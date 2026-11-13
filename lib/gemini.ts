/**
 * Gemini API Key Pool and Failover Manager
 * 
 * Supports multiple Gemini API keys from .env:
 * - GEMINI_API_KEY
 * - GEMINI_API_KEY_2
 * - GEMINI_API_KEY_3
 * - GEMINI_API_KEY_4
 * - GEMINI_API_KEY_5
 * 
 * Features:
 * 1. Round-Robin Load Balancing across all configured keys.
 * 2. Automatic Failover: If a key hits 429 (Rate Limit), quota exhausted, or 403,
 *    it automatically switches to the next available key in the pool.
 * 3. Model Fallback: Tries gemini-3.5-flash-lite, then gemini-3.8-flash.
 * 4. 20-second AbortController timeout to prevent hanging.
 */

// Live verified Gemini models (no 2.5 models per user request)
export const DEFAULT_GEMINI_MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-flash-latest",
  "gemini-3.8-flash",
]

/**
 * Reads all configured Gemini API keys from process.env
 */
export function getGeminiApiKeys(): string[] {
  const keys: string[] = []

  // Primary key
  if (process.env.GEMINI_API_KEY?.trim()) {
    keys.push(process.env.GEMINI_API_KEY.trim())
  }

  // Secondary indexed keys GEMINI_API_KEY_1 .. GEMINI_API_KEY_10
  for (let i = 1; i <= 10; i++) {
    const key = process.env[`GEMINI_API_KEY_${i}`]?.trim()
    if (key && !keys.includes(key)) {
      keys.push(key)
    }
  }

  // Comma-separated GEMINI_API_KEYS (if configured)
  if (process.env.GEMINI_API_KEYS) {
    const split = process.env.GEMINI_API_KEYS.split(",")
      .map(k => k.trim())
      .filter(Boolean)
    for (const k of split) {
      if (!keys.includes(k)) keys.push(k)
    }
  }

  return keys
}

// Global round-robin index pointer (in-memory across server requests)
let currentKeyPointer = 0

export interface GeminiCallPayload {
  contents: Array<{
    role?: string
    parts: Array<{ text: string }>
  }>
  generationConfig?: {
    temperature?: number
    topP?: number
    topK?: number
    maxOutputTokens?: number
    responseMimeType?: string
  }
}

export interface GeminiCallOptions {
  payload: GeminiCallPayload
  models?: string[]
  timeoutMs?: number
}

export interface GeminiCallResult {
  text: string
  usedKeyIndex: number
  totalKeys: number
  usedModel: string
}

/**
 * Execute Gemini generateContent with round-robin load balancing and instant failover.
 */
export async function generateContentWithKeyRotation(
  options: GeminiCallOptions
): Promise<GeminiCallResult> {
  const keys = getGeminiApiKeys()
  if (keys.length === 0) {
    throw new Error("No Gemini API keys configured. Please add GEMINI_API_KEY in .env")
  }

  const models = options.models && options.models.length > 0 ? options.models : DEFAULT_GEMINI_MODELS
  const timeoutMs = options.timeoutMs || 45000

  // Determine starting key using round-robin pointer
  const startIndex = currentKeyPointer % keys.length
  currentKeyPointer = (currentKeyPointer + 1) % keys.length

  let lastErrorMessage = ""

  // Iterate through all available keys starting from startIndex
  for (let attempt = 0; attempt < keys.length; attempt++) {
    const keyIndex = (startIndex + attempt) % keys.length
    const apiKey = keys[keyIndex]
    const maskedKey = apiKey.length > 12 
      ? `${apiKey.substring(0, 6)}...${apiKey.substring(apiKey.length - 4)}` 
      : "***"

    for (const model of models) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
            body: JSON.stringify(options.payload),
          }
        )
        clearTimeout(timeoutId)

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          const errorMsg = errData?.error?.message || `HTTP ${res.status} ${res.statusText}`
          lastErrorMessage = errorMsg
          console.warn(`[GeminiPool] Key ${keyIndex + 1}/${keys.length} (${maskedKey}) on ${model} failed: ${errorMsg}`)

          // If rate limit (429), quota exceeded, or key permission error, failover to NEXT key
          const isQuotaOrAuth = 
            res.status === 429 ||
            res.status === 403 ||
            errorMsg.toLowerCase().includes("quota") ||
            errorMsg.toLowerCase().includes("resource_exhausted") ||
            errorMsg.toLowerCase().includes("api_key")

          if (isQuotaOrAuth) {
            console.warn(`[GeminiPool] Quota/Auth issue on Key ${keyIndex + 1}. Switching to next key in pool...`)
            break // Break model loop, proceed to next key
          }

          continue // Try fallback model with same key
        }

        const data = await res.json()
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ""

        if (text) {
          console.log(`[GeminiPool] Successfully generated using Key ${keyIndex + 1}/${keys.length} (${model})`)
          // Update pointer to next key after success for balanced rotation
          currentKeyPointer = (keyIndex + 1) % keys.length
          return {
            text,
            usedKeyIndex: keyIndex + 1,
            totalKeys: keys.length,
            usedModel: model,
          }
        }
      } catch (err: any) {
        const isTimeout = err?.name === "AbortError"
        lastErrorMessage = isTimeout 
          ? `Timeout after ${timeoutMs}ms` 
          : (err?.message || "Network request failed")
        console.warn(`[GeminiPool] Key ${keyIndex + 1}/${keys.length} (${model}) threw error: ${lastErrorMessage}`)
        
        // On timeout, aborting all remaining models for this key to prevent long cascading delays
        if (isTimeout) {
          console.warn(`[GeminiPool] Key ${keyIndex + 1} timed out. Skipping remaining models for this key.`)
          break
        }
      }
    }
  }

  throw new Error(`All ${keys.length} Gemini API key(s) failed. Last error: ${lastErrorMessage}`)
}
