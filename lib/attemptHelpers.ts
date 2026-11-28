export interface StoredAnswerItem {
  questionId: string
  sectionType?: string
  answer: string | string[]
  isMarkedForReview?: boolean
}

function hasNonEmptyValue(val: unknown): boolean {
  if (Array.isArray(val)) return val.some((v) => String(v ?? "").trim().length > 0)
  return String(val ?? "").trim().length > 0
}

/**
 * Safely merges persisted attempt answers with newly submitted/autosaved answers
 * so stale client closures, empty arrays, or offline retries never wipe saved progress.
 */
export function mergeAttemptAnswers<T extends StoredAnswerItem>(
  existing: T[] | null | undefined,
  incoming: T[] | null | undefined,
  options?: { preserveNonEmptyOnEmptyIncoming?: boolean }
): T[] {
  const existingList = Array.isArray(existing) ? existing : []
  const incomingList = Array.isArray(incoming) ? incoming : []

  if (incomingList.length === 0) {
    return existingList.map((item) => ({ ...item }))
  }

  const byId = new Map<string, T>()
  const order: string[] = []

  for (const item of existingList) {
    const qId = String(item?.questionId || "").trim()
    if (!qId) continue
    byId.set(qId, { ...item, questionId: qId })
    order.push(qId)
  }

  for (const item of incomingList) {
    const qId = String(item?.questionId || "").trim()
    if (!qId) continue
    const prev = byId.get(qId)
    if (!prev) {
      byId.set(qId, { ...item, questionId: qId })
      order.push(qId)
      continue
    }

    const preserveExistingAnswer =
      Boolean(options?.preserveNonEmptyOnEmptyIncoming) &&
      hasNonEmptyValue(prev.answer) &&
      !hasNonEmptyValue(item.answer)

    byId.set(qId, {
      ...prev,
      ...item,
      questionId: qId,
      answer: preserveExistingAnswer ? prev.answer : item.answer,
    })
  }

  return order.map((qId) => byId.get(qId)!).filter(Boolean)
}

/**
 * Finds a student's answer entry matching either question._id or question.id.
 */
export function findAnswerForQuestion<T extends { questionId?: unknown }>(
  answers: T[] | null | undefined,
  question: { _id?: unknown; id?: unknown } | null | undefined
): T | undefined {
  if (!Array.isArray(answers) || !question) return undefined
  const objId = question._id ? String(question._id).trim() : ""
  const strId = question.id ? String(question.id).trim() : ""
  return answers.find((a) => {
    const aId = String(a?.questionId || "").trim()
    if (!aId) return false
    return (objId && aId === objId) || (strId && aId === strId)
  })
}

/**
 * Preserves public access mode (?access=public) when navigating back to the exam portal.
 */
export function getExamPortalUrl(examId: string, isPublic?: boolean): string {
  return `/exam/${examId}${isPublic ? "?access=public" : ""}`
}

/**
 * Resolves the authoritative score shown on student analytics pages so a valid
 * backend-stored score (visible to organization admins) is never overridden by 0
 * from partial client-side recalculation, while still recovering legacy 0-scored
 * DB attempts when valid answers exist in the attempt record.
 */
export function resolveAnalyticsDisplayScore(params: {
  showResults: boolean
  attemptScore?: number | null
  calculatedScore: number
  isGraded?: boolean
  hasManualGrades?: boolean
}): number {
  const { showResults, attemptScore, calculatedScore, isGraded, hasManualGrades } = params
  if (!showResults) return typeof attemptScore === "number" ? attemptScore : 0

  if (typeof attemptScore === "number" && !Number.isNaN(attemptScore)) {
    if (hasManualGrades) return attemptScore
    if (attemptScore !== 0 && (isGraded || calculatedScore === 0)) return attemptScore
    if (attemptScore === 0 && calculatedScore > 0) return calculatedScore
    return attemptScore
  }

  return calculatedScore
}

export const DEFAULT_EXAM_INSTRUCTIONS = [
  "Read all questions carefully before answering.",
  "Do not switch tabs or exit the exam screen during the test.",
  "Ensure you have completed all required questions before finishing the exam.",
] as const

const INSTRUCTION_LABEL_PREFIX_REGEX =
  /\s+(?=(?:Face Detection|Tab-Switch Prevention|Enforce Fullscreen|AI Status Analysis|Negative marking)\s*:)/gi

/**
 * Normalizes exam instructions into clean bullet items, splitting multi-line or
 * inadvertently concatenated instruction paragraphs into individual readable guidelines.
 */
export function formatExamInstructions(
  rawInstructions: string[] | string | null | undefined
): string[] {
  const chunks = Array.isArray(rawInstructions)
    ? rawInstructions.map((item) => String(item ?? ""))
    : typeof rawInstructions === "string"
      ? [rawInstructions]
      : []

  const items: string[] = []
  for (const chunk of chunks) {
    const lines = chunk
      .split(/\r?\n+/)
      .map((line) => line.trim())
      .filter(Boolean)

    for (const line of lines) {
      const labelSplit = line
        .replace(INSTRUCTION_LABEL_PREFIX_REGEX, "\n")
        .split(/\r?\n+/)
        .map((part) => part.trim())
        .filter(Boolean)

      for (const part of labelSplit) {
        if (part.length > 90 && /[.!?]\s+[A-Z]/.test(part)) {
          const sentences = part
            .split(/(?<=[.!?])\s+(?=[A-Z])/)
            .map((s) => s.trim())
            .filter(Boolean)
          items.push(...sentences)
        } else {
          items.push(part)
        }
      }
    }
  }

  return items.length > 0 ? items : [...DEFAULT_EXAM_INSTRUCTIONS]
}

const normalizeProseForCompare = (value: string) =>
  value
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()

/**
 * Returns the exam description only when it is distinct from exam instructions,
 * hiding legacy walls of text where instructions were copied into `description`.
 */
export function getCleanExamDescription(
  description: string | null | undefined,
  instructions: string[] | string | null | undefined
): string | null {
  const trimmed = String(description || "").trim()
  if (!trimmed) return null

  const normalizedDesc = normalizeProseForCompare(trimmed)
  const parsedInstructions = formatExamInstructions(instructions)
  const joinedInstructions = normalizeProseForCompare(parsedInstructions.join(" "))

  if (normalizedDesc === joinedInstructions) return null

  // Legacy generator/API payloads copied default/proctoring instructions straight into description
  const instructionFingerprints = [
    "read all questions carefully before answering",
    "ensure you have completed all required questions before finishing the exam",
    "do not switch tabs or exit the exam screen during the test",
    "face detection: sit alone",
    "tab-switch prevention:",
    "enforce fullscreen:",
    "ai status analysis:",
  ]
  const matchedFingerprints = instructionFingerprints.filter((fp) => normalizedDesc.includes(fp)).length
  if (matchedFingerprints >= 2) return null

  return trimmed
}
