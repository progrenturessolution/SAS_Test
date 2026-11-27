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

    const [institutes, allExams, studentCounts, attemptEmailsByExam] = await Promise.all([
      Institute.find().select("-logo").sort({ createdAt: -1 }).lean(),
      Exam.find({}, "_id instituteId createdBy").lean(),
      User.aggregate<{ _id: unknown; count: number }>([
        { $match: { role: "student", instituteId: { $ne: null } } },
        { $group: { _id: "$instituteId", count: { $sum: 1 } } },
      ]),
      Attempt.aggregate<{ _id: unknown; emails: string[] }>([
        { $group: { _id: "$examId", emails: { $addToSet: "$studentEmail" } } },
      ]),
    ])

    const studentCountByInst = new Map<string, number>()
    for (const row of studentCounts) {
      if (row._id) studentCountByInst.set(String(row._id), row.count)
    }

    const emailsByExamId = new Map<string, string[]>()
    for (const row of attemptEmailsByExam) {
      if (row._id) emailsByExamId.set(String(row._id), row.emails || [])
    }

    const examsByInstId = new Map<string, string[]>()
    const examsByCreatorId = new Map<string, string[]>()
    for (const ex of allExams as any[]) {
      const exId = String(ex._id)
      if (ex.instituteId) {
        const key = String(ex.instituteId)
        const list = examsByInstId.get(key) || []
        list.push(exId)
        examsByInstId.set(key, list)
      }
      if (ex.createdBy) {
        const key = String(ex.createdBy)
        const list = examsByCreatorId.get(key) || []
        list.push(exId)
        examsByCreatorId.set(key, list)
      }
    }

    const enrichedInstitutes = institutes.map((inst: any) => {
      const instIdStr = String(inst._id)
      const adminIdStr = inst.adminUserId ? String(inst.adminUserId) : ""
      const examIdSet = new Set<string>([
        ...(examsByInstId.get(instIdStr) || []),
        ...(adminIdStr ? examsByCreatorId.get(adminIdStr) || [] : []),
      ])
      const examCount = examIdSet.size

      const studentUserCount = studentCountByInst.get(instIdStr) || 0
      const distinctAttemptEmails = new Set<string>()
      examIdSet.forEach((exId) => {
        for (const em of emailsByExamId.get(exId) || []) {
          if (em) distinctAttemptEmails.add(em)
        }
      })

      const totalStudentsUsed = Math.max(studentUserCount, distinctAttemptEmails.size)

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
      customQuestionTypes = ["mcq", "assertion", "truefalse", "descriptive", "fillblanks", "coding"],
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

    // Determine expanded exam types; standard Exams ("EXAM", "CUSTOM") are always allowed for all organizations
    const rawIncomingTypes = Array.isArray(examTypes) ? examTypes : ["COMPETITIVE", "OTHER", "ASPIRANTS"]
    const hasCompetitive = rawIncomingTypes.some((t: string) =>
      ["COMPETITIVE", "NEET", "JEE_MAIN", "JEE_ADVANCED", "MHT_CET", "CBSE_BOARD"].includes(String(t).toUpperCase())
    )
    const hasOther = rawIncomingTypes.some((t: string) =>
      ["OTHER", "OTHER_EXAMS"].includes(String(t).toUpperCase())
    )
    const hasAspirants = rawIncomingTypes.some((t: string) =>
      ["ASPIRANTS", "STUDENTS"].includes(String(t).toUpperCase())
    ) || (features?.aspirantsManagement !== undefined ? Boolean(features.aspirantsManagement) : true)

    const finalExamTypes: string[] = ["EXAM", "CUSTOM"]
    if (hasCompetitive) {
      finalExamTypes.push("COMPETITIVE", "NEET", "JEE_MAIN", "JEE_ADVANCED", "MHT_CET", "CBSE_BOARD")
    }
    if (hasOther) {
      finalExamTypes.push("OTHER", "OTHER_EXAMS")
    }
    if (hasAspirants) {
      finalExamTypes.push("ASPIRANTS")
    }

    // 1. Create Institute document
    const newInstitute = await Institute.create({
      name: name.trim(),
      code: cleanCode,
      email: cleanEmail,
      adminPassword: String(password).trim(),
      phone: phone?.trim(),
      city: city?.trim(),
      address: address?.trim(),
      contactPerson: contactPerson?.trim(),
      limits: {
        maxStudents: Number(maxStudents) || 100,
        maxExams: Number(maxExams) || 20,
        examTypes: finalExamTypes,
        customQuestionTypes: Array.isArray(customQuestionTypes) && customQuestionTypes.length > 0
          ? customQuestionTypes
          : ["mcq", "assertion", "truefalse", "descriptive", "fillblanks", "coding"],
        features: {
          neetJeeGenerator: hasCompetitive,
          aiProctoring: features?.aiProctoring ?? true,
          pdfImport: features?.pdfImport ?? true,
          aspirantsManagement: hasAspirants,
          customLogo: features?.customLogo !== undefined ? Boolean(features.customLogo) : true,
          customThemeColor: features?.customThemeColor !== undefined ? Boolean(features.customThemeColor) : true,
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
