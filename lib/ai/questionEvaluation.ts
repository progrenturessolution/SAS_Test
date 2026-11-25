import {
  normalizeCompareText,
  normalizeStoredQuestion,
  normalizeTrueFalseAnswer,
  resolveMultiOptionAnswers,
  resolveSingleOptionAnswer,
  type CanonicalFormat,
} from "./canonicalSchema"

export interface EvaluationInputQuestion {
  id?: string
  _id?: string
  type?: string
  questionFormat?: string
  questionText?: string
  options?: string[]
  correctAnswer?: string | string[]
  blanks?: Array<{ id?: number; label?: string; answer: string; alsoAccept?: string[]; caseInsensitive?: boolean }>
  caseInsensitive?: boolean
  modelAnswer?: string
  rubric?: string[]
  marks?: number
  negativeMark?: number
  scoringMode?: string
  questionImage?: string
  assertionText?: string
  reasonText?: string
  explanation?: string
}

export interface ObjectiveEvalResult {
  format: CanonicalFormat
  attempted: boolean
  isCorrect: boolean
  isPartiallyCorrect: boolean
  correctCount: number
  totalExpected: number
  earnedMarks: number
  negativeApplied: number
  maxMarks: number
  resolvedCorrectOptions: string[]
  resolvedStudentOptions: string[]
}

function normalizeAnswerScalar(value: string): string {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
}

function parseMultiTokens(answer: string | string[] | undefined): string[] {
  if (!answer) return []
  if (Array.isArray(answer)) return answer.map((v) => String(v ?? "").trim()).filter(Boolean)
  const s = String(answer).trim()
  if (!s) return []
  if (s.startsWith("[") && s.endsWith("]")) {
    try {
      const parsed = JSON.parse(s)
      if (Array.isArray(parsed)) return parsed.map((v) => String(v ?? "").trim()).filter(Boolean)
    } catch {
      return s.slice(1, -1).split(",").map((x) => x.trim()).filter(Boolean)
    }
  }
  return [s]
}

export function isObjectiveFormat(format: CanonicalFormat): boolean {
  return (
    format === "mcq_single" ||
    format === "mcq_multi" ||
    format === "assertion" ||
    format === "true_false" ||
    format === "fib" ||
    format === "diagram"
  )
}

/**
 * Deterministically grades any objective question (mcq_single, mcq_multi, assertion,
 * true_false, fillblanks in either blank-entry or 4-option mode, diagram) using the Canonical Schema.
 */
