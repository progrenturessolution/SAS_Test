import { getSession } from "@/lib/auth"
import { redirect } from "next/navigation"
import AdminDashboardClient from "./AdminDashboardClient"

export default async function AdminPage() {
  const session = await getSession()

  // If not logged in, redirect to admin login form
  if (!session) {
    redirect("/admin/login")
  }

  // If super admin, redirect to institutes management portal
  if (session.role === "super_admin" || (session.role === "admin" && !session.instituteId)) {
    redirect("/admin/institutes")
  }

  return <AdminDashboardClient />
}
