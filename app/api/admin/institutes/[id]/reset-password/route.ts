import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import connectDB from "@/lib/mongodb"
import Institute from "@/models/Institute"
import User from "@/models/User"

// POST /api/admin/institutes/[id]/reset-password
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session || !["super_admin", "admin"].includes(session.role) || session.instituteId) {
      return NextResponse.json({ error: "Unauthorized. Super Admin only." }, { status: 403 })
    }

    const { id } = await params
    const { newPassword } = await req.json()

    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json(
        { error: "New password must be at least 6 characters long." },
        { status: 400 }
      )
    }

    await connectDB()

    const institute = await Institute.findById(id)
    if (!institute) {
      return NextResponse.json({ error: "Institute not found" }, { status: 404 })
    }

    const user = await User.findOne({
      $or: [{ _id: institute.adminUserId }, { email: institute.email }],
    })

    if (!user) {
      return NextResponse.json({ error: "Institute admin user account not found" }, { status: 404 })
    }

    user.password = newPassword
    await user.save()

    return NextResponse.json({ ok: true, message: `Password for ${institute.name} updated successfully!` })
  } catch (error: any) {
    console.error("Reset password error:", error)
    return NextResponse.json({ error: error.message || "Failed to reset password" }, { status: 500 })
  }
}
