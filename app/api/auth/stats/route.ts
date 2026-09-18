import { NextResponse } from "next/server"
import connectDB from "@/lib/mongodb"
import Attempt from "@/models/Attempt"

export async function GET(req: Request) {
  try {
    await connectDB()
    const { searchParams } = new URL(req.url)
    const email = searchParams.get("email")
    const roll = searchParams.get("roll")

    if (!email || !roll) {
      return NextResponse.json({ error: "Missing identity fields" }, { status: 400 })
    }

    const attempts = await Attempt.find({
      studentEmail: email,
      rollNumber: roll,
      status: { $in: ["submitted", "auto-submitted", "graded"] }
    }).lean()

    const totalExams = attempts.length
    const avgScore = totalExams > 0 
      ? attempts.reduce((acc, curr) => acc + (curr.percentage || 0), 0) / totalExams 
      : 0

    return NextResponse.json({
      stats: {
        totalExams,
        avgScore: Math.round(avgScore * 100) / 100
      }
    })
  } catch (error) {
    console.error("Student stats error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
