import { NextResponse } from "next/server"
import connectDB from "@/lib/mongodb"
import Attempt from "@/models/Attempt"
import Exam from "@/models/Exam"
import User from "@/models/User"

function phonesMatch(storedPhone: unknown, inputPhone: string): boolean {
  const storedDigits = String(storedPhone || "").replace(/\D/g, "")
  const inputDigits = inputPhone.replace(/\D/g, "")
  if (!storedDigits || !inputDigits) return false
  if (storedDigits === inputDigits) return true
  if (storedDigits.length >= 10 && inputDigits.length >= 10) {
    return storedDigits.slice(-10) === inputDigits.slice(-10)
  }
  return false
}

// POST /api/exams/[id]/results/lookup — public result lookup by Email and Mobile Number
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB()
    const { id: examId } = await params
    const { email, phone } = await req.json()
    const cleanEmail = String(email || "").trim().toLowerCase()
    const cleanPhone = String(phone || "").trim()

    if (!cleanEmail || !cleanPhone) {
      return NextResponse.json(
        { error: "Please enter both your Email Address and Mobile Number." },
        { status: 400 }
      )
    }

    if (cleanPhone.replace(/\D/g, "").length < 8) {
      return NextResponse.json(
        { error: "Please enter a valid Mobile Number." },
        { status: 400 }
      )
    }

    // Validate ObjectId format
    if (!/^[0-9a-fA-F]{24}$/.test(examId)) {
      return NextResponse.json({ error: "Invalid exam ID" }, { status: 404 })
    }

    // Verify exam exists
    const exam = await Exam.findById(examId).lean()
    if (!exam) {
      return NextResponse.json({ error: "Exam not found" }, { status: 404 })
    }

    const canViewResults =
      (exam as any)?.settings?.showResults !== false ||
      (exam as any)?.settings?.resultsPublished === true
    if (!canViewResults) {
      return NextResponse.json(
        {
          error: "Results have not been published yet. Please check back later.",
          unpublished: true,
        },
        { status: 403 }
      )
    }

    const attempts = await Attempt.find({
      examId,
      studentEmail: cleanEmail,
      status: { $in: ["submitted", "auto-submitted", "graded"] },
    })
      .sort({ submittedAt: -1 })
      .lean()

    const phoneMatchedAttempts = attempts.filter((att) => phonesMatch(att.studentPhone, cleanPhone))
    let matchedAttempt =
      phoneMatchedAttempts.find(
        (att) =>
          (Array.isArray(att.answers) && att.answers.length > 0) ||
          (typeof att.score === "number" && att.score !== 0)
      ) || phoneMatchedAttempts[0]

    // Fallback for institute attempts created before studentPhone was copied onto Attempt
    if (!matchedAttempt && attempts.length > 0) {
      const studentUser = await User.findOne({
        email: cleanEmail,
        role: "student",
      })
        .select("phone")
        .lean()
      if (studentUser?.phone && phonesMatch(studentUser.phone, cleanPhone)) {
        matchedAttempt =
          attempts.find(
            (att) =>
              (Array.isArray(att.answers) && att.answers.length > 0) ||
              (typeof att.score === "number" && att.score !== 0)
          ) || attempts[0]
      }
    }

    if (!matchedAttempt) {
      return NextResponse.json(
        { error: "No submitted result found. Please check your Email Address and Mobile Number." },
        { status: 404 }
      )
    }

    return NextResponse.json({
      attempt: {
        _id: matchedAttempt._id,
        examId: {
          _id: exam._id,
          title: (exam as any).title,
          totalMarks: (exam as any).totalMarks,
          passMarks: (exam as any).passMarks,
          duration: (exam as any).duration,
          subject: (exam as any).subject,
        },
        studentName: matchedAttempt.studentName,
        rollNumber: matchedAttempt.rollNumber,
        score: matchedAttempt.score,
        maxScore: matchedAttempt.maxScore,
        percentage: matchedAttempt.percentage,
        passed: matchedAttempt.passed,
        timeSpent: matchedAttempt.timeSpent,
        submittedAt: matchedAttempt.submittedAt,
        answers: matchedAttempt.answers,
      },
    })
  } catch (error) {
    console.error("[ResultLookup] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
