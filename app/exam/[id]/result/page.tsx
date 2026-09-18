"use client"

import { useState, useEffect, use } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import {
  CheckCircle2, XCircle, Award, Clock, FileText, BarChart2,
  ChevronRight, BookOpen, RefreshCw, TrendingUp,
  Home, Check, Calendar, LayoutDashboard, Mail, Bell, EyeOff, Target
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
  examId: { _id: string; title: string; totalMarks: number; passMarks: number; duration: number; sections?: any[] }
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

function StatCard({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-2xl p-4 sm:p-6 border border-gray-100/80 shadow-sm flex flex-col items-center text-center gap-3 min-w-0 w-full hover:shadow-md transition-shadow">
      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gray-50 flex items-center justify-center shrink-0 border border-gray-100">
        <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-[#2D3A4A]" />
      </div>
      <div className="min-w-0 w-full overflow-hidden">
        <p className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 truncate px-1">
          {label}
        </p>
        <p className="text-sm sm:text-xl font-black text-[#2D3A4A] leading-tight break-words">
          {value}
        </p>
      </div>
    </div>
  )
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#2D3A4A] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500 font-medium tracking-wide">Fetching your results...</p>
        </div>
      </div>
    )
  }

  if (!result) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-sm border border-gray-100 text-center">
          <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <XCircle className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">No Result Found</h2>
          <p className="text-gray-500 mb-8">We couldn't find the results for this attempt. It might still be processing.</p>
          <Link
            href="/exam"
            className="flex items-center justify-center gap-2 w-full py-3 bg-[#2D3A4A] text-white rounded-xl font-semibold hover:bg-[#1a232d] transition-colors"
          >
            <Home className="w-4 h-4" />
            Back to Exams
          </Link>
        </div>
      </div>
    )
  }

  const scorePercentage = result.percentage || (result.score / result.maxScore) * 100
  const isPassed = result.passed

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link href="/exam" className="flex items-center gap-3">
            <div className="scale-90 sm:scale-100 origin-left">
              <ProcrentureLogo />
            </div>
          </Link>

          <div className="flex items-center gap-2 sm:gap-4">
             <div className="flex flex-col items-end mr-1 sm:mr-2">
                <span className="text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">Candidate</span>
                <span className="text-xs sm:text-sm font-black text-[#2D3A4A] max-w-[80px] sm:max-w-none truncate">{result.studentName}</span>
             </div>
             <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-[#2D3A4A] flex items-center justify-center overflow-hidden shrink-0 shadow-sm border-2 border-white">
                <span className="text-xs sm:text-sm font-black text-white">{result.studentName.charAt(0).toUpperCase()}</span>
             </div>
          </div>
        </div>
      </header>

      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 h-12 flex items-center gap-3 text-xs font-bold text-gray-400">
          <Link href="/exam" className="hover:text-[#2D3A4A] transition-colors">Exams</Link>
          <span className="text-gray-200">/</span>
          <Link href={"/exam/" + id + "/results"} className="hover:text-[#2D3A4A] transition-colors">Results</Link>
          <span className="text-gray-200">/</span>
          <span className="text-[#2D3A4A]">Exam Completed</span>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="grid lg:grid-cols-3 gap-6 sm:gap-8">
          <div className="lg:col-span-2 space-y-6 sm:space-y-8">
            <div className="bg-white rounded-2xl sm:rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-100 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-[#2D3A4A]/5 rounded-full -mr-32 -mt-32 blur-3xl"></div>
              
              <div className="relative flex flex-col items-center text-center">
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gray-50 rounded-2xl flex items-center justify-center mb-8 border border-gray-100">
                  <Award className="w-8 h-8 sm:w-10 sm:h-10 text-gray-400" />
                </div>
                
                <h1 className="text-2xl sm:text-4xl font-black text-[#2D3A4A] mb-2 leading-tight">
                  Exam {isPassed ? "Successfully Completed" : "Attempt Finished"}
                </h1>
                <p className="text-gray-400 font-semibold mb-10 text-sm sm:text-base">
                  {result.examId.title} • {new Date(result.submittedAt).toLocaleDateString()}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 w-full max-w-4xl py-4">
                  <StatCard icon={Target} label="Final Score" value={result.score + " / " + result.maxScore} />
                  <StatCard icon={Award} label="Percentage" value={scorePercentage.toFixed(1) + "%"} />
                  <StatCard icon={Clock} label="Time Taken" value={formatTime(result.timeSpent)} />
                  <StatCard 
                    icon={CheckCircle2} 
                    label="Status" 
                    value={isPassed ? "Passed" : "Completed"} 
                  />
                </div>
              </div>
            </div>

            {showResults && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-[#2D3A4A]">Sectional Performance</h2>
                    <p className="text-xs sm:text-sm text-gray-500 font-medium">Detailed breakdown of your strengths</p>
                  </div>
                  <Link 
                    href={"/exam/" + id + "/result/analytics?attemptId=" + attemptId}
                    className="group inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-[#2D3A4A] hover:underline"
                  >
                    View Comprehensive Analytics
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  {(result.sectionResults || []).map((section, idx) => (
                    <div key={idx} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center border border-gray-100">
                            <BookOpen className="w-5 h-5 text-[#2D3A4A]" />
                          </div>
                          <div>
                            <h3 className="font-bold text-[#2D3A4A]">{section.name}</h3>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{section.type}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-black text-[#2D3A4A]">{section.score}/{section.maxScore}</p>
                          <p className="text-[10px] font-bold text-gray-500">{Math.round((section.score/section.maxScore)*100)}% Accuracy</p>
                        </div>
                      </div>
                      
                      <div className="w-full h-2 bg-gray-50 rounded-full overflow-hidden mb-4 p-0.5 border border-gray-100">
                        <div 
                          className="h-full rounded-full bg-[#2D3A4A] transition-all duration-1000 shadow-sm"
                          style={{ width: (section.score / section.maxScore) * 100 + "%" }}
                        ></div>
                      </div>

                      <div className="flex items-center justify-between text-[11px] font-bold">
                        <span className="text-gray-400">Solved {section.attempted} of {section.total}</span>
                        <span className="text-[#2D3A4A]">
                          {section.score >= (section.maxScore * 0.4) ? "Excellent" : "Needs Review"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 text-center">
              <div className="mb-6 relative inline-block">
                <svg className="w-40 h-40">
                  <circle
                    className="text-gray-100"
                    strokeWidth="10"
                    stroke="currentColor"
                    fill="transparent"
                    r="70"
                    cx="80"
                    cy="80"
                  />
                  <circle
                    className="text-[#2D3A4A] transition-all duration-1000"
                    strokeWidth="10"
                    strokeDasharray={440}
                    strokeDashoffset={440 - (440 * scorePercentage) / 100}
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="transparent"
                    r="70"
                    cx="80"
                    cy="80"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-4xl font-black text-[#2D3A4A]">{Math.round(scorePercentage)}%</span>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Aggregate</span>
                </div>
              </div>

              <h3 className="text-xl font-bold text-[#2D3A4A] mb-2">Performance Summary</h3>
              <p className="text-sm text-gray-500 mb-8 leading-relaxed px-4">
                {scorePercentage >= 70 
                  ? "Outstanding performance! You've demonstrated a strong command over the subject matter."
                  : scorePercentage >= 40
                  ? "Goode effort. You've cleared the basics but there's significant room for growth."
                  : "You might want to revisit the core concepts and try the practice evaluations."}
              </p>
            </div>

            <div className="bg-[#2D3A4A] rounded-3xl p-8 text-white overflow-hidden relative group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                <TrendingUp className="w-24 h-24 text-white" />
              </div>
              <h4 className="text-lg font-bold mb-2">Performance Insights</h4>
              <p className="text-white/70 text-sm mb-6 leading-relaxed">
                Unlock deep analytics, AI-powered recommendations, and peer benchmarking.
              </p>
              <Link
                href={"/exam/" + id + "/result/analytics?attemptId=" + attemptId}
                className="inline-flex items-center gap-2 text-sm font-bold bg-white/10 hover:bg-white/20 px-6 py-3 rounded-xl transition-colors backdrop-blur-sm"
              >
                Access Analytics
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
