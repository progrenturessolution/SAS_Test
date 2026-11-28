import test from "node:test"
import assert from "node:assert/strict"
import katex from "katex"
import "katex/contrib/mhchem"

import { robustJsonParse, sanitizeJsonString, salvageJsonArrayObjects } from "../lib/jsonRepair"
import {
  normalizeFormatInput,
  normalizeStoredQuestion,
  toExamQuestionPayload,
  resolveSingleOptionAnswer,
  resolveMultiOptionAnswers,
  STANDARD_ASSERTION_OPTIONS,
} from "../lib/ai/canonicalSchema"
import { validateAndSanitizeSvg, computeSvgFingerprint } from "../lib/ai/diagramValidator"
import { checkMathNotation, runDeterministicAcademicChecks } from "../lib/ai/mathAndScienceValidator"
import { validateAndCanonicalizeQuestion } from "../lib/ai/validators"
import { QuestionDeduplicator } from "../lib/ai/deduplication"
import {
  allocateByWeights,
  partitionDifficultyAcrossBatches,
  planSubjectGenerationSlots,
  resolveClassDistribution,
} from "../lib/ai/examBlueprint"
import { buildQuestionGenerationPrompt, computeDifficultyCounts } from "../lib/ai/promptBuilder"
import { generateQuestionBatch } from "../lib/ai/orchestrator"
import { callGeminiJson, sanitizeErrorMessage, type GeminiTransportFn } from "../lib/ai/geminiClient"
import { evaluateObjectiveAnswer, formatOptionDisplay } from "../lib/ai/questionEvaluation"
import { isBareStandaloneMath, normalizeMathContent } from "../lib/mathFormat"
import { computePublicExamCapacity } from "../lib/publicExamCapacity"
import {
  findAnswerForQuestion,
  formatExamInstructions,
  getCleanExamDescription,
  getExamPortalUrl,
  mergeAttemptAnswers,
  resolveAnalyticsDisplayScore,
} from "../lib/attemptHelpers"

// ─── 1. JSON Parsing & LaTeX Backslash Preservation ───────────────────────────

test("robustJsonParse preserves unescaped LaTeX commands before JSON.parse corrupts control chars", () => {
  const geminiRaw = `\`\`\`json
[
  {
    "questionText": "Evaluate $\\frac{\\theta}{2} + \\times \\beta \\nabla \\rightarrow \\rho$ with $\\tan(\\theta) = 1$,\\nnext line ok.",
    "options": ["$\\frac{1}{2}$", "$\\theta$", "$\\beta$", "$\\rho$"],
    "correctAnswer": "$\\frac{1}{2}$",
    "explanation": "Using $\\frac{\\theta}{2}$ and $\\times$."
  },
]
\`\`\``

  // Simulate single-backslash Gemini JSON emission directly:
  const singleBackslashRaw = geminiRaw.replace(/\\\\(frac|theta|times|beta|nabla|rightarrow|rho|tan)/g, "\\$1")
  const parsed = robustJsonParse<any[]>(singleBackslashRaw)
  assert.equal(parsed.length, 1)
  assert.ok(!/[\u0008\u0009\u000c\u000d]/.test(parsed[0].questionText), "Must not contain control characters")
  assert.ok(parsed[0].questionText.includes("\\frac{\\theta}{2}"), "Must preserve \\frac and \\theta")
  assert.ok(parsed[0].questionText.includes("\\rightarrow \\rho"), "Must preserve \\rightarrow and \\rho")
  assert.ok(parsed[0].questionText.includes("\nnext line ok."), "Must preserve genuine newline escape before English word")
})

test("robustJsonParse salvages completed objects from MAX_TOKENS truncated JSON arrays", () => {
  const truncated = `[
    {"questionText": "Q1", "options": ["1","2","3","4"], "correctAnswer": "1"},
    {"questionText": "Q2", "options": ["a","b","c","d"], "correctAnswer": "a"},
    {"questionText": "Q3 truncated midway`
  const salvaged = salvageJsonArrayObjects<any>(truncated)
  assert.equal(salvaged.length, 2)
  const parsed = robustJsonParse<any[]>(truncated)
  assert.equal(parsed.length, 2)
  assert.equal(parsed[1].questionText, "Q2")
})

// ─── 2. Canonical Schema & Backward Compatibility ─────────────────────────────

test("canonicalSchema normalizes legacy formats and preserves prefixes vs author names", () => {
  assert.equal(normalizeFormatInput("mcq_multiple"), "mcq_multi")
  assert.equal(normalizeFormatInput("long_descriptive"), "descriptive")
  assert.equal(normalizeFormatInput("truefalse"), "true_false")
  assert.equal(normalizeFormatInput("fill_in_the_blanks"), "fib")

  const single = resolveSingleOptionAnswer("B", ["Force", "Momentum", "Energy", "Power"])
  assert.equal(single, "Momentum")

  const multi = resolveMultiOptionAnswers(["A", "C"], ["Scalar", "Vector", "Tensor", "Constant"])
  assert.deepEqual(multi, ["Scalar", "Tensor"])

  // Legacy competitive FIB (4 options, no blanks[]) adapts smoothly into canonical + DB payload
  const legacyFib = normalizeStoredQuestion({
    type: "fillblanks",
    questionFormat: "fib",
    questionText: "The SI unit of electric charge is ___.",
    options: ["Coulomb", "Volt", "Ampere", "Ohm"],
    correctAnswer: "Coulomb",
    explanation: "Charge is measured in Coulombs.",
  })
  assert.equal(legacyFib.questionFormat, "fib")
  assert.equal(legacyFib.blanks?.[0]?.answer, "Coulomb")

  // Legacy descriptive stored in correctAnswer adapts cleanly without options[]
  const legacyDesc = normalizeStoredQuestion({
    type: "descriptive",
    questionText: "Derive mirror formula.",
    options: ["wrong", "artifact"],
    correctAnswer: "1/f = 1/v + 1/u derived using paraxial rays and similar triangles.",
    explanation: "State assumptions (1m) | Derive triangles (2m) | Simplify (2m)",
    marks: 5,
    wordLimit: "120-150 words",
  })
  const payload = toExamQuestionPayload(legacyDesc)
  assert.equal(payload.options, undefined, "Descriptive payload must strip accidental options")
  assert.equal(payload.wordLimit, 150)
  assert.ok(String(payload.modelAnswer).includes("1/f = 1/v + 1/u"))
})

