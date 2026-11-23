import { getSession } from "@/lib/auth"
import AdminSidebar from "@/components/admin/AdminSidebar"
import CoachingThemeWrapper from "@/components/admin/CoachingThemeWrapper"
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
  const session = await getSession()

  // No session = login/register page (middleware handles redirect for protected routes)
  if (!session) {
    return <>{children}</>
  }

  let themeColor = "#2D3A4A"
  const isInstitute = Boolean(
    session.instituteId ||
    session.role === "institute" ||
    session.role === "coaching_institute" ||
    session.instituteName
  )

  if (session.instituteId) {
    themeColor = await getInstituteTheme(session.instituteId)
  }

  return (
    <CoachingThemeWrapper isInstitute={isInstitute} initialThemeColor={themeColor}>
      <div className="flex min-h-screen w-full flex-col overflow-x-hidden bg-[#F5F6FA] lg:h-screen lg:flex-row lg:overflow-hidden print:h-auto print:overflow-visible print:bg-white print:block">
        <div className="no-print print:hidden">
          <AdminSidebar
            userName={session.name}
            userEmail={session.email}
            role={session.role}
            instituteId={session.instituteId}
            instituteName={session.instituteName}
            instituteCode={session.instituteCode}
            initialThemeColor={themeColor}
          />
        </div>
        <main className="min-w-0 flex-1 overflow-y-auto print:overflow-visible print:h-auto print:p-0 print:m-0">{children}</main>
      </div>
    </CoachingThemeWrapper>
  )
}
