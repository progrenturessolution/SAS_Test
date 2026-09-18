import { NextResponse } from "next/server"
import connectDB from "@/lib/mongodb"
import User from "@/models/User"
import { getSession } from "@/lib/auth"

export async function POST(req: Request) {
  try {
    const session = await getSession()
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { currentPassword, newPassword } = await req.json()
    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: "Current password and new password are required" },
        { status: 400 }
      )
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: "New password must be at least 6 characters long" },
        { status: 400 }
      )
    }

    await connectDB()
    const user = await User.findById(session.id)
    if (!user) {
      return NextResponse.json({ error: "Admin user not found" }, { status: 404 })
    }

    const isMatch = await user.comparePassword(currentPassword)
    if (!isMatch) {
      return NextResponse.json({ error: "Incorrect current password" }, { status: 400 })
    }

    user.password = newPassword
    // user.save() will trigger the pre-save middleware which hashes the password automatically
    await user.save()

    return NextResponse.json({ success: true, message: "Password updated successfully" })
  } catch (error: any) {
    console.error("Change password error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to change password" },
      { status: 500 }
    )
  }
}
