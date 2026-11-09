"use client"

import { useState, useEffect } from "react"
import { Settings, Shield, Database, Info, Loader2, CheckCircle2, AlertCircle } from "lucide-react"

export default function SettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState("")

  // Global settings state
  const [platformName, setPlatformName] = useState("Progrentures Exam Platform")
  const [supportEmail, setSupportEmail] = useState("support@progrentures.com")
  const [supportPhone, setSupportPhone] = useState("+91 93094 70958")
  const [proctoring, setProctoring] = useState({
    faceDetection: true,
    tabSwitch: true,
    fullscreen: true,
    mobileFaceDetection: false,
    maxWarnings: 3,
  })

  // Password state
  const [passForm, setPassForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" })
  const [passwordError, setPasswordError] = useState("")
  const [passwordSuccess, setPasswordSuccess] = useState("")
  const [passwordChanging, setPasswordChanging] = useState(false)

  // Fetch settings on mount
  useEffect(() => {
    fetch("/api/admin/settings")
      .then(r => r.json())
      .then(data => {
        if (data.settings) {
          if (data.settings.platformName) setPlatformName(data.settings.platformName)
          if (data.settings.supportEmail) setSupportEmail(data.settings.supportEmail)
          if (data.settings.supportPhone) setSupportPhone(data.settings.supportPhone)
          if (data.settings.proctoring) {
            setProctoring({
              faceDetection: !!data.settings.proctoring.faceDetection,
              tabSwitch: !!data.settings.proctoring.tabSwitch,
              fullscreen: !!data.settings.proctoring.fullscreen,
              mobileFaceDetection: !!data.settings.proctoring.mobileFaceDetection,
              maxWarnings: data.settings.proctoring.maxWarnings || 3,
            })
          }
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setSaveError("")
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platformName,
          supportEmail,
          supportPhone,
          proctoring,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to save settings")
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err: any) {
      setSaveError(err.message || "Failed to save settings")
    } finally {
      setSaving(false)
    }
  }

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
        body: JSON.stringify({
          currentPassword: passForm.currentPassword,
          newPassword: passForm.newPassword,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setPasswordError(data.error || "Failed to update password")
      } else {
        setPasswordSuccess("Password updated successfully!")
        setPassForm({ currentPassword: "", newPassword: "", confirmPassword: "" })
      }
    } catch (err) {
      setPasswordError("An unexpected error occurred")
    } finally {
      setPasswordChanging(false)
    }
  }

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-primary">Settings</h1>
        {loading && (
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-400">
            <Loader2 size={14} className="animate-spin text-primary" /> Loading rules...
          </div>
        )}
      </div>

      <div className="space-y-6">
        {/* Platform Info */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                <Info size={16} className="text-blue-500" />
              </div>
              <h2 className="font-semibold text-primary">Platform Configuration</h2>
            </div>
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-gray-50 px-2 py-1 rounded border border-gray-100">
              General
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Platform Name</label>
              <input
                type="text"
                value={platformName}
                onChange={e => setPlatformName(e.target.value)}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all font-medium text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Support Email</label>
              <input
                type="email"
                value={supportEmail}
                onChange={e => setSupportEmail(e.target.value)}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all font-medium text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Support Phone</label>
              <input
                type="text"
                value={supportPhone}
                onChange={e => setSupportPhone(e.target.value)}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all font-medium text-sm"
              />
            </div>
          </div>
        </div>

        {/* Global Proctoring Rules */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                <Shield size={16} className="text-blue-500" />
              </div>
              <h2 className="font-semibold text-primary">Global Proctoring Rules</h2>
            </div>
            <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest bg-emerald-50 px-2 py-1 rounded border border-emerald-100">
              Active Security
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              {[
                { 
                  id: "face", 
                  label: "Face detection monitoring", 
                  checked: proctoring.faceDetection, 
                  onChange: (checked: boolean) => setProctoring(p => ({ ...p, faceDetection: checked })),
                  sub: "Requires camera verification & logs face absence/multiple faces during test"
                },
                { 
                  id: "tab", 
                  label: "Tab-switch prevention", 
                  checked: proctoring.tabSwitch, 
                  onChange: (checked: boolean) => setProctoring(p => ({ ...p, tabSwitch: checked })),
                  sub: "Monitors tab switching, window minimization & browser blur"
                },
                { 
                  id: "full", 
                  label: "Enforce fullscreen mode", 
                  checked: proctoring.fullscreen, 
                  onChange: (checked: boolean) => setProctoring(p => ({ ...p, fullscreen: checked })),
                  sub: "Enforces fullscreen exam session & logs fullscreen exits"
                },
                { 
                  id: "mobile", 
                  label: "Allow Mobile Face Detection", 
                  checked: proctoring.mobileFaceDetection, 
                  onChange: (checked: boolean) => setProctoring(p => ({ ...p, mobileFaceDetection: checked })),
                  sub: "Optimized mobile proctoring for mobile exams" 
                },
              ].map((item) => (
                <div key={item.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100">
                  <input
                    type="checkbox"
                    id={item.id}
                    checked={item.checked}
                    onChange={e => item.onChange(e.target.checked)}
                    className="mt-1 w-4 h-4 rounded border-gray-300 accent-primary cursor-pointer"
                  />
                  <label htmlFor={item.id} className="cursor-pointer">
                    <p className="text-sm font-semibold text-gray-800">{item.label}</p>
                    {item.sub && <p className="text-[11px] text-gray-400 font-medium">{item.sub}</p>}
                  </label>
                </div>
              ))}
            </div>
            
            <div className="bg-gray-50 rounded-xl p-5 border border-gray-100 space-y-4">
              <div className="space-y-1.5">
                <p className="text-sm font-bold text-primary">Auto-Submit Threshold</p>
                <p className="text-xs text-gray-500">Number of warnings before session is terminated.</p>
                <input
                  type="number"
                  value={proctoring.maxWarnings}
                  onChange={e => setProctoring(p => ({ ...p, maxWarnings: Math.max(1, parseInt(e.target.value) || 1) }))}
                  min={1}
                  max={20}
                  className="w-full mt-2 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-primary bg-white font-bold text-primary text-center"
                />
              </div>
              <div className="p-3 bg-blue-50/50 rounded-lg border border-blue-100">
                <p className="text-[11px] text-blue-700 font-medium leading-relaxed">
                  Notice: These global rules govern exam proctoring across the entire platform. Unticking a rule disables it immediately for all students.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Database & Advanced */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center">
              <Database size={16} className="text-purple-500" />
            </div>
            <h2 className="font-semibold text-primary">Database & Ops</h2>
          </div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-sm text-gray-600">Connected to MongoDB</span>
          </div>
          <p className="text-sm text-gray-500 mb-4">Export portal data or reset platform cache. These actions are restricted to super-admins.</p>
          <div className="flex gap-3">
             <button disabled className="px-4 py-2 bg-gray-100 text-gray-500 rounded-lg text-[11px] font-bold uppercase tracking-wider">Export JSON</button>
             <button disabled className="px-4 py-2 bg-gray-100 text-gray-500 rounded-lg text-[11px] font-bold uppercase tracking-wider">Clear Cache</button>
          </div>
        </div>

        {/* Change Admin Password */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center">
              <Shield size={16} className="text-amber-500" />
            </div>
            <h2 className="font-semibold text-primary">Change Admin Password</h2>
          </div>
          
          <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md">
            {passwordError && (
              <div className="p-3 bg-red-50 text-red-600 rounded-lg text-xs font-semibold flex items-center gap-2">
                <AlertCircle size={14} /> {passwordError}
              </div>
            )}
            {passwordSuccess && (
              <div className="p-3 bg-green-50 text-green-600 rounded-lg text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 size={14} /> {passwordSuccess}
              </div>
            )}
            
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Current Password</label>
              <input
                type="password"
                required
                value={passForm.currentPassword}
                onChange={e => setPassForm(f => ({ ...f, currentPassword: e.target.value }))}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-primary transition-all text-sm font-semibold"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">New Password</label>
              <input
                type="password"
                required
                value={passForm.newPassword}
                onChange={e => setPassForm(f => ({ ...f, newPassword: e.target.value }))}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-primary transition-all text-sm font-semibold"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Confirm New Password</label>
              <input
                type="password"
                required
                value={passForm.confirmPassword}
                onChange={e => setPassForm(f => ({ ...f, confirmPassword: e.target.value }))}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-primary transition-all text-sm font-semibold"
              />
            </div>
            
            <button
              type="submit"
              disabled={passwordChanging}
              className="px-6 py-2.5 bg-primary text-white text-xs font-bold rounded-lg uppercase tracking-wider hover:bg-accent transition-colors shadow-sm disabled:opacity-50"
            >
              {passwordChanging ? "Updating..." : "Update Password"}
            </button>
          </form>
        </div>
      </div>
      
      {saveError && (
        <div className="mt-4 p-3 bg-red-50 text-red-600 rounded-xl text-xs font-semibold flex items-center gap-2">
          <AlertCircle size={14} /> {saveError}
        </div>
      )}

      <div className="mt-8 flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className={`px-10 py-3 font-bold rounded-xl transition-all shadow-lg hover:shadow-xl active:scale-95 flex items-center gap-2 ${
            saved 
              ? "bg-emerald-600 text-white" 
              : "bg-primary text-white hover:bg-accent"
          } disabled:opacity-60`}
        >
          {saving ? (
            <>
              <Loader2 size={16} className="animate-spin" /> Saving Rules...
            </>
          ) : saved ? (
            <>
              <CheckCircle2 size={16} /> Global Rules Saved!
            </>
          ) : (
            "Save All Changes"
          )}
        </button>
      </div>
    </div>
  )
}
