import type { CanonicalQuestion } from "./canonicalSchema"

export interface AcademicValidationIssue {
  severity: "error" | "warning"
  code: string
  message: string
}

const CORRUPT_CONTROL_CHAR_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/

/**
 * Checks LaTeX, chemical notation (\ce), and control-character cleanliness.
 */
export function checkMathNotation(text: string): AcademicValidationIssue[] {
  const issues: AcademicValidationIssue[] = []
  if (!text) return issues

  if (CORRUPT_CONTROL_CHAR_RE.test(text)) {
    issues.push({
      severity: "error",
      code: "LATEX_CONTROL_CHAR_CORRUPTION",
      message: "Text contains escaped ASCII control characters (likely corrupted LaTeX backslash)",
    })
  }

  // Strip $$...$$ before counting inline $...$
  const withoutDisplay = text.replace(/\$\$[\s\S]*?\$\$/g, " ")
  const displayDelims = (text.match(/\$\$/g) || []).length
  if (displayDelims % 2 !== 0) {
    issues.push({
      severity: "error",
      code: "UNBALANCED_DISPLAY_MATH",
      message: "Unbalanced display math $$ delimiter",
    })
  }

  // Count non-escaped $ signs outside currency values ($ followed by digit can be currency like $50 unless paired)
  const unescapedDollars = withoutDisplay.replace(/\\\$/g, "").match(/\$/g) || []
  if (unescapedDollars.length % 2 !== 0) {
    // Allow literal single currency usage like "costs $100" when there is no backslash command nearby
    const hasTeXCommand = /\\[a-zA-Z]+/.test(withoutDisplay)
    const looksLikeCurrency = /\$\d+(?:\.\d+)?/.test(withoutDisplay) && unescapedDollars.length === 1 && !hasTeXCommand
    if (!looksLikeCurrency) {
      issues.push({
        severity: "error",
        code: "UNBALANCED_INLINE_MATH",
        message: "Unbalanced inline math $ delimiter",
      })
    }
  }

  // Check brace balance inside $...$ math expressions
  const mathBlocks = [
    ...(text.match(/\$\$[\s\S]*?\$\$/g) || []),
    ...(withoutDisplay.match(/\$[^$\n]+\$/g) || []),
  ]
  for (const block of mathBlocks) {
    let depth = 0
    for (let i = 0; i < block.length; i++) {
      if (block[i] === "\\") {
        i++
        continue
      }
      if (block[i] === "{") depth++
      else if (block[i] === "}") depth--
      if (depth < 0) break
    }
    if (depth !== 0) {
      issues.push({
        severity: "error",
        code: "UNBALANCED_MATH_BRACES",
        message: `Unbalanced curly braces inside math expression: ${block.slice(0, 60)}`,
      })
      break
    }

    const leftCount = (block.match(/\\left\b/g) || []).length
    const rightCount = (block.match(/\\right\b/g) || []).length
    if (leftCount !== rightCount) {
      issues.push({
        severity: "warning",
        code: "UNBALANCED_LEFT_RIGHT",
        message: "Mismatched \\left and \\right delimiters in LaTeX",
      })
    }
  }

  return issues
}

/**
 * Checks whether the explanation explicitly declares a different option letter than the recorded correctAnswer.
 */
