import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { jwtVerify } from "jose"

const SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET ?? "progrentures-auth-secret-change-in-production"
)
const COOKIE_NAME = "admin_token"
const PUBLIC_ADMIN_PATHS = ["/admin/login", "/admin/register"]

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (!pathname.startsWith("/admin")) return NextResponse.next()
  if (PUBLIC_ADMIN_PATHS.some((p) => pathname.startsWith(p))) return NextResponse.next()

  // Differentiate super admin routes (/admin/institutes, /admin/overview)
  // from regular organization dashboard routes (/admin, /admin/exams, /admin/students, etc.)
  const isSuperAdminPath =
    pathname.startsWith("/admin/institutes") || pathname.startsWith("/admin/overview")
  const defaultLoginPath = isSuperAdminPath ? "/admin/login" : "/institute/login"

  const token = req.cookies.get(COOKIE_NAME)?.value
  if (!token) {
    const loginUrl = new URL(defaultLoginPath, req.nextUrl.origin)
    loginUrl.searchParams.set("callbackUrl", pathname)
    return NextResponse.redirect(loginUrl)
  }

  try {
    await jwtVerify(token, SECRET)
    return NextResponse.next()
  } catch {
    const loginUrl = new URL(defaultLoginPath, req.nextUrl.origin)
    const res = NextResponse.redirect(loginUrl)
    res.cookies.delete(COOKIE_NAME)
    return res
  }
}

export default proxy

export const config = {
  matcher: ["/admin/:path*"],
}
