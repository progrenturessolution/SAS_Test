import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import connectDB from "@/lib/mongodb"
import Attempt from "@/models/Attempt"
import Exam from "@/models/Exam"

// GET /api/admin/results
export async function GET(req: Request) {
  const session = await getSession(req)
  const canViewResults = session && (
    ["super_admin", "admin", "institute", "coaching_institute"].includes(session.role) ||
    Boolean(session.instituteId)
  )
  if (!canViewResults) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  try {
    await connectDB()
    const { searchParams } = new URL(req.url)
    const examId = searchParams.get("examId")
    const page = parseInt(searchParams.get("page") || "1", 10)
    const limit = parseInt(searchParams.get("limit") || "50", 10)
    const skip = (page - 1) * limit

    let query: any = { status: { $ne: "in-progress" } }
    if (session.instituteId) {
      const instituteExamQuery = {
        $or: [{ instituteId: session.instituteId }, { createdBy: session.id }],
      }
      if (examId) {
        const instituteExam = await Exam.findOne({ _id: examId, ...instituteExamQuery }, "_id").lean()
        if (!instituteExam) {
          return NextResponse.json({ error: "Exam does not belong to this institute." }, { status: 403 })
        }
        query.examId = instituteExam._id
      } else {
        const instExams = await Exam.find(instituteExamQuery, "_id").lean()
        query.examId = { $in: instExams.map((e) => e._id) }
      }
    } else if (examId) {
      query.examId = examId
    }

    const [attempts, total] = await Promise.all([
      Attempt.find(query)
        .sort({ submittedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Attempt.countDocuments(query)
    ])
    
    const examIds = [...new Set(attempts.map((a) => a.examId?.toString()).filter(Boolean))]
    const exams = await Exam.find({ _id: { $in: examIds } }, "title subject").lean()
    const examMap = Object.fromEntries(exams.map((e) => [e._id.toString(), e]))

    const enriched = attempts.map((a) => ({
      ...a,
      examId: a.examId.toString(), // Keep as string for API response
      examTitle: examMap[a.examId?.toString()]?.title || "Unknown",
      examSubject: examMap[a.examId?.toString()]?.subject || "",
      isGraded: !!a.isGraded
    }))

    return NextResponse.json({ 
      results: enriched,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    })
  } catch (error) {
    console.error("Results error:", error)
    return NextResponse.json({ error: "Failed to fetch results" }, { status: 500 })
  }
}
