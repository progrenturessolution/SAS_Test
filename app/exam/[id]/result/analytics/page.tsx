"use client"

import { useState, useEffect, use, useMemo, Suspense, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer
} from "recharts"
import {
  CheckCircle2, XCircle, BarChart2, ChevronDown,
  Download, Printer, Share2, HelpCircle, Target, FileText,
  TrendingUp, EyeOff, LayoutDashboard, Mail, Calendar, Check, Bell, Award
} from "lucide-react"
import { ProcrentureLogo } from "@/components/exam/ExamShared"
import { MathRenderer } from "@/components/exam/MathRenderer"
import { ResultAnalyticsSkeleton } from "@/components/SkeletonLoaders"
import katex from "katex"
import "katex/dist/katex.min.css"

// ─── Types ─────────────────────────────────────────────────────────────────────

interface QuestionData {
  _id: string
  type: "mcq" | "truefalse" | "descriptive" | "fillblanks" | "coding"
  questionText: string
  questionImage?: string
  codeSnippet?: string
  options?: string[]
  optionImages?: string[]
  correctAnswer?: string | string[]
  marks: number
  negativeMark?: number
  difficulty?: string
  blanks?: { id: number; label: string; answer: string }[]
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
  marks?: number
}

interface AttemptResult {
  _id: string
  examId: {
    _id: string; title: string; totalMarks: number; passMarks: number; duration: number; subject?: string
  }
  studentName: string
  studentEmail: string
  rollNumber: string
  score: number
  maxScore: number
  percentage: number
  passed: boolean
  timeSpent: number
  submittedAt: string
  startedAt?: string
  status: "in-progress" | "submitted" | "auto-submitted" | "graded"
  isGraded?: boolean
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
    if (!attemptId) { router.push(`/exam/${id}`); return }
    
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
          `/api/attempts?examId=${id}&rollNumber=${mainAttempt.rollNumber}&studentEmail=${mainAttempt.studentEmail}`
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
        const studentAns = attempt.answers.find(a => a.questionId === q._id?.toString())
        const answerValue = studentAns?.answer
        const isEmpty = !answerValue || (Array.isArray(answerValue) ? answerValue.every(v => !v) : answerValue === "")

        let isCorrect = false
        let marksEarned = 0

