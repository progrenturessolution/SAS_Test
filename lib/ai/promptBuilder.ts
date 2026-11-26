import { STANDARD_ASSERTION_OPTIONS, type CanonicalDifficulty, type CanonicalFormat } from "./canonicalSchema"

export interface DifficultyMixCounts {
  easy: number
  medium: number
  hard: number
}

export interface PromptBuildInput {
  examName: string
  examTarget?: string
  subject: string
  grade?: string
  chapters: string[]
  topics?: string[]
  syllabusSummary?: string
  format: CanonicalFormat
  fibMode?: "blanks" | "mcq"
  count: number
  difficulty: CanonicalDifficulty | "mixed" | "balanced" | string
  difficultyCounts: DifficultyMixCounts
  marks: number
  negativeMark: number
  wordLimit?: number
  customInstructions?: string
  existingQuestionStems?: string[]
  coveredObjectives?: string[]
}

export interface BuiltPrompt {
  systemInstruction: string
  formatDirectives: string
  taskPrompt: string
}

export function computeDifficultyCounts(
  totalCount: number,
  mode: string,
  customRatio?: Partial<{ easy: number; medium: number; hard: number }>
): DifficultyMixCounts {
  const n = Math.max(0, Math.round(totalCount))
  if (n === 0) return { easy: 0, medium: 0, hard: 0 }

  const norm = String(mode || "medium").trim().toLowerCase()
  if (norm === "easy") return { easy: n, medium: 0, hard: 0 }
  if (norm === "medium") return { easy: 0, medium: n, hard: 0 }
  if (norm === "hard") return { easy: 0, medium: 0, hard: n }

  const wEasy = Math.max(0, Number(customRatio?.easy ?? 30))
  const wMed = Math.max(0, Number(customRatio?.medium ?? 50))
  const wHard = Math.max(0, Number(customRatio?.hard ?? 20))
  const weightSum = wEasy + wMed + wHard || 100

  // Largest remainder (Hamilton) integer apportionment so easy + medium + hard === n strictly
  const exact = [
    { key: "easy" as const, val: (n * wEasy) / weightSum },
    { key: "medium" as const, val: (n * wMed) / weightSum },
    { key: "hard" as const, val: (n * wHard) / weightSum },
  ]
  const floors = exact.map((e) => ({
    key: e.key,
    base: Math.floor(e.val),
    rem: e.val - Math.floor(e.val),
  }))

  let remaining = n - floors.reduce((s, f) => s + f.base, 0)
  const order = [...floors].sort((a, b) => b.rem - a.rem)
  for (let i = 0; i < remaining; i++) {
    order[i % order.length].base += 1
  }

  return {
    easy: floors.find((f) => f.key === "easy")!.base,
    medium: floors.find((f) => f.key === "medium")!.base,
    hard: floors.find((f) => f.key === "hard")!.base,
  }
}

