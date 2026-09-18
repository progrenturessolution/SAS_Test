import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import connectDB from "@/lib/mongodb"
import User from "@/models/User"
import { createSession, COOKIE_NAME, COOKIE_MAX_AGE } from "@/lib/auth"

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json()
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 })
    }

    await connectDB()
    const user = await User.findOne({ email: email.toLowerCase(), role: "admin" })
    if (!user) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 })
    }

    const isValid = await user.comparePassword(password)
    if (!isValid) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 })
    }

    const token = await createSession({
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
    })

    const cookieStore = await cookies()
    cookieStore.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: COOKIE_MAX_AGE,
      path: "/",
    })

    return NextResponse.json({ ok: true, name: user.name, email: user.email })
  } catch (error) {
    console.error("[v0] Login error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
