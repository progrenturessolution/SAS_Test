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
      const [
        totalInstitutes,
        activeInstitutes,
        totalExams,
        activeExams,
        totalAttempts,
        distinctEmails,
        examsThisMonth,
      ] = await Promise.all([
        Institute.countDocuments(),
        Institute.countDocuments({ status: "active" }),
        Exam.countDocuments(),
        Exam.countDocuments({ status: "active" }),
        Attempt.countDocuments(),
        Attempt.distinct("studentEmail"),
        Exam.countDocuments({ createdAt: { $gte: thisMonth } }),
      ])

      return NextResponse.json({
        isSuperAdmin: true,
        totalInstitutes,
        activeInstitutes,
        totalExams,
        activeExams,
        totalAttempts,
        studentsEnrolled: distinctEmails.length,
        examsThisMonth,
      })
    }

    // Case 2: Coaching Organization Admin
    let institute: any = null
    const query: any = session.instituteId
      ? { $or: [{ instituteId: session.instituteId }, { createdBy: session.id }] }
      : { $or: [{ createdBy: session.id }, { sharedWith: session.email }] }

    const [instituteDoc, accessibleExams] = await Promise.all([
      session.instituteId ? Institute.findById(session.instituteId).lean() : Promise.resolve(null),
      Exam.find(query, "_id sections status createdAt").lean(),
    ])
    institute = instituteDoc

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

    let distinctStudents = 0
    let attemptsCount = 0
    let studentsThisMonth = 0

    if (examIds.length > 0) {
      const [emails, count, monthEmails] = await Promise.all([
        Attempt.distinct("studentEmail", { examId: { $in: examIds } }),
        Attempt.countDocuments({ examId: { $in: examIds } }),
        Attempt.distinct("studentEmail", { examId: { $in: examIds }, startedAt: { $gte: thisMonth } }),
      ])
      distinctStudents = emails.length
      attemptsCount = count
      studentsThisMonth = monthEmails.length
    }

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