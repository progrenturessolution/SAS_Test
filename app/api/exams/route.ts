import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import connectDB from "@/lib/mongodb"
import Exam from "@/models/Exam"
import { getExamStartDateTime, getExamEndDateTime } from "@/lib/examSchedule"

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
      "title subject class duration status createdAt sections.name sections.title sections.questions._id sections.questions.title"
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
    if (session.instituteId) {
      const Institute = (await import("@/models/Institute")).default
      const institute = await Institute.findById(session.instituteId).lean()
      if (!institute) {
        return NextResponse.json(
          { error: "Institute access could not be verified. Please sign in again." },
          { status: 403 }
        )
      }
      if (institute.status === "suspended" || institute.status === "expired") {
          return NextResponse.json(
            { error: `Your coaching institute account is ${institute.status}. You cannot create new exams.` },
            { status: 403 }
          )
      }
      const examType = String(body.examType || "CUSTOM").trim().toUpperCase()
        const allowedExamTypes = Array.isArray(institute.limits?.examTypes)
          ? institute.limits.examTypes.map((type) => String(type).trim().toUpperCase())
          : ["NEET", "JEE_MAIN", "JEE_ADVANCED", "MHT_CET", "CBSE_BOARD", "CUSTOM"]
      if (!allowedExamTypes.includes(examType)) {
          return NextResponse.json(
            { error: `This institute is not permitted to conduct ${examType.replaceAll("_", " ")} exams.` },
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
      const examCount = await Exam.countDocuments({
          $or: [{ instituteId: session.instituteId }, { createdBy: session.id }],
        })
        const maxExams = institute.limits?.maxExams ?? 20
      if (examCount >= maxExams) {
          return NextResponse.json(
            {
              error: `Exam limit reached (${examCount}/${maxExams} exams used). Please contact the platform admin to increase your exam quota.`,
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
    
    const exam = await Exam.create({
      ...examData,
      createdBy: session.id,
      instituteId: session.instituteId || undefined,
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
