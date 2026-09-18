import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import connectDB from "@/lib/mongodb"
import Attempt from "@/models/Attempt"

// GET /api/admin/students
export async function GET() {
  const session = await getSession()
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  try {
    await connectDB()
    const students = await Attempt.aggregate([
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
      { $sort: { lastAttempt: -1 } },
    ])
    return NextResponse.json({ students })
  } catch (error) {
    console.error("Students error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
