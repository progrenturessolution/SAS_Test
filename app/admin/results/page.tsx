"use client"

import { useEffect, useState, useMemo, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Filter, Share2, Check, Globe, Users, Search, X, Mail, Phone, Hash, Award, Calendar, ShieldAlert, ExternalLink, User } from "lucide-react"
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
  studentPhone?: string
  rollNumber: string
  candidateType?: "institute" | "public"
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
  const [candidateTypeFilter, setCandidateTypeFilter] = useState<"all" | "institute" | "public">("all")
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [profileResult, setProfileResult] = useState<Result | null>(null)

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
    const params = new URLSearchParams()
    if (examId) params.append("examId", examId)
    if (candidateTypeFilter !== "all") params.append("candidateType", candidateTypeFilter)
    const qs = params.toString()
    const url = qs ? `/api/admin/results?${qs}` : "/api/admin/results"
    setLoading(true)
    fetch(url)
      .then((r) => r.json())
      .then((d) => { setResults(d.results || []); setLoading(false) })
  }, [examId, candidateTypeFilter])

  const handleExamChange = (id: string) => {
    if (id === "all") {
      router.push("/admin/results")
    } else {
      router.push(`/admin/results?examId=${id}`)
    }
  }

  const filteredResults = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return results
    return results.filter(
      (r) =>
        r.studentName?.toLowerCase().includes(q) ||
        r.rollNumber?.toLowerCase().includes(q) ||
        r.studentEmail?.toLowerCase().includes(q) ||
        r.studentPhone?.toLowerCase().includes(q) ||
        r.examTitle?.toLowerCase().includes(q) ||
        r.examSubject?.toLowerCase().includes(q)
    )
  }, [results, search])

  const avg = filteredResults.length
    ? Math.round(filteredResults.reduce((s, r) => s + (r.percentage || 0), 0) / filteredResults.length)
    : 0

  const passed = filteredResults.filter((r) => r.passed).length

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

        {examId && (
          <button
            onClick={copyShareLink}
            className={`self-start sm:self-auto flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-xs cursor-pointer ${
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

      {/* Dedicated Filter & Search Bar - Side by Side Dropdowns */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 sm:p-4 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Controls: Search + Side-by-side Dropdown Filters */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3 flex-1 flex-wrap">
            {/* Search Input */}
            <div className="relative w-full sm:w-72 md:w-80 shrink-0">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              <input
                type="text"
                placeholder="Search by name, roll, email, or exam name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-slate-50/80 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 transition-all shadow-2xs"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  title="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Dropdown 1: Exam Filter */}
            <div className="flex items-center gap-2 bg-slate-50/80 hover:bg-slate-50 focus-within:bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-2xs transition-colors flex-1 sm:flex-initial sm:min-w-[210px] focus-within:border-slate-800 focus-within:ring-2 focus-within:ring-slate-900/10">
              <Filter size={14} className="text-slate-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <select 
                  value={examId || "all"} 
                  onChange={(e) => handleExamChange(e.target.value)}
                  className="w-full bg-transparent border-none text-xs sm:text-sm font-semibold focus:ring-0 cursor-pointer text-slate-800 outline-none truncate pr-1"
                >
                  <option value="all">All Exams</option>
                  {exams.map(e => (
                    <option key={e._id} value={e._id}>{e.title}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Dropdown 2: Candidate Registration Type Filter */}
            <div className="flex items-center gap-2 bg-slate-50/80 hover:bg-slate-50 focus-within:bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-2xs transition-colors flex-1 sm:flex-initial sm:min-w-[210px] focus-within:border-slate-800 focus-within:ring-2 focus-within:ring-slate-900/10">
              <Users size={14} className="text-slate-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <select
                  value={candidateTypeFilter}
                  onChange={(e) => setCandidateTypeFilter(e.target.value as "all" | "institute" | "public")}
                  className="w-full bg-transparent border-none text-xs sm:text-sm font-semibold focus:ring-0 cursor-pointer text-slate-800 outline-none truncate pr-1"
                >
                  <option value="all">All Candidates</option>
                  <option value="institute">Enrolled Aspirants (Institute)</option>
                  <option value="public">External / Public Candidates</option>
                </select>
              </div>
            </div>

            {/* Reset Filter Button */}
            {(search || examId || candidateTypeFilter !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setSearch("")
                  setCandidateTypeFilter("all")
                  if (examId) router.push("/admin/results")
                }}
                className="px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                title="Reset all filters and search"
              >
                <X size={13} />
                <span>Reset</span>
              </button>
            )}
          </div>

          {/* Right: Counter badge */}
          <div className="text-xs font-medium text-slate-400 shrink-0 text-left md:text-right pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
            Showing <span className="font-bold text-slate-800">{filteredResults.length}</span> of <span className="font-semibold text-slate-600">{results.length}</span> attempts
          </div>
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
            {filteredResults.length}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {candidateTypeFilter === "public"
              ? "External public attempts"
              : candidateTypeFilter === "institute"
              ? "Enrolled aspirant attempts"
              : examId
              ? "Selected exam"
              : "Across all active exams"}
          </p>
        </div>

        {/* Card 2: Passed */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs hover:shadow-sm transition-all">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
            Passed Aspirants
          </p>
          <p className="text-2xl sm:text-3xl font-extrabold text-[#324158] tracking-tight">
            {passed}
          </p>
          <p className="text-xs text-slate-500 font-medium mt-1">
            {filteredResults.length > 0 ? `${Math.round((passed / filteredResults.length) * 100)}% Pass Rate` : "No attempts yet"}
          </p>
        </div>

        {/* Card 3: Failed / Retake */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs hover:shadow-sm transition-all">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
            Failed / Retake
          </p>
          <p className="text-2xl sm:text-3xl font-extrabold text-[#324158] tracking-tight">
            {filteredResults.length - passed}
          </p>
          <p className="text-xs text-slate-500 font-medium mt-1">
            {filteredResults.length > 0 ? `${Math.round(((filteredResults.length - passed) / filteredResults.length) * 100)}% Below Passing` : "0% Fail Rate"}
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
                {["Aspirant", "Exam", "Score", "Result", "Grading", "Warnings", "Submitted", "Actions"].map((h) => (
                  <th key={h} className={`text-xs font-semibold text-gray-400 uppercase tracking-wider px-5 py-4 ${h === "Actions" ? "text-right" : "text-left"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredResults.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-16 text-gray-400 text-sm">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-1">
                        <Search size={22} />
                      </div>
                      <p className="font-semibold text-slate-700 text-sm">No results match your criteria</p>
                      <p className="text-xs text-gray-400 max-w-sm">
                        {search
                          ? `No candidates match "${search}". Try adjusting your search query.`
                          : "No candidate attempts found for the selected filter combination."}
                      </p>
                      {(search || examId || candidateTypeFilter !== "all") && (
                        <button
                          type="button"
                          onClick={() => {
                            setSearch("")
                            setCandidateTypeFilter("all")
                            if (examId) router.push("/admin/results")
                          }}
                          className="mt-1 text-xs text-primary font-semibold hover:underline cursor-pointer"
                        >
                          Clear all filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
              {filteredResults.map((r) => {
                const warningCount = r.proctoring?.warnings || 0
                return (
                <tr key={r._id} className="border-b border-gray-50 hover:bg-gray-50 last:border-0">
                  <td className="px-5 py-4">
                    <button
                      type="button"
                      onClick={() => setProfileResult(r)}
                      className="text-left group cursor-pointer"
                      title="View Candidate Profile"
                    >
                      <p className="text-sm font-medium text-foreground group-hover:text-primary group-hover:underline">
                        {r.studentName}
                      </p>
                    </button>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      <span className="text-xs text-gray-400">{r.rollNumber}</span>
                      {r.candidateType === "public" ? (
                        <button
                          type="button"
                          onClick={() => setProfileResult(r)}
                          className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200/80 px-2 py-0.5 rounded-full cursor-pointer transition-colors"
                          title="Open Public Candidate Profile"
                        >
                          <Globe size={10} className="shrink-0" />
                          Public Candidate
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                          <Users size={10} className="shrink-0" />
                          Enrolled
                        </span>
                      )}
                    </div>
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
                  <td className="px-5 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center whitespace-nowrap text-[11px] font-semibold px-2.5 py-1 rounded-full border ${
                        warningCount > 0
                          ? "text-amber-800 bg-amber-50 border-amber-200/80"
                          : "text-slate-600 bg-slate-50 border-slate-200/80"
                      }`}
                    >
                      {warningCount === 0
                        ? "No warnings"
                        : `${warningCount} ${warningCount === 1 ? "warning" : "warnings"}`}
                    </span>
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap text-[11px] font-medium text-gray-500">
                    {r.submittedAt ? new Date(r.submittedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <ResultActionMenu result={r} onViewProfile={() => setProfileResult(r)} />
                  </td>
                </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
      {profileResult && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[2px] flex items-center justify-center p-4"
          onClick={() => setProfileResult(null)}
        >
          <div
            className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 bg-[#131B2A] text-white flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center text-sm font-bold shrink-0">
                  {profileResult.studentName?.charAt(0).toUpperCase() || <User size={18} />}
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm sm:text-base font-bold truncate">
                    {profileResult.studentName}
                  </h2>
                  <div className="flex items-center gap-2 mt-0.5">
                    {profileResult.candidateType === "public" ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-blue-500/20 text-blue-200 px-2 py-0.5 rounded-full">
                        <Globe size={10} /> Public Exam Applicant
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-white/15 text-slate-200 px-2 py-0.5 rounded-full">
                        <Users size={10} /> Enrolled Aspirant
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setProfileResult(null)}
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                aria-label="Close profile"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="rounded-xl border border-slate-200/90 bg-slate-50/70 divide-y divide-slate-200/70 text-xs">
                <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                  <span className="inline-flex items-center gap-1.5 text-slate-500 font-medium shrink-0">
                    <Mail size={13} className="text-slate-400" /> Email
                  </span>
                  <span className="font-semibold text-slate-800 break-all text-right">
                    {profileResult.studentEmail || "—"}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                  <span className="inline-flex items-center gap-1.5 text-slate-500 font-medium shrink-0">
                    <Phone size={13} className="text-slate-400" /> Mobile Number
                  </span>
                  <span className="font-semibold text-slate-800 text-right">
                    {profileResult.studentPhone || "Not provided"}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                  <span className="inline-flex items-center gap-1.5 text-slate-500 font-medium shrink-0">
                    <Hash size={13} className="text-slate-400" /> Roll / Applicant ID
                  </span>
                  <span className="font-semibold text-slate-800 text-right">
                    {profileResult.rollNumber || "—"}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                  <span className="inline-flex items-center gap-1.5 text-slate-500 font-medium shrink-0">
                    <Award size={13} className="text-slate-400" /> Exam
                  </span>
                  <span className="font-semibold text-slate-800 text-right truncate max-w-[220px]" title={profileResult.examTitle}>
                    {profileResult.examTitle}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                  <span className="inline-flex items-center gap-1.5 text-slate-500 font-medium shrink-0">
                    <Calendar size={13} className="text-slate-400" /> Submitted
                  </span>
                  <span className="font-semibold text-slate-800 text-right">
                    {profileResult.submittedAt
                      ? new Date(profileResult.submittedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
                      : "—"}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2.5 text-center">
                <div className="rounded-xl border border-slate-200 p-2.5">
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Score</p>
                  <p className="text-sm font-bold text-slate-900 mt-0.5">
                    {profileResult.score ?? "—"} / {profileResult.maxScore ?? "—"}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 p-2.5">
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Percentage</p>
                  <p className="text-sm font-bold text-slate-900 mt-0.5">
                    {profileResult.percentage ?? "—"}%
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 p-2.5">
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Warnings</p>
                  <p className="text-sm font-bold text-slate-900 mt-0.5">
                    {profileResult.proctoring?.warnings || 0}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                <Link
                  href={`/admin/results/${profileResult._id}`}
                  onClick={() => setProfileResult(null)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <ShieldAlert size={13} /> Proctoring
                </Link>
                <Link
                  href={`/admin/results/${profileResult._id}/review`}
                  onClick={() => setProfileResult(null)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <Award size={13} /> Review &amp; Grade
                </Link>
                {profileResult.examId && (
                  <Link
                    href={`/exam/${profileResult.examId}/result/analytics?attemptId=${profileResult._id}`}
                    target="_blank"
                    onClick={() => setProfileResult(null)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#131B2A] hover:bg-[#1f293d] text-xs font-semibold text-white transition-colors"
                  >
                    <span>Analytics</span>
                    <ExternalLink size={12} />
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

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
