import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import connectDB from "@/lib/mongodb"
import Institute from "@/models/Institute"
import User from "@/models/User"
import Exam from "@/models/Exam"
import Attempt from "@/models/Attempt"

// GET /api/admin/institutes - List all institutes with usage metrics
export async function GET() {
  try {
    const session = await getSession()
    if (!session || !["super_admin", "admin"].includes(session.role) || session.instituteId) {
      return NextResponse.json({ error: "Unauthorized. Super Admin only." }, { status: 403 })
    }

    await connectDB()

    const institutes = await Institute.find().sort({ createdAt: -1 }).lean()

    // Calculate usage for each institute
    const enrichedInstitutes = await Promise.all(
      institutes.map(async (inst: any) => {
        // Count exams created for this institute
        const examCount = await Exam.countDocuments({
          $or: [{ instituteId: inst._id }, { createdBy: inst.adminUserId?.toString() }],
        })

        // Count unique students (from attempts or student users)
        const studentUserCount = await User.countDocuments({
          instituteId: inst._id,
          role: "student",
        })

        // Also check distinct student emails in attempts associated with this institute's exams
        const instExams = await Exam.find(
          { $or: [{ instituteId: inst._id }, { createdBy: inst.adminUserId?.toString() }] },
          "_id"
        ).lean()
        const examIds = instExams.map((e) => e._id)
        const distinctAttemptStudents = examIds.length > 0
          ? (await Attempt.distinct("studentEmail", { examId: { $in: examIds } })).length
          : 0

        const totalStudentsUsed = Math.max(studentUserCount, distinctAttemptStudents)

        return {
          ...inst,
          usage: {
            examsCreated: examCount,
            studentsEnrolled: totalStudentsUsed,
            examLimit: inst.limits?.maxExams ?? 20,
            studentLimit: inst.limits?.maxStudents ?? 100,
            isExamLimitReached: examCount >= (inst.limits?.maxExams ?? 20),
            isStudentLimitReached: totalStudentsUsed >= (inst.limits?.maxStudents ?? 100),
          },
        }
      })
    )

    return NextResponse.json({ institutes: enrichedInstitutes })
  } catch (error: any) {
    console.error("Fetch institutes error:", error)
    return NextResponse.json({ error: error.message || "Failed to fetch institutes" }, { status: 500 })
  }
}

// POST /api/admin/institutes - Register a new coaching institute
export async function POST(req: Request) {
  try {
    const session = await getSession()
    if (!session || !["super_admin", "admin"].includes(session.role) || session.instituteId) {
      return NextResponse.json({ error: "Unauthorized. Super Admin only." }, { status: 403 })
    }

    const body = await req.json()
    const {
      name,
      code,
      email,
      password,
      phone,
      city,
      address,
      contactPerson,
      maxStudents = 100,
      maxExams = 20,
      examTypes = ["NEET", "JEE_MAIN", "JEE_ADVANCED", "MHT_CET", "CBSE_BOARD", "CUSTOM"],
      customQuestionTypes = ["mcq", "truefalse", "descriptive", "fillblanks", "coding"],
      features = { neetJeeGenerator: true, aiProctoring: true, pdfImport: true },
      validUntil,
    } = body

    if (!name || !code || !email || !password) {
      return NextResponse.json(
        { error: "Institute Name, Code, Email, and Initial Password are required" },
        { status: 400 }
      )
    }

    await connectDB()

    const cleanCode = code.trim().toUpperCase()
    const cleanEmail = email.trim().toLowerCase()

    // Check if code or email already exists
    const existingInst = await Institute.findOne({
      $or: [{ code: cleanCode }, { email: cleanEmail }],
    })
    if (existingInst) {
      if (existingInst.code === cleanCode) {
        return NextResponse.json(
          { error: `Institute code "${cleanCode}" is already taken.` },
          { status: 400 }
        )
      }
      return NextResponse.json(
        { error: `Email "${cleanEmail}" is already registered.` },
        { status: 400 }
      )
    }

    const existingUser = await User.findOne({ email: cleanEmail })
    if (existingUser) {
      return NextResponse.json(
        { error: `A user account with email "${cleanEmail}" already exists.` },
        { status: 400 }
      )
    }

    // 1. Create Institute document
    const newInstitute = await Institute.create({
      name: name.trim(),
      code: cleanCode,
      email: cleanEmail,
      phone: phone?.trim(),
      city: city?.trim(),
      address: address?.trim(),
      contactPerson: contactPerson?.trim(),
      limits: {
        maxStudents: Number(maxStudents) || 100,
        maxExams: Number(maxExams) || 20,
        examTypes: Array.isArray(examTypes)
          ? examTypes
          : ["NEET", "JEE_MAIN", "JEE_ADVANCED", "MHT_CET", "CBSE_BOARD", "CUSTOM"],
        customQuestionTypes: Array.isArray(customQuestionTypes)
          ? customQuestionTypes
          : ["mcq", "truefalse", "descriptive", "fillblanks", "coding"],
        features: {
          neetJeeGenerator: features.neetJeeGenerator ?? true,
          aiProctoring: features.aiProctoring ?? true,
          pdfImport: features.pdfImport ?? true,
        },
      },
      validUntil: validUntil ? new Date(validUntil) : undefined,
      status: "active",
    })

    // 2. Create the Institute Admin User
    const newAdminUser = await User.create({
      name: name.trim() + " Admin",
      email: cleanEmail,
      password: password,
      role: "institute",
      instituteId: newInstitute._id,
    })

    // 3. Link user ID back to institute
    newInstitute.adminUserId = newAdminUser._id
    await newInstitute.save()

    return NextResponse.json(
      {
        ok: true,
        message: "Coaching institute registered successfully!",
        institute: newInstitute,
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error("Register institute error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to register coaching institute" },
      { status: 500 }
    )
  }
}