export function checkExplanationOptionConsistency(q: CanonicalQuestion): AcademicValidationIssue[] {
  const issues: AcademicValidationIssue[] = []
  if (
    !q.explanation ||
    !Array.isArray(q.options) ||
    q.options.length !== 4 ||
    (q.questionFormat !== "mcq_single" && q.questionFormat !== "diagram" && q.questionFormat !== "assertion")
  ) {
    return issues
  }

  const answerStr = typeof q.correctAnswer === "string" ? q.correctAnswer : ""
  const correctIdx = q.options.findIndex((o) => o.trim() === answerStr.trim())
  if (correctIdx === -1) return issues

  const expectedLetter = String.fromCharCode(65 + correctIdx)

  // Look for explicit conclusion phrases like "Hence option (B) is correct" or "Correct answer is Option C"
  const explicitPatterns = [
    /\b(?:hence|therefore|thus|so),?\s*(?:the\s+)?(?:correct\s+(?:answer|option)\s+(?:is|:)\s*)?(?:option\s*)?\(?([A-D])\)?\s+is\s+(?:the\s+)?correct\b/gi,
    /\bcorrect\s+(?:answer|option)\s*(?:is|:)\s*(?:option\s*)?\(?([A-D])\)?\b/gi,
    /\boption\s*\(?([A-D])\)?\s+is\s+(?:the\s+)?(?:only\s+)?correct\s+(?:answer|option|statement)?\b/gi,
  ]

  const foundLetters = new Set<string>()
  for (const re of explicitPatterns) {
    let m: RegExpExecArray | null
    while ((m = re.exec(q.explanation)) !== null) {
      foundLetters.add(m[1].toUpperCase())
    }
  }

  if (foundLetters.size === 1) {
    const [declaredLetter] = Array.from(foundLetters)
    if (declaredLetter !== expectedLetter) {
      issues.push({
        severity: "error",
        code: "EXPLANATION_ANSWER_MISMATCH",
        message: `Explanation concludes Option (${declaredLetter}) is correct, but correctAnswer is mapped to Option (${expectedLetter})`,
      })
    }
  }

  // Additional Assertion & Reason logical alignment check
  if (q.questionFormat === "assertion") {
    const exp = q.explanation.toLowerCase()
    const correctLower = answerStr.toLowerCase()

    const claimsBothTrue =
      /\bboth\s*(?:\(?a\)?|assertion)\s*and\s*(?:\(?r\)?|reason)\s*are\s*true/i.test(correctLower)
    const claimsAFalseRTrue =
      /(?:\(?a\)?|assertion)\s*is\s*false\b/i.test(correctLower) &&
      /(?:\(?r\)?|reason)\s*is\s*true\b/i.test(correctLower)
    const claimsATrueRFalse =
      /(?:\(?a\)?|assertion)\s*is\s*true\b/i.test(correctLower) &&
      /(?:\(?r\)?|reason)\s*is\s*false\b/i.test(correctLower)

    if (claimsBothTrue && /\b(?:assertion\s*(?:\(a\))?\s*is\s*false|reason\s*(?:\(r\))?\s*is\s*false)\b/i.test(exp)) {
      issues.push({
        severity: "error",
        code: "ASSERTION_LOGIC_CONTRADICTION",
        message: "Explanation states Assertion or Reason is false while correctAnswer selects both true",
      })
    }
    if (claimsAFalseRTrue && /\bassertion\s*(?:\(a\))?\s*is\s*true\b/i.test(exp)) {
      issues.push({
        severity: "error",
        code: "ASSERTION_LOGIC_CONTRADICTION",
        message: "Explanation states Assertion is true while correctAnswer marks Assertion false",
      })
    }
    if (claimsATrueRFalse && /\breason\s*(?:\(r\))?\s*is\s*true\b/i.test(exp)) {
      issues.push({
        severity: "error",
        code: "ASSERTION_LOGIC_CONTRADICTION",
        message: "Explanation states Reason is true while correctAnswer marks Reason false",
      })
    }
  }

  return issues
}

/**
 * Checks whether final computed numeric value in explanation directly contradicts numeric option chosen as correctAnswer.
 */
export function checkNumericFinalAnswerConsistency(q: CanonicalQuestion): AcademicValidationIssue[] {
  const issues: AcademicValidationIssue[] = []
  if (
    !q.explanation ||
    (q.questionFormat !== "mcq_single" && q.questionFormat !== "diagram" && q.questionFormat !== "fib")
  ) {
    return issues
  }

  const answerText =
    typeof q.correctAnswer === "string"
      ? q.correctAnswer
      : q.blanks?.[0]?.answer || ""

  // Extract pure scalar + optional unit like "12.5 m/s", "-4", "25 J" from answer
  const cleanAns = answerText.replace(/\$|,/g, "").trim()
  const ansNumMatch = cleanAns.match(/^([+-]?\d+(?:\.\d+)?)\s*(?:[a-zA-Z°/%Ωμ]+)?$/)
  if (!ansNumMatch) return issues

  const ansVal = Number(ansNumMatch[1])
  if (!Number.isFinite(ansVal)) return issues

  // If explanation explicitly ends with a clear final result "= <num> <unit>" inside the last sentence
  const sentences = q.explanation.split(/(?<=[.!?])\s+|\n+/).filter((s) => s.trim().length > 0)
  const tail = sentences.slice(-2).join(" ")
  const finalEqMatches = Array.from(
    tail.replace(/\$/g, "").matchAll(/(?:=|≈|is|gives|equals)\s*([+-]?\d+(?:\.\d+)?)\s*(?:m\/s\^?2|m\/s|kg|N|J|W|V|A|Ω|Hz|mol|g|cm|m|km|s|K|°C|%|Pa|atm)?(?=\s|$|\.|,)/gi)
  )

  if (finalEqMatches.length > 0 && Array.isArray(q.options) && q.options.length === 4) {
    // Only flag if the FINAL printed number matches one of the OTHER 3 options strictly and differs significantly from correctAnswer!
    const lastComputed = Number(finalEqMatches[finalEqMatches.length - 1][1])
    if (Number.isFinite(lastComputed) && Math.abs(lastComputed - ansVal) > 1e-4 * Math.max(1, Math.abs(ansVal))) {
      const optionNums = q.options.map((opt) => {
        const m = opt.replace(/\$|,/g, "").trim().match(/^([+-]?\d+(?:\.\d+)?)/)
        return m ? Number(m[1]) : NaN
      })
      const matchesAnotherOption = optionNums.some(
        (num, idx) =>
          Number.isFinite(num) &&
          q.options![idx].trim() !== answerText.trim() &&
          Math.abs(num - lastComputed) <= 1e-4 * Math.max(1, Math.abs(lastComputed))
      )
      if (matchesAnotherOption) {
        issues.push({
          severity: "error",
          code: "EXPLANATION_NUMERIC_KEY_CONFLICT",
          message: `Explanation finishes with value ${lastComputed}, which matches a distractor instead of correctAnswer (${ansVal})`,
        })
      }
    }
  }

  return issues
}

