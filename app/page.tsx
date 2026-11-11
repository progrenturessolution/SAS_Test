"use client"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faUser } from "@fortawesome/free-solid-svg-icons"
import {
  Building2,
  Shield,
  GraduationCap,
  CheckCircle2,
  BookOpen,
  Clock,
  BarChart2,
  ScanFace,
  FileText,
  ArrowRight,
  Menu,
  X,
  Phone,
  Mail,
  Globe,
  Lock,
  Layers,
  Sparkles,
  Laptop,
} from "lucide-react"

function ScrollReveal({
  children,
  direction = "up",
  delay = 0,
  className = "",
}: {
  children: React.ReactNode
  direction?: "up" | "down" | "left" | "right" | "fade"
  delay?: number
  className?: string
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
      { threshold: 0.08, rootMargin: "0px 0px -40px 0px" }
    )

    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const getTransform = () => {
    if (isVisible) return "translate-x-0 translate-y-0 opacity-100"
    switch (direction) {
      case "up":
        return "translate-y-8 opacity-0"
      case "down":
        return "-translate-y-8 opacity-0"
      case "left":
        return "-translate-x-8 opacity-0"
      case "right":
        return "translate-x-8 opacity-0"
      case "fade":
      default:
        return "opacity-0"
    }
  }

  return (
    <div
      ref={elementRef}
      style={{
        transitionDelay: `${delay}ms`,
        transitionDuration: "700ms",
      }}
      className={`transform-gpu transition-all ease-out ${getTransform()} ${className}`}
    >
      {children}
    </div>
  )
}

