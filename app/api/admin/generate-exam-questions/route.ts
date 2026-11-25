import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { getGeminiApiKeys } from "@/lib/gemini"
import {
  CanonicalFormat,
  CanonicalQuestion,
  normalizeFormatInput,
  toExamQuestionPayload,
} from "@/lib/ai/canonicalSchema"
import { generateQuestionBatch } from "@/lib/ai/orchestrator"
import { QuestionDeduplicator } from "@/lib/ai/deduplication"

interface QuestionBlueprint {
  mcq?: number
  mcq_multi?: number
  assertion?: number
  truefalse?: number
  descriptive?: number
  fillblanks?: number
  diagram?: number
}

export async function POST(req: Request) {
  try {
    const session = await getSession(req)
    if (!session || (session.role !== "admin" && session.role !== "institute" && session.role !== "super_admin")) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 })
    }

    const body = await req.json()
    const {
      topic,
      topics,
      questionType,
      subject = "General",
      grade = "Standard",
      difficulty = "medium",
      marks,
      negativeMark,
      blueprint,
      defaultMarks,
      existingQuestions = [],
    } = body

    if (getGeminiApiKeys().length === 0) {
      return NextResponse.json({ error: "No Gemini API keys configured in .env" }, { status: 500 })
    }

    const seedExisting = Array.isArray(existingQuestions)
      ? existingQuestions.map((q: any, i: number) => ({
          id: String(q?.id || `ex_${i}`),
          questionText: typeof q === "string" ? q : String(q?.questionText || ""),
          options: Array.isArray(q?.options) ? q.options : undefined,
        }))
      : []

    // Mode A: Single Question Type (supports topics list or topic string)
    if (questionType) {
      const requestedTopics: Array<{ topic: string; count: number }> =
        Array.isArray(topics) && topics.length > 0
          ? topics
              .filter((t: any) => typeof t?.topic === "string" && t.topic.trim() && Number(t.count) > 0)
              .map((t: any) => ({ topic: t.topic.trim(), count: Math.min(40, Math.round(Number(t.count))) }))
          : typeof topic === "string" && topic.trim()
            ? [{ topic: topic.trim(), count: Math.min(40, Math.max(1, Math.round(Number(body.count) || 5))) }]
            : []

      if (requestedTopics.length === 0) {
        return NextResponse.json({ error: "At least one topic is required" }, { status: 400 })
      }

      const totalCount = requestedTopics.reduce((s, t) => s + t.count, 0)
      if (totalCount > 40) {
        return NextResponse.json({ error: "Maximum 40 questions can be generated at once" }, { status: 400 })
      }

      const format = normalizeFormatInput(String(questionType))
      const qMarks =
        Number(marks) ||
        (format === "mcq_single" || format === "mcq_multi" || format === "assertion" || format === "diagram"
          ? 4
          : format === "descriptive"
            ? 5
            : 2)
      const qNeg =
        format === "descriptive"
          ? 0
          : typeof negativeMark === "number"
            ? Math.max(0, negativeMark)
            : 0

      const dedup = new QuestionDeduplicator(seedExisting)
      const collected: CanonicalQuestion[] = []

      for (const row of requestedTopics) {
        const res = await generateQuestionBatch({
          examName: `${subject} Exam`,
          subject: String(subject),
          grade: String(grade),
          chapters: [row.topic],
          topics: [row.topic],
          format,
          fibMode: "blanks",
          count: row.count,
          difficulty: String(difficulty),
          marks: qMarks,
          negativeMark: qNeg,
          existingQuestions: [
            ...seedExisting,
            ...collected.map((q) => ({ id: q.id, questionText: q.questionText, options: q.options })),
          ],
          strictSyllabusCheck: false,
          maxRetriesForDeficit: 1,
        })

        for (const q of res.questions) {
          if (!dedup.check(q).isDuplicate) {
            dedup.add(q)
            collected.push(q)
          }
        }
      }

      if (collected.length === 0) {
        return NextResponse.json(
          { error: "AI could not generate valid verified questions for this topic. Please retry." },
          { status: 422 }
        )
      }

      return NextResponse.json({
        success: true,
        count: collected.length,
        questions: collected.map(toExamQuestionPayload),
      })
    }

    // Mode B: Multi-Format Blueprint Mode
    if (!topic || !String(topic).trim()) {
      return NextResponse.json({ error: "Topic is required for question generation" }, { status: 400 })
    }

    const bp: QuestionBlueprint = blueprint || { mcq: 5, assertion: 0, truefalse: 3, descriptive: 2, fillblanks: 3 }
    const dm = defaultMarks || { mcq: 4, mcq_multi: 4, assertion: 4, truefalse: 2, descriptive: 5, fillblanks: 2, diagram: 4 }

    const formatEntries: Array<{ key: keyof QuestionBlueprint; format: CanonicalFormat; count: number; marks: number }> = (
      [
        { key: "mcq" as const, format: "mcq_single" as CanonicalFormat, count: Math.max(0, Number(bp.mcq) || 0), marks: Number(dm.mcq) || 4 },
        { key: "mcq_multi" as const, format: "mcq_multi" as CanonicalFormat, count: Math.max(0, Number(bp.mcq_multi) || 0), marks: Number(dm.mcq_multi) || 4 },
        { key: "assertion" as const, format: "assertion" as CanonicalFormat, count: Math.max(0, Number(bp.assertion) || 0), marks: Number(dm.assertion) || 4 },
        { key: "truefalse" as const, format: "true_false" as CanonicalFormat, count: Math.max(0, Number(bp.truefalse) || 0), marks: Number(dm.truefalse) || 2 },
        { key: "fillblanks" as const, format: "fib" as CanonicalFormat, count: Math.max(0, Number(bp.fillblanks) || 0), marks: Number(dm.fillblanks) || 2 },
        { key: "descriptive" as const, format: "descriptive" as CanonicalFormat, count: Math.max(0, Number(bp.descriptive) || 0), marks: Number(dm.descriptive) || 5 },
        { key: "diagram" as const, format: "diagram" as CanonicalFormat, count: Math.max(0, Number(bp.diagram) || 0), marks: Number(dm.diagram) || 4 },
      ]
    ).filter((e) => e.count > 0)

    const totalCount = formatEntries.reduce((s, e) => s + e.count, 0)
    if (totalCount === 0) {
      return NextResponse.json({ error: "Please select at least 1 question to generate" }, { status: 400 })
    }
    if (totalCount > 40) {
      return NextResponse.json({ error: "Maximum 40 questions can be generated per batch" }, { status: 400 })
    }

    const dedup = new QuestionDeduplicator(seedExisting)
    const collected: CanonicalQuestion[] = []

    for (const entry of formatEntries) {
      const res = await generateQuestionBatch({
        examName: `${subject} Exam`,
        subject: String(subject),
        grade: String(grade),
        chapters: [String(topic).trim()],
        topics: [String(topic).trim()],
        format: entry.format,
        fibMode: "blanks",
        count: entry.count,
        difficulty: String(difficulty),
        marks: entry.marks,
        negativeMark: 0,
        existingQuestions: [
          ...seedExisting,
          ...collected.map((q) => ({ id: q.id, questionText: q.questionText, options: q.options })),
        ],
        strictSyllabusCheck: false,
        maxRetriesForDeficit: 1,
      })

      for (const q of res.questions) {
        if (!dedup.check(q).isDuplicate) {
          dedup.add(q)
          collected.push(q)
        }
      }
    }

    if (collected.length === 0) {
      return NextResponse.json(
        { error: "AI could not parse or validate the requested questions. Please retry with a clearer topic." },
        { status: 422 }
      )
    }

    return NextResponse.json({
      success: true,
      topic: String(topic).trim(),
      count: collected.length,
      questions: collected.map(toExamQuestionPayload),
    })
  } catch (error) {
    console.error("Exam question generation error:", error instanceof Error ? error.message : error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate questions with AI" },
      { status: 500 }
    )
  }
}
