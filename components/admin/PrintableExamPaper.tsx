"use client"

import React, { useState } from "react"
import { Printer, X, CheckCircle2, BookOpen, Clock, Award, FileText, Check, HelpCircle } from "lucide-react"
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

interface PrintableExamPaperProps {
  isOpen: boolean
  onClose: () => void
  questions: GeneratedCompetitiveQuestion[]
  examTitle: string
  subject: string
  examTarget: string
  grade: string
  durationMinutes?: number
  defaultMode?: "student" | "teacher"
  instituteName?: string
}

export function PrintableExamPaper({
  isOpen,
  onClose,
  questions,
  examTitle,
  subject,
  examTarget,
  grade,
  durationMinutes = 60,
  defaultMode = "student",
  instituteName: initialInstitute = "",
}: PrintableExamPaperProps) {
  const [printMode, setPrintMode] = useState<"student" | "teacher">(defaultMode)
  const [scope, setScope] = useState<"all" | "selected">("all")
  
  const cleanInitialName =
    initialInstitute && !initialInstitute.toLowerCase().includes("progrentures")
      ? initialInstitute.trim()
      : "COACHING INSTITUTE"

  const [customInstitute, setCustomInstitute] = useState(cleanInitialName)
  const [showAnswerKeyGrid, setShowAnswerKeyGrid] = useState(true)

  React.useEffect(() => {
    if (initialInstitute && !initialInstitute.toLowerCase().includes("progrentures")) {
      setCustomInstitute(initialInstitute.trim())
    }
  }, [initialInstitute])

  if (!isOpen) return null

  // Calculate total marks
  const totalMarks = questions.reduce((sum, q) => sum + (q.marks || 4), 0)

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
      q.questionFormat === "assertion_reason" ||
      Boolean(parseAssertionReason(q.questionText || ""))
    ) {
      return "assertion"
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

  const checkIsCorrect = (
    opt: string,
    index: number,
    correctAnswer: string,
    isTF: boolean
  ): boolean => {
    if (!correctAnswer) return false
    if (isTF) {
      const isFalse =
        String(correctAnswer).toLowerCase().includes("false") || correctAnswer === "Option B"
      const target = isFalse ? "False" : "True"
      return opt.toLowerCase() === target.toLowerCase()
    }
    if (opt.trim().toLowerCase() === correctAnswer.trim().toLowerCase()) return true
    const letter = ["A", "B", "C", "D"][index]
    if (correctAnswer.trim().toUpperCase() === letter) return true
    if (correctAnswer.trim().toLowerCase() === `option ${letter.toLowerCase()}`) return true
    return false
  }

  const getCorrectAnswerLabel = (q: GeneratedCompetitiveQuestion): string => {
    const qFormat = getQuestionFormat(q)
    const isTF = qFormat === "true_false"
    if (isTF) {
      const isFalse =
        String(q.correctAnswer).toLowerCase().includes("false") || q.correctAnswer === "Option B"
      return isFalse ? "False" : "True"
    }
    const opts = q.options || []
    for (let i = 0; i < opts.length; i++) {
      if (checkIsCorrect(opts[i], i, q.correctAnswer, false)) {
        return ["(A)", "(B)", "(C)", "(D)"][i] || `(${i + 1})`
      }
    }
    const trimmed = (q.correctAnswer || "").trim().toUpperCase()
    if (["A", "B", "C", "D"].includes(trimmed)) return `(${trimmed})`
    if (trimmed.startsWith("OPTION ")) return `(${trimmed.replace("OPTION ", "")})`
    return q.correctAnswer ? `(${q.correctAnswer})` : "-"
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex flex-col items-center p-0 sm:p-4 md:p-6">
      {/* ─── Control Bar (Screen Only, Hidden on Print) ─── */}
      <div className="no-print w-full max-w-5xl bg-white border border-slate-200 rounded-b-2xl sm:rounded-2xl shadow-xl p-3 sm:p-4 mb-4 sticky top-0 sm:top-2 z-10 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-semibold text-slate-900">
                Print Question Paper &amp; Solutions
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-500">
                Official high-resolution A4 printable layout for coaching institutes &amp; students
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 rounded-xl bg-[#1E293B] hover:bg-[#0F172A] text-white font-medium text-xs sm:text-sm flex items-center gap-2 shadow-sm transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print / Save PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Close Preview"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toolbar: Mode switcher & Settings */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Mode Tabs */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setPrintMode("student")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                printMode === "student"
                  ? "bg-white text-slate-900 shadow-xs font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 text-blue-600" />
              <span>Student Copy (Without Solutions)</span>
            </button>

            <button
              type="button"
              onClick={() => setPrintMode("teacher")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                printMode === "teacher"
                  ? "bg-white text-slate-900 shadow-xs font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-emerald-600" />
              <span>Teacher Copy (With Solutions &amp; Key)</span>
            </button>
          </div>

          {/* Quick Configs */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <label className="text-slate-500 font-medium">Coaching Name:</label>
              <input
                type="text"
                value={customInstitute}
                onChange={(e) => setCustomInstitute(e.target.value)}
                placeholder="Enter coaching institute name..."
                className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 bg-white text-slate-800 w-48 sm:w-64 focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>

            {printMode === "teacher" && (
              <label className="flex items-center gap-1.5 text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showAnswerKeyGrid}
                  onChange={(e) => setShowAnswerKeyGrid(e.target.checked)}
                  className="rounded text-slate-900 focus:ring-slate-900 w-3.5 h-3.5"
                />
                <span>Show Master Answer Grid</span>
              </label>
            )}
          </div>
        </div>
      </div>

      {/* ─── Printable Document (Visible on screen preview and on Print) ─── */}
      <div
        id="printable-exam-paper"
        className="w-full max-w-4xl bg-white text-slate-900 shadow-2xl rounded-none sm:rounded-xl p-6 sm:p-10 md:p-12 mb-10 border border-slate-200 print:border-none print:shadow-none print:p-0 print:m-0 print:max-w-none print:w-full"
      >
        {/* ─── Exam Header ─── */}
        <header className="border-b-2 border-slate-900 pb-4 mb-6">
          <div className="text-center space-y-1">
            <h1 className="text-xl sm:text-2xl font-bold uppercase tracking-wider text-slate-950">
              {customInstitute}
            </h1>
            <div className="text-xs sm:text-sm font-semibold tracking-wide text-slate-700 uppercase">
              {examTarget} EXAMINATION PREPARATION &amp; ASSESSMENT
            </div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 pt-1">
              {examTitle || `${examTarget} ${subject} Mock Examination`}
            </h2>
          </div>

          {/* Teacher Mode Alert Banner */}
          {printMode === "teacher" && (
            <div className="mt-3 py-1.5 px-3 bg-emerald-50 border border-emerald-300 rounded text-center text-xs font-bold text-emerald-800 uppercase tracking-widest">
              ★ OFFICIAL TEACHER &amp; COACHING COPY — ANSWER KEY &amp; COMPLETE STEP-BY-STEP SOLUTIONS ★
            </div>
          )}

          {/* Exam Meta Bar */}
          <div className="mt-4 pt-3 border-t border-slate-300 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-medium text-slate-800">
            <div>
              <span className="text-slate-500">Subject:</span> <strong className="font-semibold">{subject}</strong>
            </div>
            <div>
              <span className="text-slate-500">Grade / Class:</span> <strong className="font-semibold">{grade === "both" ? "Class 11 & 12" : `Class ${grade}`}</strong>
            </div>
            <div>
              <span className="text-slate-500">Time Allowed:</span> <strong className="font-semibold">{durationMinutes} Minutes</strong>
            </div>
            <div>
              <span className="text-slate-500">Max Marks:</span> <strong className="font-semibold">{totalMarks} ({questions.length} Questions)</strong>
            </div>
          </div>

          {/* Student Fill-in Box (Student Mode Only) */}
          {printMode === "student" && (
            <div className="mt-4 p-3 border border-slate-300 rounded bg-slate-50/50 text-xs space-y-2 print-avoid-break">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex items-center gap-2">
                  <span className="font-semibold shrink-0">Student Name:</span>
                  <div className="flex-1 border-b border-dotted border-slate-400 h-4"></div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold shrink-0">Roll No / ID:</span>
                  <div className="flex-1 border-b border-dotted border-slate-400 h-4"></div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="flex items-center gap-2">
                  <span className="font-semibold shrink-0">Batch:</span>
                  <div className="flex-1 border-b border-dotted border-slate-400 h-4"></div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold shrink-0">Date:</span>
                  <div className="flex-1 border-b border-dotted border-slate-400 h-4"></div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold shrink-0">Invigilator Sign:</span>
                  <div className="flex-1 border-b border-dotted border-slate-400 h-4"></div>
                </div>
              </div>
            </div>
          )}

          {/* General Instructions */}
          <div className="mt-3 p-2.5 bg-slate-50 border border-slate-200 rounded text-[11px] leading-relaxed text-slate-700 print-avoid-break">
            <strong className="block font-semibold text-slate-900 mb-0.5">GENERAL INSTRUCTIONS:</strong>
            <ol className="list-decimal pl-4 space-y-0.5">
              <li>This question paper contains <strong>{questions.length} questions</strong>. All questions are compulsory.</li>
              <li>Each question carries marks as indicated. Wrong answers carry negative marking where applicable.</li>
              {printMode === "student" ? (
                <>
                  <li>Darken or mark only one response for each question clearly.</li>
                  <li>Use the blank space in margins for rough work. No separate rough sheet will be provided.</li>
                </>
              ) : (
                <li>This reference guide contains the verified master answer key and detailed derivations for faculty discussion.</li>
              )}
            </ol>
          </div>
        </header>

        {/* ─── Teacher Mode: Master Quick Answer Key Grid ─── */}
        {printMode === "teacher" && showAnswerKeyGrid && (
          <section className="mb-6 p-4 border-2 border-emerald-600 rounded-lg bg-emerald-50/30 print-avoid-break">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                <span>Quick Master Answer Key (At-a-Glance)</span>
              </h3>
              <span className="text-[10px] text-emerald-700 font-semibold">Total: {questions.length} Questions</span>
            </div>
            <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5 text-xs">
              {questions.map((q, idx) => {
                const answerLabel = getCorrectAnswerLabel(q)
                return (
                  <div
                    key={q.id || idx}
                    className="p-1 border border-emerald-200 rounded bg-white text-center flex flex-col justify-center shadow-2xs"
                  >
                    <span className="text-[10px] text-slate-500 font-medium leading-none">Q.{idx + 1}</span>
                    <span className="font-bold text-emerald-800 text-xs mt-0.5 leading-none">{answerLabel}</span>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* ─── Questions List ─── */}
        <main className="space-y-6">
          {questions.map((q, idx) => {
            const qFormat = getQuestionFormat(q)
            const isTF = qFormat === "true_false"
            const parsedAR = parseAssertionReason(q.questionText)
            const isAR = qFormat === "assertion" || Boolean(parsedAR)
            const displayOptions = isTF ? ["True", "False"] : q.options || []

            const formatBadge =
              isTF ? "True / False" :
              isAR ? "Assertion & Reason" :
              qFormat === "fib" ? "Fill in the Blank" : "MCQ"

            return (
              <article
                key={q.id || idx}
                className="print-avoid-break pb-5 border-b border-slate-200 last:border-b-0 space-y-2.5"
              >
                {/* Question Metadata Header */}
                <div className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-700">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-slate-900 text-white font-bold text-xs">
                      {idx + 1}
                    </span>
                    <span className="text-slate-900 font-bold">Question {idx + 1}</span>
                    {q.chapter && (
                      <span className="text-[11px] text-slate-500 font-normal">
                        ({q.chapter})
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-medium">
                      {formatBadge}
                    </span>
                    <span className="font-semibold text-slate-800">
                      [+{q.marks || 4}{q.negativeMark ? `, -${q.negativeMark}` : ""}]
                    </span>
                    {printMode === "teacher" && q.pyqReference && (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-medium text-[10px]">
                        {q.pyqReference}
                      </span>
                    )}
                  </div>
                </div>

                {/* Question Statement */}
                {parsedAR ? (
                  <div className="space-y-2 pl-2 border-l-2 border-slate-300 my-2">
                    <div className="text-xs sm:text-sm text-slate-900">
                      <strong className="text-slate-950 font-bold block mb-0.5">Assertion (A):</strong>
                      <MathRenderer content={parsedAR.assertion} />
                    </div>
                    <div className="text-xs sm:text-sm text-slate-900 pt-1">
                      <strong className="text-slate-950 font-bold block mb-0.5">Reason (R):</strong>
                      <MathRenderer content={parsedAR.reason} />
                    </div>
                  </div>
                ) : (
                  <div className="text-xs sm:text-sm leading-relaxed text-slate-900 font-normal pl-1">
                    <MathRenderer content={q.questionText} />
                  </div>
                )}

                {/* Options List */}
                {qFormat === "fib" ? (
                  <div className="pl-1 pt-1">
                    <div className="text-xs font-medium text-slate-600 flex items-center gap-2">
                      <span>Answer:</span>
                      <div className="flex-1 max-w-xs border-b-2 border-slate-400 h-5"></div>
                    </div>
                  </div>
                ) : (
                  <div className={`grid gap-2 pl-1 pt-1 ${isTF ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-2"}`}>
                    {displayOptions.map((opt, oi) => {
                      const letter = isTF ? (opt === "True" ? "T" : "F") : ["(A)", "(B)", "(C)", "(D)"][oi] || `(${oi + 1})`
                      const isCorrect = printMode === "teacher" && checkIsCorrect(opt, oi, q.correctAnswer, isTF)

                      return (
                        <div
                          key={oi}
                          className={`p-2 rounded border text-xs flex items-start gap-2 ${
                            isCorrect
                              ? "bg-emerald-50/80 border-emerald-500 font-medium text-emerald-950"
                              : "border-slate-200 bg-white text-slate-800"
                          }`}
                        >
                          <span
                            className={`w-5 h-5 rounded flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5 ${
                              isCorrect
                                ? "bg-emerald-600 text-white"
                                : "bg-slate-100 text-slate-700 border border-slate-300"
                            }`}
                          >
                            {isCorrect ? "✓" : letter}
                          </span>

                          <div className="flex-1 leading-snug pt-0.5">
                            <MathRenderer content={opt} />
                          </div>

                          {isCorrect && (
                            <span className="text-[10px] uppercase font-bold text-emerald-700 bg-emerald-100 px-1 py-0.5 rounded self-start shrink-0">
                              Correct
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Teacher Mode: Complete Step-by-Step Solution Box */}
                {printMode === "teacher" && (
                  <div className="mt-3 p-3 rounded-lg bg-slate-50 border border-slate-300 text-xs text-slate-800 space-y-1.5 print-avoid-break">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 uppercase tracking-wide text-[11px] flex items-center gap-1 text-emerald-800">
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Step-by-Step Conceptual Solution:</span>
                      </span>
                      <span className="font-semibold text-emerald-700 text-[11px]">
                        Correct Answer: {getCorrectAnswerLabel(q)}
                      </span>
                    </div>
                    <div className="leading-relaxed text-slate-700 pl-1 border-l-2 border-emerald-500">
                      <MathRenderer content={q.explanation || "No explanation provided for this question."} />
                    </div>
                  </div>
                )}
              </article>
            )
          })}
        </main>

        {/* ─── Footer of Document ─── */}
        <footer className="mt-8 pt-4 border-t border-slate-300 text-center text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2 print-avoid-break">
          <span>{examTitle || `${examTarget} ${subject}`} · {printMode === "student" ? "Student Examination Booklet" : "Teacher Solution Key"}</span>
          <span className="font-medium text-slate-700">*** END OF QUESTION PAPER ***</span>
          <span>{customInstitute}</span>
        </footer>
      </div>
    </div>
  )
}
