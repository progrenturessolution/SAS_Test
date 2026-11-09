import { getSession } from "@/lib/auth"
import { redirect } from "next/navigation"

/**
 * Call this at the top of every protected admin Server Component.
 * Returns the session. Redirects to /admin/login if not authenticated.
 */
export async function requireAdmin() {
  const session = await getSession()
  if (!session || !["super_admin", "admin", "institute"].includes(session.role)) {
    redirect("/admin/login")
  }
  return session
}

export async function requireSuperAdmin() {
  const session = await getSession()
  if (!session || (!["super_admin", "admin"].includes(session.role) || Boolean(session.instituteId))) {
    redirect("/admin")
  }
  return session
}
