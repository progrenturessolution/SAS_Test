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
  Layers,
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

  const isSuperAdmin = role === "super_admin" || (role === "admin" && !instituteName)

  const superAdminNavItems = [
    { label: "Organizations", href: "/admin/institutes", icon: Building2 },
    { label: "Platform Overview", href: "/admin/overview", icon: LayoutDashboard },
  ]

  const instituteNavItems = [
    { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
    { label: "Exams", href: "/admin/exams", icon: FileText },
    { label: "NEET / JEE / MHT-CET", href: "/admin/ai-generator", icon: GraduationCap },
    { label: "Question Bank", href: "/admin/questions", icon: BookOpen },
    { label: "Students", href: "/admin/students", icon: Users },
    { label: "Results", href: "/admin/results", icon: BarChart2 },
  ]

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
    <aside className="flex w-full shrink-0 flex-col border-b border-gray-200 bg-white lg:h-screen lg:w-[272px] lg:border-b-0 lg:border-r">
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
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#2D3A4A] text-white text-[11px] font-semibold w-fit shadow-xs">
              <Shield className="w-3 h-3 text-amber-400" />
              <span>Super Admin Portal</span>
            </div>
          ) : (
            <div className="p-2 rounded-lg bg-gray-50 border border-gray-200">
              <div className="flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-[#2D3A4A]" />
                <span className="text-xs font-bold text-[#45505F] truncate">
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
      <nav className="flex flex-1 gap-1 overflow-x-auto px-3 py-3 lg:block lg:space-y-1 lg:overflow-y-auto lg:overflow-x-hidden lg:py-4">
        <p className="hidden px-2 text-[10px] font-bold uppercase tracking-widest text-gray-400 lg:mb-2 lg:block">
          {isSuperAdmin ? "Management" : "Organization Navigation"}
        </p>

        {navItems.map((item) => {
          const Icon = item.icon
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-w-max items-center justify-between rounded-lg px-3 py-2.5 text-xs font-medium transition-colors lg:w-full ${
                active
                  ? "bg-[#2D3A4A] text-white font-semibold shadow-xs"
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

        <p className="hidden px-2 text-[10px] font-bold uppercase tracking-widest text-gray-400 lg:mb-2 lg:mt-6 lg:block">
          Configuration
        </p>
        {settingsItems.map((item) => {
          const Icon = item.icon
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-w-max items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors lg:w-full ${
                active
                  ? "bg-[#2D3A4A] text-white font-semibold shadow-xs"
                  : "text-gray-600 hover:bg-gray-100/70 hover:text-gray-900"
              }`}
            >
              <Icon size={16} />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* User & Logout Footer */}
      <div className="border-t border-gray-100 bg-gray-50/50 px-3 py-3">
        <div className="flex items-center gap-2.5 px-2 py-1.5">
          <div className="w-8 h-8 rounded-full bg-[#2D3A4A] text-white flex items-center justify-center text-xs font-bold shrink-0">
            {userName?.charAt(0).toUpperCase() || "A"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-gray-800 truncate">{userName}</p>
            <p className="text-[11px] text-gray-400 truncate">{userEmail}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 w-full px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg mt-1 transition-colors cursor-pointer"
        >
          <LogOut size={13} />
          Logout
        </button>
      </div>
    </aside>
  )
}
