import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import connectDB from "@/lib/mongodb"
import { getPublicExamCapacity, resolveExamInstitute } from "@/lib/examCapacity"
import Exam from "@/models/Exam"
import GlobalSettings from "@/models/GlobalSettings"
import mongoose from "mongoose"
import { getExamStartDateTime, getExamEndDateTime } from "@/lib/examSchedule"

const isValidObjectId = (id: string) => mongoose.isValidObjectId(id) && /^[0-9a-fA-F]{24}$/.test(id)

// GET /api/exams/[id]
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB()
    const { id } = await params
    if (!isValidObjectId(id)) {
      return NextResponse.json({ error: "Exam not found" }, { status: 404 })
    }
    const exam: any = await Exam.findById(id).lean()
    if (!exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 })

    const session = await getSession(req)
    const canReadGeneratorSetup = Boolean(session && (
      session.role === "super_admin" ||
      session.role === "admin" ||
      (
        session.instituteId &&
        (
          String(exam.instituteId || "") === String(session.instituteId) ||
          String(exam.createdBy) === String(session.id)
        )
      )
    ))
    if (!canReadGeneratorSetup && exam.settings?.competitiveGenerator) {
      delete exam.settings.competitiveGenerator
    }

    // Attach coaching institute branding (logo, themeColor, name) and public seat capacity
    try {
      const inst: any = await resolveExamInstitute(exam)
      if (inst) {
        exam.institute = {
          name: inst.name,
          code: inst.code,
          logo: inst.logo || null,
          themeColor: inst.themeColor || "#2D3A4A",
        }
        const capacity = await getPublicExamCapacity(exam, inst)
        if (capacity) {
          exam.publicAccessLimit = capacity
        }
      }
    } catch (instErr) {
      console.warn("[GetExam] Could not load institute branding:", instErr)
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
        : ["NEET", "JEE_MAIN", "JEE_ADVANCED", "MHT_CET", "CBSE_BOARD", "CUSTOM", "OTHER", "OTHER_EXAMS"]
      const examType = String(body.examType).trim().toUpperCase()

      const isCompetitive = ["NEET", "JEE_MAIN", "JEE_ADVANCED", "MHT_CET", "CBSE_BOARD", "COMPETITIVE"].includes(examType)
      const isStandardExam = ["CUSTOM", "EXAM"].includes(examType)
      const isOtherExam = ["OTHER", "OTHER_EXAMS"].includes(examType)

      const hasCompAccess = allowedExamTypes.some((t) =>
        ["COMPETITIVE", "NEET", "JEE_MAIN", "JEE_ADVANCED", "MHT_CET", "CBSE_BOARD"].includes(t)
      )
      // Standard Exams section is always enabled for all organizations
      const hasExamAccess = true
      const hasOtherAccess = allowedExamTypes.some((t) => ["OTHER", "OTHER_EXAMS"].includes(t))

      const isAllowed =
        (isCompetitive && hasCompAccess) ||
        (isStandardExam && hasExamAccess) ||
        (isOtherExam && hasOtherAccess) ||
        allowedExamTypes.includes(examType)

      if (!isAllowed) {
        return NextResponse.json(
          { error: `This institute is not permitted to conduct ${examType.replaceAll("_", " ")} exams.` },
          { status: 403 }
        )
      }
      body.examType = examType
    }
    // All standard custom question types (including coding) are enabled across organizations
    
    // Properly handle nested settings update with Date conversion
    const updateData = { ...body }
    delete updateData.createdBy
    delete updateData.instituteId
    if (updateData.settings) {
      const mergedSettings = {
        ...((existingExam as any).settings || {}),
        ...updateData.settings,
      }
      if (updateData.settings.startDate) {
        mergedSettings.startDate = getExamStartDateTime(mergedSettings) || new Date(updateData.settings.startDate)
      }
      if (updateData.settings.endDate) {
        mergedSettings.endDate = getExamEndDateTime(mergedSettings) || new Date(updateData.settings.endDate)
      }
      updateData.settings = mergedSettings
    }
    
    if (Array.isArray(updateData.sections)) {
      const { normalizeStoredQuestion, toExamQuestionPayload } = await import("@/lib/ai/canonicalSchema")
      updateData.sections = updateData.sections.map((sec: any) => ({
        ...sec,
        questions: Array.isArray(sec.questions)
          ? sec.questions.map((q: any, qIdx: number) => ({
              ...q,
              ...toExamQuestionPayload(normalizeStoredQuestion(q, qIdx)),
            }))
          : [],
      }))
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
