import { getSession } from "@/lib/auth"
import { redirect } from "next/navigation"
import AdminLoginClient from "./AdminLoginClient"

export default async function AdminLoginPage() {
  const session = await getSession()

  // If already logged in, redirect to dashboard
  if (session) {
    redirect("/admin")
  }

  return <AdminLoginClient />
}
