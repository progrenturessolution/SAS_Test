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
    <div className="p-8">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-[#45505F]">All Exams</h1>
        <div className="flex items-center gap-2.5">
          <Link
            href="/admin/ai-generator"
            className="flex items-center gap-2 px-4 py-2 bg-[#2D3A4A] hover:bg-[#1e2a38] text-white rounded-lg text-sm font-medium shadow-sm transition-colors"
          >
            <GraduationCap size={16} className="text-white" />
            <span>NEET / JEE / MHT-CET</span>
          </Link>
          <Link href="/admin/exams/create" className="flex items-center gap-2 px-4 py-2 bg-[#45505F] text-white rounded-lg text-sm font-medium hover:bg-[#1e2a38]">
            <Plus size={16} /> Create Exam
          </Link>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-5">
        {["all", "active", "draft", "closed"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold capitalize transition-all tracking-wider ${
              filter === f
                ? "bg-primary text-white shadow-md shadow-primary/20 scale-105"
                : "bg-white text-gray-400 border border-gray-100 hover:bg-gray-50"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {loading ? (
          <AdminListSkeleton />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-200">
            <thead>
              <tr className="border-b border-gray-100">
                {["Exam Name", "Subject", "Questions", "Duration", "Proctoring", "Status", "Created", "Actions"].map((h) => (
                  <th key={h} className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-5 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="text-center py-12 text-gray-400 text-sm">No exams found.</td></tr>
              )}
              {filtered.map((exam) => (
                <tr key={exam._id} className="border-b border-gray-50 hover:bg-gray-50 last:border-0 transition-colors">
                  <td className="px-5 py-4">
                    <p className="font-medium text-[#45505F] text-sm">{exam.title}</p>
                    {exam.class && <p className="text-xs text-gray-400">{exam.class}</p>}
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-600">{exam.subject}</td>
                  <td className="px-5 py-4 text-sm text-gray-600">{totalQ(exam)}</td>
                  <td className="px-5 py-4 text-sm text-gray-600">{exam.duration} mins</td>
                  <td className="px-5 py-4">
                    {exam.proctoring?.enabled ? (
                      <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">On · {exam.proctoring.maxWarnings}w</span>
                    ) : (
                      <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-full">Off</span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${statusColor(exam.status)}`}>{exam.status}</span>
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-500">
                    {new Date(exam.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </td>
                  <td className="px-5 py-4">
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
        )}
      </div>
    </div>
  )
}
