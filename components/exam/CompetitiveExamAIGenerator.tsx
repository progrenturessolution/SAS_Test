"use client"

import { useState, useMemo, useRef, KeyboardEvent } from "react"
import {
  BookOpen,
  GraduationCap,
  Layers,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  Plus,
  Trash2,
  Edit3,
  Sliders,
  Check,
  Zap,
  Target,
  ShieldCheck,
  Tag,
  Upload,
  FileText,
  FileCheck2,
  RefreshCw,
  ChevronUp,
  ChevronDown,
  Search,
} from "lucide-react"
import {
  EXAM_TARGETS,
  ExamTarget,
  GradeLevel,
  CompetitiveSubject,
  getChapters,
  Chapter,
} from "@/lib/curriculumData"
import { MathRenderer } from "./MathRenderer"

export interface GeneratedCompetitiveQuestion {
  id: string
  type: "mcq"
  questionText: string
  difficulty: "easy" | "medium" | "hard"
  marks: number
  negativeMark: number
  options: string[]
  correctAnswer: string
  explanation: string
  chapter: string
  pyqReference?: string
}

interface CompetitiveExamAIGeneratorProps {
  isOpen: boolean
  onClose: () => void
  onAddQuestions: (questions: GeneratedCompetitiveQuestion[]) => void
}

