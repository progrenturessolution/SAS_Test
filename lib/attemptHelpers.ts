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
