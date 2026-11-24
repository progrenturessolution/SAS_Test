import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { getSession } from "@/lib/auth"
import connectDB from "@/lib/mongodb"
import Attempt from "@/models/Attempt"
import Institute from "@/models/Institute"
import User from "@/models/User"

// POST /api/admin/students - Add a student to the signed-in institute
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
    const { name, email, rollNumber, password, phone, batch, totalFees, completedFees } = body
    const cleanName = String(name || "").trim()
    const cleanEmail = String(email || "").trim().toLowerCase()
    const cleanRollNumber = String(rollNumber || "").trim()
    const cleanPhone = String(phone || "").trim()
    const cleanBatch = String(batch || "").trim()

    const parsedTotalFees = Math.max(0, Number(totalFees) || 0)
    const parsedCompletedFees = Math.max(0, Number(completedFees) || 0)
    const calculatedPendingFees = Math.max(0, parsedTotalFees - parsedCompletedFees)

    if (!cleanName || !cleanEmail || !cleanRollNumber || !password) {
      return NextResponse.json({ error: "Name, email, roll number, and password are required." }, { status: 400 })
    }

    if (String(password).length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 })
    }

    await connectDB()

    let instituteId = session.instituteId
    if (!instituteId) {
      const activeInst = await Institute.findOne({ status: "active" }).select("_id").lean()
      if (activeInst) instituteId = activeInst._id.toString()
    }

    if (instituteId) {
      const institute = await Institute.findById(instituteId).select("limits status").lean()
      if (institute && institute.status !== "active") {
        return NextResponse.json({ error: "Your institute account is not active." }, { status: 403 })
      }
      if (institute) {
        if (session.role === "institute" && institute.limits?.features?.aspirantsManagement === false) {
          return NextResponse.json({ error: "Access Restricted: Aspirants module is disabled for your organization." }, { status: 403 })
        }
        const studentCount = await User.countDocuments({ instituteId, role: "student" })
        if (studentCount >= (institute.limits?.maxStudents ?? 200)) {
          return NextResponse.json({ error: "Aspirant limit reached. Please contact platform admin." }, { status: 403 })
        }
      }
    }

    const collisionQuery: any = { $or: [{ email: cleanEmail }] }
    if (instituteId) {
      collisionQuery.$or.push({ instituteId, rollNumber: cleanRollNumber })
    } else {
      collisionQuery.$or.push({ rollNumber: cleanRollNumber })
    }

    const existing = await User.findOne(collisionQuery)
    if (existing) {
      if (existing.email === cleanEmail) {
        return NextResponse.json({ error: "An aspirant with this email is already registered." }, { status: 409 })
      }
      return NextResponse.json({ error: "Roll number is already in use at this institute." }, { status: 409 })
    }

    const student = await User.create({
      name: cleanName,
      email: cleanEmail,
      password,
      role: "student",
      rollNumber: cleanRollNumber,
      instituteId: instituteId || undefined,
      phone: cleanPhone,
      batch: cleanBatch,
      totalFees: parsedTotalFees,
      completedFees: parsedCompletedFees,
      pendingFees: calculatedPendingFees,
      status: "active",
      isActive: true,
      deactivationReason: "",
      examPassword: String(password).trim(),
    })

    // Explicit update to guarantee all fields are persisted in MongoDB
    await User.updateOne(
      { _id: student._id },
      {
        $set: {
          phone: cleanPhone,
          batch: cleanBatch,
          totalFees: parsedTotalFees,
          completedFees: parsedCompletedFees,
          pendingFees: calculatedPendingFees,
          status: "active",
          isActive: true,
          deactivationReason: "",
          examPassword: String(password).trim(),
        },
      }
    )

    return NextResponse.json(
      {
        ok: true,
        student: {
          _id: student._id.toString(),
          studentName: cleanName,
          email: cleanEmail,
          rollNumber: cleanRollNumber,
          phone: cleanPhone,
          batch: cleanBatch,
          totalFees: parsedTotalFees,
          completedFees: parsedCompletedFees,
          pendingFees: calculatedPendingFees,
          status: "active",
          isActive: true,
          deactivationReason: "",
          examPassword: String(password).trim(),
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Add student error:", error)
    return NextResponse.json({ error: "Failed to add student." }, { status: 500 })
  }
}

// GET /api/admin/students
export async function GET(req: Request) {
  const session = await getSession(req)
  const canViewStudents =
    session &&
    (["super_admin", "admin", "institute", "coaching_institute"].includes(session.role) ||
      Boolean(session.instituteId))
  if (!canViewStudents) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  try {
    await connectDB()

    if (session.instituteId && session.role !== "super_admin") {
      const institute = await Institute.findById(session.instituteId).select("limits status").lean()
      if (institute && institute.limits?.features?.aspirantsManagement === false) {
        return NextResponse.json({ error: "Access Restricted: Aspirants module is disabled for your organization.", students: [] }, { status: 403 })
      }
    }

    const filter: any = { role: "student" }
    if (session.instituteId) {
      filter.instituteId = session.instituteId
    }

    const students = await User.find(filter)
      .sort({ createdAt: -1 })
      .lean()

    const studentEmails = students.map((s) => s.email).filter(Boolean)

    const attempts = await Attempt.aggregate([
      { $match: { studentEmail: { $in: studentEmails } } },
      {
        $group: {
          _id: "$studentEmail",
          totalAttempts: { $sum: 1 },
          lastAttempt: { $max: "$startedAt" },
          avgPercentage: { $avg: "$percentage" },
        },
      },
    ])
    const attemptMap = new Map(attempts.map((a) => [a._id, a]))

    return NextResponse.json({
      students: students.map((s: any) => {
        const totalFees = Number(s.totalFees) || 0
        const completedFees = Number(s.completedFees) || 0
        const pendingFees =
          s.pendingFees !== undefined && s.pendingFees !== null && !isNaN(Number(s.pendingFees))
            ? Number(s.pendingFees)
            : Math.max(0, totalFees - completedFees)

        const isDeactivated = s.status === "deactivated" || s.isActive === false
        const status = isDeactivated ? "deactivated" : "active"

        return {
          _id: s._id.toString(),
          studentName: s.name,
          email: s.email,
          rollNumber: s.rollNumber || "",
          phone: s.phone || "",
          batch: s.batch || "",
          totalFees,
          completedFees,
          pendingFees,
          status,
          isActive: !isDeactivated,
          deactivationReason: s.deactivationReason || "",
          examPassword: s.examPassword || "",
          createdAt: s.createdAt,
          totalAttempts: attemptMap.get(s.email)?.totalAttempts || 0,
          lastAttempt: attemptMap.get(s.email)?.lastAttempt || "",
          avgPercentage: attemptMap.get(s.email)?.avgPercentage,
        }
      }),
    })
  } catch (error) {
    console.error("Students error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PUT /api/admin/students - Edit student details, fees, or toggle status
export async function PUT(req: Request) {
  const session = await getSession(req)
  const canManage =
    session &&
    (["super_admin", "admin", "institute", "coaching_institute"].includes(session.role) ||
      Boolean(session.instituteId))
  if (!canManage) {
    return NextResponse.json({ error: "Only an institute admin can edit aspirants." }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { id, name, email, rollNumber, password, phone, batch, totalFees, completedFees, action, status, deactivationReason } = body

    if (!id && !email) {
      return NextResponse.json({ error: "Aspirant ID or email is required." }, { status: 400 })
    }

    await connectDB()

    const query: any = id ? { _id: id, role: "student" } : { email: String(email).toLowerCase().trim(), role: "student" }
    if (session.instituteId) {
      query.instituteId = session.instituteId
    }

    const student = await User.findOne(query)
    if (!student) {
      return NextResponse.json({ error: "Aspirant not found." }, { status: 404 })
    }

    // Status Toggle Action (Activate / Deactivate)
    if (action === "toggle_status" || status !== undefined) {
      const newStatus = status === "deactivated" ? "deactivated" : "active"
      const reason =
        newStatus === "deactivated"
          ? String(deactivationReason || "").trim() || "Account deactivated by coaching administration."
          : ""

      const updated = await User.findByIdAndUpdate(
        student._id,
        {
          $set: {
            status: newStatus,
            isActive: newStatus === "active",
            deactivationReason: reason,
          },
        },
        { new: true, lean: true }
      )
      if (!updated) {
        return NextResponse.json({ error: "Failed to update aspirant status." }, { status: 404 })
      }

      return NextResponse.json({
        ok: true,
        message: newStatus === "active" ? "Aspirant activated successfully." : "Aspirant deactivated successfully.",
        student: {
          _id: updated._id.toString(),
          studentName: updated.name,
          email: updated.email,
          rollNumber: updated.rollNumber,
          phone: (updated as any).phone || "",
          batch: (updated as any).batch || "",
          totalFees: (updated as any).totalFees || 0,
          completedFees: (updated as any).completedFees || 0,
          pendingFees: (updated as any).pendingFees || 0,
          status: (updated as any).status || "active",
          isActive: (updated as any).isActive !== false,
          deactivationReason: (updated as any).deactivationReason || "",
          examPassword: (updated as any).examPassword || student.examPassword || "",
        },
      })
    }

    // Regular Edit
    const cleanName = name !== undefined ? String(name).trim() : student.name
    const cleanEmail = email !== undefined ? String(email).trim().toLowerCase() : student.email
    const cleanRollNumber = rollNumber !== undefined ? String(rollNumber).trim() : student.rollNumber
    const cleanPhone = phone !== undefined ? String(phone).trim() : ((student as any).phone || "")
    const cleanBatch = batch !== undefined ? String(batch).trim() : ((student as any).batch || "")

    if (!cleanName || !cleanEmail || !cleanRollNumber) {
      return NextResponse.json({ error: "Name, email, and roll number cannot be empty." }, { status: 400 })
    }

    // Check collision if email or roll number changed
    if (cleanEmail !== student.email || cleanRollNumber !== student.rollNumber) {
      const collisionQuery: any = {
        _id: { $ne: student._id },
        $or: [{ email: cleanEmail }],
      }
      if (session.instituteId) {
        collisionQuery.$or.push({ instituteId: session.instituteId, rollNumber: cleanRollNumber })
      } else {
        collisionQuery.$or.push({ rollNumber: cleanRollNumber })
      }

      const collision = await User.findOne(collisionQuery)
      if (collision) {
        if (collision.email === cleanEmail) {
          return NextResponse.json({ error: "Email is already used by another aspirant." }, { status: 409 })
        }
        return NextResponse.json({ error: "Roll number is already in use by another aspirant." }, { status: 409 })
      }
    }

    const parsedTotalFees =
      totalFees !== undefined ? Math.max(0, Number(totalFees) || 0) : ((student as any).totalFees || 0)
    const parsedCompletedFees =
      completedFees !== undefined
        ? Math.max(0, Number(completedFees) || 0)
        : ((student as any).completedFees || 0)
    const calculatedPendingFees = Math.max(0, parsedTotalFees - parsedCompletedFees)

    const updateSet: any = {
      name: cleanName,
      email: cleanEmail,
      rollNumber: cleanRollNumber,
      phone: cleanPhone,
      batch: cleanBatch,
      totalFees: parsedTotalFees,
      completedFees: parsedCompletedFees,
      pendingFees: calculatedPendingFees,
    }

    if (password && String(password).trim().length >= 6) {
      updateSet.password = await bcrypt.hash(String(password).trim(), 10)
      updateSet.examPassword = String(password).trim()
    }

    const updated = await User.findByIdAndUpdate(student._id, { $set: updateSet }, { new: true, lean: true })
    if (!updated) {
      return NextResponse.json({ error: "Failed to update aspirant." }, { status: 404 })
    }

    return NextResponse.json({
      ok: true,
      student: {
        _id: updated._id.toString(),
        studentName: updated.name,
        email: updated.email,
        rollNumber: updated.rollNumber,
        phone: (updated as any).phone || "",
        batch: (updated as any).batch || "",
        totalFees: (updated as any).totalFees || 0,
        completedFees: (updated as any).completedFees || 0,
        pendingFees: (updated as any).pendingFees || 0,
        status: (updated as any).status || "active",
        isActive: (updated as any).isActive !== false,
        deactivationReason: (updated as any).deactivationReason || "",
        examPassword: (updated as any).examPassword || student.examPassword || "",
      },
    })
  } catch (error) {
    console.error("Edit student error:", error)
    return NextResponse.json({ error: "Failed to update student." }, { status: 500 })
  }
}

// DELETE /api/admin/students - Delete student from institute
export async function DELETE(req: Request) {
  const session = await getSession(req)
  const canManage =
    session &&
    (["super_admin", "admin", "institute", "coaching_institute"].includes(session.role) ||
      Boolean(session.instituteId))
  if (!canManage) {
    return NextResponse.json({ error: "Only an institute admin can remove aspirants." }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")
    if (!id) {
      return NextResponse.json({ error: "Aspirant ID is required." }, { status: 400 })
    }

    await connectDB()
    const query: any = { _id: id, role: "student" }
    if (session.instituteId) {
      query.instituteId = session.instituteId
    }

    const deleted = await User.findOneAndDelete(query)
    if (!deleted) {
      return NextResponse.json({ error: "Aspirant not found or already removed." }, { status: 404 })
    }

    return NextResponse.json({ ok: true, message: "Aspirant removed successfully." })
  } catch (error) {
    console.error("Delete student error:", error)
    return NextResponse.json({ error: "Failed to remove aspirant." }, { status: 500 })
  }
}
