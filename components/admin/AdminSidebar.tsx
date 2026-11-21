"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import Image from "next/image"
import { useEffect, useState } from "react"
import {
  LayoutDashboard,
  FileText,
  Users,
  BarChart2,
  Settings,
  LogOut,
  GraduationCap,
  Building2,
  Shield,
  Menu,
  X,
  Lock,
  Layers,
  MessageSquare,
} from "lucide-react"
import { toast } from "sonner"
import { formatDateDDMMYYYY } from "@/lib/utils"
import AdminNotificationBell from "@/components/admin/AdminNotificationBell"

interface AdminSidebarProps {
  userName: string
  userEmail: string
  role?: string
  instituteName?: string
  instituteCode?: string
  initialThemeColor?: string
}

export default function AdminSidebar({
  userName,
  userEmail,
  role = "super_admin",
  instituteName,
  instituteCode,
  initialThemeColor,
}: AdminSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [hasCompetitiveAccess, setHasCompetitiveAccess] = useState(true)
  const [hasExamAccess, setHasExamAccess] = useState(true)
  const [hasOtherExamsAccess, setHasOtherExamsAccess] = useState(true)
  const [isExamQuotaReached, setIsExamQuotaReached] = useState(false)
  const [maxExams, setMaxExams] = useState(20)
  const [examCount, setExamCount] = useState(0)
  const [validUntil, setValidUntil] = useState<string | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [instituteLogo, setInstituteLogo] = useState<string | null>(null)
  const [themeColor, setThemeColor] = useState<string>(initialThemeColor || "#2D3A4A")

  const isSuperAdmin = role === "super_admin" || (role === "admin" && !instituteName)

  const superAdminNavItems = [
    { label: "Organizations", href: "/admin/institutes", icon: Building2 },
    { label: "Platform Overview", href: "/admin/overview", icon: LayoutDashboard },
    { label: "Support & Requests", href: "/admin/queries", icon: MessageSquare },
  ]

  const instituteNavItems = [
    { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
    { label: "Exams", href: "/admin/exams", icon: FileText },
    { label: "Entrance Exams", href: "/admin/ai-generator", icon: GraduationCap },
    { label: "Other Exams", href: "/admin/other-exams", icon: Layers },
    { label: "Students", href: "/admin/students", icon: Users },
    { label: "Results", href: "/admin/results", icon: BarChart2 },
    { label: "Support & Help", href: "/admin/queries", icon: MessageSquare },
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
    const loadAccess = () => {
      fetch("/api/admin/institute-access", { credentials: "include" })
        .then((response) => response.json())
        .then((data) => {
          setHasCompetitiveAccess(data.hasCompetitiveAccess !== false)
          setHasExamAccess(data.hasExamAccess !== false)
          setHasOtherExamsAccess(data.hasOtherExamsAccess !== false)
          setIsExamQuotaReached(Boolean(data.isExamQuotaReached))
          if (data.maxExams !== undefined) setMaxExams(Number(data.maxExams))
          if (data.examCount !== undefined) setExamCount(Number(data.examCount))
          if (data.validUntil) setValidUntil(data.validUntil)
          if (data.logo) setInstituteLogo(data.logo)
          if (data.themeColor) {
            setThemeColor(data.themeColor)
            document.documentElement.style.setProperty("--primary", data.themeColor)
          }
        })
        .catch(() => {
          setHasCompetitiveAccess(true)
          setHasExamAccess(true)
          setHasOtherExamsAccess(true)
          setIsExamQuotaReached(false)
        })
    }
    loadAccess()
    window.addEventListener("institute-settings-updated", loadAccess)
    return () => window.removeEventListener("institute-settings-updated", loadAccess)
  }, [isSuperAdmin])

  const navItems = isSuperAdmin ? superAdminNavItems : instituteNavItems

  const settingsItems = [
    { label: "Settings", href: "/admin/settings", icon: Settings },
  ]

  const isActive = (href: string) => {
    if (href === "/admin") return pathname === "/admin"
    return pathname.startsWith(href)
  }

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" })
    router.push(isSuperAdmin ? "/admin/login" : "/institute/login")
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
          {isSuperAdmin ? (
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
          ) : (
            <div className="flex items-center gap-2">
              {instituteLogo ? (
                <img
                  src={instituteLogo}
                  alt={instituteName || "Coaching Logo"}
                  className="h-8 max-w-[140px] w-auto object-contain"
                />
              ) : (
                <div className="flex items-center gap-1.5 font-bold text-sm text-gray-800">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0"
                    style={{ backgroundColor: themeColor }}
                  >
                    <Building2 size={15} />
                  </div>
                  <span className="truncate max-w-[140px] font-semibold text-gray-800">
                    {instituteName || "Coaching Portal"}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isSuperAdmin && <AdminNotificationBell isSuperAdmin={isSuperAdmin} />}
          {instituteCode && (
            <span className="hidden sm:inline-block text-[10px] font-mono px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 border border-gray-200">
              {instituteCode}
            </span>
          )}
          <div
            className="w-8 h-8 rounded-full text-white flex items-center justify-center text-xs font-medium shrink-0 shadow-2xs"
            style={{ backgroundColor: themeColor }}
          >
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
              {isSuperAdmin ? (
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
              ) : (
                <div className="flex items-center gap-2">
                  {instituteLogo ? (
                    <img
                      src={instituteLogo}
                      alt={instituteName || "Coaching Logo"}
                      className="h-9 max-w-[160px] w-auto object-contain"
                    />
                  ) : (
                    <div className="flex items-center gap-2 font-bold text-sm text-gray-800">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0 shadow-xs"
                        style={{ backgroundColor: themeColor }}
                      >
                        <Building2 size={16} />
                      </div>
                      <span className="truncate max-w-[150px] font-semibold text-gray-800">
                        {instituteName || "Coaching Portal"}
                      </span>
                    </div>
                  )}
                </div>
              )}
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
                    <Building2 className="w-3.5 h-3.5" style={{ color: themeColor }} />
                    <span className="text-xs font-semibold text-[#324158] truncate">
                      {instituteName || "Organization"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-gray-500 mt-1">
                    {instituteCode && <span className="font-mono">Code: {instituteCode}</span>}
                    {validUntil ? (
                      <span className="font-medium text-slate-600">Valid: {formatDateDDMMYYYY(validUntil)}</span>
                    ) : (
                      <span className="font-medium text-slate-500">Lifetime</span>
                    )}
                  </div>
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
                const isCompetitiveItem = item.href === "/admin/ai-generator"
                const isExamItem = item.href === "/admin/exams"
                const isOtherExamsItem = item.href === "/admin/other-exams"
                const isWip = Boolean((item as any).isWip)
                const isQuotaBlocked = (isExamQuotaReached || (maxExams > 0 && examCount >= maxExams)) && (isCompetitiveItem || isOtherExamsItem || isExamItem)
                const isRestricted = !isSuperAdmin && (
                  isQuotaBlocked ||
                  (isCompetitiveItem && !hasCompetitiveAccess) ||
                  (isExamItem && !hasExamAccess) ||
                  (isOtherExamsItem && !hasOtherExamsAccess)
                )
                const restrictedMessage = !isSuperAdmin && isQuotaBlocked
                  ? `Exam Limit Reached: Your organization has reached the limit of ${maxExams} exams (${examCount}/${maxExams} used). Contact administrator to increase your exam quota.`
                  : isCompetitiveItem
                  ? "Access Restricted: You do not have permission to create Entrance Exams. Contact administrator."
                  : isOtherExamsItem
                  ? "Access Restricted: You do not have permission to create Other Exams. Contact administrator."
                  : "Access Restricted: You do not have permission to create Exams. Contact administrator."

                return (
                  <div key={item.href} className="relative group">
                    <Link
                      href={item.href}
                      title={isRestricted ? restrictedMessage : undefined}
                      onClick={(e) => {
                        if (isRestricted) {
                          e.preventDefault()
                          toast.error(restrictedMessage)
                        } else if (isWip) {
                          toast.info("Other Exams: Work in progress soon! 🚀", {
                            description: "Other exam modules and additional board formats are currently under development.",
                          })
                          setMobileOpen(false)
                        } else {
                          setMobileOpen(false)
                        }
                      }}
                      style={{ backgroundColor: active ? themeColor : undefined }}
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-xs font-medium transition-colors ${
                        isRestricted
                          ? "opacity-60 cursor-not-allowed bg-gray-100/50 text-gray-500 hover:bg-gray-100/70"
                          : active
                            ? "text-white shadow-xs font-semibold"
                            : "text-gray-700 hover:bg-gray-100/70 hover:text-gray-900"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon size={17} />
                        <span>{item.label}</span>
                      </div>
                      {isRestricted ? (
                        <span className="flex items-center gap-1 text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200/80 px-1.5 py-0.5 rounded">
                          <Lock size={10} className="text-amber-600" />
                          <span>{isQuotaBlocked ? "Quota Full" : "Locked"}</span>
                        </span>
                      ) : isWip ? (
                        <span className="flex items-center gap-1 text-[9px] font-bold text-blue-700 bg-blue-50 border border-blue-200/80 px-1.5 py-0.5 rounded-full">
                          Soon
                        </span>
                      ) : null}
                    </Link>

                    {isRestricted && (
                      <div className="hidden group-hover:block mt-1 p-2 rounded-lg bg-[#1E293B] text-white text-[11px] leading-relaxed shadow-lg border border-slate-700 animate-in fade-in slide-in-from-top-1 duration-150">
                        <div className="flex items-start gap-1.5">
                          <Lock size={12} className="text-amber-400 mt-0.5 shrink-0" />
                          <p className="text-slate-200 font-normal">{restrictedMessage}</p>
                        </div>
                      </div>
                    )}
                  </div>
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
                      style={{ backgroundColor: active ? themeColor : undefined }}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-medium transition-colors ${
                        active
                          ? "text-white shadow-xs font-semibold"
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
                <div
                  className="w-8 h-8 rounded-full text-white flex items-center justify-center text-xs font-medium shrink-0"
                  style={{ backgroundColor: themeColor }}
                >
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
          {isSuperAdmin ? (
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
          ) : (
            <div className="flex items-center gap-2.5">
              {instituteLogo ? (
                <img
                  src={instituteLogo}
                  alt={instituteName || "Coaching Logo"}
                  className="max-h-12 max-w-[190px] w-auto object-contain"
                />
              ) : (
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs"
                    style={{ backgroundColor: themeColor }}
                  >
                    <Building2 size={22} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate leading-tight">
                      {instituteName || "Coaching Portal"}
                    </p>
                    <p className="text-[10px] text-gray-400 font-mono mt-0.5">
                      {instituteCode ? `Code: ${instituteCode}` : "Academic Center"}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Role / Tenant Badge */}
          <div className="mt-3">
            {isSuperAdmin ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#2D3A4A] text-white text-[11px] font-medium w-fit shadow-xs">
                  <Shield className="w-3 h-3 text-amber-400" />
                  <span>Super Admin Portal</span>
                </div>
                <AdminNotificationBell isSuperAdmin={isSuperAdmin} />
              </div>
            ) : (
              <div className="p-2 rounded-lg bg-gray-50 border border-gray-200">
                <div className="flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5" style={{ color: themeColor }} />
                  <span className="text-xs font-semibold text-[#324158] truncate">
                    {instituteName || "Organization"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-gray-500 mt-1">
                  {instituteCode && <span className="font-mono">Code: {instituteCode}</span>}
                  {validUntil ? (
                    <span className="font-medium text-slate-600">Valid: {formatDateDDMMYYYY(validUntil)}</span>
                  ) : (
                    <span className="font-medium text-slate-500">Lifetime</span>
                  )}
                </div>
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
            const isCompetitiveItem = item.href === "/admin/ai-generator"
            const isExamItem = item.href === "/admin/exams"
            const isOtherExamsItem = item.href === "/admin/other-exams"
            const isWip = Boolean((item as any).isWip)
            const isQuotaBlocked = (isExamQuotaReached || (maxExams > 0 && examCount >= maxExams)) && (isCompetitiveItem || isOtherExamsItem || isExamItem)
            const isRestricted = !isSuperAdmin && (
              isQuotaBlocked ||
              (isCompetitiveItem && !hasCompetitiveAccess) ||
              (isExamItem && !hasExamAccess) ||
              (isOtherExamsItem && !hasOtherExamsAccess)
            )
            const restrictedMessage = !isSuperAdmin && isQuotaBlocked
              ? `Exam Limit Reached: Your organization has reached the limit of ${maxExams} exams (${examCount}/${maxExams} used). Contact administrator to increase your exam quota.`
              : isCompetitiveItem
              ? "Access Restricted: You do not have permission to create Entrance Exams. Contact administrator."
              : isOtherExamsItem
              ? "Access Restricted: You do not have permission to create Other Exams. Contact administrator."
              : "Access Restricted: You do not have permission to create Exams. Contact administrator."

            return (
              <div key={item.href} className="relative group">
                <Link
                  href={item.href}
                  title={isRestricted ? restrictedMessage : undefined}
                  onClick={(e) => {
                    if (isRestricted) {
                      e.preventDefault()
                      toast.error(restrictedMessage)
                    } else if (isWip) {
                      toast.info("Other Exams: Work in progress soon! 🚀", {
                        description: "Other exam modules and additional board formats are currently under development.",
                      })
                    }
                  }}
                  style={{ backgroundColor: active ? themeColor : undefined }}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-xs font-medium transition-colors ${
                    isRestricted
                      ? "opacity-60 cursor-not-allowed bg-gray-100/50 text-gray-500 hover:bg-gray-100/70"
                      : active
                        ? "text-white font-medium shadow-xs"
                        : "text-gray-600 hover:bg-gray-100/70 hover:text-gray-900"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon size={16} />
                    <span>{item.label}</span>
                  </div>
                  {isRestricted ? (
                    <span className="flex items-center gap-1 text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200/80 px-1.5 py-0.5 rounded">
                      <Lock size={10} className="text-amber-600" />
                      <span>{isQuotaBlocked ? "Quota Full" : "Locked"}</span>
                    </span>
                  ) : isWip ? (
                    <span className="flex items-center gap-1 text-[9px] font-bold text-blue-700 bg-blue-50 border border-blue-200/80 px-1.5 py-0.5 rounded-full">
                      Soon
                    </span>
                  ) : null}
                </Link>

                {isRestricted && (
                  <div className="hidden group-hover:block mt-1 p-2 rounded-lg bg-[#1E293B] text-white text-[11px] leading-relaxed shadow-lg border border-slate-700 animate-in fade-in slide-in-from-top-1 duration-150">
                    <div className="flex items-start gap-1.5">
                      <Lock size={12} className="text-amber-400 mt-0.5 shrink-0" />
                      <p className="text-slate-200 font-normal">{restrictedMessage}</p>
                    </div>
                  </div>
                )}
              </div>
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
                style={{ backgroundColor: active ? themeColor : undefined }}
                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                  active
                    ? "text-white font-medium shadow-xs"
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
            <div
              className="w-8 h-8 rounded-full text-white flex items-center justify-center text-xs font-medium shrink-0"
              style={{ backgroundColor: themeColor }}
            >
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