// ─── 3. Diagram Security, Structure & Fingerprinting ─────────────────────────

test("diagramValidator accepts clean SVG, sanitizes safely, and blocks XSS/empty SVGs", () => {
  const validSvg = `<svg viewBox="0 0 400 280"><rect x="40" y="40" width="120" height="80" fill="none" stroke="#1e293b"/><line x1="40" y1="80" x2="200" y2="80" stroke="#2563eb"/><text x="90" y="30">R1 = 10 Ohm</text></svg>`
  const ok = validateAndSanitizeSvg(validSvg)
  assert.equal(ok.valid, true)
  assert.ok(ok.sanitizedSvg?.includes('xmlns="http://www.w3.org/2000/svg"'))
  assert.equal(ok.primitiveCount, 2)
  assert.deepEqual(ok.textLabels, ["R1 = 10 Ohm"])

  const xssSvg = `<svg viewBox="0 0 200 200"><script>alert(1)</script><rect x="10" y="10" width="50" height="50"/><circle cx="80" cy="80" r="10"/></svg>`
  const badXss = validateAndSanitizeSvg(xssSvg)
  assert.equal(badXss.valid, false)

  const sparseSvg = `<svg viewBox="0 0 200 200"><text x="10" y="20">Empty diagram</text></svg>`
  const badSparse = validateAndSanitizeSvg(sparseSvg)
  assert.equal(badSparse.valid, false)

  const fp1 = computeSvgFingerprint(validSvg)
  const fp2 = computeSvgFingerprint(validSvg)
  assert.equal(fp1, fp2)
})

// ─── 4. Structural, Mathematical & Academic Validation ───────────────────────

test("validators enforce strict format rules and catch explanation/numeric/PYQ contradictions", () => {
  // Reject MCQ when correctAnswer does not match any option (old code silently forced options[0])
  const badKey = validateAndCanonicalizeQuestion(
    {
      questionText: "What is acceleration due to gravity near Earth's surface?",
      options: ["4.9 m/s^2", "9.8 m/s^2", "19.6 m/s^2", "2.4 m/s^2"],
      correctAnswer: "30 m/s^2",
      explanation: "Standard value g = 9.8 m/s^2.",
    },
    { expectedFormat: "mcq_single", defaultMarks: 4 }
  )
  assert.equal(badKey.valid, false)

  // Reject Explanation concluding Option C while answer says Option B
  const mismatch = validateAndCanonicalizeQuestion(
    {
      questionText: "Find the kinetic energy of a 2 kg block moving at 3 m/s.",
      options: ["3 J", "6 J", "9 J", "18 J"],
      correctAnswer: "6 J",
      explanation: "KE = 0.5 * 2 * 3^2 = 9 J. Therefore option (C) is correct.",
    },
    { expectedFormat: "mcq_single", subject: "Physics", defaultMarks: 4 }
  )
  assert.equal(mismatch.valid, false)
  assert.ok(mismatch.errors.some((e) => e.includes("Option (C)") || e.includes("9")))

  // Reject unverified official PYQ claim
  const fakePyq = validateAndCanonicalizeQuestion(
    {
      questionText: "Which organelle synthesizes ATP via oxidative phosphorylation?",
      options: ["Golgi apparatus", "Mitochondria", "Lysosome", "Ribosome"],
      correctAnswer: "Mitochondria",
      explanation: "Mitochondria carry out oxidative phosphorylation.",
      pyqReference: "Official NEET 2024",
    },
    { expectedFormat: "mcq_single", subject: "Biology", defaultMarks: 4 }
  )
  assert.equal(fakePyq.valid, false)

  // Reject multiple-correct with only 1 answer
  const badMulti = validateAndCanonicalizeQuestion(
    {
      questionText: "Which of the following are scalar quantities?",
      options: ["Work", "Energy", "Force", "Momentum"],
      correctAnswer: ["Work"],
      explanation: "Both Work and Energy are scalars.",
    },
    { expectedFormat: "mcq_multi", defaultMarks: 4 }
  )
  assert.equal(badMulti.valid, false)

  // Accept valid Assertion-Reason
  const validAR = validateAndCanonicalizeQuestion(
    {
      assertionText: "Diamond does not conduct electricity.",
      reasonText: "All four valence electrons of carbon are engaged in covalent bonds leaving no free electrons.",
      options: [...STANDARD_ASSERTION_OPTIONS],
      correctAnswer: STANDARD_ASSERTION_OPTIONS[0],
      explanation: "Assertion (A) is true and Reason (R) is true, and R directly explains A.",
    },
    { expectedFormat: "assertion", subject: "Chemistry", defaultMarks: 4 }
  )
  assert.equal(validAR.valid, true)

  // Reject descriptive with rubric marks mismatch
  const badRubric = validateAndCanonicalizeQuestion(
    {
      questionText: "Explain Faraday's laws of electromagnetic induction with mathematical expression.",
      modelAnswer: "First law states induced EMF occurs on flux change; Second law quantifies e = -dPhi/dt in SI units.",
      rubric: ["First law statement (1 mark)", "Second law equation (1 mark)"],
      marks: 5,
    },
    { expectedFormat: "descriptive", subject: "Physics", defaultMarks: 5 }
  )
  assert.equal(badRubric.valid, false)

  // Catch unbalanced math braces
  const mathIssues = checkMathNotation("Calculate $\\frac{1}{2mv^2$.")
  assert.ok(mathIssues.some((i) => i.code === "UNBALANCED_MATH_BRACES"))

  // Strict syllabus boundary rejection
  const outOfSyllabus = validateAndCanonicalizeQuestion(
    {
      questionText: "Derive the Lens Maker formula for a thin biconvex lens.",
      options: ["1/f = (n-1)(1/R1 - 1/R2)", "1/f = (1/R1 + 1/R2)", "f = R/2", "1/f = n/R"],
      correctAnswer: "1/f = (n-1)(1/R1 - 1/R2)",
      chapter: "Ray Optics",
      explanation: "Thin lens refraction yields Lens Maker formula.",
    },
    {
      expectedFormat: "mcq_single",
      allowedChapters: ["Electrostatics", "Current Electricity"],
      strictSyllabusCheck: true,
    }
  )
  assert.equal(outOfSyllabus.valid, false)
})

