import { NextResponse } from "next/server"
import connectDB from "@/lib/mongodb"
import Attempt from "@/models/Attempt"
import Exam from "@/models/Exam"
import { evaluateObjectiveAnswer } from "@/lib/ai/questionEvaluation"

function normalizeOptionToken(val: string): string {
  return val
    .trim()
    .replace(/^[\(\[\{]/, "")
    .replace(/[\)\]\}]$/, "")
    .replace(/^option\s*/i, "")
    .replace(/^[a-d]\s*[\)\.\-:]\s*/i, "")
    .replace(/\s+/g, " ")
    .toLowerCase()
}

function resolveOptionIndex(val: string, options?: string[]): number {
  const trimmed = val.trim()
  const clean = trimmed
    .replace(/^[\(\[\{]/, "")
    .replace(/[\)\]\}]$/, "")
    .replace(/^option\s*/i, "")
    .trim()

  if (/^[a-d]$/i.test(clean)) {
    return clean.toUpperCase().charCodeAt(0) - 65
  }

  const num = Number(clean)
  if (Number.isInteger(num)) {
    if (num >= 0 && (!options || num < options.length)) return num
    if (num >= 1 && options && num <= options.length) return num - 1
  }

  if (options && options.length > 0) {
    const norm = normalizeOptionToken(trimmed)
    const idx = options.findIndex(o => normalizeOptionToken(o) === norm)
    if (idx >= 0) return idx
  }

  return -1
}

function parseTokens(val: unknown, options?: string[]): number[] {
  if (val === undefined || val === null) return []
  let rawItems: string[] = []
  if (Array.isArray(val)) {
    rawItems = val.map(v => String(v).trim()).filter(Boolean)
  } else if (typeof val === "string") {
    const s = val.trim()
    if (s.startsWith("[") && s.endsWith("]")) {
      try {
        const parsed = JSON.parse(s)
        if (Array.isArray(parsed)) rawItems = parsed.map(v => String(v).trim()).filter(Boolean)
      } catch {}
    }
    if (rawItems.length === 0) {
      rawItems = s.split(/,|\band\b|&/i).map(x => x.trim()).filter(Boolean)
    }
  }

  const indices = new Set<number>()
  for (const item of rawItems) {
    const idx = resolveOptionIndex(item, options)
    if (idx >= 0) indices.add(idx)
  }
  return Array.from(indices).sort((a, b) => a - b)
}

