import { z } from "zod"

export const CANONICAL_FORMATS = [
  "mcq_single",
  "mcq_multi",
  "assertion",
  "true_false",
  "fib",
  "descriptive",
  "diagram",
  "coding",
] as const

export type CanonicalFormat = (typeof CANONICAL_FORMATS)[number]

export const CANONICAL_DB_TYPES = [
  "mcq",
  "mcq_multi",
  "assertion",
  "truefalse",
  "fillblanks",
  "descriptive",
  "diagram",
  "coding",
] as const

export type CanonicalDbType = (typeof CANONICAL_DB_TYPES)[number]

export const CANONICAL_DIFFICULTIES = ["easy", "medium", "hard"] as const
export type CanonicalDifficulty = (typeof CANONICAL_DIFFICULTIES)[number]

export interface CanonicalBlank {
  id: number
  label?: string
  answer: string
  alsoAccept: string[]
  caseInsensitive: boolean
}

export interface CanonicalCodingTestCase {
  input: string
  expectedOutput: string
  explanation?: string
}

export interface CanonicalQuestion {
  id: string
  type: CanonicalDbType
  questionFormat: CanonicalFormat
  questionText: string
  subject?: string
  chapter?: string
  topic?: string
  classLevel?: string
  difficulty: CanonicalDifficulty
  marks: number
  negativeMark: number
  options?: string[]
  correctAnswer: string | string[]
  assertionText?: string
  reasonText?: string
  blanks?: CanonicalBlank[]
  caseInsensitive?: boolean
  modelAnswer?: string
  rubric?: string[]
  wordLimit?: number
  questionImage?: string
  explanation: string
  learningObjective?: string
  pyqReference?: string
  conceptTags?: string[]
  // Coding fields preserved cleanly for ExamWizard compatibility
  codeTemplate?: string
  codeTemplates?: Record<string, string>
  driverCode?: Record<string, string>
  testCases?: CanonicalCodingTestCase[]
  constraints?: string[]
  languages?: string[]
}

export const CanonicalBlankZodSchema = z.object({
  id: z.number().int().min(1),
  label: z.string().optional(),
  answer: z.string().trim().min(1),
  alsoAccept: z.array(z.string().trim()).default([]),
  caseInsensitive: z.boolean().default(true),
})

export const CanonicalQuestionZodSchema = z.object({
  id: z.string().trim().min(1),
  type: z.enum(CANONICAL_DB_TYPES),
  questionFormat: z.enum(CANONICAL_FORMATS),
  questionText: z.string().trim().min(5),
  subject: z.string().trim().optional(),
  chapter: z.string().trim().optional(),
  topic: z.string().trim().optional(),
  classLevel: z.string().trim().optional(),
  difficulty: z.enum(CANONICAL_DIFFICULTIES),
  marks: z.number().positive(),
  negativeMark: z.number().min(0),
  options: z.array(z.string().trim().min(1)).optional(),
  correctAnswer: z.union([z.string(), z.array(z.string())]),
  assertionText: z.string().trim().optional(),
  reasonText: z.string().trim().optional(),
  blanks: z.array(CanonicalBlankZodSchema).optional(),
  caseInsensitive: z.boolean().optional(),
  modelAnswer: z.string().trim().optional(),
  rubric: z.array(z.string().trim().min(1)).optional(),
  wordLimit: z.number().int().positive().optional(),
  questionImage: z.string().trim().optional(),
  explanation: z.string(),
  learningObjective: z.string().trim().optional(),
  pyqReference: z.string().trim().optional(),
  conceptTags: z.array(z.string().trim()).optional(),
})

export const STANDARD_ASSERTION_OPTIONS = [
  "Both Assertion (A) and Reason (R) are true, and Reason (R) is the correct explanation of Assertion (A).",
  "Both Assertion (A) and Reason (R) are true, but Reason (R) is NOT the correct explanation of Assertion (A).",
  "Assertion (A) is true, but Reason (R) is false.",
  "Assertion (A) is false, but Reason (R) is true.",
] as const

