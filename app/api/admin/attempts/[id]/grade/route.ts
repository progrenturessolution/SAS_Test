import { NextResponse } from "next/server"
import connectDB from "@/lib/mongodb"
import Attempt from "@/models/Attempt"
import Exam from "@/models/Exam"

function answersMatch(
  studentAnswer: string | string[],
  correctAnswer: string | string[] | undefined,
  options?: string[]
) {
  const student = Array.isArray(studentAnswer) ? studentAnswer[0] : studentAnswer
  const correct = Array.isArray(correctAnswer) ? correctAnswer[0] : correctAnswer
  if (student === undefined || correct === undefined) return false

  const normalize = (value: string) => value
    .trim()
    .replace(/^[a-z]\s*[\)\.\-:]\s*/i, "")
    .replace(/\s+/g, " ")
    .toLowerCase()
  if (normalize(student) === normalize(correct)) return true

  if (options?.length) {
    const optionIndex = (value: string) => {
      const normalized = value.trim()
      if (/^[a-z]$/i.test(normalized)) {
        const index = normalized.toUpperCase().charCodeAt(0) - 65
        return index >= 0 && index < options.length ? index : -1
      }
      const numericIndex = Number(normalized)
      if (Number.isInteger(numericIndex)) {
        if (numericIndex >= 0 && numericIndex < options.length) return numericIndex
        if (numericIndex >= 1 && numericIndex <= options.length) return numericIndex - 1
      }
      return options.findIndex(option => normalize(option) === normalize(value))
    }

    const studentIndex = optionIndex(student)
    const correctIndex = optionIndex(correct)
    return studentIndex >= 0 && studentIndex === correctIndex
  }

  return false
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
        if (question.type === "mcq" || question.type === "truefalse") {
          const correct = Array.isArray(question.correctAnswer) 
            ? question.correctAnswer[0] 
            : question.correctAnswer
          if (answersMatch(ans.answer, correct, question.type === "mcq" ? question.options : undefined)) {
            autoScore = question.marks || 0
          }
        } else if (question.type === "fillblanks" && question.blanks) {
          const studentAnswers = Array.isArray(ans.answer) 
            ? ans.answer 
            : [ans.answer]
          question.blanks.forEach((blank: any, i: number) => {
            if (studentAnswers[i] && studentAnswers[i].trim() === blank.answer.trim()) {
              autoScore += question.marks / question.blanks.length
            }
          })
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

          if (question.type === "mcq" || question.type === "truefalse") {
            const correct = Array.isArray(question.correctAnswer) 
              ? question.correctAnswer[0] 
              : question.correctAnswer
            if (answersMatch(studentAnswer.answer, correct, question.type === "mcq" ? question.options : undefined)) {
              isCorrect = true;
              earnedMarks = question.marks || 0;
            }
          } else if (question.type === "fillblanks" && question.blanks) {
            const stuAnswers = Array.isArray(studentAnswer.answer) 
              ? studentAnswer.answer 
              : [studentAnswer.answer]
            let blankScore = 0
            let correctBlanks = 0;
            question.blanks.forEach((blank: any, i: number) => {
              if (stuAnswers[i] && stuAnswers[i].trim().toLowerCase() === blank.answer.trim().toLowerCase()) {
                correctBlanks++;
                blankScore += question.marks / question.blanks.length
              }
            })
            earnedMarks = blankScore;
            isCorrect = correctBlanks === question.blanks.length;
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
          } else if (earnedMarks > 0) {
            newTotalScore += earnedMarks;
          } else if (sectionNegativeMarking) {
            const negativeValue = question.negativeMark ?? sectionNegativeValue;
            newTotalScore -= Math.abs(negativeValue);
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
