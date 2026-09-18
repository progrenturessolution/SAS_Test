import { NextResponse } from "next/server"
import connectDB from "@/lib/mongodb"
import Attempt from "@/models/Attempt"

// POST /api/attempts/[id]/proctor - log a proctoring event
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB()
    const { id } = await params
    const { type, details } = await req.json()

    const attempt = await Attempt.findByIdAndUpdate(
      id,
      {
        $push: { "proctoring.events": { type, details, timestamp: new Date() } },
        $inc: { "proctoring.warnings": 1 },
      },
      { returnDocument: "after" }
    )

    if (!attempt) return NextResponse.json({ error: "Not found" }, { status: 404 })

    return NextResponse.json({
      warnings: attempt.proctoring.warnings,
      shouldAutoSubmit: false, // checked client-side against maxWarnings
    })
  } catch (error) {
    console.error("[v0] Proctor event error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