const CHEMISTRY_SVG_AND_NOTATION_GUIDE = `
CHEMISTRY VISUAL & NOTATION PLAYBOOK (CRITICAL FOR COMPETITIVE AUTHENTICITY):
Include varied real exam question archetypes rather than repetitive text definitions:
1. Organic Reaction Schemes (Aromatic Rings & Reagent Conditions over Arrow):
   - When a reaction involves benzene/aromatic rings, cyclic/heterocyclic rings, bond-line skeletal frameworks, curved-arrow mechanisms, stereochemistry, or side-by-side reaction sets (i)/(ii) or (a)-(d):
     DRAW a crisp, clean textbook-style inline SVG in "questionImage"!
   - Benzene ring SVG pattern: <polygon points="..." fill="none" stroke="#1e293b" stroke-width="2"/> + inner aromatic <circle cx="..." cy="..." r="..." fill="none" stroke="#1e293b" stroke-width="1.5"/> (or alternating double bonds), attached substituents with bond lines + labels (-NO₂, -OH, -Br, -CH₃), "+" between reactants, horizontal arrow (<defs><marker id="arr" ...>), with reagents/catalysts & temperature stacked cleanly ABOVE and BELOW the arrow (e.g., "Conc. H₂SO₄" above arrow, "333 K" below arrow) and compound names ("Benzene", "Nitrobenzene", "ethanol") neatly below structures.
2. Curved-Arrow Mechanisms & Bond Cleavage Comparisons (a)-(d):
   - Use <path d="M x1 y1 Q cx cy x2 y2" fill="none" stroke="#1e293b" stroke-width="1.6" marker-end="url(#arr)"/> for two-electron movement and fishhook/half-arrow or distinct labels ("Homolysis", "Heterolysis", "Free radicals", "Carbocation", "Carbanion") when comparing 4 labeled reaction schemes (a), (b), (c), (d) cleanly spaced inside a single SVG (e.g., viewBox="0 0 560 440"). Use options ["(a)", "(b)", "(c)", "(d)"] or concise descriptions matching those exact letters, and name the compounds/concepts inside questionText so each question stays self-contained!
   - INSIDE <svg><text>...</text></svg>, ALWAYS use Unicode subscripts/superscripts & symbols (H₂SO₄, HNO₃, NO₂, CH₃, sp², sp³, ⁺, ⁻, •, →, ⇌, ≡, Δ) or <tspan> — NEVER put raw $...$ or \\ce{...} inside SVG <text>.
3. Structural Hybridization & Chain Annotations (Inline LaTeX in questionText/options/explanation):
   - For sp/sp²/sp³ hybridization, functional groups, or π-bond problems on chains, use stacked notation:
     e.g., "$\\\\text{CH}_2 = \\\\overset{(sp^2)}{\\\\text{CH}} - \\\\overset{(sp^3)}{\\\\text{CH}}_2 - \\\\text{CH}_2 - \\\\text{C}\\\\equiv\\\\text{CH}$".
4. Physical & Inorganic Solubility / Trends / Orders:
   - Write crystal-clear subscripted ionic formulas via LaTeX/mhchem (e.g. "$(\\\\text{NH}_4)_2\\\\text{SO}_4$", "$\\\\text{KMnO}_4$", "$\\\\text{BaCO}_3$", "$\\\\text{Zn(NO}_3)_2$", "$\\\\ce{2H2 + O2 -> 2H2O}$") testing solubility, thermal stability, Ka/Kb trends, VSEPR, CFSE, Nernst/emf, kinetics, and equilibrium.
5. Physical Chemistry Numericals:
   - Specify constants ($R = 8.314\\\\text{ J mol}^{-1}\\\\text{K}^{-1}$ or $0.0821\\\\text{ L atm mol}^{-1}\\\\text{K}^{-1}$) when needed, verify unit conversions, and double-check arithmetic before locking options.`