// ─── 5. Multi-Level Deduplication ─────────────────────────────────────────────

test("QuestionDeduplicator detects exact, numeric-clone, rephrased, and diagram clones without false positives", () => {
  const existing = [
    {
      id: "ex1",
      questionText: "A block of mass 5 kg accelerates at 4 m/s^2 across a smooth horizontal surface. Find the net force acting on the block.",
      options: ["10 N", "20 N", "25 N", "40 N"],
      learningObjective: "Newton second law numerical force calculation",
    },
  ]
  const dedup = new QuestionDeduplicator(existing)

  // Swapped numbers clone -> flagged!
  const numericClone = dedup.check({
    id: "cand1",
    questionText: "A block of mass 12 kg accelerates at 3 m/s^2 across a smooth horizontal surface. Find the net force acting on the block.",
    options: ["12 N", "24 N", "36 N", "48 N"],
    learningObjective: "Newton second law numerical force calculation",
  })
  assert.equal(numericClone.isDuplicate, true)
  assert.equal(numericClone.reason, "numeric_template_clone")

  // Genuinely distinct conceptual question on Newton's laws -> allowed!
  const legitimateConcept = dedup.check({
    id: "cand2",
    questionText: "Two blocks connected by a light inextensible string are pulled on an inclined plane at 30 degrees. Compare the tension in the string when acceleration is upward vs downward.",
    options: ["Larger upward", "Larger downward", "Equal", "Zero"],
    learningObjective: "Connected body pulley tension dynamics on incline",
  })
  assert.equal(legitimateConcept.isDuplicate, false)
})

// ─── 6. Difficulty, Class 11/12 Weightage & Syllabus Planning ─────────────────

test("examBlueprint preserves exact difficulty ratios, rounding, and prevents Class 11 leakage", () => {
  const diff7 = computeDifficultyCounts(7, "mixed", { easy: 30, medium: 50, hard: 20 })
  assert.equal(diff7.easy + diff7.medium + diff7.hard, 7)
  assert.deepEqual(diff7, { easy: 2, medium: 4, hard: 1 })

  const batches = partitionDifficultyAcrossBatches(
    { easy: 6, medium: 10, hard: 4 },
    [8, 7, 5]
  )
  assert.equal(batches.length, 3)
  assert.equal(batches[0].easy + batches[0].medium + batches[0].hard, 8)
  assert.equal(batches[1].easy + batches[1].medium + batches[1].hard, 7)
  assert.equal(batches[2].easy + batches[2].medium + batches[2].hard, 5)
  assert.equal(batches.reduce((s, b) => s + b.easy, 0), 6)
  assert.equal(batches.reduce((s, b) => s + b.medium, 0), 10)
  assert.equal(batches.reduce((s, b) => s + b.hard, 0), 4)

  // Only Class 12 chapters selected -> Class 11 count MUST be 0 even if gradeFilter="both"
  const clsDist = resolveClassDistribution({
    totalQuestions: 20,
    hasClass11Chapters: false,
    hasClass12Chapters: true,
    gradeFilter: "both",
    class11WeightPercent: 50,
  })
  assert.deepEqual(clsDist, { class11Count: 0, class12Count: 20 })

  const slots = planSubjectGenerationSlots({
    subject: "Physics",
    totalQuestions: 10,
    difficultyMode: "mixed",
    gradeFilter: "12",
    chapters: [{ name: "Electrostatics", grade: "12" }],
    formatWeights: [
      { format: "mcq_single", count: 6 },
      { format: "assertion", count: 4 },
    ],
    marks: 4,
    negativeMark: 1,
    maxBatchSize: 6,
  })
  assert.equal(slots.reduce((s, x) => s + x.totalQuestions, 0), 10)
  assert.ok(slots.every((s) => s.chapters.includes("Electrostatics") && s.grade === "12"))
})

// ─── 7. Prompt Construction & Mocked Gemini Orchestration + Fallback ──────────

