import type { CanonicalDifficulty, CanonicalFormat } from "./canonicalSchema"
import { computeDifficultyCounts, type DifficultyMixCounts } from "./promptBuilder"

export interface ChapterItemInput {
  id?: string
  name: string
  grade?: string
  subject?: string
  subtopics?: string[]
}

export interface BlueprintSlot {
  slotIndex: number
  subject: string
  grade?: string
  chapters: string[]
  topics: string[]
  format: CanonicalFormat
  totalQuestions: number
  difficultyCounts: DifficultyMixCounts
  marks: number
  negativeMark: number
}

export interface ClassWeightagePlan {
  class11Count: number
  class12Count: number
}

/**
 * Splits `totalQuestions` across weighted buckets using Hamilton largest-remainder rounding
 * so the sum ALWAYS equals `totalQuestions`.
 */
export function allocateByWeights(totalQuestions: number, weights: number[]): number[] {
  const total = Math.max(0, Math.round(totalQuestions))
  if (weights.length === 0) return []
  if (total === 0) return weights.map(() => 0)

  const positiveWeights = weights.map((w) => Math.max(0, Number(w) || 0))
  const sum = positiveWeights.reduce((a, b) => a + b, 0)
  if (sum <= 0) {
    // Uniform fallback when all weights are zero
    const base = Math.floor(total / weights.length)
    const rem = total - base * weights.length
    return weights.map((_, i) => base + (i < rem ? 1 : 0))
  }

  const exact = positiveWeights.map((w) => (total * w) / sum)
  const floors = exact.map((e, idx) => ({
    idx,
    count: Math.floor(e),
    rem: e - Math.floor(e),
  }))

  let remaining = total - floors.reduce((s, f) => s + f.count, 0)
  const order = [...floors].sort((a, b) => b.rem - a.rem)
  for (let i = 0; i < remaining; i++) {
    order[i % order.length].count += 1
  }

  return floors.sort((a, b) => a.idx - b.idx).map((f) => f.count)
}

/**
 * Computes exact integer question counts for Class 11 vs Class 12 WITHOUT fabricating
 * unselected class chapters. If only Class 11 chapters exist, 100% goes to Class 11;
 * if only Class 12 chapters exist, 100% goes to Class 12.
 */
export function resolveClassDistribution(params: {
  totalQuestions: number
  hasClass11Chapters: boolean
  hasClass12Chapters: boolean
  gradeFilter?: "11" | "12" | "both" | string
  class11WeightPercent?: number
}): ClassWeightagePlan {
  const { totalQuestions, hasClass11Chapters, hasClass12Chapters, gradeFilter, class11WeightPercent } = params
  const total = Math.max(0, Math.round(totalQuestions))

  if (gradeFilter === "11" || (hasClass11Chapters && !hasClass12Chapters)) {
    return { class11Count: total, class12Count: 0 }
  }
  if (gradeFilter === "12" || (hasClass12Chapters && !hasClass11Chapters)) {
    return { class11Count: 0, class12Count: total }
  }
  if (!hasClass11Chapters && !hasClass12Chapters) {
    // General syllabus without grade split (e.g. uploaded PDF / custom topics)
    return { class11Count: 0, class12Count: 0 }
  }

  const w11 = Math.min(100, Math.max(0, Number(class11WeightPercent ?? 50)))
  const w12 = 100 - w11
  const [class11Count, class12Count] = allocateByWeights(total, [w11, w12])
  return { class11Count, class12Count }
}

/**
 * Slices an overall DifficultyMixCounts across sequential sub-batches proportionally
 * so summing every sub-batch yields the exact parent easy/medium/hard totals!
 */
export function partitionDifficultyAcrossBatches(
  overallCounts: DifficultyMixCounts,
  batchSizes: number[]
): DifficultyMixCounts[] {
  const sumBatches = batchSizes.reduce((a, b) => a + b, 0)
  if (batchSizes.length === 0) return []
  if (sumBatches === 0) return batchSizes.map(() => ({ easy: 0, medium: 0, hard: 0 }))

  // Allocate Easy and Hard by batch weights, capping each batch cleanly at batchSizes[i],
  // then fill remaining slots in each batch as Medium so every batch sums to batchSizes[i]
  // and overall Easy/Medium/Hard totals match exactly!
  const result: DifficultyMixCounts[] = batchSizes.map(() => ({ easy: 0, medium: 0, hard: 0 }))
  const remainingCap = [...batchSizes]

  const assignDifficulty = (key: CanonicalDifficulty, targetTotal: number) => {
    let left = Math.min(targetTotal, remainingCap.reduce((a, b) => a + b, 0))
    const rawAlloc = allocateByWeights(left, remainingCap)
    for (let i = 0; i < batchSizes.length; i++) {
      const give = Math.min(rawAlloc[i], remainingCap[i], left)
      result[i][key] += give
      remainingCap[i] -= give
      left -= give
    }
    // Distribute any leftover due to cap collisions
    for (let i = 0; i < batchSizes.length && left > 0; i++) {
      const give = Math.min(remainingCap[i], left)
      result[i][key] += give
      remainingCap[i] -= give
      left -= give
    }
  }

  assignDifficulty("easy", overallCounts.easy)
  assignDifficulty("hard", overallCounts.hard)
  for (let i = 0; i < batchSizes.length; i++) {
    result[i].medium += remainingCap[i]
  }

  return result
}

