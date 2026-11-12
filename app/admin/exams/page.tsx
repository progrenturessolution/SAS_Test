"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Eye, EyeOff, Pencil, Trash2, Link2, BarChart2, Plus, Share2, GraduationCap } from "lucide-react"
import { AdminListSkeleton } from "@/components/SkeletonLoaders"
import { ExamActionMenu } from "@/components/ExamActionMenu"

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
}

export default function ExamsListPage() {
  const [exams, setExams] = useState<Exam[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState<string | null>(null)
  const [filter, setFilter] = useState("all")

  useEffect(() => {
    fetch("/api/exams", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { setExams(d.exams || []); setLoading(false) })
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
    setTimeout(() => setCopied(null), 2000)
  }

  const totalQ = (e: Exam) => e.sections?.reduce((s, sec) => s + (sec.questions?.length || 0), 0) || 0

  const filtered = exams.filter((e) => filter === "all" || e.status === filter)

  const statusColor = (s: string) => {
    if (s === "active") return "bg-primary/10 text-primary border border-primary/20"
    if (s === "draft") return "bg-yellow-50 text-yellow-700 border border-yellow-100"
    return "bg-gray-50 text-gray-600 border border-gray-100"
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#45505F] tracking-tight">All Exams</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">View and manage all exams generated in your organization</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/admin/ai-generator"
            className="flex items-center gap-2 px-3.5 py-2 bg-[#2D3A4A] hover:bg-[#1e2a38] text-white rounded-lg text-sm font-medium shadow-sm transition-colors"
          >
            <GraduationCap size={16} className="text-white" />
            <span>Competitive Test</span>
          </Link>
          <Link href="/admin/exams/create" className="flex items-center gap-2 px-3.5 py-2 bg-[#45505F] text-white rounded-lg text-sm font-medium hover:bg-[#1e2a38]">
            <Plus size={16} /> Create Exam
          </Link>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        {["all", "active", "draft", "closed"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold capitalize transition-all tracking-wider ${filter === f
                ? "bg-primary text-white shadow-md shadow-primary/20 scale-105"
                : "bg-white text-gray-400 border border-gray-100 hover:bg-gray-50"
              }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-xs overflow-hidden">
        {loading ? (
          <AdminListSkeleton />
        ) : (
          <>
            {/* Mobile View: Dedicated Touch-Friendly Cards */}
            <div className="block sm:hidden divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-sm">No exams found.</div>
              ) : (
                filtered.map((exam) => (
                  <div key={exam._id} className="p-4 hover:bg-gray-50/50 transition-colors">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-[#45505F] text-sm leading-snug line-clamp-2">{exam.title}</p>
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
                          copied={copied === exam._id}
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
                        href={`/admin/exams/${exam._id}/edit`}
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
                    <tr><td colSpan={8} className="text-center py-12 text-gray-400 text-sm">No exams found.</td></tr>
                  )}
                  {filtered.map((exam) => (
                    <tr key={exam._id} className="border-b border-gray-50 hover:bg-gray-50/80 last:border-0 transition-colors">
                      <td className="px-4 sm:px-5 py-3.5 sm:py-4">
                        <p className="font-medium text-[#45505F] text-sm line-clamp-1">{exam.title}</p>
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
                          copied={copied === exam._id}
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
