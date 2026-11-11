"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Layers,
  Users,
  BarChart2,
  Home,
  ArrowRight,
  Loader2,
} from "lucide-react"

interface AdminLoginClientProps {
  portalType: "institute" | "admin"
}

export default function AdminLoginClient({ portalType }: AdminLoginClientProps) {
  const router = useRouter()
  const isInstitute = portalType === "institute"
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError("")
    setLoading(true)

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, portalType }),
      })
      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Invalid email or password")
        return
      }

      const targetUrl = data.role === "super_admin" ? "/admin/institutes" : "/admin"
      router.push(targetUrl)
      router.refresh()
    } catch {
      setError("Network connection error. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col justify-between overflow-hidden bg-[#fafbfc] text-[#0f172a] selection:bg-[#0f172a] selection:text-white">
      {/* Background Soft Wave (matches uploaded Figma design) */}
      <div className="pointer-events-none absolute bottom-0 left-0 h-[240px] w-full max-w-[680px] overflow-hidden opacity-40">
        <svg
          viewBox="0 0 500 150"
          preserveAspectRatio="none"
          className="h-full w-full"
        >
          <path
            d="M0.00,49.98 C149.99,150.00 349.81,-49.98 500.00,49.98 L500.00,150.00 L0.00,150.00 Z"
            fill="#e2e8f0"
            opacity="0.45"
          />
          <path
            d="M0.00,75.00 C170.00,165.00 330.00,15.00 500.00,75.00 L500.00,150.00 L0.00,150.00 Z"
            fill="#cbd5e1"
            opacity="0.35"
          />
        </svg>
      </div>

      {/* Main Content Showcase */}
      <main className="relative z-10 mx-auto flex w-full max-w-[1140px] flex-1 items-center justify-center px-6 py-12 sm:px-10 lg:py-16">
        <div className="grid w-full grid-cols-1 items-center gap-12 lg:grid-cols-[1.12fr_0.88fr] lg:gap-16">
          {/* Left Column: Brand & Platform Value Proposition */}
          <div>
            {/* Logo: Lab Flask + Testro Lab */}
            <Link href="/" className="inline-flex items-center gap-3 group">
              <svg
                className="h-8 w-8 text-[#0f172a] transition-transform group-hover:scale-105"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M10 2v7.31L4.75 18.1A2 2 0 0 0 6.46 21h11.08a2 2 0 0 0 1.71-2.9L14 9.31V2" />
                <line x1="8.5" y1="2" x2="15.5" y2="2" />
                <path d="M8.5 14h7" />
              </svg>
              <span className="text-[26px] font-bold tracking-tight text-[#0f172a]">
                Testro Lab
              </span>
            </Link>

            {/* Horizontal Dark Accent Line */}
            <div className="my-8 h-[3.5px] w-12 rounded-full bg-[#0f172a]" />

            {/* Platform Headline */}
            <h1 className="text-4xl font-extrabold tracking-[-0.035em] text-[#0f172a] sm:text-[44px] sm:leading-[1.12]">
              Testro Lab Platform
            </h1>

            {/* Sub-description */}
            <p className="mt-4 max-w-[460px] text-[15px] font-normal leading-relaxed text-[#64748b] sm:text-base">
              Create secure competitive and board mock exams, manage questions, and track student performance with a simple and reliable system.
            </p>

            {/* 3 Feature Pills */}
            <div className="mt-9 flex flex-wrap items-center gap-3.5 text-xs font-semibold text-[#1e293b] sm:text-[13px]">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-[#475569]" />
                <span>Create Exams</span>
              </div>
              <span className="text-gray-300">|</span>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-[#475569]" />
                <span>Manage Students</span>
              </div>
              <span className="text-gray-300">|</span>
              <div className="flex items-center gap-2">
                <BarChart2 className="h-4 w-4 text-[#475569]" />
                <span>Track Performance</span>
              </div>
            </div>
          </div>

          {/* Right Column: Clean White Login Card */}
          <div className="w-full max-w-[430px] rounded-2xl border border-gray-100 bg-white p-7 shadow-[0_15px_40px_-12px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.03)] sm:p-9">
            {/* Card Header */}
            <h2 className="text-[24px] font-bold tracking-tight text-[#0f172a]">
              {isInstitute ? "Organization Login" : "Platform Admin Login"}
            </h2>
            <p className="mt-1 text-sm text-[#64748b] mb-6">
              Sign in to continue to Testro Lab
            </p>

            {/* Error Message */}
            {error && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs font-semibold text-red-600">
                {error}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-3.5">
              {/* Email Input */}
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={isInstitute ? "Organization Email" : "Admin Email"}
                  required
                  className="h-11 w-full rounded-lg border border-gray-200 bg-white pl-10 pr-3 text-sm text-[#0f172a] placeholder:text-gray-400 outline-none transition focus:border-[#0f172a] focus:ring-1 focus:ring-[#0f172a]"
                />
              </div>

              {/* Password Input */}
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  required
                  className="h-11 w-full rounded-lg border border-gray-200 bg-white pl-10 pr-10 text-sm text-[#0f172a] placeholder:text-gray-400 outline-none transition focus:border-[#0f172a] focus:ring-1 focus:ring-[#0f172a]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {/* Keep Me Signed In Checkbox */}
              <div className="pt-0.5 pb-1">
                <label className="flex items-center gap-2 text-xs text-[#64748b] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-[#0f172a] focus:ring-[#0f172a] cursor-pointer"
                  />
                  <span>Keep me signed in</span>
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#111c2e] hover:bg-[#0b1320] text-sm font-semibold text-white shadow-xs transition-colors cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>

            {/* Bottom Register Contact Link */}
            <div className="mt-7 border-t border-gray-100 pt-4 text-center sm:text-left text-[11.5px] text-[#64748b]">
              <span>
                {isInstitute
                  ? "Want to register a new organization? "
                  : "Need help managing your organization access? "}
              </span>
              <button
                type="button"
                onClick={() =>
                  window.open(
                    "https://wa.me/919309470958?text=Hello%20Progrentures,%20we%20want%20to%20onboard%20our%20organization%20on%20Testro%20Lab.",
                    "_blank"
                  )
                }
                className="font-bold text-[#0f172a] hover:underline cursor-pointer inline-flex items-center gap-1"
              >
                <span>Contact Platform Admin</span>
                <ArrowRight className="h-3 w-3 inline" />
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Footer Bar */}
      <footer className="relative z-10 w-full border-t border-gray-100/90 bg-white/70 px-6 py-4.5 text-xs text-gray-500 backdrop-blur-xs sm:px-12">
        <div className="mx-auto flex max-w-[1140px] flex-col items-center justify-between gap-3 sm:flex-row">
          <div className="flex items-center gap-2 text-[#64748b]">
            <span>© 2026 Testro Lab</span>
            <span className="text-gray-300">|</span>
            <span>Exam &amp; Assessment Platform</span>
          </div>

          <Link
            href="/"
            className="flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-[#475569] shadow-2xs hover:bg-gray-50 hover:text-[#0f172a] transition-colors"
          >
            <Home className="h-3.5 w-3.5" />
            <span>Home</span>
          </Link>
        </div>
      </footer>
    </div>
  )
}
