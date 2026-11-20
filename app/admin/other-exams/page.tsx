"use client"

import { useState, useMemo, useRef, useEffect, KeyboardEvent, Suspense } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import {
  Search,
  ArrowRight,
  ArrowLeft,
  Check,
  CheckCircle2,
  Sparkles,
  Layers,
  X,
  Zap,
  ChevronDown,
  ChevronUp,
  Plus,
  Edit2,
  Edit3,
  Trash2,
  Sliders,
  HelpCircle,
  FileText,
  AlertCircle,
  Clock,
  Award,
  Upload,
  FileCheck2,
  Target,
  ShieldCheck,
  Tag,
  Loader2,
  Filter,
  Printer,
  Calendar,
  Lock,
  RefreshCw,
  Info,
} from "lucide-react"
import { MathRenderer } from "@/components/exam/MathRenderer"
import { QuestionDiagram } from "@/components/exam/QuestionDiagram"
import { PrintableExamPaper } from "@/components/admin/PrintableExamPaper"
import { toast } from "sonner"

export interface ExamCategory {
  id: string
  number: string
  title: string
}

export const EXAM_CATEGORIES: ExamCategory[] = [
  { id: "engineering_tech", number: "01", title: "Engineering Entrance Exams" },
  { id: "medical_health", number: "02", title: "Medical & Health Entrance Exams" },
  { id: "mba_management", number: "03", title: "Management Entrance Exams" },
  { id: "law_entrance", number: "04", title: "Law Entrance Exams" },
  { id: "defence_uniformed", number: "05", title: "Defence Exams" },
  { id: "banking_finance", number: "06", title: "Banking & Financial Exams" },
  { id: "upsc", number: "07", title: "UPSC & Civil Services Exams" },
  { id: "mpsc_state_psc", number: "08", title: "MPSC & State PSC Exams" },
  { id: "ssc_railways", number: "09", title: "SSC & Central Govt. Exams" },
  { id: "teaching_eligibility", number: "10", title: "Teaching & Eligibility Exams" },
  { id: "scholarship", number: "11", title: "Scholarship Exams" },
  { id: "other_exams", number: "12", title: "Other Exams (All Competitive Exams)" },
]

// Exact Mapped Exams from Pages 1 to 7 of PDF
export const CATEGORY_EXAMS: Record<string, string[]> = {
  other_exams: [
    "NMMS (National Means-cum-Merit Scholarship)",
    "Maharashtra Scholarship Exam – Class 5",
    "Maharashtra Scholarship Exam – Class 8",
    "SOF IMO (International Mathematics Olympiad)",
    "SOF NSO (National Science Olympiad)",
    "Homi Bhabha Balvaidnyanik Competition",
    "SOF Olympiads – IEO / IGKO / NCO / ISSO",
    "SilverZone Olympiads",
    "NTSE (National Talent Search Examination)",
    "Unified Cyber Olympiad",
    "CUET UG",
    "CUET PG",
    "GATE",
    "IIT JAM",
    "All India Sainik School Entrance (AISSEE)",
    "Jawahar Navodaya Vidyalaya Selection Test (JNVST)",
    "State Level Talent Search Examination",
    "Other Competitive / Entrance Examinations",
  ],
  scholarship: [
    "NMMS (National Means-cum-Merit Scholarship)",
    "Maharashtra Scholarship Exam – Class 5",
    "Maharashtra Scholarship Exam – Class 8",
    "SOF IMO (International Mathematics Olympiad)",
    "SOF NSO (National Science Olympiad)",
    "Homi Bhabha Balvaidnyanik Competition",
    "SOF Olympiads – IMO / NSO / IEO / IGKO / NCO / ISSO",
    "SilverZone Olympiads",
    "Unified Cyber Olympiad",
    "NTSE (National Talent Search Examination)",
  ],
  upsc: [
    "Civil Services Examination – Prelims",
    "Civil Services Examination – Mains",
    "Indian Forest Service (IFoS)",
    "CDS (Combined Defence Services)",
    "NDA & NA (National Defence Academy)",
    "CAPF Assistant Commandant",
    "Engineering Services Examination (ESE)",
    "Combined Medical Services (CMS)",
    "Indian Economic Service / Indian Statistical Service",
    "Combined Geo-Scientist",
    "EPFO recruitment examinations",
  ],
  mpsc_state_psc: [
    "MPSC Rajyaseva – Prelims",
    "MPSC Rajyaseva – Mains",
    "MPSC Group B – PSI / STI / ASO",
    "MPSC Group C",
    "MPSC Forest Services",
    "MPSC Engineering Services",
    "MPSC Agriculture Services",
    "Maharashtra Civil Judge / JMFC",
    "Talathi recruitment",
    "Maharashtra Police Bharti",
    "Zilla Parishad recruitment",
    "Other State PSCs – UPPSC / BPSC / MPPSC / RPSC / GPSC / KPSC / TNPSC / OPSC / JPSC",
  ],
  banking_finance: [
    "IBPS PO",
    "IBPS Clerk / Customer Service Associate",
    "IBPS Specialist Officer",
    "IBPS RRB Officer Scale I",
    "IBPS RRB Office Assistant",
    "IBPS RRB Officer Scale II & III",
    "SBI PO",
    "SBI Clerk",
    "SBI Specialist Officer",
    "RBI Grade B",
    "RBI Assistant",
    "NABARD Grade A / B",
    "SEBI Grade A",
    "SIDBI Grade A / B",
    "ECGC PO",
    "LIC AAO / ADO",
    "NIACL Administrative Officer",
  ],
  ssc_railways: [
    "SSC CGL",
    "SSC CHSL",
    "SSC MTS",
    "SSC GD Constable",
    "SSC CPO",
    "SSC JE",
    "SSC Stenographer",
    "SSC Selection Post",
    "SSC JHT",
    "SSC ASO / departmental posts",
    "Delhi Police recruitment",
    "RRB NTPC",
    "RRB Group D",
    "RRB ALP",
    "RRB JE",
    "RRB Technician",
    "RPF recruitment",
  ],
  mba_management: [
    "CAT",
    "XAT",
    "SNAP",
    "NMAT",
    "CMAT",
    "MAT",
    "ATMA",
    "MAH MBA / MMS CET",
    "GMAT",
    "MICAT",
    "IBSAT",
    "JIPMAT",
    "IPMAT",
  ],
  medical_health: [
    "NEET PG",
    "INI-CET",
    "NEET MDS",
    "AIIMS B.Sc. Nursing",
    "AIIMS Paramedical",
    "AIAPGET",
    "Nursing CET",
    "Maharashtra B.Sc. Nursing CET",
    "FMGE",
    "NIPER JEE",
  ],
  engineering_tech: [
    "JEE Main – Paper 1 (B.E. / B.Tech)",
    "JEE Main – Paper 2A (B.Arch)",
    "JEE Main – Paper 2B (B.Planning)",
    "JEE Advanced",
    "BITSAT",
    "VITEEE",
    "SRMJEEE",
    "MET",
    "COMEDK UGET",
    "WBJEE",
    "KCET",
    "GUJCET",
    "AP EAPCET",
    "TS EAPCET",
    "NATA",
    "MHT-CET – PCM",
    "MHT-CET – PCB",
  ],
  law_entrance: [
    "CLAT – UG",
    "CLAT – PG",
    "AILET – UG",
    "AILET – PG",
    "MH CET Law – 5-Year LLB",
    "MH CET Law – 3-Year LLB",
    "SLAT",
    "LSAT-style practice tests",
  ],
  design_creative: [
    "NIFT Entrance Examination",
    "NID DAT",
    "UCEED",
    "CEED",
    "FDDI AIST",
    "AIEED",
    "MITID DAT",
  ],
  defence_uniformed: [
    "NDA & NA",
    "CDS",
    "AFCAT",
    "CAPF Assistant Commandant",
    "Indian Navy recruitment / INET-style practice",
    "Army Agniveer",
    "Navy Agniveer",
    "Air Force Agniveervayu",
    "Indian Coast Guard Navik",
    "Military Nursing Service",
  ],
  teaching_eligibility: [
    "CTET – Paper I",
    "CTET – Paper II",
    "MAHA TET",
    "UPTET",
    "REET",
    "HTET",
    "UGC NET",
    "CSIR NET",
    "MH SET",
    "KVS recruitment",
    "NVS recruitment",
  ],
  university_professional: [
    "CUET UG",
    "CUET PG",
    "ICAR-related entrance examinations",
    "GPAT",
    "GATE",
    "IIT JAM",
    "ISI Admission Test",
    "CMI Entrance Examination",
    "NCHM JEE",
    "NCET",
    "Other university-specific / professional entrance examinations",
  ],
}

// 12 Standard Question Formats from Page 8 of PDF
export interface BlueprintFormatRow {
  id: string
  name: string
  checked: boolean
  count: number
  marks: number
}

const DEFAULT_BLUEPRINT_FORMATS: BlueprintFormatRow[] = [
  { id: "mcq", name: "MCQ – Single Correct", checked: true, count: 20, marks: 4 },
  { id: "mcq_multiple", name: "MCQ – Multiple Correct", checked: false, count: 5, marks: 4 },
  { id: "assertion", name: "Assertion & Reason", checked: true, count: 5, marks: 4 },
  { id: "diagram", name: "Image-based / Diagram / Visual", checked: false, count: 5, marks: 4 },
  { id: "true_false", name: "True / False", checked: false, count: 5, marks: 2 },
  { id: "fib", name: "Fill in the Blanks", checked: false, count: 5, marks: 2 },
  { id: "match_following", name: "Match the Following", checked: false, count: 4, marks: 4 },
  { id: "numerical", name: "Numerical Answer Type", checked: false, count: 5, marks: 4 },
  { id: "short_answer", name: "Short Answer", checked: false, count: 4, marks: 3 },
  { id: "long_descriptive", name: "Long Answer / Descriptive", checked: false, count: 2, marks: 5 },
  { id: "case_passage", name: "Case Study / Passage-based", checked: false, count: 4, marks: 4 },
  { id: "coding_essay", name: "Coding / Essay (where applicable)", checked: false, count: 1, marks: 10 },
]

export interface GeneratedQuestionItem {
  id: string
  type: "mcq"
  questionFormat?: string
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
}

