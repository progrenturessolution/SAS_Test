import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { getGeminiApiKeys } from "@/lib/gemini"
import {
  CanonicalQuestion,
  normalizeFormatInput,
  toExamQuestionPayload,
} from "@/lib/ai/canonicalSchema"
import { generateQuestionBatch } from "@/lib/ai/orchestrator"
import { QuestionDeduplicator } from "@/lib/ai/deduplication"

/**
 * Formats a verified CanonicalQuestion cleanly for ExamWizard modals
 * (which use option letter "A"-"D" inside single-choice MCQ & Assertion UI state).
 */
function formatForObjectiveModal(q: CanonicalQuestion) {
  const base = toExamQuestionPayload(q)

  if ((q.questionFormat === "mcq_single" || q.questionFormat === "assertion" || q.questionFormat === "diagram") && Array.isArray(q.options)) {
    const idx = q.options.findIndex((o) => o.trim() === String(q.correctAnswer).trim())
    const letter = idx !== -1 ? String.fromCharCode(65 + idx) : String(q.correctAnswer)
    return {
      ...base,
      correctAnswer: letter,
      correctOptionText: String(q.correctAnswer),
    }
  }

  if (q.questionFormat === "descriptive") {
    return {
      ...base,
      wordLimit: String(q.wordLimit || 150),
    }
  }

  return base
}

export async function POST(req: Request) {
  try {
    const session = await getSession(req)
    const canGenerate =
      session &&
      (["admin", "institute", "super_admin", "coaching_institute"].includes(session.role) ||
        Boolean(session.instituteId))
    if (!canGenerate) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const {
      prompt,
      topics,
      type = "mcq",
      marks = 1,
      negativeMark = 0,
      difficulty = "medium",
      subject = "General",
      grade,
      existingQuestions = [],
    } = body

    const canonicalFormat = normalizeFormatInput(String(type))
    const requestedTopics: Array<{ topic: string; count: number }> = Array.isArray(topics)
      ? topics
          .filter((item: any) => typeof item?.topic === "string" && item.topic.trim() && Number(item?.count) > 0)
          .slice(0, 10)
          .map((item: any) => ({
            topic: item.topic.trim(),
            count: Math.min(30, Math.max(1, Math.floor(Number(item.count) || 1))),
          }))
      : []

    const isBulk = requestedTopics.length > 0

    if (!isBulk && (typeof prompt !== "string" || !prompt.trim())) {
      return NextResponse.json({ error: "Topic or question prompt is required" }, { status: 400 })
    }

    if (getGeminiApiKeys().length === 0) {
      return NextResponse.json({ error: "GEMINI_API_KEY is not configured" }, { status: 500 })
    }

    const qMarks = Math.max(1, Number(marks) || 1)
    const qNeg = canonicalFormat === "descriptive" ? 0 : Math.max(0, Number(negativeMark) || 0)

    const seedExisting = Array.isArray(existingQuestions)
      ? existingQuestions.map((q: any, i: number) => ({
          id: String(q?.id || `ex_${i}`),
          questionText: typeof q === "string" ? q : String(q?.questionText || ""),
          options: Array.isArray(q?.options) ? q.options : undefined,
        }))
      : []

    if (!isBulk) {
      const batchRes = await generateQuestionBatch({
        examName: "Standard Assessment",
        subject: String(subject),
        grade: grade ? String(grade) : undefined,
        chapters: [String(prompt).trim()],
        topics: [String(prompt).trim()],
        format: canonicalFormat,
        fibMode: "blanks",
        count: 1,
        difficulty: String(difficulty),
        marks: qMarks,
        negativeMark: qNeg,
        existingQuestions: seedExisting,
        strictSyllabusCheck: false,
        maxRetriesForDeficit: 2,
      })

      if (batchRes.questions.length === 0) {
        return NextResponse.json(
          {
            error: "AI failed to produce a valid question matching strict quality rules. Please refine your prompt and retry.",
            qualityReport: batchRes.qualityReport,
          },
          { status: 422 }
        )
      }

      return NextResponse.json({
        success: true,
        data: formatForObjectiveModal(batchRes.questions[0]),
        qualityReport: batchRes.qualityReport,
      })
    }

    // Bulk topic generation with cross-topic duplicate protection
    const dedup = new QuestionDeduplicator(seedExisting)
    const allAccepted: CanonicalQuestion[] = []
    let totalRejected = 0

    for (const row of requestedTopics) {
      const batchRes = await generateQuestionBatch({
        examName: "Standard Assessment",
        subject: String(subject),
        grade: grade ? String(grade) : undefined,
        chapters: [row.topic],
        topics: [row.topic],
        format: canonicalFormat,
        fibMode: "blanks",
        count: row.count,
        difficulty: String(difficulty),
        marks: qMarks,
        negativeMark: qNeg,
        existingQuestions: [
          ...seedExisting,
          ...allAccepted.map((q) => ({ id: q.id, questionText: q.questionText, options: q.options, learningObjective: q.learningObjective })),
        ],
        strictSyllabusCheck: false,
        maxRetriesForDeficit: 1,
      })

      totalRejected += batchRes.qualityReport.rejectedCount
      for (const q of batchRes.questions) {
        if (!dedup.check(q).isDuplicate) {
          dedup.add(q)
          allAccepted.push(q)
        }
      }
    }

    if (allAccepted.length === 0) {
      return NextResponse.json(
        { error: "No valid questions could be generated across the specified topics." },
        { status: 422 }
      )
    }

    return NextResponse.json({
      success: true,
      data: allAccepted.map(formatForObjectiveModal),
      qualityReport: {
        requestedCount: requestedTopics.reduce((s, r) => s + r.count, 0),
        acceptedCount: allAccepted.length,
        rejectedCount: totalRejected,
      },
    })
  } catch (error) {
    console.error("[GenerateObjectiveQuestion] Error:", error instanceof Error ? error.message : error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate question" },
      { status: 500 }
    )
  }
}
