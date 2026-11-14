"use client"

import React, { useState } from "react"
import {
  Sparkles,
  X,
  Loader2,
  Check,
  CheckCircle2,
  AlertCircle,
  List,
  CheckSquare,
  AlignLeft,
  FileText,
  Sliders,
  ArrowRight,
  BookOpen,
  HelpCircle,
  RefreshCw,
  Plus,
} from "lucide-react"
import { MathRenderer } from "@/components/exam/MathRenderer"

export type Difficulty = "easy" | "medium" | "hard"
export type QuestionType = "mcq" | "truefalse" | "descriptive" | "fillblanks" | "coding"

export interface MCQQuestion {
  id: string
  type: "mcq"
  questionText: string
  difficulty: Difficulty
  marks: number
  negativeMark?: number
  options: string[]
  correctAnswer: string
  explanation: string
}

export interface TrueFalseQuestion {
  id: string
  type: "truefalse"
  questionText: string
  difficulty: Difficulty
  marks: number
  negativeMark?: number
  correctAnswer: "True" | "False"
  explanation: string
}

export interface DescriptiveQuestion {
  id: string
  type: "descriptive"
  questionText: string
  difficulty: Difficulty
  marks: number
  negativeMark?: number
  wordLimit: string
  modelAnswer: string
  rubric: string[]
}

export interface FillBlanksQuestion {
  id: string
  type: "fillblanks"
  questionText: string
  difficulty: Difficulty
  marks: number
  negativeMark?: number
  blanks: { answer: string; alsoAccept: string[] }[]
  caseInsensitive: boolean
}

export type GeneratedQuestion =
  | MCQQuestion
  | TrueFalseQuestion
  | DescriptiveQuestion
  | FillBlanksQuestion

interface TopicExamAIGeneratorProps {
  isOpen: boolean
  onClose: () => void
  onAddQuestions: (questions: GeneratedQuestion[]) => void
  defaultSubject?: string
  defaultTitle?: string
}

const COMMON_SUBJECTS = [
  "Mathematics",
  "Physics",
  "Chemistry",
  "Biology",
  "Computer Science",
  "Science",
  "English",
  "History",
  "Geography",
  "Economics",
  "General Knowledge",
]

const QUICK_TOPICS: Record<string, string[]> = {
  Physics: ["Newton's Laws of Motion", "Thermodynamics", "Optics & Ray Diagram", "Electrostatics", "Wave Optics"],
  Chemistry: ["Periodic Table & Trends", "Chemical Bonding", "Organic Reactions", "Acids, Bases & Salts"],
  Mathematics: ["Calculus & Derivatives", "Probability & Statistics", "Matrices & Determinants", "Trigonometry"],
  Biology: ["Cell Structure & Function", "Photosynthesis", "Human Circulatory System", "Genetics & DNA"],
  "Computer Science": ["Object-Oriented Programming", "Data Structures & Arrays", "SQL & Database Queries", "Networking Basics"],
}

