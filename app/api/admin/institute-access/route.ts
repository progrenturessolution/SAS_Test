import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import connectDB from "@/lib/mongodb"
import Institute from "@/models/Institute"
import Exam from "@/models/Exam"

const ALL_EXAM_TYPES = ["NEET", "JEE_MAIN", "JEE_ADVANCED", "MHT_CET", "CBSE_BOARD", "CUSTOM", "CODING", "OTHER", "OTHER_EXAMS", "ASPIRANTS"]
const LEGACY_INSTITUTE_EXAM_TYPES = ["NEET", "JEE_MAIN", "JEE_ADVANCED", "MHT_CET", "CBSE_BOARD", "CUSTOM", "OTHER", "OTHER_EXAMS", "ASPIRANTS"]
const ALL_CUSTOM_QUESTION_TYPES = ["mcq", "assertion", "truefalse", "descriptive", "fillblanks", "coding"]

export async function GET(req: Request) {
  try {
    const session = await getSession(req)
    const canReadAccess = session && (
      ["admin", "institute", "super_admin", "coaching_institute"].includes(session.role) ||
      Boolean(session.instituteId)
    )
    if (!canReadAccess) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!session.instituteId) {
      return NextResponse.json({
        instituteName: session.instituteName || session.name || "Coaching Institute",
        instituteCode: session.instituteCode || "",
        validUntil: null,
        isExpired: false,
        status: "active",
        hasCompetitiveAccess: true,
        hasExamAccess: true,
        hasOtherExamsAccess: true,
        hasAspirantsAccess: true,
        maxExams: 999999,
        examCount: 0,
        isExamQuotaReached: false,
        examTypes: ALL_EXAM_TYPES,
        features: {},
        customQuestionTypes: ALL_CUSTOM_QUESTION_TYPES,
      })
    }

    await connectDB()
    const institute = await Institute.findById(session.instituteId)
      .select("name code logo themeColor limits validUntil status adminUserId")
      .lean()
    if (!institute) {
      return NextResponse.json({ error: "Institute not found" }, { status: 404 })
    }

    const isExpired = Boolean(
      institute.validUntil && new Date(institute.validUntil).getTime() < Date.now()
    )

    const rawExamTypes = Array.isArray(institute.limits?.examTypes)
      ? institute.limits.examTypes.map((type) => String(type).trim().toUpperCase())
      : LEGACY_INSTITUTE_EXAM_TYPES

    const hasCompetitiveAccess = rawExamTypes.some((t) =>
      ["COMPETITIVE", "NEET", "JEE_MAIN", "JEE_ADVANCED", "MHT_CET", "CBSE_BOARD"].includes(t)
    ) && institute.limits?.features?.neetJeeGenerator !== false

    const hasExamAccess = rawExamTypes.some((t) => ["EXAM", "CUSTOM"].includes(t))

    const hasOtherExamsAccess = rawExamTypes.some((t) => ["OTHER", "OTHER_EXAMS"].includes(t))

    const hasAspirantsAccess = Boolean(
      institute.limits?.features?.aspirantsManagement !== false &&
      (rawExamTypes.some((t) => ["ASPIRANTS", "STUDENTS"].includes(t)) ||
       (institute.limits?.features?.aspirantsManagement === undefined && !rawExamTypes.some((t) => ["COMPETITIVE", "OTHER"].includes(t))))
    )

    const maxExams = Number(institute.limits?.maxExams ?? 20)
    const mongoose = (await import("mongoose")).default
    const instObjId = session.instituteId && mongoose.Types.ObjectId.isValid(session.instituteId)
      ? new mongoose.Types.ObjectId(session.instituteId)
      : null
    const userObjId = session.id && mongoose.Types.ObjectId.isValid(session.id)
      ? new mongoose.Types.ObjectId(session.id)
      : null
    const adminObjId = institute.adminUserId && mongoose.Types.ObjectId.isValid(institute.adminUserId)
      ? new mongoose.Types.ObjectId(institute.adminUserId)
      : null

    const examConditions: any[] = [
      { instituteId: session.instituteId },
      { instituteId: String(session.instituteId) },
      ...(instObjId ? [{ instituteId: instObjId }] : []),
    ]
    if (session.id) {
      examConditions.push({ createdBy: session.id }, { createdBy: String(session.id) })
      if (userObjId) examConditions.push({ createdBy: userObjId })
    }
    if (institute.adminUserId) {
      examConditions.push({ createdBy: institute.adminUserId }, { createdBy: String(institute.adminUserId) })
      if (adminObjId) examConditions.push({ createdBy: adminObjId })
    }
    const examCount = await Exam.countDocuments({ $or: examConditions })
    const isExamQuotaReached = examCount >= maxExams

    return NextResponse.json({
      instituteName: institute.name || session.instituteName || "Coaching Institute",
      instituteCode: institute.code || session.instituteCode || "",
      logo: institute.logo || null,
      themeColor: institute.themeColor || "#2D3A4A",
      validUntil: institute.validUntil ? new Date(institute.validUntil).toISOString() : null,
      isExpired,
      status: institute.status || "active",
      hasCompetitiveAccess: isExpired ? false : hasCompetitiveAccess,
      hasExamAccess: isExpired ? false : hasExamAccess,
      hasOtherExamsAccess: isExpired ? false : hasOtherExamsAccess,
      hasAspirantsAccess: isExpired ? false : Boolean(hasAspirantsAccess),
      maxExams,
      examCount,
      isExamQuotaReached,
      examTypes: isExpired ? [] : rawExamTypes,
      features: institute.limits?.features || {},
      customQuestionTypes: Array.isArray(institute.limits?.customQuestionTypes)
        ? institute.limits.customQuestionTypes
        : ALL_CUSTOM_QUESTION_TYPES,
    })
  } catch (error) {
    console.error("Fetch institute access error:", error)
    return NextResponse.json({ error: "Failed to fetch institute access" }, { status: 500 })
  }
}
