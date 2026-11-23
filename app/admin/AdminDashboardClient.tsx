"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Eye, Pencil, Trash2, Link2, BarChart2, UserCheck, FileText, PlayCircle, HelpCircle, Users, Building2, ShieldAlert, Lock, Calendar, AlertCircle } from "lucide-react"
import { ExamActionMenu } from "@/components/ExamActionMenu"
import { toast } from "sonner"
import { getExamEditUrl } from "@/lib/examEditHelper"
import { formatDateDDMMYYYY } from "@/lib/utils"

interface Stats {
  isSuperAdmin?: boolean
  institute?: {
    id: string
    name: string
    code: string
    status: string
    validUntil?: string | null
    maxStudents: number
    maxExams: number
    features?: any
  }
  totalExams: number
  activeExams: number
  totalQuestions: number
  studentsEnrolled: number
  examsThisMonth: number
  studentsThisMonth: number
}

interface Exam {
  _id: string
  title: string
  subject: string
  class?: string
  sections: { questions: unknown[] }[]
  duration: number
  status: string
  createdAt: string
  examType?: string
}

export default function AdminDashboardClient() {
  const router = useRouter()
  const [stats, setStats] = useState<Stats | null>(null)
  const [exams, setExams] = useState<Exam[]>([])
  const [search, setSearch] = useState("")
  const [copied, setCopied] = useState<string | null>(null)
  const [copiedPublic, setCopiedPublic] = useState<string | null>(null)
  const [hasExamAccess, setHasExamAccess] = useState(true)
  const [isExamQuotaReached, setIsExamQuotaReached] = useState(false)
  const [maxExams, setMaxExams] = useState(20)
  const [examCount, setExamCount] = useState(0)

  useEffect(() => {
    fetch("/api/admin/institute-access", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        setHasExamAccess(d.hasExamAccess !== false)
        setIsExamQuotaReached(Boolean(d.isExamQuotaReached))
        if (d.maxExams !== undefined) setMaxExams(Number(d.maxExams))
        if (d.examCount !== undefined) setExamCount(Number(d.examCount))
      })
      .catch(() => {})

    fetch("/api/admin/stats")
      .then((r) => {
        if (r.status === 401 || r.status === 403) {
          router.replace("/institute/login")
          return null
        }
        return r.json()
      })
      .then((d) => {
        if (!d) return
        setStats(d)
        if (d.isSuperAdmin) {
          router.replace("/admin/institutes")
        }
      })
      .catch(() => {
        router.replace("/institute/login")
      })
    fetch("/api/exams").then((r) => r.json()).then((d) => setExams(d.exams || []))
  }, [router])

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "active" ? "draft" : "active"
    setExams((prev) => prev.map((e) => e._id === id ? { ...e, status: newStatus } : e))
    try {
      await fetch(`/api/exams/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
    } catch (error) {
      console.error("Failed to toggle status:", error)
      setExams((prev) => prev.map((e) => e._id === id ? { ...e, status: currentStatus } : e))
      throw error
    }
  }

  const handleShare = async (id: string, email: string) => {
    try {
      const res = await fetch(`/api/exams/${id}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to share")
    } catch (err: any) {
      throw err
    }
  }

  const handleDelete = async (id: string) => {
    await fetch(`/api/exams/${id}`, { method: "DELETE" })
    setExams((prev) => prev.filter((e) => e._id !== id))
  }

  const handleCopyLink = (id: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/exam/${id}`)
    setCopied(id)
    toast.success("Exam link copied to clipboard")
    setTimeout(() => setCopied(null), 2000)
  }

  const handleCopyPublic = (id: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/exam/${id}?type=public`)
    setCopiedPublic(id)
    toast.success("Public exam link copied! Anyone can take this exam without institute login.")
    setTimeout(() => setCopiedPublic(null), 2000)
  }

  const totalQuestions = (exam: Exam) =>
    exam.sections?.reduce((sum, sec) => sum + (sec.questions?.length || 0), 0) || 0

  const filtered = exams.filter(
    (e) =>
      e.title.toLowerCase().includes(search.toLowerCase()) ||
      e.subject.toLowerCase().includes(search.toLowerCase())
  )

  const statusColor = (s: string) => {
    if (s === "active") return "bg-[#eaf0f8] text-[#324158] border border-[#cbd5e1] font-semibold"
    if (s === "draft") return "bg-amber-50 text-amber-800 border border-amber-200 font-semibold"
    return "bg-slate-100 text-slate-700 border border-slate-200 font-medium"
  }

  const effectiveQuotaReached = isExamQuotaReached || Boolean(stats?.institute?.maxExams && (stats?.totalExams ?? 0) >= stats.institute.maxExams)
  const effectiveMaxExams = stats?.institute?.maxExams ?? maxExams
  const effectiveExamCount = stats?.totalExams ?? examCount
  const quotaReachedMessage = `Exam Limit Reached: Your organization has reached the limit of ${effectiveMaxExams} exams (${effectiveExamCount}/${effectiveMaxExams} used). Contact administrator to increase your exam quota.`

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-primary tracking-tight">Exam Management</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">Manage, monitor and publish your institute's exams</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3">
          <div className="relative flex-1 sm:w-64">
            <input
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:border-[#324158] shadow-xs"
              placeholder="Search exams..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <div className="relative group">
            {!effectiveQuotaReached && hasExamAccess ? (
              <Link
                href="/admin/exams/create"
                className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:opacity-90 shadow-sm transition-all text-center whitespace-nowrap block cursor-pointer"
              >
                + Create Exam
              </Link>
            ) : (
              <button
                type="button"
                onClick={() =>
                  toast.error(
                    effectiveQuotaReached
                      ? quotaReachedMessage
                      : "Access Restricted: You do not have permission to create Exams. Contact administrator."
                  )
                }
                className="px-4 py-2 bg-gray-100 text-gray-400 border border-gray-200 rounded-lg text-sm font-medium text-center whitespace-nowrap flex items-center gap-1.5 cursor-not-allowed"
              >
                <Lock size={14} className="text-gray-400" />
                <span>+ Create Exam</span>
              </button>
            )}
            {(effectiveQuotaReached || !hasExamAccess) && (
              <div className="pointer-events-none absolute right-0 top-full mt-2 z-50 hidden group-hover:flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-[#1E293B] px-3 py-1.5 text-xs text-white shadow-xl border border-gray-700 animate-in fade-in duration-150">
                <Lock size={12} className="text-amber-400 shrink-0" />
                <span>
                  {effectiveQuotaReached
                    ? `Exam Limit Reached: ${effectiveExamCount}/${effectiveMaxExams} exams used. Contact administrator.`
                    : "Access Restricted: You do not have permission to create Exams."}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Exam Quota Reached Alert */}
      {effectiveQuotaReached && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs sm:text-sm flex items-start gap-3 shadow-xs">
          <Lock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-bold text-amber-950">
              Exam Quota Reached ({effectiveExamCount} / {effectiveMaxExams} exams used)
            </p>
            <p className="text-amber-800 text-xs mt-0.5">
              Your institute has reached the maximum allowed exam creation limit. Creating new exams is locked. Please contact your platform administrator to increase your exam quota.
            </p>
          </div>
        </div>
      )}

      {/* Subscription Expired Alert */}
      {stats?.institute?.validUntil && new Date(stats.institute.validUntil).getTime() < Date.now() && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs sm:text-sm flex items-start gap-3 shadow-xs">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-red-900">Subscription Expired</p>
            <p className="text-red-700 mt-0.5">
              Your organization subscription expired on{" "}
              <strong>{formatDateDDMMYYYY(stats.institute.validUntil)}</strong>. Exam creation and testing modules are paused. Please contact platform support or administrator to renew.
            </p>
          </div>
        </div>
      )}

      {/* Organization Plan & Limits Banner */}
      {stats?.institute && (
        <div className="p-4 rounded-xl bg-white border border-gray-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#324158]">
                {stats.institute.name}
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200">
                {stats.institute.code}
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                stats.institute.status === "active"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-red-50 text-red-700 border-red-200"
              }`}>
                {stats.institute.status === "active" ? "Active Organization Account" : "Deactivated"}
              </span>
              {stats.institute.validUntil ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  <Calendar size={12} className="text-blue-600" />
                  <span>Valid up to: <strong>{formatDateDDMMYYYY(stats.institute.validUntil)}</strong></span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                  <Calendar size={12} className="text-slate-500" />
                  <span>Lifetime Validity</span>
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Your organization portal is authorized to conduct tests and enroll aspirants within your allocated quotas.
            </p>
          </div>

          <div className="flex items-center gap-6 text-xs bg-gray-50/70 p-3 rounded-lg border border-gray-200 shrink-0 w-full sm:w-auto justify-around sm:justify-start">
            <div>
              <span className="text-gray-500 text-[11px] block">Exams Quota</span>
              <span className="font-bold text-[#324158] text-sm">
                {stats.totalExams} / {stats.institute.maxExams}
              </span>
            </div>
            <div className="w-px h-8 bg-gray-200" />
            <div>
              <span className="text-gray-500 text-[11px] block">Aspirants Quota</span>
              <span className="font-bold text-[#324158] text-sm">
                {stats.studentsEnrolled} / {stats.institute.maxStudents}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-5">
        {[
          { label: "Total Exams", value: stats?.totalExams ?? "—", sub: `+${stats?.examsThisMonth ?? 0} this month`, icon: FileText, iconBg: "bg-[#eaf0f8] border border-[#cbd5e1]/60", iconColor: "text-[#324158]" },
          { label: "Active Exams", value: stats?.activeExams ?? "—", sub: "Live now", icon: PlayCircle, iconBg: "bg-[#eaf0f8] border border-[#cbd5e1]/60", iconColor: "text-[#324158]" },
          { label: "Total Questions", value: stats?.totalQuestions?.toLocaleString() ?? "—", sub: "Across all exams", icon: HelpCircle, iconBg: "bg-[#eaf0f8] border border-[#cbd5e1]/60", iconColor: "text-[#324158]" },
          { label: "Aspirants Enrolled", value: stats?.studentsEnrolled?.toLocaleString() ?? "—", sub: `+${stats?.studentsThisMonth ?? 0} this month`, icon: UserCheck, iconBg: "bg-[#eaf0f8] border border-[#cbd5e1]/60", iconColor: "text-[#324158]" },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl border border-gray-100 p-4 sm:p-5 flex justify-between items-start shadow-xs">
            <div>
              <p className="text-xs sm:text-sm text-gray-500 mb-1">{stat.label}</p>
              <p className="text-2xl sm:text-3xl font-bold text-[#324158]">{stat.value}</p>
              <p className="text-xs text-[#64748b] font-medium mt-1">{stat.sub}</p>
            </div>
            <div className={`w-9 h-9 sm:w-10 sm:h-10 ${stat.iconBg} rounded-lg flex items-center justify-center shrink-0 shadow-2xs`}>
              <stat.icon size={18} className={stat.iconColor} />
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-xs overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 sm:px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-semibold text-primary text-base">Recent Exams</h2>
            <p className="text-xs text-gray-500 mt-0.5">Quick access to manage and review active test sessions</p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            {filtered.length > 0 && (
              <span className="text-xs text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full font-medium">
                {filtered.length} {filtered.length === 1 ? "exam" : "exams"}
              </span>
            )}
          </div>
        </div>

        {/* Mobile View: Dedicated Touch-Friendly Cards */}
        <div className="block sm:hidden divide-y divide-gray-100">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">
              No exams found.{" "}
              {effectiveQuotaReached ? (
                <span className="text-amber-700 font-medium block mt-1">
                  Exam quota reached ({effectiveExamCount}/{effectiveMaxExams}). Contact administrator.
                </span>
              ) : (
                <Link href="/admin/exams/create" className="text-[#324158] hover:underline font-semibold block mt-1">
                  Create your first exam
                </Link>
              )}
            </div>
          ) : (
            filtered.map((exam) => (
              <div key={exam._id} className="p-4 hover:bg-gray-50/50 transition-colors">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-primary text-sm leading-snug line-clamp-2">{exam.title}</p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      <span className="text-[11px] font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                        {exam.subject}
                      </span>
                      {exam.class && (
                        <span className="text-[10px] text-gray-500 bg-gray-50 border border-gray-200 px-1.5 py-0.5 rounded">
                          {exam.class}
                        </span>
                      )}
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${statusColor(exam.status)}`}>
                        {exam.status}
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0 pt-0.5">
                    <ExamActionMenu
                      exam={exam}
                      onToggleStatus={handleToggleStatus}
                      onDelete={handleDelete}
                      onShare={handleShare}
                      onCopy={handleCopyLink}
                      onCopyPublic={handleCopyPublic}
                      copied={copied === exam._id}
                      copiedPublic={copiedPublic === exam._id}
                    />
                  </div>
                </div>

                {/* Metrics Pill Grid */}
                <div className="grid grid-cols-3 gap-2 py-2 px-3 bg-gray-50/80 rounded-lg text-xs mt-3">
                  <div>
                    <span className="text-gray-400 text-[10px] uppercase font-semibold block">Questions</span>
                    <span className="font-bold text-gray-800">{totalQuestions(exam)}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 text-[10px] uppercase font-semibold block">Duration</span>
                    <span className="font-bold text-gray-800">{exam.duration}m</span>
                  </div>
                  <div>
                    <span className="text-gray-400 text-[10px] uppercase font-semibold block">Created</span>
                    <span className="font-medium text-gray-700 text-[11px]">
                      {new Date(exam.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  </div>
                </div>

                {/* Quick 1-Tap Action Links */}
                <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => handleCopyLink(exam._id)}
                    className="flex-1 py-1.5 px-2 rounded-lg border border-gray-200 text-xs font-medium text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Link2 size={13} className="text-gray-400 shrink-0" />
                    <span className="truncate">{copied === exam._id ? "Copied!" : "Copy Link"}</span>
                  </button>
                  <Link
                    href={getExamEditUrl(exam)}
                    className="flex-1 py-1.5 px-2 rounded-lg border border-gray-200 text-xs font-medium text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-1.5 transition-colors text-center"
                  >
                    <Pencil size={13} className="text-[#324158] shrink-0" />
                    <span>Edit</span>
                  </Link>
                  <Link
                    href={`/admin/results?examId=${exam._id}`}
                    className="flex-1 py-1.5 px-2 rounded-lg bg-[#324158]/5 border border-[#324158]/20 text-xs font-medium text-[#324158] hover:bg-[#324158]/10 flex items-center justify-center gap-1.5 transition-colors text-center"
                  >
                    <BarChart2 size={13} className="text-[#324158] shrink-0" />
                    <span>Results</span>
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop View: Wide Table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full min-w-[700px] text-left">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                {["Exam Name", "Subject", "Questions", "Duration", "Status", "Created", "Actions"].map((h) => (
                  <th key={h} className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 sm:px-6 py-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-16 text-gray-400 text-sm">
                    No exams found.{" "}
                    {effectiveQuotaReached ? (
                      <span className="text-amber-700 font-medium">
                        Exam quota reached ({effectiveExamCount}/{effectiveMaxExams}). Contact administrator.
                      </span>
                    ) : (
                      <Link href="/admin/exams/create" className="text-[#324158] hover:underline font-semibold">
                        Create your first exam
                      </Link>
                    )}
                  </td>
                </tr>
              )}
              {filtered.map((exam) => (
                <tr key={exam._id} className="border-b border-gray-50 hover:bg-gray-50/80 transition-colors last:border-0">
                  <td className="px-4 sm:px-6 py-3.5 sm:py-4">
                    <p className="font-medium text-primary text-sm line-clamp-1">{exam.title}</p>
                    {exam.class && <p className="text-xs text-gray-400 mt-0.5">{exam.class}</p>}
                  </td>
                  <td className="px-4 sm:px-6 py-3.5 sm:py-4 text-sm text-gray-600">{exam.subject}</td>
                  <td className="px-4 sm:px-6 py-3.5 sm:py-4 text-sm text-gray-600 font-medium">{totalQuestions(exam)}</td>
                  <td className="px-4 sm:px-6 py-3.5 sm:py-4 text-sm text-gray-600">{exam.duration} mins</td>
                  <td className="px-4 sm:px-6 py-3.5 sm:py-4">
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium capitalize ${statusColor(exam.status)}`}>
                      {exam.status}
                    </span>
                  </td>
                  <td className="px-4 sm:px-6 py-3.5 sm:py-4 text-sm text-gray-500 whitespace-nowrap">
                    {new Date(exam.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </td>
                  <td className="px-4 sm:px-6 py-3.5 sm:py-4">
                    <ExamActionMenu
                      exam={exam}
                      onToggleStatus={handleToggleStatus}
                      onDelete={handleDelete}
                      onShare={handleShare}
                      onCopy={handleCopyLink}
                      onCopyPublic={handleCopyPublic}
                      copied={copied === exam._id}
                      copiedPublic={copiedPublic === exam._id}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

