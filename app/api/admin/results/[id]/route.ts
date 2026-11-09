import { NextResponse } from "next/server"
import connectDB from "@/lib/mongodb"
import Attempt from "@/models/Attempt"
import { getSession } from "@/lib/auth"
import Exam from "@/models/Exam"

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession(req)
    const canViewResult = session && (
      ["super_admin", "admin", "institute", "coaching_institute"].includes(session.role) ||
      Boolean(session.instituteId)
    )
    if (!canViewResult) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    await connectDB()
    const { id } = await params
    const attempt = await Attempt.findById(id).lean()
    if (!attempt) return NextResponse.json({ error: "Not found" }, { status: 404 })
    if (session.instituteId) {
      const exam = await Exam.findOne({
        _id: attempt.examId,
        $or: [{ instituteId: session.instituteId }, { createdBy: session.id }],
      }).select("_id").lean()
      if (!exam) return NextResponse.json({ error: "Result does not belong to this institute." }, { status: 403 })
    }
    return NextResponse.json({ attempt })
  } catch (error) {
    console.error("[v0] Get attempt detail error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
