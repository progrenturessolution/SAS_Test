import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import connectDB from "@/lib/mongodb"
import Institute from "@/models/Institute"
import User from "@/models/User"
import Exam from "@/models/Exam"
import Attempt from "@/models/Attempt"

// PUT /api/admin/institutes/[id] - Update limits, status, details
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session || !["super_admin", "admin"].includes(session.role) || session.instituteId) {
      return NextResponse.json({ error: "Unauthorized. Super Admin only." }, { status: 403 })
    }

    const { id } = await params
    const body = await req.json()

    await connectDB()

    const institute = await Institute.findById(id)
    if (!institute) {
      return NextResponse.json({ error: "Institute not found" }, { status: 404 })
    }

    // Editable fields
    if (body.name !== undefined) institute.name = body.name.trim()
    if (body.phone !== undefined) institute.phone = body.phone.trim()
    if (body.city !== undefined) institute.city = body.city.trim()
    if (body.address !== undefined) institute.address = body.address.trim()
    if (body.contactPerson !== undefined) institute.contactPerson = body.contactPerson.trim()
    if (body.status !== undefined) institute.status = body.status

    if (body.validUntil !== undefined) {
      institute.validUntil = body.validUntil ? new Date(body.validUntil) : undefined
    }

    if (body.limits) {
      let finalExamTypes = institute.limits.examTypes
      let hasComp = institute.limits.features?.neetJeeGenerator ?? true

      if (Array.isArray(body.limits.examTypes)) {
        const incomingTypes = body.limits.examTypes
        hasComp = incomingTypes.some((t: string) =>
          ["COMPETITIVE", "NEET", "JEE_MAIN", "JEE_ADVANCED", "MHT_CET", "CBSE_BOARD"].includes(String(t).toUpperCase())
        )
        const hasExam = incomingTypes.some((t: string) =>
          ["EXAM", "CUSTOM"].includes(String(t).toUpperCase())
        )
        const hasOther = incomingTypes.some((t: string) =>
          ["OTHER", "OTHER_EXAMS"].includes(String(t).toUpperCase())
        )

        finalExamTypes = []
        if (hasComp) {
          finalExamTypes.push("COMPETITIVE", "NEET", "JEE_MAIN", "JEE_ADVANCED", "MHT_CET", "CBSE_BOARD")
        }
        if (hasExam) {
          finalExamTypes.push("EXAM", "CUSTOM")
        }
        if (hasOther) {
          finalExamTypes.push("OTHER", "OTHER_EXAMS")
        }
      }

      institute.limits = {
        maxStudents: Number(body.limits.maxStudents ?? institute.limits.maxStudents),
        maxExams: Number(body.limits.maxExams ?? institute.limits.maxExams),
        examTypes: finalExamTypes,
        customQuestionTypes: Array.isArray(body.limits.customQuestionTypes) && body.limits.customQuestionTypes.length > 0
          ? body.limits.customQuestionTypes
          : institute.limits.customQuestionTypes,
        features: {
          neetJeeGenerator: hasComp,
          aiProctoring: body.limits.features?.aiProctoring ?? institute.limits.features.aiProctoring,
          pdfImport: body.limits.features?.pdfImport ?? institute.limits.features.pdfImport,
        },
      }
    }

    await institute.save()

    return NextResponse.json({ ok: true, message: "Institute updated successfully", institute })
  } catch (error: any) {
    console.error("Update institute error:", error)
    return NextResponse.json({ error: error.message || "Failed to update institute" }, { status: 500 })
  }
}

// DELETE /api/admin/institutes/[id]
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session || !["super_admin", "admin"].includes(session.role) || session.instituteId) {
      return NextResponse.json({ error: "Unauthorized. Super Admin only." }, { status: 403 })
    }

    const { id } = await params
    await connectDB()

    const institute = await Institute.findById(id)
    if (!institute) {
      return NextResponse.json({ error: "Institute not found" }, { status: 404 })
    }

    const instId = institute._id
    const instIdStr = institute._id.toString()
    const instEmail = institute.email?.toLowerCase().trim()
    const adminUserId = institute.adminUserId
    const adminUserIdStr = adminUserId?.toString()

    // 1. Identify all users belonging to this institute (students, admin, staff)
    const userConditions: any[] = [
      { instituteId: instId },
      { instituteId: instIdStr },
      { instituteId: id },
    ]
    if (adminUserId) {
      userConditions.push({ _id: adminUserId })
    }
    if (instEmail) {
      userConditions.push({ email: instEmail })
    }

    const instituteUsers = await User.find({ $or: userConditions }).lean()
    const allUserIds = instituteUsers.map((u) => u._id)
    const allUserIdsStr = instituteUsers.map((u) => u._id.toString())
    const allUserEmails = instituteUsers.map((u) => u.email).filter(Boolean)
    const studentCount = instituteUsers.filter((u) => u.role === "student").length

    // 2. Identify all exams belonging to this institute or created by its users
    const examConditions: any[] = [
      { instituteId: instId },
      { instituteId: instIdStr },
      { instituteId: id },
    ]
    if (adminUserIdStr) {
      examConditions.push({ createdBy: adminUserIdStr })
      examConditions.push({ createdBy: adminUserId })
    }
    if (allUserIdsStr.length > 0) {
      examConditions.push({ createdBy: { $in: allUserIdsStr } })
      examConditions.push({ createdBy: { $in: allUserIds } })
    }

    const instituteExams = await Exam.find({ $or: examConditions }, "_id").lean()
    const examIds = instituteExams.map((exam) => exam._id)
    const examIdsStr = instituteExams.map((exam) => exam._id.toString())

    // 3. Build query to delete all attempts associated with this institute's exams or students
    const attemptConditions: any[] = []
    if (examIds.length > 0) {
      attemptConditions.push({ examId: { $in: [...examIds, ...examIdsStr] } })
    }
    if (allUserEmails.length > 0) {
      const emailRegexes = allUserEmails.map(
        (e) => new RegExp(`^${e.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i")
      )
      attemptConditions.push({ studentEmail: { $in: allUserEmails } })
      attemptConditions.push({ studentEmail: { $in: emailRegexes } })
    }

    // 4. Cascade delete attempts, exams, users, and the institute itself
    const deletedAttempts = attemptConditions.length > 0
      ? await Attempt.deleteMany({ $or: attemptConditions })
      : { deletedCount: 0 }

    const deletedExams = await Exam.deleteMany({ $or: examConditions })
    const deletedUsers = await User.deleteMany({ $or: userConditions })

    await Institute.findByIdAndDelete(id)

    return NextResponse.json({
      ok: true,
      message: "Institute and all associated records (exams, attempts, students, admin) deleted successfully",
      deleted: {
        students: studentCount,
        users: deletedUsers.deletedCount,
        exams: deletedExams.deletedCount,
        attempts: deletedAttempts.deletedCount,
      },
    })
  } catch (error: any) {
    console.error("Delete institute error:", error)
    return NextResponse.json({ error: error.message || "Failed to delete institute" }, { status: 500 })
  }
}
