"use client"

import { useState, useEffect, useRef } from "react"
import {
  Building2,
  Upload,
  Palette,
  Check,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trash2,
  Info,
  Database,
  Calendar,
  MessageSquare,
  Send,
  Clock,
  Mail,
  Phone,
  HelpCircle,
  ExternalLink,
} from "lucide-react"
import { toast } from "sonner"
import { formatDateDDMMYYYY } from "@/lib/utils"

const THEME_PRESETS = [
  { name: "Slate Navy", hex: "#2D3A4A", desc: "Professional & Classic" },
  { name: "Sapphire Blue", hex: "#2563EB", desc: "Modern & Trustworthy" },
  { name: "Indigo Purple", hex: "#4F46E5", desc: "Dynamic Tech Feel" },
  { name: "Emerald Green", hex: "#059669", desc: "Academic & Focused" },
  { name: "Royal Violet", hex: "#7C3AED", desc: "Creative & Premium" },
  { name: "Deep Teal", hex: "#0D9488", desc: "Balanced & Elegant" },
  { name: "Crimson Red", hex: "#DC2626", desc: "Bold & High-Energy" },
  { name: "Warm Amber", hex: "#D97706", desc: "Vibrant & Warm" },
]

export default function SettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState("")

  const [isInstitute, setIsInstitute] = useState(false)

  // Institute state
  const [instituteName, setInstituteName] = useState("")
  const [instituteCode, setInstituteCode] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [address, setAddress] = useState("")
  const [city, setCity] = useState("")
  const [contactPerson, setContactPerson] = useState("")
  const [logo, setLogo] = useState<string>("")
  const [themeColor, setThemeColor] = useState<string>("#2D3A4A")
  const [validUntil, setValidUntil] = useState<string | null>(null)
  const [status, setStatus] = useState<string>("active")
  const [limits, setLimits] = useState<any>(null)

  // Super admin platform state
  const [platformName, setPlatformName] = useState("Progrentures Exam Platform")
  const [supportEmail, setSupportEmail] = useState("support@progrentures.com")
  const [supportPhone, setSupportPhone] = useState("+91 93094 70958")

  // Support queries state for organization
  const [queries, setQueries] = useState<any[]>([])
  const [loadingQueries, setLoadingQueries] = useState(false)
  const [querySubject, setQuerySubject] = useState("")
  const [queryCategory, setQueryCategory] = useState("quota_increase")
  const [queryMessage, setQueryMessage] = useState("")
  const [submittingQuery, setSubmittingQuery] = useState(false)

  const loadInstituteQueries = async () => {
    try {
      setLoadingQueries(true)
      const res = await fetch("/api/admin/queries", { credentials: "include" })
      const data = await res.json()
      if (data.success) {
        setQueries(data.queries || [])
      }
    } catch (e) {
      console.error("Failed to load queries:", e)
    } finally {
      setLoadingQueries(false)
    }
  }

  const handleSubmitQuery = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!querySubject.trim()) {
      toast.error("Please enter a subject for your query")
      return
    }
    if (!queryMessage.trim()) {
      toast.error("Please describe your query or change request")
      return
    }

    try {
      setSubmittingQuery(true)
      const res = await fetch("/api/admin/queries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: querySubject.trim(),
          category: queryCategory,
          message: queryMessage.trim(),
          contactEmail: email,
          contactPhone: phone,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to submit query")

      toast.success("Query submitted! Platform administrators have been notified.")
      setQuerySubject("")
      setQueryMessage("")
      loadInstituteQueries()
    } catch (err: any) {
      toast.error(err.message || "Failed to submit query")
    } finally {
      setSubmittingQuery(false)
    }
  }

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Fetch settings on mount
  useEffect(() => {
    fetch("/api/admin/settings", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (data.isInstitute && data.institute) {
          setIsInstitute(true)
          setInstituteName(data.institute.name || "")
          setInstituteCode(data.institute.code || "")
          setEmail(data.institute.email || "")
          setPhone(data.institute.phone || "")
          setAddress(data.institute.address || "")
          setCity(data.institute.city || "")
          setContactPerson(data.institute.contactPerson || "")
          setLogo(data.institute.logo || "")
          if (data.institute.validUntil) setValidUntil(data.institute.validUntil)
          if (data.institute.status) setStatus(data.institute.status)
          if (data.institute.limits) setLimits(data.institute.limits)
          const color = data.institute.themeColor || "#2D3A4A"
          setThemeColor(color)
          document.documentElement.style.setProperty("--primary", color)
          loadInstituteQueries()
        } else if (data.settings) {
          setIsInstitute(false)
          if (data.settings.platformName) setPlatformName(data.settings.platformName)
          if (data.settings.supportEmail) setSupportEmail(data.settings.supportEmail)
          if (data.settings.supportPhone) setSupportPhone(data.settings.supportPhone)
        }
      })
      .catch((err) => {
        console.error("Failed to load settings:", err)
      })
      .finally(() => setLoading(false))
  }, [])

  // Handle Logo Upload
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload a valid image file (PNG, JPG, SVG, WebP)")
      return
    }

    // Limit to 3MB
    if (file.size > 3 * 1024 * 1024) {
      toast.error("Logo file size must be less than 3MB")
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const base64 = event.target?.result as string
      setLogo(base64)
      toast.success("Logo uploaded! Click 'Save All Changes' to apply.")
    }
    reader.readAsDataURL(file)
  }

  // Handle Save
  const handleSave = async () => {
    setSaving(true)
    setSaveError("")
    try {
      const payload = isInstitute
        ? {
            name: instituteName,
            phone,
            address,
            city,
            contactPerson,
            logo,
            themeColor,
          }
        : {
            platformName,
            supportEmail,
            supportPhone,
          }

      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to save settings")

      setSaved(true)
      toast.success("Settings saved successfully!")

      if (isInstitute && themeColor) {
        document.documentElement.style.setProperty("--primary", themeColor)
        document.documentElement.style.setProperty("--brand-theme", themeColor)
      }

      // Notify sidebar and coaching theme wrapper to refresh logo and theme immediately
      window.dispatchEvent(new CustomEvent("institute-settings-updated", { detail: { themeColor } }))

      setTimeout(() => setSaved(false), 3000)
    } catch (err: any) {
      setSaveError(err.message || "Failed to save settings")
      toast.error(err.message || "Failed to save settings")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8 max-w-7xl mx-auto flex items-center justify-center min-h-[50vh]">
        <div className="flex items-center gap-3 text-sm font-semibold text-gray-500">
          <Loader2 size={18} className="animate-spin text-[#324158]" /> Loading settings...
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-200 pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
            {isInstitute ? "Coaching Branding & Theme" : "Platform Settings"}
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            {isInstitute
              ? "Upload your coaching logo and customize the brand theme color across your portal and student exams."
              : "Manage global platform credentials and operational preferences."}
          </p>
        </div>

        {isInstitute && instituteCode && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold px-3 py-1 rounded-lg bg-gray-100 text-gray-700 border border-gray-200">
              Code: {instituteCode}
            </span>
          </div>
        )}
      </div>

      {isInstitute ? (
        /* ═══════════════════════════════════════════════════════════════════
           COACHING INSTITUTE BRANDING & THEME VIEW (FULL WIDTH)
        ═══════════════════════════════════════════════════════════════════ */
        <div className="space-y-6 sm:space-y-8">
          {/* Subscription & Validity Card */}
          <div className="bg-white rounded-2xl border border-gray-200/90 p-5 sm:p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs"
                  style={{ backgroundColor: themeColor }}
                >
                  <Calendar size={20} />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-gray-900">
                    Subscription & License Details
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    View your organization license period and authorized test quotas.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                  status === "active"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-red-50 text-red-700 border-red-200"
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${status === "active" ? "bg-emerald-500" : "bg-red-500"}`} />
                  {status === "active" ? "Active License" : "Deactivated"}
                </span>

                {validUntil ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-xs font-semibold">
                    <Calendar size={13} className="text-blue-600" />
                    Subscription Valid Up To: <strong>{formatDateDDMMYYYY(validUntil)}</strong>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold">
                    <Calendar size={13} className="text-slate-500" />
                    Lifetime Validity (No Expiry)
                  </span>
                )}
              </div>
            </div>

            {limits && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-gray-100 text-xs">
                <div>
                  <span className="text-gray-400 block text-[11px]">Max Students</span>
                  <span className="font-bold text-[#324158] text-sm mt-0.5 block">{limits.maxStudents ?? 100} Enrolled</span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[11px]">Max Exams</span>
                  <span className="font-bold text-[#324158] text-sm mt-0.5 block">{limits.maxExams ?? 20} Exams</span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[11px]">Paper Import</span>
                  <span className="font-bold text-[#324158] text-sm mt-0.5 block">{limits.features?.pdfImport ? "Enabled" : "Disabled"}</span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[11px]">AI Generation</span>
                  <span className="font-bold text-[#324158] text-sm mt-0.5 block">{limits.features?.neetJeeGenerator !== false ? "Enabled" : "Disabled"}</span>
                </div>
              </div>
            )}
          </div>

          {/* 1. Brand Logo Upload Card */}
          <div className="bg-white rounded-2xl border border-gray-200/90 p-6 sm:p-8 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs"
                  style={{ backgroundColor: themeColor }}
                >
                  <Building2 size={20} />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-gray-900">Coaching Institute Logo</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Your logo replaces the default platform logo in your portal header and on all student exam screens.
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-bold text-slate-700 uppercase tracking-widest bg-slate-100 px-3 py-1 rounded-full border border-slate-200 w-fit">
                White-Label Branding
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center">
              {/* Preview Box */}
              <div className="lg:col-span-5 flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50/60 min-h-[190px] w-full">
                {logo ? (
                  <div className="space-y-3 text-center">
                    <div className="p-4 bg-white rounded-xl border border-gray-200 shadow-2xs inline-block">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={logo}
                        alt="Uploaded Coaching Logo"
                        className="max-h-24 max-w-[280px] w-auto object-contain mx-auto"
                      />
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                        Active Brand Logo
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setLogo("")
                          if (fileInputRef.current) fileInputRef.current.value = ""
                          toast.info("Logo removed. Click 'Save All Changes' to confirm.")
                        }}
                        className="text-[11px] font-bold text-red-600 hover:text-red-700 hover:bg-red-50 px-2.5 py-0.5 rounded transition-colors inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 size={12} /> Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center space-y-2">
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center text-white mx-auto shadow-xs"
                      style={{ backgroundColor: themeColor }}
                    >
                      <Building2 size={24} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-700">No Custom Logo Uploaded</p>
                      <p className="text-[11px] text-gray-400">
                        Upload your official coaching logo (PNG, JPG, SVG, WebP)
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Upload Controls */}
              <div className="lg:col-span-7 space-y-4">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  onChange={handleLogoUpload}
                  className="hidden"
                  id="logo-upload-input"
                />

                <div className="space-y-2">
                  <label
                    htmlFor="logo-upload-input"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white text-xs sm:text-sm font-bold shadow-sm hover:opacity-90 active:scale-95 transition-all cursor-pointer"
                    style={{ backgroundColor: themeColor }}
                  >
                    <Upload size={16} />
                    {logo ? "Upload / Replace Logo" : "Upload Coaching Logo"}
                  </label>
                  <p className="text-[11px] text-gray-400 leading-relaxed">
                    Recommended dimensions: <strong>300x80 px</strong> or higher. Transparent PNG or SVG yields best results across light headers.
                  </p>
                </div>

                <div className="p-3.5 bg-amber-50/80 rounded-xl border border-amber-200/70 text-xs text-amber-800 leading-relaxed">
                  <strong>Student Exam Visibility:</strong> When students open or submit tests created by your coaching, your logo will appear on their exam header instead of any platform branding.
                </div>
              </div>
            </div>
          </div>

          {/* 2. Brand Theme Color Customizer Card */}
          <div className="bg-white rounded-2xl border border-gray-200/90 p-6 sm:p-8 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs"
                  style={{ backgroundColor: themeColor }}
                >
                  <Palette size={20} />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-gray-900">Theme & Brand Color</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Customize your coaching portal and student exam accent colors to match your institute branding.
                  </p>
                </div>
              </div>
              <div
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-white text-xs font-mono font-bold shadow-2xs w-fit"
                style={{ backgroundColor: themeColor, borderColor: themeColor }}
              >
                <span>{themeColor}</span>
              </div>
            </div>

            {/* Presets Grid - Wide 8 Columns on Large Screens */}
            <div className="space-y-3 mb-6">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">
                Choose Brand Palette Preset
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 sm:gap-3.5">
                {THEME_PRESETS.map((preset) => {
                  const isSelected = themeColor.toLowerCase() === preset.hex.toLowerCase()
                  return (
                    <button
                      key={preset.hex}
                      type="button"
                      onClick={() => setThemeColor(preset.hex)}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer relative ${
                        isSelected
                          ? "border-gray-900 ring-2 ring-gray-900/10 shadow-xs bg-gray-50/50"
                          : "border-gray-200 hover:border-gray-300 bg-white"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div
                          className="w-6 h-6 rounded-lg shadow-2xs shrink-0 flex items-center justify-center text-white"
                          style={{ backgroundColor: preset.hex }}
                        >
                          {isSelected && <Check size={14} className="stroke-[3]" />}
                        </div>
                        <span className="text-[10px] font-mono text-gray-400 font-semibold">{preset.hex}</span>
                      </div>
                      <p className="text-xs font-bold text-gray-800 leading-tight">{preset.name}</p>
                      <p className="text-[10px] text-gray-400 truncate mt-0.5">{preset.desc}</p>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Custom Color Input & Live Preview */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-5 border-t border-gray-100 items-center">
              <div className="lg:col-span-6 space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">
                  Or Pick Custom Hex Color
                </label>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <input
                      type="color"
                      value={themeColor}
                      onChange={(e) => setThemeColor(e.target.value)}
                      className="w-12 h-11 rounded-xl border border-gray-200 p-1 cursor-pointer bg-white shadow-2xs"
                    />
                  </div>
                  <input
                    type="text"
                    value={themeColor}
                    onChange={(e) => {
                      const val = e.target.value
                      if (val.startsWith("#") && val.length <= 7) setThemeColor(val)
                      else if (!val.startsWith("#") && val.length <= 6) setThemeColor("#" + val)
                    }}
                    placeholder="#2D3A4A"
                    className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl font-mono text-sm font-bold text-gray-800 focus:outline-none focus:border-gray-400"
                  />
                </div>
                <p className="text-[11px] text-gray-400">
                  Enter any standard 6-digit hex code or use the color picker dropper.
                </p>
              </div>

              {/* Live Preview Card */}
              <div className="lg:col-span-6 p-4 rounded-xl border border-gray-200 bg-gray-50/50 space-y-3">
                <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  Live UI Element Preview
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className="px-4 py-2 rounded-lg text-white text-xs font-bold shadow-2xs"
                    style={{ backgroundColor: themeColor }}
                  >
                    Primary Button
                  </button>
                  <span
                    className="text-xs font-bold px-3 py-1.5 rounded-md text-white shadow-2xs"
                    style={{ backgroundColor: themeColor }}
                  >
                    Active Tab
                  </span>
                  <div
                    className="w-8 h-8 rounded-lg text-white flex items-center justify-center text-xs font-bold shadow-2xs"
                    style={{ backgroundColor: themeColor }}
                  >
                    A
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 3. Help & Support / Request for Change Section */}
          <div className="bg-white rounded-2xl border border-gray-200/90 p-6 sm:p-8 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs"
                  style={{ backgroundColor: themeColor }}
                >
                  <MessageSquare size={20} />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-gray-900">
                    Help & Support / Request for Change
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Have questions, need your exam/student quotas increased, or requesting platform changes? Send your query directly to platform administrators.
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-bold text-slate-700 uppercase tracking-widest bg-slate-100 px-3 py-1 rounded-full border border-slate-200 w-fit">
                Dedicated Support Desk
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
              {/* Left Column: Submit Query Form */}
              <div className="lg:col-span-6 space-y-4">
                <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                  <Send size={15} style={{ color: themeColor }} />
                  <span>Submit a New Query / Request</span>
                </h3>

                <form onSubmit={handleSubmitQuery} className="space-y-3.5">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-600 block">
                      Category / Request Type:
                    </label>
                    <select
                      value={queryCategory}
                      onChange={(e) => setQueryCategory(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-xs font-medium bg-gray-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2D3A4A]/10 focus:border-[#2D3A4A] transition-all cursor-pointer"
                    >
                      <option value="quota_increase">Exam Quota Increase Request</option>
                      <option value="quota_increase">Student Enrolled Limit Increase</option>
                      <option value="billing_fees">Billing, License & Validity</option>
                      <option value="feature_request">Feature Request / Customization</option>
                      <option value="technical_issue">Technical Support / Bug</option>
                      <option value="other">General Query / Other</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-600 block">
                      Subject:
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Request to increase exam quota from 20 to 50"
                      value={querySubject}
                      onChange={(e) => setQuerySubject(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-xs font-medium bg-gray-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2D3A4A]/10 focus:border-[#2D3A4A] transition-all"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-600 block">
                      Message / Request Details:
                    </label>
                    <textarea
                      required
                      rows={4}
                      placeholder="Explain your query, the changes required, or additional quotas needed for your institute..."
                      value={queryMessage}
                      onChange={(e) => setQueryMessage(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-xs font-medium bg-gray-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2D3A4A]/10 focus:border-[#2D3A4A] transition-all resize-none leading-relaxed"
                    />
                  </div>

                  <div className="pt-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <button
                      type="submit"
                      disabled={submittingQuery}
                      style={{ backgroundColor: themeColor }}
                      className="px-6 py-2.5 rounded-xl text-xs font-bold text-white shadow-xs hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                    >
                      {submittingQuery ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          <span>Submitting Query...</span>
                        </>
                      ) : (
                        <>
                          <Send size={14} />
                          <span>Submit Query</span>
                        </>
                      )}
                    </button>

                    <a
                      href={`mailto:support@progrentures.com?subject=${encodeURIComponent(
                        `REQUEST For Change - ${instituteName || "Organization"} (${instituteCode || "ID"})`
                      )}&body=${encodeURIComponent(
                        `Hello Progrentures Support Team,\n\nOrganization: ${instituteName}\nCode: ${instituteCode}\nContact Email: ${email}\nContact Phone: ${phone}\n\nRequest / Change Details:\n${queryMessage || "[Describe your request here]"}\n`
                      )}`}
                      className="text-xs text-slate-500 hover:text-slate-800 underline font-medium flex items-center gap-1.5 w-fit"
                    >
                      <Mail size={13} className="text-slate-400" />
                      <span>Or email support@progrentures.com</span>
                      <ExternalLink size={11} />
                    </a>
                  </div>
                </form>
              </div>

              {/* Right Column: Query History & Admin Replies */}
              <div className="lg:col-span-6 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                    <Clock size={15} style={{ color: themeColor }} />
                    <span>Your Support Queries & Admin Replies</span>
                  </h3>
                  <button
                    type="button"
                    onClick={loadInstituteQueries}
                    disabled={loadingQueries}
                    className="text-[11px] text-gray-500 hover:text-gray-800 flex items-center gap-1 cursor-pointer"
                  >
                    <Loader2 size={12} className={loadingQueries ? "animate-spin" : "hidden"} />
                    <span>Refresh</span>
                  </button>
                </div>

                <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                  {loadingQueries && queries.length === 0 ? (
                    <div className="p-8 text-center text-xs text-gray-400">Loading your queries...</div>
                  ) : queries.length === 0 ? (
                    <div className="p-8 text-center rounded-xl bg-gray-50/70 border border-dashed border-gray-200 space-y-1.5">
                      <HelpCircle size={24} className="text-gray-300 mx-auto" />
                      <p className="text-xs font-bold text-gray-700">No support queries yet</p>
                      <p className="text-[11px] text-gray-400">
                        When you submit a query or request for change, it will appear here along with replies from the platform administrator.
                      </p>
                    </div>
                  ) : (
                    queries.map((q) => (
                      <div
                        key={q._id}
                        className="p-4 rounded-xl border border-gray-200/90 bg-white shadow-2xs space-y-2.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-xs text-gray-900 truncate">{q.subject}</span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                              q.status === "resolved"
                                ? "bg-slate-100 text-slate-700"
                                : q.status === "replied"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-amber-50 text-amber-700 border border-amber-200"
                            }`}
                          >
                            {q.status}
                          </span>
                        </div>

                        <p className="text-xs text-gray-600 whitespace-pre-wrap leading-relaxed bg-gray-50/80 p-2.5 rounded-lg border border-gray-100">
                          {q.message}
                        </p>

                        <div className="flex items-center justify-between text-[10px] text-gray-400">
                          <span>Category: <strong className="text-gray-600 capitalize">{q.category?.replace("_", " ")}</strong></span>
                          <span>{new Date(q.createdAt).toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                        </div>

                        {/* Admin Reply Callout */}
                        {q.adminReply && (
                          <div className="mt-2 p-3 rounded-lg bg-emerald-50/80 border border-emerald-200/90 space-y-1">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-bold text-emerald-950 flex items-center gap-1.5">
                                <CheckCircle2 size={13} className="text-emerald-600" />
                                Reply from Platform Admin ({q.adminRepliedByName || "Support Team"}):
                              </span>
                              {q.adminRepliedAt && (
                                <span className="text-[10px] text-emerald-700">
                                  {new Date(q.adminRepliedAt).toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-emerald-900 whitespace-pre-wrap leading-relaxed">
                              {q.adminReply}
                            </p>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ═══════════════════════════════════════════════════════════════════
           SUPER ADMIN PLATFORM SETTINGS VIEW
        ═══════════════════════════════════════════════════════════════════ */
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-2xs">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
                <Info size={16} />
              </div>
              <h2 className="font-bold text-gray-900">Platform Configuration</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Platform Name</label>
                <input
                  type="text"
                  value={platformName}
                  onChange={(e) => setPlatformName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-gray-400 font-medium text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Support Email</label>
                <input
                  type="email"
                  value={supportEmail}
                  onChange={(e) => setSupportEmail(e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-gray-400 font-medium text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Support Phone</label>
                <input
                  type="text"
                  value={supportPhone}
                  onChange={(e) => setSupportPhone(e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-gray-400 font-medium text-sm"
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-2xs">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center text-purple-600">
                <Database size={16} />
              </div>
              <h2 className="font-bold text-gray-900">Database & Platform Ops</h2>
            </div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-sm text-gray-600 font-medium">Connected to MongoDB</span>
            </div>
            <p className="text-xs text-gray-500">System maintenance and platform operations are restricted to super administrators.</p>
          </div>
        </div>
      )}

      {saveError && (
        <div className="p-3 bg-red-50 text-red-600 rounded-xl text-xs font-semibold flex items-center gap-2">
          <AlertCircle size={14} /> {saveError}
        </div>
      )}

      {/* Save Button */}
      <div className="flex justify-end pt-2 pb-6">
        <button
          onClick={handleSave}
          disabled={saving}
          style={{ backgroundColor: saved ? "#059669" : themeColor }}
          className="px-10 py-3 font-bold text-white rounded-xl transition-all shadow-md hover:shadow-lg active:scale-95 flex items-center gap-2 cursor-pointer disabled:opacity-60"
        >
          {saving ? (
            <>
              <Loader2 size={16} className="animate-spin" /> Saving Changes...
            </>
          ) : saved ? (
            <>
              <CheckCircle2 size={16} /> Saved Successfully!
            </>
          ) : (
            "Save All Changes"
          )}
        </button>
      </div>
    </div>
  )
}
