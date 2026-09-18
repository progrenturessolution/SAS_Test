import { NextResponse } from "next/server"
import connectDB from "@/lib/mongodb"
import Attempt from "@/models/Attempt"
import Exam from "@/models/Exam"

// POST /api/attempts - start an exam attempt
export async function POST(req: Request) {
  try {
    await connectDB()
    const { examId, studentName, studentEmail, rollNumber } = await req.json()
    if (!examId || !studentName || !studentEmail || !rollNumber) {
      return NextResponse.json({ error: "All fields required" }, { status: 400 })
    }

    // Check if already has an active OR completed attempt.
    // Prevents a student who already submitted from starting a fresh attempt.
    const existing = await Attempt.findOne({
      examId,
      rollNumber,
      status: { $in: ["in-progress", "submitted", "auto-submitted"] },
    })
    if (existing) {
      return NextResponse.json(
        { attempt: existing, alreadySubmitted: existing.status !== "in-progress" },
        { status: existing.status === "in-progress" ? 200 : 409 }
      )
    }

    const attempt = await Attempt.create({
      examId,
      studentName,
      studentEmail,
      rollNumber,
      startedAt: new Date(),
      answers: [],
      proctoring: { warnings: 0, events: [] },
    })

    return NextResponse.json({ attempt }, { status: 201 })
  } catch (error) {
    console.error("[v0] Start attempt error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// GET /api/attempts?examId=...
export async function GET(req: Request) {
  try {
    await connectDB()
    const { searchParams } = new URL(req.url)
    const examId = searchParams.get("examId")
    const rollNumber = searchParams.get("rollNumber")
    const studentEmail = searchParams.get("studentEmail")

    const query: any = {}
    if (examId) query.examId = examId
    if (rollNumber) query.rollNumber = rollNumber
    if (studentEmail) query.studentEmail = studentEmail

    const attempts = await Attempt.find(query).sort({ startedAt: -1 }).lean()
    return NextResponse.json({ attempts })
  } catch (error) {
    console.error("[v0] Get attempts error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
