import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import connectDB from "@/lib/mongodb"
import Exam from "@/models/Exam"
import Attempt from "@/models/Attempt"
import Institute from "@/models/Institute"
import User from "@/models/User"

// GET /api/admin/stats
export async function GET(req: Request) {
  const session = await getSession(req)
  const canViewStats = session && (
    ["super_admin", "admin", "institute", "coaching_institute"].includes(session.role) ||
    Boolean(session.instituteId)
  )
  if (!canViewStats) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  try {
    await connectDB()

    const thisMonth = new Date()
    thisMonth.setDate(1)
    thisMonth.setHours(0, 0, 0, 0)

    // Case 1: Super Admin (Platform Admin)
    if ((session.role === "super_admin" || session.role === "admin") && !session.instituteId) {
      const totalInstitutes = await Institute.countDocuments()
      const activeInstitutes = await Institute.countDocuments({ status: "active" })
      const totalExams = await Exam.countDocuments()
      const activeExams = await Exam.countDocuments({ status: "active" })
      const totalAttempts = await Attempt.countDocuments()
      const distinctStudents = (await Attempt.distinct("studentEmail")).length
      const examsThisMonth = await Exam.countDocuments({ createdAt: { $gte: thisMonth } })

      return NextResponse.json({
        isSuperAdmin: true,
        totalInstitutes,
        activeInstitutes,
        totalExams,
        activeExams,
        totalAttempts,
        studentsEnrolled: distinctStudents,
        examsThisMonth,
      })
    }

    // Case 2: Coaching Institute Admin
    let institute: any = null
    if (session.instituteId) {
      institute = await Institute.findById(session.instituteId).lean()
    }

    const query: any = session.instituteId
      ? { $or: [{ instituteId: session.instituteId }, { createdBy: session.id }] }
      : { $or: [{ createdBy: session.id }, { sharedWith: session.email }] }

    const accessibleExams = await Exam.find(query, "_id sections status createdAt").lean()
    const examIds = accessibleExams.map((ex) => ex._id)

    const totalExams = accessibleExams.length
    const activeExams = accessibleExams.filter((e) => e.status === "active").length

    const totalQuestions = accessibleExams.reduce((sum, exam) => {
      return (
        sum +
        (exam.sections || []).reduce(
          (s: number, sec: { questions: unknown[] }) => s + (sec.questions?.length || 0),
          0
        )
      )
    }, 0)

    const examsThisMonth = accessibleExams.filter(
      (e) => e.createdAt && new Date(e.createdAt) >= thisMonth
    ).length

    const distinctStudents = examIds.length > 0
      ? (await Attempt.distinct("studentEmail", { examId: { $in: examIds } })).length
      : 0
    const attemptsCount = examIds.length > 0
      ? await Attempt.countDocuments({ examId: { $in: examIds } })
      : 0
    const studentsThisMonth = examIds.length > 0
      ? (await Attempt.distinct("studentEmail", { examId: { $in: examIds }, startedAt: { $gte: thisMonth } })).length
      : 0

    return NextResponse.json({
      isSuperAdmin: false,
      institute: institute
        ? {
            id: institute._id,
            name: institute.name,
            code: institute.code,
            status: institute.status,
            maxStudents: institute.limits?.maxStudents ?? 100,
            maxExams: institute.limits?.maxExams ?? 20,
            features: institute.limits?.features,
          }
        : null,
      totalExams,
      activeExams,
      totalQuestions,
      studentsEnrolled: distinctStudents || attemptsCount,
      totalAttempts: attemptsCount,
      examsThisMonth,
      studentsThisMonth,
    })
  } catch (error) {
    console.error("Stats error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}