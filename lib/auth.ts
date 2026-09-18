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
  role: string
}

export async function createSession(payload: AdminSession): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(SECRET)
}

export async function getSession(): Promise<AdminSession | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value
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