export function normalizeFormatInput(
  rawFormat?: string | null,
  rawQuestion?: Record<string, unknown>
): CanonicalFormat {
  const f = String(rawFormat || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")

  if (f === "mcq_multi" || f === "mcq_multiple" || f === "multiple_correct" || f === "multi_correct") {
    return "mcq_multi"
  }
  if (f === "assertion" || f === "assertion_reason") {
    return "assertion"
  }
  if (f === "true_false" || f === "truefalse" || f === "tf") {
    return "true_false"
  }
  if (f === "fib" || f === "fillblanks" || f === "fill_blanks" || f === "fill_in_the_blanks") {
    return "fib"
  }
  if (
    f === "descriptive" ||
    f === "long_descriptive" ||
    f === "long_answer" ||
    f === "short_answer" ||
    f === "case_study" ||
    f === "subjective"
  ) {
    return "descriptive"
  }
  if (f === "diagram" || f === "diagram_based") {
    return "diagram"
  }
  if (f === "coding") {
    return "coding"
  }

  // Fallback inspection of rawQuestion shape when format string is missing or "mcq"
  if (rawQuestion) {
    const qFormat = String(rawQuestion.questionFormat || "")
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, "_")
    if (qFormat && qFormat !== f) {
      return normalizeFormatInput(qFormat, { ...rawQuestion, questionFormat: undefined })
    }
    if (Array.isArray(rawQuestion.correctAnswer) && rawQuestion.correctAnswer.length >= 2) {
      return "mcq_multi"
    }
    if (Array.isArray(rawQuestion.blanks) && rawQuestion.blanks.length > 0) {
      return "fib"
    }
    if (
      typeof rawQuestion.modelAnswer === "string" &&
      rawQuestion.modelAnswer.trim().length > 0 &&
      (!Array.isArray(rawQuestion.options) || rawQuestion.options.length === 0)
    ) {
      return "descriptive"
    }
    if (
      typeof rawQuestion.assertionText === "string" &&
      rawQuestion.assertionText.trim().length > 0 &&
      typeof rawQuestion.reasonText === "string" &&
      rawQuestion.reasonText.trim().length > 0
    ) {
      return "assertion"
    }
    if (
      typeof rawQuestion.questionImage === "string" &&
      rawQuestion.questionImage.trim().startsWith("<svg") &&
      f !== "mcq_single" &&
      f !== "mcq"
    ) {
      return "diagram"
    }
  }

  return "mcq_single"
}

export function formatToDbType(format: CanonicalFormat): CanonicalDbType {
  switch (format) {
    case "mcq_single":
      return "mcq"
    case "mcq_multi":
      return "mcq_multi"
    case "assertion":
      return "assertion"
    case "true_false":
      return "truefalse"
    case "fib":
      return "fillblanks"
    case "descriptive":
      return "descriptive"
    case "diagram":
      return "diagram"
    case "coding":
      return "coding"
  }
}

export function normalizeDifficulty(raw?: unknown): CanonicalDifficulty {
  const d = String(raw || "").trim().toLowerCase()
  if (d === "easy" || d === "hard") return d
  return "medium"
}

export function parseWordLimit(raw: unknown): number | undefined {
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
    return Math.round(raw)
  }
  if (typeof raw === "string") {
    const matches = raw.match(/\d+/g)
    if (matches && matches.length > 0) {
      const last = Number(matches[matches.length - 1])
      if (Number.isFinite(last) && last > 0) return last
    }
  }
  return undefined
}

export function cleanOptionList(rawOptions: unknown): string[] {
  if (!Array.isArray(rawOptions)) return []
  const trimmed = rawOptions.map((o) => String(o ?? "").trim())
  // Strip A) / B) / (A) / A. prefixes only if >= 3 options consistently carry sequential letter prefixes
  const letterPrefixRegex = /^\(?([A-Da-d])\)?[\)\.\:\-]\s+(.+)$/
  const prefixedCount = trimmed.filter((o, idx) => {
    const m = o.match(letterPrefixRegex)
    if (!m) return false
    const expectedLetter = String.fromCharCode(65 + idx)
    return m[1].toUpperCase() === expectedLetter
  }).length

  if (trimmed.length === 4 && prefixedCount >= 3) {
    return trimmed.map((o) => {
      const m = o.match(letterPrefixRegex)
      return m ? m[2].trim() : o
    })
  }
  return trimmed
}

export function normalizeCompareText(value: unknown): string {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
}