function parseAssertionReason(text: string): { assertion: string; reason: string } | null {
  if (!text) return null
  const match = text.match(/(?:Assertion\s*\(?A\)?\s*[:\-–]\s*)([\s\S]+?)(?=(?:Reason\s*\(?R\)?\s*[:\-–]\s*)|$)/i)
  const matchR = text.match(/(?:Reason\s*\(?R\)?\s*[:\-–]\s*)([\s\S]+)$/i)
  if (match && matchR) {
    return {
      assertion: match[1].trim(),
      reason: matchR[1].trim(),
    }
  }
  return null
}

function OtherExamsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editExamId = searchParams.get("edit")
  const [editingExamId, setEditingExamId] = useState<string | null>(editExamId)
  const [isLoadingExistingExam, setIsLoadingExistingExam] = useState(false)
  const [hasOtherExamsAccess, setHasOtherExamsAccess] = useState<boolean | null>(null)
  const [isExamQuotaReached, setIsExamQuotaReached] = useState(false)
  const [maxExams, setMaxExams] = useState(20)
  const [examCount, setExamCount] = useState(0)
  const [currentStep, setCurrentStep] = useState(1)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/admin/institute-access", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        if (data.hasOtherExamsAccess !== undefined) {
          setHasOtherExamsAccess(data.hasOtherExamsAccess !== false)
        } else {
          setHasOtherExamsAccess(true)
        }
        setIsExamQuotaReached(Boolean(data.isExamQuotaReached))
        if (data.maxExams !== undefined) setMaxExams(Number(data.maxExams))
        if (data.examCount !== undefined) setExamCount(Number(data.examCount))
      })
      .catch(() => {
        setHasOtherExamsAccess(true)
        setIsExamQuotaReached(false)
      })
  }, [])

  // Step 1: Category
  const [selectedCategory, setSelectedCategory] = useState<string>("other_exams")
  const [searchQuery, setSearchQuery] = useState("")

  // Step 2: Exam & Stage
  const [selectedExam, setSelectedExam] = useState<string>("")
  const [examDropdownOpen, setExamDropdownOpen] = useState(false)
  const [examSearchQuery, setExamSearchQuery] = useState("")
  const [isCustomExam, setIsCustomExam] = useState(false)
  const [customExamInput, setCustomExamInput] = useState("")
  const [selectedStage, setSelectedStage] = useState<string>("Prelims / Stage 1")
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Step 3: Content & Blueprint (Page 8 of PDF)
  const [selectedTopics, setSelectedTopics] = useState<string[]>([])
  const [manualTopicInput, setManualTopicInput] = useState("")
  const [uploadedSyllabusText, setUploadedSyllabusText] = useState("")
  const [uploadedPdf, setUploadedPdf] = useState<{ name: string; size: number } | null>(null)
  const [isUploadingPdf, setIsUploadingPdf] = useState(false)
  const pdfInputRef = useRef<HTMLInputElement>(null)

  const [blueprintFormats, setBlueprintFormats] = useState<BlueprintFormatRow[]>(DEFAULT_BLUEPRINT_FORMATS)
  const [negativeMarkingEnabled, setNegativeMarkingEnabled] = useState(true)
  const [negativeMarkPenalty, setNegativeMarkPenalty] = useState(1)
  const [difficultyRatio, setDifficultyRatio] = useState<"mixed" | "easy" | "medium" | "hard">("mixed")
  const [examDuration, setExamDuration] = useState<number>(60)

  // Step 4: Questions & Generation States
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationStep, setGenerationStep] = useState(0)
  const [generatedQuestions, setGeneratedQuestions] = useState<GeneratedQuestionItem[]>([])
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<Set<string>>(new Set())
  const [expandedSolutions, setExpandedSolutions] = useState<Set<string>>(new Set())
  const [formatFilter, setFormatFilter] = useState<string>("all")
  const [editingQuestion, setEditingQuestion] = useState<GeneratedQuestionItem | null>(null)
  const [isGeneratingMissing, setIsGeneratingMissing] = useState(false)

  // Print Preview
  const [printDropdownOpen, setPrintDropdownOpen] = useState(false)
  const [printMode, setPrintMode] = useState<"student" | "teacher">("student")
  const [showPrintModal, setShowPrintModal] = useState(false)

  // Step 5: Exam Details
  const [examTitle, setExamTitle] = useState("")
  const [passMarks, setPassMarks] = useState<number>(0)
  const [examTotalMarks, setExamTotalMarks] = useState<number>(0)
  const [questionsPerMinute, setQuestionsPerMinute] = useState("")
  const [instructionsList, setInstructionsList] = useState<string[]>([
    "Each question has only one correct option unless specified.",
    "Negative marking applies for incorrect attempts.",
    "Do not switch tabs or exit fullscreen mode during the examination.",
  ])

  // Step 6: Settings & Proctoring
  const [startDate, setStartDate] = useState<string>(() => new Date().toISOString().split("T")[0])
  const [startHour, setStartHour] = useState<string>("09")
  const [startMinute, setStartMinute] = useState<string>("00")
  const [startPeriod, setStartPeriod] = useState<"AM" | "PM">("AM")
  const [endDate, setEndDate] = useState<string>(() => {
    const d = new Date()
    d.setDate(d.getDate() + 7)
    return d.toISOString().split("T")[0]
  })
  const [endHour, setEndHour] = useState<string>("11")
  const [endMinute, setEndMinute] = useState<string>("59")
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
    enableNegativeMarking: true,
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

  const to24HourTime = (hourStr: string, minStr: string, period: "AM" | "PM") => {
    let h = parseInt(hourStr, 10)
    if (isNaN(h)) h = 10
    if (period === "PM" && h < 12) h += 12
    if (period === "AM" && h === 12) h = 0
    const m = minStr ? minStr.padStart(2, "0") : "00"
    return `${String(h).padStart(2, "0")}:${m}`
  }

  // Step 7: Publishing State
  const [isPublishing, setIsPublishing] = useState(false)

  // 7-Step Navigation (Matches Competitive Test Studio Exactly)
  const STEPS = [
    { step: 1, label: "Category" },
    { step: 2, label: "Select Exam" },
    { step: 3, label: "Blueprint" },
    { step: 4, label: "Questions" },
    { step: 5, label: "Exam Details" },
    { step: 6, label: "Settings" },
    { step: 7, label: "Publish" },
  ]

  // Close dropdown when clicked outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setExamDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
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

        // Find matching category
        if (exam.subject) {
          const matched = EXAM_CATEGORIES.find((c) => c.title.toLowerCase() === exam.subject.toLowerCase())
          if (matched) setSelectedCategory(matched.id)
        }

        const secName = exam.sections?.[0]?.name || ""
        const cleanName = secName.replace(/\s*\([^)]*\)\s*$/, "").trim()
        if (cleanName) {
          setSelectedExam(cleanName)
        } else if (exam.title) {
          setSelectedExam(exam.title)
        }

        if (exam.class) setSelectedStage(exam.class)
        if (exam.duration) setExamDuration(exam.duration)
        if (exam.totalMarks) setExamTotalMarks(exam.totalMarks)
        if (exam.passMarks) setPassMarks(exam.passMarks)
        if (exam.questionsPerMin) setQuestionsPerMinute(String(exam.questionsPerMin))
        if (Array.isArray(exam.instructions)) {
          setInstructionsList(exam.instructions)
        } else if (typeof exam.instructions === "string") {
          setInstructionsList(exam.instructions.split("\n").filter(Boolean))
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

        // Settings
        if (exam.settings) {
          setEvalSettings((prev) => ({
            ...prev,
            randomizeQuestions: exam.settings.randomize ?? prev.randomizeQuestions,
            showResultsImmediately: exam.settings.showResults ?? prev.showResultsImmediately,
            allowReview: exam.settings.allowReview ?? prev.allowReview,
            enableNegativeMarking: exam.settings.negativeMarking ?? prev.enableNegativeMarking,
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

        // Map questions
        const loadedQuestions: GeneratedQuestionItem[] = (exam.sections || []).flatMap((sec: any) =>
          (sec.questions || []).map((q: any, idx: number) => ({
            id: q.id || `loaded_${idx}_${Math.random().toString(36).slice(2, 7)}`,
            type: q.type || "mcq",
            questionFormat: q.questionFormat || q.type || "mcq",
            questionText: q.questionText || "",
            questionImage: q.questionImage,
            marks: q.marks || 4,
            negativeMark: q.negativeMark || (exam.settings?.negativeMarking ? 1 : 0),
            options: Array.isArray(q.options) ? q.options : [],
            correctAnswer: q.correctAnswer || "",
            explanation: q.explanation || "",
            difficulty: q.difficulty || "medium",
            chapter: q.chapter || cleanName || exam.title || "General",
            pyqReference: q.pyqReference,
          }))
        )

        if (loadedQuestions.length > 0) {
          setGeneratedQuestions(loadedQuestions)
          setSelectedQuestionIds(new Set(loadedQuestions.map((q) => q.id)))
          setCurrentStep(4) // Directly land on Questions workspace!
        }
        setIsLoadingExistingExam(false)
        toast.success(`Loaded "${exam.title}" for editing`)
      })
      .catch((err) => {
        console.error("Failed to load existing exam in other-exams:", err)
        toast.error("Failed to load exam")
        setIsLoadingExistingExam(false)
      })
  }, [editExamId])

  // Filter categories by search (Step 1)
  const filteredCategories = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return EXAM_CATEGORIES
    return EXAM_CATEGORIES.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.number.includes(q)
    )
  }, [searchQuery])

  // Current category's exams list (Step 2)
  const currentCategoryExams = useMemo(() => {
    const list = CATEGORY_EXAMS[selectedCategory] || CATEGORY_EXAMS.scholarship || []
    const q = examSearchQuery.toLowerCase().trim()
    if (!q) return list
    return list.filter((e) => e.toLowerCase().includes(q))
  }, [selectedCategory, examSearchQuery])

  const selectedCategoryObj = useMemo(() => {
    return EXAM_CATEGORIES.find((c) => c.id === selectedCategory) || EXAM_CATEGORIES[0]
  }, [selectedCategory])

  const activeExamName = useMemo(() => {
    if (isCustomExam) {
      return customExamInput.trim() || "Custom Exam (Manual)"
    }
    return selectedExam || ""
  }, [isCustomExam, customExamInput, selectedExam])

  // Detected Stages for Selected Exam
  const availableStages = useMemo(() => {
    const examLower = activeExamName.toLowerCase()
    if (examLower.includes("prelims") || examLower.includes("mains") || examLower.includes("civil services")) {
      return ["Prelims", "Mains"]
    }
    if (examLower.includes("paper 1") || examLower.includes("paper 2") || examLower.includes("paper i") || examLower.includes("paper ii") || examLower.includes("ctet")) {
      return ["Paper I", "Paper II", "Paper I & II Combined"]
    }
    if (examLower.includes("tier") || examLower.includes("cgl") || examLower.includes("chsl")) {
      return ["Tier 1", "Tier 2"]
    }
    if (examLower.includes("group b") || examLower.includes("group c")) {
      return ["Combined Prelims", "Mains", "Skill Test"]
    }
    return ["Full Paper / Stage 1", "Paper I", "Paper II"]
  }, [activeExamName])

  // Auto-set first stage
  useEffect(() => {
    if (availableStages.length > 0 && !availableStages.includes(selectedStage)) {
      setSelectedStage(availableStages[0])
    }
  }, [availableStages, selectedStage])

  // Blueprint Calculations (Page 8 Summary)
  const totalQuestions = useMemo(() => {
    return blueprintFormats.reduce((acc, f) => acc + (f.checked ? Number(f.count) || 0 : 0), 0)
  }, [blueprintFormats])

  const totalCalculatedMarks = useMemo(() => {
    return blueprintFormats.reduce((acc, f) => {
      const c = f.checked ? Number(f.count) || 0 : 0
      const m = Number(f.marks) || 1
      return acc + (c * m)
    }, 0)
  }, [blueprintFormats])

  const updateFormatRow = (id: string, updates: Partial<BlueprintFormatRow>) => {
    setBlueprintFormats((prev) =>
      prev.map((row) => (row.id === id ? { ...row, ...updates } : row))
    )
  }

  // Topic chips handling
  const handleAddTopic = () => {
    if (!manualTopicInput.trim()) return
    const splitted = manualTopicInput.split(/[,]+/).map((s) => s.trim()).filter(Boolean)
    if (splitted.length > 0) {
      setSelectedTopics((prev) => Array.from(new Set([...prev, ...splitted])))
      setManualTopicInput("")
    }
  }

  const handleRemoveTopic = (topic: string) => {
    setSelectedTopics((prev) => prev.filter((t) => t !== topic))
  }

  // Syllabus PDF upload
  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setErrorMsg("Please upload a valid PDF file.")
      return
    }

    setIsUploadingPdf(true)
    setErrorMsg(null)

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
        throw new Error(data.error || "Failed to parse syllabus from PDF")
      }

      setUploadedPdf({ name: data.fileName, size: data.fileSize })
      setUploadedSyllabusText(data.extractedText || "")
      if (Array.isArray(data.detectedTopics) && data.detectedTopics.length > 0) {
        setSelectedTopics((prev) => Array.from(new Set([...prev, ...data.detectedTopics])))
      }
      toast.success("Syllabus PDF extracted successfully!")
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to read PDF file.")
    } finally {
      setIsUploadingPdf(false)
      if (pdfInputRef.current) pdfInputRef.current.value = ""
    }
  }

  // ─── AI QUESTION GENERATION (Parallel Concurrent Chunking) ───
  const handleGenerateQuestions = async () => {
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

    const defaultTitle = `${activeExamName} (${selectedStage}) - Mock Test Paper`

    const showQuestions = (questions: GeneratedQuestionItem[]) => {
      setGeneratedQuestions(questions)
      setSelectedQuestionIds(new Set(questions.map((q) => q.id)))
      setExamTitle((prev) => prev.trim() || defaultTitle)
      const calculatedTotal = questions.reduce((sum, q) => sum + (q.marks || 4), 0) || totalCalculatedMarks || 100
      setExamTotalMarks(calculatedTotal)
      setPassMarks(Math.round(calculatedTotal * 0.4))
      setCurrentStep(4)
    }

    try {
      // Build micro-batches of max 3 questions (2 for diagram) to prevent Vercel 15s timeout
      interface BatchItem {
        id: string
        formatId: string
        formatLabel: string
        count: number
        marks: number
      }

      const activeFormats = blueprintFormats.filter((f) => f.checked && Number(f.count) > 0)
      const batches: BatchItem[] = []

      for (const fmt of activeFormats) {
        let remaining = Number(fmt.count) || 0
        const marks = Number(fmt.marks) || 4
        const chunkSize = fmt.id === "diagram" ? 2 : 3
        while (remaining > 0) {
          const take = Math.min(remaining, chunkSize)
          batches.push({
            id: `${fmt.id}_${batches.length}_${Math.random().toString(36).slice(2, 6)}`,
            formatId: fmt.id,
            formatLabel: fmt.name,
            count: take,
            marks,
          })
          remaining -= take
        }
      }

      const queue = [...batches]
      let allGenerated: GeneratedQuestionItem[] = []
      const seenTexts = new Set<string>()
      let openedReview = false
      const batchErrors: string[] = []

      // Concurrency 2 ensures 2 parallel requests across rotated Gemini API keys
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
                  exam: activeExamName,
                  grade: selectedStage || "Comprehensive",
                  subject: selectedCategoryObj.title,
                  chapters: selectedTopics.length > 0 ? selectedTopics : [activeExamName],
                  topics: selectedTopics,
                  syllabusText: uploadedSyllabusText,
                  difficulty: difficultyRatio,
                  questionCount: batch.count,
                  questionPattern: "mixed",
                  blueprintFormats: [
                    {
                      id: batch.formatId,
                      label: batch.formatLabel,
                      count: batch.count,
                      marks: batch.marks,
                      checked: true,
                    },
                  ],
                  marksPerQuestion: batch.marks || 4,
                  negativeMarks: negativeMarkingEnabled ? negativeMarkPenalty : 0,
                  focusPYQ: true,
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
                const uniqueNew: GeneratedQuestionItem[] = []
                for (const q of data.questions) {
                  const norm = (q.questionText || "").toLowerCase().replace(/[^a-z0-9]/g, "")
                  if (norm && !seenTexts.has(norm)) {
                    seenTexts.add(norm)
                    uniqueNew.push({
                      ...q,
                      type: "mcq",
                      chapter: q.chapter || activeExamName,
                    })
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
                throw new Error("No questions in batch")
              }
            } catch (bErr: any) {
              retries--
              if (retries < 0) {
                console.warn("[OtherExams] Batch permanently failed:", batch.formatId, bErr.message)
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
        throw new Error(batchErrors[0] || "No questions were created. Please verify your connection and try again.")
      }

      toast.success(`Generated ${allGenerated.length} questions successfully!`)
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred while generating.")
      window.scrollTo({ top: 0, behavior: "auto" })
    } finally {
      clearTimeout(timer1)
      clearTimeout(timer2)
      setIsGenerating(false)
      setGenerationStep(0)
    }
  }

  // Generate missing questions
  const handleGenerateMissing = async () => {
    const missingCount = Math.max(0, totalQuestions - generatedQuestions.length)
    if (missingCount <= 0 || isGeneratingMissing) return

    setIsGeneratingMissing(true)
    setErrorMsg(null)
    const existingTexts = generatedQuestions.map((q) => q.questionText)

    try {
      const requestCount = Math.min(missingCount, 3)
      const res = await fetch("/api/admin/generate-competitive-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          exam: activeExamName,
          grade: selectedStage || "Comprehensive",
          subject: selectedCategoryObj.title,
          chapters: selectedTopics.length > 0 ? selectedTopics : [activeExamName],
          topics: selectedTopics,
          syllabusText: uploadedSyllabusText,
          difficulty: difficultyRatio,
          questionCount: requestCount,
          questionPattern: "mixed",
          blueprintFormats: blueprintFormats.map((f) => ({
            ...f,
            count: Math.min(Number(f.count) || 0, requestCount),
          })),
          marksPerQuestion: 4,
          negativeMarks: negativeMarkingEnabled ? negativeMarkPenalty : 0,
          focusPYQ: true,
          existingQuestions: existingTexts.slice(-30),
          stream: false,
        }),
      })

      const data = await res.json()
      if (res.ok && data.success && Array.isArray(data.questions) && data.questions.length > 0) {
        const newItems: GeneratedQuestionItem[] = data.questions.map((q: any) => ({
          ...q,
          type: "mcq" as const,
          chapter: q.chapter || activeExamName,
        }))
        const updated = [...generatedQuestions, ...newItems]
        setGeneratedQuestions(updated)
        setSelectedQuestionIds(new Set(updated.map((q) => q.id)))
        toast.success(`Generated ${data.questions.length} more question(s)! Total: ${updated.length}/${totalQuestions}`)
      } else {
        toast.error("Could not generate remaining questions.")
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to generate missing questions.")
    } finally {
      setIsGeneratingMissing(false)
    }
  }

  // Toggle selection
  const toggleQuestionSelection = (id: string) => {
    setSelectedQuestionIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleDeleteQuestion = (id: string) => {
    setGeneratedQuestions((prev) => prev.filter((q) => q.id !== id))
    setSelectedQuestionIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  const handleSaveEdit = () => {
    if (!editingQuestion) return
    setGeneratedQuestions((prev) =>
      prev.map((q) => (q.id === editingQuestion.id ? editingQuestion : q))
    )
    setEditingQuestion(null)
    toast.success("Question updated successfully")
  }

  // Format counts for filter pills in Step 4
  const formatCounts = useMemo(() => {
    const counts: Record<string, number> = { all: generatedQuestions.length }
    for (const q of generatedQuestions) {
      const f = q.questionFormat || q.type || "mcq"
      counts[f] = (counts[f] || 0) + 1
    }
    return counts
  }, [generatedQuestions])

  // Filter questions by format in Step 4
  const filteredQuestions = useMemo(() => {
    if (formatFilter === "all") return generatedQuestions
    return generatedQuestions.filter((q) => (q.questionFormat || q.type) === formatFilter)
  }, [generatedQuestions, formatFilter])

  // Step 7: Final Publish Exam
  const handlePublishExam = async () => {
    if (!examTitle.trim()) {
      setErrorMsg("Please enter an exam title.")
      setCurrentStep(5)
      return
    }

    const selectedQuestions = generatedQuestions.filter((q) => selectedQuestionIds.has(q.id))
    if (selectedQuestions.length === 0) {
      setErrorMsg("Please select at least one question to include in the exam.")
      setCurrentStep(4)
      return
    }

    setIsPublishing(true)
    setErrorMsg(null)

    try {
      const formattedStartTime = to24HourTime(startHour, startMinute, startPeriod)
      const formattedEndTime = to24HourTime(endHour, endMinute, endPeriod)
      const startDateTime = new Date(`${startDate}T${formattedStartTime}:00`)
      const endDateTime = new Date(`${endDate}T${formattedEndTime}:00`)

      const isNegativeEnabled = evalSettings.enableNegativeMarking

      // Format questions into sections for exam model
      const sections = [
        {
          name: `${activeExamName} (${selectedStage})`,
          type: "mcq",
          questionRange: `1-${selectedQuestions.length}`,
          negativeMarking: isNegativeEnabled,
          sectionNegativeMark: isNegativeEnabled ? negativeMarkPenalty : 0,
          questions: selectedQuestions.map((q, idx) => ({
            id: q.id || `q_${idx + 1}`,
            type: q.type || "mcq",
            questionFormat: q.questionFormat || "mcq",
            questionText: q.questionText,
            questionImage: q.questionImage,
            marks: q.marks || 4,
            negativeMark: isNegativeEnabled ? negativeMarkPenalty : 0,
            options: q.options || [],
            correctAnswer: q.correctAnswer,
            explanation: q.explanation,
            difficulty: q.difficulty || "medium",
            chapter: q.chapter || activeExamName,
            pyqReference: q.pyqReference,
          })),
        },
      ]

      const endpoint = editingExamId ? `/api/exams/${editingExamId}` : "/api/exams"
      const method = editingExamId ? "PUT" : "POST"

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: examTitle.trim(),
          examType: "OTHER",
          subject: selectedCategoryObj.title,
          class: selectedStage,
          duration: examDuration,
          questionsPerMin: questionsPerMinute ? Number(questionsPerMinute) : undefined,
          totalMarks: examTotalMarks || totalCalculatedMarks,
          passMarks: passMarks || Math.round((examTotalMarks || totalCalculatedMarks) * 0.4),
          description: instructionsList.join("\n"),
          instructions: instructionsList,
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
            endDate: endDateTime.toISOString(),
            startTime: formattedStartTime,
            endTime: formattedEndTime,
            isScheduled: true,
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
            shuffleQuestions: evalSettings.randomizeQuestions,
            shuffleOptions: evalSettings.randomizeQuestions,
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
      setIsPublishing(false)
    }
  }

  const handleNextStep = () => {
    if (currentStep === 1 && !selectedCategory) return
    if (currentStep === 2 && !activeExamName.trim()) return
    if (currentStep === 3) {
      handleGenerateQuestions()
      return
    }
    if (currentStep === 4 && selectedQuestionIds.size === 0) {
      setErrorMsg("Please select at least one question to proceed.")
      return
    }

    setCurrentStep((prev) => Math.min(prev + 1, STEPS.length))
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((p) => p - 1)
      window.scrollTo({ top: 0, behavior: "smooth" })
    } else {
      router.push("/admin")
    }
  }

  const handleSelectExamItem = (examName: string) => {
    setSelectedExam(examName)
    setIsCustomExam(false)
    setExamDropdownOpen(false)
    setExamSearchQuery("")
  }

  const handleSelectCustomManual = () => {
    setIsCustomExam(true)
    setSelectedExam("")
    setExamDropdownOpen(false)
  }

  if (isExamQuotaReached && !editingExamId) {
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

  if (hasOtherExamsAccess === false) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4 border border-amber-200 shadow-sm">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-[#324158] mb-2">Access Restricted</h2>
        <p className="text-gray-500 max-w-md text-sm mb-6 leading-relaxed">
          Your coaching institute does not have permission to access the Other Exams Studio. Please contact your administrator to enable this module.
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
    <div className="min-h-screen bg-[#F8FAFC] pb-8 pt-3 sm:pt-4">
      <div className="mx-auto max-w-[1400px] px-3 sm:px-8 lg:px-10">
        {/* ─── Breadcrumbs ─── */}
        <div className="flex items-center gap-1.5 text-[11px] sm:text-xs font-medium text-slate-500 mb-1.5">
          <Link href="/admin" className="hover:text-slate-900 transition-colors">
            Dashboard
          </Link>
          <span>/</span>
          <Link href="/admin/exams" className="hover:text-slate-900 transition-colors">
            Exams
          </Link>
          <span>/</span>
          <span className="text-slate-900 font-semibold">Other Exams Studio</span>
        </div>

        {/* ─── Studio Title & Badges Header ─── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3 sm:mb-4">
          <div>
            <h1 className="text-base sm:text-lg font-semibold tracking-tight text-slate-900">
              Other Competitive Exams Studio
            </h1>
            <p className="sm:hidden text-xs text-slate-500 mt-0.5">
              Step {currentStep} of {STEPS.length}: {STEPS.find((s) => s.step === currentStep)?.label}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#ECFDF5] text-[#047857] border border-[#A7F3D0] text-[11px] font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#059669]" />
              <span>13 National Sectors</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE] text-[11px] font-medium">
              <Zap className="w-3.5 h-3.5 text-[#2563EB]" />
              <span>Multi-Format AI Engine</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-medium">
              <Layers className="w-3.5 h-3.5 text-slate-600" />
              <span>Configurable Blueprint</span>
            </span>
          </div>
        </div>

        {editingExamId && (
          <div className="mb-3 px-3.5 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span>
                <strong>Editing Mode:</strong> Updating existing exam <strong>&quot;{examTitle || activeExamName}&quot;</strong>
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditingExamId(null)
                router.push("/admin/other-exams")
              }}
              className="text-amber-700 hover:text-amber-900 font-semibold underline cursor-pointer text-xs"
            >
              Cancel Edit
            </button>
          </div>
        )}

        {/* Error Notification */}
        {errorMsg && (
          <div className="mb-3.5 p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs sm:text-sm flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span className="font-medium">{errorMsg}</span>
            </div>
            <button
              onClick={() => setErrorMsg(null)}
              className="text-red-500 hover:text-red-800 font-medium p-1 cursor-pointer"
            >
              <X size={15} />
            </button>
          </div>
        )}

        {/* ─── Mobile Dedicated Stepper (sm:hidden) ─── */}
        <div className="sm:hidden mb-5 bg-white rounded-2xl border border-slate-200/80 p-3.5 shadow-xs space-y-3">
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

          {/* 7-Step Quick Action Touch Buttons */}
          <div className="grid grid-cols-7 gap-1.5 pt-0.5">
            {STEPS.map((s) => {
              const isCurrent = s.step === currentStep
              const isComplete = s.step < currentStep

              return (
                <button
                  key={s.step}
                  type="button"
                  disabled={isGenerating}
                  onClick={() => {
                    setCurrentStep(s.step)
                    window.scrollTo({ top: 0, behavior: "smooth" })
                  }}
                  className={`h-9 rounded-xl flex items-center justify-center text-xs font-medium transition-all cursor-pointer ${
                    isCurrent
                      ? "bg-primary text-white shadow-xs font-semibold ring-2 ring-primary/25"
                      : isComplete
                      ? "bg-primary/15 text-primary border border-primary/30 font-semibold"
                      : "bg-slate-50 text-slate-400 border border-slate-200/60 disabled:opacity-40"
                  }`}
                  title={s.label}
                >
                  {isComplete ? <Check className="w-3.5 h-3.5 stroke-[2.5]" /> : s.step}
                </button>
              )
            })}
          </div>
        </div>

        {/* ─── Desktop 7-Step Stepper (hidden sm:block) ─── */}
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
                      disabled={isGenerating}
                      onClick={() => {
                        setCurrentStep(s.step)
                        window.scrollTo({ top: 0, behavior: "smooth" })
                      }}
                      className={`flex items-center justify-center w-7 h-7 rounded-full text-[11px] font-medium transition-all cursor-pointer ${
                        isCurrent
                          ? "bg-primary text-white shadow-sm ring-2 ring-primary/25 ring-offset-2"
                          : isComplete
                          ? "bg-primary text-white shadow-sm"
                          : "bg-white text-slate-400 border border-slate-300 hover:border-slate-400 disabled:opacity-40"
                      }`}
                    >
                      {isComplete ? <Check className="w-3.5 h-3.5 stroke-[2.5]" /> : s.step}
                    </button>
                    <span
                      className={`mt-1 text-[10px] sm:text-[11px] font-medium transition-colors text-center whitespace-nowrap ${
                        isCurrent
                          ? "text-slate-900 font-semibold"
                          : isComplete
                          ? "text-primary font-medium"
                          : "text-slate-400"
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

        {/* ─── STEP 1: SELECT CATEGORY (13 PDF Sectors) ─── */}
        {currentStep === 1 && (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 pb-6 shadow-xs relative z-20 space-y-4 sm:space-y-5 animate-in fade-in duration-200">
            {/* Header with STEP 1 and Search Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  STEP 1
                </p>
                <h2 className="mt-0.5 text-lg sm:text-xl font-bold tracking-tight text-slate-900">
                  Select Category
                </h2>
              </div>

              {/* Search Bar */}
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search category"
                  className="w-full pl-9 pr-8 py-2 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-slate-800 focus:ring-1 focus:ring-slate-800 transition-all shadow-2xs"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Grid of 13 Categories (3 Columns) */}
            {filteredCategories.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs sm:text-sm">
                No categories found matching &quot;{searchQuery}&quot;
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
                {filteredCategories.map((cat) => {
                  const isSelected = selectedCategory === cat.id
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        setSelectedCategory(cat.id)
                        setSelectedExam("")
                        setIsCustomExam(false)
                      }}
                      className={`group relative text-center flex items-center justify-center min-h-[52px] sm:min-h-[56px] px-3.5 py-2.5 rounded-xl transition-all duration-150 cursor-pointer ${
                        isSelected
                          ? "bg-slate-50/90 border-2 border-slate-900 shadow-xs"
                          : "bg-white border border-slate-200/90 hover:border-slate-300 hover:bg-slate-50/50 shadow-2xs hover:shadow-xs"
                      }`}
                    >
                      {cat.id === "other_exams" ? (
                        <div className="text-center leading-tight py-0.5">
                          <div className={`text-[11.5px] sm:text-xs tracking-tight ${isSelected ? "text-slate-950 font-bold" : "text-slate-800 font-medium group-hover:text-slate-950"}`}>
                            Other Exams
                          </div>
                          <div className={`text-[10px] mt-0.5 ${isSelected ? "text-slate-700 font-medium" : "text-slate-500 font-normal"}`}>
                            (All Competitive Exams)
                          </div>
                        </div>
                      ) : (
                        <span
                          className={`text-[11.5px] sm:text-xs transition-colors text-center leading-snug tracking-tight ${
                            isSelected ? "text-slate-950 font-bold" : "text-slate-800 font-medium group-hover:text-slate-950"
                          }`}
                        >
                          {cat.title}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Bottom Action Bar */}
            <div className="pt-4 sm:pt-5 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={handleBack}
                className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold shadow-2xs transition-all cursor-pointer"
              >
                Back
              </button>

              <button
                type="button"
                onClick={handleNextStep}
                disabled={!selectedCategory}
                className="px-6 py-2.5 rounded-xl bg-[#1E293B] hover:bg-[#0F172A] text-white text-xs sm:text-sm font-semibold shadow-sm flex items-center gap-2 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-md"
              >
                <span>Next Step</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ─── STEP 2: SELECT EXAM (Searchable Dropdown + Stages) ─── */}
        {currentStep === 2 && (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 pb-6 shadow-xs relative z-20 space-y-4 sm:space-y-5 animate-in fade-in duration-200">
            {/* Header: Title & Selected Category Pill Badge */}
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                STEP 2
              </p>
              <h2 className="mt-0.5 text-lg sm:text-xl font-bold tracking-tight text-slate-900">
                Select Exam
              </h2>

              {/* Selected Category Pill */}
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-xs font-medium text-slate-500">Selected Category:</span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-800 text-xs font-semibold border border-slate-200">
                  <span>{selectedCategoryObj.title.replace("\n", " ")}</span>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    className="text-slate-400 hover:text-slate-800 ml-0.5 cursor-pointer"
                    title="Change category"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                </span>
              </div>
            </div>

            {/* Choose Exam Section */}
            <div className="max-w-3xl space-y-3.5 pt-0.5">
              <div className="space-y-1.5" ref={dropdownRef}>
                <label className="text-xs sm:text-sm font-semibold text-slate-900 block">
                  Choose Exam <span className="text-red-500">*</span>
                </label>

                {/* Custom Searchable Dropdown */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setExamDropdownOpen((p) => !p)}
                    className={`w-full px-4 py-2.5 sm:py-3 rounded-xl border text-left flex items-center justify-between text-xs sm:text-sm transition-all cursor-pointer bg-white ${
                      examDropdownOpen
                        ? "border-slate-900 ring-1 ring-slate-900"
                        : "border-slate-300 hover:border-slate-400"
                    }`}
                  >
                    <span className={activeExamName ? "text-slate-900 font-semibold" : "text-slate-500"}>
                      {activeExamName || "Select an exam"}
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-500 transition-transform duration-150 ${
                        examDropdownOpen ? "rotate-180 text-slate-900" : ""
                      }`}
                    />
                  </button>

                  {/* Dropdown Menu Panel (In-flow expansion so it NEVER gets cut off or hidden at the bottom) */}
                  {examDropdownOpen && (
                    <div className="mt-2 relative w-full bg-white border border-slate-200 rounded-xl shadow-lg z-30 overflow-hidden animate-in fade-in duration-150">
                      {/* Sticky Search inside dropdown */}
                      <div className="sticky top-0 p-2.5 border-b border-slate-100 bg-white z-10">
                        <div className="relative">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                          <input
                            type="text"
                            value={examSearchQuery}
                            onChange={(e) => setExamSearchQuery(e.target.value)}
                            placeholder="Search exam..."
                            autoFocus
                            className="w-full pl-8 pr-7 py-2 rounded-lg border border-slate-200 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-slate-800"
                          />
                          {examSearchQuery && (
                            <button
                              type="button"
                              onClick={() => setExamSearchQuery("")}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Scrollable Exams List with comfortable height */}
                      <div className="max-h-[220px] sm:max-h-[240px] overflow-y-auto divide-y divide-slate-50 [scrollbar-width:thin]">
                        {currentCategoryExams.length === 0 ? (
                          <div className="px-4 py-8 text-center text-xs text-slate-400">
                            No exams found matching &quot;{examSearchQuery}&quot;
                          </div>
                        ) : (
                          currentCategoryExams.map((examName) => {
                            const isItemSelected = !isCustomExam && selectedExam === examName
                            return (
                              <button
                                key={examName}
                                type="button"
                                onClick={() => handleSelectExamItem(examName)}
                                className={`w-full px-4 py-2.5 text-left text-xs sm:text-sm flex items-center justify-between transition-colors cursor-pointer ${
                                  isItemSelected
                                    ? "bg-slate-50 font-bold text-slate-950"
                                    : "text-slate-700 hover:bg-slate-50/80 hover:text-slate-900 font-medium"
                                }`}
                              >
                                <span>{examName}</span>
                                {isItemSelected && <Check className="w-4 h-4 text-slate-900 stroke-[2.5]" />}
                              </button>
                            )
                          })
                        )}
                      </div>

                      {/* Sticky Bottom Row: Type Exam Manually (Clean & NEVER cut off) */}
                      <div
                        onClick={handleSelectCustomManual}
                        className="sticky bottom-0 px-4 py-3 pb-3.5 bg-slate-50 border-t border-slate-200 hover:bg-slate-100 transition-colors cursor-pointer flex items-center justify-between z-10"
                      >
                        <div className="text-left leading-normal">
                          <div className="text-xs sm:text-sm font-semibold text-slate-900">
                            Type Exam Manually
                          </div>
                          <div className="text-[11px] text-slate-500 font-normal">
                            Can&apos;t find your exam in the list? Enter custom name
                          </div>
                        </div>
                        <span className="text-[11px] font-semibold text-slate-700 bg-white border border-slate-200 px-2.5 py-1 rounded-full shadow-2xs shrink-0 hidden sm:inline-block">
                          Custom Exam
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* If "Other (Type Exam Manually)" selected */}
                {isCustomExam && (
                  <div className="p-4 rounded-xl bg-slate-50/90 border border-slate-200/80 space-y-2 mt-3 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-800">
                        Enter Custom Examination Name:
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setIsCustomExam(false)
                          setCustomExamInput("")
                        }}
                        className="text-xs text-slate-500 hover:text-slate-800 underline cursor-pointer"
                      >
                        Choose from standard list
                      </button>
                    </div>
                    <input
                      type="text"
                      value={customExamInput}
                      onChange={(e) => setCustomExamInput(e.target.value)}
                      placeholder="e.g. KV Scholarship Test 2026, State Talent Search..."
                      autoFocus
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-800 focus:ring-1 focus:ring-slate-800 shadow-2xs"
                    />
                  </div>
                )}
              </div>

              {/* Paper / Stage Selector (from Page 8 of PDF) */}
              {activeExamName && (
                <div className="pt-2 space-y-2">
                  <label className="text-xs sm:text-sm font-semibold text-slate-900 block">
                    Paper / Stage Selector <span className="text-slate-400 text-xs font-normal">(Page 8 Blueprint Rule)</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {availableStages.map((stage) => {
                      const isStageActive = selectedStage === stage
                      return (
                        <button
                          key={stage}
                          type="button"
                          onClick={() => setSelectedStage(stage)}
                          className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                            isStageActive
                              ? "bg-[#1E293B] text-white shadow-xs font-semibold"
                              : "bg-white border border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                          }`}
                        >
                          {stage}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Action Bar */}
            <div className="pt-4 sm:pt-5 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={handleBack}
                className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold shadow-2xs transition-all cursor-pointer"
              >
                Back
              </button>

              <button
                type="button"
                onClick={handleNextStep}
                disabled={!activeExamName.trim()}
                className="px-6 py-2.5 rounded-xl bg-[#1E293B] hover:bg-[#0F172A] text-white text-xs sm:text-sm font-semibold shadow-sm flex items-center gap-2 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-md"
              >
                <span>Configure Blueprint</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ─── STEP 3: CONFIGURE QUESTION BLUEPRINT & SYLLABUS (Page 8 of PDF) ─── */}
        {currentStep === 3 && (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-7 pb-8 shadow-xs relative z-20 space-y-6 animate-in fade-in duration-200">
            {/* Header: Exam Summary & Blueprint Title */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                  STEP 3 · QUESTION BLUEPRINT & SYLLABUS
                </p>
                <h2 className="mt-1 text-base sm:text-lg font-bold tracking-tight text-slate-900">
                  Configure Syllabus Material & Question Distribution
                </h2>
                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                  <span className="text-xs text-slate-500">Target:</span>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-800 text-xs font-semibold">
                    {activeExamName}
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200/70 text-[11px] font-medium">
                    {selectedStage}
                  </span>
                </div>
              </div>

              {/* Live Metric Badges */}
              <div className="flex items-center gap-3">
                <div className="px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200/80 text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Questions</span>
                  <span className="text-base font-bold text-slate-900">{totalQuestions}</span>
                </div>
                <div className="px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200/80 text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Marks</span>
                  <span className="text-base font-bold text-slate-900">{totalCalculatedMarks}</span>
                </div>
              </div>
            </div>

            {/* Syllabus Topics & PDF Upload Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50/60 border border-slate-200/80">
              {/* Left: Custom Topics */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-900 block">
                  Specific Topics / Chapters / Notes:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={manualTopicInput}
                    onChange={(e) => setManualTopicInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === ",") {
                        e.preventDefault()
                        handleAddTopic()
                      }
                    }}
                    placeholder="Type topic & press Enter (e.g. Reasoning, Quantitative, General Science)..."
                    className="flex-1 px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-slate-800"
                  />
                  <button
                    type="button"
                    onClick={handleAddTopic}
                    className="px-3 py-2 rounded-lg bg-slate-800 text-white text-xs font-medium hover:bg-slate-900 cursor-pointer"
                  >
                    Add
                  </button>
                </div>

                {/* Topic Badges */}
                <div className="flex flex-wrap gap-1.5 pt-1 min-h-[32px]">
                  {selectedTopics.length === 0 ? (
                    <span className="text-[11px] text-slate-400 italic">No custom topics added. AI will formulate comprehensive test questions based on {activeExamName}.</span>
                  ) : (
                    selectedTopics.map((topic) => (
                      <span
                        key={topic}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-slate-200 text-slate-800 text-xs font-medium shadow-2xs"
                      >
                        <span>{topic}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveTopic(topic)}
                          className="text-slate-400 hover:text-red-500"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))
                  )}
                </div>

                {/* Quick One-Click Topic Suggestions */}
                <div className="pt-2 border-t border-slate-200/60">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1.5">
                    Quick Suggestions (Click to add):
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {[
                      "Mental Ability Test (MAT)",
                      "Scholastic Aptitude (SAT)",
                      "General Science",
                      "Mathematics & Algebra",
                      "Reasoning & Logic",
                      "Quantitative Aptitude",
                      "General Awareness & GK",
                      "Indian Polity & Governance",
                      "Modern History & Geography",
                      "English Comprehension",
                    ].map((sug) => {
                      const isAdded = selectedTopics.includes(sug)
                      return (
                        <button
                          key={sug}
                          type="button"
                          onClick={() => {
                            if (isAdded) {
                              setSelectedTopics((prev) => prev.filter((t) => t !== sug))
                            } else {
                              setSelectedTopics((prev) => [...prev, sug])
                            }
                          }}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-all cursor-pointer ${
                            isAdded
                              ? "bg-slate-900 text-white font-semibold"
                              : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                          }`}
                        >
                          {isAdded ? "✓ " : "+ "}
                          {sug}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Right: Upload Syllabus PDF */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-900 block">
                  Optional: Upload Official Syllabus PDF:
                </label>
                <input
                  ref={pdfInputRef}
                  type="file"
                  accept=".pdf"
                  onChange={handlePdfUpload}
                  className="hidden"
                  id="syllabus-pdf-upload"
                />

                {uploadedPdf ? (
                  <div className="p-3 rounded-lg bg-white border border-emerald-200 flex items-center justify-between shadow-2xs">
                    <div className="flex items-center gap-2">
                      <FileCheck2 className="w-4 h-4 text-emerald-600" />
                      <div className="overflow-hidden">
                        <span className="text-xs font-semibold text-slate-900 block truncate max-w-[200px]">
                          {uploadedPdf.name}
                        </span>
                        <span className="text-[10px] text-emerald-700">Syllabus PDF Active</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setUploadedPdf(null)
                        setUploadedSyllabusText("")
                      }}
                      className="text-slate-400 hover:text-red-600 p-1"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <label
                    htmlFor="syllabus-pdf-upload"
                    className="p-3 rounded-lg border-2 border-dashed border-slate-200 hover:border-slate-400 bg-white flex items-center justify-center gap-2 cursor-pointer transition-colors"
                  >
                    {isUploadingPdf ? (
                      <Loader2 className="w-4 h-4 animate-spin text-slate-600" />
                    ) : (
                      <Upload className="w-4 h-4 text-slate-500" />
                    )}
                    <span className="text-xs text-slate-600 font-medium">
                      {isUploadingPdf ? "Parsing syllabus PDF..." : "Upload Official Syllabus or Notification PDF"}
                    </span>
                  </label>
                )}
              </div>
            </div>

            {/* Editable Question Formats Table (12 Formats from Page 8 of PDF) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm font-semibold text-slate-900">
                  Question Format Breakdown (Page 8 Blueprint)
                </span>
                <span className="text-xs text-slate-400">
                  Select formats and specify quantities
                </span>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <table className="w-full text-left border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                      <th className="py-2.5 px-3.5 w-10 text-center">
                        <Check className="w-3.5 h-3.5 mx-auto text-slate-400" />
                      </th>
                      <th className="py-2.5 px-3">QUESTION FORMAT</th>
                      <th className="py-2.5 px-3 w-36 text-center">QUANTITY</th>
                      <th className="py-2.5 px-3 w-36 text-center">MARKS / QUES</th>
                      <th className="py-2.5 px-3.5 w-24 text-right">TOTAL</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {blueprintFormats.map((row) => {
                      const isRowActive = row.checked
                      const subtotal = isRowActive ? (Number(row.count) || 0) * (Number(row.marks) || 0) : 0

                      return (
                        <tr
                          key={row.id}
                          className={`transition-colors ${
                            isRowActive ? "bg-white" : "bg-slate-50/50 opacity-60"
                          } hover:bg-slate-50/80`}
                        >
                          <td className="py-2.5 px-3.5 text-center">
                            <input
                              type="checkbox"
                              checked={isRowActive}
                              onChange={(e) => updateFormatRow(row.id, { checked: e.target.checked })}
                              className="w-4 h-4 rounded text-slate-900 focus:ring-slate-900 cursor-pointer"
                            />
                          </td>
                          <td className="py-2.5 px-3 font-medium text-slate-800">
                            <span>{row.name}</span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <input
                              type="number"
                              min={0}
                              max={200}
                              disabled={!isRowActive}
                              value={row.count}
                              onChange={(e) =>
                                updateFormatRow(row.id, {
                                  count: Math.max(0, parseInt(e.target.value) || 0),
                                })
                              }
                              className="w-24 text-center py-1 px-2 rounded-lg border border-slate-200 bg-white font-semibold text-slate-900 text-xs sm:text-sm focus:outline-none focus:border-slate-800 disabled:bg-slate-100 disabled:cursor-not-allowed"
                            />
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <input
                              type="number"
                              min={1}
                              max={50}
                              disabled={!isRowActive}
                              value={row.marks}
                              onChange={(e) =>
                                updateFormatRow(row.id, {
                                  marks: Math.max(1, parseInt(e.target.value) || 1),
                                })
                              }
                              className="w-24 text-center py-1 px-2 rounded-lg border border-slate-200 bg-white font-semibold text-slate-900 text-xs sm:text-sm focus:outline-none focus:border-slate-800 disabled:bg-slate-100 disabled:cursor-not-allowed"
                            />
                          </td>
                          <td className="py-2.5 px-3.5 text-right font-bold text-slate-800">
                            {subtotal}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Additional Settings (Page 8 of PDF) */}
            <div className="pt-2 border-t border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Negative Marking */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">Negative Marking</span>
                  <input
                    type="checkbox"
                    checked={negativeMarkingEnabled}
                    onChange={(e) => {
                      setNegativeMarkingEnabled(e.target.checked)
                      setEvalSettings((prev) => ({ ...prev, enableNegativeMarking: e.target.checked }))
                    }}
                    className="w-4 h-4 rounded text-slate-900 focus:ring-slate-900 cursor-pointer"
                  />
                </div>
                <p className="text-[11px] text-slate-500">
                  Penalty marks for incorrect choices.
                </p>
                {negativeMarkingEnabled && (
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-xs text-slate-600 font-medium">Penalty:</span>
                    <select
                      value={negativeMarkPenalty}
                      onChange={(e) => setNegativeMarkPenalty(parseFloat(e.target.value))}
                      className="py-1 px-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-800 focus:outline-none focus:border-slate-800"
                    >
                      <option value={0.25}>-0.25 (1/4th penalty)</option>
                      <option value={0.33}>-0.33 (1/3rd penalty)</option>
                      <option value={0.5}>-0.50 (1/2 penalty)</option>
                      <option value={1}>-1.00 (Standard)</option>
                      <option value={2}>-2.00</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Difficulty Distribution */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                <span className="text-xs font-bold text-slate-800 block">Difficulty Distribution</span>
                <p className="text-[11px] text-slate-500">
                  Balanced entrance exam standard.
                </p>
                <div className="flex gap-1.5 pt-1">
                  {(["mixed", "easy", "medium", "hard"] as const).map((diff) => (
                    <button
                      key={diff}
                      type="button"
                      onClick={() => setDifficultyRatio(diff)}
                      className={`flex-1 py-1 rounded-md text-xs font-semibold capitalize transition-all cursor-pointer ${
                        difficultyRatio === diff
                          ? "bg-[#1E293B] text-white"
                          : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {diff}
                    </button>
                  ))}
                </div>
              </div>

              {/* Exam Duration */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                <span className="text-xs font-bold text-slate-800 block">Exam Duration</span>
                <p className="text-[11px] text-slate-500">
                  Total time allocated for this paper.
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  <input
                    type="number"
                    min={10}
                    max={360}
                    value={examDuration}
                    onChange={(e) => setExamDuration(parseInt(e.target.value) || 60)}
                    className="w-16 py-1 px-2 rounded-lg border border-slate-200 bg-white font-semibold text-xs text-center"
                  />
                  <span className="text-xs text-slate-600 font-medium">Minutes</span>
                </div>
              </div>
            </div>

            {/* Bottom Action Bar: Generate Button */}
            <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={handleBack}
                disabled={isGenerating}
                className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-medium shadow-2xs transition-all cursor-pointer disabled:opacity-40"
              >
                Back
              </button>

              {generatedQuestions.length > 0 ? (
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={handleGenerateQuestions}
                    disabled={isGenerating || totalQuestions === 0}
                    className="px-4 sm:px-5 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-medium shadow-2xs flex items-center gap-2 transition-all cursor-pointer disabled:opacity-40 hover:shadow-xs active:scale-[0.99]"
                    title="Re-run AI question generation with new blueprint"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                        <span>Generating ({totalQuestions})...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-amber-500" />
                        <span>Regenerate Questions ({totalQuestions})</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCurrentStep(4)
                      window.scrollTo({ top: 0, behavior: "smooth" })
                    }}
                    className="px-4 sm:px-7 py-2.5 rounded-xl bg-[#0B192C] hover:bg-[#1E293B] text-white font-medium text-xs sm:text-sm flex items-center gap-2 shadow-md transition-all cursor-pointer hover:shadow-lg active:scale-[0.99]"
                  >
                    <span>Next: View Questions ({generatedQuestions.length})</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleGenerateQuestions}
                  disabled={isGenerating || totalQuestions === 0}
                  className="px-6 py-2.5 rounded-xl bg-[#1E293B] hover:bg-[#0F172A] text-white text-xs sm:text-sm font-medium shadow-sm flex items-center gap-2 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-md"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-amber-300" />
                      <span>
                        {generationStep === 1
                          ? `Analyzing ${activeExamName} syllabus...`
                          : generationStep === 2
                          ? "Generating Parallel Batches (Fast AI)..."
                          : "Validating Questions & LaTeX solutions..."}
                      </span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-amber-300" />
                      <span>Create Questions ({totalQuestions})</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}

        {/* ─── STEP 4: QUESTIONS REVIEW & CUSTOMIZE ─── */}
        {currentStep === 4 && (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-7 pb-8 shadow-xs relative z-20 space-y-6 animate-in fade-in duration-200">
            {/* Top Header & Exam Title */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                  STEP 4 · REVIEW & CUSTOMIZE QUESTIONS
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <h2 className="text-base sm:text-lg font-bold tracking-tight text-slate-900">
                    {generatedQuestions.length} Questions Generated for {activeExamName}
                  </h2>
                  {isGenerating && <Loader2 className="w-4 h-4 animate-spin text-amber-500" />}
                </div>
              </div>

              {/* Exam Title Input */}
              <div className="flex items-center gap-2 max-w-md w-full lg:w-auto">
                <span className="text-xs font-semibold text-slate-600 shrink-0">Exam Title:</span>
                <input
                  type="text"
                  value={examTitle}
                  onChange={(e) => setExamTitle(e.target.value)}
                  placeholder="Enter exam paper title..."
                  className="w-full lg:w-80 px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50/80 text-slate-900 font-medium focus:outline-none focus:border-slate-800 focus:bg-white transition-all shadow-2xs"
                />
              </div>
            </div>

            {/* Action Bar (Toolbar) */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex flex-wrap items-center gap-2">
                {/* Select All / Deselect All Button */}
                <button
                  type="button"
                  onClick={() => {
                    if (selectedQuestionIds.size === generatedQuestions.length) {
                      setSelectedQuestionIds(new Set())
                    } else {
                      setSelectedQuestionIds(new Set(generatedQuestions.map((q) => q.id)))
                    }
                  }}
                  className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                >
                  <Check className="w-3.5 h-3.5 text-slate-500" />
                  <span>
                    {selectedQuestionIds.size === generatedQuestions.length ? "Deselect All" : "Select All"}
                  </span>
                </button>

                {/* Tweak Blueprint Button */}
                <button
                  type="button"
                  onClick={() => {
                    setCurrentStep(3)
                    window.scrollTo({ top: 0, behavior: "smooth" })
                  }}
                  className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                >
                  <Sliders className="w-3.5 h-3.5 text-slate-500" />
                  <span>Tweak Blueprint</span>
                </button>

                {/* Print for Students */}
                <button
                  type="button"
                  onClick={() => {
                    setPrintMode("student")
                    setShowPrintModal(true)
                  }}
                  className="px-3.5 py-2 rounded-xl border border-blue-200 bg-blue-50/70 hover:bg-blue-100/70 text-blue-800 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                  title="Print clean question paper for students"
                >
                  <Printer className="w-3.5 h-3.5 text-blue-600" />
                  <span>Print for Students</span>
                </button>

                {/* Print Teacher Solutions */}
                <button
                  type="button"
                  onClick={() => {
                    setPrintMode("teacher")
                    setShowPrintModal(true)
                  }}
                  className="px-3.5 py-2 rounded-xl border border-emerald-200 bg-emerald-50/70 hover:bg-emerald-100/70 text-emerald-800 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                  title="Print full answer key and step-by-step solutions"
                >
                  <FileText className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Print Teacher Solutions</span>
                </button>
              </div>

              {/* Right Side: Proceed Button */}
              <button
                type="button"
                onClick={() => {
                  setCurrentStep(5)
                  window.scrollTo({ top: 0, behavior: "smooth" })
                }}
                disabled={isGenerating || selectedQuestionIds.size === 0}
                className="px-5 py-2.5 rounded-xl bg-[#1E293B] hover:bg-[#0F172A] text-white text-xs sm:text-sm font-semibold shadow-sm flex items-center gap-2 disabled:opacity-40 cursor-pointer hover:shadow-md transition-all"
              >
                <span>Proceed to Exam Details ({selectedQuestionIds.size})</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* Format Filter Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full [scrollbar-width:none] [&::-webkit-scrollbar]:hidden flex-wrap pt-1">
              <button
                type="button"
                onClick={() => setFormatFilter("all")}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                  formatFilter === "all"
                    ? "bg-[#1E293B] text-white shadow-xs"
                    : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                All ({generatedQuestions.length})
              </button>
              {Object.entries(formatCounts)
                .filter(([k]) => k !== "all")
                .map(([fmtKey, count]) => (
                  <button
                    key={fmtKey}
                    type="button"
                    onClick={() => setFormatFilter(fmtKey)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                      formatFilter === fmtKey
                        ? "bg-[#1E293B] text-white shadow-xs"
                        : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {fmtKey.replace("_", " ").toUpperCase()} ({count})
                  </button>
                ))}
            </div>

            {/* Live Parallel AI Generation Progress Banner */}
            {isGenerating && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-xs font-medium text-slate-700 shadow-xs animate-in fade-in duration-200">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-[#1E293B] text-white flex items-center justify-center shrink-0 shadow-xs">
                    <Loader2 className="h-4 w-4 animate-spin text-amber-300" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 text-xs sm:text-sm">
                      Creating Questions in Progress ({generatedQuestions.length} of {totalQuestions} completed)...
                    </p>
                    <p className="text-[11px] text-slate-600 font-normal mt-0.5">
                      Fast AI worker pool generating questions across API keys in parallel. Incoming questions appear below in real time.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                  <div className="w-28 sm:w-36 h-2 bg-amber-200/80 rounded-full overflow-hidden">
                    <div
                      className="bg-[#1E293B] h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min(100, Math.round((generatedQuestions.length / Math.max(1, totalQuestions)) * 100))}%`,
                      }}
                    />
                  </div>
                  <span className="text-[11px] font-bold text-slate-900 tabular-nums">
                    {Math.min(100, Math.round((generatedQuestions.length / Math.max(1, totalQuestions)) * 100))}%
                  </span>
                </div>
              </div>
            )}

            {/* Top-Up Missing Questions Banner */}
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

            {/* Questions List */}
            <div className="space-y-4">
              {filteredQuestions.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-sm">
                  No questions match the current filter.
                </div>
              ) : (
                filteredQuestions.map((q, idx) => {
                  const isSelected = selectedQuestionIds.has(q.id)
                  const isExpanded = expandedSolutions.has(q.id)
                  const parsedAR = parseAssertionReason(q.questionText)
                  const qFormat = q.questionFormat || q.type || "mcq"

                  return (
                    <div
                      key={q.id}
                      className={`p-5 rounded-2xl border transition-all ${
                        isSelected
                          ? "bg-white border-slate-300 shadow-xs"
                          : "bg-slate-50/60 border-slate-200 opacity-60"
                      }`}
                    >
                      {/* Top Header of Question Card */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleQuestionSelection(q.id)}
                            className="w-4 h-4 rounded text-slate-900 focus:ring-slate-900 cursor-pointer"
                          />
                          <span className="font-bold text-xs sm:text-sm text-slate-900">
                            Q{idx + 1}
                          </span>
                          <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold uppercase border ${
                            qFormat === "assertion"
                              ? "bg-amber-50 text-amber-800 border-amber-200"
                              : qFormat === "diagram"
                              ? "bg-indigo-50 text-indigo-800 border-indigo-200"
                              : qFormat === "fib"
                              ? "bg-purple-50 text-purple-800 border-purple-200"
                              : qFormat === "true_false"
                              ? "bg-cyan-50 text-cyan-800 border-cyan-200"
                              : "bg-slate-100 text-slate-700 border-slate-200"
                          }`}>
                            {qFormat.replace("_", " ")}
                          </span>
                          <span className="text-xs text-slate-500 font-medium">
                            +{q.marks || 4} marks {negativeMarkingEnabled ? `| -${negativeMarkPenalty}` : ""}
                          </span>
                          {q.pyqReference && (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200/60 text-[10px] font-medium flex items-center gap-1">
                              <Target className="w-3 h-3 text-emerald-600" />
                              <span>{q.pyqReference}</span>
                            </span>
                          )}
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium uppercase text-[10px] tracking-wider">
                            {q.difficulty}
                          </span>
                        </div>

                        {/* Edit & Delete Action Buttons */}
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setEditingQuestion(q)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
                            title="Edit Question"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteQuestion(q.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                            title="Delete Question"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Question Text with LaTeX rendering & Assertion-Reason handling */}
                      {parsedAR ? (
                        <div className="space-y-2.5 pl-0 sm:pl-6 mb-4">
                          <div className="p-3 sm:p-4 rounded-xl bg-amber-50/40 border border-amber-200/70 text-slate-900 shadow-2xs">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-900 bg-amber-100/90 border border-amber-300/60 px-2 py-0.5 rounded shadow-2xs">
                                Assertion (A)
                              </span>
                            </div>
                            <div className="text-xs sm:text-sm font-normal leading-relaxed text-slate-800">
                              <MathRenderer content={parsedAR.assertion} />
                            </div>
                          </div>

                          <div className="p-3 sm:p-4 rounded-xl bg-purple-50/40 border border-purple-200/70 text-slate-900 shadow-2xs">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-purple-900 bg-purple-100/90 border border-purple-300/60 px-2 py-0.5 rounded shadow-2xs">
                                Reason (R)
                              </span>
                            </div>
                            <div className="text-xs sm:text-sm font-normal leading-relaxed text-slate-800">
                              <MathRenderer content={parsedAR.reason} />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs sm:text-sm text-slate-900 leading-relaxed mb-4 pl-0 sm:pl-6">
                          <MathRenderer content={q.questionText} />
                        </div>
                      )}

                      {/* Diagram Figure if exists */}
                      {q.questionImage && (
                        <div className="pl-0 sm:pl-6 mb-4 max-w-lg">
                          <QuestionDiagram src={q.questionImage} />
                        </div>
                      )}

                      {/* Options Grid */}
                      {Array.isArray(q.options) && q.options.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-0 sm:pl-6 mb-3">
                          {q.options.map((opt, oi) => {
                            const isCorrect = opt === q.correctAnswer
                            const optLetter = ["A", "B", "C", "D"][oi] || `${oi + 1}`

                            return (
                              <div
                                key={oi}
                                className={`p-3 rounded-xl border text-xs sm:text-sm flex items-start justify-between gap-2.5 transition-all ${
                                  isCorrect
                                    ? "bg-emerald-50/70 border-emerald-300 text-emerald-950 font-semibold"
                                    : "bg-slate-50/60 border-slate-200 text-slate-700"
                                }`}
                              >
                                <div className="flex items-start gap-2.5 flex-1">
                                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] shrink-0 font-bold ${
                                    isCorrect ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-700"
                                  }`}>
                                    {optLetter}
                                  </span>
                                  <div className="flex-1 leading-snug">
                                    <MathRenderer content={opt} />
                                  </div>
                                </div>
                                {isCorrect && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />}
                              </div>
                            )
                          })}
                        </div>
                      )}

                      {/* Expandable Explanation Drawer */}
                      <div className="pl-0 sm:pl-6 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                        <button
                          type="button"
                          onClick={() => {
                            setExpandedSolutions((prev) => {
                              const next = new Set(prev)
                              if (next.has(q.id)) next.delete(q.id)
                              else next.add(q.id)
                              return next
                            })
                          }}
                          className="text-slate-600 hover:text-slate-900 font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <span>{isExpanded ? "Hide Solution" : "View Step-by-Step Solution"}</span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                      </div>

                      {isExpanded && (
                        <div className="mt-3 ml-0 sm:ml-6 p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 leading-relaxed space-y-1">
                          <p className="font-bold text-slate-900">Explanation & Derivation:</p>
                          <MathRenderer content={q.explanation || "No explanation provided."} />
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>

            {/* Bottom Action Bar */}
            <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={handleBack}
                className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-medium shadow-2xs transition-all cursor-pointer"
              >
                Back to Blueprint
              </button>

              <button
                type="button"
                onClick={() => {
                  setCurrentStep(5)
                  window.scrollTo({ top: 0, behavior: "smooth" })
                }}
                disabled={selectedQuestionIds.size === 0}
                className="px-6 py-2.5 rounded-xl bg-[#1E293B] hover:bg-[#0F172A] text-white text-xs sm:text-sm font-medium shadow-sm flex items-center gap-2 transition-all cursor-pointer disabled:opacity-40"
              >
                <span>Proceed to Exam Details ({selectedQuestionIds.size})</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ─── STEP 5: EXAM DETAILS & OVERVIEW (MATCHES COMPETITIVE STEP 4 100%) ─── */}
        {currentStep === 5 && (
          <div className="space-y-6 animate-in fade-in duration-200">
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
                        value={examTitle}
                        onChange={(e) => setExamTitle(e.target.value)}
                        placeholder="e.g. NMMS (National Means-cum-Merit Scholarship) - Mock Paper 1"
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
                          value={examDuration}
                          onChange={(e) => setExamDuration(Number(e.target.value) || 0)}
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
                        {instructionsList.map((inst, idx) => (
                          <div key={idx} className="flex items-start gap-2.5 group">
                            <span className="text-xs sm:text-sm font-normal text-slate-500 shrink-0 mt-0.5">
                              {idx + 1}.
                            </span>
                            <input
                              type="text"
                              value={inst}
                              onChange={(e) => {
                                const next = [...instructionsList]
                                next[idx] = e.target.value
                                setInstructionsList(next)
                              }}
                              className="w-full bg-transparent border-0 border-b border-transparent hover:border-slate-200 focus:border-slate-400 px-1 py-0.5 text-xs sm:text-sm font-normal text-slate-700 focus:outline-none transition-colors"
                            />
                            {instructionsList.length > 1 && (
                              <button
                                type="button"
                                onClick={() => setInstructionsList((prev) => prev.filter((_, i) => i !== idx))}
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
                          onClick={() => setInstructionsList((prev) => [...prev, "New guideline for learners."])}
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
                        {activeExamName}
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 sm:gap-4 py-1.5 border-b border-slate-100/80">
                      <span className="text-xs font-normal text-slate-500 w-auto sm:w-36 shrink-0">
                        Category
                      </span>
                      <span className="text-xs font-medium text-slate-800 text-left sm:text-right break-words">
                        {selectedCategoryObj.title.replace("\n", " ")}
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 sm:gap-4 py-1.5 border-b border-slate-100/80">
                      <span className="text-xs font-normal text-slate-500 w-auto sm:w-36 shrink-0">
                        Stage / Paper
                      </span>
                      <span className="text-xs font-medium text-slate-800 text-left sm:text-right break-words">
                        {selectedStage}
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 sm:gap-4 py-1.5 border-b border-slate-100/80">
                      <span className="text-xs font-normal text-slate-500 w-auto sm:w-36 shrink-0">
                        Topics / Syllabus
                      </span>
                      <span className="text-xs font-medium text-slate-800 text-left sm:text-right break-words">
                        {selectedTopics.length > 0 ? selectedTopics.join(", ") : "Comprehensive Syllabus"}
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 sm:gap-4 py-1.5 border-b border-slate-100/80">
                      <span className="text-xs font-normal text-slate-500 w-auto sm:w-36 shrink-0">
                        Question Format
                      </span>
                      <span className="text-xs font-medium text-slate-800 text-left sm:text-right break-words">
                        {blueprintFormats.filter((f) => f.checked && Number(f.count) > 0).map((f) => `${f.name} (${f.count})`).join(", ") || "Standard MCQ"}
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 sm:gap-4 py-1.5">
                      <span className="text-xs font-normal text-slate-500 w-auto sm:w-36 shrink-0">
                        Difficulty Level
                      </span>
                      <span className="text-xs font-medium text-slate-800 text-left sm:text-right break-words">
                        {difficultyRatio.toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bottom Summary Stats Strip */}
                <div className="mt-8 rounded-2xl bg-slate-50 border border-slate-200/80 p-3.5 sm:p-5 grid grid-cols-3 divide-x divide-slate-200">
                  <div className="text-center px-1 sm:px-2">
                    <p className="text-[10px] sm:text-[11px] font-normal text-slate-500 mb-0.5">Duration</p>
                    <p className="text-sm sm:text-base font-medium text-slate-800">
                      {examDuration} <span className="text-[10px] sm:text-xs font-normal text-slate-500">min</span>
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

            {/* Bottom Action Bar */}
            <div className="pt-2 flex items-center justify-between">
              <button
                type="button"
                onClick={handleBack}
                className="px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer shadow-2xs hover:shadow-xs"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Questions</span>
              </button>

              <button
                type="button"
                onClick={handleNextStep}
                disabled={!examTitle.trim()}
                className="px-4 sm:px-7 py-2.5 sm:py-3 rounded-xl bg-[#0B192C] hover:bg-[#1E293B] text-white font-medium text-xs sm:text-sm flex items-center gap-2 shadow-md transition-all cursor-pointer hover:shadow-lg active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span>Next: Settings</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ─── STEP 6: SETTINGS (SCHEDULE & EVALUATION & PROCTORING) ─── */}
        {currentStep === 6 && (
          <div className="space-y-6 animate-in fade-in duration-200">
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
                            setEvalSettings((prev) => {
                              const val = !prev.enableNegativeMarking
                              setNegativeMarkingEnabled(val)
                              return { ...prev, enableNegativeMarking: val }
                            })
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

            {/* Bottom Action Bar */}
            <div className="pt-2 flex items-center justify-between">
              <button
                type="button"
                onClick={handleBack}
                className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-medium shadow-2xs transition-all cursor-pointer"
              >
                Back to Details
              </button>

              <button
                type="button"
                onClick={handleNextStep}
                className="px-4 sm:px-7 py-2.5 sm:py-3 rounded-xl bg-[#0B192C] hover:bg-[#1E293B] text-white font-medium text-xs sm:text-sm flex items-center gap-2 shadow-md transition-all cursor-pointer hover:shadow-lg active:scale-[0.99]"
              >
                <span>Next: Publish</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ─── STEP 7: FINAL REVIEW & PUBLISH ─── */}
        {currentStep === 7 && (
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 p-6 sm:p-10 shadow-xs relative z-20 space-y-6 animate-in fade-in duration-200">
            <div className="mb-5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                STEP 7 · FINAL PUBLISH
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
                  {examTitle}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5 font-normal">
                  {activeExamName} • {selectedStage}
                </p>
              </div>

              <div className="p-4 rounded-2xl border border-slate-200/90 bg-white">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-1.5">
                  QUESTIONS &amp; MARKS
                </span>
                <p className="text-xs sm:text-sm font-bold text-slate-900">
                  {selectedQuestionIds.size} Questions
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5 font-normal">
                  {examTotalMarks} Marks • {examDuration} min
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
                onClick={handleBack}
                disabled={isPublishing}
                className="px-5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 font-semibold text-xs shadow-2xs transition-all cursor-pointer disabled:opacity-40"
              >
                Back
              </button>

              <button
                type="button"
                onClick={handlePublishExam}
                disabled={isPublishing || selectedQuestionIds.size === 0}
                className="px-5 py-2 rounded-xl bg-[#0B192C] hover:bg-[#1E293B] text-white font-semibold text-xs shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-md active:scale-[0.99]"
              >
                {isPublishing ? (
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

        {/* ─── INLINE EDIT MODAL ─── */}
        {editingQuestion && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
            <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-900">Edit Question</h3>
                <button onClick={() => setEditingQuestion(null)} className="text-slate-400 hover:text-slate-700">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-900 block mb-1">Question Statement:</label>
                <textarea
                  rows={3}
                  value={editingQuestion.questionText}
                  onChange={(e) => setEditingQuestion({ ...editingQuestion, questionText: e.target.value })}
                  className="w-full p-2.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-slate-800"
                />
              </div>

              {/* Options */}
              {Array.isArray(editingQuestion.options) && (
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-900 block">Options:</label>
                  {editingQuestion.options.map((opt, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-5 text-xs font-bold text-slate-500">{["A", "B", "C", "D"][i] || i + 1}:</span>
                      <input
                        type="text"
                        value={opt}
                        onChange={(e) => {
                          const updated = [...editingQuestion.options]
                          updated[i] = e.target.value
                          setEditingQuestion({ ...editingQuestion, options: updated })
                        }}
                        className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200"
                      />
                    </div>
                  ))}
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-slate-900 block mb-1">Correct Answer:</label>
                <input
                  type="text"
                  value={editingQuestion.correctAnswer}
                  onChange={(e) => setEditingQuestion({ ...editingQuestion, correctAnswer: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-900 block mb-1">Explanation:</label>
                <textarea
                  rows={2}
                  value={editingQuestion.explanation}
                  onChange={(e) => setEditingQuestion({ ...editingQuestion, explanation: e.target.value })}
                  className="w-full p-2.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-slate-800"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingQuestion(null)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  className="px-5 py-2 rounded-lg bg-[#1E293B] text-white text-xs font-semibold shadow-sm"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── PRINTABLE EXAM PAPER MODAL ─── */}
        {showPrintModal && (
          <PrintableExamPaper
            isOpen={showPrintModal}
            onClose={() => setShowPrintModal(false)}
            questions={(
              selectedQuestionIds.size > 0 && selectedQuestionIds.size < generatedQuestions.length
                ? generatedQuestions.filter((q) => selectedQuestionIds.has(q.id))
                : generatedQuestions
            ).map((q) => ({
              ...q,
              type: "mcq" as const,
              chapter: q.chapter || activeExamName,
            }))}
            examTitle={examTitle || activeExamName}
            subject={selectedCategoryObj.title}
            examTarget={activeExamName as any}
            grade={selectedStage as any}
            durationMinutes={examDuration}
            defaultMode={printMode}
          />
        )}
      </div>
    </div>
  )
}

export default function OtherExamsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F5F6FA] flex items-center justify-center">
          <div className="flex items-center gap-3 text-gray-500">
            <Loader2 className="animate-spin text-slate-700" size={24} />
            <span className="text-sm font-medium">Loading Other Exams Studio...</span>
          </div>
        </div>
      }
    >
      <OtherExamsContent />
    </Suspense>
  )
}