export default function HomePage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [hoveredFeature, setHoveredFeature] = useState<number | null>(null)
  const locomotiveScrollRef = useRef<any>(null)

  // Initialize Locomotive Scroll for smooth scrolling
  useEffect(() => {
    let scrollInstance: any = null

    const initLocomotive = async () => {
      try {
        const LocomotiveScroll = (await import("locomotive-scroll")).default
        scrollInstance = new LocomotiveScroll({
          lenisOptions: {
            lerp: 0.1,
            duration: 1.2,
            smoothWheel: true,
            wheelMultiplier: 1,
            touchMultiplier: 1.8,
          },
        })
        locomotiveScrollRef.current = scrollInstance
      } catch (err) {
        console.error("LocomotiveScroll initialization error:", err)
      }
    }

    initLocomotive()

    return () => {
      if (scrollInstance) {
        scrollInstance.destroy()
      }
      locomotiveScrollRef.current = null
    }
  }, [])

  // Smooth scroll handler for anchor links
  const handleAnchorClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (href.startsWith("#")) {
      e.preventDefault()
      const target = document.querySelector(href)
      if (target) {
        if (locomotiveScrollRef.current) {
          locomotiveScrollRef.current.scrollTo(target, { offset: -70, duration: 1.2 })
        } else {
          target.scrollIntoView({ behavior: "smooth" })
        }
      }
    }
  }

  return (
    <div className="min-h-screen overflow-x-clip bg-white font-sans text-gray-800 selection:bg-[#2D3A4A] selection:text-white">
      {/* ─── 1. Header / Navbar ─── */}
      <header className="sticky top-0 z-50 border-b border-[#e5eaf0]/80 bg-white/95 backdrop-blur-md shadow-[0_2px_15px_rgba(0,0,0,0.04)] transition-all">
        <div className="mx-auto flex h-[74px] sm:h-[84px] lg:h-[90px] max-w-[1320px] items-center justify-between px-4 sm:px-8 lg:px-16">
          {/* Logo */}
          <Link href="/" className="group flex items-center">
            <span className="flex items-center gap-2 sm:gap-2.5 transition-transform group-hover:scale-[1.02]">
              <svg
                className="h-8 w-8 sm:h-[35px] sm:w-[35px] shrink-0 drop-shadow-xs"
                viewBox="0 0 44 44"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M0 12C0 5.37258 5.37258 0 12 0H32C38.6274 0 44 5.37258 44 12V32C44 38.6274 38.6274 44 32 44H3C1.34315 44 0 42.6569 0 41V12Z"
                  fill="#324158"
                />
                <path
                  d="M15.5 13.5H28.5V17.5H24V28.5H20V17.5H15.5V13.5Z"
                  fill="white"
                />
              </svg>
              <span className="flex flex-col leading-none">
                <span className="text-[14px] sm:text-[15px] font-bold tracking-[0.12em] text-[#304058]">
                  TESTRO
                </span>
                <span className="mt-1 text-[7.5px] sm:text-[8px] font-semibold tracking-[0.24em] text-[#64748b]">
                  LAB
                </span>
              </span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden items-center gap-6 xl:gap-7 text-[14px] xl:text-[15px] font-medium text-[#27364a] lg:flex">
            {[
              { label: "Home", href: "/" },
              { label: "Features", href: "#features" },
              { label: "JEE / CET / NEET", href: "#exams" },
              { label: "Solutions", href: "#workflow" },
              { label: "Pricing", href: "#pricing" },
              { label: "About Us", href: "#about" },
              { label: "Contact", href: "https://progrentures.com/#contact", external: true },
            ].map((item) => (
              <Link
                key={item.label}
                href={item.href}
                target={item.external ? "_blank" : undefined}
                onClick={(e) => {
                  if (item.href.startsWith("#")) {
                    handleAnchorClick(e, item.href)
                  }
                }}
                className="group relative py-1.5 text-[#27364a] transition-colors hover:text-[#1e293b] cursor-pointer"
              >
                <span>{item.label}</span>
                {/* Smooth Animated Hover Underline */}
                <span className="absolute bottom-0 left-0 h-[2px] w-0 rounded-full bg-[#304058] transition-all duration-300 ease-out group-hover:w-full" />
              </Link>
            ))}
          </nav>

          {/* Desktop Actions */}
          <div className="hidden items-center gap-2.5 lg:flex">
            <button
              onClick={() => window.open("https://wa.me/919309470958", "_blank")}
              className="flex h-11 items-center gap-2 rounded-lg bg-[#304058] px-4.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-[#243246] cursor-pointer"
            >
              Schedule Demo
              <ArrowRight className="h-3.5 w-3.5" />
            </button>

            {/* Direct Login Button (Redirects to Institute Login) */}
            <Link
              href="/institute/login"
              className="flex h-11 items-center gap-2 rounded-lg border border-[#cbd3dd] bg-white px-4 text-xs font-semibold text-[#27364a] transition-colors hover:bg-[#f5f7fa]"
            >
              <span>Login</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {/* Mobile / Tablet Menu Button */}
          <div className="flex items-center gap-2 lg:hidden">
            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="flex items-center gap-1.5 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] px-3 py-2 text-xs font-bold text-[#1e293b] shadow-xs hover:bg-white hover:border-[#94a3b8] transition-all cursor-pointer"
              aria-label="Toggle navigation menu"
            >
              <span>{mobileMenuOpen ? "Close" : "Menu"}</span>
              {mobileMenuOpen ? <X className="h-4 w-4 text-[#1e293b]" /> : <Menu className="h-4 w-4 text-[#1e293b]" />}
            </button>
          </div>
        </div>

        {/* Mobile / Tablet Full Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="border-t border-[#e2e8f0] bg-white px-5 py-6 shadow-2xl lg:hidden animate-in slide-in-from-top-2 duration-200">
            <div className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wider text-[#94a3b8]">
              Menu Options
            </div>
            <nav className="flex flex-col space-y-1">
              {[
                { label: "Home", href: "/" },
                { label: "Features", href: "#features" },
                { label: "JEE / CET / NEET", href: "#exams" },
                { label: "Solutions", href: "#workflow" },
                { label: "Pricing", href: "#pricing" },
                { label: "About Us", href: "#about" },
                { label: "Contact", href: "https://progrentures.com/#contact", external: true },
              ].map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  target={item.external ? "_blank" : undefined}
                  onClick={(e) => {
                    setMobileMenuOpen(false)
                    if (item.href.startsWith("#")) {
                      handleAnchorClick(e, item.href)
                    }
                  }}
                  className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium text-[#27364a] hover:bg-[#f1f5f9] transition-colors"
                >
                  <span>{item.label}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-[#94a3b8]" />
                </Link>
              ))}
            </nav>

            <div className="my-4 border-t border-[#e2e8f0]" />

            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false)
                  window.open("https://wa.me/919309470958", "_blank")
                }}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#304058] py-3 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-[#243246] cursor-pointer"
              >
                Schedule Demo
                <ArrowRight className="h-3.5 w-3.5" />
              </button>

              <Link
                href="/institute/login"
                onClick={() => setMobileMenuOpen(false)}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] py-2.5 text-xs font-semibold text-[#1e293b] hover:bg-white transition-colors"
              >
                <Building2 className="h-3.5 w-3.5 text-[#304058]" />
                <span>Login</span>
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* ─── 2. Hero Section ─── */}
      <section className="relative overflow-hidden bg-[#1f2e43] pb-16 pt-12 text-white sm:pb-20 sm:pt-16 lg:pb-24 lg:pt-20">
        <div className="pointer-events-none absolute inset-0 opacity-30" style={{ backgroundImage: "linear-gradient(rgba(165,188,212,.12) 1px, transparent 1px), linear-gradient(90deg, rgba(165,188,212,.12) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
        <div className="relative z-10 mx-auto max-w-[1440px] px-4 sm:px-8 lg:px-10">
          <div className="grid items-center gap-10 sm:gap-12 lg:grid-cols-[0.86fr_1.14fr] lg:gap-10">
            {/* Left Content */}
            <ScrollReveal direction="up" className="space-y-5 sm:space-y-7 text-center lg:text-left">
              <div className="flex items-center justify-center gap-2 text-[10px] sm:text-[12px] font-semibold tracking-[0.1em] sm:tracking-[0.12em] text-[#c2ccda] lg:justify-start">
                <span className="h-px w-5 sm:w-7 bg-[#c2ccda]" />
                AI-POWERED EXAMINATION MANAGEMENT PLATFORM
              </div>

              <h1 className="hero-title mx-auto max-w-[560px] text-[30px] xs:text-[34px] sm:text-5xl lg:text-[50px] font-bold leading-[1.14] tracking-[-0.03em] text-white text-balance lg:mx-0">
                Smarter Exams.<br />
                Secure Assessments.<br />
                Instant Results.
              </h1>

              <p className="mx-auto max-w-[540px] text-[13.5px] sm:text-base lg:text-lg leading-[1.6] text-[#c4cedb] lg:mx-0">
                Create AI-powered examinations, conduct secure online assessments, automate evaluations and monitor student performance — all through one integrated platform.
              </p>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center lg:justify-start gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => window.open("https://wa.me/919309470958", "_blank")}
                  className="flex h-[48px] sm:h-[52px] w-full sm:w-auto items-center justify-center gap-3 rounded-lg bg-[#263c5a] px-6 sm:px-7 text-[14px] sm:text-[15px] font-semibold text-white shadow-xs transition-colors hover:bg-[#304b6f] cursor-pointer"
                >
                  Talk to Our Team
                  <ArrowRight className="h-4 w-4" />
                </button>

                <Link
                  href="/institute/login"
                  className="flex h-[48px] sm:h-[52px] w-full sm:w-auto items-center justify-center gap-3 rounded-lg bg-white px-6 sm:px-7 text-[14px] sm:text-[15px] font-semibold text-[#304058] shadow-xs transition-colors hover:bg-[#edf2f7]"
                >
                  <span className="text-[11px]">▶</span>
                  Watch Product Demo
                </Link>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-x-4 sm:gap-x-5 gap-y-2 pt-2 text-[11px] sm:text-[13px] font-medium text-[#d3dbe5] lg:justify-start">
                <span className="flex items-center gap-1.5 sm:gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  AI-Powered
                </span>
                <span className="flex items-center gap-1.5 sm:gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Secure Assessments
                </span>
                <span className="flex items-center gap-1.5 sm:gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Automated Evaluation
                </span>
              </div>
            </ScrollReveal>

            {/* Right Mockup Showcase */}
            <ScrollReveal direction="up" delay={150} className="relative mx-auto w-full max-w-[790px] pt-3 pb-4 sm:py-0 lg:translate-y-1">
              {/* Floating Badge 1 - Top Right */}
              <div className="absolute -top-1.5 right-1 sm:-top-7 sm:right-0 z-20 flex min-w-0 sm:min-w-[195px] items-center gap-2 sm:gap-3 rounded-xl border border-[#d8e0e8] bg-white px-2.5 py-1.5 sm:px-4 sm:py-3 text-[#314158] shadow-[0_12px_30px_rgba(27,42,61,0.22)] scale-[0.84] xs:scale-90 sm:scale-100 origin-top-right">
                <span className="flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-lg bg-[#eef2f6] text-xs">✦</span>
                <span className="text-[10px] sm:text-[11px] font-semibold leading-tight">AI Question Generated<br /><small className="font-normal text-gray-400 text-[8px] sm:text-[9px]">Ready to review</small></span>
                <span className="text-xs sm:text-sm font-bold text-emerald-600 ml-0.5">✓</span>
              </div>

              {/* Offset decorative border frame */}
              <div className="pointer-events-none absolute left-2 sm:left-[26px] top-[-6px] sm:top-[-26px] z-0 h-full w-[calc(100%-10px)] sm:w-full rounded-[18px] sm:rounded-[22px] border border-[#7890a9]/40" />

              {/* Mockup Card Main Window */}
              <div className="relative z-10 overflow-hidden rounded-[16px] border border-[#93a6bc] bg-[#f7f9fb] shadow-[0_24px_50px_rgba(12,27,45,0.3)]">
                <div className="flex">
                  {/* Sidebar */}
                  <aside className="w-[46px] xs:w-[54px] sm:w-[22%] lg:w-[20%] shrink-0 bg-[#304159] p-2 sm:p-4 text-white flex flex-col justify-between">
                    <div>
                      {/* Logo */}
                      <div className="mb-4 sm:mb-8 flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2">
                        <span className="flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded bg-white text-[9px] sm:text-[10px] font-bold text-[#304159]">T</span>
                        <div className="hidden sm:block text-[9px] sm:text-[10px] font-bold tracking-widest leading-none">
                          TESTRO<br /><small className="text-[6.5px] tracking-[0.2em] text-[#93a6bc]">LAB</small>
                        </div>
                      </div>

                      {/* Nav Items */}
                      <div className="space-y-1.5 sm:space-y-3.5 text-[9px] text-[#d2dbe5] sm:text-[10px]">
                        {[
                          { name: "Overview", icon: Layers },
                          { name: "Examinations", icon: FileText },
                          { name: "Question Bank", icon: BookOpen },
                          { name: "Students", icon: GraduationCap },
                          { name: "Results", icon: BarChart2 },
                        ].map((item, index) => {
                          const ItemIcon = item.icon
                          return (
                            <div
                              key={item.name}
                              className={`flex items-center justify-center sm:justify-start gap-2 rounded-md p-1.5 sm:px-2 sm:py-2 transition-colors ${
                                index === 0 ? "bg-[#445872] text-white font-semibold" : "hover:bg-[#3a4d67]"
                              }`}
                              title={item.name}
                            >
                              <ItemIcon className="h-3.5 w-3.5 shrink-0" />
                              <span className="hidden sm:inline-block truncate">{item.name}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </aside>

                  {/* Main Content Area */}
                  <div className="min-w-0 flex-1 p-3 sm:p-5 lg:p-6 text-[#33445a]">
                    {/* Header */}
                    <div className="flex items-start justify-between border-b border-gray-100 sm:border-0 pb-2 sm:pb-0">
                      <div>
                        <p className="text-[8px] sm:text-[9px] text-gray-400 font-medium">Dashboard</p>
                        <h2 className="mb-2 sm:mb-4 text-xs sm:text-base font-bold text-[#1f2e43]">Good morning, Admin</h2>
                      </div>
                      <span className="flex h-5 w-5 sm:h-7 sm:w-7 items-center justify-center rounded-full bg-[#e7ecf1] text-[7px] sm:text-[8px] font-bold text-[#65758a]">
                        AS
                      </span>
                    </div>

                    {/* Metric Cards - 2 cols on mobile, 4 on sm+ */}
                    <div className="mb-2.5 sm:mb-4 grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2">
                      {[
                        { label: "Total Exams", value: "248" },
                        { label: "Active Exams", value: "12" },
                        { label: "Total Questions", value: "4,826" },
                        { label: "Students", value: "1,842" },
                      ].map((stat) => (
                        <div key={stat.label} className="rounded-lg border border-gray-200/80 bg-white p-2 sm:p-2.5 shadow-2xs">
                          <p className="text-[7.5px] sm:text-[8px] text-gray-400 leading-tight truncate">{stat.label}</p>
                          <p className="mt-0.5 sm:mt-1 text-xs sm:text-base font-bold text-[#1f2e43]">{stat.value}</p>
                        </div>
                      ))}
                    </div>

                    {/* Widgets Grid - 1 col on mobile, 2 cols on sm+ */}
                    <div className="grid grid-cols-1 sm:grid-cols-[1.38fr_0.92fr] gap-2 sm:gap-3">
                      {/* Left: Recent Examinations */}
                      <div className="rounded-lg border border-gray-200/80 bg-white p-2 sm:p-3 shadow-2xs">
                        <div className="mb-2 sm:mb-3 flex items-center justify-between text-[8.5px] sm:text-[10px] font-bold text-[#1f2e43]">
                          <span>Recent examinations</span>
                          <span className="text-[7px] sm:text-[8px] font-normal text-gray-400">View all</span>
                        </div>
                        <div className="space-y-1 sm:space-y-1.5">
                          {[
                            { name: "JEE Mock Test 08", status: "Live", badgeBg: "bg-[#e3f5ec] text-emerald-600" },
                            { name: "Biology: Human Physiology", status: "Scheduled", badgeBg: "bg-[#eaf0f8] text-[#304058]" },
                            { name: "MHT-CET Practice Set", status: "Completed", badgeBg: "bg-gray-100 text-gray-600" },
                          ].map((exam, index) => (
                            <div key={exam.name} className="flex items-center justify-between border-t border-gray-100 pt-1.5 pb-0.5 text-[7.5px] sm:text-[8.5px]">
                              <span className="flex items-center gap-1.5 truncate">
                                <b className="flex h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0 items-center justify-center rounded bg-gray-100 text-[6.5px] sm:text-[7px] font-bold text-gray-600">
                                  {index + 1}
                                </b>
                                <span className="truncate max-w-[125px] xs:max-w-[170px] sm:max-w-none text-[#33445a]">
                                  {exam.name}
                                </span>
                              </span>
                              <span className={`shrink-0 rounded-full px-1.5 sm:px-2 py-0.5 text-[6.5px] sm:text-[7px] font-medium ${exam.badgeBg}`}>
                                {exam.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Right: Result Overview */}
                      <div className="rounded-lg border border-gray-200/80 bg-white p-2 sm:p-3 shadow-2xs flex flex-col justify-between">
                        <div className="flex items-center justify-between text-[8.5px] sm:text-[10px] font-bold text-[#1f2e43]">
                          <span>Result overview</span>
                          <span className="text-[7px] sm:text-[8px] font-normal text-gray-400">This month</span>
                        </div>
                        <div className="my-1.5 sm:my-4 flex items-center justify-center">
                          <div className="relative flex h-14 w-14 sm:h-20 sm:w-20 items-center justify-center rounded-full border-[6px] sm:border-[10px] border-[#344860] text-xs sm:text-sm font-bold text-[#1f2e43]">
                            84%
                          </div>
                        </div>
                        <p className="text-center text-[7px] sm:text-[8px] text-gray-400">
                          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 mr-1" />
                          Passed &nbsp;·&nbsp; Needs review
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating Badges Bottom */}
              <div className="absolute -bottom-1.5 left-1 sm:-bottom-3 sm:-left-3 z-20 flex items-center gap-1.5 sm:gap-2 rounded-xl border border-[#d8e0e8] bg-white px-2.5 py-1.5 sm:px-4 sm:py-3 text-[9px] sm:text-[10px] font-semibold text-[#314158] shadow-[0_12px_30px_rgba(27,42,61,0.2)] scale-[0.84] xs:scale-90 sm:scale-100 origin-bottom-left">
                <span className="text-xs">⚙</span>
                <div>
                  <span>Face Detection Active</span>
                  <small className="block font-normal text-gray-400 text-[7px] sm:text-[8px]">Session monitored <span className="text-emerald-500 font-bold">●</span></small>
                </div>
              </div>

              <div className="absolute -bottom-1.5 right-1 sm:-bottom-3 sm:-right-1 z-20 hidden xs:flex items-center gap-1.5 sm:gap-2 rounded-xl border border-[#d8e0e8] bg-white px-2.5 py-1.5 sm:px-4 sm:py-3 text-[9px] sm:text-[10px] font-semibold text-[#314158] shadow-[0_12px_30px_rgba(27,42,61,0.2)] scale-[0.84] xs:scale-90 sm:scale-100 origin-bottom-right">
                <span className="text-xs">▥</span>
                <div>
                  <span>Exam Results Available</span>
                  <small className="block font-normal text-gray-400 text-[7px] sm:text-[8px]">152 submissions</small>
                </div>
              </div>
            </ScrollReveal>
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
          <ScrollReveal direction="up" className="mx-auto mb-10 max-w-3xl space-y-3 text-center sm:mb-11">
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#718096]">
              Platform Capabilities
            </span>
            <h2 className="text-3xl font-bold leading-tight tracking-[-0.035em] text-[#304058] sm:text-5xl">
              Everything Your Examination
              <br />
              <span className="font-semibold italic">Process Needs.</span>
            </h2>
            <p className="text-sm sm:text-base text-[#718096]">
              One integrated platform to create, conduct, secure and evaluate examinations.
            </p>
          </ScrollReveal>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              [Sparkles, "AI Question Generation", "Create structured questions and answer sets from topics or learning material."],
              [Laptop, "Coding Assessments", "Evaluate programming knowledge with purpose-built technical question formats."],
              [Shield, "Advanced Exam Proctoring", "Configure controls that promote a focused and fair testing environment."],
              [ScanFace, "Face Detection Monitoring", "Monitor candidate presence throughout an online assessment session."],
              [FileText, "Automatic Result Generation", "Generate organized outcomes instantly for supported question types."],
              [BarChart2, "Performance Analytics", "Turn examination data into clear, actionable student performance insights."],
            ].map(([Icon, title, description], index) => {
              const FeatureIcon = Icon as typeof Sparkles
              return (
                <ScrollReveal key={title as string} direction="up" delay={index * 60}>
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

      {/* ─── 5. End-to-End Exam Management ─── */}
      <section id="workflow" className="relative overflow-hidden border-y border-[#e7ebef] bg-white py-16 sm:py-20 lg:py-24">
        <div className="pointer-events-none absolute inset-0 opacity-60" style={{ backgroundImage: "linear-gradient(#e9eef3 1px, transparent 1px), linear-gradient(90deg, #e9eef3 1px, transparent 1px)", backgroundSize: "64px 64px" }} />
        <div className="relative mx-auto max-w-[1115px] px-5 sm:px-8">
          <ScrollReveal direction="up" className="mx-auto max-w-3xl space-y-4 text-center">
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#718096]">
              End-to-End Exam Management
            </span>
            <h2 className="text-3xl font-bold leading-[1.08] tracking-[-0.035em] text-[#304058] sm:text-5xl">
              From Exam Creation to Results.
              <br />
              All in One Place.
            </h2>
            <p className="text-[14px] sm:text-[15px] text-[#718096]">
              Manage every stage of your examination process through a single centralized dashboard.
            </p>
          </ScrollReveal>

          <div className="relative mt-12 grid gap-8 md:grid-cols-4 md:gap-0">
            <div className="pointer-events-none absolute left-[12%] right-[12%] top-[42px] hidden border-t border-dashed border-[#d6dee6] md:block" />
            {[
              [FileText, "Create Exam", "Configure title, duration, marks and instructions."],
              [Sparkles, "Add Questions", "Generate with AI, upload PDFs or add manually."],
              [Clock, "Schedule & Share", "Set timing, security and share access links."],
              [BarChart2, "Evaluate & Analyze", "Evaluate supported answers and access results."],
            ].map(([Icon, title, description], index) => {
              const StepIcon = Icon as typeof FileText
              return (
                <ScrollReveal key={title as string} direction="up" delay={index * 80}>
                  <article className="relative z-10 flex flex-col items-center text-center">
                    <span className="mb-1 text-[10px] font-bold text-[#9aa8b6]">0{index + 1}</span>
                    <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[#dce3e9] bg-white text-[#526982] shadow-[0_5px_15px_rgba(47,64,87,0.06)]">
                      <StepIcon className="h-5 w-5" />
                    </div>
                    <h3 className="mt-5 text-[16px] font-medium text-[#304058]">{title as string}</h3>
                    <p className="mt-2 max-w-[185px] text-[13px] leading-relaxed text-[#8190a0]">{description as string}</p>
                  </article>
                </ScrollReveal>
              )
            })}
          </div>
        </div>
      </section>

      {/* ─── 6. Exam Security & Proctoring ─── */}
      <section id="security" className="relative overflow-hidden bg-[#1f2e43] py-16 text-white sm:py-20 lg:py-24">
        <div className="pointer-events-none absolute inset-0 opacity-20" style={{ backgroundImage: "linear-gradient(rgba(165,188,212,.14) 1px, transparent 1px), linear-gradient(90deg, rgba(165,188,212,.14) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
        <div className="relative mx-auto grid max-w-[1115px] items-center gap-10 px-5 sm:px-8 lg:grid-cols-[0.72fr_1.28fr] lg:gap-16">
          <ScrollReveal direction="up">
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#c2ccda]">
              Exam Security &amp; Proctoring
            </span>
            <h2 className="mt-5 max-w-[390px] text-3xl font-bold leading-[1.08] tracking-[-0.035em] sm:text-5xl">
              Examination Security,
              <br />
              <span className="font-semibold italic">Built Into Every</span>
              <br />
              <span className="font-semibold italic">Assessment.</span>
            </h2>
            <p className="mt-5 max-w-[390px] text-[14px] sm:text-[15px] leading-relaxed text-[#c4cedb]">
              Advanced monitoring tools help institutions conduct more controlled and reliable online examinations.
            </p>

            <div className="mt-6 max-w-[420px]">
              {[
                ["Face Detection Monitoring", "Monitor candidate presence and face positioning during examination sessions."],
                ["Tab-Switch Prevention", ""],
                ["Fullscreen Enforcement", ""],
                ["AI-Assisted Status Analysis", ""],
              ].map(([title, description], index) => (
                <div key={title} className={`flex items-center gap-4 border-t border-[#52657b]/50 py-4 ${index === 0 ? "border-l-2 border-l-white bg-[#2c3e55] pl-3" : "pl-3"}`}>
                  <span className="w-4 text-[9px] text-[#94a8bc]">0{index + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-semibold text-white">{title}</p>
                    {description && <p className="mt-1 text-[9px] text-[#aebdcb]">{description}</p>}
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-[#8fa4b8]" />
                </div>
              ))}
              <div className="flex items-center gap-2 border-t border-[#52657b]/50 pt-4 text-[10px] text-[#aebdcb]">
                <Shield className="h-3.5 w-3.5" />
                Configurable security controls. Greater examination integrity.
              </div>
            </div>
          </ScrollReveal>

          <ScrollReveal direction="up" delay={150} className="relative">
            {/* Scoped CSS for Face Scanner Animation */}
            <style dangerouslySetInnerHTML={{ __html: `
              @keyframes scanning {
                0% {
                  transform: translateY(8px);
                }
                50% {
                  transform: translateY(102px);
                }
                100% {
                  transform: translateY(8px);
                }
              }
              .scan-line-anim {
                position: absolute;
                left: 5px;
                right: 5px;
                height: 1px;
                top: 0px;
                background: #b6c4d1;
                box-shadow: 0 0 6px #dce8ff80;
                will-change: transform;
                animation: scanning 2.6s ease-in-out infinite !important;
              }
            `}} />

            {/* Outer card */}
            <div className="w-full rounded-xl border border-[#344151] bg-[#192331] p-[10px] shadow-[0_15px_40px_rgba(0,0,0,0.25)]">

              {/* Top header */}
              <div className="flex items-center justify-between px-[7px] pb-[16px] pt-[9px] text-[9px]">
                <div className="flex items-center gap-[7px]">
                  <span className="h-[6px] w-[6px] rounded-full bg-[#a6b7c8]" style={{ boxShadow: "0 0 8px #a6b7c8" }} />
                  <strong>Live examination monitoring</strong>
                </div>
                <div className="flex items-center gap-3 text-[#8c9bad]">
                  <span>JEE Mock Test 08</span>
                  <span className="rounded-full border border-[#344151] px-[9px] py-[5px]">Session protected</span>
                </div>
              </div>

              {/* Monitor panel */}
              <div className="relative overflow-hidden rounded-[9px] border border-[#344151]">

                {/* Monitor header */}
                <div className="flex h-[33px] items-center justify-between border-b border-[#344151] bg-[#17212e] px-3 text-[9px] font-bold">
                  <span>● &nbsp; LIVE EXAMINATION MONITORING</span>
                  <span className="font-normal text-[#8c9bad]">JEE Mock Test 08</span>
                </div>

                {/* Camera area */}
                <div
                  className="relative h-[265px] overflow-hidden bg-[#202c3b]"
                  style={{
                    backgroundImage: "linear-gradient(#ffffff08 1px, transparent 1px), linear-gradient(90deg, #ffffff08 1px, transparent 1px)",
                    backgroundSize: "25px 25px",
                  }}
                >
                  {/* Face detection frame — single box, all 4 corners + scan line */}
                  <div className="absolute left-1/2 top-[18px] h-[116px] w-[110px] -translate-x-1/2">
                    <span className="absolute left-0 top-0 h-[19px] w-[19px] border-l-2 border-t-2 border-[#f2f5fa]" />
                    <span className="absolute right-0 top-0 h-[19px] w-[19px] border-r-2 border-t-2 border-[#f2f5fa]" />
                    <span className="absolute bottom-0 left-0 h-[19px] w-[19px] border-b-2 border-l-2 border-[#f2f5fa]" />
                    <span className="absolute bottom-0 right-0 h-[19px] w-[19px] border-b-2 border-r-2 border-[#f2f5fa]" />
                    
                    {/* Animated Scanning Line */}
                    <div className="scan-line-anim" />
                  </div>

                  {/* Person silhouette — CSS head + shoulders (matches HTML reference) */}
                  <div className="absolute bottom-0 left-1/2 flex -translate-x-1/2 flex-col items-center">
                    <div
                      className="h-[60px] w-[50px] bg-[#596779]"
                      style={{ borderRadius: "45% 45% 48% 48%", boxShadow: "inset 0 0 15px #ffffff12" }}
                    />
                    <div className="mt-[5px] h-[45px] w-[112px] rounded-t-[65px] bg-[#465467]" />
                  </div>

                  {/* Face status — bottom left */}
                  <div
                    className="absolute bottom-3 left-3 flex items-center gap-[7px] rounded-[7px] border border-[#39485a] px-[10px] py-[7px] text-[9px]"
                    style={{ background: "rgba(23,33,46,0.92)" }}
                  >
                    <ScanFace className="h-3.5 w-3.5 text-[#8aaac8]" />
                    <span>Face positioned correctly</span>
                  </div>

                  {/* Camera status — inside camera area, positioned top right */}
                  <div
                    className="absolute right-[-1px] top-[30px] w-[92px] rounded-l-[9px] border border-[#3a4858] bg-[#192431] p-[10px] text-[8px]"
                    style={{ boxShadow: "0 5px 15px #0003" }}
                  >
                    <span>● &nbsp; Camera</span>
                    <strong className="mt-1 block font-bold text-white">Connected</strong>
                  </div>
                </div>

                {/* Status grid — 3 columns */}
                <div className="grid grid-cols-3 gap-[6px] bg-[#17212e] p-2">
                  {["Candidate|Present", "Session|Active", "Camera|Connected"].map((item) => {
                    const [label, value] = item.split("|")
                    return (
                      <div key={label} className="rounded-[7px] border border-[#3b495a] bg-[#202b3a] px-[7px] py-[9px]">
                        <p className="mb-[5px] text-[7px] text-[#a6b2c0]">{label}</p>
                        <p className="text-[9px] font-medium text-white">{value}</p>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center gap-[10px] pb-[7px] pt-[19px] px-1">
                <span className="flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-[8px] border border-[#435267] text-[#8aaac8]">
                  <ScanFace className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-[7px] text-[#8b9bae]">Active security control</p>
                  <h3 className="my-1 text-[14px] font-semibold text-white">Face Detection Monitoring</h3>
                  <p className="text-[9px] text-[#a3afbd]">Monitor candidate presence and face positioning during examination sessions.</p>
                </div>
              </div>

            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ─── 7. Competitive Exam Preparation ─── */}
      <section id="exams" className="relative overflow-hidden border-y border-[#e7ebef] bg-white py-16 sm:py-20 lg:py-24">
        <div className="pointer-events-none absolute inset-0 opacity-60" style={{ backgroundImage: "linear-gradient(#e9eef3 1px, transparent 1px), linear-gradient(90deg, #e9eef3 1px, transparent 1px)", backgroundSize: "64px 64px" }} />
        <div className="relative mx-auto grid max-w-[1115px] items-center gap-10 px-5 sm:px-8 lg:grid-cols-[0.72fr_1.28fr] lg:gap-16">
          <ScrollReveal direction="up">
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#718096]">
              Specialized Test Creation
            </span>
            <h2 className="mt-5 max-w-[390px] text-3xl font-bold leading-[1.05] tracking-[-0.035em] text-[#304058] sm:text-5xl">
              Built for
              <br />
              Competitive
              <br />
              Exam Preparation.
            </h2>
            <p className="mt-5 max-w-[390px] text-[14px] sm:text-[15px] leading-relaxed text-[#718096]">
              Give organizations a structured way to create practice tests and mock examinations for Class 11th and 12th students.
            </p>
            <div className="mt-6 flex max-w-[420px] flex-wrap gap-2 text-[11px] text-[#718096]">
              {["Chapter-wise tests", "Subject-wise assessments", "Revision tests", "Practice examinations", "Full-length mock tests"].map((item) => (
                <span key={item} className="flex items-center gap-2 rounded-md border border-[#dce3e9] bg-white px-3 py-2">
                  <CheckCircle2 className="h-3 w-3 text-[#718096]" />
                  {item}
                </span>
              ))}
            </div>
          </ScrollReveal>

          <ScrollReveal direction="up" delay={150} className="rounded-2xl border border-[#dce3e9] bg-white p-5 shadow-[0_16px_40px_rgba(47,64,87,0.1)] sm:p-6">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-[16px] font-bold text-[#304058]">Create competitive test</h3>
                <p className="mt-1 text-[9px] text-[#9aa8b6]">Configure examination</p>
              </div>
              <span className="rounded-full border border-[#dce3e9] px-3 py-1 text-[9px] text-[#718096]">Step 3 of 6</span>
            </div>
            <div className="mt-7 flex gap-1">
              {[1, 2, 3, 4, 5, 6].map((step) => <span key={step} className={`h-[3px] flex-1 rounded-full ${step <= 3 ? "bg-[#526982]" : "bg-[#e2e7ec]"}`} />)}
            </div>
            <div className="mt-5 space-y-4 text-[9px] text-[#899aaa]">
              <div>
                <p className="mb-1">Select class</p>
                <div className="grid grid-cols-2 gap-2">
                  {["Class 11", "Class 12"].map((item, index) => <div key={item} className={`rounded-md border px-3 py-3 text-center text-[10px] ${index === 1 ? "border-[#526982] bg-[#f3f5f7] font-medium text-[#304058]" : "border-[#dce3e9] text-[#526982]"}`}>{item}</div>)}
                </div>
              </div>
              <div>
                <p className="mb-1">Select course</p>
                <div className="grid grid-cols-3 gap-2">
                  {["JEE", "MHT-CET", "NEET"].map((item, index) => <div key={item} className={`rounded-md border px-3 py-3 text-center text-[10px] ${index === 0 ? "border-[#526982] bg-[#f3f5f7] font-medium text-[#304058]" : "border-[#dce3e9] text-[#526982]"}`}>{item}</div>)}
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div><p className="mb-1">Subject</p><div className="rounded-md border border-[#dce3e9] px-3 py-3 text-[10px] text-[#526982]">Physics⌄</div></div>
                <div><p className="mb-1">Chapters</p><div className="rounded-md border border-[#dce3e9] px-3 py-3 text-[10px] text-[#526982]">3 selected⌄</div></div>
              </div>
            </div>
            <div className="mt-5 flex items-center justify-between rounded-lg bg-[#f0f3f6] px-3 py-3">
              <div className="flex gap-7 text-[#304058]">
                <span><small className="block text-[8px] text-[#899aaa]">Questions</small><b className="text-[14px]">60</b></span>
                <span><small className="block text-[8px] text-[#899aaa]">Duration</small><b className="text-[14px]">180 min</b></span>
              </div>
              <button type="button" className="rounded-md bg-[#304058] px-4 py-2.5 text-[10px] font-semibold text-white">Continue　→</button>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ─── 8. Coding Assessments ─── */}
      <section id="coding" className="relative overflow-hidden bg-[#172335] py-12 text-white sm:py-14 lg:py-16">
        <div className="pointer-events-none absolute inset-0 opacity-20" style={{ backgroundImage: "linear-gradient(rgba(165,188,212,.12) 1px, transparent 1px), linear-gradient(90deg, rgba(165,188,212,.12) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
        <div className="relative mx-auto max-w-[1115px] px-5 sm:px-8">
          <ScrollReveal direction="up" className="max-w-[720px]">
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#c2ccda]">
              Coding Assessments
            </span>
            <h2 className="mt-5 text-3xl font-bold leading-[1.08] tracking-[-0.035em] sm:text-5xl">
              Go Beyond Traditional
              <br />
              Multiple-Choice Tests.
            </h2>
            <p className="mt-5 max-w-[650px] text-[14px] sm:text-[15px] leading-relaxed text-[#c4cedb]">
              Assess programming knowledge through dedicated coding question formats and technical assessments.
            </p>
          </ScrollReveal>

          <ScrollReveal direction="up" delay={150} className="mt-10 overflow-hidden rounded-xl border border-[#52657b] bg-[#1d2b3d] shadow-[0_20px_50px_rgba(7,15,27,0.35)]">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#52657b] bg-[#2b3d55] px-4 sm:px-5 py-3 sm:py-4 text-[10px]">
              <div className="flex items-center gap-3 font-semibold"><span className="rounded bg-[#3a4d66] px-2 py-1">T</span> Technical Assessment</div>
              <div className="flex items-center gap-3 sm:gap-5 text-[#b8c5d2]">Question 2 of 5 <span className="rounded bg-[#172335] px-3 py-1.5 font-semibold text-white">42:18 remaining</span></div>
            </div>
            <div className="grid lg:grid-cols-[0.68fr_1.32fr]">
              <div className="border-b border-[#52657b] p-5 sm:p-8 lg:border-b-0 lg:border-r">
                <p className="text-[9px] uppercase tracking-[0.14em] text-[#9fb1c3]">Problem 02 · 20 marks</p>
                <h3 className="mt-4 sm:mt-5 max-w-[310px] text-xl sm:text-2xl font-medium leading-tight">Find the first non-repeating character</h3>
                <p className="mt-4 sm:mt-5 text-[12px] leading-relaxed text-[#b9c6d3]">
                  Given a string of lowercase characters, return the first character that does not repeat. Return -1 if no such character exists.
                </p>
                <p className="mt-5 sm:mt-6 text-[9px] font-semibold text-white">Example input</p>
                <div className="mt-2 rounded bg-[#2b3d55] px-3 py-2.5 font-mono text-[10px] text-[#d0dbe5]">assessment</div>
                <p className="mt-4 sm:mt-5 text-[9px] font-semibold text-white">Expected output</p>
                <div className="mt-2 rounded bg-[#2b3d55] px-3 py-2.5 font-mono text-[10px] text-[#d0dbe5]">a</div>
                <p className="mt-4 sm:mt-5 text-[9px] font-semibold text-white">Constraints</p>
                <p className="mt-2 text-[10px] text-[#9fb1c3]">1 ≤ string length ≤ 10⁵</p>
              </div>
              <div className="flex flex-col bg-[#121d2c]">
                <div className="flex items-center justify-between border-b border-[#34465c] px-4 sm:px-5 py-3 text-[10px]">
                  <span className="font-semibold">Solution</span>
                  <span className="rounded bg-[#2b3d55] px-3 py-1.5 text-[8px]">JavaScript⌄</span>
                </div>
                <div className="flex-1 space-y-2 p-4 sm:p-5 font-mono text-[10px] leading-relaxed text-[#c6d4e2] overflow-x-auto">
                  <p><span className="mr-4 sm:mr-5 text-[#71869d]">1</span><span className="text-[#d78cff]">function</span> <span className="text-[#7dd3fc]">firstUniqueChar</span>(<span className="text-[#f6c177]">str</span>) &#123;</p>
                  <p><span className="mr-4 sm:mr-5 text-[#71869d]">2</span>  <span className="text-[#d78cff]">const</span> <span className="text-[#7dd3fc]">frequency</span> = &#123;&#125;;</p>
                  <p><span className="mr-4 sm:mr-5 text-[#71869d]">3</span>  <span className="text-[#d78cff]">for</span> (<span className="text-[#d78cff]">const</span> <span className="text-[#f6c177]">char</span> <span className="text-[#d78cff]">of</span> <span className="text-[#f6c177]">str</span>) &#123;</p>
                  <p><span className="mr-4 sm:mr-5 text-[#71869d]">4</span>    <span className="text-[#7dd3fc]">frequency</span>[<span className="text-[#f6c177]">char</span>] = (<span className="text-[#7dd3fc]">frequency</span>[<span className="text-[#f6c177]">char</span>] || <span className="text-[#f6c177]">0</span>) + <span className="text-[#f6c177]">1</span>;</p>
                  <p><span className="mr-4 sm:mr-5 text-[#71869d]">5</span>  &#125;</p>
                  <p><span className="mr-4 sm:mr-5 text-[#71869d]">6</span>  <span className="text-[#d78cff]">return</span> <span className="text-[#f6c177]">str</span>.<span className="text-[#7dd3fc]">split</span>(<span className="text-[#9ee493]">&quot;&quot;</span>).<span className="text-[#7dd3fc]">find</span>(<span className="text-[#f6c177]">char</span> =&gt;</p>
                  <p><span className="mr-4 sm:mr-5 text-[#71869d]">7</span>    <span className="text-[#7dd3fc]">frequency</span>[<span className="text-[#f6c177]">char</span>] === <span className="text-[#f6c177]">1</span>) || <span className="text-[#f6c177]">-1</span>;</p>
                  <p><span className="mr-4 sm:mr-5 text-[#71869d]">8</span>&#125;</p>
                  <p><span className="mr-4 sm:mr-5 text-[#71869d]">9</span></p>
                  <p><span className="mr-4 sm:mr-5 text-[#71869d]">10</span><span className="text-[#8ea2b6]">// Find the first unique character</span></p>
                  <p><span className="mr-4 sm:mr-5 text-[#71869d]">11</span><span className="text-[#d78cff]">const</span> result = <span className="text-[#7dd3fc]">firstUniqueChar</span>(<span className="text-[#9ee493]">&quot;assessment&quot;</span>);</p>
                  <p><span className="mr-4 sm:mr-5 text-[#71869d]">12</span><span className="text-[#7dd3fc]">console</span>.<span className="text-[#7dd3fc]">log</span>(result);</p>
                  <p><span className="mr-4 sm:mr-5 text-[#71869d]">13</span><span className="text-[#8ea2b6]">// Output: a</span></p>
                </div>
                <div className="flex items-center justify-between border-t border-[#34465c] px-4 sm:px-5 py-2.5 text-[9px]">
                  <span className="text-[#8ea2b6]">Saved just now</span>
                  <button type="button" className="rounded bg-white px-3 sm:px-4 py-1.5 sm:py-2 font-semibold text-[#304058]">Submit code　→</button>
                </div>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ─── 9. Automated Results & Analytics ─── */}
      <section id="analytics" className="relative overflow-hidden border-y border-[#e7ebef] bg-[#f7f9fb] py-16 sm:py-20 lg:py-24">
        <div className="pointer-events-none absolute inset-0 opacity-60" style={{ backgroundImage: "linear-gradient(#e9eef3 1px, transparent 1px), linear-gradient(90deg, #e9eef3 1px, transparent 1px)", backgroundSize: "64px 64px" }} />
        <div className="relative mx-auto max-w-[1115px] px-5 sm:px-8">
          <ScrollReveal direction="up" className="mx-auto max-w-3xl space-y-4 text-center">
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#718096]">Automated Results &amp; Analytics</span>
            <h2 className="text-3xl font-bold leading-[1.08] tracking-[-0.035em] text-[#304058] sm:text-5xl">
              Every Result. Every Student.
              <br />
              <span className="font-semibold italic">Every Insight.</span>
            </h2>
            <p className="text-[14px] sm:text-[15px] leading-relaxed text-[#718096]">
              Reduce manual evaluation and understand student performance through organized examination
              <br className="hidden sm:block" /> results and analytics.
            </p>
          </ScrollReveal>

          <ScrollReveal direction="up" delay={150} className="mt-10 overflow-hidden rounded-2xl border border-[#dce3e9] bg-white shadow-[0_16px_40px_rgba(47,64,87,0.1)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e5eaee] px-5 sm:px-6 py-4 sm:py-5">
              <div>
                <h3 className="text-[14px] sm:text-[15px] font-bold text-[#304058]">JEE Mock Test — Results</h3>
                <p className="mt-0.5 sm:mt-1 text-[9px] text-[#9aa8b6]">Published on 24 May 2025</p>
              </div>
              <button type="button" className="rounded border border-[#dce3e9] bg-white px-3 py-2 text-[9px] font-medium text-[#526982]">Export report</button>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:gap-5 border-b border-[#e5eaee] px-5 sm:px-6 py-4 sm:py-5 sm:grid-cols-4">
              {[
                ["Class average", "76.4%", "82%"],
                ["Highest score", "94%", "94%"],
                ["Pass rate", "88.2%", "88%"],
                ["Students", "152", "65%"],
              ].map(([label, value, width]) => (
                <div key={label}>
                  <div className="flex items-end justify-between gap-2"><p className="text-[9px] text-[#899aaa]">{label}</p><b className="text-xl sm:text-2xl text-[#304058]">{value}</b></div>
                  <div className="mt-2 h-[3px] rounded-full bg-[#e6ebef]"><div className="h-full bg-[#526982]" style={{ width }} /></div>
                </div>
              ))}
            </div>
            {/* Responsive Table Wrapper */}
            <div className="w-full overflow-x-auto">
              <div className="min-w-[700px]">
                <div className="grid grid-cols-[1.6fr_0.7fr_0.7fr_0.8fr_0.8fr_0.7fr_1fr] border-b border-[#e5eaee] px-5 py-3 text-[8px] text-[#899aaa]">
                  <span>Student</span><span>Obtained</span><span>Total</span><span>Percentage</span><span>Result</span><span>Grade</span><span>Exam date</span>
                </div>
                {[
                  ["AS", "Aarav Sharma", "282", "94%", "A+", "24 May 2025"],
                  ["IK", "Isha Kulkarni", "264", "88%", "A", "24 May 2025"],
                  ["RP", "Rohan Patil", "231", "77%", "B+", "24 May 2025"],
                  ["MJ", "Meera Joshi", "198", "66%", "B", "24 May 2025"],
                ].map(([initials, name, obtained, percentage, grade, date]) => (
                  <div key={name} className="grid grid-cols-[1.6fr_0.7fr_0.7fr_0.8fr_0.8fr_0.7fr_1fr] items-center border-b border-[#edf0f3] px-5 py-3 text-[9px] text-[#526982]">
                    <span className="flex items-center gap-2 font-semibold text-[#304058]"><b className="flex h-6 w-6 items-center justify-center rounded-full bg-[#edf1f4] text-[7px] font-normal">{initials}</b>{name}</span>
                    <span>{obtained}</span><span>300</span><span>{percentage}</span><span><b className="rounded-md bg-[#e7f5ef] px-2 py-1 text-[8px] font-medium text-[#56977b]">Pass</b></span><span>{grade}</span><span>{date}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2 bg-[#f5f7f9] px-5 sm:px-6 py-3 text-[8px] sm:text-[9px] text-[#899aaa]">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              Instant results are available for supported automatically evaluated question types when enabled.
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ─── 10. Multiple Educational Needs ─── */}
      <section id="solutions" className="relative overflow-hidden border-y border-[#e7ebef] bg-white py-16 sm:py-20 lg:py-24">
        <div className="pointer-events-none absolute inset-0 opacity-60" style={{ backgroundImage: "linear-gradient(#e9eef3 1px, transparent 1px), linear-gradient(90deg, #e9eef3 1px, transparent 1px)", backgroundSize: "64px 64px" }} />
        <div className="relative mx-auto max-w-[1115px] px-5 sm:px-8">
          <ScrollReveal direction="up" className="mx-auto max-w-3xl space-y-4 text-center">
            <h2 className="text-3xl font-bold leading-[1.08] tracking-[-0.035em] text-[#304058] sm:text-5xl">
              One Platform. Multiple
              <br />
              Educational Needs.
            </h2>
            <p className="text-[14px] sm:text-[15px] leading-relaxed text-[#718096]">
              Flexible examination capabilities designed for different learning environments and institutional
              <br className="hidden sm:block" /> requirements.
            </p>
          </ScrollReveal>

          <div className="mt-10 grid gap-3 lg:grid-cols-2">
            {[
              ["01", "JEE / CET / NEET Organizations", "Create chapter-wise practice tests, subject assessments and full-length competitive examination simulations."],
              ["02", "Schools", "Conduct regular academic assessments, unit tests and structured student evaluations."],
              ["03", "Colleges & Universities", "Manage technical assessments, aptitude tests, coding examinations and internal evaluations."],
              ["04", "Training & Assessment Organizations", "Evaluate knowledge, technical capabilities and candidate performance through structured online assessments."],
            ].map(([number, title, description], index) => (
              <ScrollReveal key={title} direction="up" delay={index * 70}>
                <article className="relative min-h-[260px] sm:min-h-[245px] overflow-hidden rounded-xl border border-[#dce3e9] bg-white p-5 shadow-[0_8px_24px_rgba(47,64,87,0.04)]">
                  <span className="absolute left-5 top-0 h-px w-3 bg-[#8da0b3]" />
                  <div className="pr-0 pb-36 sm:pb-0 sm:pr-[46%] h-full">
                    <p className="text-[10px] font-bold tracking-[0.14em] text-[#899aaa]">{number}</p>
                    <h3 className="mt-3 sm:mt-4 text-[16px] sm:text-[18px] font-medium leading-tight text-[#304058]">{title}</h3>
                    <p className="mt-2 sm:mt-3 text-[12px] sm:text-[13px] leading-relaxed text-[#718096]">{description}</p>
                    <span className="absolute bottom-5 left-5 text-[11px] font-semibold text-[#526982]">Learn more　→</span>
                  </div>
                  <div className="absolute bottom-2 right-2 sm:top-2 w-[88%] sm:w-[43%] h-[125px] sm:h-auto rounded-lg border border-[#dce3e9] bg-[#f3f6f8] p-3 overflow-hidden">
                    {index === 0 && <><div className="mb-3 h-3 w-24 rounded bg-[#304058]" /><div className="space-y-2">{["Electrostatics", "Current electricity"].map((item) => <div key={item} className="rounded border border-[#dce3e9] bg-white p-2 text-[8px] text-[#718096]">□ {item}</div>)}</div></>}
                    {index === 1 && <><div className="mb-4 h-3 w-20 rounded bg-[#304058]" /><p className="text-[9px] font-semibold text-[#304058]">Which organelle is known as the powerhouse of the cell?</p><div className="mt-3 space-y-2">{["Nucleus", "Mitochondria", "Ribosome"].map((item) => <div key={item} className="rounded border border-[#cbd6df] bg-white p-2 text-[8px] text-[#718096]">{item}</div>)}</div></>}
                    {index === 2 && <div className="h-full rounded bg-[#1d2b3d] p-3 font-mono text-[8px] leading-relaxed text-[#9ee493]"><p>1 function findResult(data) &#123;</p><p>2 const values = data.map</p><p>3 item.score();</p><p>4 return Math.max(...values)</p><p>5 &#125;</p></div>}
                    {index === 3 && <><p className="text-2xl font-bold text-[#304058]">82%</p><p className="text-[8px] text-[#899aaa]">Average score</p><div className="mt-8 flex h-16 items-end gap-1">{[35, 55, 42, 68, 52, 78, 60].map((height, bar) => <span key={bar} className="flex-1 bg-[#718198]" style={{ height: `${height}%` }} />)}</div><p className="mt-2 text-[8px] text-[#899aaa]">Completed　　　　　　 124 candidates</p></>}
                  </div>
                </article>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── 11. Transparent Pricing ─── */}
      <section id="pricing" className="relative overflow-hidden border-y border-[#e7ebef] bg-[#f7f9fb] py-16 sm:py-20 lg:py-24">
        <div className="pointer-events-none absolute inset-0 opacity-60" style={{ backgroundImage: "linear-gradient(#e9eef3 1px, transparent 1px), linear-gradient(90deg, #e9eef3 1px, transparent 1px)", backgroundSize: "64px 64px" }} />
        <div className="relative mx-auto max-w-[1115px] px-5 sm:px-8">
          <ScrollReveal direction="up" className="mx-auto max-w-3xl space-y-4 text-center">
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#718096]">Transparent Pricing</span>
            <h2 className="text-3xl font-bold leading-[1.08] tracking-[-0.035em] text-[#304058] sm:text-5xl">
              Simple Plans. Powerful
              <br />
              Examination Capabilities.
            </h2>
            <p className="text-[14px] sm:text-[15px] text-[#718096]">Choose a plan that supports the way your organization assesses and grows.</p>
          </ScrollReveal>

          <div className="mt-10 grid items-stretch gap-4 sm:gap-3 lg:grid-cols-3">
            {[
              ["Basic", "₹8,500", "Essential tools for modern examination management.", "View Pricing", ["50 students", "200 exams per year", "General examination management", "AI question generation", "Automatic results", "Proctoring"]],
              ["Organization", "₹12,000", "Essential tools for modern examination management.", "View Pricing", ["50 students", "200 exams per year", "Everything in Basic", "JEE, MHT-CET & NEET creation", "Class and chapter-based workflow"]],
              ["Customized Plan", "Custom", "A tailored solution designed around your organization.", "Talk to Our Team", ["Custom student capacity", "Custom examination limits", "Tailored organization requirements", "Personalized support options"]],
            ].map(([name, price, description, action, items], index) => (
              <ScrollReveal key={name as string} direction="up" delay={index * 90}>
                <article className="group relative flex h-full min-h-[405px] box-border flex-col rounded-xl border border-[#dce3e9] bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:border-[#304058] hover:shadow-[0_16px_34px_rgba(47,64,87,0.12)]">
                  <span className="absolute left-5 top-0 h-px w-3 bg-[#8da0b3]" />
                  {index === 1 && <span className="absolute right-5 top-5 rounded-md bg-[#304058] px-3 py-2 text-[8px] font-bold uppercase tracking-wide text-white">Most Popular</span>}
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#718096]">{name as string}</p>
                  <div className="mt-7 flex items-baseline gap-2 text-[#304058]">
                    <span className="text-3xl font-bold">{price as string}</span>
                    <small className="text-[9px] text-[#899aaa]">{index === 2 ? "pricing" : "/ year"}</small>
                  </div>
                  <p className="mt-4 min-h-[42px] text-[12px] leading-relaxed text-[#718096]">{description as string}</p>
                  <button type="button" className={`mt-5 flex w-full items-center justify-center rounded-lg border px-4 py-3 text-[11px] font-semibold transition-colors cursor-pointer ${index === 1 ? "border-[#304058] bg-[#304058] text-white hover:bg-[#243246]" : "border-[#cbd6df] bg-white text-[#526982] hover:bg-[#f4f6f8]"}`}>
                    {action as string}　→
                  </button>
                  <div className="my-5 border-t border-[#edf0f3]" />
                  <ul className="space-y-3 text-[11px] text-[#718096]">
                    {(items as string[]).map((item) => <li key={item} className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-[#718096]" />{item}</li>)}
                  </ul>
                </article>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── 12. Institutional CTA Section ─── */}
      <section id="institutes" className="relative overflow-hidden border-t border-[#e7ebef] bg-white py-16 sm:py-20 lg:py-24">
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            backgroundImage: "linear-gradient(#e9eef3 1px, transparent 1px), linear-gradient(90deg, #e9eef3 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        <div className="relative mx-auto grid max-w-[1140px] items-center gap-10 px-6 sm:px-8 lg:grid-cols-[1.15fr_0.85fr] lg:gap-14">
          <ScrollReveal direction="up">
            <span className="text-[12px] font-bold uppercase tracking-[0.16em] text-[#64748b]">
              Start Your Transformation
            </span>
            <h2 className="mt-5 text-3xl sm:text-5xl lg:text-[50px] font-extrabold leading-[1.08] tracking-[-0.035em] text-[#1e293b]">
              Ready to Transform the Way
              <br />
              You Conduct Examinations?
            </h2>
            <p className="mt-6 max-w-[500px] text-[15px] leading-relaxed text-[#64748b] sm:text-base">
              Experience a smarter, more secure and efficient examination management platform built for modern educational organizations.
            </p>
          </ScrollReveal>

          {/* 3D Dashboard Mockup Card */}
          <ScrollReveal direction="up" delay={150} className="relative flex items-center justify-center py-4">
            <div className="relative w-full max-w-[390px] -rotate-[3.5deg] overflow-hidden rounded-xl border border-[#e2e8f0] bg-white shadow-[0_25px_50px_-12px_rgba(15,23,42,0.14),0_0_0_1px_rgba(226,232,240,0.8)] transition-transform duration-300 hover:rotate-0">
              <div className="flex min-h-[225px]">
                {/* Mini Sidebar */}
                <aside className="w-[70px] shrink-0 bg-[#e8edf2] px-2.5 py-3 text-[#64748b]">
                  <div className="flex items-center gap-1.5 text-[7px] font-bold text-[#1e293b]">
                    <span className="flex h-3.5 w-3.5 items-center justify-center rounded bg-white text-[8px] font-black text-[#1e293b] shadow-xs">
                      T
                    </span>
                    <span className="tracking-wider">TESTRO</span>
                  </div>
                  <div className="mt-4 space-y-2 text-[6.5px]">
                    <span className="block rounded bg-[#d3dce4] px-1.5 py-1 font-semibold text-[#1e293b]">Dashboard</span>
                    <span className="block px-1.5 py-0.5 text-[#64748b]">Exams</span>
                    <span className="block px-1.5 py-0.5 text-[#64748b]">Questions</span>
                    <span className="block px-1.5 py-0.5 text-[#64748b]">Students</span>
                    <span className="block px-1.5 py-0.5 text-[#64748b]">Analytics</span>
                  </div>
                </aside>

                {/* Mini Content Area */}
                <div className="flex-1 bg-[#f8fafc] p-3">
                  <div className="flex items-center justify-between border-b border-[#e2e8f0] pb-2 text-[7px] text-[#64748b]">
                    <b className="font-semibold text-[#1e293b]">Dashboard</b>
                    <span>Good morning, Admin</span>
                    <span className="h-2.5 w-2.5 rounded-full bg-[#cbd5e1]" />
                  </div>

                  {/* Metric Tiles */}
                  <div className="mt-2.5 grid grid-cols-4 gap-1.5">
                    {["248", "12", "4,826", "1,842"].map((val) => (
                      <span key={val} className="rounded border border-[#e2e8f0] bg-white p-1.5 text-center text-[9px] font-bold text-[#1e293b] shadow-xs">
                        {val}
                      </span>
                    ))}
                  </div>

                  {/* 2-Col Widgets */}
                  <div className="mt-2.5 grid grid-cols-[1.4fr_1fr] gap-2">
                    {/* Left: Recent Contributions / Exams */}
                    <div className="rounded border border-[#e2e8f0] bg-white p-2 shadow-xs">
                      <span className="block text-[6px] font-medium text-[#64748b]">Recent examinations</span>
                      <div className="mt-2 space-y-1.5">
                        <span className="block h-1 w-full rounded-full bg-[#cbd5e1]" />
                        <span className="block h-1 w-[80%] rounded-full bg-[#e2e8f0]" />
                        <span className="block h-1 w-[60%] rounded-full bg-[#e2e8f0]" />
                      </div>
                    </div>

                    {/* Right: Circular Progress Ring */}
                    <div className="flex flex-col items-center justify-center rounded border border-[#e2e8f0] bg-white p-2 shadow-xs">
                      <span className="text-[6px] font-medium text-[#64748b]">Result overview</span>
                      <div className="relative mt-1 flex h-10 w-10 items-center justify-center rounded-full border-[3.5px] border-[#334155] border-t-[#0284c7] text-[8px] font-bold text-[#1e293b]">
                        84%
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ─── Modern Deep Dark Footer ─── */}
      <footer className="border-t border-[#182333] bg-[#0c1524] pt-16 pb-12 text-[#8c9bab]">
        <div className="mx-auto max-w-[1140px] px-6 sm:px-8">
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-[1.5fr_1fr_1fr_1fr_1.1fr] lg:gap-10">
            {/* Brand Column */}
            <div className="col-span-2 sm:col-span-3 lg:col-span-1">
              <div className="flex items-center gap-2.5">
                <svg
                  className="h-8 w-8 shrink-0"
                  viewBox="0 0 44 44"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M0 12C0 5.37258 5.37258 0 12 0H32C38.6274 0 44 5.37258 44 12V32C44 38.6274 38.6274 44 32 44H3C1.34315 44 0 42.6569 0 41V12Z"
                    fill="white"
                  />
                  <path
                    d="M15.5 13.5H28.5V17.5H24V28.5H20V17.5H15.5V13.5Z"
                    fill="#0c1524"
                  />
                </svg>
                <div>
                  <span className="block text-[14px] font-bold tracking-wider text-white">
                    TESTRO
                  </span>
                  <span className="block text-[7.5px] font-semibold tracking-[0.3em] text-[#64748b]">
                    LAB
                  </span>
                </div>
              </div>
              <p className="mt-4 max-w-[240px] text-[12px] leading-relaxed text-[#8c9bab]">
                An integrated AI-powered examination and assessment management platform by Progrentures Solution Pvt. Ltd.
              </p>
            </div>

            {/* Platform */}
            <div>
              <h3 className="text-[12px] font-bold tracking-wider text-white">Platform</h3>
              <div className="mt-4 space-y-2.5 text-[11px]">
                <Link href="#features" className="block text-[#8c9bab] transition-colors hover:text-white">Features</Link>
                <Link href="#workflow" className="block text-[#8c9bab] transition-colors hover:text-white">AI Question Generation</Link>
                <Link href="#workflow" className="block text-[#8c9bab] transition-colors hover:text-white">Exam Management</Link>
                <Link href="#coding" className="block text-[#8c9bab] transition-colors hover:text-white">Online Assessments</Link>
                <Link href="#security" className="block text-[#8c9bab] transition-colors hover:text-white">Proctoring &amp; Security</Link>
                <Link href="#analytics" className="block text-[#8c9bab] transition-colors hover:text-white">Analytics</Link>
              </div>
            </div>

            {/* Solutions */}
            <div>
              <h3 className="text-[12px] font-bold tracking-wider text-white">Solutions</h3>
              <div className="mt-4 space-y-2.5 text-[11px]">
                <Link href="#exams" className="block text-[#8c9bab] transition-colors hover:text-white">Organizations</Link>
                <Link href="#solutions" className="block text-[#8c9bab] transition-colors hover:text-white">Schools</Link>
                <Link href="#solutions" className="block text-[#8c9bab] transition-colors hover:text-white">Colleges</Link>
                <Link href="#exams" className="block text-[#8c9bab] transition-colors hover:text-white">JEE / CET / NEET</Link>
              </div>
            </div>

            {/* Company */}
            <div>
              <h3 className="text-[12px] font-bold tracking-wider text-white">Company</h3>
              <div className="mt-4 space-y-2.5 text-[11px]">
                <Link href="#about" className="block text-[#8c9bab] transition-colors hover:text-white">About Us</Link>
                <Link href="#pricing" className="block text-[#8c9bab] transition-colors hover:text-white">Pricing</Link>
                <Link href="https://progrentures.com/#contact" target="_blank" className="block text-[#8c9bab] transition-colors hover:text-white">Contact</Link>
                <button
                  type="button"
                  onClick={() => window.open("https://wa.me/919309470958", "_blank")}
                  className="block text-[#8c9bab] transition-colors hover:text-white cursor-pointer"
                >
                  Schedule a Demo
                </button>
              </div>
            </div>

            {/* Contact */}
            <div>
              <h3 className="text-[12px] font-bold tracking-wider text-white">Contact</h3>
              <div className="mt-4 space-y-3 text-[11px]">
                <button
                  type="button"
                  onClick={() => window.open("https://wa.me/919309470958", "_blank")}
                  className="flex items-center gap-2 text-[#8c9bab] transition-colors hover:text-white cursor-pointer"
                >
                  <Phone className="h-3.5 w-3.5 shrink-0 text-[#8c9bab]" />
                  <span>9309470958</span>
                </button>
                <a
                  href="mailto:hello@progrentures.com"
                  className="flex items-center gap-2 text-[#8c9bab] transition-colors hover:text-white"
                >
                  <Mail className="h-3.5 w-3.5 shrink-0 text-[#8c9bab]" />
                  <span>hello@progrentures.com</span>
                </a>
                <a
                  href="https://www.progrentures.com"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 text-[#8c9bab] transition-colors hover:text-white"
                >
                  <Globe className="h-3.5 w-3.5 shrink-0 text-[#8c9bab]" />
                  <span>www.progrentures.com</span>
                </a>
              </div>
            </div>
          </div>

          {/* Divider Line */}
          <div className="mt-14 border-t border-[#1a2638]" />

          {/* Bottom Copyright & Legal Links */}
          <div className="mt-6 flex flex-col items-center justify-between gap-3 text-[11px] text-[#6b7c93] sm:flex-row">
            <p>© 2026 Progrentures Solution Pvt. Ltd. All rights reserved.</p>
            <div className="flex items-center gap-6">
              <a href="#" className="transition-colors hover:text-white">Privacy Policy</a>
              <a href="#" className="transition-colors hover:text-white">Terms &amp; Conditions</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