function getSubjectGuidance(subject: string): string {
  const s = subject.trim().toLowerCase()
  if (s.includes("phys")) {
    return [
      "- Physics Rules: Enforce consistent SI units and dimensional homogeneity across data, intermediate steps, and options.",
      "- Specify standard constants clearly when needed (e.g., $g = 9.8\\text{ m/s}^2$ or $10\\text{ m/s}^2$).",
      "- Solve equations symbolically and numerically first; check signs, vectors, and frame of reference before locking options.",
      "- Include clean inline SVG diagrams (`questionImage`) whenever mechanics FBD/pulley/inclined-plane geometry, electric/RLC circuits, ray/wave optics, or $V$-$I$/$v$-$t$/$P$-$V$ graphs strengthen conceptual testing.",
      "- Distractors should reflect realistic student pitfalls (missing factor of $2$, sign flip, unit error), never absurd random numbers.",
    ].join("\n")
  }
  if (s.includes("chem") || s.includes("organic") || s.includes("inorganic")) {
    return [
      "- Chemistry Rules: Use $...$ and \\\\ce{...} in questionText/options/explanation ($\\\\ce{2H2 + O2 -> 2H2O}$ or \\\\ce{Conc. HNO3 ->[\\\\text{Conc. H}_2\\\\text{SO}_4, 333\\\\text{ K}] Nitrobenzene}).",
      "- Ensure chemical equations are atom- and charge-balanced; state conditions (temperature, solvent, aq/alc medium, catalyst) unambiguously.",
      "- Use IUPAC nomenclature accurately and verify atomic numbers, electron configurations, stereochemistry, and oxidation states.",
      CHEMISTRY_SVG_AND_NOTATION_GUIDE,
    ].join("\n")
  }
  if (s.includes("math")) {
    return [
      "- Mathematics Rules: State domain restrictions explicitly (e.g., $x > 0$, $x \\neq 1$). Ensure a unique, exact answer exists.",
      "- Solve step-by-step and plug the final result back into the original equation or boundary cases before outputting.",
      "- Include clean coordinate/geometric SVG graphs (`questionImage`) for area-under-curve, conic sections, tangent-normal, or vector geometry when visually helpful.",
      "- Format all math cleanly with inline $...$ LaTeX using valid double-escaped JSON backslashes (e.g. \\\\frac{a}{b}).",
    ].join("\n")
  }
  if (s.includes("bio")) {
    return [
      "- Biology Rules: Adhere strictly to scientifically verified NCERT/standard textbook terminology, pathways, enzymes, and taxonomy.",
      "- Avoid double-negative traps unless clearly marked (e.g. 'Which of the following is NOT correct?'). Highlight 'NOT'/'INCORRECT' in uppercase.",
      "- Ensure every statement in multi-statement biology items is unambiguously true or false under standard textbook conventions.",
    ].join("\n")
  }
  return [
    "- Academic Precision: Ensure terminology, facts, quantitative reasoning, and answer explanations are 100% self-consistent and unambiguous.",
  ].join("\n")
}

function getExamProfileGuidance(examTarget?: string, subject = ""): string {
  const t = String(examTarget || "").trim().toUpperCase().replace(/[\s-]+/g, "_")
  const subjLower = subject.trim().toLowerCase()
  const isChem = subjLower.includes("chem") || subjLower.includes("organic") || subjLower.includes("inorganic")
  switch (t) {
    case "NEET":
      return [
        "Exam Profile (NEET UG): Strongly conceptual & NCERT line-by-line precision, direct + multi-statement ('How many statements are correct?' / 'INCORRECT statement') & Assertion-Reason items.",
        isChem
          ? "NEET Chemistry Focus: Exact NCERT organic reagents & temperature conversions (nitration 333 K, Sandmeyer, Reimer-Tiemann, Aldol/Cannizzaro, haloalkane aq. vs alc. KOH), solubility/acidity/basicity orders, hybridization & sigma/pi counting, coordination nomenclature, plus periodic/oxyacid structure trends."
          : "",
      ].filter(Boolean).join("\n")
    case "JEE_MAIN":
      return [
        "Exam Profile (JEE Main): NTA engineering entrance rigor combining multi-concept analytical problem solving, Statement I / Statement II conceptual checks, multi-step synthesis, and quantitative calculations.",
        isChem
          ? "JEE Main Chemistry Focus: Multi-step organic reagent chains (P -> Q -> R -> Major Product with ring/skeletal SVG diagrams where aromatic/cyclic substrates appear), hybridization/IUPAC structure identification, coordination crystal field splitting & isomerism, solubility/periodic anomalies, and physical chemistry numericals (thermo, equilibrium, electrochemistry, kinetics)."
          : "",
      ].filter(Boolean).join("\n")
    case "JEE_ADVANCED":
      return [
        "Exam Profile (JEE Advanced): IIT deep conceptual rigor, multi-concept synthesis across physical/organic/inorganic, tricky edge cases, and subtle mechanism discrimination.",
        isChem
          ? "JEE Advanced Chemistry Focus: Curved-arrow electron-pushing mechanisms (homolysis vs heterolysis, SN1/SN2/E1/E2 competition, carbocation rearrangement, regio/stereoselectivity drawn with crisp SVG reaction diagrams), multi-correct exception statements, coupled equilibrium-electrochemistry-thermodynamics numericals."
          : "",
      ].filter(Boolean).join("\n")
    case "MHT_CET":
      return [
        "Exam Profile (MHT-CET Pattern): Maharashtra HSC + NCERT aligned fast-solving speed-and-accuracy exam. Direct to two-step conceptual + numerical items solvable in 45-75 seconds without overly convoluted multi-part ambiguity.",
        isChem
          ? "MHT-CET Chemistry Focus: Textbook-standard named reactions & reagent schemes (e.g., Benzene + Conc. HNO₃ with Conc. H₂SO₄ at 333 K, CH₃CH₂I + aq. KOH -> ethanol + KI, Williamson synthesis, Grignard, Haloalkanes/Arenes, Alcohols/Phenols/Ethers), hybridization/IUPAC chains, first-order half-life, Raoult/osmotic colligative numericals, transition & coordination complexes, and solubility comparisons."
          : "",
      ].filter(Boolean).join("\n")
    case "CBSE_BOARD":
      return "Exam Profile (CBSE / State Board Pattern): Clear competency-based MCQs, Assertion-Reason, balanced chemical equation / reagent Fill-in-the-Blanks, and structured step-marked descriptive derivations/mechanisms."
    default:
      return "Exam Profile (Configurable Competitive & Academic Assessment): Match authentic entrance/academic rigor, formula/reagent precision, and visual clarity strictly to the selected exam level, subject, chapters, and marks."
  }
}

