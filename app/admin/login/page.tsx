import { getSession } from "@/lib/auth"
import { redirect } from "next/navigation"
import AdminLoginClient from "./AdminLoginClient"

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ type?: string }>
}) {
  const session = await getSession()

  // If already logged in, redirect to appropriate portal
  if (session) {
    if (session.role === "super_admin" || (session.role === "admin" && !session.instituteId)) {
      redirect("/admin/institutes")
    } else {
      redirect("/admin")
    }
  }

  const sp = searchParams ? await searchParams : {}
  if (sp.type === "institute") {
    redirect("/institute/login")
  }

  return <AdminLoginClient portalType="admin" />
}