export function evaluateObjectiveAnswer(
  rawQuestion: EvaluationInputQuestion,
  studentRawAnswer: string | string[] | undefined | null,
  sectionDefaults?: { negativeMarking?: boolean; negativeValue?: number }
): ObjectiveEvalResult {
  const canonical = normalizeStoredQuestion(rawQuestion)
  const maxMarks = Math.max(0, Number(rawQuestion.marks ?? canonical.marks ?? 1))
  const negEnabled = Boolean(sectionDefaults?.negativeMarking) || Number(rawQuestion.negativeMark || 0) > 0
  const negAmount =
    rawQuestion.negativeMark !== undefined && Number(rawQuestion.negativeMark) >= 0
      ? Number(rawQuestion.negativeMark)
      : Number(sectionDefaults?.negativeValue ?? 0)

  const format = canonical.questionFormat

  if (format === "mcq_multi") {
    const opts = canonical.options || []
    const expectedList = resolveMultiOptionAnswers(rawQuestion.correctAnswer ?? canonical.correctAnswer, opts) || []
    const studentList = resolveMultiOptionAnswers(studentRawAnswer, opts) || []
    const rawTokens = parseMultiTokens(studentRawAnswer as any)
    const attempted = rawTokens.length > 0

    if (!attempted || expectedList.length === 0) {
      return {
        format,
        attempted,
        isCorrect: false,
        isPartiallyCorrect: false,
        correctCount: 0,
        totalExpected: expectedList.length,
        earnedMarks: 0,
        negativeApplied: 0,
        maxMarks,
        resolvedCorrectOptions: expectedList,
        resolvedStudentOptions: studentList,
      }
    }

    const expectedSet = new Set(expectedList.map((e) => normalizeCompareText(e)))
    const studentSet = new Set(studentList.map((s) => normalizeCompareText(s)))

    const anyWrong = Array.from(studentSet).some((s) => !expectedSet.has(s))
    let matchCount = 0
    for (const s of studentSet) {
      if (expectedSet.has(s)) matchCount++
    }

    const allMatched = !anyWrong && matchCount === expectedSet.size && expectedSet.size > 0
    const scoringMode = rawQuestion.scoringMode === "all" ? "all" : "partial"

    if (allMatched) {
      return {
        format,
        attempted: true,
        isCorrect: true,
        isPartiallyCorrect: false,
        correctCount: matchCount,
        totalExpected: expectedSet.size,
        earnedMarks: maxMarks,
        negativeApplied: 0,
        maxMarks,
        resolvedCorrectOptions: expectedList,
        resolvedStudentOptions: studentList,
      }
    }

    if (anyWrong) {
      const penalty = negEnabled ? Math.abs(negAmount) : 0
      return {
        format,
        attempted: true,
        isCorrect: false,
        isPartiallyCorrect: false,
        correctCount: 0,
        totalExpected: expectedSet.size,
        earnedMarks: penalty > 0 ? -penalty : 0,
        negativeApplied: penalty,
        maxMarks,
        resolvedCorrectOptions: expectedList,
        resolvedStudentOptions: studentList,
      }
    }

    // Partial positive credit when subset of correct options selected and no wrong options selected
    const earned =
      scoringMode === "partial" ? Math.round(((maxMarks * matchCount) / expectedSet.size) * 100) / 100 : 0

    return {
      format,
      attempted: true,
      isCorrect: false,
      isPartiallyCorrect: earned > 0,
      correctCount: matchCount,
      totalExpected: expectedSet.size,
      earnedMarks: earned,
      negativeApplied: 0,
      maxMarks,
      resolvedCorrectOptions: expectedList,
      resolvedStudentOptions: studentList,
    }
  }

  if (format === "true_false") {
    const expectedTf = normalizeTrueFalseAnswer(canonical.correctAnswer)
    const studentTf = normalizeTrueFalseAnswer(Array.isArray(studentRawAnswer) ? studentRawAnswer[0] : studentRawAnswer)
    const attempted = Boolean(studentRawAnswer && String(studentRawAnswer).trim())
    const isCorrect = Boolean(expectedTf && studentTf && expectedTf === studentTf)
    const penalty = !isCorrect && attempted && negEnabled ? Math.abs(negAmount) : 0

    return {
      format,
      attempted,
      isCorrect,
      isPartiallyCorrect: false,
      correctCount: isCorrect ? 1 : 0,
      totalExpected: 1,
      earnedMarks: isCorrect ? maxMarks : penalty > 0 ? -penalty : 0,
      negativeApplied: penalty,
      maxMarks,
      resolvedCorrectOptions: expectedTf ? [expectedTf] : [],
      resolvedStudentOptions: studentTf ? [studentTf] : [],
    }
  }

  if (format === "fib") {
    const opts = canonical.options || []
    const blanks = canonical.blanks || []

    // Legacy 4-option Fill-in-the-Blanks (when options[] exist and no explicit multiple blank entries)
    if (opts.length > 0 && blanks.length <= 1 && !Array.isArray(studentRawAnswer)) {
      const studentOpt = resolveSingleOptionAnswer(studentRawAnswer, opts)
      const correctOpt =
        resolveSingleOptionAnswer(rawQuestion.correctAnswer ?? canonical.correctAnswer, opts) ||
        blanks[0]?.answer ||
        ""
      const attempted = Boolean(studentRawAnswer && String(studentRawAnswer).trim())
      const normStu = normalizeAnswerScalar(studentOpt || String(studentRawAnswer || ""))
      const acceptable = [
        normalizeAnswerScalar(correctOpt),
        ...(blanks[0]?.alsoAccept || []).map(normalizeAnswerScalar),
      ].filter(Boolean)
      const isCorrect = attempted && acceptable.includes(normStu)
      const penalty = !isCorrect && attempted && negEnabled ? Math.abs(negAmount) : 0

      return {
        format,
        attempted,
        isCorrect,
        isPartiallyCorrect: false,
        correctCount: isCorrect ? 1 : 0,
        totalExpected: 1,
        earnedMarks: isCorrect ? maxMarks : penalty > 0 ? -penalty : 0,
        negativeApplied: penalty,
        maxMarks,
        resolvedCorrectOptions: correctOpt ? [correctOpt] : [],
        resolvedStudentOptions: studentOpt ? [studentOpt] : attempted ? [String(studentRawAnswer)] : [],
      }
    }

    // Text-entry Fill-in-the-Blanks
    const stuArr = Array.isArray(studentRawAnswer)
      ? studentRawAnswer.map((s) => String(s ?? ""))
      : typeof studentRawAnswer === "string"
        ? [studentRawAnswer]
        : []
    const attempted = stuArr.some((s) => s.trim().length > 0)

    if (!attempted || blanks.length === 0) {
      return {
        format,
        attempted,
        isCorrect: false,
        isPartiallyCorrect: false,
        correctCount: 0,
        totalExpected: Math.max(1, blanks.length),
        earnedMarks: 0,
        negativeApplied: 0,
        maxMarks,
        resolvedCorrectOptions: blanks.map((b) => b.answer),
        resolvedStudentOptions: stuArr,
      }
    }

    const ci = canonical.caseInsensitive !== false
    let correctBlanks = 0
    for (let i = 0; i < blanks.length; i++) {
      const b = blanks[i]
      const rawStu = String(stuArr[i] ?? "").trim().replace(/\s+/g, " ")
      const stuVal = ci ? rawStu.toLowerCase() : rawStu
      const acceptedSet = new Set(
        [b.answer, ...(b.alsoAccept || [])]
          .map((a) => String(a || "").trim().replace(/\s+/g, " "))
          .map((a) => (ci ? a.toLowerCase() : a))
          .filter(Boolean)
      )
      if (stuVal && acceptedSet.has(stuVal)) {
        correctBlanks++
      }
    }

    const allCorrect = correctBlanks === blanks.length
    const earned = blanks.length > 0 ? Math.round(((maxMarks * correctBlanks) / blanks.length) * 100) / 100 : 0

    return {
      format,
      attempted,
      isCorrect: allCorrect,
      isPartiallyCorrect: !allCorrect && correctBlanks > 0,
      correctCount: correctBlanks,
      totalExpected: blanks.length,
      earnedMarks: earned,
      negativeApplied: 0,
      maxMarks,
      resolvedCorrectOptions: blanks.map((b) => b.answer),
      resolvedStudentOptions: stuArr,
    }
  }

  // Single-correct choice types: mcq_single, assertion, diagram
  const opts = canonical.options || []
  const rawStu = Array.isArray(studentRawAnswer) ? studentRawAnswer[0] : studentRawAnswer
  const attempted = Boolean(rawStu && String(rawStu).trim())
  const resolvedCorrect =
    resolveSingleOptionAnswer(rawQuestion.correctAnswer ?? canonical.correctAnswer, opts) ||
    (typeof canonical.correctAnswer === "string" ? canonical.correctAnswer : "")
  const resolvedStudent = resolveSingleOptionAnswer(rawStu, opts) || String(rawStu || "").trim()

  const isCorrect =
    attempted &&
    Boolean(resolvedCorrect) &&
    normalizeCompareText(resolvedStudent) === normalizeCompareText(resolvedCorrect)

  const penalty = !isCorrect && attempted && negEnabled ? Math.abs(negAmount) : 0

  return {
    format,
    attempted,
    isCorrect,
    isPartiallyCorrect: false,
    correctCount: isCorrect ? 1 : 0,
    totalExpected: 1,
    earnedMarks: isCorrect ? maxMarks : penalty > 0 ? -penalty : 0,
    negativeApplied: penalty,
    maxMarks,
    resolvedCorrectOptions: resolvedCorrect ? [resolvedCorrect] : [],
    resolvedStudentOptions: attempted ? [resolvedStudent] : [],
  }
}

export function formatOptionDisplay(
  answer: string | string[] | undefined,
  options?: string[]
): string {
  if (!answer || (Array.isArray(answer) && answer.length === 0)) return "Not answered"
  if (Array.isArray(answer)) {
    const labels = answer.map((a) => formatSingleAnswerDisplay(a, options))
    return labels.join(", ")
  }
  return formatSingleAnswerDisplay(answer, options)
}

function formatSingleAnswerDisplay(answer: string, options?: string[]): string {
  const s = String(answer || "").trim()
  if (!s) return "Not answered"
  if (!options || options.length === 0) return s

  const resolved = resolveSingleOptionAnswer(s, options)
  if (!resolved) return s
  const idx = options.findIndex((o) => normalizeCompareText(o) === normalizeCompareText(resolved))
  if (idx !== -1) {
    return `${String.fromCharCode(65 + idx)}. ${options[idx]}`
  }
  return resolved
}
