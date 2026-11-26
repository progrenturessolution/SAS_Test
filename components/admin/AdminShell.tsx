"use client"

import { usePathname } from "next/navigation"
import AdminSidebar from "@/components/admin/AdminSidebar"
import CoachingThemeWrapper from "@/components/admin/CoachingThemeWrapper"

interface AdminShellProps {
  children: React.ReactNode
  isInstitute: boolean
  themeColor: string
  userName: string
  userEmail: string
  role: string
  instituteId?: string
  instituteName?: string
  instituteCode?: string
}

const AUTH_FREE_PATHS = ["/admin/login", "/admin/register"]

export default function AdminShell({
  children,
  isInstitute,
  themeColor,
  userName,
  userEmail,
  role,
  instituteId,
  instituteName,
  instituteCode,
}: AdminShellProps) {
  const pathname = usePathname() || ""
  const isAuthPage = AUTH_FREE_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  )

  if (isAuthPage) {
    return <>{children}</>
  }

  return (
    <CoachingThemeWrapper isInstitute={isInstitute} initialThemeColor={themeColor}>
      <div className="flex min-h-screen w-full flex-col overflow-x-hidden bg-[#F5F6FA] lg:h-screen lg:flex-row lg:overflow-hidden print:h-auto print:overflow-visible print:bg-white print:block">
        <div className="no-print print:hidden">
          <AdminSidebar
            userName={userName}
            userEmail={userEmail}
            role={role}
            instituteId={instituteId}
            instituteName={instituteName}
            instituteCode={instituteCode}
            initialThemeColor={themeColor}
          />
        </div>
        <main className="min-w-0 flex-1 overflow-y-auto print:overflow-visible print:h-auto print:p-0 print:m-0">
          {children}
        </main>
      </div>
    </CoachingThemeWrapper>
  )
}

