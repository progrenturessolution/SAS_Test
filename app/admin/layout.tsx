import { getSession } from "@/lib/auth"
import AdminSidebar from "@/components/admin/AdminSidebar"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()

  // No session = login/register page (middleware handles redirect for protected routes)
  if (!session) {
    return <>{children}</>
  }

  return (
    <div className="flex min-h-screen w-full flex-col overflow-x-hidden bg-[#F5F6FA] lg:h-screen lg:flex-row lg:overflow-hidden">
      <AdminSidebar
        userName={session.name}
        userEmail={session.email}
        role={session.role}
        instituteName={session.instituteName}
        instituteCode={session.instituteCode}
      />
      <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
    </div>
  )
}
