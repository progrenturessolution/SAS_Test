"use client"

import { useState, useEffect, useCallback, use } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  Bold, Italic, Underline as UnderlineIcon, List, ListOrdered,
  AlignLeft, AlignJustify, FileText, CheckCircle,
} from "lucide-react"
import { ExamHeader, ProctoringCamera, statusColorMap, QuestionStatus } from "@/components/exam/ExamShared"
import { ProctoringWarning } from "@/components/exam/ProctoringWarning"
import { useProctoring } from "@/hooks/use-proctoring"

interface Question {
  _id: string
  questionText: string
  marks: number
  wordLimit?: number
}

interface ExamData {
  _id: string
  title: string
  duration: number
  sections: { name: string; type: string; questionRange: string; questions: Question[] }[]
  proctoring: { enabled: boolean; tabSwitch: boolean; fullscreenExit: boolean; faceDetection: boolean; maxWarnings: number }
}

export default function DescriptivePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const searchParams = useSearchParams()
  const attemptId = searchParams.get("attemptId")
  const router = useRouter()

  const [exam, setExam] = useState<ExamData | null>(null)
  const [timeLeft, setTimeLeft] = useState(0)
  const [currentQ, setCurrentQ] = useState(0)
  const [textAnswers, setTextAnswers] = useState<Record<string, string>>({})
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

  const buildPayload = useCallback((ta: Record<string, string>, section: { questions: Question[] }) => {
    return section.questions.map((q) => ({
      questionId: q._id,
      sectionType: "descriptive",
      answer: ta[q._id] ?? "",
    }))
  }, [])

  const handleAutoSubmit = useCallback(() => {
    if (!attemptId || !exam) return
    setSubmitting(true)
    const section = exam.sections.find((s) => s.type === "descriptive")
    const answers = section ? buildPayload(textAnswers, section as { questions: Question[] }) : []
    fetch(`/api/attempts/${attemptId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers, autoSubmit: true }),
    }).then(() => router.push(`/exam/${id}/result?attemptId=${attemptId}`))
  }, [attemptId, exam, textAnswers, buildPayload, id, router])

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

  useEffect(() => {
    if (!attemptId || !exam) return
    const section = exam.sections.find((s) => s.type === "descriptive")
    if (!section) return
    const t = setInterval(() => {
      const answers = buildPayload(textAnswers, section as { questions: Question[] })
      fetch(`/api/attempts/${attemptId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      }).then(() => setLastSaved(new Date()))
    }, 30000)
    return () => clearInterval(t)
  }, [attemptId, exam, textAnswers, buildPayload])

  if (!exam) return (
    <div className="flex h-screen items-center justify-center">
      <div className="w-10 h-10 border-4 border-[#2D3A4A] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const section = exam.sections.find((s) => s.type === "descriptive")
  if (!section) return <div className="flex h-screen items-center justify-center text-gray-400">No descriptive section found.</div>

  const questions = section.questions as Question[]
  const question = questions[currentQ]
  const qId = question?._id ?? ""
  const answer = textAnswers[qId] ?? ""
  const wordCount = answer.trim() ? answer.trim().split(/\s+/).length : 0
  const wordLimit = question?.wordLimit ?? 500

  const getStatus = (q: Question, i: number): QuestionStatus => {
    const text = textAnswers[q._id] ?? ""
    if (text.trim().length > 0) return "answered"
    if (i < currentQ) return "not-answered"
    return "not-visited"
  }

  const totalAnswered = questions.filter((q) => (textAnswers[q._id] ?? "").trim().length > 0).length

  const sectionTabs = exam.sections.map((s, i) => {
    const paths: Record<string, string> = { mcq: "take", truefalse: "take", descriptive: "descriptive", fillblanks: "fill-blanks", coding: "coding" }
    return { label: `${s.name} (${s.questionRange})`, type: s.type, path: paths[s.type] ?? "take" }
  })

  const handleSubmitSection = async () => {
    if (!confirm("Submit Descriptive section?")) return
    if (!attemptId) return
    setSubmitting(true)
    const answers = buildPayload(textAnswers, section as { questions: Question[] })
    await fetch(`/api/attempts/${attemptId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers }),
    })
    // Navigate to next section (fill-blanks if available, else result)
    const nextSection = exam.sections.find((s) => s.type === "fillblanks") ? "fill-blanks" : "result"
    router.push(`/exam/${id}/${nextSection}?attemptId=${attemptId}`)
  }

  const toolbarButtons = [
    { Icon: Bold, title: "Bold" },
    { Icon: Italic, title: "Italic" },
    { Icon: UnderlineIcon, title: "Underline" },
    { Icon: List, title: "Bullet List" },
    { Icon: ListOrdered, title: "Numbered List" },
    { Icon: AlignLeft, title: "Align Left" },
    { Icon: AlignJustify, title: "Justify" },
    { Icon: FileText, title: "Format" },
  ]

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
        onSubmit={handleSubmitSection}
        warningCount={procState.warnings}
        maxWarnings={exam.proctoring?.maxWarnings ?? 3}
      />

      {/* Section Tabs */}
      <div className="bg-white border-b border-gray-200 px-6 py-2.5 flex items-center gap-2 shrink-0">
        {sectionTabs.map((tab, i) => (
          <button
            key={i}
            onClick={() => router.push(`/exam/${id}/${tab.path}?attemptId=${attemptId}`)}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${tab.type === "descriptive" ? "bg-[#2D3A4A] text-white" : "text-gray-500 hover:bg-gray-100"}`}
          >
            {tab.label}
          </button>
        ))}
        <span className="ml-auto text-sm font-semibold text-[#10B981]">{totalAnswered}/{questions.length}</span>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-y-auto p-6">
          {/* Meta */}
          <div className="flex items-center gap-3 mb-5 flex-wrap">
            <div className="w-10 h-10 rounded-xl bg-[#7C3AED] flex items-center justify-center shrink-0">
              <span className="text-white font-bold text-sm">Q{currentQ + 1}</span>
            </div>
            <span className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-semibold rounded-full">{question?.marks} Marks</span>
            <span className="px-3 py-1.5 bg-blue-50 text-blue-600 text-xs font-semibold rounded-full">Max {wordLimit} words</span>
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => setTextAnswers((p) => ({ ...p, [qId]: "" }))}
                className="px-4 py-2 text-sm font-semibold border border-gray-300 text-gray-600 rounded-xl hover:bg-gray-50"
              >
                Clear Response
              </button>
            </div>
          </div>

          {/* Question */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-5">
            <p className="text-[#1a2535] font-medium text-base leading-relaxed">{question?.questionText}</p>
          </div>

          {/* Answer Editor */}
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden mb-5">
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
              <p className="text-sm font-semibold text-[#1a2535]">Your Answer</p>
              <p className="text-sm text-gray-500">
                Word Count:{" "}
                <span className={`font-semibold ${wordCount > wordLimit ? "text-red-500" : "text-[#10B981]"}`}>
                  {wordCount}/{wordLimit}
                </span>
              </p>
            </div>
            {/* Toolbar (visual only, textarea is plain) */}
            <div className="flex items-center gap-1 px-4 py-2 border-b border-gray-100 bg-gray-50 flex-wrap">
              {toolbarButtons.map(({ Icon, title }) => (
                <button key={title} title={title} className="p-1.5 rounded hover:bg-gray-200 text-gray-600 transition-colors">
                  <Icon className="w-4 h-4" />
                </button>
              ))}
            </div>
            <textarea
              value={answer}
              onChange={(e) => setTextAnswers((p) => ({ ...p, [qId]: e.target.value }))}
              className="w-full p-4 text-sm text-gray-700 leading-relaxed resize-none focus:outline-none min-h-[260px]"
              placeholder="Start writing your answer here..."
            />
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setCurrentQ(Math.max(0, currentQ - 1))}
              disabled={currentQ === 0}
              className="px-5 py-2.5 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50 disabled:opacity-40"
            >
              Previous
            </button>
            <div className="flex items-center gap-3">
              <button className="px-5 py-2.5 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50">Save Draft</button>
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
            <div className="flex items-center gap-2 flex-wrap">
              {questions.map((q, i) => {
                const status = getStatus(q, i)
                return (
                  <button
                    key={q._id}
                    onClick={() => setCurrentQ(i)}
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

          {/* Writing Tips */}
          <div className="p-4 flex-1">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-3">Writing Tips</p>
            <ul className="space-y-2">
              {[
                "Start with a clear thesis statement",
                "Use specific examples from the text",
                "Organize into clear paragraphs",
                "Proofread before submitting",
              ].map((tip) => (
                <li key={tip} className="text-xs text-gray-500 flex items-start gap-1.5">
                  <span className="text-gray-400 mt-0.5">•</span>
                  {tip}
                </li>
              ))}
            </ul>
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
              className="w-full py-3 bg-[#7C3AED] text-white text-sm font-bold rounded-xl hover:bg-[#6d28d9] transition-colors disabled:opacity-60"
            >
              {submitting ? "Submitting..." : `Submit ${section.name}`}
            </button>
          </div>
        </aside>
      </div>
    </div>
  )
}
