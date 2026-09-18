"use client"

import { useState } from "react"
import { Settings, Shield, Database, Info } from "lucide-react"

export default function SettingsPage() {
  const [saved, setSaved] = useState(false)
  const [passForm, setPassForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" })
  const [passwordError, setPasswordError] = useState("")
  const [passwordSuccess, setPasswordSuccess] = useState("")
  const [passwordChanging, setPasswordChanging] = useState(false)

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
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
      <h1 className="text-2xl font-bold text-primary mb-6">Settings</h1>

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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
            <div className="space-y-1.5">
              <p className="text-gray-500 font-medium">Platform Name</p>
              <input
                defaultValue="Progrentures Testro Lab"
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all font-medium"
              />
            </div>
            <div className="space-y-1.5">
              <p className="text-gray-500 font-medium">Tagline</p>
              <input
                defaultValue="Where Skills Are Truly Measured."
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all font-medium"
              />
            </div>
            <div className="space-y-1.5">
              <p className="text-gray-500 font-medium">Support Email</p>
              <input
                defaultValue="support@progrentures.com"
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all font-medium"
              />
            </div>
            <div className="space-y-1.5">
              <p className="text-gray-500 font-medium">Contact WhatsApp</p>
              <input
                defaultValue="+91 93094 70958"
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all font-medium"
              />
            </div>
          </div>
          
          <div className="mt-8 pt-6 border-t border-gray-100">
            <p className="text-sm text-gray-500 font-medium mb-3">Platform Logo</p>
            <div className="flex items-center gap-6">
              <div className="w-24 h-24 bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center text-gray-400 group hover:border-primary hover:text-primary transition-all cursor-pointer">
                <Settings size={24} className="group-hover:rotate-45 transition-transform" />
                <span className="text-[10px] mt-1 font-bold">CHANGE</span>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-primary">Upload New Logo</p>
                <p className="text-xs text-gray-400">Recommend size: 256x256. PNG or SVG preferred.</p>
                <button className="mt-2 px-4 py-1.5 bg-primary text-white text-[11px] font-bold rounded uppercase tracking-wider hover:bg-accent transition-colors shadow-sm">
                  Choose File
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Proctoring Defaults */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                <Shield size={16} className="text-blue-500" />
              </div>
              <h2 className="font-semibold text-primary">Global Proctoring Rules</h2>
            </div>
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-gray-50 px-2 py-1 rounded border border-gray-100">
              Security
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              {[
                { id: "face", label: "Face detection monitoring", defaultChecked: true },
                { id: "tab", label: "Tab-switch prevention", defaultChecked: true },
                { id: "full", label: "Enforce fullscreen mode", defaultChecked: true },
                { id: "mobile", label: "Allow Mobile Face Detection", defaultChecked: false, sub: "Beta feature for optimized mobile proctoring" },
              ].map((item) => (
                <div key={item.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                  <input
                    type="checkbox"
                    id={item.id}
                    defaultChecked={item.defaultChecked}
                    className="mt-1 w-4 h-4 rounded border-gray-300 accent-primary"
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
                  defaultValue={3}
                  min={1}
                  max={10}
                  className="w-full mt-2 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-primary bg-white font-bold text-primary text-center"
                />
              </div>
              <div className="p-3 bg-blue-50/50 rounded-lg border border-blue-100">
                <p className="text-[11px] text-blue-700 font-medium leading-relaxed">
                  Note: These settings are used as defaults for new exams. Individual exams can still override these rules.
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
              <div className="p-3 bg-red-50 text-red-600 rounded-lg text-xs font-semibold">
                {passwordError}
              </div>
            )}
            {passwordSuccess && (
              <div className="p-3 bg-green-50 text-green-600 rounded-lg text-xs font-semibold">
                {passwordSuccess}
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
      
      <div className="mt-8 flex justify-end">
        <button
          onClick={handleSave}
          className="px-10 py-3 bg-primary text-white font-bold rounded-xl hover:bg-accent transition-all shadow-lg hover:shadow-xl active:scale-95"
        >
          {saved ? "Configurations Saved!" : "Save All Changes"}
        </button>
      </div>
    </div>
  )
}