export function resolveSingleOptionAnswer(rawAnswer: unknown, options: string[]): string | null {
  if (!Array.isArray(options) || options.length === 0) return null

  const candidate = Array.isArray(rawAnswer)
    ? (rawAnswer.length === 1 ? String(rawAnswer[0] ?? "") : "")
    : String(rawAnswer ?? "")

  const trimmed = candidate.trim()
  if (!trimmed) return null

  // 1. Direct exact or normalized string match
  const exactIdx = options.findIndex((o) => o.trim() === trimmed)
  if (exactIdx !== -1) return options[exactIdx]

  const normCandidate = normalizeCompareText(trimmed)
  const normIdx = options.findIndex((o) => normalizeCompareText(o) === normCandidate)
  if (normIdx !== -1) return options[normIdx]

  // 2. Stripped prefix match ("A) value" -> "value")
  const strippedCandidate = trimmed.replace(/^\(?([A-Da-d])\)?[\)\.\:\-]\s+/, "").trim()
  if (strippedCandidate !== trimmed) {
    const strippedIdx = options.findIndex(
      (o) => normalizeCompareText(o) === normalizeCompareText(strippedCandidate)
    )
    if (strippedIdx !== -1) return options[strippedIdx]
  }

  // 3. Explicit letter ("A", "B", "C", "D", "Option A", "(C)", "Statement A")
  const letterMatch = trimmed.match(/^(?:option|choice|ans|answer)?\s*\(?([A-Da-d])\)?[\.\)]?$/i)
  if (letterMatch) {
    const idx = letterMatch[1].toUpperCase().charCodeAt(0) - 65
    if (idx >= 0 && idx < options.length) return options[idx]
  }

  // 4. 1-based numeric index ("1", "2", "3", "4") ONLY when options themselves are NOT just integers 1..4
  if (/^[1-4]$/.test(trimmed)) {
    const optionsArePureDigits = options.every((o) => /^\d+$/.test(o.trim()))
    if (!optionsArePureDigits) {
      const idx = Number(trimmed) - 1
      if (idx >= 0 && idx < options.length) return options[idx]
    }
  }

  return null
}

export function resolveMultiOptionAnswers(rawAnswer: unknown, options: string[]): string[] | null {
  if (!Array.isArray(options) || options.length === 0) return null

  let rawTokens: string[] = []
  if (Array.isArray(rawAnswer)) {
    rawTokens = rawAnswer.map((v) => String(v ?? "").trim()).filter(Boolean)
  } else if (typeof rawAnswer === "string") {
    const s = rawAnswer.trim()
    if (!s) return null
    if (s.startsWith("[") && s.endsWith("]")) {
      try {
        const parsed = JSON.parse(s)
        if (Array.isArray(parsed)) {
          rawTokens = parsed.map((v) => String(v ?? "").trim()).filter(Boolean)
        }
      } catch {
        rawTokens = s.slice(1, -1).split(/[,;&]+/).map((t) => t.trim()).filter(Boolean)
      }
    } else if (/^[\(\[]?[A-Da-d][\)\]]?(\s*[,;&\/\+]\s*[\(\[]?[A-Da-d][\)\]]?)+$/i.test(s)) {
      rawTokens = s.split(/[,;&\/\+]+/).map((t) => t.trim()).filter(Boolean)
    } else if (s.includes(",")) {
      // Split by comma only if individual pieces resolve cleanly
      const parts = s.split(",").map((t) => t.trim()).filter(Boolean)
      const resolvedParts = parts.map((p) => resolveSingleOptionAnswer(p, options))
      if (resolvedParts.every((r) => r !== null)) {
        rawTokens = parts
      } else {
        rawTokens = [s]
      }
    } else {
      rawTokens = [s]
    }
  }

  if (rawTokens.length === 0) return null

  const resolved: string[] = []
  for (const token of rawTokens) {
    const match = resolveSingleOptionAnswer(token, options)
    if (!match) return null
    if (!resolved.includes(match)) resolved.push(match)
  }

  return resolved
}

export function parseAssertionReasonParts(questionText: string): { assertionText: string; reasonText: string } | null {
  const m = String(questionText || "").match(
    /Assertion\s*(?:\(A\))?\s*:\s*([\s\S]*?)\s*(?:\n+|\r+|\s+)Reason\s*(?:\(R\))?\s*:\s*([\s\S]*)/i
  )
  if (!m) return null
  return {
    assertionText: m[1].trim(),
    reasonText: m[2].trim(),
  }
}

export function countBlankMarkers(questionText: string): number {
  const matches = String(questionText || "").match(/_{2,}/g)
  return matches ? matches.length : 0
}

export function normalizeTrueFalseAnswer(raw: unknown): "True" | "False" | null {
  const s = normalizeCompareText(raw)
  if (s === "true" || s === "t") return "True"
  if (s === "false" || s === "f") return "False"
  return null
}

