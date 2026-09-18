import { NextResponse } from "next/server"
import connectDB from "@/lib/mongodb"
import Attempt from "@/models/Attempt"
import Exam from "@/models/Exam"

// POST /api/exams/[id]/results/lookup — public result lookup by credentials
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB()
    const { id: examId } = await params
    const { rollNumber, email } = await req.json()

    if (!rollNumber && !email) {
      return NextResponse.json({ error: "Please provide Roll Number or Email" }, { status: 400 })
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

    // Build query — match by exam + at least one credential + only submitted attempts
    const query: Record<string, unknown> = {
      examId,
      status: { $in: ["submitted", "auto-submitted", "graded"] }, // Include graded attempts
    }

    if (rollNumber && email) {
      query.rollNumber = rollNumber.trim()
      query.studentEmail = email.trim().toLowerCase()
    } else if (rollNumber) {
      query.rollNumber = rollNumber.trim()
    } else {
      query.studentEmail = email.trim().toLowerCase()
    }

    const attempt = await Attempt.findOne(query)
      .sort({ submittedAt: -1 })
      .lean()

    if (!attempt) {
      return NextResponse.json(
        { error: "No submitted result found. Please check your Roll Number and Email." },
        { status: 404 }
      )
    }

    return NextResponse.json({
      attempt: {
        _id: attempt._id,
        examId: {
          _id: exam._id,
          title: (exam as any).title,
          totalMarks: (exam as any).totalMarks,
          passMarks: (exam as any).passMarks,
          duration: (exam as any).duration,
          subject: (exam as any).subject,
        },
        studentName: attempt.studentName,
        rollNumber: attempt.rollNumber,
        score: attempt.score,
        maxScore: attempt.maxScore,
        percentage: attempt.percentage,
        passed: attempt.passed,
        timeSpent: attempt.timeSpent,
        submittedAt: attempt.submittedAt,
        answers: attempt.answers,
      },
    })
  } catch (error) {
    console.error("[ResultLookup] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
