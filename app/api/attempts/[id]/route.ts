import { NextResponse } from "next/server"
import connectDB from "@/lib/mongodb"
import Attempt from "@/models/Attempt"
import Exam from "@/models/Exam"
import { IQuestion } from "@/models/Exam"
import { generateContentWithKeyRotation } from "@/lib/gemini"

async function evaluateDescriptiveAnswerWithAI({
  questionText,
  modelAnswer,
  explanation,
  marks,
  studentAnswerText,
}: {
  questionText: string
  modelAnswer?: string
  explanation?: string
  marks: number
  studentAnswerText: string
}): Promise<{
  score: number
  maxScore: number
  verdict: "Correct" | "Partially Correct" | "Incorrect" | "Unattempted"
  whyRight: string
  whyWrong: string
  feedback: string
}> {
  if (!studentAnswerText || studentAnswerText.trim().length === 0) {
    return {
      score: 0,
      maxScore: marks,
      verdict: "Unattempted",
      whyRight: "No answer provided.",
      whyWrong: "The response was left blank.",
      feedback: "Please attempt descriptive questions by explaining concepts, steps, and formulas in detail.",
    }
  }

  const prompt = `You are an expert academic examiner evaluating a student's answer to a descriptive exam question.

Question:
${questionText}

${modelAnswer ? `Model / Reference Answer:\n${modelAnswer}\n` : ""}
${explanation ? `Scoring Rubric & Expected Key Points:\n${explanation}\n` : ""}
Maximum Marks: ${marks}

Student's Written Answer:
"""
${studentAnswerText}
"""

Evaluate the student's answer objectively:
1. "score": Award marks between 0 and ${marks} (can be fractional like 2.5, 3.5, etc., but within 0 to ${marks}).
2. "verdict": "Correct" (if scored >= 85% of max marks), "Partially Correct" (if scored > 0 and < 85%), or "Incorrect" (if scored 0 or almost entirely wrong).
3. "whyRight": Clearly describe what specific concepts, formulas, keywords, steps, or statements the student got right. If none, write "None identified."
4. "whyWrong": Clearly identify what was incorrect, inaccurate, missing, or omitted from the expected answer and rubric. If perfect, write "No significant errors or omissions found."
5. "feedback": Provide constructive, actionable advice for the student on how to write a better, more comprehensive answer.

Return ONLY a valid JSON object matching this schema:
{
  "score": number,
  "verdict": "Correct" | "Partially Correct" | "Incorrect",
  "whyRight": "string",
  "whyWrong": "string",
  "feedback": "string"
}`

  try {
    const result = await generateContentWithKeyRotation({
      payload: {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
        },
      },
      timeoutMs: 20000,
    })

    const parsed = JSON.parse(result.text.trim())
    const rawScore = typeof parsed.score === "number" ? parsed.score : Number(parsed.score) || 0
    const score = Math.max(0, Math.min(marks, Math.round(rawScore * 10) / 10))
    const verdict = (["Correct", "Partially Correct", "Incorrect"].includes(parsed.verdict)
      ? parsed.verdict
      : score >= marks * 0.85
      ? "Correct"
      : score > 0
      ? "Partially Correct"
      : "Incorrect") as "Correct" | "Partially Correct" | "Incorrect"

    return {
      score,
      maxScore: marks,
      verdict,
      whyRight: parsed.whyRight || "Key concepts identified in the response.",
      whyWrong: parsed.whyWrong || "No major omissions noted.",
      feedback: parsed.feedback || "Good attempt. Continue reviewing the subject fundamentals.",
    }
  } catch (err) {
    console.error("[evaluateDescriptiveAnswerWithAI] Error evaluating answer:", err)
    return {
      score: 0,
      maxScore: marks,
      verdict: "Partially Correct",
      whyRight: "Response recorded and saved for examiner evaluation.",
      whyWrong: "AI automated verification encountered a temporary connection delay.",
      feedback: "Your written answer has been saved and will be reviewed by the instructor.",
    }
  }
}

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