export function buildFormatDirectives(
  format: CanonicalFormat,
  marks: number,
  negativeMark: number,
  opts?: { fibMode?: "blanks" | "mcq"; wordLimit?: number }
): string {
  const baseFields = `
Required shared JSON keys on EVERY item:
- "questionText": string (clear, self-contained question; wrap EVERY math symbol, subscript, superscript, fraction, Greek letter, and unit expression in inline LaTeX $...$ with JSON-escaped backslashes like "\\\\frac{1}{2}")
- "chapter": string (MUST match one of the authorized chapters/topics listed in the task prompt)
- "topic": string (specific subtopic tested)
- "learningObjective": string (concise phrase describing the concept + skill tested)
- "difficulty": "easy" | "medium" | "hard"
- "marks": ${marks}
- "negativeMark": ${negativeMark}
- "explanation": string (solve step-by-step mathematically/scientifically BEFORE stating why the correct option(s) are right and why distractors fail; wrap all formulas in $...$)
- "pyqReference": "" (leave empty string "" OR write "PYQ-Inspired Concept: <concept>" ONLY — NEVER claim an unverified official exam year like "Official JEE 2023")
- CRITICAL LATEX RULE FOR OPTIONS & TEXT: In "questionText", EVERY item of "options", and "explanation", NEVER output un-delimited LaTeX or raw underscores/powers like "2.5 \\\\mu\\\\text{F}", "f_0/2", "2 \\\\Omega", "10^{-4} \\\\text{ T}", or "(2n+1)\\\\frac{\\\\lambda}{2}" without dollar signs — ALWAYS wrap them inside $...$ (e.g. "$2.5\\\\,\\\\mu\\\\text{F}$", "$f_0/2$", "$2\\\\,\\\\Omega$", "$10^{-4}\\\\text{ T}$").
`

  switch (format) {
    case "mcq_single":
      return `FORMAT: Single-Correct MCQ ("questionFormat": "mcq_single")
${baseFields}
Format-specific schema requirements:
- "questionFormat": "mcq_single"
- "options": array of EXACTLY 4 distinct, non-empty option strings (do NOT include prefixes like "A) " inside text unless options literally label labeled panels "(a)", "(b)", "(c)", "(d)" from an SVG)
- "correctAnswer": string — MUST equal ONE exact entry from "options" verbatim. Strictly ONE option is correct.
- "questionImage" (OPTIONAL SVG visual): For Chemistry aromatic/cyclic rings, skeletal reaction schemes with reagents over arrows, or curved-arrow mechanism comparisons (a)-(d) (or Physics/Math circuits, FBDs, graphs), include a clean inline <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 340">...</svg> diagram using Unicode labels (H₂SO₄, NO₂, sp², →, ⁺, ⁻, •) instead of $...$ inside SVG! Omit "questionImage" for pure text/formula questions (use $...$ / \\\\ce{...} / \\\\overset in questionText & options instead).
- Never claim a diagram/figure is shown if you omit "questionImage".
- Do NOT include "blanks", "modelAnswer", or "rubric".`

    case "mcq_multi":
      return `FORMAT: Multiple-Correct MCQ ("questionFormat": "mcq_multi")
${baseFields}
Format-specific schema requirements:
- "questionFormat": "mcq_multi"
- State in questionText clearly so multiple statements/options can be evaluated independently (e.g., "(One or more than one option is correct)").
- "options": array of EXACTLY 4 distinct, non-empty option strings (NO "A) " prefixes)
- "correctAnswer": JSON array of 2 or 3 strings — EVERY element MUST appear verbatim in "options". NEVER output only 1 answer and NEVER omit an array.
- "questionImage" (OPTIONAL SVG visual): Where multiple-reaction comparisons, aromatic mechanisms, FBDs, or graphs clarify the problem, include a clean self-contained inline <svg viewBox="0 0 520 340">...</svg> using Unicode subscripts/superscripts inside SVG <text>; otherwise omit "questionImage".
- In "explanation", evaluate EACH of the 4 options explicitly and explain why the selected subset is correct.`

    case "assertion":
      return `FORMAT: Assertion & Reason ("questionFormat": "assertion")
${baseFields}
Format-specific schema requirements:
- "questionFormat": "assertion"
- "assertionText": string — clear, self-contained statement (A) that is definitively either True or False.
- "reasonText": string — clear, self-contained statement (R) that is definitively either True or False, and either explains (A) or does not explain (A).
- "questionText": "Assertion (A): <assertionText>\\nReason (R): <reasonText>"
- "options": MUST be these exact 4 canonical options in order:
  ${JSON.stringify(STANDARD_ASSERTION_OPTIONS)}
- "correctAnswer": MUST equal ONE of those 4 strings verbatim, consistent with the truth values and causal link verified in "explanation".
- Verification check: If (A) is false and (R) is true, correctAnswer MUST be index 3; if both true and (R) directly explains (A), index 0; if both true and independent, index 1; if (A) true and (R) false, index 2.`

    case "true_false":
      return `FORMAT: True / False ("questionFormat": "true_false")
${baseFields}
Format-specific schema requirements:
- "questionFormat": "true_false"
- "questionText": one clear factual/conceptual declarative statement to judge True or False (no ambiguous double meanings)
- "correctAnswer": strictly "True" or "False"
- Do NOT include an "options" array.`

    case "fib":
      if (opts?.fibMode === "mcq") {
        return `FORMAT: Fill in the Blanks (Objective Choice Mode, "questionFormat": "fib")
${baseFields}
Format-specific schema requirements:
- "questionFormat": "fib"
- "questionText": sentence containing ONE clear "___" blank marker where a key term/value is missing
- "options": array of EXACTLY 4 distinct plausible strings
- "correctAnswer": exact string from "options" that completes the blank accurately
- "blanks": [{"id": 1, "label": "Blank 1", "answer": "<exact correctAnswer>", "alsoAccept": []}]`
      }
      return `FORMAT: Fill in the Blanks (Text Blank Entry Mode, "questionFormat": "fib")
${baseFields}
Format-specific schema requirements:
- "questionFormat": "fib"
- "questionText": sentence containing 1 or 2 explicit "___" blank markers (using three underscores ___). The count of "___" markers MUST match "blanks.length".
- "blanks": array with ONE object per blank marker: { "id": 1, "label": "Blank 1", "answer": "<exact canonical answer>", "alsoAccept": ["<valid synonym/alt form>"], "caseInsensitive": true }
- "correctAnswer": string (for 1 blank: exact blank answer; for multiple blanks: comma-separated answers)
- Do NOT include an "options" array.`

    case "descriptive": {
      const targetWords = opts?.wordLimit || (marks <= 2 ? 40 : marks <= 5 ? 120 : 220)
      return `FORMAT: Descriptive / Subjective Question ("questionFormat": "descriptive")
${baseFields}
Format-specific schema requirements:
- "questionFormat": "descriptive"
- "questionText": open-ended conceptual, derivation, analysis, or problem-solving question worth ${marks} marks
- "wordLimit": ${targetWords}
- "modelAnswer": thorough, well-structured expert solution (~${targetWords} words) directly answering every part of the question
- "rubric": non-empty JSON array of marking checkpoints whose allocated marks SUM EXACTLY to ${marks} marks (e.g., ["Define concept clearly (1 mark)", "Derive governing relation (2 marks)", "State final result with units (1 mark)"])
- "correctAnswer": set equal to "modelAnswer"
- STRICT RULE: Do NOT include an "options" array or any MCQ choice letters.`
    }

    case "diagram":
      return `FORMAT: Diagram-Based MCQ ("questionFormat": "diagram")
${baseFields}
Format-specific schema requirements:
- "questionFormat": "diagram"
- "questionText": MUST explicitly refer to the accompanying SVG diagram (e.g. "In the circuit shown in the diagram below...") so answering requires inspecting the diagram.
- "questionImage": a complete, clean, self-contained inline "<svg xmlns=\\"http://www.w3.org/2000/svg\\" viewBox=\\"0 0 400 280\\">...</svg>" diagram illustrating the exact values/labels asked in the question!
  * SVG Rules: valid balanced tags, >= 3 geometric primitives (<rect>, <circle>, <line>, <path>, <polygon>), legible <text> labels placed neatly INSIDE 15..385 x 15..265 without overlapping, stroke-width >= 1.5, high-contrast dark strokes (#1e293b / #2563eb / #dc2626) on clean background.
  * SECURITY: NO <script>, NO <foreignObject>, NO onclick/onload attributes, NO external URLs.
- "options": array of EXACTLY 4 distinct, non-empty option strings
- "correctAnswer": exact string matching ONE entry from "options" verbatim.`

    case "coding":
    default:
      return buildFormatDirectives("mcq_single", marks, negativeMark, opts)
  }
}