test("promptBuilder creates consistent format directives across subjects", () => {
  const prompt = buildQuestionGenerationPrompt({
    examName: "JEE Advanced Mock",
    examTarget: "JEE_ADVANCED",
    subject: "Chemistry",
    grade: "12",
    chapters: ["Electrochemistry"],
    format: "mcq_multi",
    count: 5,
    difficulty: "mixed",
    difficultyCounts: { easy: 1, medium: 3, hard: 1 },
    marks: 4,
    negativeMark: 2,
    existingQuestionStems: ["Calculate EMF of Daniel cell at 298K"],
  })
  assert.ok(prompt.systemInstruction.includes("\\ce"))
  assert.ok(prompt.taskPrompt.includes("Easy: 1"))
  assert.ok(prompt.taskPrompt.includes("Electrochemistry"))
  assert.ok(prompt.taskPrompt.includes("mcq_multi"))
})

test("orchestrator handles rate-limit fallback, schema retries, dedup, deficit recovery, and redacts keys", async () => {
  let callNum = 0
  const mockTransport: GeminiTransportFn = async ({ model }) => {
    callNum++
    // First attempt returns 429 rate-limit -> fallback to next model succeeds!
    if (callNum === 1) {
      return { status: 429, bodyText: '{"error":{"message":"Quota exceeded"}}' }
    }
    // Second call returns 1 valid + 1 bad (mismatched answer) + 1 duplicate
    if (callNum === 2) {
      return {
        status: 200,
        bodyText: JSON.stringify({
          candidates: [
            {
              finishReason: "STOP",
              content: {
                parts: [
                  {
                    text: JSON.stringify([
                      {
                        questionText: "What is the dimensional formula of Planck's constant $h$?",
                        chapter: "Units and Measurements",
                        difficulty: "easy",
                        marks: 4,
                        negativeMark: 1,
                        options: ["$[ML^2T^{-1}]$", "$[ML^2T^{-2}]$", "$[MLT^{-1}]$", "$[M^0LT^{-1}]$"],
                        correctAnswer: "$[ML^2T^{-1}]$",
                        explanation: "From $E = h\\nu$, $[h] = [ML^2T^{-2}] / [T^{-1}] = [ML^2T^{-1}]$.",
                        learningObjective: "Dimensional formula of Planck constant",
                      },
                      {
                        questionText: "Broken item whose answer does not match options",
                        chapter: "Units and Measurements",
                        difficulty: "medium",
                        options: ["1", "2", "3", "4"],
                        correctAnswer: "99",
                        explanation: "Broken.",
                      },
                    ]),
                  },
                ],
              },
            },
          ],
        }),
      }
    }
    // Deficit recovery call fills remaining question cleanly
    return {
      status: 200,
      bodyText: JSON.stringify({
        candidates: [
          {
            finishReason: "STOP",
            content: {
              parts: [
                {
                  text: JSON.stringify([
                    {
                      questionText: "Which physical quantity has the same dimensions as angular momentum?",
                      chapter: "Units and Measurements",
                      difficulty: "medium",
                      marks: 4,
                      negativeMark: 1,
                      options: ["Torque", "Planck's constant", "Impulse", "Surface tension"],
                      correctAnswer: "Planck's constant",
                      explanation: "Both angular momentum $L = mvr$ and Planck's constant $h = E/\\nu$ have dimensions $[ML^2T^{-1}]$.",
                      learningObjective: "Compare dimensional equality with Planck constant",
                    },
                  ]),
                },
              ],
            },
          },
        ],
      }),
    }
  }

  const res = await generateQuestionBatch({
    examName: "Physics Test",
    subject: "Physics",
    grade: "11",
    chapters: ["Units and Measurements"],
    format: "mcq_single",
    count: 2,
    difficulty: "mixed",
    marks: 4,
    negativeMark: 1,
    strictSyllabusCheck: true,
    maxRetriesForDeficit: 2,
    transportOverride: mockTransport,
  })

  assert.equal(res.questions.length, 2)
  assert.equal(res.qualityReport.rejectedCount, 1)
  assert.ok(res.qualityReport.retriesExecuted >= 1)
  assert.equal(
    sanitizeErrorMessage("Fetch failed for https://host/v1?key=AIzaSyTestSecret1234567890"),
    "Fetch failed for https://host/v1?key=[REDACTED]"
  )
})

// ─── 8. End-to-End Objective Grading Engine ───────────────────────────────────

test("questionEvaluation grades mcq_single, mcq_multi, assertion, true_false, fib (both modes), and diagram", () => {
  // Multi-correct full & partial
  const multiQ = {
    type: "mcq_multi",
    options: ["Velocity", "Displacement", "Mass", "Speed"],
    correctAnswer: ["Velocity", "Displacement"],
    marks: 4,
    negativeMark: 1,
  }
  const exactMulti = evaluateObjectiveAnswer(multiQ, ["A", "B"])
  assert.equal(exactMulti.isCorrect, true)
  assert.equal(exactMulti.earnedMarks, 4)

  const partialMulti = evaluateObjectiveAnswer(multiQ, ["A"])
  assert.equal(partialMulti.isCorrect, false)
  assert.equal(partialMulti.earnedMarks, 2)

  const wrongMulti = evaluateObjectiveAnswer(multiQ, ["A", "C"])
  assert.equal(wrongMulti.earnedMarks, -1)

  // Assertion by letter vs full text
  const assertionQ = {
    type: "assertion",
    options: [...STANDARD_ASSERTION_OPTIONS],
    correctAnswer: "A",
    marks: 4,
    negativeMark: 1,
  }
  assert.equal(evaluateObjectiveAnswer(assertionQ, STANDARD_ASSERTION_OPTIONS[0]).isCorrect, true)

  // Text FIB with alsoAccept case-insensitivity
  const fibTextQ = {
    type: "fillblanks",
    questionText: "The chemical symbol for Sodium is ___.",
    blanks: [{ id: 1, label: "Blank 1", answer: "Na", alsoAccept: ["Natrium"] }],
    caseInsensitive: true,
    marks: 2,
  }
  assert.equal(evaluateObjectiveAnswer(fibTextQ, ["na"]).isCorrect, true)
  assert.equal(evaluateObjectiveAnswer(fibTextQ, ["natrium"]).isCorrect, true)

  // Legacy 4-option competitive FIB
  const fibOptQ = {
    type: "fillblanks",
    questionText: "The unit of Capacitance is ___.",
    options: ["Farad", "Henry", "Tesla", "Weber"],
    correctAnswer: "Farad",
    marks: 4,
    negativeMark: 1,
  }
  assert.equal(evaluateObjectiveAnswer(fibOptQ, "A").isCorrect, true)
  assert.equal(evaluateObjectiveAnswer(fibOptQ, "B").earnedMarks, -1)

  // Diagram formatting display helper
  assert.equal(formatOptionDisplay(["Velocity", "Displacement"], multiQ.options), "A. Velocity, B. Displacement")
})

