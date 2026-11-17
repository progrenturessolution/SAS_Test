import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import connectDB from "@/lib/mongodb"
import Exam from "@/models/Exam"
import GlobalSettings from "@/models/GlobalSettings"
import mongoose from "mongoose"
import { getExamStartDateTime, getExamEndDateTime } from "@/lib/examSchedule"

const isValidObjectId = (id: string) => mongoose.isValidObjectId(id) && /^[0-9a-fA-F]{24}$/.test(id)

// GET /api/exams/[id]
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB()
    const { id } = await params
    if (!isValidObjectId(id)) {
      return NextResponse.json({ error: "Exam not found" }, { status: 404 })
    }
    const exam: any = await Exam.findById(id).lean()
    if (!exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 })

    // Attach coaching institute branding (logo, themeColor, name)
    if (exam.instituteId) {
      try {
        const Institute = (await import("@/models/Institute")).default
        const inst: any = await Institute.findById(exam.instituteId).select("name code logo themeColor").lean()
        if (inst) {
          exam.institute = {
            name: inst.name,
            code: inst.code,
            logo: inst.logo || null,
            themeColor: inst.themeColor || "#2D3A4A",
          }
        }
      } catch (instErr) {
        console.warn("[GetExam] Could not load institute branding:", instErr)
      }
    }

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
  const session = await getSession(req)
  const canManageExams = session && (
    ["admin", "institute", "super_admin", "coaching_institute"].includes(session.role) ||
    Boolean(session.instituteId)
  )
  if (!canManageExams) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  try {
    await connectDB()
    const { id } = await params
    if (!isValidObjectId(id)) return NextResponse.json({ error: "Exam not found" }, { status: 404 })
    const body = await req.json()
    const existingExam = await Exam.findById(id).lean()
    if (!existingExam) return NextResponse.json({ error: "Exam not found" }, { status: 404 })
    if (
      session.role !== "super_admin" &&
      session.role !== "admin" &&
      !(
        session.instituteId &&
        (
          String(existingExam.instituteId || "") === String(session.instituteId) ||
          String(existingExam.createdBy) === String(session.id)
        )
      )
    ) {
      return NextResponse.json({ error: "You can only edit exams created by your institute." }, { status: 403 })
    }

    if (session.instituteId && body.examType !== undefined) {
      const Institute = (await import("@/models/Institute")).default
      const institute = await Institute.findById(session.instituteId).select("limits").lean()
      const allowedExamTypes = Array.isArray(institute?.limits?.examTypes)
        ? institute.limits.examTypes.map((type) => String(type).trim().toUpperCase())
        : ["NEET", "JEE_MAIN", "JEE_ADVANCED", "MHT_CET", "CBSE_BOARD", "CUSTOM"]
      const examType = String(body.examType).trim().toUpperCase()
      if (!allowedExamTypes.includes(examType)) {
        return NextResponse.json(
          { error: `This institute is not permitted to conduct ${examType.replaceAll("_", " ")} exams.` },
          { status: 403 }
        )
      }
      body.examType = examType
    }
    if (session.instituteId && String(body.examType || existingExam.examType).trim().toUpperCase() === "CUSTOM") {
      const Institute = (await import("@/models/Institute")).default
      const institute = await Institute.findById(session.instituteId).select("limits").lean()
      if (!institute) {
        return NextResponse.json(
          { error: "Institute access could not be verified. Please sign in again." },
          { status: 403 }
        )
      }
      const allowedCustomQuestionTypes = Array.isArray(institute?.limits?.customQuestionTypes)
        ? institute.limits.customQuestionTypes.map((type: string) => String(type).trim().toLowerCase())
        : []
      const questionTypes = Array.isArray(body.sections)
        ? body.sections.flatMap((section: { questions?: { type?: string }[] }) =>
            Array.isArray(section.questions) ? section.questions.map((question) => question.type) : []
          )
        : []
      const disallowedType = questionTypes.find(
        (type: unknown) => type && !allowedCustomQuestionTypes.includes(String(type).trim().toLowerCase())
      )
      if (disallowedType) {
        return NextResponse.json(
          { error: `${String(disallowedType)} questions are not enabled for Custom Tests in this institute.` },
          { status: 403 }
        )
      }
    }
    
    // Properly handle nested settings update with Date conversion
    const updateData = { ...body }
    delete updateData.createdBy
    delete updateData.instituteId
    if (updateData.settings) {
      updateData.settings = { ...updateData.settings }
      if (updateData.settings.startDate) {
        updateData.settings.startDate = getExamStartDateTime(updateData.settings) || new Date(updateData.settings.startDate)
      }
      if (updateData.settings.endDate) {
        updateData.settings.endDate = getExamEndDateTime(updateData.settings) || new Date(updateData.settings.endDate)
      }
    }
    
    const exam = await Exam.findByIdAndUpdate(id, updateData, { returnDocument: "after", runValidators: true })
    if (!exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 })
    return NextResponse.json({ exam })
  } catch (error) {
    console.error("Update exam error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE /api/exams/[id]
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(req)
  const canManageExams = session && (
    ["admin", "institute", "super_admin", "coaching_institute"].includes(session.role) ||
    Boolean(session.instituteId)
  )
  if (!canManageExams) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  try {
    await connectDB()
    const { id } = await params
    if (!isValidObjectId(id)) return NextResponse.json({ error: "Exam not found" }, { status: 404 })
    const existingExam = await Exam.findById(id).lean()
    if (!existingExam) return NextResponse.json({ error: "Exam not found" }, { status: 404 })
    if (
      session.role !== "super_admin" &&
      session.role !== "admin" &&
      !(
        session.instituteId &&
        (
          String(existingExam.instituteId || "") === String(session.instituteId) ||
          String(existingExam.createdBy) === String(session.id)
        )
      )
    ) {
      return NextResponse.json({ error: "You can only delete exams created by your institute." }, { status: 403 })
    }
    await Exam.findByIdAndDelete(id)
    return NextResponse.json({ message: "Exam deleted" })
  } catch (error) {
    console.error("Delete exam error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
