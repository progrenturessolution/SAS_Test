import type { CanonicalDifficulty, CanonicalFormat, CanonicalQuestion } from "./canonicalSchema"
import { QuestionDeduplicator, type DuplicateReason } from "./deduplication"
import { callGeminiJson, type GeminiTransportFn } from "./geminiClient"
import { buildQuestionGenerationPrompt, computeDifficultyCounts, type DifficultyMixCounts } from "./promptBuilder"
import { validateAndCanonicalizeQuestion, verifyQuestionsAcademically } from "./validators"

export interface GenerationBatchRequest {
  examName: string
  examTarget?: string
  subject: string
  grade?: string
  chapters: string[]
  topics?: string[]
  syllabusSummary?: string
  format: CanonicalFormat
  fibMode?: "blanks" | "mcq"
  count: number
  difficulty: CanonicalDifficulty | "mixed" | "balanced" | string
  difficultyCounts?: DifficultyMixCounts
  marks: number
  negativeMark: number
  wordLimit?: number
  customInstructions?: string
  existingQuestions?: Array<Pick<CanonicalQuestion, "id" | "questionText" | "options" | "questionImage" | "learningObjective">>
  strictSyllabusCheck?: boolean
  verifyAcademically?: boolean
  preferredModel?: string
  maxRetriesForDeficit?: number
  requireExplanation?: boolean
  transportOverride?: GeminiTransportFn
}

export interface RejectedQuestionRecord {
  stage: "schema_or_academic" | "duplicate" | "ai_verifier"
  reasons: string[]
  duplicateReason?: DuplicateReason
  rawQuestionText?: string
}

export interface GenerationQualityReport {
  requestedCount: number
  acceptedCount: number
  rejectedCount: number
  duplicateCount: number
  verifierRejectedCount: number
  retriesExecuted: number
  modelsUsed: string[]
  difficultyTarget: DifficultyMixCounts
  difficultyActual: DifficultyMixCounts
  classCounts: Record<string, number>
  formatCounts: Record<string, number>
  rejectionSummary: Record<string, number>
  warnings: string[]
}

export interface GenerationBatchResponse {
  questions: CanonicalQuestion[]
  qualityReport: GenerationQualityReport
  rejected: RejectedQuestionRecord[]
}

function summarizeDifficulty(questions: CanonicalQuestion[]): DifficultyMixCounts {
  return {
    easy: questions.filter((q) => q.difficulty === "easy").length,
    medium: questions.filter((q) => q.difficulty === "medium").length,
    hard: questions.filter((q) => q.difficulty === "hard").length,
  }
}

function computeRemainingDifficultyCounts(
  target: DifficultyMixCounts,
  accepted: CanonicalQuestion[]
): DifficultyMixCounts {
  const actual = summarizeDifficulty(accepted)
  return {
    easy: Math.max(0, target.easy - actual.easy),
    medium: Math.max(0, target.medium - actual.medium),
    hard: Math.max(0, target.hard - actual.hard),
  }
}

