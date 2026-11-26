import { headers } from "next/headers"
import { getSession } from "@/lib/auth"
import AdminShell from "@/components/admin/AdminShell"
import { connectDB } from "@/lib/db"
import Institute from "@/models/Institute"

// In-memory cache for institute theme colors to prevent slow DB lookups on every route transition
const themeCache = new Map<string, { color: string; timestamp: number }>()
const THEME_CACHE_TTL = 60000 // 1 minute

async function getInstituteTheme(instituteId: string): Promise<string> {
  const cached = themeCache.get(instituteId)
  if (cached && Date.now() - cached.timestamp < THEME_CACHE_TTL) {
    return cached.color
  }
  try {
    await connectDB()
    const inst = await Institute.findById(instituteId).select("themeColor").lean()
    const color = (inst as any)?.themeColor || "#2D3A4A"
    themeCache.set(instituteId, { color, timestamp: Date.now() })
    return color
  } catch {
    return "#2D3A4A"
  }
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers()
  const currentPath = headersList.get("x-pathname") || ""
  const isAuthPage =
    currentPath === "/admin/login" ||
    currentPath.startsWith("/admin/login/") ||
    currentPath === "/admin/register" ||
    currentPath.startsWith("/admin/register/")

  if (isAuthPage) {
    return <>{children}</>
  }

  const session = await getSession()

  // No session = login/register page (middleware handles redirect for protected routes)
  if (!session) {
    return <>{children}</>
  }

  const isSuperAdmin = !session.instituteId && ["super_admin", "admin"].includes(session.role)
  const isInstitute = Boolean(
    session.instituteId ||
    session.role === "institute" ||
    session.role === "coaching_institute" ||
    session.instituteName
  )

  if (!isSuperAdmin && !isInstitute) {
    return <>{children}</>
  }

  let themeColor = "#2D3A4A"
  if (session.instituteId) {
    themeColor = await getInstituteTheme(session.instituteId)
  }

  return (
    <AdminShell
      isInstitute={isInstitute}
      themeColor={themeColor}
      userName={session.name}
      userEmail={session.email}
      role={session.role}
      instituteId={session.instituteId}
      instituteName={session.instituteName}
      instituteCode={session.instituteCode}
    >
      {children}
    </AdminShell>
  )
}
