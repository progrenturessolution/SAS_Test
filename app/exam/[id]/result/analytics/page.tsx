"use client"

import { SubmissionConfirmation } from "@/components/exam/SubmissionConfirmation"

import { useState, useEffect, use, useMemo, Suspense, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer
} from "recharts"
import {
  CheckCircle2, XCircle, BarChart2, ChevronDown,
  Download, Printer, Share2, HelpCircle, Target, FileText,
  TrendingUp, EyeOff, LayoutDashboard, Mail, Calendar, Check, Bell, Award, Sparkles
} from "lucide-react"
import { ProcrentureLogo } from "@/components/exam/BrandLogo"
import { MathRenderer } from "@/components/exam/MathRenderer"
import { QuestionDiagram } from "@/components/exam/QuestionDiagram"
import { ResultAnalyticsSkeleton } from "@/components/SkeletonLoaders"
import katex from "katex"
import "katex/dist/katex.min.css"
import "katex/contrib/mhchem"
import {
  evaluateObjectiveAnswer,
  formatOptionDisplay,
  getFormattedOptionItems,
  isObjectiveFormat,
  parseAssertionReasonText,
} from "@/lib/ai/questionEvaluation"
import { normalizeCompareText, normalizeFormatInput, normalizeTrueFalseAnswer } from "@/lib/ai/canonicalSchema"
import { findAnswerForQuestion, getExamPortalUrl, resolveAnalyticsDisplayScore } from "@/lib/attemptHelpers"
import { normalizeMathContent } from "@/lib/mathFormat"

// ─── Types ─────────────────────────────────────────────────────────────────────

interface QuestionData {
  _id: string
  type: "mcq" | "mcq_multi" | "diagram" | "assertion" | "truefalse" | "descriptive" | "fillblanks" | "coding"
  questionFormat?: string
  questionText: string
  questionImage?: string
  codeSnippet?: string
  options?: string[]
  optionImages?: string[]
  correctAnswer?: string | string[]
  modelAnswer?: string
  rubric?: string[]
  marks: number
  negativeMark?: number
  scoringMode?: "all" | "partial"
  difficulty?: string
  blanks?: { id: number; label: string; answer: string; alsoAccept?: string[] }[]
  explanation?: string
}

interface SectionData {
  name: string
  type: string
  negativeMarking?: boolean
  sectionNegativeMark?: number
  questions: QuestionData[]
}

interface AnswerData {
  questionId: string
  sectionType: string
  answer: string | string[]
  correct?: boolean
  isCorrect?: boolean
  marks?: number
  manualScore?: number
  earnedMarks?: number
  totalPassed?: number
  totalCases?: number
  testResults?: { passed: boolean }[]
  feedback?: string
  aiEvaluation?: {
    score?: number
    maxScore?: number
    verdict?: string
    whyRight?: string
    whyWrong?: string
    feedback?: string
  }
}

interface AttemptResult {
  _id: string
  examId: {
    _id: string; title: string; totalMarks: number; passMarks: number; duration: number; subject?: string;
    institute?: { name: string; code?: string; logo?: string | null; themeColor?: string }
  }
  studentName: string
  studentEmail: string
  rollNumber: string
  candidateType?: "institute" | "public"
  score: number
  manualScore?: number
  maxScore: number
  percentage: number
  passed: boolean
  timeSpent: number
  submittedAt: string
  startedAt?: string
  status: "in-progress" | "submitted" | "auto-submitted" | "graded"
  isGraded?: boolean
  sectionResults?: {
    name: string
    type: string
    attempted: number
    total: number
    correctOrMarked: number
    score: number
    maxScore: number
  }[]
  answers: AnswerData[]
}

interface ExamFullData {
  _id: string
  title: string
  subject: string
  description: string
  totalMarks: number
  passMarks: number
  duration: number
  sections: SectionData[]
  institute?: {
    name: string
    code?: string
    logo?: string | null
    themeColor?: string
  }
  settings?: {
    negativeMarking?: boolean
  }
  class?: string
}

interface SectionAnalysis {
  name: string
  type: string
  totalQuestions: number
  correct: number
  incorrect: number
  skipped: number
  marksObtained: number
  maxMarks: number
  percentage: number
}

interface QuestionAnalysis {
  question: QuestionData
  sectionName: string
  studentAnswer: string | string[] | null
  isCorrect: boolean
  isSkipped: boolean
  marksEarned: number
  aiEvaluation?: {
    score?: number
    maxScore?: number
    verdict?: string
    whyRight?: string
    whyWrong?: string
    feedback?: string
  }
}

// ─── SVG Charts ────────────────────────────────────────────────────────────────

function DonutChart({ segments, size = 160, strokeWidth = 28, centerLabel, centerSub }: {
  segments: { value: number; color: string; label: string }[]
  size?: number
  strokeWidth?: number
  centerLabel?: string
  centerSub?: string
}) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const total = segments.reduce((s, seg) => s + seg.value, 0)

  let offset = circumference / 4  // Start at 90 degrees to keep chart orientation
  const arcs = segments.map((seg) => {
    const pct = total > 0 ? seg.value / total : 0
    const dash = pct * circumference
    const gap = circumference - dash
    const currentOffset = offset
    offset += dash
    return { ...seg, dash, gap, offset: currentOffset }
  })

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#f1f5f9" strokeWidth={strokeWidth} />
      {arcs.map((arc, i) => (
        <circle
          key={i}
          cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          stroke={arc.color}
          strokeWidth={strokeWidth}
          strokeDasharray={`${arc.dash} ${arc.gap}`}
          strokeDashoffset={-arc.offset}
          strokeLinecap="round"
          className="transition-all duration-1000"
        />
      ))}
      <text
        x={size / 2} y={size / 2 - 4}
        textAnchor="middle" dominantBaseline="central"
        className="fill-[#1a2535] text-3xl font-extrabold"
        style={{ fontSize: "28px", fontWeight: 800 }}
      >
        {centerLabel}
      </text>
      <text
        x={size / 2} y={size / 2 + 20}
        textAnchor="middle" dominantBaseline="central"
        className="fill-gray-400 text-xs"
        style={{ fontSize: "11px" }}
      >
        {centerSub}
      </text>
    </svg>
  )
}

