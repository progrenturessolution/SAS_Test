"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  Building2,
  Users,
  FileText,
  BarChart2,
  CheckCircle2,
  ArrowRight,
  Shield,
  Layers,
  Sparkles,
  PlayCircle,
  HelpCircle,
} from "lucide-react"

export default function SuperAdminOverviewPage() {
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((r) => r.json())
      .then((d) => setStats(d))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="p-6 sm:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-gray-100">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
            <Shield className="w-3.5 h-3.5 text-amber-500" />
            <span>Super Admin Platform Headquarters</span>
          </div>
          <h1 className="text-2xl font-bold text-[#45505F]">Platform Overview & Metrics</h1>
          <p className="text-xs text-gray-500 mt-1">
            Real-time aggregate data across all registered coaching centers and academic institutions.
          </p>
        </div>

        <Link
          href="/admin/institutes"
          className="px-4 py-2.5 rounded-lg bg-[#2D3A4A] hover:bg-[#1e2a38] text-white text-xs font-semibold shadow-sm flex items-center gap-2 transition-all"
        >
          <Building2 className="w-4 h-4" />
          <span>Manage Coaching Institutes</span>
        </Link>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl bg-white border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between text-gray-400 text-xs font-medium mb-1">
            <span>Registered Institutes</span>
            <Building2 className="w-4 h-4 text-[#2D3A4A]" />
          </div>
          <div className="text-3xl font-bold text-[#2D3A4A]">
            {stats?.totalInstitutes ?? "—"}
          </div>
          <span className="text-[11px] text-emerald-600 font-medium">
            {stats?.activeInstitutes ?? 0} Active Subscriptions
          </span>
        </div>

        <div className="p-5 rounded-xl bg-white border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between text-gray-400 text-xs font-medium mb-1">
            <span>Total Enrolled Students</span>
            <Users className="w-4 h-4 text-[#2D3A4A]" />
          </div>
          <div className="text-3xl font-bold text-[#2D3A4A]">
            {stats?.studentsEnrolled ?? "—"}
          </div>
          <span className="text-[11px] text-gray-400">Across all coaching batches</span>
        </div>

        <div className="p-5 rounded-xl bg-white border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between text-gray-400 text-xs font-medium mb-1">
            <span>Platform Tests Created</span>
            <FileText className="w-4 h-4 text-[#2D3A4A]" />
          </div>
          <div className="text-3xl font-bold text-[#2D3A4A]">
            {stats?.totalExams ?? "—"}
          </div>
          <span className="text-[11px] text-emerald-600 font-medium">
            +{stats?.examsThisMonth ?? 0} this month
          </span>
        </div>

        <div className="p-5 rounded-xl bg-white border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between text-gray-400 text-xs font-medium mb-1">
            <span>Total Test Submissions</span>
            <BarChart2 className="w-4 h-4 text-[#2D3A4A]" />
          </div>
          <div className="text-3xl font-bold text-[#2D3A4A]">
            {stats?.totalAttempts ?? "—"}
          </div>
          <span className="text-[11px] text-gray-400">Total student attempt records</span>
        </div>
      </div>

      {/* Quick Action Panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-6 rounded-2xl bg-white border border-gray-200 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <div className="w-10 h-10 rounded-xl bg-gray-100 text-[#2D3A4A] flex items-center justify-center mb-3">
              <Building2 className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-[#45505F] mb-1">
              Coaching Institutes Directory
            </h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              Register new academies, adjust student limits, configure exam limits, and control feature permissions for each institute.
            </p>
          </div>
          <Link
            href="/admin/institutes"
            className="inline-flex items-center gap-2 text-xs font-bold text-[#2D3A4A] hover:underline"
          >
            <span>Open Coaching Directory</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="p-6 rounded-2xl bg-white border border-gray-200 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <div className="w-10 h-10 rounded-xl bg-gray-100 text-[#2D3A4A] flex items-center justify-center mb-3">
              <Shield className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-[#45505F] mb-1">
              Global Platform Security & Proctoring
            </h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              Configure default AI proctoring rules, face detection thresholds, tab switch violations, and platform contact settings.
            </p>
          </div>
          <Link
            href="/admin/settings"
            className="inline-flex items-center gap-2 text-xs font-bold text-[#2D3A4A] hover:underline"
          >
            <span>Platform Settings</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  )
}