export function buildQuestionGenerationPrompt(input: PromptBuildInput): BuiltPrompt {
  const systemInstruction = [
    "You are an expert Senior Assessment Engineer and Subject Matter Specialist creating publication-grade examination questions.",
    "CORE VERIFICATION WORKFLOW (MANDATORY BEFORE EMITTING EACH QUESTION):",
    "1. Design an original, syllabus-aligned question testing a clear learning objective.",
    "2. Solve the question completely from first principles on scratch work (verify algebra, calculus, stoichiometry, biological facts, units, and boundary conditions).",
    "3. Double-check that your options / blanks / assertion-reason logic / rubric match your computed solution with zero contradictions.",
    "4. Confirm EVERY JSON backslash inside LaTeX is properly escaped for JSON parsing (e.g. \\\\frac{1}{2}, \\\\ce{H2SO4}, \\\\theta, \\\\times).",
    "5. Output ONLY a valid JSON array `[ ... ]` with zero surrounding markdown fences or commentary.",
    getExamProfileGuidance(input.examTarget, input.subject),
    getSubjectGuidance(input.subject),
  ].join("\n\n")

  const formatDirectives = buildFormatDirectives(input.format, input.marks, input.negativeMark, {
    fibMode: input.fibMode,
    wordLimit: input.wordLimit,
  })

  const chaptersText =
    input.chapters.length > 0
      ? input.chapters.map((c, i) => `${i + 1}. ${c}`).join("\n")
      : `General curriculum for ${input.subject}`

  const topicsText =
    input.topics && input.topics.length > 0 ? input.topics.join(", ") : "Cover diverse subtopics across the listed chapters"

  const existingSection =
    input.existingQuestionStems && input.existingQuestionStems.length > 0
      ? `\nDO NOT DUPLICATE OR MERELY REWORD / SWAP NUMBERS OF THESE EXISTING QUESTIONS:\n${input.existingQuestionStems
        .slice(0, 35)
        .map((s, i) => `${i + 1}. ${s.slice(0, 140)}`)
        .join("\n")}\n`
      : ""

  const objectivesSection =
    input.coveredObjectives && input.coveredObjectives.length > 0
      ? `\nCONCEPTS ALREADY COVERED (prefer fresh concepts/subtopics):\n- ${input.coveredObjectives.slice(0, 25).join("\n- ")}\n`
      : ""

  const syllabusSection = input.syllabusSummary
    ? `\nAUTHORIZED SYLLABUS EXCERPT (Stay strictly within this scope):\n${input.syllabusSummary.slice(0, 2500)}\n`
    : ""

  const diffRequirement = `REQUIRED EXACT DIFFICULTY BREAKDOWN FOR THIS ${input.count}-QUESTION BATCH:
- Easy: ${input.difficultyCounts.easy}
- Medium: ${input.difficultyCounts.medium}
- Hard: ${input.difficultyCounts.hard}
Total MUST equal EXACTLY ${input.count} questions.`

  const taskPrompt = [
    `Generate EXACTLY ${input.count} unique, verified ${input.subject} question(s) for "${input.examName}"${input.grade ? ` (${input.grade})` : ""}.`,
    "",
    diffRequirement,
    "",
    "STRICT SYLLABUS BOUNDARY — Generate ONLY from these authorized chapters/topics:",
    chaptersText,
    `Target subtopics: ${topicsText}`,
    syllabusSection,
    input.customInstructions ? `Additional Educator Instructions: ${input.customInstructions}` : "",
    existingSection,
    objectivesSection,
    "---",
    formatDirectives,
    "---",
    `Return ONLY a valid JSON array containing EXACTLY ${input.count} question objects.`,
  ]
    .filter(Boolean)
    .join("\n")

  return { systemInstruction, formatDirectives, taskPrompt }
}

export function buildAcademicVerificationPrompt(
  subject: string,
  questions: Array<{
    index: number
    questionFormat: CanonicalFormat
    questionText: string
    options?: string[]
    correctAnswer: string | string[]
    blanks?: Array<{ answer: string }>
    modelAnswer?: string
    explanation: string
  }>
): { systemInstruction: string; userPrompt: string } {
  const systemInstruction = [
    "You are an independent Master Exam Auditor verifying whether AI-generated questions are academically accurate, unambiguous, and correctly keyed.",
    "Solve each question independently BEFORE looking at the proposed correctAnswer.",
    "Return ONLY a valid JSON array of audit verdicts.",
  ].join("\n")

  const userPrompt = `Independently verify these ${questions.length} ${subject} questions.
For EACH question return:
{
  "index": number,
  "isAcademicallyValid": boolean,
  "isUnambiguous": boolean,
  "computedAnswer": string,
  "issues": string[] // empty if valid; concise factual error if invalid (e.g. wrong formula, unbalanced reaction, ambiguous multiple options, flawed assertion logic)
}

Questions to audit:
${JSON.stringify(questions, null, 2)}`

  return { systemInstruction, userPrompt }
}
