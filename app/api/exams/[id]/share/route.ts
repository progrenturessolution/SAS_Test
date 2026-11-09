import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import connectDB from "@/lib/mongodb"
import Exam from "@/models/Exam"

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(req)
    const canShare = session && (
      ["admin", "institute", "super_admin", "coaching_institute"].includes(session.role) ||
      Boolean(session.instituteId)
    )
    if (!canShare) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await connectDB()
    const { id } = await params
    const body = await req.json()
    const { email } = body

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }

    const exam = await Exam.findById(id)
    if (!exam) {
      return NextResponse.json({ error: "Exam not found" }, { status: 404 })
    }

    // Only creator or institute admin can share
    const isOwner = exam.createdBy === session.id || (
      session.instituteId && String(exam.instituteId || "") === String(session.instituteId)
    ) || session.role === "super_admin"
    if (!isOwner) {
      return NextResponse.json({ error: "Only the creator or institute admin can share this exam" }, { status: 403 })
    }

    if (!exam.sharedWith) {
      exam.sharedWith = []
    }

    if (!exam.sharedWith.includes(email)) {
      exam.sharedWith.push(email)
      await exam.save()
    }

    return NextResponse.json({ message: "Exam shared successfully", sharedWith: exam.sharedWith })
  } catch (error) {
    console.error("Share exam error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
