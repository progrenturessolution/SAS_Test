import { getSession } from "@/lib/auth"
import AdminSidebar from "@/components/admin/AdminSidebar"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()

  // No session = login/register page (middleware handles redirect for protected routes)
  if (!session) {
    return <div className="min-h-screen bg-gray-50">{children}</div>
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#F5F6FA]">
      <AdminSidebar userName={session.name} userEmail={session.email} />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  )
}