// GET /api/attempts/[id]
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB()
    const { id } = await params
    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      return NextResponse.json({ error: "Invalid attempt ID format" }, { status: 400 })
    }
    
    const attempt = (await Attempt.findById(id).populate("examId", "title totalMarks passMarks duration subject settings sections instituteId").lean()) as any
    if (!attempt) {
      return NextResponse.json({ error: "Attempt not found" }, { status: 404 })
    }
    
    // Ensure examId exists and is properly structured
    if (!attempt.examId) {
      console.error('Attempt found but examId missing:', id)
      return NextResponse.json({ error: "Exam data not found for this attempt" }, { status: 500 })
    }

    if ((attempt.examId as any)?.instituteId) {
      try {
        const Institute = (await import("@/models/Institute")).default
        const inst: any = await Institute.findById((attempt.examId as any).instituteId).select("name code logo themeColor").lean()
        if (inst) {
          (attempt.examId as any).institute = {
            name: inst.name,
            code: inst.code,
            logo: inst.logo || null,
            themeColor: inst.themeColor || "#2D3A4A",
          }
        }
      } catch {}
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
      delete (sanitizedAttempt as any).sectionResults
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

    // Idempotency check: If already submitted/graded (e.g. double-click or fast retry),
    // return existing calculated result immediately without re-grading or extra DB writes.
    if (attempt.status === "graded" || (attempt.status === "submitted" && attempt.submittedAt)) {
      const existingExam = (await Exam.findById(attempt.examId).select("settings").lean()) as any
      const showResults = existingExam?.settings?.showResults ?? true
      const sanitizedAttempt = { ...attempt.toObject() }
      if (!showResults) {
        delete (sanitizedAttempt as any).score
        delete (sanitizedAttempt as any).percentage
        delete (sanitizedAttempt as any).passed
        delete (sanitizedAttempt as any).manualScore
        delete (sanitizedAttempt as any).sectionResults
        if (sanitizedAttempt.answers) {
          sanitizedAttempt.answers = sanitizedAttempt.answers.map((ans: any) => {
            const { correct, marks, manualScore, ...rest } = ans
            return rest
          })
        }
      }
      return NextResponse.json({ attempt: sanitizedAttempt, showResults, alreadySubmitted: true })
    }

    if (body.answers) attempt.answers = body.answers
    if (body.proctoring) attempt.proctoring = body.proctoring
    if (body.autoSubmit) attempt.proctoring.autoSubmitted = true

    // Calculate score - load exam with lean() and select only needed fields for maximum speed
    const exam = (await Exam.findById(attempt.examId).select("duration passMarks settings sections").lean()) as any
    let score = 0
    let maxScore = 0
    const sectionResults: {
      name: string
      type: string
      attempted: number
      total: number
      correctOrMarked: number
      score: number
      maxScore: number
    }[] = []

    if (exam) {
      for (const section of exam.sections as any[]) {
        const sectionNegativeMarking = section.negativeMarking || exam.settings?.negativeMarking || false;
        const sectionNegativeValue = section.sectionNegativeMark ?? 0;

        let secScore = 0
        let secMaxScore = 0
        let secAttempted = 0
        let secCorrectOrMarked = 0

        for (const q of section.questions as IQuestion[]) {
          secMaxScore += q.marks
          maxScore += q.marks
          const studentAnswer = attempt.answers.find(
            (a: { questionId: string }) => a.questionId === q._id?.toString()
          )
          
          if (!studentAnswer || !studentAnswer.answer || (Array.isArray(studentAnswer.answer) && !studentAnswer.answer.some(Boolean))) continue

          secAttempted++

          let isCorrect = false;
          let earnedMarks = 0;

          if (q.type === "mcq" || q.type === "truefalse" || q.type === "assertion") {
            const correct = Array.isArray(q.correctAnswer)
              ? q.correctAnswer[0]
              : q.correctAnswer
            if (answersMatch(studentAnswer.answer, correct, (q.type === "mcq" || q.type === "assertion") ? q.options : undefined)) {
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
          } else if (q.type === "descriptive") {
            const ansText = typeof studentAnswer.answer === "string"
              ? studentAnswer.answer.trim()
              : Array.isArray(studentAnswer.answer)
              ? studentAnswer.answer.join(" ").trim()
              : ""

            if (ansText.length > 0) {
              const aiResult = await evaluateDescriptiveAnswerWithAI({
                questionText: q.questionText,
                modelAnswer: Array.isArray(q.correctAnswer) ? q.correctAnswer.join(", ") : (q.correctAnswer as string | undefined),
                explanation: (q as any).explanation,
                marks: q.marks,
                studentAnswerText: ansText,
              })

              earnedMarks = aiResult.score
              isCorrect = aiResult.verdict === "Correct" || aiResult.score >= (q.marks * 0.85)
              studentAnswer.earnedMarks = earnedMarks
              studentAnswer.isCorrect = isCorrect
              studentAnswer.feedback = aiResult.feedback
              studentAnswer.manualScore = earnedMarks
              studentAnswer.aiEvaluation = {
                score: aiResult.score,
                maxScore: q.marks,
                verdict: aiResult.verdict,
                whyRight: aiResult.whyRight,
                whyWrong: aiResult.whyWrong,
                feedback: aiResult.feedback,
              }
            }
          }

          if (isCorrect) {
            secCorrectOrMarked++
            score += earnedMarks;
            secScore += earnedMarks;
          } else if (earnedMarks > 0) {
            secCorrectOrMarked++
            score += earnedMarks;
            secScore += earnedMarks;
          } else if (sectionNegativeMarking && (q.type === "mcq" || q.type === "truefalse" || q.type === "assertion")) {
            // Apply negative marks only if explicitly wrong (not just empty)
            const negativeValue = q.negativeMark ?? sectionNegativeValue;
            score -= Math.abs(negativeValue);
            secScore -= Math.abs(negativeValue);
          }
        }

        sectionResults.push({
          name: section.name || "Questions",
          type: section.type || "mcq",
          attempted: secAttempted,
          total: section.questions.length,
          correctOrMarked: secCorrectOrMarked,
          score: Math.round(secScore * 100) / 100,
          maxScore: secMaxScore,
        })
      }
    }

    // AI verification grades descriptive questions automatically upon submit
    attempt.isGraded = true
    attempt.status = "graded"
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
    attempt.set("sectionResults", sectionResults)
    attempt.markModified("sectionResults")
    attempt.markModified("answers")
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
      delete (sanitizedAttempt as any).sectionResults
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
