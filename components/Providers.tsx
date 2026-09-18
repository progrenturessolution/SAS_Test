"use client"
// next-auth has been removed. This component is a no-op wrapper kept for
// compatibility in case it is still referenced anywhere in the codebase.
export default function Providers({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
