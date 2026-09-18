import { getSession } from "@/lib/auth"
import { redirect } from "next/navigation"

/**
 * Call this at the top of every protected admin Server Component.
 * Returns the session. Redirects to /admin/login if not authenticated.
 */
export async function requireAdmin() {
  const session = await getSession()
  if (!session || session.role !== "admin") {
    redirect("/admin/login")
  }
  return session
}
