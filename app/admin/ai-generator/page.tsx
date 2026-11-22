"use client"

import { useState, useMemo, useRef, useEffect, KeyboardEvent, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
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
  Calendar,
  Award,
  X,
  FileQuestion,
  Filter,
  Info,
  ChevronRight,
  BarChart2,
  Printer,
  Lock,
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
import { PrintableExamPaper } from "@/components/admin/PrintableExamPaper"
import { QuestionDiagram } from "@/components/exam/QuestionDiagram"
import { toast } from "sonner"

export interface GeneratedCompetitiveQuestion {
  id: string
  type: "mcq" | "descriptive"
  questionFormat?: "mcq" | "diagram" | "assertion" | "fib" | "true_false" | "descriptive" | string
  questionText: string
  questionImage?: string
  difficulty: "easy" | "medium" | "hard"
  marks: number
  negativeMark: number
  options: string[]
  correctAnswer: string
  explanation: string
  chapter: string
  pyqReference?: string
  wordLimit?: number
}

function AIGeneratorContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editExamId = searchParams.get("edit")
  const [editingExamId, setEditingExamId] = useState<string | null>(editExamId)
  const [isLoadingExistingExam, setIsLoadingExistingExam] = useState(false)

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
    "11": true,
    "12": false,
  })

  // Blueprint Format Matrix - Match Screenshot (No Coding)
  const [blueprintFormats, setBlueprintFormats] = useState([
    { id: "mcq", label: "MCQ (Single Correct)", checked: true, count: 50, marks: 1 },
    { id: "mcq_multi", label: "MCQ (Multiple Correct)", checked: false, count: 0, marks: 1 },
    { id: "assertion", label: "Assertion & Reason", checked: false, count: 0, marks: 1 },
    { id: "true_false", label: "True / False", checked: false, count: 0, marks: 1 },
    { id: "fib", label: "Fill in the Blanks", checked: false, count: 0, marks: 1 },
    { id: "descriptive", label: "Description / Descriptive", checked: false, count: 0, marks: 2 },
    { id: "diagram", label: "Diagram / Visual", checked: false, count: 0, marks: 1 },
  ])

  // Subject-wise Marks & Syllabus Weightage States (Screenshot Match)
  const [subjectDist, setSubjectDist] = useState<Record<string, { questions: number; marks: number }>>({
    Physics: { questions: 50, marks: 50 },
    Chemistry: { questions: 50, marks: 50 },
    Mathematics: { questions: 50, marks: 100 },
  })
  const [class11Weightage, setClass11Weightage] = useState<number>(20)
  const [class12Weightage, setClass12Weightage] = useState<number>(80)

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
  const [isGeneratingMissing, setIsGeneratingMissing] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Questions Review & Publishing
  const [generatedQuestions, setGeneratedQuestions] = useState<GeneratedCompetitiveQuestion[]>([])
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<Set<string>>(new Set())
  const [expandedSolutions, setExpandedSolutions] = useState<Set<string>>(new Set())
  const [examTitle, setExamTitle] = useState("")
  const [creatingExam, setCreatingExam] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState<GeneratedCompetitiveQuestion | null>(null)
  const [formatFilter, setFormatFilter] = useState<string>("all")
  const [printModalOpen, setPrintModalOpen] = useState(false)
  const [printMode, setPrintMode] = useState<"student" | "teacher">("student")
  const [printDropdownOpen, setPrintDropdownOpen] = useState(false)
  const [coachingName, setCoachingName] = useState<string>("")
  const [hasCompetitiveAccess, setHasCompetitiveAccess] = useState<boolean | null>(null)
  const [isExamQuotaReached, setIsExamQuotaReached] = useState(false)
  const [maxExams, setMaxExams] = useState(20)
  const [examCount, setExamCount] = useState(0)

  useEffect(() => {
    fetch("/api/admin/institute-access", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        setHasCompetitiveAccess(data.hasCompetitiveAccess !== false)
        setIsExamQuotaReached(Boolean(data.isExamQuotaReached))
        if (data.maxExams !== undefined) setMaxExams(Number(data.maxExams))
        if (data.examCount !== undefined) setExamCount(Number(data.examCount))
      })
      .catch(() => {
        setHasCompetitiveAccess(true)
        setIsExamQuotaReached(false)
      })
  }, [])

  // Load existing exam for editing if ?edit=<id> is present
  useEffect(() => {
    if (!editExamId) return
    setIsLoadingExistingExam(true)
    fetch(`/api/exams/${editExamId}`, { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        if (!data?.exam) {
          toast.error("Exam not found")
          setIsLoadingExistingExam(false)
          return
        }
        const exam = data.exam
        setEditingExamId(exam._id)
        if (exam.title) setExamTitle(exam.title)
        if (exam.examType && ["NEET", "JEE_MAIN", "JEE_ADVANCED", "MHT_CET"].includes(exam.examType)) {
          setSelectedExam(exam.examType as ExamTarget)
        }
        if (exam.subject) {
          setSelectedSubject(exam.subject as CompetitiveSubject)
          setSelectedSubjects([exam.subject as CompetitiveSubject])
          setActiveSubjectTab(exam.subject as CompetitiveSubject)
        }
        if (exam.class) {
          if (exam.class.includes("11") && exam.class.includes("12")) {
            setSelectedGrade("both")
          } else if (exam.class.includes("11")) {
            setSelectedGrade("11")
          } else if (exam.class.includes("12")) {
            setSelectedGrade("12")
          }
        }
        if (exam.duration) setDuration(exam.duration)
        if (exam.totalMarks) setExamTotalMarks(exam.totalMarks)
        if (exam.passMarks) setPassMarks(exam.passMarks)
        if (exam.questionsPerMin) setQuestionsPerMinute(String(exam.questionsPerMin))
        if (Array.isArray(exam.instructions)) {
          setInstructions(exam.instructions)
        } else if (typeof exam.instructions === "string") {
          setInstructions(exam.instructions.split("\n").filter(Boolean))
        }

        // Schedule
        if (exam.schedule?.startDate || exam.settings?.startDate) {
          const raw = exam.schedule?.startDate || exam.settings?.startDate
          const d = new Date(raw)
          if (!isNaN(d.getTime())) setStartDate(d.toISOString().split("T")[0])
        }
        if (exam.schedule?.endDate || exam.settings?.endDate) {
          const raw = exam.schedule?.endDate || exam.settings?.endDate
          const d = new Date(raw)
          if (!isNaN(d.getTime())) setEndDate(d.toISOString().split("T")[0])
        }

        // Eval & proctoring
        if (exam.settings) {
          setEvalSettings((prev) => ({
            ...prev,
            randomizeQuestions: exam.settings.randomize ?? prev.randomizeQuestions,
            showResultsImmediately: exam.settings.showResults ?? prev.showResultsImmediately,
            allowReview: exam.settings.allowReview ?? prev.allowReview,
            enableNegativeMarking: exam.settings.negativeMarking ?? prev.enableNegativeMarking,
          }))
          if (exam.settings.proctoring) {
            setProctoringSettings((prev) => ({
              ...prev,
              faceDetection: exam.settings.proctoring.faceDetection ?? prev.faceDetection,
              tabSwitchPrevention: exam.settings.proctoring.tabSwitch ?? exam.settings.proctoring.tabSwitchPrevention ?? prev.tabSwitchPrevention,
              enforceFullscreen: exam.settings.proctoring.fullscreen ?? exam.settings.proctoring.enforceFullscreen ?? prev.enforceFullscreen,
              aiStatusAnalysis: exam.settings.proctoring.aiProctoring ?? exam.settings.proctoring.aiStatusAnalysis ?? prev.aiStatusAnalysis,
            }))
          }
        }

        // Questions mapping
        const loadedQuestions: GeneratedCompetitiveQuestion[] = (exam.sections || []).flatMap((sec: any) =>
          (sec.questions || []).map((q: any, idx: number) => ({
            id: q.id || `loaded_${idx}_${Math.random().toString(36).slice(2, 7)}`,
            type: q.type === "descriptive" || q.questionFormat === "descriptive" ? ("descriptive" as const) : ("mcq" as const),
            questionFormat: q.questionFormat || q.type || "mcq",
            questionText: q.questionText || "",
            questionImage: q.questionImage,
            difficulty: q.difficulty || "medium",
            marks: q.marks || (q.type === "descriptive" ? 5 : 4),
            negativeMark: q.type === "descriptive" ? 0 : (q.negativeMark || (exam.settings?.negativeMarking ? 1 : 0)),
            options: Array.isArray(q.options) ? q.options : [],
            correctAnswer: q.correctAnswer || "",
            explanation: q.explanation || "",
            chapter: q.chapter || exam.subject || "General",
            pyqReference: q.pyqReference,
            wordLimit: q.wordLimit,
          }))
        )

        if (loadedQuestions.length > 0) {
          setGeneratedQuestions(loadedQuestions)
          setSelectedQuestionIds(new Set(loadedQuestions.map((q) => q.id)))
          setCurrentStep(3) // Jump directly to Questions step so user can edit right away!
        }
        setIsLoadingExistingExam(false)
        toast.success(`Loaded "${exam.title}" for editing`)
      })
      .catch((err) => {
        console.error("Failed to load existing exam:", err)
        toast.error("Failed to load exam")
        setIsLoadingExistingExam(false)
      })
  }, [editExamId])

  // Step 4: Exam Details States
  const [duration, setDuration] = useState<number>(30)
  const [examTotalMarks, setExamTotalMarks] = useState<number>(200)
  const [passMarks, setPassMarks] = useState<number>(80)
  const [questionsPerMinute, setQuestionsPerMinute] = useState<string>("")
  const [instructions, setInstructions] = useState<string[]>([
    "Read each question carefully before submitting your answer.",
    "Each question carries 2 marks.",
    "No negative marking applicable.",
    "Formulas and chemical reactions are formatted with scientific standard LaTeX notation.",
  ])

  // Step 5: Schedule & Settings States
  const [startDate, setStartDate] = useState<string>("2026-11-12")
  const [startHour, setStartHour] = useState<string>("10")
  const [startMinute, setStartMinute] = useState<string>("00")
  const [startPeriod, setStartPeriod] = useState<"AM" | "PM">("AM")

  const [endDate, setEndDate] = useState<string>("2026-11-12")
  const [endHour, setEndHour] = useState<string>("01")
  const [endMinute, setEndMinute] = useState<string>("00")
  const [endPeriod, setEndPeriod] = useState<"AM" | "PM">("PM")

  const startDateInputRef = useRef<HTMLInputElement>(null)
  const endDateInputRef = useRef<HTMLInputElement>(null)

  const openDatePicker = (inputRef: React.RefObject<HTMLInputElement | null>) => {
    if (!inputRef.current) return
    try {
      inputRef.current.showPicker?.()
    } catch {
      inputRef.current.focus()
    }
  }

  // Evaluation Options
  const [evalSettings, setEvalSettings] = useState({
    randomizeQuestions: true,
    showResultsImmediately: true,
    allowReview: false,
    enableNegativeMarking: false,
  })

  // Proctoring Security
  const [proctoringSettings, setProctoringSettings] = useState({
    faceDetection: false,
    tabSwitchPrevention: false,
    enforceFullscreen: false,
    aiStatusAnalysis: false,
  })

  const formatDateDisplay = (dateStr: string) => {
    try {
      const [y, m, d] = dateStr.split("-").map(Number)
      if (!y || !m || !d) return dateStr
      const date = new Date(y, m - 1, d)
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    } catch {
      return dateStr
    }
  }

  const parseAssertionReason = (text: string) => {
    if (!text) return null
    const match = text.match(
      /(?:Assertion|Statement\s*1)\s*(?:\([Aa1]\))?\s*:\s*([\s\S]*?)(?:Reason|Statement\s*2)\s*(?:\([Rr2]\))?\s*:\s*([\s\S]*)$/i
    )
    if (match && match[1]?.trim() && match[2]?.trim()) {
      return {
        assertion: match[1].trim(),
        reason: match[2].trim(),
      }
    }
    return null
  }

  const getQuestionFormat = (q: GeneratedCompetitiveQuestion): string => {
    if (
      q.type === "descriptive" ||
      q.questionFormat === "descriptive" ||
      (!q.options || q.options.length === 0)
    ) {
      return "descriptive"
    }
    if (
      q.questionFormat === "true_false" ||
      q.questionText?.toLowerCase().startsWith("true or false") ||
      q.questionText?.toLowerCase().startsWith("true/false") ||
      (Array.isArray(q.options) && q.options.length === 2 && q.options.includes("True"))
    ) {
      return "true_false"
    }
    if (
      q.questionFormat === "assertion" ||
      q.questionFormat === "assertion_reason" ||
      Boolean(parseAssertionReason(q.questionText || ""))
    ) {
      return "assertion"
    }
    if (
      q.questionFormat === "diagram" ||
      Boolean(q.questionImage && String(q.questionImage).includes("<svg"))
    ) {
      return "diagram"
    }
    if (
      q.questionFormat === "fib" ||
      q.questionFormat === "fill_in_the_blanks" ||
      q.questionText?.includes("______")
    ) {
      return "fib"
    }
    return "mcq"
  }

  const filteredGeneratedQuestions = useMemo(() => {
    if (formatFilter === "all") return generatedQuestions
    return generatedQuestions.filter((q) => getQuestionFormat(q) === formatFilter)
  }, [generatedQuestions, formatFilter])


  const formatCounts = useMemo(() => {
    const counts: Record<string, number> = { all: generatedQuestions.length, mcq: 0, diagram: 0, assertion: 0, fib: 0, true_false: 0, descriptive: 0 }
    generatedQuestions.forEach((q) => {
      const fmt = getQuestionFormat(q)
      if (counts[fmt] !== undefined) counts[fmt]++
      else counts.mcq++
    })
    return counts
  }, [generatedQuestions])

  const getDefaultExamTitle = () => {
    const examCode = selectedExam.replace("-", "_")
    const subjectName = activeSubjectTab || selectedSubject || "Mathematics"
    let chapterPart = ""
    if (selectedChapters.length === 1) {
      chapterPart = ` - ${selectedChapters[0]}`
    } else if (selectedChapters.length > 1) {
      chapterPart = ` - ${selectedChapters[0]} & ${selectedChapters.length - 1} more`
    } else {
      chapterPart = " - Mock Exam"
    }
    return `${examCode} ${subjectName}${chapterPart}`
  }

  // Step 4: Overview Computations
  const { class11SelectedCount, class12SelectedCount } = useMemo(() => {
    const all11Names = new Set(getChapters(selectedExam, "11").map((c) => c.name))
    const all12Names = new Set(getChapters(selectedExam, "12").map((c) => c.name))
    let c11 = 0
    let c12 = 0
    selectedChapters.forEach((chName) => {
      if (all11Names.has(chName)) c11++
      else if (all12Names.has(chName)) c12++
    })
    return { class11SelectedCount: c11, class12SelectedCount: c12 }
  }, [selectedExam, selectedChapters])

  const chaptersOverviewText = useMemo(() => {
    if (selectedChapters.length === 0) {
      return `${generatedQuestions.length > 0 ? generatedQuestions.length : 0} Questions (${selectedGrade === "both" ? "Class 11 + 12" : `Class ${selectedGrade}th`})`
    }
    if (class11SelectedCount > 0 && class12SelectedCount > 0) {
      return `${selectedChapters.length} (Class 11: ${class11SelectedCount} | Class 12: ${class12SelectedCount})`
    }
    if (class11SelectedCount > 0) {
      return `${selectedChapters.length} (Class 11: ${class11SelectedCount})`
    }
    if (class12SelectedCount > 0) {
      return `${selectedChapters.length} (Class 12: ${class12SelectedCount})`
    }
    return `${selectedChapters.length} Chapters`
  }, [selectedChapters, class11SelectedCount, class12SelectedCount, generatedQuestions.length, selectedGrade])

  const questionFormatOverview = useMemo(() => {
    const parts: string[] = []
    if (formatCounts.mcq > 0) parts.push(`MCQ: ${formatCounts.mcq}`)
    if (formatCounts.assertion > 0) parts.push(`Assertion: ${formatCounts.assertion}`)
    if (formatCounts.fib > 0) parts.push(`Fill in the Blanks: ${formatCounts.fib}`)
    if (formatCounts.true_false > 0) parts.push(`True / False: ${formatCounts.true_false}`)
    if (formatCounts.descriptive > 0) parts.push(`Descriptive: ${formatCounts.descriptive}`)

    if (parts.length > 0) return parts.join(" | ")

    const blueprintParts = blueprintFormats
      .filter((f) => f.checked && f.count > 0)
      .map((f) => `${f.label}: ${f.count}`)

    if (blueprintParts.length > 0) return blueprintParts.join(" | ")
    return "MCQ: 30 | Assertion: 10 | Fill in the Blanks: 5"
  }, [formatCounts, blueprintFormats])

  const difficultyOverview = useMemo(() => {
    switch (difficulty) {
      case "easy":
        return "Easy (Concept & Formula Foundations)"
      case "medium":
        return "Medium (Application & Numerical Reasoning)"
      case "hard":
        return "Hard (Advanced Problem Solving)"
      case "balanced":
        return "Balanced (Standard Exam Mix)"
      default:
        return "Easy (Concept & Formula Foundations)"
    }
  }, [difficulty])

  const examOverviewName = useMemo(() => {
    switch (selectedExam) {
      case "MHT_CET":
        return "MHT-CET"
      case "JEE_MAIN":
        return "JEE Main"
      case "JEE_ADVANCED":
        return "JEE Advanced"
      case "NEET":
        return "NEET (UG)"
      case "CBSE_BOARD":
        return "CBSE 12th Board"
      default:
        return String(selectedExam).replace("_", "-")
    }
  }, [selectedExam])

  const classOverviewText = useMemo(() => {
    if (selectedGrade === "both") return "11th + 12th"
    return `${selectedGrade}th`
  }, [selectedGrade])

  const subjectsOverviewText = useMemo(() => {
    if (selectedSubjects.length === 0) return "Physics"
    if (selectedSubjects.length <= 3) return selectedSubjects.join(", ")
    return `${selectedSubjects.slice(0, 3).join(", ")} +${selectedSubjects.length - 3} more`
  }, [selectedSubjects])

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

  // Step 2: Format calculations (guaranteed numeric arithmetic, never string concatenation)
  const totalQuestions = useMemo(() => {
    return blueprintFormats.reduce((acc, f) => {
      const c = f.checked ? Number(f.count) : 0
      return acc + (isNaN(c) ? 0 : c)
    }, 0)
  }, [blueprintFormats])

  const totalMarks = useMemo(() => {
    return blueprintFormats.reduce((acc, f) => {
      const c = f.checked ? Number(f.count) : 0
      const m = Number(f.marks) || 4
      return acc + ((isNaN(c) ? 0 : c) * (isNaN(m) ? 0 : m))
    }, 0)
  }, [blueprintFormats])

  const toggleFormatCheck = (id: string) => {
    setBlueprintFormats((prev) =>
      prev.map((f) => {
        if (f.id === id) {
          const nextChecked = !f.checked
          return {
            ...f,
            checked: nextChecked,
            count: nextChecked && (Number(f.count) || 0) === 0 ? 5 : Number(f.count) || 0,
          }
        }
        return f
      })
    )
  }

  const updateFormatCount = (id: string, count: any) => {
    const parsed = typeof count === "number" ? count : parseInt(String(count), 10)
    const safeCount = isNaN(parsed) ? 0 : Math.max(0, Math.min(200, Math.round(parsed)))
    setBlueprintFormats((prev) =>
      prev.map((f) => (f.id === id ? { ...f, count: safeCount, checked: safeCount > 0 ? true : f.checked } : f))
    )
  }

  const updateFormatMarks = (id: string, marks: any) => {
    const parsed = typeof marks === "number" ? marks : parseInt(String(marks), 10)
    const safeMarks = isNaN(parsed) ? 1 : Math.max(0, Math.min(20, Math.round(parsed)))
    setBlueprintFormats((prev) =>
      prev.map((f) => (f.id === id ? { ...f, marks: safeMarks } : f))
    )
  }

  const updateFormatType = (id: string, newLabel: string) => {
    setBlueprintFormats((prev) =>
      prev.map((f) => (f.id === id ? { ...f, label: newLabel } : f))
    )
  }

  const updateSubjectDist = (sub: string, field: "questions" | "marks", val: number) => {
    setSubjectDist((prev) => ({
      ...prev,
      [sub]: {
        questions: field === "questions" ? val : (prev[sub]?.questions ?? 50),
        marks: field === "marks" ? val : (prev[sub]?.marks ?? 50),
      },
    }))
  }

  const totalSubjectQuestions = useMemo(() => {
    return selectedSubjects.reduce((acc, sub) => acc + (subjectDist[sub]?.questions ?? 50), 0)
  }, [selectedSubjects, subjectDist])

  const totalSubjectMarks = useMemo(() => {
    return selectedSubjects.reduce((acc, sub) => acc + (subjectDist[sub]?.marks ?? (sub === "Mathematics" ? 100 : 50)), 0)
  }, [selectedSubjects, subjectDist])

  const handleClass11WeightageChange = (val: number) => {
    setClass11Weightage(val)
    setClass12Weightage(Math.max(0, 100 - val))
  }

  const handleClass12WeightageChange = (val: number) => {
    setClass12Weightage(val)
    setClass11Weightage(Math.max(0, 100 - val))
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

  // Generate Questions via API (Fast Parallel Concurrent Chunking - Zero Vercel Timeout)
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
    setGeneratedQuestions([])
    setSelectedQuestionIds(new Set())
    setFormatFilter("all")

    const timer1 = setTimeout(() => setGenerationStep(2), 1500)
    const timer2 = setTimeout(() => setGenerationStep(3), 3500)

    const chapterTitle =
      selectedChapters.length === 1
        ? selectedChapters[0]
        : selectedChapters.length > 1
        ? `${selectedChapters[0]} & ${selectedChapters.length - 1} more`
        : ""
    const targetSubject = activeSubjectTab || selectedSubject
    const examCode = selectedExam.replace("-", "_")
    const nextTitle = `${examCode} ${targetSubject}${chapterTitle ? ` - ${chapterTitle}` : ""}`

    const countToGenerate = Math.max(1, Number(totalQuestions) || Number(questionCount) || 10)

    const showQuestions = (questions: GeneratedCompetitiveQuestion[]) => {
      setGeneratedQuestions(questions)
      setSelectedQuestionIds(new Set(questions.map((q) => q.id)))
      setExamTitle(nextTitle)
      const calculatedTotal = questions.reduce((sum, q) => sum + (q.marks || 4), 0) || totalMarks || 200
      setExamTotalMarks(calculatedTotal)
      setPassMarks(Math.round(calculatedTotal * 0.4))
      setDuration(30)
      setCurrentStep(3)
    }

    try {
      // Build micro-batches (max 3 questions, 2 for diagram) so each HTTP request finishes in ~2s
      interface BatchItem {
        id: string
        formatId: string
        formatLabel: string
        count: number
        marks: number
      }

      const activeFormats = blueprintFormats.filter((f) => f.checked && Number(f.count) > 0)
      const batches: BatchItem[] = []

      if (activeFormats.length > 0) {
        for (const fmt of activeFormats) {
          let remaining = Number(fmt.count) || 0
          const marks = Number(fmt.marks) || currentExamMeta.defaultMarksPerQuestion
          const chunkSize = fmt.id === "diagram" ? 2 : 3
          while (remaining > 0) {
            const take = Math.min(remaining, chunkSize)
            batches.push({
              id: `${fmt.id}_${batches.length}_${Math.random().toString(36).slice(2, 6)}`,
              formatId: fmt.id,
              formatLabel: fmt.label || fmt.id,
              count: take,
              marks,
            })
            remaining -= take
          }
        }
      } else {
        let remaining = countToGenerate
        while (remaining > 0) {
          const isDiagram = (pattern as string) === "diagram" || (pattern as string) === "diagram_based"
          const isAssertion = pattern === "assertion_reason" || (pattern as string) === "assertion"
          const chunkSize = isDiagram ? 2 : 3
          const take = Math.min(remaining, chunkSize)
          batches.push({
            id: `batch_${batches.length}_${Math.random().toString(36).slice(2, 6)}`,
            formatId: isDiagram ? "diagram" : isAssertion ? "assertion" : "mcq",
            formatLabel: isDiagram ? "Diagram / Visual" : isAssertion ? "Assertion & Reason" : "MCQ",
            count: take,
            marks: currentExamMeta.defaultMarksPerQuestion,
          })
          remaining -= take
        }
      }

      const queue = [...batches]
      let allGenerated: GeneratedCompetitiveQuestion[] = []
      const seenTexts = new Set<string>()
      let openedReview = false
      const batchErrors: string[] = []

      // Concurrency 2: Dispatches 2 parallel lightweight requests at a time across Gemini API key pool
      const CONCURRENCY = 2

      const runWorker = async () => {
        while (queue.length > 0) {
          const batch = queue.shift()
          if (!batch) break

          let retries = 1
          let batchSuccess = false

          while (retries >= 0 && !batchSuccess) {
            try {
              const existingTexts = allGenerated.map((q) => q.questionText).slice(-25)

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
                  questionCount: batch.count,
                  questionPattern: pattern,
                  blueprintFormats: [
                    {
                      id: batch.formatId,
                      label: batch.formatLabel,
                      count: batch.count,
                      marks: batch.marks,
                      checked: true,
                    },
                  ],
                  marksPerQuestion: batch.marks || currentExamMeta.defaultMarksPerQuestion,
                  negativeMarks: currentExamMeta.defaultNegativeMarks,
                  focusPYQ,
                  existingQuestions: existingTexts,
                  stream: false,
                }),
              })

              if (!res.ok) {
                const errData = await res.json().catch(() => ({}))
                throw new Error(errData.error || `Server error ${res.status}`)
              }

              const data = await res.json()
              if (data.success && Array.isArray(data.questions) && data.questions.length > 0) {
                const uniqueNew: GeneratedCompetitiveQuestion[] = []
                for (const q of data.questions) {
                  const norm = (q.questionText || "").toLowerCase().replace(/[^a-z0-9]/g, "")
                  if (norm && !seenTexts.has(norm)) {
                    seenTexts.add(norm)
                    uniqueNew.push(q)
                  }
                }

                if (uniqueNew.length > 0) {
                  allGenerated = [...allGenerated, ...uniqueNew]
                  showQuestions(allGenerated)

                  if (!openedReview) {
                    openedReview = true
                    window.scrollTo({ top: 0, behavior: "auto" })
                  }
                }
                batchSuccess = true
              } else {
                throw new Error("No questions in batch response")
              }
            } catch (bErr: any) {
              retries--
              if (retries < 0) {
                console.warn("[CompetitiveAI] Batch permanently failed:", batch.formatId, bErr.message)
                batchErrors.push(bErr.message)
              }
            }
          }
        }
      }

      const activeWorkers = Array.from(
        { length: Math.min(CONCURRENCY, queue.length) },
        () => runWorker()
      )

      await Promise.all(activeWorkers)

      if (allGenerated.length === 0) {
        throw new Error(
          batchErrors[0] || "No questions were created. Please verify your connection and click Create Questions again."
        )
      }

      // Quick 1-batch top-up if deficit exists
      if (allGenerated.length < countToGenerate) {
        const gap = countToGenerate - allGenerated.length
        try {
          const topUpRes = await fetch("/api/admin/generate-competitive-questions", {
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
              questionCount: Math.min(gap, 3),
              questionPattern: pattern,
              blueprintFormats: blueprintFormats.map((f) => ({
                ...f,
                count: Math.min(Number(f.count) || 0, gap),
              })),
              marksPerQuestion: currentExamMeta.defaultMarksPerQuestion,
              negativeMarks: currentExamMeta.defaultNegativeMarks,
              focusPYQ,
              existingQuestions: allGenerated.map((q) => q.questionText).slice(-30),
              stream: false,
            }),
          })
          const topUpData = await topUpRes.json()
          if (topUpData.success && Array.isArray(topUpData.questions) && topUpData.questions.length > 0) {
            for (const q of topUpData.questions) {
              const norm = (q.questionText || "").toLowerCase().replace(/[^a-z0-9]/g, "")
              if (norm && !seenTexts.has(norm)) {
                seenTexts.add(norm)
                allGenerated.push(q)
              }
            }
            showQuestions(allGenerated)
          }
        } catch (gapErr) {
          console.warn("[CompetitiveAI] Final gap top-up non-blocking warning:", gapErr)
        }
      }

      toast.success(`Generated ${allGenerated.length} questions successfully!`)
    } catch (err: any) {
      setErrorMsg(err?.message || "An unexpected error occurred while generating.")
      window.scrollTo({ top: 0, behavior: "auto" })
    } finally {
      clearTimeout(timer1)
      clearTimeout(timer2)
      setIsGenerating(false)
      setGenerationStep(0)
    }
  }

  // Generate missing questions to reach blueprint target
  const handleGenerateMissing = async () => {
    const missingCount = Math.max(0, totalQuestions - generatedQuestions.length)
    if (missingCount <= 0 || isGeneratingMissing) return

    setIsGeneratingMissing(true)
    setErrorMsg(null)
    const chapterTitle =
      selectedChapters.length === 1
        ? selectedChapters[0]
        : selectedChapters.length > 1
        ? `${selectedChapters[0]} & ${selectedChapters.length - 1} more`
        : ""
    const targetSubject = activeSubjectTab || selectedSubject
    const nextTitle = `${selectedExam.replace("-", "_")} ${targetSubject}${chapterTitle ? ` - ${chapterTitle}` : ""}`
    const existingTexts = generatedQuestions.map((q) => q.questionText)

    try {
      const requestCount = Math.min(missingCount, 3)
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
          questionCount: requestCount,
          questionPattern: pattern,
          blueprintFormats: blueprintFormats.map((f) => ({
            ...f,
            count: Math.min(Number(f.count) || 0, requestCount),
          })),
          marksPerQuestion: currentExamMeta.defaultMarksPerQuestion,
          negativeMarks: currentExamMeta.defaultNegativeMarks,
          focusPYQ,
          existingQuestions: existingTexts.slice(-30),
          stream: false,
        }),
      })

      const data = await res.json()
      if (res.ok && data.success && Array.isArray(data.questions) && data.questions.length > 0) {
        const updated = [...generatedQuestions, ...data.questions]
        setGeneratedQuestions(updated)
        setSelectedQuestionIds(new Set(updated.map((q) => q.id)))
        setExamTitle(nextTitle)
        const calculatedTotal = updated.reduce((sum, q) => sum + (q.marks || 4), 0) || totalMarks || 200
        setExamTotalMarks(calculatedTotal)
        setPassMarks(Math.round(calculatedTotal * 0.4))
        toast.success(`Generated ${data.questions.length} more question(s)! Total: ${updated.length}/${totalQuestions}`)
      } else {
        toast.error("Could not generate remaining questions. Please try again.")
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to generate missing questions.")
    } finally {
      setIsGeneratingMissing(false)
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
    if (isExamQuotaReached && !editingExamId) {
      const msg = `Exam Limit Reached: Your organization has reached the limit of ${maxExams} exams (${examCount}/${maxExams} used). Contact administrator to increase your exam quota.`
      setErrorMsg(msg)
      toast.error(msg)
      return
    }

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

      // Convert 12-hour AM/PM to 24-hour "HH:mm"
      const to24HourTime = (hourStr: string, minStr: string, period: "AM" | "PM") => {
        let h = parseInt(hourStr, 10)
        if (isNaN(h)) h = 10
        if (period === "PM" && h < 12) h += 12
        if (period === "AM" && h === 12) h = 0
        const m = minStr ? minStr.padStart(2, "0") : "00"
        return `${String(h).padStart(2, "0")}:${m}`
      }

      const formattedStartTime = to24HourTime(startHour, startMinute, startPeriod)
      const formattedEndTime = to24HourTime(endHour, endMinute, endPeriod)

      const finalInstructions = instructions && instructions.length > 0 ? instructions : [
        "Read each question carefully before submitting your answer.",
        `Each question carries ${currentExamMeta.defaultMarksPerQuestion} marks.`,
        currentExamMeta.defaultNegativeMarks > 0
          ? `Negative marking: -${currentExamMeta.defaultNegativeMarks} marks will be deducted for each incorrect response.`
          : "No negative marking applicable.",
        "Formulas and chemical reactions are formatted with scientific standard LaTeX notation.",
      ]

      const isNegativeEnabled = evalSettings.enableNegativeMarking
      const defaultNegMark = isNegativeEnabled ? (currentExamMeta.defaultNegativeMarks || 1) : 0

      const typeTitles: Record<string, string> = {
        mcq: "Multiple Choice Questions",
        diagram: "Diagram & Visual Questions",
        assertion: "Assertion & Reason",
        truefalse: "True / False Questions",
        fillblanks: "Fill in the Blanks",
        descriptive: "Descriptive Questions",
      }

      const mappedQuestions = toSave.map((q) => {
        const fmt = getQuestionFormat(q)
        const isDescriptive = fmt === "descriptive" || q.type === "descriptive"
        const isTF = fmt === "true_false"
        const isAR = fmt === "assertion"
        const isFIB = fmt === "fib"
        const isDiagram = fmt === "diagram"

        let determinedType: "mcq" | "assertion" | "truefalse" | "fillblanks" | "descriptive" = "mcq"
        if (isDescriptive) determinedType = "descriptive"
        else if (isTF) determinedType = "truefalse"
        else if (isAR) determinedType = "assertion"
        else if (isFIB) determinedType = "fillblanks"

        const options = isDescriptive ? [] : isTF ? ["True", "False"] : q.options || []
        const correctAnswer = isTF
          ? (String(q.correctAnswer).toLowerCase().includes("false") || q.correctAnswer === "Option B" ? "False" : "True")
          : q.correctAnswer

        const parsedAR = isAR ? parseAssertionReason(q.questionText || "") : null

        return {
          type: determinedType,
          questionFormat: isDescriptive ? "descriptive" : isTF ? "true_false" : isAR ? "assertion" : isFIB ? "fib" : isDiagram ? "diagram" : "mcq",
          assertionText: parsedAR?.assertion,
          reasonText: parsedAR?.reason,
          questionText: q.questionText,
          questionImage: q.questionImage,
          difficulty: q.difficulty,
          marks: q.marks || (isDescriptive ? 5 : currentExamMeta.defaultMarksPerQuestion),
          negativeMark: isDescriptive
            ? 0
            : (q.negativeMark !== undefined
              ? q.negativeMark
              : defaultNegMark),
          options,
          correctAnswer,
          explanation: q.explanation,
          wordLimit: q.wordLimit || 150,
        }
      })

      const typeOrder: ("mcq" | "assertion" | "truefalse" | "fillblanks" | "descriptive")[] = ["mcq", "assertion", "truefalse", "fillblanks", "descriptive"]
      const groupedTypes = typeOrder.filter(t => mappedQuestions.some(q => q.type === t))

      let sections: any[] = []
      if (groupedTypes.length <= 1) {
        sections = [{
          name: mappedQuestions[0]?.type ? (typeTitles[mappedQuestions[0].type] || "Questions") : "Questions",
          title: `${activeSubjectTab || selectedSubject} - Section 1`,
          type: mappedQuestions[0]?.type || "mcq",
          negativeMarking: isNegativeEnabled,
          sectionNegativeMark: defaultNegMark,
          questionRange: `1-${mappedQuestions.length}`,
          questions: mappedQuestions,
        }]
      } else {
        let runningCount = 1
        sections = groupedTypes.map(t => {
          const qs = mappedQuestions.filter(q => q.type === t)
          const startNum = runningCount
          const endNum = runningCount + qs.length - 1
          runningCount = endNum + 1
          return {
            name: typeTitles[t] || "Questions",
            title: `${activeSubjectTab || selectedSubject} - ${typeTitles[t]}`,
            type: t,
            negativeMarking: isNegativeEnabled,
            sectionNegativeMark: defaultNegMark,
            questionRange: `${startNum}-${endNum}`,
            questions: qs,
          }
        })
      }

      const finalExamDuration = duration || Math.max(toSave.length * 2, 30)

      const endpoint = editingExamId ? `/api/exams/${editingExamId}` : "/api/exams"
      const method = editingExamId ? "PUT" : "POST"

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: examTitle.trim() || getDefaultExamTitle(),
          examType: selectedExam,
          subject: activeSubjectTab || selectedSubject,
          class: selectedGrade === "both" ? "11th + 12th" : `${selectedGrade}th`,
          duration: finalExamDuration,
          totalMarks: examTotalMarks || totalMarks,
          passMarks: passMarks || Math.floor((examTotalMarks || totalMarks) * 0.4),
          questionsPerMin: questionsPerMinute ? Number(questionsPerMinute) : undefined,
          description: finalInstructions.join("\n"),
          instructions: finalInstructions,
          sections,
          proctoring: {
            enabled: proctoringSettings.faceDetection || proctoringSettings.tabSwitchPrevention || proctoringSettings.enforceFullscreen || proctoringSettings.aiStatusAnalysis,
            faceDetection: proctoringSettings.faceDetection,
            tabSwitch: proctoringSettings.tabSwitchPrevention,
            fullscreenExit: proctoringSettings.enforceFullscreen,
            maxWarnings: 3,
          },
          schedule: {
            startDate,
            startTime: formattedStartTime,
            endDate,
            endTime: formattedEndTime,
          },
          settings: {
            randomize: evalSettings.randomizeQuestions,
            showResults: evalSettings.showResultsImmediately,
            allowReview: evalSettings.allowReview,
            negativeMarking: isNegativeEnabled,
            startDate: startDate,
            startTime: formattedStartTime,
            endDate: endDate,
            endTime: formattedEndTime,
            proctoring: {
              faceDetection: proctoringSettings.faceDetection,
              tabSwitch: proctoringSettings.tabSwitchPrevention,
              tabSwitchPrevention: proctoringSettings.tabSwitchPrevention,
              fullscreen: proctoringSettings.enforceFullscreen,
              enforceFullscreen: proctoringSettings.enforceFullscreen,
              aiProctoring: proctoringSettings.aiStatusAnalysis,
              aiStatusAnalysis: proctoringSettings.aiStatusAnalysis,
            },
          },
          status: "active",
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to publish exam")

      toast.success(editingExamId ? "Exam paper updated successfully!" : "Exam paper published successfully!")
      router.push("/admin/exams")
    } catch (err: any) {
      toast.error(err.message || "Failed to publish exam")
      setErrorMsg("Error publishing exam: " + err.message)
    } finally {
      setCreatingExam(false)
    }
  }

  if (isExamQuotaReached && !editExamId) {
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

  if (hasCompetitiveAccess === false) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4 border border-amber-200 shadow-sm">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-[#324158] mb-2">Access Restricted</h2>
        <p className="text-gray-500 max-w-md text-sm mb-6 leading-relaxed">
          Your coaching institute does not have permission to access the Competitive Test Studio. Please contact your administrator to enable this module.
        </p>
        <Link
          href="/admin"
          className="px-6 py-2.5 bg-[#2D3A4A] hover:bg-[#1e2a38] text-white rounded-xl text-sm font-medium transition-colors shadow-sm"
        >
          Return to Dashboard
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
          <span className="text-slate-900 font-semibold">Competitive Test</span>
        </div>

        {/* ─── Studio Title & Badges Header ─── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
          <div>
            <h1 className="text-lg sm:text-xl font-medium tracking-tight text-slate-900">
              Competitive Test Studio
            </h1>
            <p className="sm:hidden text-xs text-slate-500 mt-0.5">
              Step {currentStep} of {STEPS.length}: {STEPS.find((s) => s.step === currentStep)?.label}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full bg-[#ECFDF5] text-[#047857] border border-[#A7F3D0] text-[11px] sm:text-xs font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#059669]" />
              <span>NCERT Aligned</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE] text-[11px] sm:text-xs font-medium">
              <Zap className="w-3.5 h-3.5 text-[#2563EB]" />
              <span>10-Yr PYQ Bank</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 text-[11px] sm:text-xs font-medium">
              <Layers className="w-3.5 h-3.5 text-slate-600" />
              <span>Zero Repetition</span>
            </span>
          </div>
        </div>

        {editingExamId && (
          <div className="mb-4 px-4 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span>
                <strong>Editing Mode:</strong> Updating existing exam <strong>&quot;{examTitle}&quot;</strong>
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditingExamId(null)
                router.push("/admin/ai-generator")
              }}
              className="text-amber-700 hover:text-amber-900 font-semibold underline cursor-pointer text-xs"
            >
              Cancel Edit
            </button>
          </div>
        )}

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
              className="text-red-500 hover:text-red-800 font-medium p-1 cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* ─── Mobile Dedicated Stepper (sm:hidden) ─── */}
        <div className="sm:hidden mb-5 bg-white rounded-2xl border border-slate-200/80 p-3.5 shadow-xs space-y-3">
          {/* Step Info Row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-lg bg-primary text-white text-xs font-semibold flex items-center justify-center shadow-2xs">
                {currentStep}
              </span>
              <div>
                <p className="text-xs font-semibold text-slate-900 leading-none">
                  {STEPS.find((s) => s.step === currentStep)?.label}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Step {currentStep} of {STEPS.length}
                </p>
              </div>
            </div>

            <span className="text-[11px] font-medium text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full">
              {Math.round((currentStep / STEPS.length) * 100)}% Done
            </span>
          </div>

          {/* 6-Step Quick Action Touch Buttons */}
          <div className="grid grid-cols-6 gap-1.5 pt-0.5">
            {STEPS.map((s) => {
              const isCurrent = s.step === currentStep
              const isComplete = s.step < currentStep
              const isClickable = !isGenerating && (s.step <= currentStep || (generatedQuestions.length > 0 && s.step <= 6))

              return (
                <button
                  key={s.step}
                  type="button"
                  disabled={!isClickable}
                  onClick={() => {
                    if (isClickable) {
                      setCurrentStep(s.step)
                      window.scrollTo({ top: 0, behavior: "smooth" })
                    }
                  }}
                  className={`h-9 rounded-xl flex items-center justify-center text-xs font-medium transition-all cursor-pointer ${
                    isCurrent
                      ? "bg-primary text-white shadow-xs font-semibold ring-2 ring-primary/25"
                      : isComplete
                      ? "bg-primary/15 text-primary border border-primary/30 font-semibold"
                      : "bg-slate-50 text-slate-400 border border-slate-200/60 disabled:opacity-40 disabled:cursor-not-allowed"
                  }`}
                  title={s.label}
                >
                  {isComplete ? <Check className="w-3.5 h-3.5 stroke-[2.5]" /> : s.step}
                </button>
              )
            })}
          </div>
        </div>

        {/* ─── Desktop 6-Step Stepper (hidden sm:block) ─── */}
        <div className="hidden sm:block mb-6 bg-white rounded-2xl border border-slate-200/80 px-4 py-5 sm:px-8 shadow-xs">
            <div className="flex items-center justify-between">
              {STEPS.map((s, index) => {
                const isCurrent = s.step === currentStep
                const isComplete = s.step < currentStep

                return (
                  <div key={s.step} className="flex-1 flex items-center">
                    <div className="flex flex-col items-center flex-1">
                      <button
                        type="button"
                        onClick={() => {
                          if (!isGenerating && (s.step <= currentStep || (generatedQuestions.length > 0 && s.step <= 6))) {
                            setCurrentStep(s.step)
                            window.scrollTo({ top: 0, behavior: "smooth" })
                          }
                        }}
                        className={`flex items-center justify-center w-7 h-7 rounded-full text-[11px] font-medium transition-all cursor-pointer ${
                          isCurrent
                            ? "bg-primary text-white shadow-sm ring-2 ring-primary/25 ring-offset-2"
                            : isComplete
                            ? "bg-primary text-white shadow-sm"
                            : "bg-white text-slate-400 border border-slate-300"
                        }`}
                      >
                        {isComplete ? <Check className="w-3.5 h-3.5 stroke-[2.5]" /> : s.step}
                      </button>
                      <span
                        className={`mt-1 text-[10px] sm:text-[11px] font-medium transition-colors text-center ${
                          isCurrent ? "text-slate-900 font-semibold" : isComplete ? "text-primary font-medium" : "text-slate-400"
                        }`}
                      >
                        {s.label}
                      </span>
                    </div>
                    {index < STEPS.length - 1 && (
                      <div
                        className={`h-[1.5px] w-full max-w-[120px] -mt-5 transition-colors ${
                          s.step < currentStep ? "bg-primary" : "bg-slate-200"
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
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-7 pb-8 shadow-xs relative z-20">
              <div className="mb-6">
                <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                  STEP 1 · EXAM DETAILS
                </p>
                <h2 className="mt-1 text-base sm:text-lg font-medium tracking-tight text-slate-900">
                  Choose Exam, Class and Subjects
                </h2>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
                {/* Column 1: Exam */}
                <div className={`lg:col-span-3 lg:pr-6 relative ${examDropdownOpen ? "z-50" : "z-20"}`}>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1.5">
                    Exam
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setExamDropdownOpen(!examDropdownOpen)
                      setSubjectDropdownOpen(false)
                    }}
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 flex items-center justify-between text-xs font-normal text-slate-800 transition-colors shadow-2xs focus:outline-none focus:ring-2 focus:ring-slate-900/10 cursor-pointer"
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
                            className={`w-full px-3 py-2 rounded-lg text-left text-xs sm:text-sm font-normal flex items-center justify-between transition-colors cursor-pointer ${
                              selectedExam === exam.id
                                ? "bg-slate-100 text-[#324158] font-medium"
                                : "text-slate-700 hover:bg-slate-50"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span>{exam.title}</span>
                              <span className="text-[10px] text-slate-400 font-normal px-1.5 py-0.5 bg-slate-50 rounded border border-slate-100">
                                {exam.badge}
                              </span>
                            </div>
                            {selectedExam === exam.id && <Check className="w-3.5 h-3.5 text-[#324158] shrink-0" />}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* Column 2: Class / Standard */}
                <div className="lg:col-span-4 lg:px-6 pt-5 lg:pt-0 relative z-10">
                  <label className="block text-[11px] font-medium text-slate-500 mb-1.5">
                    Class / Standard
                  </label>
                  <div className="flex items-center gap-1.5 sm:gap-2">
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
                          className={`flex-1 h-11 px-2 sm:px-3 rounded-xl text-[11px] sm:text-xs font-medium transition-all duration-150 cursor-pointer ${
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
                  <label className="block text-[11px] font-medium text-slate-500 mb-1.5">
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
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-blue-50 text-blue-900 text-xs font-normal border border-blue-200/60"
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
                        <p className="px-3 py-1 text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                          Select subjects
                        </p>
                        {availableSubjects.map((sub) => {
                          const isChecked = selectedSubjects.includes(sub)
                          return (
                            <button
                              key={sub}
                              type="button"
                              onClick={() => handleToggleSubject(sub)}
                              className="w-full px-3 py-1.5 text-left text-xs font-normal text-slate-700 hover:bg-slate-50 rounded-lg flex items-center justify-between transition-colors cursor-pointer"
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

          {/* ─── STEP 2: CONTENT & BLUEPRINT (MATCHING SCREENSHOT) ─── */}
          {currentStep === 2 && (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-7 shadow-xs">
              {/* Top Header inside card */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-100">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200/80 flex items-center justify-center shrink-0 text-[#324158]">
                    <Layers size={18} />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-bold tracking-tight text-slate-900">
                      Content &amp; Blueprint
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Select chapters and set question format, marks and difficulty level.
                    </p>
                  </div>
                </div>

                {/* Selected Summary Badges & Edit Icon */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200/80 text-[11px] sm:text-xs font-normal text-slate-600">
                    Class:{" "}
                    <span className="font-semibold text-slate-800">
                      {selectedGrade === "both"
                        ? "11th + 12th"
                        : selectedGrade === "11"
                        ? "Class 11th"
                        : "Class 12th"}
                    </span>
                  </span>
                  <span className="px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200/80 text-[11px] sm:text-xs font-normal text-slate-600">
                    Subjects:{" "}
                    <span className="font-semibold text-slate-800">
                      {selectedSubjects.join(", ")}
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

              {/* ─── Chapter Selection (Full Width) ─── */}
              <div className="pt-6">
                <div className="flex items-center gap-2 mb-3.5">
                  <span className="w-1.5 h-4 bg-[#324158] rounded-full inline-block" />
                  <h3 className="text-sm sm:text-base font-bold text-slate-900">Chapter Selection</h3>
                </div>

                {/* Subject Selection Pills */}
                <div className="flex items-center gap-2 mb-3 overflow-x-auto pb-1 max-w-full [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap">
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
                        className={`px-4 py-1.5 rounded-full text-xs transition-all shrink-0 sm:shrink cursor-pointer whitespace-nowrap ${
                          isActive
                            ? "bg-[#324158] text-white font-bold shadow-xs"
                            : "bg-slate-50 border border-slate-200 text-slate-700 hover:border-slate-300 font-semibold"
                        }`}
                      >
                        {sub} ({count})
                      </button>
                    )
                  })}
                </div>

                {/* Class Filter Chips */}
                <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1 max-w-full [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap">
                  {[
                    { id: "all", label: `All (${currentSubjectChapters.length})` },
                    { id: "11", label: `Class 11 (${class11Chapters.length})` },
                    { id: "12", label: `Class 12 (${class12Chapters.length})` },
                  ].map((cf) => (
                    <button
                      key={cf.id}
                      type="button"
                      onClick={() => setClassFilter(cf.id as any)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors shrink-0 sm:shrink cursor-pointer whitespace-nowrap ${
                        classFilter === cf.id
                          ? "bg-blue-50 text-blue-900 border border-blue-200/80 font-bold"
                          : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300 font-medium"
                      }`}
                    >
                      {cf.label}
                    </button>
                  ))}
                </div>

                {/* Accordions for Class 11 and Class 12 */}
                <div className="space-y-3 mb-4">
                  {/* Class 11 */}
                  {(classFilter === "all" || classFilter === "11") && class11Chapters.length > 0 && (
                    <div className="rounded-xl border border-slate-200/90 bg-white overflow-hidden shadow-2xs">
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
                              className="w-4 h-4 rounded text-[#324158] focus:ring-slate-900 border-slate-300 cursor-pointer"
                            />
                            <span className="font-bold text-slate-800 text-xs sm:text-sm">
                              Class 11 ({class11Chapters.length} chapters)
                            </span>
                          </label>
                        </div>
                        <ChevronRight
                          onClick={() =>
                            setExpandedClasses((prev) => ({ ...prev, "11": !prev["11"] }))
                          }
                          className={`w-4 h-4 text-slate-400 cursor-pointer transition-transform ${
                            expandedClasses["11"] ? "rotate-90" : ""
                          }`}
                        />
                      </div>

                      {expandedClasses["11"] && (
                        <div className="px-4 py-3 bg-slate-50/40 border-t border-slate-100 max-h-72 overflow-y-auto space-y-1.5 custom-scrollbar">
                          {class11Chapters.map((ch, idx) => {
                            const isChecked = selectedChapters.includes(ch.name)
                            return (
                              <label
                                key={ch.id || ch.name}
                                className="flex items-center gap-3 text-xs text-slate-700 cursor-pointer hover:bg-white p-2 rounded-lg transition-colors"
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleChapter(ch.name)}
                                  className="w-4 h-4 rounded text-[#324158] focus:ring-slate-900 border-slate-300 cursor-pointer shrink-0"
                                />
                                <span className="font-medium text-slate-800">
                                  <span className="text-slate-400 mr-2">{idx + 1}.</span>
                                  {ch.name}
                                </span>
                              </label>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Class 12 */}
                  {(classFilter === "all" || classFilter === "12") && class12Chapters.length > 0 && (
                    <div className="rounded-xl border border-slate-200/90 bg-white overflow-hidden shadow-2xs">
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
                              className="w-4 h-4 rounded text-[#324158] focus:ring-slate-900 border-slate-300 cursor-pointer"
                            />
                            <span className="font-bold text-slate-800 text-xs sm:text-sm">
                              Class 12 ({class12Chapters.length} chapters)
                            </span>
                          </label>
                        </div>
                        <ChevronRight
                          onClick={() =>
                            setExpandedClasses((prev) => ({ ...prev, "12": !prev["12"] }))
                          }
                          className={`w-4 h-4 text-slate-400 cursor-pointer transition-transform ${
                            expandedClasses["12"] ? "rotate-90" : ""
                          }`}
                        />
                      </div>

                      {expandedClasses["12"] && (
                        <div className="px-4 py-3 bg-slate-50/40 border-t border-slate-100 max-h-72 overflow-y-auto space-y-1.5 custom-scrollbar">
                          {class12Chapters.map((ch, idx) => {
                            const isChecked = selectedChapters.includes(ch.name)
                            return (
                              <label
                                key={ch.id || ch.name}
                                className="flex items-center gap-3 text-xs text-slate-700 cursor-pointer hover:bg-white p-2 rounded-lg transition-colors"
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleChapter(ch.name)}
                                  className="w-4 h-4 rounded text-[#324158] focus:ring-slate-900 border-slate-300 cursor-pointer shrink-0"
                                />
                                <span className="font-medium text-slate-800">
                                  <span className="text-slate-400 mr-2">{idx + 1}.</span>
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
                <div className="px-4 py-2.5 rounded-xl bg-blue-50/70 border border-blue-100 flex items-center gap-2 text-xs font-bold text-blue-900 mb-8">
                  <Check className="w-4 h-4 text-blue-600 stroke-[2.5]" />
                  <span>Selected: {selectedChapters.length} Chapters</span>
                </div>
              </div>

              {/* ─── Bottom Section: Question Type & Marks (Left) + Subject Breakdown & Syllabus Weightage (Right) ─── */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start pt-2">
                {/* Left Column: Question Type & Marks */}
                <div className="lg:col-span-7 xl:col-span-7">
                  <div className="flex items-center gap-2 mb-3.5">
                    <span className="w-1.5 h-4 bg-[#324158] rounded-full inline-block" />
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-1.5">
                      Question Type &amp; Marks <Info size={13} className="text-slate-400" />
                    </h3>
                  </div>

                  {/* Table of Question Types */}
                  <div className="space-y-2.5">
                    {/* Header Row */}
                    <div className="grid grid-cols-12 gap-2.5 px-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      <span className="col-span-5">Question Type</span>
                      <span className="col-span-3 text-center">Marks per Question</span>
                      <span className="col-span-2 text-center">Total Questions</span>
                      <span className="col-span-2 text-center">Total Marks</span>
                    </div>

                    {blueprintFormats.map((f) => (
                      <div key={f.id} className="grid grid-cols-12 gap-2.5 items-center">
                        {/* Question Type Dropdown */}
                        <div className="col-span-5 relative">
                          <select
                            value={f.label}
                            onChange={(e) => updateFormatType(f.id, e.target.value)}
                            className="w-full h-10 pl-3 pr-8 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 shadow-2xs focus:outline-none focus:ring-2 focus:ring-[#324158]/10 cursor-pointer appearance-none truncate"
                          >
                            {[
                              "MCQ (Single Correct)",
                              "MCQ (Multiple Correct)",
                              "Assertion & Reason",
                              "True / False",
                              "Fill in the Blanks",
                              "Description / Descriptive",
                              "Diagram / Visual",
                            ].map((t) => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </select>
                          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        </div>

                        {/* Marks per Question Dropdown */}
                        <div className="col-span-3 relative">
                          <select
                            value={f.marks}
                            onChange={(e) => updateFormatMarks(f.id, Number(e.target.value))}
                            className="w-full h-10 px-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 shadow-2xs focus:outline-none focus:ring-2 focus:ring-[#324158]/10 cursor-pointer text-center appearance-none"
                          >
                            {[1, 2, 3, 4, 5, 6, 8, 10].map((m) => (
                              <option key={m} value={m}>{m}</option>
                            ))}
                          </select>
                          <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        </div>

                        {/* Total Questions Input */}
                        <div className="col-span-2">
                          <input
                            type="number"
                            min={0}
                            max={200}
                            value={f.count === 0 ? "0" : f.count}
                            onChange={(e) => {
                              const val = Math.max(0, parseInt(e.target.value, 10) || 0)
                              updateFormatCount(f.id, val)
                            }}
                            className="w-full h-10 px-2 text-center rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 shadow-2xs focus:outline-none focus:ring-2 focus:ring-[#324158]/10"
                          />
                        </div>

                        {/* Total Marks (Calculated) */}
                        <div className="col-span-2">
                          <input
                            type="text"
                            readOnly
                            value={(f.count || 0) * (f.marks || 0)}
                            className="w-full h-10 px-2 text-center rounded-xl border border-slate-200 bg-slate-50/80 text-xs font-bold text-slate-700 shadow-2xs select-none"
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Bottom Summary Bar */}
                  <div className="mt-4 px-4 py-2.5 rounded-xl bg-blue-50/70 border border-blue-100 flex items-center gap-2 text-xs font-semibold text-blue-950">
                    <Info size={14} className="text-blue-600 shrink-0" />
                    <span>Total Questions: <b className="text-slate-900">{totalQuestions}</b></span>
                    <span className="text-blue-200 mx-1">|</span>
                    <span>Total Marks: <b className="text-slate-900">{totalMarks}</b></span>
                  </div>
                </div>

                {/* Right Column: Subject-wise Marks + Syllabus Weightage */}
                <div className="lg:col-span-5 xl:col-span-5 space-y-5">
                  {/* Box 1: Subject-wise Marks */}
                  <div className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-2xs">
                    <h4 className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-1.5 mb-3">
                      Subject-wise Marks <Info size={13} className="text-slate-400" />
                    </h4>

                    <div className="space-y-2">
                      <div className="grid grid-cols-12 gap-2 text-[11px] font-semibold text-slate-400 pb-1.5 border-b border-slate-100">
                        <span className="col-span-6">Subject</span>
                        <span className="col-span-3 text-center">Questions</span>
                        <span className="col-span-3 text-center">Marks</span>
                      </div>

                      {selectedSubjects.map((sub) => (
                        <div key={sub} className="grid grid-cols-12 gap-2 items-center py-1">
                          <span className="col-span-6 text-xs font-medium text-slate-800 truncate">{sub}</span>
                          <div className="col-span-3 flex justify-center">
                            <input
                              type="number"
                              min={0}
                              value={subjectDist[sub]?.questions ?? 50}
                              onChange={(e) => updateSubjectDist(sub, "questions", parseInt(e.target.value, 10) || 0)}
                              className="w-16 h-8 px-2 text-center rounded-lg border border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#324158]/10 shadow-2xs"
                            />
                          </div>
                          <div className="col-span-3 flex justify-center">
                            <input
                              type="number"
                              min={0}
                              value={subjectDist[sub]?.marks ?? (sub === "Mathematics" ? 100 : 50)}
                              onChange={(e) => updateSubjectDist(sub, "marks", parseInt(e.target.value, 10) || 0)}
                              className="w-16 h-8 px-2 text-center rounded-lg border border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#324158]/10 shadow-2xs"
                            />
                          </div>
                        </div>
                      ))}

                      {/* Total Row */}
                      <div className="grid grid-cols-12 gap-2 items-center pt-2.5 border-t border-slate-100 font-bold text-xs text-slate-900">
                        <span className="col-span-6">Total</span>
                        <span className="col-span-3 text-center">{totalSubjectQuestions}</span>
                        <span className="col-span-3 text-center">{totalSubjectMarks}</span>
                      </div>
                    </div>
                  </div>

                  {/* Box 2: Syllabus Weightage */}
                  <div className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-2xs">
                    <h4 className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-1.5 mb-3">
                      Syllabus Weightage <Info size={13} className="text-slate-400" />
                    </h4>

                    <div className="space-y-2.5">
                      <div className="grid grid-cols-12 gap-2 text-[11px] font-semibold text-slate-400 pb-1.5 border-b border-slate-100">
                        <span className="col-span-6">Class</span>
                        <span className="col-span-6 text-center">Weightage</span>
                      </div>

                      <div className="grid grid-cols-12 gap-2 items-center py-1">
                        <span className="col-span-6 text-xs font-medium text-slate-800">Class 11</span>
                        <div className="col-span-6 flex justify-center relative">
                          <select
                            value={class11Weightage}
                            onChange={(e) => handleClass11WeightageChange(Number(e.target.value))}
                            className="w-24 h-8 px-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-800 text-center cursor-pointer shadow-2xs focus:outline-none focus:ring-2 focus:ring-[#324158]/10 appearance-none"
                          >
                            {[10, 20, 30, 40, 50, 60, 70, 80, 90].map((v) => (
                              <option key={v} value={v}>{v}%</option>
                            ))}
                          </select>
                          <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        </div>
                      </div>

                      <div className="grid grid-cols-12 gap-2 items-center py-1">
                        <span className="col-span-6 text-xs font-medium text-slate-800">Class 12</span>
                        <div className="col-span-6 flex justify-center relative">
                          <select
                            value={class12Weightage}
                            onChange={(e) => handleClass12WeightageChange(Number(e.target.value))}
                            className="w-24 h-8 px-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-800 text-center cursor-pointer shadow-2xs focus:outline-none focus:ring-2 focus:ring-[#324158]/10 appearance-none"
                          >
                            {[90, 80, 70, 60, 50, 40, 30, 20, 10].map((v) => (
                              <option key={v} value={v}>{v}%</option>
                            ))}
                          </select>
                          <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        </div>
                      </div>
                    </div>
                  </div>
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
                  <h3 className="text-lg font-semibold text-slate-800 mb-1">No Questions Generated Yet</h3>
                  <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto mb-6">
                    Configure your chapter selections and question blueprint in Step 2, then click &ldquo;Create Questions&rdquo; to generate exam questions.
                  </p>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    className="px-6 py-2.5 rounded-xl bg-[#1E293B] hover:bg-[#0F172A] text-white font-medium text-sm transition-colors cursor-pointer inline-flex items-center gap-2"
                  >
                    <span>Go to Step 2 (Content & Blueprint)</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <>
                  {/* Action Bar Header Card */}
                  <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 p-3.5 sm:p-6 shadow-xs space-y-3.5 sm:space-y-4">
                    {/* Top Row: Created summary & stats */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] sm:text-xs font-medium uppercase tracking-wider flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{generatedQuestions.length} Questions Created</span>
                        </span>
                        <span className="text-xs text-slate-500 font-normal">
                          {selectedQuestionIds.size} of {generatedQuestions.length} selected
                        </span>
                        <span className="text-xs font-normal px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                          Total Marks: {generatedQuestions.filter((q) => selectedQuestionIds.has(q.id)).reduce((acc, q) => acc + (q.marks || 4), 0)}
                        </span>
                      </div>

                      {/* Top Right Actions */}
                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        {/* Print Dropdown */}
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => !isGenerating && setPrintDropdownOpen((prev) => !prev)}
                            disabled={isGenerating}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 sm:py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs sm:text-sm font-medium shadow-xs transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                            title="Print Question Paper"
                          >
                            <Printer className="w-4 h-4 text-slate-700" />
                            <span>Print Paper</span>
                            <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                          </button>

                          {printDropdownOpen && !isGenerating && (
                            <div className="absolute right-0 mt-1.5 w-64 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-20">
                              <button
                                type="button"
                                onClick={() => {
                                  setPrintMode("student")
                                  setPrintModalOpen(true)
                                  setPrintDropdownOpen(false)
                                }}
                                className="w-full px-3 py-2 text-left text-xs hover:bg-slate-50 flex items-start gap-2.5 transition-colors cursor-pointer"
                              >
                                <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                                  <BookOpen className="w-4 h-4" />
                                </div>
                                <div>
                                  <div className="font-semibold text-slate-800">Student Copy</div>
                                  <div className="text-[11px] text-slate-500">Only questions &amp; options (No solutions)</div>
                                </div>
                              </button>

                              <div className="border-t border-slate-100 my-1"></div>

                              <button
                                type="button"
                                onClick={() => {
                                  setPrintMode("teacher")
                                  setPrintModalOpen(true)
                                  setPrintDropdownOpen(false)
                                }}
                                className="w-full px-3 py-2 text-left text-xs hover:bg-slate-50 flex items-start gap-2.5 transition-colors cursor-pointer"
                              >
                                <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                                  <FileText className="w-4 h-4" />
                                </div>
                                <div>
                                  <div className="font-semibold text-slate-800">Teacher &amp; Coaching Copy</div>
                                  <div className="text-[11px] text-slate-500">With verified answers &amp; derivations</div>
                                </div>
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Desktop Proceed Button */}
                        <button
                          type="button"
                          onClick={() => {
                            if (isGenerating) return
                            setCurrentStep(4)
                            window.scrollTo({ top: 0, behavior: "smooth" })
                          }}
                          disabled={isGenerating || selectedQuestionIds.size === 0}
                          className="hidden sm:inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1E293B] hover:bg-[#0F172A] text-white text-xs sm:text-sm font-medium shadow-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                        >
                          {isGenerating ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin text-amber-300" />
                              <span>Generating ({generatedQuestions.length}/{totalQuestions})...</span>
                            </>
                          ) : (
                            <>
                              <span>Proceed to Exam Details</span>
                              <ArrowRight className="w-4 h-4" />
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Middle Row: Exam Title Input */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2.5">
                      <label className="text-xs font-medium text-slate-600 shrink-0">Exam Title:</label>
                      <input
                        type="text"
                        value={examTitle}
                        onChange={(e) => setExamTitle(e.target.value)}
                        placeholder="Enter exam paper title..."
                        className="px-3.5 py-2 text-xs sm:text-sm font-normal rounded-xl border border-slate-200 bg-slate-50 text-slate-900 w-full sm:max-w-md focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 focus:bg-white"
                      />
                    </div>

                    {/* Bottom Row: Action Buttons */}
                    <div className="flex items-center gap-2 pt-1 flex-wrap">
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedQuestionIds.size === generatedQuestions.length) {
                            setSelectedQuestionIds(new Set())
                          } else {
                            setSelectedQuestionIds(new Set(generatedQuestions.map((q) => q.id)))
                          }
                        }}
                        className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5 text-slate-500" />
                        <span>
                          {selectedQuestionIds.size === generatedQuestions.length ? "Deselect All" : "Select All"}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setCurrentStep(2)}
                        className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer"
                      >
                        <Sliders className="w-3.5 h-3.5 text-slate-500" />
                        <span>Tweak Blueprint</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setPrintMode("student")
                          setPrintModalOpen(true)
                        }}
                        disabled={isGenerating}
                        className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl border border-blue-200 bg-blue-50/70 hover:bg-blue-100/70 text-blue-800 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Print clean question paper for students"
                      >
                        <Printer className="w-3.5 h-3.5 text-blue-600" />
                        <span>Print for Students</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setPrintMode("teacher")
                          setPrintModalOpen(true)
                        }}
                        disabled={isGenerating}
                        className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl border border-emerald-200 bg-emerald-50/70 hover:bg-emerald-100/70 text-emerald-800 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Print complete solutions and answer key for teachers"
                      >
                        <FileText className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Print Teacher Solutions</span>
                      </button>

                      {/* Mobile Proceed Button */}
                      <button
                        type="button"
                        onClick={() => {
                          if (isGenerating) return
                          setCurrentStep(4)
                          window.scrollTo({ top: 0, behavior: "smooth" })
                        }}
                        disabled={isGenerating || selectedQuestionIds.size === 0}
                        className="sm:hidden flex-1 px-3.5 py-2 rounded-xl bg-[#1E293B] hover:bg-[#0F172A] text-white text-xs font-medium shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                      >
                        {isGenerating ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-300" />
                            <span>Generating ({generatedQuestions.length}/{totalQuestions})...</span>
                          </>
                        ) : (
                          <>
                            <span>Next: Details</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Format Filter Tabs */}
                  {generatedQuestions.length > 0 && (
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                      <button
                        type="button"
                        onClick={() => setFormatFilter("all")}
                        className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all shrink-0 cursor-pointer whitespace-nowrap ${
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
                          className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all shrink-0 cursor-pointer whitespace-nowrap ${
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
                          className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all shrink-0 cursor-pointer whitespace-nowrap ${
                            formatFilter === "assertion"
                              ? "bg-amber-600 text-white shadow-xs"
                              : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          Assertion &amp; Reason ({formatCounts.assertion})
                        </button>
                      )}
                      {formatCounts.fib > 0 && (
                        <button
                          type="button"
                          onClick={() => setFormatFilter("fib")}
                          className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all shrink-0 cursor-pointer whitespace-nowrap ${
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
                          className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all shrink-0 cursor-pointer whitespace-nowrap ${
                            formatFilter === "true_false"
                              ? "bg-cyan-600 text-white shadow-xs"
                              : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          True / False ({formatCounts.true_false})
                        </button>
                      )}
                      {formatCounts.descriptive > 0 && (
                        <button
                          type="button"
                          onClick={() => setFormatFilter("descriptive")}
                          className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all shrink-0 cursor-pointer whitespace-nowrap ${
                            formatFilter === "descriptive"
                              ? "bg-emerald-600 text-white shadow-xs"
                              : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          Descriptive ({formatCounts.descriptive})
                        </button>
                      )}
                    </div>
                  )}

                  {isGenerating && (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-xs font-medium text-slate-700 shadow-xs">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-[#1E293B] text-white flex items-center justify-center shrink-0 shadow-xs">
                          <Loader2 className="h-4 w-4 animate-spin text-amber-300" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 text-xs sm:text-sm">
                            Creating Questions in Progress ({generatedQuestions.length} of {totalQuestions} completed)...
                          </p>
                          <p className="text-[11px] text-slate-600 font-normal mt-0.5">
                            Please wait while AI generates all questions. Proceeding to the next step will unlock once all {totalQuestions} questions are ready.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                        <div className="w-28 sm:w-36 h-2 bg-amber-200/80 rounded-full overflow-hidden">
                          <div
                            className="bg-[#1E293B] h-full rounded-full transition-all duration-300"
                            style={{
                              width: `${Math.min(100, Math.round((generatedQuestions.length / Math.max(1, totalQuestions)) * 100))}%`
                            }}
                          />
                        </div>
                        <span className="text-[11px] font-bold text-slate-900 tabular-nums">
                          {Math.min(100, Math.round((generatedQuestions.length / Math.max(1, totalQuestions)) * 100))}%
                        </span>
                      </div>
                    </div>
                  )}

                  {!isGenerating && generatedQuestions.length > 0 && generatedQuestions.length < totalQuestions && (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-blue-50/80 p-4 text-xs font-medium text-slate-700 shadow-xs">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-[#1E293B] text-white flex items-center justify-center shrink-0 shadow-xs">
                          <Sparkles className="h-4 w-4 text-amber-300" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 text-xs sm:text-sm">
                            {generatedQuestions.length} of {totalQuestions} Questions Ready
                          </p>
                          <p className="text-[11px] text-slate-600 font-normal mt-0.5">
                            {totalQuestions - generatedQuestions.length} questions remaining to reach your target blueprint. Click below to generate the rest!
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleGenerateMissing}
                        disabled={isGeneratingMissing}
                        className="self-end sm:self-auto inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1E293B] hover:bg-[#0F172A] text-white text-xs font-semibold shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                      >
                        {isGeneratingMissing ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-300" />
                            <span>Generating {totalQuestions - generatedQuestions.length} Remaining...</span>
                          </>
                        ) : (
                          <>
                            <Plus className="w-3.5 h-3.5 text-amber-300" />
                            <span>Generate Remaining {totalQuestions - generatedQuestions.length} Questions</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Generated Questions List */}
                  <div className="space-y-4">
                    {filteredGeneratedQuestions.map((q, idx) => {
                      const isSelected = selectedQuestionIds.has(q.id)
                      const isExpanded = expandedSolutions.has(q.id)
                      const qFormat = getQuestionFormat(q)
                      const isDescriptive = qFormat === "descriptive" || q.type === "descriptive"
                      const isTF = qFormat === "true_false"
                      const parsedAR = parseAssertionReason(q.questionText)
                      const isAR = qFormat === "assertion" || Boolean(parsedAR)

                      const displayOptions = isTF ? ["True", "False"] : (q.options || [])
                      const displayCorrectAnswer = isTF
                        ? (String(q.correctAnswer).toLowerCase().includes("false") || q.correctAnswer === "Option B" ? "False" : "True")
                        : q.correctAnswer

                      const formatLabel =
                        isDescriptive ? "Descriptive" :
                        isTF ? "True / False" :
                        isAR ? "Assertion & Reason" :
                        qFormat === "diagram" ? "Diagram Based" :
                        qFormat === "fib" ? "Fill in the Blanks" : "MCQ"

                      return (
                        <div
                          key={q.id || idx}
                          className={`bg-white rounded-2xl border transition-all p-3.5 sm:p-5 shadow-xs ${
                            isSelected
                              ? "border-slate-300 ring-2 ring-slate-900/5 shadow-2xs"
                              : "border-slate-200 opacity-60 bg-slate-50/40"
                          }`}
                        >
                          {/* Question Card Header: Two clean, structured tiers */}
                          <div className="space-y-2 mb-3.5 pb-2.5 border-b border-slate-100">
                            {/* Tier 1: Checkbox + Number + Chapter (Left) & Marks + Edit/Delete (Right) */}
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleQuestionSelection(q.id)}
                                  className="w-4 h-4 rounded text-[#324158] focus:ring-[#1E293B] cursor-pointer accent-[#1E293B] shrink-0"
                                />
                                <span className="w-6 h-6 rounded-lg bg-[#1E293B] text-white text-xs font-medium flex items-center justify-center shadow-2xs shrink-0">
                                  {idx + 1}
                                </span>
                                <span className="text-xs font-medium text-slate-800 truncate" title={q.chapter}>
                                  {q.chapter}
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="text-[11px] sm:text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                                  +{q.marks}/-{q.negativeMark}m
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setEditingQuestion(q)}
                                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                                  title="Edit Question"
                                >
                                  <Edit3 size={15} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteQuestion(q.id)}
                                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                  title="Delete Question"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </div>

                            {/* Tier 2: Format Tag, PYQ Reference, Difficulty Tag in a neat clean row */}
                            <div className="flex items-center gap-1.5 flex-wrap pl-6 sm:pl-8 text-[11px]">
                              <span className={`px-2 py-0.5 rounded-md border font-normal ${
                                qFormat === "assertion"
                                    ? "bg-amber-50 text-amber-800 border-amber-200"
                                    : qFormat === "fib"
                                    ? "bg-purple-50 text-purple-800 border-purple-200"
                                    : qFormat === "diagram"
                                    ? "bg-indigo-50 text-indigo-800 border-indigo-200"
                                    : isTF
                                    ? "bg-cyan-50 text-cyan-800 border-cyan-200"
                                    : isDescriptive
                                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                    : "bg-blue-50 text-blue-800 border-blue-200"
                              }`}>
                                {formatLabel}
                              </span>

                              {q.pyqReference && (
                                <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200/60 flex items-center gap-1 font-normal">
                                  <Target className="w-3 h-3 text-emerald-600 shrink-0" />
                                  <span>{q.pyqReference}</span>
                                </span>
                              )}

                              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium uppercase text-[10px] tracking-wider">
                                {q.difficulty}
                              </span>
                            </div>
                          </div>

                          {/* Question Statement with LaTeX Math & Matrices */}
                          {parsedAR ? (
                            <div className="space-y-2.5 pl-0 sm:pl-8 mb-4">
                              <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-amber-50/40 border border-amber-200/70 text-slate-900 shadow-2xs">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-[10px] sm:text-[11px] font-medium uppercase tracking-wider text-amber-900 bg-amber-100/90 border border-amber-300/60 px-2 py-0.5 rounded shadow-2xs">
                                    Assertion (A)
                                  </span>
                                </div>
                                <div className="text-xs sm:text-sm font-normal leading-relaxed text-slate-800 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                                  <MathRenderer content={parsedAR.assertion} />
                                </div>
                              </div>

                              <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-purple-50/40 border border-purple-200/70 text-slate-900 shadow-2xs">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-[10px] sm:text-[11px] font-medium uppercase tracking-wider text-purple-900 bg-purple-100/90 border border-purple-300/60 px-2 py-0.5 rounded shadow-2xs">
                                    Reason (R)
                                  </span>
                                </div>
                                <div className="text-xs sm:text-sm font-normal leading-relaxed text-slate-800 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                                  <MathRenderer content={parsedAR.reason} />
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="text-xs sm:text-sm font-normal text-slate-800 pl-0 sm:pl-8 mb-4 leading-relaxed overflow-x-auto overflow-y-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                              <MathRenderer content={q.questionText} />
                            </div>
                          )}

                          {/* Diagram / Figure reference */}
                          {q.questionImage && (
                            <div className="pl-0 sm:pl-8 mb-4 max-w-xl">
                              <QuestionDiagram src={q.questionImage} />
                            </div>
                          )}

                          {/* Descriptive Model Answer & Rubric OR MCQ Options Grid */}
                          {isDescriptive ? (
                            <div className="space-y-3 pl-0 sm:pl-8 mb-4">
                              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                                <div className="flex items-center justify-between gap-2 mb-1.5">
                                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-700">
                                    Model / Reference Answer
                                  </span>
                                  {q.wordLimit && (
                                    <span className="text-[11px] text-slate-500 font-medium bg-white border border-slate-200 px-2 py-0.5 rounded">
                                      Word Limit: ~{q.wordLimit} words
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs sm:text-sm font-normal text-slate-800 leading-relaxed overflow-x-auto">
                                  <MathRenderer content={q.correctAnswer || "Model answer / key concepts to be evaluated by AI."} />
                                </div>
                              </div>
                              {q.explanation && (
                                <div className="p-3 rounded-xl bg-emerald-50/50 border border-emerald-200/60">
                                  <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-900 block mb-1">
                                    Scoring Rubric &amp; Key Evaluation Points
                                  </span>
                                  <div className="text-xs sm:text-sm font-normal text-emerald-950 leading-relaxed overflow-x-auto">
                                    <MathRenderer content={q.explanation} />
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className={`grid gap-2.5 sm:gap-3 pl-0 sm:pl-8 mb-4 ${isTF ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-2"}`}>
                              {displayOptions.map((opt, oi) => {
                                const isCorrect = opt === displayCorrectAnswer
                                const label = isTF ? (opt === "True" ? "T" : "F") : ["A", "B", "C", "D"][oi]

                                return (
                                  <div
                                    key={oi}
                                    className={`p-3 sm:p-3.5 rounded-xl border flex items-start gap-2.5 sm:gap-3 transition-all ${
                                      isCorrect
                                        ? "bg-emerald-50/70 border-emerald-500 text-emerald-950 font-normal shadow-2xs"
                                        : "bg-slate-50/60 border-slate-200 text-slate-700 hover:bg-white"
                                    }`}
                                  >
                                    <span
                                      className={`w-6 h-6 sm:w-7 sm:h-7 rounded-lg text-xs font-medium flex items-center justify-center shrink-0 mt-0.5 ${
                                        isCorrect
                                          ? "bg-emerald-600 text-white shadow-2xs"
                                          : isTF
                                          ? "bg-slate-200 text-slate-700"
                                          : "bg-white border border-slate-200 text-slate-700"
                                      }`}
                                    >
                                      {isCorrect ? "✓" : label}
                                    </span>

                                    <div className="flex-1 text-xs sm:text-sm font-normal pt-0.5 leading-relaxed overflow-x-auto overflow-y-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                                      <MathRenderer content={opt} />
                                    </div>

                                    {isCorrect && (
                                      <span className="text-[10px] font-medium text-emerald-700 bg-emerald-100/90 border border-emerald-200/80 px-1.5 py-0.5 rounded shrink-0 self-start mt-0.5">
                                        Correct
                                      </span>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          )}

                          {/* Solution Accordion */}
                          <div className="pl-0 sm:pl-8 pt-1">
                            <button
                              type="button"
                              onClick={() => toggleSolution(q.id)}
                              className="text-xs font-medium text-slate-600 hover:text-slate-900 hover:underline flex items-center gap-1.5 cursor-pointer"
                            >
                              {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                              <span>{isExpanded ? "Hide Solution" : "View Step-by-Step Solution"}</span>
                            </button>

                            {isExpanded && (
                              <div className="mt-2.5 p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-700 leading-relaxed space-y-2 overflow-x-auto">
                                <span className="font-medium text-slate-600 block text-xs uppercase tracking-wider">
                                  Concept &amp; Detailed Solution:
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
          {/* ─── STEP 4: EXAM DETAILS & OVERVIEW ─── */}
          {currentStep === 4 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
              {/* Left Card: Exam Details */}
              <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-8 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="mb-5">
                    <h2 className="text-base sm:text-lg font-medium tracking-tight text-slate-900">
                      Exam Details
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Set the key details for your exam.
                    </p>
                  </div>

                  <div className="space-y-5">
                    {/* Exam Title */}
                    <div>
                      <label className="block text-[11px] font-medium text-slate-500 mb-1.5">
                        Exam Title <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={examTitle || getDefaultExamTitle()}
                        onChange={(e) => setExamTitle(e.target.value)}
                        placeholder="e.g. MHT_CET Mathematics - Continuity and Differentiability & 3 more"
                        className="w-full px-3.5 py-2 text-xs font-normal rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-all placeholder:text-slate-400"
                      />
                    </div>

                    {/* Row 1: Duration, Total Marks, Pass Marks */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-500 mb-1.5 truncate">
                          Duration (minutes) <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          min={5}
                          value={duration}
                          onChange={(e) => setDuration(Number(e.target.value) || 0)}
                          className="w-full px-3.5 py-2 text-xs font-normal rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-all"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-slate-500 mb-1.5 truncate">
                          Total Marks <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={examTotalMarks}
                          onChange={(e) => setExamTotalMarks(Number(e.target.value) || 0)}
                          className="w-full px-3.5 py-2 text-xs font-normal rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-all"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-slate-500 mb-1.5 truncate">
                          Pass Marks <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={passMarks}
                          onChange={(e) => setPassMarks(Number(e.target.value) || 0)}
                          className="w-full px-3.5 py-2 text-xs font-normal rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-all"
                        />
                      </div>
                    </div>

                    {/* Row 2: Questions Per Minute */}
                    <div>
                      <label className="block text-[11px] font-medium text-slate-500 mb-1.5">
                        Questions Per Minute <span className="text-slate-400 font-normal">(Optional)</span>
                      </label>
                      <input
                        type="text"
                        value={questionsPerMinute}
                        onChange={(e) => setQuestionsPerMinute(e.target.value)}
                        placeholder="e.g., 1.5"
                        className="w-full px-3.5 py-2 text-xs font-normal rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-all placeholder:text-slate-400"
                      />
                    </div>

                    {/* Instructions Section */}
                    <div className="pt-2">
                      <h3 className="text-sm font-semibold text-slate-800">
                        Instructions
                      </h3>
                      <p className="text-xs text-slate-500 mb-2.5">
                        Add important guidelines for learners.
                      </p>

                      <div className="rounded-2xl border border-slate-200/90 bg-white p-4 space-y-2">
                        {instructions.map((inst, idx) => (
                          <div key={idx} className="flex items-start gap-2.5 group">
                            <span className="text-xs sm:text-sm font-normal text-slate-500 shrink-0 mt-0.5">
                              {idx + 1}.
                            </span>
                            <input
                              type="text"
                              value={inst}
                              onChange={(e) => {
                                const next = [...instructions]
                                next[idx] = e.target.value
                                setInstructions(next)
                              }}
                              className="w-full bg-transparent border-0 border-b border-transparent hover:border-slate-200 focus:border-slate-400 px-1 py-0.5 text-xs sm:text-sm font-normal text-slate-700 focus:outline-none transition-colors"
                            />
                            {instructions.length > 1 && (
                              <button
                                type="button"
                                onClick={() => setInstructions((prev) => prev.filter((_, i) => i !== idx))}
                                className="text-slate-300 hover:text-red-500 p-0.5 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                                title="Remove guideline"
                              >
                                <X size={14} />
                              </button>
                            )}
                          </div>
                        ))}

                        <button
                          type="button"
                          onClick={() => setInstructions((prev) => [...prev, "New guideline for learners."])}
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 pt-1 cursor-pointer"
                        >
                          <Plus size={14} />
                          <span>Add Instruction</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Card: Exam Overview */}
              <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-8 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="mb-5">
                    <h2 className="text-base sm:text-lg font-medium tracking-tight text-slate-900">
                      Exam Overview
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Review your exam configuration.
                    </p>
                  </div>

                  {/* Configuration Key-Value Rows */}
                  <div className="space-y-2.5 sm:space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 sm:gap-4 py-1.5 border-b border-slate-100/80">
                      <span className="text-xs font-normal text-slate-500 w-auto sm:w-36 shrink-0">
                        Exam
                      </span>
                      <span className="text-xs font-medium text-slate-800 text-left sm:text-right break-words">
                        {examOverviewName}
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 sm:gap-4 py-1.5 border-b border-slate-100/80">
                      <span className="text-xs font-normal text-slate-500 w-auto sm:w-36 shrink-0">
                        Class
                      </span>
                      <span className="text-xs font-medium text-slate-800 text-left sm:text-right break-words">
                        {classOverviewText}
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 sm:gap-4 py-1.5 border-b border-slate-100/80">
                      <span className="text-xs font-normal text-slate-500 w-auto sm:w-36 shrink-0">
                        Subjects
                      </span>
                      <span className="text-xs font-medium text-slate-800 text-left sm:text-right break-words">
                        {subjectsOverviewText}
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 sm:gap-4 py-1.5 border-b border-slate-100/80">
                      <span className="text-xs font-normal text-slate-500 w-auto sm:w-36 shrink-0">
                        Chapters
                      </span>
                      <span className="text-xs font-medium text-slate-800 text-left sm:text-right break-words">
                        {chaptersOverviewText}
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 sm:gap-4 py-1.5 border-b border-slate-100/80">
                      <span className="text-xs font-normal text-slate-500 w-auto sm:w-36 shrink-0">
                        Question Format
                      </span>
                      <span className="text-xs font-medium text-slate-800 text-left sm:text-right break-words">
                        {questionFormatOverview}
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 sm:gap-4 py-1.5">
                      <span className="text-xs font-normal text-slate-500 w-auto sm:w-36 shrink-0">
                        Difficulty Level
                      </span>
                      <span className="text-xs font-medium text-slate-800 text-left sm:text-right break-words">
                        {difficultyOverview}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bottom Summary Stats Strip */}
                <div className="mt-8 rounded-2xl bg-slate-50 border border-slate-200/80 p-3.5 sm:p-5 grid grid-cols-3 divide-x divide-slate-200">
                  <div className="text-center px-1 sm:px-2">
                    <p className="text-[10px] sm:text-[11px] font-normal text-slate-500 mb-0.5">Duration</p>
                    <p className="text-sm sm:text-base font-medium text-slate-800">
                      {duration} <span className="text-[10px] sm:text-xs font-normal text-slate-500">min</span>
                    </p>
                  </div>

                  <div className="text-center px-1 sm:px-2">
                    <p className="text-[10px] sm:text-[11px] font-normal text-slate-500 mb-0.5">Total Questions</p>
                    <p className="text-sm sm:text-base font-medium text-slate-800">
                      {selectedQuestionIds.size > 0 ? selectedQuestionIds.size : totalQuestions}
                    </p>
                  </div>

                  <div className="text-center px-1 sm:px-2">
                    <p className="text-[10px] sm:text-[11px] font-normal text-slate-500 mb-0.5">Total Marks</p>
                    <p className="text-sm sm:text-base font-medium text-slate-800">
                      {examTotalMarks}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ─── STEP 5: EXAM SETTINGS (SCHEDULE & EVALUATION & PROCTORING) ─── */}
          {currentStep === 5 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
              {/* Left Card: Exam Schedule */}
              <div className="bg-white rounded-3xl border border-slate-200/80 p-4 sm:p-8 shadow-xs relative overflow-hidden flex flex-col justify-between">
                {/* Subtle decorative background wave in top right */}
                <div className="absolute top-0 right-0 w-48 h-32 bg-gradient-to-bl from-blue-50/70 to-transparent rounded-bl-full pointer-events-none" />

                <div>
                  <div className="mb-5 relative z-10">
                    <h2 className="text-base sm:text-lg font-medium tracking-tight text-slate-900">
                      Exam Schedule
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Set the exam start and end date with time.
                    </p>
                  </div>

                  <div className="space-y-6 relative z-10">
                    {/* ── Start Date & Time ── */}
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="w-1.5 h-4.5 bg-[#1E293B] rounded-full inline-block" />
                        <h3 className="text-sm font-semibold text-slate-800 tracking-tight">
                          Start Date &amp; Time
                        </h3>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
                        {/* Interactive Active Date Picker */}
                        <div
                          onClick={() => openDatePicker(startDateInputRef)}
                          className="relative flex-1 min-w-[140px] cursor-pointer group"
                        >
                          <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:border-blue-400 group-hover:bg-slate-50/80 transition-all shadow-2xs">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
                              <span className="text-xs sm:text-sm font-medium text-slate-800 truncate">
                                {formatDateDisplay(startDate)}
                              </span>
                            </div>
                            <span className="text-[10px] font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100 shrink-0">
                              Select Date
                            </span>
                          </div>
                          <input
                            ref={startDateInputRef}
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                          />
                        </div>

                        {/* Time Controls Group */}
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                          {/* Hour Dropdown */}
                          <div className="relative flex-1 sm:w-20 sm:flex-none">
                            <select
                              value={startHour}
                              onChange={(e) => setStartHour(e.target.value)}
                              className="w-full appearance-none px-3.5 py-2.5 text-xs sm:text-sm font-normal rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-all cursor-pointer pr-7 shadow-2xs"
                            >
                              {["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"].map((h) => (
                                <option key={h} value={h}>
                                  {h}
                                </option>
                              ))}
                            </select>
                            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                          </div>

                          {/* Minute Dropdown */}
                          <div className="relative flex-1 sm:w-20 sm:flex-none">
                            <select
                              value={startMinute}
                              onChange={(e) => setStartMinute(e.target.value)}
                              className="w-full appearance-none px-3.5 py-2.5 text-xs sm:text-sm font-normal rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-all cursor-pointer pr-7 shadow-2xs"
                            >
                              {["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"].map((m) => (
                                <option key={m} value={m}>
                                  {m}
                                </option>
                              ))}
                            </select>
                            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                          </div>

                          {/* AM / PM Segmented Toggle */}
                          <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50/70 p-1 shadow-2xs shrink-0">
                            <button
                              type="button"
                              onClick={() => setStartPeriod("AM")}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                                startPeriod === "AM"
                                  ? "bg-[#1E293B] text-white shadow-2xs"
                                  : "text-slate-500 hover:text-slate-800"
                              }`}
                            >
                              AM
                            </button>
                            <button
                              type="button"
                              onClick={() => setStartPeriod("PM")}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                                startPeriod === "PM"
                                  ? "bg-[#1E293B] text-white shadow-2xs"
                                  : "text-slate-500 hover:text-slate-800"
                              }`}
                            >
                              PM
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* ── End Date & Time ── */}
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="w-1.5 h-4.5 bg-rose-500 rounded-full inline-block" />
                        <h3 className="text-sm font-semibold text-slate-800 tracking-tight">
                          End Date &amp; Time
                        </h3>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
                        {/* Interactive Active Date Picker */}
                        <div
                          onClick={() => openDatePicker(endDateInputRef)}
                          className="relative flex-1 min-w-[140px] cursor-pointer group"
                        >
                          <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:border-rose-400 group-hover:bg-slate-50/80 transition-all shadow-2xs">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <Calendar className="w-4 h-4 text-rose-600 shrink-0" />
                              <span className="text-xs sm:text-sm font-medium text-slate-800 truncate">
                                {formatDateDisplay(endDate)}
                              </span>
                            </div>
                            <span className="text-[10px] font-medium text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-100 shrink-0">
                              Select Date
                            </span>
                          </div>
                          <input
                            ref={endDateInputRef}
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                          />
                        </div>

                        {/* Time Controls Group */}
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                          {/* Hour Dropdown */}
                          <div className="relative flex-1 sm:w-20 sm:flex-none">
                            <select
                              value={endHour}
                              onChange={(e) => setEndHour(e.target.value)}
                              className="w-full appearance-none px-3.5 py-2.5 text-xs sm:text-sm font-normal rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-all cursor-pointer pr-7 shadow-2xs"
                            >
                              {["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"].map((h) => (
                                <option key={h} value={h}>
                                  {h}
                                </option>
                              ))}
                            </select>
                            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                          </div>

                          {/* Minute Dropdown */}
                          <div className="relative flex-1 sm:w-20 sm:flex-none">
                            <select
                              value={endMinute}
                              onChange={(e) => setEndMinute(e.target.value)}
                              className="w-full appearance-none px-3.5 py-2.5 text-xs sm:text-sm font-normal rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-all cursor-pointer pr-7 shadow-2xs"
                            >
                              {["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"].map((m) => (
                                <option key={m} value={m}>
                                  {m}
                                </option>
                              ))}
                            </select>
                            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                          </div>

                          {/* AM / PM Segmented Toggle */}
                          <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50/70 p-1 shadow-2xs shrink-0">
                            <button
                              type="button"
                              onClick={() => setEndPeriod("AM")}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                                endPeriod === "AM"
                                  ? "bg-[#1E293B] text-white shadow-2xs"
                                  : "text-slate-500 hover:text-slate-800"
                              }`}
                            >
                              AM
                            </button>
                            <button
                              type="button"
                              onClick={() => setEndPeriod("PM")}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                                endPeriod === "PM"
                                  ? "bg-[#1E293B] text-white shadow-2xs"
                                  : "text-slate-500 hover:text-slate-800"
                              }`}
                            >
                              PM
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Card: Evaluation Options & Proctoring Security */}
              <div className="bg-white rounded-3xl border border-slate-200/80 p-4 sm:p-8 shadow-xs flex flex-col justify-between">
                <div>
                  {/* ── Evaluation Options ── */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-1.5 h-4.5 bg-[#1E293B] rounded-full inline-block" />
                      <h3 className="text-sm font-semibold text-slate-800 tracking-tight">
                        Evaluation Options
                      </h3>
                    </div>

                    <div className="divide-y divide-slate-100">
                      <div className="flex items-center justify-between py-2.5">
                        <span className="text-xs font-normal text-slate-700">
                          Randomize Questions
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setEvalSettings((prev) => ({
                              ...prev,
                              randomizeQuestions: !prev.randomizeQuestions,
                            }))
                          }
                          className={`w-11 h-6 flex items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                            evalSettings.randomizeQuestions ? "bg-[#1E293B]" : "bg-slate-200"
                          }`}
                        >
                          <div
                            className={`bg-white w-5 h-5 rounded-full shadow-sm transform transition-transform ${
                              evalSettings.randomizeQuestions ? "translate-x-5" : "translate-x-0"
                            }`}
                          />
                        </button>
                      </div>

                      <div className="flex items-center justify-between py-2.5">
                        <span className="text-xs font-normal text-slate-700">
                          Show Results Immediately
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setEvalSettings((prev) => ({
                              ...prev,
                              showResultsImmediately: !prev.showResultsImmediately,
                            }))
                          }
                          className={`w-11 h-6 flex items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                            evalSettings.showResultsImmediately ? "bg-[#1E293B]" : "bg-slate-200"
                          }`}
                        >
                          <div
                            className={`bg-white w-5 h-5 rounded-full shadow-sm transform transition-transform ${
                              evalSettings.showResultsImmediately ? "translate-x-5" : "translate-x-0"
                            }`}
                          />
                        </button>
                      </div>

                      <div className="flex items-center justify-between py-2.5">
                        <span className="text-xs font-normal text-slate-700">
                          Allow Review
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setEvalSettings((prev) => ({
                              ...prev,
                              allowReview: !prev.allowReview,
                            }))
                          }
                          className={`w-11 h-6 flex items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                            evalSettings.allowReview ? "bg-[#1E293B]" : "bg-slate-200"
                          }`}
                        >
                          <div
                            className={`bg-white w-5 h-5 rounded-full shadow-sm transform transition-transform ${
                              evalSettings.allowReview ? "translate-x-5" : "translate-x-0"
                            }`}
                          />
                        </button>
                      </div>

                      <div className="flex items-center justify-between py-2.5">
                        <span className="text-xs font-normal text-slate-700">
                          Enable Negative Marking
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setEvalSettings((prev) => ({
                              ...prev,
                              enableNegativeMarking: !prev.enableNegativeMarking,
                            }))
                          }
                          className={`w-11 h-6 flex items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                            evalSettings.enableNegativeMarking ? "bg-[#1E293B]" : "bg-slate-200"
                          }`}
                        >
                          <div
                            className={`bg-white w-5 h-5 rounded-full shadow-sm transform transition-transform ${
                              evalSettings.enableNegativeMarking ? "translate-x-5" : "translate-x-0"
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* ── Proctoring Security ── */}
                  <div className="mt-5">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-1.5 h-4.5 bg-[#1E293B] rounded-full inline-block" />
                      <h3 className="text-sm font-semibold text-slate-800 tracking-tight">
                        Proctoring Security
                      </h3>
                    </div>

                    <div className="divide-y divide-slate-100">
                      <div className="flex items-center justify-between py-2.5">
                        <span className="text-xs font-normal text-slate-700">
                          Face Detection
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setProctoringSettings((prev) => ({
                              ...prev,
                              faceDetection: !prev.faceDetection,
                            }))
                          }
                          className={`w-11 h-6 flex items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                            proctoringSettings.faceDetection ? "bg-[#1E293B]" : "bg-slate-200"
                          }`}
                        >
                          <div
                            className={`bg-white w-5 h-5 rounded-full shadow-sm transform transition-transform ${
                              proctoringSettings.faceDetection ? "translate-x-5" : "translate-x-0"
                            }`}
                          />
                        </button>
                      </div>

                      <div className="flex items-center justify-between py-2.5">
                        <span className="text-xs font-normal text-slate-700">
                          Tab-Switch Prevention
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setProctoringSettings((prev) => ({
                              ...prev,
                              tabSwitchPrevention: !prev.tabSwitchPrevention,
                            }))
                          }
                          className={`w-11 h-6 flex items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                            proctoringSettings.tabSwitchPrevention ? "bg-[#1E293B]" : "bg-slate-200"
                          }`}
                        >
                          <div
                            className={`bg-white w-5 h-5 rounded-full shadow-sm transform transition-transform ${
                              proctoringSettings.tabSwitchPrevention ? "translate-x-5" : "translate-x-0"
                            }`}
                          />
                        </button>
                      </div>

                      <div className="flex items-center justify-between py-2.5">
                        <span className="text-xs font-normal text-slate-700">
                          Enforce Fullscreen
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setProctoringSettings((prev) => ({
                              ...prev,
                              enforceFullscreen: !prev.enforceFullscreen,
                            }))
                          }
                          className={`w-11 h-6 flex items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                            proctoringSettings.enforceFullscreen ? "bg-[#1E293B]" : "bg-slate-200"
                          }`}
                        >
                          <div
                            className={`bg-white w-5 h-5 rounded-full shadow-sm transform transition-transform ${
                              proctoringSettings.enforceFullscreen ? "translate-x-5" : "translate-x-0"
                            }`}
                          />
                        </button>
                      </div>

                      <div className="flex items-center justify-between py-2.5">
                        <span className="text-xs font-normal text-slate-700">
                          AI Status Analysis
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setProctoringSettings((prev) => ({
                              ...prev,
                              aiStatusAnalysis: !prev.aiStatusAnalysis,
                            }))
                          }
                          className={`w-11 h-6 flex items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                            proctoringSettings.aiStatusAnalysis ? "bg-[#1E293B]" : "bg-slate-200"
                          }`}
                        >
                          <div
                            className={`bg-white w-5 h-5 rounded-full shadow-sm transform transition-transform ${
                              proctoringSettings.aiStatusAnalysis ? "translate-x-5" : "translate-x-0"
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Pro-Tip Note Callout */}
                <div className="mt-6 rounded-2xl bg-[#EFF6FF] border border-[#BFDBFE]/70 p-3.5 sm:p-4 flex items-center gap-2.5 text-xs text-[#1E40AF]">
                  <Info className="w-4 h-4 text-[#2563EB] shrink-0" />
                  <span className="leading-relaxed">
                    <strong className="font-medium text-[#1E40AF]">Pro-Tip:</strong> Face Detection &amp; AI Status Analysis require students to have a working webcam.
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ─── STEP 6: PUBLISH & CONFIRMATION ─── */}
          {currentStep === 6 && (
            <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 p-6 sm:p-10 shadow-xs">
              <div className="mb-5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  STEP 6 · FINAL PUBLISH
                </p>
                <h2 className="mt-1 text-lg sm:text-xl font-bold tracking-tight text-slate-900">
                  Ready to Publish Exam Paper
                </h2>
                <p className="text-xs text-slate-500 mt-1 font-normal">
                  Review the final summary below. Once published, your exam will be active and scheduled for candidates.
                </p>
              </div>

              {/* Summary Card Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                <div className="p-4 rounded-2xl border border-slate-200/90 bg-white">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-1.5">
                    PAPER DETAILS
                  </span>
                  <p className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                    {examTitle || getDefaultExamTitle()}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5 font-normal">
                    {examOverviewName} • {classOverviewText}
                  </p>
                </div>

                <div className="p-4 rounded-2xl border border-slate-200/90 bg-white">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-1.5">
                    QUESTIONS &amp; MARKS
                  </span>
                  <p className="text-xs sm:text-sm font-bold text-slate-900">
                    {selectedQuestionIds.size > 0 ? selectedQuestionIds.size : totalQuestions} Questions
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5 font-normal">
                    {examTotalMarks} Marks • {duration} min
                  </p>
                </div>

                <div className="p-4 rounded-2xl border border-slate-200/90 bg-white">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-1.5">
                    SCHEDULED WINDOW
                  </span>
                  <p className="text-xs sm:text-sm font-bold text-slate-900">
                    {formatDateDisplay(startDate)}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5 font-normal">
                    {startHour}:{startMinute} {startPeriod} – {endHour}:{endMinute} {endPeriod}
                  </p>
                </div>
              </div>

              {errorMsg && (
                <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Right-aligned Actions at Bottom Right */}
              <div className="mt-7 flex items-center justify-end gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setCurrentStep(5)
                    window.scrollTo({ top: 0, behavior: "smooth" })
                  }}
                  className="px-5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 font-semibold text-xs shadow-2xs transition-all cursor-pointer"
                >
                  Back
                </button>

                <button
                  type="button"
                  onClick={handleSaveAsExam}
                  disabled={creatingExam || selectedQuestionIds.size === 0}
                  className="px-5 py-2 rounded-xl bg-[#0B192C] hover:bg-[#1E293B] text-white font-semibold text-xs shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-md active:scale-[0.99]"
                >
                  {creatingExam ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-amber-300" />
                      <span>{editingExamId ? "Updating..." : "Publishing..."}</span>
                    </>
                  ) : (
                    <span>{editingExamId ? "Update Exam Paper" : "Publish Exam"}</span>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ─── Bottom Navigation Actions (Steps 1 to 5) ─── */}
          {currentStep < 6 && (
          <div className="mt-8 flex items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                if (currentStep > 1) {
                  setCurrentStep((step) => step - 1)
                  window.scrollTo({ top: 0, behavior: "smooth" })
                } else {
                  router.push("/admin/exams")
                }
              }}
              className="px-4 sm:px-6 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-medium text-xs sm:text-sm hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer shrink-0"
            >
              Back
            </button>

            {currentStep === 1 && (
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                disabled={selectedSubjects.length === 0}
                className="px-4 sm:px-6 py-2.5 rounded-xl bg-[#1E293B] hover:bg-[#0F172A] text-white font-medium text-xs sm:text-sm flex items-center gap-2 shadow-sm transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span>Next Step</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}

            {currentStep === 2 && (
              <div className="flex items-center gap-2 flex-wrap justify-end">
                {errorMsg && (
                  <span className="text-xs text-red-600 font-medium bg-red-50 border border-red-200 px-3 py-1.5 rounded-lg max-w-xs truncate">
                    {errorMsg}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (generatedQuestions.length > 0) {
                      setCurrentStep(3)
                      window.scrollTo({ top: 0, behavior: "smooth" })
                    } else {
                      handleGenerate()
                    }
                  }}
                  disabled={
                    isGenerating ||
                    (selectedChapters.length === 0 && selectedTopics.length === 0 && !uploadedSyllabusText) ||
                    totalQuestions === 0
                  }
                  className="px-6 py-2.5 rounded-xl bg-[#324158] hover:bg-[#253244] text-white font-semibold text-xs sm:text-sm flex items-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.99]"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>
                        {generationStep === 1
                          ? "Analyzing PYQs..."
                          : generationStep === 2
                          ? "Generating Questions..."
                          : "Validating Questions..."}
                      </span>
                    </>
                  ) : (
                    <>
                      <span>Next Step</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            )}

            {currentStep === 3 && (
              <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setPrintMode("student")
                    setPrintModalOpen(true)
                  }}
                  disabled={isGenerating || generatedQuestions.length === 0}
                  className="px-3.5 sm:px-5 py-2.5 sm:py-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs sm:text-sm flex items-center gap-2 shadow-xs transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Print question paper for students (Without Solutions)"
                >
                  <Printer className="w-4 h-4 text-blue-600" />
                  <span>Print Student Copy</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPrintMode("teacher")
                    setPrintModalOpen(true)
                  }}
                  disabled={isGenerating || generatedQuestions.length === 0}
                  className="px-3.5 sm:px-5 py-2.5 sm:py-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs sm:text-sm flex items-center gap-2 shadow-xs transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Print question paper with complete solutions and answer key"
                >
                  <FileText className="w-4 h-4 text-emerald-600" />
                  <span>Print Teacher Copy</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (isGenerating) return
                    setCurrentStep(4)
                    window.scrollTo({ top: 0, behavior: "smooth" })
                  }}
                  disabled={isGenerating || selectedQuestionIds.size === 0}
                  className="px-4 sm:px-7 py-2.5 sm:py-3 rounded-xl bg-[#1E293B] hover:bg-[#0F172A] text-white font-medium text-xs sm:text-sm flex items-center gap-2 shadow-md transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-lg active:scale-[0.99]"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-amber-300" />
                      <span>Generating ({generatedQuestions.length}/{totalQuestions})...</span>
                    </>
                  ) : (
                    <>
                      <span>Next: Exam Details</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            )}

            {currentStep === 4 && (
              <button
                type="button"
                onClick={() => {
                  setCurrentStep(5)
                  window.scrollTo({ top: 0, behavior: "smooth" })
                }}
                className="px-4 sm:px-7 py-2.5 sm:py-3 rounded-xl bg-[#0B192C] hover:bg-[#1E293B] text-white font-medium text-xs sm:text-sm flex items-center gap-2 shadow-md transition-all cursor-pointer hover:shadow-lg active:scale-[0.99]"
              >
                <span>Next: Settings</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}

            {currentStep === 5 && (
              <button
                type="button"
                onClick={() => {
                  setCurrentStep(6)
                  window.scrollTo({ top: 0, behavior: "smooth" })
                }}
                className="px-4 sm:px-7 py-2.5 sm:py-3 rounded-xl bg-[#0B192C] hover:bg-[#1E293B] text-white font-medium text-xs sm:text-sm flex items-center gap-2 shadow-md transition-all cursor-pointer hover:shadow-lg active:scale-[0.99]"
              >
                <span>Next: Publish</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
          )}
      </div>
    </div>

      {/* ─── Inline Edit Question Modal ─── */}
      {editingQuestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-2xl bg-white rounded-2xl p-4 sm:p-6 shadow-2xl border border-gray-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-[#324158]">Edit Question Details</h3>
              <button
                onClick={() => setEditingQuestion(null)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer p-1"
              >
                <X size={18} />
              </button>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1">
                Question Statement (LaTeX supported with $...$):
              </label>
              <textarea
                rows={3}
                value={editingQuestion.questionText}
                onChange={(e) =>
                  setEditingQuestion({ ...editingQuestion, questionText: e.target.value })
                }
                className="w-full p-3 text-xs sm:text-sm rounded-xl border border-gray-200 bg-gray-50/50 text-[#324158] font-mono focus:outline-none focus:border-[#2D3A4A]"
              />
            </div>

            {(editingQuestion.type === "descriptive" || getQuestionFormat(editingQuestion) === "descriptive") ? (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">
                    Model / Reference Answer (Evaluated by AI Examiner):
                  </label>
                  <textarea
                    rows={4}
                    value={editingQuestion.correctAnswer || ""}
                    onChange={(e) =>
                      setEditingQuestion({ ...editingQuestion, correctAnswer: e.target.value })
                    }
                    placeholder="Provide the expected theoretical concepts, derivation steps, or key points..."
                    className="w-full p-3 text-xs sm:text-sm rounded-xl border border-gray-200 bg-gray-50/50 text-[#324158] font-mono focus:outline-none focus:border-[#2D3A4A]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-700 block mb-1">
                      Marks:
                    </label>
                    <input
                      type="number"
                      value={editingQuestion.marks || 5}
                      onChange={(e) =>
                        setEditingQuestion({ ...editingQuestion, marks: Number(e.target.value) || 0 })
                      }
                      className="w-full p-2 text-xs rounded-lg border border-gray-200 bg-white text-[#324158] focus:outline-none focus:border-[#2D3A4A]"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-700 block mb-1">
                      Approx. Word Limit:
                    </label>
                    <input
                      type="number"
                      value={editingQuestion.wordLimit || 150}
                      onChange={(e) =>
                        setEditingQuestion({ ...editingQuestion, wordLimit: Number(e.target.value) || 0 })
                      }
                      className="w-full p-2 text-xs rounded-lg border border-gray-200 bg-white text-[#324158] focus:outline-none focus:border-[#2D3A4A]"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                <label className="text-xs font-medium text-gray-700 block">
                  Options &amp; Correct Answer:
                </label>
                {(editingQuestion.options || []).map((opt, i) => (
                  <div key={i} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <div className="flex items-center gap-2 flex-1">
                      <span className="w-6 text-xs font-medium text-gray-500 shrink-0">
                        {["A", "B", "C", "D"][i]}:
                      </span>
                      <input
                        type="text"
                        value={opt}
                        onChange={(e) => {
                          const newOpts = [...(editingQuestion.options || [])]
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
                        className="flex-1 p-2 text-xs rounded-lg border border-gray-200 bg-white text-[#324158] font-mono focus:outline-none focus:border-[#2D3A4A]"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setEditingQuestion({ ...editingQuestion, correctAnswer: opt })
                      }
                      className={`self-end sm:self-auto px-3 py-1.5 text-xs rounded-lg font-medium transition-colors cursor-pointer shrink-0 ${
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
            )}

            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1">
                Step-by-Step Solution / Explanation:
              </label>
              <textarea
                rows={3}
                value={editingQuestion.explanation}
                onChange={(e) =>
                  setEditingQuestion({ ...editingQuestion, explanation: e.target.value })
                }
                className="w-full p-3 text-xs sm:text-sm rounded-xl border border-gray-200 bg-gray-50/50 text-[#324158] font-mono focus:outline-none focus:border-[#2D3A4A]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setEditingQuestion(null)}
                className="px-4 py-2 rounded-xl border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSaveEdit(editingQuestion)}
                className="px-5 py-2 rounded-xl bg-[#2D3A4A] text-white text-xs font-medium hover:bg-[#1e2a38] cursor-pointer"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printable Exam Paper Preview & Print Modal */}
      {printModalOpen && (
        <PrintableExamPaper
          isOpen={printModalOpen}
          onClose={() => setPrintModalOpen(false)}
          questions={
            selectedQuestionIds.size > 0 && selectedQuestionIds.size < generatedQuestions.length
              ? generatedQuestions.filter((q) => selectedQuestionIds.has(q.id))
              : generatedQuestions
          }
          examTitle={examTitle || getDefaultExamTitle()}
          subject={activeSubjectTab || selectedSubject || "Physics"}
          examTarget={selectedExam}
          grade={selectedGrade}
          durationMinutes={duration || Math.max(generatedQuestions.length * 2, 30)}
          defaultMode={printMode}
          instituteName={coachingName}
        />
      )}
    </div>
  )
}

export default function AIGeneratorPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F5F6FA] flex items-center justify-center">
          <div className="flex items-center gap-3 text-gray-500">
            <Loader2 className="animate-spin text-slate-700" size={24} />
            <span className="text-sm font-medium">Loading Competitive Test Studio...</span>
          </div>
        </div>
      }
    >
      <AIGeneratorContent />
    </Suspense>
  )
}