export function CompetitiveExamAIGenerator({
  isOpen,
  onClose,
  onAddQuestions,
}: CompetitiveExamAIGeneratorProps) {
  // ─── Filter & Config States ───
  const [selectedExam, setSelectedExam] = useState<ExamTarget>("NEET")
  const [selectedGrade, setSelectedGrade] = useState<GradeLevel | "both">("12")
  const [selectedSubject, setSelectedSubject] = useState<CompetitiveSubject>("Physics")
  
  // Custom Chapters & Topics
  const [selectedChapters, setSelectedChapters] = useState<string[]>([])
  const [manualChapterInput, setManualChapterInput] = useState("")
  const [chapterSearch, setChapterSearch] = useState("")
  
  const [selectedTopics, setSelectedTopics] = useState<string[]>([])
  const [manualTopicInput, setManualTopicInput] = useState("")

  // PDF Syllabus Import
  const [uploadedPdf, setUploadedPdf] = useState<{
    name: string
    size: number
    wordCount: number
  } | null>(null)
  const [uploadedSyllabusText, setUploadedSyllabusText] = useState("")
  const [isUploadingPdf, setIsUploadingPdf] = useState(false)
  const [pdfError, setPdfError] = useState<string | null>(null)
  const pdfInputRef = useRef<HTMLInputElement>(null)

  const [customInstructions, setCustomInstructions] = useState("")
  const [focusPYQ, setFocusPYQ] = useState(true)

  // Blueprint settings
  const [questionCount, setQuestionCount] = useState<number>(5)
  const [difficulty, setDifficulty] = useState<"balanced" | "easy" | "medium" | "hard">("balanced")
  const [pattern, setPattern] = useState<"mcq_single" | "assertion_reason" | "mixed">("mcq_single")

  // ─── Generation & Review States ───
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationStep, setGenerationStep] = useState(0)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [generatedList, setGeneratedList] = useState<GeneratedCompetitiveQuestion[]>([])
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<Set<string>>(new Set())
  const [expandedSolutions, setExpandedSolutions] = useState<Set<string>>(new Set())

  // Inline edit state
  const [editingQuestion, setEditingQuestion] = useState<GeneratedCompetitiveQuestion | null>(null)

  // Current Exam Metadata
  const currentExamMeta = useMemo(() => {
    return EXAM_TARGETS.find((e) => e.id === selectedExam) || EXAM_TARGETS[0]
  }, [selectedExam])

  // Available subjects for this exam
  const availableSubjects = useMemo(() => {
    return currentExamMeta.subjects
  }, [currentExamMeta])

  // Official curriculum chapters from database
  const availableChapters = useMemo(() => {
    return getChapters(selectedExam, selectedGrade, selectedSubject)
  }, [selectedExam, selectedGrade, selectedSubject])

  // Filtered chapters matching search query
  const filteredChapters = useMemo(() => {
    if (!chapterSearch.trim()) return availableChapters
    const q = chapterSearch.toLowerCase().trim()
    return availableChapters.filter(
      (ch) =>
        ch.name.toLowerCase().includes(q) ||
        ch.subtopics?.some((sub) => sub.toLowerCase().includes(q))
    )
  }, [availableChapters, chapterSearch])

  const toggleChapter = (chapterName: string) => {
    setSelectedChapters((prev) =>
      prev.includes(chapterName)
        ? prev.filter((c) => c !== chapterName)
        : [...prev, chapterName]
    )
  }

  const handleSelectAllChapters = () => {
    const names = filteredChapters.map((ch) => ch.name)
    setSelectedChapters((prev) => Array.from(new Set([...prev, ...names])))
  }

  const handleDeselectAllChapters = () => {
    setSelectedChapters([])
  }

  // Automatically switch subject if not available in selected exam
  const handleExamChange = (exam: ExamTarget) => {
    setSelectedExam(exam)
    const targetMeta = EXAM_TARGETS.find((e) => e.id === exam)
    if (targetMeta && !targetMeta.subjects.includes(selectedSubject)) {
      setSelectedSubject(targetMeta.subjects[0])
    }
    setSelectedChapters([])
    setChapterSearch("")
  }

  const handleGradeChange = (grade: GradeLevel | "both") => {
    setSelectedGrade(grade)
    setSelectedChapters([])
    setChapterSearch("")
  }

  const handleSubjectChange = (subject: CompetitiveSubject) => {
    setSelectedSubject(subject)
    setSelectedChapters([])
    setChapterSearch("")
  }

  // ─── Manual Chapter Management ───
  const handleAddManualChapter = () => {
    if (!manualChapterInput.trim()) return
    const splitted = manualChapterInput
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean)

    if (splitted.length === 0) return
    setSelectedChapters((prev) => Array.from(new Set([...prev, ...splitted])))
    setManualChapterInput("")
  }

  const handleManualChapterKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault()
      handleAddManualChapter()
    }
  }

  const handleRemoveChapter = (chapterToRemove: string) => {
    setSelectedChapters((prev) => prev.filter((c) => c !== chapterToRemove))
  }

  // ─── Manual Topics Management ───
  const handleAddManualTopic = () => {
    if (!manualTopicInput.trim()) return
    const splitted = manualTopicInput
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean)

    if (splitted.length === 0) return
    setSelectedTopics((prev) => Array.from(new Set([...prev, ...splitted])))
    setManualTopicInput("")
  }

  const handleManualTopicKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault()
      handleAddManualTopic()
    }
  }

  const handleRemoveTopic = (topicToRemove: string) => {
    setSelectedTopics((prev) => prev.filter((t) => t !== topicToRemove))
  }

  // ─── Syllabus PDF Upload & Parse ───
  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setPdfError("Please upload a valid PDF file.")
      return
    }

    setIsUploadingPdf(true)
    setPdfError(null)

    try {
      const formData = new FormData()
      formData.append("file", file)

      const res = await fetch("/api/admin/parse-syllabus-pdf", {
        method: "POST",
        credentials: "include",
        body: formData,
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to extract syllabus from PDF")
      }

      setUploadedPdf({
        name: data.fileName,
        size: data.fileSize,
        wordCount: data.wordCount,
      })
      setUploadedSyllabusText(data.extractedText || "")

      // If PDF had detected chapters/topics, auto-fill them!
      if (Array.isArray(data.detectedChapters) && data.detectedChapters.length > 0) {
        setSelectedChapters((prev) => Array.from(new Set([...prev, ...data.detectedChapters])))
      }
      if (Array.isArray(data.detectedTopics) && data.detectedTopics.length > 0) {
        setSelectedTopics((prev) => Array.from(new Set([...prev, ...data.detectedTopics])))
      }
    } catch (err: any) {
      setPdfError(err?.message || "Failed to read PDF file.")
    } finally {
      setIsUploadingPdf(false)
      if (pdfInputRef.current) pdfInputRef.current.value = ""
    }
  }

  const handleRemovePdf = () => {
    setUploadedPdf(null)
    setUploadedSyllabusText("")
    setPdfError(null)
  }

  const clearAllInputs = () => {
    setSelectedChapters([])
    setSelectedTopics([])
    handleRemovePdf()
  }

  // ─── Generate Questions via API ───
  const handleGenerate = async () => {
    if (selectedChapters.length === 0 && selectedTopics.length === 0 && !uploadedSyllabusText) {
      setErrorMsg("Please add at least one chapter, topic, or upload a syllabus PDF.")
      return
    }

    setErrorMsg(null)
    setIsGenerating(true)
    setGenerationStep(1)

    const timer1 = setTimeout(() => setGenerationStep(2), 2000)
    const timer2 = setTimeout(() => setGenerationStep(3), 5000)

    try {
      const existingQuestionTexts = generatedList.map((q) => q.questionText)

      const res = await fetch("/api/admin/generate-competitive-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          exam: selectedExam,
          grade: selectedGrade,
          subject: selectedSubject,
          chapters: selectedChapters,
          topics: selectedTopics,
          syllabusText: uploadedSyllabusText,
          difficulty,
          questionCount,
          questionPattern: pattern,
          marksPerQuestion: currentExamMeta.defaultMarksPerQuestion,
          negativeMarks: currentExamMeta.defaultNegativeMarks,
          focusPYQ,
          existingQuestions: existingQuestionTexts,
        }),
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to generate exam questions")
      }

      setGeneratedList(data.questions)
      // Auto-select all generated questions
      setSelectedQuestionIds(new Set(data.questions.map((q: GeneratedCompetitiveQuestion) => q.id)))
    } catch (err: any) {
      setErrorMsg(err?.message || "An unexpected error occurred while generating.")
    } finally {
      clearTimeout(timer1)
      clearTimeout(timer2)
      setIsGenerating(false)
      setGenerationStep(0)
    }
  }

  // Toggle solution drawer
  const toggleSolution = (id: string) => {
    setExpandedSolutions((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Toggle selection for adding to exam
  const toggleQuestionSelection = (id: string) => {
    setSelectedQuestionIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Delete question from preview
  const handleDeleteQuestion = (id: string) => {
    setGeneratedList((prev) => prev.filter((q) => q.id !== id))
    setSelectedQuestionIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  // Save inline edit
  const handleSaveEdit = (updated: GeneratedCompetitiveQuestion) => {
    setGeneratedList((prev) => prev.map((q) => (q.id === updated.id ? updated : q)))
    setEditingQuestion(null)
  }

  // Final Action: Add selected questions to Exam Paper
  const handleAddToExam = () => {
    const toAdd = generatedList.filter((q) => selectedQuestionIds.has(q.id))
    if (toAdd.length === 0) {
      setErrorMsg("Please select at least one question to add.")
      return
    }
    onAddQuestions(toAdd)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl max-h-[92vh] flex flex-col bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
        {/* ─── Header ─── */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-gray-100 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gray-100 text-[#2D3A4A] flex items-center justify-center shrink-0">
              <GraduationCap className="w-5 h-5 text-[#2D3A4A]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-[#45505F]">
                  NEET / JEE / MHT-CET
                </h2>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-gray-100 text-[#45505F] border border-gray-200">
                  Question Studio
                </span>
              </div>
              <p className="text-xs text-gray-500">
                Generate entrance exam questions from custom chapters, topics, or uploaded PDF syllabus
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* ─── Main Body ─── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
              <button
                onClick={() => setErrorMsg(null)}
                className="text-red-500 hover:text-red-700 font-bold"
              >
                ✕
              </button>
            </div>
          )}

          {/* If no questions generated yet, show Configuration Wizard */}
          {generatedList.length === 0 ? (
            <div className="space-y-6">
              {/* Section 1: Target Exam Selection */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-[#45505F] block mb-2.5">
                  1. Select Target Competitive Exam
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  {EXAM_TARGETS.map((exam) => {
                    const isSelected = selectedExam === exam.id
                    return (
                      <button
                        key={exam.id}
                        type="button"
                        onClick={() => handleExamChange(exam.id)}
                        className={`text-left p-3.5 rounded-xl border transition-all relative overflow-hidden cursor-pointer ${
                          isSelected
                            ? "border-2 border-[#2D3A4A] bg-[#2D3A4A]/5 text-[#2D3A4A] shadow-xs"
                            : "border border-gray-200 hover:border-gray-300 bg-white"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                            isSelected ? "bg-[#2D3A4A] text-white" : "bg-gray-100 text-gray-700"
                          }`}>
                            {exam.badge}
                          </span>
                          {isSelected && (
                            <CheckCircle2 className="w-4 h-4 text-[#2D3A4A] shrink-0" />
                          )}
                        </div>
                        <h3 className="font-bold text-sm text-[#45505F] leading-tight">
                          {exam.title}
                        </h3>
                        <p className="text-[11px] text-gray-500 mt-1 line-clamp-1">
                          {exam.subtitle}
                        </p>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Section 2: Class & Subject Filters */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-gray-50/70 border border-gray-100">
                {/* Grade / Class */}
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-[#45505F] block mb-2">
                    2. Select Class / Standard
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: "11", label: "Class 11" },
                      { id: "12", label: "Class 12" },
                      { id: "both", label: "11 + 12 (Full)" },
                    ].map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => handleGradeChange(g.id as GradeLevel | "both")}
                        className={`py-2 px-3 rounded-lg text-xs font-semibold text-center transition-all cursor-pointer ${
                          selectedGrade === g.id
                            ? "bg-[#2D3A4A] text-white shadow-xs"
                            : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        {g.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Subject */}
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-[#45505F] block mb-2">
                    3. Select Subject
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {availableSubjects.map((sub) => (
                      <button
                        key={sub}
                        type="button"
                        onClick={() => handleSubjectChange(sub)}
                        className={`py-2 px-4 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          selectedSubject === sub
                            ? "bg-[#2D3A4A] text-white shadow-xs"
                            : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        {sub}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Section 3: Add Chapters, Add Topics & Import Syllabus PDF */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-[#45505F] block">
                      4. Chapters, Topics & Syllabus Definition
                    </label>
                    <p className="text-xs text-gray-500">
                      Add chapters manually, pinpoint specific topics, or upload your syllabus/notes PDF.
                    </p>
                  </div>

                  {(selectedChapters.length > 0 || selectedTopics.length > 0 || uploadedPdf) && (
                    <button
                      type="button"
                      onClick={clearAllInputs}
                      className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-red-50 text-red-600 hover:bg-red-100 border border-red-100 cursor-pointer"
                    >
                      Clear All
                    </button>
                  )}
                </div>

                {/* Grid of Chapter Input and Topic Input */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Card 1: Official Chapters Selection */}
                  <div className="p-4 rounded-xl border border-gray-200 bg-white space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-[#45505F] flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-[#45505F]" />
                        <span>Curriculum Chapters</span>
                        </span>
                        <span className="mt-1 block text-[10px] font-semibold text-emerald-700">
                          {currentExamMeta.title} {currentExamMeta.syllabusYear} · {selectedSubject} · Class {selectedGrade === "both" ? "11 & 12" : selectedGrade}
                        </span>
                        <a
                          href={currentExamMeta.officialSyllabusUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 inline-block text-[10px] font-semibold text-[#2D3A4A] underline-offset-2 hover:underline"
                        >
                          Official syllabus source
                        </a>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold text-gray-500">
                          {selectedChapters.length} selected
                        </span>
                        <button
                          type="button"
                          onClick={handleSelectAllChapters}
                          className="text-[10px] font-bold text-[#2D3A4A] hover:underline"
                        >
                          Select All
                        </button>
                        {selectedChapters.length > 0 && (
                          <button
                            type="button"
                            onClick={handleDeselectAllChapters}
                            className="text-[10px] font-bold text-red-600 hover:underline"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Chapter Search Filter */}
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Search chapters (e.g. Thermodynamics, Optics)..."
                        value={chapterSearch}
                        onChange={(e) => setChapterSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-gray-200 bg-gray-50/50 text-gray-800 focus:outline-none focus:border-[#2D3A4A]"
                      />
                    </div>

                    {/* Official Click-to-Select Chapter Chips */}
                    <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pt-1">
                      {filteredChapters.map((ch) => {
                        const isSelected = selectedChapters.includes(ch.name)
                        return (
                          <button
                            key={ch.id}
                            type="button"
                            onClick={() => toggleChapter(ch.name)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium text-left transition-all flex items-center gap-1.5 cursor-pointer ${
                              isSelected
                                ? "bg-[#2D3A4A] text-white shadow-xs"
                                : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                            }`}
                          >
                            <span>{isSelected ? "✓" : "+"}</span>
                            <span>{String(filteredChapters.indexOf(ch) + 1).padStart(2, "0")}. {ch.name}</span>
                            <span className={`text-[9px] px-1 rounded ${isSelected ? "bg-white/20 text-white" : "bg-gray-200 text-gray-600"}`}>
                              {ch.grade}th
                            </span>
                          </button>
                        )
                      })}
                    </div>

                    {/* Custom chapter write-in fallback */}
                    <div className="pt-2 border-t border-gray-100 flex gap-2">
                      <input
                        type="text"
                        placeholder="Or type custom chapter name..."
                        value={manualChapterInput}
                        onChange={(e) => setManualChapterInput(e.target.value)}
                        onKeyDown={handleManualChapterKeyDown}
                        className="flex-1 px-2.5 py-1 text-xs rounded-lg border border-gray-200 bg-white text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-[#2D3A4A]"
                      />
                      <button
                        type="button"
                        onClick={handleAddManualChapter}
                        disabled={!manualChapterInput.trim()}
                        className="px-2.5 py-1 rounded-lg bg-[#2D3A4A] text-white text-xs font-medium disabled:opacity-50 cursor-pointer"
                      >
                        Add
                      </button>
                    </div>
                  </div>

                  {/* Card 2: Add Topics / Specific Concepts */}
                  <div className="p-4 rounded-xl border border-gray-200 bg-white space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#45505F] flex items-center gap-1.5">
                        <Target className="w-3.5 h-3.5 text-[#45505F]" />
                        <span>Add Topic(s) / Specific Concepts</span>
                      </span>
                      <span className="text-[11px] font-semibold text-gray-500">
                        {selectedTopics.length} added
                      </span>
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="e.g. Carnot Cycle, Projectile on Incline, SN1 vs SN2 (Press Enter)..."
                        value={manualTopicInput}
                        onChange={(e) => setManualTopicInput(e.target.value)}
                        onKeyDown={handleManualTopicKeyDown}
                        className="flex-1 px-3 py-2 text-xs rounded-lg border border-gray-200 bg-white text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2D3A4A]/20 focus:border-[#2D3A4A]"
                      />
                      <button
                        type="button"
                        onClick={handleAddManualTopic}
                        disabled={!manualTopicInput.trim()}
                        className="px-3.5 py-2 rounded-lg bg-[#45505F] hover:bg-[#1e2a38] text-white text-xs font-medium flex items-center gap-1 disabled:opacity-50 transition-all cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add</span>
                      </button>
                    </div>

                    {/* Topic Tags */}
                    {selectedTopics.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pt-1">
                        {selectedTopics.map((topic) => (
                          <span
                            key={topic}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-[#45505F] text-white shadow-xs"
                          >
                            <span>{topic}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveTopic(topic)}
                              className="hover:bg-white/20 rounded-full p-0.5 text-gray-200 hover:text-white transition-colors cursor-pointer"
                            >
                              <X size={12} />
                            </button>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-gray-400 italic">
                        Type specific key concepts or numerical types you want tested in the exam.
                      </p>
                    )}
                  </div>
                </div>

                {/* Card 3: Import Syllabus (PDF Upload) */}
                <div className="p-4 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/50">
                  <input
                    ref={pdfInputRef}
                    type="file"
                    accept="application/pdf"
                    onChange={handlePdfUpload}
                    className="hidden"
                  />

                  {uploadedPdf ? (
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 rounded-lg bg-gray-50 border border-gray-200">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-[#2D3A4A] text-white flex items-center justify-center shrink-0">
                          <FileCheck2 className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-[#45505F]">
                              {uploadedPdf.name}
                            </span>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-200 text-gray-700">
                              Extracted ~{uploadedPdf.wordCount} words
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-500 mt-0.5">
                            AI will formulate exam questions directly aligned with this uploaded syllabus content!
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleRemovePdf}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white border border-red-200 text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                      >
                        Remove PDF
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-gray-100 text-[#45505F] flex items-center justify-center shrink-0">
                          <Upload className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-[#45505F]">
                            Import Syllabus or Chapter Notes (PDF Upload)
                          </h4>
                          <p className="text-[11px] text-gray-500 leading-snug">
                            Upload your institute coaching module, official syllabus, or notes PDF. AI will extract topics and build questions from it.
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => pdfInputRef.current?.click()}
                        disabled={isUploadingPdf}
                        className="px-4 py-2 rounded-lg bg-white border border-gray-200 text-xs font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2 shadow-xs shrink-0 disabled:opacity-50 cursor-pointer"
                      >
                        {isUploadingPdf ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#2D3A4A]" />
                            <span>Extracting text from PDF...</span>
                          </>
                        ) : (
                          <>
                            <Upload className="w-3.5 h-3.5 text-[#2D3A4A]" />
                            <span>Select Syllabus PDF</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {pdfError && (
                    <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
                      <AlertCircle size={13} />
                      <span>{pdfError}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Section 4: PYQ & Zero Repetition Highlights */}
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-[#2D3A4A] text-white flex items-center justify-center shrink-0 shadow-xs">
                    <Target className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#45505F]">
                      Past Years & High-Yield Question Bank
                    </h4>
                    <p className="text-[11px] text-gray-500 leading-snug">
                      Focuses on past 10 years NEET & JEE question patterns, recurring numericals, and
                      NTA highest-frequency concepts.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-[#45505F] text-white flex items-center justify-center shrink-0 shadow-xs">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#45505F]">
                      Strict Zero-Repetition Algorithm
                    </h4>
                    <p className="text-[11px] text-gray-500 leading-snug">
                      Each generated question is guaranteed 100% unique in concept, numbers, and
                      options. Never repeats previous questions.
                    </p>
                  </div>
                </div>
              </div>

              {/* Section 5: Exam Blueprint & Difficulty */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-gray-50/70 border border-gray-100">
                {/* Question Count */}
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-[#45505F] block mb-2">
                    5. Number of Questions
                  </label>
                  <div className="flex items-center gap-2">
                    {[5, 10, 15, 20, 25].map((cnt) => (
                      <button
                        key={cnt}
                        type="button"
                        onClick={() => setQuestionCount(cnt)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          questionCount === cnt
                            ? "bg-[#2D3A4A] text-white"
                            : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        {cnt}
                      </button>
                    ))}
                  </div>
                  <span className="text-[11px] text-gray-400 block mt-1">
                    Total Marks: {questionCount * currentExamMeta.defaultMarksPerQuestion} (+
                    {currentExamMeta.defaultMarksPerQuestion}/-{currentExamMeta.defaultNegativeMarks}{" "}
                    scheme)
                  </span>
                </div>

                {/* Difficulty */}
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-[#45505F] block mb-2">
                    Difficulty Distribution
                  </label>
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value as any)}
                    className="w-full py-1.5 px-3 rounded-lg text-xs font-medium border border-gray-200 bg-white text-gray-800 focus:outline-none focus:border-[#2D3A4A]"
                  >
                    <option value="balanced">Balanced (NTA Standard 30:50:20)</option>
                    <option value="easy">Easy (Concept & Formula Foundations)</option>
                    <option value="medium">Medium (Standard Entrance Level)</option>
                    <option value="hard">Hard (High Rigor / Rank Booster)</option>
                  </select>
                </div>

                {/* Pattern */}
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-[#45505F] block mb-2">
                    Question Pattern
                  </label>
                  <select
                    value={pattern}
                    onChange={(e) => setPattern(e.target.value as any)}
                    className="w-full py-1.5 px-3 rounded-lg text-xs font-medium border border-gray-200 bg-white text-gray-800 focus:outline-none focus:border-[#2D3A4A]"
                  >
                    <option value="mcq_single">Single Choice MCQ (4 Options)</option>
                    <option value="assertion_reason">Assertion & Reason Pattern</option>
                    <option value="mixed">Mixed NTA Comprehensive Pattern</option>
                  </select>
                </div>
              </div>

              {/* Generate Button */}
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={isGenerating || (selectedChapters.length === 0 && selectedTopics.length === 0 && !uploadedSyllabusText)}
                  className="px-6 py-2.5 rounded-lg bg-[#2D3A4A] hover:bg-[#1e2a38] text-white text-sm font-medium shadow-sm flex items-center gap-2 transition-all disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>
                        {generationStep === 1
                          ? "Analyzing PYQ Papers & Syllabus Material..."
                          : generationStep === 2
                          ? "Formulating Physics/Math/Bio LaTeX equations & Options..."
                          : "Validating non-repetition & building step-by-step solutions..."}
                      </span>
                    </>
                  ) : (
                    <>
                      <BookOpen className="w-4 h-4" />
                      <span>
                        Generate {questionCount} {selectedExam} Questions
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* Section 6: Review & Approval Workspace */
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-xl bg-gray-50 border border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#2D3A4A] text-white flex items-center justify-center font-bold text-xs">
                    ✓
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#45505F]">
                      Generated {generatedList.length} Non-Repeating Questions for {selectedExam} ({selectedSubject})
                    </h3>
                    <p className="text-xs text-gray-500">
                      Based on real entrance exam PYQs & syllabus requirements. Review and insert into exam.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setGeneratedList([])
                      setSelectedQuestionIds(new Set())
                    }}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Generate New Batch</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleAddToExam}
                    disabled={selectedQuestionIds.size === 0}
                    className="px-4 py-1.5 text-xs font-medium rounded-lg bg-[#2D3A4A] hover:bg-[#1e2a38] text-white shadow-sm flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add {selectedQuestionIds.size} Questions</span>
                  </button>
                </div>
              </div>

              {/* Questions List */}
              <div className="space-y-4">
                {generatedList.map((q, idx) => {
                  const isSelected = selectedQuestionIds.has(q.id)
                  const isExpanded = expandedSolutions.has(q.id)

                  return (
                    <div
                      key={q.id}
                      className={`p-5 rounded-xl border transition-all ${
                        isSelected
                          ? "bg-white border-2 border-[#2D3A4A]/40 shadow-xs"
                          : "bg-gray-50/60 border border-gray-200 opacity-60"
                      }`}
                    >
                      {/* Question Header */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleQuestionSelection(q.id)}
                            className="w-4 h-4 rounded text-[#2D3A4A] focus:ring-[#2D3A4A] cursor-pointer"
                          />
                          <span className="font-bold text-xs px-2 py-0.5 rounded-md bg-gray-100 text-[#2D3A4A]">
                            Q{idx + 1}
                          </span>
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                            {q.chapter}
                          </span>
                          {q.pyqReference && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-[#45505F] border border-gray-200 flex items-center gap-1">
                              <Target className="w-3 h-3 text-[#2D3A4A]" />
                              <span>{q.pyqReference}</span>
                            </span>
                          )}
                          <span className="text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                            {q.difficulty}
                          </span>
                          <span className="text-[11px] text-gray-400">
                            +{q.marks} / -{q.negativeMark} marks
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setEditingQuestion(q)}
                            className="p-1.5 text-gray-400 hover:text-[#2D3A4A] hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                            title="Edit Question"
                          >
                            <Edit3 size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteQuestion(q.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>

                      {/* Question Text with Math rendering */}
                      <div className="text-[#2D3A4A] font-medium mb-4 pl-6">
                        <MathRenderer content={q.questionText} />
                      </div>

                      {/* 4 Options Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pl-6 mb-3">
                        {q.options.map((opt, optIdx) => {
                          const isCorrect = opt === q.correctAnswer
                          const optLabel = ["A", "B", "C", "D"][optIdx] || `${optIdx + 1}`

                          return (
                            <div
                              key={optIdx}
                              className={`p-3 rounded-lg border flex items-start gap-2.5 transition-all ${
                                isCorrect
                                  ? "bg-emerald-50 border-emerald-500 text-emerald-900 font-medium"
                                  : "bg-white border-gray-200 text-gray-700"
                              }`}
                            >
                              <span
                                className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
                                  isCorrect
                                    ? "bg-emerald-600 text-white"
                                    : "bg-gray-100 text-gray-600"
                                }`}
                              >
                                {isCorrect ? "✓" : optLabel}
                              </span>
                              <div className="flex-1">
                                <MathRenderer content={opt} />
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      {/* Solution Dropdown */}
                      <div className="pl-6 pt-1">
                        <button
                          type="button"
                          onClick={() => toggleSolution(q.id)}
                          className="text-xs font-medium text-[#45505F] hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          <span>{isExpanded ? "Hide Solution" : "View Step-by-Step Solution"}</span>
                        </button>

                        {isExpanded && (
                          <div className="mt-2.5 p-3.5 rounded-xl bg-gray-50 border border-gray-100 text-xs text-gray-700">
                            <span className="font-bold text-[#45505F] block mb-1">
                              Solution & Concept Explanation:
                            </span>
                            <MathRenderer content={q.explanation} />
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* ─── Footer ─── */}
        <div className="px-6 py-3.5 border-t border-gray-100 bg-white flex items-center justify-between">
          <div className="text-xs text-gray-400">
            Progrentures Testro Lab Question Authoring Engine
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 cursor-pointer"
            >
              Cancel
            </button>
            {generatedList.length > 0 && (
              <button
                type="button"
                onClick={handleAddToExam}
                disabled={selectedQuestionIds.size === 0}
                className="px-5 py-2 rounded-lg bg-[#2D3A4A] hover:bg-[#1e2a38] text-white text-sm font-medium shadow-sm disabled:opacity-50 cursor-pointer"
              >
                Insert {selectedQuestionIds.size} Questions into Exam
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ─── Inline Edit Modal ─── */}
      {editingQuestion && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-white rounded-2xl p-6 shadow-2xl border border-gray-100 space-y-4">
            <h3 className="text-sm font-bold text-[#45505F] flex items-center justify-between">
              <span>Edit Question Details</span>
              <button
                onClick={() => setEditingQuestion(null)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                ✕
              </button>
            </h3>

            <div>
              <label className="text-xs font-semibold text-[#45505F] block mb-1">
                Question Statement (LaTeX supported with $...$)
              </label>
              <textarea
                rows={3}
                value={editingQuestion.questionText}
                onChange={(e) =>
                  setEditingQuestion({ ...editingQuestion, questionText: e.target.value })
                }
                className="w-full p-2.5 text-xs rounded-lg border border-gray-200 bg-white text-gray-800 font-mono focus:outline-none focus:border-[#2D3A4A]"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-[#45505F] block">
                Options & Correct Answer
              </label>
              {editingQuestion.options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-6 text-xs font-bold text-gray-500">
                    {["A", "B", "C", "D"][i]}:
                  </span>
                  <input
                    type="text"
                    value={opt}
                    onChange={(e) => {
                      const newOpts = [...editingQuestion.options]
                      newOpts[i] = e.target.value
                      setEditingQuestion({
                        ...editingQuestion,
                        options: newOpts,
                        correctAnswer:
                          editingQuestion.correctAnswer === opt
                            ? e.target.value
                            : editingQuestion.correctAnswer,
                      })
                    }}
                    className="flex-1 p-2 text-xs rounded-lg border border-gray-200 bg-white text-gray-800 font-mono focus:outline-none focus:border-[#2D3A4A]"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setEditingQuestion({ ...editingQuestion, correctAnswer: opt })
                    }
                    className={`px-2.5 py-1 text-xs rounded-md font-semibold cursor-pointer ${
                      editingQuestion.correctAnswer === opt
                        ? "bg-emerald-600 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {editingQuestion.correctAnswer === opt ? "Correct" : "Set Correct"}
                  </button>
                </div>
              ))}
            </div>

            <div>
              <label className="text-xs font-semibold text-[#45505F] block mb-1">
                Solution & Explanation
              </label>
              <textarea
                rows={3}
                value={editingQuestion.explanation}
                onChange={(e) =>
                  setEditingQuestion({ ...editingQuestion, explanation: e.target.value })
                }
                className="w-full p-2.5 text-xs rounded-lg border border-gray-200 bg-white text-gray-800 font-mono focus:outline-none focus:border-[#2D3A4A]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingQuestion(null)}
                className="px-4 py-2 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSaveEdit(editingQuestion)}
                className="px-4 py-2 text-xs rounded-lg bg-[#2D3A4A] hover:bg-[#1e2a38] text-white font-medium cursor-pointer"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
