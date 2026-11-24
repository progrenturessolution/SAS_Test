import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import connectDB from "@/lib/mongodb"
import Exam from "@/models/Exam"
import { getExamStartDateTime, getExamEndDateTime } from "@/lib/examSchedule"
import { formatDateDDMMYYYY } from "@/lib/utils"

// GET /api/exams
export async function GET(req: Request) {
  try {
    await connectDB()
    const session = await getSession(req)
    const { searchParams } = new URL(req.url)
    const status = searchParams.get("status")

    let query: any = status ? { status } : {}
    if (session && (
      ["admin", "institute", "super_admin", "coaching_institute"].includes(session.role) ||
      Boolean(session.instituteId)
    )) {
      if (session.instituteId) {
        query = {
          ...query,
          $or: [{ instituteId: session.instituteId }, { createdBy: session.id }],
        }
      } else if (session.role === "admin" && !session.instituteId) {
        query = {
          ...query,
          $or: [{ createdBy: session.id }, { sharedWith: session.email }],
        }
      }
    }

    const exams = await Exam.find(
      query,
      "title examType subject class duration status createdAt sections.name sections.title sections.questions._id sections.questions.title"
    )
      .sort({ createdAt: -1 })
      .lean()
    return NextResponse.json({ exams })
  } catch (error) {
    console.error("Get exams error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/exams
export async function POST(req: Request) {
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
    const body = await req.json()

    // Institute Limit Enforcement
    let targetInstituteId = session.instituteId
    if (!targetInstituteId && session.role === "institute") {
      const User = (await import("@/models/User")).default
      const u = await User.findById(session.id).select("instituteId").lean()
      if (u?.instituteId) targetInstituteId = String(u.instituteId)
    }

    if (targetInstituteId) {
      const Institute = (await import("@/models/Institute")).default
      const institute = await Institute.findById(targetInstituteId).lean()
      if (!institute) {
        return NextResponse.json(
          { error: "Institute access could not be verified. Please sign in again." },
          { status: 403 }
        )
      }
      const isExpired = Boolean(
        institute.validUntil && new Date(institute.validUntil).getTime() < Date.now()
      )
      if (institute.status === "suspended" || institute.status === "expired" || isExpired) {
        let errorMsg = `Your coaching institute account is ${institute.status === "suspended" ? "deactivated" : institute.status}. You cannot create new exams.`
        if (isExpired) {
          const expDate = formatDateDDMMYYYY(institute.validUntil)
          errorMsg = `Your organization subscription expired on ${expDate}. You cannot create new exams. Please contact administrator to renew.`
        }
        return NextResponse.json(
          { error: errorMsg },
          { status: 403 }
        )
      }
      const examType = String(body.examType || "CUSTOM").trim().toUpperCase()
      const allowedExamTypes = Array.isArray(institute.limits?.examTypes)
        ? institute.limits.examTypes.map((type) => String(type).trim().toUpperCase())
        : ["NEET", "JEE_MAIN", "JEE_ADVANCED", "MHT_CET", "CBSE_BOARD", "CUSTOM", "EXAM", "COMPETITIVE", "OTHER", "OTHER_EXAMS"]

      const isCompetitive = ["NEET", "JEE_MAIN", "JEE_ADVANCED", "MHT_CET", "CBSE_BOARD", "COMPETITIVE"].includes(examType)
      const isStandardExam = ["CUSTOM", "EXAM"].includes(examType)
      const isOtherExam = ["OTHER", "OTHER_EXAMS"].includes(examType)

      const hasCompAccess = allowedExamTypes.some((t) =>
        ["COMPETITIVE", "NEET", "JEE_MAIN", "JEE_ADVANCED", "MHT_CET", "CBSE_BOARD"].includes(t)
      ) && institute.limits?.features?.neetJeeGenerator !== false
      const hasExamAccess = allowedExamTypes.some((t) => ["EXAM", "CUSTOM"].includes(t))
      const hasOtherAccess = allowedExamTypes.some((t) => ["OTHER", "OTHER_EXAMS"].includes(t))

      if (isCompetitive && !hasCompAccess) {
        return NextResponse.json(
          { error: "Your institute does not have permission to create Competitive Tests." },
          { status: 403 }
        )
      }
      if (isStandardExam && !hasExamAccess) {
        return NextResponse.json(
          { error: "Your institute does not have permission to create standard Exams." },
          { status: 403 }
        )
      }
      if (isOtherExam && !hasOtherAccess) {
        return NextResponse.json(
          { error: "Your institute does not have permission to create Other Exams." },
          { status: 403 }
        )
      }
      body.examType = examType
      if (examType === "CUSTOM") {
          const allowedCustomQuestionTypes = Array.isArray(institute.limits?.customQuestionTypes)
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
      const mongoose = (await import("mongoose")).default
      const instObjId = targetInstituteId && mongoose.Types.ObjectId.isValid(targetInstituteId)
        ? new mongoose.Types.ObjectId(targetInstituteId)
        : null
      const userObjId = session.id && mongoose.Types.ObjectId.isValid(session.id)
        ? new mongoose.Types.ObjectId(session.id)
        : null
      const adminObjId = institute.adminUserId && mongoose.Types.ObjectId.isValid(institute.adminUserId)
        ? new mongoose.Types.ObjectId(institute.adminUserId)
        : null

      const examConditions: any[] = [
        { instituteId: targetInstituteId },
        { instituteId: String(targetInstituteId) },
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
      const maxExams = Number(institute.limits?.maxExams ?? 20)
      if (examCount >= maxExams) {
        return NextResponse.json(
          {
            error: `Exam limit reached (${examCount}/${maxExams} exams used). Please contact administrator to increase your exam quota.`,
          },
          { status: 403 }
        )
      }
    }
    if (session.instituteId) {
      const Institute = (await import("@/models/Institute")).default
      const institute = await Institute.findById(session.instituteId).select("limits").lean()
      if (body.settings?.proctoring?.aiProctoring && !institute?.limits?.features?.aiProctoring) {
        return NextResponse.json(
          { error: "AI Proctoring is not enabled for this institute." },
          { status: 403 }
        )
      }
    }
    
    // Properly handle nested settings with Date conversion
    const examData = { ...body }
    if (examData.settings) {
      examData.settings = { ...examData.settings }
      if (examData.settings.startDate) {
        examData.settings.startDate = getExamStartDateTime(examData.settings) || new Date(examData.settings.startDate)
      }
      if (examData.settings.endDate) {
        examData.settings.endDate = getExamEndDateTime(examData.settings) || new Date(examData.settings.endDate)
      }
    }
    
    if (!examData.instructions || !Array.isArray(examData.instructions) || examData.instructions.length === 0) {
      examData.instructions = [
        "Read all questions carefully before answering.",
        "Do not switch tabs or exit the exam screen during the test.",
        "Ensure you have completed all required questions before finishing the exam.",
      ]
      if (!examData.description) {
        examData.description = examData.instructions.join("\n")
      }
    }

    const exam = await Exam.create({
      ...examData,
      createdBy: session.id,
      instituteId: targetInstituteId || undefined,
    })
    return NextResponse.json({ exam }, { status: 201 })
  } catch (error) {
    console.error("Create exam error detail:", error)
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
