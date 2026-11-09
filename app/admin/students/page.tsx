"use client"

import { useEffect, useState } from "react"
import { User, Mail, Hash, Clock, TrendingUp, Plus, X } from "lucide-react"
import { AdminListSkeleton } from "@/components/SkeletonLoaders"
import { Toaster } from "@/components/ui/toaster"

interface Student {
  _id: string
  email?: string
  studentName: string
  rollNumber: string
  totalAttempts: number
  lastAttempt: string
  avgPercentage?: number
}

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [showAddStudent, setShowAddStudent] = useState(false)
  const [studentForm, setStudentForm] = useState({ name: "", email: "", rollNumber: "", password: "" })
  const [studentError, setStudentError] = useState("")
  const [savingStudent, setSavingStudent] = useState(false)

  const loadStudents = () => {
    setLoading(true)
    fetch("/api/admin/students")
      .then((r) => r.json())
      .then((d) => { setStudents(d.students || []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(loadStudents, [])

  const handleAddStudent = async (event: React.FormEvent) => {
    event.preventDefault()
    setStudentError("")
    setSavingStudent(true)
    try {
      const response = await fetch("/api/admin/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(studentForm),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to add student")
      setStudentForm({ name: "", email: "", rollNumber: "", password: "" })
      setShowAddStudent(false)
      loadStudents()
    } catch (error) {
      setStudentError(error instanceof Error ? error.message : "Failed to add student")
    } finally {
      setSavingStudent(false)
    }
  }

  const filtered = students.filter(
    (s) =>
      s.studentName?.toLowerCase().includes(search.toLowerCase()) ||
      s._id?.toLowerCase().includes(search.toLowerCase()) ||
      s.rollNumber?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-primary">Students</h1>
          <p className="mt-1 text-xs text-gray-500">Only registered students can enter your institute exams.</p>
        </div>
        <button type="button" onClick={() => setShowAddStudent(true)} className="flex items-center gap-2 rounded-lg bg-[#2D3A4A] px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-[#1e2a38]">
          <Plus className="h-4 w-4" /> Add Student
        </button>
        <div className="relative">
          <input
            className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:border-[#10B981] w-64"
            placeholder="Search by name, email, roll..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5 mb-6">
        {[
          { label: "Total Students", value: students.length, icon: User },
          { label: "Avg Score", value: students.length ? `${Math.round(students.reduce((s, st) => s + (st.avgPercentage || 0), 0) / students.length)}%` : "—", icon: TrendingUp },
          { label: "Total Attempts", value: students.reduce((s, st) => s + st.totalAttempts, 0), icon: Clock },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl border border-gray-100 p-5 flex items-center gap-4">
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
              <stat.icon size={18} className="text-blue-500" />
            </div>
            <div>
              <p className="text-xs text-gray-500">{stat.label}</p>
              <p className="text-2xl font-bold text-primary">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
        {loading ? (
          <AdminListSkeleton />
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                {["Student", "Email", "Roll Number", "Attempts", "Avg Score", "Last Attempt"].map((h) => (
                  <th key={h} className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-6 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="text-center py-12 text-gray-400 text-sm">No students yet.</td></tr>
              )}
              {filtered.map((s) => (
                <tr key={s._id} className="border-b border-gray-50 hover:bg-gray-50 last:border-0">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold">
                        {s.studentName?.charAt(0)?.toUpperCase() || "?"}
                      </div>
                      <span className="text-sm font-medium text-primary">{s.studentName}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{s.email || s._id}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{s.rollNumber}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{s.totalAttempts}</td>
                  <td className="px-6 py-4">
                    {s.avgPercentage != null ? (
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-[#10B981] rounded-full" style={{ width: `${Math.min(s.avgPercentage, 100)}%` }} />
                        </div>
                        <span className="text-sm text-gray-600">{Math.round(s.avgPercentage)}%</span>
                      </div>
                    ) : <span className="text-gray-400 text-sm">—</span>}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {s.lastAttempt ? new Date(s.lastAttempt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {showAddStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <form onSubmit={handleAddStudent} className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-[#2D3A4A]">Add Student</h2>
                <p className="mt-1 text-xs text-gray-500">This student will be allowed into institute exams.</p>
              </div>
              <button type="button" onClick={() => setShowAddStudent(false)} aria-label="Close"><X className="h-5 w-5 text-gray-400" /></button>
            </div>
            {studentError && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">{studentError}</p>}
            <div className="space-y-3">
              {[
                ["name", "Student name", "Full name"],
                ["email", "Email address", "student@example.com"],
                ["rollNumber", "Roll number", "e.g. STU-001"],
                ["password", "Exam password", "Minimum 6 characters"],
              ].map(([key, label, placeholder]) => (
                <label key={key} className="block text-xs font-semibold text-gray-700">
                  {label}
                  <input type={key === "password" ? "password" : key === "email" ? "email" : "text"} required minLength={key === "password" ? 6 : undefined} value={studentForm[key as keyof typeof studentForm]} onChange={(event) => setStudentForm((current) => ({ ...current, [key]: event.target.value }))} placeholder={placeholder} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm font-normal outline-none focus:border-[#2D3A4A]" />
                </label>
              ))}
            </div>
            <button type="submit" disabled={savingStudent} className="mt-5 w-full rounded-lg bg-[#2D3A4A] py-2.5 text-sm font-semibold text-white hover:bg-[#1e2a38] disabled:opacity-60">
              {savingStudent ? "Adding..." : "Add Student"}
            </button>
          </form>
        </div>
      )}
      <Toaster />
    </div>
  )
}
