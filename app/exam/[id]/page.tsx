"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Clock, FileText, CheckCircle, Award, User, Mail, Hash, LockKeyhole, Shield, AlertCircle, Camera, Maximize, AlertTriangle } from "lucide-react"
import { ProcrentureLogo } from "@/components/exam/ExamShared"
import { getScheduleStatus, formatCountdown, formatScheduleDateTime } from "@/lib/examSchedule"

interface ExamData {
  _id: string
  title: string
  subject: string
  class?: string
  description: string
  instructions: string[]
  duration: number
  totalMarks: number
  passMarks: number
  status: string
  sections: { name: string; questions: unknown[] }[]
  settings?: {
    startDate?: string
    startTime?: string
    endDate?: string
    endTime?: string
    proctoring?: {
      faceDetection: boolean
      tabSwitch: boolean
      fullscreen: boolean
      aiProctoring: boolean
    }
  }
}

interface ExistingAttempt {
  _id: string
  status: "in-progress" | "submitted" | "auto-submitted" | "graded"
}

async function getExam(id: string): Promise<ExamData | null> {
  try {
    const res = await fetch(`/api/exams/${id}`)
    if (!res.ok) return null
    const data = await res.json()
    return data.exam
  } catch {
    return null
  }
}

export default function ExamLoginPage({ params }: { params: Promise<{ id: string }> }) {
  const [id, setId] = useState<string>("")
  const router = useRouter()
  const [exam, setExam] = useState<ExamData | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({ name: "", email: "", roll: "", password: "", agreed: false })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [fetchError, setFetchError] = useState("")
  const [studentStats, setStudentStats] = useState<{ totalExams: number; avgScore: number } | null>(null)
  const [existingAttempt, setExistingAttempt] = useState<ExistingAttempt | null>(null)
  const [currentTime, setCurrentTime] = useState(Date.now())

  // Ticker for live scheduled exam countdown
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Resolve params then fetch exam
  useEffect(() => {
    params.then(({ id: resolvedId }) => {
      setId(resolvedId)
      getExam(resolvedId).then((e) => {
        setExam(e)
        setLoading(false)
        if (!e) setFetchError("Exam not found or has been removed.")
      })
    })
  }, [params])

  // Fetch student stats when email/roll changed
  useEffect(() => {
    const fetchStats = async () => {
      if (form.email?.includes("@") && form.roll?.length > 2) {
        try {
          const res = await fetch(`/api/auth/stats?email=${form.email}&roll=${form.roll}`)
          if (res.ok) {
            const data = await res.json()
            setStudentStats(data.stats)
          }
        } catch (err) {
          console.error("Failed to fetch stats", err)
        }
      }
    }
    const timer = setTimeout(fetchStats, 1000)
    return () => clearTimeout(timer)
  }, [form.email, form.roll])

  const totalQuestions = exam?.sections?.reduce((s, sec) => s + (sec.questions?.length || 0), 0) || 0
  const schedule = getScheduleStatus(exam?.settings, currentTime)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Strict Time-Windowed Access Check (allow access within 5-min setup window)
    if (!schedule.canEnterSetup && schedule.startDt) {
      const setupTime = new Date(schedule.startDt.getTime() - 5 * 60 * 1000)
      setErrors({
        submit: `Camera setup opens 5 minutes prior to the exam (at ${setupTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })}). Exam begins at ${formatScheduleDateTime(schedule.startDt)}.`
      })
      return
    }
    if (schedule.isAfterEnd && schedule.endDt) {
      setErrors({ submit: `This exam has ended and is no longer available. It ended at ${formatScheduleDateTime(schedule.endDt)}.` })
      return
    }

    const newErrors: Record<string, string> = {}
    if (!form.name.trim()) newErrors.name = "Full name is required"
    if (!form.email.trim()) newErrors.email = "Email address is required"
    if (!form.roll.trim()) newErrors.roll = "Roll number is required"
    if (!form.password) newErrors.password = "Exam password is required"
    if (!form.agreed) newErrors.agreed = "You must agree to the exam rules"
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          examId: id,
          studentName: form.name,
          studentEmail: form.email,
          rollNumber: form.roll,
          password: form.password,
        }),
      })
      const data = await res.json()
      if (data.alreadySubmitted && data.attempt?._id) {
        setExistingAttempt(data.attempt)
        setErrors({})
        setSubmitting(false)
        return
      }
      if (!res.ok) throw new Error(data.error || "Failed to start exam")
      router.push(`/exam/${id}/take?attemptId=${data.attempt._id}`)
    } catch (err) {
      setErrors({ submit: (err as Error).message })
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-[#2D3A4A] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Loading exam details...</p>
        </div>
      </div>
    )
  }

  if (fetchError || !exam) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
        <AlertCircle size={40} className="text-red-400" />
        <h1 className="text-xl font-bold text-gray-800">Exam Not Found</h1>
        <p className="text-gray-500 text-sm">{fetchError}</p>
        <Link href="/" className="text-[#10B981] underline text-sm">Go back to home</Link>
      </div>
    )
  }

  const instructions = exam.instructions?.length
    ? exam.instructions
    : [
        "Read each question carefully before answering. All questions are compulsory.",
        "Do not refresh or close the browser during the exam. Your progress is auto-saved.",
        "You can navigate between questions using the question palette on the right.",
        'Click "Submit Exam" only when you have completed all questions.',
      ]

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <header className="bg-white border-b border-gray-200 px-4 sm:px-8 py-4 flex items-center justify-between sticky top-0 z-50">
        <ProcrentureLogo />
        <button className="hidden sm:block px-5 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 transition-colors">
          Need Help?
        </button>
        <button className="sm:hidden p-2 text-gray-500">
          <Hash size={20} />
        </button>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10 grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-6 sm:gap-8 items-start">
        {/* Left */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-8 shadow-sm">
          <div className="mb-6">
            <span className="inline-block bg-primary/10 text-primary text-[10px] sm:text-xs font-bold px-3 py-1.5 rounded-full mb-3 tracking-wider uppercase ring-1 ring-primary/20">
              Online Examination
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1a2535] mb-2 leading-tight">{exam.title}</h1>
            {exam.class && <p className="text-gray-500 font-medium">{exam.class}</p>}
            {exam.description && <p className="text-gray-500 text-sm mt-2 leading-relaxed">{exam.description}</p>}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-8">
            {[
              { icon: Clock, label: "Duration", value: `${exam.duration}m`, fullValue: `${exam.duration} Minutes` },
              { icon: FileText, label: "Questions", value: `${totalQuestions} Qs`, fullValue: `${totalQuestions} Questions` },
              { icon: Award, label: "Total", value: `${exam.totalMarks}`, fullValue: `${exam.totalMarks} Marks` },
              { icon: CheckCircle, label: "Pass", value: `${exam.passMarks}`, fullValue: `${exam.passMarks} Marks`, highlight: true, color: "text-primary", bg: "bg-primary/5", border: "border-primary" },
            ].map(({ icon: Icon, label, value, fullValue, highlight, color, bg, border }) => (
              <div key={label} className={`border rounded-xl p-3 sm:p-4 ${highlight ? `${border} ${bg}` : "border-gray-100 bg-gray-50/50"}`}>
                <Icon className={`w-4 h-4 sm:w-5 sm:h-5 mb-2 ${highlight ? color : "text-gray-400"}`} />
                <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5 font-bold uppercase tracking-wider">{label}</p>
                <p className={`font-bold text-xs sm:text-sm ${highlight ? color : "text-[#1a2535]"}`}>
                  <span className="sm:hidden">{value}</span>
                  <span className="hidden sm:inline">{fullValue}</span>
                </p>
              </div>
            ))}
          </div>

          {exam.settings?.proctoring && (
            <div className="mb-6 p-4 bg-gray-50 border border-gray-100 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <Shield size={16} className="text-primary" />
                <span className="text-sm font-semibold text-primary uppercase tracking-wide">Security Protocols Active</span>
              </div>
              <div className="flex flex-wrap gap-2 text-primary">
                {exam.settings.proctoring.faceDetection && (
                  <div className="flex items-center gap-2 text-[11px] font-bold bg-white border border-gray-200 px-3 py-1.5 rounded-lg shadow-sm">
                    <Camera size={12} />
                    FACE DETECTION
                  </div>
                )}
                {exam.settings.proctoring.tabSwitch && (
                  <div className="flex items-center gap-2 text-[11px] font-bold bg-white border border-gray-200 px-3 py-1.5 rounded-lg shadow-sm">
                    <AlertTriangle size={12} />
                    ANTI TAB-SWITCH
                  </div>
                )}
                {exam.settings.proctoring.fullscreen && (
                  <div className="flex items-center gap-2 text-[11px] font-bold bg-white border border-gray-100 px-3 py-1.5 rounded-lg shadow-sm">
                    <Maximize size={12} />
                    FORCED FULLSCREEN
                  </div>
                )}
                {exam.settings.proctoring.aiProctoring && (
                  <div className="flex items-center gap-2 text-[11px] font-bold bg-white border border-gray-100 px-3 py-1.5 rounded-lg shadow-sm">
                    <Shield size={12} />
                    AI MONITORING
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="mb-8">
            <h2 className="text-lg font-bold text-[#1a2535] mb-3">About This Exam</h2>
            <p className="text-sm text-gray-500 leading-relaxed">
              {exam.description || `This examination covers the ${exam.subject} curriculum. The exam is designed to assess your understanding and problem-solving abilities.`}
            </p>
          </div>

          {/* Instructions */}
          <div className="bg-gray-50/50 rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 bg-primary flex items-center justify-between">
              <h2 className="text-sm font-bold text-white uppercase tracking-widest">Exam Instructions</h2>
              <div className="hidden sm:flex items-center gap-1.5 bg-white/10 px-2 py-1 rounded text-[10px] font-bold text-white/80 border border-white/10">
                READ CAREFULLY
              </div>
            </div>
            <div className="p-3 sm:p-4 grid gap-3">
              {instructions.map((text, i) => (
                <div key={i} className="flex items-start gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl bg-white border border-gray-100 shadow-sm transition-all hover:border-primary/20 group">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-primary/5 flex items-center justify-center text-[10px] sm:text-xs font-black text-primary shrink-0 group-hover:bg-primary group-hover:text-white transition-colors">
                    {i + 1}
                  </div>
                  <p className="text-xs sm:text-sm text-[#45505F] font-medium leading-relaxed pt-1 sm:pt-1.5">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right - Form */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 lg:sticky lg:top-24">
          <h2 className="text-xl font-bold text-[#1a2535] mb-1">Student Registration</h2>
          <p className="text-sm text-gray-500 mb-6 font-medium">Please enter your details to start the exam</p>

          {/* Schedule Status Banner */}
          {/* Schedule Status Banner: More than 5 mins before start */}
          {schedule.isBeforeStart && !schedule.canEnterSetup && schedule.startDt && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl shadow-sm">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock size={14} className="animate-pulse text-amber-600" /> Exam Not Started Yet
                </span>
                <span className="text-xs font-mono font-black text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-300">
                  Starts in {formatCountdown(schedule.secondsUntilStart)}
                </span>
              </div>
              <p className="text-xs text-amber-700 font-medium">
                Starts on <strong className="font-semibold text-amber-900">{formatScheduleDateTime(schedule.startDt)}</strong>. Camera setup opens 5 minutes before the exam in <strong className="font-semibold text-amber-900">{formatCountdown(schedule.secondsUntilSetup)}</strong>.
              </p>
            </div>
          )}

          {/* Schedule Status Banner: Within 5-min Early Setup Window */}
          {schedule.isBeforeStart && schedule.canEnterSetup && schedule.startDt && (
            <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl shadow-sm">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Camera size={14} className="text-emerald-600 animate-pulse" /> Camera Setup Open
                </span>
                <span className="text-xs font-mono font-black text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300">
                  Exam in {formatCountdown(schedule.secondsUntilStart)}
                </span>
              </div>
              <p className="text-xs text-emerald-700 font-medium">
                You can now proceed to test your camera and review proctoring rules. The exam paper unlocks automatically at <strong className="font-semibold text-emerald-950">{formatScheduleDateTime(schedule.startDt)}</strong>.
              </p>
            </div>
          )}

          {schedule.isAfterEnd && schedule.endDt && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl shadow-sm">
              <div className="flex items-center gap-2 text-xs font-bold text-red-800 uppercase tracking-wider mb-1">
                <AlertCircle size={14} className="text-red-600" /> Examination Closed
              </div>
              <p className="text-xs text-red-700 font-medium">
                This examination closed on <strong className="font-semibold text-red-900">{formatScheduleDateTime(schedule.endDt)}</strong> and is no longer accepting new attempts.
              </p>
            </div>
          )}

          {schedule.canStart && schedule.endDt && (
            <div className="mb-6 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-800">
              <div className="flex items-center gap-2">
                <Clock size={13} className="text-emerald-600" />
                <span>
                  Closes & auto-submits at: <strong className="font-semibold text-emerald-950">{formatScheduleDateTime(schedule.endDt)}</strong>
                </span>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-600 text-white px-2 py-0.5 rounded-full">
                Active
              </span>
            </div>
          )}

          {studentStats && studentStats.totalExams > 0 && (
            <div className="mb-6 bg-primary p-5 rounded-xl border border-primary/20 text-white shadow-lg flex items-center justify-between">
              <div>
                <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1">Your Quick Stats</h3>
                <div className="flex gap-4">
                  <div>
                    <span className="block text-xl font-bold">{studentStats.totalExams}</span>
                    <span className="text-[10px] text-gray-400">Exams Taken</span>
                  </div>
                  <div className="w-px bg-gray-600 h-8 mt-1" />
                  <div>
                    <span className="block text-xl font-bold text-[#10B981]">{studentStats.avgScore}%</span>
                    <span className="text-[10px] text-gray-400">Avg. Score</span>
                  </div>
                </div>
              </div>
              <div className="bg-white/10 p-2.5 rounded-lg border border-white/20">
                <User className="w-5 h-5 text-white" />
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {[
              { key: "name", label: "Full Name", icon: User, type: "text", placeholder: "Enter your full name" },
              { key: "email", label: "Email Address", icon: Mail, type: "email", placeholder: "Enter your email address" },
              { key: "roll", label: "Roll Number", icon: Hash, type: "text", placeholder: "Enter your roll number" },
              { key: "password", label: "Exam Password", icon: LockKeyhole, type: "password", placeholder: "Enter the password given by your organization" },
            ].map(({ key, label, icon: Icon, type, placeholder }) => (
              <div key={key}>
                <label className="block text-sm font-semibold text-[#1a2535] mb-1.5">
                  {label} <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Icon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 font-bold" />
                  <input
                    type={type}
                    placeholder={placeholder}
                    value={form[key as keyof typeof form] as string}
                    onChange={(e) => {
                      setForm({ ...form, [key]: e.target.value })
                      setErrors({ ...errors, [key]: "" })
                      setExistingAttempt(null)
                    }}
                    className={`w-full pl-12 pr-4 py-3.5 bg-gray-50 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all font-medium ${errors[key] ? "border-red-300 bg-red-50" : "border-gray-100"}`}
                  />
                </div>
                {errors[key] && <p className="text-xs text-red-500 mt-1">{errors[key]}</p>}
              </div>
            ))}

            <div>
              <label className="flex items-start gap-3 cursor-pointer group">
                <input type="checkbox" checked={form.agreed} onChange={(e) => setForm({ ...form, agreed: e.target.checked })} className="mt-1 w-4 h-4 rounded border-gray-300 accent-primary" />
                <span className="text-xs text-gray-500 group-hover:text-primary transition-colors leading-relaxed">I confirm that I have read the instructions and agree to follow the exam guidelines.</span>
              </label>
              {errors.agreed && <p className="text-xs text-red-500 mt-1">{errors.agreed}</p>}
            </div>

            {errors.submit && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 font-medium">{errors.submit}</div>
            )}
            {existingAttempt && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-bold text-amber-800">You have already taken this exam.</p>
                <p className="mt-1 text-xs text-amber-700">
                  You cannot take this exam again. View your result and comprehensive analytics below.
                </p>
                <Link
                  href={`/exam/${id}/result/analytics?attemptId=${existingAttempt._id}`}
                  className="mt-3 inline-flex rounded-lg bg-primary px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-accent"
                >
                  View Comprehensive Analytics
                </Link>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !!existingAttempt || !schedule.canEnterSetup || schedule.isAfterEnd}
              className={`w-full py-4 text-white font-black rounded-xl transition-all text-sm uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg active:scale-95 ${
                !schedule.canEnterSetup || schedule.isAfterEnd
                  ? "bg-gray-400 cursor-not-allowed opacity-80"
                  : schedule.isBeforeStart
                  ? "bg-[#2D3A4A] hover:bg-[#1a2535] hover:shadow-xl hover:scale-[1.01]"
                  : "bg-primary hover:bg-accent hover:shadow-xl"
              } disabled:opacity-70`}
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  INITIALIZING SECURE SESSION...
                </>
              ) : !schedule.canEnterSetup ? (
                `Setup Opens in ${formatCountdown(schedule.secondsUntilSetup)}`
              ) : schedule.isBeforeStart ? (
                <>
                  <Camera size={16} /> Proceed to Camera Setup ({formatCountdown(schedule.secondsUntilStart)})
                </>
              ) : schedule.isAfterEnd ? (
                "EXAMINATION CLOSED"
              ) : (
                "Start Examination"
              )}
            </button>
          </form>

          <div className="mt-5 flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
            <Shield className="w-4 h-4 text-gray-400 shrink-0" />
            <p className="text-xs text-gray-500">Your data is secure and will only be used for examination purposes</p>
          </div>
        </div>
      </main>

      <footer className="text-center py-5 text-xs text-gray-400 border-t border-gray-100 bg-white mt-10">
        Powered by Progrentures Solution - Empower Your Growth
      </footer>
    </div>
  )
}
