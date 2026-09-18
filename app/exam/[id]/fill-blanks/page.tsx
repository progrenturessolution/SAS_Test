"use client"

import { useState, useEffect, useCallback, use } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { CheckCircle, Info } from "lucide-react"
import { ExamHeader, ProctoringCamera, statusColorMap, QuestionStatus } from "@/components/exam/ExamShared"
import { ProctoringWarning } from "@/components/exam/ProctoringWarning"
import { useProctoring } from "@/hooks/use-proctoring"

interface Blank {
  id: number
  label: string
  answer: string
}

interface Question {
  _id: string
  type: "fillblanks"
  questionText: string
  marks: number
  blanks?: Blank[]
}

interface ExamData {
  _id: string
  title: string
  duration: number
  sections: { name: string; type: string; questionRange: string; questions: Question[] }[]
  proctoring: { enabled: boolean; tabSwitch: boolean; fullscreenExit: boolean; faceDetection: boolean; maxWarnings: number }
}

// answers[questionId] = { [blankIndex]: value }
type BlankAnswers = Record<string, Record<number, string>>

export default function FillBlanksPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const searchParams = useSearchParams()
  const attemptId = searchParams.get("attemptId")
  const router = useRouter()

  const [exam, setExam] = useState<ExamData | null>(null)
  const [timeLeft, setTimeLeft] = useState(0)
  const [currentQ, setCurrentQ] = useState(0)
  const [blanksAnswers, setBlanksAnswers] = useState<BlankAnswers>({})
  const [activeWarning, setActiveWarning] = useState<string | null>(null)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!attemptId) { router.push(`/exam/${id}`); return }
    fetch(`/api/exams/${id}`).then((r) => r.json()).then((d) => {
      setExam(d.exam)
      setTimeLeft(d.exam.duration * 60)
    })
  }, [id, attemptId, router])

  // Convert blanks to flat answer array for API
  const buildAnswerPayload = useCallback((ba: BlankAnswers, section: { questions: Question[] }) => {
    return section.questions.map((q) => ({
      questionId: q._id,
      sectionType: "fillblanks",
      answer: Object.values(ba[q._id] ?? {}),
    }))
  }, [])

  const handleAutoSubmit = useCallback(() => {
    if (!attemptId || !exam) return
    setSubmitting(true)
    const section = exam.sections.find((s) => s.type === "fillblanks")
    const answers = section ? buildAnswerPayload(blanksAnswers, section as { questions: Question[] }) : []
    fetch(`/api/attempts/${attemptId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers, autoSubmit: true }),
    }).then(() => router.push(`/exam/${id}/result?attemptId=${attemptId}`))
  }, [attemptId, exam, blanksAnswers, buildAnswerPayload, id, router])

  const { state: procState, requestFullscreen } = useProctoring({
    attemptId,
    maxWarnings: exam?.proctoring?.maxWarnings ?? 3,
    enableFaceDetection: exam?.proctoring?.faceDetection ?? false,
    enableTabSwitch: exam?.proctoring?.tabSwitch ?? true,
    enableFullscreen: exam?.proctoring?.fullscreenExit ?? true,
    onAutoSubmit: handleAutoSubmit,
    onWarning: (type) => setActiveWarning(type),
  })

  useEffect(() => {
    if (exam?.proctoring?.fullscreenExit) requestFullscreen()
  }, [exam, requestFullscreen])

  useEffect(() => {
    if (!exam || timeLeft <= 0) return
    const t = setInterval(() => setTimeLeft((p) => { if (p <= 1) { clearInterval(t); handleAutoSubmit(); return 0 } return p - 1 }), 1000)
    return () => clearInterval(t)
  }, [exam, handleAutoSubmit, timeLeft])

  // Auto-save every 30s
  useEffect(() => {
    if (!attemptId || !exam) return
    const section = exam.sections.find((s) => s.type === "fillblanks")
    if (!section) return
    const t = setInterval(() => {
      const answers = buildAnswerPayload(blanksAnswers, section as { questions: Question[] })
      fetch(`/api/attempts/${attemptId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      }).then(() => setLastSaved(new Date()))
    }, 30000)
    return () => clearInterval(t)
  }, [attemptId, exam, blanksAnswers, buildAnswerPayload])

  if (!exam) return <div className="flex h-screen items-center justify-center"><div className="w-10 h-10 border-4 border-[#2D3A4A] border-t-transparent rounded-full animate-spin" /></div>

  const section = exam.sections.find((s) => s.type === "fillblanks")
  if (!section) return <div className="flex h-screen items-center justify-center text-gray-400">No fill-blanks section found.</div>

  const questions = section.questions as Question[]
  const question = questions[currentQ]
  const qId = question?._id ?? ""
  const blanksForQ = blanksAnswers[qId] ?? {}

  const setBlankValue = (blankIdx: number, val: string) => {
    setBlanksAnswers((prev) => ({ ...prev, [qId]: { ...(prev[qId] ?? {}), [blankIdx]: val } }))
  }

  const getQuestionStatus = (q: Question, i: number): QuestionStatus => {
    const ba = blanksAnswers[q._id] ?? {}
    const filledCount = Object.values(ba).filter((v) => v.trim()).length
    const totalBlanks = q.blanks?.length ?? 0
    if (filledCount === totalBlanks && totalBlanks > 0) return "answered"
    if (filledCount > 0) return "review" // partial = review color
    if (i < currentQ) return "not-answered"
    return "not-visited"
  }

  const totalAnswered = questions.filter((q) => {
    const ba = blanksAnswers[q._id] ?? {}
    return Object.values(ba).some((v) => v.trim())
  }).length

  const sectionTabs = exam.sections.map((s) => ({ label: `${s.name} (${s.questionRange})`, type: s.type }))

  const handleSubmitSection = async () => {
    if (!confirm("Submit Fill Blanks section?")) return
    if (!attemptId) return
    setSubmitting(true)
    const answers = buildAnswerPayload(blanksAnswers, section as { questions: Question[] })
    await fetch(`/api/attempts/${attemptId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers }),
    })
    router.push(`/exam/${id}/coding?attemptId=${attemptId}`)
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden">
      <ProctoringWarning
        warningCount={procState.warnings}
        maxWarnings={exam.proctoring?.maxWarnings ?? 3}
        warningType={activeWarning}
        onDismiss={() => setActiveWarning(null)}
        autoSubmitted={procState.autoSubmitted}
      />

      <ExamHeader
        title={exam.title}
        section={section.name}
        timeLeft={timeLeft}
        duration={exam.duration}
        studentName="Student"
        rollNo="N/A"
        onSubmit={() => handleSubmitSection()}
        warningCount={procState.warnings}
        maxWarnings={exam.proctoring?.maxWarnings ?? 3}
      />

      {/* Section Tabs */}
      <div className="bg-white border-b border-gray-200 px-6 py-2.5 flex items-center gap-2 shrink-0">
        {sectionTabs.map((tab, i) => {
          const tabType = exam.sections[i]?.type
          const paths: Record<string, string> = { mcq: "take", truefalse: "take", descriptive: "descriptive", fillblanks: "fill-blanks", coding: "coding" }
          return (
            <button
              key={i}
              onClick={() => router.push(`/exam/${id}/${paths[tabType] ?? "take"}?attemptId=${attemptId}`)}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${tabType === "fillblanks" ? "bg-[#2D3A4A] text-white" : "text-gray-500 hover:bg-gray-100"}`}
            >
              {tab.label}
            </button>
          )
        })}
        <span className="ml-auto text-sm font-semibold text-[#10B981]">{totalAnswered}/{questions.length}</span>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-y-auto p-6">
          {/* Meta */}
          <div className="flex items-center gap-3 mb-5 flex-wrap">
            <div className="w-10 h-10 rounded-xl bg-[#F59E0B] flex items-center justify-center shrink-0">
              <span className="text-white font-bold text-sm">Q{currentQ + 1}</span>
            </div>
            <span className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-semibold rounded-full">{question?.marks} Marks</span>
            <span className="px-3 py-1.5 bg-blue-50 text-blue-600 text-xs font-semibold rounded-full">Fill in Blanks</span>
            {question?.blanks && (
              <span className="px-3 py-1.5 bg-purple-50 text-purple-600 text-xs font-semibold rounded-full">{question.blanks.length} Blanks</span>
            )}
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => setCurrentQ(Math.max(0, currentQ - 1))}
                className="px-4 py-2 text-sm font-semibold border border-[#F59E0B] text-[#F59E0B] rounded-xl hover:bg-amber-50"
              >
                Mark for Review
              </button>
              <button
                onClick={() => setBlanksAnswers((p) => ({ ...p, [qId]: {} }))}
                className="px-4 py-2 text-sm font-semibold border border-gray-300 text-gray-600 rounded-xl hover:bg-gray-50"
              >
                Clear Response
              </button>
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 flex items-center gap-2 mb-4">
            <Info size={16} className="text-blue-500 shrink-0" />
            <p className="text-sm text-blue-600">Fill in the blanks with appropriate words. Each blank is numbered and corresponds to an input field below.</p>
          </div>

          {/* Passage */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6">
            <p className="text-[#1a2535] font-medium text-base leading-relaxed">{question?.questionText}</p>
          </div>

          {/* Blank Inputs */}
          <div>
            <p className="text-sm font-bold text-[#1a2535] mb-4">Your Answers:</p>
            <div className="space-y-5">
              {(question?.blanks ?? []).map((blank, bi) => {
                const val = blanksForQ[bi] ?? ""
                const isFilled = val.trim().length > 0
                return (
                  <div key={bi} className="flex items-start gap-4">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 mt-1 ${isFilled ? "bg-[#F59E0B] text-white" : "bg-gray-200 text-gray-500"}`}>
                      {bi + 1}
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-gray-500 mb-1.5">{blank.label}</p>
                      <div className="flex items-center gap-3">
                        <input
                          type="text"
                          placeholder="Type your answer..."
                          value={val}
                          onChange={(e) => setBlankValue(bi, e.target.value)}
                          className={`flex-1 px-4 py-3 border-2 rounded-xl text-sm text-gray-700 placeholder-gray-400 focus:outline-none transition-colors ${isFilled ? "border-[#10B981] focus:border-[#10B981]" : "border-gray-200 focus:border-[#2D3A4A]"}`}
                        />
                        <span className={`px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 ${isFilled ? "bg-green-100 text-green-600" : "bg-red-100 text-red-500"}`}>
                          {isFilled ? "Filled" : "Empty"}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8">
            <button
              onClick={() => setCurrentQ(Math.max(0, currentQ - 1))}
              disabled={currentQ === 0}
              className="px-5 py-2.5 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50 disabled:opacity-40"
            >
              Previous
            </button>
            <div className="flex items-center gap-3">
              <button onClick={() => setCurrentQ(Math.min(questions.length - 1, currentQ + 1))} className="px-5 py-2.5 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50">Skip</button>
              <button
                onClick={() => setCurrentQ(Math.min(questions.length - 1, currentQ + 1))}
                className="px-6 py-2.5 bg-[#2D3A4A] text-white text-sm font-bold rounded-xl hover:bg-[#1a2535]"
              >
                Save and Next
              </button>
            </div>
          </div>
        </main>

        {/* Sidebar */}
        <aside className="w-64 bg-white border-l border-gray-200 flex flex-col overflow-y-auto shrink-0">
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{section.name}</p>
              <span className="text-xs font-semibold text-[#10B981]">{totalAnswered}/{questions.length}</span>
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {questions.map((q, i) => {
                const status = getQuestionStatus(q, i)
                return (
                  <button key={q._id} onClick={() => setCurrentQ(i)}
                    className={`w-10 h-10 rounded-full text-xs font-semibold transition-all ${i === currentQ ? "ring-2 ring-offset-1 ring-[#2D3A4A] " : ""}${statusColorMap[status]}`}
                  >
                    {i + 1}
                  </button>
                )
              })}
            </div>
            <div className="grid grid-cols-2 gap-1.5 mt-3">
              {[
                { color: "bg-[#10B981]", label: "Answered" },
                { color: "bg-red-500", label: "Not Answered" },
                { color: "bg-[#F59E0B]", label: "Partial" },
                { color: "bg-gray-200", label: "Not Visited" },
              ].map(({ color, label }) => (
                <div key={label} className="flex items-center gap-1.5">
                  <span className={`w-3 h-3 rounded-sm ${color}`} />
                  <span className="text-[9px] text-gray-500">{label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 border-b border-gray-100">
            <ProctoringCamera />
          </div>

          {/* Blanks Status */}
          <div className="p-4 flex-1">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-3">Blanks Status</p>
            <div className="space-y-2">
              {(question?.blanks ?? []).map((blank, bi) => {
                const val = blanksForQ[bi] ?? ""
                const filled = val.trim().length > 0
                return (
                  <div key={bi} className="flex items-center justify-between py-1 border-b border-gray-50 last:border-0">
                    <span className="text-xs text-gray-600">Blank {bi + 1}</span>
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${filled ? "bg-[#10B981]" : "bg-red-500"}`} />
                      <span className={`text-xs font-semibold ${filled ? "text-[#10B981]" : "text-red-500"}`}>{filled ? "Filled" : "Empty"}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="p-4 border-t border-gray-100 space-y-2">
            {lastSaved && (
              <div className="flex items-center gap-1.5 text-[10px] text-[#10B981]">
                <CheckCircle size={11} />
                <span>Saved {lastSaved.toLocaleTimeString()}</span>
              </div>
            )}
            <button
              onClick={handleSubmitSection}
              disabled={submitting}
              className="w-full py-3 bg-[#F59E0B] text-white text-sm font-bold rounded-xl hover:bg-[#d97706] transition-colors disabled:opacity-60"
            >
              {submitting ? "Submitting..." : `Submit ${section.name}`}
            </button>
          </div>
        </aside>
      </div>
    </div>
  )
}
