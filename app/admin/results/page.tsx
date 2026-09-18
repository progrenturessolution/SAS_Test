"use client"

import { useEffect, useState, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { ShieldAlert, CheckCircle, XCircle, Eye, Share2, Check, AlertTriangle, Filter } from "lucide-react"
import { AdminListSkeleton } from "@/components/SkeletonLoaders"
import { Toaster } from "@/components/ui/toaster"

interface Result {
  _id: string
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
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">
          {examId ? "Exam Results" : "All Results"}
        </h1>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
            <Filter size={16} className="text-gray-400" />
            <select 
              value={examId || "all"} 
              onChange={(e) => handleExamChange(e.target.value)}
              className="bg-transparent border-none text-sm font-medium focus:ring-0 cursor-pointer text-gray-700 min-w-[200px]"
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
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                copied
                  ? "bg-green-50 text-[#10B981] border border-green-200"
                  : "bg-primary text-white hover:bg-accent shadow-sm hover:shadow-md"
              }`}
            >
              {copied ? (
                <><Check size={15} /> Link Copied!</>
              ) : (
                <><Share2 size={15} /> Share Results Link</>
              )}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-5 mb-6">
        {[
          { label: "Total Attempts", value: results.length, color: "text-blue-500", bg: "bg-blue-50" },
          { label: "Passed", value: passed, color: "text-green-500", bg: "bg-green-50" },
          { label: "Failed", value: results.length - passed, color: "text-red-500", bg: "bg-red-50" },
          { label: "Avg Score", value: `${avg}%`, color: "text-purple-500", bg: "bg-purple-50" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-5">
            <div className={`w-8 h-8 ${s.bg} rounded-lg flex items-center justify-center mb-2`}>
              <span className={`text-sm font-bold ${s.color}`}>#</span>
            </div>
            <p className={`text-xs ${s.bg}`}>{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-auto custom-scrollbar max-h-[calc(100vh-320px)] shadow-sm">
        {loading ? (
          <AdminListSkeleton />
        ) : (
          <table className="w-full min-w-[1000px] border-collapse">
            <thead className="sticky top-0 bg-white z-10 shadow-sm">
              <tr className="border-b border-gray-100">
                {["Student", "Exam", "Score", "Result", "Grading", "Warnings", "Submitted", "Actions"].map((h) => (
                  <th key={h} className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-5 py-4">{h}</th>
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
                      <span className="flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full w-fit border border-green-100">
                        <CheckCircle size={11} /> Pass
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-red-500 bg-red-50 px-2 py-1 rounded-full w-fit border border-red-100">
                        <XCircle size={11} /> Fail
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    {r.isGraded ? (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-full w-fit border border-blue-100">
                        <CheckCircle size={11} /> Graded
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded-full w-fit border border-orange-100">
                        <AlertTriangle size={11} /> Pending
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <span className={`flex items-center gap-1 text-[10px] font-bold w-fit px-2 py-1 rounded-full border ${r.proctoring.warnings > 0 ? "text-orange-600 bg-orange-50 border-orange-100" : "text-gray-400 bg-gray-50 border-gray-100"}`}>
                      <ShieldAlert size={11} /> {r.proctoring.warnings}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-[11px] font-medium text-gray-500">
                    {r.submittedAt ? new Date(r.submittedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                  </td>
                  <td className="px-5 py-4 flex items-center gap-2">
                    <Link href={`/admin/results/${r._id}/review`} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-[10px] font-bold rounded-lg hover:bg-accent transition-all">
                      Review & Grade
                    </Link>
                    <Link href={`/admin/results/${r._id}`} title="View proctoring log" className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                      <Eye size={15} className="text-gray-400 hover:text-blue-500" />
                    </Link>
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
