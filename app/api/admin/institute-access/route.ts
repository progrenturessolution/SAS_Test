import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import connectDB from "@/lib/mongodb"
import Institute from "@/models/Institute"

const ALL_EXAM_TYPES = ["NEET", "JEE_MAIN", "JEE_ADVANCED", "MHT_CET", "CBSE_BOARD", "CUSTOM", "CODING"]
const LEGACY_INSTITUTE_EXAM_TYPES = ["NEET", "JEE_MAIN", "JEE_ADVANCED", "MHT_CET", "CBSE_BOARD", "CUSTOM"]
const ALL_CUSTOM_QUESTION_TYPES = ["mcq", "truefalse", "descriptive", "fillblanks", "coding"]

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
        examTypes: ALL_EXAM_TYPES,
        features: {},
        customQuestionTypes: ALL_CUSTOM_QUESTION_TYPES,
      })
    }

    await connectDB()
    const institute = await Institute.findById(session.instituteId).select("limits").lean()
    if (!institute) {
      return NextResponse.json({ error: "Institute not found" }, { status: 404 })
    }

    return NextResponse.json({
      examTypes: Array.isArray(institute.limits?.examTypes)
        ? institute.limits.examTypes.map((type) => String(type).trim().toUpperCase())
        : LEGACY_INSTITUTE_EXAM_TYPES,
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
