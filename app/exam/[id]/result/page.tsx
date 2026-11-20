"use client"

import { useState, useEffect, use } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import {
  CheckCircle2, XCircle, Award, Clock, BarChart2,
  BookOpen, TrendingUp, Target, Home
} from "lucide-react"
import { ProcrentureLogo } from "@/components/exam/ExamShared"

interface SectionResult {
  name: string
  type: string
  attempted: number
  total: number
  correctOrMarked: number
  score: number
  maxScore: number
}

interface AttemptResult {
  _id: string
  examId: {
    _id: string
    title: string
    totalMarks: number
    passMarks: number
    duration: number
    sections?: any[]
    institute?: { name: string; code?: string; logo?: string | null; themeColor?: string }
  }
  studentName: string
  rollNumber: string
  score: number
  maxScore: number
  percentage: number
  passed: boolean
  timeSpent: number
  submittedAt: string
  status: "in-progress" | "submitted" | "auto-submitted" | "graded"
  isGraded?: boolean
  sectionResults?: SectionResult[]
  totalQuestions?: number
  answers: { questionId: string; sectionType: string; answer: string | string[]; correct?: boolean; marks?: number }[]
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m + "m " + s + "s"
}

export default function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const searchParams = useSearchParams()
  const attemptId = searchParams.get("attemptId")
  const router = useRouter()

  const [result, setResult] = useState<AttemptResult | null>(null)
  const [showResults, setShowResults] = useState(true)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!attemptId) {
      router.push("/exam/")
      return
    }
    fetch("/api/attempts/" + attemptId)
      .then((r) => r.json())
      .then((data) => {
        setResult(data.attempt)
        setShowResults(data.showResults ?? true)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [id, attemptId, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9FD]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#131B2A] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-500 font-medium tracking-wide text-sm">Fetching your results...</p>
        </div>
      </div>
    )
  }

  if (!result) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9FD] p-6">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-sm border border-slate-100 text-center">
          <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <XCircle className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">No Result Found</h2>
          <p className="text-slate-500 mb-8 text-sm">We couldn't find the results for this attempt. It might still be processing.</p>
          <Link
            href="/exam"
            className="flex items-center justify-center gap-2 w-full py-3 bg-[#131B2A] text-white rounded-xl font-semibold hover:bg-slate-800 transition-colors"
          >
            <Home className="w-4 h-4" />
            Back to Exams
          </Link>
        </div>
      </div>
    )
  }

  const scorePercentage = result.percentage ?? (result.maxScore > 0 ? (result.score / result.maxScore) * 100 : 0)
  const safePercentage = Math.min(100, Math.max(0, scorePercentage))
  const radius = 38
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (circumference * safePercentage) / 100

  return (
    <div className="min-h-screen bg-[#F8F9FD] text-slate-800">
      {/* ─── Top Header ─── */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            {result.examId?.institute?.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={result.examId.institute.logo}
                alt={result.examId.institute.name || "Institute"}
                className="h-8 sm:h-11 max-w-[130px] sm:max-w-[220px] object-contain"
              />
            ) : result.examId?.institute?.name ? (
              <div className="flex items-center gap-2">
                <div
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs sm:text-sm shrink-0"
                  style={{ backgroundColor: result.examId.institute.themeColor || "#131B2A" }}
                >
                  {result.examId.institute.name.charAt(0).toUpperCase()}
                </div>
                <span className="font-bold text-xs sm:text-base text-slate-900 line-clamp-1">
                  {result.examId.institute.name}
                </span>
              </div>
            ) : (
              <div className="scale-85 sm:scale-100 origin-left">
                <ProcrentureLogo />
              </div>
            )}
          </div>

          <div className="flex items-center gap-2.5 sm:gap-4">
            <div className="flex flex-col items-end">
              <span className="text-[8px] sm:text-[9px] font-semibold text-slate-400 uppercase tracking-widest leading-none mb-1">
                CANDIDATE
              </span>
              <span className="text-xs sm:text-[13px] font-bold text-slate-900 max-w-[100px] sm:max-w-none truncate leading-none">
                {result.studentName}
              </span>
            </div>
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#131B2A] flex items-center justify-center overflow-hidden shrink-0 shadow-sm border border-slate-100">
              <span className="text-xs font-bold text-white">
                {result.studentName.charAt(0).toUpperCase()}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* ─── Main Content ─── */}
      <main className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 py-4 sm:py-7">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
          {/* ─── Left Main Card (Exam Attempt Finished + 4 Metric Cards) ─── */}
          <div className="lg:col-span-7 xl:col-span-8 bg-white rounded-3xl p-5 sm:p-7 border border-slate-100/90 shadow-[0_2px_16px_rgba(0,0,0,0.03)] relative overflow-hidden flex flex-col justify-between">
            {/* Subtle aesthetic gradient in top right */}
            <div className="absolute top-0 right-0 w-72 h-72 bg-gradient-to-br from-blue-50/50 via-indigo-50/20 to-transparent rounded-full -mr-24 -mt-24 blur-2xl pointer-events-none" />

            {/* Top row: Icon + Title & Subtitle */}
            <div className="relative flex items-center gap-3.5">
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full border border-blue-100 bg-blue-50/40 flex items-center justify-center text-slate-700 shrink-0">
                <Award className="w-5 h-5 sm:w-6 sm:h-6 text-slate-700" strokeWidth={1.75} />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-lg sm:text-xl font-bold text-slate-900 leading-tight">
                  Exam Attempt Finished
                </h1>
                <p className="text-[11px] sm:text-xs text-slate-400 font-normal mt-0.5 truncate">
                  {result.examId.title} • {new Date(result.submittedAt).toLocaleDateString()}
                </p>
              </div>
            </div>

            {/* Horizontal divider */}
            <div className="border-t border-slate-100 my-5 sm:my-6 relative" />

            {/* 4 Metrics in a row / responsive grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3.5 relative">
              {/* Metric 1: Final Score */}
              <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 sm:p-4 flex flex-col items-center justify-center text-center shadow-2xs hover:border-slate-300 transition-colors">
                <div className="w-7 h-7 rounded-full border border-slate-200/90 flex items-center justify-center text-slate-600 mb-2">
                  <Target className="w-3.5 h-3.5 text-slate-700" strokeWidth={2} />
                </div>
                <span className="text-[10px] sm:text-[11px] text-slate-400 font-medium">Final Score</span>
                <span className="text-sm sm:text-base font-bold text-slate-900 mt-0.5">
                  {showResults ? `${result.score} / ${result.maxScore}` : "Hidden"}
                </span>
              </div>

              {/* Metric 2: Percentage */}
              <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 sm:p-4 flex flex-col items-center justify-center text-center shadow-2xs hover:border-slate-300 transition-colors">
                <div className="w-7 h-7 rounded-full border border-slate-200/90 flex items-center justify-center text-slate-600 mb-2">
                  <Award className="w-3.5 h-3.5 text-slate-700" strokeWidth={2} />
                </div>
                <span className="text-[10px] sm:text-[11px] text-slate-400 font-medium">Percentage</span>
                <span className="text-sm sm:text-base font-bold text-slate-900 mt-0.5">
                  {showResults ? `${scorePercentage.toFixed(1)}%` : "Hidden"}
                </span>
              </div>

              {/* Metric 3: Time Taken */}
              <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 sm:p-4 flex flex-col items-center justify-center text-center shadow-2xs hover:border-slate-300 transition-colors">
                <div className="w-7 h-7 rounded-full border border-slate-200/90 flex items-center justify-center text-slate-600 mb-2">
                  <Clock className="w-3.5 h-3.5 text-slate-700" strokeWidth={2} />
                </div>
                <span className="text-[10px] sm:text-[11px] text-slate-400 font-medium">Time Taken</span>
                <span className="text-sm sm:text-base font-bold text-slate-900 mt-0.5">
                  {formatTime(result.timeSpent)}
                </span>
              </div>

              {/* Metric 4: Status */}
              <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 sm:p-4 flex flex-col items-center justify-center text-center shadow-2xs hover:border-slate-300 transition-colors">
                <div className="w-7 h-7 rounded-full border border-slate-200/90 flex items-center justify-center text-slate-600 mb-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-slate-700" strokeWidth={2} />
                </div>
                <span className="text-[10px] sm:text-[11px] text-slate-400 font-medium">Status</span>
                <span className="inline-flex items-center mt-0.5 px-2.5 py-0.5 rounded-full text-[11px] sm:text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-100">
                  Completed
                </span>
              </div>
            </div>
          </div>

          {/* ─── Right Column (Performance Summary & Dark Navy Insights) ─── */}
          <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-4 sm:gap-5">
            {/* Card 1: Performance Summary */}
            <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-100 shadow-[0_2px_16px_rgba(0,0,0,0.03)] flex items-center gap-4 sm:gap-5">
              {/* Circular Donut Ring */}
              <div className="relative w-20 h-20 sm:w-24 sm:h-24 shrink-0">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r={radius}
                    stroke="#F1F5F9"
                    strokeWidth="8"
                    fill="transparent"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r={radius}
                    stroke="#131B2A"
                    strokeWidth="8"
                    strokeDasharray={circumference}
                    strokeDashoffset={showResults ? strokeDashoffset : circumference}
                    strokeLinecap="round"
                    fill="transparent"
                    className="transition-all duration-1000 ease-out"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-lg sm:text-xl font-bold text-slate-900 leading-none">
                    {showResults ? `${Math.round(scorePercentage)}%` : "—"}
                  </span>
                  <span className="text-[9px] text-slate-400 font-medium mt-0.5 uppercase tracking-wider">
                    Aggregate
                  </span>
                </div>
              </div>

              {/* Summary Description */}
              <div className="flex-1 min-w-0">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 mb-1">
                  Performance Summary
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-500 leading-relaxed font-normal">
                  {showResults ? (
                    scorePercentage >= 70
                      ? "Outstanding performance! You've demonstrated a strong command over the subject matter."
                      : scorePercentage >= 40
                      ? "Good effort. You've cleared the basics but there's significant room for growth."
                      : "You might want to revisit the core concepts and try the practice evaluations."
                  ) : (
                    "Your exam attempt has been recorded and submitted. Results will be published soon."
                  )}
                </p>
              </div>
            </div>

            {/* Card 2: Performance Insights (Dark Navy Card) */}
            <div className="bg-[#131B2A] rounded-3xl p-5 sm:p-6 text-white relative overflow-hidden shadow-md flex flex-col justify-between min-h-[145px]">
              {/* Subtle Arrow Watermark in top right */}
              <TrendingUp
                className="w-20 h-20 text-white/5 absolute -top-1 -right-1 pointer-events-none stroke-1"
              />

              <div className="relative">
                <div className="flex items-start gap-3 mb-2.5 sm:mb-3">
                  <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center shrink-0 text-white">
                    <BarChart2 className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm sm:text-base font-bold text-white mb-0.5">
                      Performance Insights
                    </h4>
                    <p className="text-[11px] sm:text-xs text-white/70 leading-relaxed">
                      Unlock deep analytics, AI-powered recommendations, and peer benchmarking.
                    </p>
                  </div>
                </div>
              </div>

              <div className="relative pt-0.5">
                <Link
                  href={`/exam/${id}/result/analytics?attemptId=${attemptId}`}
                  className="inline-flex items-center gap-1.5 bg-white text-[#324158] hover:bg-slate-100 font-semibold text-xs px-4 py-2 rounded-full transition-all shadow-sm hover:shadow active:scale-[0.99] cursor-pointer"
                >
                  <span>Access Analytics</span>
                  <span className="text-sm leading-none">→</span>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Bottom Section: Sectional Performance ─── */}
        <div className="mt-5 sm:mt-7 space-y-3.5">
          <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-slate-100 shadow-[0_2px_16px_rgba(0,0,0,0.03)] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                Sectional Performance
              </h2>
              <p className="text-[11px] text-slate-400 font-normal mt-0.5">
                Detailed breakdown of your strengths
              </p>
            </div>
            <Link
              href={`/exam/${id}/result/analytics?attemptId=${attemptId}`}
              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline"
            >
              <span>View Comprehensive Analytics</span>
              <span className="text-sm leading-none">→</span>
            </Link>
          </div>

          {/* Sectional cards grid if sectionResults exist */}
          {showResults && result.sectionResults && result.sectionResults.length > 0 && (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {result.sectionResults.map((section, idx) => (
                <div
                  key={idx}
                  className="bg-white rounded-2xl p-4 border border-slate-100 shadow-2xs hover:shadow-xs transition-shadow"
                >
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center border border-slate-100">
                        <BookOpen className="w-3.5 h-3.5 text-slate-700" />
                      </div>
                      <div>
                        <h3 className="text-xs font-bold text-slate-900 truncate max-w-[140px]">
                          {section.name}
                        </h3>
                        <span className="text-[9px] text-slate-400 uppercase tracking-wider font-semibold">
                          {section.type}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs sm:text-sm font-bold text-slate-900">
                        {section.score}/{section.maxScore}
                      </p>
                      <p className="text-[10px] text-slate-500 font-medium">
                        {section.maxScore > 0 ? Math.round((section.score / section.maxScore) * 100) : 0}% Accuracy
                      </p>
                    </div>
                  </div>

                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mb-2">
                    <div
                      className="h-full rounded-full bg-[#131B2A] transition-all duration-700"
                      style={{
                        width: `${section.maxScore > 0 ? Math.min(100, Math.round((section.score / section.maxScore) * 100)) : 0}%`,
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px] sm:text-[11px] font-medium text-slate-500">
                    <span>Solved {section.attempted} of {section.total}</span>
                    <span className="font-semibold text-slate-700">
                      {section.score >= section.maxScore * 0.4 ? "Excellent" : "Needs Review"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