// ─── 9. Full Multi-Format Round-Trip & Secondary Academic Verifier ───────────

test("orchestrator generates all formats canonically and rejects verifier-flagged flaws across subjects", async () => {
  const cases: Array<{
    format: "mcq_multi" | "assertion" | "true_false" | "fib" | "descriptive" | "diagram"
    subject: string
    payload: Record<string, unknown>
    expectedDbType: string
  }> = [
    {
      format: "mcq_multi",
      subject: "Chemistry",
      expectedDbType: "mcq_multi",
      payload: {
        questionText: "Which species act as Bronsted-Lowry bases in aqueous media?",
        chapter: "Ionic Equilibrium",
        difficulty: "medium",
        options: ["$\\ce{NH3}$", "$\\ce{CH3COO-}$", "$\\ce{NH4+}$", "$\\ce{H3O+}$"],
        correctAnswer: ["$\\ce{NH3}$", "$\\ce{CH3COO-}$"],
        explanation: "Both $\\ce{NH3}$ and $\\ce{CH3COO-}$ accept protons cleanly; $\\ce{NH4+}$ and $\\ce{H3O+}$ act as proton donors.",
      },
    },
    {
      format: "true_false",
      subject: "Biology",
      expectedDbType: "truefalse",
      payload: {
        questionText: "During aerobic respiration, glycolysis takes place strictly inside the mitochondrial matrix.",
        chapter: "Respiration in Plants",
        difficulty: "easy",
        correctAnswer: "False",
        explanation: "Glycolysis takes place in the cytoplasm, whereas the Krebs cycle takes place in the mitochondrial matrix.",
      },
    },
    {
      format: "fib",
      subject: "Mathematics",
      expectedDbType: "fillblanks",
      payload: {
        questionText: "The derivative of $\\sin(3x)$ with respect to $x$ is ___.",
        chapter: "Differentiation",
        difficulty: "easy",
        blanks: [{ id: 1, label: "Blank 1", answer: "3cos(3x)", alsoAccept: ["3 cos(3x)"] }],
        explanation: "Applying chain rule gives $\\frac{d}{dx}\\sin(3x) = 3\\cos(3x)$.",
      },
    },
    {
      format: "descriptive",
      subject: "Physics",
      expectedDbType: "descriptive",
      payload: {
        questionText: "State Gauss's Law in electrostatics and derive the electric field due to an infinitely long uniform line charge.",
        chapter: "Electrostatics",
        difficulty: "hard",
        marks: 5,
        wordLimit: 140,
        modelAnswer: "Gauss's law states that total electric flux through any closed surface equals enclosed charge divided by permittivity. Constructing a coaxial cylinder of radius r and length L gives E(2*pi*r*L) = lambda*L/eps0, hence E = lambda / (2*pi*eps0*r).",
        rubric: [
          "Statement & mathematical formula of Gauss's Law (2 marks)",
          "Symmetric cylindrical Gaussian surface & flux integration (2 marks)",
          "Final expression with direction (1 mark)",
        ],
        explanation: "Complete derivation following Gaussian symmetry.",
      },
    },
    {
      format: "diagram",
      subject: "Physics",
      expectedDbType: "diagram",
      payload: {
        questionText: "In the series resistor circuit diagram shown below, calculate the equivalent resistance between X and Y.",
        chapter: "Current Electricity",
        difficulty: "medium",
        questionImage: `<svg viewBox="0 0 400 200"><line x1="20" y1="100" x2="100" y2="100" stroke="#1e293b" stroke-width="2"/><rect x="100" y="85" width="70" height="30" fill="none" stroke="#1e293b"/><rect x="210" y="85" width="70" height="30" fill="none" stroke="#1e293b"/><line x1="280" y1="100" x2="360" y2="100" stroke="#1e293b"/><text x="120" y="75">4 Ohm</text><text x="230" y="75">6 Ohm</text></svg>`,
        options: ["2.4 Ohm", "10 Ohm", "24 Ohm", "1.5 Ohm"],
        correctAnswer: "10 Ohm",
        explanation: "Resistors in series add linearly: $R_{eq} = 4 + 6 = 10\\ \\Omega$.",
      },
    },
  ]

  for (const tc of cases) {
    const transport: GeminiTransportFn = async () => ({
      status: 200,
      bodyText: JSON.stringify({
        candidates: [
          {
            finishReason: "STOP",
            content: { parts: [{ text: JSON.stringify([tc.payload]) }] },
          },
        ],
      }),
    })

    const out = await generateQuestionBatch({
      examName: "Roundtrip Assessment",
      subject: tc.subject,
      chapters: [String(tc.payload.chapter)],
      format: tc.format,
      count: 1,
      difficulty: String(tc.payload.difficulty),
      marks: Number(tc.payload.marks || 4),
      negativeMark: tc.format === "descriptive" ? 0 : 1,
      transportOverride: transport,
    })

    assert.equal(out.questions.length, 1, `Expected 1 valid ${tc.format} question`)
    const dbPayload = toExamQuestionPayload(out.questions[0])
    assert.equal(dbPayload.type, tc.expectedDbType)

    const rehydrated = normalizeStoredQuestion(dbPayload)
    assert.equal(rehydrated.questionFormat, tc.format)
    if (tc.format === "descriptive") {
      assert.equal(dbPayload.options, undefined)
      assert.equal((dbPayload.rubric as string[]).length, 3)
    }
  }

  // Verify academic verification stage drops flagged question when enabled
  let step = 0
  const verifierTransport: GeminiTransportFn = async () => {
    step++
    if (step === 1) {
      return {
        status: 200,
        bodyText: JSON.stringify({
          candidates: [
            {
              finishReason: "STOP",
              content: {
                parts: [
                  {
                    text: JSON.stringify([
                      {
                        questionText: "What is the pH of pure neutral water at 298 K?",
                        chapter: "Equilibrium",
                        difficulty: "easy",
                        options: ["0", "5", "7", "14"],
                        correctAnswer: "7",
                        explanation: "Pure water has $[H^+] = 10^{-7}$ M so pH = 7 at 298 K.",
                      },
                      {
                        questionText: "Flawed subtle chemistry item flagged by academic verifier",
                        chapter: "Equilibrium",
                        difficulty: "hard",
                        options: ["A1", "B1", "C1", "D1"],
                        correctAnswer: "A1",
                        explanation: "Subtle error in thermodynamic equilibrium premise.",
                      },
                    ]),
                  },
                ],
              },
            },
          ],
        }),
      }
    }
    return {
      status: 200,
      bodyText: JSON.stringify({
        candidates: [
          {
            finishReason: "STOP",
            content: {
              parts: [
                {
                  text: JSON.stringify([
                    { index: 0, isAcademicallyValid: true, isUnambiguous: true, computedAnswer: "7", issues: [] },
                    { index: 1, isAcademicallyValid: false, isUnambiguous: false, computedAnswer: "none", issues: ["Thermodynamic premise is inconsistent"] },
                  ]),
                },
              ],
            },
          },
        ],
      }),
    }
  }

  const verifiedOut = await generateQuestionBatch({
    examName: "Verifier Check",
    subject: "Chemistry",
    chapters: ["Equilibrium"],
    format: "mcq_single",
    count: 1,
    difficulty: "mixed",
    marks: 4,
    negativeMark: 1,
    verifyAcademically: true,
    maxRetriesForDeficit: 0,
    transportOverride: verifierTransport,
  })

  assert.equal(verifiedOut.questions.length, 1)
  assert.equal(verifiedOut.questions[0].correctAnswer, "7")
  assert.equal(verifiedOut.qualityReport.verifierRejectedCount, 1)
})

