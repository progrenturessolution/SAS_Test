import { redirect } from "next/navigation"
import AdminLoginClient from "./AdminLoginClient"

/**
 * Platform Admin Login Page (/admin/login)
 * 
 * Note: When a user manually navigates to /admin/login via the URL bar,
 * they should always see the Platform Admin Login Form, even if an
 * existing organization/institute session is present in cookies.
 * Auto-redirecting to /admin or /institute/login when typing /admin/login
 * is avoided so platform admins can always access their portal login.
 */
export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ type?: string }>
}) {
  const sp = searchParams ? await searchParams : {}
  // Backward compatibility: redirect ?type=institute to /institute/login
  if (sp.type === "institute") {
    redirect("/institute/login")
  }

  // Always render the Platform Admin Login form when visiting /admin/login
  return <AdminLoginClient portalType="admin" />
}
