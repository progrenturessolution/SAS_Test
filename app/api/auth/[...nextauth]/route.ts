import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// next-auth replaced with custom jose JWT auth.
// Stub that returns valid JSON for SessionProvider polling so the client stays silent.
export async function GET(req: NextRequest) {
  const p = req.nextUrl.pathname
  if (p.endsWith("/session"))   return NextResponse.json({})
  if (p.endsWith("/providers")) return NextResponse.json({})
  if (p.endsWith("/csrf"))      return NextResponse.json({ csrfToken: "" })
  return NextResponse.json({})
}

export async function POST() {
  return NextResponse.json({})
}
