"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import Image from "next/image"
import { useEffect, useState } from "react"
import {
  LayoutDashboard,
  FileText,
  BookOpen,
  Users,
  BarChart2,
  Settings,
  LogOut,
  GraduationCap,
  Building2,
  Shield,
  Menu,
  X,
} from "lucide-react"

interface AdminSidebarProps {
  userName: string
  userEmail: string
  role?: string
  instituteName?: string
  instituteCode?: string
}

export default function AdminSidebar({
  userName,
  userEmail,
  role = "super_admin",
  instituteName,
  instituteCode,
}: AdminSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [canUseQuestionStudio, setCanUseQuestionStudio] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)

  const isSuperAdmin = role === "super_admin" || (role === "admin" && !instituteName)

  const superAdminNavItems = [
    { label: "Organizations", href: "/admin/institutes", icon: Building2 },
    { label: "Platform Overview", href: "/admin/overview", icon: LayoutDashboard },
  ]

  const instituteNavItems = [
    { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
    { label: "Exams", href: "/admin/exams", icon: FileText },
    { label: "Competitive Test", href: "/admin/ai-generator", icon: GraduationCap },
    { label: "Question Bank", href: "/admin/questions", icon: BookOpen },
    { label: "Students", href: "/admin/students", icon: Users },
    { label: "Results", href: "/admin/results", icon: BarChart2 },
  ]

  // Close mobile drawer on route navigation
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  // Prevent background scroll when mobile drawer is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = "unset"
    }
    return () => {
      document.body.style.overflow = "unset"
    }
  }, [mobileOpen])

  useEffect(() => {
    if (isSuperAdmin) return
    fetch("/api/admin/institute-access", { credentials: "include" })
      .then(response => response.json())
      .then(data => setCanUseQuestionStudio(data.features?.neetJeeGenerator !== false))
      .catch(() => setCanUseQuestionStudio(false))
  }, [isSuperAdmin])

  const navItems = isSuperAdmin
    ? superAdminNavItems
    : instituteNavItems.filter(item => item.href !== "/admin/ai-generator" || canUseQuestionStudio)

  const settingsItems = [
    { label: "Settings", href: "/admin/settings", icon: Settings },
  ]

  const isActive = (href: string) => {
    if (href === "/admin") return pathname === "/admin"
    return pathname.startsWith(href)
  }

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" })
    router.push("/admin/login")
    router.refresh()
  }

  return (
    <>
      {/* ─── Mobile Sticky Top Bar with Hamburger Button ─── */}
      <div className="lg:hidden sticky top-0 z-40 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 shadow-2xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-xl text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors cursor-pointer -ml-1"
            aria-label="Open navigation menu"
          >
            <Menu size={22} />
          </button>
          <Link href="/" className="inline-flex items-center">
            <Image
              src="/logo.png"
              alt="Progrentures Testro Lab"
              width={130}
              height={40}
              priority
              className="object-contain"
            />
          </Link>
        </div>

        <div className="flex items-center gap-2">
          {instituteCode && (
            <span className="hidden sm:inline-block text-[10px] font-mono px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 border border-gray-200">
              {instituteCode}
            </span>
          )}
          <div className="w-8 h-8 rounded-full bg-[#2D3A4A] text-white flex items-center justify-center text-xs font-medium shrink-0 shadow-2xs">
            {userName?.charAt(0).toUpperCase() || "A"}
          </div>
        </div>
      </div>

      {/* ─── Mobile Slide-Over Drawer & Overlay Backdrop ─── */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          {/* Backdrop overlay */}
          <div
            onClick={() => setMobileOpen(false)}
            className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in"
          />

          {/* Drawer container */}
          <aside className="relative flex flex-col w-[280px] max-w-[85vw] h-full bg-white shadow-2xl z-50 animate-in slide-in-from-left duration-200">
            {/* Header inside drawer */}
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <Link href="/" onClick={() => setMobileOpen(false)} className="inline-flex items-center">
                <Image
                  src="/logo.png"
                  alt="Progrentures Testro Lab"
                  width={140}
                  height={44}
                  priority
                  className="object-contain"
                />
              </Link>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
                aria-label="Close navigation menu"
              >
                <X size={20} />
              </button>
            </div>

            {/* Role / Tenant Badge */}
            <div className="px-5 pt-3 pb-2">
              {isSuperAdmin ? (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#2D3A4A] text-white text-[11px] font-medium w-fit shadow-xs">
                  <Shield className="w-3 h-3 text-amber-400" />
                  <span>Super Admin Portal</span>
                </div>
              ) : (
                <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-200">
                  <div className="flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-[#2D3A4A]" />
                    <span className="text-xs font-semibold text-[#45505F] truncate">
                      {instituteName || "Organization"}
                    </span>
                  </div>
                  {instituteCode && (
                    <span className="text-[10px] font-mono text-gray-500 mt-0.5 block">
                      Code: {instituteCode}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Navigation items in drawer */}
            <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
              <p className="px-2 text-[10px] font-medium uppercase tracking-widest text-gray-400 mb-2">
                {isSuperAdmin ? "Management" : "Navigation"}
              </p>

              {navItems.map((item) => {
                const Icon = item.icon
                const active = isActive(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-medium transition-colors ${
                      active
                        ? "bg-[#2D3A4A] text-white shadow-xs"
                        : "text-gray-700 hover:bg-gray-100/70 hover:text-gray-900"
                    }`}
                  >
                    <Icon size={17} />
                    <span>{item.label}</span>
                  </Link>
                )
              })}

              <div className="pt-4">
                <p className="px-2 text-[10px] font-medium uppercase tracking-widest text-gray-400 mb-2">
                  Configuration
                </p>
                {settingsItems.map((item) => {
                  const Icon = item.icon
                  const active = isActive(item.href)
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-medium transition-colors ${
                        active
                          ? "bg-[#2D3A4A] text-white shadow-xs"
                          : "text-gray-700 hover:bg-gray-100/70 hover:text-gray-900"
                      }`}
                    >
                      <Icon size={17} />
                      <span>{item.label}</span>
                    </Link>
                  )
                })}
              </div>
            </nav>

            {/* Footer inside drawer */}
            <div className="border-t border-gray-100 bg-gray-50/70 p-3 mt-auto">
              <div className="flex items-center gap-2.5 px-2 py-1.5">
                <div className="w-8 h-8 rounded-full bg-[#2D3A4A] text-white flex items-center justify-center text-xs font-medium shrink-0">
                  {userName?.charAt(0).toUpperCase() || "A"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-800 truncate">{userName}</p>
                  <p className="text-[11px] text-gray-400 truncate">{userEmail}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center gap-2 w-full px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 rounded-xl mt-1 transition-colors cursor-pointer"
              >
                <LogOut size={14} />
                Logout
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* ─── Desktop Permanent Sidebar (lg: and above) ─── */}
      <aside className="hidden lg:flex w-[272px] h-screen shrink-0 flex-col border-r border-gray-200 bg-white">
        {/* Brand Header */}
        <div className="border-b border-gray-100 px-5 py-4">
          <Link href="/" className="group inline-flex items-center">
            <Image
              src="/logo.png"
              alt="Progrentures Testro Lab"
              width={160}
              height={50}
              priority
              className="object-contain group-hover:opacity-80 transition-opacity"
            />
          </Link>

          {/* Role / Tenant Badge */}
          <div className="mt-3">
            {isSuperAdmin ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#2D3A4A] text-white text-[11px] font-medium w-fit shadow-xs">
                <Shield className="w-3 h-3 text-amber-400" />
                <span>Super Admin Portal</span>
              </div>
            ) : (
              <div className="p-2 rounded-lg bg-gray-50 border border-gray-200">
                <div className="flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-[#2D3A4A]" />
                  <span className="text-xs font-semibold text-[#45505F] truncate">
                    {instituteName || "Organization"}
                  </span>
                </div>
                {instituteCode && (
                  <span className="text-[10px] font-mono text-gray-500 mt-0.5 block">
                    Code: {instituteCode}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Main Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto overflow-x-hidden px-3 py-4">
          <p className="px-2 text-[10px] font-medium uppercase tracking-widest text-gray-400 mb-2">
            {isSuperAdmin ? "Management" : "Organization Navigation"}
          </p>

          {navItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-xs font-medium transition-colors ${
                  active
                    ? "bg-[#2D3A4A] text-white font-medium shadow-xs"
                    : "text-gray-600 hover:bg-gray-100/70 hover:text-gray-900"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon size={16} />
                  <span>{item.label}</span>
                </div>
              </Link>
            )
          })}

          <p className="px-2 text-[10px] font-medium uppercase tracking-widest text-gray-400 mb-2 mt-6">
            Configuration
          </p>
          {settingsItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                  active
                    ? "bg-[#2D3A4A] text-white font-medium shadow-xs"
                    : "text-gray-600 hover:bg-gray-100/70 hover:text-gray-900"
                }`}
              >
                <Icon size={16} />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        {/* User & Logout Footer */}
        <div className="border-t border-gray-100 bg-gray-50/50 px-3 py-3 mt-auto">
          <div className="flex items-center gap-2.5 px-2 py-1.5">
            <div className="w-8 h-8 rounded-full bg-[#2D3A4A] text-white flex items-center justify-center text-xs font-medium shrink-0">
              {userName?.charAt(0).toUpperCase() || "A"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-800 truncate">{userName}</p>
              <p className="text-[11px] text-gray-400 truncate">{userEmail}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg mt-1 transition-colors cursor-pointer"
          >
            <LogOut size={13} />
            Logout
          </button>
        </div>
      </aside>
    </>
  )
}
