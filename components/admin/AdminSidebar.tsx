"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import Image from "next/image"
import {
  LayoutDashboard,
  FileText,
  BookOpen,
  Users,
  BarChart2,
  Settings,
  LogOut,
} from "lucide-react"

const navItems = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { label: "Exams", href: "/admin/exams", icon: FileText },
  { label: "Question Bank", href: "/admin/questions", icon: BookOpen },
  { label: "Students", href: "/admin/students", icon: Users },
  { label: "Results", href: "/admin/results", icon: BarChart2 },
]

const settingsItems = [
  { label: "Settings", href: "/admin/settings", icon: Settings },
]

export default function AdminSidebar({ userName, userEmail }: { userName: string; userEmail: string }) {
  const pathname = usePathname()
  const router = useRouter()

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
    <aside className="w-56 min-h-screen bg-white border-r border-gray-100 flex flex-col">
      {/* Logo */}
      <div className="px-5 py-4">
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
      </div>

      {/* Main Nav */}
      <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-2 mb-3">Main Menu</p>
        {navItems.map((item) => {
          const Icon = item.icon
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-gray-100 text-[#2D3A4A]"
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
              }`}
            >
              <Icon size={16} />
              {item.label}
            </Link>
          )
        })}

        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-2 mt-6 mb-3">Settings</p>
        {settingsItems.map((item) => {
          const Icon = item.icon
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-gray-100 text-[#2D3A4A]"
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
              }`}
            >
              <Icon size={16} />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* User Footer */}
      <div className="px-3 py-4 border-t border-gray-100">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-bold text-gray-600">
            {userName?.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800 truncate">{userName}</p>
            <p className="text-xs text-gray-400 truncate">{userEmail}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-500 hover:bg-red-50 rounded-lg mt-1 transition-colors"
        >
          <LogOut size={14} />
          Logout
        </button>
      </div>
    </aside>
  )
}
