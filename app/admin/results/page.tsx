"use client"

import { useEffect, useState, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Filter, Share2, Check } from "lucide-react"
import { AdminListSkeleton } from "@/components/SkeletonLoaders"
import { Toaster } from "@/components/ui/toaster"
import { ResultActionMenu } from "@/components/ResultActionMenu"

interface Result {
  _id: string
  examId?: string
  examTitle: string
  examSubject: string
  studentName: string
  studentEmail: string
  rollNumber: string
  score?: number
  maxScore?: number
  percentage?: number
  passed?: boolean
  status: string
  submittedAt?: string
  proctoring: { warnings: number; autoSubmitted?: boolean }
  isGraded?: boolean
}

function ResultsPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const examId = searchParams.get("examId")
  const [results, setResults] = useState<Result[]>([])
  const [exams, setExams] = useState<{_id: string, title: string}[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  const copyShareLink = () => {
    if (!examId) return
    const url = `${window.location.origin}/exam/${examId}/results`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  useEffect(() => {
    fetch("/api/exams")
      .then(r => r.json())
      .then(data => setExams(data.exams || []))
  }, [])

  useEffect(() => {
    const url = examId ? `/api/admin/results?examId=${examId}` : "/api/admin/results"
    setLoading(true)
    fetch(url)
      .then((r) => r.json())
      .then((d) => { setResults(d.results || []); setLoading(false) })
  }, [examId])

  const handleExamChange = (id: string) => {
    if (id === "all") {
      router.push("/admin/results")
    } else {
      router.push(`/admin/results?examId=${id}`)
    }
  }

  const avg = results.length
    ? Math.round(results.reduce((s, r) => s + (r.percentage || 0), 0) / results.length)
    : 0

  const passed = results.filter((r) => r.passed).length

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            {examId ? "Exam Results" : "All Results"}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time candidate submissions, proctoring alerts, and automated scoring analysis
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3.5 py-2 shadow-2xs hover:border-slate-300 transition-colors">
            <Filter size={15} className="text-slate-400" />
            <select 
              value={examId || "all"} 
              onChange={(e) => handleExamChange(e.target.value)}
              className="bg-transparent border-none text-xs sm:text-sm font-semibold focus:ring-0 cursor-pointer text-slate-800 min-w-[180px] sm:min-w-[220px] outline-none"
            >
              <option value="all">All Exams</option>
              {exams.map(e => (
                <option key={e._id} value={e._id}>{e.title}</option>
              ))}
            </select>
          </div>
          {examId && (
            <button
              onClick={copyShareLink}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-xs cursor-pointer ${
                copied
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs"
                  : "bg-[#1E293B] hover:bg-[#0F172A] text-white hover:shadow-md"
              }`}
            >
              {copied ? (
                <><Check size={14} className="stroke-[2.5]" /> Link Copied!</>
              ) : (
                <><Share2 size={14} /> Share Results Link</>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Top Clean Minimalist Metric Cards (No Emojis / No Icons) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {/* Card 1: Total Submissions */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs hover:shadow-sm transition-all">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
            Total Attempts
          </p>
          <p className="text-2xl sm:text-3xl font-extrabold text-[#324158] tracking-tight">
            {results.length}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {examId ? "Selected exam" : "Across all active exams"}
          </p>
        </div>

        {/* Card 2: Passed */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs hover:shadow-sm transition-all">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
            Passed Students
          </p>
          <p className="text-2xl sm:text-3xl font-extrabold text-[#324158] tracking-tight">
            {passed}
          </p>
          <p className="text-xs text-slate-500 font-medium mt-1">
            {results.length > 0 ? `${Math.round((passed / results.length) * 100)}% Pass Rate` : "No attempts yet"}
          </p>
        </div>

        {/* Card 3: Failed / Retake */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs hover:shadow-sm transition-all">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
            Failed / Retake
          </p>
          <p className="text-2xl sm:text-3xl font-extrabold text-[#324158] tracking-tight">
            {results.length - passed}
          </p>
          <p className="text-xs text-slate-500 font-medium mt-1">
            {results.length > 0 ? `${Math.round(((results.length - passed) / results.length) * 100)}% Below Passing` : "0% Fail Rate"}
          </p>
        </div>

        {/* Card 4: Average Score */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs hover:shadow-sm transition-all">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
            Average Score
          </p>
          <p className="text-2xl sm:text-3xl font-extrabold text-[#324158] tracking-tight">
            {avg}%
          </p>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Mean score of attempts
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-auto custom-scrollbar max-h-[calc(100vh-320px)] shadow-sm">
        {loading ? (
          <AdminListSkeleton />
        ) : (
          <table className="w-full min-w-[1000px] border-collapse">
            <thead className="sticky top-0 bg-white z-10 shadow-sm">
              <tr className="border-b border-gray-100">
                {["Student", "Exam", "Score", "Result", "Grading", "Warnings", "Submitted", "Actions"].map((h) => (
                  <th key={h} className={`text-xs font-semibold text-gray-400 uppercase tracking-wider px-5 py-4 ${h === "Actions" ? "text-right" : "text-left"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.length === 0 && (
                <tr><td colSpan={8} className="text-center py-12 text-gray-400 text-sm">No results yet.</td></tr>
              )}
              {results.map((r) => (
                <tr key={r._id} className="border-b border-gray-50 hover:bg-gray-50 last:border-0">
                  <td className="px-5 py-4">
                    <p className="text-sm font-medium text-foreground">{r.studentName}</p>
                    <p className="text-xs text-gray-400">{r.rollNumber}</p>
                  </td>
                  <td className="px-5 py-4">
                    <p className="text-sm text-gray-700">{r.examTitle}</p>
                    <p className="text-xs text-gray-400">{r.examSubject}</p>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-col gap-1">
                      <span className="text-sm text-gray-600 font-bold">{r.score ?? "—"} / {r.maxScore ?? "—"}</span>
                      <div className="flex items-center gap-1.5">
                        <div className="w-12 h-1 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${(r.percentage || 0) >= 40 ? "bg-[#10B981]" : "bg-red-400"}`}
                            style={{ width: `${Math.min(r.percentage || 0, 100)}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-gray-400">{r.percentage ?? "—"}%</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    {r.passed ? (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full w-fit border border-emerald-100">
                        Pass
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-full w-fit border border-rose-100">
                        Fail
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    {r.isGraded ? (
                      <span className="text-[10px] font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-full w-fit border border-slate-200">
                        Graded
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full w-fit border border-amber-200/70">
                        Pending
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <span className={`text-[10px] font-bold w-fit px-2.5 py-1 rounded-full border ${r.proctoring.warnings > 0 ? "text-amber-800 bg-amber-50 border-amber-200/80" : "text-gray-500 bg-gray-50 border-gray-100"}`}>
                      {r.proctoring.warnings} warnings
                    </span>
                  </td>
                  <td className="px-5 py-4 text-[11px] font-medium text-gray-500">
                    {r.submittedAt ? new Date(r.submittedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <ResultActionMenu result={r} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <Toaster />
    </div>
  )
}

export default function ResultsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-400">Loading...</div>}>
      <ResultsPageInner />
    </Suspense>
  )
}
