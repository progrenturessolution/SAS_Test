import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { COOKIE_NAME } from "@/lib/auth"

export async function POST() {
  try {
    const cookieStore = await cookies()
    cookieStore.delete(COOKIE_NAME)
  } catch {}
  const res = NextResponse.json({ ok: true })
  res.cookies.delete(COOKIE_NAME)
  return res
}