/**
 * Normalizes a stored MongoDB question (including legacy formats) into CanonicalQuestion.
 * Preserves backward compatibility with historical data while standardizing downstream consumers.
 */
export function normalizeStoredQuestion(raw: any, fallbackIndex = 0): CanonicalQuestion {
  const format = normalizeFormatInput(raw?.questionFormat || raw?.type, raw)
  const dbType = formatToDbType(format)
  const id = String(raw?.id || raw?._id || `q_${fallbackIndex + 1}`)
  const marks = Number(raw?.marks) > 0 ? Number(raw.marks) : 4
  const negativeMark = Number(raw?.negativeMark) >= 0 ? Number(raw.negativeMark) : 0
  const difficulty = normalizeDifficulty(raw?.difficulty)

  const base: CanonicalQuestion = {
    id,
    type: dbType,
    questionFormat: format,
    questionText: String(raw?.questionText || "").trim(),
    subject: raw?.subject ? String(raw.subject).trim() : undefined,
    chapter: raw?.chapter ? String(raw.chapter).trim() : undefined,
    topic: raw?.topic ? String(raw.topic).trim() : undefined,
    classLevel: raw?.classLevel ? String(raw.classLevel).trim() : undefined,
    difficulty,
    marks,
    negativeMark,
    correctAnswer: "",
    explanation: String(raw?.explanation || "").trim(),
    questionImage: typeof raw?.questionImage === "string" && raw.questionImage.trim()
      ? raw.questionImage.trim()
      : undefined,
    learningObjective: raw?.learningObjective ? String(raw.learningObjective).trim() : undefined,
    pyqReference: raw?.pyqReference ? String(raw.pyqReference).trim() : undefined,
    conceptTags: Array.isArray(raw?.conceptTags) ? raw.conceptTags.map((t: unknown) => String(t)) : undefined,
  }

  if (format === "descriptive") {
    const modelAnswer = String(raw?.modelAnswer || raw?.correctAnswer || "").trim()
    const rubric = Array.isArray(raw?.rubric)
      ? raw.rubric.map((r: unknown) => String(r || "").trim()).filter(Boolean)
      : []
    const wl = parseWordLimit(raw?.wordLimit)
    return {
      ...base,
      options: undefined,
      modelAnswer,
      rubric,
      wordLimit: wl,
      correctAnswer: modelAnswer,
      explanation: base.explanation || (rubric.length > 0 ? rubric.join(" | ") : ""),
    }
  }

  if (format === "true_false") {
    const tf = normalizeTrueFalseAnswer(raw?.correctAnswer)
    return {
      ...base,
      options: undefined,
      correctAnswer: tf || String(raw?.correctAnswer || "").trim(),
    }
  }

  if (format === "fib") {
    const cleanOpts = cleanOptionList(raw?.options)
    const rawBlanks = Array.isArray(raw?.blanks) ? raw.blanks : []
    let blanks: CanonicalBlank[] = rawBlanks
      .map((b: any, i: number) => ({
        id: Number(b?.id) || i + 1,
        label: b?.label ? String(b.label) : `Blank ${i + 1}`,
        answer: String(b?.answer || "").trim(),
        alsoAccept: Array.isArray(b?.alsoAccept)
          ? b.alsoAccept.map((a: unknown) => String(a || "").trim()).filter(Boolean)
          : [],
        caseInsensitive: b?.caseInsensitive !== false && raw?.caseInsensitive !== false,
      }))
      .filter((b: CanonicalBlank) => b.answer.length > 0)

    const resolvedOpt = cleanOpts.length > 0 ? resolveSingleOptionAnswer(raw?.correctAnswer, cleanOpts) : null
    if (blanks.length === 0 && (resolvedOpt || (typeof raw?.correctAnswer === "string" && raw.correctAnswer.trim()))) {
      blanks = [
        {
          id: 1,
          label: "Blank 1",
          answer: resolvedOpt || String(raw.correctAnswer).trim(),
          alsoAccept: [],
          caseInsensitive: raw?.caseInsensitive !== false,
        },
      ]
    }

    return {
      ...base,
      options: cleanOpts.length > 0 ? cleanOpts : undefined,
      blanks,
      caseInsensitive: raw?.caseInsensitive !== false,
      correctAnswer: resolvedOpt || blanks.map((b) => b.answer).join(", "),
    }
  }

  if (format === "assertion") {
    const parsed = parseAssertionReasonParts(base.questionText)
    const aText = String(raw?.assertionText || parsed?.assertionText || "").trim()
    const rText = String(raw?.reasonText || parsed?.reasonText || "").trim()
    const cleanOpts = cleanOptionList(raw?.options)
    const opts = cleanOpts.length === 4 ? cleanOpts : [...STANDARD_ASSERTION_OPTIONS]
    const resolved = resolveSingleOptionAnswer(raw?.correctAnswer, opts)
    const fullText =
      base.questionText ||
      (aText && rText ? `Assertion (A): ${aText}\nReason (R): ${rText}` : "")
    return {
      ...base,
      questionText: fullText,
      assertionText: aText || undefined,
      reasonText: rText || undefined,
      options: opts,
      correctAnswer: resolved || String(raw?.correctAnswer || "").trim(),
    }
  }

  if (format === "mcq_multi") {
    const cleanOpts = cleanOptionList(raw?.options)
    const resolved = resolveMultiOptionAnswers(raw?.correctAnswer, cleanOpts)
    return {
      ...base,
      options: cleanOpts,
      correctAnswer: resolved ?? (Array.isArray(raw?.correctAnswer) ? raw.correctAnswer.map(String) : []),
    }
  }

  if (format === "coding") {
    return {
      ...base,
      correctAnswer: String(raw?.correctAnswer || "").trim(),
      codeTemplate: raw?.codeTemplate,
      codeTemplates: raw?.codeTemplates,
      driverCode: raw?.driverCode,
      testCases: raw?.testCases,
      constraints: raw?.constraints,
      languages: raw?.languages,
    }
  }

  // mcq_single or diagram
  const cleanOpts = cleanOptionList(raw?.options)
  const resolved = resolveSingleOptionAnswer(raw?.correctAnswer, cleanOpts)
  return {
    ...base,
    options: cleanOpts,
    correctAnswer: resolved || String(raw?.correctAnswer || "").trim(),
  }
}