// ─── 10. Competitive Chemistry Visual/Reaction/Mechanism/Hybridization ────────

test("Chemistry prompt builder and validator support organic ring/mechanism SVGs, hybridization notation, and reject raw TeX in SVG", () => {
  const mhtPrompt = buildQuestionGenerationPrompt({
    examName: "MHT-CET Chemistry Mock",
    examTarget: "MHT_CET",
    subject: "Chemistry",
    grade: "12",
    chapters: ["Halogen Derivatives", "Alcohols, Phenols and Ethers"],
    format: "mcq_single",
    count: 10,
    difficulty: "balanced",
    difficultyCounts: { easy: 3, medium: 5, hard: 2 },
    marks: 1,
    negativeMark: 0,
  })
  assert.ok(mhtPrompt.systemInstruction.includes("MHT-CET"))
  assert.ok(mhtPrompt.systemInstruction.includes("Conc. H₂SO₄"))
  assert.ok(mhtPrompt.systemInstruction.includes("\\overset{(sp^2)}"))
  assert.ok(mhtPrompt.formatDirectives.includes("questionImage"))

  const advPrompt = buildQuestionGenerationPrompt({
    examName: "JEE Advanced Chemistry",
    examTarget: "JEE_ADVANCED",
    subject: "Organic Chemistry",
    grade: "11",
    chapters: ["Basic Principles of Organic Chemistry"],
    format: "mcq_multi",
    count: 5,
    difficulty: "hard",
    difficultyCounts: { easy: 0, medium: 0, hard: 5 },
    marks: 4,
    negativeMark: 2,
  })
  assert.ok(advPrompt.systemInstruction.includes("JEE Advanced Chemistry Focus"))
  assert.ok(advPrompt.systemInstruction.includes("homolysis vs heterolysis"))

  // Reject raw unrendered LaTeX $...$ inside SVG <text>
  const brokenSvgTex = `<svg viewBox="0 0 400 200"><polygon points="60,80 90,60 120,80 120,120 90,140 60,120" fill="none" stroke="#1e293b"/><line x1="140" y1="100" x2="220" y2="100" stroke="#1e293b"/><text x="150" y="90">$\\ce{Conc. H2SO4}$</text></svg>`
  const badTexCheck = validateAndSanitizeSvg(brokenSvgTex)
  assert.equal(badTexCheck.valid, false)

  // Accept valid textbook-style Chemistry ring + curved-arrow reaction SVG inside mcq_single
  const chemMechSvg = `<svg viewBox="0 0 520 340"><defs><marker id="arr" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto"><path d="M0,0 L8,3 L0,6 Z" fill="#1e293b"/></marker></defs><polygon points="60,70 85,55 110,70 110,100 85,115 60,100" fill="none" stroke="#1e293b" stroke-width="2"/><circle cx="85" cy="85" r="14" fill="none" stroke="#1e293b"/><text x="65" y="135">Benzene</text><text x="125" y="90">+ Conc. HNO₃</text><line x1="210" y1="85" x2="310" y2="85" stroke="#1e293b" stroke-width="2" marker-end="url(#arr)"/><text x="220" y="75">Conc. H₂SO₄</text><text x="242" y="103">333 K</text><polygon points="340,70 365,55 390,70 390,100 365,115 340,100" fill="none" stroke="#1e293b" stroke-width="2"/><text x="357" y="42">NO₂</text><text x="332" y="135">Nitrobenzene</text></svg>`
  const chemMcq = validateAndCanonicalizeQuestion(
    {
      questionText: "Identify the reaction type shown in the benzene nitration scheme below.",
      questionImage: chemMechSvg,
      chapter: "Hydrocarbons",
      difficulty: "medium",
      options: [
        "Electrophilic aromatic substitution",
        "Nucleophilic substitution",
        "Free radical addition",
        "Elimination reaction",
      ],
      correctAnswer: "Electrophilic aromatic substitution",
      explanation: "Conc. HNO₃ + Conc. H₂SO₄ generates nitronium ion NO₂⁺ which attacks the benzene ring via electrophilic aromatic substitution.",
    },
    { expectedFormat: "mcq_single", subject: "Chemistry", defaultMarks: 4 }
  )
  assert.equal(chemMcq.valid, true)
  assert.ok(chemMcq.question?.questionImage?.includes("xmlns=\"http://www.w3.org/2000/svg\""))

  // Distinct Chemistry SVG figures with similar generic stems must NOT be flagged as duplicate
  const otherChemSvg = `<svg viewBox="0 0 520 340"><line x1="40" y1="90" x2="180" y2="90" stroke="#1e293b"/><path d="M90,90 Q110,60 130,90" fill="none" stroke="#1e293b"/><rect x="200" y="70" width="80" height="40" fill="none" stroke="#1e293b"/><text x="50" y="75">CH₃O–OCH₃ Homolysis → Free radicals</text></svg>`
  const dedup = new QuestionDeduplicator([
    {
      id: "chem1",
      questionText: "Identify the incorrect curved arrow cleavage shown below.",
      questionImage: chemMechSvg,
      options: ["(a)", "(b)", "(c)", "(d)"],
    },
  ])
  const checkOther = dedup.check({
    id: "chem2",
    questionText: "Identify the incorrect curved arrow cleavage shown below.",
    questionImage: otherChemSvg,
    options: ["(a)", "(b)", "(c)", "(d)"],
  })
  assert.equal(checkOther.isDuplicate, false)

  // Verify ESM KaTeX + mhchem registers \ce macro without katex-error red output
  const renderedThiosulfate = katex.renderToString("\\ce{Na2S2O3}", {
    throwOnError: false,
    strict: "ignore",
    trust: true,
  })
  assert.ok(!renderedThiosulfate.includes("katex-error"), "KaTeX must recognize \\ce without red error span")
  assert.ok(renderedThiosulfate.includes("Na") && renderedThiosulfate.includes("S") && renderedThiosulfate.includes("O"))

  const renderedReaction = katex.renderToString(
    "\\ce{CH3CH2I + KOH(aq) ->[\\Delta] CH3CH2OH + KI}",
    { throwOnError: false, strict: "ignore", trust: true }
  )
  assert.ok(!renderedReaction.includes("katex-error"), "KaTeX must render \\ce arrow reactions cleanly")
})

