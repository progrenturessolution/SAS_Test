import { NextResponse } from "next/server"
import connectDB from "@/lib/mongodb"
import Attempt from "@/models/Attempt"
import { getSession } from "@/lib/auth"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    await connectDB()
    const { id } = await params
    const attempt = await Attempt.findById(id).lean()
    if (!attempt) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json({ attempt })
  } catch (error) {
    console.error("[v0] Get attempt detail error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
