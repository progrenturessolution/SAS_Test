import AdminLoginClient from "@/app/admin/login/AdminLoginClient"

/**
 * Organization/Institute Login Page (/institute/login)
 * 
 * Always renders the Organization Login form so organizations can sign in
 * without conflicting with platform admin credentials or redirects.
 */
export default async function InstituteLoginPage() {
  return <AdminLoginClient portalType="institute" />
}
