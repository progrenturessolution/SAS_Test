import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import connectDB from "@/lib/mongodb"
import Exam from "@/models/Exam"

// GET /api/exams
export async function GET(req: Request) {
  try {
    await connectDB()
    const session = await getSession()
    const { searchParams } = new URL(req.url)
    const status = searchParams.get("status")
    
    // If returning exams for admins, filter by creator or sharedWith.
    // Assuming this route is mostly for the dashboard or exams need to be restricted:
    let query: any = status ? { status } : {}
    if (session && session.role === "admin") {
      query = {
        ...query,
        $or: [{ createdBy: session.id }, { sharedWith: session.email }]
      }
    }

    const exams = await Exam.find(query).sort({ createdAt: -1 }).lean()
    return NextResponse.json({ exams })
  } catch (error) {
    console.error("Get exams error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/exams
export async function POST(req: Request) {
  const session = await getSession()
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  try {
    await connectDB()
    const body = await req.json()
    console.log("Creating exam with body:", JSON.stringify(body, null, 2))
    
    // Properly handle nested settings with Date conversion
    const examData = { ...body }
    if (examData.settings) {
      examData.settings = { ...examData.settings }
      
      // Convert ISO 8601 local datetime string to Date
      if (examData.settings.startDate && typeof examData.settings.startDate === 'string') {
        const [dateStr, timeStr] = examData.settings.startDate.split('T')
        if (dateStr && timeStr) {
          const [year, month, day] = dateStr.split('-')
          const [hours, minutes] = timeStr.split(':')
          const baseDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 
                                     parseInt(hours), parseInt(minutes), 0)
          examData.settings.startDate = baseDate
        } else {
          examData.settings.startDate = new Date(examData.settings.startDate)
        }
      }
      
      if (examData.settings.endDate && typeof examData.settings.endDate === 'string') {
        const [dateStr, timeStr] = examData.settings.endDate.split('T')
        if (dateStr && timeStr) {
          const [year, month, day] = dateStr.split('-')
          const [hours, minutes] = timeStr.split(':')
          const baseDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 
                                     parseInt(hours), parseInt(minutes), 0)
          examData.settings.endDate = baseDate
        } else {
          examData.settings.endDate = new Date(examData.settings.endDate)
        }
      }
    }
    
    const exam = await Exam.create({ ...examData, createdBy: session.id })
    return NextResponse.json({ exam }, { status: 201 })
  } catch (error) {
    console.error("Create exam error detail:", error)
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
