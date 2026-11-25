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
  ArrowLeft,
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
  AlertTriangle,
  Calculator,
} from "lucide-react"
import { computeDifficultyCounts } from "@/lib/ai/promptBuilder"
import { partitionDifficultyAcrossBatches, resolveClassDistribution } from "@/lib/ai/examBlueprint"
import { normalizeFormatInput, normalizeStoredQuestion, toExamQuestionPayload, formatToDbType } from "@/lib/ai/canonicalSchema"
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
  questionFormat?: "mcq" | "diagram" | "assertion" | "fib" | "true_false" | "descriptive" | "mcq_multi" | string
  questionText: string
  questionImage?: string
  difficulty: "easy" | "medium" | "hard"
  marks: number
  negativeMark: number
  options: string[]
  correctAnswer: string | string[]
  explanation: string
  chapter: string
  subject?: string
  grade?: string
  pyqReference?: string
  wordLimit?: number
}

export interface SubjectConfig {
  questions: number
  marksPerQuestion: number
  marks: number
}

export interface SubjectTypeRow {
  rowId: string
  formatId: string
  count: number
  marks: number
}

const QUESTION_FORMAT_LABELS: Record<string, string> = {
  mcq: "MCQ – Single Correct",
  mcq_multi: "MCQ – Multiple Correct",
  assertion: "Assertion & Reason",
  true_false: "True / False",
  fib: "Fill in the Blanks",
  descriptive: "Descriptive / Long Answer",
  diagram: "Diagram / Visual",
}

const QUESTION_FORMAT_ALIASES: Record<string, string> = {
  mcq_single: "mcq",
  mcq_multiple: "mcq_multi",
  assertion_reason: "assertion",
  truefalse: "true_false",
  fill_in_the_blanks: "fib",
  fillblanks: "fib",
  diagram_based: "diagram",
  short_answer: "descriptive",
  long_descriptive: "descriptive",
}

export function buildAutoSubjectTypes(
  sub: string,
  targetQ: number,
  targetM: number,
  defaultMpq: number
): SubjectTypeRow[] {
  const q = Math.max(0, Math.round(targetQ))
  if (q === 0) return []
  const mpq = q > 0 && targetM > 0 ? Math.max(1, Math.round(targetM / q)) : Math.max(1, defaultMpq)

  if (q * mpq === targetM && q >= 5) {
    const diagramCount = Math.min(q - 1, Math.max(1, Math.round(q * 0.16)))
    const mcqCount = q - diagramCount
    return [
      { rowId: `${sub}_auto_mcq`, formatId: "mcq", count: mcqCount, marks: mpq },
      { rowId: `${sub}_auto_diagram`, formatId: "diagram", count: diagramCount, marks: mpq },
    ]
  }

  return [{ rowId: `${sub}_auto_mcq`, formatId: "mcq", count: q, marks: mpq }]
}

export const getSynchronizedConfigs = (exam: ExamTarget, subjects: CompetitiveSubject[]) => {
  const dist: Record<string, SubjectConfig> = {}
  const typeDist: Record<string, SubjectTypeRow[]> = {}

  const defaultFormats = [
    { id: "mcq", label: "MCQ – Single Correct", checked: true, count: 0, marks: exam === "NEET" || exam === "JEE_MAIN" || exam === "JEE_ADVANCED" ? 4 : 1 },
    { id: "mcq_multi", label: "MCQ – Multiple Correct", checked: false, count: 0, marks: exam === "JEE_ADVANCED" ? 4 : 1 },
    { id: "assertion", label: "Assertion & Reason", checked: false, count: 0, marks: exam === "NEET" || exam === "JEE_MAIN" || exam === "JEE_ADVANCED" ? 4 : 1 },
    { id: "diagram", label: "Diagram / Visual", checked: false, count: 0, marks: exam === "NEET" || exam === "JEE_MAIN" || exam === "JEE_ADVANCED" ? 4 : 1 },
    { id: "true_false", label: "True / False", checked: false, count: 0, marks: 1 },
    { id: "fib", label: "Fill in the Blanks", checked: false, count: 0, marks: 1 },
    { id: "descriptive", label: "Descriptive / Long Answer", checked: false, count: 0, marks: 2 },
  ]

  let c11Weight = 20
  let c12Weight = 80

  if (exam === "MHT_CET") {
    c11Weight = 20
    c12Weight = 80
    subjects.forEach((sub) => {
      const qCount = sub === "Biology" && !subjects.includes("Mathematics") ? 100 : 50
      const mpq = sub === "Mathematics" ? 2 : 1
      dist[sub] = { questions: qCount, marksPerQuestion: mpq, marks: qCount * mpq }
      typeDist[sub] = [{ rowId: `${sub}_mcq`, formatId: "mcq", count: qCount, marks: mpq }]
    })
  } else if (exam === "NEET") {
    c11Weight = 50
    c12Weight = 50
    subjects.forEach((sub) => {
      const qCount = sub === "Biology" ? 90 : 45
      const mpq = 4
      dist[sub] = { questions: qCount, marksPerQuestion: mpq, marks: qCount * mpq }
      typeDist[sub] = [{ rowId: `${sub}_mcq`, formatId: "mcq", count: qCount, marks: mpq }]
    })
  } else if (exam === "JEE_MAIN") {
    c11Weight = 45
    c12Weight = 55
    subjects.forEach((sub) => {
      const qCount = 25
      const mpq = 4
      dist[sub] = { questions: qCount, marksPerQuestion: mpq, marks: qCount * mpq }
      typeDist[sub] = [{ rowId: `${sub}_mcq`, formatId: "mcq", count: qCount, marks: mpq }]
    })
  } else if (exam === "JEE_ADVANCED") {
    c11Weight = 50
    c12Weight = 50
    subjects.forEach((sub) => {
      const qCount = 18
      const mpq = 4
      dist[sub] = { questions: qCount, marksPerQuestion: mpq, marks: qCount * mpq }
      typeDist[sub] = [{ rowId: `${sub}_mcq`, formatId: "mcq", count: qCount, marks: mpq }]
    })
  } else {
    c11Weight = 50
    c12Weight = 50
    subjects.forEach((sub) => {
      const qCount = 20
      const mpq = 2
      dist[sub] = { questions: qCount, marksPerQuestion: mpq, marks: qCount * mpq }
      typeDist[sub] = [{ rowId: `${sub}_mcq`, formatId: "mcq", count: qCount, marks: mpq }]
    })
  }

  return { dist, formats: defaultFormats, typeDist, c11Weight, c12Weight }
}

const initialSynchronizedSetup = getSynchronizedConfigs("MHT_CET", ["Physics", "Chemistry", "Mathematics"])

function AIGeneratorContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editExamId = searchParams.get("edit")
  const [editingExamId, setEditingExamId] = useState<string | null>(editExamId)
  const [isLoadingExistingExam, setIsLoadingExistingExam] = useState(false)

  // ─── Filter & Selection States ───
  const [selectedExam, setSelectedExam] = useState<ExamTarget>("MHT_CET")
  const [selectedGrade, setSelectedGrade] = useState<GradeLevel | "both">("both")
  const [selectedSubject, setSelectedSubject] = useState<CompetitiveSubject>("Physics")
  const [selectedSubjects, setSelectedSubjects] = useState<CompetitiveSubject[]>(["Physics", "Chemistry", "Mathematics"])
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

  // Blueprint Format Matrix & Per-Subject Distribution
  const [generationMode, setGenerationMode] = useState<"manual" | "auto">("manual")
  const [blueprintFormats, setBlueprintFormats] = useState(initialSynchronizedSetup.formats)

  // Subject-wise Marks & Syllabus Weightage States
  const [subjectDist, setSubjectDist] = useState<Record<string, SubjectConfig>>(initialSynchronizedSetup.dist)
  const [subjectTypeDist, setSubjectTypeDist] = useState<Record<string, SubjectTypeRow[]>>(initialSynchronizedSetup.typeDist)
  const [class11Weightage, setClass11Weightage] = useState<number>(initialSynchronizedSetup.c11Weight)
  const [class12Weightage, setClass12Weightage] = useState<number>(initialSynchronizedSetup.c12Weight)

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
  const [questionCount, setQuestionCount] = useState<number>(0)
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "balanced" | "hard">("balanced")
  const [pattern, setPattern] = useState<"mcq_single" | "assertion_reason" | "mixed">("mixed")
  const [focusPYQ, setFocusPYQ] = useState(true)

  // Step 2: Negative Marking States (Customizable in Blueprint Step)
  const [negativeMarkingEnabled, setNegativeMarkingEnabled] = useState<boolean>(false)
  const [negativeMarkPenalty, setNegativeMarkPenalty] = useState<number>(() => {
    const meta = EXAM_TARGETS.find((e) => e.id === "MHT_CET")
    return meta?.defaultNegativeMarks && meta.defaultNegativeMarks > 0 ? meta.defaultNegativeMarks : 1
  })

  const handleToggleNegativeMarking = (enabled: boolean) => {
    setNegativeMarkingEnabled(enabled)
    setEvalSettings((prev) => ({ ...prev, enableNegativeMarking: enabled }))
    if (generatedQuestions.length > 0) {
      setGeneratedQuestions((prev) =>
        prev.map((q) => {
          const isDesc = q.type === "descriptive" || q.questionFormat === "descriptive"
          return isDesc ? q : { ...q, negativeMark: enabled ? negativeMarkPenalty : 0 }
        })
      )
    }
  }

  const handleNegativePenaltyChange = (penalty: number) => {
    setNegativeMarkPenalty(penalty)
    if (negativeMarkingEnabled && generatedQuestions.length > 0) {
      setGeneratedQuestions((prev) =>
        prev.map((q) => {
          const isDesc = q.type === "descriptive" || q.questionFormat === "descriptive"
          return isDesc ? q : { ...q, negativeMark: penalty }
        })
      )
    }
  }

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
          if (!isNaN(d.getTime())) {
            const y = d.getFullYear()
            const m = String(d.getMonth() + 1).padStart(2, "0")
            const day = String(d.getDate()).padStart(2, "0")
            setStartDate(`${y}-${m}-${day}`)

            const timeStr = exam.schedule?.startTime || exam.settings?.startTime
            if (timeStr && timeStr.includes(":")) {
              const [th, tm] = timeStr.split(":").map(Number)
              if (!isNaN(th) && !isNaN(tm)) {
                const p = th >= 12 ? "PM" : "AM"
                let h12 = th % 12
                if (h12 === 0) h12 = 12
                setStartHour(String(h12).padStart(2, "0"))
                setStartMinute(String(tm).padStart(2, "0"))
                setStartPeriod(p)
              }
            } else {
              let h12 = d.getHours() % 12
              if (h12 === 0) h12 = 12
              setStartHour(String(h12).padStart(2, "0"))
              setStartMinute(String(d.getMinutes()).padStart(2, "0"))
              setStartPeriod(d.getHours() >= 12 ? "PM" : "AM")
            }
          }
        }
        if (exam.schedule?.endDate || exam.settings?.endDate) {
          const raw = exam.schedule?.endDate || exam.settings?.endDate
          const d = new Date(raw)
          if (!isNaN(d.getTime())) {
            const y = d.getFullYear()
            const m = String(d.getMonth() + 1).padStart(2, "0")
            const day = String(d.getDate()).padStart(2, "0")
            setEndDate(`${y}-${m}-${day}`)

            const timeStr = exam.schedule?.endTime || exam.settings?.endTime
            if (timeStr && timeStr.includes(":")) {
              const [th, tm] = timeStr.split(":").map(Number)
              if (!isNaN(th) && !isNaN(tm)) {
                const p = th >= 12 ? "PM" : "AM"
                let h12 = th % 12
                if (h12 === 0) h12 = 12
                setEndHour(String(h12).padStart(2, "0"))
                setEndMinute(String(tm).padStart(2, "0"))
                setEndPeriod(p)
              }
            } else {
              let h12 = d.getHours() % 12
              if (h12 === 0) h12 = 12
              setEndHour(String(h12).padStart(2, "0"))
              setEndMinute(String(d.getMinutes()).padStart(2, "0"))
              setEndPeriod(d.getHours() >= 12 ? "PM" : "AM")
            }
          }
        }

        // Eval & proctoring
        if (exam.settings) {
          setEvalSettings((prev) => ({
            ...prev,
            randomizeQuestions: exam.settings.randomize ?? prev.randomizeQuestions,
            showResultsImmediately: exam.settings.showResults ?? prev.showResultsImmediately,
            allowReview: exam.settings.allowReview ?? prev.allowReview,
            enableNegativeMarking: exam.settings.negativeMarking ?? prev.enableNegativeMarking,
            allowCalculator: exam.settings.allowCalculator ?? exam.settings.enableCalculator ?? (exam as any).allowCalculator ?? prev.allowCalculator,
          }))
          if (exam.settings.negativeMarking !== undefined) {
            setNegativeMarkingEnabled(Boolean(exam.settings.negativeMarking))
          }
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
        if (exam.sections?.[0]?.negativeMarking !== undefined) {
          setNegativeMarkingEnabled(Boolean(exam.sections[0].negativeMarking))
        }
        const loadedNegMark = exam.sections?.[0]?.sectionNegativeMark || exam.sections?.[0]?.questions?.[0]?.negativeMark
        if (loadedNegMark !== undefined && loadedNegMark > 0) {
          setNegativeMarkPenalty(loadedNegMark)
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
            negativeMark: q.type === "descriptive" ? 0 : (q.negativeMark !== undefined ? q.negativeMark : (exam.settings?.negativeMarking ? (loadedNegMark || 1) : 0)),
            options: Array.isArray(q.options) ? q.options : [],
            correctAnswer: q.correctAnswer || "",
            explanation: q.explanation || "",
            chapter: q.chapter || exam.subject || "General",
            subject: q.subject || exam.subject || "",
            grade: q.grade || "",
            pyqReference: q.pyqReference,
            wordLimit: q.wordLimit,
          }))
        )

        if (loadedQuestions.length > 0) {
          setGeneratedQuestions(loadedQuestions)
          setSelectedQuestionIds(new Set(loadedQuestions.map((q) => q.id)))

          // Pre-populate chapters from loaded questions
          const existingChapters = Array.from(
            new Set(loadedQuestions.map((q) => q.chapter).filter((c) => Boolean(c) && c !== "General"))
          )
          if (existingChapters.length > 0) {
            setSelectedChapters(existingChapters)
          }

          // Pre-populate subjects if sections contain distinct subjects
          const sectionSubjects = (exam.sections || [])
            .map((s: any) => s.name || s.subject)
            .filter((s: string) => ["Physics", "Chemistry", "Mathematics", "Biology"].includes(s)) as CompetitiveSubject[]
          if (sectionSubjects.length > 0) {
            const uniqueSubs = Array.from(new Set(sectionSubjects))
            setSelectedSubjects(uniqueSubs)
          }

          // Pre-populate format counts in blueprint
          const formatCounts: Record<string, { count: number; marks: number }> = {}
          loadedQuestions.forEach((q) => {
            const fmt = q.questionFormat || q.type || "mcq"
            if (!formatCounts[fmt]) formatCounts[fmt] = { count: 0, marks: 0 }
            formatCounts[fmt].count += 1
            formatCounts[fmt].marks = q.marks || 4
          })
          if (Object.keys(formatCounts).length > 0) {
            setBlueprintFormats((prev) =>
              prev.map((f) => {
                const found = formatCounts[f.id]
                if (found) {
                  return { ...f, checked: true, count: found.count, marks: found.marks }
                }
                return f
              })
            )
          }

          // Pre-populate subject & per-subject question-type distribution
          const subCounts: Record<string, { count: number; marks: number }> = {}
          const subTypeCounts: Record<string, Record<string, { count: number; marks: number }>> = {}
          loadedQuestions.forEach((q) => {
            const sec = (exam.sections || []).find((s: any) =>
              (s.questions || []).some((sq: any) => sq.id === q.id || sq._id === q.id)
            )
            const sub = sec?.name || exam.subject || "Physics"
            if (!subCounts[sub]) subCounts[sub] = { count: 0, marks: 0 }
            subCounts[sub].count += 1
            const qMarks = q.marks || 4
            subCounts[sub].marks += qMarks

            const rawFmt = String(q.questionFormat || q.type || "mcq")
            const canonicalFmt = QUESTION_FORMAT_ALIASES[rawFmt] || (QUESTION_FORMAT_LABELS[rawFmt] ? rawFmt : "mcq")
            if (!subTypeCounts[sub]) subTypeCounts[sub] = {}
            if (!subTypeCounts[sub][canonicalFmt]) subTypeCounts[sub][canonicalFmt] = { count: 0, marks: qMarks }
            subTypeCounts[sub][canonicalFmt].count += 1
            subTypeCounts[sub][canonicalFmt].marks = qMarks
          })
          if (Object.keys(subCounts).length > 0) {
            setSubjectDist((prev) => {
              const updated = { ...prev }
              for (const [subName, info] of Object.entries(subCounts)) {
                updated[subName] = {
                  questions: info.count,
                  marks: info.marks,
                  marksPerQuestion: Math.max(1, Math.round(info.marks / Math.max(1, info.count))),
                }
              }
              return updated
            })
            setSubjectTypeDist((prev) => {
              const updated = { ...prev }
              for (const [subName, fmtMap] of Object.entries(subTypeCounts)) {
                updated[subName] = Object.entries(fmtMap).map(([fmtId, info], idx) => ({
                  rowId: `${subName}_${fmtId}_loaded_${idx}`,
                  formatId: fmtId,
                  count: info.count,
                  marks: Math.max(1, info.marks),
                }))
              }
              return updated
            })
          }

          setCurrentStep(3) // Jump directly to Questions step so user can edit right away!
        }

        const savedGeneratorSetup = exam.settings?.competitiveGenerator
        if (savedGeneratorSetup && typeof savedGeneratorSetup === "object") {
          if (Array.isArray(savedGeneratorSetup.selectedSubjects)) {
            setSelectedSubjects(savedGeneratorSetup.selectedSubjects)
          }
          if (savedGeneratorSetup.selectedExam) setSelectedExam(savedGeneratorSetup.selectedExam)
          if (savedGeneratorSetup.selectedGrade) setSelectedGrade(savedGeneratorSetup.selectedGrade)
          if (savedGeneratorSetup.selectedSubject) setSelectedSubject(savedGeneratorSetup.selectedSubject)
          if (savedGeneratorSetup.activeSubjectTab) setActiveSubjectTab(savedGeneratorSetup.activeSubjectTab)
          if (Array.isArray(savedGeneratorSetup.selectedChapters)) {
            setSelectedChapters(savedGeneratorSetup.selectedChapters)
          }
          if (Array.isArray(savedGeneratorSetup.selectedTopics)) {
            setSelectedTopics(savedGeneratorSetup.selectedTopics)
          }
          if (typeof savedGeneratorSetup.uploadedSyllabusText === "string") {
            setUploadedSyllabusText(savedGeneratorSetup.uploadedSyllabusText)
          }
          if (savedGeneratorSetup.uploadedPdf) setUploadedPdf(savedGeneratorSetup.uploadedPdf)
          if (Array.isArray(savedGeneratorSetup.blueprintFormats)) {
            setBlueprintFormats(savedGeneratorSetup.blueprintFormats.map((format: any) => {
              const rawId = String(format.id || "mcq")
              const id = QUESTION_FORMAT_ALIASES[rawId] || rawId
              return {
                ...format,
                id,
                label: QUESTION_FORMAT_LABELS[id] || format.label || id,
                count: Math.max(0, Math.min(200, Number(format.count) || 0)),
                marks: Math.max(1, Math.min(100, Number(format.marks) || 1)),
              }
            }))
          }
          if (savedGeneratorSetup.subjectDist && typeof savedGeneratorSetup.subjectDist === "object") {
            setSubjectDist(savedGeneratorSetup.subjectDist)
          }
          if (savedGeneratorSetup.subjectTypeDist && typeof savedGeneratorSetup.subjectTypeDist === "object") {
            setSubjectTypeDist(savedGeneratorSetup.subjectTypeDist)
          }
          if (savedGeneratorSetup.generationMode === "auto" || savedGeneratorSetup.generationMode === "manual") {
            setGenerationMode(savedGeneratorSetup.generationMode)
          }
          if (typeof savedGeneratorSetup.class11Weightage === "number") {
            const class11 = Math.max(0, Math.min(100, savedGeneratorSetup.class11Weightage))
            setClass11Weightage(class11)
            setClass12Weightage(100 - class11)
          } else if (typeof savedGeneratorSetup.class12Weightage === "number") {
            const class12 = Math.max(0, Math.min(100, savedGeneratorSetup.class12Weightage))
            setClass12Weightage(class12)
            setClass11Weightage(100 - class12)
          }
          if (typeof savedGeneratorSetup.questionCount === "number") {
            setQuestionCount(savedGeneratorSetup.questionCount)
          }
          if (["easy", "medium", "balanced", "hard"].includes(savedGeneratorSetup.difficulty)) {
            setDifficulty(savedGeneratorSetup.difficulty)
          }
          if (["mcq_single", "assertion_reason", "mixed"].includes(savedGeneratorSetup.pattern)) {
            setPattern(savedGeneratorSetup.pattern)
          }
          if (typeof savedGeneratorSetup.focusPYQ === "boolean") {
            setFocusPYQ(savedGeneratorSetup.focusPYQ)
          }
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
    "Read all questions carefully before answering.",
    "Do not switch tabs or exit the exam screen during the test.",
    "Ensure you have completed all required questions before finishing the exam.",
  ])

  // Step 5: Schedule & Settings States
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date()
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, "0")
    const day = String(d.getDate()).padStart(2, "0")
    return `${y}-${m}-${day}`
  })
  const [startHour, setStartHour] = useState<string>(() => {
    const d = new Date()
    let h = d.getHours() % 12
    if (h === 0) h = 12
    return String(h).padStart(2, "0")
  })
  const [startMinute, setStartMinute] = useState<string>(() => {
    const d = new Date()
    const min = Math.floor(d.getMinutes() / 5) * 5
    return String(min).padStart(2, "0")
  })
  const [startPeriod, setStartPeriod] = useState<"AM" | "PM">(() => {
    return new Date().getHours() >= 12 ? "PM" : "AM"
  })

  const [endDate, setEndDate] = useState<string>(() => {
    const d = new Date()
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, "0")
    const day = String(d.getDate()).padStart(2, "0")
    return `${y}-${m}-${day}`
  })
  const [endHour, setEndHour] = useState<string>(() => {
    const d = new Date()
    d.setHours(d.getHours() + 2)
    let h = d.getHours() % 12
    if (h === 0) h = 12
    return String(h).padStart(2, "0")
  })
  const [endMinute, setEndMinute] = useState<string>(() => {
    const d = new Date()
    const min = Math.floor(d.getMinutes() / 5) * 5
    return String(min).padStart(2, "0")
  })
  const [endPeriod, setEndPeriod] = useState<"AM" | "PM">(() => {
    const d = new Date()
    d.setHours(d.getHours() + 2)
    return d.getHours() >= 12 ? "PM" : "AM"
  })

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
    allowCalculator: false,
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
    const rawFmt = String(q.questionFormat || q.type || "").toLowerCase().trim()
    const rawType = String(q.type || "").toLowerCase().trim()
    if (rawFmt === "true_false" || rawFmt === "truefalse" || rawType === "truefalse") {
      return "true_false"
    }
    if (
      rawFmt === "fib" ||
      rawFmt === "fillblanks" ||
      rawType === "fillblanks" ||
      (Array.isArray((q as any).blanks) && (q as any).blanks.length > 0)
    ) {
      return "fib"
    }
    if (
      rawFmt === "assertion" ||
      rawFmt === "assertion_reason" ||
      rawType === "assertion" ||
      Boolean(parseAssertionReason(q.questionText || ""))
    ) {
      return "assertion"
    }
    if (
      rawFmt === "mcq_multi" ||
      rawFmt === "mcq_multiple" ||
      rawType === "mcq_multi" ||
      (Array.isArray(q.correctAnswer) && q.correctAnswer.length > 1)
    ) {
      return "mcq_multi"
    }
    if (
      rawFmt === "diagram" ||
      rawType === "diagram" ||
      Boolean(q.questionImage && String(q.questionImage).includes("<svg"))
    ) {
      return "diagram"
    }
    if (rawType === "descriptive" || rawFmt === "descriptive") {
      return "descriptive"
    }
    if (!q.options || q.options.length === 0) {
      if (["true", "false"].includes(String(q.correctAnswer || "").trim().toLowerCase())) return "true_false"
      if (q.questionText?.includes("___")) return "fib"
      return "descriptive"
    }
    return "mcq"
  }

  const filteredGeneratedQuestions = useMemo(() => {
    if (formatFilter === "all") return generatedQuestions
    return generatedQuestions.filter((q) => getQuestionFormat(q) === formatFilter)
  }, [generatedQuestions, formatFilter])


  const formatCounts = useMemo(() => {
    const counts: Record<string, number> = { all: generatedQuestions.length, mcq: 0, mcq_multi: 0, diagram: 0, assertion: 0, fib: 0, true_false: 0, descriptive: 0 }
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
      const sync = getSynchronizedConfigs(exam, targetMeta.subjects)
      setSubjectDist(sync.dist)
      setBlueprintFormats(sync.formats)
      setSubjectTypeDist(sync.typeDist)
      setClass11Weightage(sync.c11Weight)
      setClass12Weightage(sync.c12Weight)
      // Negative marking disabled by default
      setNegativeMarkingEnabled(false)
      setNegativeMarkPenalty(targetMeta.defaultNegativeMarks > 0 ? targetMeta.defaultNegativeMarks : 1)
      setEvalSettings((prev) => ({ ...prev, enableNegativeMarking: false }))
    }
    // Reset selected chapters when exam changes
    setSelectedChapters([])
    setChapterSearch("")
    setExamDropdownOpen(false)
  }

  // Handle multi-select toggle of subjects in Step 1
  const handleToggleSubject = (sub: CompetitiveSubject) => {
    let next: CompetitiveSubject[] = []
    if (selectedSubjects.includes(sub)) {
      if (selectedSubjects.length > 1) {
        next = selectedSubjects.filter((s) => s !== sub)
        setSelectedSubjects(next)
        if (selectedSubject === sub) setSelectedSubject(next[0])
        if (activeSubjectTab === sub) setActiveSubjectTab(next[0])
      } else {
        return
      }
    } else {
      next = [...selectedSubjects, sub]
      setSelectedSubjects(next)
      if (!selectedSubject) setSelectedSubject(sub)
    }
    const sync = getSynchronizedConfigs(selectedExam, next)
    setBlueprintFormats(sync.formats)
    setSubjectDist((prev) => {
      const merged: Record<string, SubjectConfig> = {}
      next.forEach((s) => {
        merged[s] = prev[s] || sync.dist[s] || { questions: 20, marksPerQuestion: 1, marks: 20 }
      })
      return merged
    })
    setSubjectTypeDist((prev) => {
      const merged: Record<string, SubjectTypeRow[]> = {}
      next.forEach((s) => {
        const existing = prev[s]
        merged[s] = existing && existing.length > 0 ? existing : (sync.typeDist[s] || [])
      })
      return merged
    })
  }

  const handleRemoveSubject = (e: React.MouseEvent, sub: CompetitiveSubject) => {
    e.stopPropagation()
    if (selectedSubjects.length > 1) {
      const next = selectedSubjects.filter((s) => s !== sub)
      setSelectedSubjects(next)
      if (selectedSubject === sub) setSelectedSubject(next[0])
      if (activeSubjectTab === sub) setActiveSubjectTab(next[0])
      const sync = getSynchronizedConfigs(selectedExam, next)
      setBlueprintFormats(sync.formats)
      setSubjectDist((prev) => {
        const merged: Record<string, SubjectConfig> = {}
        next.forEach((s) => {
          merged[s] = prev[s] || sync.dist[s] || { questions: 20, marksPerQuestion: 1, marks: 20 }
        })
        return merged
      })
      setSubjectTypeDist((prev) => {
        const merged: Record<string, SubjectTypeRow[]> = {}
        next.forEach((s) => {
          const existing = prev[s]
          merged[s] = existing && existing.length > 0 ? existing : (sync.typeDist[s] || [])
        })
        return merged
      })
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
      const next = [subject]
      setSelectedSubjects(next)
      const sync = getSynchronizedConfigs(selectedExam, next)
      setSubjectDist(sync.dist)
      setBlueprintFormats(sync.formats)
      setSubjectTypeDist(sync.typeDist)
    }
    setSelectedChapters([])
    setChapterSearch("")
  }

  // Step 2: Subject-wise & Question Type Distribution calculations
  const totalQuestions = useMemo(() => {
    return selectedSubjects.reduce((acc, sub) => {
      const q = Number(subjectDist[sub]?.questions) || 0
      return acc + Math.max(0, q)
    }, 0)
  }, [selectedSubjects, subjectDist])

  const totalMarks = useMemo(() => {
    return selectedSubjects.reduce((acc, sub) => {
      const m = Number(subjectDist[sub]?.marks) || 0
      return acc + Math.max(0, m)
    }, 0)
  }, [selectedSubjects, subjectDist])

  const getSubjectTypeRows = (sub: string): SubjectTypeRow[] => {
    const subCfg = subjectDist[sub] || { questions: 0, marksPerQuestion: 1, marks: 0 }
    if (generationMode === "auto") {
      return buildAutoSubjectTypes(sub, subCfg.questions, subCfg.marks, subCfg.marksPerQuestion)
    }
    const existing = subjectTypeDist[sub]
    if (existing && existing.length > 0) return existing
    return [
      {
        rowId: `${sub}_mcq`,
        formatId: "mcq",
        count: Math.max(0, subCfg.questions),
        marks: Math.max(1, subCfg.marksPerQuestion || 1),
      },
    ]
  }

  const getSubjectProgress = (sub: string) => {
    const subCfg = subjectDist[sub] || { questions: 0, marksPerQuestion: 1, marks: 0 }
    const targetQ = Math.max(0, Number(subCfg.questions) || 0)
    const targetM = Math.max(0, Number(subCfg.marks) || 0)
    const rows = getSubjectTypeRows(sub)
    const allocatedQ = rows.reduce((sum, r) => sum + (Number(r.count) || 0), 0)
    const allocatedM = rows.reduce((sum, r) => sum + (Number(r.count) || 0) * (Number(r.marks) || 0), 0)
    const isQuestionsMatched = allocatedQ === targetQ
    const isMarksMatched = allocatedM === targetM
    return {
      targetQ,
      targetM,
      allocatedQ,
      allocatedM,
      isQuestionsMatched,
      isMarksMatched,
      isMatched: isQuestionsMatched && isMarksMatched,
    }
  }

  const effectiveBlueprintFormats = useMemo(() => {
    const order = ["mcq", "mcq_multi", "assertion", "diagram", "true_false", "fib", "descriptive"]
    const map: Record<string, { count: number; marks: number }> = {}
    order.forEach((id) => {
      map[id] = { count: 0, marks: id === "descriptive" ? 2 : currentExamMeta.defaultMarksPerQuestion }
    })

    for (const sub of selectedSubjects) {
      const subCfg = subjectDist[sub] || { questions: 0, marksPerQuestion: 1, marks: 0 }
      const rows =
        generationMode === "auto"
          ? buildAutoSubjectTypes(sub, subCfg.questions, subCfg.marks, subCfg.marksPerQuestion)
          : subjectTypeDist[sub] || []
      for (const r of rows) {
        if (r.count > 0) {
          if (!map[r.formatId]) map[r.formatId] = { count: 0, marks: r.marks }
          map[r.formatId].count += r.count
          map[r.formatId].marks = r.marks
        }
      }
    }

    return order.map((id) => ({
      id,
      label: QUESTION_FORMAT_LABELS[id] || id,
      checked: (map[id]?.count || 0) > 0,
      count: map[id]?.count || 0,
      marks: map[id]?.marks || 1,
    }))
  }, [selectedSubjects, subjectDist, subjectTypeDist, generationMode, currentExamMeta.defaultMarksPerQuestion])

  const questionFormatOverview = useMemo(() => {
    const parts: string[] = []
    if (formatCounts.mcq > 0) parts.push(`MCQ: ${formatCounts.mcq}`)
    if (formatCounts.mcq_multi > 0) parts.push(`Multi-Correct: ${formatCounts.mcq_multi}`)
    if (formatCounts.diagram > 0) parts.push(`Diagram: ${formatCounts.diagram}`)
    if (formatCounts.assertion > 0) parts.push(`Assertion: ${formatCounts.assertion}`)
    if (formatCounts.fib > 0) parts.push(`Fill in the Blanks: ${formatCounts.fib}`)
    if (formatCounts.true_false > 0) parts.push(`True / False: ${formatCounts.true_false}`)
    if (formatCounts.descriptive > 0) parts.push(`Descriptive: ${formatCounts.descriptive}`)

    if (parts.length > 0) return parts.join(" | ")

    const blueprintParts = effectiveBlueprintFormats
      .filter((f) => f.checked && f.count > 0)
      .map((f) => `${f.label}: ${f.count}`)

    if (blueprintParts.length > 0) return blueprintParts.join(" | ")
    return "MCQ – Single Correct"
  }, [formatCounts, effectiveBlueprintFormats])

  const handleModeSwitch = (mode: "manual" | "auto") => {
    setGenerationMode(mode)
  }

  const updateSubjectTotalQuestions = (sub: string, rawVal: any) => {
    const parsed = typeof rawVal === "number" ? rawVal : parseInt(String(rawVal), 10)
    const safeQ = isNaN(parsed) ? 0 : Math.max(0, Math.min(200, Math.round(parsed)))
    const prevCfg = subjectDist[sub] || { questions: 0, marksPerQuestion: 1, marks: 0 }
    const mpq =
      prevCfg.marksPerQuestion > 0
        ? prevCfg.marksPerQuestion
        : prevCfg.questions > 0 && prevCfg.marks > 0
        ? Math.max(1, Math.round(prevCfg.marks / prevCfg.questions))
        : 1
    const nextM = safeQ * mpq

    setSubjectDist((prev) => ({
      ...prev,
      [sub]: {
        questions: safeQ,
        marksPerQuestion: mpq,
        marks: nextM,
      },
    }))

    // By default, keep single-row MCQ distribution automatically synchronized with subject limits
    setSubjectTypeDist((prev) => {
      const existing = prev[sub] || []
      if (existing.length <= 1) {
        const firstFormat = existing[0]?.formatId || "mcq"
        return {
          ...prev,
          [sub]: [
            {
              rowId: existing[0]?.rowId || `${sub}_mcq`,
              formatId: firstFormat,
              count: safeQ,
              marks: mpq,
            },
          ],
        }
      }
      return prev
    })
  }

  const updateSubjectTotalMarks = (sub: string, rawVal: any) => {
    const parsed = typeof rawVal === "number" ? rawVal : parseInt(String(rawVal), 10)
    const safeM = isNaN(parsed) ? 0 : Math.max(0, Math.min(2000, Math.round(parsed)))
    const prevCfg = subjectDist[sub] || { questions: 0, marksPerQuestion: 1, marks: 0 }
    const q = Math.max(0, prevCfg.questions)
    const derivedMpq = q > 0 && safeM >= q ? Math.max(1, Math.round(safeM / q)) : Math.max(1, prevCfg.marksPerQuestion || 1)

    setSubjectDist((prev) => ({
      ...prev,
      [sub]: {
        questions: q,
        marksPerQuestion: derivedMpq,
        marks: safeM,
      },
    }))

    // When only one question type exists and marks divide cleanly by question count, sync row marks automatically
    setSubjectTypeDist((prev) => {
      const existing = prev[sub] || []
      if (existing.length === 1 && q > 0 && safeM > 0 && safeM % q === 0) {
        return {
          ...prev,
          [sub]: [
            {
              ...existing[0],
              count: q,
              marks: Math.max(1, safeM / q),
            },
          ],
        }
      }
      return prev
    })
  }

  const addSubjectTypeRow = (sub: string) => {
    const currentRows = getSubjectTypeRows(sub)
    const usedFormats = new Set(currentRows.map((r) => r.formatId))
    const preferredOrder = ["diagram", "assertion", "mcq_multi", "true_false", "fib", "descriptive", "mcq"]
    const nextFormat = preferredOrder.find((fmt) => !usedFormats.has(fmt))
    if (!nextFormat) return

    const subCfg = subjectDist[sub] || { questions: 0, marksPerQuestion: 1, marks: 0 }
    const allocQ = currentRows.reduce((sum, r) => sum + (Number(r.count) || 0), 0)
    const allocM = currentRows.reduce((sum, r) => sum + (Number(r.count) || 0) * (Number(r.marks) || 0), 0)
    const remQ = Math.max(0, subCfg.questions - allocQ)
    const remM = Math.max(0, subCfg.marks - allocM)
    const suggestedMarks =
      remQ > 0 && remM >= remQ
        ? Math.max(1, Math.min(100, Math.round(remM / remQ)))
        : Math.max(1, subCfg.marksPerQuestion || currentExamMeta.defaultMarksPerQuestion || 1)

    setSubjectTypeDist((prev) => ({
      ...prev,
      [sub]: [
        ...(prev[sub] && prev[sub].length > 0 ? prev[sub] : currentRows),
        {
          rowId: `${sub}_${nextFormat}_${Date.now()}`,
          formatId: nextFormat,
          count: remQ,
          marks: suggestedMarks,
        },
      ],
    }))
  }

  const updateSubjectTypeRow = (
    sub: string,
    rowId: string,
    patch: Partial<{ formatId: string; count: number; marks: number }>
  ) => {
    setSubjectTypeDist((prev) => {
      const currentRows = prev[sub] && prev[sub].length > 0 ? prev[sub] : getSubjectTypeRows(sub)
      const nextRows = currentRows.map((r) => {
        if (r.rowId !== rowId) return r
        const nextCount =
          patch.count !== undefined
            ? Math.max(0, Math.min(200, Math.round(Number(patch.count) || 0)))
            : r.count
        const nextMarks =
          patch.marks !== undefined
            ? Math.max(1, Math.min(100, Math.round(Number(patch.marks) || 1)))
            : r.marks
        return {
          ...r,
          formatId: patch.formatId ?? r.formatId,
          count: nextCount,
          marks: nextMarks,
        }
      })
      return { ...prev, [sub]: nextRows }
    })
  }

  const removeSubjectTypeRow = (sub: string, rowId: string) => {
    setSubjectTypeDist((prev) => {
      const currentRows = prev[sub] && prev[sub].length > 0 ? prev[sub] : getSubjectTypeRows(sub)
      if (currentRows.length <= 1) return prev
      return {
        ...prev,
        [sub]: currentRows.filter((r) => r.rowId !== rowId),
      }
    })
  }

  const balanceSubjectTypeRows = (sub: string) => {
    const subCfg = subjectDist[sub] || { questions: 0, marksPerQuestion: 1, marks: 0 }
    const targetQ = Math.max(0, subCfg.questions)
    const targetM = Math.max(0, subCfg.marks)
    const mpq = targetQ > 0 && targetM >= targetQ ? Math.max(1, Math.round(targetM / targetQ)) : Math.max(1, subCfg.marksPerQuestion || 1)
    setSubjectTypeDist((prev) => {
      const rows = prev[sub] && prev[sub].length > 0 ? [...prev[sub]] : [{ rowId: `${sub}_mcq`, formatId: "mcq", count: targetQ, marks: mpq }]
      if (rows.length === 1) {
        if (targetQ > 0 && targetM % targetQ !== 0 && targetQ >= 2) {
          // Split cleanly across 2 rows if target marks aren't divisible evenly
          const lowM = Math.max(1, Math.floor(targetM / targetQ))
          const rem = targetM - lowM * targetQ
          return {
            ...prev,
            [sub]: [
              { ...rows[0], count: targetQ - rem, marks: lowM },
              { rowId: `${sub}_diagram_bal`, formatId: rows[0].formatId === "diagram" ? "mcq" : "diagram", count: rem, marks: lowM + 1 },
            ],
          }
        }
        return {
          ...prev,
          [sub]: [{ ...rows[0], count: targetQ, marks: mpq }],
        }
      }
      const otherCount = rows.slice(1).reduce((s, r) => s + (Number(r.count) || 0), 0)
      const firstCount = Math.max(0, targetQ - otherCount)
      const otherMarks = rows.slice(1).reduce((s, r) => s + (Number(r.count) || 0) * (Number(r.marks) || 0), 0)
      const remMarks = Math.max(0, targetM - otherMarks)
      const firstMarks = firstCount > 0 && remMarks >= firstCount && remMarks % firstCount === 0
        ? remMarks / firstCount
        : rows[0].marks
      rows[0] = { ...rows[0], count: firstCount, marks: Math.max(1, firstMarks) }
      return { ...prev, [sub]: rows }
    })
  }

  const apportionFormats = (count: number, defaultMarks: number) => {
    if (count <= 0) return []
    const activeFormats = effectiveBlueprintFormats.filter((format) => format.count > 0)
    if (activeFormats.length === 0) {
      return [{ formatId: "mcq", formatLabel: "MCQ – Single Correct", count, marks: defaultMarks }]
    }

    const sumFormatCounts = activeFormats.reduce((sum, format) => sum + (Number(format.count) || 0), 0) || 1
    const allocations = activeFormats.map((format, index) => {
      const exactCount = count * ((Number(format.count) || 0) / sumFormatCounts)
      return { format, index, count: Math.floor(exactCount), fraction: exactCount % 1 }
    })
    const remaining = count - allocations.reduce((sum, allocation) => sum + allocation.count, 0)
    const remainderOrder = [...allocations].sort((a, b) => b.fraction - a.fraction || a.index - b.index)
    for (let index = 0; index < remaining; index++) {
      remainderOrder[index % remainderOrder.length].count += 1
    }

    return allocations
      .filter((allocation) => allocation.count > 0)
      .map(({ format, count: formatCount }) => ({
        formatId: format.id,
        formatLabel: QUESTION_FORMAT_LABELS[format.id] || format.label || format.id,
        count: formatCount,
        marks: Number(format.marks) || defaultMarks,
      }))
  }

  const applyExamRecommendedPreset = () => {
    const ratioMap: Record<ExamTarget, { id: string; weight: number }[]> = {
      MHT_CET: [
        { id: "mcq", weight: 0.84 },
        { id: "diagram", weight: 0.16 },
      ],
      JEE_MAIN: [
        { id: "mcq", weight: 0.68 },
        { id: "assertion", weight: 0.16 },
        { id: "diagram", weight: 0.16 },
      ],
      JEE_ADVANCED: [
        { id: "mcq", weight: 0.44 },
        { id: "mcq_multi", weight: 0.24 },
        { id: "assertion", weight: 0.16 },
        { id: "diagram", weight: 0.16 },
      ],
      NEET: [
        { id: "mcq", weight: 0.64 },
        { id: "assertion", weight: 0.22 },
        { id: "diagram", weight: 0.14 },
      ],
      CBSE_BOARD: [
        { id: "mcq", weight: 0.45 },
        { id: "assertion", weight: 0.15 },
        { id: "fib", weight: 0.15 },
        { id: "true_false", weight: 0.1 },
        { id: "descriptive", weight: 0.15 },
      ],
    }

    const template = ratioMap[selectedExam] || ratioMap.JEE_MAIN
    setGenerationMode("manual")
    setSubjectTypeDist((prev) => {
      const next = { ...prev }
      for (const sub of selectedSubjects) {
        const subCfg = subjectDist[sub] || { questions: 20, marksPerQuestion: 1, marks: 20 }
        const q = Math.max(0, subCfg.questions)
        if (q === 0) continue
        const mpq =
          q > 0 && subCfg.marks >= q && subCfg.marks % q === 0
            ? subCfg.marks / q
            : Math.max(1, subCfg.marksPerQuestion || 1)

        const raw = template.map((t, idx) => ({
          id: t.id,
          idx,
          count: Math.floor(q * t.weight),
          frac: (q * t.weight) % 1,
        }))
        let rem = q - raw.reduce((s, r) => s + r.count, 0)
        const order = [...raw].sort((a, b) => b.frac - a.frac || a.idx - b.idx)
        for (let i = 0; i < rem; i++) order[i % order.length].count += 1

        next[sub] = raw
          .filter((r) => r.count > 0)
          .map((r) => ({
            rowId: `${sub}_${r.id}_preset`,
            formatId: r.id,
            count: r.count,
            marks: mpq,
          }))
      }
      return next
    })
    setDifficulty("balanced")
    if (selectedExam === "MHT_CET") {
      setNegativeMarkingEnabled(false)
    }
    toast.success(`Applied recommended ${currentExamMeta.title} practice pattern`)
  }

  const targetTotalQuestions = totalQuestions
  const targetTotalMarks = totalMarks

  // Keep examTotalMarks in Step 4 automatically synchronized with selected questions / blueprint
  useEffect(() => {
    if (generatedQuestions.length > 0) {
      const activeQs = generatedQuestions.filter((q) => selectedQuestionIds.has(q.id))
      const calculatedTotal = activeQs.reduce((sum, q) => sum + (q.marks || 1), 0)
      if (calculatedTotal > 0 && calculatedTotal !== examTotalMarks) {
        setExamTotalMarks(calculatedTotal)
      }
    } else if (targetTotalMarks > 0 && targetTotalMarks !== examTotalMarks) {
      setExamTotalMarks(targetTotalMarks)
    }
  }, [generatedQuestions, selectedQuestionIds, targetTotalMarks, examTotalMarks])

  const handleClass11WeightageChange = (val: number) => {
    const clamped = isNaN(val) ? 0 : Math.max(0, Math.min(100, Math.round(val)))
    setClass11Weightage(clamped)
    setClass12Weightage(100 - clamped)
  }

  const handleClass12WeightageChange = (val: number) => {
    const clamped = isNaN(val) ? 0 : Math.max(0, Math.min(100, Math.round(val)))
    setClass12Weightage(clamped)
    setClass11Weightage(100 - clamped)
  }

  // Step 2 Comprehensive Validation
  const validationErrors = useMemo(() => {
    const errors: string[] = []

    if (selectedSubjects.length === 0) {
      errors.push("Select at least one subject in Step 1.")
    }

    if (totalQuestions <= 0) {
      errors.push("Enter at least 1 question in Subject-wise Configuration.")
    }
    if (totalQuestions > 200) {
      errors.push("This generator supports up to 200 questions per paper.")
    }

    if (generationMode === "manual") {
      for (const sub of selectedSubjects) {
        const subCfg = subjectDist[sub] || { questions: 0, marksPerQuestion: 1, marks: 0 }
        const rows = subjectTypeDist[sub] || []
        const allocQ = rows.reduce((sum, r) => sum + (Number(r.count) || 0), 0)
        const allocM = rows.reduce((sum, r) => sum + (Number(r.count) || 0) * (Number(r.marks) || 0), 0)
        if (allocQ !== subCfg.questions || allocM !== subCfg.marks) {
          errors.push(
            `${sub}: Question Type totals (${allocQ} Q / ${allocM} Marks) must match Subject Configuration (${subCfg.questions} Q / ${subCfg.marks} Marks).`
          )
        }
        if (rows.some((r) => r.count > 0 && r.marks < 1)) {
          errors.push(`${sub}: Each active question type must have at least 1 mark per question.`)
        }
      }
    }

    if (selectedGrade === "both") {
      const totalWeightage = (Number(class11Weightage) || 0) + (Number(class12Weightage) || 0)
      if (totalWeightage !== 100) {
        errors.push("Class 11 and Class 12 weightage must add up to 100%.")
      }
    }

    const hasContent = selectedChapters.length > 0 || selectedTopics.length > 0 || Boolean(uploadedSyllabusText)
    if (!hasContent) {
      errors.push("Please select at least one chapter, add custom topics, or upload a syllabus PDF.")
    }

    return errors
  }, [
    selectedSubjects,
    totalQuestions,
    generationMode,
    subjectDist,
    subjectTypeDist,
    selectedGrade,
    class11Weightage,
    class12Weightage,
    selectedChapters.length,
    selectedTopics.length,
    uploadedSyllabusText,
  ])

  const isStep2Valid = validationErrors.length === 0

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

  const filteredClass11Chapters = useMemo(() => {
    if (!chapterSearch.trim()) return class11Chapters
    const q = chapterSearch.toLowerCase().trim()
    return class11Chapters.filter(
      (ch) => ch.name.toLowerCase().includes(q) || ch.subtopics?.some((s) => s.toLowerCase().includes(q))
    )
  }, [class11Chapters, chapterSearch])

  const filteredClass12Chapters = useMemo(() => {
    if (!chapterSearch.trim()) return class12Chapters
    const q = chapterSearch.toLowerCase().trim()
    return class12Chapters.filter(
      (ch) => ch.name.toLowerCase().includes(q) || ch.subtopics?.some((s) => s.toLowerCase().includes(q))
    )
  }, [class12Chapters, chapterSearch])

  const subjectChapterCounts = useMemo(() => {
    const selectedSet = new Set(selectedChapters)
    return selectedSubjects.reduce<Record<string, { selected: number; total: number }>>((acc, sub) => {
      const chs = getChapters(selectedExam, selectedGrade, sub)
      acc[sub] = {
        selected: chs.filter((c) => selectedSet.has(c.name)).length,
        total: chs.length,
      }
      return acc
    }, {})
  }, [selectedSubjects, selectedExam, selectedGrade, selectedChapters])

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
      return generatedQuestions.length > 0 || isStep2Valid
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

  // Select all visible chapters in active subject tab (respecting classFilter & search)
  const handleSelectAllChapters = () => {
    const pool =
      classFilter === "11"
        ? filteredClass11Chapters
        : classFilter === "12"
        ? filteredClass12Chapters
        : [...filteredClass11Chapters, ...filteredClass12Chapters]
    const allNames = pool.map((ch) => ch.name)
    setSelectedChapters((prev) => Array.from(new Set([...prev, ...allNames])))
  }

  // Clear chapters in active subject tab (or all if requested)
  const handleDeselectSubjectChapters = () => {
    const pool =
      classFilter === "11"
        ? class11Chapters
        : classFilter === "12"
        ? class12Chapters
        : currentSubjectChapters
    const removeSet = new Set(pool.map((ch) => ch.name))
    setSelectedChapters((prev) => prev.filter((name) => !removeSet.has(name)))
  }

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
    if (validationErrors.length > 0) {
      setErrorMsg(validationErrors.join(" "))
      return
    }

    if (selectedChapters.length === 0 && selectedTopics.length === 0 && !uploadedSyllabusText) {
      setErrorMsg("Please select at least one chapter from the list below to begin.")
      return
    }

    if (targetTotalQuestions === 0) {
      setErrorMsg("Please specify at least one question format or subject question count > 0.")
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
    const nextTitle = `${examCode} ${selectedSubjects.length > 1 ? selectedSubjects.join(" + ") : targetSubject}${chapterTitle ? ` - ${chapterTitle}` : ""}`

    const countToGenerate = Math.max(1, targetTotalQuestions)

    const showQuestions = (questions: GeneratedCompetitiveQuestion[]) => {
      const safeQuestions = questions.slice(0, countToGenerate)
      setGeneratedQuestions(safeQuestions)
      setSelectedQuestionIds(new Set(safeQuestions.map((q) => q.id)))
      setExamTitle(nextTitle)
      const calculatedTotal = safeQuestions.reduce((sum, q) => sum + (q.marks || 1), 0) || targetTotalMarks || 200
      setExamTotalMarks(calculatedTotal)
      setPassMarks(Math.round(calculatedTotal * 0.4))
      setDuration(Math.max(30, Math.round(safeQuestions.length * 1.2)))
      setCurrentStep(3)
    }

    try {
      // Build micro-batches (max 3 questions, 2 for diagram) so each HTTP request finishes in ~2s
      interface BatchItem {
        id: string
        subject: string
        grade: string
        chapters: string[]
        formatId: string
        formatLabel: string
        count: number
        marks: number
        negativeMark: number
        difficultyCounts?: { easy: number; medium: number; hard: number }
      }

      const batches: BatchItem[] = []

      for (const sub of selectedSubjects) {
        const subCfg = subjectDist[sub] || { questions: 0, marksPerQuestion: 1, marks: 0 }
        if (subCfg.questions <= 0) continue

        const typeRows = (
          generationMode === "auto"
            ? buildAutoSubjectTypes(sub, subCfg.questions, subCfg.marks, subCfg.marksPerQuestion)
            : subjectTypeDist[sub] || []
        ).filter((r) => r.count > 0)

        const allSubChapters = getChapters(selectedExam, selectedGrade, sub)
        const subSelected = selectedChapters.filter((name) => allSubChapters.some((c) => c.name === name))
        const hasTopicsOrPdf = selectedTopics.length > 0 || Boolean(uploadedSyllabusText.trim())
        const usableChapters =
          subSelected.length > 0
            ? subSelected
            : hasTopicsOrPdf
            ? []
            : allSubChapters.map((c) => c.name)

        const all11Chapters = getChapters(selectedExam, "11", sub).map((c) => c.name)
        const all12Chapters = getChapters(selectedExam, "12", sub).map((c) => c.name)
        const ch11 = usableChapters.filter((name) => all11Chapters.includes(name))
        const ch12 = usableChapters.filter((name) => all12Chapters.includes(name))

        for (const row of typeRows) {
          const classDist = resolveClassDistribution({
            totalQuestions: row.count,
            hasClass11Chapters: ch11.length > 0,
            hasClass12Chapters: ch12.length > 0,
            gradeFilter: selectedGrade,
            class11WeightPercent: class11Weightage,
          })

          const pushGradeBatches = (gradeLabel: string, count: number, targetChapters: string[]) => {
            let rem = count
            const chunkSize = row.formatId === "diagram" ? 2 : 5
            while (rem > 0) {
              const take = Math.min(rem, chunkSize)
              batches.push({
                id: `${sub}_${gradeLabel}_${row.formatId}_${batches.length}_${Math.random().toString(36).slice(2, 6)}`,
                subject: sub,
                grade: gradeLabel,
                chapters: targetChapters.length > 0 ? targetChapters : usableChapters,
                formatId: row.formatId,
                formatLabel: QUESTION_FORMAT_LABELS[row.formatId] || row.formatId,
                count: take,
                marks: row.marks,
                negativeMark: row.formatId === "descriptive" ? 0 : (negativeMarkingEnabled ? negativeMarkPenalty : 0),
              })
              rem -= take
            }
          }

          if (classDist.class11Count > 0 || classDist.class12Count > 0) {
            if (classDist.class11Count > 0) pushGradeBatches("11", classDist.class11Count, ch11)
            if (classDist.class12Count > 0) pushGradeBatches("12", classDist.class12Count, ch12)
          } else {
            // Custom PDF / uncategorized topics without grade split
            pushGradeBatches(
              selectedGrade === "both" ? "12" : selectedGrade,
              row.count,
              usableChapters
            )
          }
        }
      }

      const totalBatchQuestions = batches.reduce((sum, b) => sum + b.count, 0)
      const batchDiffTargets = partitionDifficultyAcrossBatches(
        computeDifficultyCounts(totalBatchQuestions, difficulty),
        batches.map((b) => b.count)
      )
      batches.forEach((b, idx) => {
        b.difficultyCounts = batchDiffTargets[idx]
      })

      const queue = [...batches]
      let allGenerated: GeneratedCompetitiveQuestion[] = []
      const seenTexts = new Set<string>()
      let openedReview = false
      const batchErrors: string[] = []

      // Concurrency 2: Dispatches 2 parallel lightweight requests at a time across Gemini API key pool
      const CONCURRENCY = 2

      const runWorker = async () => {
        while (queue.length > 0) {
          if (allGenerated.length >= countToGenerate) {
            queue.length = 0
            break
          }

          const batch = queue.shift()
          if (!batch) break

          let retries = 1
          let batchSuccess = false

          while (retries >= 0 && !batchSuccess) {
            if (allGenerated.length >= countToGenerate) {
              queue.length = 0
              break
            }

            try {
              const existingTexts = allGenerated.map((q) => q.questionText).slice(-25)

      const res = await fetch("/api/admin/generate-competitive-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          exam: selectedExam,
                  grade: batch.grade,
                  subject: batch.subject,
                  chapters: batch.chapters,
          topics: selectedTopics,
          syllabusText: uploadedSyllabusText,
          difficulty,
          difficultyCounts: batch.difficultyCounts,
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
                  marksPerQuestion: batch.marks,
                  negativeMarks: batch.negativeMark,
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
                    uniqueNew.push({
                      ...q,
                      subject: batch.subject,
                      grade: batch.grade,
                      marks: batch.marks,
                      negativeMark: batch.negativeMark,
                      chapter: q.chapter && q.chapter !== "General" ? q.chapter : (batch.chapters[0] || batch.subject),
                    })
                  }
                }

                if (uniqueNew.length > 0) {
                  const remainingSlots = countToGenerate - allGenerated.length
                  if (remainingSlots > 0) {
                    const toAdd = uniqueNew.slice(0, remainingSlots)
                    allGenerated = [...allGenerated, ...toAdd]
                    showQuestions(allGenerated)

                    if (!openedReview) {
                      openedReview = true
                      window.scrollTo({ top: 0, behavior: "auto" })
                    }
                  }
                }

                if (allGenerated.length >= countToGenerate) {
                  queue.length = 0
                  break
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

      allGenerated = allGenerated.slice(0, countToGenerate)

      if (allGenerated.length === 0) {
        throw new Error(
          batchErrors[0] || "No questions were created. Please verify your connection and click Next Step again."
        )
      }

      // Subject & format-aware top-up if any planned slot has a deficit
      if (allGenerated.length < countToGenerate) {
        const slotTargets = new Map<
          string,
          { subject: string; grade: string; formatId: string; formatLabel: string; marks: number; negativeMark: number; chapters: string[]; target: number; actual: number }
        >()
        for (const b of batches) {
          const key = `${b.subject}::${b.grade}::${b.formatId}`
          const existingSlot = slotTargets.get(key)
          if (existingSlot) {
            existingSlot.target += b.count
          } else {
            slotTargets.set(key, {
              subject: b.subject,
              grade: b.grade,
              formatId: b.formatId,
              formatLabel: b.formatLabel,
              marks: b.marks,
              negativeMark: b.negativeMark,
              chapters: b.chapters,
              target: b.count,
              actual: 0,
            })
          }
        }
        for (const q of allGenerated) {
          const key = `${q.subject || targetSubject}::${q.grade || (selectedGrade === "both" ? "12" : selectedGrade)}::${getQuestionFormat(q)}`
          const slot = slotTargets.get(key)
          if (slot) slot.actual += 1
        }
        const deficitSlots = Array.from(slotTargets.values())
          .filter((s) => s.actual < s.target)
          .slice(0, 3)

        for (const slot of deficitSlots) {
          if (allGenerated.length >= countToGenerate) break
          const slotGap = Math.min(3, slot.target - slot.actual, countToGenerate - allGenerated.length)
          if (slotGap <= 0) continue
          try {
            const topUpRes = await fetch("/api/admin/generate-competitive-questions", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({
                exam: selectedExam,
                grade: slot.grade,
                subject: slot.subject,
                chapters: slot.chapters,
                topics: selectedTopics,
                syllabusText: uploadedSyllabusText,
                difficulty,
                questionCount: slotGap,
                questionPattern: pattern,
                blueprintFormats: [
                  {
                    id: slot.formatId,
                    label: slot.formatLabel,
                    count: slotGap,
                    marks: slot.marks,
                    checked: true,
                  },
                ],
                marksPerQuestion: slot.marks,
                negativeMarks: slot.negativeMark,
                focusPYQ,
                existingQuestions: allGenerated.map((q) => q.questionText).slice(-30),
                stream: false,
              }),
            })
            const topUpData = await topUpRes.json()
            if (topUpData.success && Array.isArray(topUpData.questions) && topUpData.questions.length > 0) {
              for (const q of topUpData.questions) {
                if (allGenerated.length >= countToGenerate) break
                const norm = (q.questionText || "").toLowerCase().replace(/[^a-z0-9]/g, "")
                if (norm && !seenTexts.has(norm)) {
                  seenTexts.add(norm)
                  allGenerated.push({
                    ...q,
                    subject: slot.subject,
                    grade: slot.grade,
                    marks: slot.marks,
                    negativeMark: slot.negativeMark,
                    chapter: q.chapter && q.chapter !== "General" ? q.chapter : (slot.chapters[0] || slot.subject),
                  })
                }
              }
              allGenerated = allGenerated.slice(0, countToGenerate)
              showQuestions(allGenerated)
            }
          } catch (gapErr) {
            console.warn("[CompetitiveAI] Final gap top-up non-blocking warning:", gapErr)
          }
        }
      }

      allGenerated = allGenerated.slice(0, countToGenerate)
      showQuestions(allGenerated)
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

  // Generate missing questions to reach Step 2 subject/format blueprint target
  const handleGenerateMissing = async () => {
    const missingCount = Math.max(0, targetTotalQuestions - generatedQuestions.length)
    if (missingCount <= 0 || isGeneratingMissing) return

    setIsGeneratingMissing(true)
    setErrorMsg(null)

    // Pick the specific subject & question format that still has fewer generated questions than planned in Step 2
    const deficitSubject =
      selectedSubjects.find((sub) => {
        const targetSubCount = Number(subjectDist[sub]?.questions) || 0
        const currentSubCount = generatedQuestions.filter((q) => (q.subject || selectedSubject) === sub).length
        return currentSubCount < targetSubCount
      }) ||
      activeSubjectTab ||
      selectedSubject

    const subExisting = generatedQuestions.filter((q) => (q.subject || deficitSubject) === deficitSubject)
    const plannedRows = getSubjectTypeRows(deficitSubject)
    const missingRow =
      plannedRows.find((r) => {
        const haveFmtCount = subExisting.filter((q) => getQuestionFormat(q) === r.formatId).length
        return haveFmtCount < r.count
      }) || plannedRows[0] || { rowId: "fallback", formatId: "mcq", count: missingCount, marks: currentExamMeta.defaultMarksPerQuestion }

    const allSubChapters = getChapters(selectedExam, selectedGrade, deficitSubject)
    const subSelected = selectedChapters.filter((name) => allSubChapters.some((c) => c.name === name))
    const hasTopicsOrPdf = selectedTopics.length > 0 || Boolean(uploadedSyllabusText.trim())
    const usableChapters =
      subSelected.length > 0
        ? subSelected
        : hasTopicsOrPdf
        ? []
        : allSubChapters.map((c) => c.name)

    const all11Chapters = getChapters(selectedExam, "11", deficitSubject).map((c) => c.name)
    const all12Chapters = getChapters(selectedExam, "12", deficitSubject).map((c) => c.name)
    const ch11 = usableChapters.filter((name) => all11Chapters.includes(name))
    const ch12 = usableChapters.filter((name) => all12Chapters.includes(name))
    const have11 = subExisting.filter((q) => q.grade === "11").length
    const totalSubTarget = Math.max(1, Number(subjectDist[deficitSubject]?.questions) || missingCount)
    const targetClassDist = resolveClassDistribution({
      totalQuestions: totalSubTarget,
      hasClass11Chapters: ch11.length > 0,
      hasClass12Chapters: ch12.length > 0,
      gradeFilter: selectedGrade,
      class11WeightPercent: class11Weightage,
    })
    const need11 = have11 < targetClassDist.class11Count && ch11.length > 0
    const chosenGrade =
      need11
        ? "11"
        : ch12.length > 0
        ? "12"
        : ch11.length > 0
        ? "11"
        : selectedGrade === "both"
        ? "12"
        : selectedGrade
    const chosenChapters = chosenGrade === "11" ? (ch11.length > 0 ? ch11 : usableChapters) : (ch12.length > 0 ? ch12 : usableChapters)
    const missingNegative =
      missingRow.formatId === "descriptive" ? 0 : negativeMarkingEnabled ? negativeMarkPenalty : 0

    const chapterTitle =
      selectedChapters.length === 1
        ? selectedChapters[0]
        : selectedChapters.length > 1
        ? `${selectedChapters[0]} & ${selectedChapters.length - 1} more`
        : ""
    const nextTitle = `${selectedExam.replace("-", "_")} ${selectedSubjects.length > 1 ? selectedSubjects.join(" + ") : deficitSubject}${chapterTitle ? ` - ${chapterTitle}` : ""}`
    const existingTexts = generatedQuestions.map((q) => q.questionText)

    try {
      const formatRemaining = Math.max(
        1,
        missingRow.count - subExisting.filter((q) => getQuestionFormat(q) === missingRow.formatId).length
      )
      const requestCount = Math.min(missingCount, formatRemaining, 3)
      const res = await fetch("/api/admin/generate-competitive-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          exam: selectedExam,
          grade: chosenGrade,
          subject: deficitSubject,
          chapters: chosenChapters,
          topics: selectedTopics,
          syllabusText: uploadedSyllabusText,
          difficulty,
          questionCount: requestCount,
          questionPattern: pattern,
          blueprintFormats: [
            {
              id: missingRow.formatId,
              label: QUESTION_FORMAT_LABELS[missingRow.formatId] || missingRow.formatId,
              count: requestCount,
              marks: missingRow.marks,
              checked: true,
            },
          ],
          marksPerQuestion: missingRow.marks,
          negativeMarks: missingNegative,
          focusPYQ,
          existingQuestions: existingTexts.slice(-30),
          stream: false,
        }),
      })

      const data = await res.json()
      if (res.ok && data.success && Array.isArray(data.questions) && data.questions.length > 0) {
        const toAdd = data.questions.slice(0, missingCount).map((q: any) => ({
          ...q,
          subject: deficitSubject,
          grade: chosenGrade,
          marks: missingRow.marks,
          negativeMark: missingNegative,
          chapter: q.chapter && q.chapter !== "General" ? q.chapter : (chosenChapters[0] || deficitSubject),
        }))
        const updated = [...generatedQuestions, ...toAdd].slice(0, targetTotalQuestions)
        setGeneratedQuestions(updated)
        setSelectedQuestionIds(new Set(updated.map((q) => q.id)))
        setExamTitle(nextTitle)
        const calculatedTotal = updated.reduce((sum, q) => sum + (q.marks || 1), 0)
        setExamTotalMarks(calculatedTotal)
        setPassMarks(Math.round(calculatedTotal * 0.4))
        toast.success(`Generated ${toAdd.length} more ${deficitSubject} question(s)! Total: ${updated.length}/${targetTotalQuestions}`)
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

      // Construct accurate Date objects in the user's browser timezone
      const [sy, sm, sd] = startDate.split("-").map(Number)
      const [sh, smin] = formattedStartTime.split(":").map(Number)
      const startDateTime = new Date(sy, sm - 1, sd, sh || 0, smin || 0, 0, 0)

      const [ey, em, ed] = endDate.split("-").map(Number)
      const [eh, emin] = formattedEndTime.split(":").map(Number)
      const endDateTime = new Date(ey, em - 1, ed, eh ?? 23, emin ?? 59, 59, 999)

      const finalInstructions = instructions && instructions.length > 0 ? instructions : [
        "Read all questions carefully before answering.",
        "Do not switch tabs or exit the exam screen during the test.",
        "Ensure you have completed all required questions before finishing the exam.",
      ]

      const isNegativeEnabled = negativeMarkingEnabled
      const defaultNegMark = isNegativeEnabled ? negativeMarkPenalty : 0

      const typeTitles: Record<string, string> = {
        mcq: "Multiple Choice Questions",
        mcq_multi: "Multiple-Correct Questions",
        diagram: "Diagram & Visual Questions",
        assertion: "Assertion & Reason",
        truefalse: "True / False Questions",
        fillblanks: "Fill in the Blanks",
        descriptive: "Descriptive Questions",
      }

      const mappedQuestions = toSave.map((q, qIdx) => {
        const canonical = normalizeStoredQuestion(q, qIdx)
        const canonicalFormat = canonical.questionFormat
        const dbType = formatToDbType(canonicalFormat)
        const payload = toExamQuestionPayload({
          ...canonical,
          marks: q.marks || (canonicalFormat === "descriptive" ? 5 : currentExamMeta.defaultMarksPerQuestion),
          negativeMark:
            canonicalFormat === "descriptive"
              ? 0
              : negativeMarkingEnabled
                ? q.negativeMark !== undefined && q.negativeMark > 0
                  ? q.negativeMark
                  : defaultNegMark
                : 0,
        })

        return {
          ...payload,
          type: dbType,
          grade: q.grade,
        } as any
      })

      let sections: any[] = []
      const distinctSubjects = Array.from(new Set(mappedQuestions.map((q) => q.subject).filter(Boolean)))

      if (distinctSubjects.length > 1) {
        let runningCount = 1
        sections = distinctSubjects.map((subName) => {
          const qs = mappedQuestions.filter((q) => q.subject === subName)
          const startNum = runningCount
          const endNum = runningCount + qs.length - 1
          runningCount = endNum + 1
          return {
            name: String(subName),
            title: `${subName} Section`,
            type: qs[0]?.type || "mcq",
            negativeMarking: isNegativeEnabled,
            sectionNegativeMark: defaultNegMark,
            questionRange: `${startNum}-${endNum}`,
            questions: qs,
          }
        })
      } else {
        const typeOrder = ["mcq", "mcq_multi", "diagram", "assertion", "truefalse", "fillblanks", "descriptive"]
        const groupedTypes = typeOrder.filter(t => mappedQuestions.some(q => q.type === t))

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
            startDate: startDateTime.toISOString(),
            startTime: formattedStartTime,
            endDate: endDateTime.toISOString(),
            endTime: formattedEndTime,
            isScheduled: true,
          },
          settings: {
            randomize: evalSettings.randomizeQuestions,
            showResults: evalSettings.showResultsImmediately,
            allowReview: evalSettings.allowReview,
            negativeMarking: isNegativeEnabled,
            allowCalculator: evalSettings.allowCalculator,
            enableCalculator: evalSettings.allowCalculator,
            startDate: startDateTime.toISOString(),
            startTime: formattedStartTime,
            endDate: endDateTime.toISOString(),
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
            competitiveGenerator: {
              selectedExam,
              selectedGrade,
              selectedSubjects,
              selectedSubject,
              activeSubjectTab,
              selectedChapters,
              selectedTopics,
              uploadedSyllabusText: uploadedSyllabusText.slice(0, 4000),
              uploadedPdf,
              blueprintFormats: effectiveBlueprintFormats,
              subjectDist,
              subjectTypeDist,
              generationMode,
              class11Weightage,
              class12Weightage,
              questionCount,
              difficulty,
              pattern,
              focusPYQ,
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
          Your coaching institute does not have permission to access the Entrance Exam Section. Please contact your administrator to enable this module.
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
    <div className={`min-h-screen bg-[#F8FAFC] pt-6 sm:pt-8 ${currentStep === 3 ? "pb-28 sm:pb-32" : "pb-16"}`}>
      <div className="mx-auto max-w-[1400px] px-3 sm:px-8 lg:px-10">
        {/* ─── Breadcrumbs ─── */}
        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 mb-2">
          <Link href="/admin/exams" className="hover:text-slate-900 transition-colors">
            Exams
          </Link>
          <span>/</span>
          <span className="text-slate-900 font-semibold">Entrance Exam</span>
        </div>

        {/* ─── Studio Title & Badges Header ─── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
          <div>
            <h1 className="text-lg sm:text-xl font-medium tracking-tight text-slate-900">
              Entrance Exam Section
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

          {/* ─── STEP 2: CONTENT & BLUEPRINT (MATCHING SCREENSHOT + CHAPTERS) ─── */}
          {currentStep === 2 && (
            <div className="space-y-5">
              {/* Top Context Bar + Recommended Pattern Action */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white rounded-2xl border border-slate-200/80 px-4 py-3.5 sm:px-5 shadow-2xs">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                  <span className="px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200/80 font-semibold text-slate-800">
                    {currentExamMeta.title}
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200/80">
                    Class:{" "}
                    <b className="text-slate-800">
                      {selectedGrade === "both" ? "11th + 12th" : selectedGrade === "11" ? "Class 11th" : "Class 12th"}
                    </b>
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200/80">
                    Subjects: <b className="text-slate-800">{selectedSubjects.join(", ")}</b>
                  </span>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    title="Edit Exam, Class or Subjects"
                    className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 inline-flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={applyExamRecommendedPreset}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition-colors cursor-pointer shrink-0"
                >
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Use Recommended {currentExamMeta.title} Pattern</span>
                </button>
              </div>

              {/* ─── Top Mode Toggle Cards ─── */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <button
                  type="button"
                  onClick={() => handleModeSwitch("manual")}
                  className={`w-full text-left px-4 py-3.5 rounded-2xl border transition-all flex items-center gap-3.5 cursor-pointer ${
                    generationMode === "manual"
                      ? "bg-[#26354B] border-[#26354B] text-white shadow-sm"
                      : "bg-white border-slate-200/90 text-slate-800 hover:border-slate-300 shadow-2xs"
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                      generationMode === "manual"
                        ? "bg-white text-[#26354B]"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    <Check className="w-4 h-4 stroke-[2.75]" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold leading-snug">Create with Questions</div>
                    <div
                      className={`text-xs mt-0.5 leading-snug ${
                        generationMode === "manual" ? "text-slate-200" : "text-slate-500"
                      }`}
                    >
                      Configure subjects, question types and marks manually.
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleModeSwitch("auto")}
                  className={`w-full text-left px-4 py-3.5 rounded-2xl border transition-all flex items-center gap-3.5 cursor-pointer ${
                    generationMode === "auto"
                      ? "bg-[#26354B] border-[#26354B] text-white shadow-sm"
                      : "bg-white border-slate-200/90 text-slate-800 hover:border-slate-300 shadow-2xs"
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                      generationMode === "auto"
                        ? "bg-white text-[#26354B]"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold leading-snug">Auto Generate Test</div>
                    <div
                      className={`text-xs mt-0.5 leading-snug ${
                        generationMode === "auto" ? "text-slate-200" : "text-slate-500"
                      }`}
                    >
                      Create test automatically using MCQ (Single Correct) and Diagram/Visual.
                    </div>
                  </div>
                </button>
              </div>

              {/* ─── CARD 1: SUBJECT-WISE CONFIGURATION + CLASS-WISE WEIGHTAGE ─── */}
              <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
                  <div className="flex items-start gap-3">
                    <span className="w-7 h-7 rounded-full bg-[#26354B] text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                      1
                    </span>
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-slate-900">
                        Subject-wise Configuration
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Set total questions and total marks for each subject.
                      </p>
                    </div>
                  </div>

                  {totalQuestions > 0 &&
                  totalQuestions <= 200 &&
                  (selectedGrade !== "both" || (Number(class11Weightage) || 0) + (Number(class12Weightage) || 0) === 100) ? (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-50 border border-emerald-200/80 text-emerald-700 text-xs font-bold">
                      Configured <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold">
                      Check Limits
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
                  {/* Left: Subject-wise Totals Table */}
                  <div className="lg:col-span-7 xl:col-span-8 rounded-xl border border-slate-200/80 bg-slate-50/50 overflow-hidden flex flex-col justify-between">
                    <div>
                      <div className="grid grid-cols-12 gap-3 px-4 py-3 text-xs font-bold text-slate-700 border-b border-slate-200/70 bg-slate-50/90">
                        <span className="col-span-4">Subject</span>
                        <span className="col-span-4 text-center">
                          Total Questions <span className="text-red-500">*</span>
                        </span>
                        <span className="col-span-4 text-center">
                          Total Marks <span className="text-red-500">*</span>
                        </span>
                      </div>

                      <div className="divide-y divide-slate-100 bg-white/80">
                        {selectedSubjects.map((sub) => {
                          const subCfg = subjectDist[sub] || { questions: 0, marksPerQuestion: 1, marks: 0 }
                          return (
                            <div key={sub} className="grid grid-cols-12 gap-3 px-4 py-2.5 items-center">
                              <span className="col-span-4 text-xs sm:text-sm font-medium text-slate-800">
                                {sub}
                              </span>
                              <div className="col-span-4 flex justify-center">
                                <input
                                  type="number"
                                  min={0}
                                  max={200}
                                  value={subCfg.questions}
                                  onFocus={(e) => e.target.select()}
                                  onChange={(e) => updateSubjectTotalQuestions(sub, e.target.value)}
                                  aria-label={`${sub} total questions`}
                                  className="w-24 sm:w-28 h-9 px-2 text-center rounded-lg border border-slate-200 bg-white text-xs sm:text-sm font-semibold text-slate-800 shadow-2xs focus:outline-none focus:ring-2 focus:ring-[#26354B]/15"
                                />
                              </div>
                              <div className="col-span-4 flex justify-center">
                                <input
                                  type="number"
                                  min={0}
                                  max={2000}
                                  value={subCfg.marks}
                                  onFocus={(e) => e.target.select()}
                                  onChange={(e) => updateSubjectTotalMarks(sub, e.target.value)}
                                  aria-label={`${sub} total marks`}
                                  className="w-24 sm:w-28 h-9 px-2 text-center rounded-lg border border-slate-200 bg-white text-xs sm:text-sm font-semibold text-slate-800 shadow-2xs focus:outline-none focus:ring-2 focus:ring-[#26354B]/15"
                                />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Table Footer Row */}
                    <div className="grid grid-cols-12 gap-3 px-4 py-3 bg-slate-50/90 border-t border-slate-200/70 items-center">
                      <span className="col-span-4 text-xs sm:text-sm font-bold text-slate-900">Total</span>
                      <span className="col-span-4 text-center text-sm font-bold text-slate-900">
                        {totalQuestions}
                      </span>
                      <span className="col-span-4 text-center text-sm font-bold text-slate-900">
                        {totalMarks}
                      </span>
                    </div>
                  </div>

                  {/* Right: Class-wise Weightage Card */}
                  <div className="lg:col-span-5 xl:col-span-4 rounded-xl border border-slate-200/90 bg-slate-50/40 p-4 flex flex-col justify-between">
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-slate-800">
                        Class-wise Weightage <span className="text-red-500">*</span>
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {selectedGrade === "both"
                          ? "Set syllabus weightage for each class."
                          : `Fixed to 100% for Class ${selectedGrade}th selection.`}
                      </p>

                      <div className="space-y-3 mt-4">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs sm:text-sm font-medium text-slate-800">Class 11</span>
                          {selectedGrade === "both" ? (
                            <div className="relative w-28">
                              <input
                                type="number"
                                min={0}
                                max={100}
                                value={class11Weightage}
                                onFocus={(e) => e.target.select()}
                                onChange={(e) => handleClass11WeightageChange(Number(e.target.value))}
                                aria-label="Class 11 weightage percentage"
                                className="w-full h-9 pl-3 pr-7 text-center rounded-lg border border-slate-200 bg-white text-xs sm:text-sm font-semibold text-slate-800 shadow-2xs focus:outline-none focus:ring-2 focus:ring-[#26354B]/15"
                              />
                              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 pointer-events-none">
                                %
                              </span>
                            </div>
                          ) : (
                            <div className="w-28 h-9 px-3 rounded-lg border border-slate-200 bg-slate-100/80 flex items-center justify-center text-xs sm:text-sm font-semibold text-slate-700">
                              {selectedGrade === "11" ? "100%" : "0%"}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs sm:text-sm font-medium text-slate-800">Class 12</span>
                          {selectedGrade === "both" ? (
                            <div className="relative w-28">
                              <input
                                type="number"
                                min={0}
                                max={100}
                                value={class12Weightage}
                                onFocus={(e) => e.target.select()}
                                onChange={(e) => handleClass12WeightageChange(Number(e.target.value))}
                                aria-label="Class 12 weightage percentage"
                                className="w-full h-9 pl-3 pr-7 text-center rounded-lg border border-slate-200 bg-white text-xs sm:text-sm font-semibold text-slate-800 shadow-2xs focus:outline-none focus:ring-2 focus:ring-[#26354B]/15"
                              />
                              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 pointer-events-none">
                                %
                              </span>
                            </div>
                          ) : (
                            <div className="w-28 h-9 px-3 rounded-lg border border-slate-200 bg-slate-100/80 flex items-center justify-center text-xs sm:text-sm font-semibold text-slate-700">
                              {selectedGrade === "12" ? "100%" : "0%"}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-200/70 flex items-center justify-between gap-2">
                      <span className="text-xs sm:text-sm font-bold text-slate-900">Total Weightage</span>
                      {selectedGrade !== "both" ||
                      (Number(class11Weightage) || 0) + (Number(class12Weightage) || 0) === 100 ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-50 border border-emerald-200/80 text-emerald-700 text-xs font-bold">
                          100% <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-3 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold">
                          {(Number(class11Weightage) || 0) + (Number(class12Weightage) || 0)}%
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* ─── CARD 2: QUESTION TYPE DISTRIBUTION ─── */}
              <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                  <div className="flex items-start gap-3">
                    <span className="w-7 h-7 rounded-full bg-[#26354B] text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                      2
                    </span>
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-slate-900">
                        Question Type Distribution
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {generationMode === "auto"
                          ? "Auto Generate Test distributes questions automatically between MCQ (Single Correct) and Diagram/Visual."
                          : "Configure question types for each subject. Questions and marks are limited to the values set above."}
                      </p>
                    </div>
                  </div>

                  {(() => {
                    const activeSub = selectedSubjects.includes(activeSubjectTab)
                      ? activeSubjectTab
                      : selectedSubjects[0] || "Physics"
                    const activeProg = getSubjectProgress(activeSub)
                    return !activeProg.isMatched && generationMode === "manual" ? (
                      <button
                        type="button"
                        onClick={() => balanceSubjectTypeRows(activeSub)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-200 bg-amber-50 hover:bg-amber-100 text-xs font-semibold text-amber-900 transition-colors cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Auto-balance {activeSub}</span>
                      </button>
                    ) : null
                  })()}
                </div>

                {/* Subject Segmented Tabs */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {selectedSubjects.map((sub) => {
                    const prog = getSubjectProgress(sub)
                    const isActive = activeSubjectTab === sub
                    return (
                      <button
                        key={sub}
                        type="button"
                        onClick={() => {
                          setActiveSubjectTab(sub)
                          setSelectedSubject(sub)
                        }}
                        className={`flex-1 min-w-[175px] h-10 px-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer ${
                          isActive
                            ? "bg-[#26354B] text-white shadow-xs"
                            : "bg-white border border-slate-200 text-slate-700 hover:border-slate-300"
                        }`}
                      >
                        <span>
                          {sub} ({prog.targetQ} Q / {prog.targetM} Marks)
                        </span>
                        {!prog.isMatched && (
                          <span
                            className={`w-2 h-2 rounded-full ${isActive ? "bg-amber-300" : "bg-amber-500"}`}
                            title="Question type total does not match subject target"
                          />
                        )}
                      </button>
                    )
                  })}
                </div>

                {/* Split Row: Question Type Table (Left) + Subject Progress (Right) */}
                {(() => {
                  const activeSub = selectedSubjects.includes(activeSubjectTab)
                    ? activeSubjectTab
                    : selectedSubjects[0] || "Physics"
                  const currentRows = getSubjectTypeRows(activeSub)
                  const activeProg = getSubjectProgress(activeSub)
                  const usedFormats = new Set(currentRows.map((r) => r.formatId))

                  return (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start mt-4">
                      {/* Left: Question Types Table */}
                      <div className="lg:col-span-8 rounded-xl border border-slate-200/80 bg-slate-50/50 p-3.5 sm:p-4 space-y-3">
                        <div className="hidden sm:grid grid-cols-12 gap-2.5 px-1 text-xs font-bold text-slate-700">
                          <span className="col-span-5">Question Type</span>
                          <span className="col-span-2 text-center">Questions</span>
                          <span className="col-span-3 text-center">Marks per Question</span>
                          <span className="col-span-2 text-center">Total Marks</span>
                        </div>

                        <div className="space-y-2.5">
                          {currentRows.map((row) => (
                            <div
                              key={row.rowId}
                              className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center bg-white/70 sm:bg-transparent p-2.5 sm:p-0 rounded-xl border sm:border-0 border-slate-200/70"
                            >
                              {/* Question Type Select */}
                              <div className="sm:col-span-5">
                                <label className="block sm:hidden text-[11px] font-semibold text-slate-500 mb-1">
                                  Question Type
                                </label>
                                {generationMode === "auto" ? (
                                  <div className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-slate-100/80 flex items-center text-xs font-medium text-slate-700">
                                    {QUESTION_FORMAT_LABELS[row.formatId] || row.formatId}
                                  </div>
                                ) : (
                                  <div className="relative">
                                    <select
                                      value={row.formatId}
                                      onChange={(e) =>
                                        updateSubjectTypeRow(activeSub, row.rowId, { formatId: e.target.value })
                                      }
                                      className="w-full h-10 pl-3 pr-8 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-800 shadow-2xs appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#26354B]/15"
                                    >
                                      {Object.entries(QUESTION_FORMAT_LABELS).map(([fmtKey, fmtLabel]) => {
                                        const isUsedElsewhere = usedFormats.has(fmtKey) && fmtKey !== row.formatId
                                        return (
                                          <option key={fmtKey} value={fmtKey} disabled={isUsedElsewhere}>
                                            {fmtLabel}
                                          </option>
                                        )
                                      })}
                                    </select>
                                    <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" />
                                  </div>
                                )}
                              </div>

                              {/* Questions Input */}
                              <div className="sm:col-span-2">
                                <label className="block sm:hidden text-[11px] font-semibold text-slate-500 mb-1">
                                  Questions
                                </label>
                                <input
                                  type="number"
                                  min={0}
                                  max={200}
                                  disabled={generationMode === "auto"}
                                  value={row.count}
                                  onFocus={(e) => e.target.select()}
                                  onChange={(e) =>
                                    updateSubjectTypeRow(activeSub, row.rowId, {
                                      count: e.target.value === "" ? 0 : Number(e.target.value),
                                    })
                                  }
                                  className="w-full h-10 px-2 text-center rounded-lg border border-slate-200 bg-slate-100/75 focus:bg-white text-xs sm:text-sm font-semibold text-slate-800 shadow-2xs focus:outline-none focus:ring-2 focus:ring-[#26354B]/15 disabled:opacity-75 disabled:cursor-not-allowed"
                                />
                              </div>

                              {/* Marks per Question Input */}
                              <div className="sm:col-span-3">
                                <label className="block sm:hidden text-[11px] font-semibold text-slate-500 mb-1">
                                  Marks per Question
                                </label>
                                <input
                                  type="number"
                                  min={1}
                                  max={100}
                                  disabled={generationMode === "auto"}
                                  value={row.marks}
                                  onFocus={(e) => e.target.select()}
                                  onChange={(e) =>
                                    updateSubjectTypeRow(activeSub, row.rowId, {
                                      marks: e.target.value === "" ? 1 : Number(e.target.value),
                                    })
                                  }
                                  className="w-full h-10 px-2 text-center rounded-lg border border-slate-200 bg-white text-xs sm:text-sm font-semibold text-slate-800 shadow-2xs focus:outline-none focus:ring-2 focus:ring-[#26354B]/15 disabled:bg-slate-100/80 disabled:opacity-75 disabled:cursor-not-allowed"
                                />
                              </div>

                              {/* Total Marks Read-only + Optional Remove */}
                              <div className="sm:col-span-2 flex items-center gap-1.5">
                                <div
                                  className="flex-1 h-10 px-2 rounded-lg border border-slate-200 bg-slate-100/85 flex items-center justify-center text-xs sm:text-sm font-bold text-slate-800 select-none"
                                  title="Questions × Marks per Question"
                                >
                                  {(Number(row.count) || 0) * (Number(row.marks) || 0)}
                                </div>
                                {generationMode === "manual" && currentRows.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => removeSubjectTypeRow(activeSub, row.rowId)}
                                    title="Remove question type"
                                    className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer shrink-0"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>

                        {generationMode === "manual" && (
                          <div className="pt-1">
                            <button
                              type="button"
                              onClick={() => addSubjectTypeRow(activeSub)}
                              disabled={currentRows.length >= Object.keys(QUESTION_FORMAT_LABELS).length}
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-2xs transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Add Question Type</span>
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Right: {Subject} Progress Card */}
                      <div className="lg:col-span-4 rounded-xl border border-slate-200/90 bg-slate-50/40 p-4 space-y-3">
                        <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-200/70">
                          <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                            {activeSub} Progress
                          </h4>
                          {activeProg.isMatched ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200/80 text-emerald-700 text-xs font-bold">
                              <Check className="w-3.5 h-3.5 stroke-[2.5]" /> Matched
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold">
                              Mismatch
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between text-xs sm:text-sm">
                          <span className="text-slate-600 font-medium">Questions</span>
                          <span
                            className={`font-bold ${
                              activeProg.isQuestionsMatched ? "text-emerald-600" : "text-amber-600"
                            }`}
                          >
                            {activeProg.allocatedQ} / {activeProg.targetQ}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-xs sm:text-sm">
                          <span className="text-slate-600 font-medium">Marks</span>
                          <span
                            className={`font-bold ${
                              activeProg.isMarksMatched ? "text-emerald-600" : "text-amber-600"
                            }`}
                          >
                            {activeProg.allocatedM} / {activeProg.targetM}
                          </span>
                        </div>

                        {!activeProg.isMatched && generationMode === "manual" && (
                          <button
                            type="button"
                            onClick={() => balanceSubjectTypeRows(activeSub)}
                            className="w-full mt-1 py-1.5 px-3 rounded-lg bg-amber-100/70 hover:bg-amber-100 text-amber-900 text-[11px] font-semibold transition-colors cursor-pointer"
                          >
                            Match Subject Limits Automatically
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })()}

                {/* Blue Note Callout Banner */}
                <div className="mt-4 rounded-xl border border-blue-200/80 bg-blue-50/70 px-4 py-3 flex items-start gap-2.5 text-xs text-slate-700">
                  <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    <b className="text-slate-900">Note:</b> By default, all questions are added as &ldquo;MCQ – Single Correct&rdquo;. You can add more question types if required, but the total questions and total marks must match the subject-wise limits.
                  </p>
                </div>

                {/* Compact Difficulty, PYQ Focus & Negative Marking Bar */}
                <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                  <div className="md:col-span-5 flex flex-col sm:flex-row sm:items-center gap-2">
                    <span className="text-xs font-bold text-slate-700 shrink-0 flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-slate-500" /> Difficulty:
                    </span>
                    <div className="relative flex-1">
                      <select
                        value={difficulty}
                        onChange={(e) => setDifficulty(e.target.value as any)}
                        className="w-full h-9 pl-3 pr-8 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-800 appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#26354B]/15"
                      >
                        <option value="balanced">Balanced (Standard Exam Mix)</option>
                        <option value="easy">Easy (Concept Foundations)</option>
                        <option value="medium">Medium (Application & Numerical)</option>
                        <option value="hard">Hard (Advanced Multi-Concept)</option>
                      </select>
                      <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" />
                    </div>
                  </div>

                  <div className="md:col-span-3 flex items-center gap-2">
                    <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={focusPYQ}
                        onChange={(e) => setFocusPYQ(e.target.checked)}
                        className="w-4 h-4 rounded text-[#26354B] focus:ring-[#26354B] cursor-pointer"
                      />
                      <span>PYQ-Style Rigor</span>
                    </label>
                  </div>

                  <div className="md:col-span-4 flex flex-wrap items-center justify-start md:justify-end gap-2.5">
                    <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={negativeMarkingEnabled}
                        onChange={(e) => handleToggleNegativeMarking(e.target.checked)}
                        className="w-4 h-4 rounded text-[#26354B] focus:ring-[#26354B] cursor-pointer"
                      />
                      <span>Negative Marking</span>
                    </label>
                    {negativeMarkingEnabled && (
                      <div className="flex items-center gap-1.5">
                        <div className="relative">
                          <select
                            value={[0.25, 0.33, 0.5, 1, 2].includes(negativeMarkPenalty) ? negativeMarkPenalty : "custom"}
                            onChange={(e) => {
                              if (e.target.value === "custom") {
                                handleNegativePenaltyChange(1.5)
                              } else {
                                handleNegativePenaltyChange(parseFloat(e.target.value))
                              }
                            }}
                            className="h-8 pl-2.5 pr-7 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-800 cursor-pointer appearance-none focus:outline-none focus:border-slate-800"
                          >
                            <option value={0.25}>-0.25</option>
                            <option value={0.33}>-0.33</option>
                            <option value={0.5}>-0.50</option>
                            <option value={1}>-1.00</option>
                            <option value={2}>-2.00</option>
                            <option value="custom">Custom</option>
                          </select>
                          <ChevronDown className="w-3.5 h-3.5 text-slate-400 pointer-events-none absolute right-2 top-1/2 -translate-y-1/2" />
                        </div>
                        {![0.25, 0.33, 0.5, 1, 2].includes(negativeMarkPenalty) && (
                          <input
                            type="number"
                            step="0.05"
                            min="0.05"
                            max="10"
                            value={negativeMarkPenalty}
                            onChange={(e) => handleNegativePenaltyChange(Math.max(0, parseFloat(e.target.value) || 0))}
                            className="w-14 h-8 px-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-800 text-center"
                          />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ─── CARD 3: CHAPTER & SYLLABUS SELECTION ─── */}
              <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                  <div className="flex items-start gap-3">
                    <span className="w-7 h-7 rounded-full bg-[#26354B] text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                      3
                    </span>
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-slate-900">
                        Chapter &amp; Syllabus Selection
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Select chapters for each subject, or add custom topics / upload a syllabus PDF.
                      </p>
                    </div>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold border ${
                      selectedChapters.length > 0 || selectedTopics.length > 0 || Boolean(uploadedSyllabusText)
                        ? "bg-emerald-50 border-emerald-200/80 text-emerald-700"
                        : "bg-amber-50 border-amber-200 text-amber-800"
                    }`}
                  >
                    {selectedChapters.length > 0 && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
                    <span>
                      Selected: {selectedChapters.length} {selectedChapters.length === 1 ? "Chapter" : "Chapters"}
                    </span>
                  </span>
                </div>

                {/* Subject Filter Tabs for Chapters */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 mb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {selectedSubjects.map((sub) => {
                    const counts = subjectChapterCounts[sub] || { selected: 0, total: 0 }
                    const isActive = activeSubjectTab === sub
                    return (
                      <button
                        key={sub}
                        type="button"
                        onClick={() => {
                          setActiveSubjectTab(sub)
                          setSelectedSubject(sub)
                        }}
                        className={`px-4 py-1.5 rounded-full text-xs transition-all shrink-0 cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                          isActive
                            ? "bg-[#26354B] text-white font-bold shadow-xs"
                            : "bg-slate-50 border border-slate-200 text-slate-700 hover:border-slate-300 font-semibold"
                        }`}
                      >
                        <span>{sub}</span>
                        <span
                          className={`text-[11px] px-1.5 py-0.5 rounded-full ${
                            isActive
                              ? "bg-white/15 text-white"
                              : counts.selected > 0
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-slate-200/70 text-slate-600"
                          }`}
                        >
                          {counts.selected}/{counts.total}
                        </span>
                      </button>
                    )
                  })}
                </div>

                {/* Class Filter Chips + Chapter Search & Bulk Actions */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {[
                      { id: "all", label: `All (${currentSubjectChapters.length})` },
                      { id: "11", label: `Class 11 (${class11Chapters.length})` },
                      { id: "12", label: `Class 12 (${class12Chapters.length})` },
                    ].map((cf) => (
                      <button
                        key={cf.id}
                        type="button"
                        onClick={() => setClassFilter(cf.id as any)}
                        className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors shrink-0 cursor-pointer whitespace-nowrap ${
                          classFilter === cf.id
                            ? "bg-blue-50 text-blue-900 border border-blue-200/80 font-bold"
                            : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300 font-medium"
                        }`}
                      >
                        {cf.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative flex-1 sm:w-52">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={chapterSearch}
                        onChange={(e) => setChapterSearch(e.target.value)}
                        placeholder={`Search ${activeSubjectTab} chapters...`}
                        className="w-full h-8 pl-8 pr-7 rounded-lg border border-slate-200 bg-white text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#26354B]/15"
                      />
                      {chapterSearch && (
                        <button
                          type="button"
                          onClick={() => setChapterSearch("")}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={handleSelectAllChapters}
                      className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-[11px] font-semibold text-slate-700 cursor-pointer shrink-0"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={handleDeselectSubjectChapters}
                      className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-[11px] font-semibold text-slate-500 hover:text-slate-700 cursor-pointer shrink-0"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {/* Accordions for Class 11 & Class 12 */}
                <div className="space-y-3">
                  {(classFilter === "all" || classFilter === "11") && filteredClass11Chapters.length > 0 && (
                    <div className="rounded-xl border border-slate-200/90 bg-white overflow-hidden shadow-2xs">
                      <div className="p-3.5 flex items-center justify-between hover:bg-slate-50/70 transition-colors">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => setExpandedClasses((prev) => ({ ...prev, "11": !prev["11"] }))}
                            className="text-slate-400 hover:text-slate-700 cursor-pointer p-0.5"
                          >
                            <ChevronDown
                              className={`w-4 h-4 transition-transform duration-200 ${
                                expandedClasses["11"] || chapterSearch.trim() ? "rotate-180" : ""
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
                              className="w-4 h-4 rounded text-[#26354B] focus:ring-slate-900 border-slate-300 cursor-pointer"
                            />
                            <span className="font-bold text-slate-800 text-xs sm:text-sm">
                              Class 11 ({filteredClass11Chapters.length}
                              {chapterSearch.trim() ? ` of ${class11Chapters.length}` : ""} chapters)
                            </span>
                          </label>
                        </div>
                        <ChevronRight
                          onClick={() => setExpandedClasses((prev) => ({ ...prev, "11": !prev["11"] }))}
                          className={`w-4 h-4 text-slate-400 cursor-pointer transition-transform ${
                            expandedClasses["11"] || chapterSearch.trim() ? "rotate-90" : ""
                          }`}
                        />
                      </div>

                      {(expandedClasses["11"] || Boolean(chapterSearch.trim())) && (
                        <div className="px-4 py-3 bg-slate-50/40 border-t border-slate-100 max-h-64 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-1.5 custom-scrollbar">
                          {filteredClass11Chapters.map((ch, idx) => {
                            const isChecked = selectedChapters.includes(ch.name)
                            return (
                              <label
                                key={ch.id || ch.name}
                                className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer hover:bg-white p-2 rounded-lg transition-colors"
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleChapter(ch.name)}
                                  className="w-4 h-4 rounded text-[#26354B] focus:ring-slate-900 border-slate-300 cursor-pointer shrink-0"
                                />
                                <span className="font-medium text-slate-800">
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

                  {(classFilter === "all" || classFilter === "12") && filteredClass12Chapters.length > 0 && (
                    <div className="rounded-xl border border-slate-200/90 bg-white overflow-hidden shadow-2xs">
                      <div className="p-3.5 flex items-center justify-between hover:bg-slate-50/70 transition-colors">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => setExpandedClasses((prev) => ({ ...prev, "12": !prev["12"] }))}
                            className="text-slate-400 hover:text-slate-700 cursor-pointer p-0.5"
                          >
                            <ChevronDown
                              className={`w-4 h-4 transition-transform duration-200 ${
                                expandedClasses["12"] || chapterSearch.trim() ? "rotate-180" : ""
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
                              className="w-4 h-4 rounded text-[#26354B] focus:ring-slate-900 border-slate-300 cursor-pointer"
                            />
                            <span className="font-bold text-slate-800 text-xs sm:text-sm">
                              Class 12 ({filteredClass12Chapters.length}
                              {chapterSearch.trim() ? ` of ${class12Chapters.length}` : ""} chapters)
                            </span>
                          </label>
                        </div>
                        <ChevronRight
                          onClick={() => setExpandedClasses((prev) => ({ ...prev, "12": !prev["12"] }))}
                          className={`w-4 h-4 text-slate-400 cursor-pointer transition-transform ${
                            expandedClasses["12"] || chapterSearch.trim() ? "rotate-90" : ""
                          }`}
                        />
                      </div>

                      {(expandedClasses["12"] || Boolean(chapterSearch.trim())) && (
                        <div className="px-4 py-3 bg-slate-50/40 border-t border-slate-100 max-h-64 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-1.5 custom-scrollbar">
                          {filteredClass12Chapters.map((ch, idx) => {
                            const isChecked = selectedChapters.includes(ch.name)
                            return (
                              <label
                                key={ch.id || ch.name}
                                className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer hover:bg-white p-2 rounded-lg transition-colors"
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleChapter(ch.name)}
                                  className="w-4 h-4 rounded text-[#26354B] focus:ring-slate-900 border-slate-300 cursor-pointer shrink-0"
                                />
                                <span className="font-medium text-slate-800">
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

                  {filteredClass11Chapters.length === 0 && filteredClass12Chapters.length === 0 && (
                    <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500">
                      No chapters matched &ldquo;{chapterSearch}&rdquo; for {activeSubjectTab}.
                    </div>
                  )}
                </div>

                {/* Collapsible Custom Topics & Syllabus PDF Drawer */}
                <div className="mt-4 rounded-xl border border-slate-200/80 bg-slate-50/40 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowAdvancedInputs((v) => !v)}
                    className="w-full px-4 py-3 flex items-center justify-between text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <Tag className="w-3.5 h-3.5 text-slate-500" />
                      <span>Custom Topics &amp; Syllabus PDF (Optional)</span>
                      {(selectedTopics.length > 0 || uploadedPdf) && (
                        <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold">
                          {selectedTopics.length + (uploadedPdf ? 1 : 0)} added
                        </span>
                      )}
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-400 transition-transform ${showAdvancedInputs ? "rotate-180" : ""}`}
                    />
                  </button>

                  {showAdvancedInputs && (
                    <div className="px-4 pb-4 pt-2 border-t border-slate-200/70 grid grid-cols-1 md:grid-cols-2 gap-4 bg-white/70">
                      {/* Manual Custom Topics */}
                      <div className="space-y-2">
                        <label className="block text-[11px] font-bold text-slate-700">
                          Focus Topics / Concepts (comma separated)
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={manualTopicInput}
                            onChange={(e) => setManualTopicInput(e.target.value)}
                            onKeyDown={handleManualTopicKeyDown}
                            placeholder="e.g. SN1 vs SN2, Rolling Motion, Bayes Theorem"
                            className="flex-1 h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#26354B]/15"
                          />
                          <button
                            type="button"
                            onClick={handleAddManualTopic}
                            className="h-9 px-3 rounded-lg bg-[#26354B] text-white text-xs font-semibold cursor-pointer shrink-0"
                          >
                            Add
                          </button>
                        </div>
                        {selectedTopics.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {selectedTopics.map((topic) => (
                              <span
                                key={topic}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-800 text-[11px] font-medium border border-slate-200"
                              >
                                <span>{topic}</span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveTopic(topic)}
                                  className="text-slate-400 hover:text-red-600 cursor-pointer"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Syllabus PDF Upload */}
                      <div className="space-y-2">
                        <label className="block text-[11px] font-bold text-slate-700">
                          Upload Coaching / Board Syllabus PDF
                        </label>
                        <input
                          ref={pdfInputRef}
                          type="file"
                          accept=".pdf"
                          onChange={handlePdfUpload}
                          className="hidden"
                        />
                        {uploadedPdf ? (
                          <div className="h-9 px-3 rounded-lg border border-emerald-200 bg-emerald-50 flex items-center justify-between text-xs text-emerald-900">
                            <span className="flex items-center gap-1.5 truncate font-medium">
                              <FileCheck2 className="w-4 h-4 text-emerald-600 shrink-0" />
                              <span className="truncate">{uploadedPdf.name}</span>
                              <span className="text-[10px] text-emerald-700 shrink-0">
                                ({uploadedPdf.wordCount} words)
                              </span>
                            </span>
                            <button
                              type="button"
                              onClick={handleRemovePdf}
                              className="text-emerald-700 hover:text-red-600 cursor-pointer ml-2"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => pdfInputRef.current?.click()}
                            disabled={isUploadingPdf}
                            className="w-full h-9 px-3 rounded-lg border border-dashed border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center justify-center gap-2 cursor-pointer"
                          >
                            {isUploadingPdf ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>Extracting syllabus...</span>
                              </>
                            ) : (
                              <>
                                <Upload className="w-3.5 h-3.5 text-slate-500" />
                                <span>Choose Syllabus PDF</span>
                              </>
                            )}
                          </button>
                        )}
                        {pdfError && <p className="text-[11px] text-red-600">{pdfError}</p>}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Validation Alert Banner */}
              {validationErrors.length > 0 && (
                <div className="flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 shadow-2xs">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <div className="space-y-0.5">
                    {validationErrors.map((err, idx) => (
                      <p key={idx}>{err}</p>
                    ))}
                  </div>
                </div>
              )}
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
                                  <div className="font-semibold text-slate-800">Aspirant Copy</div>
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
                              <span>Generating ({generatedQuestions.length}/{targetTotalQuestions})...</span>
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
                        title="Print clean question paper for aspirants"
                      >
                        <Printer className="w-3.5 h-3.5 text-blue-600" />
                        <span>Print for Aspirants</span>
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
                            <span>Generating ({generatedQuestions.length}/{targetTotalQuestions})...</span>
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
                      {formatCounts.mcq_multi > 0 && (
                        <button
                          type="button"
                          onClick={() => setFormatFilter("mcq_multi")}
                          className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all shrink-0 cursor-pointer whitespace-nowrap ${
                            formatFilter === "mcq_multi"
                              ? "bg-indigo-600 text-white shadow-xs"
                              : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          Multi-Correct ({formatCounts.mcq_multi})
                        </button>
                      )}
                      {formatCounts.diagram > 0 && (
                        <button
                          type="button"
                          onClick={() => setFormatFilter("diagram")}
                          className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all shrink-0 cursor-pointer whitespace-nowrap ${
                            formatFilter === "diagram"
                              ? "bg-teal-600 text-white shadow-xs"
                              : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          Diagram ({formatCounts.diagram})
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
                            Creating Questions in Progress ({generatedQuestions.length} of {targetTotalQuestions} completed)...
                          </p>
                          <p className="text-[11px] text-slate-600 font-normal mt-0.5">
                            Please wait while AI generates all questions. Proceeding to the next step will unlock once all {targetTotalQuestions} questions are ready.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                        <div className="w-28 sm:w-36 h-2 bg-amber-200/80 rounded-full overflow-hidden">
                          <div
                            className="bg-[#1E293B] h-full rounded-full transition-all duration-300"
                            style={{
                              width: `${Math.min(100, Math.round((generatedQuestions.length / Math.max(1, targetTotalQuestions)) * 100))}%`
                            }}
                          />
                        </div>
                        <span className="text-[11px] font-bold text-slate-900 tabular-nums">
                          {Math.min(100, Math.round((generatedQuestions.length / Math.max(1, targetTotalQuestions)) * 100))}%
                        </span>
                      </div>
                    </div>
                  )}

                  {!isGenerating && generatedQuestions.length > 0 && generatedQuestions.length < targetTotalQuestions && (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-blue-50/80 p-4 text-xs font-medium text-slate-700 shadow-xs">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-[#1E293B] text-white flex items-center justify-center shrink-0 shadow-xs">
                          <Sparkles className="h-4 w-4 text-amber-300" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 text-xs sm:text-sm">
                            {generatedQuestions.length} of {targetTotalQuestions} Questions Ready
                          </p>
                          <p className="text-[11px] text-slate-600 font-normal mt-0.5">
                            {targetTotalQuestions - generatedQuestions.length} questions remaining to reach your target blueprint. Click below to generate the rest!
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
                            <span>Generating {targetTotalQuestions - generatedQuestions.length} Remaining...</span>
                          </>
                        ) : (
                          <>
                            <Plus className="w-3.5 h-3.5 text-amber-300" />
                            <span>Generate Remaining {targetTotalQuestions - generatedQuestions.length} Questions</span>
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

                      const isMulti = qFormat === "mcq_multi"

                      const formatLabel =
                        isDescriptive ? "Descriptive" :
                        isTF ? "True / False" :
                        isAR ? "Assertion & Reason" :
                        qFormat === "diagram" ? "Diagram Based" :
                        qFormat === "fib" ? "Fill in the Blanks" :
                        isMulti ? "MCQ (Multiple Correct)" : "MCQ"

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
                                {q.subject && (
                                  <span className="text-[10px] font-bold text-blue-900 bg-blue-50 border border-blue-200/70 px-2 py-0.5 rounded-md shrink-0">
                                    {q.subject}
                                  </span>
                                )}
                                {q.grade && (
                                  <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded-md shrink-0">
                                    Class {q.grade}th
                                  </span>
                                )}
                                <span className="text-xs font-medium text-slate-800 truncate" title={q.chapter}>
                                  {q.chapter}
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="text-[11px] sm:text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                                  +{q.marks}m{q.negativeMark > 0 ? ` / -${q.negativeMark}m` : ""}
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
                                  <MathRenderer content={Array.isArray(q.correctAnswer) ? q.correctAnswer.join(", ") : (q.correctAnswer || "Model answer / key concepts to be evaluated by AI.")} />
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
                              const label = isTF ? (opt === "True" ? "T" : "F") : ["A", "B", "C", "D"][oi]
                                const isCorrect = isTF
                                  ? opt === displayCorrectAnswer
                                  : Array.isArray(q.correctAnswer)
                                  ? (q.correctAnswer.includes(label) || q.correctAnswer.some(a => String(a).trim().toLowerCase() === opt.trim().toLowerCase()))
                                  : (opt === displayCorrectAnswer || q.correctAnswer === label || String(q.correctAnswer).trim().toLowerCase() === opt.trim().toLowerCase())

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
                        <label className="block text-[11px] font-medium text-slate-500 mb-1.5 truncate flex items-center justify-between">
                          <span>Total Marks</span>
                          <span className="text-[10px] text-slate-400 font-normal flex items-center gap-1">
                            <Lock size={10} className="text-slate-400" /> Auto-calculated
                          </span>
                        </label>
                        <input
                          type="number"
                          readOnly
                          disabled
                          value={examTotalMarks}
                          title="Total marks are calculated automatically from the question paper and cannot be changed manually."
                          className="w-full px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-slate-100/80 text-slate-700 cursor-not-allowed select-none shadow-2xs focus:outline-none"
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
                        <span className="w-1.5 h-4.5 bg-[#324158] rounded-full inline-block" />
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
                          <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:border-[#324158]/50 group-hover:bg-slate-50/80 transition-all shadow-2xs">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <Calendar className="w-4 h-4 text-[#324158] shrink-0" />
                              <span className="text-xs sm:text-sm font-medium text-slate-800 truncate">
                                {formatDateDisplay(startDate)}
                              </span>
                            </div>
                            <span className="text-[10px] font-medium text-[#324158] bg-[#eaf0f8] px-2 py-0.5 rounded-md border border-[#324158]/20 shrink-0">
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
                                  ? "bg-[#324158] text-white shadow-2xs"
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
                                  ? "bg-[#324158] text-white shadow-2xs"
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
                        <span className="w-1.5 h-4.5 bg-[#324158] rounded-full inline-block" />
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
                          <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:border-[#324158]/50 group-hover:bg-slate-50/80 transition-all shadow-2xs">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <Calendar className="w-4 h-4 text-[#324158] shrink-0" />
                              <span className="text-xs sm:text-sm font-medium text-slate-800 truncate">
                                {formatDateDisplay(endDate)}
                              </span>
                            </div>
                            <span className="text-[10px] font-medium text-[#324158] bg-[#eaf0f8] px-2 py-0.5 rounded-md border border-[#324158]/20 shrink-0">
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
                                  ? "bg-[#324158] text-white shadow-2xs"
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
                                  ? "bg-[#324158] text-white shadow-2xs"
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
                        <div className="flex items-center gap-2">
                          <Calculator className="w-4 h-4 text-[#324158]" />
                          <div>
                            <span className="text-xs font-normal text-slate-700 block">
                              Enable Aspirant Calculator
                        </span>
                            <span className="text-[10px] text-slate-400 block">
                              Allow on-screen scientific calculator during exam
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setEvalSettings((prev) => ({
                              ...prev,
                              allowCalculator: !prev.allowCalculator,
                            }))
                          }
                          className={`w-11 h-6 flex items-center rounded-full p-0.5 transition-colors cursor-pointer shrink-0 ${
                            evalSettings.allowCalculator ? "bg-[#1E293B]" : "bg-slate-200"
                          }`}
                        >
                          <div
                            className={`bg-white w-5 h-5 rounded-full shadow-sm transform transition-transform ${
                              evalSettings.allowCalculator ? "translate-x-5" : "translate-x-0"
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
                    <strong className="font-medium text-[#1E40AF]">Pro-Tip:</strong> Face Detection &amp; AI Status Analysis require aspirants to have a working webcam.
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
            <div
              className={
                currentStep === 3
                  ? "fixed bottom-0 left-0 lg:left-[272px] right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-[0_-4px_25px_rgba(0,0,0,0.08)] py-3 px-4 sm:px-8 transition-all"
                  : "mt-8 flex items-center justify-between gap-3 pt-2"
              }
            >
              <div className="mx-auto max-w-[1400px] flex items-center justify-between gap-2 sm:gap-3 w-full">
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
                  className="px-4 sm:px-6 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-medium text-xs sm:text-sm hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer shrink-0 flex items-center gap-1.5"
            >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
            </button>

            {currentStep === 1 && (
                  <div className="flex items-center gap-2.5">
                    {generatedQuestions.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setCurrentStep(3)
                          window.scrollTo({ top: 0, behavior: "smooth" })
                        }}
                        className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs sm:text-sm flex items-center gap-2 shadow-2xs transition-all cursor-pointer"
                      >
                        <span>Skip to Questions ({generatedQuestions.length})</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    )}
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                disabled={selectedSubjects.length === 0}
                className="px-4 sm:px-6 py-2.5 rounded-xl bg-[#1E293B] hover:bg-[#0F172A] text-white font-medium text-xs sm:text-sm flex items-center gap-2 shadow-sm transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span>Next Step</span>
                <ArrowRight className="w-4 h-4" />
              </button>
                  </div>
            )}

            {currentStep === 2 && (
              <div className="flex items-center gap-2 flex-wrap justify-end">
                {errorMsg && (
                  <span className="text-xs text-red-600 font-medium bg-red-50 border border-red-200 px-3 py-1.5 rounded-lg max-w-xs truncate">
                    {errorMsg}
                  </span>
                )}
                    {generatedQuestions.length > 0 && (
                <button
                  type="button"
                        onClick={() => {
                          if (window.confirm("Are you sure you want to re-create questions? This will replace your current questions.")) {
                            handleGenerate()
                          }
                        }}
                        disabled={isGenerating || !isStep2Valid}
                        className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 font-semibold text-xs sm:text-sm flex items-center gap-2 shadow-2xs transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? "animate-spin" : ""}`} />
                        <span>Re-create Questions</span>
                      </button>
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
                      disabled={isGenerating || (generatedQuestions.length === 0 && !isStep2Valid)}
                      title={
                        generatedQuestions.length === 0 && !isStep2Valid
                          ? validationErrors[0] || "Please resolve configuration alignment issues before proceeding"
                          : "Proceed to next step"
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
                          <span>{generatedQuestions.length > 0 ? `Next: View Questions (${generatedQuestions.length})` : "Next Step"}</span>
                          <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            )}

            {currentStep === 3 && (
                  <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-end">
                    {generatedQuestions.length > 0 && (
                      <span className="hidden xl:inline-flex text-xs font-semibold text-slate-500 bg-slate-100/90 px-3 py-1.5 rounded-full border border-slate-200/80 mr-1">
                        {selectedQuestionIds.size} of {generatedQuestions.length} Selected
                      </span>
                    )}

              <button
                type="button"
                onClick={() => {
                        setPrintMode("student")
                        setPrintModalOpen(true)
                      }}
                      disabled={isGenerating || generatedQuestions.length === 0}
                      className="hidden sm:inline-flex px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs sm:text-sm items-center gap-1.5 sm:gap-2 shadow-xs transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      title="Print question paper for aspirants (Without Solutions)"
                    >
                      <Printer className="w-4 h-4 text-blue-600 shrink-0" />
                      <span>Print Aspirant Copy</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setPrintMode("teacher")
                        setPrintModalOpen(true)
                      }}
                      disabled={isGenerating || generatedQuestions.length === 0}
                      className="hidden sm:inline-flex px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs sm:text-sm items-center gap-1.5 sm:gap-2 shadow-xs transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      title="Print question paper with complete solutions and answer key"
                    >
                      <FileText className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Print Teacher Copy</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (isGenerating) return
                        setInstructions((prev) => {
                          const base = prev && prev.length > 0 ? prev : [
                            "Read all questions carefully before answering.",
                            "Do not switch tabs or exit the exam screen during the test.",
                            "Ensure you have completed all required questions before finishing the exam.",
                          ]
                          if (negativeMarkingEnabled) {
                            const negText = `Negative marking: -${negativeMarkPenalty} marks will be deducted for each incorrect response.`
                            const hasNeg = base.some((i) => i.toLowerCase().includes("negative marking"))
                            if (!hasNeg) return [...base, negText]
                            return base.map((i) => (i.toLowerCase().includes("negative marking") ? negText : i))
                          } else {
                            return base.filter((i) => !i.toLowerCase().includes("negative marking"))
                          }
                        })
                  setCurrentStep(4)
                  window.scrollTo({ top: 0, behavior: "smooth" })
                }}
                      disabled={isGenerating || selectedQuestionIds.size === 0}
                      className="px-4 sm:px-7 py-2 sm:py-2.5 rounded-xl bg-[#1E293B] hover:bg-[#0F172A] text-white font-medium text-xs sm:text-sm flex items-center gap-2 shadow-md transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-lg active:scale-[0.99]"
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
                {(editingQuestion.options || []).map((opt, i) => {
                  const letter = ["A", "B", "C", "D"][i]
                  const isMulti = editingQuestion.questionFormat === "mcq_multi" || editingQuestion.questionFormat === "mcq_multiple" || (Array.isArray(editingQuestion.correctAnswer) && editingQuestion.correctAnswer.length > 1)
                  const isOptSelected = Array.isArray(editingQuestion.correctAnswer)
                    ? (editingQuestion.correctAnswer.includes(letter) || editingQuestion.correctAnswer.includes(opt))
                    : (editingQuestion.correctAnswer === opt || editingQuestion.correctAnswer === letter)

                  return (
                <div key={i} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <div className="flex items-center gap-2 flex-1">
                    <span className="w-6 text-xs font-medium text-gray-500 shrink-0">
                          {letter}:
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
                        })
                      }}
                          className="flex-1 p-2 text-xs rounded-lg border border-gray-200 bg-white text-[#324158] font-mono focus:outline-none focus:border-[#2D3A4A]"
                    />
                  </div>
                  <button
                    type="button"
                        onClick={() => {
                          if (isMulti) {
                            const cur = Array.isArray(editingQuestion.correctAnswer)
                              ? [...editingQuestion.correctAnswer]
                              : [String(editingQuestion.correctAnswer || "A")]
                            const exists = cur.includes(letter) || cur.includes(opt)
                            const next = exists ? cur.filter(x => x !== letter && x !== opt) : [...cur, letter]
                            setEditingQuestion({ ...editingQuestion, correctAnswer: next.length > 0 ? next : [letter] })
                          } else {
                            setEditingQuestion({ ...editingQuestion, correctAnswer: letter })
                          }
                        }}
                    className={`self-end sm:self-auto px-3 py-1.5 text-xs rounded-lg font-medium transition-colors cursor-pointer shrink-0 ${
                          isOptSelected
                        ? "bg-emerald-600 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                        {isOptSelected ? "Correct Answer" : "Set Correct"}
                  </button>
                </div>
                  )
                })}
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
            <span className="text-sm font-medium">Loading Entrance Exam Section...</span>
          </div>
        </div>
      }
    >
      <AIGeneratorContent />
    </Suspense>
  )
}
