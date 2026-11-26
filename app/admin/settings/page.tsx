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
  Mail,
  Phone,
  HelpCircle,
  ExternalLink,
  User,
  KeyRound,
  Eye,
  EyeOff,
  Copy,
  Lock,
  Shield,
  MapPin,
} from "lucide-react"
import Link from "next/link"
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
  const [canEditLogo, setCanEditLogo] = useState(true)
  const [canEditThemeColor, setCanEditThemeColor] = useState(true)

  // Credentials & Password state for organization
  const [adminPassword, setAdminPassword] = useState("")
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [newPassword, setNewPassword] = useState("")
  const [confirmNewPassword, setConfirmNewPassword] = useState("")
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false)
  const [updatingPassword, setUpdatingPassword] = useState(false)

  // Super admin platform state
  const [platformName, setPlatformName] = useState("Progrentures Exam Platform")
  const [supportEmail, setSupportEmail] = useState("support@progrentures.com")
  const [supportPhone, setSupportPhone] = useState("+91 93094 70958")

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
          setAdminPassword(data.institute.adminPassword || "")
          if (data.institute.validUntil) setValidUntil(data.institute.validUntil)
          if (data.institute.status) setStatus(data.institute.status)
          if (data.institute.limits) setLimits(data.institute.limits)
          setCanEditLogo(
            data.permissions?.canEditLogo !== undefined
              ? Boolean(data.permissions.canEditLogo)
              : data.institute.limits?.features?.customLogo !== false
          )
          setCanEditThemeColor(
            data.permissions?.canEditThemeColor !== undefined
              ? Boolean(data.permissions.canEditThemeColor)
              : data.institute.limits?.features?.customThemeColor !== false
          )
          const color = data.institute.themeColor || "#2D3A4A"
          setThemeColor(color)
          document.documentElement.style.setProperty("--primary", color)
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

  // Handle Password Update for Coaching Institute
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPassword || newPassword.trim().length < 6) {
      toast.error("New password must be at least 6 characters long.")
      return
    }
    if (newPassword !== confirmNewPassword) {
      toast.error("New password and confirmation do not match.")
      return
    }

    setUpdatingPassword(true)
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ newPassword: newPassword.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to update password")

      setAdminPassword(newPassword.trim())
      setNewPassword("")
      setConfirmNewPassword("")
      toast.success("Portal password updated successfully! Super Admin view has also been updated.")
    } catch (err: any) {
      toast.error(err.message || "Failed to update password")
    } finally {
      setUpdatingPassword(false)
    }
  }

  // Handle Logo Upload
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canEditLogo) {
      toast.error("Custom Logo editing is disabled by your Platform Administrator.")
      return
    }
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
      toast.success("Logo uploaded! Click 'Save Logo & Colour Changes' to apply.")
    }
    reader.readAsDataURL(file)
  }

  // Handle Save
  const handleSave = async () => {
    if (isInstitute && !canEditLogo && !canEditThemeColor) {
      toast.error("Branding changes are locked by your Platform Administrator.")
      return
    }
    setSaving(true)
    setSaveError("")
    try {
      const payload = isInstitute
        ? {
            ...(canEditLogo ? { logo } : {}),
            ...(canEditThemeColor ? { themeColor } : {}),
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
              ? "Upload your coaching logo and customize the brand theme color across your portal and aspirant exams."
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
                  <span className="text-gray-400 block text-[11px]">Max Aspirants</span>
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

          {/* 2. Organization Details Card (Not Changeable) */}
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
                  <h2 className="text-base sm:text-lg font-bold text-gray-900">
                    Organization Details
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Registered profile information managed by the platform administrator.
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-full border border-slate-200 w-fit">
                <Lock size={12} className="text-slate-500" />
                Not Changeable
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="p-3.5 rounded-xl border border-gray-200/80 bg-gray-50/70 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                  <Building2 size={11} /> Organization Name
                </span>
                <p className="text-xs sm:text-sm font-semibold text-gray-800 break-words">
                  {instituteName || "—"}
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-gray-200/80 bg-gray-50/70 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                  <User size={11} /> Contact Person Name
                </span>
                <p className="text-xs sm:text-sm font-semibold text-gray-800 break-words">
                  {contactPerson || "—"}
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-gray-200/80 bg-gray-50/70 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                  <Phone size={11} /> Mobile Number
                </span>
                <p className="text-xs sm:text-sm font-semibold text-gray-800 break-words">
                  {phone || "—"}
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-gray-200/80 bg-gray-50/70 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                  <Mail size={11} /> Email
                </span>
                <p className="text-xs sm:text-sm font-semibold text-gray-800 break-all">
                  {email || "—"}
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-gray-200/80 bg-gray-50/70 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                  <MapPin size={11} /> City
                </span>
                <p className="text-xs sm:text-sm font-semibold text-gray-800 break-words">
                  {city || "—"}
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-gray-200/80 bg-gray-50/70 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                  <MapPin size={11} /> Address
                </span>
                <p className="text-xs sm:text-sm font-semibold text-gray-800 break-words">
                  {address || "—"}
                </p>
              </div>
            </div>
          </div>

          {/* 3. Change Logo Card */}
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
                  <h2 className="text-base sm:text-lg font-bold text-gray-900">Change Logo</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Your logo replaces the default platform logo in your portal header and on all aspirant exam screens.
                  </p>
                </div>
              </div>
              {canEditLogo ? (
                <span className="text-[10px] font-bold text-slate-700 uppercase tracking-widest bg-slate-100 px-3 py-1 rounded-full border border-slate-200 w-fit">
                  White-Label Branding
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-800 bg-amber-50 px-3 py-1 rounded-full border border-amber-200 w-fit">
                  <Lock size={12} /> Locked by Admin
                </span>
              )}
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
                      {canEditLogo && (
                        <button
                          type="button"
                          onClick={() => {
                            setLogo("")
                            if (fileInputRef.current) fileInputRef.current.value = ""
                            toast.info("Logo removed. Click 'Save Logo & Colour Changes' to confirm.")
                          }}
                          className="text-[11px] font-bold text-red-600 hover:text-red-700 hover:bg-red-50 px-2.5 py-0.5 rounded transition-colors inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 size={12} /> Remove
                        </button>
                      )}
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
                  disabled={!canEditLogo}
                  className="hidden"
                  id="logo-upload-input"
                />

                <div className="space-y-2">
                  {canEditLogo ? (
                    <label
                      htmlFor="logo-upload-input"
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white text-xs sm:text-sm font-bold shadow-sm hover:opacity-90 active:scale-95 transition-all cursor-pointer"
                      style={{ backgroundColor: themeColor }}
                    >
                      <Upload size={16} />
                      {logo ? "Upload / Replace Logo" : "Upload Coaching Logo"}
                    </label>
                  ) : (
                    <div className="space-y-2">
                      <button
                        type="button"
                        disabled
                        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gray-100 text-gray-400 border border-gray-200 text-xs sm:text-sm font-bold cursor-not-allowed"
                      >
                        <Lock size={15} />
                        <span>Logo Upload Locked</span>
                      </button>
                      <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200 text-xs text-amber-800 flex items-start gap-2">
                        <Lock size={14} className="text-amber-600 shrink-0 mt-0.5" />
                        <span>
                          Custom Logo permission is disabled for your organization. Contact your Platform Administrator to allow logo changes.
                        </span>
                      </div>
                    </div>
                  )}
                  <p className="text-[11px] text-gray-400 leading-relaxed">
                    Recommended dimensions: <strong>300x80 px</strong> or higher. Transparent PNG or SVG yields best results across light headers.
                  </p>
                </div>

                <div className="p-3.5 bg-amber-50/80 rounded-xl border border-amber-200/70 text-xs text-amber-800 leading-relaxed">
                  <strong>Aspirant Exam Visibility:</strong> When aspirants open or submit tests created by your coaching, your logo will appear on their exam header instead of any platform branding.
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
                  <h2 className="text-base sm:text-lg font-bold text-gray-900">Change Colour</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Customize your coaching portal and aspirant exam accent colors to match your institute branding.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 w-fit">
                {!canEditThemeColor && (
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-800 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
                    <Lock size={12} /> Locked by Admin
                  </span>
                )}
                <div
                  className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-white text-xs font-mono font-bold shadow-2xs w-fit"
                  style={{ backgroundColor: themeColor, borderColor: themeColor }}
                >
                  <span>{themeColor}</span>
                </div>
              </div>
            </div>

            {!canEditThemeColor && (
              <div className="mb-5 p-3 rounded-xl bg-amber-50/80 border border-amber-200 text-xs text-amber-800 flex items-start gap-2">
                <Lock size={14} className="text-amber-600 shrink-0 mt-0.5" />
                <span>
                  Theme Color customization is locked for your organization. You can view your current theme preview below, and contact Platform Administrator to allow changes.
                </span>
              </div>
            )}

            {/* Presets Grid - Wide 8 Columns on Large Screens */}
            <div className={`space-y-3 mb-6 ${!canEditThemeColor ? "opacity-65" : ""}`}>
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
                      disabled={!canEditThemeColor}
                      onClick={() => {
                        if (!canEditThemeColor) return
                        setThemeColor(preset.hex)
                      }}
                      className={`p-3 rounded-xl border text-left transition-all relative ${
                        !canEditThemeColor
                          ? "cursor-not-allowed bg-gray-50/60 border-gray-200"
                          : isSelected
                          ? "border-gray-900 ring-2 ring-gray-900/10 shadow-xs bg-gray-50/50 cursor-pointer"
                          : "border-gray-200 hover:border-gray-300 bg-white cursor-pointer"
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
              <div className={`lg:col-span-6 space-y-2 ${!canEditThemeColor ? "opacity-65" : ""}`}>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">
                  Or Pick Custom Hex Color
                </label>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <input
                      type="color"
                      disabled={!canEditThemeColor}
                      value={themeColor}
                      onChange={(e) => {
                        if (!canEditThemeColor) return
                        setThemeColor(e.target.value)
                      }}
                      className={`w-12 h-11 rounded-xl border border-gray-200 p-1 bg-white shadow-2xs ${
                        canEditThemeColor ? "cursor-pointer" : "cursor-not-allowed opacity-70"
                      }`}
                    />
                  </div>
                  <input
                    type="text"
                    disabled={!canEditThemeColor}
                    value={themeColor}
                    onChange={(e) => {
                      if (!canEditThemeColor) return
                      const val = e.target.value
                      if (val.startsWith("#") && val.length <= 7) setThemeColor(val)
                      else if (!val.startsWith("#") && val.length <= 6) setThemeColor("#" + val)
                    }}
                    placeholder="#2D3A4A"
                    className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl font-mono text-sm font-bold text-gray-800 focus:outline-none focus:border-gray-400 disabled:cursor-not-allowed disabled:bg-gray-100/80"
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

            {saveError && (
              <div className="mt-5 p-3 bg-red-50 text-red-600 rounded-xl text-xs font-semibold flex items-center gap-2">
                <AlertCircle size={14} /> {saveError}
              </div>
            )}

            <div className="flex items-center justify-end pt-5 mt-5 border-t border-gray-100">
              {!canEditLogo && !canEditThemeColor ? (
                <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold">
                  <Lock size={14} className="text-amber-600 shrink-0" />
                  <span>Logo &amp; Theme Color customization are locked by your Platform Administrator</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  style={{ backgroundColor: saved ? "#059669" : themeColor }}
                  className="px-8 py-2.5 text-xs sm:text-sm font-bold text-white rounded-xl transition-all shadow-md hover:shadow-lg active:scale-95 flex items-center gap-2 cursor-pointer disabled:opacity-60"
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
                    "Save Logo & Colour Changes"
                  )}
                </button>
              )}
            </div>
          </div>

          {/* 5. Password Change Section */}
          <div className="bg-white rounded-2xl border border-gray-200/90 p-6 sm:p-8 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs"
                  style={{ backgroundColor: themeColor }}
                >
                  <KeyRound size={20} />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-gray-900">
                    Password Change
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    View your organization login credentials and update your account password.
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-bold text-slate-700 uppercase tracking-widest bg-slate-100 px-3 py-1 rounded-full border border-slate-200 w-fit">
                Login Access & Security
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
              {/* Left Column: Organization Login Credentials Display */}
              <div className="lg:col-span-6 space-y-4">
                <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                  <Shield size={16} style={{ color: themeColor }} />
                  <span>Current Portal Credentials</span>
                </h3>

                <div className="space-y-3">
                  {/* Email */}
                  <div className="p-3.5 rounded-xl border border-gray-200/90 bg-gray-50/60 shadow-2xs space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
                      Login Email Address
                    </span>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-xs text-gray-900 font-mono truncate select-all">
                        {email || "Not specified"}
                      </span>
                      {email && (
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(email)
                            toast.success("Login email copied to clipboard!")
                          }}
                          className="p-1.5 text-gray-400 hover:text-[#324158] hover:bg-white rounded-lg transition-colors shadow-2xs shrink-0 cursor-pointer"
                          title="Copy Email"
                        >
                          <Copy size={13} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Portal Code */}
                  <div className="p-3.5 rounded-xl border border-gray-200/90 bg-gray-50/60 shadow-2xs space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
                      Organization Portal Code
                    </span>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-bold text-xs text-[#324158] bg-[#eaf0f8] px-2 py-0.5 rounded-md select-all">
                        {instituteCode || "ID"}
                      </span>
                      {instituteCode && (
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(instituteCode)
                            toast.success("Organization code copied!")
                          }}
                          className="p-1.5 text-gray-400 hover:text-[#324158] hover:bg-white rounded-lg transition-colors shadow-2xs shrink-0 cursor-pointer"
                          title="Copy Code"
                        >
                          <Copy size={13} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Password with Eye Toggle */}
                  <div className="p-3.5 rounded-xl border border-gray-200/90 bg-gray-50/60 shadow-2xs space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
                      Current Portal Password
                    </span>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-semibold text-xs text-gray-900 select-all">
                        {adminPassword ? (
                          showCurrentPassword ? adminPassword : "••••••••••••"
                        ) : (
                          <span className="text-gray-400 italic font-normal text-xs">•••••••• (Set new password below)</span>
                        )}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        {adminPassword && (
                          <button
                            type="button"
                            onClick={() => setShowCurrentPassword((prev) => !prev)}
                            className="p-1.5 text-gray-400 hover:text-[#324158] hover:bg-white rounded-lg transition-colors shadow-2xs cursor-pointer"
                            title={showCurrentPassword ? "Hide password" : "Show password"}
                          >
                            {showCurrentPassword ? <EyeOff size={14} /> : <Eye size={14} className="text-[#324158]" />}
                          </button>
                        )}
                        {adminPassword && (
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(adminPassword)
                              toast.success("Password copied to clipboard!")
                            }}
                            className="p-1.5 text-gray-400 hover:text-[#324158] hover:bg-white rounded-lg transition-colors shadow-2xs cursor-pointer"
                            title="Copy Password"
                          >
                            <Copy size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200/80 text-[11px] text-blue-800 leading-relaxed flex items-start gap-2">
                  <Info size={15} className="text-blue-600 mt-0.5 shrink-0" />
                  <p>
                    These credentials are used by your coaching administration to sign in. Any password change will immediately update across your account and reflect on the Super Admin organization details.
                  </p>
                </div>
              </div>

              {/* Right Column: Change Password Form */}
              <div className="lg:col-span-6 space-y-4">
                <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                  <Lock size={16} style={{ color: themeColor }} />
                  <span>Change Portal Password</span>
                </h3>

                <form onSubmit={handleUpdatePassword} className="space-y-3.5">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-600 block">
                      New Password *
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? "text" : "password"}
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter new portal password"
                        className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-gray-200 text-xs font-medium bg-gray-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2D3A4A]/10 focus:border-[#2D3A4A] transition-all font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword((prev) => !prev)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 cursor-pointer"
                        title={showNewPassword ? "Hide password" : "Show password"}
                      >
                        {showNewPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-600 block">
                      Confirm New Password *
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmNewPassword ? "text" : "password"}
                        required
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                        placeholder="Re-enter new password to confirm"
                        className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-gray-200 text-xs font-medium bg-gray-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2D3A4A]/10 focus:border-[#2D3A4A] transition-all font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmNewPassword((prev) => !prev)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 cursor-pointer"
                        title={showConfirmNewPassword ? "Hide password" : "Show password"}
                      >
                        {showConfirmNewPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>

                  <p className="text-[11px] text-gray-400">
                    Password must be at least 6 characters long.
                  </p>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={updatingPassword || !newPassword || newPassword.length < 6 || newPassword !== confirmNewPassword}
                      style={{ backgroundColor: themeColor }}
                      className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs font-bold text-white shadow-xs hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {updatingPassword ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          <span>Updating Password...</span>
                        </>
                      ) : (
                        <>
                          <KeyRound size={14} />
                          <span>Update Portal Password</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
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

      {/* Super Admin Save Button */}
      {!isInstitute && (
        <>
          {saveError && (
            <div className="p-3 bg-red-50 text-red-600 rounded-xl text-xs font-semibold flex items-center gap-2">
              <AlertCircle size={14} /> {saveError}
            </div>
          )}
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
        </>
      )}
    </div>
  )
}
