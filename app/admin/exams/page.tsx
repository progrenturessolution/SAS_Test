"use client"

import { useEffect, useState, useMemo } from "react"
import Link from "next/link"
import { Eye, EyeOff, Pencil, Trash2, Link2, BarChart2, Plus, Share2, GraduationCap, Lock, Layers, Search, X, FileText } from "lucide-react"
import { AdminListSkeleton } from "@/components/SkeletonLoaders"
import { ExamActionMenu } from "@/components/ExamActionMenu"
import { toast } from "sonner"
import { getExamEditUrl } from "@/lib/examEditHelper"

interface Exam {
  _id: string
  title: string
  subject: string
  class?: string
  sections: { questions: unknown[] }[]
  duration: number
  status: string
  createdAt: string
  proctoring: { enabled: boolean; maxWarnings: number }
  examType?: string
}

export default function ExamsListPage() {
  const [exams, setExams] = useState<Exam[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState<string | null>(null)
  const [copiedPublic, setCopiedPublic] = useState<string | null>(null)
  const [filter, setFilter] = useState("all")
  const [search, setSearch] = useState("")
  const [hasCompetitiveAccess, setHasCompetitiveAccess] = useState(true)
  const [hasExamAccess, setHasExamAccess] = useState(true)
  const [hasOtherExamsAccess, setHasOtherExamsAccess] = useState(true)
  const [isExamQuotaReached, setIsExamQuotaReached] = useState(false)
  const [maxExams, setMaxExams] = useState(20)
  const [examCount, setExamCount] = useState(0)

  useEffect(() => {
    fetch("/api/exams", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { setExams(d.exams || []); setLoading(false) })
    
    fetch("/api/admin/institute-access", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        setHasCompetitiveAccess(d.hasCompetitiveAccess !== false)
        setHasExamAccess(d.hasExamAccess !== false)
        setHasOtherExamsAccess(d.hasOtherExamsAccess !== false)
        setIsExamQuotaReached(Boolean(d.isExamQuotaReached))
        if (d.maxExams !== undefined) setMaxExams(Number(d.maxExams))
        if (d.examCount !== undefined) setExamCount(Number(d.examCount))
      })
      .catch(() => {})
  }, [])

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "active" ? "draft" : "active"
    setExams((prev) => prev.map((e) => e._id === id ? { ...e, status: newStatus } : e))
    try {
      await fetch(`/api/exams/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: newStatus }),
      })
    } catch (error) {
      console.error("Failed to toggle status:", error)
      // Revert on error
      setExams((prev) => prev.map((e) => e._id === id ? { ...e, status: currentStatus } : e))
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this exam?")) return
    await fetch(`/api/exams/${id}`, { method: "DELETE", credentials: "include" })
    setExams((prev) => prev.filter((e) => e._id !== id))
  }

  const handleShare = async (id: string, email: string) => {
    try {
      const res = await fetch(`/api/exams/${id}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to share")
    } catch (err: any) {
      throw new Error(err.message)
    }
  }

  const handleCopy = (id: string) => {
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

  const totalQ = (e: Exam) => e.sections?.reduce((s, sec) => s + (sec.questions?.length || 0), 0) || 0

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return exams.filter((e) => {
      const matchFilter = filter === "all" || e.status === filter
      if (!matchFilter) return false
      if (!q) return true

      const titleMatch = e.title?.toLowerCase().includes(q)
      const subjectMatch = e.subject?.toLowerCase().includes(q)
      const classMatch = e.class?.toLowerCase().includes(q)
      const examTypeMatch = e.examType?.toLowerCase().includes(q)
      const statusMatch = e.status?.toLowerCase().includes(q)
      const createdMatch = e.createdAt
        ? new Date(e.createdAt)
            .toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
            .toLowerCase()
            .includes(q)
        : false

      return Boolean(titleMatch || subjectMatch || classMatch || examTypeMatch || statusMatch || createdMatch)
    })
  }, [exams, filter, search])

  const quotaReached = isExamQuotaReached || (maxExams > 0 && exams.length >= maxExams)
  const currentExamCount = Math.max(examCount, exams.length)
  const quotaReachedMessage = `Exam Limit Reached: Your organization has reached the limit of ${maxExams} exams (${currentExamCount}/${maxExams} used). Please contact administrator to increase your exam quota.`

  const statusColor = (s: string) => {
    if (s === "active") return "bg-primary/10 text-primary border border-primary/20"
    if (s === "draft") return "bg-yellow-50 text-yellow-700 border border-yellow-100"
    return "bg-gray-50 text-gray-600 border border-gray-100"
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#324158] tracking-tight">All Exams</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">View and manage all exams generated in your organization</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Create Exam Button */}
          <div className="relative group">
            {!quotaReached && hasExamAccess ? (
              <Link
                href="/admin/exams/create"
                className="flex items-center gap-2 px-3.5 py-2 bg-[#324158] hover:bg-[#253244] text-white rounded-lg text-sm font-medium shadow-sm transition-colors cursor-pointer"
              >
                <Plus size={16} /> Create Exam
              </Link>
            ) : (
              <button
                type="button"
                onClick={() =>
                  toast.error(
                    quotaReached
                      ? quotaReachedMessage
                      : "Access Restricted: You do not have permission to create Exams. Contact administrator."
                  )
                }
                className="flex items-center gap-2 px-3.5 py-2 bg-gray-100 text-gray-400 border border-gray-200 rounded-lg text-sm font-medium cursor-not-allowed"
              >
                <Lock size={15} className="text-gray-400" />
                <span>Create Exam</span>
              </button>
            )}
            {(quotaReached || !hasExamAccess) && (
              <div className="pointer-events-none absolute right-0 top-full mt-2 z-50 hidden group-hover:flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-[#1E293B] px-3 py-1.5 text-xs text-white shadow-xl border border-gray-700 animate-in fade-in duration-150">
                <Lock size={12} className="text-amber-400 shrink-0" />
                <span>
                  {quotaReached
                    ? `Exam Limit Reached: ${currentExamCount}/${maxExams} exams used. Contact administrator.`
                    : "Access Restricted: You do not have permission to create Exams."}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Exam Quota Reached Banner */}
      {quotaReached && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs sm:text-sm flex items-start gap-3 shadow-xs">
          <Lock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-amber-950">
              Exam Quota Reached ({currentExamCount} / {maxExams} exams created)
            </p>
            <p className="text-amber-800 text-xs mt-0.5">
              Your institute has reached its maximum exam creation limit. Creating new exams (Competitive, Other, or Custom) is currently locked. Existing exams remain fully operational. Please contact your platform administrator to increase your exam quota.
            </p>
          </div>
        </div>
      )}

      {/* Search and Filters Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        {/* Search Input Box */}
        <div className="relative w-full sm:w-72 md:w-80 shrink-0">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
          <input
            type="text"
            className="w-full pl-9 pr-9 py-2 border border-slate-200 rounded-xl text-xs sm:text-sm bg-white text-slate-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 shadow-2xs transition-all"
            placeholder="Search exams by title, subject, class..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
              title="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filter Tabs & Counter */}
        <div className="flex flex-wrap items-center gap-2">
          {["all", "active", "draft", "closed"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold capitalize transition-all tracking-wider cursor-pointer ${filter === f
                  ? "bg-primary text-white shadow-md shadow-primary/20 scale-105"
                  : "bg-white text-gray-400 border border-gray-100 hover:bg-gray-50"
                }`}
            >
              {f}
            </button>
          ))}
          {(search || filter !== "all") && (
            <button
              type="button"
              onClick={() => {
                setSearch("")
                setFilter("all")
              }}
              className="px-2.5 py-1.5 rounded-full text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 transition-colors flex items-center gap-1 cursor-pointer"
              title="Reset all filters and search"
            >
              <X size={12} />
              <span>Reset</span>
            </button>
          )}
          {exams.length > 0 && (
            <span className="text-[11px] font-medium text-gray-400 ml-1">
              Showing {filtered.length} of {exams.length}
            </span>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-xs overflow-hidden">
        {loading ? (
          <AdminListSkeleton />
        ) : (
          <>
            {/* Mobile View: Dedicated Touch-Friendly Cards */}
            <div className="block sm:hidden divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-sm flex flex-col items-center justify-center gap-2">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-1">
                    {search || filter !== "all" ? <Search size={22} /> : <FileText size={22} />}
                  </div>
                  <p className="font-semibold text-slate-700 text-sm">
                    {search || filter !== "all" ? "No exams match your search" : "No exams found"}
                  </p>
                  <p className="text-xs text-gray-400 max-w-xs">
                    {search
                      ? `No exams found matching "${search}" in ${filter === "all" ? "all" : filter} exams.`
                      : filter !== "all"
                      ? `No exams with status "${filter}".`
                      : "Create your first examination to get started."}
                  </p>
                  {(search || filter !== "all") && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearch("")
                        setFilter("all")
                      }}
                      className="mt-1 text-xs text-primary font-semibold hover:underline cursor-pointer"
                    >
                      Clear search & filters
                    </button>
                  )}
                </div>
              ) : (
                filtered.map((exam) => (
                  <div key={exam._id} className="p-4 hover:bg-gray-50/50 transition-colors">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-[#324158] text-sm leading-snug line-clamp-2">{exam.title}</p>
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
                          {exam.proctoring?.enabled ? (
                            <span className="text-[10px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full font-medium">
                              Proctor On
                            </span>
                          ) : (
                            <span className="text-[10px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded-full">
                              Proctor Off
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0 pt-0.5">
                        <ExamActionMenu
                          exam={exam}
                          onToggleStatus={handleToggleStatus}
                          onDelete={handleDelete}
                          onShare={handleShare}
                          onCopy={handleCopy}
                          onCopyPublic={handleCopyPublic}
                          copied={copied === exam._id}
                          copiedPublic={copiedPublic === exam._id}
                        />
                      </div>
                    </div>

                    {/* Metrics Grid */}
                    <div className="grid grid-cols-3 gap-2 py-2 px-3 bg-gray-50/80 rounded-lg text-xs mt-3">
                      <div>
                        <span className="text-gray-400 text-[10px] uppercase font-semibold block">Questions</span>
                        <span className="font-bold text-gray-800">{totalQ(exam)}</span>
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
                        onClick={() => handleCopy(exam._id)}
                        className="flex-1 py-1.5 px-2 rounded-lg border border-gray-200 text-xs font-medium text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Link2 size={13} className="text-gray-400 shrink-0" />
                        <span className="truncate">{copied === exam._id ? "Copied!" : "Copy Link"}</span>
                      </button>
                      <Link
                        href={getExamEditUrl(exam)}
                        className="flex-1 py-1.5 px-2 rounded-lg border border-gray-200 text-xs font-medium text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-1.5 transition-colors text-center"
                      >
                        <Pencil size={13} className="text-emerald-500 shrink-0" />
                        <span>Edit</span>
                      </Link>
                      <Link
                        href={`/admin/results?examId=${exam._id}`}
                        className="flex-1 py-1.5 px-2 rounded-lg bg-primary/5 border border-primary/20 text-xs font-medium text-primary hover:bg-primary/10 flex items-center justify-center gap-1.5 transition-colors text-center"
                      >
                        <BarChart2 size={13} className="text-primary shrink-0" />
                        <span>Results</span>
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Desktop View: Wide Table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full min-w-[760px] text-left">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    {["Exam Name", "Subject", "Questions", "Duration", "Proctoring", "Status", "Created", "Actions"].map((h) => (
                      <th key={h} className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 sm:px-5 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-gray-400 text-sm">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-1">
                            {search || filter !== "all" ? <Search size={22} /> : <FileText size={22} />}
                          </div>
                          <p className="font-semibold text-slate-700 text-sm">
                            {search || filter !== "all" ? "No exams match your search" : "No exams found"}
                          </p>
                          <p className="text-xs text-gray-400 max-w-sm">
                            {search
                              ? `No exams found matching "${search}" in ${filter === "all" ? "all" : filter} exams.`
                              : filter !== "all"
                              ? `No exams with status "${filter}".`
                              : "Create your first examination to get started."}
                          </p>
                          {(search || filter !== "all") && (
                            <button
                              type="button"
                              onClick={() => {
                                setSearch("")
                                setFilter("all")
                              }}
                              className="mt-1 text-xs text-primary font-semibold hover:underline cursor-pointer"
                            >
                              Clear search & filters
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                  {filtered.map((exam) => (
                    <tr key={exam._id} className="border-b border-gray-50 hover:bg-gray-50/80 last:border-0 transition-colors">
                      <td className="px-4 sm:px-5 py-3.5 sm:py-4">
                        <p className="font-medium text-[#324158] text-sm line-clamp-1">{exam.title}</p>
                        {exam.class && <p className="text-xs text-gray-400 mt-0.5">{exam.class}</p>}
                      </td>
                      <td className="px-4 sm:px-5 py-3.5 sm:py-4 text-sm text-gray-600">{exam.subject}</td>
                      <td className="px-4 sm:px-5 py-3.5 sm:py-4 text-sm text-gray-600 font-medium">{totalQ(exam)}</td>
                      <td className="px-4 sm:px-5 py-3.5 sm:py-4 text-sm text-gray-600">{exam.duration} mins</td>
                      <td className="px-4 sm:px-5 py-3.5 sm:py-4">
                        {exam.proctoring?.enabled ? (
                          <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full font-medium">On · {exam.proctoring.maxWarnings}w</span>
                        ) : (
                          <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">Off</span>
                        )}
                      </td>
                      <td className="px-4 sm:px-5 py-3.5 sm:py-4">
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium capitalize ${statusColor(exam.status)}`}>{exam.status}</span>
                      </td>
                      <td className="px-4 sm:px-5 py-3.5 sm:py-4 text-sm text-gray-500 whitespace-nowrap">
                        {new Date(exam.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </td>
                      <td className="px-4 sm:px-5 py-3.5 sm:py-4">
                        <ExamActionMenu
                          exam={exam}
                          onToggleStatus={handleToggleStatus}
                          onDelete={handleDelete}
                          onShare={handleShare}
                          onCopy={handleCopy}
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
          </>
        )}
      </div>
    </div>
  )
}
