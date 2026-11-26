import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { getSession } from "@/lib/auth"
import connectDB from "@/lib/mongodb"
import Institute from "@/models/Institute"
import User from "@/models/User"

interface RawBulkStudentRow {
  rowNumber?: number
  name?: unknown
  email?: unknown
  rollNumber?: unknown
  password?: unknown
  phone?: unknown
  batch?: unknown
  totalFees?: unknown
  completedFees?: unknown
}

interface ValidatedBulkStudent {
  rowNumber: number
  name: string
  email: string
  rollNumber: string
  password: string
  phone: string
  batch: string
  totalFees: number
  completedFees: number
  pendingFees: number
}

interface SkippedBulkRow {
  rowNumber: number
  name: string
  email: string
  rollNumber: string
  reason: string
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// POST /api/admin/students/bulk - Bulk register aspirants from Excel/CSV rows
export async function POST(req: Request) {
  const session = await getSession(req)
  const canManage =
    session &&
    (["super_admin", "admin", "institute", "coaching_institute"].includes(session.role) ||
      Boolean(session.instituteId))
  if (!canManage) {
    return NextResponse.json({ error: "Only an institute admin can add aspirants." }, { status: 403 })
  }

  try {
    const body = await req.json()
    const rawRows: RawBulkStudentRow[] = Array.isArray(body?.students) ? body.students : []

    if (rawRows.length === 0) {
      return NextResponse.json({ error: "No aspirant rows found in the uploaded sheet." }, { status: 400 })
    }

    if (rawRows.length > 500) {
      return NextResponse.json(
        { error: "Maximum 500 aspirants can be uploaded at a time. Please split larger sheets." },
        { status: 400 }
      )
    }

    await connectDB()

    let instituteId = session.instituteId
    if (!instituteId) {
      const activeInst = await Institute.findOne({ status: "active" }).select("_id").lean()
      if (activeInst) instituteId = activeInst._id.toString()
    }

    let maxStudentsLimit = 200
    if (instituteId) {
      const institute = await Institute.findById(instituteId).select("limits status").lean()
      if (institute && institute.status !== "active") {
        return NextResponse.json({ error: "Your institute account is not active." }, { status: 403 })
      }
      if (institute) {
        if (session.role === "institute" && institute.limits?.features?.aspirantsManagement === false) {
          return NextResponse.json(
            { error: "Access Restricted: Aspirants module is disabled for your organization." },
            { status: 403 }
          )
        }
        maxStudentsLimit = institute.limits?.maxStudents ?? 200
      }
    }

    const skippedRows: SkippedBulkRow[] = []
    const candidateRows: ValidatedBulkStudent[] = []
    const seenEmails = new Set<string>()
    const seenRolls = new Set<string>()

    rawRows.forEach((raw, idx) => {
      const rowNumber = Number(raw.rowNumber) || idx + 2
      const name = String(raw.name ?? "").trim()
      const email = String(raw.email ?? "").trim().toLowerCase()
      const rollNumber = String(raw.rollNumber ?? "").trim()
      const password = String(raw.password ?? "").trim()
      const phone = String(raw.phone ?? "").trim()
      const batch = String(raw.batch ?? "").trim()
      const totalFees = Math.max(0, Number(raw.totalFees) || 0)
      const completedFees = Math.max(0, Number(raw.completedFees) || 0)
      const pendingFees = Math.max(0, totalFees - completedFees)

      if (!name || !email || !rollNumber || !password) {
        skippedRows.push({
          rowNumber,
          name,
          email,
          rollNumber,
          reason: "Missing required fields (Name, Email, Roll Number, or Password).",
        })
        return
      }

      if (!EMAIL_REGEX.test(email)) {
        skippedRows.push({
          rowNumber,
          name,
          email,
          rollNumber,
          reason: "Invalid email format.",
        })
        return
      }

      if (password.length < 6) {
        skippedRows.push({
          rowNumber,
          name,
          email,
          rollNumber,
          reason: "Password must be at least 6 characters.",
        })
        return
      }

      if (seenEmails.has(email)) {
        skippedRows.push({
          rowNumber,
          name,
          email,
          rollNumber,
          reason: "Duplicate email within uploaded sheet.",
        })
        return
      }

      const rollKey = rollNumber.toLowerCase()
      if (seenRolls.has(rollKey)) {
        skippedRows.push({
          rowNumber,
          name,
          email,
          rollNumber,
          reason: "Duplicate roll number within uploaded sheet.",
        })
        return
      }

      seenEmails.add(email)
      seenRolls.add(rollKey)
      candidateRows.push({
        rowNumber,
        name,
        email,
        rollNumber,
        password,
        phone,
        batch,
        totalFees,
        completedFees,
        pendingFees,
      })
    })

    if (candidateRows.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "All rows failed validation. Please fix the sheet and try again.",
          createdCount: 0,
          skippedCount: skippedRows.length,
          skippedRows,
        },
        { status: 400 }
      )
    }

