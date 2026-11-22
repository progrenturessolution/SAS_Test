"use client"

import { useState, useRef, useEffect } from "react"
import { createPortal } from "react-dom"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import {
  Check, Upload, Plus, X, Trash2, AlertCircle,
  FileText, CheckSquare, List, Code2, AlignLeft, Info, Pencil, MoreVertical,
  Shield, Camera, Maximize, AlertTriangle, Sparkles, Loader2, Clock, GraduationCap,
  ArrowRight, ArrowLeft, CheckCircle2, Zap, Layers, Lock, ChevronDown, ChevronUp, Minus
} from "lucide-react"
import { getExamStartDateTime, getExamEndDateTime, formatScheduleDateTime } from "@/lib/examSchedule"
import { ExamDateTimePicker } from "@/components/exam/ExamDateTimePicker"
import { CompetitiveExamAIGenerator, GeneratedCompetitiveQuestion } from "@/components/exam/CompetitiveExamAIGenerator"
import { MathRenderer } from "@/components/exam/MathRenderer"
import { toast } from "sonner"

// ─── Types ────────────────────────────────────────────────────────────────────

export function parseAssertionReason(text: string) {
  if (!text) return null
  const match = text.match(
    /(?:Assertion|Statement\s*1)\s*(?:\([Aa1]\))?\s*:\s*([\s\S]*?)(?:Reason|Statement\s*2)\s*(?:\([Rr2]\))?\s*:\s*([\s\S]*)$/i
  )
  if (!match) return null
  return {
    assertion: match[1].trim(),
    reason: match[2].trim(),
  }
}

type Difficulty = "easy" | "medium" | "hard"
type QuestionType = "mcq" | "assertion" | "truefalse" | "descriptive" | "fillblanks" | "coding"

interface MCQQuestion {
  id: string; type: "mcq"
  questionText: string; difficulty: Difficulty; marks: number
  negativeMark?: number
  options: string[]; correctAnswer: string; explanation: string
  questionImage?: string; optionImages?: string[]
}
interface AssertionQuestion {
  id: string; type: "assertion"
  assertionText?: string; reasonText?: string
  questionText: string; difficulty: Difficulty; marks: number
  negativeMark?: number
  options: string[]; correctAnswer: string; explanation: string
  questionImage?: string
}
interface TrueFalseQuestion {
  id: string; type: "truefalse"
  questionText: string; difficulty: Difficulty; marks: number
  negativeMark?: number
  correctAnswer: "True" | "False"; explanation: string
  questionImage?: string
}
interface DescriptiveQuestion {
  id: string; type: "descriptive"
  questionText: string; difficulty: Difficulty; marks: number
  negativeMark?: number
  wordLimit: string; modelAnswer: string; rubric: string[]
  questionImage?: string
}
interface FillBlanksQuestion {
  id: string; type: "fillblanks"
  questionText: string; difficulty: Difficulty; marks: number
  negativeMark?: number
  blanks: { answer: string; alsoAccept: string[] }[]
  caseInsensitive: boolean
  questionImage?: string
  options?: string[]
  correctAnswer?: string | string[]
  explanation?: string
}
interface CodingQuestion {
  id: string; type: "coding"
  questionText: string; difficulty: Difficulty; marks: number
  negativeMark?: number
  codeTemplate: string
  codeTemplates: Record<string, string>
  driverCode: Record<string, string>
  testCases: { input: string; expectedOutput: string; hidden?: boolean }[]
  constraints: string[]; languages: string[]
  questionImage?: string
}

type Question = MCQQuestion | AssertionQuestion | TrueFalseQuestion | DescriptiveQuestion | FillBlanksQuestion | CodingQuestion

interface Step1Form {
  title: string; examType: string; duration: string
  passMarks: string; totalMarks: string; instructions: string; questionsPerMin: string
}
interface Step2Form {
  startDate: string; startTime: string; endDate: string; endTime: string
  randomize: boolean; showResults: boolean; allowReview: boolean; negativeMarking: boolean
  sectionNegativeMark: number;
  proctoring: {
    faceDetection: boolean
    tabSwitch: boolean
    fullscreen: boolean
    aiProctoring: boolean
  }
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SUBJECTS = ["Mathematics","Science","Computer Science","English","History","Geography","Physics","Chemistry","Biology","Economics"]
const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  easy: "bg-green-100 text-green-700",
  medium: "bg-yellow-100 text-yellow-700",
  hard: "bg-red-100 text-red-700",
}
const TYPE_META: Record<QuestionType, { label: string; color: string; icon: React.ReactNode }> = {
  mcq:         { label: "MCQ",                color: "bg-blue-100 text-blue-700",     icon: <List size={13}/> },
  assertion:   { label: "Assertion & Reason", color: "bg-purple-100 text-purple-700", icon: <Layers size={13}/> },
  truefalse:   { label: "True/False",         color: "bg-teal-100 text-teal-700",     icon: <CheckSquare size={13}/> },
  fillblanks:  { label: "Fill Blanks",        color: "bg-amber-100 text-amber-700",   icon: <FileText size={13}/> },
  descriptive: { label: "Descriptive",        color: "bg-rose-100 text-rose-700",     icon: <AlignLeft size={13}/> },
  coding:      { label: "Coding",             color: "bg-red-100 text-red-700",       icon: <Code2 size={13}/> },
}

// ─── Stepper ──────────────────────────────────────────────────────────────────