export function TopicExamAIGenerator({
  isOpen,
  onClose,
  onAddQuestions,
  defaultSubject = "Science",
  defaultTitle = "",
}: TopicExamAIGeneratorProps) {
  // ─── Form States ───
  const [topic, setTopic] = useState(defaultTitle || "")
  const [subject, setSubject] = useState(defaultSubject || "Science")
  const [grade, setGrade] = useState("Class 11 & 12")
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard" | "balanced">("medium")
  const [additionalPrompt, setAdditionalPrompt] = useState("")

  // ─── Blueprint Matrix: MCQ, True/False, Descriptive, Fill Blanks ───
  const [blueprint, setBlueprint] = useState({
    mcq: { enabled: true, count: 5, marks: 4 },
    truefalse: { enabled: true, count: 3, marks: 2 },
    descriptive: { enabled: true, count: 2, marks: 5 },
    fillblanks: { enabled: true, count: 3, marks: 2 },
  })

  // ─── Process States ───
  const [step, setStep] = useState<"configure" | "review">("configure")
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generatedQuestions, setGeneratedQuestions] = useState<GeneratedQuestion[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [filterType, setFilterType] = useState<string>("all")

  if (!isOpen) return null

  // Calculate totals
  const totalQuestionsToGenerate = Object.values(blueprint)
    .filter((b) => b.enabled)
    .reduce((sum, b) => sum + (b.count || 0), 0)

  const totalMarksToGenerate = Object.values(blueprint)
    .filter((b) => b.enabled)
    .reduce((sum, b) => sum + (b.count || 0) * (b.marks || 0), 0)

  // ─── Generation Handler ───
  const handleGenerate = async () => {
    if (!topic.trim()) {
      setError("Please enter a topic, chapter name, or concept.")
      return
    }
    if (totalQuestionsToGenerate <= 0) {
      setError("Please select at least 1 question type with count greater than 0.")
      return
    }

    setIsGenerating(true)
    setError(null)

    try {
      const payload = {
        topic: topic.trim(),
        subject,
        grade,
        difficulty,
        additionalPrompt: additionalPrompt.trim(),
        blueprint: {
          mcq: blueprint.mcq.enabled ? blueprint.mcq.count : 0,
          truefalse: blueprint.truefalse.enabled ? blueprint.truefalse.count : 0,
          descriptive: blueprint.descriptive.enabled ? blueprint.descriptive.count : 0,
          fillblanks: blueprint.fillblanks.enabled ? blueprint.fillblanks.count : 0,
        },
        defaultMarks: {
          mcq: blueprint.mcq.marks,
          truefalse: blueprint.truefalse.marks,
          descriptive: blueprint.descriptive.marks,
          fillblanks: blueprint.fillblanks.marks,
        },
      }

      const res = await fetch("/api/admin/generate-exam-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate questions. Please retry.")
      }

      if (!data.questions || data.questions.length === 0) {
        throw new Error("No questions returned. Please check the topic and try again.")
      }

      setGeneratedQuestions(data.questions)
      setSelectedIds(new Set(data.questions.map((q: GeneratedQuestion) => q.id)))
      setStep("review")
    } catch (err: any) {
      console.error("AI Generation Error:", err)
      setError(err?.message || "Failed to generate questions. Please check your internet or try again.")
    } finally {
      setIsGenerating(false)
    }
  }

  // ─── Add to Exam Handler ───
  const handleAddSelected = () => {
    const toAdd = generatedQuestions.filter((q) => selectedIds.has(q.id))
    if (toAdd.length === 0) {
      setError("Please select at least one question to add.")
      return
    }
    onAddQuestions(toAdd)
    onClose()
  }

  // Filtered in review
  const filteredQuestions =
    filterType === "all"
      ? generatedQuestions
      : generatedQuestions.filter((q) => q.type === filterType)

  const toggleSelectAll = () => {
    if (selectedIds.size === generatedQuestions.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(generatedQuestions.map((q) => q.id)))
    }
  }

  const toggleSelectQuestion = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="relative w-full max-w-3xl bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* ─── Modal Header ─── */}
        <div className="px-5 sm:px-6 py-4 bg-gradient-to-r from-[#202c3b] to-[#172230] text-white flex items-center justify-between border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-sm">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold tracking-tight text-white flex items-center gap-2">
                <span>AI Question Generator</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider bg-purple-500/30 text-purple-200 border border-purple-400/30 px-2 py-0.5 rounded-full">
                  Fast AI
                </span>
              </h2>
              <p className="text-xs text-slate-300">
                Generate MCQs, True/False, Descriptive &amp; Fill in the Blanks on any topic
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/60 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ─── Body ─── */}
        <div className="p-5 sm:p-6 max-h-[78vh] overflow-y-auto custom-scrollbar">
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1">{error}</div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              VIEW 1: CONFIGURATION FORM
              ═══════════════════════════════════════════════════════════════ */}
          {step === "configure" && !isGenerating && (
            <div className="space-y-5">
              {/* Topic Input */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Topic / Chapter / Concept Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. Laws of Motion, Photosynthesis, Python Functions, French Revolution..."
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D3A4A]/20 focus:border-[#2D3A4A] transition-all"
                  autoFocus
                />

                {/* Quick Topic Pills */}
                {QUICK_TOPICS[subject] && (
                  <div className="flex items-center gap-1.5 flex-wrap mt-2">
                    <span className="text-[11px] font-medium text-slate-400">Suggestions:</span>
                    {QUICK_TOPICS[subject].map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTopic(t)}
                        className="text-[11px] px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors cursor-pointer"
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Subject, Grade, Difficulty Row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Subject */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Subject</label>
                  <select
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-800 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#2D3A4A]/20 focus:border-[#2D3A4A] cursor-pointer"
                  >
                    {COMMON_SUBJECTS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Grade / Level */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Grade Level</label>
                  <select
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-800 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#2D3A4A]/20 focus:border-[#2D3A4A] cursor-pointer"
                  >
                    <option value="Class 8-10">Class 8th - 10th (Secondary)</option>
                    <option value="Class 11 & 12">Class 11th - 12th (Higher Sec)</option>
                    <option value="Undergraduate">College / University</option>
                    <option value="Competitive Exam">Competitive Mock Standard</option>
                  </select>
                </div>

                {/* Difficulty */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Difficulty</label>
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-800 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#2D3A4A]/20 focus:border-[#2D3A4A] cursor-pointer"
                  >
                    <option value="easy">Easy (Fundamentals)</option>
                    <option value="medium">Medium (Standard)</option>
                    <option value="hard">Hard (Advanced / Complex)</option>
                    <option value="balanced">Balanced Mix</option>
                  </select>
                </div>
              </div>

              {/* ─── Question Formats Blueprint ─── */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Question Types &amp; Counts
                  </label>
                  <span className="text-xs text-slate-500 font-medium">
                    Total: <strong className="text-slate-900">{totalQuestionsToGenerate} Questions</strong> ·{" "}
                    <strong className="text-slate-900">{totalMarksToGenerate} Marks</strong>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* 1. MCQ */}
                  <div
                    className={`p-3 rounded-xl border transition-all ${
                      blueprint.mcq.enabled
                        ? "bg-blue-50/50 border-blue-200 ring-1 ring-blue-500/10"
                        : "bg-slate-50 border-slate-200 opacity-60"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={blueprint.mcq.enabled}
                          onChange={(e) =>
                            setBlueprint((prev) => ({
                              ...prev,
                              mcq: { ...prev.mcq, enabled: e.target.checked },
                            }))
                          }
                          className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                        />
                        <div className="flex items-center gap-1.5">
                          <span className="p-1 rounded bg-blue-100 text-blue-700">
                            <List size={13} />
                          </span>
                          <span className="text-xs font-bold text-slate-800">Multiple Choice (MCQ)</span>
                        </div>
                      </label>

                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-slate-500">Qty:</span>
                          <input
                            type="number"
                            min={1}
                            max={30}
                            value={blueprint.mcq.count}
                            disabled={!blueprint.mcq.enabled}
                            onChange={(e) =>
                              setBlueprint((prev) => ({
                                ...prev,
                                mcq: { ...prev.mcq, count: Math.max(1, parseInt(e.target.value) || 1) },
                              }))
                            }
                            className="w-12 px-1.5 py-0.5 text-xs text-center border border-slate-300 rounded-md bg-white font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-slate-500">Marks:</span>
                          <input
                            type="number"
                            min={1}
                            max={20}
                            value={blueprint.mcq.marks}
                            disabled={!blueprint.mcq.enabled}
                            onChange={(e) =>
                              setBlueprint((prev) => ({
                                ...prev,
                                mcq: { ...prev.mcq, marks: Math.max(1, parseInt(e.target.value) || 1) },
                              }))
                            }
                            className="w-11 px-1 py-0.5 text-xs text-center border border-slate-300 rounded-md bg-white font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 2. True / False */}
                  <div
                    className={`p-3 rounded-xl border transition-all ${
                      blueprint.truefalse.enabled
                        ? "bg-teal-50/50 border-teal-200 ring-1 ring-teal-500/10"
                        : "bg-slate-50 border-slate-200 opacity-60"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={blueprint.truefalse.enabled}
                          onChange={(e) =>
                            setBlueprint((prev) => ({
                              ...prev,
                              truefalse: { ...prev.truefalse, enabled: e.target.checked },
                            }))
                          }
                          className="rounded text-teal-600 focus:ring-teal-500 w-4 h-4 cursor-pointer"
                        />
                        <div className="flex items-center gap-1.5">
                          <span className="p-1 rounded bg-teal-100 text-teal-700">
                            <CheckSquare size={13} />
                          </span>
                          <span className="text-xs font-bold text-slate-800">True / False</span>
                        </div>
                      </label>

                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-slate-500">Qty:</span>
                          <input
                            type="number"
                            min={1}
                            max={30}
                            value={blueprint.truefalse.count}
                            disabled={!blueprint.truefalse.enabled}
                            onChange={(e) =>
                              setBlueprint((prev) => ({
                                ...prev,
                                truefalse: { ...prev.truefalse, count: Math.max(1, parseInt(e.target.value) || 1) },
                              }))
                            }
                            className="w-12 px-1.5 py-0.5 text-xs text-center border border-slate-300 rounded-md bg-white font-semibold focus:outline-none focus:ring-1 focus:ring-teal-500"
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-slate-500">Marks:</span>
                          <input
                            type="number"
                            min={1}
                            max={20}
                            value={blueprint.truefalse.marks}
                            disabled={!blueprint.truefalse.enabled}
                            onChange={(e) =>
                              setBlueprint((prev) => ({
                                ...prev,
                                truefalse: { ...prev.truefalse, marks: Math.max(1, parseInt(e.target.value) || 1) },
                              }))
                            }
                            className="w-11 px-1 py-0.5 text-xs text-center border border-slate-300 rounded-md bg-white font-semibold focus:outline-none focus:ring-1 focus:ring-teal-500"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 3. Descriptive */}
                  <div
                    className={`p-3 rounded-xl border transition-all ${
                      blueprint.descriptive.enabled
                        ? "bg-purple-50/50 border-purple-200 ring-1 ring-purple-500/10"
                        : "bg-slate-50 border-slate-200 opacity-60"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={blueprint.descriptive.enabled}
                          onChange={(e) =>
                            setBlueprint((prev) => ({
                              ...prev,
                              descriptive: { ...prev.descriptive, enabled: e.target.checked },
                            }))
                          }
                          className="rounded text-purple-600 focus:ring-purple-500 w-4 h-4 cursor-pointer"
                        />
                        <div className="flex items-center gap-1.5">
                          <span className="p-1 rounded bg-purple-100 text-purple-700">
                            <AlignLeft size={13} />
                          </span>
                          <span className="text-xs font-bold text-slate-800">Descriptive</span>
                        </div>
                      </label>

                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-slate-500">Qty:</span>
                          <input
                            type="number"
                            min={1}
                            max={30}
                            value={blueprint.descriptive.count}
                            disabled={!blueprint.descriptive.enabled}
                            onChange={(e) =>
                              setBlueprint((prev) => ({
                                ...prev,
                                descriptive: { ...prev.descriptive, count: Math.max(1, parseInt(e.target.value) || 1) },
                              }))
                            }
                            className="w-12 px-1.5 py-0.5 text-xs text-center border border-slate-300 rounded-md bg-white font-semibold focus:outline-none focus:ring-1 focus:ring-purple-500"
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-slate-500">Marks:</span>
                          <input
                            type="number"
                            min={1}
                            max={20}
                            value={blueprint.descriptive.marks}
                            disabled={!blueprint.descriptive.enabled}
                            onChange={(e) =>
                              setBlueprint((prev) => ({
                                ...prev,
                                descriptive: { ...prev.descriptive, marks: Math.max(1, parseInt(e.target.value) || 1) },
                              }))
                            }
                            className="w-11 px-1 py-0.5 text-xs text-center border border-slate-300 rounded-md bg-white font-semibold focus:outline-none focus:ring-1 focus:ring-purple-500"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 4. Fill in the Blanks */}
                  <div
                    className={`p-3 rounded-xl border transition-all ${
                      blueprint.fillblanks.enabled
                        ? "bg-amber-50/50 border-amber-200 ring-1 ring-amber-500/10"
                        : "bg-slate-50 border-slate-200 opacity-60"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={blueprint.fillblanks.enabled}
                          onChange={(e) =>
                            setBlueprint((prev) => ({
                              ...prev,
                              fillblanks: { ...prev.fillblanks, enabled: e.target.checked },
                            }))
                          }
                          className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer"
                        />
                        <div className="flex items-center gap-1.5">
                          <span className="p-1 rounded bg-amber-100 text-amber-700">
                            <FileText size={13} />
                          </span>
                          <span className="text-xs font-bold text-slate-800">Fill in the Blanks</span>
                        </div>
                      </label>

                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-slate-500">Qty:</span>
                          <input
                            type="number"
                            min={1}
                            max={30}
                            value={blueprint.fillblanks.count}
                            disabled={!blueprint.fillblanks.enabled}
                            onChange={(e) =>
                              setBlueprint((prev) => ({
                                ...prev,
                                fillblanks: { ...prev.fillblanks, count: Math.max(1, parseInt(e.target.value) || 1) },
                              }))
                            }
                            className="w-12 px-1.5 py-0.5 text-xs text-center border border-slate-300 rounded-md bg-white font-semibold focus:outline-none focus:ring-1 focus:ring-amber-500"
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-slate-500">Marks:</span>
                          <input
                            type="number"
                            min={1}
                            max={20}
                            value={blueprint.fillblanks.marks}
                            disabled={!blueprint.fillblanks.enabled}
                            onChange={(e) =>
                              setBlueprint((prev) => ({
                                ...prev,
                                fillblanks: { ...prev.fillblanks, marks: Math.max(1, parseInt(e.target.value) || 1) },
                              }))
                            }
                            className="w-11 px-1 py-0.5 text-xs text-center border border-slate-300 rounded-md bg-white font-semibold focus:outline-none focus:ring-1 focus:ring-amber-500"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Optional Additional Instructions */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Specific Instructions / Focus (Optional)
                </label>
                <input
                  type="text"
                  value={additionalPrompt}
                  onChange={(e) => setAdditionalPrompt(e.target.value)}
                  placeholder="e.g. Focus on practical real-life examples, formulas, and recent syllabus updates..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-[#2D3A4A]/20"
                />
              </div>

              {/* Action Button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={totalQuestionsToGenerate <= 0 || !topic.trim()}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>Generate {totalQuestionsToGenerate} Questions with AI</span>
                </button>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              VIEW 2: LOADING STATE
              ═══════════════════════════════════════════════════════════════ */}
          {isGenerating && (
            <div className="py-16 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white flex items-center justify-center mx-auto shadow-lg animate-pulse">
                <Sparkles className="w-7 h-7 text-amber-300 animate-spin" style={{ animationDuration: "3s" }} />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-800">
                  Generating Questions for &ldquo;{topic}&rdquo;...
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Authoring MCQs, True/False statements, descriptive models, and LaTeX formulas.
                </p>
              </div>
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-100 text-slate-600 text-xs font-medium">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Multi-Key AI Engine Running</span>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              VIEW 3: REVIEW & SELECTION SCREEN
              ═══════════════════════════════════════════════════════════════ */}
          {step === "review" && !isGenerating && (
            <div className="space-y-4">
              {/* Review Bar Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-200">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{generatedQuestions.length} Questions Generated</span>
                  </span>
                  <span className="text-xs text-slate-500">
                    {selectedIds.size} of {generatedQuestions.length} selected
                  </span>
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                    Total Marks:{" "}
                    {generatedQuestions
                      .filter((q) => selectedIds.has(q.id))
                      .reduce((acc, q) => acc + (q.marks || 0), 0)}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors cursor-pointer"
                  >
                    {selectedIds.size === generatedQuestions.length ? "Deselect All" : "Select All"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep("configure")}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <Sliders size={13} />
                    <span>Tweak</span>
                  </button>
                </div>
              </div>

              {/* Format Filter Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                {["all", "mcq", "truefalse", "descriptive", "fillblanks"].map((t) => {
                  const count =
                    t === "all"
                      ? generatedQuestions.length
                      : generatedQuestions.filter((q) => q.type === t).length
                  if (t !== "all" && count === 0) return null
                  const label =
                    t === "all"
                      ? `All (${count})`
                      : t === "mcq"
                      ? `MCQ (${count})`
                      : t === "truefalse"
                      ? `True/False (${count})`
                      : t === "descriptive"
                      ? `Descriptive (${count})`
                      : `Fill Blanks (${count})`

                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setFilterType(t)}
                      className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                        filterType === t
                          ? "bg-[#2D3A4A] text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>

              {/* Questions List */}
              <div className="space-y-3">
                {filteredQuestions.map((q, idx) => {
                  const isSelected = selectedIds.has(q.id)
                  const typeBadge =
                    q.type === "mcq"
                      ? { label: "MCQ", color: "bg-blue-100 text-blue-800" }
                      : q.type === "truefalse"
                      ? { label: "True / False", color: "bg-teal-100 text-teal-800" }
                      : q.type === "descriptive"
                      ? { label: "Descriptive", color: "bg-purple-100 text-purple-800" }
                      : { label: "Fill Blanks", color: "bg-amber-100 text-amber-800" }

                  return (
                    <div
                      key={q.id || idx}
                      className={`p-3.5 rounded-xl border transition-all ${
                        isSelected
                          ? "bg-white border-slate-300 shadow-2xs ring-1 ring-slate-900/5"
                          : "bg-slate-50/60 border-slate-200 opacity-60"
                      }`}
                    >
                      {/* Top Header of Question */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectQuestion(q.id)}
                            className="rounded text-[#2D3A4A] focus:ring-[#2D3A4A] w-4 h-4 cursor-pointer"
                          />
                          <span className="w-5 h-5 rounded-md bg-[#2D3A4A] text-white text-[11px] font-bold flex items-center justify-center">
                            {idx + 1}
                          </span>
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${typeBadge.color}`}>
                            {typeBadge.label}
                          </span>
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                            {q.difficulty}
                          </span>
                        </div>

                        <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                          +{q.marks} marks
                        </span>
                      </div>

                      {/* Question Text */}
                      <div className="text-xs sm:text-sm text-slate-900 leading-relaxed pl-6 mb-2">
                        <MathRenderer content={q.questionText} />
                      </div>

                      {/* Format-Specific details */}
                      <div className="pl-6 text-xs">
                        {/* MCQ Options */}
                        {q.type === "mcq" && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-2">
                            {q.options.map((opt, oi) => {
                              const isCorrect = opt === q.correctAnswer
                              return (
                                <div
                                  key={oi}
                                  className={`p-2 rounded-lg border flex items-center gap-2 ${
                                    isCorrect
                                      ? "bg-emerald-50 border-emerald-400 text-emerald-900 font-medium"
                                      : "bg-slate-50 border-slate-200 text-slate-700"
                                  }`}
                                >
                                  <span
                                    className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold ${
                                      isCorrect
                                        ? "bg-emerald-600 text-white"
                                        : "bg-white border border-slate-300 text-slate-600"
                                    }`}
                                  >
                                    {isCorrect ? "✓" : ["A", "B", "C", "D"][oi]}
                                  </span>
                                  <div className="flex-1 text-[11px]">
                                    <MathRenderer content={opt} />
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}

                        {/* True/False */}
                        {q.type === "truefalse" && (
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-slate-500">Correct Answer:</span>
                            <span className="px-2.5 py-0.5 rounded-md bg-teal-100 text-teal-800 font-bold text-[11px]">
                              {q.correctAnswer}
                            </span>
                            {q.explanation && (
                              <span className="text-slate-500 text-[11px] truncate" title={q.explanation}>
                                · {q.explanation}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Descriptive */}
                        {q.type === "descriptive" && (
                          <div className="mt-1.5 p-2 rounded-lg bg-purple-50/50 border border-purple-200 space-y-1">
                            <div className="flex items-center gap-2 text-purple-900 font-semibold text-[11px]">
                              <span>Word Limit: {q.wordLimit}</span>
                            </div>
                            {q.modelAnswer && (
                              <div className="text-[11px] text-slate-700 leading-snug">
                                <strong>Model Answer:</strong> {q.modelAnswer}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Fill Blanks */}
                        {q.type === "fillblanks" && (
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-slate-500">Correct Answer:</span>
                            <span className="px-2.5 py-0.5 rounded-md bg-amber-100 text-amber-900 font-bold text-[11px]">
                              {q.blanks?.[0]?.answer || "N/A"}
                            </span>
                            {q.blanks?.[0]?.alsoAccept?.length > 0 && (
                              <span className="text-slate-400 text-[10px]">
                                (Also accepts: {q.blanks[0].alsoAccept.join(", ")})
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Bottom Sticky Action Bar */}
              <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2.5">
                <button
                  type="button"
                  onClick={() => setStep("configure")}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw size={13} />
                  <span>Generate More on Another Topic</span>
                </button>

                <button
                  type="button"
                  onClick={handleAddSelected}
                  disabled={selectedIds.size === 0}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#2D3A4A] hover:bg-[#1E293B] text-white font-bold text-xs sm:text-sm shadow-sm hover:shadow flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Check size={16} />
                  <span>Add {selectedIds.size} Questions to Exam</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

