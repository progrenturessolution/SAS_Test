import { SignJWT, jwtVerify } from "jose"
import { cookies } from "next/headers"

const SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET ?? "progrentures-auth-secret-change-in-production"
)
const COOKIE_NAME = "admin_token"
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7 // 7 days

export interface AdminSession {
  id: string
  name: string
  email: string
  role: "super_admin" | "admin" | "institute" | "student" | string
  instituteId?: string
  instituteName?: string
  instituteCode?: string
}

export async function createSession(payload: AdminSession): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(SECRET)
}

export async function getSession(req?: Request): Promise<AdminSession | null> {
  try {
    let token: string | undefined

    if (req) {
      // 1. Try Authorization header
      const authHeader = req.headers.get("authorization")
      if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.substring(7).trim()
      }
      // 2. Try raw Cookie header
      if (!token) {
        const cookieHeader = req.headers.get("cookie")
        if (cookieHeader) {
          const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]*)`))
          if (match) {
            token = decodeURIComponent(match[1])
          }
        }
      }
    }

    // 3. Fallback to Next.js cookies()
    if (!token) {
      try {
        const cookieStore = await cookies()
        token = cookieStore.get(COOKIE_NAME)?.value
      } catch {
        // cookies() may throw if called outside request context
      }
    }

    if (!token) return null
    const { payload } = await jwtVerify(token, SECRET)
    return payload as unknown as AdminSession
  } catch {
    return null
  }
}

export async function verifyToken(token: string): Promise<AdminSession | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET)
    return payload as unknown as AdminSession
  } catch {
    return null
  }
}

export { COOKIE_NAME, COOKIE_MAX_AGE }
