"use client"

import { useState, useRef, useEffect } from "react"
import { createPortal } from "react-dom"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  Check, Upload, Plus, X, Trash2, Search, AlertCircle,
  FileText, CheckSquare, List, Code2, AlignLeft, Info, Pencil, MoreVertical,
  Shield, Camera, Maximize, AlertTriangle, Sparkles, Loader2, Clock, GraduationCap
} from "lucide-react"
import { getExamStartDateTime, getExamEndDateTime, formatScheduleDateTime } from "@/lib/examSchedule"
import { ExamDateTimePicker } from "@/components/exam/ExamDateTimePicker"
import { CompetitiveExamAIGenerator, GeneratedCompetitiveQuestion } from "@/components/exam/CompetitiveExamAIGenerator"
import { MathRenderer } from "@/components/exam/MathRenderer"

// ─── Types ────────────────────────────────────────────────────────────────────

type Difficulty = "easy" | "medium" | "hard"
type QuestionType = "mcq" | "truefalse" | "descriptive" | "fillblanks" | "coding"

interface MCQQuestion {
  id: string; type: "mcq"
  questionText: string; difficulty: Difficulty; marks: number
  negativeMark?: number
  options: string[]; correctAnswer: string; explanation: string
  questionImage?: string; optionImages?: string[]
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

type Question = MCQQuestion | TrueFalseQuestion | DescriptiveQuestion | FillBlanksQuestion | CodingQuestion

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
  mcq:         { label: "MCQ",         color: "bg-blue-100 text-blue-700",   icon: <List size={13}/> },
  descriptive: { label: "Descriptive", color: "bg-purple-100 text-purple-700", icon: <AlignLeft size={13}/> },
  truefalse:   { label: "True/False",  color: "bg-teal-100 text-teal-700",   icon: <CheckSquare size={13}/> },
  fillblanks:  { label: "Fill Blanks", color: "bg-amber-100 text-amber-700", icon: <FileText size={13}/> },
  coding:      { label: "Coding",      color: "bg-red-100 text-red-700",     icon: <Code2 size={13}/> },
}

// ─── Stepper ──────────────────────────────────────────────────────────────────

