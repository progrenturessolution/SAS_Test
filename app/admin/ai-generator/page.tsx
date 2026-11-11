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
  Info,
  ChevronRight,
  BarChart2,
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
  questionFormat?: "mcq" | "assertion" | "fib" | "true_false" | string
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
  const [selectedSubjects, setSelectedSubjects] = useState<CompetitiveSubject[]>(["Physics", "Chemistry", "Biology"])
  const [examDropdownOpen, setExamDropdownOpen] = useState(false)
  const [subjectDropdownOpen, setSubjectDropdownOpen] = useState(false)
  const [currentStep, setCurrentStep] = useState(1)

  const STEPS = [
    { step: 1, label: "Exam" },
    { step: 2, label: "Content & Blueprint" },
    { step: 3, label: "Questions" },
    { step: 4, label: "Exam Details" },
    { step: 5, label: "Settings" },
    { step: 6, label: "Publish" },
  ]

  // Step 2: Content & Blueprint States
  const [activeSubjectTab, setActiveSubjectTab] = useState<CompetitiveSubject>("Physics")
  const [classFilter, setClassFilter] = useState<"all" | "11" | "12">("all")
  const [expandedClasses, setExpandedClasses] = useState<{ "11": boolean; "12": boolean }>({
    "11": false,
    "12": false,
  })

  // Blueprint Format Matrix
  const [blueprintFormats, setBlueprintFormats] = useState([
    { id: "mcq", label: "MCQ", checked: true, count: 30, marks: 4 },
    { id: "assertion", label: "Assertion", checked: true, count: 10, marks: 4 },
    { id: "fib", label: "Fill in the Blanks", checked: true, count: 5, marks: 2 },
    { id: "true_false", label: "True / False", checked: false, count: 0, marks: 0 },
  ])

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
  const [questionCount, setQuestionCount] = useState<number>(45)
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "balanced" | "hard">("easy")
  const [pattern, setPattern] = useState<"mcq_single" | "assertion_reason" | "mixed">("mixed")
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
  const [formatFilter, setFormatFilter] = useState<string>("all")

  const filteredGeneratedQuestions = useMemo(() => {
    if (formatFilter === "all") return generatedQuestions
    return generatedQuestions.filter((q) => {
      const fmt = q.questionFormat || q.type || "mcq"
      return fmt === formatFilter
    })
  }, [generatedQuestions, formatFilter])

  const formatCounts = useMemo(() => {
    const counts: Record<string, number> = { all: generatedQuestions.length, mcq: 0, assertion: 0, fib: 0, true_false: 0 }
    generatedQuestions.forEach((q) => {
      const fmt = q.questionFormat || q.type || "mcq"
      if (counts[fmt] !== undefined) counts[fmt]++
      else counts.mcq++
    })
    return counts
  }, [generatedQuestions])

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
    if (targetMeta) {
      setSelectedSubjects(targetMeta.subjects)
      setSelectedSubject(targetMeta.subjects[0] || "Physics")
      setActiveSubjectTab(targetMeta.subjects[0] || "Physics")
    }
    // Reset selected chapters when exam changes
    setSelectedChapters([])
    setChapterSearch("")
    setExamDropdownOpen(false)
  }

  // Handle multi-select toggle of subjects in Step 1
  const handleToggleSubject = (sub: CompetitiveSubject) => {
    if (selectedSubjects.includes(sub)) {
      if (selectedSubjects.length > 1) {
        const next = selectedSubjects.filter((s) => s !== sub)
        setSelectedSubjects(next)
        if (selectedSubject === sub) setSelectedSubject(next[0])
        if (activeSubjectTab === sub) setActiveSubjectTab(next[0])
      }
    } else {
      const next = [...selectedSubjects, sub]
      setSelectedSubjects(next)
      if (!selectedSubject) setSelectedSubject(sub)
    }
  }

  const handleRemoveSubject = (e: React.MouseEvent, sub: CompetitiveSubject) => {
    e.stopPropagation()
    if (selectedSubjects.length > 1) {
      const next = selectedSubjects.filter((s) => s !== sub)
      setSelectedSubjects(next)
      if (selectedSubject === sub) setSelectedSubject(next[0])
      if (activeSubjectTab === sub) setActiveSubjectTab(next[0])
    }
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
    setActiveSubjectTab(subject)
    if (!selectedSubjects.includes(subject)) {
      setSelectedSubjects([subject])
    }
    setSelectedChapters([])
    setChapterSearch("")
  }

  // Step 2: Format calculations
  const totalQuestions = useMemo(() => {
    return blueprintFormats.reduce((acc, f) => acc + (f.checked ? f.count : 0), 0)
  }, [blueprintFormats])

  const totalMarks = useMemo(() => {
    return blueprintFormats.reduce((acc, f) => acc + (f.checked ? f.count * f.marks : 0), 0)
  }, [blueprintFormats])

  const toggleFormatCheck = (id: string) => {
    setBlueprintFormats((prev) =>
      prev.map((f) => (f.id === id ? { ...f, checked: !f.checked } : f))
    )
  }

  const updateFormatCount = (id: string, count: number) => {
    setBlueprintFormats((prev) =>
      prev.map((f) => (f.id === id ? { ...f, count } : f))
    )
  }

  const updateFormatMarks = (id: string, marks: number) => {
    setBlueprintFormats((prev) =>
      prev.map((f) => (f.id === id ? { ...f, marks } : f))
    )
  }

  // Step 2: Chapters by subject & grade
  const currentSubjectChapters = useMemo(() => {
    return getChapters(selectedExam, selectedGrade, activeSubjectTab)
  }, [selectedExam, selectedGrade, activeSubjectTab])

  const class11Chapters = useMemo(() => {
    return currentSubjectChapters.filter((c) => c.grade === "11")
  }, [currentSubjectChapters])

  const class12Chapters = useMemo(() => {
    return currentSubjectChapters.filter((c) => c.grade === "12")
  }, [currentSubjectChapters])

  const toggleAllClass = (grade: "11" | "12") => {
    const targetChapters = grade === "11" ? class11Chapters : class12Chapters
    const targetNames = targetChapters.map((c) => c.name)
    const allSelected =
      targetNames.length > 0 &&
      targetNames.every((name) => selectedChapters.includes(name))

    if (allSelected) {
      setSelectedChapters((prev) => prev.filter((name) => !targetNames.includes(name)))
    } else {
      setSelectedChapters((prev) => Array.from(new Set([...prev, ...targetNames])))
    }
  }

  const canContinueFromStep = (step: number) => {
    if (step === 1) {
      return selectedSubjects.length > 0
    }
    if (step === 2) {
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

    if (totalQuestions === 0) {
      setErrorMsg("Please specify at least one question format with count > 0 in the blueprint.")
      return
    }

    setErrorMsg(null)
    setIsGenerating(true)
    setGenerationStep(1)

    const timer1 = setTimeout(() => setGenerationStep(2), 2200)
    const timer2 = setTimeout(() => setGenerationStep(3), 5500)

    try {
      const existingQuestionTexts = generatedQuestions.map((q) => q.questionText)
      const targetSubject = activeSubjectTab || selectedSubject
      const countToGenerate = totalQuestions > 0 ? totalQuestions : questionCount

      const res = await fetch("/api/admin/generate-competitive-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          exam: selectedExam,
          grade: selectedGrade,
          subject: targetSubject,
          chapters: selectedChapters,
          topics: selectedTopics,
          syllabusText: uploadedSyllabusText,
          difficulty,
          questionCount: countToGenerate,
          questionPattern: pattern,
          blueprintFormats: blueprintFormats,
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
          : targetSubject
      setExamTitle(`${selectedExam} ${targetSubject} - ${chapterTitle}`)

      // Transition to Step 3
      setCurrentStep(3)

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
    <div className="min-h-screen bg-[#F8FAFC] pb-16 pt-6 sm:pt-8">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-8 lg:px-10">
        {/* ─── Breadcrumbs ─── */}
        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 mb-2">
          <Link href="/admin/exams" className="hover:text-slate-900 transition-colors">
            Exams
          </Link>
          <span>/</span>
          <span className="text-slate-900 font-semibold">Competitive Test</span>
        </div>

        {/* ─── Studio Title & Badges Header ─── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Competitive Test Studio
          </h1>

          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#ECFDF5] text-[#047857] border border-[#A7F3D0] text-xs font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#059669]" />
              <span>NCERT Aligned</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE] text-xs font-semibold">
              <Zap className="w-3.5 h-3.5 text-[#2563EB]" />
              <span>10-Yr PYQ Bank</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold">
              <Layers className="w-3.5 h-3.5 text-slate-600" />
              <span>Zero Repetition</span>
            </span>
          </div>
        </div>

        <div className="space-y-6">
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

        {/* ─── 6-Step Stepper Card ─── */}
        <div className="mb-6 bg-white rounded-2xl border border-slate-200/80 px-4 py-5 sm:px-8 shadow-xs">
            <div className="flex items-center justify-between">
              {STEPS.map((s, index) => {
                const isCurrent = s.step === currentStep
                const isComplete = s.step < currentStep

                return (
                  <div key={s.step} className="flex-1 flex items-center">
                    <div className="flex flex-col items-center flex-1">
                      <button
                        type="button"
                        onClick={() => s.step <= currentStep && setCurrentStep(s.step)}
                        className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold transition-all cursor-pointer ${
                          isCurrent
                            ? "bg-[#1E293B] text-white shadow-sm"
                            : isComplete
                            ? "bg-emerald-500 text-white"
                            : "bg-white text-slate-400 border border-slate-300"
                        }`}
                      >
                        {isComplete ? <Check className="w-4 h-4 stroke-[2.5]" /> : s.step}
                      </button>
                      <span
                        className={`mt-2 text-xs font-semibold transition-colors ${
                          isCurrent ? "text-slate-900" : isComplete ? "text-emerald-700" : "text-slate-400"
                        }`}
                      >
                        {s.label}
                      </span>
                    </div>
                    {index < STEPS.length - 1 && (
                      <div
                        className={`h-[1.5px] w-full max-w-[120px] -mt-5 transition-colors ${
                          s.step < currentStep ? "bg-emerald-400" : "bg-slate-200"
                        }`}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* ─── STEP 1: EXAM DETAILS ─── */}
          {currentStep === 1 && (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 pb-10 shadow-xs relative z-20">
              <div className="mb-8">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  STEP 1 · EXAM DETAILS
                </p>
                <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
                  Choose Exam, Class and Subjects
                </h2>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
                {/* Column 1: Exam */}
                <div className={`lg:col-span-3 lg:pr-6 relative ${examDropdownOpen ? "z-50" : "z-20"}`}>
                  <label className="block text-xs font-bold text-slate-700 mb-2">
                    Exam
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setExamDropdownOpen(!examDropdownOpen)
                      setSubjectDropdownOpen(false)
                    }}
                    className="w-full h-12 px-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 flex items-center justify-between text-sm font-semibold text-slate-900 transition-colors shadow-2xs focus:outline-none focus:ring-2 focus:ring-slate-900/10 cursor-pointer"
                  >
                    <span>{currentExamMeta.title}</span>
                    <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${examDropdownOpen ? "rotate-180" : ""}`} />
                  </button>

                  {examDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setExamDropdownOpen(false)} />
                      <div className="absolute top-[calc(100%+6px)] left-0 right-0 z-50 bg-white rounded-xl border border-slate-200 shadow-xl p-1.5 animate-in fade-in-50 zoom-in-95">
                        {EXAM_TARGETS.map((exam) => (
                          <button
                            key={exam.id}
                            type="button"
                            onClick={() => handleExamChange(exam.id)}
                            className={`w-full px-3 py-2 rounded-lg text-left text-xs sm:text-sm font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                              selectedExam === exam.id
                                ? "bg-slate-100 text-[#1E293B] font-bold"
                                : "text-slate-700 hover:bg-slate-50"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span>{exam.title}</span>
                              <span className="text-[10px] text-slate-400 font-normal px-1.5 py-0.5 bg-slate-50 rounded border border-slate-100">
                                {exam.badge}
                              </span>
                            </div>
                            {selectedExam === exam.id && <Check className="w-3.5 h-3.5 text-[#1E293B] shrink-0" />}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* Column 2: Class / Standard */}
                <div className="lg:col-span-4 lg:px-6 pt-5 lg:pt-0 relative z-10">
                  <label className="block text-xs font-bold text-slate-700 mb-2">
                    Class / Standard
                  </label>
                  <div className="flex items-center gap-2">
                    {[
                      { id: "11", label: "Class 11th" },
                      { id: "12", label: "Class 12th" },
                      { id: "both", label: "11th + 12th" },
                    ].map((cls) => {
                      const isSelected = selectedGrade === cls.id
                      return (
                        <button
                          key={cls.id}
                          type="button"
                          onClick={() => handleGradeChange(cls.id as any)}
                          className={`flex-1 h-12 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-150 cursor-pointer ${
                            isSelected
                              ? "border-2 border-slate-900 bg-white text-slate-900 shadow-xs"
                              : "border border-slate-200 bg-slate-50/60 hover:bg-slate-100/80 text-slate-600"
                          }`}
                        >
                          {cls.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Column 3: Subjects */}
                <div className={`lg:col-span-5 lg:pl-6 pt-5 lg:pt-0 relative ${subjectDropdownOpen ? "z-50" : "z-20"}`}>
                  <label className="block text-xs font-bold text-slate-700 mb-2">
                    Subjects
                  </label>
                  <div
                    onClick={() => {
                      setSubjectDropdownOpen(!subjectDropdownOpen)
                      setExamDropdownOpen(false)
                    }}
                    className="w-full min-h-[48px] px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 flex items-center justify-between gap-2 transition-colors cursor-pointer shadow-2xs"
                  >
                    <div className="flex flex-wrap items-center gap-1.5">
                      {selectedSubjects.map((sub) => (
                        <span
                          key={sub}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-blue-50 text-blue-900 text-xs font-semibold border border-blue-200/60"
                        >
                          <span>{sub}</span>
                          <span
                            onClick={(e) => handleRemoveSubject(e, sub)}
                            className="hover:bg-blue-100 rounded-sm p-0.5 text-blue-700 cursor-pointer transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </span>
                        </span>
                      ))}
                    </div>
                    <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 ml-auto transition-transform duration-200 ${subjectDropdownOpen ? "rotate-180" : ""}`} />
                  </div>

                  {subjectDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setSubjectDropdownOpen(false)} />
                      <div className="absolute top-[calc(100%+6px)] left-0 right-0 z-50 bg-white rounded-xl border border-slate-200 shadow-xl p-1.5 animate-in fade-in-50 zoom-in-95">
                        <p className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Select subjects
                        </p>
                        {availableSubjects.map((sub) => {
                          const isChecked = selectedSubjects.includes(sub)
                          return (
                            <button
                              key={sub}
                              type="button"
                              onClick={() => handleToggleSubject(sub)}
                              className="w-full px-3 py-1.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 rounded-lg flex items-center justify-between transition-colors cursor-pointer"
                            >
                              <span>{sub}</span>
                              <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${
                                isChecked ? "bg-[#1E293B] border-[#1E293B] text-white" : "border-slate-300 bg-white"
                              }`}>
                                {isChecked && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ─── STEP 2: CONTENT & BLUEPRINT (MIRO DESIGN) ─── */}
          {currentStep === 2 && (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 shadow-xs">
              {/* Top Header inside card */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-slate-100">
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-700 shadow-2xs">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                      Content & Blueprint
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Select chapters and set question format, marks and difficulty level.
                    </p>
                  </div>
                </div>

                {/* Selected Summary Badges & Edit Icon */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-3.5 py-1.5 rounded-full bg-slate-50 border border-slate-200/80 text-xs font-semibold text-slate-700">
                    Class:{" "}
                    <span className="font-bold text-slate-900">
                      {selectedGrade === "both"
                        ? "11th + 12th"
                        : selectedGrade === "11"
                        ? "Class 11th"
                        : "Class 12th"}
                    </span>
                  </span>
                  <span className="px-3.5 py-1.5 rounded-full bg-slate-50 border border-slate-200/80 text-xs font-semibold text-slate-700">
                    Subjects:{" "}
                    <span className="font-bold text-slate-900">
                      {selectedSubjects.slice(0, 3).join(", ") +
                        (selectedSubjects.length > 3
                          ? ` +${selectedSubjects.length - 3} more`
                          : "")}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    title="Edit Exam, Class or Subjects"
                    className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Two-Column Grid: Chapter Selection & Question Blueprint */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start pt-6">
                {/* Left Column: Chapter Selection */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="w-1 h-4 bg-slate-900 rounded-full" />
                    <h3 className="text-base font-bold text-slate-900">Chapter Selection</h3>
                  </div>

                  {/* Subject Filter Pills */}
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    {selectedSubjects.map((sub) => {
                      const count = getChapters(selectedExam, selectedGrade, sub).length
                      const isActive = activeSubjectTab === sub
                      return (
                        <button
                          key={sub}
                          type="button"
                          onClick={() => {
                            setActiveSubjectTab(sub)
                            setSelectedSubject(sub)
                          }}
                          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                            isActive
                              ? "bg-[#1E293B] text-white shadow-xs"
                              : "bg-white border border-slate-200 text-slate-700 hover:border-slate-300"
                          }`}
                        >
                          {sub} ({count})
                        </button>
                      )
                    })}
                  </div>

                  {/* Class Filter Chips */}
                  <div className="flex items-center gap-2 mb-4">
                    {[
                      { id: "all", label: `All (${currentSubjectChapters.length})` },
                      { id: "11", label: `Class 11 (${class11Chapters.length})` },
                      { id: "12", label: `Class 12 (${class12Chapters.length})` },
                    ].map((cf) => (
                      <button
                        key={cf.id}
                        type="button"
                        onClick={() => setClassFilter(cf.id as any)}
                        className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                          classFilter === cf.id
                            ? "bg-blue-100 text-blue-700 font-bold"
                            : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300"
                        }`}
                      >
                        {cf.label}
                      </button>
                    ))}
                  </div>

                  {/* Accordion Rows for Class 11 and Class 12 */}
                  <div className="space-y-3">
                    {/* Class 11 Row */}
                    {(classFilter === "all" || classFilter === "11") && class11Chapters.length > 0 && (
                      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden transition-all shadow-2xs">
                        <div className="p-3.5 flex items-center justify-between hover:bg-slate-50/70 transition-colors">
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedClasses((prev) => ({ ...prev, "11": !prev["11"] }))
                              }
                              className="text-slate-400 hover:text-slate-700 cursor-pointer p-0.5"
                            >
                              <ChevronDown
                                className={`w-4 h-4 transition-transform duration-200 ${
                                  expandedClasses["11"] ? "rotate-180" : ""
                                }`}
                              />
                            </button>
                            <label className="flex items-center gap-2.5 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={
                                  class11Chapters.length > 0 &&
                                  class11Chapters.every((c) => selectedChapters.includes(c.name))
                                }
                                onChange={() => toggleAllClass("11")}
                                className="w-4 h-4 rounded text-[#1E293B] focus:ring-slate-900 border-slate-300 cursor-pointer"
                              />
                              <span className="font-bold text-slate-900 text-xs sm:text-sm">
                                Class 11 ({class11Chapters.length} chapters)
                              </span>
                            </label>
                          </div>
                          <ChevronRight
                            onClick={() =>
                              setExpandedClasses((prev) => ({ ...prev, "11": !prev["11"] }))
                            }
                            className="w-4 h-4 text-slate-400 cursor-pointer"
                          />
                        </div>

                        {expandedClasses["11"] && (
                          <div className="px-4 py-3 bg-slate-50/50 border-t border-slate-100 max-h-56 overflow-y-auto space-y-2">
                            {class11Chapters.map((ch, idx) => {
                              const isChecked = selectedChapters.includes(ch.name)
                              return (
                                <label
                                  key={ch.id || ch.name}
                                  className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer hover:text-slate-900 py-1"
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => toggleChapter(ch.name)}
                                    className="mt-0.5 w-3.5 h-3.5 rounded text-[#1E293B] focus:ring-slate-900 border-slate-300 cursor-pointer"
                                  />
                                  <span className="font-medium">
                                    <span className="text-slate-400 mr-1.5">{idx + 1}.</span>
                                    {ch.name}
                                  </span>
                                </label>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Class 12 Row */}
                    {(classFilter === "all" || classFilter === "12") && class12Chapters.length > 0 && (
                      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden transition-all shadow-2xs">
                        <div className="p-3.5 flex items-center justify-between hover:bg-slate-50/70 transition-colors">
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedClasses((prev) => ({ ...prev, "12": !prev["12"] }))
                              }
                              className="text-slate-400 hover:text-slate-700 cursor-pointer p-0.5"
                            >
                              <ChevronDown
                                className={`w-4 h-4 transition-transform duration-200 ${
                                  expandedClasses["12"] ? "rotate-180" : ""
                                }`}
                              />
                            </button>
                            <label className="flex items-center gap-2.5 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={
                                  class12Chapters.length > 0 &&
                                  class12Chapters.every((c) => selectedChapters.includes(c.name))
                                }
                                onChange={() => toggleAllClass("12")}
                                className="w-4 h-4 rounded text-[#1E293B] focus:ring-slate-900 border-slate-300 cursor-pointer"
                              />
                              <span className="font-bold text-slate-900 text-xs sm:text-sm">
                                Class 12 ({class12Chapters.length} chapters)
                              </span>
                            </label>
                          </div>
                          <ChevronRight
                            onClick={() =>
                              setExpandedClasses((prev) => ({ ...prev, "12": !prev["12"] }))
                            }
                            className="w-4 h-4 text-slate-400 cursor-pointer"
                          />
                        </div>

                        {expandedClasses["12"] && (
                          <div className="px-4 py-3 bg-slate-50/50 border-t border-slate-100 max-h-56 overflow-y-auto space-y-2">
                            {class12Chapters.map((ch, idx) => {
                              const isChecked = selectedChapters.includes(ch.name)
                              return (
                                <label
                                  key={ch.id || ch.name}
                                  className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer hover:text-slate-900 py-1"
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => toggleChapter(ch.name)}
                                    className="mt-0.5 w-3.5 h-3.5 rounded text-[#1E293B] focus:ring-slate-900 border-slate-300 cursor-pointer"
                                  />
                                  <span className="font-medium">
                                    <span className="text-slate-400 mr-1.5">{idx + 1}.</span>
                                    {ch.name}
                                  </span>
                                </label>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Selected Status Bar */}
                  <div className="mt-4 px-4 py-2.5 rounded-xl bg-blue-50/70 border border-blue-100 flex items-center gap-2 text-xs font-semibold text-blue-900">
                    <Check className="w-4 h-4 text-blue-600 stroke-[2.5]" />
                    <span>Selected: {selectedChapters.length} Chapters</span>
                  </div>
                </div>

                {/* Right Column: Question Blueprint */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="w-1 h-4 bg-slate-900 rounded-full" />
                    <h3 className="text-base font-bold text-slate-900">Question Blueprint</h3>
                  </div>

                  {/* Blueprint Matrix Table */}
                  <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
                    <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-slate-50/80 border-b border-slate-100 text-xs font-bold text-slate-700">
                      <span className="col-span-6">Question Format</span>
                      <span className="col-span-3 text-center">No. of Questions</span>
                      <span className="col-span-3 text-center">Marks per Question</span>
                    </div>

                    <div className="divide-y divide-slate-100">
                      {blueprintFormats.map((f) => (
                        <div
                          key={f.id}
                          className={`grid grid-cols-12 gap-2 px-4 py-3 items-center transition-colors ${
                            f.checked ? "bg-white" : "bg-slate-50/40 opacity-75"
                          }`}
                        >
                          <label className="col-span-6 flex items-center gap-2.5 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={f.checked}
                              onChange={() => toggleFormatCheck(f.id)}
                              className="w-4 h-4 rounded text-[#1E293B] focus:ring-slate-900 border-slate-300 cursor-pointer"
                            />
                            <span className="font-semibold text-slate-800 text-xs sm:text-sm">
                              {f.label}
                            </span>
                          </label>

                          <div className="col-span-3 flex justify-center">
                            <select
                              disabled={!f.checked}
                              value={f.count}
                              onChange={(e) => updateFormatCount(f.id, Number(e.target.value))}
                              className="w-20 h-9 px-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900 cursor-pointer disabled:bg-slate-100 disabled:text-slate-400"
                            >
                              {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50].map((num) => (
                                <option key={num} value={num}>
                                  {num}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="col-span-3 flex justify-center">
                            <select
                              disabled={!f.checked}
                              value={f.marks}
                              onChange={(e) => updateFormatMarks(f.id, Number(e.target.value))}
                              className="w-16 h-9 px-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900 cursor-pointer disabled:bg-slate-100 disabled:text-slate-400"
                            >
                              {[0, 1, 2, 3, 4, 5].map((m) => (
                                <option key={m} value={m}>
                                  {m}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Info Summary: Total Questions & Marks */}
                  <div className="mt-4 px-4 py-3 rounded-xl bg-blue-50/70 border border-blue-100 flex items-center gap-3 text-xs text-blue-950 font-medium">
                    <Info className="w-4 h-4 text-blue-600 shrink-0" />
                    <div className="flex items-center gap-3">
                      <span>
                        Total Questions:{" "}
                        <strong className="font-bold text-slate-900">{totalQuestions}</strong>
                      </span>
                      <span className="text-blue-200">|</span>
                      <span>
                        Total Marks:{" "}
                        <strong className="font-bold text-slate-900">{totalMarks}</strong>
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Section: Difficulty Level */}
              <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
                    <BarChart2 className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">Difficulty Level</p>
                    <p className="text-xs text-slate-400">Choose the challenge level for learners.</p>
                  </div>
                </div>

                <div className="md:w-80">
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value as any)}
                    className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-semibold text-slate-800 shadow-2xs focus:outline-none focus:ring-2 focus:ring-slate-900/10 cursor-pointer"
                  >
                    <option value="easy">Easy (Concept & Formula Foundations)</option>
                    <option value="medium">Medium (Standard Entrance Level)</option>
                    <option value="balanced">Balanced (NTA Standard 30:50:20)</option>
                    <option value="hard">Hard (Rank Booster / High Rigor)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* ─── STEP 3: QUESTIONS REVIEW & PUBLISHING WORKSPACE ─── */}
          {currentStep === 3 && (
            <div className="space-y-6">
              {generatedQuestions.length === 0 ? (
                /* Empty state when no questions generated yet */
                <div className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center shadow-xs">
                  <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-500 mx-auto flex items-center justify-center mb-4">
                    <FileQuestion className="w-7 h-7" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-1">No Questions Generated Yet</h3>
                  <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto mb-6">
                    Configure your chapter selections and question blueprint in Step 2, then click &ldquo;Create Questions&rdquo; to generate exam questions.
                  </p>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    className="px-6 py-2.5 rounded-xl bg-[#1E293B] hover:bg-[#0F172A] text-white font-semibold text-sm transition-colors cursor-pointer inline-flex items-center gap-2"
                  >
                    <span>Go to Step 2 (Content & Blueprint)</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <>
                  {/* Action Bar Header Card */}
                  <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-xs flex flex-col xl:flex-row items-start xl:items-center justify-between gap-5">
                    <div className="flex-1 w-full xl:w-auto">
                      <div className="flex items-center gap-2.5 mb-2 flex-wrap">
                        <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{generatedQuestions.length} Questions Created</span>
                        </span>
                        <span className="text-xs text-slate-500 font-semibold">
                          {selectedQuestionIds.size} of {generatedQuestions.length} selected for paper
                        </span>
                        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                          Total Marks: {generatedQuestions.filter((q) => selectedQuestionIds.has(q.id)).reduce((acc, q) => acc + (q.marks || 4), 0)}
                        </span>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
                        <label className="text-xs font-bold text-slate-600 shrink-0">Exam Title:</label>
                        <input
                          type="text"
                          value={examTitle}
                          onChange={(e) => setExamTitle(e.target.value)}
                          placeholder="Enter exam paper title..."
                          className="px-3.5 py-2 text-sm font-semibold rounded-xl border border-slate-200 bg-slate-50 text-slate-900 w-full sm:w-96 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 focus:bg-white"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 flex-wrap w-full xl:w-auto justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedQuestionIds.size === generatedQuestions.length) {
                            setSelectedQuestionIds(new Set())
                          } else {
                            setSelectedQuestionIds(new Set(generatedQuestions.map((q) => q.id)))
                          }
                        }}
                        className="px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5 text-slate-500" />
                        <span>
                          {selectedQuestionIds.size === generatedQuestions.length ? "Deselect All" : "Select All"}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setCurrentStep(2)}
                        className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
                      >
                        <Sliders className="w-3.5 h-3.5 text-slate-500" />
                        <span>Tweak Blueprint</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleSaveAsExam}
                        disabled={creatingExam || selectedQuestionIds.size === 0}
                        className="px-6 py-2.5 rounded-xl bg-[#1E293B] hover:bg-[#0F172A] text-white text-xs sm:text-sm font-semibold shadow-sm flex items-center gap-2 disabled:opacity-40 transition-all cursor-pointer"
                      >
                        {creatingExam ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin text-amber-300" />
                            <span>Publishing Exam...</span>
                          </>
                        ) : (
                          <>
                            <span>Publish Exam ({selectedQuestionIds.size})</span>
                            <ArrowRight className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Format Filter Tabs */}
                  {generatedQuestions.length > 0 && (
                    <div className="flex items-center gap-2 overflow-x-auto pb-1">
                      <button
                        type="button"
                        onClick={() => setFormatFilter("all")}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          formatFilter === "all"
                            ? "bg-[#1E293B] text-white shadow-xs"
                            : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        All Formats ({formatCounts.all})
                      </button>
                      {formatCounts.mcq > 0 && (
                        <button
                          type="button"
                          onClick={() => setFormatFilter("mcq")}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            formatFilter === "mcq"
                              ? "bg-blue-600 text-white shadow-xs"
                              : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          MCQ ({formatCounts.mcq})
                        </button>
                      )}
                      {formatCounts.assertion > 0 && (
                        <button
                          type="button"
                          onClick={() => setFormatFilter("assertion")}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            formatFilter === "assertion"
                              ? "bg-amber-600 text-white shadow-xs"
                              : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          Assertion & Reason ({formatCounts.assertion})
                        </button>
                      )}
                      {formatCounts.fib > 0 && (
                        <button
                          type="button"
                          onClick={() => setFormatFilter("fib")}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            formatFilter === "fib"
                              ? "bg-purple-600 text-white shadow-xs"
                              : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          Fill in the Blanks ({formatCounts.fib})
                        </button>
                      )}
                      {formatCounts.true_false > 0 && (
                        <button
                          type="button"
                          onClick={() => setFormatFilter("true_false")}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            formatFilter === "true_false"
                              ? "bg-cyan-600 text-white shadow-xs"
                              : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          True / False ({formatCounts.true_false})
                        </button>
                      )}
                    </div>
                  )}

                  {/* Generated Questions List */}
                  <div className="space-y-4">
                    {filteredGeneratedQuestions.map((q, idx) => {
                      const isSelected = selectedQuestionIds.has(q.id)
                      const isExpanded = expandedSolutions.has(q.id)
                      const formatLabel =
                        q.questionFormat === "assertion" ? "Assertion & Reason" :
                        q.questionFormat === "fib" ? "Fill in the Blanks" :
                        q.questionFormat === "true_false" ? "True / False" : "MCQ"

                      return (
                        <div
                          key={q.id || idx}
                          className={`bg-white rounded-2xl border transition-all p-5 sm:p-6 shadow-xs ${
                            isSelected
                              ? "border-slate-300 ring-2 ring-slate-900/5 shadow-2xs"
                              : "border-slate-200 opacity-60 bg-slate-50/40"
                          }`}
                        >
                          {/* Question Header */}
                          <div className="flex items-start justify-between gap-3 mb-4">
                            <div className="flex items-center gap-2.5 flex-wrap">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleQuestionSelection(q.id)}
                                className="w-4 h-4 rounded text-[#1E293B] focus:ring-[#1E293B] cursor-pointer accent-[#1E293B]"
                              />
                              <span className="w-7 h-7 rounded-xl bg-[#1E293B] text-white text-xs font-bold flex items-center justify-center shadow-2xs">
                                {idx + 1}
                              </span>
                              <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800">
                                {q.chapter}
                              </span>
                              <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg border ${
                                q.questionFormat === "assertion"
                                  ? "bg-amber-50 text-amber-800 border-amber-200"
                                  : q.questionFormat === "fib"
                                  ? "bg-purple-50 text-purple-800 border-purple-200"
                                  : q.questionFormat === "true_false"
                                  ? "bg-cyan-50 text-cyan-800 border-cyan-200"
                                  : "bg-blue-50 text-blue-800 border-blue-200"
                              }`}>
                                {formatLabel}
                              </span>
                              {q.pyqReference && (
                                <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200/60 flex items-center gap-1">
                                  <Target className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>{q.pyqReference}</span>
                                </span>
                              )}
                              <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700">
                                {q.difficulty}
                              </span>
                              <span className="text-xs text-slate-500 font-semibold">
                                +{q.marks} / -{q.negativeMark} marks
                              </span>
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setEditingQuestion(q)}
                                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                                title="Edit Question"
                              >
                                <Edit3 size={16} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteQuestion(q.id)}
                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                                title="Delete Question"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>

                          {/* Question Statement with LaTeX Math & Matrices */}
                          <div className="text-sm sm:text-base font-semibold text-slate-900 pl-0 sm:pl-9 mb-5 leading-relaxed overflow-x-auto">
                            <MathRenderer content={q.questionText} />
                          </div>

                          {/* Options Grid */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-0 sm:pl-9 mb-4">
                            {q.options.map((opt, oi) => {
                              const isCorrect = opt === q.correctAnswer
                              const label = ["A", "B", "C", "D"][oi]

                              return (
                                <div
                                  key={oi}
                                  className={`p-3.5 rounded-xl border flex items-start gap-3 transition-all ${
                                    isCorrect
                                      ? "bg-emerald-50/70 border-emerald-500 text-emerald-950 font-medium shadow-2xs"
                                      : "bg-slate-50/60 border-slate-200 text-slate-700 hover:bg-white"
                                  }`}
                                >
                                  <span
                                    className={`w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center shrink-0 ${
                                      isCorrect
                                        ? "bg-emerald-600 text-white shadow-2xs"
                                        : "bg-white border border-slate-200 text-slate-700"
                                    }`}
                                  >
                                    {isCorrect ? "✓" : label}
                                  </span>
                                  <div className="flex-1 text-xs sm:text-sm pt-0.5 overflow-x-auto">
                                    <MathRenderer content={opt} />
                                  </div>
                                </div>
                              )
                            })}
                          </div>

                          {/* Solution Accordion */}
                          <div className="pl-0 sm:pl-9 pt-2">
                            <button
                              type="button"
                              onClick={() => toggleSolution(q.id)}
                              className="text-xs font-bold text-slate-700 hover:text-slate-900 hover:underline flex items-center gap-1.5 cursor-pointer"
                            >
                              {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                              <span>{isExpanded ? "Hide Solution" : "View Step-by-Step Solution"}</span>
                            </button>

                            {isExpanded && (
                              <div className="mt-3 p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-700 leading-relaxed space-y-2 overflow-x-auto">
                                <span className="font-bold text-slate-900 block text-xs uppercase tracking-wider text-slate-500">
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
                </>
              )}
            </div>
          )}
          {/* ─── Bottom Navigation Actions ─── */}
          <div className="mt-8 flex items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                if (currentStep > 1) {
                  setCurrentStep((step) => step - 1)
                } else {
                  router.push("/admin/exams")
                }
              }}
              className="px-6 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold text-sm hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
            >
              Back
            </button>

            {currentStep === 1 && (
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                disabled={selectedSubjects.length === 0}
                className="px-6 py-2.5 rounded-xl bg-[#1E293B] hover:bg-[#0F172A] text-white font-semibold text-sm flex items-center gap-2 shadow-sm transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span>Next Step</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}

            {currentStep === 2 && (
              <button
                type="button"
                onClick={handleGenerate}
                disabled={
                  isGenerating ||
                  (selectedChapters.length === 0 && selectedTopics.length === 0 && !uploadedSyllabusText) ||
                  totalQuestions === 0
                }
                className="px-7 py-3 rounded-xl bg-[#1E293B] hover:bg-[#0F172A] text-white font-semibold text-sm flex items-center gap-2.5 shadow-md transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-lg active:scale-[0.99]"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-amber-300" />
                    <span>Generating Questions...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>Create Questions ({totalQuestions})</span>
                  </>
                )}
              </button>
            )}

            {currentStep === 3 && (
              <button
                type="button"
                onClick={handleSaveAsExam}
                disabled={creatingExam || selectedQuestionIds.size === 0}
                className="px-7 py-3 rounded-xl bg-[#1E293B] hover:bg-[#0F172A] text-white font-semibold text-sm flex items-center gap-2.5 shadow-md transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-lg active:scale-[0.99]"
              >
                {creatingExam ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-amber-300" />
                    <span>Publishing Exam Paper...</span>
                  </>
                ) : (
                  <>
                    <span>Publish Exam Paper</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            )}
          </div>
      </div>
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
