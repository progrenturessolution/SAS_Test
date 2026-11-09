"use client"

import { useState, useMemo, useRef, KeyboardEvent } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  GraduationCap,
  BookOpen,
  Layers,
  CheckCircle2,
  AlertCircle,
  Loader2,
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
  ArrowRight,
  Search,
  Sparkles,
  Clock,
  Award,
  X,
  FileQuestion,
  Filter,
} from "lucide-react"
import {
  EXAM_TARGETS,
  ExamTarget,
  GradeLevel,
  CompetitiveSubject,
  getChapters,
  Chapter,
} from "@/lib/curriculumData"
import { MathRenderer } from "@/components/exam/MathRenderer"

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

export default function AIGeneratorPage() {
  const router = useRouter()

  // ─── Filter & Selection States ───
  const [selectedExam, setSelectedExam] = useState<ExamTarget>("NEET")
  const [selectedGrade, setSelectedGrade] = useState<GradeLevel | "both">("12")
  const [selectedSubject, setSelectedSubject] = useState<CompetitiveSubject>("Physics")
  const [currentStep, setCurrentStep] = useState(1)

  // Chapter Selection
  const [selectedChapters, setSelectedChapters] = useState<string[]>([])
  const [chapterSearch, setChapterSearch] = useState("")
  const [expandedChapterInfo, setExpandedChapterInfo] = useState<string | null>(null)

  // Custom Topics & Accordion
  const [showAdvancedInputs, setShowAdvancedInputs] = useState(false)
  const [selectedTopics, setSelectedTopics] = useState<string[]>([])
  const [manualTopicInput, setManualTopicInput] = useState("")

  // PDF Syllabus Upload
  const [uploadedPdf, setUploadedPdf] = useState<{
    name: string
    size: number
    wordCount: number
  } | null>(null)
  const [uploadedSyllabusText, setUploadedSyllabusText] = useState("")
  const [isUploadingPdf, setIsUploadingPdf] = useState(false)
  const [pdfError, setPdfError] = useState<string | null>(null)
  const pdfInputRef = useRef<HTMLInputElement>(null)

  // Blueprint Settings
  const [questionCount, setQuestionCount] = useState<number>(10)
  const [difficulty, setDifficulty] = useState<"balanced" | "easy" | "medium" | "hard">("balanced")
  const [pattern, setPattern] = useState<"mcq_single" | "assertion_reason" | "mixed">("mcq_single")
  const [focusPYQ, setFocusPYQ] = useState(true)

  // Generation & Status
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationStep, setGenerationStep] = useState(0)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Questions Review & Publishing
  const [generatedQuestions, setGeneratedQuestions] = useState<GeneratedCompetitiveQuestion[]>([])
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<Set<string>>(new Set())
  const [expandedSolutions, setExpandedSolutions] = useState<Set<string>>(new Set())
  const [examTitle, setExamTitle] = useState("")
  const [creatingExam, setCreatingExam] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState<GeneratedCompetitiveQuestion | null>(null)

  // Current Exam Metadata
  const currentExamMeta = useMemo(() => {
    return EXAM_TARGETS.find((e) => e.id === selectedExam) || EXAM_TARGETS[0]
  }, [selectedExam])

  // Available subjects for selected exam
  const availableSubjects = useMemo(() => {
    return currentExamMeta.subjects
  }, [currentExamMeta])

  // Available official chapters from database
  const availableChapters = useMemo(() => {
    return getChapters(selectedExam, selectedGrade, selectedSubject)
  }, [selectedExam, selectedGrade, selectedSubject])

  // Filtered chapters based on search text
  const filteredChapters = useMemo(() => {
    if (!chapterSearch.trim()) return availableChapters
    const q = chapterSearch.toLowerCase().trim()
    return availableChapters.filter(
      (ch) =>
        ch.name.toLowerCase().includes(q) ||
        ch.subtopics?.some((sub) => sub.toLowerCase().includes(q))
    )
  }, [availableChapters, chapterSearch])

  // Automatically switch subject if not available in selected exam
  const handleExamChange = (exam: ExamTarget) => {
    setSelectedExam(exam)
    const targetMeta = EXAM_TARGETS.find((e) => e.id === exam)
    if (targetMeta && !targetMeta.subjects.includes(selectedSubject)) {
      setSelectedSubject(targetMeta.subjects[0])
    }
    // Reset selected chapters when exam changes
    setSelectedChapters([])
    setChapterSearch("")
  }

  // Handle grade change
  const handleGradeChange = (grade: GradeLevel | "both") => {
    setSelectedGrade(grade)
    setSelectedChapters([])
    setChapterSearch("")
  }

  // Handle subject change
  const handleSubjectChange = (subject: CompetitiveSubject) => {
    setSelectedSubject(subject)
    setSelectedChapters([])
    setChapterSearch("")
  }

  const canContinueFromStep = (step: number) => {
    if (step === 3) {
      return selectedChapters.length > 0 || selectedTopics.length > 0 || Boolean(uploadedSyllabusText)
    }
    return true
  }

  // Toggle chapter selection
  const toggleChapter = (chapterName: string) => {
    setSelectedChapters((prev) => {
      if (prev.includes(chapterName)) {
        return prev.filter((c) => c !== chapterName)
      } else {
        return [...prev, chapterName]
      }
    })
  }

  // Select all visible chapters
  const handleSelectAllChapters = () => {
    const allNames = filteredChapters.map((ch) => ch.name)
    setSelectedChapters((prev) => Array.from(new Set([...prev, ...allNames])))
  }

  // Deselect all chapters
  const handleDeselectAllChapters = () => {
    setSelectedChapters([])
  }

  // Add custom topic
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

  // Syllabus PDF upload
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

  // Generate Questions via API
  const handleGenerate = async () => {
    if (selectedChapters.length === 0 && selectedTopics.length === 0 && !uploadedSyllabusText) {
      setErrorMsg("Please select at least one chapter from the list below to begin.")
      return
    }

    setErrorMsg(null)
    setIsGenerating(true)
    setGenerationStep(1)

    const timer1 = setTimeout(() => setGenerationStep(2), 2200)
    const timer2 = setTimeout(() => setGenerationStep(3), 5500)

    try {
      const existingQuestionTexts = generatedQuestions.map((q) => q.questionText)

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

      setGeneratedQuestions(data.questions)
      setSelectedQuestionIds(new Set(data.questions.map((q: GeneratedCompetitiveQuestion) => q.id)))

      // Set default exam title
      const chapterTitle =
        selectedChapters.length === 1
          ? selectedChapters[0]
          : selectedChapters.length > 1
          ? `${selectedChapters[0]} & ${selectedChapters.length - 1} more`
          : selectedSubject
      setExamTitle(`${selectedExam} ${selectedSubject} - ${chapterTitle}`)

      // Scroll smoothly to results
      window.scrollTo({ top: 0, behavior: "smooth" })
    } catch (err: any) {
      setErrorMsg(err?.message || "An unexpected error occurred while generating.")
    } finally {
      clearTimeout(timer1)
      clearTimeout(timer2)
      setIsGenerating(false)
      setGenerationStep(0)
    }
  }

  // Toggle question selection in review
  const toggleQuestionSelection = (id: string) => {
    setSelectedQuestionIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Delete question
  const handleDeleteQuestion = (id: string) => {
    setGeneratedQuestions((prev) => prev.filter((q) => q.id !== id))
    setSelectedQuestionIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  // Toggle solution
  const toggleSolution = (id: string) => {
    setExpandedSolutions((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Save inline edit
  const handleSaveEdit = (updated: GeneratedCompetitiveQuestion) => {
    setGeneratedQuestions((prev) => prev.map((q) => (q.id === updated.id ? updated : q)))
    setEditingQuestion(null)
  }

  // Publish as Exam to DB
  const handleSaveAsExam = async () => {
    const toSave = generatedQuestions.filter((q) => selectedQuestionIds.has(q.id))
    if (toSave.length === 0) {
      setErrorMsg("Please select at least one question to include in the exam paper.")
      return
    }

    setCreatingExam(true)

    try {
      const totalMarks = toSave.reduce(
        (sum, q) => sum + (q.marks || currentExamMeta.defaultMarksPerQuestion),
        0
      )

      const res = await fetch("/api/exams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: examTitle.trim() || `${selectedExam} ${selectedSubject} Entrance Test`,
          examType: selectedExam,
          subject: selectedSubject,
          duration: Math.max(toSave.length * 2, 30),
          totalMarks: totalMarks,
          passMarks: Math.floor(totalMarks * 0.4),
          instructions: [
            "Read each question carefully before submitting your answer.",
            `Each question carries ${currentExamMeta.defaultMarksPerQuestion} marks.`,
            currentExamMeta.defaultNegativeMarks > 0
              ? `Negative marking: -${currentExamMeta.defaultNegativeMarks} marks will be deducted for each incorrect response.`
              : "No negative marking applicable.",
            "Formulas and chemical reactions are formatted with scientific standard LaTeX notation.",
          ],
          sections: [
            {
              title: `${selectedSubject} - Section 1`,
              type: "mcq",
              questions: toSave.map((q) => ({
                type: "mcq",
                questionText: q.questionText,
                difficulty: q.difficulty,
                marks: q.marks || currentExamMeta.defaultMarksPerQuestion,
                negativeMark:
                  q.negativeMark !== undefined
                    ? q.negativeMark
                    : currentExamMeta.defaultNegativeMarks,
                options: q.options,
                correctAnswer: q.correctAnswer,
                explanation: q.explanation,
              })),
            },
          ],
          settings: {
            randomize: true,
            showResults: true,
            allowReview: true,
            negativeMarking: currentExamMeta.defaultNegativeMarks > 0,
          },
          status: "draft",
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to create exam")

      router.push(`/admin/exams/${data.exam?._id || data.id}/edit`)
    } catch (err: any) {
      setErrorMsg("Error creating exam: " + err.message)
    } finally {
      setCreatingExam(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F4F7FB] pb-16">
      {/* ─── Top Studio Banner ─── */}
      <div className="border-b border-slate-200 bg-white px-4 py-5 sm:px-8 lg:px-10">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
              <Link href="/admin/exams" className="hover:text-[#2D3A4A] transition-colors">
                Exams
              </Link>
              <span>/</span>
              <span className="text-[#2D3A4A]">NEET / JEE / MHT-CET Studio</span>
            </div>
            <h1 className="flex items-center gap-3 text-2xl font-medium tracking-tight text-slate-600 sm:text-3xl">
              <span className="rounded-2xl bg-[#2D3A4A] p-2.5 text-white shadow-sm">
                <GraduationCap className="w-6 h-6" />
              </span>
              <span>Competitive Exam Studio</span>
            </h1>
            <p className="mt-2 max-w-2xl text-xs leading-relaxed text-slate-500 sm:text-sm">
              Create authentic, curriculum-aligned entrance examination papers for NEET, JEE Main,
              JEE Advanced, and MHT-CET with verified formulas and step-by-step solutions.
            </p>
          </div>

          {/* Quick Badges */}
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/60 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>NCERT Aligned</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200/60 font-medium">
              <Zap className="w-3.5 h-3.5 text-blue-600" />
              <span>10-Yr PYQ Bank</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 text-slate-800 border border-slate-200 font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-slate-700" />
              <span>Zero Repetition</span>
            </span>
          </div>
        </div>
      </div>

      <div className="mx-auto mt-6 max-w-[1440px] space-y-6 px-4 sm:px-8 lg:mt-8 lg:px-10">
        {/* Error Notification */}
        {errorMsg && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs sm:text-sm flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
              <span className="font-medium">{errorMsg}</span>
            </div>
            <button
              onClick={() => setErrorMsg(null)}
              className="text-red-500 hover:text-red-800 font-bold p-1"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            MODE A: QUESTION REVIEW & PUBLISHING WORKSPACE
        ───────────────────────────────────────────────────────────── */}
        {generatedQuestions.length > 0 ? (
          <div className="space-y-6">
            {/* Action Bar Header */}
            <div className="bg-white rounded-2xl border border-gray-200/80 p-5 sm:p-6 shadow-sm flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold uppercase tracking-wider">
                    Ready to Publish
                  </span>
                  <span className="text-xs text-gray-500 font-medium">
                    {selectedQuestionIds.size} of {generatedQuestions.length} selected
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-xs font-bold text-gray-600 shrink-0">Exam Title:</label>
                  <input
                    type="text"
                    value={examTitle}
                    onChange={(e) => setExamTitle(e.target.value)}
                    placeholder="Enter exam paper title..."
                    className="px-3.5 py-2 text-sm font-semibold rounded-xl border border-gray-200 bg-gray-50/50 text-[#1E293B] w-72 sm:w-96 focus:outline-none focus:ring-2 focus:ring-[#2D3A4A]/20 focus:border-[#2D3A4A]"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap w-full lg:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setGeneratedQuestions([])
                    setSelectedQuestionIds(new Set())
                    setCurrentStep(1)
                  }}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4 text-gray-500" />
                  <span>Configure New Batch</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveAsExam}
                  disabled={creatingExam || selectedQuestionIds.size === 0}
                  className="px-6 py-2.5 rounded-xl bg-[#2D3A4A] hover:bg-[#1e2a38] text-white text-xs sm:text-sm font-bold shadow-sm flex items-center gap-2 disabled:opacity-50 transition-all cursor-pointer"
                >
                  {creatingExam ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Creating Exam Paper...</span>
                    </>
                  ) : (
                    <>
                      <span>Publish as New Exam</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Generated Questions List */}
            <div className="space-y-4">
              {generatedQuestions.map((q, idx) => {
                const isSelected = selectedQuestionIds.has(q.id)
                const isExpanded = expandedSolutions.has(q.id)

                return (
                  <div
                    key={q.id || idx}
                    className={`bg-white rounded-2xl border transition-all p-6 shadow-xs ${
                      isSelected
                        ? "border-2 border-[#2D3A4A]/40 ring-1 ring-[#2D3A4A]/10"
                        : "border-gray-200 opacity-60"
                    }`}
                  >
                    {/* Question Header */}
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleQuestionSelection(q.id)}
                          className="w-4 h-4 rounded text-[#2D3A4A] focus:ring-[#2D3A4A] cursor-pointer"
                        />
                        <span className="w-7 h-7 rounded-lg bg-[#2D3A4A] text-white text-xs font-bold flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-gray-100 text-gray-800">
                          {q.chapter}
                        </span>
                        {q.pyqReference && (
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200/60 flex items-center gap-1">
                            <Target className="w-3.5 h-3.5 text-emerald-600" />
                            <span>{q.pyqReference}</span>
                          </span>
                        )}
                        <span className="text-xs font-medium uppercase tracking-wider px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700">
                          {q.difficulty}
                        </span>
                        <span className="text-xs text-gray-400 font-medium">
                          +{q.marks} / -{q.negativeMark} marks
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setEditingQuestion(q)}
                          className="p-2 text-gray-400 hover:text-[#2D3A4A] hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                          title="Edit Question"
                        >
                          <Edit3 size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteQuestion(q.id)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Delete Question"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    {/* Question Body */}
                    <div className="text-sm sm:text-base font-semibold text-[#1E293B] pl-8 mb-5 leading-relaxed">
                      <MathRenderer content={q.questionText} />
                    </div>

                    {/* 4 Options Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-8 mb-4">
                      {q.options.map((opt, oi) => {
                        const isCorrect = opt === q.correctAnswer
                        const label = ["A", "B", "C", "D"][oi]

                        return (
                          <div
                            key={oi}
                            className={`p-3.5 rounded-xl border flex items-start gap-3 transition-all ${
                              isCorrect
                                ? "bg-emerald-50/70 border-emerald-500 text-emerald-950 font-medium shadow-xs"
                                : "bg-gray-50/50 border-gray-200/90 text-gray-700"
                            }`}
                          >
                            <span
                              className={`w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center shrink-0 ${
                                isCorrect
                                  ? "bg-emerald-600 text-white"
                                  : "bg-white border border-gray-200 text-gray-700"
                              }`}
                            >
                              {isCorrect ? "✓" : label}
                            </span>
                            <div className="flex-1 text-xs sm:text-sm pt-0.5">
                              <MathRenderer content={opt} />
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Solution Accordion */}
                    <div className="pl-8 pt-2">
                      <button
                        type="button"
                        onClick={() => toggleSolution(q.id)}
                        className="text-xs font-bold text-[#2D3A4A] hover:underline flex items-center gap-1.5 cursor-pointer"
                      >
                        {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                        <span>{isExpanded ? "Hide Solution" : "View Step-by-Step Solution"}</span>
                      </button>

                      {isExpanded && (
                        <div className="mt-3 p-4 rounded-xl bg-gray-50 border border-gray-200/80 text-xs sm:text-sm text-gray-700 leading-relaxed space-y-1.5">
                          <span className="font-bold text-[#1E293B] block">
                            Concept & Detailed Solution:
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
        ) : (
          /* ─────────────────────────────────────────────────────────────
              MODE B: CLEAN, FULL-PAGE CONFIGURATION STUDIO
          ───────────────────────────────────────────────────────────── */
          <>
          <div className="mb-6 rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_12px_35px_rgba(30,52,75,0.07)] sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#2D3A4A] text-white shadow-sm">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium tracking-tight text-slate-600">AI Question Studio</p>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                      Draft setup
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    {currentStep === 1 ? "Choose your target exam" : currentStep === 2 ? "Set class and subject" : currentStep === 3 ? "Pick chapters and topics" : "Define your paper blueprint"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <span className="text-[11px] font-semibold text-slate-400">Step</span>
                <span className="rounded-lg bg-[#2D3A4A] px-2.5 py-1.5 text-xs font-extrabold text-white">
                  {currentStep} <span className="font-medium text-slate-300">/ 4</span>
                </span>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-4 gap-1 sm:gap-2">
              {[1, 2, 3, 4].map((step) => {
                const isCurrent = step === currentStep
                const isComplete = step < currentStep
                const label = step === 1 ? "Exam" : step === 2 ? "Profile" : step === 3 ? "Content" : "Blueprint"

                return (
                  <div key={step} className="relative">
                    {step < 4 && (
                      <span className={`absolute left-[calc(50%+18px)] right-[calc(-50%+18px)] top-4 h-px ${
                        step < currentStep ? "bg-emerald-400" : "bg-slate-200"
                      }`} />
                    )}
                    <button
                      type="button"
                      onClick={() => step <= currentStep && setCurrentStep(step)}
                      className="group relative z-10 flex w-full flex-col items-center gap-1.5"
                      aria-label={`Go to step ${step}`}
                    >
                      <span className={`flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-extrabold transition-all ${
                        isCurrent
                          ? "bg-[#2D3A4A] text-white ring-4 ring-slate-100"
                          : isComplete
                            ? "bg-emerald-500 text-white"
                            : "bg-white text-slate-400 ring-1 ring-slate-200"
                      }`}>
                        {isComplete ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : step}
                      </span>
                      <span className={`text-[10px] font-bold sm:text-[11px] ${
                        isCurrent ? "text-[#2D3A4A]" : isComplete ? "text-emerald-600" : "text-slate-400"
                      }`}>
                        {label}
                      </span>
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

          <div className={currentStep === 4 ? "grid grid-cols-1 items-start gap-6 xl:grid-cols-3 xl:gap-8" : "grid grid-cols-1 items-start gap-6"}>
            {/* Left 2 Columns: Exam, Class, Subject & Chapters */}
            <div className={currentStep === 4 ? "hidden" : "w-full space-y-6"}>
              {/* Step 1: Target Entrance Exam */}
              <div className={currentStep === 1 ? "overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_16px_45px_rgba(30,52,75,0.07)]" : "hidden"}>
                <div className="border-b border-slate-100 px-5 py-6 sm:px-8">
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#2D3A4A] text-white shadow-lg shadow-slate-300">
                      <GraduationCap className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#2D3A4A]">Step 1 · Target exam</p>
                      <h2 className="mt-1 text-2xl font-medium tracking-tight text-slate-600">Choose your exam</h2>
                      <p className="mt-1 max-w-xl text-sm leading-relaxed text-slate-500">Select the exam you are building this paper for. We will automatically tailor subjects, marks and syllabus.</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2 sm:p-8">
                  {EXAM_TARGETS.map((exam) => {
                    const isSelected = selectedExam === exam.id
                    return (
                      <button
                        key={exam.id}
                        type="button"
                        onClick={() => handleExamChange(exam.id)}
                        className={`group relative overflow-hidden rounded-2xl border p-4 text-left transition-all duration-200 cursor-pointer ${
                          isSelected
                            ? "border-[#2D3A4A] bg-[#f4f7fa] shadow-md ring-1 ring-[#2D3A4A]"
                            : "border-slate-200 bg-white hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold ${
                              exam.id === "NEET" ? "bg-emerald-100 text-emerald-700" :
                              exam.id === "JEE_MAIN" ? "bg-blue-100 text-blue-700" :
                              exam.id === "JEE_ADVANCED" ? "bg-violet-100 text-violet-700" :
                              exam.id === "MHT_CET" ? "bg-amber-100 text-amber-700" :
                              "bg-cyan-100 text-cyan-700"
                            }`}>
                              {exam.id === "NEET" ? "N" : exam.id === "JEE_MAIN" ? "M" : exam.id === "JEE_ADVANCED" ? "A" : exam.id === "MHT_CET" ? "C" : "B"}
                            </span>
                            <div className="min-w-0">
                              <h3 className="truncate text-base font-medium text-slate-600">{exam.title}</h3>
                              <p className="mt-0.5 truncate text-[11px] font-medium text-slate-400">{exam.badge} · {exam.syllabusYear} syllabus</p>
                            </div>
                          </div>
                          <span
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                              isSelected ? "border-[#2D3A4A] bg-[#2D3A4A] text-white" : "border-slate-200 text-transparent"
                            }`}
                          >
                            <Check className="h-3.5 w-3.5" strokeWidth={3} />
                          </span>
                        </div>
                        <p className="mt-3 line-clamp-1 text-xs leading-relaxed text-slate-500">{exam.subtitle}</p>
                        <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-[11px] text-slate-500">
                          <span>
                            +{exam.defaultMarksPerQuestion} / -{exam.defaultNegativeMarks} marks
                          </span>
                          <span className="font-semibold text-slate-600">
                            {exam.subjects.length} subjects
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Step 2: Class & Subject Segmented Row */}
              <div className={currentStep === 2 ? "overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_16px_45px_rgba(30,52,75,0.07)]" : "hidden"}>
                <div className="border-b border-slate-100 px-5 py-6 sm:px-8">
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                      <BookOpen className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#2D3A4A]">Step 2 · Learner profile</p>
                      <h2 className="mt-1 text-2xl font-medium tracking-tight text-slate-600">Set your class and subject</h2>
                      <p className="mt-1 max-w-xl text-sm leading-relaxed text-slate-500">Choose the academic level and subject you want the AI to use for your chapter recommendations.</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-5 p-5 sm:p-8 md:grid-cols-2">
                  {/* Class Level */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="mb-4 flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                        <GraduationCap className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-600">Class / Standard</p>
                        <p className="mt-0.5 text-xs text-slate-400">Select your study level</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      {[
                        { id: "11", label: "Class 11th" },
                        { id: "12", label: "Class 12th" },
                        { id: "both", label: "11th + 12th" },
                      ].map((g) => {
                        const isSelected = selectedGrade === g.id
                        return (
                          <button
                            key={g.id}
                            type="button"
                            onClick={() => handleGradeChange(g.id as any)}
                            className={`rounded-xl border px-3 py-3 text-xs font-semibold text-center transition-all cursor-pointer ${
                              isSelected
                                ? "border-amber-400 bg-amber-50 text-amber-800 shadow-sm ring-1 ring-amber-200"
                                : "border-slate-200 bg-slate-50 text-slate-600 hover:border-amber-200 hover:bg-white"
                            }`}
                          >
                            {g.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Subject */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="mb-4 flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                        <BookOpen className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-600">Subject</p>
                        <p className="mt-0.5 text-xs text-slate-400">Choose your focus area</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {availableSubjects.map((sub) => {
                        const isSelected = selectedSubject === sub
                        return (
                          <button
                            key={sub}
                            type="button"
                            onClick={() => handleSubjectChange(sub)}
                            className={`rounded-xl border px-4 py-3 text-xs font-semibold transition-all cursor-pointer ${
                              isSelected
                                ? "border-blue-400 bg-blue-50 text-blue-800 shadow-sm ring-1 ring-blue-200"
                                : "border-slate-200 bg-slate-50 text-slate-600 hover:border-blue-200 hover:bg-white"
                            }`}
                          >
                            {sub}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 3: Chapter Selection Grid */}
              <div className={currentStep === 3 ? "overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_16px_45px_rgba(30,52,75,0.07)]" : "hidden"}>
                <div className="flex flex-col justify-between gap-4 border-b border-slate-100 px-5 py-6 sm:flex-row sm:items-center sm:px-8">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                        <Layers className="h-5 w-5" />
                      </div>
                      <div>
                      <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#2D3A4A]">Step 3 · Content selection</p>
                      <span className="mt-1 inline-flex text-xs font-semibold text-emerald-700">
                        {selectedChapters.length} Selected
                      </span>
                      </div>
                    </div>
                    <h2 className="mt-4 text-2xl font-medium tracking-tight text-slate-600">
                      {currentExamMeta.title} {currentExamMeta.syllabusYear} chapters
                    </h2>
                    <p className="mt-1 text-xs text-slate-500">
                      {selectedSubject} · Class {selectedGrade === "both" ? "11 & 12" : selectedGrade} ·{" "}
                      {availableChapters.length} chapters in official sequence
                    </p>
                    <a
                      href={currentExamMeta.officialSyllabusUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex text-[11px] font-semibold text-[#2D3A4A] underline-offset-2 hover:underline"
                    >
                      View official {currentExamMeta.syllabusYear} syllabus source
                    </a>
                  </div>

                  {/* Select All & Clear Buttons */}
                  <div className="flex flex-wrap items-center gap-2 sm:pt-8">
                    <button
                      type="button"
                      onClick={handleSelectAllChapters}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 cursor-pointer"
                    >
                      Select All ({filteredChapters.length})
                    </button>
                    {selectedChapters.length > 0 && (
                      <button
                        type="button"
                        onClick={handleDeselectAllChapters}
                        className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 transition-colors hover:bg-red-100 cursor-pointer"
                      >
                        Clear All
                      </button>
                    )}
                  </div>
                </div>

                {/* Chapter Search Bar */}
                <div className="relative mx-5 mt-5 sm:mx-8">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={chapterSearch}
                    onChange={(e) => setChapterSearch(e.target.value)}
                    placeholder={`Filter ${selectedSubject} chapters (e.g. Thermodynamics, Optics, Organic)...`}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-10 text-xs text-slate-600 placeholder:text-slate-400 focus:border-[#2D3A4A] focus:bg-white focus:outline-none focus:ring-4 focus:ring-slate-100 sm:text-sm"
                  />
                  {chapterSearch && (
                    <button
                      type="button"
                      onClick={() => setChapterSearch("")}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Chapter Pills Grid */}
                {filteredChapters.length === 0 ? (
                  <div className="py-12 text-center text-gray-400 text-xs">
                    No chapters matching &ldquo;{chapterSearch}&rdquo;.
                  </div>
                ) : (
                  <div className="mx-5 mt-4 grid max-h-[440px] grid-cols-1 gap-2 overflow-y-auto pb-5 sm:mx-8 sm:pb-8">
                    {filteredChapters.map((ch) => {
                      const isSelected = selectedChapters.includes(ch.name)
                      const isInfoOpen = expandedChapterInfo === ch.id

                      return (
                        <div
                          key={ch.id}
                          className={`rounded-xl border transition-all text-left relative ${
                            isSelected
                              ? "border-emerald-300 bg-emerald-50 text-slate-700 shadow-sm"
                              : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                          }`}
                        >
                          <div
                            onClick={() => toggleChapter(ch.name)}
                            className="flex cursor-pointer select-none items-center justify-between gap-3 px-3 py-3 sm:px-4"
                          >
                            <div className="flex items-start gap-2.5">
                              <div
                                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-colors ${
                                  isSelected
                                    ? "bg-emerald-500 text-white"
                                    : "border border-slate-200 bg-slate-50 text-transparent"
                                }`}
                              >
                                {isSelected && <Check size={13} strokeWidth={3} />}
                              </div>
                              <div className="min-w-0">
                                <span
                                  className={`text-[10px] font-semibold uppercase tracking-wider ${
                                    isSelected
                                      ? "text-emerald-700"
                                      : "text-slate-400"
                                  }`}
                                >
                                  {String(filteredChapters.indexOf(ch) + 1).padStart(2, "0")} · Class {ch.grade}th
                                </span>
                                <h4 className="mt-1 truncate text-sm font-medium leading-snug text-slate-700 sm:text-[15px]">
                                  {ch.name}
                                </h4>
                              </div>
                            </div>

                            {/* Subtopics counter toggle */}
                            {ch.subtopics && ch.subtopics.length > 0 && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setExpandedChapterInfo(isInfoOpen ? null : ch.id)
                                }}
                                className={`shrink-0 rounded-lg px-2 py-1 text-[10px] font-semibold transition-colors ${
                                  isSelected
                                    ? "bg-white text-emerald-700 hover:bg-emerald-100"
                                    : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                                }`}
                              >
                                {ch.subtopics.length} topics
                              </button>
                            )}
                          </div>

                          {/* Subtopics expansion preview */}
                          {isInfoOpen && ch.subtopics && (
                            <div
                              className={`px-3.5 pb-3 pt-1 border-t text-xs ${
                                isSelected
                                  ? "border-white/20 text-gray-200"
                                  : "border-gray-100 text-gray-600"
                              }`}
                            >
                              <span className="font-bold block mb-1">Key concepts included:</span>
                              <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                                {ch.subtopics.map((s, si) => (
                                  <li key={si} className="truncate">
                                    {s}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Optional Collapsible: Custom Topics & Syllabus PDF */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAdvancedInputs(!showAdvancedInputs)}
                    className="text-xs font-bold text-[#2D3A4A] hover:underline flex items-center gap-1.5 cursor-pointer"
                  >
                    {showAdvancedInputs ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    <span>
                      {showAdvancedInputs
                        ? "Hide Custom Topics & PDF Upload"
                        : "➕ Need custom topics or upload coaching syllabus PDF? (Optional)"}
                    </span>
                  </button>

                  {showAdvancedInputs && (
                    <div className="mt-4 p-5 rounded-xl bg-gray-50 border border-gray-200/80 space-y-4">
                      {/* Custom Topics Input */}
                      <div>
                        <label className="text-xs font-bold text-gray-700 block mb-1.5">
                          Specify Custom Topics or Numerical Models (Optional):
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={manualTopicInput}
                            onChange={(e) => setManualTopicInput(e.target.value)}
                            onKeyDown={handleManualTopicKeyDown}
                            placeholder="e.g. Carnot Engine, Projectile on Incline, SN1 vs SN2..."
                            className="flex-1 px-3 py-2 text-xs rounded-xl border border-gray-200 bg-white text-[#1E293B] focus:outline-none focus:border-[#2D3A4A]"
                          />
                          <button
                            type="button"
                            onClick={handleAddManualTopic}
                            disabled={!manualTopicInput.trim()}
                            className="px-3.5 py-2 rounded-xl bg-[#2D3A4A] text-white text-xs font-semibold disabled:opacity-50 cursor-pointer"
                          >
                            Add Topic
                          </button>
                        </div>

                        {selectedTopics.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2.5">
                            {selectedTopics.map((topic) => (
                              <span
                                key={topic}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-[#2D3A4A] text-white"
                              >
                                <span>{topic}</span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveTopic(topic)}
                                  className="hover:bg-white/20 rounded p-0.5"
                                >
                                  <X size={12} />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* PDF Syllabus Upload */}
                      <div className="pt-2 border-t border-gray-200">
                        <input
                          ref={pdfInputRef}
                          type="file"
                          accept="application/pdf"
                          onChange={handlePdfUpload}
                          className="hidden"
                        />

                        {uploadedPdf ? (
                          <div className="flex items-center justify-between p-3 rounded-xl bg-white border border-gray-200">
                            <div className="flex items-center gap-3">
                              <FileCheck2 className="w-5 h-5 text-emerald-600" />
                              <div>
                                <span className="text-xs font-bold text-gray-800">
                                  {uploadedPdf.name}
                                </span>
                                <span className="text-[11px] text-gray-500 block">
                                  Extracted ~{uploadedPdf.wordCount} words
                                </span>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={handleRemovePdf}
                              className="text-xs text-red-600 hover:underline font-semibold"
                            >
                              Remove PDF
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                            <div className="text-xs text-gray-600">
                              <span className="font-bold block text-gray-800">
                                Import Coaching Syllabus / Notes PDF
                              </span>
                              Upload notes PDF to generate questions strictly aligned with coaching
                              handouts.
                            </div>
                            <button
                              type="button"
                              onClick={() => pdfInputRef.current?.click()}
                              disabled={isUploadingPdf}
                              className="px-4 py-2 rounded-xl bg-white border border-gray-200 hover:bg-gray-100 text-xs font-bold text-gray-700 flex items-center gap-2 shadow-xs cursor-pointer"
                            >
                              {isUploadingPdf ? (
                                <>
                                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#2D3A4A]" />
                                  <span>Reading PDF...</span>
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

                        {pdfError && <p className="text-xs text-red-500 mt-2">{pdfError}</p>}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Blueprint Settings & Live Summary Card */}
            <div className={currentStep === 4 ? "w-full space-y-6 xl:col-span-3" : "hidden"}>
              {/* Exam Blueprint Card */}
              <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_16px_45px_rgba(30,52,75,0.08)]">
                <div className="border-b border-slate-100 px-5 py-6 sm:px-8">
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
                      <Sliders className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#2D3A4A]">Step 4 · Final blueprint</p>
                      <h2 className="mt-1 text-2xl font-medium tracking-tight text-slate-600">Design your question paper</h2>
                      <p className="mt-1 text-sm leading-relaxed text-slate-500">Choose the size, difficulty and format. Your AI-generated paper will follow these settings.</p>
                    </div>
                  </div>
                </div>

                {/* Number of Questions */}
                <div className="grid gap-6 p-5 sm:p-8 xl:grid-cols-2 xl:gap-x-10">
                  <div>
                    <p className="text-sm font-medium text-slate-600">Number of questions</p>
                    <p className="mt-1 text-xs text-slate-400">How long should this paper be?</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {[5, 10, 15, 20, 25, 30].map((cnt) => (
                      <button
                        key={cnt}
                        type="button"
                        onClick={() => setQuestionCount(cnt)}
                        className={`rounded-2xl border py-3 text-xs font-bold transition-all cursor-pointer ${
                          questionCount === cnt
                            ? "border-violet-400 bg-violet-50 text-violet-800 shadow-sm ring-1 ring-violet-200"
                            : "border-slate-200 bg-slate-50 text-slate-600 hover:border-violet-200 hover:bg-white"
                        }`}
                      >
                        {cnt} Qs
                      </button>
                    ))}
                  </div>
                
                {/* Difficulty Distribution */}
                <div className="px-5 sm:px-8 xl:px-0">
                  <p className="mb-1 text-sm font-medium text-slate-600">Difficulty level</p>
                  <p className="mb-2 text-xs text-slate-400">Choose the challenge level for learners.</p>
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value as any)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-800 focus:border-[#2D3A4A] focus:bg-white focus:outline-none sm:text-sm"
                  >
                    <option value="balanced">Balanced (NTA Standard 30:50:20)</option>
                    <option value="easy">Easy (Concept & Formula Foundations)</option>
                    <option value="medium">Medium (Standard Entrance Level)</option>
                    <option value="hard">Hard (Rank Booster / High Rigor)</option>
                  </select>
                </div>

                {/* Question Pattern */}
                <div className="px-5 sm:px-8 xl:px-0">
                  <p className="mb-1 text-sm font-medium text-slate-600">Question format</p>
                  <p className="mb-2 text-xs text-slate-400">Select how questions should be structured.</p>
                  <select
                    value={pattern}
                    onChange={(e) => setPattern(e.target.value as any)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-800 focus:border-[#2D3A4A] focus:bg-white focus:outline-none sm:text-sm"
                  >
                    <option value="mcq_single">Single Choice MCQ (4 Options)</option>
                    <option value="assertion_reason">Assertion & Reason Pattern</option>
                    <option value="mixed">Mixed NTA Comprehensive Pattern</option>
                  </select>
                </div>

                {/* PYQ Switch */}
                <div className="mx-5 flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:mx-8 xl:mx-0">
                  <input
                    id="pyq-check"
                    type="checkbox"
                    checked={focusPYQ}
                    onChange={(e) => setFocusPYQ(e.target.checked)}
                    className="w-4 h-4 rounded text-[#2D3A4A] focus:ring-[#2D3A4A] cursor-pointer mt-0.5"
                  />
                  <label
                    htmlFor="pyq-check"
                    className="text-xs text-gray-600 cursor-pointer select-none leading-snug"
                  >
                    <span className="block font-medium text-slate-600">
                      Prioritize 10-year PYQ models
                    </span>
                    Formulate questions modeling real NTA & state entrance past year questions.
                  </label>
                </div>

                {/* Live Calculation Summary */}
                <div className="mx-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs shadow-sm sm:mx-8 xl:mx-0">
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Paper summary</p>
                  <div className="flex justify-between text-slate-500">
                    <span>Target Exam:</span>
                    <span className="font-medium text-slate-600">{currentExamMeta.title}</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Subject & Class:</span>
                    <span className="font-medium text-slate-600">
                      {selectedSubject} (Class {selectedGrade === "both" ? "11 & 12" : selectedGrade}
                      )
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Chapters Selected:</span>
                    <span className="font-medium text-slate-600">
                      {selectedChapters.length > 0
                        ? `${selectedChapters.length} chapter(s)`
                        : "None selected"}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Marking Scheme:</span>
                    <span className="font-medium text-slate-600">
                      +{currentExamMeta.defaultMarksPerQuestion} / -
                      {currentExamMeta.defaultNegativeMarks} marks
                    </span>
                  </div>
                  <div className="mt-2 flex justify-between border-t border-slate-200 pt-3 text-sm font-medium text-[#2D3A4A]">
                    <span>Total Paper Marks:</span>
                    <span>{questionCount * currentExamMeta.defaultMarksPerQuestion} Marks</span>
                  </div>
                </div>

                {/* Big Generate Action Button */}
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={
                    isGenerating ||
                    (selectedChapters.length === 0 &&
                      selectedTopics.length === 0 &&
                      !uploadedSyllabusText)
                  }
                  className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-[#2D3A4A] px-6 py-4 text-sm font-semibold text-white shadow-md transition-all hover:bg-[#1e2a38] disabled:pointer-events-none disabled:opacity-50 cursor-pointer xl:col-span-2"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span className="text-xs">
                        {generationStep === 1
                          ? "Analyzing NTA PYQs..."
                          : generationStep === 2
                          ? "Formulating LaTeX & Options..."
                          : "Validating Unique Questions..."}
                      </span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-amber-300" />
                      <span>
                        Generate {questionCount} {selectedExam} Questions
                      </span>
                    </>
                  )}
                </button>

                {selectedChapters.length === 0 &&
                  selectedTopics.length === 0 &&
                  !uploadedSyllabusText && (
                    <p className="text-[11px] text-amber-600 text-center font-medium">
                      👆 Please select at least one chapter from Step 3 above.
                    </p>
                  )}
              </div>
            </div>
          </div>

          </div>

          <div className="mt-6 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setCurrentStep((step) => Math.max(1, step - 1))}
              disabled={currentStep === 1}
              className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Back
            </button>
            {currentStep < 4 && (
              <button
                type="button"
                onClick={() => setCurrentStep((step) => Math.min(4, step + 1))}
                disabled={!canContinueFromStep(currentStep)}
                className="rounded-xl bg-[#2D3A4A] px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#1e2a38] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next step
                <ArrowRight className="ml-2 inline-block h-4 w-4" />
              </button>
            )}
          </div>
          </>
        )}
      </div>

      {/* ─── Inline Edit Question Modal ─── */}
      {editingQuestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-2xl bg-white rounded-2xl p-6 shadow-2xl border border-gray-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="text-sm font-bold text-[#1E293B]">Edit Question Details</h3>
              <button
                onClick={() => setEditingQuestion(null)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">
                Question Statement (LaTeX supported with $...$):
              </label>
              <textarea
                rows={3}
                value={editingQuestion.questionText}
                onChange={(e) =>
                  setEditingQuestion({ ...editingQuestion, questionText: e.target.value })
                }
                className="w-full p-3 text-xs sm:text-sm rounded-xl border border-gray-200 bg-gray-50/50 text-[#1E293B] font-mono focus:outline-none focus:border-[#2D3A4A]"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-700 block">
                Options & Correct Answer:
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
                    className="flex-1 p-2 text-xs rounded-lg border border-gray-200 bg-white text-[#1E293B] font-mono focus:outline-none focus:border-[#2D3A4A]"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setEditingQuestion({ ...editingQuestion, correctAnswer: opt })
                    }
                    className={`px-3 py-1.5 text-xs rounded-lg font-bold transition-colors cursor-pointer ${
                      editingQuestion.correctAnswer === opt
                        ? "bg-emerald-600 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {editingQuestion.correctAnswer === opt ? "Correct Answer" : "Set Correct"}
                  </button>
                </div>
              ))}
            </div>

            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">
                Step-by-Step Solution / Explanation:
              </label>
              <textarea
                rows={3}
                value={editingQuestion.explanation}
                onChange={(e) =>
                  setEditingQuestion({ ...editingQuestion, explanation: e.target.value })
                }
                className="w-full p-3 text-xs sm:text-sm rounded-xl border border-gray-200 bg-gray-50/50 text-[#1E293B] font-mono focus:outline-none focus:border-[#2D3A4A]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setEditingQuestion(null)}
                className="px-4 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSaveEdit(editingQuestion)}
                className="px-5 py-2 rounded-xl bg-[#2D3A4A] text-white text-xs font-bold hover:bg-[#1e2a38] cursor-pointer"
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
