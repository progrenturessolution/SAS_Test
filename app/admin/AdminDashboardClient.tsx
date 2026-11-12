"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Eye, Pencil, Trash2, Link2, BarChart2, UserCheck, FileText, PlayCircle, HelpCircle, Users, Building2, ShieldAlert } from "lucide-react"
import { ExamActionMenu } from "@/components/ExamActionMenu"

interface Stats {
  isSuperAdmin?: boolean
  institute?: {
    id: string
    name: string
    code: string
    status: string
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
}

export default function AdminDashboardClient() {
  const router = useRouter()
  const [stats, setStats] = useState<Stats | null>(null)
  const [exams, setExams] = useState<Exam[]>([])
  const [search, setSearch] = useState("")
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((r) => {
        if (r.status === 401 || r.status === 403) {
          router.replace("/admin/login")
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
        router.replace("/admin/login")
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
    setTimeout(() => setCopied(null), 2000)
  }

  const totalQuestions = (exam: Exam) =>
    exam.sections?.reduce((sum, sec) => sum + (sec.questions?.length || 0), 0) || 0

  const filtered = exams.filter(
    (e) =>
      e.title.toLowerCase().includes(search.toLowerCase()) ||
      e.subject.toLowerCase().includes(search.toLowerCase())
  )

  const statusColor = (s: string) => {
    if (s === "active") return "bg-green-100 text-green-700"
    if (s === "draft") return "bg-yellow-100 text-yellow-700"
    return "bg-gray-100 text-gray-600"
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-primary">Exam Management</h1>
        <div className="flex items-center gap-3">
          <div className="relative">
            <input
              className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:border-[#10B981] w-64"
              placeholder="Search exams..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <Link
            href="/admin/exams/create"
            className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-accent transition-colors"
          >
            + Create Exam
          </Link>
        </div>
      </div>

      {/* Organization Plan & Limits Banner */}
      {stats?.institute && (
        <div className="mb-6 p-4 rounded-xl bg-white border border-gray-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#45505F]">
                {stats.institute.name}
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200">
                {stats.institute.code}
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                Active Organization Account
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Your organization portal is authorized to conduct tests and enroll students within your allocated quotas.
            </p>
          </div>

          <div className="flex items-center gap-6 text-xs bg-gray-50/70 p-3 rounded-lg border border-gray-200 shrink-0">
            <div>
              <span className="text-gray-500 text-[11px] block">Exams Quota</span>
              <span className="font-bold text-[#2D3A4A] text-sm">
                {stats.totalExams} / {stats.institute.maxExams}
              </span>
            </div>
            <div className="w-px h-8 bg-gray-200" />
            <div>
              <span className="text-gray-500 text-[11px] block">Students Quota</span>
              <span className="font-bold text-[#2D3A4A] text-sm">
                {stats.studentsEnrolled} / {stats.institute.maxStudents}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-5 mb-8">
        {[
          { label: "Total Exams", value: stats?.totalExams ?? "—", sub: `+${stats?.examsThisMonth ?? 0} this month`, icon: FileText, iconBg: "bg-blue-50", iconColor: "text-blue-500" },
          { label: "Active Exams", value: stats?.activeExams ?? "—", sub: "Live now", icon: PlayCircle, iconBg: "bg-green-50", iconColor: "text-green-500" },
          { label: "Total Questions", value: stats?.totalQuestions?.toLocaleString() ?? "—", sub: "Across all exams", icon: HelpCircle, iconBg: "bg-purple-50", iconColor: "text-purple-500" },
          { label: "Students Enrolled", value: stats?.studentsEnrolled?.toLocaleString() ?? "—", sub: `+${stats?.studentsThisMonth ?? 0} this month`, icon: UserCheck, iconBg: "bg-teal-50", iconColor: "text-teal-500" },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl border border-gray-100 p-5 flex justify-between items-start">
            <div>
              <p className="text-sm text-gray-500 mb-1">{stat.label}</p>
              <p className="text-3xl font-bold text-primary">{stat.value}</p>
              <p className="text-xs text-green-500 mt-1">{stat.sub}</p>
            </div>
            <div className={`w-9 h-9 ${stat.iconBg} rounded-lg flex items-center justify-center`}>
              <stat.icon size={18} className={stat.iconColor} />
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-visible">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-primary">Recent Exams</h2>
          <div className="flex gap-2">
            <button className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Filter</button>
            <button className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Export</button>
          </div>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100">
              {["Exam Name", "Subject", "Questions", "Duration", "Status", "Created", "Actions"].map((h) => (
                <th key={h} className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-6 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-16 text-gray-400 text-sm">
                  No exams yet.{" "}
                  <Link href="/admin/exams/create" className="text-[#10B981] underline">Create your first exam</Link>
                </td>
              </tr>
            )}
            {filtered.map((exam) => (
              <tr key={exam._id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors last:border-0">
                <td className="px-6 py-4">
                  <p className="font-medium text-primary text-sm">{exam.title}</p>
                  {exam.class && <p className="text-xs text-gray-400">{exam.class}</p>}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">{exam.subject}</td>
                <td className="px-6 py-4 text-sm text-gray-600">{totalQuestions(exam)}</td>
                <td className="px-6 py-4 text-sm text-gray-600">{exam.duration} mins</td>
                <td className="px-6 py-4">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${statusColor(exam.status)}`}>
                    {exam.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {new Date(exam.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </td>
                <td className="px-6 py-4">
                  <ExamActionMenu
                    exam={exam}
                    onToggleStatus={handleToggleStatus}
                    onDelete={handleDelete}
                    onShare={handleShare}
                    onCopy={handleCopyLink}
                    copied={copied === exam._id}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

