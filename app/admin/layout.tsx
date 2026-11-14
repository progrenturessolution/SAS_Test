import { getSession } from "@/lib/auth"
import AdminSidebar from "@/components/admin/AdminSidebar"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()

  // No session = login/register page (middleware handles redirect for protected routes)
  if (!session) {
    return <>{children}</>
  }

  return (
    <div className="flex min-h-screen w-full flex-col overflow-x-hidden bg-[#F5F6FA] lg:h-screen lg:flex-row lg:overflow-hidden print:h-auto print:overflow-visible print:bg-white print:block">
      <div className="no-print print:hidden">
        <AdminSidebar
          userName={session.name}
          userEmail={session.email}
          role={session.role}
          instituteName={session.instituteName}
          instituteCode={session.instituteCode}
        />
      </div>
      <main className="min-w-0 flex-1 overflow-y-auto print:overflow-visible print:h-auto print:p-0 print:m-0">{children}</main>
    </div>
  )
}