function Stepper({ step, onStepClick }: { step: number; onStepClick?: (step: number) => void }) {
  const steps = [
    { n: 1, label: "Questions" },
    { n: 2, label: "Exam Details" },
    { n: 3, label: "Settings" },
  ]

  return (
    <>
      {/* Mobile Dedicated Stepper (sm:hidden) */}
      <div className="sm:hidden mb-5 bg-white rounded-2xl border border-slate-200/80 p-3.5 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-6 h-6 rounded-lg bg-primary text-white text-xs font-semibold flex items-center justify-center shadow-2xs">
              {step}
            </span>
            <div>
              <p className="text-xs font-semibold text-slate-900 leading-none">
                {steps[step - 1]?.label}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Step {step} of {steps.length}
              </p>
            </div>
          </div>
          <span className="text-[11px] font-medium text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full">
            {Math.round((step / steps.length) * 100)}% Done
          </span>
        </div>

        {/* 3-Step Quick Action Touch Buttons */}
        <div className="grid grid-cols-3 gap-1.5 pt-0.5">
          {steps.map((s) => {
            const isCurrent = s.n === step
            const isComplete = s.n < step
            return (
              <button
                key={s.n}
                type="button"
                onClick={() => onStepClick?.(s.n)}
                className={`h-9 rounded-xl flex items-center justify-center text-xs font-medium transition-all cursor-pointer ${
                  isCurrent
                    ? "bg-primary text-white shadow-xs font-semibold ring-2 ring-primary/25"
                    : isComplete
                    ? "bg-primary/15 text-primary border border-primary/30 font-semibold"
                    : "bg-slate-50 text-slate-400 border border-slate-200/60"
                }`}
                title={s.label}
              >
                {isComplete ? <Check className="w-3.5 h-3.5 stroke-[2.5]" /> : `${s.n}. ${s.label.split(" ")[0]}`}
              </button>
            )
          })}
        </div>
      </div>

      {/* Desktop Stepper (hidden sm:block) */}
      <div className="hidden sm:block mb-6 bg-white rounded-2xl border border-slate-200/80 px-4 py-5 sm:px-8 shadow-xs">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          {steps.map((s, index) => {
            const isCurrent = s.n === step
            const isComplete = s.n < step
            return (
              <div key={s.n} className="flex-1 flex items-center">
                <div className="flex flex-col items-center flex-1">
                  <button
                    type="button"
                    onClick={() => onStepClick?.(s.n)}
                    className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-medium transition-all cursor-pointer ${
                      isCurrent
                        ? "bg-primary text-white shadow-sm ring-2 ring-primary/25 ring-offset-2"
                        : isComplete
                        ? "bg-primary text-white shadow-sm"
                        : "bg-white text-slate-400 border border-slate-300 hover:border-slate-400"
                    }`}
                  >
                    {isComplete ? <Check className="w-4 h-4 stroke-[2.5]" /> : s.n}
                  </button>
                  <span
                    className={`mt-2 text-xs font-medium transition-colors text-center ${
                      isCurrent ? "text-slate-900 font-semibold" : isComplete ? "text-primary font-medium" : "text-slate-400"
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`h-[1.5px] w-full max-w-[120px] -mt-5 transition-colors ${
                      s.n < step ? "bg-primary" : "bg-slate-200"
                    }`}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}

// ─── Toggle ───────────────────────────────────────────────────────────────────

function Toggle({ checked, onChange, disabled = false }: { checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-slate-900/20 disabled:cursor-not-allowed disabled:opacity-40 ${
        checked ? "bg-[#1E293B]" : "bg-slate-200"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  )
}

// ─── Input helpers ────────────────────────────────────────────────────────────

const inputCls = "w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 text-sm text-slate-800 placeholder:text-slate-400 transition-colors shadow-2xs focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
const textareaCls = "w-full px-3.5 py-3 rounded-xl border border-slate-200 bg-white hover:border-slate-300 text-sm text-slate-800 placeholder:text-slate-400 transition-colors shadow-2xs focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 resize-none"
const labelCls = "block text-xs font-semibold text-slate-700 mb-1.5"

// ─── MCQ Modal ────────────────────────────────────────────────────────────────

function MCQModal({ onSave, onClose, initial }: {
  onSave: (q: MCQQuestion | MCQQuestion[]) => void; onClose: () => void; initial?: MCQQuestion
}) {
  const blank = (): MCQQuestion => ({
    id: Math.random().toString(36).slice(2), type: "mcq",
    questionText: "", difficulty: "medium", marks: 1,
    options: ["", "", "", ""], correctAnswer: "", explanation: ""
  })
  const [q, setQ] = useState<MCQQuestion>(initial ?? blank())
  const [error, setError] = useState("")
  const [aiPrompt, setAiPrompt] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [bulkTopics, setBulkTopics] = useState([{ topic: "", count: 1 }])

  const save = () => {
    if (!q.questionText.trim()) return setError("Question text is required")
    if (q.options.filter(o => o.trim()).length < 2) return setError("At least 2 options required")
    if (!q.correctAnswer) return setError("Select the correct answer")
    onSave(q); onClose()
  }

  const generateWithAi = async () => {
    if (!aiPrompt.trim()) return setError("Enter a topic or short question prompt first")
    setIsGenerating(true); setError("")
    try {
      const res = await fetch("/api/admin/generate-objective-question", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: aiPrompt, type: "mcq", marks: q.marks, difficulty: q.difficulty }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to generate MCQ")
      setQ(prev => ({ ...prev, questionText: data.data.questionText, options: data.data.options, correctAnswer: data.data.correctAnswer, explanation: data.data.explanation }))
    } catch (error) { setError(error instanceof Error ? error.message : "Failed to generate MCQ") }
    finally { setIsGenerating(false) }
  }

  const generateBulk = async () => {
    const topics = bulkTopics.filter(item => item.topic.trim() && item.count > 0)
    if (!topics.length) return setError("Add at least one topic and question count")
    setIsGenerating(true); setError("")
    try {
      const res = await fetch("/api/admin/generate-objective-question", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topics, type: "mcq", marks: q.marks, difficulty: q.difficulty }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Bulk generation failed")
      const generated = data.data.map((item: any): MCQQuestion => ({ ...q, id: Math.random().toString(36).slice(2), questionText: item.questionText, options: item.options, correctAnswer: item.correctAnswer, explanation: item.explanation }))
      onSave(generated); onClose()
    } catch (error) { setError(error instanceof Error ? error.message : "Bulk generation failed") }
    finally { setIsGenerating(false) }
  }

  return (
    <ModalShell
      title={initial ? "Edit MCQ Question" : "Add MCQ Question"}
      icon={
        <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
          <List size={18} className="text-blue-600"/>
        </div>
      }
      onClose={onClose}
    >
      <div className="space-y-4">
        {!initial && (
          <>
            {/* Box 1: Generate up to 10 topics at once */}
            <div className="rounded-2xl border border-blue-100 bg-[#F0F7FF]/60 p-4 space-y-3">
              <p className="text-xs font-bold text-blue-700">Generate up to 10 topics at once</p>
              <div className="space-y-2">
                {bulkTopics.map((item, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <input
                      value={item.topic}
                      onChange={e => setBulkTopics(rows => rows.map((row, i) => i === index ? { ...row, topic: e.target.value } : row))}
                      placeholder={`Topic ${index + 1}`}
                      className="flex-1 h-11 px-3.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-colors"
                    />
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={item.count}
                      onChange={e => setBulkTopics(rows => rows.map((row, i) => i === index ? { ...row, count: Math.max(1, Math.min(60, Number(e.target.value) || 1)) } : row))}
                      className="w-18 sm:w-20 h-11 px-2.5 rounded-xl border border-slate-200 bg-white text-sm text-center font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
                    />
                    {index === bulkTopics.length - 1 && bulkTopics.length < 10 && (
                      <button
                        type="button"
                        onClick={() => setBulkTopics(rows => [...rows, { topic: "", count: 1 }])}
                        className="w-11 h-11 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-700 text-lg font-bold cursor-pointer transition-colors shadow-2xs shrink-0"
                        title="Add topic row"
                      >
                        +
                      </button>
                    )}
                    {bulkTopics.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setBulkTopics(rows => rows.filter((_, i) => i !== index))}
                        className="w-11 h-11 rounded-xl border border-red-100 bg-white hover:bg-red-50 flex items-center justify-center text-red-500 cursor-pointer transition-colors shrink-0"
                        title="Remove row"
                      >
                        <X size={15} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={generateBulk}
                disabled={isGenerating}
                className="h-10 px-4 rounded-xl bg-[#1E293B] hover:bg-[#0F172A] text-white text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors cursor-pointer disabled:opacity-60"
              >
                {isGenerating ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                <span>Generate All Topics</span>
              </button>
            </div>

            {/* Box 2: Single topic generator */}
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-3">
              <div className="flex gap-2">
                <input
                  value={aiPrompt}
                  onChange={e => setAiPrompt(e.target.value)}
                  placeholder="AI topic, e.g. photosynthesis..."
                  className="flex-1 h-11 px-3.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-colors"
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); generateWithAi(); } }}
                />
                <button
                  type="button"
                  onClick={generateWithAi}
                  disabled={isGenerating}
                  className="h-11 px-5 rounded-xl bg-[#1E293B] hover:bg-[#0F172A] text-white text-xs font-semibold flex items-center gap-1.5 shrink-0 shadow-xs transition-colors cursor-pointer disabled:opacity-60"
                >
                  {isGenerating ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                  <span>{isGenerating ? "Generating..." : "Generate"}</span>
                </button>
              </div>
            </div>
          </>
        )}

        {/* Question Text */}
        <div>
          <label className={labelCls}>Question Text *</label>
          <textarea
            value={q.questionText}
            onChange={e => setQ({ ...q, questionText: e.target.value })}
            rows={4}
            placeholder="Enter your question here..."
            className={textareaCls}
          />
        </div>

        {/* Question Image URL */}
        <div>
          <label className={labelCls}>
            Question Image URL <span className="text-slate-400 font-normal">(Optional)</span>
          </label>
          <input
            value={q.questionImage || ""}
            onChange={e => setQ({ ...q, questionImage: e.target.value })}
            placeholder="https://example.com/image.png"
            className={inputCls}
          />
        </div>

        {/* 3 Columns: Difficulty, Marks, Negative Mark */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <div>
            <label className={labelCls}>Difficulty *</label>
            <select
              value={q.difficulty}
              onChange={e => setQ({ ...q, difficulty: e.target.value as Difficulty })}
              className={inputCls + " cursor-pointer"}
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Marks *</label>
            <input
              type="number"
              value={q.marks}
              onChange={e => setQ({ ...q, marks: +e.target.value })}
              min={1}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Negative Mark</label>
            <input
              type="number"
              step="0.25"
              value={q.negativeMark || 0}
              onChange={e => setQ({ ...q, negativeMark: +e.target.value })}
              min={0}
              className={inputCls}
              placeholder="0"
            />
          </div>
        </div>

        {/* ANSWER OPTIONS */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className={labelCls + " mb-0 uppercase tracking-wider"}>ANSWER OPTIONS</label>
            <span className="text-xs text-slate-400">Select the correct answer</span>
          </div>
          <div className="space-y-2.5">
            {q.options.map((opt, i) => {
              const letter = String.fromCharCode(65 + i)
              const isSelected = q.correctAnswer === letter
              return (
                <div
                  key={i}
                  className={`flex items-start gap-3 rounded-xl border p-3 transition-colors ${
                    isSelected ? "border-emerald-500 bg-emerald-50/40 shadow-2xs" : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setQ({ ...q, correctAnswer: letter })}
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors cursor-pointer mt-0.5 ${
                      isSelected ? "bg-emerald-600 text-white shadow-2xs" : "border-2 border-slate-300 text-slate-500 bg-white"
                    }`}
                  >
                    {isSelected ? <Check size={13} className="stroke-[3]" /> : letter}
                  </button>
                  <div className="flex-1 space-y-2 min-w-0">
                    <input
                      value={opt}
                      onChange={e => {
                        const opts = [...q.options]
                        opts[i] = e.target.value
                        setQ({ ...q, options: opts })
                      }}
                      placeholder={`Enter option ${letter}...`}
                      className="w-full text-sm bg-transparent focus:outline-none text-slate-800 placeholder:text-slate-400"
                    />
                    <div className="flex items-center gap-1.5 border-t border-slate-100 pt-1.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Image URL:</span>
                      <input
                        value={q.optionImages?.[i] || ""}
                        onChange={e => {
                          const img = [...(q.optionImages || ["", "", "", ""])]
                          img[i] = e.target.value
                          setQ({ ...q, optionImages: img })
                        }}
                        placeholder="Optional image URL for this option..."
                        className="flex-1 text-[11px] bg-transparent focus:outline-none text-blue-600 placeholder:text-slate-300"
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Explanation */}
        <div>
          <label className={labelCls}>
            Explanation <span className="text-slate-400 font-normal">(Optional - shown after answer)</span>
          </label>
          <textarea
            value={q.explanation}
            onChange={e => setQ({ ...q, explanation: e.target.value })}
            rows={3}
            placeholder="Explain why the correct answer is right..."
            className={textareaCls}
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 font-medium flex items-center gap-1.5 p-2.5 rounded-lg bg-red-50 border border-red-200">
            <AlertCircle size={14} className="shrink-0" />
            <span>{error}</span>
          </p>
        )}
      </div>
      <ModalFooter note="Fields marked with * are required" onCancel={onClose} onSave={save} />
    </ModalShell>
  )
}

// ─── Assertion Modal ─────────────────────────────────────────────────────────

function AssertionModal({ onSave, onClose, initial }: {
  onSave: (q: AssertionQuestion | AssertionQuestion[]) => void; onClose: () => void; initial?: AssertionQuestion
}) {
  const defaultOptions = [
    "Both Assertion (A) and Reason (R) are true and Reason (R) is the correct explanation of Assertion (A)",
    "Both Assertion (A) and Reason (R) are true but Reason (R) is not the correct explanation of Assertion (A)",
    "Assertion (A) is true but Reason (R) is false",
    "Assertion (A) is false but Reason (R) is true"
  ]

  const blank = (): AssertionQuestion => ({
    id: Math.random().toString(36).slice(2),
    type: "assertion",
    assertionText: "",
    reasonText: "",
    questionText: "",
    difficulty: "medium",
    marks: 4,
    negativeMark: 1,
    options: [...defaultOptions],
    correctAnswer: "A",
    explanation: ""
  })

  const [q, setQ] = useState<AssertionQuestion>(() => {
    if (!initial) return blank()
    const parsed = parseAssertionReason(initial.questionText)
    return {
      ...initial,
      assertionText: initial.assertionText || parsed?.assertion || "",
      reasonText: initial.reasonText || parsed?.reason || "",
      options: initial.options?.length === 4 ? initial.options : [...defaultOptions],
      correctAnswer: initial.correctAnswer || "A"
    }
  })

  const [error, setError] = useState("")
  const [aiPrompt, setAiPrompt] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [bulkTopics, setBulkTopics] = useState([{ topic: "", count: 1 }])

  const save = () => {
    const aText = (q.assertionText || "").trim()
    const rText = (q.reasonText || "").trim()
    if (!aText) return setError("Assertion (A) statement is required")
    if (!rText) return setError("Reason (R) statement is required")
    if (q.options.filter(o => o.trim()).length < 4) return setError("All 4 option statements are required")
    if (!q.correctAnswer) return setError("Select the correct answer (A, B, C, or D)")

    const fullQuestionText = `Assertion (A): ${aText}\nReason (R): ${rText}`
    onSave({
      ...q,
      assertionText: aText,
      reasonText: rText,
      questionText: fullQuestionText
    })
    onClose()
  }

  const generateWithAi = async () => {
    if (!aiPrompt.trim()) return setError("Enter a topic for the Assertion & Reason question")
    setIsGenerating(true); setError("")
    try {
      const res = await fetch("/api/admin/generate-objective-question", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: aiPrompt, type: "assertion", marks: q.marks, difficulty: q.difficulty }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to generate Assertion & Reason question")
      const item = data.data
      setQ(prev => ({
        ...prev,
        assertionText: item.assertionText || prev.assertionText,
        reasonText: item.reasonText || prev.reasonText,
        questionText: item.questionText || prev.questionText,
        options: item.options || prev.options,
        correctAnswer: item.correctAnswer || prev.correctAnswer,
        explanation: item.explanation || prev.explanation
      }))
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to generate Assertion & Reason question") }
    finally { setIsGenerating(false) }
  }

  const generateBulk = async () => {
    const topics = bulkTopics.filter(item => item.topic.trim() && item.count > 0)
    if (!topics.length) return setError("Add at least one topic and question count")
    setIsGenerating(true); setError("")
    try {
      const res = await fetch("/api/admin/generate-objective-question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topics, type: "assertion", marks: q.marks, difficulty: q.difficulty }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Bulk generation failed")
      const generated = data.data.map((item: any): AssertionQuestion => ({
        ...q,
        id: Math.random().toString(36).slice(2),
        type: "assertion",
        assertionText: item.assertionText,
        reasonText: item.reasonText,
        questionText: item.questionText || `Assertion (A): ${item.assertionText}\nReason (R): ${item.reasonText}`,
        options: item.options || [...defaultOptions],
        correctAnswer: item.correctAnswer || "A",
        explanation: item.explanation || "",
      }))
      onSave(generated); onClose()
    } catch (error) {
      setError(error instanceof Error ? error.message : "Bulk generation failed")
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <ModalShell
      title={initial ? "Edit Assertion & Reason Question" : "Add Assertion & Reason Question"}
      icon={
        <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center shrink-0">
          <Layers size={18} className="text-purple-600"/>
        </div>
      }
      onClose={onClose}
    >
      <div className="space-y-4">
        {!initial && (
          <>
            {/* Box 1: Generate up to 10 topics at once */}
            <div className="rounded-2xl border border-purple-100 bg-purple-50/40 p-4 space-y-3">
              <p className="text-xs font-bold text-purple-800">Generate up to 10 topics at once</p>
              <div className="space-y-2">
                {bulkTopics.map((item, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <input
                      value={item.topic}
                      onChange={e => setBulkTopics(rows => rows.map((row, i) => i === index ? { ...row, topic: e.target.value } : row))}
                      placeholder={`Topic ${index + 1}`}
                      className="flex-1 h-11 px-3.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-colors"
                    />
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={item.count}
                      onChange={e => setBulkTopics(rows => rows.map((row, i) => i === index ? { ...row, count: Math.max(1, Math.min(60, Number(e.target.value) || 1)) } : row))}
                      className="w-18 sm:w-20 h-11 px-2.5 rounded-xl border border-slate-200 bg-white text-sm text-center font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
                    />
                    {index === bulkTopics.length - 1 && bulkTopics.length < 10 && (
                      <button
                        type="button"
                        onClick={() => setBulkTopics(rows => [...rows, { topic: "", count: 1 }])}
                        className="w-11 h-11 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-700 text-lg font-bold cursor-pointer transition-colors shadow-2xs shrink-0"
                        title="Add topic row"
                      >
                        +
                      </button>
                    )}
                    {bulkTopics.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setBulkTopics(rows => rows.filter((_, i) => i !== index))}
                        className="w-11 h-11 rounded-xl border border-red-100 bg-white hover:bg-red-50 flex items-center justify-center text-red-500 cursor-pointer transition-colors shrink-0"
                        title="Remove row"
                      >
                        <X size={15} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={generateBulk}
                disabled={isGenerating}
                className="h-10 px-4 rounded-xl bg-[#1E293B] hover:bg-[#0F172A] text-white text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors cursor-pointer disabled:opacity-60"
              >
                {isGenerating ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                <span>Generate All Topics</span>
              </button>
            </div>

            {/* Box 2: Single topic generator */}
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-3">
              <div className="flex gap-2">
                <input
                  value={aiPrompt}
                  onChange={e => setAiPrompt(e.target.value)}
                  placeholder="AI topic, e.g. Newton's laws, Thermodynamics..."
                  className="flex-1 h-11 px-3.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-colors"
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); generateWithAi(); } }}
                />
                <button
                  type="button"
                  onClick={generateWithAi}
                  disabled={isGenerating}
                  className="h-11 px-5 rounded-xl bg-[#1E293B] hover:bg-[#0F172A] text-white text-xs font-semibold flex items-center gap-1.5 shrink-0 shadow-xs transition-colors cursor-pointer disabled:opacity-60"
                >
                  {isGenerating ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                  <span>{isGenerating ? "Generating..." : "Generate"}</span>
                </button>
              </div>
            </div>
          </>
        )}

        {/* Assertion (A) Statement */}
        <div className="p-4 rounded-xl border border-purple-200 bg-purple-50/40 space-y-1.5">
          <label className="text-xs font-bold text-purple-900 flex items-center gap-1.5">
            <span className="px-2 py-0.5 rounded-md bg-purple-600 text-white text-[10px] uppercase font-black">Assertion (A) *</span>
          </label>
          <textarea
            value={q.assertionText || ""}
            onChange={e => setQ({ ...q, assertionText: e.target.value })}
            rows={3}
            placeholder="Enter the Assertion (A) statement..."
            className={textareaCls}
          />
        </div>

        {/* Reason (R) Statement */}
        <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/40 space-y-1.5">
          <label className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
            <span className="px-2 py-0.5 rounded-md bg-indigo-600 text-white text-[10px] uppercase font-black">Reason (R) *</span>
          </label>
          <textarea
            value={q.reasonText || ""}
            onChange={e => setQ({ ...q, reasonText: e.target.value })}
            rows={3}
            placeholder="Enter the Reason (R) statement..."
            className={textareaCls}
          />
        </div>

        {/* Question Image URL */}
        <div>
          <label className={labelCls}>
            Question Image URL <span className="text-slate-400 font-normal">(Optional)</span>
          </label>
          <input
            value={q.questionImage || ""}
            onChange={e => setQ({ ...q, questionImage: e.target.value })}
            placeholder="https://example.com/image.png"
            className={inputCls}
          />
        </div>

        {/* 3 Columns: Difficulty, Marks, Negative Mark */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <div>
            <label className={labelCls}>Difficulty *</label>
            <select
              value={q.difficulty}
              onChange={e => setQ({ ...q, difficulty: e.target.value as Difficulty })}
              className={inputCls + " cursor-pointer"}
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Marks *</label>
            <input
              type="number"
              value={q.marks}
              onChange={e => setQ({ ...q, marks: +e.target.value })}
              min={1}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>
              Negative Mark <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <input
              type="number"
              value={q.negativeMark ?? 1}
              onChange={e => setQ({ ...q, negativeMark: +e.target.value })}
              min={0}
              step={0.25}
              placeholder="e.g. 1"
              className={inputCls}
            />
          </div>
        </div>

        {/* Answer Options */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
              Answer Options
            </span>
            <span className="text-[11px] font-semibold text-slate-400">
              Select the correct option (A, B, C, or D)
            </span>
          </div>
          <div className="space-y-2.5">
            {["A", "B", "C", "D"].map((key, i) => {
              const isSelected = q.correctAnswer === key
              return (
                <div
                  key={key}
                  className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${
                    isSelected ? "border-purple-400 bg-purple-50/50 shadow-xs" : "border-slate-200 bg-white"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setQ({ ...q, correctAnswer: key })}
                    className={`mt-1 w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 font-bold text-xs cursor-pointer transition-colors ${
                      isSelected
                        ? "border-purple-600 bg-purple-600 text-white"
                        : "border-slate-300 text-slate-500 hover:border-slate-400"
                    }`}
                  >
                    {key}
                  </button>
                  <textarea
                    rows={2}
                    value={q.options[i]}
                    onChange={e => {
                      const updated = [...q.options]
                      updated[i] = e.target.value
                      setQ({ ...q, options: updated })
                    }}
                    className="flex-1 bg-transparent border-0 p-0 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none resize-none font-medium"
                  />
                </div>
              )
            })}
          </div>
        </div>

        {/* Explanation */}
        <div>
          <label className={labelCls}>
            Explanation <span className="text-slate-400 font-normal">(Optional)</span>
          </label>
          <textarea
            value={q.explanation}
            onChange={e => setQ({ ...q, explanation: e.target.value })}
            rows={3}
            placeholder="Explain why this option is correct..."
            className={textareaCls}
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 font-medium flex items-center gap-1.5 p-2.5 rounded-lg bg-red-50 border border-red-200">
            <AlertCircle size={14} className="shrink-0" />
            <span>{error}</span>
          </p>
        )}
      </div>
      <ModalFooter note="Fields marked with * are required" onCancel={onClose} onSave={save} />
    </ModalShell>
  )
}

// ─── TrueFalse Modal ──────────────────────────────────────────────────────────

function TrueFalseModal({ onSave, onClose, initial }: {
  onSave: (q: TrueFalseQuestion | TrueFalseQuestion[]) => void; onClose: () => void; initial?: TrueFalseQuestion
}) {
  const blank = (): TrueFalseQuestion => ({
    id: Math.random().toString(36).slice(2), type: "truefalse",
    questionText: "", difficulty: "medium", marks: 1,
    correctAnswer: "True", explanation: ""
  })
  const [q, setQ] = useState<TrueFalseQuestion>(initial ?? blank())
  const [error, setError] = useState("")
  const [aiPrompt, setAiPrompt] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [bulkTopics, setBulkTopics] = useState([{ topic: "", count: 1 }])

  const save = () => {
    if (!q.questionText.trim()) return setError("Statement is required")
    onSave(q); onClose()
  }

  const generateWithAi = async () => {
    if (!aiPrompt.trim()) return setError("Enter a topic or statement prompt first")
    setIsGenerating(true); setError("")
    try {
      const res = await fetch("/api/admin/generate-objective-question", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: aiPrompt, type: "truefalse", marks: q.marks, difficulty: q.difficulty }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to generate True/False question")
      setQ(prev => ({ ...prev, questionText: data.data.questionText, correctAnswer: data.data.correctAnswer, explanation: data.data.explanation }))
    } catch (error) { setError(error instanceof Error ? error.message : "Failed to generate True/False question") }
    finally { setIsGenerating(false) }
  }

  const generateBulk = async () => {
    const topics = bulkTopics.filter(item => item.topic.trim() && item.count > 0)
    if (!topics.length) return setError("Add at least one topic and question count")
    setIsGenerating(true); setError("")
    try {
      const res = await fetch("/api/admin/generate-objective-question", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topics, type: "truefalse", marks: q.marks, difficulty: q.difficulty }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Bulk generation failed")
      const generated = data.data.map((item: any): TrueFalseQuestion => ({ ...q, id: Math.random().toString(36).slice(2), questionText: item.questionText, correctAnswer: item.correctAnswer, explanation: item.explanation }))
      onSave(generated); onClose()
    } catch (error) { setError(error instanceof Error ? error.message : "Bulk generation failed") }
    finally { setIsGenerating(false) }
  }

  return (
    <ModalShell
      title={initial ? "Edit True/False Question" : "Add True/False Question"}
      icon={
        <div className="w-9 h-9 rounded-xl bg-teal-50 flex items-center justify-center shrink-0">
          <CheckSquare size={18} className="text-teal-600"/>
        </div>
      }
      onClose={onClose}
    >
      <div className="space-y-4">
        {!initial && (
          <>
            {/* Box 1: Generate up to 10 topics at once */}
            <div className="rounded-2xl border border-teal-100 bg-teal-50/40 p-4 space-y-3">
              <p className="text-xs font-bold text-teal-800">Generate up to 10 topics at once</p>
              <div className="space-y-2">
                {bulkTopics.map((item, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <input
                      value={item.topic}
                      onChange={e => setBulkTopics(rows => rows.map((row, i) => i === index ? { ...row, topic: e.target.value } : row))}
                      placeholder={`Topic ${index + 1}`}
                      className="flex-1 h-11 px-3.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-colors"
                    />
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={item.count}
                      onChange={e => setBulkTopics(rows => rows.map((row, i) => i === index ? { ...row, count: Math.max(1, Math.min(60, Number(e.target.value) || 1)) } : row))}
                      className="w-18 sm:w-20 h-11 px-2.5 rounded-xl border border-slate-200 bg-white text-sm text-center font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
                    />
                    {index === bulkTopics.length - 1 && bulkTopics.length < 10 && (
                      <button
                        type="button"
                        onClick={() => setBulkTopics(rows => [...rows, { topic: "", count: 1 }])}
                        className="w-11 h-11 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-700 text-lg font-bold cursor-pointer transition-colors shadow-2xs shrink-0"
                        title="Add topic row"
                      >
                        +
                      </button>
                    )}
                    {bulkTopics.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setBulkTopics(rows => rows.filter((_, i) => i !== index))}
                        className="w-11 h-11 rounded-xl border border-red-100 bg-white hover:bg-red-50 flex items-center justify-center text-red-500 cursor-pointer transition-colors shrink-0"
                        title="Remove row"
                      >
                        <X size={15} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={generateBulk}
                disabled={isGenerating}
                className="h-10 px-4 rounded-xl bg-[#1E293B] hover:bg-[#0F172A] text-white text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors cursor-pointer disabled:opacity-60"
              >
                {isGenerating ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                <span>Generate All Topics</span>
              </button>
            </div>

            {/* Box 2: Single topic generator */}
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-3">
              <div className="flex gap-2">
                <input
                  value={aiPrompt}
                  onChange={e => setAiPrompt(e.target.value)}
                  placeholder="AI topic, e.g. JavaScript basics..."
                  className="flex-1 h-11 px-3.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-colors"
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); generateWithAi(); } }}
                />
                <button
                  type="button"
                  onClick={generateWithAi}
                  disabled={isGenerating}
                  className="h-11 px-5 rounded-xl bg-[#1E293B] hover:bg-[#0F172A] text-white text-xs font-semibold flex items-center gap-1.5 shrink-0 shadow-xs transition-colors cursor-pointer disabled:opacity-60"
                >
                  {isGenerating ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                  <span>{isGenerating ? "Generating..." : "Generate"}</span>
                </button>
              </div>
            </div>
          </>
        )}

        {/* Statement */}
        <div>
          <label className={labelCls}>Statement *</label>
          <textarea
            value={q.questionText}
            onChange={e => setQ({ ...q, questionText: e.target.value })}
            rows={4}
            placeholder="Enter the statement here..."
            className={textareaCls}
          />
        </div>

        {/* Question Image URL */}
        <div>
          <label className={labelCls}>
            Question Image URL <span className="text-slate-400 font-normal">(Optional)</span>
          </label>
          <input
            value={q.questionImage || ""}
            onChange={e => setQ({ ...q, questionImage: e.target.value })}
            placeholder="https://example.com/image.png"
            className={inputCls}
          />
        </div>

        {/* 3 Columns: Difficulty, Marks, Negative Mark */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <div>
            <label className={labelCls}>Difficulty *</label>
            <select
              value={q.difficulty}
              onChange={e => setQ({ ...q, difficulty: e.target.value as Difficulty })}
              className={inputCls + " cursor-pointer"}
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Marks *</label>
            <input
              type="number"
              value={q.marks}
              onChange={e => setQ({ ...q, marks: +e.target.value })}
              min={1}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Negative Mark</label>
            <input
              type="number"
              step="0.25"
              value={q.negativeMark || 0}
              onChange={e => setQ({ ...q, negativeMark: +e.target.value })}
              min={0}
              className={inputCls}
              placeholder="0"
            />
          </div>
        </div>

        {/* Correct Answer */}
        <div>
          <label className={labelCls}>Correct Answer *</label>
          <div className="grid grid-cols-2 gap-3">
            {(["True", "False"] as const).map(opt => (
              <button
                key={opt}
                type="button"
                onClick={() => setQ({ ...q, correctAnswer: opt })}
                className={`h-12 rounded-xl border-2 text-sm font-semibold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                  q.correctAnswer === opt
                    ? opt === "True"
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700 shadow-2xs"
                      : "border-red-500 bg-red-50 text-red-700 shadow-2xs"
                    : "border-slate-200 text-slate-600 hover:border-slate-300 bg-white"
                }`}
              >
                {q.correctAnswer === opt && <Check size={14} className="stroke-[3]" />}
                <span>{opt}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Explanation */}
        <div>
          <label className={labelCls}>
            Explanation <span className="text-slate-400 font-normal">(Shown after answering)</span>
          </label>
          <textarea
            value={q.explanation}
            onChange={e => setQ({ ...q, explanation: e.target.value })}
            rows={3}
            placeholder="Explain why this is true or false..."
            className={textareaCls}
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 font-medium flex items-center gap-1.5 p-2.5 rounded-lg bg-red-50 border border-red-200">
            <AlertCircle size={14} className="shrink-0" />
            <span>{error}</span>
          </p>
        )}
      </div>
      <ModalFooter
        note={<span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"/>Auto-graded question type</span>}
        onCancel={onClose}
        onSave={save}
      />
    </ModalShell>
  )
}

// ─── Descriptive Modal ────────────────────────────────────────────────────────

function DescriptiveModal({ onSave, onClose, initial }: {
  onSave: (q: DescriptiveQuestion) => void; onClose: () => void; initial?: DescriptiveQuestion
}) {
  const blank = (): DescriptiveQuestion => ({
    id: Math.random().toString(36).slice(2), type: "descriptive",
    questionText: "", difficulty: "medium", marks: 10,
    wordLimit: "", modelAnswer: "", rubric: ["","",""]
  })
  const [q, setQ] = useState<DescriptiveQuestion>(initial ?? blank())
  const [error, setError] = useState("")

  const save = () => {
    if (!q.questionText.trim()) return setError("Question text is required")
    onSave(q); onClose()
  }

  return (
    <ModalShell
      title={initial ? "Edit Descriptive Question" : "Add Descriptive Question"}
      icon={
        <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center shrink-0">
          <AlignLeft size={18} className="text-purple-600"/>
        </div>
      }
      onClose={onClose}
    >
      <div className="space-y-4">
        <div>
          <label className={labelCls}>Question Text *</label>
          <textarea
            value={q.questionText}
            onChange={e => setQ({ ...q, questionText: e.target.value })}
            rows={4}
            placeholder="Enter your descriptive question here..."
            className={textareaCls}
          />
        </div>
        <div>
          <label className={labelCls}>
            Question Image URL <span className="text-slate-400 font-normal">(Optional)</span>
          </label>
          <input
            value={q.questionImage || ""}
            onChange={e => setQ({ ...q, questionImage: e.target.value })}
            placeholder="https://example.com/image.png"
            className={inputCls}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <div>
            <label className={labelCls}>Difficulty *</label>
            <select
              value={q.difficulty}
              onChange={e => setQ({ ...q, difficulty: e.target.value as Difficulty })}
              className={inputCls + " cursor-pointer"}
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Marks *</label>
            <input
              type="number"
              value={q.marks}
              onChange={e => setQ({ ...q, marks: +e.target.value })}
              min={1}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>
              Word Limit <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <input
              value={q.wordLimit}
              onChange={e => setQ({ ...q, wordLimit: e.target.value })}
              placeholder="e.g. 200-300 words"
              className={inputCls}
            />
          </div>
        </div>
        <div>
          <label className={labelCls}>
            Model Answer <span className="text-slate-400 font-normal">(For grading reference)</span>
          </label>
          <textarea
            value={q.modelAnswer}
            onChange={e => setQ({ ...q, modelAnswer: e.target.value })}
            rows={4}
            placeholder="Enter the ideal answer or key points that should be covered..."
            className={textareaCls}
          />
        </div>
        <div>
          <label className={labelCls}>
            Grading Rubric <span className="text-slate-400 font-normal">(Optional - define scoring criteria)</span>
          </label>
          <div className="space-y-2">
            {q.rubric.map((r, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input
                  value={r}
                  onChange={e => {
                    const rb = [...q.rubric]
                    rb[i] = e.target.value
                    setQ({ ...q, rubric: rb })
                  }}
                  placeholder={`Criterion ${i + 1}`}
                  className={inputCls}
                />
                {q.rubric.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setQ({ ...q, rubric: q.rubric.filter((_, idx) => idx !== i) })}
                    className="w-11 h-11 rounded-xl border border-red-100 bg-white hover:bg-red-50 flex items-center justify-center text-red-500 cursor-pointer transition-colors shrink-0"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => setQ({ ...q, rubric: [...q.rubric, ""] })}
              className="h-10 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus size={14} /> Add Rubric Criterion
            </button>
          </div>
        </div>
        {error && (
          <p className="text-sm text-red-600 font-medium flex items-center gap-1.5 p-2.5 rounded-lg bg-red-50 border border-red-200">
            <AlertCircle size={14} className="shrink-0" />
            <span>{error}</span>
          </p>
        )}
      </div>
      <ModalFooter
        note={<span className="flex items-center gap-1.5"><AlertCircle size={13} className="text-slate-400"/>Descriptive answers require manual evaluation</span>}
        onCancel={onClose}
        onSave={save}
      />
    </ModalShell>
  )
}

// ─── FillBlanks Modal ─────────────────────────────────────────────────────────

function FillBlanksModal({ onSave, onClose, initial }: {
  onSave: (q: FillBlanksQuestion | FillBlanksQuestion[]) => void; onClose: () => void; initial?: FillBlanksQuestion
}) {
  const blank = (): FillBlanksQuestion => ({
    id: Math.random().toString(36).slice(2), type: "fillblanks",
    questionText: "", difficulty: "medium", marks: 1,
    blanks: [], caseInsensitive: true
  })
  const [q, setQ] = useState<FillBlanksQuestion>(() => {
    if (initial) {
      const blanks = (initial.blanks && initial.blanks.length > 0)
        ? initial.blanks
        : [{ answer: (initial as any).correctAnswer || (initial.options ? initial.options[0] : "") || "", alsoAccept: [] }]
      return { ...initial, blanks }
    }
    return blank()
  })
  const [error, setError] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [aiPrompt, setAiPrompt] = useState("")
  const [bulkTopics, setBulkTopics] = useState([{ topic: "", count: 1 }])

  const detectBlanks = (text: string) => {
    const matches = text.match(/_{2,}/g) || []
    const newBlanks = matches.map((_, i) => q.blanks[i] ?? { answer: "", alsoAccept: [] })
    setQ(prev => ({ ...prev, questionText: text, blanks: newBlanks }))
  }

  const save = () => {
    if (!q.questionText.trim()) return setError("Question text is required")
    if (q.blanks.length === 0) return setError("Use ___ to mark blanks in the question text")
    if (q.blanks.some(b => !b.answer.trim())) return setError("All blanks need a correct answer")
    onSave(q); onClose()
  }

  const generateWithAi = async () => {
    if (!aiPrompt.trim()) return setError("Enter a topic for the fill-in-the-blanks question")
    setIsGenerating(true); setError("")
    try {
      const res = await fetch("/api/admin/generate-objective-question", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: aiPrompt, type: "fillblanks", marks: q.marks, difficulty: q.difficulty }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to generate Fill Blanks question")
      const item = data.data
      setQ(prev => ({
        ...prev,
        questionText: item.questionText,
        blanks: (item.blanks || []).map((blank: any) => ({
          answer: blank.answer,
          alsoAccept: Array.isArray(blank.alsoAccept) ? blank.alsoAccept : [],
        })),
      }))
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to generate Fill Blanks question") }
    finally { setIsGenerating(false) }
  }

  const generateBulk = async () => {
    const topics = bulkTopics.filter(item => item.topic.trim() && item.count > 0)
    if (!topics.length) return setError("Add at least one topic and question count")
    setIsGenerating(true); setError("")
    try {
      const res = await fetch("/api/admin/generate-objective-question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topics, type: "fillblanks", marks: q.marks, difficulty: q.difficulty }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Bulk generation failed")
      const generated = data.data.map((item: any): FillBlanksQuestion => ({
        ...q,
        id: Math.random().toString(36).slice(2),
        questionText: item.questionText,
        blanks: item.blanks.map((blank: any) => ({ answer: blank.answer, alsoAccept: Array.isArray(blank.alsoAccept) ? blank.alsoAccept : [] })),
      }))
      onSave(generated); onClose()
    } catch (error) {
      setError(error instanceof Error ? error.message : "Bulk generation failed")
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <ModalShell
      title={initial ? "Edit Fill in the Blanks" : "Add Fill in the Blanks"}
      icon={
        <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
          <FileText size={18} className="text-amber-600"/>
        </div>
      }
      onClose={onClose}
    >
      <div className="space-y-4">
        {!initial && (
          <>
            {/* Box 1: Generate up to 10 topics at once */}
            <div className="rounded-2xl border border-amber-100 bg-amber-50/40 p-4 space-y-3">
              <p className="text-xs font-bold text-amber-800">Generate up to 10 topics at once</p>
              <div className="space-y-2">
                {bulkTopics.map((item, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <input
                      value={item.topic}
                      onChange={e => setBulkTopics(rows => rows.map((row, i) => i === index ? { ...row, topic: e.target.value } : row))}
                      placeholder={`Topic ${index + 1}`}
                      className="flex-1 h-11 px-3.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-colors"
                    />
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={item.count}
                      onChange={e => setBulkTopics(rows => rows.map((row, i) => i === index ? { ...row, count: Math.max(1, Math.min(60, Number(e.target.value) || 1)) } : row))}
                      className="w-18 sm:w-20 h-11 px-2.5 rounded-xl border border-slate-200 bg-white text-sm text-center font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
                    />
                    {index === bulkTopics.length - 1 && bulkTopics.length < 10 && (
                      <button
                        type="button"
                        onClick={() => setBulkTopics(rows => [...rows, { topic: "", count: 1 }])}
                        className="w-11 h-11 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-700 text-lg font-bold cursor-pointer transition-colors shadow-2xs shrink-0"
                        title="Add topic row"
                      >
                        +
                      </button>
                    )}
                    {bulkTopics.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setBulkTopics(rows => rows.filter((_, i) => i !== index))}
                        className="w-11 h-11 rounded-xl border border-red-100 bg-white hover:bg-red-50 flex items-center justify-center text-red-500 cursor-pointer transition-colors shrink-0"
                        title="Remove row"
                      >
                        <X size={15} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={generateBulk}
                disabled={isGenerating}
                className="h-10 px-4 rounded-xl bg-[#1E293B] hover:bg-[#0F172A] text-white text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors cursor-pointer disabled:opacity-60"
              >
                {isGenerating ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                <span>Generate All Topics</span>
              </button>
            </div>

            {/* Box 2: Single topic generator */}
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-3">
              <div className="flex gap-2">
                <input
                  value={aiPrompt}
                  onChange={e => setAiPrompt(e.target.value)}
                  placeholder="AI topic, e.g. water cycle..."
                  className="flex-1 h-11 px-3.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-colors"
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); generateWithAi(); } }}
                />
                <button
                  type="button"
                  onClick={generateWithAi}
                  disabled={isGenerating}
                  className="h-11 px-5 rounded-xl bg-[#1E293B] hover:bg-[#0F172A] text-white text-xs font-semibold flex items-center gap-1.5 shrink-0 shadow-xs transition-colors cursor-pointer disabled:opacity-60"
                >
                  {isGenerating ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                  <span>{isGenerating ? "Generating..." : "Generate"}</span>
                </button>
              </div>
            </div>
          </>
        )}

        <div className="bg-amber-50 rounded-xl px-4 py-3 text-xs text-amber-800 border border-amber-200/60 leading-relaxed">
          Use <strong>___</strong> (3 or more underscores) to designate blank locations in your text.
        </div>

        <div>
          <label className={labelCls}>Question with Blanks *</label>
          <textarea
            value={q.questionText}
            onChange={e => detectBlanks(e.target.value)}
            rows={3}
            placeholder="The chemical formula for water is ___ and for carbon dioxide is ___."
            className={textareaCls}
          />
        </div>

        <div>
          <label className={labelCls}>
            Question Image URL <span className="text-slate-400 font-normal">(Optional)</span>
          </label>
          <input
            value={q.questionImage || ""}
            onChange={e => setQ({ ...q, questionImage: e.target.value })}
            placeholder="https://example.com/image.png"
            className={inputCls}
          />
        </div>

        {/* 3 Columns: Difficulty, Marks, Negative Mark */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <div>
            <label className={labelCls}>Difficulty *</label>
            <select
              value={q.difficulty}
              onChange={e => setQ({ ...q, difficulty: e.target.value as Difficulty })}
              className={inputCls + " cursor-pointer"}
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Marks *</label>
            <input
              type="number"
              value={q.marks}
              onChange={e => setQ({ ...q, marks: +e.target.value })}
              min={1}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Negative Mark</label>
            <input
              type="number"
              step="0.1"
              value={q.negativeMark || 0}
              onChange={e => setQ({ ...q, negativeMark: +e.target.value })}
              min={0}
              className={inputCls}
              placeholder="0"
            />
          </div>
        </div>

        {q.blanks.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={labelCls + " mb-0 uppercase tracking-wider"}>CORRECT ANSWERS</label>
              <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
                <input
                  type="checkbox"
                  checked={q.caseInsensitive}
                  onChange={e => setQ({ ...q, caseInsensitive: e.target.checked })}
                  className="rounded border-slate-300 text-slate-900 focus:ring-slate-900/20"
                />
                Case insensitive matching
              </label>
            </div>
            <div className="space-y-3">
              {q.blanks.map((bl, i) => (
                <div key={i} className="p-3 bg-slate-50/60 rounded-xl border border-slate-200/80 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-amber-100 text-amber-800 text-xs font-bold flex items-center justify-center shrink-0">
                      {i + 1}
                    </span>
                    <input
                      value={bl.answer}
                      onChange={e => {
                        const bs = [...q.blanks]
                        bs[i] = { ...bs[i], answer: e.target.value }
                        setQ({ ...q, blanks: bs })
                      }}
                      placeholder={`Correct answer for blank #${i + 1}`}
                      className={inputCls}
                    />
                  </div>
                  <div className="flex items-center gap-2 pl-9 flex-wrap">
                    <span className="text-xs text-slate-400">Also accept:</span>
                    {bl.alsoAccept.map((a, ai) => (
                      <input
                        key={ai}
                        value={a}
                        onChange={e => {
                          const bs = [...q.blanks]
                          const aa = [...bs[i].alsoAccept]
                          aa[ai] = e.target.value
                          bs[i] = { ...bs[i], alsoAccept: aa }
                          setQ({ ...q, blanks: bs })
                        }}
                        placeholder="Alternative..."
                        className="w-28 h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-800 focus:outline-none focus:border-slate-400"
                      />
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        const bs = [...q.blanks]
                        bs[i] = { ...bs[i], alsoAccept: [...bs[i].alsoAccept, ""] }
                        setQ({ ...q, blanks: bs })
                      }}
                      className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Plus size={13} /> Add
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && (
          <p className="text-sm text-red-600 font-medium flex items-center gap-1.5 p-2.5 rounded-lg bg-red-50 border border-red-200">
            <AlertCircle size={14} className="shrink-0" />
            <span>{error}</span>
          </p>
        )}
      </div>
      <ModalFooter
        note={
          <span className="flex items-center gap-1.5 text-amber-700">
            <span className="w-2 h-2 rounded-full bg-amber-500 inline-block"/>
            {q.blanks.length} blank{q.blanks.length !== 1 ? "s" : ""} detected · Auto-graded
          </span>
        }
        onCancel={onClose}
        onSave={save}
      />
    </ModalShell>
  )
}

// ─── Coding Modal ─────────────────────────────────────────────────────────────

const DEFAULT_TEMPLATES: Record<string, string> = {
  python: "class Solution:\n    def solve(self, nums, target):\n        # Write your code here\n        pass\n",
  javascript: "class Solution {\n    solve(nums, target) {\n        // Write your code here\n    }\n}\n",
  java: "public class Solution {\n    public int[] solve(int[] nums, int target) {\n        // Write your code here\n        return new int[]{0, 1};\n    }\n}",
  cpp: "#include <iostream>\n#include <vector>\n\nclass Solution {\npublic:\n    std::vector<int> solve(std::vector<int>& nums, int target) {\n        // Write your code here\n        return {0, 1};\n    }\n};",
  go: "package main\n\ntype Solution struct{}\n\nfunc (s *Solution) Solve(nums []int, target int) []int {\n    // Write your code here\n    return []int{0, 1}\n}",
  rust: "struct Solution;\n\nimpl Solution {\n    pub fn solve(nums: Vec<i32>, target: i32) -> Vec<i32> {\n        // Write your code here\n        vec![0, 1]\n    }\n}"
}

const DEFAULT_DRIVERS: Record<string, string> = {
  python: "if __name__ == '__main__':\n    import sys, json, inspect\n    sol = Solution()\n    for line in sys.stdin:\n        if not line.strip(): continue\n        try:\n            data = json.loads(line)\n            if isinstance(data, dict):\n                sig = inspect.signature(sol.solve)\n                params = list(sig.parameters.keys())\n                if len(params) == 1 and params[0] not in data:\n                    result = sol.solve(data)\n                else:\n                    filtered_data = {k: v for k, v in data.items() if k in params}\n                    result = sol.solve(**filtered_data)\n            elif isinstance(data, list):\n                result = sol.solve(*data)\n            else:\n                result = sol.solve(data)\n            print(json.dumps(result))\n        except Exception as e: sys.stderr.write(str(e))",
  javascript: "const readline = require('readline');\nconst rl = readline.createInterface({ input: process.stdin });\nconst sol = new Solution();\nfunction getParamNames(func) {\n    const str = func.toString();\n    const result = str.slice(str.indexOf('(') + 1, str.indexOf(')')).match(/([^\\s,]+)/g);\n    return result === null ? [] : result;\n}\nrl.on('line', (line) => {\n    if (!line.trim()) return;\n    try {\n        const data = JSON.parse(line);\n        let result;\n        if (typeof data === 'object' && !Array.isArray(data)) {\n            const params = getParamNames(sol.solve);\n            if (params.length === 1 && !(params[0] in data)) {\n                result = sol.solve(data);\n            } else {\n                const args = params.map(p => data[p]);\n                result = sol.solve(...args);\n            }\n        } else if (Array.isArray(data)) {\n            result = sol.solve(...data);\n        } else {\n            result = sol.solve(data);\n        }\n        console.log(JSON.stringify(result));\n    }\n    catch (e) { console.error(e); }\n});",
  java: "import java.util.Scanner;\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        Solution sol = new Solution();\n        while (sc.hasNextLine()) {\n            String line = sc.nextLine();\n            if (line.trim().isEmpty()) continue;\n            System.out.println(sol.solve(line));\n        }\n    }\n}",
  cpp: "#include <iostream>\n#include <string>\nint main() {\n    std::string line;\n    Solution sol;\n    while (std::getline(std::cin, line)) {\n        if (line.empty()) continue;\n        std::cout << sol.solve(line) << std::endl;\n    }\n    return 0;\n}",
  go: "func main() {\n    var input string\n    sol := Solution{}\n    for {\n        _, err := fmt.Scanln(&input)\n        if err != nil { break }\n        fmt.Println(sol.Solve(input))\n    }\n}",
  rust: "fn main() {\n    use std::io::{self, BufRead};\n    let stdin = io::stdin();\n    for line in stdin.lock().lines() {\n        let s = line.unwrap();\n        if s.trim().is_empty() { continue; }\n        println!(\"{}\", Solution::solve(s));\n    }\n}"
}

function CodingModal({ onSave, onClose, initial }: {
  onSave: (q: CodingQuestion) => void; onClose: () => void; initial?: CodingQuestion
}) {
  const blank = (): CodingQuestion => ({
    id: Math.random().toString(36).slice(2), type: "coding",
    questionText: "", difficulty: "hard", marks: 15,
    codeTemplate: "",
    codeTemplates: { ...DEFAULT_TEMPLATES },
    driverCode: { ...DEFAULT_DRIVERS },
    testCases: [{ input: "", expectedOutput: "" }],
    constraints: [], languages: ["Python", "JavaScript"]
  })

  // Merge initial data with defaults for missing fields (new multi-lang support)
  const [q, setQ] = useState<CodingQuestion>(() => {
    const base = initial ?? blank()
    // Ensure all enabled languages have a template/driver (fallback to defaults if missing)
    const templates = { ...DEFAULT_TEMPLATES, ...(base.codeTemplates || {}) }
    const drivers = { ...DEFAULT_DRIVERS, ...(base.driverCode || {}) }
    return { ...base, codeTemplates: templates, driverCode: drivers }
  })
  const [activeLang, setActiveLang] = useState<string>(q.languages[0]?.toLowerCase() || "python")
  const [error, setError] = useState("")
  const [aiPrompt, setAiPrompt] = useState("")
  const [isAiGenerating, setIsAiGenerating] = useState(false)
  const [aiError, setAiError] = useState("")

  const handleAiGenerate = async () => {
    if (!aiPrompt.trim()) return
    setIsAiGenerating(true)
    setAiError("")
    try {
      const res = await fetch("/api/admin/generate-coding-question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          prompt: aiPrompt,
          languages: q.languages.length > 0 ? q.languages : ["Python", "Java", "C++", "JavaScript"]
        })
      })
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || "Failed to generate question")
      }
      const data = json.data
      setQ(prev => {
        const langs = prev.languages.length > 0 ? prev.languages : ["Python", "Java", "C++", "JavaScript"]
        return {
          ...prev,
          questionText: data.questionText || prev.questionText,
          difficulty: (data.difficulty as Difficulty) || prev.difficulty,
          constraints: Array.isArray(data.constraints) ? data.constraints : prev.constraints,
          codeTemplates: {
            ...prev.codeTemplates,
            ...(data.codeTemplates || {})
          },
          testCases: Array.isArray(data.testCases) && data.testCases.length > 0
            ? data.testCases
            : prev.testCases,
          languages: langs
        }
      })
      if (data.codeTemplates && Object.keys(data.codeTemplates).length > 0) {
        const firstKey = Object.keys(data.codeTemplates)[0].toLowerCase()
        setActiveLang(firstKey)
      }
    } catch (err: any) {
      setAiError(err.message || "Failed to generate")
    } finally {
      setIsAiGenerating(false)
    }
  }

  const save = () => {
    if (!q.questionText.trim()) return setError("Problem statement is required")
    if (q.languages.length === 0) return setError("At least one language must be enabled")
    onSave(q); onClose()
  }

  return (
    <ModalShell
      title="Coding Challenge Studio"
      icon={
        <div className="w-9 h-9 rounded-xl bg-[#eaf0f8] border border-[#cbd5e1] flex items-center justify-center text-[#324158] shadow-2xs">
          <Code2 size={18} />
        </div>
      }
      onClose={onClose}
      maxWidth="max-w-4xl"
    >
      <div className="space-y-4 pb-2 overflow-y-auto max-h-[82vh] px-0.5 custom-scrollbar">
        {/* Gemini AI Auto-Generator */}
        <div className="p-4 bg-gradient-to-b from-[#f8fafc] to-[#eaf0f8]/35 border border-[#cbd5e1] rounded-2xl space-y-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-[#324158]">
              <Sparkles size={14} className="text-[#324158]" />
              <span>Smart AI Coding Problem Generator</span>
            </div>
            <span className="text-[10px] font-bold text-[#324158] px-2.5 py-0.5 bg-[#eaf0f8] border border-[#cbd5e1] rounded-full">
              Auto-Fill
            </span>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. Check Palindrome / Two Sum / Reverse Linked List / Binary Search..."
              value={aiPrompt}
              onChange={e => setAiPrompt(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleAiGenerate(); } }}
              disabled={isAiGenerating}
              className="flex-1 h-10 px-3.5 text-xs font-semibold bg-white border border-[#cbd5e1] rounded-xl text-[#324158] placeholder:text-slate-400 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-[#324158]/20 focus:border-[#324158] disabled:opacity-60 shadow-2xs transition-all"
            />
            <button
              type="button"
              disabled={isAiGenerating || !aiPrompt.trim()}
              onClick={handleAiGenerate}
              className="h-10 px-4 bg-[#324158] hover:bg-[#253244] text-white text-xs font-bold rounded-xl transition-all disabled:opacity-50 flex items-center gap-1.5 shadow-2xs shrink-0 cursor-pointer"
            >
              {isAiGenerating ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              <span>{isAiGenerating ? "Generating..." : "Generate AI"}</span>
            </button>
          </div>
          {aiError && (
            <p className="text-[11px] text-red-600 font-semibold flex items-center gap-1">
              <AlertCircle size={12} /> {aiError}
            </p>
          )}
          <p className="text-[11px] text-slate-500">
            Type any programming problem or topic name to auto-fill description, starter templates for all languages, and test cases instantly.
          </p>
        </div>

        {/* Step-by-Step Guide */}
        <div className="bg-slate-50/80 border border-[#cbd5e1] rounded-xl p-3.5 text-xs text-[#324158] leading-relaxed">
          <p className="font-bold mb-1 flex items-center gap-1.5 text-[#324158]">
            <Info size={13} className="text-[#324158]" />
            How to configure a LeetCode-style problem:
          </p>
          <ol className="list-decimal list-inside space-y-1 ml-1 text-[11.5px] text-slate-600">
            <li>Write the <b>Problem Statement</b> and configure <b>Difficulty</b> & <b>Marks</b>.</li>
            <li>Select the <b>Languages</b> you want candidates to be able to choose from.</li>
            <li>Under each language tab, the <b>Initial Template</b> is what the student sees in their code editor.</li>
            <li>The <b>Driver Code</b> (hidden internal runner) executes the candidate's code and feeds test cases via <code>stdin</code>.</li>
            <li>Add <b>Test Cases</b> with sample inputs & expected outputs matching your driver logic.</li>
          </ol>
        </div>

        {/* Problem Statement */}
        <div>
          <label className="block text-xs font-bold text-[#324158] mb-1.5">Problem Statement <span className="text-rose-500">*</span></label>
          <textarea
            value={q.questionText}
            onChange={e => setQ({...q, questionText: e.target.value})}
            rows={4}
            placeholder="Describe the problem clearly, including input format, output format, and constraints..."
            className="w-full px-3.5 py-2.5 rounded-xl border border-[#cbd5e1] bg-white hover:border-[#324158]/50 text-sm font-medium text-[#324158] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#324158]/20 focus:border-[#324158] transition-all shadow-2xs resize-none"
          />
        </div>

        {/* Question Image URL */}
        <div>
          <label className="block text-xs font-bold text-[#324158] mb-1.5">
            Diagram / Image URL <span className="text-slate-400 font-normal">(Optional)</span>
          </label>
          <input
            value={q.questionImage || ""}
            onChange={e => setQ({...q, questionImage: e.target.value})} 
            placeholder="https://example.com/graph-diagram.png"
            className="w-full h-10 px-3.5 rounded-xl border border-[#cbd5e1] bg-white hover:border-[#324158]/50 text-sm text-[#324158] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#324158]/20 focus:border-[#324158] transition-all shadow-2xs"
          />
        </div>

        {/* Difficulty, Marks, Negative Marks */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-bold text-[#324158] mb-1.5">Difficulty Level <span className="text-rose-500">*</span></label>
            <select
              value={q.difficulty}
              onChange={e => setQ({...q, difficulty: e.target.value as Difficulty})}
              className="w-full h-10 px-3 rounded-xl border border-[#cbd5e1] bg-white text-xs font-bold text-[#324158] focus:outline-none focus:ring-2 focus:ring-[#324158]/20 focus:border-[#324158] shadow-2xs cursor-pointer capitalize"
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-[#324158] mb-1.5">Marks <span className="text-rose-500">*</span></label>
            <input
              type="number"
              value={q.marks}
              onChange={e => setQ({...q, marks: +e.target.value})}
              min={1}
              className="w-full h-10 px-3.5 rounded-xl border border-[#cbd5e1] bg-white text-xs font-bold text-[#324158] focus:outline-none focus:ring-2 focus:ring-[#324158]/20 focus:border-[#324158] shadow-2xs"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-[#324158] mb-1.5">Negative Mark</label>
            <input
              type="number"
              step="0.1"
              value={q.negativeMark || 0}
              onChange={e => setQ({...q, negativeMark: +e.target.value})}
              min={0}
              className="w-full h-10 px-3.5 rounded-xl border border-[#cbd5e1] bg-white text-xs font-bold text-[#324158] focus:outline-none focus:ring-2 focus:ring-[#324158]/20 focus:border-[#324158] shadow-2xs"
              placeholder="0"
            />
          </div>
        </div>

        {/* Multi-Language Boilerplates */}
        <div>
          <label className="block text-xs font-bold text-[#324158] mb-1.5">
            Enabled Programming Languages <span className="text-rose-500">*</span>
          </label>
          <div className="flex gap-2 flex-wrap mb-3.5">
            {["Python","Java","C++","JavaScript","Go","Rust"].map(lang => {
              const active = q.languages.includes(lang)
              return (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setQ(prev => {
                    const langs = active ? prev.languages.filter(l => l !== lang) : [...prev.languages, lang]
                    return { ...prev, languages: langs }
                  })}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    active
                      ? "bg-[#324158] text-white border-[#324158] shadow-xs"
                      : "bg-white border-[#cbd5e1] text-slate-600 hover:border-[#324158]"
                  }`}
                >
                  {active && <span className="mr-1">✓</span>}
                  {lang}
                </button>
              )
            })}
          </div>

          {q.languages.length > 0 && (
            <div className="border border-[#cbd5e1] rounded-2xl overflow-hidden bg-white shadow-2xs">
              {/* Language selection tabs */}
              <div className="flex bg-slate-100/80 p-1 border-b border-[#cbd5e1] gap-1 overflow-x-auto">
                {q.languages.map(lang => {
                  const isActive = activeLang === lang.toLowerCase()
                  return (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => setActiveLang(lang.toLowerCase())}
                      className={`px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                        isActive
                          ? "bg-[#324158] text-white shadow-xs"
                          : "text-slate-600 hover:text-[#324158] hover:bg-white/60"
                      }`}
                    >
                      {lang}
                    </button>
                  )
                })}
              </div>

              {/* Code Editors */}
              <div className="p-4 space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Initial Boilerplate Template ({activeLang})
                    </label>
                    <span className="text-[9px] font-bold text-[#324158] bg-[#eaf0f8] border border-[#cbd5e1] px-2 py-0.5 rounded-full">
                      VISIBLE TO CANDIDATE
                    </span>
                  </div>
                  <textarea
                    value={q.codeTemplates[activeLang] || ""}
                    onChange={e => setQ({
                      ...q,
                      codeTemplates: { ...q.codeTemplates, [activeLang]: e.target.value }
                    })}
                    rows={6}
                    className="w-full p-3 bg-[#1e293b] text-slate-100 font-mono text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-[#324158] border border-slate-700"
                    placeholder={`Enter starter boilerplate function / class for ${activeLang}...`}
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Driver Code Runner ({activeLang})
                    </label>
                    <span className="text-[9px] font-bold text-slate-600 bg-slate-100 border border-slate-300 px-2 py-0.5 rounded-full">
                      INTERNAL TEST RUNNER (HIDDEN)
                    </span>
                  </div>
                  <textarea
                    value={q.driverCode[activeLang] || ""}
                    onChange={e => setQ({
                       ...q,
                       driverCode: { ...q.driverCode, [activeLang]: e.target.value }
                    })}
                    rows={4}
                    className="w-full p-3 bg-slate-50 text-[#324158] font-mono text-xs rounded-xl border border-[#cbd5e1] focus:outline-none focus:ring-1 focus:ring-[#324158]"
                    placeholder={`Enter driver code to run test cases in ${activeLang}...`}
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Reads candidate solution inputs via <code>stdin</code> and prints output to <code>stdout</code> for assertion.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Test Cases Studio */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-[#324158]">
                Test Cases ({q.testCases.length})
              </label>
              <span className="text-[10px] text-slate-400">At least 1 required</span>
            </div>
            <button
              type="button"
              onClick={() => setQ({...q, testCases: [...q.testCases, {input:"", expectedOutput:"", hidden: false}]})}
              className="text-xs text-[#324158] hover:bg-[#eaf0f8] px-2.5 py-1 rounded-lg border border-[#cbd5e1] flex items-center gap-1 font-bold transition-colors cursor-pointer"
            >
              <Plus size={13}/>
              <span>+ Add Test Case</span>
            </button>
          </div>
          <div className="space-y-3">
            {q.testCases.map((tc, i) => (
              <div key={i} className="bg-slate-50/70 p-3.5 rounded-xl border border-[#cbd5e1] space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-extrabold text-[#324158]">Test Case #{i + 1}</span>
                    <label className="flex items-center gap-1.5 cursor-pointer ml-2">
                      <input
                        type="checkbox"
                        checked={!!tc.hidden}
                        onChange={e => {
                          const tc2 = [...q.testCases]; tc2[i] = {...tc2[i], hidden: e.target.checked}; setQ({...q, testCases: tc2})
                        }}
                        className="rounded border-[#cbd5e1] text-[#324158] focus:ring-[#324158]"
                      />
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        Hidden Test Case
                      </span>
                    </label>
                  </div>
                  {q.testCases.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setQ({...q, testCases: q.testCases.filter((_, idx) => idx !== i)})}
                      className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                      title="Delete test case"
                    >
                      <Trash2 size={14}/>
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Input (stdin)</label>
                    <textarea
                      value={tc.input}
                      onChange={e => {
                        const tc2 = [...q.testCases]; tc2[i] = {...tc2[i], input: e.target.value}; setQ({...q, testCases: tc2})
                      }}
                      placeholder="e.g. 5\n1 2 3 4 5"
                      className="w-full h-18 p-2.5 text-xs font-mono bg-white border border-[#cbd5e1] rounded-xl text-[#324158] focus:outline-none focus:ring-1 focus:ring-[#324158] resize-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Expected Output (stdout)</label>
                    <textarea
                      value={tc.expectedOutput}
                      onChange={e => {
                        const tc2 = [...q.testCases]; tc2[i] = {...tc2[i], expectedOutput: e.target.value}; setQ({...q, testCases: tc2})
                      }}
                      placeholder="e.g. 15"
                      className="w-full h-18 p-2.5 text-xs font-mono bg-white border border-[#cbd5e1] rounded-xl text-[#324158] focus:outline-none focus:ring-1 focus:ring-[#324158] resize-none"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {error && (
          <p className="text-xs text-red-600 flex items-center gap-1.5 font-bold bg-red-50 border border-red-200 p-2.5 rounded-xl">
            <AlertCircle size={14}/> {error}
          </p>
        )}
      </div>
      <ModalFooter
        note={<span className="font-semibold text-slate-500">Multi-language code challenge configured</span>}
        onCancel={onClose}
        onSave={save}
      />
    </ModalShell>
  )
}

// ─── Modal Shell & Footer ─────────────────────────────────────────────────────

function ModalShell({ title, icon, onClose, maxWidth = "max-w-2xl", children }: {
  title: string; icon: React.ReactNode; onClose: () => void; maxWidth?: string; children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in-50">
      <div className={`bg-white rounded-2xl shadow-2xl border border-[#cbd5e1] w-full ${maxWidth} max-h-[92vh] flex flex-col overflow-hidden`}>
        <div className="flex items-center gap-3 px-5 sm:px-6 py-4 border-b border-slate-100 shrink-0 bg-slate-50/70">
          {icon}
          <h2 className="text-base sm:text-lg font-bold text-[#324158] flex-1 truncate">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-5 sm:px-6 py-4 space-y-4 custom-scrollbar">{children}</div>
      </div>
    </div>
  )
}

function ModalFooter({ note, onCancel, onSave }: { note: React.ReactNode; onCancel: () => void; onSave: () => void }) {
  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-4 mt-2 border-t border-slate-100 shrink-0">
      <div className="text-xs text-slate-500 font-medium">{note}</div>
      <div className="flex gap-2 sm:gap-3 justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 sm:flex-none h-10 px-5 rounded-xl border border-[#cbd5e1] bg-white hover:bg-[#eaf0f8] text-xs sm:text-sm font-bold text-[#324158] transition-colors cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSave}
          className="flex-1 sm:flex-none h-10 px-6 rounded-xl bg-[#324158] hover:bg-[#253244] text-white text-xs sm:text-sm font-bold shadow-xs transition-colors cursor-pointer"
        >
          Save Question
        </button>
      </div>
    </div>
  )
}

// ─── Step 1 ───────────────────────────────────────────────────────────────────

function Step1({ form, setForm }: { form: Step1Form; setForm: React.Dispatch<React.SetStateAction<Step1Form>> }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-8 shadow-xs relative">
      <div className="mb-6 sm:mb-8 pb-5 border-b border-slate-100">
        <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
          STEP 2 · EXAM DETAILS
        </p>
        <h2 className="mt-1 text-xl sm:text-2xl font-semibold tracking-tight text-slate-900">
          Basic Information
        </h2>
      </div>

      <div className="space-y-5 sm:space-y-6">
        <div>
          <label className={labelCls}>
            Exam Title <span className="text-red-500">*</span>
          </label>
          <input
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder="e.g. Physics Final Exam / Organic Chemistry Mock / General Aptitude"
            className={inputCls}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          <div>
            <label className={labelCls}>
              Duration (minutes) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={form.duration}
              onChange={e => setForm(f => ({ ...f, duration: e.target.value }))}
              placeholder="e.g. 60"
              min="1"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>
              Questions Per Minute <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <input
              type="number"
              value={form.questionsPerMin}
              onChange={e => setForm(f => ({ ...f, questionsPerMin: e.target.value }))}
              placeholder="e.g. 1.5"
              min="0.1"
              step="0.1"
              className={inputCls}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          <div>
            <label className={labelCls}>
              Pass Marks <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={form.passMarks}
              onChange={e => setForm(f => ({ ...f, passMarks: e.target.value }))}
              placeholder="e.g. 40"
              min="0"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>
              Total Marks <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={form.totalMarks}
              onChange={e => setForm(f => ({ ...f, totalMarks: e.target.value }))}
              placeholder="e.g. 100"
              min="1"
              className={inputCls}
            />
          </div>
        </div>

        <div>
          <label className={labelCls}>Instructions for Students</label>
          <textarea
            value={form.instructions}
            onChange={e => setForm(f => ({ ...f, instructions: e.target.value }))}
            rows={4}
            placeholder="Enter instructions, e.g. 'Read each question carefully. Calculators are not allowed.'"
            className={textareaCls}
          />
        </div>
      </div>
    </div>
  )
}

// ─── Step 2 ───────────────────────────────────────────────────────────────────

function Step2({ form, setForm, canUseAiProctoring }: { form: Step2Form; setForm: React.Dispatch<React.SetStateAction<Step2Form>>; canUseAiProctoring: boolean }) {
  const toggles: { key: keyof Step2Form; label: string; desc: string }[] = [
    { key: "randomize",      label: "Randomize Questions",       desc: "Display questions in random order for each student" },
    { key: "showResults",    label: "Show Results Immediately",  desc: "Students can see their score & answers right after submission" },
    { key: "allowReview",    label: "Allow Review Mode",         desc: "Students can review question explanations after submitting" },
    { key: "negativeMarking", label: "Enable Negative Marking",  desc: "Deduct marks for incorrect answers across sections" },
  ]

  const proctoringToggles = [
    { key: "faceDetection", label: "Face Detection Monitoring", desc: "Monitors candidate presence and face positioning during exam", icon: <Camera size={16} /> },
    { key: "tabSwitch",     label: "Tab-Switch Prevention",    desc: "Detects and warns when candidate leaves or switches tabs", icon: <AlertTriangle size={16} /> },
    { key: "fullscreen",    label: "Enforce Fullscreen Mode",   desc: "Requires exam to be taken in full screen with auto-termination", icon: <Maximize size={16} /> },
    { key: "aiProctoring",  label: "AI Proctoring Analysis",    desc: "Analyzes webcam stream in real-time for anomaly warnings", icon: <Shield size={16} /> },
  ] as const

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-8 shadow-xs relative">
      <div className="mb-6 sm:mb-8 pb-5 border-b border-slate-100">
        <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
          STEP 3 · TIMELINE & POLICIES
        </p>
        <h2 className="mt-1 text-xl sm:text-2xl font-semibold tracking-tight text-slate-900">
          Exam Settings & Proctoring
        </h2>
      </div>

      <div className="space-y-6 sm:space-y-8">
        {/* Schedule & Timeline */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <span className="w-1.5 h-5 bg-slate-900 rounded-full" />
            <h3 className="text-base font-semibold text-slate-900">Schedule & Timeline</h3>
          </div>

          {(() => {
            const startDt = form.startDate ? getExamStartDateTime({ startDate: form.startDate, startTime: form.startTime }) : null
            const endDt = form.endDate ? getExamEndDateTime({ endDate: form.endDate, endTime: form.endTime }) : null
            const isInvalid = !!(startDt && endDt && endDt.getTime() <= startDt.getTime())

            return (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  <ExamDateTimePicker
                    label="Start Date & Time"
                    sublabel="Students can only begin the exam at or after this time"
                    date={form.startDate}
                    time={form.startTime}
                    onDateChange={(d) => setForm(f => ({ ...f, startDate: d }))}
                    onTimeChange={(t) => setForm(f => ({ ...f, startTime: t }))}
                  />
                  <ExamDateTimePicker
                    label="End Date & Time"
                    sublabel="Exam automatically submits for all students at this time"
                    date={form.endDate}
                    time={form.endTime}
                    onDateChange={(d) => setForm(f => ({ ...f, endDate: d }))}
                    onTimeChange={(t) => setForm(f => ({ ...f, endTime: t }))}
                    referenceStart={{ date: form.startDate, time: form.startTime }}
                  />
                </div>

                {isInvalid && (
                  <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs sm:text-sm text-red-600 font-medium flex items-center gap-2">
                    <AlertCircle size={16} className="shrink-0" />
                    <span>End Date & Time must be after Start Date & Time!</span>
                  </div>
                )}

                {startDt && endDt && !isInvalid && (
                  <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs sm:text-sm text-emerald-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 shadow-2xs">
                    <div className="flex items-center gap-2.5">
                      <Clock size={16} className="text-emerald-600 shrink-0" />
                      <span className="leading-snug">
                        <strong className="font-semibold text-emerald-950">Active Exam Window: </strong>
                        {formatScheduleDateTime(startDt)} → {formatScheduleDateTime(endDt)}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-600 text-white px-2.5 py-0.5 rounded-full shrink-0 self-start sm:self-auto">
                      Strict Timed Access
                    </span>
                  </div>
                )}
              </div>
            )
          })()}
        </div>

        {/* 2 Columns: Evaluation Options & Proctoring Security */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 pt-4 border-t border-slate-100">
          {/* Evaluation Options */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="w-1.5 h-5 bg-slate-900 rounded-full" />
              <h3 className="text-base font-semibold text-slate-900">Evaluation Options</h3>
            </div>
            <div className="space-y-3">
              {toggles.map(t => (
                <div key={t.key} className="rounded-xl border border-slate-200/80 p-3.5 hover:border-slate-300 transition-colors bg-white">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 pr-2">
                      <p className="text-sm font-semibold text-slate-900">{t.label}</p>
                      <p className="text-xs text-slate-500 leading-relaxed mt-0.5">{t.desc}</p>
                    </div>
                    <Toggle checked={form[t.key] as boolean} onChange={() => setForm(f => ({ ...f, [t.key]: !f[t.key] }))} />
                  </div>
                  {t.key === "negativeMarking" && form.negativeMarking && (
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <label className="text-xs font-semibold text-slate-700 block mb-1.5">Default Negative Mark</label>
                      <input
                        type="number"
                        step="0.25"
                        min="0"
                        value={form.sectionNegativeMark}
                        onChange={e => setForm(f => ({ ...f, sectionNegativeMark: +e.target.value }))}
                        className={inputCls}
                        placeholder="e.g. 0.25"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Proctoring Security */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="w-1.5 h-5 bg-red-500 rounded-full" />
              <h3 className="text-base font-semibold text-slate-900">Proctoring Security</h3>
            </div>
            <div className="space-y-3">
              {proctoringToggles.map(pt => (
                <div key={pt.key} className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200/80 hover:border-slate-300 transition-colors bg-white gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-xl shrink-0 flex items-center justify-center ${form.proctoring[pt.key] ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-400"}`}>
                      {pt.icon}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{pt.label}</p>
                      <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{pt.desc}</p>
                    </div>
                  </div>
                  <Toggle
                    checked={form.proctoring[pt.key]}
                    disabled={pt.key === "aiProctoring" && !canUseAiProctoring}
                    onChange={() => setForm(f => ({
                      ...f,
                      proctoring: { ...f.proctoring, [pt.key]: !f.proctoring[pt.key] }
                    }))}
                  />
                </div>
              ))}
              <div className="p-3.5 bg-blue-50/60 rounded-xl border border-blue-100 text-xs text-blue-800">
                <p className="font-semibold flex items-center gap-1.5 mb-1 text-blue-900">
                  <Info size={14} className="text-blue-600" />
                  <span>Proctoring Notice</span>
                </p>
                <p className="leading-relaxed">
                  Enabling Face Detection and Fullscreen ensures student integrity by monitoring presence and preventing split-screen cheating.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Step 3 ───────────────────────────────────────────────────────────────────

function QuestionMenu({ q, onEdit, onDelete, onClose, anchorRect }: { q: Question; onEdit: (q: Question) => void; onDelete: (id: string) => void; onClose: () => void; anchorRect: DOMRect | null }) {
  const [mounted, setMounted] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  useEffect(() => setMounted(true), [])
  
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    if (mounted) {
      const timer = setTimeout(() => {
        document.addEventListener("mousedown", handleClickOutside)
        document.addEventListener("touchstart", handleClickOutside)
      }, 10)
      return () => {
        clearTimeout(timer)
        document.removeEventListener("mousedown", handleClickOutside)
        document.removeEventListener("touchstart", handleClickOutside)
      }
    }
  }, [mounted, onClose])
  
  if (!mounted || !anchorRect) return null

  const menuWidth = 160
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight

  let left = anchorRect.right - menuWidth
  if (left < 8) left = 8
  if (left + menuWidth > viewportWidth - 8) left = viewportWidth - menuWidth - 8

  const spaceBelow = viewportHeight - anchorRect.bottom
  const openUp = spaceBelow < 120 && anchorRect.top > 120
  const top = openUp ? anchorRect.top - 86 : anchorRect.bottom + 4
  
  return createPortal(
    <div 
      ref={menuRef} 
      style={{ position: "fixed", top, left }}
      className="z-[9999] bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden min-w-40 animate-in fade-in zoom-in-95 duration-100"
    >
      <button onClick={() => { onEdit(q); onClose() }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-[#eaf0f8] hover:text-[#324158] text-left border-b border-gray-100 font-medium transition-colors">
        <Pencil size={14} className="text-[#324158]" />
        <span className="flex-1">Edit Question</span>
      </button>
      <button onClick={() => { onDelete(q.id); onClose() }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 text-left font-medium transition-colors">
        <Trash2 size={14}/>
        <span className="flex-1">Delete</span>
      </button>
    </div>,
    document.body
  )
}

function Step3({
  questions, setQuestions, canUseQuestionStudio, canUsePdfImport, allowedCustomQuestionTypes
}: {
  questions: Question[]
  setQuestions: React.Dispatch<React.SetStateAction<Question[]>>
  canUseQuestionStudio: boolean
  canUsePdfImport: boolean
  allowedCustomQuestionTypes: QuestionType[]
}) {
  const [modal, setModal] = useState<QuestionType | null>(null)
  const [editQ, setEditQ] = useState<Question | null>(null)
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null)
  const [pdfUploading, setPdfUploading] = useState(false)
  const [pdfError, setPdfError] = useState("")
  const [showCompetitiveAiModal, setShowCompetitiveAiModal] = useState(false)
  const [expandedSolutions, setExpandedSolutions] = useState<Record<string, boolean>>({})
  const toggleSolution = (id: string) => setExpandedSolutions(prev => ({ ...prev, [id]: !prev[id] }))
  const fileRef = useRef<HTMLInputElement>(null)

  // ── AI In-Page Question Generator State ──
  const [aiTopic, setAiTopic] = useState("")
  const [aiDifficulty, setAiDifficulty] = useState<Difficulty>("medium")
  const [selectedFormats, setSelectedFormats] = useState<Record<"mcq" | "assertion" | "truefalse" | "descriptive" | "fillblanks", boolean>>({
    mcq: true,
    assertion: true,
    truefalse: true,
    descriptive: false,
    fillblanks: true,
  })
  const [formatCounts, setFormatCounts] = useState<Record<"mcq" | "assertion" | "truefalse" | "descriptive" | "fillblanks", number>>({
    mcq: 5,
    assertion: 2,
    truefalse: 2,
    descriptive: 2,
    fillblanks: 2,
  })
  const [isGeneratingAi, setIsGeneratingAi] = useState(false)
  const [aiGenError, setAiGenError] = useState("")

  const toggleFormat = (fmt: "mcq" | "assertion" | "truefalse" | "descriptive" | "fillblanks") => {
    setSelectedFormats(prev => ({ ...prev, [fmt]: !prev[fmt] }))
  }

  const updateFormatCount = (fmt: "mcq" | "assertion" | "truefalse" | "descriptive" | "fillblanks", delta: number) => {
    setFormatCounts(prev => ({
      ...prev,
      [fmt]: Math.max(1, Math.min(20, (prev[fmt] || 1) + delta))
    }))
  }

  const adjustAllCounts = (delta: number) => {
    setFormatCounts(prev => ({
      mcq: Math.max(1, Math.min(20, (prev.mcq || 1) + delta)),
      assertion: Math.max(1, Math.min(20, (prev.assertion || 1) + delta)),
      truefalse: Math.max(1, Math.min(20, (prev.truefalse || 1) + delta)),
      descriptive: Math.max(1, Math.min(20, (prev.descriptive || 1) + delta)),
      fillblanks: Math.max(1, Math.min(20, (prev.fillblanks || 1) + delta)),
    }))
  }

  const totalAiCount = (["mcq", "assertion", "truefalse", "descriptive", "fillblanks"] as const)
    .reduce((sum, fmt) => sum + (selectedFormats[fmt] ? (formatCounts[fmt] || 0) : 0), 0)

  const handleGenerateAi = async () => {
    if (!aiTopic.trim()) {
      toast.error("Please enter a Topic Name first")
      return
    }
    if (totalAiCount === 0) {
      toast.error("Please select at least one question format")
      return
    }
    if (totalAiCount > 40) {
      toast.error("Maximum 40 questions can be generated per batch. Please reduce quantities.")
      return
    }

    setIsGeneratingAi(true)
    setAiGenError("")
    try {
      const blueprint: Record<string, number> = {}
      if (selectedFormats.mcq) blueprint.mcq = formatCounts.mcq
      if (selectedFormats.assertion) blueprint.assertion = formatCounts.assertion
      if (selectedFormats.truefalse) blueprint.truefalse = formatCounts.truefalse
      if (selectedFormats.descriptive) blueprint.descriptive = formatCounts.descriptive
      if (selectedFormats.fillblanks) blueprint.fillblanks = formatCounts.fillblanks

      const res = await fetch("/api/admin/generate-exam-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: aiTopic.trim(),
          difficulty: aiDifficulty,
          blueprint,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate questions")
      }

      if (Array.isArray(data.questions) && data.questions.length > 0) {
        setQuestions(prev => [...prev, ...data.questions])
        toast.success(`Successfully generated ${data.questions.length} questions for "${aiTopic.trim()}"!`)
      } else {
        toast.error("No questions were generated. Please try with a clearer topic name.")
      }
    } catch (err: any) {
      console.error("AI Question Generation error:", err)
      setAiGenError(err.message || "Failed to generate questions")
      toast.error(err.message || "Failed to generate questions")
    } finally {
      setIsGeneratingAi(false)
    }
  }

  const isCorrectOption = (opt: string, optIndex: number, correctAnswer?: string | string[]) => {
    if (correctAnswer === undefined || correctAnswer === null || correctAnswer === "") return false
    const ansStr = Array.isArray(correctAnswer) ? correctAnswer[0] : String(correctAnswer)
    const trimmedAns = ansStr.trim().toLowerCase()
    const trimmedOpt = String(opt).trim().toLowerCase()
    if (trimmedOpt === trimmedAns) return true
    const letter = ["a", "b", "c", "d", "e"][optIndex]
    if (trimmedAns === letter) return true
    if (trimmedAns === `option ${letter}`) return true
    if (trimmedAns === String(optIndex)) return true
    return false
  }

  const isCorrectTF = (opt: "True" | "False", correctAnswer?: string) => {
    if (!correctAnswer) return false
    const lowerAns = String(correctAnswer).toLowerCase()
    if (opt === "True") {
      return lowerAns === "true" || lowerAns === "option a" || lowerAns === "a" || lowerAns === "0"
    } else {
      return lowerAns === "false" || lowerAns === "option b" || lowerAns === "b" || lowerAns === "1"
    }
  }

  const getFormatBadge = (type: QuestionType) => {
    switch (type) {
      case "mcq":
        return "bg-[#eaf0f8] text-[#324158] border border-[#cbd5e1]"
      case "assertion":
        return "bg-purple-50 text-purple-800 border border-purple-200"
      case "truefalse":
        return "bg-teal-50 text-teal-800 border border-teal-200"
      case "descriptive":
        return "bg-blue-50 text-blue-800 border border-blue-200"
      case "fillblanks":
        return "bg-amber-50 text-amber-800 border border-amber-200"
      case "coding":
        return "bg-red-50 text-red-800 border border-red-200"
      default:
        return "bg-slate-100 text-slate-700 border border-slate-200"
    }
  }

  const handleAddCompetitiveQuestions = (newQuestions: GeneratedCompetitiveQuestion[]) => {
    const mapped: Question[] = newQuestions.map(q => {
      const rawFormat = (q.questionFormat || "").toLowerCase()
      const isTF =
        rawFormat === "true_false" ||
        rawFormat === "truefalse" ||
        q.questionText?.toLowerCase().startsWith("true or false") ||
        q.questionText?.toLowerCase().startsWith("true/false") ||
        (Array.isArray(q.options) && q.options.length === 2 && q.options.includes("True"))

      const isAR =
        !isTF && (
          rawFormat === "assertion" ||
          rawFormat === "assertion_reason" ||
          q.type === "assertion" ||
          Boolean(parseAssertionReason(q.questionText || ""))
        )

      const isFIB =
        !isTF && !isAR && (
          rawFormat === "fib" ||
          rawFormat === "fill_in_the_blanks" ||
          rawFormat === "fillblanks" ||
          q.type === "fillblanks" ||
          q.questionText?.includes("______") ||
          /_{2,}/.test(q.questionText || "") ||
          q.questionText?.toLowerCase().includes("fill in the blank")
        )

      if (isAR) {
        const parsed = parseAssertionReason(q.questionText)
        return {
          id: q.id,
          type: "assertion",
          assertionText: parsed?.assertion || "",
          reasonText: parsed?.reason || "",
          questionText: q.questionText,
          questionImage: q.questionImage,
          difficulty: q.difficulty,
          marks: q.marks,
          negativeMark: q.negativeMark,
          options: q.options,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation,
        }
      }

      if (isFIB) {
        return {
          id: q.id,
          type: "fillblanks",
          questionText: q.questionText,
          questionImage: q.questionImage,
          difficulty: q.difficulty,
          marks: q.marks,
          negativeMark: q.negativeMark,
          blanks: [{ id: 1, label: "Blank 1", answer: q.correctAnswer || (q.options ? q.options[0] : "") }],
          caseInsensitive: true,
          options: q.options,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation,
        } as any
      }

      if (isTF) {
        return {
          id: q.id,
          type: "truefalse",
          questionText: q.questionText,
          questionImage: q.questionImage,
          difficulty: q.difficulty,
          marks: q.marks,
          negativeMark: q.negativeMark,
          correctAnswer: (String(q.correctAnswer).toLowerCase().includes("false") || q.correctAnswer === "Option B") ? "False" : "True",
          explanation: q.explanation,
        }
      }

      return {
        id: q.id,
        type: "mcq",
        questionFormat: q.questionFormat,
        questionText: q.questionText,
        questionImage: q.questionImage,
        difficulty: q.difficulty,
        marks: q.marks,
        negativeMark: q.negativeMark,
        options: q.options,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
      }
    })
    setQuestions(prev => [...prev, ...mapped])
  }

  const openMenu = (qId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    setAnchorRect(rect)
    setMenuOpen(qId === menuOpen ? null : qId)
  }

  const filtered = questions

  const totalMarks = questions.reduce((s, q) => s + q.marks, 0)

  const openModal = (type: QuestionType) => {
    if (!allowedCustomQuestionTypes.includes(type)) return
    console.log("Opening modal for type:", type);
    setEditQ(null);
    setModal(type);
  };

  const saveQuestion = (q: Question | Question[]) => {
    if (Array.isArray(q)) {
      setQuestions(prev => [...prev, ...q])
      setEditQ(null)
      setModal(null)
      return
    }
    setQuestions(prev => {
      const existingIdx = prev.findIndex(x => x.id === q.id)
      if (existingIdx >= 0) {
        const n = [...prev]
        n[existingIdx] = q
        return n
      }
      return [...prev, q]
    })
    setEditQ(null)
    setModal(null)
  }

  const removeQ = (id: string) => setQuestions(prev => prev.filter(q => q.id !== id))

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    if (file.type !== "application/pdf") return setPdfError("Please upload a PDF file")
    setPdfUploading(true); setPdfError("")
    try {
      const formData = new FormData(); formData.append("file", file)
      const res = await fetch("/api/exams/parse-pdf", { method: "POST", body: formData, credentials: "include" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to parse PDF")
      if (data.questions?.length) {
        setQuestions(prev => [...prev, ...data.questions.map((q: Omit<Question, "id">) => ({...q, id: Math.random().toString(36).slice(2)}))])
      } else {
        setPdfError("No questions could be extracted from this PDF")
      }
    } catch (err) {
      setPdfError(err instanceof Error ? err.message : "Failed to parse PDF")
    } finally {
      setPdfUploading(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  const openEdit = (q: Question) => { setEditQ(q); setModal(q.type) }

  const typeCounts = Object.fromEntries(
    (["mcq","assertion","truefalse","descriptive","fillblanks","coding"] as QuestionType[]).map(t => [t, questions.filter(q => q.type === t).length])
  )

  return (
    <div className="bg-white rounded-2xl border border-[#cbd5e1] p-5 sm:p-8 shadow-xs relative">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 pb-5 border-b border-slate-100">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#64748b]">
            STEP 1 · QUESTION STUDIO
          </p>
          <div className="flex items-center gap-3 mt-1">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#324158]">Select & Manage Questions</h2>
            {questions.length > 0 && (
              <span className="px-3 py-1 bg-[#eaf0f8] rounded-full text-xs font-bold text-[#324158] border border-[#cbd5e1]">
                {questions.length} Selected
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <input ref={fileRef} type="file" accept="application/pdf" onChange={handlePdfUpload} className="hidden" />
          <button
            type="button"
            onClick={() => canUsePdfImport && fileRef.current?.click()}
            disabled={pdfUploading || !canUsePdfImport}
            className="h-10 px-4 rounded-xl border border-[#cbd5e1] bg-white hover:bg-[#eaf0f8] text-[#324158] text-xs sm:text-sm font-semibold flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50 shadow-2xs"
          >
            <Upload size={15} className="shrink-0" />
            <span>{pdfUploading ? "Uploading..." : "Upload from PDF"}</span>
          </button>
          <div className="relative group">
            <button
              type="button"
              className="h-10 px-4 rounded-xl bg-[#324158] hover:bg-[#253244] text-white text-xs sm:text-sm font-semibold flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
            >
              <Plus size={16} className="shrink-0" />
              <span>Add Question</span>
            </button>
            <div className="absolute right-0 top-full pt-1.5 w-48 z-20 hidden group-hover:block before:absolute before:inset-0 before:h-2 before:-top-2 before:bg-transparent">
              <div className="bg-white border border-[#cbd5e1] rounded-2xl shadow-xl overflow-hidden p-1 animate-in fade-in zoom-in-95">
                {(["mcq","assertion","truefalse","descriptive","fillblanks","coding"] as QuestionType[]).filter(type => allowedCustomQuestionTypes.includes(type)).map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => openModal(type)}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs sm:text-sm text-slate-700 hover:bg-[#eaf0f8] hover:text-[#324158] rounded-xl transition-colors cursor-pointer text-left font-medium"
                  >
                    {TYPE_META[type].icon}
                    <span>{TYPE_META[type].label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Quick AI Question Generator Panel ── */}
      <div className="mb-6 rounded-2xl border border-[#cbd5e1] bg-gradient-to-b from-[#f8fafc] to-[#eaf0f8]/35 p-4 sm:p-6 shadow-xs space-y-4">
        {/* Panel Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-[#cbd5e1]/70">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#324158] text-white shadow-2xs">
              <Sparkles size={16} />
            </span>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-[#324158]">
                AI Question Generator
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500">
                Enter topic name, select question formats, adjust quantities, and generate questions with answers instantly.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="text-[11px] font-bold text-[#324158] bg-white border border-[#cbd5e1] px-3 py-1 rounded-full shadow-2xs">
              Total to Generate: <span className="font-extrabold text-[#324158]">{totalAiCount}</span> Questions
            </span>
          </div>
        </div>

        {/* Row 1: Topic Input & Difficulty */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
          <div>
            <label className="block text-xs font-bold text-[#324158] mb-1.5">
              Topic Name / Chapter <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={aiTopic}
              onChange={e => setAiTopic(e.target.value)}
              placeholder="e.g. Thermodynamics, Light and Optics, Chemical Bonding, Linear Equations..."
              className="w-full h-11 px-3.5 bg-white border border-[#cbd5e1] rounded-xl text-sm font-semibold text-[#324158] placeholder:text-slate-400 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-[#324158]/20 focus:border-[#324158] transition-all shadow-2xs"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#324158] mb-1.5">
              Difficulty Level
            </label>
            <div className="flex items-center gap-1.5 h-11 bg-white border border-[#cbd5e1] rounded-xl p-1 shadow-2xs">
              {(["easy", "medium", "hard"] as Difficulty[]).map(diff => (
                <button
                  key={diff}
                  type="button"
                  onClick={() => setAiDifficulty(diff)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all cursor-pointer ${
                    aiDifficulty === diff
                      ? "bg-[#324158] text-white shadow-xs"
                      : "text-slate-600 hover:bg-[#eaf0f8] hover:text-[#324158]"
                  }`}
                >
                  {diff}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Row 2: Format Selection & Quantity Controls */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold text-[#324158]">
              Select Formats & Set Quantities
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const allSelected = (["mcq", "assertion", "truefalse", "descriptive", "fillblanks"] as const).every(f => selectedFormats[f])
                  const targetState = !allSelected
                  setSelectedFormats({
                    mcq: targetState,
                    assertion: targetState,
                    truefalse: targetState,
                    descriptive: targetState,
                    fillblanks: targetState,
                  })
                }}
                className="text-[11px] font-bold text-[#324158] hover:underline cursor-pointer"
              >
                {(["mcq", "assertion", "truefalse", "descriptive", "fillblanks"] as const).every(f => selectedFormats[f]) ? "Deselect All" : "Select All"}
              </button>
              <span className="text-slate-300">·</span>
              <button
                type="button"
                onClick={() => adjustAllCounts(1)}
                className="text-[11px] font-bold text-[#324158] hover:underline cursor-pointer"
                title="Increase quantity by 1 for all formats"
              >
                +1 to All
              </button>
              <span className="text-slate-300">·</span>
              <button
                type="button"
                onClick={() => adjustAllCounts(-1)}
                className="text-[11px] font-bold text-[#324158] hover:underline cursor-pointer"
                title="Decrease quantity by 1 for all formats"
              >
                -1 to All
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
            {[
              { id: "mcq" as const, label: "MCQ", sublabel: "Multiple Choice", icon: List },
              { id: "assertion" as const, label: "Assertion & Reason", sublabel: "A & R Statements", icon: Layers },
              { id: "truefalse" as const, label: "True / False", sublabel: "Binary Statement", icon: CheckSquare },
              { id: "descriptive" as const, label: "Descriptive", sublabel: "Long Answer", icon: AlignLeft },
              { id: "fillblanks" as const, label: "Fill Blanks", sublabel: "Complete Sentence", icon: FileText },
            ].map(item => {
              const isSelected = selectedFormats[item.id]
              const count = formatCounts[item.id] || 1
              const Icon = item.icon
              return (
                <div
                  key={item.id}
                  className={`relative rounded-xl border p-3 transition-all flex flex-col justify-between ${
                    isSelected
                      ? "border-[#324158] bg-white shadow-xs ring-1 ring-[#324158]/10"
                      : "border-[#cbd5e1] bg-slate-50/60 opacity-60 hover:opacity-100"
                  }`}
                >
                  <div
                    onClick={() => toggleFormat(item.id)}
                    className="flex items-start justify-between gap-2 cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 text-xs ${
                        isSelected ? "bg-[#eaf0f8] text-[#324158] font-bold" : "bg-slate-200 text-slate-500"
                      }`}>
                        <Icon size={13} />
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[#324158] leading-tight truncate">
                          {item.label}
                        </p>
                        <p className="text-[10px] text-slate-500 leading-none mt-0.5 truncate">
                          {item.sublabel}
                        </p>
                      </div>
                    </div>
                    <div className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                      isSelected
                        ? "bg-[#324158] border-[#324158] text-white"
                        : "border-slate-300 bg-white"
                    }`}>
                      {isSelected && <Check size={11} strokeWidth={3} />}
                    </div>
                  </div>

                  {/* Quantity Stepper */}
                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Qty:
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={!isSelected || count <= 1}
                        onClick={(e) => {
                          e.stopPropagation()
                          updateFormatCount(item.id, -1)
                        }}
                        className="w-6 h-6 rounded-md bg-[#eaf0f8] hover:bg-[#dbe6f5] text-[#324158] disabled:opacity-40 flex items-center justify-center cursor-pointer transition-colors"
                        title="Decrease count"
                      >
                        <Minus size={11} />
                      </button>
                      <input
                        type="number"
                        min={1}
                        max={20}
                        disabled={!isSelected}
                        value={count}
                        onChange={(e) => {
                          const val = Math.max(1, Math.min(20, Number(e.target.value) || 1))
                          setFormatCounts(prev => ({ ...prev, [item.id]: val }))
                        }}
                        className="w-10 h-6 text-center text-xs font-bold text-[#324158] bg-white border border-[#cbd5e1] rounded-md disabled:bg-slate-100 disabled:text-slate-400 focus:outline-none focus:border-[#324158]"
                      />
                      <button
                        type="button"
                        disabled={!isSelected || count >= 20}
                        onClick={(e) => {
                          e.stopPropagation()
                          updateFormatCount(item.id, 1)
                        }}
                        className="w-6 h-6 rounded-md bg-[#eaf0f8] hover:bg-[#dbe6f5] text-[#324158] disabled:opacity-40 flex items-center justify-center cursor-pointer transition-colors"
                        title="Increase count"
                      >
                        <Plus size={11} />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {aiGenError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0"/>
            <span>{aiGenError}</span>
          </div>
        )}

        {/* Action Row */}
        <div className="pt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-[#cbd5e1]/60">
          <p className="text-xs text-slate-500">
            Generates <span className="font-bold text-[#324158]">{totalAiCount}</span> questions with options, explanations & correct answers based on your topic.
          </p>
          <button
            type="button"
            onClick={handleGenerateAi}
            disabled={isGeneratingAi || !aiTopic.trim() || totalAiCount === 0}
            className="h-11 px-6 rounded-xl bg-[#324158] hover:bg-[#253244] text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2.5 shadow-xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            {isGeneratingAi ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Generating {totalAiCount} Questions...</span>
              </>
            ) : (
              <>
                <Sparkles size={16} />
                <span>✦ Generate {totalAiCount} Questions</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Separate Coding Challenge Box ── */}
      {allowedCustomQuestionTypes.includes("coding") && (
        <div
          onClick={() => openModal("coding")}
          className="mb-6 rounded-2xl border border-[#cbd5e1] bg-gradient-to-b from-[#f8fafc] to-[#eaf0f8]/35 p-4 sm:p-5 shadow-xs transition-all hover:border-[#324158] hover:shadow-sm cursor-pointer group"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3.5">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#324158] text-white shadow-2xs shrink-0 group-hover:scale-105 transition-transform">
                <Code2 size={22} />
              </span>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h3 className="text-sm sm:text-base font-bold text-[#324158] group-hover:text-[#253244] transition-colors">
                    Coding Challenge Studio
                  </h3>
                  <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-[#eaf0f8] text-[#324158] border border-[#cbd5e1]">
                    IDE & Test Cases
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-slate-500 mt-1">
                  Create programming questions with custom starter code, driver code, test cases (public/hidden), constraints, and multi-language support (Python, Java, C++, JavaScript).
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                openModal("coding")
              }}
              className="h-10 px-5 rounded-xl bg-[#324158] group-hover:bg-[#253244] text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer shrink-0 self-start sm:self-auto"
            >
              <Plus size={16} />
              <span>+ Add Coding Question</span>
            </button>
          </div>
        </div>
      )}

      {pdfError && (
        <div className="mb-4 p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs sm:text-sm text-red-600 flex items-center gap-2">
          <AlertCircle size={15} className="shrink-0"/>
          <span>{pdfError}</span>
        </div>
      )}

      {/* Question List */}
      {filtered.length === 0 ? (
        <div className="py-16 text-center bg-slate-50/50 rounded-2xl border border-dashed border-[#cbd5e1]">
          <div className="w-12 h-12 rounded-2xl bg-white border border-[#cbd5e1] shadow-2xs flex items-center justify-center mx-auto mb-3">
            <FileText size={20} className="text-[#324158]"/>
          </div>
          <p className="text-sm font-bold text-[#324158]">No questions added yet</p>
          <p className="text-xs text-slate-500 mt-1">Add questions manually above via Add Question or import from PDF.</p>
        </div>
      ) : (
        <div className="space-y-4 mb-4 max-h-[640px] overflow-y-auto pr-1 sm:pr-2 custom-scrollbar">
          {filtered.map((q, i) => {
            // Keep coding question row 100% untouched as requested by user
            if (q.type === "coding") {
              return (
                <div key={q.id} className="flex items-start sm:items-center gap-3 p-3.5 sm:p-4 rounded-xl border border-red-100 bg-red-50/20 transition-colors hover:border-red-200">
                  <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-red-100 text-red-700 mt-0.5 sm:mt-0 shadow-2xs">
                    <Code2 size={13} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-800 line-clamp-2 leading-snug">
                      <MathRenderer content={q.questionText || `Coding Challenge ${i+1}`} />
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-1.5">
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-red-100 text-red-700 border-current opacity-90">Coding</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${DIFFICULTY_COLORS[q.difficulty]} border-current opacity-90`}>{q.difficulty}</span>
                      <span className="sm:hidden text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-700 font-semibold rounded">
                        {q.marks} {q.marks === 1 ? "mark" : "marks"}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                    <div className="text-right hidden sm:block">
                      <p className="text-sm font-bold text-slate-800">{q.marks}</p>
                      <p className="text-[10px] font-medium text-slate-400 uppercase">Marks</p>
                    </div>
                    <div className="flex items-center gap-1 relative">
                      <button onClick={(e) => openMenu(q.id, e)} className="p-1.5 sm:p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer">
                        <MoreVertical size={16}/>
                      </button>
                      {menuOpen === q.id && (
                        <QuestionMenu
                          q={q}
                          anchorRect={anchorRect}
                          onEdit={q => openEdit(q)}
                          onDelete={id => removeQ(id)}
                          onClose={() => setMenuOpen(null)}
                        />
                      )}
                    </div>
                  </div>
                </div>
              )
            }

            // Rich Question Card with Questions and Answers shown (MCQ, Assertion, True/False, Descriptive, Fill Blanks)
            return (
              <div
                key={q.id}
                className="bg-white rounded-2xl border border-[#cbd5e1] p-4 sm:p-5 shadow-xs hover:border-[#324158]/50 transition-all space-y-3.5"
              >
                {/* Header */}
                <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap min-w-0">
                    <span className="w-6 h-6 rounded-lg bg-[#324158] text-white text-xs font-bold flex items-center justify-center shadow-2xs shrink-0">
                      {i + 1}
                    </span>
                    <span className={`text-[10px] sm:text-[11px] px-2.5 py-0.5 rounded-md font-bold uppercase tracking-wider ${getFormatBadge(q.type)}`}>
                      {TYPE_META[q.type].label}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider ${DIFFICULTY_COLORS[q.difficulty]}`}>
                      {q.difficulty}
                    </span>
                    {q.questionImage && (
                      <span className="text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
                        Diagram
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-bold text-[#324158] bg-[#eaf0f8] border border-[#cbd5e1] px-2.5 py-0.5 rounded-md">
                      +{q.marks}m{q.negativeMark ? ` / -${q.negativeMark}m` : ""}
                    </span>
                    <button
                      type="button"
                      onClick={() => openEdit(q)}
                      className="p-1.5 text-slate-400 hover:text-[#324158] hover:bg-[#eaf0f8] rounded-lg transition-colors cursor-pointer"
                      title="Edit Question"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeQ(q.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                      title="Delete Question"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Question Statement */}
                {q.type === "assertion" ? (
                  (() => {
                    const parsed = (q as AssertionQuestion).assertionText && (q as AssertionQuestion).reasonText
                      ? { assertion: (q as AssertionQuestion).assertionText!, reason: (q as AssertionQuestion).reasonText! }
                      : parseAssertionReason(q.questionText)
                    return parsed ? (
                      <div className="space-y-2 mb-2">
                        <div className="p-3 rounded-xl bg-amber-50/50 border border-amber-200 text-slate-900 text-xs sm:text-sm">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded mb-1 inline-block">
                            Assertion (A)
                          </span>
                          <div className="leading-relaxed">
                            <MathRenderer content={parsed.assertion} />
                          </div>
                        </div>
                        <div className="p-3 rounded-xl bg-purple-50/50 border border-purple-200 text-slate-900 text-xs sm:text-sm">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-purple-900 bg-purple-100 border border-purple-300 px-2 py-0.5 rounded mb-1 inline-block">
                            Reason (R)
                          </span>
                          <div className="leading-relaxed">
                            <MathRenderer content={parsed.reason} />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs sm:text-sm font-semibold text-slate-800 leading-relaxed">
                        <MathRenderer content={q.questionText} />
                      </div>
                    )
                  })()
                ) : (
                  <div className="text-xs sm:text-sm font-semibold text-slate-800 leading-relaxed">
                    <MathRenderer content={q.questionText} />
                  </div>
                )}

                {/* Question Image / Diagram */}
                {q.questionImage && (
                  <div className="my-2 max-w-sm rounded-lg overflow-hidden border border-slate-200 bg-slate-50 p-1">
                    <img src={q.questionImage} alt="Diagram" className="max-h-48 rounded object-contain mx-auto" />
                  </div>
                )}

                {/* Options / Answers Section */}
                {/* 1. MCQ Options */}
                {q.type === "mcq" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                    {(q as MCQQuestion).options?.map((opt, oi) => {
                      const isCorrect = isCorrectOption(opt, oi, (q as MCQQuestion).correctAnswer)
                      const letter = ["A", "B", "C", "D", "E"][oi]
                      return (
                        <div
                          key={oi}
                          className={`p-3 rounded-xl border flex items-start gap-2.5 transition-all text-xs sm:text-sm ${
                            isCorrect
                              ? "bg-[#eaf0f8] border-2 border-[#324158] text-[#324158] font-medium shadow-xs"
                              : "bg-slate-50/70 border-slate-200 text-slate-700 hover:bg-white"
                          }`}
                        >
                          <span
                            className={`w-6 h-6 rounded-md text-xs font-bold flex items-center justify-center shrink-0 mt-0.5 ${
                              isCorrect
                                ? "bg-[#324158] text-white shadow-2xs"
                                : "bg-white border border-slate-200 text-slate-600"
                            }`}
                          >
                            {isCorrect ? "✓" : letter}
                          </span>
                          <div className="flex-1 pt-0.5 leading-relaxed overflow-x-auto">
                            <MathRenderer content={opt} />
                          </div>
                          {isCorrect && (
                            <span className="text-[10px] font-bold text-white bg-[#324158] px-2 py-0.5 rounded shadow-2xs shrink-0 self-start mt-0.5">
                              Correct Answer
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* 2. Assertion & Reason Options */}
                {q.type === "assertion" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                    {((q as AssertionQuestion).options && (q as AssertionQuestion).options.length > 0
                      ? (q as AssertionQuestion).options
                      : [
                          "Both A and R are true and R is the correct explanation of A",
                          "Both A and R are true but R is not the correct explanation of A",
                          "A is true but R is false",
                          "A is false but R is true"
                        ]
                    ).map((opt, oi) => {
                      const isCorrect = isCorrectOption(opt, oi, (q as AssertionQuestion).correctAnswer)
                      const letter = ["A", "B", "C", "D"][oi]
                      return (
                        <div
                          key={oi}
                          className={`p-3 rounded-xl border flex items-start gap-2.5 transition-all text-xs sm:text-sm ${
                            isCorrect
                              ? "bg-[#eaf0f8] border-2 border-[#324158] text-[#324158] font-medium shadow-xs"
                              : "bg-slate-50/70 border-slate-200 text-slate-700 hover:bg-white"
                          }`}
                        >
                          <span
                            className={`w-6 h-6 rounded-md text-xs font-bold flex items-center justify-center shrink-0 mt-0.5 ${
                              isCorrect
                                ? "bg-[#324158] text-white shadow-2xs"
                                : "bg-white border border-slate-200 text-slate-600"
                            }`}
                          >
                            {isCorrect ? "✓" : letter}
                          </span>
                          <div className="flex-1 pt-0.5 leading-relaxed overflow-x-auto">
                            <MathRenderer content={opt} />
                          </div>
                          {isCorrect && (
                            <span className="text-[10px] font-bold text-white bg-[#324158] px-2 py-0.5 rounded shadow-2xs shrink-0 self-start mt-0.5">
                              Correct Answer
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* 3. True / False Options */}
                {q.type === "truefalse" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                    {(["True", "False"] as const).map((opt) => {
                      const isCorrect = isCorrectTF(opt, (q as TrueFalseQuestion).correctAnswer)
                      return (
                        <div
                          key={opt}
                          className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs sm:text-sm font-semibold transition-all ${
                            isCorrect
                              ? "bg-[#eaf0f8] border-2 border-[#324158] text-[#324158] shadow-xs"
                              : "bg-slate-50/70 border-slate-200 text-slate-600 hover:bg-white"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <span
                              className={`w-7 h-7 rounded-md text-xs font-bold flex items-center justify-center shrink-0 ${
                                isCorrect
                                  ? "bg-[#324158] text-white shadow-2xs"
                                  : "bg-white border border-slate-200 text-slate-600"
                              }`}
                            >
                              {isCorrect ? "✓" : opt === "True" ? "T" : "F"}
                            </span>
                            <span>{opt}</span>
                          </div>
                          {isCorrect && (
                            <span className="text-[10px] font-bold text-white bg-[#324158] px-2.5 py-1 rounded shadow-2xs">
                              Correct Answer
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* 4. Descriptive Answer */}
                {q.type === "descriptive" && (
                  <div className="space-y-2.5 pt-1">
                    <div className="p-3.5 rounded-xl bg-[#eaf0f8]/60 border border-[#cbd5e1] text-xs sm:text-sm">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[#324158] flex items-center gap-1.5">
                          <CheckCircle2 size={13} className="text-[#324158]" />
                          <span>Model / Reference Answer</span>
                        </span>
                        {(q as DescriptiveQuestion).wordLimit && (
                          <span className="text-[10px] font-semibold text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded">
                            Word Limit: ~{(q as DescriptiveQuestion).wordLimit} words
                          </span>
                        )}
                      </div>
                      <div className="text-slate-800 leading-relaxed overflow-x-auto">
                        <MathRenderer content={(q as DescriptiveQuestion).modelAnswer || (q as any).sampleAnswer || (q as any).correctAnswer || "Model answer to be evaluated by instructor."} />
                      </div>
                    </div>

                    {(q as DescriptiveQuestion).rubric && (q as DescriptiveQuestion).rubric.length > 0 && (
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                        <span className="font-bold text-[#324158] block mb-1 uppercase tracking-wider text-[10px]">
                          Evaluation Rubric:
                        </span>
                        <ul className="list-disc pl-4 space-y-0.5 text-slate-700">
                          {(q as DescriptiveQuestion).rubric.map((r, ri) => <li key={ri}>{r}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* 5. Fill in the Blanks Answer */}
                {q.type === "fillblanks" && (
                  <div className="p-3.5 rounded-xl bg-[#eaf0f8]/60 border border-[#cbd5e1] text-xs sm:text-sm space-y-2 pt-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#324158] flex items-center gap-1.5">
                      <CheckCircle2 size={13} className="text-[#324158]" />
                      <span>Correct Blank Answers</span>
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {(q as FillBlanksQuestion).blanks && (q as FillBlanksQuestion).blanks.length > 0 ? (
                        (q as FillBlanksQuestion).blanks.map((b, bi) => (
                          <span key={bi} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white border border-[#cbd5e1] text-xs font-semibold text-[#324158] shadow-2xs">
                            <span className="text-[10px] text-slate-400 font-bold uppercase">Blank {bi + 1}:</span>
                            <span>{b.answer}</span>
                          </span>
                        ))
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white border border-[#cbd5e1] text-xs font-semibold text-[#324158] shadow-2xs">
                          <span>{Array.isArray((q as any).correctAnswer) ? (q as any).correctAnswer.join(", ") : ((q as any).correctAnswer || "Correct answer specified")}</span>
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Solution / Explanation Accordion */}
                {(q as any).explanation && (
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => toggleSolution(q.id)}
                      className="text-xs font-semibold text-[#324158] hover:underline flex items-center gap-1.5 cursor-pointer"
                    >
                      {expandedSolutions[q.id] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      <span>{expandedSolutions[q.id] ? "Hide Solution" : "View Step-by-Step Solution"}</span>
                    </button>
                    {expandedSolutions[q.id] && (
                      <div className="mt-2 p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-700 leading-relaxed overflow-x-auto">
                        <span className="font-bold text-[#324158] block text-[11px] uppercase tracking-wider mb-1">
                          Concept &amp; Detailed Solution:
                        </span>
                        <MathRenderer content={(q as any).explanation} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Footer Summary */}
      {questions.length > 0 && (
        <div className="pt-4 sm:pt-5 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
          <div className="flex items-center gap-2 flex-wrap text-xs sm:text-sm">
            <span className="font-bold text-[#324158] tracking-tight">{questions.length} questions selected</span>
            <span className="text-slate-300">|</span>
            <span className="font-medium text-slate-500">Total: <span className="text-[#324158] font-bold">{totalMarks} marks</span></span>
            {Object.entries(typeCounts).filter(([,c]) => c > 0).map(([t, c]) => (
              <span key={t} className="flex items-center gap-1.5"><span className="text-slate-300">·</span><span className="px-2 py-0.5 bg-[#eaf0f8] border border-[#cbd5e1] rounded text-xs text-[#324158] font-semibold">{c} {TYPE_META[t as QuestionType].label}</span></span>
            ))}
          </div>
        </div>
      )}

      {/* Modals */}
      {modal === "mcq" && (
        <MCQModal 
          onSave={saveQuestion as (q: MCQQuestion | MCQQuestion[]) => void} 
          onClose={() => { setModal(null); setEditQ(null); }} 
          initial={editQ?.type === "mcq" ? editQ : undefined} 
        />
      )}
      {modal === "assertion" && (
        <AssertionModal 
          onSave={saveQuestion as (q: AssertionQuestion | AssertionQuestion[]) => void} 
          onClose={() => { setModal(null); setEditQ(null); }} 
          initial={editQ?.type === "assertion" ? editQ : undefined} 
        />
      )}
      {modal === "truefalse" && (
        <TrueFalseModal 
          onSave={saveQuestion as (q: TrueFalseQuestion | TrueFalseQuestion[]) => void} 
          onClose={() => { setModal(null); setEditQ(null); }} 
          initial={editQ?.type === "truefalse" ? editQ : undefined} 
        />
      )}
      {modal === "descriptive" && (
        <DescriptiveModal 
          onSave={saveQuestion as (q: DescriptiveQuestion) => void} 
          onClose={() => { setModal(null); setEditQ(null); }} 
          initial={editQ?.type === "descriptive" ? editQ : undefined} 
        />
      )}
      {modal === "fillblanks" && (
        <FillBlanksModal 
          onSave={saveQuestion as (q: FillBlanksQuestion | FillBlanksQuestion[]) => void} 
          onClose={() => { setModal(null); setEditQ(null); }} 
          initial={editQ?.type === "fillblanks" ? editQ : undefined} 
        />
      )}
      {modal === "coding" && (
        <CodingModal 
          onSave={saveQuestion as (q: CodingQuestion) => void} 
          onClose={() => { setModal(null); setEditQ(null); }} 
          initial={editQ?.type === "coding" ? editQ : undefined} 
        />
      )}
      <CompetitiveExamAIGenerator
        isOpen={showCompetitiveAiModal}
        onClose={() => setShowCompetitiveAiModal(false)}
        onAddQuestions={handleAddCompetitiveQuestions}
      />
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function ExamWizard({ editId }: { editId?: string } = {}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const activeEditId = editId || searchParams?.get("edit") || undefined
  const isEdit = Boolean(activeEditId)

  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [loadingExam, setLoadingExam] = useState(isEdit)
  const [examNotFound, setExamNotFound] = useState(false)
  const [error, setError] = useState("")

  const [step1, setStep1] = useState<Step1Form>({
    title: "", examType: "CUSTOM", duration: "60",
    passMarks: "40", totalMarks: "100", instructions: "", questionsPerMin: ""
  })
  const [step2, setStep2] = useState<Step2Form>({
    startDate: "", startTime: "", endDate: "", endTime: "",
    randomize: true, showResults: true, allowReview: false, negativeMarking: false,
    sectionNegativeMark: 0,
    proctoring: {
      faceDetection: true,
      tabSwitch: true,
      fullscreen: true,
      aiProctoring: false
    }
  })
  const [questions, setQuestions] = useState<Question[]>([])
  const [instituteFeatures, setInstituteFeatures] = useState({
    neetJeeGenerator: true,
    aiProctoring: true,
    pdfImport: true,
  })
  const [allowedCustomQuestionTypes, setAllowedCustomQuestionTypes] = useState<QuestionType[]>([])
  const [hasExamAccess, setHasExamAccess] = useState<boolean | null>(null)
  const [isExamQuotaReached, setIsExamQuotaReached] = useState(false)
  const [maxExams, setMaxExams] = useState(20)
  const [examCount, setExamCount] = useState(0)
  const [loadingAccess, setLoadingAccess] = useState(true)

  // Load existing exam data if editing
  useEffect(() => {
    if (!activeEditId) return
    setLoadingExam(true)
    fetch(`/api/exams/${activeEditId}`, { credentials: "include" })
      .then(r => r.json())
      .then(data => {
        if (!data.exam) {
          setExamNotFound(true)
          setLoadingExam(false)
          return
        }
        const exam = data.exam
        const examTypeStr = String(exam.examType || "").trim().toUpperCase()
        if (examTypeStr === "OTHER") {
          router.replace(`/admin/other-exams?edit=${activeEditId}`)
          return
        }
        if (["NEET", "JEE_MAIN", "JEE_ADVANCED", "MHT_CET", "CBSE_BOARD", "COMPETITIVE", "CUET", "NDA", "BITSAT"].includes(examTypeStr)) {
          router.replace(`/admin/ai-generator?edit=${activeEditId}`)
          return
        }
        setStep1({
          title: exam.title || "",
          examType: exam.examType || "CUSTOM",
          duration: String(exam.duration || "60"),
          passMarks: String(exam.passMarks ?? "40"),
          totalMarks: String(exam.totalMarks ?? "100"),
          instructions: Array.isArray(exam.instructions)
            ? exam.instructions.join("\n")
            : typeof exam.instructions === "string"
            ? exam.instructions
            : exam.description || "",
          questionsPerMin: exam.questionsPerMin ? String(exam.questionsPerMin) : "",
        })

        let startDateStr = ""
        let startTimeStr = exam.settings?.startTime || ""
        if (exam.settings?.startDate) {
          const d = new Date(exam.settings.startDate)
          if (!isNaN(d.getTime())) {
            const y = d.getFullYear()
            const m = String(d.getMonth() + 1).padStart(2, "0")
            const day = String(d.getDate()).padStart(2, "0")
            startDateStr = `${y}-${m}-${day}`
            if (!startTimeStr) {
              startTimeStr = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
            }
          }
        }

        let endDateStr = ""
        let endTimeStr = exam.settings?.endTime || ""
        if (exam.settings?.endDate) {
          const d = new Date(exam.settings.endDate)
          if (!isNaN(d.getTime())) {
            const y = d.getFullYear()
            const m = String(d.getMonth() + 1).padStart(2, "0")
            const day = String(d.getDate()).padStart(2, "0")
            endDateStr = `${y}-${m}-${day}`
            if (!endTimeStr) {
              endTimeStr = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
            }
          }
        }

        setStep2({
          startDate: startDateStr,
          startTime: startTimeStr,
          endDate: endDateStr,
          endTime: endTimeStr,
          randomize: exam.settings?.randomize !== undefined ? Boolean(exam.settings.randomize) : true,
          showResults: exam.settings?.showResults !== undefined ? Boolean(exam.settings.showResults) : true,
          allowReview: Boolean(exam.settings?.allowReview),
          negativeMarking: Boolean(exam.settings?.negativeMarking),
          sectionNegativeMark: exam.sections?.[0]?.sectionNegativeMark || 0,
          proctoring: {
            faceDetection: exam.settings?.proctoring?.faceDetection !== undefined 
              ? Boolean(exam.settings.proctoring.faceDetection)
              : (exam.proctoring?.faceDetection !== undefined ? Boolean(exam.proctoring.faceDetection) : false),
            tabSwitch: (exam.settings?.proctoring?.tabSwitch !== undefined ? exam.settings.proctoring.tabSwitch : exam.settings?.proctoring?.tabSwitchPrevention) !== undefined
              ? Boolean(exam.settings?.proctoring?.tabSwitch ?? exam.settings?.proctoring?.tabSwitchPrevention)
              : (exam.proctoring?.tabSwitch !== undefined ? Boolean(exam.proctoring.tabSwitch) : false),
            fullscreen: (exam.settings?.proctoring?.fullscreen !== undefined ? exam.settings.proctoring.fullscreen : exam.settings?.proctoring?.enforceFullscreen) !== undefined
              ? Boolean(exam.settings?.proctoring?.fullscreen ?? exam.settings?.proctoring?.enforceFullscreen)
              : (exam.proctoring?.fullscreenExit !== undefined ? Boolean(exam.proctoring.fullscreenExit) : false),
            aiProctoring: Boolean(exam.settings?.proctoring?.aiProctoring ?? exam.settings?.proctoring?.aiStatusAnalysis),
          }
        })

        const allQ = (exam.sections || []).flatMap((sec: any) =>
          (sec.questions || []).map((q: any) => {
            let determinedType = q.type
            if (
              q.type === "assertion" ||
              q.questionFormat === "assertion" ||
              q.questionFormat === "assertion_reason" ||
              Boolean(parseAssertionReason(q.questionText || ""))
            ) {
              determinedType = "assertion"
            } else if (
              q.type === "fillblanks" ||
              q.questionFormat === "fib" ||
              q.questionFormat === "fill_in_the_blanks" ||
              q.questionFormat === "fillblanks" ||
              (Array.isArray(q.blanks) && q.blanks.length > 0) ||
              (typeof q.questionText === "string" && (
                q.questionText.includes("______") ||
                /_{2,}/.test(q.questionText) ||
                q.questionText.toLowerCase().includes("fill in the blank")
              ))
            ) {
              determinedType = "fillblanks"
            } else if (
              q.type === "truefalse" ||
              q.questionFormat === "true_false" ||
              q.questionText?.toLowerCase().startsWith("true or false") ||
              q.questionText?.toLowerCase().startsWith("true/false") ||
              (Array.isArray(q.options) && q.options.length === 2 && q.options.some((o: string) => String(o).toLowerCase() === "true"))
            ) {
              determinedType = "truefalse"
            }

            const base: any = { ...q, id: q._id || q.id || Math.random().toString(36).slice(2), type: determinedType }
            if (determinedType === "fillblanks" && (!q.blanks || q.blanks.length === 0)) {
              base.blanks = [{ id: 1, label: "Blank 1", answer: q.correctAnswer || (q.options ? q.options[0] : "") }]
            }
            if (determinedType === "coding") {
              return {
                ...base,
                languages: q.languages?.length ? q.languages : ["Python", "JavaScript"],
                codeTemplates: q.codeTemplates || { python: q.codeTemplate || DEFAULT_TEMPLATES.python, javascript: DEFAULT_TEMPLATES.javascript },
                driverCode: q.driverCode || DEFAULT_DRIVERS
              }
            }
            return base
          })
        )
        setQuestions(allQ)
        setLoadingExam(false)
      })
      .catch(err => {
        console.error("Failed to load exam in edit mode:", err)
        setExamNotFound(true)
        setLoadingExam(false)
      })
  }, [activeEditId, router])

  // Load global proctoring defaults from admin settings
  useEffect(() => {
    fetch("/api/admin/institute-access", { credentials: "include" })
      .then((response) => response.json())
      .then((data) => {
        setHasExamAccess(data.hasExamAccess !== false)
        setIsExamQuotaReached(Boolean(data.isExamQuotaReached))
        if (data.maxExams !== undefined) setMaxExams(Number(data.maxExams))
        if (data.examCount !== undefined) setExamCount(Number(data.examCount))
        if (data.features) {
          const features = {
            neetJeeGenerator: data.features.neetJeeGenerator !== false,
            aiProctoring: data.features.aiProctoring !== false,
            pdfImport: data.features.pdfImport !== false,
          }
          if (Array.isArray(data.customQuestionTypes)) {
            setAllowedCustomQuestionTypes(data.customQuestionTypes)
          }
          setInstituteFeatures(features)
          if (!features.aiProctoring) {
            setStep2(current => ({
              ...current,
              proctoring: { ...current.proctoring, aiProctoring: false },
            }))
          }
        }
      })
      .catch(() => {
        setHasExamAccess(true)
      })
      .finally(() => {
        setLoadingAccess(false)
      })
  }, [])

  useEffect(() => {
    if (allowedCustomQuestionTypes.length > 0) {
      setQuestions((current) => current.filter((question) => allowedCustomQuestionTypes.includes(question.type)))
    }
  }, [allowedCustomQuestionTypes, setQuestions])

  useEffect(() => {
    fetch("/api/admin/settings", { credentials: "include" })
      .then(r => r.json())
      .then(data => {
        if (data.settings?.proctoring) {
          setStep2(s => ({
            ...s,
            proctoring: {
              faceDetection: !!data.settings.proctoring.faceDetection,
              tabSwitch: !!data.settings.proctoring.tabSwitch,
              fullscreen: !!data.settings.proctoring.fullscreen,
              aiProctoring: false,
            }
          }))
        }
      })
      .catch(() => {})
  }, [])

  const validateStep1 = () => {
    if (!step1.title.trim()) return "Exam title is required"
    if (!step1.duration || +step1.duration < 1) return "Valid duration is required"
    if (!step1.totalMarks || +step1.totalMarks < 1) return "Total marks are required"
    if (!step1.passMarks || +step1.passMarks < 0) return "Pass marks are required"
    return ""
  }

  const validateStep2 = () => {
    if (step2.startDate && step2.endDate) {
      const s = getExamStartDateTime({ startDate: step2.startDate, startTime: step2.startTime })
      const e = getExamEndDateTime({ endDate: step2.endDate, endTime: step2.endTime })
      if (s && e && e.getTime() <= s.getTime()) {
        return "End Date & Time must be after Start Date & Time"
      }
    }
    return ""
  }

  const handleNext = () => {
    setError("")
    if (step === 2) {
      const err = validateStep1()
      if (err) return setError(err)
    }
    setStep(s => s + 1)
  }

  const handleSubmit = async (status: "draft" | "active") => {
    setError("")
    if (!isEdit && isExamQuotaReached) {
      const msg = `Exam Limit Reached: Your organization has reached the limit of ${maxExams} exams (${examCount}/${maxExams} used). Contact administrator to increase your exam quota.`
      setError(msg)
      toast.error(msg)
      return
    }
    const err1 = validateStep1()
    if (err1) {
      setStep(2)
      return setError(err1)
    }
    const err2 = validateStep2()
    if (err2) {
      setStep(3)
      return setError(err2)
    }
    if (status === "active" && questions.length === 0) {
      setStep(1)
      return setError("Please add at least one question to publish the exam")
    }
    setSaving(true)
    try {
      const startDt = step2.startDate ? getExamStartDateTime({ startDate: step2.startDate, startTime: step2.startTime }) : null
      const endDt = step2.endDate ? getExamEndDateTime({ endDate: step2.endDate, endTime: step2.endTime }) : null

      if (startDt && endDt && endDt.getTime() <= startDt.getTime()) {
        throw new Error("End Date & Time must be after Start Date & Time")
      }

      const typeTitles: Record<string, string> = {
        mcq: "Multiple Choice Questions",
        assertion: "Assertion & Reason",
        truefalse: "True / False Questions",
        fillblanks: "Fill in the Blanks",
        descriptive: "Descriptive Questions",
        coding: "Coding Challenges",
      }
      
      const typeOrder = ["mcq", "assertion", "truefalse", "fillblanks", "descriptive", "coding"]
      const groupedTypes = typeOrder.filter(t => questions.some(q => q.type === t))

      let sections: any[] = []
      if (groupedTypes.length <= 1) {
        sections = [{
          name: questions[0]?.type ? (typeTitles[questions[0].type] || "Questions") : "Questions",
          type: questions[0]?.type || "mcq",
          negativeMarking: step2.negativeMarking,
          sectionNegativeMark: step2.sectionNegativeMark,
          questionRange: `1-${questions.length}`,
          questions: questions.map(({ id: _id, ...q }) => ({
            ...q,
            correctAnswer: q.type === "fillblanks"
              ? ((q as any).blanks?.map((b: any) => b.answer) || [(q as any).correctAnswer || ""])
              : (q as MCQQuestion | TrueFalseQuestion).correctAnswer ?? ""
          }))
        }]
      } else {
        let runningCount = 1
        sections = groupedTypes.map(t => {
          const qs = questions.filter(q => q.type === t)
          const startNum = runningCount
          const endNum = runningCount + qs.length - 1
          runningCount = endNum + 1
          return {
            name: typeTitles[t] || "Questions",
            type: t,
            negativeMarking: step2.negativeMarking,
            sectionNegativeMark: step2.sectionNegativeMark,
            questionRange: `${startNum}-${endNum}`,
            questions: qs.map(({ id: _id, ...q }) => ({
              ...q,
              correctAnswer: q.type === "fillblanks"
                ? ((q as any).blanks?.map((b: any) => b.answer) || [(q as any).correctAnswer || ""])
                : (q as MCQQuestion | TrueFalseQuestion).correctAnswer ?? ""
            }))
          }
        })
      }
      const payload: any = {
        title: step1.title,
        examType: step1.examType || "CUSTOM",
        subject: "",
        description: step1.instructions,
        instructions: step1.instructions.split("\n").filter(Boolean),
        duration: +step1.duration,
        totalMarks: +step1.totalMarks,
        passMarks: +step1.passMarks,
        questionsPerMin: step1.questionsPerMin ? +step1.questionsPerMin : undefined,
        status,
        sections,
        settings: {
          randomize: step2.randomize,
          showResults: step2.showResults,
          allowReview: step2.allowReview,
          negativeMarking: step2.negativeMarking,
          startDate: startDt ? startDt.toISOString() : undefined,
          startTime: step2.startTime || undefined,
          endDate: endDt ? endDt.toISOString() : undefined,
          endTime: step2.endTime || undefined,
          proctoring: step2.proctoring,
        }
      }
      const endpoint = isEdit ? `/api/exams/${activeEditId}` : "/api/exams"
      const method = isEdit ? "PUT" : "POST"
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (res.status === 401) {
        throw new Error("Your organization session has expired. Please sign in again from the Organization Login page.")
      }
      if (!res.ok) throw new Error(data.error || `Failed to ${isEdit ? "update" : "save"} exam`)
      toast.success(isEdit ? "Exam updated successfully" : "Exam created successfully")
      router.push("/admin/exams")
    } catch (e) {
      setError(e instanceof Error ? e.message : `Failed to ${isEdit ? "update" : "save"} exam`)
    } finally {
      setSaving(false)
    }
  }

  if (loadingExam) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-500 bg-white px-5 py-3 rounded-2xl border border-slate-200/80 shadow-xs">
          <Loader2 className="animate-spin text-[#324158]" size={20} />
          <span className="text-sm font-semibold text-[#324158]">Loading exam...</span>
        </div>
      </div>
    )
  }

  if (examNotFound) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-8 text-center bg-[#F8FAFC]">
        <div className="w-16 h-16 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mb-4 border border-red-200 shadow-sm">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-[#324158] mb-2">Exam Not Found</h2>
        <p className="text-gray-500 max-w-md text-sm mb-6 leading-relaxed">
          The exam you are trying to edit does not exist or may have been deleted.
        </p>
        <Link
          href="/admin/exams"
          className="px-6 py-2.5 bg-[#324158] hover:bg-[#253244] text-white rounded-xl text-sm font-medium transition-colors shadow-sm"
        >
          Return to Exams
        </Link>
      </div>
    )
  }

  if (loadingAccess) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-8 text-center bg-[#F8FAFC]">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin mb-3" />
        <p className="text-xs text-gray-400 font-medium">Checking exam permissions & quota...</p>
      </div>
    )
  }

  if (!isEdit && isExamQuotaReached) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-8 text-center bg-[#F8FAFC]">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4 border border-amber-200 shadow-sm">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-[#324158] mb-2">Exam Quota Reached</h2>
        <p className="text-gray-500 max-w-md text-sm mb-6 leading-relaxed">
          Your coaching institute has reached its maximum exam creation limit ({examCount}/{maxExams} exams created). New exam creation is disabled. Please contact your platform administrator to increase your exam quota.
        </p>
        <Link
          href="/admin/exams"
          className="px-6 py-2.5 bg-[#2D3A4A] hover:bg-[#1e2a38] text-white rounded-xl text-sm font-medium transition-colors shadow-sm"
        >
          Return to Exams
        </Link>
      </div>
    )
  }

  if (!isEdit && hasExamAccess === false) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-8 text-center bg-[#F8FAFC]">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4 border border-amber-200 shadow-sm">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-[#324158] mb-2">Access Restricted</h2>
        <p className="text-gray-500 max-w-md text-sm mb-6 leading-relaxed">
          Your coaching institute does not have permission to create standard Exams. Please contact your administrator to enable this module.
        </p>
        <Link
          href="/admin/exams"
          className="px-6 py-2.5 bg-[#2D3A4A] hover:bg-[#1e2a38] text-white rounded-xl text-sm font-medium transition-colors shadow-sm"
        >
          Return to Exams
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-16 pt-6 sm:pt-8">
      <div className="mx-auto max-w-[1400px] px-3 sm:px-8 lg:px-10">
        {/* ─── Breadcrumbs ─── */}
        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 mb-2">
          <Link href="/admin/exams" className="hover:text-slate-900 transition-colors">
            Exams
          </Link>
          <span>/</span>
          <span className="text-slate-900 font-semibold">{isEdit ? "Edit Exam" : "Create New Exam"}</span>
        </div>

        {/* ─── Header & Actions ─── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl sm:text-3xl font-semibold tracking-tight text-slate-900">
              {isEdit ? "Edit Exam" : "Create New Exam"}
            </h1>
            <p className="sm:hidden text-xs text-slate-500 mt-0.5">
              Step {step} of 3: {step === 1 ? "Questions" : step === 2 ? "Exam Details" : "Settings"}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full bg-[#ECFDF5] text-[#047857] border border-[#A7F3D0] text-[11px] sm:text-xs font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#059669]" />
              <span>Proctored Exam</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE] text-[11px] sm:text-xs font-medium">
              <Zap className="w-3.5 h-3.5 text-[#2563EB]" />
              <span>Auto-Grading</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 text-[11px] sm:text-xs font-medium">
              <Layers className="w-3.5 h-3.5 text-slate-600" />
              <span>AI Question Studio</span>
            </span>
            <div className="hidden sm:flex items-center gap-2 ml-2 pl-2 border-l border-slate-200">
              <Link
                href="/admin/exams"
                className="h-10 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs sm:text-sm font-semibold text-slate-700 transition-colors flex items-center shadow-2xs"
              >
                Cancel
              </Link>
              <button
                type="button"
                onClick={() => handleSubmit("draft")}
                disabled={saving}
                className="h-10 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs sm:text-sm font-semibold text-slate-800 transition-colors disabled:opacity-50 shadow-2xs cursor-pointer"
              >
                {isEdit ? "Save Changes as Draft" : "Save Draft"}
              </button>
            </div>
          </div>
        </div>

        {/* ─── Stepper ─── */}
        <Stepper
          step={step}
          onStepClick={(s) => {
            setError("")
            if (s === 2 && step === 1) {
              setStep(2)
            } else if (s === 3 && step === 1) {
              setStep(3)
            } else if (s === 3 && step === 2) {
              handleNext()
            } else {
              setStep(s)
            }
          }}
        />

        {/* ─── Error Notification ─── */}
        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs sm:text-sm flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
              <span className="font-medium">{error}</span>
            </div>
            <button
              onClick={() => setError("")}
              className="text-red-500 hover:text-red-800 font-medium p-1 cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* ─── Step Content ─── */}
        <div className="space-y-6">
          {step === 1 && (
            <Step3
              questions={questions}
              setQuestions={setQuestions}
              canUseQuestionStudio={instituteFeatures.neetJeeGenerator}
              canUsePdfImport={instituteFeatures.pdfImport}
              allowedCustomQuestionTypes={allowedCustomQuestionTypes}
            />
          )}
          {step === 2 && <Step1 form={step1} setForm={setStep1} />}
          {step === 3 && <Step2 form={step2} setForm={setStep2} canUseAiProctoring={instituteFeatures.aiProctoring} />}

          {/* ─── Bottom Navigation Bar ─── */}
          <div className="flex items-center justify-between pt-6 border-t border-slate-200/80 mt-8">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => {
                  setStep(s => s - 1)
                  window.scrollTo({ top: 0, behavior: "smooth" })
                }}
                className="h-11 sm:h-12 px-6 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-sm font-semibold text-slate-700 transition-colors flex items-center gap-2 shadow-2xs cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
            ) : (
              <Link
                href="/admin/exams"
                className="h-11 sm:h-12 px-6 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-sm font-semibold text-slate-700 transition-colors flex items-center gap-2 shadow-2xs sm:hidden"
              >
                Cancel
              </Link>
            )}

            {step < 3 ? (
              <button
                type="button"
                onClick={handleNext}
                className="ml-auto h-11 sm:h-12 px-7 rounded-xl bg-[#324158] hover:bg-[#253244] text-white text-sm font-semibold flex items-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer active:scale-[0.99]"
              >
                <span>{step === 1 ? "Next: Exam Details" : "Next: Settings"}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleSubmit("active")}
                disabled={saving || questions.length === 0}
                className="ml-auto h-11 sm:h-12 px-8 rounded-xl bg-[#324158] hover:bg-[#253244] text-white text-sm font-semibold flex items-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99]"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{isEdit ? "Updating Exam..." : "Creating Exam..."}</span>
                  </>
                ) : (
                  <>
                    <span>{isEdit ? "Update Exam" : "Create & Publish Exam"}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