function Stepper({ step, onStepClick }: { step: number; onStepClick?: (step: number) => void }) {
  const steps = [
    { n: 1, label: "Exam Details" },
    { n: 2, label: "Settings" },
    { n: 3, label: "Questions" },
  ]
  return (
    <>
      {/* Mobile Stepper */}
      <div className="flex sm:hidden flex-col gap-2.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold uppercase tracking-wider text-primary">
            Step {step} of 3
          </span>
          <span className="text-gray-500 font-medium">
            {steps[step - 1]?.label}
          </span>
        </div>
        {/* Progress Bar */}
        <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
          <div
            className="bg-[#2D3A4A] h-full transition-all duration-300 rounded-full"
            style={{ width: `${(step / 3) * 100}%` }}
          />
        </div>
        {/* Step Indicator Pills */}
        <div className="grid grid-cols-3 gap-1.5 pt-1">
          {steps.map((s) => (
            <button
              key={s.n}
              type="button"
              onClick={() => onStepClick?.(s.n)}
              className={`py-1.5 px-2 rounded-lg text-center text-[11px] font-semibold transition-all ${
                step === s.n
                  ? "bg-[#2D3A4A] text-white shadow-xs"
                  : step > s.n
                  ? "bg-primary/10 text-primary"
                  : "bg-gray-100 text-gray-400"
              }`}
            >
              {s.n}. {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Desktop Stepper */}
      <div className="hidden sm:flex items-center justify-center gap-0">
        {steps.map((s, i) => (
          <div key={s.n} className="flex items-center">
            <button
              type="button"
              onClick={() => onStepClick?.(s.n)}
              className="flex flex-col items-center gap-1 cursor-pointer focus:outline-none"
            >
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-all
                ${step > s.n ? "bg-primary border-primary text-white"
                  : step === s.n ? "bg-[#2D3A4A] border-[#2D3A4A] text-white"
                  : "bg-white border-gray-200 text-gray-400"}`}>
                {step > s.n ? <Check size={16} /> : s.n}
              </div>
              <div className="text-center">
                <p className={`text-[10px] uppercase tracking-wide font-semibold ${step >= s.n ? "text-[#2D3A4A]" : "text-gray-400"}`}>
                  STEP {s.n}
                </p>
                <p className={`text-xs font-medium ${step >= s.n ? "text-primary" : "text-gray-400"}`}>{s.label}</p>
              </div>
            </button>
            {i < steps.length - 1 && (
              <div className={`w-16 md:w-24 h-0.5 mx-3 mb-5 transition-colors ${step > s.n ? "bg-primary" : "bg-gray-200"}`} />
            )}
          </div>
        ))}
      </div>
    </>
  )
}

// ─── Toggle ───────────────────────────────────────────────────────────────────

function Toggle({ checked, onChange, disabled = false }: { checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      className={`relative w-12 h-6 rounded-full transition-colors focus:outline-none ${checked ? "bg-[#2D3A4A]" : "bg-gray-200"} ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? "translate-x-6" : "translate-x-0"}`} />
    </button>
  )
}

// ─── Input helpers ────────────────────────────────────────────────────────────

const inputCls = "w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2D3A4A]/30 focus:border-[#2D3A4A] bg-white"
const labelCls = "block text-sm font-medium text-[#2D3A4A] mb-1.5"

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
    <ModalShell title={initial ? "Edit MCQ Question" : "Add MCQ Question"} icon={<div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center"><List size={18} className="text-blue-600"/></div>} onClose={onClose}>
      <div className="space-y-4">
        {!initial && (
          <>
            <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3 space-y-2">
              <p className="text-xs font-bold text-blue-800">Generate up to 10 topics at once</p>
              {bulkTopics.map((item, index) => <div key={index} className="flex gap-2">
                <input value={item.topic} onChange={e => setBulkTopics(rows => rows.map((row, i) => i === index ? { ...row, topic: e.target.value } : row))} placeholder={`Topic ${index + 1}`} className={inputCls} />
                <input type="number" min={1} max={60} value={item.count} onChange={e => setBulkTopics(rows => rows.map((row, i) => i === index ? { ...row, count: Math.max(1, Math.min(60, Number(e.target.value) || 1)) } : row))} className="w-20 rounded-lg border border-gray-200 px-2 text-sm bg-white" />
                {index === bulkTopics.length - 1 && bulkTopics.length < 10 && <button type="button" onClick={() => setBulkTopics(rows => [...rows, { topic: "", count: 1 }])} className="rounded-lg border border-gray-200 bg-white hover:bg-gray-50 px-3 text-sm cursor-pointer">+</button>}
              </div>)}
              <button type="button" onClick={generateBulk} disabled={isGenerating} className="flex items-center gap-1.5 rounded-lg bg-[#2D3A4A] hover:bg-[#1e2a38] text-white px-3 py-2 text-xs font-semibold disabled:opacity-60 cursor-pointer">
                {isGenerating ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} Generate All Topics
              </button>
            </div>
            <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3">
              <div className="flex gap-2">
                <input value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} placeholder="AI topic, e.g. photosynthesis..." className={inputCls} />
                <button type="button" onClick={generateWithAi} disabled={isGenerating} className="shrink-0 flex items-center gap-1.5 rounded-lg bg-[#2D3A4A] hover:bg-[#1e2a38] text-white px-3 py-2 text-xs font-semibold disabled:opacity-60 cursor-pointer">
                  {isGenerating ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} {isGenerating ? "Generating..." : "Generate"}
                </button>
              </div>
            </div>
          </>
        )}
        <div>
          <label className={labelCls}>Question Text *</label>
          <textarea value={q.questionText} onChange={e => setQ({...q, questionText: e.target.value})}
            rows={4} placeholder="Enter your question here..."
            className={inputCls + " resize-none"} />
        </div>
        <div>
          <label className={labelCls}>Question Image URL <span className="text-gray-400 font-normal">(Optional)</span></label>
          <div className="flex gap-2">
            <input value={q.questionImage || ""} onChange={e => setQ({...q, questionImage: e.target.value})} 
              placeholder="https://example.com/image.png" className={inputCls} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Difficulty *</label>
            <select value={q.difficulty} onChange={e => setQ({...q, difficulty: e.target.value as Difficulty})} className={inputCls}>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
          <div className="flex gap-3 min-w-0">
             <div className="flex-1">
               <label className={labelCls}>Marks *</label>
               <input type="number" value={q.marks} onChange={e => setQ({...q, marks: +e.target.value})} min={1} className={inputCls} />
             </div>
             <div className="flex-1">
               <label className={labelCls}>Negative Mark</label>
               <input type="number" step="0.25" value={q.negativeMark || 0} onChange={e => setQ({...q, negativeMark: +e.target.value})} min={0} className={inputCls} placeholder="0" />
             </div>
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className={labelCls + " mb-0"}>ANSWER OPTIONS</label>
            <span className="text-xs text-gray-400">Select the correct answer</span>
          </div>
          <div className="space-y-2">
            {q.options.map((opt, i) => (
              <div key={i} className={`flex items-center gap-3 border rounded-lg px-3 py-2 transition-colors ${q.correctAnswer === String.fromCharCode(65+i) ? "border-[#10B981] bg-green-50" : "border-gray-200"}`}>
                <button type="button" onClick={() => setQ({...q, correctAnswer: String.fromCharCode(65+i)})}
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors
                    ${q.correctAnswer === String.fromCharCode(65+i) ? "bg-[#10B981] text-white" : "border-2 border-gray-300 text-gray-400"}`}>
                  {q.correctAnswer === String.fromCharCode(65+i) ? <Check size={13}/> : String.fromCharCode(65+i)}
                </button>
                <div className="flex-1 space-y-2">
                   <input value={opt} onChange={e => {
                     const opts = [...q.options]; opts[i] = e.target.value; setQ({...q, options: opts})
                   }} placeholder={`Enter option ${String.fromCharCode(65+i)}...`}
                     className="w-full text-sm bg-transparent focus:outline-none" />
                   <div className="flex items-center gap-1.5 border-t border-gray-100 pt-1.5 mt-1">
                      <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Image URL:</span>
                      <input 
                        value={q.optionImages?.[i] || ""} 
                        onChange={e => {
                           const img = [...(q.optionImages || ["","","",""])];
                           img[i] = e.target.value;
                           setQ({...q, optionImages: img})
                        }}
                        placeholder="Optional image URL for this option..."
                        className="flex-1 text-[10px] bg-transparent focus:outline-none border-none p-0 text-blue-500" 
                      />
                   </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <label className={labelCls}>Explanation <span className="text-gray-400 font-normal">(Optional - shown after answer)</span></label>
          <textarea value={q.explanation} onChange={e => setQ({...q, explanation: e.target.value})}
            rows={3} placeholder="Explain why the correct answer is right..."
            className={inputCls + " resize-none"} />
        </div>
        {error && <p className="text-sm text-red-500 flex items-center gap-1"><AlertCircle size={14}/>{error}</p>}
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
    <ModalShell title={initial ? "Edit True/False Question" : "Add True/False Question"} icon={<div className="w-9 h-9 rounded-lg bg-teal-50 flex items-center justify-center"><CheckSquare size={18} className="text-teal-600"/></div>} onClose={onClose}>
      <div className="space-y-4">
        {!initial && (
          <>
            <div className="rounded-xl border border-teal-100 bg-teal-50/50 p-3 space-y-2">
              <p className="text-xs font-bold text-teal-800">Generate up to 10 topics at once</p>
              {bulkTopics.map((item, index) => <div key={index} className="flex gap-2">
                <input value={item.topic} onChange={e => setBulkTopics(rows => rows.map((row, i) => i === index ? { ...row, topic: e.target.value } : row))} placeholder={`Topic ${index + 1}`} className={inputCls} />
                <input type="number" min={1} max={60} value={item.count} onChange={e => setBulkTopics(rows => rows.map((row, i) => i === index ? { ...row, count: Math.max(1, Math.min(60, Number(e.target.value) || 1)) } : row))} className="w-20 rounded-lg border border-gray-200 px-2 text-sm bg-white" />
                {index === bulkTopics.length - 1 && bulkTopics.length < 10 && <button type="button" onClick={() => setBulkTopics(rows => [...rows, { topic: "", count: 1 }])} className="rounded-lg border border-gray-200 bg-white hover:bg-gray-50 px-3 text-sm cursor-pointer">+</button>}
              </div>)}
              <button type="button" onClick={generateBulk} disabled={isGenerating} className="flex items-center gap-1.5 rounded-lg bg-[#2D3A4A] hover:bg-[#1e2a38] text-white px-3 py-2 text-xs font-semibold disabled:opacity-60 cursor-pointer">
                {isGenerating ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} Generate All Topics
              </button>
            </div>
            <div className="rounded-xl border border-teal-100 bg-teal-50/50 p-3">
              <div className="flex gap-2">
                <input value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} placeholder="AI topic, e.g. JavaScript basics..." className={inputCls} />
                <button type="button" onClick={generateWithAi} disabled={isGenerating} className="shrink-0 flex items-center gap-1.5 rounded-lg bg-[#2D3A4A] hover:bg-[#1e2a38] text-white px-3 py-2 text-xs font-semibold hover:bg-primary/90 disabled:opacity-60 cursor-pointer">
                  {isGenerating ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} {isGenerating ? "Generating..." : "Generate"}
                </button>
              </div>
            </div>
          </>
        )}
        <div>
          <label className={labelCls}>Statement *</label>
          <textarea value={q.questionText} onChange={e => setQ({...q, questionText: e.target.value})}
            rows={4} placeholder="Enter the statement here..."
            className={inputCls + " resize-none"} />
        </div>
        <div>
          <label className={labelCls}>Question Image URL <span className="text-gray-400 font-normal">(Optional)</span></label>
          <input value={q.questionImage || ""} onChange={e => setQ({...q, questionImage: e.target.value})} 
            placeholder="https://example.com/image.png" className={inputCls} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Difficulty *</label>
            <select value={q.difficulty} onChange={e => setQ({...q, difficulty: e.target.value as Difficulty})} className={inputCls}>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>Marks *</label>
              <input type="number" value={q.marks} onChange={e => setQ({...q, marks: +e.target.value})} min={1} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Neg. Mark</label>
              <input type="number" step="0.25" value={q.negativeMark || 0} onChange={e => setQ({...q, negativeMark: +e.target.value})} min={0} className={inputCls} placeholder="0" />
            </div>
          </div>
        </div>
        <div>
          <label className={labelCls}>Correct Answer *</label>
          <div className="grid grid-cols-2 gap-3">
            {(["True","False"] as const).map(opt => (
              <button key={opt} type="button" onClick={() => setQ({...q, correctAnswer: opt})}
                className={`py-4 rounded-xl border-2 text-base font-semibold transition-all
                  ${q.correctAnswer === opt
                    ? opt === "True"
                      ? "border-green-500 bg-green-50 text-green-600"
                      : "border-red-500 bg-red-50 text-red-600"
                    : "border-gray-200 text-gray-500 hover:border-gray-300"}`}>
                {opt}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className={labelCls}>Explanation <span className="text-gray-400 font-normal">(Shown after answering)</span></label>
          <textarea value={q.explanation} onChange={e => setQ({...q, explanation: e.target.value})}
            rows={3} placeholder="Explain why this is true or false..."
            className={inputCls + " resize-none"} />
        </div>
        {error && <p className="text-sm text-red-500 flex items-center gap-1"><AlertCircle size={14}/>{error}</p>}
      </div>
      <ModalFooter note={<span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500 inline-block"/>Auto-graded question type</span>} onCancel={onClose} onSave={save} />
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
    <ModalShell title={initial ? "Edit Descriptive Question" : "Add Descriptive Question"} icon={<div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center"><AlignLeft size={18} className="text-purple-600"/></div>} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className={labelCls}>Question Text *</label>
          <textarea value={q.questionText} onChange={e => setQ({...q, questionText: e.target.value})}
            rows={4} placeholder="Enter your descriptive question here..."
            className={inputCls + " resize-none"} />
        </div>
        <div>
          <label className={labelCls}>Question Image URL <span className="text-gray-400 font-normal">(Optional)</span></label>
          <input value={q.questionImage || ""} onChange={e => setQ({...q, questionImage: e.target.value})} 
            placeholder="https://example.com/image.png" className={inputCls} />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Difficulty *</label>
            <select value={q.difficulty} onChange={e => setQ({...q, difficulty: e.target.value as Difficulty})} className={inputCls}>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Marks *</label>
            <input type="number" value={q.marks} onChange={e => setQ({...q, marks: +e.target.value})} min={1} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Word Limit <span className="text-gray-400 font-normal text-xs">(Optional)</span></label>
            <input value={q.wordLimit} onChange={e => setQ({...q, wordLimit: e.target.value})} placeholder="e.g. 200-300 words" className={inputCls} />
          </div>
        </div>
        <div>
          <label className={labelCls}>Model Answer <span className="text-gray-400 font-normal text-xs">(For grading reference)</span></label>
          <textarea value={q.modelAnswer} onChange={e => setQ({...q, modelAnswer: e.target.value})}
            rows={4} placeholder="Enter the ideal answer or key points that should be covered..."
            className={inputCls + " resize-none"} />
        </div>
        <div>
          <label className={labelCls}>Grading Rubric <span className="text-gray-400 font-normal text-xs">(Optional - define scoring criteria)</span></label>
          <div className="flex gap-2 flex-wrap">
            {q.rubric.map((r, i) => (
              <input key={i} value={r} onChange={e => {
                const rb = [...q.rubric]; rb[i] = e.target.value; setQ({...q, rubric: rb})
              }} placeholder={`Criterion ${i+1}`}
                className="flex-1 min-w-30 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#10B981]" />
            ))}
            <button type="button" onClick={() => setQ({...q, rubric: [...q.rubric, ""]})}
              className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center text-gray-400 hover:border-[#10B981] hover:text-[#10B981]">
              <Plus size={16}/>
            </button>
          </div>
        </div>
        {error && <p className="text-sm text-red-500 flex items-center gap-1"><AlertCircle size={14}/>{error}</p>}
      </div>
      <ModalFooter note={<span className="flex items-center gap-1.5"><AlertCircle size={13} className="text-gray-400"/>Descriptive answers require manual grading</span>} onCancel={onClose} onSave={save} />
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
  const [q, setQ] = useState<FillBlanksQuestion>(initial ?? blank())
  const [error, setError] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [aiPrompt, setAiPrompt] = useState("")
  const [bulkTopics, setBulkTopics] = useState([{ topic: "", count: 1 }])

  // Auto-detect blanks from ___ in questionText
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
    <ModalShell title={initial ? "Edit Fill in the Blanks" : "Add Fill in the Blanks"} icon={<div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center"><FileText size={18} className="text-amber-600"/></div>} onClose={onClose}>
      <div className="space-y-4">
        {!initial && (
          <>
            <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-3 space-y-2">
              <p className="text-xs font-bold text-amber-800">Generate up to 10 topics at once</p>
              {bulkTopics.map((item, index) => (
                <div key={index} className="flex gap-2">
                  <input value={item.topic} onChange={e => setBulkTopics(rows => rows.map((row, i) => i === index ? { ...row, topic: e.target.value } : row))} placeholder={`Topic ${index + 1}`} className={inputCls} />
                  <input type="number" min={1} max={60} value={item.count} onChange={e => setBulkTopics(rows => rows.map((row, i) => i === index ? { ...row, count: Math.max(1, Math.min(60, Number(e.target.value) || 1)) } : row))} className="w-20 rounded-lg border border-gray-200 px-2 text-sm bg-white" />
                  {index === bulkTopics.length - 1 && bulkTopics.length < 10 && <button type="button" onClick={() => setBulkTopics(rows => [...rows, { topic: "", count: 1 }])} className="rounded-lg border border-gray-200 bg-white hover:bg-gray-50 px-3 text-sm cursor-pointer">+</button>}
                </div>
              ))}
              <button type="button" onClick={generateBulk} disabled={isGenerating} className="flex items-center gap-1.5 rounded-lg bg-[#2D3A4A] hover:bg-[#1e2a38] text-white px-3 py-2 text-xs font-semibold disabled:opacity-60 cursor-pointer">
                {isGenerating ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} Generate All Topics
              </button>
            </div>
            <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-3">
              <div className="flex gap-2">
                <input value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} placeholder="AI topic, e.g. water cycle..." className={inputCls} />
                <button type="button" onClick={generateWithAi} disabled={isGenerating} className="shrink-0 flex items-center gap-1.5 rounded-lg bg-[#2D3A4A] hover:bg-[#1e2a38] text-white px-3 py-2 text-xs font-semibold disabled:opacity-60 cursor-pointer">
                  {isGenerating ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} {isGenerating ? "Generating..." : "Generate"}
                </button>
              </div>
            </div>
          </>
        )}
        <div className="bg-amber-50 rounded-lg px-4 py-3 text-sm text-amber-700">
          Use <strong>___</strong> (3+ underscores) to mark blank positions in your question text.
        </div>
        <div>
          <label className={labelCls}>Question with Blanks *</label>
          <textarea value={q.questionText} onChange={e => detectBlanks(e.target.value)}
            rows={3} placeholder="The chemical formula for water is ___ and for carbon dioxide is ___."
            className={inputCls + " resize-none"} />
        </div>
        <div>
          <label className={labelCls}>Question Image URL <span className="text-gray-400 font-normal">(Optional)</span></label>
          <input value={q.questionImage || ""} onChange={e => setQ({...q, questionImage: e.target.value})} 
            placeholder="https://example.com/image.png" className={inputCls} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Difficulty *</label>
            <select value={q.difficulty} onChange={e => setQ({...q, difficulty: e.target.value as Difficulty})} className={inputCls}>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>Marks *</label>
              <input type="number" value={q.marks} onChange={e => setQ({...q, marks: +e.target.value})} min={1} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Neg. Mark</label>
              <input type="number" step="0.1" value={q.negativeMark || 0} onChange={e => setQ({...q, negativeMark: +e.target.value})} min={0} className={inputCls} placeholder="0" />
            </div>
          </div>
        </div>
        {q.blanks.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">CORRECT ANSWERS</label>
              <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
                <input type="checkbox" checked={q.caseInsensitive} onChange={e => setQ({...q, caseInsensitive: e.target.checked})} className="accent-[#10B981]" />
                Case insensitive matching
              </label>
            </div>
            <div className="space-y-3">
              {q.blanks.map((bl, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 text-xs font-bold flex items-center justify-center shrink-0">{i+1}</span>
                    <input value={bl.answer} onChange={e => {
                      const bs = [...q.blanks]; bs[i] = {...bs[i], answer: e.target.value}; setQ({...q, blanks: bs})
                    }} placeholder={`Answer for blank ${i+1}`} className={inputCls} />
                  </div>
                  <div className="flex items-center gap-2 pl-9">
                    <span className="text-xs text-gray-400">Also accept:</span>
                    {bl.alsoAccept.map((a, ai) => (
                      <input key={ai} value={a} onChange={e => {
                        const bs = [...q.blanks]; const aa = [...bs[i].alsoAccept]; aa[ai] = e.target.value; bs[i] = {...bs[i], alsoAccept: aa}; setQ({...q, blanks: bs})
                      }} className="w-24 px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:border-[#10B981]" />
                    ))}
                    <button type="button" onClick={() => {
                      const bs = [...q.blanks]; bs[i] = {...bs[i], alsoAccept: [...bs[i].alsoAccept, ""]}; setQ({...q, blanks: bs})
                    }} className="text-[#10B981] hover:text-[#059669]"><Plus size={14}/></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {error && <p className="text-sm text-red-500 flex items-center gap-1"><AlertCircle size={14}/>{error}</p>}
      </div>
      <ModalFooter
        note={<span className="flex items-center gap-1.5 text-amber-600"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block"/>{q.blanks.length} blank{q.blanks.length !== 1 ? "s" : ""} detected - Auto-graded question</span>}
        onCancel={onClose} onSave={save} />
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
    <ModalShell title="Add Coding Question" icon={<div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center"><Code2 size={18} className="text-red-600"/></div>} onClose={onClose}>
      <div className="space-y-4 pb-4 overflow-y-auto max-h-[85vh] px-1">
        {/* Gemini AI Auto-Generator */}
        <div className="p-3.5 bg-gradient-to-r from-indigo-50/90 via-purple-50/60 to-blue-50/90 border border-indigo-200/80 rounded-2xl space-y-2.5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-950">
              <Sparkles size={14} className="text-indigo-600 animate-pulse" />
              <span>Smart Question & Template Generator</span>
            </div>
            <span className="text-[10px] font-bold text-indigo-700 px-2 py-0.5 bg-indigo-100 rounded-full">
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
              className="flex-1 px-3 py-2 text-xs bg-white border border-indigo-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-60 placeholder:text-gray-400"
            />
            <button
              type="button"
              disabled={isAiGenerating || !aiPrompt.trim()}
              onClick={handleAiGenerate}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all disabled:opacity-50 flex items-center gap-1.5 shadow-sm shrink-0 active:scale-95"
            >
              {isAiGenerating ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              <span>{isAiGenerating ? "Generating..." : "Generate"}</span>
            </button>
          </div>
          {aiError && (
            <p className="text-[11px] text-red-600 font-medium flex items-center gap-1">
              <AlertCircle size={11} /> {aiError}
            </p>
          )}
          <p className="text-[10px] text-indigo-800/70">
            Type any problem name or topic to auto-fill description, starter templates for all languages, and test cases instantly!
          </p>
        </div>

        {/* Step-by-Step Guide */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-[11px] text-blue-700 leading-relaxed">
          <p className="font-bold mb-1 flex items-center gap-1"><Info size={12}/> How to create a LeetCode-style problem:</p>
          <ol className="list-decimal list-inside space-y-0.5 ml-1">
            <li>Write the <b>Problem Statement</b> and set <b>Marks</b>.</li>
            <li>Enable the <b>Languages</b> you want to support.</li>
            <li>Under each language tab, the <b>Initial Template</b> is what the student sees (e.g. a class method).</li>
            <li>The <b>Driver Code</b> (hidden) is what executes the student's code and reads test cases via <code>stdin</code>.</li>
            <li>Add <b>Test Cases</b> with the specific inputs your Driver expects.</li>
          </ol>
        </div>

        <div>
          <label className={labelCls}>Problem Statement *</label>
          <textarea value={q.questionText} onChange={e => setQ({...q, questionText: e.target.value})}
            rows={4} placeholder="Describe the problem clearly..."
            className={inputCls + " resize-none"} />
        </div>
        <div>
          <label className={labelCls}>Question Image URL <span className="text-gray-400 font-normal">(Optional)</span></label>
          <input value={q.questionImage || ""} onChange={e => setQ({...q, questionImage: e.target.value})} 
            placeholder="https://example.com/image.png" className={inputCls} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Difficulty *</label>
            <select value={q.difficulty} onChange={e => setQ({...q, difficulty: e.target.value as Difficulty})} className={inputCls}>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>Marks *</label>
              <input type="number" value={q.marks} onChange={e => setQ({...q, marks: +e.target.value})} min={1} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Neg. Mark</label>
              <input type="number" step="0.1" value={q.negativeMark || 0} onChange={e => setQ({...q, negativeMark: +e.target.value})} min={0} className={inputCls} placeholder="0" />
            </div>
          </div>
        </div>

        <div>
          <label className={labelCls}>Enabled Languages</label>
          <div className="flex gap-2 flex-wrap mb-4">
            {["Python","Java","C++","JavaScript","Go","Rust"].map(lang => {
              const val = lang.toLowerCase()
              const active = q.languages.includes(lang)
              return (
                <button key={lang} type="button" onClick={() => setQ(prev => {
                  const langs = active ? prev.languages.filter(l => l !== lang) : [...prev.languages, lang]
                  return { ...prev, languages: langs }
                })} className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all
                  ${active ? "bg-[#45505F] text-white border-[#45505F] shadow-md" : "bg-white border-gray-100 text-gray-500 hover:border-gray-300"}`}>
                  {lang}
                </button>
              )
            })}
          </div>

          {q.languages.length > 0 && (
            <div className="border border-gray-100 rounded-2xl overflow-hidden bg-gray-50/30">
              <div className="flex bg-gray-100/50 p-1">
                {q.languages.map(lang => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => setActiveLang(lang.toLowerCase())}
                    className={`flex-1 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${
                      activeLang === lang.toLowerCase() ? "bg-white text-[#45505F] shadow-sm" : "text-gray-400 hover:text-gray-600"
                    }`}
                  >
                    {lang}
                  </button>
                ))}
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Initial Template</label>
                    <span className="text-[9px] text-[#10B981] font-bold">VISIBLE TO STUDENT</span>
                  </div>
                  <textarea
                    value={q.codeTemplates[activeLang] || ""}
                    onChange={e => setQ({
                      ...q,
                      codeTemplates: { ...q.codeTemplates, [activeLang]: e.target.value }
                    })}
                    rows={6}
                    className="w-full p-3 bg-[#1e2a38] text-white font-mono text-xs rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                    placeholder={`Enter boilerplate code for ${activeLang}...`}
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Driver Code</label>
                    <span className="text-[9px] text-red-400 font-bold">HIDDEN INTERNAL RUNNER</span>
                  </div>
                  <textarea
                    value={q.driverCode[activeLang] || ""}
                    onChange={e => setQ({
                       ...q,
                       driverCode: { ...q.driverCode, [activeLang]: e.target.value }
                    })}
                    rows={4}
                    className="w-full p-3 bg-gray-100 text-[#45505F] font-mono text-xs rounded-xl border border-gray-200 focus:outline-none"
                    placeholder={`Enter driver code to run test cases in ${activeLang}...`}
                  />
                  <p className="text-[9px] text-gray-400 mt-1.5">Use <code>stdin</code> to read inputs from test cases and print output for validation.</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className={labelCls + " mb-0"}>Test Cases</label>
            <button type="button" onClick={() => setQ({...q, testCases: [...q.testCases, {input:"", expectedOutput:"", hidden: false}]})}
              className="text-xs text-[#10B981] hover:underline flex items-center gap-1 font-bold"><Plus size={12}/>ADD TEST CASE</button>
          </div>
          <div className="space-y-3">
            {q.testCases.map((tc, i) => (
              <div key={i} className="flex gap-2 items-start bg-gray-50/50 p-3 rounded-xl border border-gray-100">
                <div className="flex-1 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[9px] font-black text-gray-400 uppercase mb-1 block">Input</label>
                      <textarea value={tc.input} onChange={e => {
                        const tc2 = [...q.testCases]; tc2[i] = {...tc2[i], input: e.target.value}; setQ({...q, testCases: tc2})
                      }} placeholder="e.g. [1, 2, 3]" className={inputCls + " text-xs font-mono h-16 resize-none"} />
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-gray-400 uppercase mb-1 block">Expected Output</label>
                      <textarea value={tc.expectedOutput} onChange={e => {
                        const tc2 = [...q.testCases]; tc2[i] = {...tc2[i], expectedOutput: e.target.value}; setQ({...q, testCases: tc2})
                      }} placeholder="e.g. 6" className={inputCls + " text-xs font-mono h-16 resize-none"} />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={!!tc.hidden} onChange={e => {
                      const tc2 = [...q.testCases]; tc2[i] = {...tc2[i], hidden: e.target.checked}; setQ({...q, testCases: tc2})
                    }} className="rounded border-gray-300 text-[#10B981] focus:ring-[#10B981]" />
                    <span className="text-[10px] font-bold text-gray-500 uppercase">Hidden Test Case</span>
                  </label>
                </div>
                <button type="button" onClick={() => setQ({...q, testCases: q.testCases.filter((_, idx) => idx !== i)})}
                  className="p-1.5 text-red-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors mt-4">
                  <Trash2 size={16}/>
                </button>
              </div>
            ))}
          </div>
        </div>
        {error && <p className="text-sm text-red-500 flex items-center gap-1 font-medium bg-red-50 p-2 rounded-lg"><AlertCircle size={14}/>{error}</p>}
      </div>
      <ModalFooter note={<span className="font-medium text-gray-500">Enable multiple languages for student choice</span>} onCancel={onClose} onSave={save} />
    </ModalShell>
  )
}

// ─── Modal Shell & Footer ─────────────────────────────────────────────────────

function ModalShell({ title, icon, onClose, children }: {
  title: string; icon: React.ReactNode; onClose: () => void; children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center gap-3 px-6 pt-6 pb-4 border-b border-gray-100">
          {icon}
          <h2 className="text-lg font-bold text-[#45505F] flex-1">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-4">{children}</div>
      </div>
    </div>
  )
}

function ModalFooter({ note, onCancel, onSave }: { note: React.ReactNode; onCancel: () => void; onSave: () => void }) {
  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-4 mt-4 border-t border-gray-100">
      <div className="text-xs text-gray-400">{note}</div>
      <div className="flex gap-2 sm:gap-3 justify-end">
        <button type="button" onClick={onCancel} className="flex-1 sm:flex-none px-4 sm:px-5 py-2 rounded-lg border border-gray-200 text-xs sm:text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
        <button type="button" onClick={onSave} className="flex-1 sm:flex-none px-4 sm:px-5 py-2 rounded-lg bg-[#2D3A4A] text-white text-xs sm:text-sm font-medium hover:bg-[#1e2a38] transition-colors">Save Question</button>
      </div>
    </div>
  )
}

// ─── Step 1 ───────────────────────────────────────────────────────────────────

function Step1({ form, setForm }: { form: Step1Form; setForm: React.Dispatch<React.SetStateAction<Step1Form>> }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-6 lg:p-8 shadow-xs">
      <h2 className="text-lg sm:text-xl font-bold text-[#2D3A4A] mb-5 sm:mb-6">Basic Information</h2>
      <div className="space-y-4 sm:space-y-5">
        <div>
          <label className={labelCls}>Exam Title <span className="text-red-500">*</span></label>
          <input value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))}
            placeholder="Enter exam title..." className={inputCls} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
          <div>
            <label className={labelCls}>Duration (minutes) <span className="text-red-500">*</span></label>
            <input type="number" value={form.duration} onChange={e => setForm(f => ({...f, duration: e.target.value}))}
              placeholder="e.g., 60" min="1" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Questions Per Minute <span className="text-xs text-gray-400 font-normal">(Optional)</span></label>
            <input type="number" value={form.questionsPerMin} onChange={e => setForm(f => ({...f, questionsPerMin: e.target.value}))}
              placeholder="e.g., 1.5" min="0.1" step="0.1" className={inputCls} />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
          <div>
            <label className={labelCls}>Pass Marks <span className="text-red-500">*</span></label>
            <input type="number" value={form.passMarks} onChange={e => setForm(f => ({...f, passMarks: e.target.value}))}
              placeholder="e.g., 40" min="0" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Total Marks <span className="text-red-500">*</span></label>
            <input type="number" value={form.totalMarks} onChange={e => setForm(f => ({...f, totalMarks: e.target.value}))}
              placeholder="e.g., 100" min="1" className={inputCls} />
          </div>
        </div>
        <div>
          <label className={labelCls}>Instructions</label>
          <textarea value={form.instructions} onChange={e => setForm(f => ({...f, instructions: e.target.value}))}
            rows={4} placeholder="Enter exam instructions for students..."
            className={inputCls + " resize-none"} />
        </div>
      </div>
    </div>
  )
}

// ─── Step 2 ───────────────────────────────────────────────────────────────────

function Step2({ form, setForm, canUseAiProctoring }: { form: Step2Form; setForm: React.Dispatch<React.SetStateAction<Step2Form>>; canUseAiProctoring: boolean }) {
  const toggles: { key: keyof Step2Form; label: string; desc: string }[] = [
    { key: "randomize",      label: "Randomize Questions",    desc: "Display questions in random order for each student" },
    { key: "showResults",    label: "Show Results Immediately", desc: "Students can see their results right after submission" },
    { key: "allowReview",    label: "Allow Review",            desc: "Students can review their answers after submission" },
    { key: "negativeMarking", label: "Enable Negative Marking", desc: "Deduct marks for wrong answers" },
  ]

  const proctoringToggles = [
    { key: "faceDetection", label: "Face Detection", desc: "Monitors candidate through camera", icon: <Camera size={16} /> },
    { key: "tabSwitch",     label: "Tab-Switch Prevention", desc: "Warns when student leaves the tab", icon: <AlertTriangle size={16} /> },
    { key: "fullscreen",    label: "Enforce Fullscreen", desc: "Exits exam if fullscreen is closed", icon: <Maximize size={16} /> },
    { key: "aiProctoring",  label: "AI Status Analysis", desc: "Analyzes face positioning and focus", icon: <Shield size={16} /> },
  ] as const

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-6 lg:p-8 shadow-xs">
      <h2 className="text-lg sm:text-xl font-bold text-[#2D3A4A] mb-5 sm:mb-6">Exam Settings</h2>
      <div className="space-y-6 sm:space-y-8">
        <div>
          <h3 className="text-base font-bold text-[#2D3A4A] mb-3 sm:mb-4 flex items-center gap-2">
            <div className="w-1.5 h-6 bg-[#3D4B5C] rounded-full" />
            Schedule & Timeline
          </h3>
          {(() => {
            const startDt = form.startDate ? getExamStartDateTime({ startDate: form.startDate, startTime: form.startTime }) : null
            const endDt = form.endDate ? getExamEndDateTime({ endDate: form.endDate, endTime: form.endTime }) : null
            const isInvalid = !!(startDt && endDt && endDt.getTime() <= startDt.getTime())

            return (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
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
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 font-bold flex items-center gap-2">
                    <AlertCircle size={14} /> End Date & Time must be after Start Date & Time!
                  </div>
                )}

                {startDt && endDt && !isInvalid && (
                  <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 shadow-2xs">
                    <div className="flex items-center gap-2.5">
                      <Clock size={15} className="text-emerald-600 shrink-0" />
                      <span className="leading-snug">
                        <strong className="font-bold text-emerald-950">Active Exam Window: </strong>
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
          <div>
            <h3 className="text-base font-bold text-[#2D3A4A] mb-3 sm:mb-4 flex items-center gap-2">
              <div className="w-1.5 h-6 bg-[#3D4B5C] rounded-full" />
              Evaluation Options
            </h3>
            <div className="space-y-3">
              {toggles.map(t => (
                <div key={t.key} className="flex flex-col border border-transparent rounded-xl hover:border-gray-200 transition-all">
                  <div className="flex items-center justify-between p-3 gap-2">
                    <div className="flex-1 pr-2 sm:pr-4">
                      <p className="text-sm font-bold text-[#2D3A4A]">{t.label}</p>
                      <p className="text-[11px] text-gray-500 font-medium leading-relaxed mt-0.5">{t.desc}</p>
                    </div>
                    <div className="shrink-0">
                      <Toggle checked={form[t.key] as boolean} onChange={() => setForm(f => ({...f, [t.key]: !f[t.key]}))} />
                    </div>
                  </div>
                  {t.key === "negativeMarking" && form.negativeMarking && (
                    <div className="pb-4 px-4">
                       <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                        <label className="text-[11px] font-bold text-gray-500 uppercase mb-2 block">Default Negative Mark</label>
                        <input
                          type="number"
                          step="0.25"
                          min="0"
                          value={form.sectionNegativeMark}
                          onChange={e => setForm(f => ({...f, sectionNegativeMark: +e.target.value}))}
                          className={`${inputCls} bg-white`}
                          placeholder="e.g. 0.25"
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-base font-bold text-[#2D3A4A] mb-3 sm:mb-4 flex items-center gap-2">
              <div className="w-1.5 h-6 bg-red-400 rounded-full" />
              Proctoring Security
            </h3>
            <div className="space-y-3">
              {proctoringToggles.map(pt => (
                <div key={pt.key} className="flex items-center justify-between p-3 rounded-xl border border-transparent hover:border-gray-200 hover:bg-white transition-all bg-gray-50/50 gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-2 rounded-lg shrink-0 ${form.proctoring[pt.key] ? 'bg-primary/10 text-primary' : 'bg-gray-200 text-gray-400'}`}>
                      {pt.icon}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[#2D3A4A]">{pt.label}</p>
                      <p className="text-[11px] text-gray-500 font-medium mt-0.5">{pt.desc}</p>
                    </div>
                  </div>
                  <div className="shrink-0">
                    <Toggle 
                      checked={form.proctoring[pt.key]} 
                      disabled={pt.key === "aiProctoring" && !canUseAiProctoring}
                      onChange={() => setForm(f => ({
                        ...f, 
                        proctoring: { ...f.proctoring, [pt.key]: !f.proctoring[pt.key] }
                      }))} 
                    />
                  </div>
                </div>
              ))}
              <div className="mt-4 p-4 bg-blue-50/50 rounded-xl border border-blue-100/50 border-dashed">
                <p className="text-[10px] text-blue-600 font-bold uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                   <Info size={12} /> Pro-Tip
                </p>
                <p className="text-xs text-blue-800 leading-relaxed font-medium">
                  Enabling Face Detection & AI Status Analysis requires students to have a working webcam.
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
      <button onClick={() => { onEdit(q); onClose() }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 text-left border-b border-gray-100 font-medium transition-colors">
        <Pencil size={14} className="text-blue-500" />
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
  const [search, setSearch] = useState("")
  const [filterType, setFilterType] = useState<QuestionType | "all">("all")
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null)
  const [pdfUploading, setPdfUploading] = useState(false)
  const [pdfError, setPdfError] = useState("")
  const [showCompetitiveAiModal, setShowCompetitiveAiModal] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleAddCompetitiveQuestions = (newQuestions: GeneratedCompetitiveQuestion[]) => {
    const mapped: Question[] = newQuestions.map(q => ({
      id: q.id,
      type: "mcq",
      questionText: q.questionText,
      difficulty: q.difficulty,
      marks: q.marks,
      negativeMark: q.negativeMark,
      options: q.options,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
    }))
    setQuestions(prev => [...prev, ...mapped])
  }

  const openMenu = (qId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    setAnchorRect(rect)
    setMenuOpen(qId === menuOpen ? null : qId)
  }

  const filtered = questions.filter(q => {
    const matchType = filterType === "all" || q.type === filterType
    const matchSearch = q.questionText.toLowerCase().includes(search.toLowerCase())
    return matchType && matchSearch
  })

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
    (["mcq","truefalse","descriptive","fillblanks","coding"] as QuestionType[]).map(t => [t, questions.filter(q => q.type === t).length])
  )

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-6 lg:p-8 shadow-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5 sm:mb-6">
        <div className="flex items-center gap-3">
          <h2 className="text-lg sm:text-xl font-bold text-[#2D3A4A]">Select Questions</h2>
          {questions.length > 0 && (
            <span className="px-2.5 py-0.5 sm:px-3 sm:py-1 bg-[#2D3A4A]/10 rounded-full text-xs font-bold text-[#2D3A4A] ring-1 ring-[#2D3A4A]/20">
              {questions.length} Selected
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => canUseQuestionStudio && setShowCompetitiveAiModal(true)}
            disabled={!canUseQuestionStudio}
            className="flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg bg-[#2D3A4A] hover:bg-[#1e2a38] text-white text-xs sm:text-sm font-medium shadow-xs transition-colors cursor-pointer"
          >
            <GraduationCap size={15} className="text-white shrink-0" />
            <span>{canUseQuestionStudio ? "Competitive Test" : "Question Studio (Unavailable)"}</span>
          </button>
          <input ref={fileRef} type="file" accept="application/pdf" onChange={handlePdfUpload} className="hidden" />
          <button onClick={() => canUsePdfImport && fileRef.current?.click()} disabled={pdfUploading || !canUsePdfImport}
            className="flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg border border-gray-200 text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60 transition-colors">
            <Upload size={15} className="shrink-0" />
            <span>{pdfUploading ? "Uploading..." : canUsePdfImport ? "Upload from PDF" : "PDF Import"}</span>
          </button>
          <div className="relative group">
            <button className="flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg bg-[#2D3A4A] text-white text-xs sm:text-sm font-medium hover:bg-[#1e2a38] transition-colors">
              <Plus size={15} className="shrink-0" />
              <span>Add Question</span>
            </button>
            <div className="absolute right-0 top-full pt-1.5 w-44 z-20 hidden group-hover:block before:absolute before:inset-0 before:h-2 before:-top-2 before:bg-transparent">
              <div className="bg-white border border-gray-100 rounded-xl shadow-lg">
                {(["mcq","truefalse","descriptive","fillblanks","coding"] as QuestionType[]).filter(type => allowedCustomQuestionTypes.includes(type)).map(type => (
                  <button key={type} onClick={() => openModal(type)}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 first:rounded-t-xl last:rounded-b-xl transition-colors">
                    {TYPE_META[type].icon}
                    {TYPE_META[type].label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {pdfError && (
        <div className="mb-4 p-3 bg-red-50 rounded-lg text-sm text-red-600 flex items-center gap-2">
          <AlertCircle size={14}/>{pdfError}
        </div>
      )}

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3 mb-4">
        <div className="flex-1 relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search questions..."
            className="w-full pl-10 pr-4 py-2 sm:py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2D3A4A]/20 focus:border-[#2D3A4A] transition-all" />
        </div>
        <select value={filterType} onChange={e => setFilterType(e.target.value as QuestionType | "all")}
          className="px-3.5 py-2 sm:py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#2D3A4A]/20 focus:border-[#2D3A4A] transition-all cursor-pointer">
          <option value="all">All Types</option>
          {(["mcq","truefalse","descriptive","fillblanks","coding"] as QuestionType[]).map(t => (
            <option key={t} value={t}>{TYPE_META[t].label}</option>
          ))}
        </select>
      </div>

      {/* Type Legend */}
      <div className="flex items-center gap-2 sm:gap-4 mb-4 flex-wrap">
        <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">TYPES:</span>
        {(["mcq","truefalse","descriptive","fillblanks","coding"] as QuestionType[]).map(t => (
          <button 
            key={t} 
            onClick={() => openModal(t)}
            className={`flex items-center gap-1.5 text-xs font-bold px-2.5 sm:px-3 py-1 rounded-full ${TYPE_META[t].color} border border-current/20 hover:scale-105 hover:shadow-xs active:scale-95 transition-all duration-200 cursor-pointer uppercase tracking-tight`}
          >
            {TYPE_META[t].icon} {TYPE_META[t].label}
          </button>
        ))}
      </div>

      {/* Question List */}
      {filtered.length === 0 ? (
        <div className="py-16 text-center">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
            <FileText size={20} className="text-gray-400"/>
          </div>
          <p className="text-sm text-gray-500">No questions yet. Add questions manually or upload a PDF.</p>
        </div>
      ) : (
        <div className="space-y-2.5 mb-4 max-h-137.5 overflow-y-auto pr-1 sm:pr-2 custom-scrollbar">
          {filtered.map((q, i) => (
            <div key={q.id} className={`flex items-start sm:items-center gap-3 p-3.5 sm:p-4 rounded-xl border transition-colors
              ${q.type === "coding" ? "border-red-100 bg-red-50/30" : "border-gray-100 hover:bg-gray-50"}`}>
              <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${TYPE_META[q.type].color} mt-0.5 sm:mt-0`}>
                {TYPE_META[q.type].icon}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-[#2D3A4A] line-clamp-2 leading-tight">
                  <MathRenderer content={q.questionText || `Question ${i+1}`} />
                </div>
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-1.5">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${TYPE_META[q.type].color} border-current opacity-90`}>{TYPE_META[q.type].label}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${DIFFICULTY_COLORS[q.difficulty]} border-current opacity-90`}>{q.difficulty}</span>
                  <span className="sm:hidden text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-700 font-semibold rounded">
                    {q.marks} {q.marks === 1 ? "mark" : "marks"}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-bold text-[#2D3A4A]">{q.marks}</p>
                  <p className="text-[10px] font-medium text-gray-400 uppercase">Marks</p>
                </div>
                <div className="flex items-center gap-1 relative">
                  <button onClick={(e) => openMenu(q.id, e)} className="p-1.5 sm:p-2 rounded-lg text-gray-400 hover:text-[#2D3A4A] hover:bg-gray-100 transition-colors">
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
          ))}
        </div>
      )}

      {/* Footer Summary */}
      {questions.length > 0 && (
        <div className="pt-4 sm:pt-5 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
          <div className="flex items-center gap-2 flex-wrap text-xs sm:text-sm">
            <span className="font-bold text-[#2D3A4A] tracking-tight">{questions.length} questions selected</span>
            <span className="text-gray-300">|</span>
            <span className="font-medium text-gray-500">Total: <span className="text-[#2D3A4A] font-bold">{totalMarks} marks</span></span>
            {Object.entries(typeCounts).filter(([,c]) => c > 0).map(([t, c]) => (
              <span key={t} className="flex items-center gap-1.5"><span className="text-gray-300">·</span><span className="px-2 py-0.5 bg-gray-50 rounded text-xs text-gray-500 font-semibold">{c} {TYPE_META[t as QuestionType].label}</span></span>
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

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CreateExamPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
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

  // Load global proctoring defaults from admin settings
  useEffect(() => {
    fetch("/api/admin/institute-access", { credentials: "include" })
      .then((response) => response.json())
      .then((data) => {
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
      .catch(() => {})
  }, [])

  useEffect(() => {
    setQuestions((current) => current.filter((question) => allowedCustomQuestionTypes.includes(question.type)))
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
    if (step === 1) {
      const err = validateStep1(); if (err) return setError(err)
    }
    if (step === 2) {
      const err = validateStep2(); if (err) return setError(err)
    }
    setStep(s => s + 1)
  }

  const handleSubmit = async (status: "draft" | "active") => {
    setError(""); setSaving(true)
    try {
      const startDt = step2.startDate ? getExamStartDateTime({ startDate: step2.startDate, startTime: step2.startTime }) : null
      const endDt = step2.endDate ? getExamEndDateTime({ endDate: step2.endDate, endTime: step2.endTime }) : null

      if (startDt && endDt && endDt.getTime() <= startDt.getTime()) {
        throw new Error("End Date & Time must be after Start Date & Time")
      }

      const sections = [{
        name: "Questions",
        type: questions[0]?.type || "mcq",
        negativeMarking: step2.negativeMarking,
        sectionNegativeMark: step2.sectionNegativeMark,
        questionRange: `1-${questions.length}`,
        questions: questions.map(({ id: _id, ...q }) => ({
          ...q,
          correctAnswer: q.type === "fillblanks" ? (q as FillBlanksQuestion).blanks.map(b => b.answer) : (q as MCQQuestion | TrueFalseQuestion).correctAnswer ?? ""
        }))
      }]
      const payload = {
        title: step1.title,
        examType: "CUSTOM",
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
      const res = await fetch("/api/exams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (res.status === 401) {
        throw new Error("Your organization session has expired. Please sign in again from the Organization Login page.")
      }
      if (!res.ok) throw new Error(data.error || "Failed to save exam")
      router.push("/admin/exams")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save exam")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F5F6FA]">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-100 px-4 sm:px-8 py-3.5 sm:py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-400 mb-0.5 sm:mb-1">
            <Link href="/admin/exams" className="hover:text-[#10B981]">Exams</Link>
            <span>/</span>
            <span className="text-[#2D3A4A] font-medium">Create New Exam</span>
          </div>
          <h1 className="text-lg sm:text-xl font-bold text-[#2D3A4A]">Create New Exam</h1>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 self-end sm:self-auto">
          <Link href="/admin/exams" className="px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-lg border border-gray-200 text-xs sm:text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">Cancel</Link>
          <button onClick={() => handleSubmit("draft")} disabled={saving}
            className="px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-lg border border-[#2D3A4A] text-[#2D3A4A] text-xs sm:text-sm font-medium hover:bg-gray-50 disabled:opacity-60 transition-colors">
            Save Draft
          </button>
        </div>
      </div>

      {/* Stepper */}
      <div className="bg-white border-b border-gray-100 px-4 sm:px-8 py-4 sm:py-6">
        <Stepper
          step={step}
          onStepClick={(s) => {
            if (s < step) setStep(s)
            else if (s === 2 && step === 1) handleNext()
            else if (s === 3 && step === 2) handleNext()
          }}
        />
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-8">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs sm:text-sm text-red-600 flex items-center gap-2">
            <AlertCircle size={14} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {step === 1 && <Step1 form={step1} setForm={setStep1} />}
        {step === 2 && <Step2 form={step2} setForm={setStep2} canUseAiProctoring={instituteFeatures.aiProctoring} />}
        {step === 3 && (
          <Step3
            questions={questions}
            setQuestions={setQuestions}
            canUseQuestionStudio={instituteFeatures.neetJeeGenerator}
            canUsePdfImport={instituteFeatures.pdfImport}
            allowedCustomQuestionTypes={allowedCustomQuestionTypes}
          />
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between gap-3 mt-5 sm:mt-6">
          {step > 1 ? (
            <button onClick={() => setStep(s => s - 1)} className="px-4 sm:px-6 py-2 sm:py-2.5 rounded-lg border border-gray-200 text-xs sm:text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
              Back
            </button>
          ) : <div />}

          {step < 3 ? (
            <button onClick={handleNext} className="px-5 sm:px-6 py-2 sm:py-2.5 rounded-lg bg-[#2D3A4A] text-white text-xs sm:text-sm font-medium hover:bg-[#1e2a38] transition-colors">
              {step === 1 ? "Next: Settings" : "Next: Questions"}
            </button>
          ) : (
            <button onClick={() => handleSubmit("active")} disabled={saving || questions.length === 0}
              className="px-5 sm:px-6 py-2 sm:py-2.5 rounded-lg bg-[#2D3A4A] text-white text-xs sm:text-sm font-medium hover:bg-[#1e2a38] disabled:opacity-60 transition-colors">
              {saving ? "Creating..." : "Create Exam"}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
