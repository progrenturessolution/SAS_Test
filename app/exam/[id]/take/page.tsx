"use client"

import { useState, useEffect, useCallback, use } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Editor from "@monaco-editor/react"
import { ExamHeader, ProctoringCamera, QuestionStatus, statusColorMap, ProcrentureLogo } from "@/components/exam/ExamShared"
import { Code, Shield, AlertCircle, FileText, Clock, CheckCircle2, Monitor, Wifi, Camera, Info, Play, ChevronLeft } from "lucide-react"
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

// ─── Micro-toast types ────────────────────────────────────────────────────────
interface Toast { id: number; message: string; type: "warn" | "info" | "danger" }
let _toastId = 0

interface Question {
  _id: string
  type: "mcq" | "truefalse" | "descriptive" | "fillblanks" | "coding"
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
  const [currentQ, setCurrentQ] = useState(0)
  const [answers, setAnswers] = useState<Answer[]>([])
  const [activeWarning, setActiveWarning] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [examSubmitted, setExamSubmitted] = useState(false)
  const [studentName, setStudentName] = useState("Student")
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
      currentSection,
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
  }, [attemptId, id, currentSection, currentQ, answers, blankInputs, timeLeft, codeLanguage])

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
        if (attempt && (attempt.status === "submitted" || attempt.status === "auto-submitted")) {
          const showResults = examRes.exam?.settings?.showResults ?? true
          if (showResults) {
            router.push(`/exam/${id}/result?attemptId=${attemptId}`)
          } else {
            router.push(`/exam/${id}/result/analytics?attemptId=${attemptId}`)
          }
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
                if (q.type === "mcq" && q.options && q.options.length > 0) {
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
          setStudentName(attempt.studentName || "Student")
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

  // Auto-submit
  const handleAutoSubmit = useCallback(async () => {
    if (!attemptId || submitting) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/attempts/${attemptId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers, autoSubmit: true, timeLeft }),
      })
      if (!res.ok) throw new Error('Network error')
      const data = await res.json()
      
      try { localStorage.removeItem(`exam-state-${id}`) } catch (e) {}

      // Stop camera and exit fullscreen
      setExamSubmitted(true)
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {})
      }
      
      if (data.showResults ?? true) {
        router.push(`/exam/${id}/result?attemptId=${attemptId}`)
      } else {
        router.push(`/exam/${id}/result/analytics?attemptId=${attemptId}`)
      }
    } catch (error) {
      try {
        localStorage.setItem(`exam-pending-submit-${attemptId}`, JSON.stringify({ answers, autoSubmit: true, timeLeft }))
      } catch(e) {}
      addToast("You are offline. Your exam state is saved locally. Please do not close the browser.", "danger")
      setSubmitting(false)
    }
  }, [attemptId, submitting, answers, exam, timeLeft, id, router, addToast])

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

      // Check if start time reached
      if (!startDt || now >= startDt.getTime()) {
        setCountdownTime(null)
        if (!scheduleStartReached) {
          setScheduleStartReached(true)
          setShowStartModal(true)
        }
      } else {
        const diffSecs = Math.ceil((startDt.getTime() - now) / 1000)
        setCountdownTime(diffSecs)
        setScheduleStartReached(false)
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

  // ��─ Navigation ──────────────────────────────────────────────────
  // goNext: Move to next question, but do NOT auto-submit after last question
  const goNext = () => {
    if (!exam) return
    // Use filteredQuestions for navigation (handles coding/non-coding tabs)
    if (currentQ < filteredQuestions.length - 1) {
      setCurrentQ(currentQ + 1)
    }
    // If at last question, do nothing (user will see submit screen handled below)
  }

  const goPrev = () => {
    if (!exam) return
    if (currentQ > 0) { setCurrentQ(currentQ - 1) }
    else if (currentSection > 0) {
      setCurrentSection(currentSection - 1)
      setCurrentQ(exam.sections[currentSection - 1].questions.length - 1)
    }
  }

  const handleSubmitExam = () => {
    setShowSubmitConfirm(true)
  }

  const confirmSubmit = async () => {
    if (!attemptId) return
    setSubmitting(true)
    setShowSubmitConfirm(false)
    try {
      const res = await fetch(`/api/attempts/${attemptId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers, autoSubmit: false, timeLeft }),
      })
      if (!res.ok) throw new Error("Submit failed")
      const data = await res.json()
      // Clear saved state
      try { localStorage.removeItem(`exam-state-${id}`) } catch {}
      // Stop camera and exit fullscreen
      setExamSubmitted(true)
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
      if (data.showResults ?? true) {
        router.push(`/exam/${id}/result?attemptId=${attemptId}`)
      } else {
        router.push(`/exam/${id}/result/analytics?attemptId=${attemptId}`)
      }
    } catch {
      addToast("Submission failed. Please try again.", "danger")
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

  // ── Loading / Error / Instructions ──────────────────────────────────────────

  if (loading || !exam) {
    return <ExamTakingSkeleton />
  }

    if (!isStarted) {
    const isFaceDetectionEnabled = exam?.settings?.proctoring?.faceDetection ?? exam?.proctoring?.faceDetection;
    const rules = exam.instructions?.length ? exam.instructions : [
      "The exam consists of multiple-choice questions. Each question carries equal marks unless otherwise specified.",
      "You can navigate between questions using the Previous and Next buttons. Questions can be answered in any order.",
      'Use the "Mark for Review" feature to flag questions you want to revisit before final submission.',
      "The timer will be displayed on the screen. Once time expires, your answers will be automatically submitted.",
      "There is no negative marking. Attempt all questions to maximize your score.",
      "Review your answers carefully before clicking the Submit button. Once submitted, you cannot change your answers."
    ];

    return (
      <div className="min-h-screen bg-gray-50 flex flex-col p-4 md:p-8 animate-in fade-in duration-500">
        {/* Top Header */}
        <div className="max-w-6xl mx-auto w-full flex items-center justify-between mb-8">
          <ProcrentureLogo />
          <Button variant="outline" className="rounded-xl font-bold text-[#2D3A4A] border-gray-200">
            need help ?
          </Button>
        </div>

        <div className="max-w-6xl mx-auto w-full flex-1">
          {/* Breadcrumb replacement */}
          <div className="flex items-center gap-2 text-sm text-gray-400 mb-6 font-medium">
            <span>Exams</span>
            <span className="text-gray-300">/</span>
            <span className="text-gray-600">General Instructions</span>
          </div>

          <h1 className="text-4xl font-black text-[#2D3A4A] mb-2 tracking-tight">General Instructions</h1>
          <p className="text-gray-500 font-medium mb-8">Please read all instructions carefully before starting your exam</p>

          {/* Scheduled Status Banner */}
          {isExamEnded && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-5 mb-8 flex items-center justify-between gap-4 shadow-sm animate-in fade-in">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center text-red-600 shrink-0">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-red-600 uppercase tracking-wider">Examination Window Closed</p>
                  <p className="text-sm font-bold text-[#2D3A4A]">The scheduled time for this exam has ended. You can no longer start this exam.</p>
                </div>
              </div>
            </div>
          )}

          {!scheduleStartReached && countdownTime !== null && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-8 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm animate-in fade-in">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-700 shrink-0">
                  <Clock className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <p className="text-xs font-black text-amber-600 uppercase tracking-widest">Scheduled Start Time</p>
                  <p className="text-base font-bold text-[#2D3A4A]">
                    Exam starts at {formatScheduleDateTime(getExamStartDateTime(exam.settings))}
                  </p>
                  <p className="text-xs text-gray-500 font-medium">Please review the rules below. The start button will automatically unlock at the exact start time.</p>
                </div>
              </div>
              <div className="text-center sm:text-right bg-white px-5 py-3 rounded-xl border border-amber-200 shadow-sm shrink-0">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Starts in</span>
                <span className="text-2xl font-black font-mono text-amber-600">{formatCountdown(countdownTime)}</span>
              </div>
            </div>
          )}

          {scheduleStartReached && !isExamEnded && exam.settings?.endDate && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mb-8 flex items-center justify-between gap-4 text-xs text-emerald-800 shadow-sm">
              <div className="flex items-center gap-2.5">
                <Clock className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  Exam is active. Scheduled to close & auto-submit at: <strong className="font-bold text-emerald-950">{formatScheduleDateTime(getExamEndDateTime(exam.settings))}</strong>
                </span>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-600 text-white px-2.5 py-0.5 rounded-full shrink-0">
                Active
              </span>
            </div>
          )}

          {/* Info Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Card className="bg-white border-gray-100 shadow-sm rounded-2xl">
              <CardContent className="p-6 flex flex-col items-center text-center gap-2">
                <Clock className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Duration</p>
                  <p className="text-lg font-black text-[#2D3A4A]">{exam.duration} Minutes</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white border-gray-100 shadow-sm rounded-2xl">
              <CardContent className="p-6 flex flex-col items-center text-center gap-2">
                <FileText className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Questions</p>
                  <p className="text-lg font-black text-[#2D3A4A]">{exam.sections.flatMap(s => s.questions).length} Questions</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white border-gray-100 shadow-sm rounded-2xl">
              <CardContent className="p-6 flex flex-col items-center text-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Marks</p>
                  <p className="text-lg font-black text-[#2D3A4A]">{exam.totalMarks} Marks</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white border-gray-100 shadow-sm rounded-2xl">
              <CardContent className="p-6 flex flex-col items-center text-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Passing Score</p>
                  <p className="text-lg font-black text-[#2D3A4A]">{Math.round((exam.passMarks / exam.totalMarks) * 100)}%</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-8 mb-8">
            {/* Rules Section */}
            <Card className="bg-white border-gray-100 shadow-sm rounded-2xl overflow-hidden">
              <CardContent className="p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-1 h-6 bg-[#2D3A4A] rounded-full" />
                  <h2 className="text-xl font-black text-[#2D3A4A]">Exam Rules & Guidelines</h2>
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
                  <div className="w-1 h-6 bg-[#2D3A4A] rounded-full" />
                  <h2 className="text-xl font-black text-[#2D3A4A]">Technical Requirements</h2>
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
                        <h4 className="font-black text-[#2D3A4A] mb-1">Camera Verification</h4>
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
              <CardContent className="p-8 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-start gap-4 flex-1">
                  <Checkbox 
                    id="agreement" 
                    checked={agreed} 
                    onCheckedChange={(checked) => setAgreed(!!checked)} 
                    className="mt-1 w-5 h-5 rounded-md border-gray-300 data-[state=checked]:bg-[#2D3A4A] data-[state=checked]:border-[#2D3A4A]"
                  />
                  <label htmlFor="agreement" className="text-sm text-gray-500 font-medium cursor-pointer leading-tight">
                    I have read and understood all the instructions and agree to abide by the exam rules.
                  </label>
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                  <Button 
                    variant="outline" 
                    className="flex-1 md:flex-none h-12 px-8 rounded-xl font-bold text-gray-500 border-gray-200"
                    onClick={() => router.back()}
                  >
                    Go Back
                  </Button>
                  <Button 
                    disabled={!agreed || (isFaceDetectionEnabled && camStatus !== "active") || !scheduleStartReached || isExamEnded}
                    onClick={() => setIsStarted(true)}
                    className="flex-1 md:flex-none h-12 px-10 rounded-xl font-black uppercase text-xs tracking-widest bg-[#2D3A4A] text-white hover:bg-[#1a2535] shadow-xl shadow-[#2D3A4A]/20 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isExamEnded 
                      ? "Exam Ended" 
                      : !scheduleStartReached && countdownTime !== null 
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
              <h2 className="text-2xl font-black text-[#303e52] mb-3">Time to Start</h2>
              <p className="text-slate-400 text-sm font-medium mb-8">The examination is scheduled to begin now. Click below to enter the room.</p>
              <button
                onClick={() => {
                  setShowStartModal(false)
                  setIsStarted(true)
                }}
                className="w-full py-4 bg-[#303e52] text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-[1.03] transition-all shadow-xl shadow-primary/20"
              >
                Start Examination
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- Section/question logic for separated tabs ---
  // -1: Questions (non-coding), -2: Coding Problems, >=0: original section
  let section: Section | null = null
  let question: Question | null = null
  let filteredQuestions: Question[] = []
  if (currentSection === -1) {
    // Only non-coding questions in Questions tab
    filteredQuestions = exam.sections.flatMap(sec => sec.questions.filter(q => q.type !== "coding"))
    question = filteredQuestions[currentQ] || null
  } else if (currentSection === -2) {
    // Only coding questions in Coding Problems tab
    filteredQuestions = exam.sections.flatMap(sec => sec.questions.filter(q => q.type === "coding"))
    question = filteredQuestions[currentQ] || null
  } else {
    // For section tabs, filter out coding questions from display and navigation
    section = exam.sections[currentSection]
    if (section) {
      const nonCodingQuestions = section.questions.filter(q => q.type !== "coding")
      filteredQuestions = nonCodingQuestions
      question = nonCodingQuestions[currentQ] || null
    }
  }

  // If user has finished all questions in the current tab, show a submit screen/button
  if (!question) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <h2 className="text-2xl font-bold mb-4 text-foreground">You have reached the end of this section.</h2>
        <p className="mb-6 text-gray-600">Please review your answers or submit your exam when ready.</p>
        <button
          onClick={handleSubmitExam}
          className="px-8 py-3 bg-[#10B981] text-white text-lg font-bold rounded-xl hover:bg-[#059669] transition-colors"
          disabled={submitting}
        >
          {submitting ? "Submitting..." : "Submit Exam"}
        </button>
      </div>
    )
  }

  const allQuestions = exam.sections.flatMap(sec => sec.questions)
  const totalQuestions = allQuestions.length
  const totalAnswered = answers.filter((a) => Array.isArray(a.answer) ? a.answer.some(Boolean) : !!a.answer).length
  const hasCodingQuestions = exam.sections.some(sec => sec.questions.some(q => q.type === "coding"))
  const hasNonCodingQuestions = exam.sections.some(sec => sec.questions.some(q => q.type !== "coding"))
  const answeredInSection = currentSection >= 0 && section ? section.questions.filter((q) => {
    const a = getAnswer(q._id)
    return Array.isArray(a?.answer) ? a!.answer.some(Boolean) : !!a?.answer
  }).length : 0

  const optionKeys = ["A", "B", "C", "D", "E"]

  const isFullscreenRequired = exam?.settings?.proctoring?.fullscreenExit ?? exam?.proctoring?.fullscreenExit;

  return (
    <div onContextMenu={(e) => { e.preventDefault(); addToast("Right-click is restricted during the exam", "warn"); }} className="flex flex-col h-screen bg-gray-50 overflow-hidden select-none">
      {!procState.isFullscreen && isFullscreenRequired && (
        <div className="fixed inset-0 z-100 flex flex-col items-center justify-center bg-black/95 backdrop-blur-sm text-white p-8">
          <AlertCircle size={64} className="text-red-500 mb-6 animate-pulse" />
          <h1 className="text-4xl font-black mb-4 text-center tracking-tight">Fullscreen Required</h1>
          <p className="text-gray-300 text-center max-w-lg mb-8 leading-relaxed text-lg">
            This exam must be taken in fullscreen mode to prevent plagiarism. Your exam is temporarily paused (timer is still running on the server).
          </p>
          <button 
            onClick={requestFullscreen}
            className="px-10 py-5 bg-primary text-white rounded-2xl font-bold text-lg hover:bg-accent transition-all transform hover:scale-105 active:scale-95 shadow-xl flex items-center gap-3"
          >
            <Shield size={24} />
            Return to Fullscreen
          </button>
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

        return (
          <ExamHeader
            title={exam.title}
            section={section ? section.name : (currentSection === -2 ? "Coding Problems" : "Questions")}
            timeLeft={timeLeft}
            duration={exam.duration * 60}
            studentName={studentName}
            rollNo={studentRoll}
            onSubmit={handleSubmitExam}
            warningCount={procState.warnings}
            maxWarnings={exam.settings?.proctoring?.maxWarnings ?? exam.proctoring?.maxWarnings ?? 3}
            endTimeLabel={endTimeLabel}
          />
        )
      })()}

      {/* Section Tabs: Questions and Coding Problems */}
      <div className="bg-white border-b border-gray-200 px-3 sm:px-4 py-2 flex items-center gap-2 overflow-x-auto shrink-0 sticky top-0 z-20">
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="sm:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
        {hasNonCodingQuestions && (
          <button
            className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap transition-all flex items-center gap-2 ${currentSection === -1 ? "bg-accent text-white shadow-sm" : "text-gray-500 hover:bg-gray-100"}`}
            onClick={() => { setCurrentSection(-1); setCurrentQ(0); setSidebarOpen(false) }}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>
            Questions
            <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${currentSection === -1 ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"}`}>
              {exam.sections.flatMap(sec => sec.questions.filter(q => q.type !== "coding")).length}
            </span>
          </button>
        )}
        {hasCodingQuestions && (
          <button
            className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap transition-all flex items-center gap-2 ${currentSection === -2 ? "bg-accent text-white shadow-sm" : "text-gray-500 hover:bg-gray-100"}`}
            onClick={() => { setCurrentSection(-2); setCurrentQ(0); setSidebarOpen(false) }}
          >
            <Code className="w-3.5 h-3.5" />
            <span className="inline">Coding Problems</span>
            <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${currentSection === -2 ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"}`}>
              {exam.sections.flatMap(sec => sec.questions.filter(q => q.type === "coding")).length}
            </span>
          </button>
        )}
        <div className="ml-auto flex items-center gap-3">
          <div className="hidden sm:flex flex-col items-end">
             <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-emerald-500 transition-all duration-500" 
                  style={{ width: `${(totalAnswered/totalQuestions)*100}%` }}
                />
             </div>
          </div>
          <span className="text-xs sm:text-sm font-bold text-emerald-600 whitespace-nowrap bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100">
            {totalAnswered}/{totalQuestions}
          </span>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Mobile overlay */}
        {sidebarOpen && <div className="fixed inset-0 bg-black/40 sm:hidden z-40" onClick={() => setSidebarOpen(false)} />}
        {/* Main question area */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-4" style={{ maxHeight: 'calc(100vh - 140px)', overflowY: 'auto' }}>
          {/* Section header and instructions */}
          {currentSection === -1 && (
            <div className="mb-3 flex items-center gap-2">
              <span className="inline-flex items-center px-2 py-1 bg-accent text-white rounded-lg font-semibold text-xs"><svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>Q&A</span>
            </div>
          )}
          {currentSection === -2 && (
            <div className="mb-3 flex items-center gap-2">
              <span className="inline-flex items-center px-2 py-1 bg-[#059669] text-white rounded-lg font-semibold text-xs"><Code className="w-4 h-4 mr-1" />Code</span>
            </div>
          )}
          {/* Question meta */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center shrink-0">
              <span className="text-white font-bold text-xs">Q{currentQ + 1}</span>
            </div>
            <span className="px-2 py-1 bg-gray-100 text-gray-600 text-[10px] font-semibold rounded-full uppercase">
              {question.type === "fillblanks" ? "Fill" : question.type === "truefalse" ? "T/F" : question.type}
            </span>
            <span className="px-2 py-1 bg-gray-100 text-gray-600 text-[10px] font-semibold rounded-full">
              {question.marks}pts
            </span>
            {question.difficulty && (
              <span className={`px-3 py-1.5 text-xs font-semibold rounded-full ${
                question.difficulty === "easy" ? "bg-green-100 text-green-600" :
                question.difficulty === "medium" ? "bg-blue-100 text-blue-600" :
                "bg-red-100 text-red-600"
              }`}>
                {question.difficulty.charAt(0).toUpperCase() + question.difficulty.slice(1)}
              </span>
            )}
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => toggleReview(question._id, section?.type || question.type || "unknown")}
                className={`px-4 py-2 text-sm font-semibold border rounded-xl transition-colors ${
                  isReview(question._id)
                    ? "border-[#F59E0B] bg-amber-50 text-[#F59E0B]"
                    : "border-[#F59E0B] text-[#F59E0B] hover:bg-amber-50"
                }`}
              >
                {isReview(question._id) ? "Marked for Review" : "Mark for Review"}
              </button>
              <button
                onClick={() => setAnswer(question._id, "", section?.type || question.type || "unknown", true)}
                className="px-4 py-2 text-sm font-semibold border border-gray-300 text-gray-600 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Clear Option
              </button>
            </div>
          </div>

          {/* Question text (non-coding) */}
          {question.type !== "coding" && (
            <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-5 space-y-4">
              <div className="text-foreground font-bold text-base leading-relaxed">
                <MathRenderer content={question.questionText} />
              </div>
              {question.questionImage && (
                <div className="relative w-full max-h-100 rounded-xl overflow-hidden border border-gray-100 bg-gray-50 shadow-sm flex items-center justify-center">
                   <img src={question.questionImage} alt="Question" className="max-w-full max-h-100 object-contain" />
                </div>
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

          {/* MCQ */}
          {question.type === "mcq" && question.options && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              {(question.shuffledOptionIndices || question.options!.map((_, i) => i)).map((shuffledIndex, oi) => {
                const opt = question.options![shuffledIndex]
                const optImg = question.optionImages?.[shuffledIndex]
                const key = optionKeys[oi] || String(oi)
                const originalKey = optionKeys[shuffledIndex] || String(shuffledIndex)
                const selected = getAnswer(question._id)?.answer === originalKey
                return (
                  <button
                    key={oi}
                    onClick={() => setAnswer(question._id, originalKey, section?.type || question.type || "mcq", true)}
                    className={`flex flex-col border-2 rounded-2xl text-left transition-all min-h-20 sm:min-h-auto ${
                      selected ? "border-primary bg-blue-50/20" : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    {optImg && (
                      <div className="w-full aspect-video bg-gray-50 border-b border-gray-100 flex items-center justify-center overflow-hidden">
                         <img src={optImg} alt={`Option ${key}`} className="w-full h-full object-contain" />
                      </div>
                    )}
                    <div className="flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3 sm:py-4">
                       <div className={`w-10 h-10 sm:w-8 sm:h-8 rounded-full border-2 flex items-center justify-center shrink-0 font-bold text-sm ${
                         selected ? "border-primary bg-primary text-white" : "border-gray-300 text-gray-500"
                       }`}>{key}</div>
                       <div className={`font-bold text-sm sm:text-base flex-1 ${selected ? "text-foreground" : "text-gray-600"}`}>
                         <MathRenderer content={opt} />
                       </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          {/* True / False */}
          {question.type === "truefalse" && (
            <div className="flex gap-4">
              {["True", "False"].map((val) => {
                const selected = getAnswer(question._id)?.answer === val
                return (
                  <button
                    key={val}
                    onClick={() => setAnswer(question._id, val, section?.type || question.type)}
                    className={`flex-1 py-6 border-2 rounded-2xl text-center font-bold text-lg transition-all ${
                      selected ? "border-[#2D3A4A] bg-[#2D3A4A] text-white" : "border-gray-200 bg-white hover:border-gray-300 text-gray-600"
                    }`}
                  >
                    {val}
                  </button>
                )
              })}
            </div>
          )}

          {/* Descriptive */}
          {question.type === "descriptive" && (
            <div>
              <textarea
                rows={8}
                placeholder="Write your answer here..."
                value={(getAnswer(question._id)?.answer as string) || ""}
                onChange={(e) => setAnswer(question._id, e.target.value, section?.type || question.type)}
                className="w-full border-2 border-gray-200 rounded-2xl p-4 text-sm text-[#1a2535] focus:outline-none focus:border-[#2D3A4A] resize-none transition-colors"
              />
              {question.wordLimit && (
                <p className="text-xs text-gray-400 mt-1 text-right">
                  {((getAnswer(question._id)?.answer as string) || "").trim().split(/\s+/).filter(Boolean).length} / {question.wordLimit} words
                </p>
              )}
            </div>
          )}

          {/* Fill in the Blanks */}
          {question.type === "fillblanks" && question.blanks && (
            <div className="space-y-4">
              {question.blanks.map((blank, bi) => {
                const inputs = blankInputs[question._id] || []
                return (
                  <div key={bi} className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-full bg-[#F59E0B] text-white text-xs font-bold flex items-center justify-center shrink-0">{bi + 1}</span>
                    <label className="text-sm text-gray-600 font-medium min-w-0 truncate">{blank.label || `Blank ${bi + 1}`}</label>
                    <input
                      type="text"
                      placeholder={`Answer for blank ${bi + 1}`}
                      value={inputs[bi] || ""}
                      onChange={(e) => {
                        const updated = [...(blankInputs[question._id] || question.blanks!.map(() => ""))]
                        updated[bi] = e.target.value
                        setBlankInputs((prev) => ({ ...prev, [question._id]: updated }))
                        setAnswer(question._id, updated, section?.type || question.type)
                      }}
                      className="flex-1 border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#F59E0B] transition-colors"
                    />
                  </div>
                )
              })}
            </div>
          )}

          {/* Coding — LeetCode-style layout */}
          {question.type === "coding" && (() => {
            const qId = question._id
            const lang = codeLanguage[qId] || "python"
            const code = (getAnswer(qId)?.answer as string) || (question.codeTemplates && question.codeTemplates[lang]) || question.codeTemplate || ""
            const visibleCases = (question.testCases || []).filter(tc => !tc.hidden)
            const results = testCaseResults[qId] || []
            const visibleResults = results.filter(r => !r.hidden)
            const activeCase = activeTestCase[qId] ?? 0
            const isRunning = testCaseRunning[qId]
            const submitted = codeSubmitted[qId]
            const allPassed = submitted && results.length > 0 && results.every(r => r.passed)
            const passedCount = results.filter(r => r.passed).length

            const DIFF_COLOR: Record<string, string> = {
              easy: "text-green-400", medium: "text-yellow-400", hard: "text-red-400"
            }

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
                      <span className="text-sm font-bold text-[#1a2535]">Problem</span>
                      <span className={`text-xs font-semibold capitalize ${DIFF_COLOR[question.difficulty || "medium"]}`}>
                        {question.difficulty || "medium"}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-gray-400">{question.marks} pts</span>
                  </div>
                  <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                    <p className="text-sm text-[#1a2535] leading-relaxed whitespace-pre-wrap">{question.questionText}</p>
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
                          : ["Python"]; // DEFAULT FALLBACK
                        
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
                            <div className="a`absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg>
                            </div>
                          </div>
                        )
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
                        onChange={(val) => setAnswer(qId, val || "", section?.type || "coding")}
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
                          // Performance and Stability fixes for "ERR Canceled"
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
                        {/* Tab for each visible test case */}
                        {visibleCases.map((_, ti) => {
                          const res = visibleResults[ti]
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
                          )
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
            )
          })()}

          {/* Navigation buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-6 sm:mt-8 pb-20 sm:pb-0">
            <button
              onClick={goPrev}
              disabled={currentQ === 0 && currentSection === 0}
              className="hidden sm:block px-4 sm:px-5 py-3 sm:py-2.5 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <div className="hidden sm:flex items-center gap-2">
              <button
                onClick={async () => {
                  await setAnswer(question._id, getAnswer(question._id)?.answer || "", section?.type || question.type, true);
                  goNext();
                }}
                className="px-4 sm:px-5 py-3 sm:py-2.5 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-colors"
              >
                Skip
              </button>
              <button
                onClick={async () => {
                  await setAnswer(question._id, getAnswer(question._id)?.answer || "", section?.type || question.type, true);
                  goNext();
                }}
                className="px-4 sm:px-6 py-3 sm:py-2.5 bg-[#2D3A4A] text-white text-sm font-bold rounded-xl hover:bg-[#1a2535] transition-colors"
              >
                Save & Next
              </button>
            </div>
          </div>

          {/* Mobile Bottom Navigation Bar */}
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-3 flex items-center justify-between gap-3 z-50 sm:hidden">
            <button
              onClick={goPrev}
              disabled={currentQ === 0 && currentSection === 0}
              className="flex-1 flex items-center justify-center gap-2 py-3 border border-gray-200 text-gray-600 text-sm font-bold rounded-xl active:bg-gray-100 disabled:opacity-30 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
              Prev
            </button>
            <button
              onClick={async () => {
                await setAnswer(question._id, getAnswer(question._id)?.answer || "", section?.type || question.type, true);
                goNext();
              }}
              className="flex-1 flex items-center justify-center gap-2 py-3 border border-gray-200 text-gray-600 text-sm font-bold rounded-xl active:bg-gray-100 transition-colors"
            >
              Skip
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 5l7 7-7 7" /></svg>
            </button>
            <button
              onClick={async () => {
                await setAnswer(question._id, getAnswer(question._id)?.answer || "", section?.type || question.type, true);
                goNext();
              }}
              className="flex-[1.5] flex items-center justify-center gap-2 py-3 bg-[#2D3A4A] text-white text-sm font-bold rounded-xl active:bg-[#1a2535] shadow-lg transition-colors"
            >
              Save & Next
              <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
            </button>
          </div>
        </main>

        {/* Right sidebar — question palette */}
        <aside className={`fixed sm:static inset-y-0 right-0 w-64 sm:w-56 bg-white border-l border-gray-200 flex flex-col overflow-y-auto shrink-0 z-40 transition-transform transform ${
          sidebarOpen ? 'translate-x-0' : 'translate-x-full sm:translate-x-0'
        }`}>
          {/* Close button on mobile */}
          <button onClick={() => setSidebarOpen(false)} className="sm:hidden a`absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-lg transition-colors z-50">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
          {/* Camera in Sidebar - Top */}
          {isStarted && !examSubmitted && (exam?.settings?.proctoring?.faceDetection ?? exam?.proctoring?.faceDetection) && (
            <div className="p-3 border-b border-gray-100 mt-10 sm:mt-0">
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
            <p className="text-[10px] font-bold text-gray-700 uppercase tracking-wider mb-2">Question Palette</p>
            <div className="grid grid-cols-2 gap-1">
              {(["answered", "not-answered", "review", "not-visited"] as QuestionStatus[]).map((s) => (
                <div key={s} className="flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-sm ${statusColorMap[s]}`} />
                  <span className="text-[9px] text-gray-500 capitalize">{s.replace("-", " ")}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Per-section palette */}
          <div className="p-3 flex-1 space-y-3">
            {currentSection === -2 ? (
              // Coding Problems tab: show only coding questions in palette
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider truncate">Coding Problems</p>
                  <span className="text-xs text-[#10B981] font-semibold ml-1 shrink-0">
                    {exam.sections.flatMap(sec => sec.questions.filter(q => q.type === "coding")).filter((q) => { const a = getAnswer(q._id); return Array.isArray(a?.answer) ? a!.answer.some(Boolean) : !!a?.answer }).length}
                    /
                    {exam.sections.flatMap(sec => sec.questions.filter(q => q.type === "coding")).length}
                  </span>
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
                  {exam.sections.flatMap(sec => sec.questions.filter(q => q.type === "coding")).map((q, qi) => {
                    const ans = getAnswer(q._id)?.answer
                    const status = getAnswer(q._id)?.isMarkedForReview
                      ? "review"
                      : (Array.isArray(ans) ? ans.some(Boolean) : !!ans)
                        ? "answered"
                        : "not-answered"
                    return (
                      <button
                        key={q._id}
                        onClick={() => { setCurrentSection(-2); setCurrentQ(qi); setSidebarOpen(false) }}
                        className={`w-9 h-9 sm:w-8 sm:h-8 rounded-full text-xs font-semibold transition-all ${currentSection === -2 && currentQ === qi ? "ring-2 ring-offset-1 ring-[#2D3A4A] " : ""}${statusColorMap[status]}`}
                      >
                        {qi + 1}
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : (
              // Default: show per-section palette for non-coding questions
              exam.sections.map((sec, si) => {
                const nonCodingQuestions = sec.questions.filter(q => q.type !== "coding")
                if (nonCodingQuestions.length === 0) return null
                return (
                  <div key={si}>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider truncate">{sec.name}</p>
                      <span className="text-xs text-[#10B981] font-semibold ml-1 shrink-0">
                        {nonCodingQuestions.filter((q) => { const a = getAnswer(q._id); const ans = a?.answer; return Array.isArray(ans) ? ans.some(Boolean) : !!ans }).length}/{nonCodingQuestions.length}
                      </span>
                    </div>
                    <div className="grid grid-cols-6 gap-1.5">
                      {nonCodingQuestions.map((q, qi) => {
                        const ans = getAnswer(q._id)?.answer
                        const status = getAnswer(q._id)?.isMarkedForReview
                          ? "review"
                          : (Array.isArray(ans) ? ans.some(Boolean) : !!ans)
                            ? "answered"
                            : "not-answered"
                        return (
                          <button
                            key={q._id}
                            onClick={() => { setCurrentSection(si); setCurrentQ(qi) }}
                            className={`w-8 h-8 rounded-full text-xs font-semibold transition-all ${si === currentSection && qi === currentQ ? "ring-2 ring-offset-1 ring-[#2D3A4A] " : ""}${statusColorMap[status]}`}
                          >
                            {qi + 1}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Summary + submit */}
          <div className="p-3 border-t border-gray-100">
            <div className="text-xs space-y-1 text-gray-600 mb-3">
              {[
                { label: "Answered", val: answers.filter((a) => Array.isArray(a.answer) ? a.answer.some(Boolean) : !!a.answer).length, color: "text-[#10B981]" },
                { label: "Not Answered", val: totalQuestions - totalAnswered, color: "text-red-500" },
                { label: "Marked for Review", val: answers.filter((a) => a.isMarkedForReview).length, color: "text-[#F59E0B]" },
              ].map(({ label, val, color }) => (
                <div key={label} className="flex justify-between">
                  <span>{label}</span>
                  <span className={`font-semibold ${color}`}>{val}</span>
                </div>
              ))}
            </div>
            <button
              onClick={handleSubmitExam}
              disabled={submitting}
              className="w-full py-2 bg-[#10B981] text-white text-xs font-bold rounded-lg hover:bg-[#059669] transition-colors disabled:opacity-60"
            >
              {submitting ? "Submitting..." : "Submit"}
            </button>
          </div>
        </aside>
      </div>

      {/* Submission Confirmation Modal */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
          <div className="a`absolute inset-0 bg-[#1a2535]/80 backdrop-blur-sm" onClick={() => setShowSubmitConfirm(false)} />
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md relative overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-[#2D3A4A] p-6 text-white text-center">
              <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <FileText size={32} />
              </div>
              <h3 className="text-xl font-bold">Ready to Submit?</h3>
              <p className="text-sm opacity-70">Please review your attempt summary below.</p>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="bg-green-50 p-4 rounded-2xl border border-green-100">
                  <p className="text-[10px] font-bold text-green-600 uppercase mb-1">Answered</p>
                  <p className="text-2xl font-black text-green-700">{totalAnswered}</p>
                </div>
                <div className="bg-red-50 p-4 rounded-2xl border border-red-100">
                  <p className="text-[10px] font-bold text-red-600 uppercase mb-1">Remaining</p>
                  <p className="text-2xl font-black text-red-700">{totalQuestions - totalAnswered}</p>
                </div>
              </div>

              <div className="space-y-3 mb-8">
                <div className="flex items-center justify-between text-sm py-2 border-b border-gray-100">
                  <span className="text-gray-500 font-medium">Total Questions</span>
                  <span className="font-bold text-[#1a2535]">{totalQuestions}</span>
                </div>
                <div className="flex items-center justify-between text-sm py-2 border-b border-gray-100">
                  <span className="text-gray-500 font-medium">Marked for Review</span>
                  <span className="font-bold text-amber-500">{answers.filter(a => a.isMarkedForReview).length}</span>
                </div>
                <div className="flex items-center justify-between text-sm py-2 border-b border-gray-100">
                  <span className="text-gray-500 font-medium">Proctoring Warnings</span>
                  <span className={`font-bold ${procState.warnings > 0 ? "text-red-500" : "text-green-500"}`}>
                    {procState.warnings} / {exam.settings?.proctoring?.maxWarnings ?? exam.proctoring?.maxWarnings}
                  </span>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowSubmitConfirm(false)}
                  className="flex-1 py-3 border border-gray-200 text-gray-600 font-bold rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmSubmit}
                  className="flex-1 py-3 bg-[#10B981] text-white font-bold rounded-xl hover:bg-[#059669] shadow-lg shadow-green-200 transition-colors"
                >
                  Confirm & Submit
                </button>
              </div>
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











