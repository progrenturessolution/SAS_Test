"use client"

import { useState, useEffect, useCallback, use, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Editor from "@monaco-editor/react"
import { ExamHeader, ProctoringCamera, QuestionStatus, statusColorMap, ProcrentureLogo } from "@/components/exam/ExamShared"
import { Code, Shield, AlertCircle, FileText, Clock, CheckCircle2, Monitor, Wifi, Camera, Info, Play, ChevronLeft, ChevronRight, Sparkles, LayoutGrid, Layers, ArrowRight, HelpCircle, BookOpen, Calculator, CheckSquare, Check, X } from "lucide-react"
import { ScientificCalculator } from "@/components/exam/ScientificCalculator"
import { ProctoringWarning } from "@/components/exam/ProctoringWarning"
import { useProctoring } from "@/hooks/use-proctoring"
import { ExamTakingSkeleton } from "@/components/SkeletonLoaders"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { getExamStartDateTime, getExamEndDateTime, formatCountdown, formatScheduleDateTime } from "@/lib/examSchedule"
import { MathRenderer } from "@/components/exam/MathRenderer"
import { QuestionDiagram } from "@/components/exam/QuestionDiagram"
import { ExamSubmitModal } from "@/components/exam/ExamSubmitModal"

// ─── Micro-toast types ────────────────────────────────────────────────────────
interface Toast { id: number; message: string; type: "warn" | "info" | "danger" }
let _toastId = 0

// ─── Assertion & Question Category Helpers ────────────────────────────────────
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

export function getQuestionCategory(q: any): "mcq" | "diagram" | "assertion" | "fillblanks" | "truefalse" | "descriptive" | "coding" | "mcq_multi" {
  if (!q) return "mcq"
  if (
    q.questionFormat === "assertion" ||
    q.questionFormat === "assertion_reason" ||
    q.type === "assertion" ||
    Boolean(parseAssertionReason(q.questionText || ""))
  ) {
    return "assertion"
  }
  if (q.type === "coding") return "coding"
  if (
    q.type === "fillblanks" ||
    q.questionFormat === "fib" ||
    q.questionFormat === "fill_in_the_blanks" ||
    q.questionFormat === "fillblanks" ||
    (Array.isArray(q.blanks) && q.blanks.length > 0) ||
    (typeof q.questionText === "string" && (
      q.questionText.includes("______") ||
      /_{2,}/.test(q.questionText) ||
      q.questionText.toLowerCase().includes("fill in the blank") ||
      q.questionText.toLowerCase().includes("fill in the blanks")
    ))
  ) {
    return "fillblanks"
  }
  if (
    q.type === "truefalse" ||
    q.questionFormat === "true_false" ||
    q.questionText?.toLowerCase().startsWith("true or false") ||
    q.questionText?.toLowerCase().startsWith("true/false") ||
    (Array.isArray(q.options) && q.options.length === 2 && q.options.some((o: string) => String(o).toLowerCase() === "true"))
  ) {
    return "truefalse"
  }
  if (
    q.questionFormat === "diagram" ||
    Boolean(q.questionImage && String(q.questionImage).includes("<svg"))
  ) {
    return "diagram"
  }
  if (q.type === "descriptive") return "descriptive"
  if (
    q.type === "mcq_multi" ||
    q.questionFormat === "mcq_multi" ||
    q.questionFormat === "mcq_multiple" ||
    (Array.isArray(q.correctAnswer) && q.correctAnswer.length > 1)
  ) {
    return "mcq_multi"
  }
  return "mcq"
}

export function getCategoryMeta(category: string) {
  const activeTabColor = "bg-[#2D3A4A] text-white"
  switch (category) {
    case "mcq_multi":
      return {
        label: "MCQ (Multiple Correct)",
        shortLabel: "Multi Correct",
        badgeBg: "bg-violet-50 text-violet-700 border-violet-200",
        activeTabBg: activeTabColor,
        dotColor: "bg-violet-500",
      }
    case "diagram":
      return {
        label: "Diagram Based Questions",
        shortLabel: "Diagram",
        badgeBg: "bg-indigo-50 text-indigo-700 border-indigo-200",
        activeTabBg: activeTabColor,
        dotColor: "bg-indigo-500",
      }
    case "assertion":
      return {
        label: "Assertion & Reason",
        shortLabel: "Assertion",
        badgeBg: "bg-purple-50 text-purple-700 border-purple-200",
        activeTabBg: activeTabColor,
        dotColor: "bg-purple-500",
      }
    case "fillblanks":
      return {
        label: "Fill in the Blanks",
        shortLabel: "Fill Blanks",
        badgeBg: "bg-amber-50 text-amber-700 border-amber-200",
        activeTabBg: activeTabColor,
        dotColor: "bg-amber-500",
      }
    case "truefalse":
      return {
        label: "True / False",
        shortLabel: "True/False",
        badgeBg: "bg-teal-50 text-teal-700 border-teal-200",
        activeTabBg: activeTabColor,
        dotColor: "bg-teal-500",
      }
    case "descriptive":
      return {
        label: "Descriptive Questions",
        shortLabel: "Descriptive",
        badgeBg: "bg-rose-50 text-rose-700 border-rose-200",
        activeTabBg: activeTabColor,
        dotColor: "bg-rose-500",
      }
    case "coding":
      return {
        label: "Coding Challenges",
        shortLabel: "Coding",
        badgeBg: "bg-emerald-50 text-emerald-700 border-emerald-200",
        activeTabBg: activeTabColor,
        dotColor: "bg-emerald-500",
      }
    case "mcq":
    default:
      return {
        label: "Multiple Choice Questions",
        shortLabel: "MCQ",
        badgeBg: "bg-blue-50 text-blue-700 border-blue-200",
        activeTabBg: activeTabColor,
        dotColor: "bg-blue-500",
      }
  }
}

interface Question {
  _id: string
  type: "mcq" | "truefalse" | "descriptive" | "fillblanks" | "coding"
  questionFormat?: string
  negativeMark?: number
  questionText: string
  questionImage?: string
  codeSnippet?: string
  options?: string[]
  optionImages?: string[]
  marks: number
  difficulty?: string
  wordLimit?: number
  blanks?: { id: number; label: string; answer: string }[]
  codeTemplate?: string
  testCases?: { input: string; expectedOutput: string; hidden?: boolean }[]
  constraints?: string[]
  timeLimit?: number
  memoryLimit?: number
  scoringMode?: "all" | "partial"
  codeTemplates?: Record<string, string>
  driverCode?: Record<string, string>
  languages?: string[]
  shuffledOptionIndices?: number[]
}

interface Section {
  name: string
  type: string
  questionRange: string
  questions: Question[]
}

interface ExamData {
  _id: string
  title: string
  subject: string
  duration: number
  minDuration?: number
  totalMarks: number
  passMarks: number
  sections: Section[]
  settings?: { 
    randomize?: boolean; 
    startDate?: string | Date;
    startTime?: string;
    endDate?: string | Date;
    endTime?: string;
    showResults?: boolean;
    allowReview?: boolean;
    negativeMarking?: boolean;
    allowCalculator?: boolean;
    enableCalculator?: boolean;
    minDuration?: number;
    proctoring?: {
      enabled?: boolean;
      faceDetection?: boolean;
      tabSwitch?: boolean;
      fullscreenExit?: boolean;
      fullscreen?: boolean;
      maxWarnings?: number;
      aiProctoring?: boolean;
    }
  }
  instructions?: string[]
  institute?: {
    name: string
    code?: string
    logo?: string | null
    themeColor?: string
  }
  proctoring: {
    enabled: boolean
    faceDetection: boolean
    tabSwitch: boolean
    fullscreenExit: boolean
    maxWarnings: number
  }
}

interface Answer {
  questionId: string
  sectionType: string
  answer: string | string[]
  isMarkedForReview?: boolean
}

export default function ExamTakePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const searchParams = useSearchParams()
  const attemptId = searchParams.get("attemptId")
  const router = useRouter()

  const [exam, setExam] = useState<ExamData | null>(null)
  const [loading, setLoading] = useState(true)
  const [agreed, setAgreed] = useState(false)
  const [timeLeft, setTimeLeft] = useState(0)
  const [currentSection, setCurrentSection] = useState(0)
  const [activeSectionId, setActiveSectionId] = useState<string>("")
  const [sectionPosMap, setSectionPosMap] = useState<Record<string, number>>({})
  const [visitedQuestionIds, setVisitedQuestionIds] = useState<string[]>([])
  const [currentQ, setCurrentQ] = useState(0)
  const [answers, setAnswers] = useState<Answer[]>([])
  const [activeWarning, setActiveWarning] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [examSubmitted, setExamSubmitted] = useState(false)
  const [studentName, setStudentName] = useState("Aspirant")
  const [studentRoll, setStudentRoll] = useState("N/A")
  // Fill-in-blank per-blank input state: map of questionId -> blank answers array
  const [blankInputs, setBlankInputs] = useState<Record<string, string[]>>({})
  // Toasts for micro-notifications
  const [toasts, setToasts] = useState<Toast[]>([])
  const [stateRestored, setStateRestored] = useState(false)
  const [serverStateLoaded, setServerStateLoaded] = useState(false)
  const [initialWarnings, setInitialWarnings] = useState(0)
  // Coding runner state
  const [codeLanguage, setCodeLanguage] = useState<Record<string, string>>({})
  const [codeRunning, setCodeRunning] = useState<Record<string, boolean>>({})
  const [codeOutput, setCodeOutput] = useState<Record<string, any>>({})
  // LeetCode-style test case results
  type TCResult = { caseIndex: number; input: string | null; expectedOutput: string | null; actualOutput: string | null; stderr: string | null; passed: boolean; hidden: boolean; status: string; time: string | null; memory: number | null }
  const [testCaseResults, setTestCaseResults] = useState<Record<string, TCResult[]>>({})
  const [activeTestCase, setActiveTestCase] = useState<Record<string, number>>({})
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showCodingDescription, setShowCodingDescription] = useState(true)
  const [codeSubmitted, setCodeSubmitted] = useState<Record<string, boolean>>({})
  const [testCaseRunning, setTestCaseRunning] = useState<Record<string, boolean>>({})
  // For Monaco Editor Stability
  const [editorReady, setEditorReady] = useState<Record<string, boolean>>({})
  
  // Timer for scheduled exam start
  const [countdownTime, setCountdownTime] = useState<number | null>(null)
  const [showStartModal, setShowStartModal] = useState(false)
  const [scheduleStartReached, setScheduleStartReached] = useState(true) // Default to true so button is enabled if no scheduled start
  const [isExamEnded, setIsExamEnded] = useState(false)
  const [isStarted, setIsStarted] = useState(false)
  const [camStatus, setCamStatus] = useState<"loading" | "active" | "denied" | "error">("loading")
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false)
  const [showMobileSidebar, setShowMobileSidebar] = useState(false) // Mobile sidebar toggle
  const [showCalculator, setShowCalculator] = useState(false)
  const [showInstructionsModal, setShowInstructionsModal] = useState(false)
  const instituteThemeColor = exam?.institute?.themeColor || "#2D3A4A"

  // Sync theme color with CSS variable
  useEffect(() => {
    if (exam?.institute?.themeColor) {
      document.documentElement.style.setProperty("--primary", exam.institute.themeColor)
      document.documentElement.style.setProperty("--brand-theme", exam.institute.themeColor)
    }
    return () => {
      document.documentElement.style.removeProperty("--primary")
      document.documentElement.style.removeProperty("--brand-theme")
    }
  }, [exam?.institute?.themeColor])

  const addToast = useCallback((message: string, type: Toast["type"] = "warn") => {
    const id = ++_toastId
    setToasts((p) => [...p, { id, message, type }])
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 3000)
  }, [])

  // Save exam state to localStorage
  const saveExamState = useCallback(() => {
    if (!attemptId) return
    const examState = {
      attemptId,
      examId: id,
      activeSectionId,
      currentSection,
      sectionPosMap,
      visitedQuestionIds,
      currentQ,
      answers,
      blankInputs,
      timeLeft,
      codeLanguage,
      timestamp: Date.now(),
    }
    try {
      localStorage.setItem(`exam-state-${id}`, JSON.stringify(examState))
    } catch (e) {
      console.error("Failed to save exam state:", e)
    }
  }, [attemptId, id, activeSectionId, currentSection, sectionPosMap, visitedQuestionIds, currentQ, answers, blankInputs, timeLeft, codeLanguage])

  // Restore exam state from localStorage + Server merging
  const restoreExamState = useCallback((serverAttempt?: any) => {
    try {
      const saved = localStorage.getItem(`exam-state-${id}`)
      let localState = null
      if (saved) {
        localState = JSON.parse(saved)
        if (localState.attemptId !== attemptId) localState = null
      }

      // 1. Restore Answers (prioritize local state as most recent)
      const serverAnswers = serverAttempt?.answers || []
      const localAnswers = localState?.answers || []
      const mergedAnswers = [...serverAnswers]
      localAnswers.forEach((la: Answer) => {
        const idx = mergedAnswers.findIndex(sa => sa.questionId === la.questionId)
        if (idx >= 0) mergedAnswers[idx] = la
        else mergedAnswers.push(la)
      })
      setAnswers(mergedAnswers)
      
      // 2. Restore Timer (Prioritize local state, then server, then full duration)
      const scheduledEnd = getExamEndDateTime(exam?.settings)
      const secondsUntilEnd = scheduledEnd ? Math.max(0, Math.floor((scheduledEnd.getTime() - Date.now()) / 1000)) : null
      const capWithScheduledEnd = (t: number) => (secondsUntilEnd !== null ? Math.min(t, secondsUntilEnd) : t)

      if (localState?.timeLeft !== undefined) {
        setTimeLeft(capWithScheduledEnd(localState.timeLeft))
      } else if (serverAttempt?.timeLeft !== undefined) {
        setTimeLeft(capWithScheduledEnd(serverAttempt.timeLeft))
      }
      
      // 3. Restore Warnings
      if (serverAttempt?.proctoring?.warnings !== undefined) {
        setInitialWarnings(serverAttempt.proctoring.warnings)
      }

      // 4. Other UI states
      if (localState) {
        if (localState.activeSectionId) setActiveSectionId(localState.activeSectionId)
        if (localState.sectionPosMap) setSectionPosMap(localState.sectionPosMap)
        if (localState.visitedQuestionIds) setVisitedQuestionIds(localState.visitedQuestionIds)
        setCurrentSection(localState.currentSection ?? 0)
        setCurrentQ(localState.currentQ ?? 0)
        setBlankInputs(localState.blankInputs || {})
        setCodeLanguage(localState.codeLanguage || {})
      }
      
      setStateRestored(true)
      setServerStateLoaded(true)
      
      // Show notification only if there's actual restored data
      if ((localState?.answers?.length || 0) > 0 || (serverAnswers.length || 0) > 0) {
        addToast("Your previous progress has been restored", "info")
      }
      return true
    } catch (e) {
      console.error("Failed to restore exam state:", e)
      setStateRestored(true)
      setServerStateLoaded(true)
    }
    return false
  }, [id, attemptId, addToast])

  const runCode = async (qId: string, code: string) => {
    const lang = codeLanguage[qId] || "python"
    setCodeRunning((p) => ({ ...p, [qId]: true }))
    setCodeOutput((p) => ({ ...p, [qId]: null }))
    try {
      const res = await fetch("/api/code/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, language: lang }),
      })
      const data = await res.json()
      setCodeOutput((p) => ({ ...p, [qId]: data }))
    } catch {
      setCodeOutput((p) => ({ ...p, [qId]: { stdout: "", stderr: "Network error — could not reach execution service.", compile_output: "", exit_code: 1 } }))
    } finally {
      setCodeRunning((p) => ({ ...p, [qId]: false }))
    }
  }
  // Load exam
  useEffect(() => {
    if (!attemptId) { router.push(`/exam/${id}`); return }
    Promise.all([
      fetch(`/api/exams/${id}`).then((r) => r.json()),
      fetch(`/api/attempts/${attemptId}`).then((r) => r.json()),
    ])
      .then(([examRes, attemptRes]) => {
        if (!examRes.exam || examRes.exam.status !== "active") { 
          router.push(`/exam/${id}`)
          return 
        }
        // 1. Check if already submitted
        const attempt = attemptRes.attempt || attemptRes
        if (attempt && (attempt.status === "submitted" || attempt.status === "auto-submitted" || attempt.status === "graded")) {
          router.push(`/exam/${id}/result?attemptId=${attemptId}`)
          return
        }

        const examData: ExamData = examRes.exam
        
        // Optionally randomize questions and options per section
        if (examData.settings?.randomize) {
          // Use attemptId as a crude seed to ensure the same order on refresh
          const seed = attemptId ? parseInt(attemptId.slice(-6), 16) : Math.random()
          
          const seededRandom = (s: number) => {
            let mask = 0xffffffff
            let m_w = (123456789 + s) & mask
            let m_z = (987654321 - s) & mask
            return () => {
              m_z = (36969 * (m_z & 65535) + (m_z >> 16)) & mask
              m_w = (18000 * (m_w & 65535) + (m_w >> 16)) & mask
              let result = ((m_z << 16) + (m_w & 65535)) >>> 0
              return result / 4294967296
            }
          }

          const rng = seededRandom(seed)
          
          examData.sections = examData.sections.map((sec) => ({
            ...sec,
            questions: [...sec.questions]
              .map(q => {
                // Also shuffle options for multiple choice questions if randomization is on
                if ((q.type === "mcq" || (q as any).type === "mcq_multi") && q.options && q.options.length > 0) {
                  const indices = q.options.map((_, i) => i)
                  const shuffledOptionIndices = [...indices].sort(() => rng() - 0.5)
                  return {
                    ...q,
                    shuffledOptionIndices
                  }
                }
                return q
              })
              .sort(() => rng() - 0.5),
          }))
        }
        setExam(examData)
        if (examData?.institute?.themeColor) {
          document.documentElement.style.setProperty("--primary", examData.institute.themeColor)
        }

        let initialSection = 0
        const firstValidSection = examData.sections.findIndex((sec: any) => sec.questions.some((q: any) => q.type !== "coding"))
        if (firstValidSection !== -1) {
          initialSection = firstValidSection
        } else {
          const hasCoding = examData.sections.some((sec: any) => sec.questions.some((q: any) => q.type === "coding"))
          if (hasCoding) {
            initialSection = -2
          }
        }
        
        // Load student info from attempt
        if (attempt) {
          setStudentName(attempt.studentName || "Aspirant")
          setStudentRoll(attempt.rollNumber || "N/A")
        }
        
        // Restore exam state from localStorage/Server AFTER setting exam
        const scheduledEnd = getExamEndDateTime(examData.settings)
        const secondsUntilEnd = scheduledEnd ? Math.max(0, Math.floor((scheduledEnd.getTime() - Date.now()) / 1000)) : null
        const capWithScheduledEnd = (t: number) => (secondsUntilEnd !== null ? Math.min(t, secondsUntilEnd) : t)

        try {
          const lsRaw = localStorage.getItem(`exam-state-${id}`)
          let localState = null
          if (lsRaw) {
            localState = JSON.parse(lsRaw)
            if (localState.attemptId === attemptId) {
              // Restore from localStorage
              setAnswers(localState.answers || [])
              if (localState.timeLeft !== undefined) {
                setTimeLeft(capWithScheduledEnd(localState.timeLeft))
              } else {
                setTimeLeft(capWithScheduledEnd(examData.duration * 60))
              }
              setCurrentSection(localState.currentSection ?? initialSection)
              if (localState.activeSectionId) setActiveSectionId(localState.activeSectionId)
              if (localState.sectionPosMap) setSectionPosMap(localState.sectionPosMap)
              if (localState.visitedQuestionIds) setVisitedQuestionIds(localState.visitedQuestionIds)
              setCurrentQ(localState.currentQ ?? 0)
              setBlankInputs(localState.blankInputs || {})
              setCodeLanguage(localState.codeLanguage || {})
              if (localState.answers?.length > 0) {
                addToast("Your previous progress has been restored", "info")
              }
            } else {
              // localStorage state is from different attempt, use server data
              if (attempt?.timeLeft !== undefined) {
                setTimeLeft(capWithScheduledEnd(attempt.timeLeft))
              } else {
                setTimeLeft(capWithScheduledEnd(examData.duration * 60))
              }
              if (attempt?.answers) setAnswers(attempt.answers)
              setCurrentSection(initialSection)
            }
          } else {
            // No localStorage, use server data
            if (attempt?.timeLeft !== undefined) {
              setTimeLeft(capWithScheduledEnd(attempt.timeLeft))
            } else {
              setTimeLeft(capWithScheduledEnd(examData.duration * 60))
            }
            if (attempt?.answers) setAnswers(attempt.answers)
            setCurrentSection(initialSection)
          }
        } catch(e) {
          console.error("Failed to restore state:", e)
          // Fallback to server data
          if (attempt?.timeLeft !== undefined) {
            setTimeLeft(capWithScheduledEnd(attempt.timeLeft))
          } else {
            setTimeLeft(capWithScheduledEnd(examData.duration * 60))
          }
          if (attempt?.answers) setAnswers(attempt.answers)
          setCurrentSection(initialSection)
        }
        
        if (attempt?.proctoring?.warnings !== undefined) {
          setInitialWarnings(attempt.proctoring.warnings)
        }
        
        setStateRestored(true)
        setServerStateLoaded(true)
        setLoading(false)
      })
      .catch(() => router.push(`/exam/${id}`))
  }, [id, attemptId, router, addToast])

  // Resilient submit with micro-jitter (to prevent 100+ students hitting server at the exact same millisecond)
  // and 3x auto-retry with exponential backoff so zero student answers are ever lost.
  const submitAttemptWithRetry = async (payload: { answers: Answer[]; autoSubmit: boolean; timeLeft: number }) => {
    // If auto-submit, add a micro-jitter (0 to 1500ms) to spread simultaneous submissions across students
    if (payload.autoSubmit) {
      const jitterMs = Math.floor(Math.random() * 1500)
      if (jitterMs > 0) await new Promise((res) => setTimeout(res, jitterMs))
    }

    // Always backup answers in localStorage before sending
    try {
      localStorage.setItem(`exam-pending-submit-${attemptId}`, JSON.stringify(payload))
    } catch {}

    let lastError: any = null
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await fetch(`/api/attempts/${attemptId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          throw new Error(errData.error || `HTTP ${res.status}`)
        }

        const data = await res.json()
        // Successfully submitted - clean up local backup
        try {
          localStorage.removeItem(`exam-state-${id}`)
          localStorage.removeItem(`exam-pending-submit-${attemptId}`)
        } catch {}

        return data
      } catch (err: any) {
        lastError = err
        if (attempt < 3) {
          // Exponential backoff with random jitter: ~800ms, ~1800ms
          const backoff = (attempt * 800) + Math.floor(Math.random() * 400)
          await new Promise((res) => setTimeout(res, backoff))
        }
      }
    }

    throw lastError || new Error("Failed to submit after 3 attempts")
  }

  // Auto-submit with thundering herd jitter & retry
  const handleAutoSubmit = useCallback(async () => {
    if (!attemptId || submitting) return
    setSubmitting(true)
    try {
      const data = await submitAttemptWithRetry({ answers, autoSubmit: true, timeLeft })

      // Stop camera and exit fullscreen
      setExamSubmitted(true)
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {})
      }
      
      router.push(`/exam/${id}/result?attemptId=${attemptId}`)
    } catch (error) {
      addToast("Network issue during submission. Your responses are safely backed up locally. Retrying...", "danger")
      setSubmitting(false)
    }
  }, [attemptId, submitting, answers, timeLeft, id, router, addToast])

  const handleWarning = useCallback((type: string) => {
    setActiveWarning(type)
    const msgs: Record<string, string> = {
      "tab-switch": "Tab switch detected — stay on this page",
      "fullscreen-exit": "Fullscreen exited — please stay fullscreen",
      "no-face": "Face not detected — look at the camera",
      "multiple-faces": "Multiple faces detected — plagiarism alert!",
    }
    addToast(msgs[type] || "Proctoring violation detected", type === "multiple-faces" ? "danger" : "warn")
  }, [addToast])

  const { state: procState, requestFullscreen, logEvent } = useProctoring({
    attemptId,
    maxWarnings: exam?.settings?.proctoring?.maxWarnings ?? exam?.proctoring?.maxWarnings ?? 3,
    enableFaceDetection: !!(exam?.settings?.proctoring?.faceDetection ?? exam?.proctoring?.faceDetection ?? false),
    enableTabSwitch: !!(exam?.settings?.proctoring?.tabSwitch ?? exam?.proctoring?.tabSwitch ?? false),
    enableFullscreen: !!((exam?.settings?.proctoring as any)?.fullscreen ?? exam?.settings?.proctoring?.fullscreenExit ?? exam?.proctoring?.fullscreenExit ?? false),
    onAutoSubmit: handleAutoSubmit,
    onWarning: handleWarning,
    initialWarnings: initialWarnings,
    isActive: isStarted && !examSubmitted,
  })
  useEffect(() => {
    const shouldFullscreen = !!((exam?.settings?.proctoring as any)?.fullscreen ?? exam?.settings?.proctoring?.fullscreenExit ?? exam?.proctoring?.fullscreenExit ?? false)
    if (isStarted && shouldFullscreen) requestFullscreen()
  }, [isStarted, exam, requestFullscreen])

  // Countdown timer - Enforce duration and scheduled end time with strict AUTO-SUBMIT
  useEffect(() => {
    if (!exam || !isStarted || examSubmitted) return
    
    const endDateTime = getExamEndDateTime(exam.settings)

    const t = setInterval(() => {
      const now = Date.now()

      // Strict scheduled end time reached -> immediately AUTO-SUBMIT!
      if (endDateTime && now >= endDateTime.getTime()) {
        clearInterval(t)
        setTimeLeft(0)
        addToast("Scheduled exam end time reached. Submitting your exam automatically...", "danger")
        handleAutoSubmit()
        return
      }

      setTimeLeft((p) => {
        if (p <= 1) { 
          clearInterval(t)
          addToast("Time is up! Submitting your exam automatically...", "danger")
          handleAutoSubmit()
          return 0
        }
        return p - 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, [exam, isStarted, examSubmitted, handleAutoSubmit, addToast])

  // Periodically save to localStorage
  useEffect(() => {
    if (!attemptId || !stateRestored) return
    const t = setInterval(() => {
      saveExamState()
    }, 10000)
    return () => clearInterval(t)
  }, [attemptId, stateRestored, saveExamState])

  useEffect(() => {
    if (!attemptId || !stateRestored || !serverStateLoaded) return
    const t = setInterval(() => {
      fetch(`/api/attempts/${attemptId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers, timeLeft }),
      })
      saveExamState()
    }, 30000)
    return () => clearInterval(t)
  }, [attemptId, answers, timeLeft, stateRestored, serverStateLoaded, saveExamState])

  // Clipboard / copy detection
  useEffect(() => {
    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      addToast("Copying content is disabled during the exam", "danger");
    }
    const handlePaste = (e: ClipboardEvent) => {
      e.preventDefault();
      addToast("Pasting content is disabled during the exam", "danger");
    }
    document.addEventListener("copy", handleCopy)
    document.addEventListener("paste", handlePaste)
    return () => {
      document.removeEventListener("copy", handleCopy)
      document.removeEventListener("paste", handlePaste)
    }
  }, [addToast])

  // Scheduled exam access timer (Start & End constraints)
  useEffect(() => {
    if (!exam || isStarted) return

    const startDt = getExamStartDateTime(exam.settings)
    const endDt = getExamEndDateTime(exam.settings)

    const checkSchedule = () => {
      const now = Date.now()

      // Check if exam already ended
      if (endDt && now >= endDt.getTime()) {
        setIsExamEnded(true)
        setScheduleStartReached(false)
        setCountdownTime(null)
        return
      } else {
        setIsExamEnded(false)
      }

      // Check if start time reached (with 2-second grace period for clock latency)
      if (!startDt || now >= (startDt.getTime() - 2000)) {
        setCountdownTime(null)
        if (!scheduleStartReached) {
          setScheduleStartReached(true)
          setShowStartModal(true)
        }
      } else {
        const diffSecs = Math.max(0, Math.ceil((startDt.getTime() - now) / 1000))
        if (diffSecs <= 0) {
          setCountdownTime(null)
          if (!scheduleStartReached) {
            setScheduleStartReached(true)
            setShowStartModal(true)
          }
        } else {
          setCountdownTime(diffSecs)
          setScheduleStartReached(false)
        }
      }
    }

    checkSchedule()
    const interval = setInterval(checkSchedule, 1000)
    return () => clearInterval(interval)
  }, [exam, isStarted, scheduleStartReached])

  // Fullscreen lock — re-request fullscreen if user exits via keyboard (ESC blocked via fullscreenchange)
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFullscreenRequired = exam?.settings?.proctoring?.fullscreenExit ?? exam?.proctoring?.fullscreenExit;
      if (!document.fullscreenElement && isFullscreenRequired) {
        addToast("Fullscreen exited — re-entering fullscreen", "warn")
        setTimeout(() => {
          document.documentElement.requestFullscreen().catch(() => {})
        }, 500)
      }
    }
    document.addEventListener("fullscreenchange", handleFullscreenChange)
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange)
  }, [exam, addToast])

  // ── Answer helpers ──────────────────────────────────────────────
  const getAnswer = (qId: string) => answers.find((a) => a.questionId === qId)
  const isReview = (qId: string) => getAnswer(qId)?.isMarkedForReview ?? false

  const setAnswer = async (qId: string, value: string | string[], sectionType: string, saveToDb: boolean = false) => {
    let updatedAnswers: Answer[] = []
    setAnswers((prev) => {
      const idx = prev.findIndex((a) => a.questionId === qId)
      const entry: Answer = { questionId: qId, sectionType, answer: value, isMarkedForReview: isReview(qId) }
      if (idx >= 0) { 
          updatedAnswers = [...prev]; 
          updatedAnswers[idx] = entry; 
      } else {
          updatedAnswers = [...prev, entry];
      }
      return updatedAnswers
    })

    if (saveToDb && attemptId) {
      try {
        await fetch(`/api/attempts/${attemptId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers: updatedAnswers }),
        })
      } catch (e) {
        addToast("Failed to save answer to server", "danger")
      }
    }
  }

  const toggleReview = async (qId: string, sectionType: string) => {
    let updatedAnswers: Answer[] = []
    setAnswers((prev) => {
      const idx = prev.findIndex((a) => a.questionId === qId)
      if (idx >= 0) {
        updatedAnswers = [...prev];
        updatedAnswers[idx] = { ...updatedAnswers[idx], isMarkedForReview: !updatedAnswers[idx].isMarkedForReview };
      } else {
        updatedAnswers = [...prev, { questionId: qId, sectionType, answer: "", isMarkedForReview: true }];
      }
      return updatedAnswers
    })

    if (attemptId) {
      // Immediate save to DB for review toggle
      setTimeout(async () => {
         try {
           await fetch(`/api/attempts/${attemptId}`, {
             method: "PATCH",
             headers: { "Content-Type": "application/json" },
             body: JSON.stringify({ 
                answers: updatedAnswers.length > 0 ? updatedAnswers : undefined 
             }),
           })
         } catch (e) { console.error("Auto-sync for review toggle failed") }
      }, 0)
    }
  }

  const getStatus = (secIdx: number, qIdx: number, q: Question): QuestionStatus => {
    const a = getAnswer(q._id)
    if (a?.isMarkedForReview) return "review"
    const hasAnswer = Array.isArray(a?.answer) ? a!.answer.some(Boolean) : !!a?.answer
    if (hasAnswer) return "answered"
    const flatCurrent = exam!.sections.slice(0, currentSection).reduce((s, sec) => s + sec.questions.length, 0) + currentQ
    const flatThis = exam!.sections.slice(0, secIdx).reduce((s, sec) => s + sec.questions.length, 0) + qIdx
    if (flatThis < flatCurrent) return "not-answered"
    return "not-visited"
  }

  const handleSubmitExam = () => {
    setShowSubmitConfirm(true)
  }

  const confirmSubmit = async () => {
    if (!attemptId) return
    setSubmitting(true)
    setShowSubmitConfirm(false)
    try {
      const data = await submitAttemptWithRetry({ answers, autoSubmit: false, timeLeft })

      // Stop camera and exit fullscreen
      setExamSubmitted(true)
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
      router.push(`/exam/${id}/result?attemptId=${attemptId}`)
    } catch {
      addToast("Submission failed. Your answers are saved locally. Please click Submit again.", "danger")
      setSubmitting(false)
    }
  }

  // ── Code execution (test cases) ─────────────────────────────────
  const runTestCases = async (questionId: string, code: string, testCases: Question["testCases"], visibleOnly: boolean, question: Question) => {
    if (!code.trim()) return
    const key = questionId
    setTestCaseRunning(p => ({ ...p, [key]: true }))
    try {
      const res = await fetch("/api/code/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          language: codeLanguage[key] || "python",
          testCases: testCases || [],
          timeLimit: question.timeLimit || 5,
          memoryLimit: question.memoryLimit || 128,
          visibleOnly,
          driverCode: question.driverCode?.[codeLanguage[key] || "python"] || "",
        }),
      })
      const data = await res.json()
      if (data.results) {
        setTestCaseResults(p => ({ ...p, [key]: data.results }))
        setActiveTestCase(p => ({ ...p, [key]: 0 }))
      }
      return data
    } catch {
      addToast("Code execution failed", "danger")
    } finally {
      setTestCaseRunning(p => ({ ...p, [key]: false }))
    }
  }

  const submitCode = async (questionId: string, code: string, question: Question) => {
    const data = await runTestCases(questionId, code, question.testCases, false, question)
    if (!data) return
    // Save test results into the answer
    setAnswers(prev => {
      const idx = prev.findIndex(a => a.questionId === questionId)
      const entry: Answer = {
        questionId,
        sectionType: "coding",
        answer: code,
        isMarkedForReview: prev[idx]?.isMarkedForReview ?? false,
        // @ts-ignore
        testResults: data.results,
        totalPassed: data.totalPassed,
        totalCases: data.totalCases,
      }
      if (idx >= 0) { const n = [...prev]; n[idx] = entry; return n }
      return [...prev, entry]
    })
    setCodeSubmitted(p => ({ ...p, [questionId]: true }))
    if (data.allPassed) {
      addToast("All test cases passed! 🎉", "info")
    } else {
      addToast(`${data.totalPassed}/${data.totalCases} test cases passed`, "warn")
    }
  }

  // --- Dynamic Section and Question Organization ---
  const { allFlatQuestions, sectionTabs } = useMemo(() => {
    if (!exam || !exam.sections?.length) {
      return { allFlatQuestions: [], sectionTabs: [] }
    }

    const flat: {
      question: Question
      globalIndex: number
      sectionIndex: number
      sectionName: string
      category: "mcq" | "diagram" | "assertion" | "fillblanks" | "truefalse" | "descriptive" | "coding" | "mcq_multi"
    }[] = []

    exam.sections.forEach((sec, sIdx) => {
      sec.questions.forEach((q) => {
        flat.push({
          question: q,
          globalIndex: flat.length,
          sectionIndex: sIdx,
          sectionName: sec.name || `Section ${sIdx + 1}`,
          category: getQuestionCategory(q),
        })
      })
    })

    const hasMultipleNamedSections = exam.sections.length > 1 && !exam.sections.every(s => s.name === "Questions")

    let tabs: {
      id: string
      title: string
      shortTitle: string
      category: string
      questions: Question[]
      questionIndices: number[]
      activeColor: string
      badgeBg: string
      dotColor: string
    }[] = []

    if (hasMultipleNamedSections) {
      tabs = exam.sections.map((sec, sIdx) => {
        const matching = flat.filter(f => f.sectionIndex === sIdx)
        const secCat = sec.type || (matching[0] ? matching[0].category : "mcq")
        const meta = getCategoryMeta(secCat)
        const isStandardTypeTitle = [
          "Multiple Choice Questions",
          "Diagram Based Questions",
          "Diagram & Visual Questions",
          "Assertion & Reason",
          "True / False Questions",
          "Fill in the Blanks",
          "Descriptive Questions",
          "Coding Challenges"
        ].includes(sec.name)
        const shortTitle = isStandardTypeTitle ? meta.shortLabel : (sec.name || `Sec ${sIdx + 1}`)

        return {
          id: `sec_${sIdx}`,
          title: sec.name || `Section ${sIdx + 1}`,
          shortTitle,
          category: secCat,
          questions: matching.map(m => m.question),
          questionIndices: matching.map(m => m.globalIndex),
          activeColor: meta.activeTabBg,
          badgeBg: meta.badgeBg,
          dotColor: meta.dotColor,
        }
      }).filter(t => t.questions.length > 0)
    } else {
      const categoriesOrder: ("mcq" | "mcq_multi" | "diagram" | "assertion" | "fillblanks" | "truefalse" | "descriptive" | "coding")[] = [
        "mcq",
        "mcq_multi",
        "diagram",
        "assertion",
        "fillblanks",
        "truefalse",
        "descriptive",
        "coding",
      ]

      tabs = categoriesOrder.map(cat => {
        const matching = flat.filter(f => f.category === cat)
        if (matching.length === 0) return null
        const meta = getCategoryMeta(cat)
        return {
          id: cat,
          title: meta.label,
          shortTitle: meta.shortLabel,
          category: cat,
          questions: matching.map(m => m.question),
          questionIndices: matching.map(m => m.globalIndex),
          activeColor: meta.activeTabBg,
          badgeBg: meta.badgeBg,
          dotColor: meta.dotColor,
        }
      }).filter(Boolean) as any[]
    }

    return { allFlatQuestions: flat, sectionTabs: tabs }
  }, [exam])

  // Automatically select the first section tab if activeSectionId is unset or invalid
  useEffect(() => {
    if (sectionTabs.length > 0) {
      const exists = sectionTabs.some(t => t.id === activeSectionId)
      if (!exists) {
        setActiveSectionId(sectionTabs[0].id)
      }
    }
  }, [sectionTabs, activeSectionId])

  const activeTab = sectionTabs.find(t => t.id === activeSectionId) || sectionTabs[0]
  const filteredQuestions: Question[] = activeTab ? activeTab.questions : []
  const question: Question | null = filteredQuestions[currentQ] || filteredQuestions[0] || null

  const globalQuestionIndex = question
    ? allFlatQuestions.findIndex(f => f.question._id === question._id)
    : 0

  const activeQuestionCategory = question ? getQuestionCategory(question) : "mcq"
  const activeTabMeta = getCategoryMeta(activeQuestionCategory)

  // Track visited questions for accurate palette status
  useEffect(() => {
    if (question?._id && !visitedQuestionIds.includes(question._id)) {
      setVisitedQuestionIds(prev => [...prev, question._id])
    }
  }, [question?._id, visitedQuestionIds])

  const totalQuestions = allFlatQuestions.length
  const totalAnswered = answers.filter((a) => Array.isArray(a.answer) ? a.answer.some(Boolean) : !!a.answer).length

  const specificTabs = sectionTabs
  const currentSpecificIdx = sectionTabs.findIndex(t => t.id === activeTab?.id)
  const isFirstQuestionOverall = globalQuestionIndex === 0
  const isLastQuestionOverall = globalQuestionIndex === allFlatQuestions.length - 1
  const isLastQuestionInSection = currentQ >= filteredQuestions.length - 1
  const nextSectionTab = currentSpecificIdx >= 0 && currentSpecificIdx < sectionTabs.length - 1
    ? sectionTabs[currentSpecificIdx + 1]
    : null
  const prevSectionTab = currentSpecificIdx > 0
    ? sectionTabs[currentSpecificIdx - 1]
    : null

  const goNext = () => {
    if (currentQ < filteredQuestions.length - 1) {
      const nextQ = currentQ + 1
      setCurrentQ(nextQ)
      setSectionPosMap(p => ({ ...p, [activeTab?.id || ""]: nextQ }))
    } else if (nextSectionTab) {
      setActiveSectionId(nextSectionTab.id)
      setCurrentQ(0)
      setSectionPosMap(p => ({ ...p, [nextSectionTab.id]: 0 }))
      addToast(`Moving to next section: ${nextSectionTab.title}`, "info")
    }
  }

  const goPrev = () => {
    if (currentQ > 0) {
      const prevQ = currentQ - 1
      setCurrentQ(prevQ)
      setSectionPosMap(p => ({ ...p, [activeTab?.id || ""]: prevQ }))
    } else if (prevSectionTab) {
      const prevQ = prevSectionTab.questions.length - 1
      setActiveSectionId(prevSectionTab.id)
      setCurrentQ(prevQ)
      setSectionPosMap(p => ({ ...p, [prevSectionTab.id]: prevQ }))
      addToast(`Returned to section: ${prevSectionTab.title}`, "info")
    }
  }

  const handleSaveAndNext = async () => {
    if (!question) return
    await setAnswer(question._id, getAnswer(question._id)?.answer || "", question.type, true)
    if (isLastQuestionOverall || (isLastQuestionInSection && !nextSectionTab)) {
      setShowSubmitConfirm(true)
    } else {
      goNext()
    }
  }

  const handleSkip = async () => {
    if (!question) return
    if (isLastQuestionOverall || (isLastQuestionInSection && !nextSectionTab)) {
      setShowSubmitConfirm(true)
    } else {
      goNext()
    }
  }

  const handleSelectSectionTab = (tabId: string) => {
    setActiveSectionId(tabId)
    const savedPos = sectionPosMap[tabId] ?? 0
    const targetTab = sectionTabs.find(t => t.id === tabId)
    const maxIdx = targetTab ? targetTab.questions.length - 1 : 0
    setCurrentQ(Math.min(savedPos, Math.max(0, maxIdx)))
    setSidebarOpen(false)
  }

  const handleSelectQuestionFromPalette = (targetQ: Question) => {
    const targetTab = sectionTabs.find(t => t.questions.some(q => q._id === targetQ._id))
    if (targetTab) {
      setActiveSectionId(targetTab.id)
      const localIdx = targetTab.questions.findIndex(q => q._id === targetQ._id)
      const validIdx = localIdx >= 0 ? localIdx : 0
      setCurrentQ(validIdx)
      setSectionPosMap(p => ({ ...p, [targetTab.id]: validIdx }))
    }
    setSidebarOpen(false)
  }

  const getQuestionStatus = (q: Question): QuestionStatus => {
    const a = getAnswer(q._id)
    if (a?.isMarkedForReview) return "review"
    const hasAnswer = Array.isArray(a?.answer) ? a.answer.some(Boolean) : !!a?.answer
    if (hasAnswer) return "answered"
    if (visitedQuestionIds.includes(q._id)) return "not-answered"
    return "not-visited"
  }

  const optionKeys = ["A", "B", "C", "D", "E"]
  const isFullscreenRequired = exam?.settings?.proctoring?.fullscreenExit ?? exam?.proctoring?.fullscreenExit

  const isAssertion = activeQuestionCategory === "assertion"
  const parsedAR = question ? parseAssertionReason(question.questionText) : null

  // ── Loading / Error / Instructions ──────────────────────────────────────────

  if (loading || !exam) {
    return <ExamTakingSkeleton />
  }

    if (!isStarted) {
    const isFaceDetectionEnabled = exam?.settings?.proctoring?.faceDetection ?? exam?.proctoring?.faceDetection;
    const rules = exam.instructions?.length ? exam.instructions : [
      "Read all questions carefully before answering.",
      "Do not switch tabs or exit the exam screen during the test.",
      "Ensure you have completed all required questions before finishing the exam.",
    ];

    return (
      <div className="min-h-screen bg-gray-50 flex flex-col p-4 md:p-8 animate-in fade-in duration-500">
        {/* Top Header */}
        <div className="max-w-6xl mx-auto w-full flex items-center justify-between gap-4 mb-8">
          {exam?.institute?.logo ? (
            <div className="flex items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={exam.institute.logo}
                alt={exam.institute.name || "Coaching Institute"}
                className="h-9 sm:h-11 max-w-[170px] sm:max-w-[240px] object-contain"
              />
            </div>
          ) : exam?.institute?.name ? (
            <div className="flex items-center gap-2.5">
              <div
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm sm:text-base shrink-0 shadow-xs"
                style={{ backgroundColor: instituteThemeColor }}
              >
                {exam.institute.name.charAt(0).toUpperCase()}
              </div>
              <span className="font-bold text-base sm:text-lg text-gray-800 line-clamp-1">
                {exam.institute.name}
              </span>
            </div>
          ) : (
            <ProcrentureLogo />
          )}

          <div className="flex items-center gap-2 sm:gap-3">
            {studentName && studentName !== "Aspirant" && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-gray-200 text-xs font-semibold text-gray-700 shadow-2xs">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: instituteThemeColor }} />
                <span>{studentName}</span>
                {studentRoll && studentRoll !== "N/A" && (
                  <span className="text-gray-400 font-normal">({studentRoll})</span>
                )}
              </div>
            )}
            <Button
              variant="outline"
              className="rounded-xl font-bold text-xs sm:text-sm border-gray-200"
              style={{ color: instituteThemeColor }}
            >
              Need Help?
            </Button>
          </div>
        </div>

        <div className="max-w-6xl mx-auto w-full flex-1">
          {/* Breadcrumb replacement */}
          <div className="flex items-center gap-2 text-sm text-gray-400 mb-6 font-medium">
            <span>Exams</span>
            <span className="text-gray-300">/</span>
            <span className="text-gray-600">General Instructions</span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-black text-[#324158] mb-2 tracking-tight">General Instructions</h1>
          <p className="text-xs sm:text-base text-gray-500 font-medium mb-6 sm:mb-8">Please read all instructions carefully before starting your exam</p>

          {/* Scheduled Status Banner */}
          {isExamEnded && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 sm:p-5 mb-6 sm:mb-8 flex items-center justify-between gap-4 shadow-sm animate-in fade-in">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center text-red-600 shrink-0">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-red-600 uppercase tracking-wider">Examination Window Closed</p>
                  <p className="text-xs sm:text-sm font-bold text-[#324158]">The scheduled time for this exam has ended. You can no longer start this exam.</p>
                </div>
              </div>
            </div>
          )}

          {!scheduleStartReached && countdownTime !== null && countdownTime > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 sm:p-5 mb-6 sm:mb-8 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm animate-in fade-in">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-700 shrink-0">
                  <Clock className="w-5 h-5 sm:w-6 sm:h-6 animate-pulse" />
                </div>
                <div>
                  <p className="text-xs font-black text-amber-600 uppercase tracking-widest">Scheduled Start Time</p>
                  <p className="text-sm sm:text-base font-bold text-[#324158]">
                    Exam starts at {formatScheduleDateTime(getExamStartDateTime(exam.settings))}
                  </p>
                  <p className="text-xs text-gray-500 font-medium">Please review the rules below. The start button will automatically unlock at the exact start time.</p>
                </div>
              </div>
              <div className="text-center sm:text-right bg-white px-4 sm:px-5 py-2 sm:py-3 rounded-xl border border-amber-200 shadow-sm shrink-0 w-full sm:w-auto">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Starts in</span>
                <span className="text-xl sm:text-2xl font-black font-mono text-amber-600">{formatCountdown(countdownTime)}</span>
              </div>
            </div>
          )}

          {scheduleStartReached && !isExamEnded && exam.settings?.endDate && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 sm:p-4 mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 text-xs text-emerald-800 shadow-sm">
              <div className="flex items-center gap-2.5">
                <Clock className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  Exam is active. Scheduled to close & auto-submit at: <strong className="font-bold text-emerald-950">{formatScheduleDateTime(getExamEndDateTime(exam.settings))}</strong>
                </span>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-600 text-white px-2.5 py-0.5 rounded-full shrink-0 self-start sm:self-auto">
                Active
              </span>
            </div>
          )}

          {/* Info Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
            <Card className="bg-white border-gray-100 shadow-sm rounded-2xl">
              <CardContent className="p-4 sm:p-6 flex flex-col items-center text-center gap-1.5 sm:gap-2">
                <Clock className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Duration</p>
                  <p className="text-sm sm:text-lg font-black text-[#324158]">{exam.duration} Mins</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white border-gray-100 shadow-sm rounded-2xl">
              <CardContent className="p-4 sm:p-6 flex flex-col items-center text-center gap-1.5 sm:gap-2">
                <FileText className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Qs</p>
                  <p className="text-sm sm:text-lg font-black text-[#324158]">{exam.sections.flatMap(s => s.questions).length} Qs</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white border-gray-100 shadow-sm rounded-2xl">
              <CardContent className="p-4 sm:p-6 flex flex-col items-center text-center gap-1.5 sm:gap-2">
                <CheckCircle2 className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Marks</p>
                  <p className="text-sm sm:text-lg font-black text-[#324158]">{exam.totalMarks} Marks</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white border-gray-100 shadow-sm rounded-2xl">
              <CardContent className="p-4 sm:p-6 flex flex-col items-center text-center gap-1.5 sm:gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Passing Score</p>
                  <p className="text-sm sm:text-lg font-black text-[#324158]">{Math.round((exam.passMarks / exam.totalMarks) * 100)}%</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-8 mb-8">
            {/* Rules Section */}
            <Card className="bg-white border-gray-100 shadow-sm rounded-2xl overflow-hidden">
              <CardContent className="p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-1 h-6 rounded-full" style={{ backgroundColor: instituteThemeColor }} />
                  <h2 className="text-xl font-black text-[#324158]">Exam Rules & Guidelines</h2>
                </div>
                <div className="space-y-4">
                  {rules.map((rule, i) => (
                    <div key={i} className="flex items-start gap-3 group">
                      <div className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border border-emerald-200 bg-emerald-50 flex items-center justify-center text-emerald-600">
                        <CheckCircle2 size={12} />
                      </div>
                      <p className="text-sm text-gray-600 font-medium leading-relaxed">{rule}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Technical Requirements & System Check */}
            <Card className="bg-white border-gray-100 shadow-sm rounded-2xl">
              <CardContent className="p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-1 h-6 rounded-full" style={{ backgroundColor: instituteThemeColor }} />
                  <h2 className="text-xl font-black text-[#324158]">Technical Requirements</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center shadow-sm">
                      <Monitor className="w-5 h-5 text-gray-400" />
                    </div>
                    <p className="text-xs font-bold text-gray-600">Use a desktop or laptop computer</p>
                  </div>
                  <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center shadow-sm text-[10px] font-bold text-gray-400">Br</div>
                    <p className="text-xs font-bold text-gray-600">Chrome, Firefox, or Edge browser</p>
                  </div>
                  <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center shadow-sm">
                      <Wifi className="w-5 h-5 text-gray-400" />
                    </div>
                    <p className="text-xs font-bold text-gray-600">Stable internet connection required</p>
                  </div>
                  <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center shadow-sm">
                      <Camera className="w-5 h-5 text-gray-400" />
                    </div>
                    <p className="text-xs font-bold text-gray-600">Webcam access for proctoring</p>
                  </div>
                </div>

                {isFaceDetectionEnabled && (
                  <div className="mt-8">
                    <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-6 flex flex-col md:flex-row items-center gap-6">
                      <div className="w-full md:w-32 aspect-square rounded-2xl bg-black overflow-hidden relative border-2 border-white shadow-lg">
                        {!examSubmitted && <ProctoringCamera onCameraStatusChange={setCamStatus} />}
                        <div className={`absolute top-2 right-2 w-2 h-2 rounded-full ${camStatus === "active" ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`} />
                      </div>
                      <div className="flex-1 text-center md:text-left">
                        <h4 className="font-black text-[#324158] mb-1">Camera Verification</h4>
                        <p className="text-sm text-gray-500 font-medium mb-3">Please ensure your face is clearly visible in the preview box to enable the start button.</p>
                        <div className="flex flex-wrap justify-center md:justify-start gap-2">
                          <Badge variant="outline" className="bg-white text-[10px] font-bold text-gray-500 border-gray-200 uppercase tracking-tighter">GOOD LIGHTING</Badge>
                          <Badge variant="outline" className="bg-white text-[10px] font-bold text-gray-500 border-gray-200 uppercase tracking-tighter">FACE CENTERED</Badge>
                        </div>
                      </div>
                      <div className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider ${camStatus === "active" ? "bg-emerald-500 text-white" : "bg-amber-100 text-amber-600"}`}>
                        {camStatus === 'active' ? 'LIVENESS OK' : 'CHECKING...'}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Agreement & Start */}
            <Card className="bg-white border-gray-100 shadow-sm rounded-2xl overflow-hidden mb-12">
              <CardContent className="p-4 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-5 sm:gap-6">
                <div className="flex items-start gap-3 sm:gap-4 flex-1">
                  <Checkbox 
                    id="agreement" 
                    checked={agreed} 
                    onCheckedChange={(checked) => setAgreed(!!checked)} 
                    className="mt-1 w-5 h-5 rounded-md border-gray-300 transition-colors"
                    style={agreed ? { backgroundColor: instituteThemeColor, borderColor: instituteThemeColor } : undefined}
                  />
                  <label htmlFor="agreement" className="text-xs sm:text-sm text-gray-600 font-medium cursor-pointer leading-relaxed">
                    I have read and understood all the instructions and agree to abide by the exam rules.
                  </label>
                </div>
                <div className="flex flex-col-reverse sm:flex-row items-center gap-2.5 sm:gap-3 w-full md:w-auto">
                  <Button 
                    variant="outline" 
                    className="w-full sm:w-auto h-11 sm:h-12 px-6 sm:px-8 rounded-xl font-bold text-gray-500 border-gray-200 hover:bg-gray-100"
                    onClick={() => router.back()}
                  >
                    Go Back
                  </Button>
                  <Button 
                    disabled={!agreed || (isFaceDetectionEnabled && camStatus !== "active") || !scheduleStartReached || isExamEnded}
                    onClick={() => setIsStarted(true)}
                    className="w-full sm:w-auto h-11 sm:h-12 px-8 sm:px-10 rounded-xl font-black uppercase text-xs tracking-widest text-white shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
                    style={{
                      backgroundColor: instituteThemeColor,
                      boxShadow: `0 10px 25px -5px ${instituteThemeColor}40`
                    }}
                  >
                    {isExamEnded 
                      ? "Exam Ended" 
                      : !scheduleStartReached && countdownTime !== null && countdownTime > 0
                        ? `Starts in ${formatCountdown(countdownTime)}` 
                        : "Start Exam"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Modal - Modernized */}
        {showStartModal && scheduleStartReached && !isExamEnded && exam.settings?.startDate && (
          <div className="fixed inset-0 bg-[#303e52]/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-[2.5rem] shadow-2xl p-10 max-w-sm w-full text-center border border-white/20">
              <div className="w-16 h-16 bg-emerald-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <Shield size={32} className="text-emerald-500" />
              </div>
              <h2 className="text-2xl font-black text-[#324158] mb-3">Time to Start</h2>
              <p className="text-slate-400 text-sm font-medium mb-8">The examination is scheduled to begin now. Click below to enter the room.</p>
              <button
                onClick={() => {
                  setShowStartModal(false)
                  setIsStarted(true)
                }}
                className="w-full py-4 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-[1.03] transition-all shadow-xl"
                style={{
                  backgroundColor: instituteThemeColor,
                  boxShadow: `0 10px 25px -5px ${instituteThemeColor}40`
                }}
              >
                Start Examination
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // If exam has no questions at all (checked AFTER loading is complete)
  if (!question && allFlatQuestions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center bg-gray-50">
        <h2 className="text-xl font-medium mb-4 text-[#324158]">No questions found for this exam.</h2>
        <p className="mb-6 text-gray-500 text-sm">Please contact your instructor or administrator.</p>
        <button
          onClick={() => router.push(`/exam/${id}`)}
          className="px-8 py-3 bg-[#1E293B] text-white text-sm font-medium rounded-xl hover:bg-[#0F172A] transition-colors"
        >
          Return to Exam Page
        </button>
      </div>
    )
  }

    return (
    <div onContextMenu={(e) => { e.preventDefault(); addToast("Right-click is restricted during the exam", "warn"); }} className="flex flex-col h-[100dvh] bg-gray-50 overflow-hidden select-none">
      {!procState.isFullscreen && isFullscreenRequired && (
        <div className="fixed inset-0 z-100 flex flex-col items-center justify-center bg-black/95 backdrop-blur-sm text-white p-6 sm:p-8">
          <AlertCircle size={48} className="text-red-500 mb-4 sm:mb-6 animate-pulse sm:w-16 sm:h-16" />
          <h1 className="text-2xl sm:text-4xl font-black mb-3 sm:mb-4 text-center tracking-tight">Fullscreen Required</h1>
          <p className="text-gray-300 text-center max-w-lg mb-6 sm:mb-8 leading-relaxed text-sm sm:text-lg">
            This exam must be taken in fullscreen mode to prevent plagiarism. Your exam is temporarily paused (timer is still running on the server).
          </p>
          <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs sm:max-w-none justify-center">
            <button 
              onClick={requestFullscreen}
              className="px-6 sm:px-10 py-3.5 sm:py-5 bg-primary text-white rounded-xl sm:rounded-2xl font-bold text-sm sm:text-lg hover:bg-accent transition-all transform hover:scale-105 active:scale-95 shadow-xl flex items-center justify-center gap-2.5 cursor-pointer"
            >
              <Shield size={20} className="sm:w-6 sm:h-6" />
              Return to Fullscreen
            </button>
            <button
              onClick={() => {
                setStateRestored(true)
                addToast("Continuing in mobile view", "info")
              }}
              className="sm:hidden px-4 py-2.5 bg-white/10 text-gray-300 rounded-xl font-semibold text-xs text-center hover:bg-white/20 transition-all cursor-pointer"
            >
              Continue on Mobile
            </button>
          </div>
        </div>
      )}
      <ProctoringWarning
        warningCount={procState.warnings}
        maxWarnings={exam.settings?.proctoring?.maxWarnings ?? exam.proctoring?.maxWarnings ?? 3}
        warningType={activeWarning}
        onDismiss={() => { if (!procState.autoSubmitted) setActiveWarning(null) }}
        autoSubmitted={procState.autoSubmitted}
      />

      {(() => {
        const scheduledEndDt = getExamEndDateTime(exam.settings)
        const endTimeLabel = scheduledEndDt
          ? scheduledEndDt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
          : undefined
        const isCalculatorAllowed = Boolean(
          exam.settings?.allowCalculator ||
          exam.settings?.enableCalculator ||
          (exam as any)?.allowCalculator
        )

        return (
          <ExamHeader
            title={exam.title}
            section={activeTab ? activeTab.title : "Examination"}
            timeLeft={timeLeft}
            duration={exam.duration * 60}
            studentName={studentName}
            rollNo={studentRoll}
            onToggleCalculator={isCalculatorAllowed ? () => setShowCalculator(p => !p) : undefined}
            onToggleInstructions={() => setShowInstructionsModal(p => !p)}
            warningCount={procState.warnings}
            maxWarnings={exam.settings?.proctoring?.maxWarnings ?? exam.proctoring?.maxWarnings ?? 3}
            endTimeLabel={endTimeLabel}
            instituteLogo={exam.institute?.logo}
            instituteName={exam.institute?.name}
            themeColor={exam.institute?.themeColor}
          />
        )
      })()}

      {/* ─── Modern Responsive Section Navigation Bar ─── */}
      <div className="bg-white border-b border-gray-200 px-2 sm:px-6 py-2 sm:py-2.5 flex items-center gap-1.5 sm:gap-2 shrink-0 sticky top-0 z-20 shadow-2xs">
        {/* Mobile Question Palette Toggle */}
        <button
          onClick={() => setSidebarOpen(true)}
          className="sm:hidden flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-full text-xs font-bold shrink-0 transition-colors border border-gray-200 cursor-pointer"
          title="Open Question Palette"
        >
          <svg className="w-3.5 h-3.5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          <span className="text-[11px]">Palette</span>
        </button>

        {/* Section Tabs - horizontally scrollable container with hidden scrollbar */}
        <div className="flex-1 flex items-center gap-1.5 sm:gap-2 overflow-x-auto scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden py-0.5">
          {sectionTabs.map((tab) => {
            const isActive = activeSectionId === tab.id
            const answeredCount = tab.questions.filter((q) => {
              const a = getAnswer(q._id)
              return Array.isArray(a?.answer) ? a.answer.some(Boolean) : !!a?.answer
            }).length

            return (
              <button
                key={tab.id}
                onClick={() => handleSelectSectionTab(tab.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 sm:gap-2 cursor-pointer ${
                  isActive
                    ? `${tab.activeColor} shadow-sm font-medium`
                    : "bg-white text-slate-700 hover:bg-gray-100 hover:text-gray-900 border border-gray-200/90"
                }`}
              >
                <span>{tab.shortTitle}</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                  isActive ? "bg-white/20 text-white" : "bg-gray-100 text-gray-600"
                }`}>
                  {answeredCount}/{tab.questions.length}
                </span>
              </button>
            )
          })}
        </div>

        {/* Overall progress on desktop */}
        <div className="hidden sm:flex ml-auto items-center gap-3 shrink-0">
          <div className="hidden md:flex flex-col items-end">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">
              Overall Progress
            </span>
            <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden border border-gray-200">
              <div 
                className="h-full bg-emerald-500 transition-all duration-500" 
                style={{ width: `${totalQuestions > 0 ? (totalAnswered / totalQuestions) * 100 : 0}%` }}
              />
            </div>
          </div>
          <span className="text-xs sm:text-sm font-black text-emerald-700 whitespace-nowrap bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200 shadow-2xs">
            {totalAnswered}/{totalQuestions}
          </span>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Mobile overlay */}
        {sidebarOpen && <div className="fixed inset-0 bg-black/50 sm:hidden z-40 backdrop-blur-xs transition-opacity" onClick={() => setSidebarOpen(false)} />}
        {/* Main question area */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-5 pb-28 sm:pb-8">
          {/* Question meta & Section badge */}
          {(() => {
            const isAssertion = activeQuestionCategory === "assertion";
            const isFillBlanks = activeQuestionCategory === "fillblanks";
            const isTrueFalse = activeQuestionCategory === "truefalse";
            const isMulti = (activeQuestionCategory as any) === "mcq_multi" ||
              (question as any)?.type === "mcq_multi" ||
              (question as any)?.questionFormat === "mcq_multi" ||
              (question as any)?.questionFormat === "mcq_multiple" ||
              (Array.isArray((question as any)?.correctAnswer) && (question as any)?.correctAnswer.length > 1);
            const parsedAR = isAssertion && question ? parseAssertionReason(question.questionText) : null;

            return (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center shrink-0 shadow-2xs">
                      <span className="text-white font-black text-xs">Q{globalQuestionIndex + 1}</span>
                    </div>
                    {/* Section Context Pill */}
                    <span className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border flex items-center gap-1.5 ${activeTabMeta.badgeBg}`}>
                      <span>{activeTab?.title || activeTabMeta.label}</span>
                      <span className="opacity-70 font-semibold">({currentQ + 1} of {filteredQuestions.length})</span>
                    </span>
                    <span className="px-2 py-1 bg-gray-100 text-gray-600 text-[10px] font-semibold rounded-full">
                      {question.marks} mark{question.marks > 1 ? "s" : ""}
                    </span>
                    {question.negativeMark ? (
                      <span className="px-2 py-1 bg-rose-50 text-rose-600 border border-rose-200 text-[10px] font-semibold rounded-full">
                        -{question.negativeMark} neg
                      </span>
                    ) : null}
                    {question.difficulty && (
                      <span className={`px-2.5 py-1 text-[10px] sm:text-xs font-semibold rounded-full ${
                        question.difficulty === "easy" ? "bg-green-100 text-green-700" :
                        question.difficulty === "medium" ? "bg-blue-100 text-blue-700" :
                        "bg-red-100 text-red-700"
                      }`}>
                        {question.difficulty.charAt(0).toUpperCase() + question.difficulty.slice(1)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                      onClick={() => toggleReview(question._id, question.type)}
                      className={`flex-1 sm:flex-initial px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold border rounded-xl transition-colors whitespace-nowrap text-center cursor-pointer ${
                        isReview(question._id)
                          ? "border-[#F59E0B] bg-amber-50 text-[#F59E0B]"
                          : "border-[#F59E0B] text-[#F59E0B] hover:bg-amber-50"
                      }`}
                    >
                      {isReview(question._id) ? "★ Marked" : "☆ Review"}
                      <span className="hidden sm:inline"> for Review</span>
                    </button>
                    <button
                      onClick={() => setAnswer(question._id, isMulti ? [] : "", question.type, true)}
                      className="flex-1 sm:flex-initial px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold border border-gray-300 text-gray-600 rounded-xl hover:bg-gray-50 transition-colors whitespace-nowrap text-center cursor-pointer"
                    >
                      Clear<span className="hidden sm:inline"> Option</span>
                    </button>
                  </div>
                </div>

                {/* Question text (non-coding) */}
                {question.type !== "coding" && (
                  <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5 mb-5 space-y-3.5 shadow-2xs">
                    {isAssertion && parsedAR ? (
                      <div className="space-y-3">
                        <div className="p-3.5 rounded-xl border border-purple-200 bg-purple-50/50">
                          <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-medium uppercase tracking-wider bg-purple-600 text-white mb-1.5">
                            Assertion (A)
                          </span>
                          <div className="text-foreground font-normal text-sm sm:text-base leading-relaxed">
                            <MathRenderer content={parsedAR.assertion} />
                          </div>
                        </div>
                        <div className="p-3.5 rounded-xl border border-indigo-200 bg-indigo-50/50">
                          <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-medium uppercase tracking-wider bg-indigo-600 text-white mb-1.5">
                            Reason (R)
                          </span>
                          <div className="text-foreground font-normal text-sm sm:text-base leading-relaxed">
                            <MathRenderer content={parsedAR.reason} />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-foreground font-normal text-sm sm:text-base leading-relaxed">
                        <MathRenderer content={question.questionText} />
                      </div>
                    )}

                    {question.questionImage && (
                      <QuestionDiagram src={question.questionImage} />
                    )}
                    {question.codeSnippet && (
                      <div className="bg-[#1e2a38] border border-gray-300 rounded-xl overflow-hidden">
                        <div className="px-4 py-2 border-b border-gray-600 bg-[#151d2a]">
                          <p className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Code Reference</p>
                        </div>
                        <pre className="px-4 py-3 text-xs text-gray-200 font-mono overflow-x-auto">{question.codeSnippet}</pre>
                      </div>
                    )}
                  </div>
                )}

                {/* MCQ or Multi-Correct or Diagram or Assertion or FIB with choices */}
                {(question.type === "mcq" || (question as any).type === "mcq_multi" || (question as any).type === "diagram" || isAssertion || (isFillBlanks && question.options && question.options.length > 0)) && question.options && question.options.length > 0 && (
                  <div className="space-y-3">
                    {isMulti ? (
                      <div className="px-3.5 py-2 rounded-xl bg-violet-50 border border-violet-200/90 text-violet-800 text-xs font-medium flex items-center gap-2">
                        <CheckSquare size={14} className="shrink-0 text-violet-600" />
                        <span><strong>Multiple Correct:</strong> Select ALL correct options that apply.</span>
                      </div>
                    ) : (
                      <div className="text-[11px] font-medium text-slate-500 flex items-center gap-1.5">
                        <span>Select one best option.</span>
                      </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-3">
                      {(question.shuffledOptionIndices || question.options!.map((_, i) => i)).map((shuffledIndex, oi) => {
                        const opt = question.options![shuffledIndex];
                        const optImg = question.optionImages?.[shuffledIndex];
                        const key = optionKeys[oi] || String(oi);
                        const originalKey = optionKeys[shuffledIndex] || String(shuffledIndex);
                        const currentAnswer = getAnswer(question._id)?.answer;
                        const selectedList: string[] = Array.isArray(currentAnswer)
                          ? currentAnswer
                          : currentAnswer
                          ? String(currentAnswer).split(",").map(s => s.trim()).filter(Boolean)
                          : [];
                        const selected = isMulti
                          ? (selectedList.includes(originalKey) || selectedList.includes(opt.trim()))
                          : currentAnswer === originalKey;

                        return (
                          <button
                            key={oi}
                            type="button"
                            onClick={() => {
                              if (isMulti) {
                                const exists = selectedList.includes(originalKey) || selectedList.includes(opt.trim());
                                const next = exists
                                  ? selectedList.filter(k => k !== originalKey && k !== opt.trim())
                                  : [...selectedList, originalKey];
                                setAnswer(question._id, next, question.type || "mcq", true);
                              } else {
                                setAnswer(question._id, originalKey, question.type, true);
                              }
                            }}
                            className={`flex flex-col border-2 rounded-xl sm:rounded-2xl text-left transition-all min-h-16 sm:min-h-auto cursor-pointer ${
                              selected ? "border-primary bg-blue-50/20 shadow-xs" : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                            }`}
                          >
                            {optImg && (
                              <div className="w-full aspect-video bg-gray-50 border-b border-gray-100 flex items-center justify-center overflow-hidden">
                                 <img src={optImg} alt={`Option ${key}`} className="w-full h-full object-contain" />
                              </div>
                            )}
                            <div className="flex items-center gap-2.5 sm:gap-3.5 px-3.5 sm:px-4 py-2.5 sm:py-3">
                               <div className={`w-8 h-8 sm:w-7 sm:h-7 ${isMulti ? "rounded-lg" : "rounded-full"} border flex items-center justify-center shrink-0 font-medium text-xs transition-colors ${
                                 selected ? "border-primary bg-primary text-white" : "border-gray-300 text-gray-500"
                               }`}>
                                 {isMulti && selected ? <Check size={13} strokeWidth={3} /> : key}
                               </div>
                               <div className={`font-normal text-xs sm:text-sm flex-1 break-words overflow-x-auto ${selected ? "text-foreground" : "text-gray-600"}`}>
                                 <MathRenderer content={opt} />
                               </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* True / False */}
                {(question.type === "truefalse" || isTrueFalse) && (
                  <div className="flex gap-2.5 sm:gap-3">
                    {["True", "False"].map((val) => {
                      const selected = getAnswer(question._id)?.answer === val;
                      return (
                        <button
                          key={val}
                          onClick={() => setAnswer(question._id, val, question.type)}
                          className={`flex-1 py-3 sm:py-4 border-2 rounded-xl sm:rounded-2xl text-center font-medium text-sm sm:text-base transition-all cursor-pointer ${
                            selected ? "border-[#2D3A4A] bg-[#2D3A4A] text-white shadow-sm" : "border-gray-200 bg-white hover:border-gray-300 text-gray-700"
                          }`}
                        >
                          {val}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Descriptive */}
                {question.type === "descriptive" && (
                  <div>
                    <textarea
                      rows={6}
                      placeholder="Write your answer here..."
                      value={(getAnswer(question._id)?.answer as string) || ""}
                      onChange={(e) => setAnswer(question._id, e.target.value, question.type)}
                      className="w-full border-2 border-gray-200 rounded-2xl p-4 text-base sm:text-sm text-[#324158] focus:outline-none focus:border-[#2D3A4A] resize-none transition-colors"
                    />
                    {question.wordLimit && (
                      <p className="text-xs text-gray-400 mt-1 text-right font-medium">
                        {((getAnswer(question._id)?.answer as string) || "").trim().split(/\s+/).filter(Boolean).length} / {question.wordLimit} words
                      </p>
                    )}
                  </div>
                )}

                {/* Fill in the Blanks */}
                {(question.type === "fillblanks" || isFillBlanks) && (!question.options || question.options.length === 0 || (question.blanks && question.blanks.length > 0)) && (
                  <div className="space-y-3 sm:space-y-4">
                    {question.blanks && question.blanks.length > 0 ? (
                      question.blanks.map((blank, bi) => {
                        const inputs = blankInputs[question._id] || [];
                        return (
                          <div key={bi} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-3 sm:p-0 bg-gray-50 sm:bg-transparent rounded-xl border sm:border-0 border-gray-100">
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="w-7 h-7 rounded-full bg-[#F59E0B] text-white text-xs font-bold flex items-center justify-center shrink-0">{bi + 1}</span>
                              <label className="text-xs sm:text-sm text-gray-700 font-semibold min-w-0 truncate">{blank.label || `Blank ${bi + 1}`}</label>
                            </div>
                            <input
                              type="text"
                              placeholder={`Enter answer for blank ${bi + 1}...`}
                              value={inputs[bi] || ""}
                              onChange={(e) => {
                                const updated = [...(blankInputs[question._id] || question.blanks!.map(() => ""))];
                                updated[bi] = e.target.value;
                                setBlankInputs((prev) => ({ ...prev, [question._id]: updated }));
                                setAnswer(question._id, updated, question.type);
                              }}
                              className="w-full sm:flex-1 border-2 border-gray-200 rounded-xl px-4 py-2.5 text-base sm:text-sm focus:outline-none focus:border-[#F59E0B] transition-colors bg-white"
                            />
                          </div>
                        );
                      })
                    ) : (
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                        <label className="text-xs sm:text-sm text-gray-700 font-semibold shrink-0">Your Answer:</label>
                        <input
                          type="text"
                          placeholder="Type the missing word or phrase..."
                          value={(getAnswer(question._id)?.answer as string) || ""}
                          onChange={(e) => setAnswer(question._id, e.target.value, question.type)}
                          className="w-full sm:flex-1 border-2 border-gray-200 rounded-xl px-4 py-2.5 text-base sm:text-sm focus:outline-none focus:border-[#F59E0B] transition-colors bg-white"
                        />
                      </div>
                    )}
                  </div>
                )}
              </>
            );
          })()}

          {/* Coding — LeetCode-style layout */}
          {question.type === "coding" && (() => {
            const qId = question._id;
            const lang = codeLanguage[qId] || "python";
            const code = (getAnswer(qId)?.answer as string) || (question.codeTemplates && question.codeTemplates[lang]) || question.codeTemplate || "";
            const visibleCases = (question.testCases || []).filter(tc => !tc.hidden);
            const results = testCaseResults[qId] || [];
            const visibleResults = results.filter(r => !r.hidden);
            const activeCase = activeTestCase[qId] ?? 0;
            const isRunning = testCaseRunning[qId];
            const submitted = codeSubmitted[qId];
            const allPassed = submitted && results.length > 0 && results.every(r => r.passed);
            const passedCount = results.filter(r => r.passed).length;

            const DIFF_COLOR: Record<string, string> = {
              easy: "text-green-400", medium: "text-yellow-400", hard: "text-red-400"
            };

            return (
              <div className="flex flex-col gap-3">
                {/* Mobile Toggle Buttons for Coding */}
                <div className="flex sm:hidden p-1 bg-gray-100 rounded-xl gap-1">
                  <button
                    onClick={() => setShowCodingDescription(true)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all ${
                      showCodingDescription ? "bg-white text-primary shadow-sm" : "text-gray-500"
                    }`}
                  >
                    <FileText size={14} /> Description
                  </button>
                  <button
                    onClick={() => setShowCodingDescription(false)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all ${
                      !showCodingDescription ? "bg-accent text-white shadow-sm" : "text-gray-500"
                    }`}
                  >
                    <Code size={14} /> Editor
                  </button>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 sm:h-[calc(100vh-180px)] sm:min-h-125">
                  {/* ── LEFT: Problem Panel */}
                  <div className={`${showCodingDescription ? "flex" : "hidden sm:flex"} w-full sm:w-95 shrink-0 flex-col bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden`}>
                  <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-[#324158]">Problem</span>
                      <span className={`text-xs font-semibold capitalize ${DIFF_COLOR[question.difficulty || "medium"]}`}>
                        {question.difficulty || "medium"}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-gray-400">{question.marks} pts</span>
                  </div>
                  <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                    <p className="text-sm text-[#324158] leading-relaxed whitespace-pre-wrap">{question.questionText}</p>
                    {question.constraints && question.constraints.length > 0 && (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                        <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-1.5">Constraints</p>
                        <ul className="space-y-0.5">
                          {question.constraints.map((c, ci) => (
                            <li key={ci} className="text-xs text-amber-800 font-mono">{c}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {visibleCases.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Examples</p>
                        {visibleCases.map((tc, ti) => (
                          <div key={ti} className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                            <p className="text-[10px] font-bold text-gray-400 mb-1">Example {ti + 1}</p>
                            <div className="space-y-1">
                              <div>
                                <span className="text-[10px] font-bold text-gray-500 uppercase">Input: </span>
                                <code className="text-xs text-gray-700 font-mono">{tc.input || "(none)"}</code>
                              </div>
                              <div>
                                <span className="text-[10px] font-bold text-gray-500 uppercase">Output: </span>
                                <code className="text-xs text-gray-700 font-mono">{tc.expectedOutput}</code>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-4 text-xs text-gray-400">
                      <span>⏱ {question.timeLimit || 5}s</span>
                      <span>💾 {question.memoryLimit || 128}MB</span>
                    </div>
                  </div>
                </div>

                {/* ── RIGHT: Editor + Test Cases */}
                <div className={`${!showCodingDescription ? "flex" : "hidden sm:flex"} flex-1 flex flex-col gap-3 min-w-0`}>
                  {/* Language selector + action buttons */}
                  <div className="bg-[#1e2a38] rounded-t-2xl px-4 py-2.5 flex items-center gap-3">
                    <div className="relative">
                      {(() => {
                        const availableLangs = question.languages && question.languages.length > 0 
                          ? question.languages 
                          : ["Python"];
                        
                        return (
                          <div className="flex items-center gap-2">
                             <select
                              value={lang}
                              onChange={(e) => {
                                const newLang = e.target.value;
                                const currentAns = getAnswer(qId)?.answer;
                                const oldTemplate = (question.codeTemplates && question.codeTemplates[lang]) || question.codeTemplate || "";
                                const newTemplate = (question.codeTemplates && question.codeTemplates[newLang]) || "";
                                
                                setCodeLanguage(p => ({ ...p, [qId]: newLang }));
                                if (!currentAns || currentAns === oldTemplate) {
                                  setAnswer(qId, newTemplate, "coding");
                                }
                              }}
                              className="bg-[#2d3a4a] text-xs font-bold text-white px-3 py-1.5 rounded-lg border border-gray-700 focus:outline-none hover:bg-[#3a4a5a] cursor-pointer appearance-none pr-8 min-w-30"
                            >
                              {availableLangs.map(l => (
                                <option key={l.toLowerCase()} value={l.toLowerCase()}>{l}</option>
                              ))}
                            </select>
                            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                    <span className="text-[10px] text-gray-500 ml-auto flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                      Judge0 CE
                    </span>
                  </div>

                  {/* Code editor */}
                  <div className="relative flex-1 bg-[#1e2a38] overflow-hidden min-h-100 sm:min-h-0 border-y border-gray-700 flex flex-col">
                    <div className="flex-1 min-h-100">
                      <Editor
                        height="400px"
                        path={`model-${qId}-${lang}`}
                        key={`editor-${qId}-${lang}-${editorReady[qId] ? 'ready' : 'init'}`}
                        onMount={() => setEditorReady(p => ({ ...p, [qId]: true }))}
                        defaultLanguage={lang === "c++" ? "cpp" : lang === "c#" ? "csharp" : lang}
                        language={lang === "c++" ? "cpp" : lang === "c#" ? "csharp" : lang}
                        theme="vs-dark"
                        value={code}
                        onChange={(val) => setAnswer(qId, val || "", "coding")}
                        options={{
                          minimap: { enabled: false },
                          scrollBeyondLastLine: false,
                          fontSize: 14,
                          lineNumbers: "on",
                          glyphMargin: false,
                          folding: true,
                          lineDecorationsWidth: 10,
                          lineNumbersMinChars: 3,
                          automaticLayout: true,
                          bracketPairColorization: { enabled: true },
                          autoClosingBrackets: "always",
                          autoClosingQuotes: "always",
                          suggestOnTriggerCharacters: true,
                          acceptSuggestionOnEnter: "on",
                          tabSize: 4,
                          padding: { top: 10 },
                          wordWrap: "on",
                          fixedOverflowWidgets: true,
                          quickSuggestions: false,
                          parameterHints: { enabled: false },
                          suggest: { 
                            showWords: false,
                            snippetsPreventQuickSuggestions: true,
                          },
                          dragAndDrop: false,
                          links: false,
                          contextmenu: true,
                          scrollbar: {
                            vertical: 'visible',
                            horizontal: 'visible',
                            useShadows: false,
                            verticalHasArrows: false,
                            horizontalHasArrows: false,
                            verticalScrollbarSize: 10,
                            horizontalScrollbarSize: 10
                          }
                        }}
                        loading={<div className="flex items-center justify-center h-full text-gray-500 text-xs font-mono">Initializing IDE...</div>}
                      />
                    </div>
                  </div>

                  {/* Test case panel */}
                  <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
                      <div className="flex items-center gap-1">
                        {visibleCases.map((_, ti) => {
                          const res = visibleResults[ti];
                          return (
                            <button key={ti}
                              onClick={() => setActiveTestCase(p => ({ ...p, [qId]: ti }))}
                              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
                                activeCase === ti ? "bg-[#1e2a38] text-white" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                              }`}
                            >
                              {res && (
                                <span className={`w-1.5 h-1.5 rounded-full ${res.passed ? "bg-green-400" : "bg-red-400"}`} />
                              )}
                              Case {ti + 1}
                            </button>
                          );
                        })}
                        {submitted && results.some(r => r.hidden) && (
                          <span className="ml-2 text-xs text-gray-400">
                            + {results.filter(r => r.hidden).length} hidden: {results.filter(r => r.hidden && r.passed).length} passed
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {submitted && (
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            allPassed ? "bg-green-100 text-green-600" : "bg-red-100 text-red-500"
                          }`}>
                            {allPassed ? "✓ All Passed" : `${passedCount}/${results.length} Passed`}
                          </span>
                        )}
                        <button
                          onClick={() => runTestCases(qId, code, question.testCases, true, question)}
                          disabled={isRunning}
                          className="flex items-center gap-1.5 px-4 py-1.5 border border-gray-300 text-xs font-semibold rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                        >
                          {isRunning && !submitted ? (
                            <span className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" /></svg>
                          )}
                          Run
                        </button>
                        <button
                          onClick={() => submitCode(qId, code, question)}
                          disabled={isRunning}
                          className="flex items-center gap-1.5 px-4 py-1.5 bg-[#2D3A4A] text-white text-xs font-semibold rounded-lg hover:bg-[#1e2a38] disabled:opacity-50 transition-colors"
                        >
                          {isRunning && submitted ? (
                            <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : "Submit"}
                        </button>
                      </div>
                    </div>

                    {/* Test case results body */}
                    <div className="px-4 py-3">
                      {!isRunning && visibleResults.length === 0 && (
                        <p className="text-xs text-gray-400 py-2">Click "Run" to test against sample cases.</p>
                      )}
                      {isRunning && (
                        <div className="flex items-center gap-2 py-2">
                          <span className="w-4 h-4 border-2 border-[#2D3A4A] border-t-transparent rounded-full animate-spin" />
                          <p className="text-xs text-gray-500">Executing...</p>
                        </div>
                      )}
                      {!isRunning && visibleResults[activeCase] && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase mb-1.5">Input</p>
                            <div className="bg-gray-50 rounded-lg p-2.5 font-mono text-xs text-gray-700 min-h-12 whitespace-pre-wrap">
                              {visibleResults[activeCase].input || "(no input)"}
                            </div>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase mb-1.5">Expected</p>
                            <div className="bg-gray-50 rounded-lg p-2.5 font-mono text-xs text-gray-700 min-h-12 whitespace-pre-wrap">
                              {visibleResults[activeCase].expectedOutput}
                            </div>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase mb-1.5">
                              Output
                              {visibleResults[activeCase].passed ? (
                                <span className="ml-1.5 text-green-500">✓</span>
                              ) : (
                                <span className="ml-1.5 text-red-500">✗</span>
                              )}
                            </p>
                            <div className={`rounded-lg p-2.5 font-mono text-[11px] min-h-12 whitespace-pre-wrap border ${
                              visibleResults[activeCase].passed ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-800"
                            }`}>
                              {visibleResults[activeCase].stderr ? visibleResults[activeCase].stderr : visibleResults[activeCase].actualOutput ?? "(no output)"}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                </div>
              </div>
            );
          })()}

          {/* Navigation buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-6 sm:mt-8 pb-12 sm:pb-0">
            <div className="hidden sm:flex items-center gap-2">
              <button
                onClick={goPrev}
                disabled={isFirstQuestionOverall || (currentQ === 0 && !prevSectionTab)}
                className="px-4 sm:px-5 py-2.5 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                Previous
              </button>
            </div>

            <div className="hidden sm:flex items-center gap-3">
              <button
                onClick={handleSkip}
                className="px-4 sm:px-5 py-2.5 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Skip
              </button>
              <button
                onClick={handleSaveAndNext}
                className="px-5 py-2.5 text-white text-sm font-bold rounded-xl transition-colors shadow-sm flex items-center gap-2 cursor-pointer hover:opacity-90"
                style={{ backgroundColor: instituteThemeColor || "#324158" }}
              >
                <span>
                  {isLastQuestionOverall
                    ? "Save & Next"
                    : isLastQuestionInSection && nextSectionTab
                      ? `Next Section: ${nextSectionTab.shortTitle}`
                      : "Save & Next"}
                </span>
                {isLastQuestionInSection && nextSectionTab ? <ArrowRight size={14} /> : null}
              </button>
            </div>
          </div>

          {/* Mobile Bottom Navigation Bar */}
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-3 py-2.5 flex items-center justify-between gap-2 z-40 sm:hidden shadow-[0_-4px_16px_rgba(0,0,0,0.08)] pb-[max(0.625rem,env(safe-area-inset-bottom))]">
            {/* Prev Button */}
            <button
              onClick={goPrev}
              disabled={isFirstQuestionOverall || (currentQ === 0 && !prevSectionTab)}
              className="flex-1 flex items-center justify-center gap-1 py-2.5 px-2 border border-gray-200 text-gray-700 text-xs font-bold rounded-xl active:bg-gray-100 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4 shrink-0" />
              <span>Prev</span>
            </button>

            {/* Skip Button */}
            <button
              onClick={handleSkip}
              className="flex-1 flex items-center justify-center gap-1 py-2.5 px-2 border border-gray-200 text-gray-700 text-xs font-bold rounded-xl active:bg-gray-100 transition-colors cursor-pointer"
            >
              <span>Skip</span>
            </button>

            {/* Next / Save & Next Button */}
            <button
              onClick={handleSaveAndNext}
              className="flex-1 flex items-center justify-center gap-1 py-2.5 px-2 text-white text-xs font-bold rounded-xl shadow-xs transition-colors truncate cursor-pointer active:opacity-80"
              style={{ backgroundColor: instituteThemeColor || "#324158" }}
            >
              <span className="truncate">
                {isLastQuestionOverall
                  ? "Next"
                  : isLastQuestionInSection && nextSectionTab
                    ? "Next Sec"
                    : "Save & Next"}
              </span>
              <ChevronRight className="w-4 h-4 shrink-0" />
            </button>

            {/* Submit Button */}
            <button
              onClick={handleSubmitExam}
              className="flex-1 flex items-center justify-center gap-1 py-2.5 px-2 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer bg-[#324158] hover:bg-[#253245] active:bg-[#1a2432]"
              title="Submit Examination"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Submit</span>
            </button>
          </div>
        </main>

        {/* Right sidebar — question palette */}
        <aside className={`fixed sm:static inset-y-0 right-0 w-[85vw] max-w-xs sm:w-68 bg-white border-l border-gray-200 flex flex-col overflow-y-auto shrink-0 z-50 transition-transform duration-300 ease-in-out transform shadow-2xl sm:shadow-none ${
          sidebarOpen ? 'translate-x-0' : 'translate-x-full sm:translate-x-0'
        }`}>
          {/* Header on mobile */}
          <div className="sm:hidden flex items-center justify-between p-3.5 border-b border-gray-100 bg-gray-50/80 sticky top-0 z-10 backdrop-blur-xs">
            <div>
              <p className="font-bold text-xs text-[#324158] uppercase tracking-wider">Question Palette</p>
              <p className="text-[11px] text-gray-500">{totalAnswered} of {totalQuestions} answered</p>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="p-1.5 hover:bg-gray-200 rounded-lg text-gray-500 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          {/* Camera in Sidebar - Top */}
          {isStarted && !examSubmitted && (exam?.settings?.proctoring?.faceDetection ?? exam?.proctoring?.faceDetection) && (
            <div className="p-3 border-b border-gray-100">
              <p className="text-[10px] font-bold text-gray-700 uppercase tracking-wider mb-2">Proctoring Camera</p>
              <div className="rounded-lg overflow-hidden border border-gray-300 bg-gray-900 aspect-video shadow-md">
                <ProctoringCamera onFaceEvent={(evt) => {
                  if (evt === "no-face") logEvent("no-face", "Face not visible in camera")
                  else if (evt === "multiple-faces") logEvent("multiple-faces", "Multiple faces detected — possible plagiarism")
                }} />
              </div>
              <div className="mt-2 text-[9px] text-gray-500 text-center">Face detection active</div>
            </div>
          )}

          {/* Legend */}
          <div className="p-3 border-b border-gray-100">
            <p className="text-[10px] font-bold text-gray-700 uppercase tracking-wider mb-2">Question Legend</p>
            <div className="grid grid-cols-2 gap-1.5">
              {(['answered', 'not-answered', 'review', 'not-visited'] as QuestionStatus[]).map((s) => (
                <div key={s} className="flex items-center gap-1.5">
                  <span className={`w-2.5 h-2.5 rounded-sm ${statusColorMap[s]}`} />
                  <span className="text-[10px] text-gray-600 capitalize font-medium">{s.replace("-", " ")}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Per-section palette grouped by section */}
          <div className="p-3 flex-1 space-y-4">
            {specificTabs.map((tab) => {
              const isCurrentSec = activeTab?.id === tab.id;
              const tabAnswered = tab.questions.filter((q) => {
                const a = getAnswer(q._id);
                return Array.isArray(a?.answer) ? a.answer.some(Boolean) : !!a?.answer;
              }).length;

              return (
                <div key={tab.id} className="rounded-2xl border border-gray-200/80 p-3 bg-gray-50/50 space-y-2">
                  <div className="flex items-center justify-between pb-1.5 border-b border-gray-200/60">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <p className="text-xs font-bold text-gray-800 truncate">{tab.title}</p>
                    </div>
                    <span className="text-[10px] text-emerald-700 font-black shrink-0 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-200">
                      {tabAnswered}/{tab.questions.length}
                    </span>
                  </div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {tab.questions.map((q, qi) => {
                      const ans = getAnswer(q._id)?.answer;
                      const isMarked = getAnswer(q._id)?.isMarkedForReview;
                      const hasAns = Array.isArray(ans) ? ans.some(Boolean) : !!ans;
                      const isVisited = visitedQuestionIds.includes(q._id);
                      const status = isMarked
                        ? "review"
                        : hasAns
                          ? "answered"
                          : isVisited
                            ? "not-answered"
                            : "not-visited";
                      const isCurrentQ = isCurrentSec && currentQ === qi;
                      return (
                        <button
                          key={q._id}
                          onClick={() => {
                            setActiveSectionId(tab.id);
                            setCurrentQ(qi);
                            setSectionPosMap(p => ({ ...p, [tab.id]: qi }));
                            setSidebarOpen(false);
                          }}
                          className={`w-8 h-8 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center ${
                            isCurrentQ ? "ring-2 ring-offset-1 ring-[#2D3A4A] scale-105 shadow-xs" : ""
                          } ${statusColorMap[status]}`}
                        >
                          {qi + 1}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Summary + submit */}
          <div className="p-3 border-t border-gray-100 bg-white sticky bottom-0">
            <div className="text-xs space-y-1.5 text-gray-600 mb-3">
              {[
                { label: "Answered", val: answers.filter((a) => Array.isArray(a.answer) ? a.answer.some(Boolean) : !!a.answer).length, color: "text-[#10B981]" },
                { label: "Not Answered", val: totalQuestions - totalAnswered, color: "text-red-500" },
                { label: "Marked for Review", val: answers.filter((a) => a.isMarkedForReview).length, color: "text-[#F59E0B]" },
              ].map(({ label, val, color }) => (
                <div key={label} className="flex justify-between">
                  <span className="font-medium">{label}</span>
                  <span className={`font-bold ${color}`}>{val}</span>
                </div>
              ))}
            </div>
            <button
              onClick={handleSubmitExam}
              disabled={submitting}
              className="w-full py-2.5 text-white text-xs font-bold rounded-xl transition-colors disabled:opacity-60 cursor-pointer shadow-sm flex items-center justify-center gap-1.5 bg-[#324158] hover:bg-[#253245] active:bg-[#1a2432]"
            >
              <span>{submitting ? "Submitting..." : "Submit Exam"}</span>
            </button>
          </div>
        </aside>
      </div>

      {/* Submission Confirmation Modal */}
      <ExamSubmitModal
        isOpen={showSubmitConfirm}
        onClose={() => setShowSubmitConfirm(false)}
        onConfirm={confirmSubmit}
        submitting={submitting}
        totalAnswered={totalAnswered}
        totalQuestions={totalQuestions}
        markedForReview={answers.filter(a => a.isMarkedForReview).length}
        warnings={procState.warnings}
        maxWarnings={exam.settings?.proctoring?.maxWarnings ?? exam.proctoring?.maxWarnings ?? 3}
      />

      {/* Virtual Calculator */}
      {Boolean(exam.settings?.allowCalculator || exam.settings?.enableCalculator || (exam as any)?.allowCalculator) && (
        <ScientificCalculator
          isOpen={showCalculator}
          onClose={() => setShowCalculator(false)}
        />
      )}
      {/* Exam Instructions Modal */}
      {showInstructionsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-4 border border-slate-200 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shadow-2xs">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">Exam Instructions</h3>
                  <p className="text-xs text-slate-400">Rules &amp; guidelines for this examination</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowInstructionsModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
              {(exam.instructions?.length ? exam.instructions : [
                "Read all questions carefully before answering.",
                "Do not switch tabs or exit the exam screen during the test.",
                "Ensure you have completed all required questions before finishing the exam.",
              ]).map((inst, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="w-6 h-6 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center shrink-0 shadow-2xs">
                    {idx + 1}
                  </span>
                  <p className="text-xs sm:text-sm text-slate-700 font-medium leading-relaxed pt-0.5">{inst}</p>
                </div>
              ))}
            </div>
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowInstructionsModal(false)}
                className="px-5 py-2 rounded-xl bg-[#1E293B] hover:bg-[#0F172A] text-white text-xs sm:text-sm font-semibold transition-colors cursor-pointer shadow-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Micro-notification toasts */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none text-right">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg text-sm font-semibold text-white animate-in slide-in-from-right-4 duration-300 ${
              t.type === "danger" ? "bg-red-600" : t.type === "info" ? "bg-blue-600" : "bg-amber-500"
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-white/70 shrink-0" />
            {t.message}
          </div>
        ))}
      </div>
    </div>
  )
}