/**
 * Converts a CanonicalQuestion into the Exam Schema persistence payload expected by MongoDB.
 */
export function toExamQuestionPayload(q: CanonicalQuestion): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    id: q.id,
    type: q.type,
    questionFormat: q.questionFormat,
    questionText: q.questionText,
    difficulty: q.difficulty,
    marks: q.marks,
    negativeMark: q.negativeMark,
    explanation: q.explanation || "",
    correctAnswer: q.correctAnswer,
  }

  if (q.subject) payload.subject = q.subject
  if (q.chapter) payload.chapter = q.chapter
  if (q.topic) payload.topic = q.topic
  if (q.classLevel) payload.classLevel = q.classLevel
  if (q.questionImage) payload.questionImage = q.questionImage
  if (q.learningObjective) payload.learningObjective = q.learningObjective
  if (q.pyqReference) payload.pyqReference = q.pyqReference
  if (q.conceptTags?.length) payload.conceptTags = q.conceptTags

  if (q.questionFormat === "descriptive") {
    payload.modelAnswer = q.modelAnswer || (typeof q.correctAnswer === "string" ? q.correctAnswer : "")
    payload.rubric = Array.isArray(q.rubric) ? q.rubric : []
    if (q.wordLimit) payload.wordLimit = q.wordLimit
    // Strictly never emit MCQ options on descriptive questions
  } else if (q.questionFormat === "fib") {
    if (Array.isArray(q.blanks) && q.blanks.length > 0) {
      payload.blanks = q.blanks.map((b, i) => ({
        id: b.id || i + 1,
        label: b.label || `Blank ${i + 1}`,
        answer: b.answer,
        alsoAccept: Array.isArray(b.alsoAccept) ? b.alsoAccept : [],
      }))
    }
    payload.caseInsensitive = q.caseInsensitive !== false
    if (Array.isArray(q.options) && q.options.length > 0) {
      payload.options = q.options
    }
  } else if (q.questionFormat === "assertion") {
    if (q.assertionText) payload.assertionText = q.assertionText
    if (q.reasonText) payload.reasonText = q.reasonText
    if (Array.isArray(q.options)) payload.options = q.options
  } else if (
    q.questionFormat === "mcq_single" ||
    q.questionFormat === "mcq_multi" ||
    q.questionFormat === "diagram"
  ) {
    payload.options = Array.isArray(q.options) ? q.options : []
  } else if (q.questionFormat === "coding") {
    payload.codeTemplate = q.codeTemplate
    payload.codeTemplates = q.codeTemplates
    payload.driverCode = q.driverCode
    payload.testCases = q.testCases
    payload.constraints = q.constraints
    payload.languages = q.languages
  }

  return payload
}

