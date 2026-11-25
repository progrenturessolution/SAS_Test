import { DEFAULT_GEMINI_MODELS, getGeminiApiKeys } from "../gemini"
import { robustJsonParse } from "../jsonRepair"

export interface GeminiClientRequest {
  systemInstruction?: string
  userPrompt: string
  temperature?: number
  maxOutputTokens?: number
  responseMimeType?: string
  responseJsonSchema?: Record<string, unknown>
  preferredModel?: string
  timeoutMs?: number
  maxAttemptsPerKeyModel?: number
}

export interface GeminiClientResponse {
  text: string
  modelUsed: string
  finishReason: string
  usage?: {
    promptTokenCount?: number
    candidatesTokenCount?: number
    totalTokenCount?: number
  }
  attempts: number
}

export type GeminiTransportFn = (params: {
  model: string
  apiKey: string
  payload: Record<string, unknown>
  timeoutMs: number
}) => Promise<{ status: number; bodyText: string }>

let mockTransport: GeminiTransportFn | null = null

/**
 * Allows automated tests to inject deterministic mocked Gemini API responses
 * without making network calls or consuming Gemini API quota.
 */
export function setGeminiMockTransport(fn: GeminiTransportFn | null): void {
  mockTransport = fn
}

export function sanitizeErrorMessage(msg: string): string {
  return String(msg || "").replace(/AIza[0-9A-Za-z\-_]{10,}/g, "[REDACTED_KEY]").replace(/([?&]key=)[^&\s]+/gi, "$1[REDACTED]")
}

function defaultHttpTransport(): GeminiTransportFn {
  return async ({ model, apiKey, payload, timeoutMs }) => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })
      const bodyText = await response.text()
      return { status: response.status, bodyText }
    } finally {
      clearTimeout(timer)
    }
  }
}

function buildPayload(req: GeminiClientRequest, includeSchema: boolean): Record<string, unknown> {
  const generationConfig: Record<string, unknown> = {
    temperature: req.temperature ?? 0.55,
    maxOutputTokens: req.maxOutputTokens ?? 16384,
    responseMimeType: req.responseMimeType ?? "application/json",
  }

  if (includeSchema && req.responseJsonSchema) {
    generationConfig.responseJsonSchema = req.responseJsonSchema
  }

  const payload: Record<string, unknown> = {
    contents: [{ role: "user", parts: [{ text: req.userPrompt }] }],
    generationConfig,
  }

  if (req.systemInstruction && req.systemInstruction.trim()) {
    payload.systemInstruction = {
      parts: [{ text: req.systemInstruction }],
    }
  }

  return payload
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0 || mockTransport) return Promise.resolve()
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function callGeminiStructured(
  req: GeminiClientRequest,
  transportOverride?: GeminiTransportFn
): Promise<GeminiClientResponse> {
  const transport = transportOverride || mockTransport || defaultHttpTransport()
  const isMocked = Boolean(transportOverride || mockTransport)
  const keys = isMocked && getGeminiApiKeys().length === 0 ? ["mock-api-key"] : getGeminiApiKeys()

  if (keys.length === 0) {
    throw new Error("No Gemini API keys configured in environment variables")
  }

  const models = req.preferredModel
    ? [req.preferredModel, ...DEFAULT_GEMINI_MODELS.filter((m) => m !== req.preferredModel)]
    : [...DEFAULT_GEMINI_MODELS]

  const timeoutMs = req.timeoutMs ?? 60000
  const maxRetries = req.maxAttemptsPerKeyModel ?? 2
  let totalAttempts = 0
  let lastError = "All Gemini API keys and fallback models failed"
  let schemaRejectedByModel = false

  for (const model of models) {
    for (let keyIdx = 0; keyIdx < keys.length; keyIdx++) {
      const apiKey = keys[keyIdx]

      for (let retry = 0; retry < maxRetries; retry++) {
        totalAttempts++
        const payload = buildPayload(req, !schemaRejectedByModel && Boolean(req.responseJsonSchema))

        try {
          const { status, bodyText } = await transport({ model, apiKey, payload, timeoutMs })

          if (status === 400 && !schemaRejectedByModel && req.responseJsonSchema) {
            // Some model/API versions reject complex responseJsonSchema syntax with 400
            schemaRejectedByModel = true
            retry--
            continue
          }

          if (status === 429 || status === 503 || status === 502 || status === 504) {
            lastError = `HTTP ${status} (${model})`
            const backoffMs = Math.min(2500, 350 * Math.pow(2, retry) + Math.floor(Math.random() * 150))
            await sleep(backoffMs)
            // On 429, rotate to next key immediately after brief backoff if multiple keys exist
            if (status === 429 && keys.length > 1) break
            continue
          }

          if (status >= 400) {
            lastError = sanitizeErrorMessage(`HTTP ${status} (${model}): ${bodyText.slice(0, 220)}`)
            break
          }

          const parsed = JSON.parse(bodyText)
          const candidate = parsed?.candidates?.[0]
          const finishReason = String(candidate?.finishReason || "UNKNOWN")
          const text = String(candidate?.content?.parts?.map((p: any) => p?.text || "").join("") || "").trim()

          if (!text) {
            const blockReason = parsed?.promptFeedback?.blockReason || finishReason
            lastError = `Empty response from ${model} (finishReason=${blockReason})`
            if (finishReason === "SAFETY" || finishReason === "PROHIBITED_CONTENT") {
              break // rotate model/key rather than retrying identical blocked output on same model/key
            }
            continue
          }

          return {
            text,
            modelUsed: model,
            finishReason,
            usage: parsed?.usageMetadata,
            attempts: totalAttempts,
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          lastError = sanitizeErrorMessage(`${model}: ${msg}`)
          if (retry + 1 < maxRetries) {
            await sleep(250 * (retry + 1))
          }
        }
      }
    }
  }

  throw new Error(lastError)
}

export async function callGeminiJson<T = unknown>(
  req: GeminiClientRequest,
  transportOverride?: GeminiTransportFn
): Promise<{ data: T; meta: Omit<GeminiClientResponse, "text"> }> {
  const res = await callGeminiStructured(req, transportOverride)
  const data = robustJsonParse<T>(res.text)
  return {
    data,
    meta: {
      modelUsed: res.modelUsed,
      finishReason: res.finishReason,
      usage: res.usage,
      attempts: res.attempts,
    },
  }
}

