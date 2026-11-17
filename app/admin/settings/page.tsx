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
  Shield,
  Trash2,
  Info,
  Database,
  Eye,
} from "lucide-react"
import { toast } from "sonner"

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

  // Super admin platform state
  const [platformName, setPlatformName] = useState("Progrentures Exam Platform")
  const [supportEmail, setSupportEmail] = useState("support@progrentures.com")
  const [supportPhone, setSupportPhone] = useState("+91 93094 70958")

  // Password change state
  const [passForm, setPassForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" })
  const [passwordError, setPasswordError] = useState("")
  const [passwordSuccess, setPasswordSuccess] = useState("")
  const [passwordChanging, setPasswordChanging] = useState(false)

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

  // Handle Password Change
  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError("")
    setPasswordSuccess("")

    if (passForm.newPassword !== passForm.confirmPassword) {
      setPasswordError("New passwords do not match")
      return
    }

    if (passForm.newPassword.length < 6) {
      setPasswordError("New password must be at least 6 characters long")
      return
    }

    setPasswordChanging(true)
    try {
      const res = await fetch("/api/admin/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          currentPassword: passForm.currentPassword,
          newPassword: passForm.newPassword,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setPasswordError(data.error || "Failed to update password")
        toast.error(data.error || "Failed to update password")
      } else {
        setPasswordSuccess("Password updated successfully!")
        toast.success("Password updated successfully!")
        setPassForm({ currentPassword: "", newPassword: "", confirmPassword: "" })
      }
    } catch {
      setPasswordError("An unexpected error occurred")
    } finally {
      setPasswordChanging(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8 max-w-5xl flex items-center justify-center min-h-[50vh]">
        <div className="flex items-center gap-3 text-sm font-semibold text-gray-500">
          <Loader2 size={18} className="animate-spin text-[#2D3A4A]" /> Loading settings...
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 sm:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            {isInstitute ? "Coaching Settings & Branding" : "Platform Settings"}
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            {isInstitute
              ? "Upload your coaching logo, customize brand theme color, and manage organization details."
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
           COACHING INSTITUTE SETTINGS VIEW
        ═══════════════════════════════════════════════════════════════════ */
        <div className="space-y-6">
          {/* 1. Brand Logo Upload Card */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-2xs">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs"
                  style={{ backgroundColor: themeColor }}
                >
                  <Building2 size={18} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">Coaching Institute Logo</h2>
                  <p className="text-xs text-gray-500">
                    Your logo replaces the default platform logo in your portal header and on all student exam screens.
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-bold text-blue-700 uppercase tracking-widest bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200/80">
                White-Label Branding
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              {/* Preview Box */}
              <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/60 min-h-[160px]">
                {logo ? (
                  <div className="space-y-3 text-center">
                    <div className="p-3 bg-white rounded-xl border border-gray-200 shadow-2xs inline-block">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={logo}
                        alt="Uploaded Coaching Logo"
                        className="max-h-20 max-w-[240px] w-auto object-contain mx-auto"
                      />
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        Active Brand Logo
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setLogo("")
                          if (fileInputRef.current) fileInputRef.current.value = ""
                          toast.info("Logo removed. Click 'Save All Changes' to confirm.")
                        }}
                        className="text-[11px] font-bold text-red-600 hover:text-red-700 hover:bg-red-50 px-2 py-0.5 rounded transition-colors inline-flex items-center gap-1 cursor-pointer"
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
              <div className="space-y-4">
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
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-xs font-bold shadow-sm hover:opacity-90 active:scale-95 transition-all cursor-pointer"
                    style={{ backgroundColor: themeColor }}
                  >
                    <Upload size={15} />
                    {logo ? "Upload / Replace Logo" : "Upload Coaching Logo"}
                  </label>
                  <p className="text-[11px] text-gray-400 leading-relaxed">
                    Recommended dimensions: <strong>300x80 px</strong> or higher. Transparent PNG or SVG yields best results across light headers.
                  </p>
                </div>

                <div className="p-3 bg-amber-50/80 rounded-xl border border-amber-200/70 text-[11px] text-amber-800 leading-relaxed">
                  <strong>Student Exam Visibility:</strong> When students open or submit tests created by your coaching, your logo will appear on their exam header instead of any platform branding.
                </div>
              </div>
            </div>
          </div>

          {/* 2. Brand Theme Color Customizer Card */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-2xs">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs"
                  style={{ backgroundColor: themeColor }}
                >
                  <Palette size={18} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">Theme & Brand Color</h2>
                  <p className="text-xs text-gray-500">
                    Customize your coaching portal and student exam accent colors to match your institute branding.
                  </p>
                </div>
              </div>
              <div
                className="flex items-center gap-2 px-3 py-1 rounded-lg border text-white text-xs font-mono font-bold shadow-2xs"
                style={{ backgroundColor: themeColor, borderColor: themeColor }}
              >
                <span>{themeColor}</span>
              </div>
            </div>

            {/* Presets Grid */}
            <div className="space-y-4 mb-6">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">
                Choose Brand Palette Preset
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-100 items-center">
              <div className="space-y-2">
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
              <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/50 space-y-3">
                <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  Live UI Element Preview
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className="px-3.5 py-1.5 rounded-lg text-white text-xs font-bold shadow-2xs"
                    style={{ backgroundColor: themeColor }}
                  >
                    Primary Button
                  </button>
                  <span
                    className="text-xs font-bold px-2.5 py-1 rounded-md text-white shadow-2xs"
                    style={{ backgroundColor: themeColor }}
                  >
                    Active Tab
                  </span>
                  <div
                    className="w-7 h-7 rounded-lg text-white flex items-center justify-center text-xs font-bold shadow-2xs"
                    style={{ backgroundColor: themeColor }}
                  >
                    A
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 3. Institute Contact & Profile Details Card */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-2xs">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
                <Info size={16} />
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900">Institute Profile & Contact</h2>
                <p className="text-xs text-gray-500">Official information shown on exam papers and printable copies.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Coaching / Institute Name</label>
                <input
                  type="text"
                  value={instituteName}
                  onChange={(e) => setInstituteName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-gray-400 font-semibold text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Official Email</label>
                <input
                  type="email"
                  disabled
                  value={email}
                  className="w-full px-4 py-2.5 bg-gray-100 border border-gray-200 rounded-xl font-medium text-sm text-gray-500 cursor-not-allowed"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Contact Phone</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 XXXXX XXXXX"
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-gray-400 font-medium text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Contact Person</label>
                <input
                  type="text"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  placeholder="Director / Coordinator"
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-gray-400 font-medium text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">City</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Pune, Mumbai, Delhi"
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-gray-400 font-medium text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Address</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Branch / Campus Address"
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-gray-400 font-medium text-sm"
                />
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

      {/* 4. Change Account Password Card */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-2xs">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center text-amber-600">
            <Shield size={16} />
          </div>
          <div>
            <h2 className="font-bold text-gray-900">Change Account Password</h2>
            <p className="text-xs text-gray-500">Update your login security credentials.</p>
          </div>
        </div>

        <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md">
          {passwordError && (
            <div className="p-3 bg-red-50 text-red-600 rounded-xl text-xs font-semibold flex items-center gap-2">
              <AlertCircle size={14} /> {passwordError}
            </div>
          )}
          {passwordSuccess && (
            <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-semibold flex items-center gap-2 border border-emerald-200">
              <CheckCircle2 size={14} /> {passwordSuccess}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Current Password</label>
            <input
              type="password"
              required
              value={passForm.currentPassword}
              onChange={(e) => setPassForm((f) => ({ ...f, currentPassword: e.target.value }))}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-gray-400 text-sm font-semibold"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">New Password</label>
            <input
              type="password"
              required
              value={passForm.newPassword}
              onChange={(e) => setPassForm((f) => ({ ...f, newPassword: e.target.value }))}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-gray-400 text-sm font-semibold"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Confirm New Password</label>
            <input
              type="password"
              required
              value={passForm.confirmPassword}
              onChange={(e) => setPassForm((f) => ({ ...f, confirmPassword: e.target.value }))}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-gray-400 text-sm font-semibold"
            />
          </div>

          <button
            type="submit"
            disabled={passwordChanging}
            style={{ backgroundColor: themeColor }}
            className="px-6 py-2.5 text-white text-xs font-bold rounded-xl uppercase tracking-wider hover:opacity-90 transition-all shadow-xs disabled:opacity-50 cursor-pointer"
          >
            {passwordChanging ? "Updating..." : "Update Password"}
          </button>
        </form>
      </div>

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
