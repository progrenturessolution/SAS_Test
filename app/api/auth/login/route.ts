import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import connectDB from "@/lib/mongodb"
import User from "@/models/User"
import Institute from "@/models/Institute"
import { createSession, COOKIE_NAME, COOKIE_MAX_AGE } from "@/lib/auth"

export async function POST(req: Request) {
  try {
    const { email, password, portalType } = await req.json()
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 })
    }

    await connectDB()

    // Run user lookup — do NOT use .lean() here as we need comparePassword() method
    const user = await User.findOne({
      email: email.toLowerCase(),
      role: { $in: ["super_admin", "admin", "institute", "coaching_institute"] },
    })
    if (!user) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 })
    }

    const isValid = await user.comparePassword(password)
    if (!isValid) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 })
    }

    // Portal type separation checks
    const isInstituteAccount = Boolean(user.instituteId || user.role === "institute")
    if (portalType === "admin" && isInstituteAccount) {
      return NextResponse.json(
        { error: "This account belongs to an Organization. Please use the Organization Login portal." },
        { status: 403 }
      )
    }

    if (portalType === "institute" && !isInstituteAccount) {
      return NextResponse.json(
        { error: "This is a Super Admin account. Please use the Admin Login portal." },
        { status: 403 }
      )
    }

    let instituteData: any = null
    if (isInstituteAccount && !user.instituteId) {
      return NextResponse.json(
        { error: "This organization account is no longer available. Please contact platform support." },
        { status: 403 }
      )
    }
    if (user.instituteId) {
      instituteData = await Institute.findById(user.instituteId).lean()
      if (!instituteData) {
        return NextResponse.json(
          { error: "This organization account is no longer available. Please contact platform support." },
          { status: 403 }
        )
      }
      if (instituteData.status === "suspended" || instituteData.status === "expired") {
        return NextResponse.json(
          { error: `Your organization account is ${instituteData.status}. Please contact platform support.` },
          { status: 403 }
        )
      }
    }

    const effectiveRole = isInstituteAccount ? "institute" : "super_admin"

    const token = await createSession({
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: effectiveRole,
      instituteId: user.instituteId ? user.instituteId.toString() : undefined,
      instituteName: instituteData?.name,
      instituteCode: instituteData?.code,
    })

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      maxAge: COOKIE_MAX_AGE,
      path: "/",
    }

    try {
      const cookieStore = await cookies()
      cookieStore.set(COOKIE_NAME, token, cookieOptions)
    } catch {
      // fallback handled below
    }

    const response = NextResponse.json({
      ok: true,
      name: user.name,
      email: user.email,
      role: effectiveRole,
      instituteName: instituteData?.name,
      instituteCode: instituteData?.code,
    })

    response.cookies.set(COOKIE_NAME, token, cookieOptions)
    return response
  } catch (error) {
    console.error("[v0] Login error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
