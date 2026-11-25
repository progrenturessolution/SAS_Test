import {
  STANDARD_ASSERTION_OPTIONS,
  cleanOptionList,
  countBlankMarkers,
  normalizeCompareText,
  normalizeDifficulty,
  normalizeFormatInput,
  normalizeTrueFalseAnswer,
  parseAssertionReasonParts,
  parseWordLimit,
  resolveMultiOptionAnswers,
  resolveSingleOptionAnswer,
  formatToDbType,
  type CanonicalDifficulty,
  type CanonicalFormat,
  type CanonicalQuestion,
} from "./canonicalSchema"
import { validateAndSanitizeSvg } from "./diagramValidator"
import { runDeterministicAcademicChecks, type AcademicValidationIssue } from "./mathAndScienceValidator"
import { buildAcademicVerificationPrompt } from "./promptBuilder"
import { callGeminiJson, type GeminiTransportFn } from "./geminiClient"

export interface ValidationContext {
  expectedFormat?: CanonicalFormat
  subject?: string
  defaultMarks?: number
  defaultNegativeMark?: number
  allowedChapters?: string[]
  strictSyllabusCheck?: boolean
  fibMode?: "blanks" | "mcq"
  requireExplanation?: boolean
}

export interface QuestionValidationResult {
  valid: boolean
  question?: CanonicalQuestion
  errors: string[]
  warnings: string[]
  academicIssues: AcademicValidationIssue[]
}

const REFERENCE_TO_MISSING_DIAGRAM_RE =
  /\b(?:given|following|adjacent|shown\s+below|below|accompanying)\s+(?:figure|diagram|graph|circuit|image|chart|plot|ray\s+diagram)\b|\b(?:in\s+the\s+diagram|from\s+the\s+figure|look\s+at\s+the\s+diagram|observe\s+the\s+diagram|refer\s+to\s+the\s+figure)\b/i

const PLACEHOLDER_ANSWER_RE = /^(?:answer|blank|tbd|todo|none|n\/a|xxx+|\?+)$/i

function isChapterWithinAllowed(candidate: string | undefined, allowedChapters: string[]): boolean {
  if (!candidate || allowedChapters.length === 0) return true
  const normCand = normalizeCompareText(candidate).replace(/[^a-z0-9 ]/g, "")
  if (!normCand) return true

  for (const allowed of allowedChapters) {
    const normAllowed = normalizeCompareText(allowed).replace(/[^a-z0-9 ]/g, "")
    if (!normAllowed) continue
    if (normAllowed === normCand || normAllowed.includes(normCand) || normCand.includes(normAllowed)) {
      return true
    }
    const candTokens = new Set(normCand.split(/\s+/).filter((t) => t.length > 2))
    const allowedTokens = new Set(normAllowed.split(/\s+/).filter((t) => t.length > 2))
    let overlap = 0
    for (const t of candTokens) {
      if (allowedTokens.has(t)) overlap++
    }
    if (candTokens.size > 0 && overlap / candTokens.size >= 0.5) return true
  }
  return false
}

function validateRubricAgainstMarks(rubric: string[], marks: number): string[] {
  const errors: string[] = []
  const pointValues: number[] = []

  for (const item of rubric) {
    const m = item.match(/(\d+(?:\.\d+)?)\s*(?:marks?|pts?|points?)\b/i)
    if (m) pointValues.push(Number(m[1]))
  }

  if (pointValues.length === rubric.length && pointValues.length > 0) {
    const sum = pointValues.reduce((a, b) => a + b, 0)
    if (Math.abs(sum - marks) > 0.25) {
      errors.push(`Descriptive rubric checkpoint marks sum (${sum}) does not match question marks (${marks})`)
    }
  }
  return errors
}

