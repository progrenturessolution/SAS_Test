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
      institute.limits = {
        maxStudents: Number(body.limits.maxStudents ?? institute.limits.maxStudents),
        maxExams: Number(body.limits.maxExams ?? institute.limits.maxExams),
        examTypes: Array.isArray(body.limits.examTypes)
          ? body.limits.examTypes
          : institute.limits.examTypes,
        customQuestionTypes: Array.isArray(body.limits.customQuestionTypes)
          ? body.limits.customQuestionTypes
          : institute.limits.customQuestionTypes,
        features: {
          neetJeeGenerator: body.limits.features?.neetJeeGenerator ?? institute.limits.features.neetJeeGenerator,
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

    const instituteAdminId = institute.adminUserId?.toString()
    const instituteExamQuery = {
      $or: [
        { instituteId: institute._id },
        ...(instituteAdminId ? [{ createdBy: instituteAdminId }] : []),
      ],
    }

    const instituteExams = await Exam.find(instituteExamQuery, "_id").lean()
    const examIds = instituteExams.map((exam) => exam._id)
    const studentUsers = await User.find(
      { instituteId: institute._id, role: "student" },
      "email"
    ).lean()
    const studentEmails = studentUsers.map((student) => student.email)

    const attemptQuery: Record<string, unknown>[] = []
    if (examIds.length > 0) {
      attemptQuery.push({ examId: { $in: examIds } })
    }
    if (studentEmails.length > 0) {
      attemptQuery.push({ studentEmail: { $in: studentEmails } })
    }

    const deletedAttempts = attemptQuery.length > 0
      ? await Attempt.deleteMany({ $or: attemptQuery })
      : { deletedCount: 0 }
    const deletedExams = await Exam.deleteMany(instituteExamQuery)
    const deletedStudents = await User.deleteMany({
      instituteId: institute._id,
      role: "student",
    })

    if (institute.adminUserId) {
      await User.findByIdAndDelete(institute.adminUserId)
    }

    await Institute.findByIdAndDelete(id)

    return NextResponse.json({
      ok: true,
      message: "Institute and all related records removed successfully",
      deleted: {
        students: deletedStudents.deletedCount,
        exams: deletedExams.deletedCount,
        attempts: deletedAttempts.deletedCount,
      },
    })
  } catch (error: any) {
    console.error("Delete institute error:", error)
    return NextResponse.json({ error: error.message || "Failed to delete institute" }, { status: 500 })
  }
}