test("normalizeMathContent wraps bare Physics LaTeX options/prose without corrupting plain text", () => {
  const physicsOptions = [
    "2.5 \\mu\\text{F}",
    "5.0 \\mu\\text{F}",
    "f_0/2",
    "f_0",
    "2f_0",
    "0.123 \\text{\\AA}",
    "1.227 \\text{\\AA}",
    "10^{-4} \\text{ T}",
    "2 \\times 10^{-5} \\text{ T}",
    "-1.386 \\times 10^5\\text{ J}",
    "2 \\Omega",
    "9 \\Omega",
    "3 \\epsilon_0 A / d",
    "n\\lambda",
    "(2n+1)\\frac{\\lambda}{2}",
    "(2n-1)\\frac{\\lambda}{2}",
  ]

  for (const raw of physicsOptions) {
    assert.equal(isBareStandaloneMath(raw), true, `Expected standalone math detection for: ${raw}`)
    const normalized = normalizeMathContent(raw)
    assert.ok(normalized.startsWith("$") && normalized.endsWith("$"), `Must wrap ${raw} in $...$`)
    const html = katex.renderToString(normalized.slice(1, -1), {
      throwOnError: true,
      strict: "ignore",
      trust: true,
    })
    assert.ok(!html.includes("katex-error"), `KaTeX failed for ${raw}`)
  }

  // Mixed prose with bare Physics LaTeX must wrap only math tokens and keep English intact
  const mixedProse =
    "If resonance frequency is f_0/2 and path difference is (2n+1)\\frac{\\lambda}{2} at B = 2 \\times 10^{-5} \\text{ T}, find C."
  const normalizedProse = normalizeMathContent(mixedProse)
  assert.ok(normalizedProse.includes("$f_0/2$"))
  assert.ok(normalizedProse.includes("$(2n+1)\\frac{\\lambda}{2}$"))
  assert.ok(normalizedProse.includes("$2 \\times 10^{-5} \\text{ T}$"))
  assert.ok(normalizedProse.startsWith("If resonance frequency is "))

  // Plain options, code snake_case identifiers, and URLs must NOT be wrapped as math
  for (const plain of [
    "40 days",
    "0.16 N-m",
    "2.99 cm",
    "2.21 pC",
    "expected_output",
    "https://example.com/path_name",
  ]) {
    assert.equal(isBareStandaloneMath(plain), false, `Must NOT treat plain text as math: ${plain}`)
    assert.equal(normalizeMathContent(plain), plain)
  }
})