const AMBIGUOUS_META_PATTERNS: RegExp[] = [
  /\bboth\s*\(?[a-d]\)?\s*and\s*\(?[a-d]\)?\s*are\s*correct\b/i,
  /\ball\s+options?\s+are\s+correct\b/i,
  /\b(?:none|two)\s+of\s+the\s+above\s+options?\s+can\s+be\s+determined\b/i,
  /\bas\s+(?:given|shown)\s+in\s+(?:my|above)\s+prompt\b/i,
  /\bTBD\b|\bTODO\b|\bplaceholder\b/i,
  /\[insert\s+[^\]]+\]/i,
]

function checkChemistryEquationSyntax(text: string): AcademicValidationIssue[] {
  const issues: AcademicValidationIssue[] = []
  const ceMatches = text.match(/\\ce\{([^}]*)\}/g) || []
  for (const ce of ceMatches) {
    if (/\\ce\{\s*\}/.test(ce)) {
      issues.push({
        severity: "error",
        code: "EMPTY_CHEMICAL_FORMULA",
        message: "Found empty \\ce{} chemical formula block",
      })
    }
  }
  return issues
}

function checkPyqClaims(q: CanonicalQuestion): AcademicValidationIssue[] {
  const issues: AcademicValidationIssue[] = []
  const combined = `${q.pyqReference || ""} ${q.questionText}`
  // Block fabricated claims like "[Official JEE Main 2024]" unless clearly labelled PYQ-inspired/Practice
  if (
    /\bofficial\s+(?:neet|jee|mht-cet|cbse|board)\s*(?:19|20)\d{2}\b/i.test(combined) &&
    !/inspired|pattern|model|based on/i.test(combined)
  ) {
    issues.push({
      severity: "error",
      code: "UNVERIFIED_OFFICIAL_PYQ_CLAIM",
      message: "Question claims to be an official historical PYQ without verification; must be PYQ-inspired only",
    })
  }
  return issues
}

/**
 * Runs deterministic subject-aware, mathematical, chemical, notation, and explanation consistency checks.
 */
export function runDeterministicAcademicChecks(q: CanonicalQuestion): AcademicValidationIssue[] {
  const issues: AcademicValidationIssue[] = []

  // 1. LaTeX & control character checks across all user-facing text fields
  const fieldsToInspect = [
    q.questionText,
    q.explanation,
    q.modelAnswer || "",
    ...(q.options || []),
    ...(q.blanks?.map((b) => b.answer) || []),
  ]
  for (const field of fieldsToInspect) {
    issues.push(...checkMathNotation(field))
    issues.push(...checkChemistryEquationSyntax(field))
  }

  // 2. Ambiguous / placeholder phrasing checks
  const fullStemAndOpts = `${q.questionText} ${(q.options || []).join(" ")} ${q.explanation}`
  for (const re of AMBIGUOUS_META_PATTERNS) {
    if (re.test(fullStemAndOpts)) {
      if (q.questionFormat === "mcq_single" && /both\s*\(?[a-d]\)?\s*and\s*\(?[a-d]\)?/i.test(fullStemAndOpts)) {
        issues.push({
          severity: "warning",
          code: "POSSIBLE_MULTI_ANSWER_AMBIGUITY",
          message: "Single-correct question wording suggests multiple options might be correct",
        })
      } else {
        issues.push({
          severity: "error",
          code: "PLACEHOLDER_OR_META_TEXT",
          message: "Question contains placeholder or invalid meta-reference text",
        })
      }
    }
  }

  // 3. Explanation vs answer alignment
  issues.push(...checkExplanationOptionConsistency(q))
  issues.push(...checkNumericFinalAnswerConsistency(q))

  // 4. PYQ authenticity check
  issues.push(...checkPyqClaims(q))

  return issues
}
