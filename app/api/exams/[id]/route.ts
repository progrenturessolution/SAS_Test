import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import connectDB from "@/lib/mongodb"
import Exam from "@/models/Exam"
import mongoose from "mongoose"

const isValidObjectId = (id: string) => mongoose.isValidObjectId(id) && /^[0-9a-fA-F]{24}$/.test(id)

// GET /api/exams/[id]
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB()
    const { id } = await params
    if (!isValidObjectId(id)) {
      return NextResponse.json({ error: "Exam not found" }, { status: 404 })
    }
    const exam = await Exam.findById(id).lean()
    if (!exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 })
    return NextResponse.json({ exam })
  } catch (error) {
    const err = error as { name?: string }
    if (err?.name === "CastError") {
      return NextResponse.json({ error: "Exam not found" }, { status: 404 })
    }
    console.error("Get exam error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PUT /api/exams/[id]
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  try {
    await connectDB()
    const { id } = await params
    if (!isValidObjectId(id)) return NextResponse.json({ error: "Exam not found" }, { status: 404 })
    const body = await req.json()
    
    // Properly handle nested settings update with Date conversion
    const updateData = { ...body }
    if (updateData.settings) {
      // Create new settings object to ensure proper update
      updateData.settings = { ...updateData.settings }
      
      // Convert ISO 8601 local datetime string to Date
      // Input format: "2024-12-20T14:30" (local time)
      if (updateData.settings.startDate && typeof updateData.settings.startDate === 'string') {
        // Parse as local time by constructing the date directly
        const [dateStr, timeStr] = updateData.settings.startDate.split('T')
        if (dateStr && timeStr) {
          const [year, month, day] = dateStr.split('-')
          const [hours, minutes] = timeStr.split(':')
          // Create date in local timezone
          const baseDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 
                                     parseInt(hours), parseInt(minutes), 0)
          // Convert to UTC for storage
          updateData.settings.startDate = baseDate
        } else {
          updateData.settings.startDate = new Date(updateData.settings.startDate)
        }
      }
      
      if (updateData.settings.endDate && typeof updateData.settings.endDate === 'string') {
        const [dateStr, timeStr] = updateData.settings.endDate.split('T')
        if (dateStr && timeStr) {
          const [year, month, day] = dateStr.split('-')
          const [hours, minutes] = timeStr.split(':')
          const baseDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 
                                     parseInt(hours), parseInt(minutes), 0)
          updateData.settings.endDate = baseDate
        } else {
          updateData.settings.endDate = new Date(updateData.settings.endDate)
        }
      }
    }
    
    const exam = await Exam.findByIdAndUpdate(id, updateData, { new: true, runValidators: true })
    if (!exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 })
    return NextResponse.json({ exam })
  } catch (error) {
    console.error("Update exam error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE /api/exams/[id]
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  try {
    await connectDB()
    const { id } = await params
    if (!isValidObjectId(id)) return NextResponse.json({ error: "Exam not found" }, { status: 404 })
    await Exam.findByIdAndDelete(id)
    return NextResponse.json({ message: "Exam deleted" })
  } catch (error) {
    console.error("Delete exam error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
