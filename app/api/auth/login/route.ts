import { NextResponse } from "next/server"
import connectDB from "@/lib/mongodb"
import User from "@/models/User"
import Institute from "@/models/Institute"
import { createSession, COOKIE_NAME, COOKIE_MAX_AGE } from "@/lib/auth"
import { formatDateDDMMYYYY } from "@/lib/utils"

export async function POST(req: Request) {
  try {
    const { email, password, portalType } = await req.json()
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 })
    }

    await connectDB()

    // Run lightweight user lookup — select only auth fields needed while keeping comparePassword()
    const user = await User.findOne({
      email: email.toLowerCase(),
      role: { $in: ["super_admin", "admin", "institute", "coaching_institute"] },
    }).select("name email password role instituteId")
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
      instituteData = await Institute.findById(user.instituteId)
        .select("name code status validUntil")
        .lean()
      if (!instituteData) {
        return NextResponse.json(
          { error: "This organization account is no longer available. Please contact platform support." },
          { status: 403 }
        )
      }
      const isExpired = Boolean(
        instituteData.validUntil && new Date(instituteData.validUntil).getTime() < Date.now()
      )
      if (instituteData.status === "suspended" || instituteData.status === "expired" || isExpired) {
        let errorMsg = `Your organization account is ${instituteData.status === "suspended" ? "deactivated" : instituteData.status}. Please contact platform support.`
        if (isExpired) {
          const expDate = formatDateDDMMYYYY(instituteData.validUntil)
          errorMsg = `Your organization subscription expired on ${expDate}. Please contact administrator to renew your plan.`
        }
        return NextResponse.json(
          { error: errorMsg },
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
