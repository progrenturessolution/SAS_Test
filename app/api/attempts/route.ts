import { NextResponse } from "next/server"
import connectDB from "@/lib/mongodb"
import Attempt from "@/models/Attempt"
import Exam from "@/models/Exam"
import User from "@/models/User"
import { getExamStartDateTime, getExamEndDateTime } from "@/lib/examSchedule"

// POST /api/attempts - start an exam attempt
export async function POST(req: Request) {
  try {
    await connectDB()
    const { examId, studentName, studentEmail, rollNumber, password } = await req.json()
    const normalizedEmail = String(studentEmail || "").trim().toLowerCase()
    const normalizedRollNumber = String(rollNumber || "").trim()
    if (!examId || !studentName || !studentEmail || !rollNumber) {
      return NextResponse.json({ error: "All fields required" }, { status: 400 })
    }

    // Verify exam status and schedule window
    const exam = await Exam.findById(examId).lean()
    if (!exam || exam.status !== "active") {
      return NextResponse.json({ error: "Exam is not active or available" }, { status: 400 })
    }

    if (exam.instituteId) {
      const student = await User.findOne({
        email: normalizedEmail,
        rollNumber: normalizedRollNumber,
        role: "student",
        instituteId: exam.instituteId,
      })
      if (!student || !password || !(await student.comparePassword(password))) {
        return NextResponse.json(
          { error: "Only students registered by this coaching institute can enter this exam." },
          { status: 403 }
        )
      }
    }

    const now = Date.now()
    if (exam.settings?.startDate) {
      const startDateTime = getExamStartDateTime(exam.settings)
      // Allow early entrance 5 minutes before start time so candidate can complete camera setup
      const setupAllowedTime = startDateTime ? startDateTime.getTime() - (5 * 60 * 1000) : 0
      if (startDateTime && now < setupAllowedTime) {
        return NextResponse.json({
          error: `Camera setup opens 5 minutes before the exam (at ${new Date(setupAllowedTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })}).`
        }, { status: 403 })
      }
    }

    if (exam.settings?.endDate) {
      const endDateTime = getExamEndDateTime(exam.settings)
      if (endDateTime && now > endDateTime.getTime()) {
        return NextResponse.json({
          error: `This exam has ended and is closed.`
        }, { status: 403 })
      }
    }

    // Check if already has an active OR completed attempt.
    // Prevents a student who already submitted from starting a fresh attempt.
    const existing = await Attempt.findOne({
      examId,
      rollNumber: normalizedRollNumber,
      status: { $in: ["in-progress", "submitted", "auto-submitted", "graded"] },
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
      studentEmail: normalizedEmail,
      rollNumber: normalizedRollNumber,
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
