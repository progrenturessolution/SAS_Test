// Login and register pages don't need the admin sidebar layout
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
