import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import connectDB from "@/lib/mongodb"
import Attempt from "@/models/Attempt"
import Exam from "@/models/Exam"

// GET /api/admin/results
export async function GET(req: Request) {
  const session = await getSession()
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  try {
    await connectDB()
    const { searchParams } = new URL(req.url)
    const examId = searchParams.get("examId")
    const page = parseInt(searchParams.get("page") || "1", 10)
    const limit = parseInt(searchParams.get("limit") || "50", 10)
    const skip = (page - 1) * limit

    const query = examId ? { examId, status: { $ne: "in-progress" } } : { status: { $ne: "in-progress" } }

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
