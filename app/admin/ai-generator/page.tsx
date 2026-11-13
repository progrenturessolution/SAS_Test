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
  Calendar,
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

  // Blueprint Format Matrix - Default to 10 MCQ questions
  const [blueprintFormats, setBlueprintFormats] = useState([
    { id: "mcq", label: "MCQ", checked: true, count: 10, marks: 4 },
    { id: "assertion", label: "Assertion", checked: false, count: 0, marks: 4 },
    { id: "fib", label: "Fill in the Blanks", checked: false, count: 0, marks: 2 },
    { id: "true_false", label: "True / False", checked: false, count: 0, marks: 2 },
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

  // Step 4: Exam Details States
  const [duration, setDuration] = useState<number>(30)
  const [examTotalMarks, setExamTotalMarks] = useState<number>(200)
  const [passMarks, setPassMarks] = useState<number>(80)
  const [questionsPerMinute, setQuestionsPerMinute] = useState<string>("")
  const [minDurationHours, setMinDurationHours] = useState<string>("02")
  const [minDurationMinutes, setMinDurationMinutes] = useState<string>("00")
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
      q.questionFormat === "true_false" ||
      q.questionText?.toLowerCase().startsWith("true or false") ||
      q.questionText?.toLowerCase().startsWith("true/false") ||
      (Array.isArray(q.options) && q.options.length === 2 && q.options.includes("True"))
    ) {
      return "true_false"
    }
    if (
      q.questionFormat === "assertion" ||
      Boolean(parseAssertionReason(q.questionText || ""))
    ) {
      return "assertion"
    }
    return q.questionFormat || q.type || "mcq"
  }

  const filteredGeneratedQuestions = useMemo(() => {
    if (formatFilter === "all") return generatedQuestions
    return generatedQuestions.filter((q) => getQuestionFormat(q) === formatFilter)
  }, [generatedQuestions, formatFilter])

  const formatCounts = useMemo(() => {
    const counts: Record<string, number> = { all: generatedQuestions.length, mcq: 0, assertion: 0, fib: 0, true_false: 0 }
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
    const safeMarks = isNaN(parsed) ? 4 : Math.max(0, Math.min(20, Math.round(parsed)))
    setBlueprintFormats((prev) =>
      prev.map((f) => (f.id === id ? { ...f, marks: safeMarks } : f))
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
      const countToGenerate = Math.max(1, Number(totalQuestions) || Number(questionCount) || 10)

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
      setFormatFilter("all") // Reset filter to all formats so new questions always render

      // Set default exam title
      const chapterTitle =
        selectedChapters.length === 1
          ? selectedChapters[0]
          : selectedChapters.length > 1
          ? `${selectedChapters[0]} & ${selectedChapters.length - 1} more`
          : targetSubject
      const examCode = selectedExam.replace("-", "_")
      setExamTitle(`${examCode} ${targetSubject} - ${chapterTitle}`)

      // Initialize Step 4 Exam Details
      const calculatedTotal =
        data.questions.reduce((sum: number, q: any) => sum + (q.marks || 4), 0) || totalMarks || 200
      setExamTotalMarks(calculatedTotal)
      setPassMarks(Math.round(calculatedTotal * 0.4))
      setDuration(30)

      // Transition to Step 3
      setCurrentStep(3)

      // Scroll smoothly to results
      window.scrollTo({ top: 0, behavior: "smooth" })
    } catch (err: any) {
      setErrorMsg(err?.message || "An unexpected error occurred while generating.")
      window.scrollTo({ top: 0, behavior: "smooth" })
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

      const res = await fetch("/api/exams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: examTitle.trim() || getDefaultExamTitle(),
          examType: selectedExam,
          subject: activeSubjectTab || selectedSubject,
          class: selectedGrade === "both" ? "11th + 12th" : `${selectedGrade}th`,
          duration: duration || Math.max(toSave.length * 2, 30),
          totalMarks: examTotalMarks || totalMarks,
          passMarks: passMarks || Math.floor((examTotalMarks || totalMarks) * 0.4),
          questionsPerMin: questionsPerMinute ? Number(questionsPerMinute) : undefined,
          description: finalInstructions.join("\n"),
          instructions: finalInstructions,
          sections: [
            {
              name: "Questions",
              title: `${activeSubjectTab || selectedSubject} - Section 1`,
              type: "mcq",
              negativeMarking: isNegativeEnabled,
              sectionNegativeMark: defaultNegMark,
              questionRange: `1-${toSave.length}`,
              questions: toSave.map((q) => {
                const isTF = getQuestionFormat(q) === "true_false"
                const options = isTF ? ["True", "False"] : q.options
                const correctAnswer = isTF
                  ? (String(q.correctAnswer).toLowerCase().includes("false") || q.correctAnswer === "Option B" ? "False" : "True")
                  : q.correctAnswer

                return {
                  type: isTF ? "truefalse" : "mcq",
                  questionText: q.questionText,
                  difficulty: q.difficulty,
                  marks: q.marks || currentExamMeta.defaultMarksPerQuestion,
                  negativeMark:
                    q.negativeMark !== undefined
                      ? q.negativeMark
                      : defaultNegMark,
                  options,
                  correctAnswer,
                  explanation: q.explanation,
                }
              }),
            },
          ],
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
          status: "draft",
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to create exam")

      const createdId = data.exam?._id || data.id
      router.push(`/admin/exams/${createdId}/edit?step=3`)
    } catch (err: any) {
      setErrorMsg("Error creating exam: " + err.message)
    } finally {
      setCreatingExam(false)
    }
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl sm:text-3xl font-semibold tracking-tight text-slate-900">
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
              <span className="w-6 h-6 rounded-lg bg-[#1E293B] text-white text-xs font-semibold flex items-center justify-center shadow-2xs">
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
              const isClickable = s.step <= currentStep || (generatedQuestions.length > 0 && s.step <= 6)

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
                      ? "bg-[#1E293B] text-white shadow-xs font-semibold ring-2 ring-slate-900/15"
                      : isComplete
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200/80"
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
                          if (s.step <= currentStep || (generatedQuestions.length > 0 && s.step <= 6)) {
                            setCurrentStep(s.step)
                            window.scrollTo({ top: 0, behavior: "smooth" })
                          }
                        }}
                        className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-medium transition-all cursor-pointer ${
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
                        className={`mt-2 text-xs font-medium transition-colors text-center ${
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
                <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                  STEP 1 · EXAM DETAILS
                </p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
                  Choose Exam, Class and Subjects
                </h2>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
                {/* Column 1: Exam */}
                <div className={`lg:col-span-3 lg:pr-6 relative ${examDropdownOpen ? "z-50" : "z-20"}`}>
                  <label className="block text-xs font-medium text-slate-600 mb-2">
                    Exam
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setExamDropdownOpen(!examDropdownOpen)
                      setSubjectDropdownOpen(false)
                    }}
                    className="w-full h-12 px-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 flex items-center justify-between text-sm font-normal text-slate-800 transition-colors shadow-2xs focus:outline-none focus:ring-2 focus:ring-slate-900/10 cursor-pointer"
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
                                ? "bg-slate-100 text-[#1E293B] font-medium"
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
                  <label className="block text-xs font-medium text-slate-600 mb-2">
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
                          className={`flex-1 h-12 px-2 sm:px-3 rounded-xl text-[11px] sm:text-xs md:text-sm font-medium transition-all duration-150 cursor-pointer ${
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
                  <label className="block text-xs font-medium text-slate-600 mb-2">
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

          {/* ─── STEP 2: CONTENT & BLUEPRINT (MIRO DESIGN) ─── */}
          {currentStep === 2 && (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-8 shadow-xs">
              {/* Top Header inside card */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-slate-100">
                <div className="flex items-center gap-3 sm:gap-3.5">
                  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-700 shadow-2xs shrink-0">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-2xl font-semibold tracking-tight text-slate-900">
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
                    <span className="font-medium text-slate-800">
                      {selectedGrade === "both"
                        ? "11th + 12th"
                        : selectedGrade === "11"
                        ? "Class 11th"
                        : "Class 12th"}
                    </span>
                  </span>
                  <span className="px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200/80 text-[11px] sm:text-xs font-normal text-slate-600">
                    Subjects:{" "}
                    <span className="font-medium text-slate-800">
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
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-start pt-6">
                {/* Left Column: Chapter Selection */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="w-1 h-4 bg-slate-900 rounded-full" />
                    <h3 className="text-base font-semibold text-slate-800">Chapter Selection</h3>
                  </div>

                  {/* Subject Filter Pills */}
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
                          className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-normal transition-all shrink-0 sm:shrink cursor-pointer whitespace-nowrap ${
                            isActive
                              ? "bg-[#1E293B] text-white shadow-xs font-medium"
                              : "bg-white border border-slate-200 text-slate-700 hover:border-slate-300"
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
                        className={`px-3 py-1 rounded-full text-xs font-normal transition-colors shrink-0 sm:shrink cursor-pointer whitespace-nowrap ${
                          classFilter === cf.id
                            ? "bg-blue-100 text-blue-800 font-medium"
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
                              <span className="font-medium text-slate-800 text-xs sm:text-sm">
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
                                  <span className="font-normal text-slate-700">
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
                              <span className="font-medium text-slate-800 text-xs sm:text-sm">
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
                                  <span className="font-normal text-slate-700">
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
                  <div className="mt-4 px-4 py-2.5 rounded-xl bg-blue-50/70 border border-blue-100 flex items-center gap-2 text-xs font-medium text-blue-900">
                    <Check className="w-4 h-4 text-blue-600 stroke-[2.5]" />
                    <span>Selected: {selectedChapters.length} Chapters</span>
                  </div>
                </div>

                {/* Right Column: Question Blueprint */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <div className="flex items-center gap-2">
                      <span className="w-1 h-4 bg-slate-900 rounded-full" />
                      <h3 className="text-base font-semibold text-slate-800">Question Blueprint</h3>
                    </div>
                  </div>

                  {/* Blueprint Matrix Table */}
                  <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
                    <div className="overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                      <div className="min-w-[340px]">
                        <div className="grid grid-cols-12 gap-2 px-3 sm:px-4 py-3 bg-slate-50/80 border-b border-slate-100 text-xs font-medium text-slate-500">
                          <span className="col-span-6">Question Format</span>
                          <span className="col-span-3 text-center">No. of Questions</span>
                          <span className="col-span-3 text-center">Marks</span>
                        </div>

                        <div className="divide-y divide-slate-100">
                          {blueprintFormats.map((f) => (
                            <div
                              key={f.id}
                              className={`grid grid-cols-12 gap-2 px-3 sm:px-4 py-3 items-center transition-colors ${
                                f.checked ? "bg-white" : "bg-slate-50/40 opacity-75"
                              }`}
                            >
                              <label className="col-span-6 flex items-center gap-2 sm:gap-2.5 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={f.checked}
                                  onChange={() => toggleFormatCheck(f.id)}
                                  className="w-4 h-4 rounded text-[#1E293B] focus:ring-slate-900 border-slate-300 cursor-pointer shrink-0"
                                />
                                <span className="font-normal text-slate-800 text-xs sm:text-sm truncate">
                                  {f.label}
                                </span>
                              </label>

                              <div className="col-span-3 flex justify-center items-center">
                                <input
                                  type="number"
                                  disabled={!f.checked}
                                  min={0}
                                  max={200}
                                  value={f.count === 0 ? "" : f.count}
                                  placeholder="0"
                                  onChange={(e) => {
                                    const raw = e.target.value
                                    const val = raw === "" ? 0 : Math.max(0, Math.min(200, parseInt(raw, 10) || 0))
                                    updateFormatCount(f.id, val)
                                  }}
                                  className="w-16 sm:w-20 h-9 px-2 text-center rounded-lg border border-slate-200 bg-white text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 disabled:bg-slate-100 disabled:text-slate-400"
                                />
                              </div>

                              <div className="col-span-3 flex justify-center">
                                <select
                                  disabled={!f.checked}
                                  value={f.marks}
                                  onChange={(e) => updateFormatMarks(f.id, Number(e.target.value))}
                                  className="w-14 sm:w-16 h-9 px-1.5 sm:px-2 rounded-lg border border-slate-200 bg-white text-xs font-normal text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900 cursor-pointer disabled:bg-slate-100 disabled:text-slate-400"
                                >
                                  {[0, 1, 2, 3, 4, 5, 8, 10].map((m) => (
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
                    </div>
                  </div>

                  {/* Info Summary: Total Questions & Marks */}
                  <div className="mt-4 px-4 py-3 rounded-xl bg-blue-50/70 border border-blue-100 flex items-center gap-3 text-xs text-blue-950 font-normal">
                    <Info className="w-4 h-4 text-blue-600 shrink-0" />
                    <div className="flex items-center gap-3">
                      <span>
                        Total Questions:{" "}
                        <span className="font-semibold text-slate-900">{totalQuestions}</span>
                      </span>
                      <span className="text-blue-200">|</span>
                      <span>
                        Total Marks:{" "}
                        <span className="font-semibold text-slate-900">{totalMarks}</span>
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
                    <p className="text-sm font-semibold text-slate-900">Difficulty Level</p>
                    <p className="text-xs text-slate-400">Choose the challenge level for learners.</p>
                  </div>
                </div>

                <div className="md:w-80">
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value as any)}
                    className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-normal text-slate-800 shadow-2xs focus:outline-none focus:ring-2 focus:ring-slate-900/10 cursor-pointer"
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

                      {/* Desktop Proceed Button */}
                      <button
                        type="button"
                        onClick={() => {
                          setCurrentStep(4)
                          window.scrollTo({ top: 0, behavior: "smooth" })
                        }}
                        disabled={selectedQuestionIds.size === 0}
                        className="hidden sm:inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1E293B] hover:bg-[#0F172A] text-white text-xs sm:text-sm font-medium shadow-sm disabled:opacity-40 transition-all cursor-pointer"
                      >
                        <span>Proceed to Exam Details</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
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
                    <div className="flex items-center gap-2 pt-1">
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

                      {/* Mobile Proceed Button */}
                      <button
                        type="button"
                        onClick={() => {
                          setCurrentStep(4)
                          window.scrollTo({ top: 0, behavior: "smooth" })
                        }}
                        disabled={selectedQuestionIds.size === 0}
                        className="sm:hidden flex-1 px-3.5 py-2 rounded-xl bg-[#1E293B] hover:bg-[#0F172A] text-white text-xs font-medium shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-40 transition-all cursor-pointer"
                      >
                        <span>Next: Details</span>
                        <ArrowRight className="w-3.5 h-3.5" />
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
                    </div>
                  )}

                  {/* Generated Questions List */}
                  <div className="space-y-4">
                    {filteredGeneratedQuestions.map((q, idx) => {
                      const isSelected = selectedQuestionIds.has(q.id)
                      const isExpanded = expandedSolutions.has(q.id)
                      const qFormat = getQuestionFormat(q)
                      const isTF = qFormat === "true_false"
                      const parsedAR = parseAssertionReason(q.questionText)
                      const isAR = qFormat === "assertion" || Boolean(parsedAR)

                      const displayOptions = isTF ? ["True", "False"] : q.options
                      const displayCorrectAnswer = isTF
                        ? (String(q.correctAnswer).toLowerCase().includes("false") || q.correctAnswer === "Option B" ? "False" : "True")
                        : q.correctAnswer

                      const formatLabel =
                        isTF ? "True / False" :
                        isAR ? "Assertion & Reason" :
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
                                  className="w-4 h-4 rounded text-[#1E293B] focus:ring-[#1E293B] cursor-pointer accent-[#1E293B] shrink-0"
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
                                    : isTF
                                    ? "bg-cyan-50 text-cyan-800 border-cyan-200"
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
                                <div className="text-xs sm:text-base font-normal leading-relaxed text-slate-800 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                                  <MathRenderer content={parsedAR.assertion} />
                                </div>
                              </div>

                              <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-purple-50/40 border border-purple-200/70 text-slate-900 shadow-2xs">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-[10px] sm:text-[11px] font-medium uppercase tracking-wider text-purple-900 bg-purple-100/90 border border-purple-300/60 px-2 py-0.5 rounded shadow-2xs">
                                    Reason (R)
                                  </span>
                                </div>
                                <div className="text-xs sm:text-base font-normal leading-relaxed text-slate-800 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                                  <MathRenderer content={parsedAR.reason} />
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="text-xs sm:text-base font-normal text-slate-800 pl-0 sm:pl-8 mb-4 leading-relaxed overflow-x-auto overflow-y-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                              <MathRenderer content={q.questionText} />
                            </div>
                          )}

                          {/* Options Grid */}
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
                  <div className="mb-6">
                    <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900">
                      Exam Details
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500 mt-1">
                      Set the key details for your exam.
                    </p>
                  </div>

                  <div className="space-y-5">
                    {/* Exam Title */}
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-2">
                        Exam Title <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={examTitle || getDefaultExamTitle()}
                        onChange={(e) => setExamTitle(e.target.value)}
                        placeholder="e.g. MHT_CET Mathematics - Continuity and Differentiability & 3 more"
                        className="w-full px-4 py-2.5 text-xs sm:text-sm font-normal rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-all placeholder:text-slate-400"
                      />
                    </div>

                    {/* Row 1: Duration, Total Marks, Pass Marks */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-2 truncate">
                          Duration (minutes) <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          min={5}
                          value={duration}
                          onChange={(e) => setDuration(Number(e.target.value) || 0)}
                          className="w-full px-4 py-2.5 text-xs sm:text-sm font-normal rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-all"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-2 truncate">
                          Total Marks <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={examTotalMarks}
                          onChange={(e) => setExamTotalMarks(Number(e.target.value) || 0)}
                          className="w-full px-4 py-2.5 text-xs sm:text-sm font-normal rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-all"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-2 truncate">
                          Pass Marks <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={passMarks}
                          onChange={(e) => setPassMarks(Number(e.target.value) || 0)}
                          className="w-full px-4 py-2.5 text-xs sm:text-sm font-normal rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-all"
                        />
                      </div>
                    </div>

                    {/* Row 2: Questions Per Minute & Minimum Exam Duration */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-2">
                          Questions Per Minute <span className="text-slate-400 font-normal">(Optional)</span>
                        </label>
                        <input
                          type="text"
                          value={questionsPerMinute}
                          onChange={(e) => setQuestionsPerMinute(e.target.value)}
                          placeholder="e.g., 1.5"
                          className="w-full px-4 py-2.5 text-xs sm:text-sm font-normal rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-all placeholder:text-slate-400"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-2">
                          Minimum Exam Duration <span className="text-red-500">*</span>
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="relative">
                            <select
                              value={minDurationHours}
                              onChange={(e) => setMinDurationHours(e.target.value)}
                              className="w-full appearance-none px-4 py-2.5 text-xs sm:text-sm font-normal rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-all cursor-pointer pr-8"
                            >
                              <option value="00">00 Hr</option>
                              <option value="01">01 Hr</option>
                              <option value="02">02 Hr</option>
                              <option value="03">03 Hr</option>
                            </select>
                            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                          </div>

                          <div className="relative">
                            <select
                              value={minDurationMinutes}
                              onChange={(e) => setMinDurationMinutes(e.target.value)}
                              className="w-full appearance-none px-4 py-2.5 text-xs sm:text-sm font-normal rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-all cursor-pointer pr-8"
                            >
                              <option value="00">00 Min</option>
                              <option value="15">15 Min</option>
                              <option value="30">30 Min</option>
                              <option value="45">45 Min</option>
                            </select>
                            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                          </div>
                        </div>
                      </div>
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
                  <div className="mb-6">
                    <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900">
                      Exam Overview
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500 mt-1">
                      Review your exam configuration.
                    </p>
                  </div>

                  {/* Configuration Key-Value Rows */}
                  <div className="space-y-3 sm:space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 sm:gap-4 py-1.5 border-b border-slate-100/80">
                      <span className="text-xs sm:text-sm font-normal text-slate-500 w-auto sm:w-36 shrink-0">
                        Exam
                      </span>
                      <span className="text-xs sm:text-sm font-normal text-slate-800 text-left sm:text-right break-words">
                        {examOverviewName}
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 sm:gap-4 py-1.5 border-b border-slate-100/80">
                      <span className="text-xs sm:text-sm font-normal text-slate-500 w-auto sm:w-36 shrink-0">
                        Class
                      </span>
                      <span className="text-xs sm:text-sm font-normal text-slate-800 text-left sm:text-right break-words">
                        {classOverviewText}
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 sm:gap-4 py-1.5 border-b border-slate-100/80">
                      <span className="text-xs sm:text-sm font-normal text-slate-500 w-auto sm:w-36 shrink-0">
                        Subjects
                      </span>
                      <span className="text-xs sm:text-sm font-normal text-slate-800 text-left sm:text-right break-words">
                        {subjectsOverviewText}
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 sm:gap-4 py-1.5 border-b border-slate-100/80">
                      <span className="text-xs sm:text-sm font-normal text-slate-500 w-auto sm:w-36 shrink-0">
                        Chapters
                      </span>
                      <span className="text-xs sm:text-sm font-normal text-slate-800 text-left sm:text-right break-words">
                        {chaptersOverviewText}
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 sm:gap-4 py-1.5 border-b border-slate-100/80">
                      <span className="text-xs sm:text-sm font-normal text-slate-500 w-auto sm:w-36 shrink-0">
                        Question Format
                      </span>
                      <span className="text-xs sm:text-sm font-normal text-slate-800 text-left sm:text-right break-words">
                        {questionFormatOverview}
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 sm:gap-4 py-1.5">
                      <span className="text-xs sm:text-sm font-normal text-slate-500 w-auto sm:w-36 shrink-0">
                        Difficulty Level
                      </span>
                      <span className="text-xs sm:text-sm font-normal text-slate-800 text-left sm:text-right break-words">
                        {difficultyOverview}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bottom Summary Stats Strip */}
                <div className="mt-8 rounded-2xl bg-slate-50 border border-slate-200/80 p-3.5 sm:p-5 grid grid-cols-3 divide-x divide-slate-200">
                  <div className="text-center px-1 sm:px-2">
                    <p className="text-[11px] sm:text-xs font-normal text-slate-500 mb-1">Duration</p>
                    <p className="text-lg sm:text-2xl font-semibold text-slate-800">
                      {duration} <span className="text-[10px] sm:text-sm font-normal text-slate-500">min</span>
                    </p>
                  </div>

                  <div className="text-center px-1 sm:px-2">
                    <p className="text-[11px] sm:text-xs font-normal text-slate-500 mb-1">Total Questions</p>
                    <p className="text-lg sm:text-2xl font-semibold text-slate-800">
                      {selectedQuestionIds.size > 0 ? selectedQuestionIds.size : totalQuestions}
                    </p>
                  </div>

                  <div className="text-center px-1 sm:px-2">
                    <p className="text-[11px] sm:text-xs font-normal text-slate-500 mb-1">Total Marks</p>
                    <p className="text-lg sm:text-2xl font-semibold text-slate-800">
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
                  <div className="mb-6 relative z-10">
                    <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900">
                      Exam Schedule
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500 mt-1">
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
                        <span className="text-xs sm:text-sm font-normal text-slate-700">
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
                        <span className="text-xs sm:text-sm font-normal text-slate-700">
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
                        <span className="text-xs sm:text-sm font-normal text-slate-700">
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
                        <span className="text-xs sm:text-sm font-normal text-slate-700">
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
                        <span className="text-xs sm:text-sm font-normal text-slate-700">
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
                        <span className="text-xs sm:text-sm font-normal text-slate-700">
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
                        <span className="text-xs sm:text-sm font-normal text-slate-700">
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
                        <span className="text-xs sm:text-sm font-normal text-slate-700">
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
            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-10 shadow-xs">
              <div className="max-w-3xl mx-auto text-center space-y-6">
                <div className="w-16 h-16 rounded-3xl bg-emerald-50 text-emerald-600 border border-emerald-200/80 mx-auto flex items-center justify-center shadow-xs">
                  <CheckCircle2 className="w-8 h-8" />
                </div>

                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-emerald-600">
                    STEP 6 · FINAL PUBLISH
                  </p>
                  <h2 className="mt-1 text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900">
                    Ready to Publish Exam Paper
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 mt-2 max-w-lg mx-auto font-normal">
                    Review the final summary below. Once published, your exam will be ready in draft status and scheduled for candidates.
                  </p>
                </div>

                {/* Summary Card Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left pt-2">
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70">
                    <span className="text-[11px] font-medium uppercase text-slate-400 block mb-1">
                      Paper Details
                    </span>
                    <p className="text-sm font-medium text-slate-800 truncate">
                      {examTitle || getDefaultExamTitle()}
                    </p>
                    <p className="text-xs text-slate-500 mt-1 font-normal">
                      {examOverviewName} · {classOverviewText}
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70">
                    <span className="text-[11px] font-medium uppercase text-slate-400 block mb-1">
                      Questions &amp; Marks
                    </span>
                    <p className="text-sm font-medium text-slate-800">
                      {selectedQuestionIds.size > 0 ? selectedQuestionIds.size : totalQuestions} Questions
                    </p>
                    <p className="text-xs text-slate-500 mt-1 font-normal">
                      {examTotalMarks} Marks · {duration} min
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70">
                    <span className="text-[11px] font-medium uppercase text-slate-400 block mb-1">
                      Scheduled Window
                    </span>
                    <p className="text-sm font-medium text-slate-800">
                      {formatDateDisplay(startDate)}
                    </p>
                    <p className="text-xs text-slate-500 mt-1 font-normal">
                      {startHour}:{startMinute} {startPeriod} – {endHour}:{endMinute} {endPeriod}
                    </p>
                  </div>
                </div>

                <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={handleSaveAsExam}
                    disabled={creatingExam || selectedQuestionIds.size === 0}
                    className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-[#0B192C] hover:bg-[#1E293B] text-white font-medium text-sm shadow-md flex items-center justify-center gap-2.5 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-lg active:scale-[0.99]"
                  >
                    {creatingExam ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-amber-300" />
                        <span>Publishing Exam...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4 text-emerald-400" />
                        <span>Confirm &amp; Publish Exam Paper</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ─── Bottom Navigation Actions ─── */}
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
                  onClick={handleGenerate}
                  disabled={
                    isGenerating ||
                    (selectedChapters.length === 0 && selectedTopics.length === 0 && !uploadedSyllabusText) ||
                    totalQuestions === 0
                  }
                  className="px-4 sm:px-7 py-2.5 sm:py-3 rounded-xl bg-[#1E293B] hover:bg-[#0F172A] text-white font-medium text-xs sm:text-sm flex items-center gap-2 shadow-md transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-lg active:scale-[0.99]"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-amber-300" />
                      <span>
                        {generationStep === 1
                          ? "Analyzing PYQs..."
                          : generationStep === 2
                          ? "Generating Parallel Batches (Fast AI)..."
                          : "Validating Questions & LaTeX..."}
                      </span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-amber-300" />
                      <span>Create Questions ({totalQuestions})</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {currentStep === 3 && (
              <button
                type="button"
                onClick={() => {
                  setCurrentStep(4)
                  window.scrollTo({ top: 0, behavior: "smooth" })
                }}
                disabled={selectedQuestionIds.size === 0}
                className="px-4 sm:px-7 py-2.5 sm:py-3 rounded-xl bg-[#1E293B] hover:bg-[#0F172A] text-white font-medium text-xs sm:text-sm flex items-center gap-2 shadow-md transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-lg active:scale-[0.99]"
              >
                <span>Next: Exam Details</span>
                <ArrowRight className="w-4 h-4" />
              </button>
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

            {currentStep === 6 && (
              <button
                type="button"
                onClick={handleSaveAsExam}
                disabled={creatingExam || selectedQuestionIds.size === 0}
                className="px-5 sm:px-8 py-2.5 sm:py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs sm:text-sm flex items-center gap-2 shadow-md transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-lg active:scale-[0.99]"
              >
                {creatingExam ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Publishing...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 text-white" />
                    <span>Publish Paper</span>
                  </>
                )}
              </button>
            )}
          </div>
      </div>
    </div>

      {/* ─── Inline Edit Question Modal ─── */}
      {editingQuestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-2xl bg-white rounded-2xl p-4 sm:p-6 shadow-2xl border border-gray-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-[#1E293B]">Edit Question Details</h3>
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
                className="w-full p-3 text-xs sm:text-sm rounded-xl border border-gray-200 bg-gray-50/50 text-[#1E293B] font-mono focus:outline-none focus:border-[#2D3A4A]"
              />
            </div>

            <div className="space-y-2.5">
              <label className="text-xs font-medium text-gray-700 block">
                Options &amp; Correct Answer:
              </label>
              {editingQuestion.options.map((opt, i) => (
                <div key={i} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <div className="flex items-center gap-2 flex-1">
                    <span className="w-6 text-xs font-medium text-gray-500 shrink-0">
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
                className="w-full p-3 text-xs sm:text-sm rounded-xl border border-gray-200 bg-gray-50/50 text-[#1E293B] font-mono focus:outline-none focus:border-[#2D3A4A]"
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
    </div>
  )
}
