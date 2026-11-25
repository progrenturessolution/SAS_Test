import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { getGeminiApiKeys } from "@/lib/gemini"
import connectDB from "@/lib/mongodb"
import {
  CanonicalFormat,
  CanonicalQuestion,
  normalizeFormatInput,
  toExamQuestionPayload,
} from "@/lib/ai/canonicalSchema"
import { partitionDifficultyAcrossBatches } from "@/lib/ai/examBlueprint"
import { computeDifficultyCounts } from "@/lib/ai/promptBuilder"
import { generateQuestionBatch, GenerationQualityReport } from "@/lib/ai/orchestrator"
import { QuestionDeduplicator } from "@/lib/ai/deduplication"

interface BlueprintFormatInput {
  id: string
  label?: string
  count: number
  marks?: number
  negativeMark?: number
  checked?: boolean
}

function mergeQualityReports(
  requestedTotal: number,
  questions: CanonicalQuestion[],
  reports: GenerationQualityReport[]
) {
  const difficultyTarget = reports.reduce(
    (acc, r) => ({
      easy: acc.easy + r.difficultyTarget.easy,
      medium: acc.medium + r.difficultyTarget.medium,
      hard: acc.hard + r.difficultyTarget.hard,
    }),
    { easy: 0, medium: 0, hard: 0 }
  )

  const difficultyCounts = {
    easy: questions.filter((q) => q.difficulty === "easy").length,
    medium: questions.filter((q) => q.difficulty === "medium").length,
    hard: questions.filter((q) => q.difficulty === "hard").length,
  }

  const formatCounts: Record<string, number> = {}
  const classCounts: Record<string, number> = {}
  const gradeMarkCounts: Record<string, { questions: number; marks: number }> = {}

  for (const q of questions) {
    formatCounts[q.questionFormat] = (formatCounts[q.questionFormat] || 0) + 1
    const g = q.classLevel || "Unspecified"
    classCounts[g] = (classCounts[g] || 0) + 1
    const cur = gradeMarkCounts[g] || { questions: 0, marks: 0 }
    gradeMarkCounts[g] = { questions: cur.questions + 1, marks: cur.marks + (Number(q.marks) || 0) }
  }

  const rejectedCount = reports.reduce((s, r) => s + r.rejectedCount, 0)
  const duplicateCount = reports.reduce((s, r) => s + r.duplicateCount, 0)

  return {
    requestedCount: requestedTotal,
    acceptedCount: questions.length,
    rejectedCount,
    duplicateCount,
    verifierRejectedCount: reports.reduce((s, r) => s + r.verifierRejectedCount, 0),
    retriesExecuted: reports.reduce((s, r) => s + r.retriesExecuted, 0),
    modelsUsed: Array.from(new Set(reports.flatMap((r) => r.modelsUsed))),
    difficultyTarget,
    difficultyActual: difficultyCounts,
    difficultyCounts,
    formatCounts,
    classCounts,
    gradeMarkCounts,
    duplicateQuestionsRemoved: duplicateCount,
    structurallyInvalidQuestionsRejected: rejectedCount - duplicateCount,
    warnings: Array.from(new Set(reports.flatMap((r) => r.warnings))),
  }
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
      exam = "NEET",
      examTarget,
      grade = "12",
      subject = "Physics",
      chapters = [],
      topics = [],
      syllabusText = "",
      difficulty = "mixed",
      difficultyRatio,
      difficultyCounts: requestedDifficultyCounts,
      questionCount = 5,
      questionPattern = "mcq_single",
      marksPerQuestion = 4,
      negativeMarks = 0,
      customInstructions = "",
      existingQuestions = [],
      blueprintFormats = [],
      fibMode = "blanks",
      focusPYQ = true,
      verifyAcademically = false,
      stream = false,
    } = body

    // Institute access & quota verification
    if (session.instituteId) {
      try {
        await connectDB()
        const Institute = (await import("@/models/Institute")).default
        const inst = await Institute.findById(session.instituteId).select("limits").lean()
        if (inst?.limits?.features && inst.limits.features.neetJeeGenerator === false) {
          return NextResponse.json(
            { error: "AI Question Studio is not enabled in your institute plan. Please contact support." },
            { status: 403 }
          )
        }
        const allowedExamTypes = Array.isArray(inst?.limits?.examTypes)
          ? inst.limits.examTypes.map((type: string) => String(type).trim().toUpperCase())
          : ["NEET", "JEE_MAIN", "JEE_ADVANCED", "MHT_CET", "CBSE_BOARD", "CUSTOM", "OTHER"]

        const hasCompetitiveAccess = allowedExamTypes.some((type: string) =>
          ["COMPETITIVE", "NEET", "JEE_MAIN", "JEE_ADVANCED", "MHT_CET", "CBSE_BOARD", "OTHER", "OTHER_EXAMS"].includes(type)
        )
        if (!hasCompetitiveAccess) {
          return NextResponse.json(
            { error: "Your institute does not have access to AI question generation. Contact administrator." },
            { status: 403 }
          )
        }
      } catch (dbErr: any) {
        console.warn("[CompetitiveAI] Institute limits check warning:", dbErr.message)
      }
    }

    const chaptersArray: string[] = Array.isArray(chapters)
      ? chapters.map((c: any) => String(c).trim()).filter(Boolean)
      : []

    const topicsArray: string[] = Array.isArray(topics)
      ? topics.map((t: any) => String(t).trim()).filter(Boolean)
      : String(topics || "")
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)

    if (chaptersArray.length === 0 && topicsArray.length === 0 && !String(syllabusText || "").trim()) {
      return NextResponse.json(
        { error: "Please select at least one chapter, topic, or upload a syllabus PDF" },
        { status: 400 }
      )
    }

    if (getGeminiApiKeys().length === 0) {
      return NextResponse.json({ error: "No Gemini API keys configured in .env" }, { status: 500 })
    }

    const activeBlueprintFormats: BlueprintFormatInput[] = Array.isArray(blueprintFormats)
      ? blueprintFormats.filter((f: any) => f.checked && Number(f.count) > 0)
      : []

    const rawCount =
      activeBlueprintFormats.length > 0
        ? activeBlueprintFormats.reduce((s, f) => s + Number(f.count), 0)
        : Math.max(1, Math.min(60, Number(questionCount) || 5))

    const defaultMarks = Math.max(1, Number(marksPerQuestion) || 4)
    const defaultNeg = Math.max(0, Number(negativeMarks) || 0)

    // Normalize tasks preserving exact per-format counts and marks
    type SubTask = {
      format: CanonicalFormat
      count: number
      marks: number
      negativeMark: number
    }
    const rawTasks: SubTask[] = []

    if (activeBlueprintFormats.length > 0) {
      for (const fmt of activeBlueprintFormats) {
        const canonicalFmt = normalizeFormatInput(fmt.id)
        const fmtMarks = Math.max(1, Number(fmt.marks) || defaultMarks)
        const fmtNeg =
          canonicalFmt === "descriptive" ? 0 : Math.max(0, Number(fmt.negativeMark ?? defaultNeg) || 0)
        let rem = Number(fmt.count)
        while (rem > 0) {
          const take = Math.min(12, rem)
          rawTasks.push({ format: canonicalFmt, count: take, marks: fmtMarks, negativeMark: fmtNeg })
          rem -= take
        }
      }
    } else if (String(questionPattern).toLowerCase() === "mixed") {
      const counts = {
        mcq: Math.max(1, Math.round(rawCount * 0.55)),
        assertion: Math.round(rawCount * 0.2),
        diagram: rawCount - Math.max(1, Math.round(rawCount * 0.55)) - Math.round(rawCount * 0.2),
      }
      for (const [k, cnt] of [
        ["mcq_single", counts.mcq],
        ["assertion", counts.assertion],
        ["diagram", counts.diagram],
      ] as Array<[CanonicalFormat, number]>) {
        let rem = cnt
        while (rem > 0) {
          const take = Math.min(12, rem)
          rawTasks.push({ format: k, count: take, marks: defaultMarks, negativeMark: defaultNeg })
          rem -= take
        }
      }
    } else {
      const canonicalFmt = normalizeFormatInput(String(questionPattern))
      let rem = rawCount
      while (rem > 0) {
        const take = Math.min(12, rem)
        rawTasks.push({
          format: canonicalFmt,
          count: take,
          marks: defaultMarks,
          negativeMark: canonicalFmt === "descriptive" ? 0 : defaultNeg,
        })
        rem -= take
      }
    }

    // Partition overall difficulty distribution accurately across sub-tasks
    const globalDiffTarget =
      requestedDifficultyCounts &&
      Number(requestedDifficultyCounts.easy || 0) +
        Number(requestedDifficultyCounts.medium || 0) +
        Number(requestedDifficultyCounts.hard || 0) ===
        rawCount
        ? {
            easy: Number(requestedDifficultyCounts.easy || 0),
            medium: Number(requestedDifficultyCounts.medium || 0),
            hard: Number(requestedDifficultyCounts.hard || 0),
          }
        : computeDifficultyCounts(rawCount, String(difficulty), difficultyRatio)

    const taskDifficultySlices = partitionDifficultyAcrossBatches(
      globalDiffTarget,
      rawTasks.map((t) => t.count)
    )

    const seedExisting = Array.isArray(existingQuestions)
      ? existingQuestions.map((q: any, i: number) => ({
          id: String(q?.id || `existing_${i}`),
          questionText: typeof q === "string" ? q : String(q?.questionText || ""),
          options: Array.isArray(q?.options) ? q.options : undefined,
          learningObjective: q?.learningObjective,
        }))
      : []

    const dedup = new QuestionDeduplicator(seedExisting)

    const executeTask = async (task: SubTask, taskIdx: number) => {
      // Spread selected chapters cleanly across tasks while still honoring selected chapter boundary
      const assignedChapters =
        chaptersArray.length > 1
          ? chaptersArray.filter((_, idx) => idx % rawTasks.length === taskIdx)
          : chaptersArray
      const effectiveChapters = assignedChapters.length > 0 ? assignedChapters : chaptersArray

      const pyqDirective =
        focusPYQ === false
          ? "Focus cleanly on core concept clarity and textbook/syllabus practice problems."
          : "Emphasize exam-authentic PYQ-style conceptual rigor without fabricating official exam years."
      const mergedCustomInstructions = [String(customInstructions || "").trim(), pyqDirective]
        .filter(Boolean)
        .join(" ")

      const res = await generateQuestionBatch({
        examName: String(exam),
        examTarget: String(examTarget || exam),
        subject: String(subject),
        grade: grade === "both" ? undefined : String(grade),
        chapters: effectiveChapters,
        topics: topicsArray,
        syllabusSummary: String(syllabusText || "").trim() || undefined,
        format: task.format,
        fibMode: fibMode === "mcq" ? "mcq" : "blanks",
        count: task.count,
        difficulty: String(difficulty),
        difficultyCounts: taskDifficultySlices[taskIdx],
        marks: task.marks,
        negativeMark: task.negativeMark,
        customInstructions: mergedCustomInstructions || undefined,
        existingQuestions: seedExisting,
        strictSyllabusCheck: chaptersArray.length > 0,
        verifyAcademically: Boolean(verifyAcademically),
        maxRetriesForDeficit: 2,
      })

      return res
    }

    if (stream) {
      const encoder = new TextEncoder()
      const readable = new ReadableStream({
        async start(controller) {
          const send = (payload: Record<string, unknown>) => {
            controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`))
          }
          try {
            send({ type: "ping" })
            const collected: CanonicalQuestion[] = []
            const reports: GenerationQualityReport[] = []

            for (let i = 0; i < rawTasks.length; i++) {
              const res = await executeTask(rawTasks[i], i)
              reports.push(res.qualityReport)

              const uniqueBatch: CanonicalQuestion[] = []
              for (const q of res.questions) {
                if (!dedup.check(q).isDuplicate) {
                  dedup.add(q)
                  uniqueBatch.push(q)
                  collected.push(q)
                }
              }

              if (uniqueBatch.length > 0) {
                send({
                  type: "batch",
                  questions: uniqueBatch.map((q) => ({
                    ...toExamQuestionPayload(q),
                    grade: q.classLevel || String(grade),
                  })),
                })
              }
            }

            if (collected.length === 0) {
              send({ type: "error", error: "Failed to generate valid questions matching strict quality checks." })
            } else {
              send({
                type: "done",
                count: collected.length,
                qualityReport: mergeQualityReports(rawCount, collected, reports),
              })
            }
          } catch (streamErr: any) {
            send({ type: "error", error: streamErr?.message || "Failed to generate questions." })
          } finally {
            controller.close()
          }
        },
      })

      return new Response(readable, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        },
      })
    }

    // Sequential or bounded concurrency execution with cross-task dedup
    const collected: CanonicalQuestion[] = []
    const reports: GenerationQualityReport[] = []

    const CONCURRENCY = 2
    for (let start = 0; start < rawTasks.length; start += CONCURRENCY) {
      const slice = rawTasks.slice(start, start + CONCURRENCY)
      const results = await Promise.all(slice.map((task, offset) => executeTask(task, start + offset)))

      for (const res of results) {
        reports.push(res.qualityReport)
        for (const q of res.questions) {
          if (!dedup.check(q).isDuplicate) {
            dedup.add(q)
            collected.push(q)
          }
        }
      }
    }

    const qualityReport = mergeQualityReports(rawCount, collected, reports)
    if (collected.length === 0) {
      return NextResponse.json(
        {
          error: "Generated questions failed structural/academic validation. Please retry.",
          qualityReport,
        },
        { status: 422 }
      )
    }

    const formattedQuestions = collected.map((q) => ({
      ...toExamQuestionPayload(q),
      grade: q.classLevel || String(grade),
    }))

    return NextResponse.json({
      success: true,
      questions: formattedQuestions,
      qualityReport,
    })
  } catch (err: any) {
    console.error("[CompetitiveAI] Error:", err?.message || err)
    return NextResponse.json(
      { error: err?.message || "Failed to generate questions" },
      { status: 500 }
    )
  }
}
