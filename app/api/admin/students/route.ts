import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import connectDB from "@/lib/mongodb"
import Attempt from "@/models/Attempt"
import Exam from "@/models/Exam"
import Institute from "@/models/Institute"
import User from "@/models/User"

// POST /api/admin/students - Add a student to the signed-in institute
export async function POST(req: Request) {
  const session = await getSession(req)
  if (!session?.instituteId || !["institute", "admin", "coaching_institute"].includes(session.role)) {
    return NextResponse.json({ error: "Only an institute admin can add students." }, { status: 403 })
  }

  try {
    const { name, email, rollNumber, password } = await req.json()
    const cleanName = String(name || "").trim()
    const cleanEmail = String(email || "").trim().toLowerCase()
    const cleanRollNumber = String(rollNumber || "").trim()

    if (!cleanName || !cleanEmail || !cleanRollNumber || !password) {
      return NextResponse.json({ error: "Name, email, roll number, and password are required." }, { status: 400 })
    }

    await connectDB()
    const institute = await Institute.findById(session.instituteId).select("limits status").lean()
    if (!institute || institute.status !== "active") {
      return NextResponse.json({ error: "Your institute account is not active." }, { status: 403 })
    }

    const studentCount = await User.countDocuments({ instituteId: session.instituteId, role: "student" })
    if (studentCount >= (institute.limits?.maxStudents ?? 100)) {
      return NextResponse.json({ error: "Student limit reached. Please contact the platform admin." }, { status: 403 })
    }

    const existing = await User.findOne({
      $or: [{ email: cleanEmail }, { instituteId: session.instituteId, rollNumber: cleanRollNumber }],
    })
    if (existing) {
      return NextResponse.json({ error: "Email or roll number is already registered." }, { status: 409 })
    }

    const student = await User.create({
      name: cleanName,
      email: cleanEmail,
      password,
      role: "student",
      rollNumber: cleanRollNumber,
      instituteId: session.instituteId,
    })

    return NextResponse.json({
      ok: true,
      student: { _id: student._id, name: student.name, email: student.email, rollNumber: student.rollNumber },
    }, { status: 201 })
  } catch (error) {
    console.error("Add student error:", error)
    return NextResponse.json({ error: "Failed to add student." }, { status: 500 })
  }
}

// GET /api/admin/students
export async function GET(req: Request) {
  const session = await getSession(req)
  const canViewStudents = session && (
    ["super_admin", "admin", "institute", "coaching_institute"].includes(session.role) ||
    Boolean(session.instituteId)
  )
  if (!canViewStudents) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  try {
    await connectDB()

    if (session.instituteId) {
      const students = await User.find(
        { instituteId: session.instituteId, role: "student" },
        "name email rollNumber createdAt"
      ).sort({ createdAt: -1 }).lean()
      const attempts = await Attempt.aggregate([
        { $match: { studentEmail: { $in: students.map((student) => student.email) } } },
        { $group: {
          _id: "$studentEmail",
          totalAttempts: { $sum: 1 },
          lastAttempt: { $max: "$startedAt" },
          avgPercentage: { $avg: "$percentage" },
        } },
      ])
      const attemptMap = new Map(attempts.map((attempt) => [attempt._id, attempt]))
      return NextResponse.json({
        students: students.map((student) => ({
          _id: student.email,
          studentName: student.name,
          email: student.email,
          rollNumber: student.rollNumber || "",
          totalAttempts: attemptMap.get(student.email)?.totalAttempts || 0,
          lastAttempt: attemptMap.get(student.email)?.lastAttempt || "",
          avgPercentage: attemptMap.get(student.email)?.avgPercentage,
        })),
      })
    }

    const matchStage: any = {}
    if (session.instituteId) {
      const exams = await Exam.find(
        { $or: [{ instituteId: session.instituteId }, { createdBy: session.id }] },
        "_id"
      ).lean()
      matchStage.examId = { $in: exams.map((e) => e._id) }
    }

    const pipeline: any[] = []
    if (Object.keys(matchStage).length > 0) {
      pipeline.push({ $match: matchStage })
    }

    pipeline.push(
      {
        $group: {
          _id: "$studentEmail",
          studentName: { $first: "$studentName" },
          rollNumber: { $first: "$rollNumber" },
          totalAttempts: { $sum: 1 },
          lastAttempt: { $max: "$startedAt" },
          avgPercentage: { $avg: "$percentage" },
        },
      },
      { $sort: { lastAttempt: -1 } }
    )

    const students = await Attempt.aggregate(pipeline)
    return NextResponse.json({ students })
  } catch (error) {
    console.error("Students error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
