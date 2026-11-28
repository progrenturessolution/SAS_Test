import crypto from "crypto"
import { NextResponse } from "next/server"
import connectDB from "@/lib/mongodb"
import Attempt from "@/models/Attempt"
import Exam from "@/models/Exam"
import User from "@/models/User"
import { getPublicExamCapacity } from "@/lib/examCapacity"
import { getExamStartDateTime, getExamEndDateTime } from "@/lib/examSchedule"

// POST /api/attempts - start an exam attempt
export async function POST(req: Request) {
  try {
    await connectDB()
    const { examId, studentName, studentEmail, studentPhone, rollNumber, password, candidateType } = await req.json()
    const isPublic = candidateType === "public"
    let normalizedEmail = String(studentEmail || "").trim().toLowerCase()
    let resolvedName = String(studentName || "").trim()
    let resolvedPhone = String(studentPhone || "").trim()
    let normalizedRollNumber =
      String(rollNumber || "").trim() ||
      (isPublic ? `PUB-${crypto.randomUUID().slice(0, 8).toUpperCase()}` : "")
    if (!examId || !resolvedName || !normalizedEmail || (!isPublic && !normalizedRollNumber)) {
      return NextResponse.json({ error: "All required fields must be provided" }, { status: 400 })
    }
    if (isPublic && !resolvedPhone) {
      return NextResponse.json({ error: "Mobile number is required for public exam applicants" }, { status: 400 })
    }

    // Verify exam status and schedule window
    const exam = await Exam.findById(examId).lean()
    if (!exam || exam.status !== "active") {
      return NextResponse.json({ error: "Exam is not active or available" }, { status: 400 })
    }

    // For non-public (institute registered) candidates, verify coaching student credentials and password
    if (!isPublic) {
      if (exam.instituteId) {
        const student = await User.findOne({
          role: "student",
          instituteId: exam.instituteId,
          $or: [
            { email: normalizedEmail },
            { rollNumber: normalizedRollNumber },
          ],
        })

        if (!student) {
          return NextResponse.json(
            { error: "Only aspirants registered by this coaching institute can enter this exam." },
            { status: 403 }
          )
        }

        if (student.status === "deactivated" || (student as any).isActive === false) {
          const reason =
            (student as any).deactivationReason?.trim() ||
            "Your aspirant account has been deactivated. Please contact your coaching administrator."
          return NextResponse.json({ error: reason }, { status: 403 })
        }

        if (!password || !(await student.comparePassword(password))) {
          return NextResponse.json(
            { error: "Invalid aspirant credentials or password." },
            { status: 403 }
          )
        }

        // Anchor identity to the verified User document so another candidate can never inherit someone else's session
        normalizedEmail = String(student.email || normalizedEmail).trim().toLowerCase()
        normalizedRollNumber = String(student.rollNumber || normalizedRollNumber).trim()
        resolvedName = String(student.name || resolvedName).trim()

        // Backfill plaintext examPassword for legacy aspirant accounts on successful login
        if (!(student as any).examPassword && typeof password === "string" && password.trim()) {
          await User.updateOne(
            { _id: student._id },
            { $set: { examPassword: password.trim() } }
          )
        }
        if (!resolvedPhone && (student as any).phone) {
          resolvedPhone = String((student as any).phone).trim()
        }
      } else {
        const student = await User.findOne({
          role: "student",
          $or: [
            { email: normalizedEmail },
            { rollNumber: normalizedRollNumber },
          ],
        })
        if (student && (student.status === "deactivated" || (student as any).isActive === false)) {
          const reason =
            (student as any).deactivationReason?.trim() ||
            "Your aspirant account has been deactivated. Please contact your coaching administrator."
          return NextResponse.json({ error: reason }, { status: 403 })
        }
        if (!resolvedPhone && (student as any)?.phone) {
          resolvedPhone = String((student as any).phone).trim()
        }
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

    // Check if this candidate (strictly matched by email, never by colliding rollNumber across students)
    // already has an active OR completed attempt.
    const existing = await Attempt.findOne({
      examId,
      studentEmail: normalizedEmail,
      status: { $in: ["in-progress", "submitted", "auto-submitted", "graded"] },
    })
    if (existing) {
      return NextResponse.json(
        { attempt: existing, alreadySubmitted: existing.status !== "in-progress" },
        { status: existing.status === "in-progress" ? 200 : 409 }
      )
    }

    // Enforce institute student limit for public exam links
    if (isPublic) {
      const capacity = await getPublicExamCapacity(exam)
      if (capacity && capacity.limitReached) {
        return NextResponse.json(
          {
            error: `Public exam registration limit reached (${capacity.usedSeats}/${capacity.maxStudents}). Only ${capacity.maxStudents} public students are allowed to take this exam.`,
            limitReached: true,
            publicAccessLimit: capacity,
          },
          { status: 403 }
        )
      }
    }

    const attempt = await Attempt.create({
      examId,
      studentName: resolvedName,
      studentEmail: normalizedEmail,
      studentPhone: resolvedPhone,
      rollNumber: normalizedRollNumber,
      candidateType: isPublic ? "public" : "institute",
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
