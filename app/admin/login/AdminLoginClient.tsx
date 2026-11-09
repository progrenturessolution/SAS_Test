"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  Eye,
  EyeOff,
  Home,
  LockKeyhole,
  Mail,
  Shield,
  Loader2,
} from "lucide-react"

interface AdminLoginClientProps {
  portalType: "institute" | "admin"
}

export default function AdminLoginClient({ portalType }: AdminLoginClientProps) {
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

      window.location.href = data.role === "super_admin" ? "/admin/institutes" : "/admin"
    } catch {
      setError("Network connection error. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f7fafc] px-3 py-4 text-[#1e2d42] selection:bg-[#27394d] selection:text-white sm:px-6 lg:flex lg:items-center lg:justify-center lg:py-5">
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          backgroundImage: "radial-gradient(#cbd7e3 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />
      <div className="pointer-events-none absolute -left-32 top-20 h-80 w-80 rounded-full bg-white/80 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 bottom-0 h-96 w-96 rounded-full bg-[#e6edf5]/80 blur-3xl" />

      <section className="relative z-10 box-border flex w-full max-w-[1290px] flex-col overflow-hidden rounded-[22px] border border-[#cbd7e3] bg-white shadow-[0_24px_60px_-24px_rgba(30,52,75,0.42)] lg:h-[603px] lg:flex-row">
        <div className="relative box-border flex min-h-[430px] flex-1 flex-col overflow-hidden bg-[#fbfcfe] px-7 pb-0 pt-5 sm:px-10 sm:pt-6 lg:min-h-0 lg:w-[56%] lg:px-16 lg:pt-5">
          <div className="pointer-events-none absolute -left-24 -top-24 h-64 w-64 rounded-full bg-[#eaf2f8] opacity-80 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-28 -left-24 h-72 w-72 rounded-full bg-[#e5eef6] opacity-70 blur-2xl" />
          <div className="pointer-events-none absolute -right-10 -top-16 h-72 w-72 rotate-[22deg] bg-[#edf3f8]" style={{ clipPath: "polygon(38% 0, 100% 0, 100% 100%)" }} />
          <div className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 bg-[#e8f0f7]" style={{ clipPath: "polygon(0 42%, 100% 100%, 0 100%)" }} />
          <div className="pointer-events-none absolute bottom-[-5%] left-[30%] h-60 w-80 rotate-[20deg] bg-[#f0f4f8]" style={{ clipPath: "polygon(0 0, 100% 0, 72% 100%, 25% 100%)" }} />
          <div className="pointer-events-none absolute right-[8%] top-[8%] h-24 w-28 opacity-70" style={{ backgroundImage: "radial-gradient(#9fb3c7 1px, transparent 1px)", backgroundSize: "11px 11px" }} />
          <div className="relative z-10">
            <Link href="/" aria-label="Go to home" className="inline-flex">
              <Image src="/logo.png" alt="Progrentures Solution" width={180} height={94} priority className="h-auto w-[145px] object-contain sm:w-[170px]" />
            </Link>
            <div className="mt-4 max-w-[570px] sm:mt-7 lg:mt-2">
              <h1 className="max-w-[475px] text-[2.2rem] font-extrabold leading-[1.06] tracking-[-0.045em] text-[#12243a] sm:text-5xl lg:text-[2.7rem]">
                Conduct Secure
                <br />
                Competitive &amp; Board
                <br />
                <span className="text-[#273c54]">Mock Exams</span>
              </h1>
              <div className="mt-4 h-[3px] w-16 rounded-full bg-[#66788b]" />
              <p className="mt-3 max-w-[505px] text-xs font-medium leading-[1.55] text-[#52657b] sm:text-[13px]">
                Access question creation studios, live AI camera proctoring,
                <br className="hidden sm:block" /> automated percentile scorecards for NEET, JEE &amp; MHT-CET.
              </p>
            </div>
          </div>
          <div className="relative mt-auto min-h-[205px] sm:min-h-[225px] lg:min-h-[235px]">
            <Image src="/login-laptop-cropped.png" alt="Assessment analytics laptop" width={920} height={700} className="absolute bottom-5 -right-8 z-10 h-auto max-h-[245px] w-[min(60%,410px)] object-contain object-bottom mix-blend-multiply sm:bottom-6 lg:-right-10 lg:bottom-7 lg:w-[min(60%,420px)]" />
          </div>
          <div className="pointer-events-none absolute bottom-4 left-12 h-16 w-16 opacity-60" style={{ backgroundImage: "radial-gradient(#9fb3c7 1px, transparent 1px)", backgroundSize: "10px 10px" }} />
        </div>

        <div className="box-border flex w-full flex-col justify-between border-t border-[#d9e2eb] bg-white px-7 py-8 sm:px-10 lg:w-[44%] lg:border-l lg:border-t-0 lg:px-12 lg:py-10">
          <div>
            <div className="flex items-start justify-between gap-5">
              <div>
                <div className="inline-flex items-center gap-2 rounded-xl bg-[#eef2f6] px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-[#34475d]">
                  {isInstitute ? <Building2 className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
                  {isInstitute ? "Institute access" : "Admin access"}
                </div>
                <h2 className="mt-3 text-4xl font-extrabold tracking-[-0.04em] text-[#12243a]">Sign In</h2>
                <p className="mt-1 text-[15px] text-[#64758a]">
                  {isInstitute ? "Enter your coaching admin credentials" : "Enter your platform admin credentials"}
                </p>
              </div>
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#25374b] text-white shadow-sm">
                {isInstitute ? <Building2 className="h-7 w-7" /> : <Shield className="h-7 w-7 text-[#f4c66b]" />}
              </div>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              {error && <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-semibold text-red-600">{error}</div>}
              <div>
                <label htmlFor="login-email" className="mb-2 block text-sm font-bold text-[#27394d]">
                  {isInstitute ? "Institute Admin Email" : "Super Admin Email"}
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#71839a]" />
                  <input id="login-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder={isInstitute ? "admin@coachingacademy.com" : "admin@progrentures.com"} required className="h-[50px] w-full rounded-xl border border-[#d6e0e9] bg-[#f8fafc] pl-12 pr-4 text-sm font-medium text-[#1e2d42] outline-none transition focus:border-[#536a82] focus:bg-white focus:ring-4 focus:ring-[#dce6ef]" />
                </div>
              </div>
              <div>
                <div className="mb-2">
                  <label htmlFor="login-password" className="text-sm font-bold text-[#27394d]">Password</label>
                </div>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#71839a]" />
                  <input id="login-password" type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••••••" required className="h-[50px] w-full rounded-xl border border-[#d6e0e9] bg-[#f8fafc] pl-12 pr-12 text-sm font-medium text-[#1e2d42] outline-none transition focus:border-[#536a82] focus:bg-white focus:ring-4 focus:ring-[#dce6ef]" />
                  <button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((visible) => !visible)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#71839a] hover:text-[#25374b]">
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>
              <div className="flex items-center">
                <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-[#53657a]">
                  <input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} className="peer sr-only" />
                  <span className={`flex h-5 w-5 items-center justify-center rounded border transition ${rememberMe ? "border-[#26384c] bg-[#26384c] text-white" : "border-[#b8c5d2] bg-white"}`}><Check className="h-3.5 w-3.5" /></span>
                  Stay signed in
                </label>
              </div>
              <button type="submit" disabled={loading} className="flex h-[52px] w-full items-center justify-center gap-3 rounded-xl bg-[#25374b] text-sm font-extrabold uppercase tracking-wide text-white shadow-[0_8px_18px_rgba(37,55,75,0.2)] transition hover:bg-[#1d2c3d] disabled:cursor-not-allowed disabled:opacity-70">
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <>{isInstitute ? "Sign in to institute portal" : "Sign in as super admin"}<ArrowRight className="h-5 w-5" /></>}
              </button>
            </form>

          </div>
          <div className="mt-8 border-t border-[#e1e7ed] pt-5 text-center text-xs text-[#68798d]">
            {isInstitute ? "Want to register a new coaching institute?" : "Need help managing your institutes?"}{" "}
            <button type="button" onClick={() => window.open("https://wa.me/919309470958?text=Hello%20Progrentures,%20we%20want%20to%20onboard%20our%20coaching%20institute%20on%20Testro%20Lab.", "_blank")} className="font-bold text-[#25374b] hover:underline">Contact Platform Admin <ArrowRight className="ml-1 inline h-3.5 w-3.5" /></button>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-3">
            <Link href={isInstitute ? "/admin/login" : "/institute/login"} className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-[#68798d] hover:text-[#25374b]"><ArrowLeft className="h-3.5 w-3.5" /> Switch to {isInstitute ? "Admin" : "Institute"} login</Link>
            <Link href="/" className="inline-flex items-center justify-center gap-1.5 rounded-full border border-[#d6e0e9] px-3 py-1.5 text-xs font-bold text-[#40536a] transition hover:border-[#c2cfdb] hover:bg-[#eef2f6] hover:text-[#25374b]">
              <Home className="h-3.5 w-3.5" />
              Home
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