function BarChart({ data, showResults = true }: { data: { label: string; value: number; color: string }[], showResults?: boolean }) {
  const maxVal = Math.max(...data.map(d => d.value), 1)
  const barH = 140

  return (
    <div className="flex items-end gap-6 justify-center px-4" style={{ height: barH + 30 }}>
      {data.map((d) => {
        const h = (d.value / maxVal) * barH
        return (
          <div key={d.label} className="flex flex-col items-center gap-1">
            {showResults && <span className="text-[11px] font-bold" style={{ color: d.color }}>{d.value}%</span>}
            {!showResults && <span className="text-[11px] font-bold h-[16.5px]" />}
            <div
              className="rounded-t-lg transition-all duration-700 w-12"
              style={{ height: `${h}px`, backgroundColor: d.color }}
            />
            <span className="text-[10px] text-gray-500 font-medium text-center whitespace-normal break-words">{d.label}</span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Section Color Map (Brand Color Variations) ─────────────────────────────────

const SECTION_COLORS = [
  "#45505F",  // Main brand
  "#556B7D",  // Lighter shade
  "#6A7F95",  // Even lighter
  "#7F93AD",  // Lighter still
  "#94A7C5",  // Pale
  "#2D3A4A",  // Darker shade
  "#1F2937",  // Very dark
  "#3A4757",  // Mid-dark
]

function getSectionColor(idx: number) {
  return SECTION_COLORS[idx % SECTION_COLORS.length]
}

// ─── Tag Type Colors ──────────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  mcq: "bg-blue-100 text-blue-700",
  truefalse: "bg-teal-100 text-teal-700",
  descriptive: "bg-purple-100 text-purple-700",
  fillblanks: "bg-amber-100 text-amber-700",
  coding: "bg-red-100 text-red-700",
}
const TYPE_LABELS: Record<string, string> = {
  mcq: "MCQ",
  truefalse: "True/False",
  descriptive: "Descriptive",
  fillblanks: "Fill in Blanks",
  coding: "Coding",
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function AnalyticsResultInner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const searchParams = useSearchParams()
  const attemptId = searchParams.get("attemptId")
  const hasPublicParam = searchParams.get("access") === "public" || searchParams.get("type") === "public"
  const router = useRouter()

  const [attempt, setAttempt] = useState<AttemptResult | null>(null)
  const [examFull, setExamFull] = useState<ExamFullData | null>(null)
  const [history, setHistory] = useState<AttemptResult[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [questionFilter, setQuestionFilter] = useState<"all" | "correct" | "incorrect" | "attempted" | "skipped">("all")
  const [showAllQuestions, setShowAllQuestions] = useState(false)
  const [showResults, setShowResults] = useState(true)

  useEffect(() => {
    if (!attemptId) { router.push(getExamPortalUrl(id, hasPublicParam)); return }
    
    const fetchMainData = async () => {
      try {
        const [attemptRes, examRes] = await Promise.all([
          fetch(`/api/attempts/${attemptId}`).then(r => r.json()),
          fetch(`/api/exams/${id}`).then(r => r.json()),
        ])

        if (attemptRes.error) { 
          setError(attemptRes.error)
          setLoading(false)
          return 
        }
        if (!attemptRes.attempt) { 
          setError("No attempt found")
          setLoading(false)
          return 
        }
        if (!examRes.exam) { 
          setError("Exam not found")
          setLoading(false)
          return 
        }

        const mainAttempt = attemptRes.attempt
        setAttempt(mainAttempt)
        setExamFull(examRes.exam)
        setShowResults(attemptRes.showResults ?? true)
        
        // Fetch history using rollNumber and studentEmail
        const historyRes = await fetch(
          `/api/attempts?examId=${encodeURIComponent(id)}&rollNumber=${encodeURIComponent(mainAttempt.rollNumber || "")}&studentEmail=${encodeURIComponent(mainAttempt.studentEmail || "")}`
        ).then(r => r.json())

        if (historyRes.attempts) {
          // Sort by submitted date or startedAt
          const sortedHistory = historyRes.attempts
            .filter((a: any) => a._id !== mainAttempt._id && a.status === 'graded')
            .sort((a: any, b: any) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime())
          
          setHistory([...sortedHistory, mainAttempt])
        }

        setLoading(false)
      } catch (err) {
        console.error('Error loading results:', err)
        setError("Failed to load results")
        setLoading(false)
      }
    }

    fetchMainData()
  }, [attemptId, id, router])

  const answersMatch = (
    studentAnswer: string | string[],
    correctAnswer: string | string[] | undefined,
    options?: string[]
  ) => {
    const student = Array.isArray(studentAnswer) ? studentAnswer[0] : studentAnswer
    const correct = Array.isArray(correctAnswer) ? correctAnswer[0] : correctAnswer
    if (student === undefined || correct === undefined) return false

    const normalize = (value: string) => value
      .trim()
      .replace(/^[a-z]\s*[\)\.\-:]\s*/i, "")
      .replace(/\s+/g, " ")
      .toLowerCase()
    if (normalize(student) === normalize(correct)) return true

    if (options?.length) {
      const optionIndex = (value: string) => {
        const normalized = value.trim()
        if (/^[a-z]$/i.test(normalized)) {
          const index = normalized.toUpperCase().charCodeAt(0) - 65
          return index >= 0 && index < options.length ? index : -1
        }
        const numericIndex = Number(normalized)
        if (Number.isInteger(numericIndex)) {
          if (numericIndex >= 0 && numericIndex < options.length) return numericIndex
          if (numericIndex >= 1 && numericIndex <= options.length) return numericIndex - 1
        }
        return options.findIndex(option => normalize(option) === normalize(value))
      }

      const studentIndex = optionIndex(student)
      const correctIndex = optionIndex(correct)
      return studentIndex >= 0 && studentIndex === correctIndex
    }

    return false
  }

  // ─── Computed analytics data ─────────────────────────────────────────────────

  const analytics = useMemo(() => {
    if (!attempt || !examFull) return null

    const allQuestions: QuestionData[] = examFull.sections.flatMap(s => s.questions)
    const totalQuestions = allQuestions.length

    // Build per-question analysis
    const questionAnalyses: QuestionAnalysis[] = []
    const sectionAnalyses: SectionAnalysis[] = []

    for (const section of examFull.sections) {
      let sCorrect = 0, sIncorrect = 0, sSkipped = 0, sMarks = 0, sMax = 0

      for (const q of section.questions) {
        sMax += q.marks
        const studentAns = findAnswerForQuestion(attempt.answers, q as any)
        const answerValue = studentAns?.answer
        const isEmpty = !answerValue || (Array.isArray(answerValue) ? answerValue.every(v => !v) : answerValue === "")

        let isCorrect = false
        let marksEarned = 0

        if (isEmpty) {
          sSkipped++
        } else {
          const canonicalFormat = normalizeFormatInput(q.questionFormat || q.type, q as any)
          if (typeof studentAns?.manualScore === "number") {
            marksEarned = studentAns.manualScore
            isCorrect = studentAns.isCorrect ?? marksEarned > 0
            if (isCorrect || marksEarned > 0) sCorrect++
            else sIncorrect++
          } else if (isObjectiveFormat(canonicalFormat)) {
            const evalRes = evaluateObjectiveAnswer(q as any, answerValue as any, {
              negativeMarking: Boolean(section.negativeMarking || examFull.settings?.negativeMarking),
              negativeValue: section.sectionNegativeMark ?? 0,
            })
            isCorrect = evalRes.isCorrect
            marksEarned = evalRes.earnedMarks
            if (evalRes.isCorrect || evalRes.isPartiallyCorrect) sCorrect++
            else sIncorrect++
          } else if (q.type === "descriptive") {
            const earned = studentAns?.earnedMarks ?? studentAns?.manualScore ?? studentAns?.aiEvaluation?.score ?? studentAns?.marks ?? 0
            const aiEval = studentAns?.aiEvaluation
            marksEarned = earned
            isCorrect = studentAns?.isCorrect ?? (aiEval?.verdict === "Correct" || earned >= q.marks * 0.85)
            if (isCorrect || (aiEval?.verdict === "Partially Correct" && earned > 0)) {
              sCorrect++
            } else {
              sIncorrect++
            }
          } else if (q.type === "coding") {
            const totalPassed = studentAns?.totalPassed ?? studentAns?.testResults?.filter((r) => r.passed).length ?? 0
            const totalCases = studentAns?.totalCases ?? studentAns?.testResults?.length ?? 1
            if (typeof studentAns?.earnedMarks === "number") {
              marksEarned = studentAns.earnedMarks
              isCorrect = marksEarned >= q.marks
            } else if (typeof studentAns?.marks === "number") {
              marksEarned = studentAns.marks
              isCorrect = marksEarned >= q.marks
            } else if (totalPassed > 0 && totalCases > 0) {
              const scoringMode = q.scoringMode || "partial"
              isCorrect = totalPassed === totalCases
              marksEarned = scoringMode === "all" ? (isCorrect ? q.marks : 0) : q.marks * (totalPassed / totalCases)
            }
            if (isCorrect || marksEarned > 0) sCorrect++
            else sIncorrect++
          } else {
            marksEarned = studentAns?.earnedMarks ?? studentAns?.marks ?? 0
            isCorrect = studentAns?.isCorrect ?? marksEarned > 0
            if (isCorrect || marksEarned > 0) sCorrect++
            else sIncorrect++
          }
          sMarks += marksEarned
        }

        questionAnalyses.push({
          question: q,
          sectionName: section.name,
          studentAnswer: isEmpty ? null : (answerValue as string | string[]),
          isCorrect,
          isSkipped: isEmpty,
          marksEarned: Math.round(marksEarned * 100) / 100,
          aiEvaluation: studentAns?.aiEvaluation,
        })
      }

      const storedSection = attempt.sectionResults?.find((sr) => sr.name === section.name)
      const useStoredSectionMarks =
        storedSection &&
        sMarks === 0 &&
        storedSection.score !== 0 &&
        sCorrect === 0 &&
        sIncorrect === 0
      const resolvedSectionMarks = useStoredSectionMarks ? storedSection.score : Math.round(sMarks * 100) / 100

      sectionAnalyses.push({
        name: section.name,
        type: section.type,
        totalQuestions: section.questions.length,
        correct: useStoredSectionMarks ? storedSection.correctOrMarked : sCorrect,
        incorrect: sIncorrect,
        skipped: sSkipped,
        marksObtained: resolvedSectionMarks,
        maxMarks: sMax,
        percentage: sMax > 0 ? Math.round((resolvedSectionMarks / sMax) * 100) : 0,
      })
    }

    const totalCorrect = questionAnalyses.filter(q => q.isCorrect && !q.isSkipped).length
    const totalSkipped = questionAnalyses.filter(q => q.isSkipped).length
    const totalIncorrect = totalQuestions - totalCorrect - totalSkipped
    const accuracy = totalQuestions - totalSkipped > 0
      ? Math.round((totalCorrect / (totalQuestions - totalSkipped)) * 100)
      : 0

    return {
      totalQuestions,
      totalCorrect,
      totalIncorrect,
      totalSkipped,
      accuracy,
      questionAnalyses,
      sectionAnalyses,
    }
  }, [attempt, examFull])

  const reportRef = useRef<HTMLDivElement>(null)

  // ─── Loading & Error States ─────────────────────────────────────────────────

  if (loading) {
    return <ResultAnalyticsSkeleton />
  }

  if (error || !attempt || !examFull || !analytics) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
        <XCircle size={48} className="text-red-400" />
        <h1 className="text-xl font-bold text-gray-800">Results Not Found</h1>
        <p className="text-gray-500 text-sm">{error || "Could not load results."}</p>
      </div>
    )
  }

  const exam = attempt.examId
  const isGraded = attempt.status === "graded" || attempt.isGraded === true
  const hasManualGrades = Boolean(
    attempt.manualScore !== undefined ||
      attempt.answers?.some((ans) => typeof ans.manualScore === "number")
  )
  const calculatedScore = showResults
    ? Math.round(
        analytics.questionAnalyses.reduce(
          (total, qa) => (qa.isSkipped ? total : total + qa.marksEarned),
          0
        ) * 100
      ) / 100
    : 0
  const displayScore = resolveAnalyticsDisplayScore({
    showResults,
    attemptScore: attempt.score,
    calculatedScore,
    isGraded,
    hasManualGrades,
  })
  const passed = showResults ? displayScore >= exam.passMarks : attempt.passed
  const submittedDate = attempt.submittedAt ? new Date(attempt.submittedAt) : null
  const formattedDate = submittedDate
    ? `Completed on ${submittedDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
    : "Completed"
  const timeTakenMin = Math.floor((attempt.timeSpent || 0) / 60)
  const timeTakenSec = (attempt.timeSpent || 0) % 60
  const timeTakenStr = `${timeTakenMin > 0 ? timeTakenMin + "m " : ""}${timeTakenSec > 0 ? timeTakenSec + "s" : timeTakenMin > 0 ? "" : "0s"}`
  const passMarksDiff = displayScore - exam.passMarks
  const totalScore = attempt.maxScore || exam.totalMarks

  // Filtered questions for Q&A section
  const filteredQuestions = analytics.questionAnalyses.filter(qa => {
    if (questionFilter === "correct") return qa.isCorrect && !qa.isSkipped
    if (questionFilter === "incorrect") return !qa.isCorrect && !qa.isSkipped
    if (questionFilter === "attempted") return !qa.isSkipped
    if (questionFilter === "skipped") return qa.isSkipped
    return true
  })
  const displayedQuestions = showAllQuestions ? filteredQuestions : filteredQuestions.slice(0, 5)

  // Helper to format answer display
  const getOptionIndex = (answer: string | null | undefined, options: string[]) => {
    if (!answer) return -1
    const normalized = answer.trim()
    const letterIndex = normalized.match(/^[A-Za-z]$/)
      ? normalized.toUpperCase().charCodeAt(0) - 65
      : -1
    if (letterIndex >= 0 && letterIndex < options.length) return letterIndex

    const numericIndex = Number(normalized)
    if (Number.isInteger(numericIndex)) {
      if (numericIndex >= 0 && numericIndex < options.length) return numericIndex
      if (numericIndex >= 1 && numericIndex <= options.length) return numericIndex - 1
    }

    return options.findIndex(option => option.trim() === normalized)
  }

  const isChoiceWithOptions = (q: QuestionData) =>
    Boolean(
      q.options &&
        q.options.length > 0 &&
        (q.type === "mcq" ||
          q.type === "mcq_multi" ||
          q.type === "diagram" ||
          q.type === "assertion" ||
          q.questionFormat === "mcq_multi" ||
          (q.type === "fillblanks" && (!q.blanks || q.blanks.length === 0)))
    )

  const formatAnswer = (answer: string | string[] | null, q: QuestionData) => {
    if (!answer) return null
    if (isChoiceWithOptions(q)) {
      return formatOptionDisplay(answer, q.options)
    }
    if (q.type === "truefalse") {
      return normalizeTrueFalseAnswer(Array.isArray(answer) ? answer[0] : answer) || String(answer)
    }
    if (q.type === "fillblanks" && Array.isArray(answer)) {
      return answer.map((v, i) => `Blank ${i + 1}: ${v || "—"}`).join("  |  ")
    }
    if (Array.isArray(answer)) return answer.join(", ")
    return String(answer)
  }

  const renderStructuredValue = (
    rawValue: string | string[] | null | undefined,
    q: QuestionData,
    isCorrectSide = false
  ) => {
    const hasBlanksList = isCorrectSide && q.type === "fillblanks" && Boolean(q.blanks && q.blanks.length > 0)
    if (!hasBlanksList && (!rawValue || (Array.isArray(rawValue) && rawValue.length === 0))) return null

    if (isChoiceWithOptions(q) && q.options) {
      const items = getFormattedOptionItems(rawValue, q.options)
      if (items.length === 0) return null
      return (
        <div className="space-y-1">
          {items.map((item, idx) => (
            <div key={`${item.label}-${idx}`} className="flex items-start gap-1.5 min-w-0">
              {item.label && <span className="shrink-0 font-bold">{item.label}.</span>}
              <div className="min-w-0 flex-1">
                <MathRenderer content={item.text} className="text-xs sm:text-[13px]" />
              </div>
            </div>
          ))}
        </div>
      )
    }

    if (q.type === "fillblanks") {
      const items = isCorrectSide && q.blanks && q.blanks.length > 0
        ? q.blanks.map((b) => b.answer)
        : Array.isArray(rawValue)
          ? rawValue
          : [String(rawValue)]
      if (items.length > 1 || (q.blanks && q.blanks.length > 0)) {
        return (
          <div className="space-y-1">
            {items.map((value, index) => (
              <div key={`${value}-${index}`} className="flex items-start gap-1.5">
                <span className="shrink-0 font-semibold">{index + 1}.</span>
                <MathRenderer content={String(value || "—")} className="text-xs sm:text-[13px]" />
              </div>
            ))}
          </div>
        )
      }
    }

    if (q.type === "truefalse") {
      const normalizedTf =
        normalizeTrueFalseAnswer(Array.isArray(rawValue) ? rawValue[0] : rawValue) ||
        String(Array.isArray(rawValue) ? rawValue[0] : rawValue)
      return <span className="font-semibold">{normalizedTf}</span>
    }

    const text = Array.isArray(rawValue) ? rawValue.join(", ") : String(rawValue)
    return <MathRenderer content={text} className="text-xs sm:text-[13px]" />
  }

  const renderFormattedAnswer = (answer: string | string[] | null, q: QuestionData) => {
    const content = renderStructuredValue(answer, q, false)
    if (!content) return null
    return <div className="min-w-0 text-[#324158]">{content}</div>
  }

  const formatCorrectAnswer = (q: QuestionData) => {
    if (q.type === "descriptive") return q.modelAnswer || (Array.isArray(q.correctAnswer) ? q.correctAnswer.join(", ") : q.correctAnswer) || "Refer Rubric"
    if (isChoiceWithOptions(q)) {
      return formatOptionDisplay(q.correctAnswer, q.options)
    }
    if (q.type === "truefalse") return normalizeTrueFalseAnswer(q.correctAnswer) || String(q.correctAnswer || "—")
    if (q.type === "fillblanks") {
      if (q.blanks && q.blanks.length > 0) return q.blanks.map((b, i) => `Blank ${i + 1}: ${b.answer}`).join("  |  ")
      if (q.options && q.options.length > 0) return formatOptionDisplay(q.correctAnswer, q.options)
    }
    if (q.correctAnswer) return Array.isArray(q.correctAnswer) ? q.correctAnswer.join(", ") : String(q.correctAnswer)
    return "—"
  }

  const escapeHtml = (value: string) => value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")

  const renderPrintableMath = (value: string) => {
    const normalized = normalizeMathContent(value)
    return normalized.split(/(\$\$[\s\S]*?\$\$|\$[^$\n]+\$)/g).map(part => {
      if (part.startsWith("$$") && part.endsWith("$$")) {
        return `<div class="formula display-formula">${katex.renderToString(part.slice(2, -2).trim(), { displayMode: true, throwOnError: false, strict: "ignore", trust: true })}</div>`
      }
      if (part.startsWith("$") && part.endsWith("$")) {
        return `<span class="formula">${katex.renderToString(part.slice(1, -1).trim(), { displayMode: false, throwOnError: false, strict: "ignore", trust: true })}</span>`
      }
      return `<span class="text-content">${escapeHtml(part)}</span>`
    }).join("")
  }

  const handleDownloadPDF = () => {
    const printWindow = window.open("", "_blank")
    if (!printWindow) return

    const qa = analytics.questionAnalyses
    const sections = analytics.sectionAnalyses
    let pageStyles = ""
    for (const styleSheet of Array.from(document.styleSheets)) {
      try {
        pageStyles += Array.from(styleSheet.cssRules).map(rule => rule.cssText).join("\n")
      } catch {
        // Ignore stylesheets that are not readable from this document.
      }
    }

    // Build question rows HTML
    const questionRows = qa.map((q: any, i: number) => {
      const status = q.isSkipped ? "Skipped" : q.isCorrect ? "Correct" : "Incorrect"
      const statusColor = q.isSkipped ? "#2D3A4A" : q.isCorrect ? "#45505F" : "#94A7C5"
      const yourAns = q.isSkipped ? "—" : formatAnswer(q.studentAnswer, q.question) || "—"
      const correctAns = showResults ? ((["mcq", "mcq_multi", "diagram", "assertion", "truefalse", "fillblanks"].includes(q.question.type))
        ? formatCorrectAnswer(q.question) : (q.question.modelAnswer || "—")) : "—"
      const evalPrint = evaluateObjectiveAnswer(q.question, q.studentAnswer)
      const selectedSet = new Set(evalPrint.resolvedStudentOptions.map((s) => normalizeCompareText(s)))
      const correctSet = new Set(evalPrint.resolvedCorrectOptions.map((c) => normalizeCompareText(c)))
      const optionsHtml =
        isChoiceWithOptions(q.question) &&
        q.question.options &&
        q.question.options.length > 0
          ? `<div class="options-grid">${q.question.options.map((option: string, optionIndex: number) => {
              const optionKey = String.fromCharCode(65 + optionIndex)
              const optNorm = normalizeCompareText(option)
              const isSelected = selectedSet.has(optNorm)
              const isCorrect = showResults && correctSet.has(optNorm)
              const optionImage = q.question.optionImages?.[optionIndex]
              const label = isCorrect ? "Correct" : isSelected ? "Selected" : ""
              return `<div class="option ${isCorrect ? "option-correct" : isSelected ? "option-selected" : ""}">
                <span class="option-key">${optionKey}</span>
                <div class="option-content">${renderPrintableMath(option)}${optionImage ? `<img src="${escapeHtml(optionImage)}" alt="Option ${optionKey}" />` : ""}</div>
                ${label ? `<span class="option-label">${label}</span>` : ""}
              </div>`
            }).join("")}</div>`
          : ""
      let questionImage = ""
      if (q.question.questionImage) {
        let trimmed = String(q.question.questionImage).trim()
        if (trimmed.includes("&lt;svg") && trimmed.includes("&gt;")) {
          trimmed = trimmed
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"')
            .replace(/&#039;/g, "'")
            .replace(/&amp;/g, "&")
        }
        const isSvg = trimmed.startsWith("<svg") || (trimmed.includes("<svg") && trimmed.includes("</svg>"))
        if (isSvg) {
          const match = trimmed.match(/<svg[\s\S]*?<\/svg>/i)
          let cleanSvg = match ? match[0] : trimmed
          if (!cleanSvg.includes("viewBox") && !cleanSvg.includes("viewbox")) {
            const wMatch = cleanSvg.match(/width=["']?(\d+)["']?/i)
            const hMatch = cleanSvg.match(/height=["']?(\d+)["']?/i)
            if (wMatch && hMatch) {
              cleanSvg = cleanSvg.replace(/<svg\b/i, `<svg viewBox="0 0 ${wMatch[1]} ${hMatch[1]}"`)
            }
          }
          questionImage = `<div class="question-diagram-wrapper">${cleanSvg}</div>`
        } else {
          const imageSrc = trimmed.startsWith("data:") || trimmed.startsWith("http") || trimmed.startsWith("/")
            ? trimmed
            : `data:image/svg+xml;utf8,${encodeURIComponent(trimmed)}`
          questionImage = `<div class="question-diagram-wrapper"><img class="question-image" src="${escapeHtml(imageSrc)}" alt="Question Diagram" /></div>`
        }
      }
      const codeSnippet = q.question.codeSnippet
        ? `<pre class="code-snippet">${escapeHtml(q.question.codeSnippet)}</pre>`
        : ""

      return `
        <div class="question-card no-break">
          <div class="question-header">
            <strong>Q${i + 1}</strong>
            <span class="type-badge">${q.question.type === 'truefalse' ? 'True/False' : q.question.type === 'fillblanks' ? 'Fill Blanks' : q.question.type.toUpperCase()}</span>
            <span class="status" style="color:${statusColor}">${status}</span>
            ${showResults ? `<span class="marks">${q.marksEarned}/${q.question.marks} marks</span>` : ""}
          </div>
          <div class="question-text">${renderPrintableMath(q.question.questionText)}</div>
          ${questionImage}${codeSnippet}${optionsHtml}
          <div class="answer-row">
            <strong>Your Answer:</strong> ${q.isSkipped ? "—" : q.question.type === "coding" ? `<pre class="code-snippet">${escapeHtml(yourAns)}</pre>` : renderPrintableMath(yourAns)}
            ${showResults ? `<span><strong>Correct Answer:</strong> ${renderPrintableMath(correctAns)}</span>` : ""}
          </div>
        </div>`
    }).join("")

    // Build section rows
    const sectionRows = sections.map((s: any, i: number) => `
      <tr style="border-bottom:1px solid #f0f0f0">
        <td style="padding:8px 12px;font-weight:600;color:#1a2535">${s.name}</td>
        <td style="padding:8px 12px;text-align:center">${s.totalQuestions}</td>
        ${showResults ? `<td style="padding:8px 12px;text-align:center;color:#45505F;font-weight:600">${s.correct}</td>
        <td style="padding:8px 12px;text-align:center;color:#94A7C5;font-weight:600">${s.incorrect}</td>
        <td style="padding:8px 12px;text-align:center;color:#2D3A4A;font-weight:600">${s.skipped}</td>
        <td style="padding:8px 12px;text-align:center;font-weight:600;color:#1a2535">${s.marksObtained}/${s.maxMarks}</td>
        <td style="padding:8px 12px;text-align:center;font-weight:700;color:${SECTION_COLORS[i % SECTION_COLORS.length]}">${s.percentage}%</td>` : `<td style="padding:8px 12px;text-align:center;color:#2D3A4A;font-weight:600">${s.skipped}</td>`}
      </tr>
    `).join("")

    const html = `<!DOCTYPE html>
    <html>
    <head>
      <title>Exam Report - ${exam.title}</title>
      <style>
        ${pageStyles}
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, sans-serif; color: #1a2535; padding: 0; }
        @media print {
          body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .no-break { page-break-inside: avoid; }
        }
        .header { background: #2D3A4A; color: white; padding: 24px 40px; display: flex; align-items: center; justify-content: space-between; }
        .header h1 { font-size: 20px; font-weight: 700; }
        .header .sub { font-size: 12px; color: #94a3b8; margin-top: 2px; }
        .badge { display: inline-block; padding: 4px 14px; border-radius: 20px; font-size: 12px; font-weight: 700; }
        .pass { background: #45505F; color: white; }
        .fail { background: #94A7C5; color: white; }
        .content { padding: 32px 40px; }
        .stats-row { display: flex; gap: 16px; margin-bottom: 24px; }
        .stat-card { flex: 1; padding: 16px; border-radius: 12px; border: 1px solid #e5e7eb; text-align: center; }
        .stat-card .label { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
        .stat-card .value { font-size: 22px; font-weight: 800; }
        .section-title { font-size: 16px; font-weight: 700; margin: 24px 0 12px; padding-bottom: 8px; border-bottom: 2px solid #e5e7eb; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        th { text-align: left; padding: 10px 12px; background: #f8f9fc; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; font-weight: 600; border-bottom: 2px solid #e5e7eb; }
        .footer { text-align: center; padding: 20px; font-size: 11px; color: #9ca3b8; border-top: 1px solid #e5e7eb; margin-top: 24px; }
        .student-info { display: flex; gap: 32px; margin-bottom: 24px; padding: 16px 20px; background: #f8f9fc; border-radius: 12px; }
        .student-info .item .lbl { font-size: 10px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; }
        .student-info .item .val { font-size: 14px; font-weight: 600; color: #1a2535; }
        .question-card { border: 1px solid #e5e7eb; border-left: 4px solid #45505F; border-radius: 10px; padding: 14px; margin-bottom: 12px; }
        .question-header { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; font-size: 12px; }
        .question-header strong { font-size: 14px; }
        .type-badge { background: #f3f4f6; color: #4b5563; border-radius: 12px; padding: 3px 8px; font-size: 10px; font-weight: 700; }
        .status { margin-left: auto; font-weight: 700; }
        .marks { color: #6b7280; font-weight: 600; }
        .question-text { color: #1a2535; font-size: 13px; font-weight: 600; line-height: 1.6; margin-bottom: 10px; }
        .text-content { white-space: pre-wrap; }
        .formula { display: inline-block; margin: 0 2px; }
        .display-formula { display: block; overflow-x: auto; text-align: center; margin: 8px 0; }
        .question-diagram-wrapper { display: block; width: 100%; margin: 10px auto; text-align: center; page-break-inside: avoid; }
        .question-diagram-wrapper svg { max-width: 100%; max-height: 240px; height: auto; margin: 0 auto; display: block; }
        .question-image { display: block; max-width: 100%; max-height: 240px; margin: 8px auto; object-fit: contain; }
        .code-snippet { overflow-x: auto; background: #1e2a38; color: #e5e7eb; border-radius: 8px; padding: 10px; margin: 8px 0; font: 11px monospace; white-space: pre-wrap; }
        .options-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 10px 0; }
        .option { display: flex; align-items: flex-start; gap: 8px; border: 1px solid #d1d5db; border-radius: 8px; padding: 8px; min-height: 36px; }
        .option-selected { border: 2px solid #3b82f6; background: #eff6ff; }
        .option-correct { border: 2px solid #10b981; background: #ecfdf5; }
        .option-key { flex: 0 0 22px; height: 22px; border-radius: 50%; background: #f3f4f6; color: #374151; text-align: center; line-height: 22px; font-size: 11px; font-weight: 700; }
        .option-content { flex: 1; font-size: 12px; line-height: 1.5; }
        .option-content img { display: block; max-width: 100%; max-height: 100px; margin-top: 5px; object-fit: contain; }
        .option-label { color: #047857; font-size: 9px; font-weight: 800; text-transform: uppercase; }
        .answer-row { display: flex; flex-wrap: wrap; gap: 16px; padding-top: 9px; border-top: 1px solid #f0f0f0; color: #374151; font-size: 12px; line-height: 1.5; }
        .answer-row > span { color: #45505F; }
        @media print { .options-grid { break-inside: avoid; } }
      </style>
    </head>
    <body>
      <div class="header" style="background:${examFull?.institute?.themeColor || '#2D3A4A'}">
        <div style="display:flex;align-items:center;gap:12px">
          ${examFull?.institute?.logo
            ? `<img src="${examFull.institute.logo}" alt="${escapeHtml(examFull.institute.name || 'Institute')}" style="height:36px;max-width:180px;object-fit:contain;background:white;padding:2px 8px;border-radius:6px;" />`
            : `<div style="font-size:18px;font-weight:bold;color:white;">${escapeHtml(examFull?.institute?.name || 'Coaching Center')}</div>`}
          <div>
            <h1>${escapeHtml(examFull?.institute?.name || exam.title)}</h1>
            <div class="sub">Performance Analytics Report</div>
          </div>
        </div>
        </div>
        <div style="text-align:right">
          ${showResults ? `<span class="badge ${passed ? 'pass' : 'fail'}">${passed ? 'PASSED' : 'FAILED'}</span>` : ''}
          <div class="sub" style="margin-top:6px">${formattedDate}</div>
        </div>
      </div>

      <div class="content">
        <h2 style="font-size:18px;margin-bottom:4px">${exam.title}</h2>
        <p style="font-size:13px;color:#6b7280;margin-bottom:16px">${examFull.subject || 'Assessment'}</p>

        <div class="student-info">
          <div class="item"><div class="lbl">Aspirant Name</div><div class="val">${attempt.studentName}</div></div>
          <div class="item"><div class="lbl">Roll Number</div><div class="val">${attempt.rollNumber}</div></div>
          ${showResults ? `<div class="item"><div class="lbl">Score</div><div class="val">${displayScore} / ${totalScore}</div></div>
          <div class="item"><div class="lbl">Percentage</div><div class="val">${totalScore > 0 ? Math.round((displayScore / totalScore) * 100) : 0}%</div></div>` : ''}
          <div class="item"><div class="lbl">Time Taken</div><div class="val">${timeTakenStr || 'N/A'}</div></div>
        </div>

        ${showResults ? `<div class="stats-row">
          <div class="stat-card"><div class="label">Correct</div><div class="value" style="color:#45505F">${analytics.totalCorrect}</div></div>
          <div class="stat-card"><div class="label">Incorrect</div><div class="value" style="color:#94A7C5">${analytics.totalIncorrect}</div></div>
          <div class="stat-card"><div class="label">Skipped</div><div class="value" style="color:#2D3A4A">${analytics.totalSkipped}</div></div>
          <div class="stat-card"><div class="label">Accuracy</div><div class="value" style="color:#45505F">${analytics.accuracy}%</div></div>
        </div>` : `<div class="stats-row">
          <div class="stat-card"><div class="label">Attempted</div><div class="value" style="color:#45505F">${analytics.totalQuestions - analytics.totalSkipped}</div></div>
          <div class="stat-card"><div class="label">Skipped</div><div class="value" style="color:#2D3A4A">${analytics.totalSkipped}</div></div>
        </div>`}

        <div class="section-title">Section-wise Breakdown</div>
        <table class="no-break">
          <thead>
            ${showResults ? `<tr><th>Section</th><th style="text-align:center">Questions</th><th style="text-align:center">Correct</th><th style="text-align:center">Incorrect</th><th style="text-align:center">Skipped</th><th style="text-align:center">Marks</th><th style="text-align:center">Score %</th></tr>` 
            : `<tr><th>Section</th><th style="text-align:center">Questions</th><th style="text-align:center">Skipped</th></tr>`}
          </thead>
          <tbody>${sectionRows}</tbody>
        </table>

        <div class="section-title">Question-wise Analysis</div>
        <div>${questionRows}</div>
      </div>

      <div class="footer">
        <strong>Progrentures Solution</strong> — Empower Your Growth<br/>
        This is a computer-generated report. Generated on ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.
      </div>
    </body>
    </html>`

    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.onload = () => {
      printWindow.print()
    }
  }



  if (!showResults) {
    return (
      <SubmissionConfirmation
        examId={id}
        examTitle={examFull?.title || attempt?.examId?.title}
        studentName={attempt?.studentName}
        rollNumber={attempt?.rollNumber}
        submittedAt={attempt?.submittedAt}
        institute={examFull?.institute || attempt?.examId?.institute}
        isPublic={hasPublicParam || attempt?.candidateType === "public"}
      />
    )
  }

  const solvedCount = analytics.totalQuestions - analytics.totalSkipped
  const unsolvedCount = analytics.totalSkipped
  const solvedPercent = analytics.totalQuestions > 0 ? Math.round((solvedCount / analytics.totalQuestions) * 100) : 0

  return (
    <div className="min-h-screen bg-[#F8F9FD] text-slate-800 font-sans">
      {/* ─── Top Header ───────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-slate-100 px-3.5 sm:px-8 py-3 sm:py-3.5 flex items-center justify-between sticky top-0 z-30 print:hidden shadow-2xs">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {examFull?.institute?.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={examFull.institute.logo}
              alt={examFull.institute.name || "Institute"}
              className="h-7 sm:h-8 max-w-[120px] sm:max-w-[150px] object-contain shrink-0"
            />
          ) : examFull?.institute?.name ? (
            <span className="font-bold text-xs sm:text-sm text-slate-900 truncate">{examFull.institute.name}</span>
          ) : (
            <div className="scale-85 sm:scale-100 origin-left">
              <ProcrentureLogo />
            </div>
          )}
          <span className="text-xs font-semibold text-slate-400 pl-2 border-l border-slate-200 hidden md:inline">
            Comprehensive Analysis
          </span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <Link
            href={`/exam/${id}/result?attemptId=${attemptId}${hasPublicParam || attempt?.candidateType === "public" ? "&access=public" : ""}`}
            className="text-xs font-semibold text-slate-600 hover:text-slate-900 px-2.5 sm:px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors"
          >
            ← <span className="hidden sm:inline">Back to </span>Summary
          </Link>
          <button
            onClick={handleDownloadPDF}
            className="flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <Download size={13} /> <span className="hidden sm:inline">Download</span>
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-4 sm:space-y-6">
        {/* ─── Top Hero Card (Matching Screenshot) ────────────────────────────────── */}
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-100 shadow-[0_2px_16px_rgba(0,0,0,0.03)] p-4 sm:p-7">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-center">
            {/* Left Column: Status, Title, Subtitle & 3 Metrics */}
            <div className="lg:col-span-6 space-y-3.5 sm:space-y-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    passed ? "bg-emerald-600 text-white" : "bg-[#131B2A] text-white"
                  }`}>
                    {showResults ? (passed ? "PASSED" : "FAILED") : "SUBMITTED"}
                  </span>
                  <span className="text-[11px] sm:text-xs text-slate-400 font-medium">
                    {formattedDate}
                  </span>
                </div>
                <h1 className="text-sm sm:text-lg font-bold text-slate-900 mt-2 leading-snug break-words">
                  {exam.title}
                </h1>
                <p className="text-[11px] sm:text-xs text-slate-400 font-medium mt-0.5">
                  {examFull.class ? `${examFull.class} — ` : ""}{examFull.subject || "Assessment"}
                </p>
              </div>

              {/* 3 Metrics in a row with vertical dividers */}
              <div className="flex items-center justify-between sm:justify-start gap-3 sm:gap-8 pt-1">
                <div>
                  <p className="text-[10px] sm:text-[11px] text-slate-400 font-medium">
                    {showResults ? "Your Score" : "Status"}
                  </p>
                  <p className="text-sm sm:text-lg font-bold text-slate-900 mt-0.5">
                    {showResults ? `${displayScore} / ${totalScore}` : "Submitted"}
                  </p>
                </div>
                <div className="h-7 sm:h-8 w-px bg-slate-200" />
                <div>
                  <p className="text-[10px] sm:text-[11px] text-slate-400 font-medium">Questions</p>
                  <p className="text-sm sm:text-lg font-bold text-slate-900 mt-0.5">{analytics.totalQuestions}</p>
                </div>
                <div className="h-7 sm:h-8 w-px bg-slate-200" />
                <div>
                  <p className="text-[10px] sm:text-[11px] text-slate-400 font-medium">Time Taken</p>
                  <p className="text-sm sm:text-lg font-bold text-slate-900 mt-0.5">{timeTakenStr || "N/A"}</p>
                </div>
              </div>
            </div>

            {/* Right Column: Performance Summary (4 boxes + Pass line banner) */}
            <div className="lg:col-span-6 lg:border-l lg:border-slate-100 lg:pl-6 pt-4 lg:pt-0 border-t lg:border-t-0 border-slate-100 space-y-3">
              <h3 className="text-xs sm:text-sm font-bold text-slate-900">Performance Summary</h3>

              {/* 4 horizontal metric pill boxes */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
                <div className="bg-slate-50/70 border border-slate-100 rounded-xl p-2.5 sm:p-3 text-left">
                  <span className="text-[10px] sm:text-[11px] text-slate-400 font-medium block">
                    {showResults ? "Correct" : "Attempted"}
                  </span>
                  <span className="text-sm sm:text-lg font-bold text-slate-900 mt-0.5 block">
                    {showResults ? analytics.totalCorrect : (analytics.totalCorrect + analytics.totalIncorrect)}
                  </span>
                </div>

                <div className="bg-slate-50/70 border border-slate-100 rounded-xl p-2.5 sm:p-3 text-left">
                  <span className="text-[10px] sm:text-[11px] text-slate-400 font-medium block">Incorrect</span>
                  <span className="text-sm sm:text-lg font-bold text-slate-900 mt-0.5 block">
                    {showResults ? analytics.totalIncorrect : 0}
                  </span>
                </div>

                <div className="bg-slate-50/70 border border-slate-100 rounded-xl p-2.5 sm:p-3 text-left">
                  <span className="text-[10px] sm:text-[11px] text-slate-400 font-medium block">Skipped</span>
                  <span className="text-sm sm:text-lg font-bold text-slate-900 mt-0.5 block">
                    {analytics.totalSkipped}
                  </span>
                </div>

                <div className="bg-slate-50/70 border border-slate-100 rounded-xl p-2.5 sm:p-3 text-left">
                  <span className="text-[10px] sm:text-[11px] text-slate-400 font-medium block">Accuracy</span>
                  <span className="text-sm sm:text-lg font-bold text-slate-900 mt-0.5 block">
                    {showResults ? `${analytics.accuracy}%` : "—"}
                  </span>
                </div>
              </div>

              {/* Pass/Fail Banner */}
              {showResults && (
                <div className="py-2 px-2.5 sm:px-3 rounded-xl bg-blue-50/40 border border-blue-100/60 text-center text-[11px] sm:text-xs text-slate-600 font-medium leading-relaxed">
                  Pass Marks: {exam.passMarks}/{totalScore} — You scored {Math.abs(passMarksDiff)} marks {passMarksDiff >= 0 ? "above" : "below"} pass line!
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ─── Middle Row: Solved vs Total & Section-wise Performance ───────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
          {/* Left Card: Solved vs. Total */}
          <div className="lg:col-span-5 bg-white rounded-2xl sm:rounded-3xl border border-slate-100 shadow-[0_2px_16px_rgba(0,0,0,0.03)] p-4 sm:p-6 flex flex-col justify-between">
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 mb-3 sm:mb-4">Solved vs. Total</h3>
              
              <div className="flex items-center gap-3">
                <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden p-0.5">
                  <div
                    className="h-full bg-[#131B2A] rounded-full transition-all duration-700"
                    style={{ width: `${solvedPercent}%` }}
                  />
                </div>
                <span className="text-xs sm:text-sm font-bold text-slate-900 shrink-0">
                  {solvedCount} / {analytics.totalQuestions}
                </span>
              </div>

              <div className="flex items-center gap-4 mt-3.5 text-[10px] sm:text-[11px] text-slate-500 font-medium">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-[#131B2A]" />
                  <span>Solved ({solvedCount})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-slate-200" />
                  <span>Unsolved ({unsolvedCount})</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Card: Section-wise Performance */}
          <div className="lg:col-span-7 bg-white rounded-2xl sm:rounded-3xl border border-slate-100 shadow-[0_2px_16px_rgba(0,0,0,0.03)] p-4 sm:p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs sm:text-sm font-bold text-slate-900">Section-wise Performance</h3>
              <span className="text-[10px] text-slate-400 font-medium sm:hidden">Swipe table →</span>
            </div>
            <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
              <table className="w-full text-xs min-w-[500px]">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 font-semibold text-[10px] uppercase tracking-wider">
                    <th className="text-left pb-2 font-semibold">SECTION</th>
                    <th className="text-center pb-2 font-semibold">QUESTIONS</th>
                    {showResults ? (
                      <>
                        <th className="text-center pb-2 font-semibold">CORRECT</th>
                        <th className="text-center pb-2 font-semibold">INCORRECT</th>
                      </>
                    ) : (
                      <th className="text-center pb-2 font-semibold">ATTEMPTED</th>
                    )}
                    <th className="text-center pb-2 font-semibold">SKIPPED</th>
                    {showResults && <th className="text-center pb-2 font-semibold">MARKS</th>}
                    <th className="text-right pb-2 font-semibold">SCORE</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {analytics.sectionAnalyses.map((sec, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="py-2.5 text-left font-semibold text-slate-800">
                        <div className="flex items-center gap-1.5">
                          <span className="w-1 h-3.5 bg-[#131B2A] rounded-full inline-block shrink-0" />
                          <span className="truncate max-w-[140px]">{sec.name}</span>
                        </div>
                      </td>
                      <td className="py-2.5 text-center text-slate-700 font-medium">{sec.totalQuestions}</td>
                      {showResults ? (
                        <>
                          <td className="py-2.5 text-center text-slate-700 font-medium">{sec.correct}</td>
                          <td className="py-2.5 text-center text-slate-700 font-medium">{sec.incorrect}</td>
                        </>
                      ) : (
                        <td className="py-2.5 text-center text-slate-700 font-medium">{sec.correct + sec.incorrect}</td>
                      )}
                      <td className="py-2.5 text-center text-slate-700 font-medium">{sec.skipped}</td>
                      {showResults && (
                        <td className="py-2.5 text-center text-slate-700 font-medium">
                          {sec.marksObtained} / {sec.maxMarks}
                        </td>
                      )}
                      <td className="py-2.5 text-right font-bold text-slate-900">
                        {sec.percentage}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ─── Question-wise Analysis ─────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-100 shadow-[0_2px_16px_rgba(0,0,0,0.03)] p-4 sm:p-6 mb-6">
          <div className="flex items-center justify-between mb-4 sm:mb-5 flex-wrap gap-2.5 sm:gap-3">
            <h3 className="text-xs sm:text-base font-bold text-slate-900">Question-wise Analysis</h3>
            <div className="flex items-center gap-1 bg-slate-100/80 rounded-xl p-1 overflow-x-auto max-w-full">
              {(showResults ? (["all", "correct", "incorrect", "skipped"] as const) : (["all", "attempted", "skipped"] as const)).map(filter => (
                <button
                  key={filter}
                  onClick={() => { setQuestionFilter(filter); setShowAllQuestions(false) }}
                  className={`px-2.5 sm:px-3 py-1 text-[11px] sm:text-xs font-semibold rounded-lg capitalize transition-all cursor-pointer whitespace-nowrap ${
                    questionFilter === filter
                      ? "bg-[#131B2A] text-white shadow-xs"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3.5 sm:space-y-4">
            {displayedQuestions.length === 0 && (
              <p className="text-center text-slate-400 text-xs py-8 font-medium">No questions match this filter.</p>
            )}
            {displayedQuestions.map((qa, idx) => {
              const globalIdx = analytics.questionAnalyses.indexOf(qa) + 1

              return (
                <div
                  key={`${qa.question._id}-${idx}`}
                  className="bg-white rounded-xl sm:rounded-2xl border border-slate-200/90 p-3.5 sm:p-5 shadow-2xs space-y-3 sm:space-y-3.5 transition-all"
                >
                  {/* Tier 1 Header */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                      <span className="inline-flex items-center justify-center px-2 sm:px-2.5 py-0.5 rounded-full text-[11px] sm:text-xs font-bold bg-[#131B2A] text-white">
                        Q{globalIdx}
                      </span>
                      <span className="px-2 sm:px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-100 uppercase">
                        {TYPE_LABELS[qa.question.type] || qa.question.type}
                      </span>
                      <span className="px-2 sm:px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-semibold bg-slate-100 text-slate-600">
                        {qa.question.marks} Mark{qa.question.marks !== 1 ? "s" : ""}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 text-[11px] sm:text-xs font-semibold">
                      {qa.isSkipped ? (
                        <span className="text-slate-500">Skipped — 0 marks</span>
                      ) : showResults ? (
                        qa.isCorrect ? (
                          <span className="text-emerald-700">+{qa.marksEarned} marks earned</span>
                        ) : qa.marksEarned > 0 ? (
                          <span className="text-blue-700">+{qa.marksEarned} marks earned</span>
                        ) : (
                          <span className="text-slate-500">0 marks earned</span>
                        )
                      ) : (
                        <span className="text-slate-700">Attempted</span>
                      )}
                    </div>
                  </div>

                  {/* Question Text */}
                  {(() => {
                    const parsedAR = qa.question.type === "assertion" ? parseAssertionReasonText(qa.question.questionText) : null
                    if (parsedAR) {
                      return (
                        <div className="space-y-2.5">
                          <div className="p-3 rounded-xl border border-purple-200 bg-purple-50/50">
                            <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider bg-purple-600 text-white mb-1">
                              Assertion (A)
                            </span>
                            <div className="text-xs sm:text-sm text-slate-900 leading-relaxed overflow-x-auto break-words">
                              <MathRenderer content={parsedAR.assertion} />
                            </div>
                          </div>
                          <div className="p-3 rounded-xl border border-indigo-200 bg-indigo-50/50">
                            <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider bg-indigo-600 text-white mb-1">
                              Reason (R)
                            </span>
                            <div className="text-xs sm:text-sm text-slate-900 leading-relaxed overflow-x-auto break-words">
                              <MathRenderer content={parsedAR.reason} />
                            </div>
                          </div>
                        </div>
                      )
                    }
                    return (
                      <div className="text-xs sm:text-sm text-slate-900 leading-relaxed overflow-x-auto break-words">
                        <MathRenderer content={qa.question.questionText} />
                      </div>
                    )
                  })()}

                  {qa.question.questionImage && (
                    <div className="max-w-xl">
                      <QuestionDiagram src={qa.question.questionImage} />
                    </div>
                  )}

                  {qa.question.codeSnippet && (
                    <pre className="overflow-x-auto rounded-xl border border-slate-700 bg-[#131B2A] px-3.5 py-2.5 sm:px-4 sm:py-3 text-[11px] sm:text-xs text-slate-200">
                      {qa.question.codeSnippet}
                    </pre>
                  )}

                  {/* Options (for MCQ / Multiple Correct / Diagram / Assertion / Choice-based FIB) */}
                  {isChoiceWithOptions(qa.question) && qa.question.options && qa.question.options.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5">
                      {qa.question.options.map((option, optionIndex) => {
                        const optionKey = String.fromCharCode(65 + optionIndex)
                        const evalInfo = evaluateObjectiveAnswer(qa.question as any, qa.studentAnswer as any)
                        const optNorm = normalizeCompareText(option)
                        const isSelected = evalInfo.resolvedStudentOptions.some(s => normalizeCompareText(s) === optNorm)
                        const isCorrect = showResults && evalInfo.resolvedCorrectOptions.some(c => normalizeCompareText(c) === optNorm)
                        const optionImage = qa.question.optionImages?.[optionIndex]

                        return (
                          <div
                            key={`${qa.question._id}-option-${optionKey}`}
                            className={`flex items-start gap-2 sm:gap-2.5 rounded-xl border p-2 sm:p-3 transition-all ${
                              isCorrect
                                ? "border-emerald-500 bg-emerald-50/60 text-emerald-950"
                                : isSelected
                                ? "border-blue-500 bg-blue-50/60 text-blue-950"
                                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50/50"
                            }`}
                          >
                            <span
                              className={`w-5 h-5 sm:w-6 sm:h-6 rounded-md text-[11px] sm:text-xs font-bold flex items-center justify-center shrink-0 mt-0.5 ${
                                isCorrect
                                  ? "bg-emerald-600 text-white"
                                  : isSelected
                                  ? "bg-blue-600 text-white"
                                  : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {optionKey}
                            </span>
                            <div className="min-w-0 flex-1 text-xs sm:text-[13px] leading-relaxed pt-0.5 overflow-x-auto">
                              <MathRenderer content={option} />
                              {optionImage && (
                                <img
                                  src={optionImage}
                                  alt={`Option ${optionKey}`}
                                  className="mt-2 max-h-28 max-w-full rounded-lg object-contain"
                                />
                              )}
                            </div>
                            {(isCorrect || isSelected) && (
                              <span
                                className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded self-start shrink-0 ${
                                  isCorrect ? "bg-emerald-100 text-emerald-800" : "bg-blue-100 text-blue-800"
                                }`}
                              >
                                {isCorrect && isSelected ? "Selected • Correct" : isCorrect ? "Correct" : "Selected"}
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* True / False Option Cards */}
                  {qa.question.type === "truefalse" && (
                    <div className="grid grid-cols-2 gap-2.5 max-w-md">
                      {(["True", "False"] as const).map((tfOption) => {
                        const studentTf = normalizeTrueFalseAnswer(Array.isArray(qa.studentAnswer) ? qa.studentAnswer[0] : qa.studentAnswer)
                        const correctTf = normalizeTrueFalseAnswer(qa.question.correctAnswer)
                        const isSelected = studentTf === tfOption
                        const isCorrect = showResults && correctTf === tfOption
                        return (
                          <div
                            key={tfOption}
                            className={`flex items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-xs sm:text-sm font-semibold ${
                              isCorrect
                                ? "border-emerald-500 bg-emerald-50/70 text-emerald-900"
                                : isSelected
                                ? "border-blue-500 bg-blue-50/70 text-blue-900"
                                : "border-slate-200 bg-white text-slate-600"
                            }`}
                          >
                            <span>{tfOption}</span>
                            {(isCorrect || isSelected) && (
                              <span
                                className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                                  isCorrect ? "bg-emerald-100 text-emerald-800" : "bg-blue-100 text-blue-800"
                                }`}
                              >
                                {isCorrect && isSelected ? "Selected • Correct" : isCorrect ? "Correct" : "Selected"}
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Descriptive Questions Display with AI breakdown */}
                  {qa.question.type === "descriptive" && (
                    <div className="space-y-3 pt-1">
                      <div className="p-3 sm:p-3.5 rounded-xl bg-slate-50/80 border border-slate-200">
                        <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                          Your Written Response:
                        </span>
                        <div className="text-xs sm:text-sm text-slate-800 whitespace-pre-wrap leading-relaxed break-words">
                          {qa.isSkipped ? (
                            <span className="italic text-slate-400">Question was skipped (no answer submitted).</span>
                          ) : (
                            String(qa.studentAnswer || "No answer text.")
                          )}
                        </div>
                      </div>

                      {showResults && (
                        <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
                          <div className="px-3 sm:px-4 py-2 bg-[#131B2A] text-white flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-1.5 sm:gap-2">
                              <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400 shrink-0" />
                              <span className="text-[11px] sm:text-xs font-semibold tracking-wide">
                                AI Examiner Verification &amp; Breakdown
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 sm:gap-2">
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  qa.marksEarned >= qa.question.marks * 0.85
                                    ? "bg-emerald-500 text-white"
                                    : qa.marksEarned > 0
                                    ? "bg-blue-500 text-white"
                                    : "bg-rose-500 text-white"
                                }`}
                              >
                                {qa.aiEvaluation?.verdict || (qa.marksEarned > 0 ? "Evaluated" : "Needs Review")}
                              </span>
                              <span className="text-[11px] sm:text-xs font-bold text-slate-100 bg-slate-800 px-2 py-0.5 rounded-md">
                                {qa.marksEarned} / {qa.question.marks} Marks
                              </span>
                            </div>
                          </div>

                          <div className="p-3 sm:p-3.5 space-y-2 sm:space-y-2.5">
                            {qa.aiEvaluation?.whyRight && (
                              <div className="p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-200/80">
                                <div className="flex items-center gap-1.5 mb-1 text-emerald-900 font-semibold text-[11px] sm:text-xs">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                  <span>Why You Are Right (Key Concepts &amp; Points Hit)</span>
                                </div>
                                <p className="text-[11px] sm:text-xs text-emerald-950 leading-relaxed pl-4 sm:pl-5 break-words">
                                  {qa.aiEvaluation.whyRight}
                                </p>
                              </div>
                            )}

                            {qa.aiEvaluation?.whyWrong && (
                              <div className="p-2.5 rounded-lg bg-rose-50/70 border border-rose-200/80">
                                <div className="flex items-center gap-1.5 mb-1 text-rose-900 font-semibold text-[11px] sm:text-xs">
                                  <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                                  <span>Why You Are Wrong / Missed Points</span>
                                </div>
                                <p className="text-[11px] sm:text-xs text-rose-950 leading-relaxed pl-4 sm:pl-5 break-words">
                                  {qa.aiEvaluation.whyWrong}
                                </p>
                              </div>
                            )}

                            {qa.aiEvaluation?.feedback && (
                              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                                <span className="text-[10px] sm:text-[11px] font-semibold text-slate-700 block mb-0.5">
                                  Examiner Feedback &amp; Suggestions:
                                </span>
                                <p className="text-[11px] sm:text-xs text-slate-700 leading-relaxed break-words">
                                  {qa.aiEvaluation.feedback}
                                </p>
                              </div>
                            )}

                            {(qa.question.modelAnswer || qa.question.correctAnswer) && (
                              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                                <span className="text-[10px] sm:text-[11px] font-semibold text-slate-600 block mb-0.5">
                                  Model / Reference Answer:
                                </span>
                                <div className="text-[11px] sm:text-xs text-slate-800 leading-relaxed overflow-x-auto break-words">
                                  <MathRenderer
                                    content={String(
                                      qa.question.modelAnswer ||
                                        (Array.isArray(qa.question.correctAnswer)
                                          ? qa.question.correctAnswer.join(", ")
                                          : qa.question.correctAnswer)
                                    )}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Coding Student Answer Block */}
                  {qa.question.type === "coding" && (
                    <div className="space-y-1.5 pt-1 border-t border-slate-100">
                      <span className="text-xs text-slate-400 block">Your Submitted Code:</span>
                      {qa.isSkipped ? (
                        <span className="inline-block px-2.5 py-1 rounded bg-slate-100 text-slate-600 text-xs font-medium">
                          Skipped (no code submitted)
                        </span>
                      ) : (
                        <pre className="overflow-x-auto rounded-xl border border-slate-700 bg-[#131B2A] px-3.5 py-2.5 text-xs font-mono text-slate-100 whitespace-pre-wrap">
                          {String(qa.studentAnswer || "")}
                        </pre>
                      )}
                    </div>
                  )}

                  {/* Fill in the Blanks Answer Row (only for text-entry blanks, not choice grid) */}
                  {!isChoiceWithOptions(qa.question) &&
                    qa.question.type !== "descriptive" &&
                    qa.question.type !== "coding" &&
                    qa.question.type !== "truefalse" && (
                    <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-6 text-xs pt-2 border-t border-slate-100">
                      <div className="flex items-start gap-2 flex-wrap">
                        <span className="text-slate-400 shrink-0 pt-0.5">Your Answer:</span>
                        {qa.isSkipped ? (
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">Skipped</span>
                        ) : (
                          <div className="rounded px-2.5 py-1 font-semibold bg-slate-100 text-slate-800 break-words">
                            {renderFormattedAnswer(qa.studentAnswer, qa.question)}
                          </div>
                        )}
                      </div>
                      {showResults && (
                        <div className="flex items-start gap-2 flex-wrap">
                          <span className="text-slate-400 shrink-0 pt-0.5">Correct Answer:</span>
                          <div className="rounded px-2.5 py-1 font-semibold bg-emerald-50 text-emerald-900 border border-emerald-200/70 break-words">
                            {renderStructuredValue(qa.question.correctAnswer, qa.question, true) || "—"}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* View All Button */}
          {filteredQuestions.length > 5 && !showAllQuestions && (
            <div className="flex justify-center mt-5">
              <button
                onClick={() => setShowAllQuestions(true)}
                className="flex items-center gap-2 px-5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <span>View All {filteredQuestions.length} Questions</span>
                <ChevronDown size={14} />
              </button>
            </div>
          )}
        </div>
      </main>

      <footer className="text-center py-5 text-xs text-slate-400 border-t border-slate-100 mt-4">
        Powered by Progrentures Solution — Empower Your Growth
      </footer>
    </div>
  )
}

export default function AnalyticsResultPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-500 text-sm font-medium">Loading your results...</p>
      </div>
    }>
      <AnalyticsResultInner params={params} />
    </Suspense>
  )
}