export async function generateQuestionBatch(req: GenerationBatchRequest): Promise<GenerationBatchResponse> {
  const targetCount = Math.max(1, Math.min(30, Math.round(req.count)))
  const difficultyTarget =
    req.difficultyCounts &&
    req.difficultyCounts.easy + req.difficultyCounts.medium + req.difficultyCounts.hard === targetCount
      ? req.difficultyCounts
      : computeDifficultyCounts(targetCount, req.difficulty)

  const deduplicator = new QuestionDeduplicator(req.existingQuestions || [])
  const accepted: CanonicalQuestion[] = []
  const rejected: RejectedQuestionRecord[] = []
  const rejectionSummary: Record<string, number> = {}
  const modelsUsed = new Set<string>()
  const warnings = new Set<string>()

  const trackReject = (rec: RejectedQuestionRecord) => {
    rejected.push(rec)
    for (const r of rec.reasons) {
      const key = r.slice(0, 90)
      rejectionSummary[key] = (rejectionSummary[key] || 0) + 1
    }
  }

  const maxAttempts = 1 + (req.maxRetriesForDeficit ?? 2)
  let retriesExecuted = 0

  for (let attempt = 0; attempt < maxAttempts && accepted.length < targetCount; attempt++) {
    if (attempt > 0) retriesExecuted++

    const needed = targetCount - accepted.length
    const requestCount = attempt === 0 ? needed : Math.min(20, needed + Math.min(2, Math.ceil(needed * 0.25)))
    const remDiff = computeRemainingDifficultyCounts(difficultyTarget, accepted)
    const diffSum = remDiff.easy + remDiff.medium + remDiff.hard
    const attemptDiffCounts =
      diffSum === requestCount
        ? remDiff
        : computeDifficultyCounts(requestCount, req.difficulty, {
            easy: remDiff.easy || 0,
            medium: remDiff.medium || 0,
            hard: remDiff.hard || 0,
          })

    const existingStems = [
      ...(req.existingQuestions || []).map((q) => q.questionText),
      ...accepted.map((q) => q.questionText),
    ]
    const coveredObjectives = accepted
      .map((q) => q.learningObjective)
      .filter((x): x is string => Boolean(x))

    const prompt = buildQuestionGenerationPrompt({
      examName: req.examName,
      examTarget: req.examTarget,
      subject: req.subject,
      grade: req.grade,
      chapters: req.chapters,
      topics: req.topics,
      syllabusSummary: req.syllabusSummary,
      format: req.format,
      fibMode: req.fibMode,
      count: requestCount,
      difficulty: req.difficulty,
      difficultyCounts: attemptDiffCounts,
      marks: req.marks,
      negativeMark: req.negativeMark,
      wordLimit: req.wordLimit,
      customInstructions: req.customInstructions,
      existingQuestionStems: existingStems,
      coveredObjectives,
    })

    const { data, meta } = await callGeminiJson<unknown>(
      {
        systemInstruction: prompt.systemInstruction,
        userPrompt: prompt.taskPrompt,
        temperature: attempt === 0 ? 0.55 : 0.4,
        maxOutputTokens: Math.min(32768, Math.max(8192, requestCount * 1600)),
        preferredModel: req.preferredModel,
      },
      req.transportOverride
    )

    if (meta.modelUsed) modelsUsed.add(meta.modelUsed)

    const rawItems = Array.isArray(data)
      ? data
      : data && typeof data === "object" && Array.isArray((data as any).questions)
        ? (data as any).questions
        : []

    if (rawItems.length === 0) {
      warnings.add(`Attempt ${attempt + 1} returned zero parsable items`)
      continue
    }

    const candidatesThisPass: CanonicalQuestion[] = []
    for (let idx = 0; idx < rawItems.length; idx++) {
      const raw = rawItems[idx]
      const valRes = validateAndCanonicalizeQuestion(
        {
          ...raw,
          subject: raw?.subject || req.subject,
          classLevel: raw?.classLevel || req.grade,
          marks: raw?.marks || req.marks,
          negativeMark: raw?.negativeMark !== undefined ? raw.negativeMark : req.negativeMark,
        },
        {
          expectedFormat: req.format,
          subject: req.subject,
          defaultMarks: req.marks,
          defaultNegativeMark: req.negativeMark,
          allowedChapters: req.chapters,
          strictSyllabusCheck: req.strictSyllabusCheck,
          fibMode: req.fibMode,
          requireExplanation: req.requireExplanation,
        },
        `gen_${Date.now().toString(36)}_${attempt}_${idx}`
      )

      valRes.warnings.forEach((w) => warnings.add(w))

      if (!valRes.valid || !valRes.question) {
        trackReject({
          stage: "schema_or_academic",
          reasons: valRes.errors,
          rawQuestionText: typeof raw?.questionText === "string" ? raw.questionText.slice(0, 140) : undefined,
        })
        continue
      }

      const dup = deduplicator.check(valRes.question)
      if (dup.isDuplicate) {
        trackReject({
          stage: "duplicate",
          reasons: [dup.detail || `Duplicate (${dup.reason})`],
          duplicateReason: dup.reason,
          rawQuestionText: valRes.question.questionText.slice(0, 140),
        })
        continue
      }

      candidatesThisPass.push(valRes.question)
    }

    // Optional independent academic verification pass (selective on hard/assertion/diagram/mcq_multi, or explicit flag)
    let vetted = candidatesThisPass
    if (req.verifyAcademically && candidatesThisPass.length > 0) {
      try {
        const audit = await verifyQuestionsAcademically({
          subject: req.subject,
          questions: candidatesThisPass,
          preferredModel: req.preferredModel,
          transportOverride: req.transportOverride,
        })
        vetted = audit.verifiedQuestions
        for (const bad of audit.rejectedByVerifier) {
          trackReject({
            stage: "ai_verifier",
            reasons: bad.issues,
          })
        }
      } catch (verErr) {
        warnings.add(
          `Academic verifier skipped due to upstream error: ${verErr instanceof Error ? verErr.message : "unknown"}`
        )
      }
    }

    for (const q of vetted) {
      if (accepted.length >= targetCount) break
      const dupCheckAgain = deduplicator.check(q)
      if (!dupCheckAgain.isDuplicate) {
        deduplicator.add(q)
        accepted.push(q)
      }
    }
  }

  const classCounts: Record<string, number> = {}
  const formatCounts: Record<string, number> = {}
  for (const q of accepted) {
    const cls = q.classLevel || "unspecified"
    classCounts[cls] = (classCounts[cls] || 0) + 1
    formatCounts[q.questionFormat] = (formatCounts[q.questionFormat] || 0) + 1
  }

  const duplicateCount = rejected.filter((r) => r.stage === "duplicate").length
  const verifierRejectedCount = rejected.filter((r) => r.stage === "ai_verifier").length

  return {
    questions: accepted,
    rejected,
    qualityReport: {
      requestedCount: targetCount,
      acceptedCount: accepted.length,
      rejectedCount: rejected.length,
      duplicateCount,
      verifierRejectedCount,
      retriesExecuted,
      modelsUsed: Array.from(modelsUsed),
      difficultyTarget,
      difficultyActual: summarizeDifficulty(accepted),
      classCounts,
      formatCounts,
      rejectionSummary,
      warnings: Array.from(warnings),
    },
  }
}