/**
 * Plans exact generation batches for a subject/grade/format configuration, ensuring
 * max batch size never exceeds Gemini reliability bounds while keeping global difficulty ratios exact.
 */
export function planSubjectGenerationSlots(params: {
  subject: string
  totalQuestions: number
  difficultyMode: string
  customDifficultyRatio?: Partial<{ easy: number; medium: number; hard: number }>
  gradeFilter?: "11" | "12" | "both" | string
  class11WeightPercent?: number
  chapters: ChapterItemInput[]
  fallbackTopics?: string[]
  formatWeights: Array<{ format: CanonicalFormat; count?: number; weightPercent?: number }>
  marks: number
  negativeMark: number
  maxBatchSize?: number
}): BlueprintSlot[] {
  const total = Math.max(0, Math.round(params.totalQuestions))
  if (total === 0) return []

  const maxBatchSize = Math.max(4, Math.min(20, params.maxBatchSize ?? 12))
  const ch11 = params.chapters.filter((c) => c.grade === "11")
  const ch12 = params.chapters.filter((c) => c.grade === "12")
  const chOther = params.chapters.filter((c) => c.grade !== "11" && c.grade !== "12")

  const has11 = ch11.length > 0
  const has12 = ch12.length > 0

  const gradeBuckets: Array<{ grade?: string; count: number; chapters: ChapterItemInput[] }> = []

  if (has11 || has12) {
    const classDist = resolveClassDistribution({
      totalQuestions: total,
      hasClass11Chapters: has11,
      hasClass12Chapters: has12,
      gradeFilter: params.gradeFilter,
      class11WeightPercent: params.class11WeightPercent,
    })
    if (classDist.class11Count > 0 && has11) {
      gradeBuckets.push({ grade: "11", count: classDist.class11Count, chapters: ch11 })
    }
    if (classDist.class12Count > 0 && has12) {
      gradeBuckets.push({ grade: "12", count: classDist.class12Count, chapters: ch12 })
    }
    if (gradeBuckets.length === 0) {
      // Edge case: chapters specified, e.g. gradeFilter didn't match — keep selected chapters instead of pulling unselected ones
      gradeBuckets.push({
        grade: params.gradeFilter && params.gradeFilter !== "both" ? params.gradeFilter : undefined,
        count: total,
        chapters: params.chapters,
      })
    }
  } else {
    gradeBuckets.push({
      grade: params.gradeFilter && params.gradeFilter !== "both" ? params.gradeFilter : undefined,
      count: total,
      chapters: chOther,
    })
  }

  // Partition global difficulty counts cleanly across all final micro-batches
  const globalDiffCounts = computeDifficultyCounts(
    total,
    params.difficultyMode,
    params.customDifficultyRatio
  )

  const preSlots: Array<Omit<BlueprintSlot, "slotIndex" | "difficultyCounts">> = []

  for (const bucket of gradeBuckets) {
    const fmtItems = params.formatWeights.length > 0
      ? params.formatWeights
      : [{ format: "mcq_single" as CanonicalFormat, weightPercent: 100 }]

    // Support exact counts or percentage weights cleanly
    const fmtCounts = allocateByWeights(
      bucket.count,
      fmtItems.map((f) => (typeof f.count === "number" ? f.count : Number(f.weightPercent ?? 1)))
    )

    const chapterNames = bucket.chapters.map((c) => c.name)
    const chapterTopics = bucket.chapters.flatMap((c) => c.subtopics || [])
    const combinedTopics = Array.from(
      new Set([...(chapterTopics || []), ...(params.fallbackTopics || [])])
    )

    fmtItems.forEach((fmt, idx) => {
      let remaining = fmtCounts[idx]
      while (remaining > 0) {
        const take = Math.min(maxBatchSize, remaining)
        preSlots.push({
          subject: params.subject,
          grade: bucket.grade,
          chapters: chapterNames,
          topics: combinedTopics,
          format: fmt.format,
          totalQuestions: take,
          marks: params.marks,
          negativeMark: params.negativeMark,
        })
        remaining -= take
      }
    })
  }

  const batchDiffs = partitionDifficultyAcrossBatches(
    globalDiffCounts,
    preSlots.map((s) => s.totalQuestions)
  )

  return preSlots.map((s, idx) => ({
    ...s,
    slotIndex: idx,
    difficultyCounts: batchDiffs[idx],
  }))
}