        if (isEmpty) {
          sSkipped++
        } else {
          if (q.type === "mcq" || q.type === "truefalse") {
            const correct = Array.isArray(q.correctAnswer) ? q.correctAnswer[0] : q.correctAnswer
            const studentAnswer = Array.isArray(answerValue) ? answerValue[0] : answerValue
            if (answersMatch(studentAnswer, correct, q.type === "mcq" ? q.options : undefined)) {
              isCorrect = true
              marksEarned = q.marks
              sCorrect++
            } else {
              sIncorrect++
            }
          } else if (q.type === "fillblanks" && q.blanks) {
            const studentAnswers = Array.isArray(answerValue) ? answerValue : [answerValue]
            let blankCorrect = 0
            q.blanks.forEach((blank, i) => {
              if (studentAnswers[i] && studentAnswers[i].toLowerCase().trim() === blank.answer.toLowerCase().trim()) {
                blankCorrect++
              }
            })
            marksEarned = (blankCorrect / q.blanks.length) * q.marks
            if (blankCorrect === q.blanks.length) {
              isCorrect = true
              sCorrect++
            } else if (blankCorrect > 0) {
              sCorrect++ // partially correct
            } else {
              sIncorrect++
            }
          } else {
            // descriptive/coding — can't auto-grade, treat as attempted
            sCorrect++ // assume submitted = attempted
            marksEarned = studentAns?.marks ?? 0
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
        })
      }

      sectionAnalyses.push({
        name: section.name,
        type: section.type,
        totalQuestions: section.questions.length,
        correct: sCorrect,
        incorrect: sIncorrect,
        skipped: sSkipped,
        marksObtained: Math.round(sMarks * 100) / 100,
        maxMarks: sMax,
        percentage: sMax > 0 ? Math.round((sMarks / sMax) * 100) : 0,
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
  const calculatedScore = showResults
    ? Math.round(analytics.questionAnalyses.reduce((total, qa) => {
        if (qa.isSkipped) return total
        if (qa.isCorrect || qa.marksEarned > 0) return total + qa.marksEarned

        const section = examFull.sections.find(section => section.name === qa.sectionName)
        const negativeMarking = section?.negativeMarking || examFull.settings?.negativeMarking || false
        if (negativeMarking && (qa.question.type === "mcq" || qa.question.type === "truefalse")) {
          return total - Math.abs(qa.question.negativeMark ?? section?.sectionNegativeMark ?? 0)
        }
        return total
      }, 0) * 100) / 100
    : 0
  const displayScore = showResults ? calculatedScore : attempt.score
  const passed = showResults ? displayScore >= exam.passMarks : attempt.passed
  const submittedDate = attempt.submittedAt ? new Date(attempt.submittedAt) : null
  const formattedDate = submittedDate
    ? `Completed on ${submittedDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
    : "Completed"
  const timeTakenMin = Math.floor((attempt.timeSpent || 0) / 60)
  const timeTakenSec = (attempt.timeSpent || 0) % 60
  const timeTakenStr = `${timeTakenMin > 0 ? timeTakenMin + "m " : ""}${timeTakenSec > 0 ? timeTakenSec + "s" : timeTakenMin > 0 ? "" : "0s"}`
  const passMarksDiff = displayScore - exam.passMarks
  const isGraded = attempt.status === "graded" || attempt.isGraded === true
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

  const formatAnswer = (answer: string | string[] | null, q: QuestionData) => {
    if (!answer) return null
    if (q.type === "mcq" && q.options) {
      const value = typeof answer === "string" ? answer : answer[0]
      const idx = getOptionIndex(value, q.options)
      if (idx >= 0) return `${String.fromCharCode(65 + idx)}) ${q.options[idx]}`
      return String(answer)
    }

    if (Array.isArray(answer)) return answer.join(", ")
    return String(answer)
  }

  const renderFormattedAnswer = (answer: string | string[] | null, q: QuestionData) => {
    const formattedAnswer = formatAnswer(answer, q)
    if (!formattedAnswer) return null

    return (
      <div className="min-w-0 text-[#45505F]">
        {q.type === "fillblanks" && Array.isArray(answer) ? (
          <div className="space-y-1">
            {answer.map((value, index) => (
              <div key={`${value}-${index}`} className="flex items-start gap-1.5">
                <span className="shrink-0 font-semibold">{index + 1}.</span>
                <MathRenderer content={value || "—"} />
              </div>
            ))}
          </div>
        ) : (
          <MathRenderer content={formattedAnswer} />
        )}
      </div>
    )
  }

  const formatCorrectAnswer = (q: QuestionData) => {
    if (q.type === "mcq" && q.options && q.correctAnswer) {
      const ca = Array.isArray(q.correctAnswer) ? q.correctAnswer[0] : q.correctAnswer
      const idx = getOptionIndex(ca, q.options)
      if (idx >= 0) return `${String.fromCharCode(65 + idx)}) ${q.options[idx]}`
      return String(ca)
    }
    if (q.type === "truefalse") return String(q.correctAnswer)
    if (q.type === "fillblanks" && q.blanks) return q.blanks.map(b => b.answer).join(", ")
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
    const normalized = value
      .replace(/\\\\/g, "\\")
      .replace(/\u000c/g, "\\frac")
      .replace(/\u0008/g, "\\b")
      .replace(/\u0009/g, " ")
      .replace(/\\\(/g, "$")
      .replace(/\\\)/g, "$")
      .replace(/\\\[/g, "$$")
      .replace(/\\\]/g, "$$")
    return normalized.split(/(\$\$[\s\S]*?\$\$|\$[^$\n]+\$)/g).map(part => {
      if (part.startsWith("$$") && part.endsWith("$$")) {
        return `<div class="formula display-formula">${katex.renderToString(part.slice(2, -2).trim(), { displayMode: true, throwOnError: false, strict: "ignore" })}</div>`
      }
      if (part.startsWith("$") && part.endsWith("$")) {
        return `<span class="formula">${katex.renderToString(part.slice(1, -1).trim(), { displayMode: false, throwOnError: false, strict: "ignore" })}</span>`
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
      const correctAns = showResults ? ((q.question.type === "mcq" || q.question.type === "truefalse" || q.question.type === "fillblanks")
        ? formatCorrectAnswer(q.question) : "—") : "—"
      const selectedIndex = q.question.options
        ? getOptionIndex(Array.isArray(q.studentAnswer) ? q.studentAnswer[0] : q.studentAnswer, q.question.options)
        : -1
      const correctIndex = q.question.options
        ? getOptionIndex(Array.isArray(q.question.correctAnswer) ? q.question.correctAnswer[0] : q.question.correctAnswer, q.question.options)
        : -1
      const optionsHtml = q.question.type === "mcq" && q.question.options
        ? `<div class="options-grid">${q.question.options.map((option: string, optionIndex: number) => {
            const optionKey = String.fromCharCode(65 + optionIndex)
            const isSelected = selectedIndex === optionIndex
            const isCorrect = showResults && correctIndex === optionIndex
            const optionImage = q.question.optionImages?.[optionIndex]
            const label = isCorrect ? "Correct" : isSelected ? "Selected" : ""
            return `<div class="option ${isCorrect ? "option-correct" : isSelected ? "option-selected" : ""}">
              <span class="option-key">${optionKey}</span>
              <div class="option-content">${renderPrintableMath(option)}${optionImage ? `<img src="${escapeHtml(optionImage)}" alt="Option ${optionKey}" />` : ""}</div>
              ${label ? `<span class="option-label">${label}</span>` : ""}
            </div>`
          }).join("")}</div>`
        : ""
      const questionImage = q.question.questionImage
        ? `<img class="question-image" src="${escapeHtml(q.question.questionImage)}" alt="Question" />`
        : ""
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
            <strong>Your Answer:</strong> ${q.isSkipped ? "—" : renderPrintableMath(yourAns)}
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
      <div class="header">
        <div style="display:flex;align-items:center;gap:12px">
          <img src="${window.location.origin}/logo.png" alt="Progrentures" style="height:32px;object-fit:contain;filter:brightness(10)" />
          <div>
            <h1>Progrentures Solution</h1>
            <div class="sub">Exam Report</div>
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
          <div class="item"><div class="lbl">Student Name</div><div class="val">${attempt.studentName}</div></div>
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



  return (
    <div className="min-h-screen bg-[#f8f9fc] font-sans">
      {/* ─── Top Header ───────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-200 px-8 py-3 flex items-center justify-between sticky top-0 z-30 print:hidden">
        <div className="flex items-center gap-3">
          <ProcrentureLogo />
          <span className="text-sm font-semibold text-[#1a2535] ml-2 hidden sm:inline">Exam Report</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadPDF}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <Download size={14} /> Download
          </button>
          {/* <button
            onClick={() => { navigator.clipboard.writeText(window.location.href) }}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-[#2D3A4A] rounded-lg hover:bg-[#1e2a38] transition-colors"
          >
            <Share2 size={14} /> Share
          </button> */}
        </div>
      </header>

      <main className="max-w-[1100px] mx-auto px-6 py-8">
        {/* ─── Hero Section ───────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left: Donut + Exam Info */}
            <div className="flex items-start gap-6 flex-1">
              <div className="shrink-0">
                <DonutChart
                  segments={showResults ? [
                  { value: analytics.totalCorrect, color: "#45505F", label: "Correct" },
                  { value: analytics.totalIncorrect, color: "#94A7C5", label: "Incorrect" },
                  { value: analytics.totalSkipped, color: "#2D3A4A", label: "Skipped" },
                  ] : [
                    { value: analytics.totalCorrect + analytics.totalIncorrect, color: "var(--primary)", label: "Attempted" },
                    { value: analytics.totalSkipped, color: "#cbd5e1", label: "Skipped" },
                  ]}
                  size={140}
                  strokeWidth={24}
                  centerLabel={String(analytics.totalQuestions)}
                  centerSub="Questions"
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  {showResults ? (
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${passed ? "bg-[#45505F] text-white" : "bg-[#94A7C5] text-white"}`}>
                      {passed ? "PASSED" : "FAILED"}
                    </span>
                  ) : (
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-primary text-white">
                      SUBMITTED
                    </span>
                  )}
                  <span className="text-xs text-gray-400">{formattedDate}</span>
                </div>
                <h1 className="text-xl font-extrabold text-[#1a2535] mb-0.5">{exam.title}</h1>
                <p className="text-sm text-gray-400 mb-3">
                  {examFull.class ? `${examFull.class} — ` : ""}{examFull.subject || "Assessment"}
                </p>
                <div className="flex items-center gap-6 flex-wrap">
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold">
                      {showResults ? "Your Score" : "Status"}
                    </p>
                    <p className="text-lg font-extrabold text-[#1a2535]">
                      {showResults ? `${displayScore} / ${totalScore}` : "Submitted"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold">Questions</p>
                    <p className="text-lg font-extrabold text-[#1a2535]">{analytics.totalQuestions}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold">Time Taken</p>
                    <p className="text-lg font-extrabold text-[#1a2535]">{timeTakenStr || "N/A"}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Performance Summary */}
            <div className="lg:w-[340px] shrink-0">
              <h3 className="text-sm font-bold text-[#1a2535] mb-3">Performance Summary</h3>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg border bg-gray-50 border-gray-100">
                  <CheckCircle2 size={16} className="text-[#45505F] shrink-0" />
                  <span className="text-sm font-medium text-gray-600">{showResults ? "Correct" : "Attempted"}</span>
                  <span className="ml-auto text-lg font-extrabold text-[#45505F]">
                    {showResults ? analytics.totalCorrect : (analytics.totalCorrect + analytics.totalIncorrect)}
                  </span>
                </div>
                {showResults && (
                  <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-50 rounded-lg border border-gray-100">
                    <XCircle size={16} className="text-[#94A7C5] shrink-0" />
                    <span className="text-sm font-medium text-gray-600">Incorrect</span>
                    <span className="ml-auto text-lg font-extrabold text-[#94A7C5]">{analytics.totalIncorrect}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-50 rounded-lg border border-gray-100">
                  <HelpCircle size={16} className="text-[#2D3A4A] shrink-0" />
                  <span className="text-sm font-medium text-gray-600">Skipped</span>
                  <span className="ml-auto text-lg font-extrabold text-[#2D3A4A]">{analytics.totalSkipped}</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-50 rounded-lg border border-gray-100">
                  <Target size={16} className="text-[#45505F] shrink-0" />
                  <span className="text-sm font-medium text-gray-600">Accuracy</span>
                  <span className="ml-auto text-lg font-extrabold text-[#45505F]">
                    {showResults ? `${analytics.accuracy}%` : "---"}
                  </span>
                </div>
                {showResults && (
                  <div className="col-span-2 flex items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5">
                    <Award size={16} className="shrink-0 text-[#45505F]" />
                    <span className="text-sm font-medium text-gray-600">Total Score</span>
                    <span className="ml-auto text-lg font-extrabold text-[#45505F]">
                      {displayScore} / {totalScore}
                    </span>
                  </div>
                )}
              </div>
              {/* Pass/Fail Banner */}
              {showResults && (
                <div className={`mt-3 px-4 py-2 rounded-lg text-center text-xs font-semibold ${
                  passed ? "bg-gray-50 text-[#45505F] border border-gray-200" : "bg-gray-50 text-[#94A7C5] border border-gray-200"
                }`}>
                  Pass Marks: {exam.passMarks}/{exam.totalMarks} — You scored {Math.abs(passMarksDiff)} marks {passMarksDiff >= 0 ? "above" : "below"} pass line!
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ─── Score Trend Row (Recharts) ────────────────────────────────────────── */}
        {showResults && history.length > 1 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
            <h3 className="text-base font-bold text-[#1a2535] mb-4 flex items-center gap-2">
              <TrendingUp size={16} className="text-blue-500" />
              Score Trend
            </h3>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={history.map((h, i) => ({
                    name: `Attempt ${i + 1}`,
                    score: h.score,
                    percentage: h.percentage,
                    date: new Date(h.submittedAt || h.startedAt || Date.now()).toLocaleDateString()
                  }))}
                  margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#94a3b8', fontSize: 12 }} 
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                    domain={[0, 100]}
                    unit="%"
                  />
                  <RechartsTooltip 
                    contentStyle={{ 
                      borderRadius: '12px', 
                      border: 'none', 
                      boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                      fontSize: '12px'
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="percentage" 
                    stroke="#3b82f6" 
                    strokeWidth={3}
                    dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4, stroke: '#fff' }}
                    activeDot={{ r: 6, strokeWidth: 0 }}
                    name="Score %"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[11px] text-gray-400 mt-4 text-center">
              This chart shows your performance across all {history.length} attempts for this exam.
            </p>
          </div>
        )}

        {/* ─── Charts Row ─────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Answer Distribution */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h3 className="text-base font-bold text-[#1a2535] mb-4 flex items-center gap-2">
              <BarChart2 size={16} className="text-gray-400" />
              Solved vs. Total
            </h3>
            <div className="flex items-center justify-center">
              <div className="relative">
                <DonutChart
                  segments={[
                    { value: analytics.totalQuestions - analytics.totalSkipped, color: "#45505F", label: "Solved" },
                    { value: analytics.totalSkipped, color: "#f1f5f9", label: "Remaining" },
                  ]}
                  size={180}
                  strokeWidth={32}
                  centerLabel={`${analytics.totalQuestions - analytics.totalSkipped}/${analytics.totalQuestions}`}
                  centerSub="Questions Solved"
                />
              </div>
            </div>
            <div className="flex justify-center gap-6 mt-4">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#45505F]" />
                <span className="text-xs text-gray-500">Solved ({analytics.totalQuestions - analytics.totalSkipped})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-gray-100 border border-gray-200" />
                <span className="text-xs text-gray-500">Skipped ({analytics.totalSkipped})</span>
              </div>
            </div>
          </div>

          {/* Section-wise Performance Bar Chart */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h3 className="text-base font-bold text-[#1a2535] mb-4 flex items-center gap-2">
              <BarChart2 size={16} className="text-gray-400" />
              Section-wise Performance
            </h3>
            <BarChart
              showResults={showResults}
              data={analytics.sectionAnalyses.map((s, i) => ({
                label: s.name,
                value: s.percentage,
                color: getSectionColor(i),
              }))}
            />
          </div>
        </div>

        {/* ─── Section-wise Breakdown Table ────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
          <h3 className="text-base font-bold text-[#1a2535] mb-4">Section-wise Breakdown</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-3 px-3 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Section</th>
                  <th className="text-center py-3 px-3 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Questions</th>
                  {showResults ? (
                    <>
                      <th className="text-center py-3 px-3 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Correct</th>
                      <th className="text-center py-3 px-3 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Incorrect</th>
                    </>
                  ) : (
                    <th className="text-center py-3 px-3 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Attempted</th>
                  )}
                  <th className="text-center py-3 px-3 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Skipped</th>
                  {showResults && <th className="text-center py-3 px-3 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Marks</th>}
                  <th className="py-3 px-3 text-[10px] uppercase tracking-wider text-gray-400 font-semibold text-right w-[180px]">
                    {showResults ? "Score" : "Completion"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {analytics.sectionAnalyses.map((sec, i) => (
                  <tr key={sec.name} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <span className="w-1 h-6 rounded-full" style={{ backgroundColor: getSectionColor(i) }} />
                        <span className="font-semibold text-[#1a2535]">{sec.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-center text-gray-600">{sec.totalQuestions}</td>
                    {showResults ? (
                      <>
                        <td className="py-3 px-3 text-center font-semibold text-[#45505F]">{sec.correct}</td>
                        <td className="py-3 px-3 text-center font-semibold text-[#94A7C5]">{sec.incorrect}</td>
                      </>
                    ) : (
                      <td className="py-3 px-3 text-center font-semibold text-primary">{sec.correct + sec.incorrect}</td>
                    )}
                    <td className="py-3 px-3 text-center font-semibold text-[#2D3A4A]">{sec.skipped}</td>
                    {showResults && <td className="py-3 px-3 text-center text-gray-600">{sec.marksObtained} / {sec.maxMarks}</td>}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2 justify-end">
                        <div className="w-24 bg-gray-100 rounded-full h-2">
                          <div
                            className="h-2 rounded-full transition-all duration-700"
                            style={{
                              width: `${sec.percentage}%`,
                              backgroundColor: getSectionColor(i),
                            }}
                          />
                        </div>
                        {showResults && (
                          <span className="text-xs font-bold min-w-[32px] text-right" style={{ color: getSectionColor(i) }}>
                            {sec.percentage}%
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ─── Question-wise Analysis ─────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
            <h3 className="text-base font-bold text-[#1a2535]">Question-wise Analysis</h3>
            <div className="flex items-center gap-1.5 bg-gray-100 rounded-lg p-0.5">
              {(showResults ? (["all", "correct", "incorrect", "skipped"] as const) : (["all", "attempted", "skipped"] as const)).map(filter => (
                <button
                  key={filter}
                  onClick={() => { setQuestionFilter(filter); setShowAllQuestions(false) }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md capitalize transition-colors ${
                    questionFilter === filter
                      ? "bg-accent text-white shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {displayedQuestions.length === 0 && (
              <p className="text-center text-gray-400 text-sm py-8">No questions match this filter.</p>
            )}
            {displayedQuestions.map((qa, idx) => {
              const globalIdx = analytics.questionAnalyses.indexOf(qa) + 1
              // If results are hidden, use neutral colors for attempted questions
              const borderColor = !showResults 
                ? (qa.isSkipped ? "#2D3A4A" : "#45505F") 
                : (qa.isSkipped ? "#2D3A4A" : qa.isCorrect ? "#45505F" : "#94A7C5")
              const bgColor = !showResults
                ? (qa.isSkipped ? "bg-gray-50/40" : "bg-gray-50/40")
                : (qa.isSkipped ? "bg-gray-50/40" : qa.isCorrect ? "bg-gray-50/40" : "bg-gray-50/40")

              return (
                <div key={`${qa.question._id}-${idx}`} className={`rounded-xl border-l-4 p-4 ${bgColor}`} style={{ borderLeftColor: borderColor }}>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-bold text-white" style={{ backgroundColor: borderColor }}>
                        Q{globalIdx}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${TYPE_COLORS[qa.question.type] || "bg-gray-100 text-gray-600"}`}>
                        {TYPE_LABELS[qa.question.type] || qa.question.type}
                      </span>
                      {showResults && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-500">
                          {qa.question.marks} Mark{qa.question.marks !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`text-xs font-semibold ${!showResults ? (qa.isSkipped ? "text-[#2D3A4A]" : "text-[#45505F]") : (qa.isSkipped ? "text-[#2D3A4A]" : qa.isCorrect ? "text-[#45505F]" : "text-[#94A7C5]")}`}>
                        {showResults 
                          ? (qa.isSkipped ? `Skipped — 0 marks` : qa.isCorrect ? `+${qa.marksEarned} marks earned` : `0 marks earned`)
                          : (qa.isSkipped ? `Skipped` : "Attempted")
                        }
                      </span>
                      {qa.isSkipped ? (
                        <span className="w-5 h-5 rounded-full bg-[#2D3A4A] flex items-center justify-center">
                          <span className="text-white text-[10px] font-bold">—</span>
                        </span>
                      ) : showResults ? (
                        qa.isCorrect ? <CheckCircle2 size={18} className="text-[#45505F]" /> : <XCircle size={18} className="text-[#94A7C5]" />
                      ) : (
                        <CheckCircle2 size={18} className="text-[#45505F]" />
                      )}
                    </div>
                  </div>

                  <div className="mb-3 text-sm font-medium text-[#1a2535]">
                    <MathRenderer content={qa.question.questionText} />
                  </div>
                  {qa.question.questionImage && (
                    <div className="mb-3 flex max-h-100 w-full items-center justify-center overflow-hidden rounded-xl border border-gray-100 bg-gray-50">
                      <img
                        src={qa.question.questionImage}
                        alt="Question"
                        className="max-h-100 max-w-full object-contain"
                      />
                    </div>
                  )}
                  {qa.question.codeSnippet && (
                    <pre className="mb-3 overflow-x-auto rounded-xl border border-gray-300 bg-[#1e2a38] px-4 py-3 text-xs text-gray-200">
                      {qa.question.codeSnippet}
                    </pre>
                  )}
                  {qa.question.type === "mcq" && qa.question.options && (
                    <div className="mb-4 grid grid-cols-1 gap-2 md:grid-cols-2">
                      {qa.question.options.map((option, optionIndex) => {
                        const optionKey = String.fromCharCode(65 + optionIndex)
                        const studentAnswer = Array.isArray(qa.studentAnswer)
                          ? qa.studentAnswer[0]
                          : qa.studentAnswer
                        const correctAnswer = Array.isArray(qa.question.correctAnswer)
                          ? qa.question.correctAnswer[0]
                          : qa.question.correctAnswer
                        const isSelected = getOptionIndex(studentAnswer, qa.question.options!) === optionIndex
                        const isCorrect = showResults && getOptionIndex(correctAnswer, qa.question.options!) === optionIndex
                        const optionImage = qa.question.optionImages?.[optionIndex]

                        return (
                          <div
                            key={`${qa.question._id}-option-${optionKey}`}
                            className={`flex items-start gap-3 rounded-xl border-2 p-3 ${
                              isCorrect
                                ? "border-emerald-500 bg-emerald-50"
                                : isSelected
                                  ? "border-blue-500 bg-blue-50"
                                  : "border-gray-200 bg-white"
                            }`}
                          >
                            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                              isCorrect
                                ? "bg-emerald-600 text-white"
                                : isSelected
                                  ? "bg-blue-600 text-white"
                                  : "bg-gray-100 text-gray-600"
                            }`}>
                              {optionKey}
                            </span>
                            <div className="min-w-0 flex-1">
                              <MathRenderer content={option} />
                              {optionImage && (
                                <img
                                  src={optionImage}
                                  alt={`Option ${optionKey}`}
                                  className="mt-2 max-h-32 max-w-full rounded-lg object-contain"
                                />
                              )}
                            </div>
                            {(isCorrect || isSelected) && (
                              <span className={`shrink-0 text-[10px] font-bold uppercase ${
                                isCorrect ? "text-emerald-700" : "text-blue-700"
                              }`}>
                                {isCorrect ? "Correct" : "Selected"}
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                    <div className="flex items-center gap-4 flex-wrap text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="text-gray-400">Your Answer:</span>
                        {qa.isSkipped ? (
                          <span className="px-2.5 py-1 rounded-md bg-gray-100 text-[#2D3A4A] font-semibold">Skipped</span>
                        ) : (
                          <div className={`rounded-md px-2.5 py-1 font-semibold ${showResults ? (qa.isCorrect ? "bg-gray-100 text-[#45505F]" : "bg-gray-100 text-[#94A7C5]") : "bg-gray-100 text-[#45505F]"}`}>
                            {renderFormattedAnswer(qa.studentAnswer, qa.question)}
                          </div>
                        )}
                      </div>
                      {showResults && (qa.question.type === "mcq" || qa.question.type === "truefalse" || qa.question.type === "fillblanks") && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-gray-400">Correct Answer:</span>
                          <div className="rounded-md bg-gray-100 px-2.5 py-1 font-semibold text-[#45505F]">
                            <MathRenderer content={formatCorrectAnswer(qa.question)} />
                          </div>
                        </div>
                      )}
                    </div>

                  {/* Explanation */}
                  {showResults && (qa.question as any).explanation && !qa.isCorrect && (
                    <div className="mt-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
                      <p className="text-xs text-[#45505F]">
                        <span className="font-semibold">Explanation:</span> {(qa.question as any).explanation}
                      </p>
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
                className="flex items-center gap-2 px-6 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-[#1a2535] hover:bg-gray-100 transition-colors"
              >
                View All {filteredQuestions.length} Questions
                <ChevronDown size={14} />
              </button>
            </div>
          )}
        </div>
      </main>

      <footer className="text-center py-5 text-xs text-gray-400 border-t border-gray-100 mt-4">
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
