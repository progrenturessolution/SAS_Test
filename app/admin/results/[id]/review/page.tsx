"use client"

import { useState, useEffect, use } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { 
  ChevronLeft, Loader2, Save, User, FileText, 
  CheckCircle, XCircle, AlertTriangle, Code, 
  MessageSquare, History, Award, Check, Sparkles,
  ExternalLink, ArrowLeft, ShieldAlert
} from "lucide-react"
import { MathRenderer } from "@/components/exam/MathRenderer"

interface Section {
  name: string
  type: string
  questions: any[]
}

interface Answer {
  questionId: string
  sectionType: string
  answer: any
  correct?: boolean
  marks?: number
  manualScore?: number
  autoScore?: number
  earnedMarks?: number
  feedback?: string
  aiEvaluation?: {
    score?: number
    maxScore?: number
    verdict?: string
    whyRight?: string
    whyWrong?: string
    feedback?: string
  }
}

interface Attempt {
  _id: string
  examId: { _id: string; title: string; totalMarks: number; passMarks: number; duration: number; sections: Section[] }
  studentName: string
  rollNumber: string
  studentEmail: string
  score: number
  maxScore: number
  status: string
  answers: Answer[]
  isGraded: boolean
  submittedAt: string
  proctoring: { warnings: number; events: any[] }
}