function isSafeImageReference(value: string): boolean {
  const trimmed = value.trim()
  if (trimmed.startsWith("<svg")) return true
  if (/^data:image\/(png|jpeg|jpg|webp|svg\+xml);base64,/i.test(trimmed)) return true
  if (/^(https?:\/\/|\/)[^\s"'<>]+$/i.test(trimmed)) return true
  return false
}

export function validateAndCanonicalizeQuestion(
  raw: any,
  context: ValidationContext = {},
  idSeed = "q_1"
): QuestionValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (!raw || typeof raw !== "object") {
    return {
      valid: false,
      errors: ["Question item is not a JSON object"],
      warnings,
      academicIssues: [],
    }
  }

  const format: CanonicalFormat = context.expectedFormat || normalizeFormatInput(raw.questionFormat || raw.type, raw)
  const dbType = formatToDbType(format)

  let questionText = String(raw.questionText || "").trim()
  const explanation = String(raw.explanation || "").trim()
  const rawDifficulty = String(raw.difficulty || "").trim().toLowerCase()
  const difficulty: CanonicalDifficulty =
    rawDifficulty === "easy" || rawDifficulty === "medium" || rawDifficulty === "hard"
      ? rawDifficulty
      : "medium"

  if (rawDifficulty && difficulty !== rawDifficulty && !["moderate", "normal"].includes(rawDifficulty)) {
    warnings.push(`Unrecognized difficulty "${raw.difficulty}", normalized to "${difficulty}"`)
  }

  const marks = Number(raw.marks) > 0 ? Number(raw.marks) : (context.defaultMarks ?? 4)
  const rawNeg = raw.negativeMark !== undefined ? Number(raw.negativeMark) : (context.defaultNegativeMark ?? 0)
  const negativeMark = Number.isFinite(rawNeg) && rawNeg >= 0 ? rawNeg : 0

  if (marks <= 0) errors.push("Marks must be positive")
  if (negativeMark < 0) errors.push("Negative mark cannot be negative")
  if (negativeMark > marks * 2) errors.push(`Negative mark (${negativeMark}) exceeds plausible range for marks (${marks})`)

  // Validate optional/required image SVG before checking question stem diagram references
  let sanitizedImage: string | undefined
  if (typeof raw.questionImage === "string" && raw.questionImage.trim()) {
    const imgRaw = raw.questionImage.trim()
    if (imgRaw.includes("<svg")) {
      const svgRes = validateAndSanitizeSvg(imgRaw)
      if (!svgRes.valid || !svgRes.sanitizedSvg) {
        errors.push(...svgRes.errors.map((e) => `Diagram SVG error: ${e}`))
      } else {
        sanitizedImage = svgRes.sanitizedSvg
        warnings.push(...svgRes.warnings)
      }
    } else if (isSafeImageReference(imgRaw)) {
      sanitizedImage = imgRaw
    } else {
      errors.push("questionImage contains an unsafe or unsupported image reference")
    }
  }

  // Format-specific validation (strict — NEVER silently defaults broken answers to option A)
  let cleanOptions: string[] | undefined
  let resolvedCorrectAnswer: string | string[] = ""
  let assertionText: string | undefined
  let reasonText: string | undefined
  let normalizedBlanks: CanonicalQuestion["blanks"]
  let modelAnswer: string | undefined
  let rubric: string[] | undefined
  let wordLimit: number | undefined

  if (format === "mcq_single") {
    const opts = cleanOptionList(raw.options)
    if (opts.length !== 4 || opts.some((o) => !o)) {
      errors.push("Single-correct MCQ must contain exactly 4 non-empty options")
    } else {
      const distinct = new Set(opts.map((o) => normalizeCompareText(o)))
      if (distinct.size !== 4) {
        errors.push("Single-correct MCQ contains duplicate options")
      } else {
        cleanOptions = opts
        const ans = resolveSingleOptionAnswer(raw.correctAnswer, opts)
        if (!ans) {
          errors.push("Single-correct MCQ correctAnswer does not match any of the 4 options")
        } else {
          resolvedCorrectAnswer = ans
        }
      }
    }
  } else if (format === "mcq_multi") {
    const opts = cleanOptionList(raw.options)
    if (opts.length !== 4 || opts.some((o) => !o)) {
      errors.push("Multiple-correct MCQ must contain exactly 4 non-empty options")
    } else {
      const distinct = new Set(opts.map((o) => normalizeCompareText(o)))
      if (distinct.size !== 4) {
        errors.push("Multiple-correct MCQ contains duplicate options")
      } else {
        cleanOptions = opts
        const ansList = resolveMultiOptionAnswers(raw.correctAnswer, opts)
        if (!ansList || ansList.length < 2) {
          errors.push("Multiple-correct MCQ must specify at least 2 distinct correct options matching options[]")
        } else {
          resolvedCorrectAnswer = ansList
        }
      }
    }
  } else if (format === "assertion") {
    const parsed = parseAssertionReasonParts(questionText)
    assertionText = String(raw.assertionText || parsed?.assertionText || "").trim()
    reasonText = String(raw.reasonText || parsed?.reasonText || "").trim()

    if (!assertionText || assertionText.length < 5) {
      errors.push("Assertion-Reason question is missing a valid Assertion (A) statement")
    }
    if (!reasonText || reasonText.length < 5) {
      errors.push("Assertion-Reason question is missing a valid Reason (R) statement")
    }
    if (
      assertionText &&
      reasonText &&
      normalizeCompareText(assertionText) === normalizeCompareText(reasonText)
    ) {
      errors.push("Assertion (A) and Reason (R) cannot be identical statements")
    }

    if (assertionText && reasonText) {
      questionText = `Assertion (A): ${assertionText}\nReason (R): ${reasonText}`
    }

    const rawOpts = cleanOptionList(raw.options)
    const opts = rawOpts.length === 4 ? rawOpts : [...STANDARD_ASSERTION_OPTIONS]
    if (opts.some((o) => !o) || new Set(opts.map((o) => normalizeCompareText(o))).size !== 4) {
      errors.push("Assertion-Reason question must have 4 distinct non-empty options")
    } else {
      cleanOptions = opts
      const ans = resolveSingleOptionAnswer(raw.correctAnswer, opts)
      if (!ans) {
        errors.push("Assertion-Reason correctAnswer does not match any of the 4 options")
      } else {
        resolvedCorrectAnswer = ans
      }
    }
  } else if (format === "true_false") {
    const rawOpts = cleanOptionList(raw.options)
    // Reject arbitrary non-T/F MCQ options attached accidentally to true_false
    if (
      rawOpts.length > 0 &&
      !(
        rawOpts.length === 2 &&
        rawOpts.some((o) => normalizeCompareText(o) === "true") &&
        rawOpts.some((o) => normalizeCompareText(o) === "false")
      )
    ) {
      errors.push("True/False question must not include arbitrary MCQ distractor options")
    }
    const tf = normalizeTrueFalseAnswer(raw.correctAnswer)
    if (!tf) {
      errors.push(`True/False correctAnswer must be "True" or "False" (received "${String(raw.correctAnswer || "")}")`)
    } else {
      resolvedCorrectAnswer = tf
    }
  } else if (format === "fib") {
    const blankCount = countBlankMarkers(questionText)
    if (blankCount === 0) {
      errors.push("Fill-in-the-blanks questionText must contain at least one ___ blank marker")
    }

    const rawOpts = cleanOptionList(raw.options)
    const fibMode = context.fibMode || (rawOpts.length === 4 && (!Array.isArray(raw.blanks) || raw.blanks.length === 0) ? "mcq" : "blanks")

    if (fibMode === "mcq") {
      if (rawOpts.length !== 4 || rawOpts.some((o) => !o) || new Set(rawOpts.map((o) => normalizeCompareText(o))).size !== 4) {
        errors.push("Objective Fill-in-the-blanks must contain 4 distinct non-empty options")
      } else {
        const ans = resolveSingleOptionAnswer(raw.correctAnswer, rawOpts)
        if (!ans) {
          errors.push("Objective Fill-in-the-blanks correctAnswer must match one of the 4 options")
        } else {
          cleanOptions = rawOpts
          resolvedCorrectAnswer = ans
          normalizedBlanks = [{ id: 1, label: "Blank 1", answer: ans, alsoAccept: [], caseInsensitive: true }]
        }
      }
    } else {
      if (rawOpts.length > 0) {
        errors.push("Text Fill-in-the-blanks must not include MCQ options[]")
      }
      const rawBlanks = Array.isArray(raw.blanks) ? raw.blanks : []
      let blanksList: NonNullable<CanonicalQuestion["blanks"]> = []
      if (rawBlanks.length > 0) {
        blanksList = rawBlanks.map((b: any, idx: number) => ({
          id: Number(b?.id) || idx + 1,
          label: b?.label ? String(b.label).trim() : `Blank ${idx + 1}`,
          answer: String(b?.answer || "").trim(),
          alsoAccept: Array.isArray(b?.alsoAccept)
            ? b.alsoAccept.map((a: unknown) => String(a || "").trim()).filter(Boolean)
            : [],
          caseInsensitive: b?.caseInsensitive !== false && raw.caseInsensitive !== false,
        }))
      } else if (typeof raw.correctAnswer === "string" && raw.correctAnswer.trim() && blankCount === 1) {
        blanksList = [
          {
            id: 1,
            label: "Blank 1",
            answer: raw.correctAnswer.trim(),
            alsoAccept: [],
            caseInsensitive: raw.caseInsensitive !== false,
          },
        ]
      }
      normalizedBlanks = blanksList

      if (blanksList.length === 0) {
        errors.push("Fill-in-the-blanks must define non-empty blanks[] answer key")
      } else if (blankCount > 0 && blanksList.length !== blankCount) {
        errors.push(`Blank marker count (${blankCount} ___) does not match blanks[] count (${blanksList.length})`)
      } else if (blanksList.some((b) => !b.answer || PLACEHOLDER_ANSWER_RE.test(b.answer))) {
        errors.push("Fill-in-the-blanks contains empty or placeholder blank answer")
      } else {
        resolvedCorrectAnswer = blanksList.map((b) => b.answer).join(", ")
      }
    }
  } else if (format === "descriptive") {
    const rawOpts = cleanOptionList(raw.options)
    if (rawOpts.length > 0) {
      errors.push("Descriptive question must NOT contain MCQ options[]")
    }
    modelAnswer = String(raw.modelAnswer || raw.correctAnswer || "").trim()
    const minAnsLen = marks <= 2 ? 15 : 35
    if (!modelAnswer || modelAnswer.length < minAnsLen || PLACEHOLDER_ANSWER_RE.test(modelAnswer)) {
      errors.push(`Descriptive question requires a meaningful modelAnswer (min ${minAnsLen} chars)`)
    }
    const rawRubric: string[] = Array.isArray(raw.rubric)
      ? raw.rubric.map((r: unknown) => String(r || "").trim()).filter(Boolean)
      : []
    if (rawRubric.length === 0) {
      errors.push("Descriptive question must include a non-empty marking rubric[]")
    } else {
      rubric = rawRubric
      errors.push(...validateRubricAgainstMarks(rawRubric, marks))
    }
    wordLimit = parseWordLimit(raw.wordLimit) || (marks <= 2 ? 40 : marks <= 5 ? 120 : 220)
    resolvedCorrectAnswer = modelAnswer
  } else if (format === "diagram") {
    if (!sanitizedImage) {
      errors.push("Diagram-based question is missing a valid SVG diagram in questionImage")
    }
    const opts = cleanOptionList(raw.options)
    if (opts.length !== 4 || opts.some((o) => !o)) {
      errors.push("Diagram-based MCQ must contain exactly 4 non-empty options")
    } else {
      const distinct = new Set(opts.map((o) => normalizeCompareText(o)))
      if (distinct.size !== 4) {
        errors.push("Diagram-based MCQ contains duplicate options")
      } else {
        cleanOptions = opts
        const ans = resolveSingleOptionAnswer(raw.correctAnswer, opts)
        if (!ans) {
          errors.push("Diagram-based MCQ correctAnswer does not match any option")
        } else {
          resolvedCorrectAnswer = ans
        }
      }
    }
  }

  if (questionText.length < 8) {
    errors.push("Question stem is too short or missing")
  }

  if (format !== "diagram" && !sanitizedImage && REFERENCE_TO_MISSING_DIAGRAM_RE.test(questionText)) {
    errors.push("Question references an external figure/diagram that was not provided")
  }

  const requireExp = context.requireExplanation !== false
  if (requireExp && format !== "descriptive" && explanation.length < 10) {
    errors.push("Explanation is missing or too brief to verify academic reasoning")
  }

  // Syllabus/chapter adherence check
  const chapterStr = raw.chapter ? String(raw.chapter).trim() : undefined
  if (context.strictSyllabusCheck && context.allowedChapters && context.allowedChapters.length > 0 && chapterStr) {
    if (!isChapterWithinAllowed(chapterStr, context.allowedChapters)) {
      errors.push(`Question chapter "${chapterStr}" lies outside authorized syllabus chapters`)
    }
  }

  const canonical: CanonicalQuestion = {
    id: String(raw.id || idSeed),
    type: dbType,
    questionFormat: format,
    questionText,
    subject: String(raw.subject || context.subject || "").trim() || undefined,
    chapter: chapterStr,
    topic: raw.topic ? String(raw.topic).trim() : undefined,
    classLevel: raw.classLevel ? String(raw.classLevel).trim() : undefined,
    difficulty,
    marks,
    negativeMark,
    options: cleanOptions,
    correctAnswer: resolvedCorrectAnswer,
    assertionText,
    reasonText,
    blanks: normalizedBlanks,
    caseInsensitive: format === "fib" ? raw.caseInsensitive !== false : undefined,
    modelAnswer,
    rubric,
    wordLimit,
    questionImage: sanitizedImage,
    explanation: explanation || (format === "descriptive" && rubric ? rubric.join(" | ") : ""),
    learningObjective: raw.learningObjective ? String(raw.learningObjective).trim() : undefined,
    pyqReference: raw.pyqReference ? String(raw.pyqReference).trim() : undefined,
  }

  const academicIssues = runDeterministicAcademicChecks(canonical)
  for (const issue of academicIssues) {
    if (issue.severity === "error") errors.push(issue.message)
    else warnings.push(issue.message)
  }

  return {
    valid: errors.length === 0,
    question: errors.length === 0 ? canonical : undefined,
    errors,
    warnings,
    academicIssues,
  }
}

export interface AcademicVerificationReport {
  verifiedQuestions: CanonicalQuestion[]
  rejectedByVerifier: Array<{ questionId: string; issues: string[] }>
  verifierRan: boolean
}

export async function verifyQuestionsAcademically(params: {
  subject: string
  questions: CanonicalQuestion[]
  preferredModel?: string
  transportOverride?: GeminiTransportFn
}): Promise<AcademicVerificationReport> {
  const { subject, questions, preferredModel, transportOverride } = params
  if (questions.length === 0) {
    return { verifiedQuestions: [], rejectedByVerifier: [], verifierRan: false }
  }

  const auditPayload = questions.map((q, index) => ({
    index,
    questionFormat: q.questionFormat,
    questionText: q.questionText,
    options: q.options,
    correctAnswer: q.correctAnswer,
    blanks: q.blanks?.map((b) => ({ answer: b.answer })),
    modelAnswer: q.modelAnswer,
    explanation: q.explanation,
  }))

  const prompt = buildAcademicVerificationPrompt(subject, auditPayload)

  const { data } = await callGeminiJson<
    Array<{
      index: number
      isAcademicallyValid?: boolean
      isUnambiguous?: boolean
      issues?: string[]
    }>
  >(
    {
      systemInstruction: prompt.systemInstruction,
      userPrompt: prompt.userPrompt,
      temperature: 0.1,
      maxOutputTokens: 8192,
      preferredModel,
    },
    transportOverride
  )

  const verdictMap = new Map<number, { valid: boolean; issues: string[] }>()
  if (Array.isArray(data)) {
    for (const v of data) {
      if (typeof v?.index === "number") {
        const ok = v.isAcademicallyValid !== false && v.isUnambiguous !== false
        verdictMap.set(v.index, {
          valid: ok,
          issues: Array.isArray(v.issues) ? v.issues.map(String) : [],
        })
      }
    }
  }

  const verifiedQuestions: CanonicalQuestion[] = []
  const rejectedByVerifier: Array<{ questionId: string; issues: string[] }> = []

  questions.forEach((q, idx) => {
    const verdict = verdictMap.get(idx)
    if (verdict && !verdict.valid) {
      rejectedByVerifier.push({
        questionId: q.id,
        issues: verdict.issues.length > 0 ? verdict.issues : ["Independent academic verifier flagged inaccuracy/ambiguity"],
      })
    } else {
      verifiedQuestions.push(q)
    }
  })

  return {
    verifiedQuestions,
    rejectedByVerifier,
    verifierRan: true,
  }
}
