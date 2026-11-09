import { getSession } from "@/lib/auth"
import { redirect } from "next/navigation"
import AdminLoginClient from "@/app/admin/login/AdminLoginClient"

export default async function InstituteLoginPage() {
  const session = await getSession()

  if (session) {
    if (session.role === "super_admin" || (session.role === "admin" && !session.instituteId)) {
      redirect("/admin/institutes")
    } else {
      redirect("/admin")
    }
  }

  return <AdminLoginClient portalType="institute" />
}