export default function GradeAttemptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [attempt, setAttempt] = useState<Attempt | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [manualScores, setManualScores] = useState<Record<string, number>>({})
  const [success, setSuccess] = useState(false)
  const [filterType, setFilterType] = useState("all")

  useEffect(() => {
    fetch(`/api/admin/attempts/${id}/grade`)
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          console.error("Failed to fetch attempt:", data.error)
          setLoading(false)
          return
        }
        const att = data.attempt
        if (!att) {
          console.error("No attempt data returned")
          setLoading(false)
          return
        }
        setAttempt(att)
        const scores: Record<string, number> = {}
        const answers = att.answers || []
        answers.forEach((ans: any) => {
          const isAutoGradable = ans.sectionType === "mcq" || ans.sectionType === "truefalse"
          if (att.isGraded) {
            if (isAutoGradable && ans.manualScore === undefined && ans.autoScore > 0) {
              scores[ans.questionId] = ans.autoScore
            } else {
              scores[ans.questionId] = ans.manualScore !== undefined ? ans.manualScore : (ans.autoScore || 0)
            }
          } else {
            scores[ans.questionId] = ans.autoScore !== undefined ? ans.autoScore : (ans.earnedMarks || 0)
          }
        })
        setManualScores(scores)
        setLoading(false)
      })
      .catch(err => {
        console.error("Error fetching attempt:", err)
        setLoading(false)
      })
  }, [id])

  const handleScoreChange = (qId: string, val: string, max: number) => {
    if (val === "" || val === "-") {
      setManualScores(prev => ({ ...prev, [qId]: val as any }))
      return
    }
    const num = parseFloat(val)
    if (isNaN(num)) return
    setManualScores(prev => ({ ...prev, [qId]: Math.min(Math.max(-max, num), max) }))
  }

  const saveGrades = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/attempts/${id}/grade`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: Object.entries(manualScores).map(([qId, score]) => ({
            questionId: qId,
            manualScore: isNaN(parseFloat(score as any)) ? 0 : parseFloat(score as any)
          }))
        })
      })
      if (res.ok) {
        setSuccess(true)
        setTimeout(() => setSuccess(false), 3000)
        const data = await res.json()
        if (attempt) setAttempt({ ...attempt, score: data.newScore, isGraded: true, status: "graded" })
      }
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  const resetToAuto = () => {
    if (!attempt) return
    const scores: Record<string, number> = {}
    attempt.answers.forEach(ans => {
      scores[ans.questionId] = ans.autoScore || (ans.aiEvaluation?.score ?? 0)
    })
    setManualScores(scores)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9FD]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[#131B2A] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-semibold text-slate-500">Loading candidate attempt data...</p>
        </div>
      </div>
    )
  }

  if (!attempt) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8F9FD] p-6 text-center">
        <XCircle className="w-12 h-12 text-rose-400 mb-3" />
        <h2 className="text-lg font-bold text-slate-800">Attempt Not Found</h2>
        <p className="text-xs text-slate-500 mt-1 mb-4">Could not retrieve attempt record for manual grading.</p>
        <Link
          href="/admin/results"
          className="text-xs font-semibold text-slate-700 bg-white border border-slate-200 px-4 py-2 rounded-xl hover:bg-slate-50"
        >
          ← Back to Results
        </Link>
      </div>
    )
  }

  const exam = attempt.examId
  const questions = exam?.sections?.flatMap(s => s.questions.map(q => ({ ...q, sectionType: s.type }))) || []

  return (
    <div className="min-h-screen bg-[#F8F9FD] text-slate-800">
      {/* ─── Top Header ─── */}
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-30 px-4 sm:px-6 lg:px-8 py-3 sm:py-3.5 shadow-2xs">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href={`/admin/results${exam?._id ? `?examId=${exam._id}` : ""}`}
              className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-500 hover:text-slate-900 shrink-0"
              title="Back to Results"
            >
              <ArrowLeft size={18} />
            </Link>
            <div className="h-5 w-px bg-slate-200 shrink-0" />
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight leading-tight truncate">
                Review &amp; Grade — {attempt.studentName}
              </h1>
              <p className="text-[11px] text-slate-400 font-medium truncate mt-0.5">
                {exam?.title} • Roll: {attempt.rollNumber}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5 self-end sm:self-auto shrink-0">
            <button
              onClick={resetToAuto}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-100 transition-all cursor-pointer"
              title="Reset scores to automated/AI scores"
            >
              <History size={13} />
              <span>Reset Auto</span>
            </button>

            <button
              onClick={saveGrades}
              disabled={saving}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer disabled:opacity-60 ${
                success
                  ? "bg-emerald-600 text-white"
                  : "bg-[#131B2A] hover:bg-[#1f293d] active:bg-[#0d131e] text-white"
              }`}
            >
              {saving ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Saving...</span>
                </>
              ) : success ? (
                <>
                  <Check size={13} />
                  <span>Grades Saved!</span>
                </>
              ) : (
                <>
                  <Save size={13} />
                  <span>Save Grades</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* ─── Main Content ─── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-7">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
          {/* ─── Left Sidebar: Candidate Overview ─── */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white rounded-2xl sm:rounded-3xl p-5 border border-slate-200/80 shadow-2xs lg:sticky lg:top-20 space-y-5">
              {/* Profile Header */}
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-[#131B2A] text-white font-bold text-base flex items-center justify-center shrink-0 shadow-2xs">
                  {attempt.studentName?.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-slate-900 text-sm truncate">
                    {attempt.studentName}
                  </h3>
                  <p className="text-[11px] text-slate-400 font-medium truncate">
                    {attempt.studentEmail}
                  </p>
                </div>
              </div>

              {/* Status and Score Breakdown */}
              <div className="space-y-2.5 text-xs pt-1">
                <div className="flex justify-between items-center py-2 border-b border-slate-100">
                  <span className="text-slate-500 font-medium flex items-center gap-1.5">
                    <Award size={13} className="text-slate-400" /> Total Score
                  </span>
                  <span className="font-bold text-slate-900 text-sm">
                    {attempt.score} / {attempt.maxScore}
                  </span>
                </div>

                <div className="flex justify-between items-center py-2 border-b border-slate-100">
                  <span className="text-slate-500 font-medium flex items-center gap-1.5">
                    <History size={13} className="text-slate-400" /> Grading Status
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wider ${
                      attempt.isGraded
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200/70"
                        : "bg-amber-50 text-amber-700 border border-amber-200/70"
                    }`}
                  >
                    {attempt.isGraded ? "Graded" : "Needs Review"}
                  </span>
                </div>

                <div className="flex justify-between items-center py-2 border-b border-slate-100">
                  <span className="text-slate-500 font-medium flex items-center gap-1.5">
                    <ShieldAlert size={13} className="text-slate-400" /> Proctoring Alerts
                  </span>
                  <Link
                    href={`/admin/results/${attempt._id}`}
                    className="font-bold text-xs text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                  >
                    <span>{attempt.proctoring?.warnings || 0} Warnings</span>
                    <span className="text-xs">→</span>
                  </Link>
                </div>

                <div className="flex justify-between items-center py-2">
                  <span className="text-slate-500 font-medium">Submitted At</span>
                  <span className="font-medium text-slate-700 text-[11px]">
                    {attempt.submittedAt ? new Date(attempt.submittedAt).toLocaleString() : "—"}
                  </span>
                </div>
              </div>

              {/* Notice Card */}
              <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200/80 text-[11px] text-slate-600 leading-relaxed space-y-1">
                <span className="font-bold text-slate-800 block text-[10px] uppercase tracking-wider">
                  Examiner Notice
                </span>
                <p>
                  Any score changes saved here immediately update the aspirant's result report and aggregate performance.
                </p>
              </div>
            </div>
          </div>

          {/* ─── Right Content: Questions & Answers List ─── */}
          <div className="lg:col-span-8 space-y-4">
            {/* Type Filter Pills */}
            <div className="flex items-center gap-1 bg-white border border-slate-200/90 rounded-2xl p-1 shadow-2xs overflow-x-auto max-w-full">
              {["all", "descriptive", "mcq", "coding", "fillblanks"].map(type => (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all capitalize whitespace-nowrap cursor-pointer ${
                    filterType === type
                      ? "bg-[#131B2A] text-white shadow-2xs"
                      : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  {type === "all" ? "All Questions" : type}
                </button>
              ))}
            </div>

            {/* Questions Loop */}
            <div className="space-y-4">
              {questions
                .filter(q => filterType === "all" || q.type === filterType)
                .map((q, idx) => {
                  const ans = attempt.answers.find(a => a.questionId === (q._id?.toString() || q.id))
                  const currentScore = manualScores[q._id || q.id] ?? (ans?.manualScore ?? ans?.marks ?? 0)

                  return (
                    <div
                      key={q._id || q.id}
                      className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-2xs overflow-hidden flex flex-col transition-all"
                    >
                      {/* Question Header Card */}
                      <div className="px-4 sm:px-6 py-3 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#131B2A] text-white">
                            Q{idx + 1}
                          </span>
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-100">
                            {q.type}
                          </span>
                          <span className="text-xs text-slate-400 font-medium">
                            Max {q.marks} Mark{q.marks !== 1 ? "s" : ""}
                          </span>
                        </div>

                        {/* Score Input */}
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                            Awarded:
                          </span>
                          <input
                            type="number"
                            step="0.5"
                            value={currentScore}
                            onChange={(e) => handleScoreChange(q._id || q.id, e.target.value, q.marks)}
                            className="w-16 h-8 text-center text-xs sm:text-sm font-bold rounded-lg border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#131B2A]/20 transition-all shadow-2xs"
                          />
                          <span className="text-xs font-bold text-slate-400">/ {q.marks}</span>
                        </div>
                      </div>

                      {/* Question Body */}
                      <div className="p-4 sm:p-6 space-y-4">
                        {/* Question Text */}
                        <div className="text-xs sm:text-sm text-slate-900 leading-relaxed overflow-x-auto break-words">
                          <MathRenderer content={q.questionText} />
                        </div>

                        {/* Aspirant's Answer */}
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5 text-slate-500 text-[11px] font-semibold uppercase tracking-wider">
                            <span>Aspirant's Response:</span>
                          </div>

                          <div
                            className={`rounded-xl p-3.5 border ${
                              q.type === "coding"
                                ? "bg-[#131B2A] text-slate-100 font-mono text-xs overflow-x-auto"
                                : "bg-slate-50/80 border-slate-200 text-slate-800 text-xs sm:text-sm leading-relaxed"
                            }`}
                          >
                            {q.type === "coding" ? (
                              <pre className="whitespace-pre-wrap">{ans?.answer || "// No response provided"}</pre>
                            ) : q.type === "mcq" ? (
                              <div className="space-y-1">
                                <p className="font-semibold text-slate-700">
                                  Selected: <span className="font-bold text-slate-900">{ans?.answer !== undefined ? String(ans.answer) : "None"}</span>
                                </p>
                                <p className="text-emerald-700 font-semibold">
                                  Correct: <span className="font-bold">{String(q.correctAnswer)}</span>
                                </p>
                              </div>
                            ) : (
                              <p className="whitespace-pre-wrap break-words">{ans?.answer || "No response provided."}</p>
                            )}
                          </div>
                        </div>

                        {/* AI Evaluation Breakdown (For Descriptive Questions) */}
                        {q.type === "descriptive" && (
                          <div className="space-y-3 pt-1">
                            {ans?.aiEvaluation && (
                              <div className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
                                <div className="px-3.5 py-2 bg-[#131B2A] text-white flex items-center justify-between gap-2 flex-wrap">
                                  <div className="flex items-center gap-2">
                                    <Sparkles size={14} className="text-emerald-400 shrink-0" />
                                    <span className="text-xs font-semibold tracking-wide">
                                      AI Examiner Verification
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span
                                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                        (ans.aiEvaluation.score ?? 0) >= q.marks * 0.85
                                          ? "bg-emerald-500 text-white"
                                          : (ans.aiEvaluation.score ?? 0) > 0
                                          ? "bg-blue-500 text-white"
                                          : "bg-rose-500 text-white"
                                      }`}
                                    >
                                      {ans.aiEvaluation.verdict || "Evaluated"}
                                    </span>
                                    <span className="text-xs font-bold text-slate-100 bg-slate-800 px-2 py-0.5 rounded-md">
                                      AI Score: {ans.aiEvaluation.score} / {q.marks}
                                    </span>
                                  </div>
                                </div>

                                <div className="p-3.5 space-y-2.5 text-xs">
                                  {ans.aiEvaluation.whyRight && (
                                    <div className="p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-200/80 text-emerald-950">
                                      <div className="flex items-center gap-1.5 mb-1 text-emerald-900 font-semibold text-[11px]">
                                        <CheckCircle size={13} className="text-emerald-600 shrink-0" />
                                        <span>Why Aspirant is Right (Key Concepts Hit):</span>
                                      </div>
                                      <p className="leading-relaxed pl-4 break-words">{ans.aiEvaluation.whyRight}</p>
                                    </div>
                                  )}

                                  {ans.aiEvaluation.whyWrong && (
                                    <div className="p-2.5 rounded-lg bg-rose-50/70 border border-rose-200/80 text-rose-950">
                                      <div className="flex items-center gap-1.5 mb-1 text-rose-900 font-semibold text-[11px]">
                                        <XCircle size={13} className="text-rose-600 shrink-0" />
                                        <span>Why Aspirant is Wrong / Missed Points:</span>
                                      </div>
                                      <p className="leading-relaxed pl-4 break-words">{ans.aiEvaluation.whyWrong}</p>
                                    </div>
                                  )}

                                  {ans.aiEvaluation.feedback && (
                                    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-700">
                                      <span className="font-semibold block mb-0.5 text-[11px] text-slate-800">
                                        Examiner Feedback &amp; Suggestions:
                                      </span>
                                      <p className="leading-relaxed break-words">{ans.aiEvaluation.feedback}</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Model / Reference Answer */}
                            <div className="p-3.5 rounded-xl bg-purple-50/40 border border-purple-100/80 text-xs">
                              <div className="flex items-center gap-1.5 mb-1 text-purple-900 font-semibold">
                                <MessageSquare size={13} className="text-purple-600" />
                                <span className="text-[10px] uppercase tracking-wider">Model / Reference Answer</span>
                              </div>
                              <div className="text-purple-950 leading-relaxed overflow-x-auto break-words">
                                <MathRenderer
                                  content={
                                    q.correctAnswer || q.modelAnswer || q.explanation || "No model answer provided."
                                  }
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