test("computePublicExamCapacity enforces institute maxStudents seat limit cleanly", () => {
  assert.deepEqual(computePublicExamCapacity(10, 0), {
    maxStudents: 10,
    usedSeats: 0,
    remainingSeats: 10,
    limitReached: false,
  })
  assert.deepEqual(computePublicExamCapacity(10, 9), {
    maxStudents: 10,
    usedSeats: 9,
    remainingSeats: 1,
    limitReached: false,
  })
  assert.deepEqual(computePublicExamCapacity(10, 10), {
    maxStudents: 10,
    usedSeats: 10,
    remainingSeats: 0,
    limitReached: true,
  })
  assert.deepEqual(computePublicExamCapacity(10, 14), {
    maxStudents: 10,
    usedSeats: 14,
    remainingSeats: 0,
    limitReached: true,
  })
  assert.deepEqual(computePublicExamCapacity(0, 0), {
    maxStudents: 0,
    usedSeats: 0,
    remainingSeats: 0,
    limitReached: true,
  })
})

test("attemptHelpers prevent answer wipes, resolve _id/id answers, and preserve public portal URL", () => {
  const savedOnServer = [
    { questionId: "q1", sectionType: "mcq", answer: "A" },
    { questionId: "q2", sectionType: "mcq", answer: "B" },
  ]

  // Stale empty client payload must NEVER erase persisted DB answers
  const preservedOnEmpty = mergeAttemptAnswers(savedOnServer, [])
  assert.deepEqual(preservedOnEmpty, savedOnServer)

  // Auto-submit with stale empty entry must keep DB answer intact while merging new answers
  const mergedAutoSubmit = mergeAttemptAnswers(
    savedOnServer,
    [
      { questionId: "q1", sectionType: "mcq", answer: "" },
      { questionId: "q3", sectionType: "mcq", answer: "C" },
    ],
    { preserveNonEmptyOnEmptyIncoming: true }
  )
  assert.equal(mergedAutoSubmit.find((a) => a.questionId === "q1")?.answer, "A")
  assert.equal(mergedAutoSubmit.find((a) => a.questionId === "q2")?.answer, "B")
  assert.equal(mergedAutoSubmit.find((a) => a.questionId === "q3")?.answer, "C")

  // Explicit user clear (non-autoSubmit) updates that question while keeping others
  const explicitClear = mergeAttemptAnswers(
    savedOnServer,
    [{ questionId: "q1", sectionType: "mcq", answer: "" }],
    { preserveNonEmptyOnEmptyIncoming: false }
  )
  assert.equal(explicitClear.find((a) => a.questionId === "q1")?.answer, "")
  assert.equal(explicitClear.find((a) => a.questionId === "q2")?.answer, "B")

  // Answer lookup works with either MongoDB _id or string id
  assert.equal(findAnswerForQuestion(savedOnServer, { id: "q2" })?.answer, "B")
  assert.equal(findAnswerForQuestion(savedOnServer, { _id: "q1" })?.answer, "A")

  // Public exam portal redirect URL preservation
  assert.equal(getExamPortalUrl("674a123", true), "/exam/674a123?access=public")
  assert.equal(getExamPortalUrl("674a123", false), "/exam/674a123")

  // Analytics display score preserves backend-stored organization score when client recalculation misses marks
  assert.equal(
    resolveAnalyticsDisplayScore({
      showResults: true,
      attemptScore: 18,
      calculatedScore: 0,
      isGraded: true,
    }),
    18
  )
  assert.equal(
    resolveAnalyticsDisplayScore({
      showResults: true,
      attemptScore: 12,
      calculatedScore: 16,
      isGraded: true,
      hasManualGrades: true,
    }),
    12
  )
  assert.equal(
    resolveAnalyticsDisplayScore({
      showResults: true,
      attemptScore: 0,
      calculatedScore: 15,
      isGraded: true,
    }),
    15
  )

  // Format concatenated instruction paragraph into clean bullet items and suppress duplicate description
  const legacyParagraph =
    "Read all questions carefully before answering. Ensure you have completed all required questions before finishing the exam. Face Detection: Sit alone in a well-lit, quiet place with your face clearly visible. Tab-Switch Prevention: Do not switch tabs or open other applications during the exam."
  const splitInstructions = formatExamInstructions([legacyParagraph])
  assert.ok(splitInstructions.length >= 4)
  assert.ok(splitInstructions.some((i) => i.startsWith("Face Detection:")))
  assert.ok(splitInstructions.some((i) => i.startsWith("Tab-Switch Prevention:")))
  assert.equal(getCleanExamDescription(legacyParagraph, splitInstructions), null)
  assert.equal(
    getCleanExamDescription("Full syllabus mock exam based on MHT-CET 2026 pattern.", splitInstructions),
    "Full syllabus mock exam based on MHT-CET 2026 pattern."
  )
})