function answersMatch(
  studentAnswer: string | string[],
  correctAnswer: string | string[] | undefined,
  options?: string[]
): boolean {
  if (studentAnswer === undefined || correctAnswer === undefined) return false

  const isMulti =
    Array.isArray(correctAnswer) ||
    (typeof correctAnswer === "string" && (correctAnswer.includes(",") || /\band\b/i.test(correctAnswer))) ||
    Array.isArray(studentAnswer) ||
    (typeof studentAnswer === "string" && (studentAnswer.includes(",") || /\band\b/i.test(studentAnswer)))

  if (isMulti) {
    const studentIndices = parseTokens(studentAnswer, options)
    const correctIndices = parseTokens(correctAnswer, options)

    if (studentIndices.length > 0 && correctIndices.length > 0) {
      if (studentIndices.length !== correctIndices.length) return false
      return studentIndices.every((val, i) => val === correctIndices[i])
    }
  }

  // Single answer comparison
  const student = Array.isArray(studentAnswer) ? studentAnswer[0] : studentAnswer
  const correct = Array.isArray(correctAnswer) ? correctAnswer[0] : correctAnswer
  if (student === undefined || correct === undefined) return false

  const sNorm = normalizeOptionToken(student)
  const cNorm = normalizeOptionToken(correct)
  if (sNorm && cNorm && sNorm === cNorm) return true

  const sIdx = resolveOptionIndex(student, options)
  const cIdx = resolveOptionIndex(correct, options)
  return sIdx >= 0 && sIdx === cIdx
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await connectDB()
    const attempt = await Attempt.findById(id).populate("examId")
    if (!attempt) return NextResponse.json({ error: "Attempt not found" }, { status: 404 })
    
    // Calculate auto-graded score for each answer to show in the UI
    const exam = attempt.examId as any
    const sections = exam?.sections || []
    const allQuestions = sections.flatMap((s: any) => s.questions || [])
    
    const answers = attempt.answers || []
    const enrichedAnswers = answers.map((ans: any) => {
      const question = allQuestions.find((q: any) => q._id.toString() === ans.questionId)
      let autoScore = 0
      
      if (question) {
        if (
          question.type === "mcq" ||
          (question as any).type === "mcq_multi" ||
          (question as any).type === "diagram" ||
          question.type === "assertion" ||
          question.type === "truefalse" ||
          question.type === "fillblanks"
        ) {
          const evalRes = evaluateObjectiveAnswer(question as any, ans.answer)
          autoScore = evalRes.earnedMarks > 0 ? evalRes.earnedMarks : 0
        } else if (question.type === "coding") {
          const totalPassed = ans.totalPassed || 0
          const totalCases = ans.totalCases || 0
          if (totalCases > 0) {
            const scoringMode = question.scoringMode || "partial"
            if (scoringMode === "all") {
              if (totalPassed === totalCases) autoScore = question.marks
            } else {
              autoScore = question.marks * (totalPassed / totalCases)
            }
          }
        } else if (question.type === "descriptive") {
          autoScore = ans.earnedMarks ?? ans.aiEvaluation?.score ?? ans.manualScore ?? 0
        }
      }
      
      return { ...ans.toObject?.() ?? ans, autoScore }
    })
    
    const attemptObj = attempt.toObject?.() ?? attempt
    attemptObj.answers = enrichedAnswers
    
    return NextResponse.json({ attempt: attemptObj })
  } catch (error: any) {
    console.error('Grade API error:', error)
    return NextResponse.json({ error: error.message || 'Failed to fetch attempt' }, { status: 500 })
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { answers } = await req.json()

    await connectDB()

    const attempt = await Attempt.findById(id).populate("examId")
    if (!attempt) {
      return NextResponse.json({ error: "Attempt not found" }, { status: 404 })
    }

    // Update answers with manual scores
    attempt.answers.forEach((ans: any) => {
      const g = answers.find((a: any) => a.questionId === ans.questionId)
      if (g && g.manualScore !== undefined) {
        ans.manualScore = g.manualScore
      }
    })

    attempt.markModified("answers")

    let newTotalScore = 0
    const exam = attempt.examId as any
    const sections = exam?.sections || []

    // Recalculate score for ALL answers
    sections.forEach((section: any) => {
      const sectionNegativeMarking = section.negativeMarking || exam.settings?.negativeMarking || false;
      const sectionNegativeValue = section.sectionNegativeMark ?? 0;

      (section.questions || []).forEach((question: any) => {
        const studentAnswer = attempt.answers.find((a: any) => a.questionId === question._id.toString())
        if (!studentAnswer) return

        // Check if this question was manually graded in this request
        const manualGradeInRequest = answers.find((a: any) => a.questionId === studentAnswer.questionId)
        
        if (manualGradeInRequest !== undefined) {
          // Use the manual score provided in this request
          newTotalScore += manualGradeInRequest.manualScore
        } else if (studentAnswer.manualScore !== undefined) {
          // Use previously saved manual score
          newTotalScore += studentAnswer.manualScore
        } else {
          // Auto-grade by comparing student answer with correct answer
          if (!studentAnswer.answer) return;

          let isCorrect = false;
          let earnedMarks = 0;

          if (
            question.type === "mcq" ||
            (question as any).type === "mcq_multi" ||
            (question as any).type === "diagram" ||
            question.type === "assertion" ||
            question.type === "truefalse" ||
            question.type === "fillblanks"
          ) {
            const evalRes = evaluateObjectiveAnswer(question as any, studentAnswer.answer, {
              negativeMarking: Boolean(sectionNegativeMarking),
              negativeValue: sectionNegativeValue ?? 0,
            })
            isCorrect = evalRes.isCorrect
            earnedMarks = evalRes.earnedMarks
          } else if (question.type === "coding") {
            const totalPassed = studentAnswer.totalPassed || 0
            const totalCases = studentAnswer.totalCases || 0
            if (totalCases > 0) {
              const scoringMode = question.scoringMode || "partial"
              if (scoringMode === "all") {
                if (totalPassed === totalCases) {
                  isCorrect = true;
                  earnedMarks = question.marks;
                }
              } else {
                earnedMarks = question.marks * (totalPassed / totalCases)
                isCorrect = totalPassed === totalCases;
              }
            }
          }

          if (isCorrect) {
            newTotalScore += earnedMarks;
          } else if (earnedMarks !== 0) {
            newTotalScore += earnedMarks;
          }
        }
      })
    })

    attempt.score = newTotalScore
    attempt.isGraded = true
    attempt.status = "graded"

    // Update percentage and passed status
    if (attempt.maxScore) {
      attempt.percentage = Math.round((newTotalScore / attempt.maxScore) * 100)
      const passMarks = (attempt.examId as any)?.passMarks || 40
      attempt.passed = newTotalScore >= passMarks
    }

    await attempt.save()

    return NextResponse.json({ success: true, newScore: newTotalScore })
  } catch (error: any) {
    console.error("Grading error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
