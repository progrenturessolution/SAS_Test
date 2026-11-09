"use client"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import {
  Building2,
  Shield,
  GraduationCap,
  CheckCircle2,
  BookOpen,
  Clock,
  BarChart2,
  Eye,
  FileText,
  ArrowRight,
  Menu,
  X,
  Phone,
  Lock,
  Layers,
  Sparkles,
  Laptop,
} from "lucide-react"

function ScrollReveal({
  children,
  direction = "left",
  delay = 0,
}: {
  children: React.ReactNode
  direction?: "left" | "right"
  delay?: number
}) {
  const elementRef = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const element = elementRef.current
    if (!element) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.05, rootMargin: "0px 0px 80px 0px" }
    )

    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={elementRef}
      style={{ transitionDelay: `${delay}ms` }}
      className={`scroll-reveal transform-gpu transition-[opacity,transform] duration-500 ease-out ${
        isVisible ? "translate-x-0 opacity-100" : direction === "left" ? "-translate-x-3 opacity-0" : "translate-x-3 opacity-0"
      }`}
    >
      {children}
    </div>
  )
}

export default function HomePage() {
  const [showLoginDropdown, setShowLoginDropdown] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [hoveredWordmarkLetter, setHoveredWordmarkLetter] = useState<number | null>(null)
  const [hoveredFeature, setHoveredFeature] = useState<number | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Handle outside click to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowLoginDropdown(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [])

  return (
    <div className="min-h-screen overflow-x-hidden bg-white font-sans text-gray-800 selection:bg-[#2D3A4A] selection:text-white">
      {/* ─── 1. Header / Navbar ─── */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-[90px] max-w-[1320px] items-center justify-between px-8 sm:px-12 lg:px-16">
          {/* Logo */}
          <Link href="/" className="group flex items-center">
            <span className="flex items-center gap-2.5 transition-transform group-hover:scale-[1.02]">
              <span className="flex h-[35px] w-[35px] items-center justify-center rounded-[4px] bg-[#304058] text-[20px] font-bold leading-none text-white">
                T
              </span>
              <span className="flex flex-col leading-none">
                <span className="text-[15px] font-bold tracking-[0.12em] text-[#304058]">
                  TESTRO
                </span>
                <span className="mt-1 text-[8px] font-semibold tracking-[0.24em] text-[#304058]">
                  LAB
                </span>
              </span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden items-center gap-7 text-[15px] font-medium text-[#27364a] lg:flex">
            <Link href="/" className="transition-colors hover:text-[#5a6c84]">
              Home
            </Link>
            <Link href="#features" className="transition-colors hover:text-[#5a6c84]">
              Features
            </Link>
            <Link href="#exams" className="transition-colors hover:text-[#5a6c84]">
              JEE / CET / NEET
            </Link>
            <Link href="#workflow" className="transition-colors hover:text-[#5a6c84]">
              Solutions
            </Link>
            <Link href="#pricing" className="transition-colors hover:text-[#5a6c84]">
              Pricing
            </Link>
            <Link href="#about" className="transition-colors hover:text-[#5a6c84]">
              About Us
            </Link>
            <Link
              href="https://progrentures.com/#contact"
              target="_blank"
              className="transition-colors hover:text-[#5a6c84]"
            >
              Contact
            </Link>
          </nav>

          {/* Desktop Actions */}
          <div className="hidden items-center gap-2 sm:flex">
            <button
              onClick={() => window.open("https://wa.me/919309470958", "_blank")}
              className="order-2 flex h-12 items-center gap-3 rounded-[10px] bg-[#304058] px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#243246] cursor-pointer"
            >
              Schedule Demo
              <ArrowRight className="h-4 w-4" />
            </button>

            {/* Single Login Button with Dropdown */}
            <div className="relative order-1" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setShowLoginDropdown((prev) => !prev)}
                className="flex h-12 items-center gap-3 rounded-[10px] border border-[#cbd3dd] bg-white px-5 text-sm font-medium text-[#27364a] transition-colors hover:bg-[#f5f7fa] cursor-pointer"
              >
                <span>Login</span>
                <ArrowRight className="h-4 w-4" />
              </button>

              {showLoginDropdown && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-200 p-2 z-50 animate-in fade-in slide-in-from-top-2">
                  <Link
                    href="/institute/login"
                    onClick={() => setShowLoginDropdown(false)}
                    className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-gray-50 transition-colors group cursor-pointer"
                  >
                    <div className="w-8 h-8 rounded-lg bg-gray-100 group-hover:bg-[#2D3A4A] group-hover:text-white text-[#2D3A4A] flex items-center justify-center shrink-0 transition-colors">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-gray-800 block group-hover:text-[#2D3A4A]">
                        Institute Login
                      </span>
                      <span className="text-[11px] text-gray-400 block leading-tight">
                        For coaching centers & teachers
                      </span>
                    </div>
                  </Link>

                  <div className="my-1 border-t border-gray-100" />

                  <Link
                    href="/admin/login"
                    onClick={() => setShowLoginDropdown(false)}
                    className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-gray-50 transition-colors group cursor-pointer"
                  >
                    <div className="w-8 h-8 rounded-lg bg-gray-100 group-hover:bg-[#2D3A4A] group-hover:text-white text-[#2D3A4A] flex items-center justify-center shrink-0 transition-colors">
                      <Shield className="w-4 h-4 text-amber-500" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-gray-800 block group-hover:text-[#2D3A4A]">
                        Admin Login
                      </span>
                      <span className="text-[11px] text-gray-400 block leading-tight">
                        Platform Super Admin
                      </span>
                    </div>
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Mobile Menu Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100 cursor-pointer"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Slide-down Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-100 bg-white px-4 py-5 space-y-4 animate-in slide-in-from-top-2">
            <nav className="flex flex-col space-y-3 text-sm font-medium text-gray-700">
              <Link
                href="#features"
                onClick={() => setMobileMenuOpen(false)}
                className="hover:text-[#2D3A4A]"
              >
                Platform Features
              </Link>
              <Link
                href="#workflow"
                onClick={() => setMobileMenuOpen(false)}
                className="hover:text-[#2D3A4A]"
              >
                How It Works
              </Link>
              <Link
                href="#institutes"
                onClick={() => setMobileMenuOpen(false)}
                className="hover:text-[#2D3A4A]"
              >
                For Coaching Institutes
              </Link>
            </nav>

            <div className="pt-4 border-t border-gray-100 space-y-2">
              <Link
                href="/institute/login"
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-gray-300 text-xs font-bold text-[#2D3A4A] bg-gray-50"
              >
                <Building2 className="w-4 h-4" />
                <span>Institute Login</span>
              </Link>
              <Link
                href="/admin/login"
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[#2D3A4A] text-xs font-bold text-white shadow-sm"
              >
                <Shield className="w-4 h-4 text-amber-400" />
                <span>Admin Login</span>
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* ─── 2. Hero Section ─── */}
      <section className="relative overflow-hidden bg-[#1f2e43] pb-16 pt-12 text-white sm:pb-20 sm:pt-16 lg:pb-24 lg:pt-20">
        <div className="pointer-events-none absolute inset-0 opacity-30" style={{ backgroundImage: "linear-gradient(rgba(165,188,212,.12) 1px, transparent 1px), linear-gradient(90deg, rgba(165,188,212,.12) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
        <div className="relative z-10 mx-auto max-w-[1440px] px-8 sm:px-12 lg:px-10">
          <div className="grid items-center gap-12 lg:grid-cols-[0.86fr_1.14fr] lg:gap-10">
            {/* Left Content */}
            <div className="space-y-7 text-center lg:text-left">
              <div className="flex items-center justify-center gap-2 text-[12px] font-semibold tracking-[0.12em] text-[#c2ccda] lg:justify-start">
                <span className="h-px w-7 bg-[#c2ccda]" />
                AI-POWERED EXAMINATION MANAGEMENT PLATFORM
              </div>

              <h1 className="hero-title max-w-[560px] text-4xl font-bold leading-[1.13] tracking-[-0.03em] text-white text-balance sm:text-5xl lg:text-[50px]">
                Smarter Exams.<br />
                Secure Assessments.<br />
                Instant Results.
              </h1>

              <p className="max-w-[540px] text-base leading-[1.55] text-[#c4cedb] sm:text-lg">
                Create AI-powered examinations, conduct secure online assessments, automate evaluations and monitor student performance — all through one integrated platform.
              </p>

              <div className="flex flex-col items-center gap-4 pt-1 sm:flex-row lg:justify-start">
                <button
                  type="button"
                  onClick={() => window.open("https://wa.me/919309470958", "_blank")}
                  className="flex h-[52px] w-full items-center justify-center gap-3 rounded-lg bg-[#263c5a] px-7 text-[15px] font-semibold text-white transition-colors hover:bg-[#304b6f] sm:w-auto"
                >
                  Talk to Our Team
                  <ArrowRight className="h-4 w-4" />
                </button>

                <Link
                  href="/institute/login"
                  className="flex h-[52px] w-full items-center justify-center gap-3 rounded-lg bg-white px-7 text-[15px] font-semibold text-[#304058] transition-colors hover:bg-[#edf2f7] sm:w-auto"
                >
                  <span className="text-[11px]">▶</span>
                  Watch Product Demo
                </Link>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 pt-2 text-[13px] font-medium text-[#d3dbe5] lg:justify-start">
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  AI-Powered
                </span>
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Secure Assessments
                </span>
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Automated Evaluation
                </span>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-[790px] lg:translate-y-1">
              <div className="absolute -right-1 -top-7 z-20 flex min-w-[195px] items-center gap-3 rounded-xl border border-[#d8e0e8] bg-white px-4 py-3 text-[#314158] shadow-[0_12px_30px_rgba(27,42,61,0.22)] sm:right-0">
                <span className="rounded-lg bg-[#eef2f6] p-2 text-xs">✦</span>
                <span className="text-[11px] font-semibold">AI Question Generated<br /><small className="font-normal text-gray-400">Ready to review</small></span>
                <span className="text-sm">✓</span>
              </div>
              <div className="pointer-events-none absolute left-[26px] top-[-26px] z-0 h-full w-full rounded-[22px] border border-[#7890a9]/50" />
              <div className="relative z-10 aspect-[1.5] overflow-hidden rounded-[16px] border border-[#93a6bc] bg-[#f7f9fb] shadow-[0_24px_50px_rgba(12,27,45,0.3)]">
                <div className="flex h-full">
                  <aside className="w-[20%] shrink-0 bg-[#304159] p-3 text-white sm:p-4">
                    <div className="mb-9 flex items-center gap-2 text-[10px] font-bold tracking-widest">
                      <span className="rounded bg-white px-2 py-1 text-[#304159]">T</span> TESTRO<br /><small>LAB</small>
                    </div>
                    <div className="space-y-4 text-[9px] text-[#d2dbe5] sm:space-y-5 sm:text-[10px]">
                      {["Overview", "Examinations", "Question Bank", "Students", "Results"].map((item, index) => (
                        <div key={item} className={`flex items-center gap-2 rounded-md px-2 py-2 ${index === 0 ? "bg-[#445872] text-white" : ""}`}>
                          <span className="h-2.5 w-2.5 rounded-sm border border-current" /> {item}
                        </div>
                      ))}
                    </div>
                  </aside>
                  <div className="min-w-0 flex-1 p-4 text-[#33445a] sm:p-5 lg:p-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-[9px] text-gray-400">Dashboard</p>
                        <h2 className="mb-5 text-base font-bold sm:text-lg">Good morning, Admin</h2>
                      </div>
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#e7ecf1] text-[8px] font-bold text-[#65758a]">AS</span>
                    </div>
                    <div className="mb-4 grid grid-cols-4 gap-2">
                      {["Total Exams|248", "Active Exams|12", "Total Questions|4,826", "Students|1,842"].map((stat) => {
                        const [label, value] = stat.split("|")
                        return <div key={label} className="rounded-lg border border-gray-200 bg-white p-2.5 shadow-sm"><p className="text-[7px] text-gray-400">{label}</p><p className="mt-1 text-sm font-bold sm:text-base">{value}</p></div>
                      })}
                    </div>
                    <div className="grid grid-cols-[1.4fr_0.9fr] gap-3">
                      <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                        <div className="mb-3 flex justify-between text-[10px] font-bold">Recent examinations <span className="text-[8px] font-normal text-gray-400">View all</span></div>
                        {["JEE Mock Test 08", "Biology: Human Physiology", "MHT-CET Practice Set"].map((exam, index) => <div key={exam} className="flex items-center justify-between border-t border-gray-100 py-2 text-[8px]"><span><b className="mr-2 rounded bg-gray-100 px-2 py-1">{index + 1}</b>{exam}</span><span className="rounded-full bg-[#e3f5ec] px-2 py-1 text-[7px] text-emerald-600">{index === 0 ? "Live" : index === 1 ? "Scheduled" : "Completed"}</span></div>)}
                      </div>
                      <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm"><div className="flex justify-between text-[10px] font-bold">Result overview <span className="text-[8px] font-normal text-gray-400">This month</span></div><div className="mx-auto my-6 flex h-20 w-20 items-center justify-center rounded-full border-[11px] border-[#344860] text-sm font-bold">84%</div><p className="text-center text-[8px] text-gray-400">Passed　 Needs review</p></div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="absolute -bottom-3 -left-2 z-20 rounded-xl border border-[#d8e0e8] bg-white px-4 py-3 text-[10px] font-semibold text-[#314158] shadow-[0_12px_30px_rgba(27,42,61,0.2)] sm:-left-3">⚙　Face Detection Active<br /><small className="pl-6 font-normal text-gray-400">Session monitored</small><span className="ml-5 text-emerald-500">●</span></div>
              <div className="absolute -bottom-3 -right-1 z-20 rounded-xl border border-[#d8e0e8] bg-white px-4 py-3 text-[10px] font-semibold text-[#314158] shadow-[0_12px_30px_rgba(27,42,61,0.2)]">▥　Exam Results Available<br /><small className="pl-6 font-normal text-gray-400">152 submissions</small></div>
            </div>
          </div>
        </div>
        <style jsx>{`
          @keyframes heroTextReveal {
            from {
              opacity: 0;
              transform: translateY(14px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          .hero-title,
          .hero-tagline {
            animation: heroTextReveal 700ms cubic-bezier(0.22, 1, 0.36, 1) both;
          }

          .hero-tagline {
            animation-delay: 140ms;
          }

          .feature-track {
            animation: featureTrackRun 28s ease-in-out infinite alternate;
            will-change: transform;
          }

          .feature-track:hover {
            animation-play-state: paused;
          }

          .feature-card:hover {
            position: relative;
            z-index: 1;
            transform: scale(1.04);
          }

          @keyframes featureTrackRun {
            from {
              transform: translateX(-38%);
            }
            to {
              transform: translateX(0);
            }
          }

          @media (prefers-reduced-motion: reduce) {
            .hero-title,
            .hero-tagline {
              animation: none;
            }

            .scroll-reveal {
              opacity: 1 !important;
              transform: none !important;
              transition: none !important;
            }

            .feature-track {
              animation: none;
            }
          }
        `}</style>
      </section>

      {/* ─── 3. Professional Features Grid ─── */}
      <section id="features" className="relative overflow-hidden bg-white py-16 sm:py-20 lg:py-24">
        <div className="pointer-events-none absolute inset-0 opacity-60" style={{ backgroundImage: "linear-gradient(#e9eef3 1px, transparent 1px), linear-gradient(90deg, #e9eef3 1px, transparent 1px)", backgroundSize: "64px 64px" }} />
        <div className="relative mx-auto max-w-[1115px] px-5 sm:px-8">
          <div className="mx-auto mb-10 max-w-3xl space-y-3 text-center sm:mb-11">
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#718096]">
              Platform Capabilities
            </span>
            <h2 className="text-4xl font-bold leading-tight tracking-[-0.035em] text-[#304058] sm:text-5xl">
              Everything Your Examination
              <br />
              <span className="font-semibold italic">Process Needs.</span>
            </h2>
            <p className="text-base text-[#718096]">
              One integrated platform to create, conduct, secure and evaluate examinations.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              [Sparkles, "AI Question Generation", "Create structured questions and answer sets from topics or learning material."],
              [Laptop, "Coding Assessments", "Evaluate programming knowledge with purpose-built technical question formats."],
              [Shield, "Advanced Exam Proctoring", "Configure controls that promote a focused and fair testing environment."],
              [Eye, "Face Detection Monitoring", "Monitor candidate presence throughout an online assessment session."],
              [FileText, "Automatic Result Generation", "Generate organized outcomes instantly for supported question types."],
              [BarChart2, "Performance Analytics", "Turn examination data into clear, actionable student performance insights."],
            ].map(([Icon, title, description], index) => {
              const FeatureIcon = Icon as typeof Sparkles
              return (
                <ScrollReveal key={title as string} direction={index % 2 === 0 ? "left" : "right"} delay={index * 50}>
                  <article className="group relative flex min-h-[224px] flex-col rounded-[15px] border border-[#dce3e9] bg-white p-6 shadow-[0_8px_24px_rgba(47,64,87,0.04)] transition-all duration-300 hover:-translate-y-1 hover:border-[#9eafc0] hover:shadow-[0_14px_30px_rgba(47,64,87,0.1)]">
                    <span className="absolute left-5 top-0 h-px w-3 bg-[#8da0b3]" />
                    <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-[#f0f3f6] text-[#304058]">
                      <FeatureIcon className="h-5 w-5" />
                    </div>
                    <h3 className="text-[18px] font-medium tracking-tight text-[#304058]">{title as string}</h3>
                    <p className="mt-2 max-w-[290px] text-[14px] leading-relaxed text-[#718096]">{description as string}</p>
                    <ArrowRight className="mt-auto ml-auto h-4 w-4 text-[#8fa0b0] transition-transform group-hover:translate-x-1" />
                  </article>
                </ScrollReveal>
              )
            })}
          </div>
        </div>
      </section>

      {/* ─── 4. How It Works (Workflow) ─── */}
      <section id="workflow" className="relative overflow-hidden border-y border-[#e7ebef] bg-[#f7f9fb] py-16 sm:py-20 lg:py-24">
        <div className="pointer-events-none absolute inset-0 opacity-60" style={{ backgroundImage: "linear-gradient(#e9eef3 1px, transparent 1px), linear-gradient(90deg, #e9eef3 1px, transparent 1px)", backgroundSize: "64px 64px" }} />
        <div className="relative mx-auto grid max-w-[1115px] items-center gap-12 px-5 sm:px-8 lg:grid-cols-[0.72fr_1.28fr] lg:gap-16">
          <div>
            <div className="mb-5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#718096]">
              <span className="h-7 w-7 rounded-full border border-[#aab8c6]" />
              Intelligent Question Creation
            </div>
            <h2 className="max-w-[360px] text-4xl font-bold leading-[1.05] tracking-[-0.035em] text-[#304058] sm:text-5xl">
              Let AI Do the
              <br />
              <span className="font-semibold italic">Question</span>
              <br />
              <span className="font-semibold italic">Preparation.</span>
            </h2>
            <p className="mt-5 max-w-[390px] text-[15px] leading-relaxed text-[#718096]">
              Simply enter a topic or provide learning material. Generate examination questions, answer options and correct answers with AI, reducing hours of manual preparation.
            </p>
            <div className="mt-5 grid max-w-[420px] grid-cols-2 gap-x-5 gap-y-3 text-[12px] font-medium text-[#526982]">
              {["Topic-based generation", "Multiple topics", "Automatic answer options", "Correct-answer identification", "Difficulty selection", "PDF question upload", "Multiple question formats"].map((item) => (
                <span key={item} className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 rounded-full bg-[#e6edf2] text-[#899aaa]" />
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-[#dce3e9] bg-white p-5 shadow-[0_16px_40px_rgba(47,64,87,0.1)] sm:p-6">
            <div className="flex items-start justify-between border-b border-[#edf0f3] pb-5">
              <div>
                <h3 className="text-[16px] font-bold text-[#304058]">AI Question Generator</h3>
                <p className="mt-1 text-[9px] text-[#9aa8b6]">Create from topic</p>
              </div>
              <span className="rounded-full border border-[#dce3e9] px-3 py-1 text-[9px] text-[#718096]">Draft</span>
            </div>
            <div className="grid gap-3 py-5 sm:grid-cols-[1.5fr_0.7fr_0.8fr]">
              {["Topic|Operating Systems", "Difficulty|Medium⌄", "Question type|MCQ⌄"].map((field) => {
                const [label, value] = field.split("|")
                return <div key={label}><p className="mb-1 text-[9px] text-[#899aaa]">{label}</p><div className="rounded-md border border-[#dce3e9] px-3 py-2 text-[10px] text-[#304058]">{value}</div></div>
              })}
            </div>
            <div className="mb-4 flex items-center justify-between text-[9px] font-semibold text-[#526982]">
              <span>✦　Generation complete</span><span>100%</span>
            </div>
            <div className="mb-4 h-[3px] rounded-full bg-[#304058]" />
            <div className="rounded-lg border border-[#dce3e9] p-4">
              <p className="mb-3 text-[9px] uppercase tracking-[0.14em] text-[#a2afbb]">Question 01</p>
              <p className="mb-3 text-[12px] font-medium text-[#304058]">Which scheduling algorithm may cause starvation in an operating system?</p>
              {["First-Come, First-Served", "Round Robin", "Priority Scheduling", "Shortest Remaining Time"].map((option, index) => (
                <div key={option} className={`mb-2 flex items-center gap-2 rounded-md border px-3 py-2 text-[9px] ${index === 2 ? "border-[#aab8c6] bg-[#f4f7f9] text-[#304058]" : "border-[#e8edf1] text-[#526982]"}`}>
                  <b className="rounded bg-[#f0f3f6] px-1.5 py-1">{String.fromCharCode(65 + index)}</b>{option}{index === 2 && <span className="ml-auto">✓</span>}
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between rounded-md bg-[#f0f3f6] px-3 py-2 text-[9px] text-[#526982]">
              <span>▣　Review before publishing<br /><small className="pl-5 text-[#9aa8b6]">Edit the question, options, or correct answer anytime.</small></span>
              <button type="button" className="rounded border border-[#cbd6df] bg-white px-2 py-1 text-[8px]">Edit question</button>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 5. Institutional CTA Section ─── */}
      <section id="institutes" className="bg-white py-14 sm:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <div className="space-y-5 rounded-3xl bg-[#2D3A4A] p-6 text-white shadow-xl sm:p-12">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              Institutional Partnership
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-tight">
              Ready to Upgrade Your Examination Infrastructure?
            </h2>
            <p className="text-xs sm:text-sm text-gray-300 max-w-xl mx-auto leading-relaxed">
              Connect with our team to onboard your coaching academy, configure custom student quotas, and experience the full assessment platform.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => window.open("https://wa.me/919309470958", "_blank")}
                className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-white text-[#2D3A4A] text-xs font-bold uppercase tracking-wider hover:bg-gray-100 transition-colors shadow-sm cursor-pointer"
              >
                Schedule Demonstration
              </button>
              <Link
                href="/institute/login"
                className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-white/10 hover:bg-white/15 text-white border border-white/20 text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
              >
                Institute Login
              </Link>
            </div>
          </div>
        </div>
      </section>

      <div className="relative overflow-hidden border-t border-gray-100 bg-[#f7f9fc] px-4 pb-16 pt-10 sm:pb-24 sm:pt-14">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-20 opacity-60"
          style={{
            background: "linear-gradient(to top, rgba(219,228,238,0.5), transparent)",
          }}
        />
        <p
          aria-label="Progrentures"
          onMouseLeave={() => setHoveredWordmarkLetter(null)}
          className="relative whitespace-nowrap text-center text-[10vw] font-extrabold leading-none tracking-[0.015em] text-[#cbd7e3] sm:text-[16vw] lg:text-[14vw]"
          style={{
            WebkitTextStroke: "0.5px rgba(93, 113, 134, 0.32)",
            textShadow: "0 1px 0 rgba(255,255,255,0.55)",
          }}
        >
          {"Progrentures".split("").map((letter, index) => {
            const distance = hoveredWordmarkLetter === null ? null : index - hoveredWordmarkLetter
            const letterColor =
              distance === 0
                ? "#1e2a38"
                : distance === 1
                  ? "#60758b"
                  : distance === 2
                    ? "#9aaaba"
                    : "#cbd7e3"

            return (
              <span
                key={`${letter}-${index}`}
                aria-hidden="true"
                onMouseEnter={() => setHoveredWordmarkLetter(index)}
                className="inline-block cursor-default transform-gpu transition-[color,transform] duration-650 ease-in-out"
                style={{
                  color: letterColor,
                  transform: distance === 0 ? "scale(1.04)" : "scale(1)",
                }}
              >
                {letter}
              </span>
            )
          })}
        </p>
      </div>

      {/* ─── 6. Clean Institutional Footer ─── */}
      <footer className="border-t border-gray-200 bg-gray-50 py-8 text-xs text-gray-500 sm:py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-8">
            <div>
              <Image
                src="/logo.png"
                alt="Progrentures Testro Lab"
                width={140}
                height={45}
                priority
                className="object-contain mb-1"
              />
              <p className="text-gray-400 text-xs">
                Where Skills Are Truly Measured.
              </p>
            </div>

            <div className="flex flex-col items-start gap-2.5 font-medium text-gray-600 sm:items-end">
              <Link href="/institute/login" className="hover:text-[#2D3A4A] transition-colors">
                Institute Login
              </Link>
              <Link href="/admin/login" className="hover:text-[#2D3A4A] transition-colors">
                Admin Login
              </Link>
              <Link
                href="https://progrentures.com/#contact"
                target="_blank"
                className="hover:text-[#2D3A4A] transition-colors"
              >
                Contact
              </Link>
              <button
                onClick={() => window.open("https://wa.me/919309470958", "_blank")}
                className="text-emerald-700 font-bold hover:underline cursor-pointer"
              >
                WhatsApp (+91 93094 70958)
              </button>
            </div>
          </div>

          <div className="flex flex-col items-center justify-between gap-2 border-t border-gray-200/80 pt-6 text-center text-[11px] text-gray-400 sm:flex-row sm:text-left">
            <p>© 2026 Progrentures Solution. All rights reserved.</p>
            <p>Institutional Online Assessment & Examination Platform.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