    // Check existing collisions in DB in a single query
    const emails = candidateRows.map((r) => r.email)
    const rolls = candidateRows.map((r) => r.rollNumber)
    const collisionConditions: any[] = [{ email: { $in: emails } }]
    if (instituteId) {
      collisionConditions.push({ instituteId, rollNumber: { $in: rolls } })
    } else {
      collisionConditions.push({ rollNumber: { $in: rolls } })
    }

    const existingUsers = await User.find({ $or: collisionConditions })
      .select("email rollNumber instituteId")
      .lean()

    const existingEmailSet = new Set(existingUsers.map((u: any) => String(u.email || "").toLowerCase()))
    const existingRollSet = new Set(existingUsers.map((u: any) => String(u.rollNumber || "").trim().toLowerCase()))

    const readyToInsert: ValidatedBulkStudent[] = []
    for (const row of candidateRows) {
      if (existingEmailSet.has(row.email)) {
        skippedRows.push({
          rowNumber: row.rowNumber,
          name: row.name,
          email: row.email,
          rollNumber: row.rollNumber,
          reason: "Email is already registered.",
        })
        continue
      }
      if (existingRollSet.has(row.rollNumber.toLowerCase())) {
        skippedRows.push({
          rowNumber: row.rowNumber,
          name: row.name,
          email: row.email,
          rollNumber: row.rollNumber,
          reason: "Roll number is already in use at this organization.",
        })
        continue
      }
      readyToInsert.push(row)
    }

    if (readyToInsert.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "All valid rows already exist or failed checks.",
          createdCount: 0,
          skippedCount: skippedRows.length,
          skippedRows,
        },
        { status: 409 }
      )
    }

    if (instituteId) {
      const currentCount = await User.countDocuments({ instituteId, role: "student" })
      const remainingSlots = Math.max(0, maxStudentsLimit - currentCount)
      if (readyToInsert.length > remainingSlots) {
        return NextResponse.json(
          {
            error: `Aspirant seat limit exceeded. You have ${remainingSlots} remaining seat${
              remainingSlots === 1 ? "" : "s"
            } (limit: ${maxStudentsLimit}), but ${readyToInsert.length} new aspirants are ready to import.`,
          },
          { status: 403 }
        )
      }
    }

    const docsToInsert = await Promise.all(
      readyToInsert.map(async (row) => {
        const hashedPassword = await bcrypt.hash(row.password, 10)
        return {
          name: row.name,
          email: row.email,
          password: hashedPassword,
          role: "student" as const,
          rollNumber: row.rollNumber,
          instituteId: instituteId || undefined,
          phone: row.phone,
          batch: row.batch,
          totalFees: row.totalFees,
          completedFees: row.completedFees,
          pendingFees: row.pendingFees,
          status: "active" as const,
          isActive: true,
          deactivationReason: "",
          examPassword: row.password,
        }
      })
    )

    const inserted = await User.insertMany(docsToInsert, { ordered: false })

    return NextResponse.json(
      {
        ok: true,
        createdCount: inserted.length,
        skippedCount: skippedRows.length,
        skippedRows: skippedRows.sort((a, b) => a.rowNumber - b.rowNumber),
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error("Bulk upload students error:", error)
    return NextResponse.json(
      { error: error?.message || "Failed to import aspirants from Excel sheet." },
      { status: 500 }
    )
  }
}

