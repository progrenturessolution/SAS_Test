"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Clock, FileText, CheckCircle, Award, User, Mail, Hash, Shield, AlertCircle, Camera, Maximize, AlertTriangle } from "lucide-react"
import { ProcrentureLogo } from "@/components/exam/ExamShared"

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
  const [form, setForm] = useState({ name: "", email: "", roll: "", agreed: false })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [fetchError, setFetchError] = useState("")
  const [studentStats, setStudentStats] = useState<{ totalExams: number; avgScore: number } | null>(null)

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Time-Windowed Access Check
    if (exam?.settings?.startDate && exam.settings.startTime) {
      const startDateTime = new Date(`${exam.settings.startDate.split('T')[0]}T${exam.settings.startTime}`)
      if (new Date() < startDateTime) {
        setErrors({ submit: `This exam has not started yet. It will be available from ${startDateTime.toLocaleString()}.` })
        return
      }
    }
    if (exam?.settings?.endDate && exam.settings.endTime) {
      const endDateTime = new Date(`${exam.settings.endDate.split('T')[0]}T${exam.settings.endTime}`)
      if (new Date() > endDateTime) {
        setErrors({ submit: `This exam has ended and is no longer available. It ended at ${endDateTime.toLocaleString()}.` })
        return
      }
    }

    const newErrors: Record<string, string> = {}
    if (!form.name.trim()) newErrors.name = "Full name is required"
    if (!form.email.trim()) newErrors.email = "Email address is required"
    if (!form.roll.trim()) newErrors.roll = "Roll number is required"
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
        }),
      })
      const data = await res.json()
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
                    onChange={(e) => { setForm({ ...form, [key]: e.target.value }); setErrors({ ...errors, [key]: "" }) }}
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

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-4 bg-primary text-white font-black rounded-xl hover:bg-accent transition-all text-sm uppercase tracking-widest disabled:opacity-60 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl active:scale-95"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  INITIALIZING SECURE SESSION...
                </>
              ) : "Start Examination"}
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
