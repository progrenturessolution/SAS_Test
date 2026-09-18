import { NextResponse } from "next/server"
import connectDB from "@/lib/mongodb"
import Attempt from "@/models/Attempt"
import Exam from "@/models/Exam"
import { IQuestion } from "@/models/Exam"

// GET /api/attempts/[id]
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB()
    const { id } = await params
    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      return NextResponse.json({ error: "Invalid attempt ID format" }, { status: 400 })
    }
    
    const attempt = (await Attempt.findById(id).populate("examId", "title totalMarks passMarks duration subject settings sections").lean()) as any
    if (!attempt) {
      return NextResponse.json({ error: "Attempt not found" }, { status: 404 })
    }
    
    // Ensure examId exists and is properly structured
    if (!attempt.examId) {
      console.error('Attempt found but examId missing:', id)
      return NextResponse.json({ error: "Exam data not found for this attempt" }, { status: 500 })
    }
    
    const examData = attempt.examId as Record<string, unknown> | null
    const showResults = (examData as any)?.settings?.showResults ?? true
    
    // If attempt is graded, always show results regardless of showResults setting
    const isGraded = attempt.status === "graded" || attempt.isGraded === true
    
    // Sanitize attempt data if results are hidden and not manually graded yet
    const sanitizedAttempt = { ...attempt }
    if (!showResults && !isGraded) {
      delete (sanitizedAttempt as any).score
      delete (sanitizedAttempt as any).percentage
      delete (sanitizedAttempt as any).passed
      delete (sanitizedAttempt as any).manualScore
      if (sanitizedAttempt.answers) {
        sanitizedAttempt.answers = sanitizedAttempt.answers.map((ans: any) => {
          const { correct, marks, manualScore, ...rest } = ans
          return rest
        })
      }
    }

    return NextResponse.json({ attempt: sanitizedAttempt, showResults: isGraded || showResults })
  } catch (error) {
    console.error("[GET /api/attempts/[id]] Error:", error)
    return NextResponse.json({ error: "Failed to fetch attempt" }, { status: 500 })
  }
}

// PATCH /api/attempts/[id] - save answers
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB()
    const { id } = await params
    const body = await req.json()

    const update: Record<string, unknown> = {}
    if (body.answers !== undefined) update.answers = body.answers
    if (body.proctoring !== undefined) update.proctoring = body.proctoring
    if (body.timeLeft !== undefined) update.timeLeft = body.timeLeft
    update.lastSavedAt = new Date()

    const attempt = await Attempt.findByIdAndUpdate(id, { $set: update }, { returnDocument: "after" })
    if (!attempt) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json({ attempt })
  } catch (error) {
    console.error("[v0] Save attempt error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/attempts/[id]/submit - submit and calculate score
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB()
    const { id } = await params
    const body = await req.json()

    const attempt = await Attempt.findById(id)
    if (!attempt) return NextResponse.json({ error: "Not found" }, { status: 404 })

    if (body.answers) attempt.answers = body.answers
    if (body.proctoring) attempt.proctoring = body.proctoring
    if (body.autoSubmit) attempt.proctoring.autoSubmitted = true

    // Calculate score
    const exam = await Exam.findById(attempt.examId)
    let score = 0
    let maxScore = 0

    if (exam) {
      for (const section of exam.sections as any[]) {
        const sectionNegativeMarking = section.negativeMarking ?? exam.settings?.negativeMarking ?? false;
        const sectionNegativeValue = section.sectionNegativeMark ?? 0;

        for (const q of section.questions as IQuestion[]) {
          maxScore += q.marks
          const studentAnswer = attempt.answers.find(
            (a: { questionId: string }) => a.questionId === q._id?.toString()
          )
          
          if (!studentAnswer || !studentAnswer.answer) continue

          let isCorrect = false;
          let earnedMarks = 0;

          if (q.type === "mcq" || q.type === "truefalse") {
            const correct = Array.isArray(q.correctAnswer)
              ? q.correctAnswer[0]
              : q.correctAnswer
            if (studentAnswer.answer === correct) {
              isCorrect = true;
              earnedMarks = q.marks;
            }
          } else if (q.type === "fillblanks" && q.blanks) {
            const studentAnswers = Array.isArray(studentAnswer.answer)
              ? studentAnswer.answer
              : [studentAnswer.answer]
            let blankScore = 0
            let correctBlanks = 0;
            q.blanks.forEach((blank: { answer: string }, i: number) => {
              if (
                studentAnswers[i] &&
                studentAnswers[i].trim().toLowerCase() === blank.answer.trim().toLowerCase()
              ) {
                correctBlanks++;
                blankScore += q.marks / q.blanks!.length
              }
            })
            earnedMarks = blankScore;
            isCorrect = correctBlanks === q.blanks.length;
          } else if (q.type === "coding") {
            const testResults = (studentAnswer as any).testResults as { passed: boolean }[] | undefined
            const totalPassed = (studentAnswer as any).totalPassed ?? testResults?.filter(r => r.passed).length ?? 0
            const totalCases = (studentAnswer as any).totalCases ?? testResults?.length ?? 1
            
            if (totalPassed > 0) {
              const scoringMode = (q as any).scoringMode || "partial"
              if (scoringMode === "all") {
                if (totalPassed === totalCases) {
                  isCorrect = true;
                  earnedMarks = q.marks;
                }
              } else {
                earnedMarks = q.marks * (totalPassed / totalCases);
                isCorrect = totalPassed === totalCases;
              }
            }
          }

          if (isCorrect) {
            score += earnedMarks;
          } else if (earnedMarks > 0) {
              // Partial credit case
              score += earnedMarks;
          } else if (sectionNegativeMarking && (q.type === "mcq" || q.type === "truefalse")) {
            // Apply negative marks only if explicitly wrong (not just empty)
            const negativeValue = q.negativeMark ?? sectionNegativeValue;
            score -= Math.abs(negativeValue);
          }
        }
      }
    }

    const hasDescriptive = exam?.sections?.some((sec: any) =>
      sec.questions?.some((q: any) => q.type === "descriptive")
    )
    if (!hasDescriptive) {
      attempt.isGraded = true
      attempt.status = "graded"
    } else {
      attempt.status = body.autoSubmit ? "auto-submitted" : "submitted"
    }
    attempt.submittedAt = new Date()
    
    // Correctly calculate time taken: total exam duration minus time left
    if (exam && body.timeLeft !== undefined) {
      attempt.timeSpent = (exam.duration * 60) - body.timeLeft
    } else {
      attempt.timeSpent = body.timeSpent || 0
    }

    attempt.score = Math.round(score * 100) / 100
    attempt.maxScore = maxScore
    attempt.percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0
    // passed = scored at least passMarks (absolute, not relative)
    attempt.passed = exam ? attempt.score >= exam.passMarks : false

    await attempt.save()
    const showResults = exam?.settings?.showResults ?? true
    
    // Sanitize attempt data if results are hidden
    const sanitizedAttempt = { ...attempt.toObject() }
    if (!showResults) {
      delete (sanitizedAttempt as any).score
      delete (sanitizedAttempt as any).percentage
      delete (sanitizedAttempt as any).passed
      delete (sanitizedAttempt as any).manualScore
      if (sanitizedAttempt.answers) {
        sanitizedAttempt.answers = sanitizedAttempt.answers.map((ans: any) => {
          const { correct, marks, manualScore, ...rest } = ans
          return rest
        })
      }
    }

    return NextResponse.json({ attempt: sanitizedAttempt, showResults })
  } catch (error) {
    console.error("[v0] Submit attempt error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
