import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const maxDuration = 60
import connectDB from "@/lib/mongodb"
import { getSession } from "@/lib/auth"
import { robustJsonParse } from "@/lib/jsonRepair"
import { generateContentWithKeyRotation, getGeminiApiKeys } from "@/lib/gemini"

export async function POST(req: Request) {
  try {
    const session = await getSession(req)
    const canGenerateQuestions = session && (
      ["super_admin", "admin", "institute", "coaching_institute"].includes(session.role) ||
      Boolean(session.instituteId)
    )
    if (!canGenerateQuestions) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const {
      exam = "NEET",
      grade = "12",
      subject = "Physics",
      chapters = [],
      topics = [],
      syllabusText = "",
      difficulty = "mixed",
      questionCount = 5,
      questionPattern = "mcq_single",
      marksPerQuestion = 4,
      negativeMarks = 1,
      focusPYQ = true,
      existingQuestions = [],
      blueprintFormats = [],
      stream = false,
    } = body

    if (session.instituteId) {
      try {
        await connectDB()
        const Institute = (await import("@/models/Institute")).default
        const inst = await Institute.findById(session.instituteId).select("limits").lean()
        if (inst && inst.limits?.features?.neetJeeGenerator === false) {
          return NextResponse.json(
            { error: "NEET / JEE / MHT-CET Question Studio is not enabled in your institute plan. Please contact support." },
            { status: 403 }
          )
        }
        const examType = String(exam)
        const allowedExamTypes = Array.isArray(inst?.limits?.examTypes)
          ? inst.limits.examTypes.map((type) => String(type).trim().toUpperCase())
          : ["NEET", "JEE_MAIN", "JEE_ADVANCED", "MHT_CET", "CBSE_BOARD", "CUSTOM"]
        const hasCompetitiveAccess = allowedExamTypes.some((type) =>
          ["COMPETITIVE", "NEET", "JEE_MAIN", "JEE_ADVANCED", "MHT_CET", "CBSE_BOARD"].includes(String(type).trim().toUpperCase())
        )
        if (!hasCompetitiveAccess) {
          return NextResponse.json(
            { error: "Your institute does not have access to Competitive question generation. Contact administrator." },
            { status: 403 }
          )
        }
      } catch (dbErr: any) {
        console.warn("[CompetitiveAI] Institute limits check non-blocking warning:", dbErr.message)
      }
    }

    const chaptersArray = Array.isArray(chapters) ? chapters.map((c: any) => String(c).trim()).filter(Boolean) : []
    const topicsList = Array.isArray(topics)
      ? topics.map((t: any) => String(t).trim()).filter(Boolean).join(", ")
      : String(topics || "").trim()

    if (chaptersArray.length === 0 && !topicsList && !syllabusText) {
      return NextResponse.json({ error: "Please enter at least one chapter, topic, or upload a syllabus PDF" }, { status: 400 })
    }

    const keys = getGeminiApiKeys()
    if (keys.length === 0) {
      return NextResponse.json({ error: "No Gemini API keys configured in .env" }, { status: 500 })
    }

    const activeBlueprintFormats = Array.isArray(blueprintFormats)
      ? blueprintFormats.filter((f: any) => f.checked && (Number(f.count) > 0))
      : []

    // Calculate blueprint total if formats were specified
    const blueprintTotal = activeBlueprintFormats.reduce((sum: number, f: any) => sum + (Number(f.count) || 0), 0)
    const rawCount = blueprintTotal > 0 ? blueprintTotal : (Number(questionCount) || 5)
    const count = Math.min(Math.max(Math.round(rawCount), 1), 200)

    const blueprintSummary = activeBlueprintFormats.length > 0
      ? activeBlueprintFormats.map((f: any) => `- ${f.label} (${f.id}): ${f.count} questions, ${f.marks} marks each`).join("\n")
      : ""
    const chaptersList = chaptersArray.length > 0
      ? chaptersArray.join(", ")
      : topicsList ? topicsList : "Uploaded Syllabus Material"

    // Format list of existing questions to strictly prevent duplicate generation
    const existingListText = Array.isArray(existingQuestions) && existingQuestions.length > 0
      ? existingQuestions
          .slice(0, 30)
          .map((q: string, i: number) => `${i + 1}. ${String(q).substring(0, 100)}`)
          .join("\n")
      : ""

    const isMedicalEngg = ["NEET", "JEE_MAIN", "JEE_ADVANCED", "MHT_CET", "BITSAT", "VITEEE"].includes(String(exam).toUpperCase())
    const examSpecialization = isMedicalEngg
      ? "NTA NEET (UG), JEE Main, JEE Advanced, and State MHT-CET entrance examinations"
      : `${exam} (${subject}) and standard Indian national, state, and academic competitive examinations`

    const systemInstruction = `
You are a senior National Examination Paper Setter and competitive entrance examination researcher specializing in ${examSpecialization}.
Your task is to generate ${count} authentic examination questions for the specified target: ${exam} (${subject}) on: ${chaptersList}.
${topicsList ? `SPECIFIC TOPICS / CONCEPTS TO FOCUS ON: ${topicsList}\n` : ""}
${syllabusText ? `UPLOADED SYLLABUS / STUDY MATERIAL EXTRACT:\n${syllabusText.substring(0, 4000)}\n(CRITICAL INSTRUCTION: Formulate questions directly testing the above uploaded syllabus material!)\n` : ""}

CORE REQUIREMENT 1: PREVIOUS YEARS QUESTIONS (PYQs) & MOST FREQUENTLY ASKED CONCEPTS:
- Base the questions directly on authentic Previous Years Questions (PYQs) or the most frequently asked, highest-yield repeated question models for ${exam} (${subject}).
- Ensure the questions reflect actual questions asked in official national and state examination boards.
- For each question, provide an authentic "pyqReference" tag (e.g. "${exam} 2023", "${exam} 2022", "Repeated PYQ Pattern", "Official Model Pattern").

CORE REQUIREMENT 2: ABSOLUTE ZERO REPETITION / NEVER DUPLICATE:
- DO NOT REPEAT ANY QUESTIONS. Every single question generated MUST test a distinct concept, different formula, different rule, or different phenomenon.
- Never generate two questions with similar numerical values, phrasing, or identical problem statements.
${existingListText ? `- STRICT: DO NOT REPEAT OR DUPLICATE ANY OF THESE PREVIOUSLY GENERATED QUESTIONS:\n${existingListText}\n` : ""}

EXAMINATION TARGET: ${exam}
CLASS / STAGE / LEVEL: ${grade === "both" ? "Full Syllabus" : grade}
SUBJECT / DOMAIN: ${subject}
CHAPTERS / TOPICS COVERED: ${chaptersList}
${topics ? `SPECIFIC TOPICS / NOTES: ${topics}` : ""}
DIFFICULTY LEVEL: ${difficulty.toUpperCase()}
QUESTION PATTERN: ${questionPattern.toUpperCase()}
MARKS PER QUESTION: +${marksPerQuestion}, NEGATIVE MARKS: -${negativeMarks}

${blueprintSummary ? `QUESTION FORMAT SPECIFICATION:\nFollow this blueprint format distribution strictly:\n${blueprintSummary}\n` : ""}
- For "mcq": standard 4 distinct options with single correct choice.
- For "assertion": formulate Assertion (A) and Reason (R) statements in questionText. The options must be standard Assertion-Reason options:
  1. Both (A) and (R) are true and (R) is the correct explanation of (A)
  2. Both (A) and (R) are true but (R) is not the correct explanation of (A)
  3. (A) is true but (R) is false
  4. (A) is false but (R) is true
- For "fib" (Fill in the Blanks): formulate statement with a blank "______" or finding a missing mathematical/physical value. Options are 4 possible values.
- For "true_false": provide a clear conceptual statement (e.g. starting with "True or False: ...").
  CRITICAL: For "true_false" questions, "options" MUST be exactly ["True", "False"] (an array of 2 elements). NEVER return Option A, Option B, Option C, Option D. "correctAnswer" MUST be either "True" or "False".

MATHEMATICAL & SCIENTIFIC FORMATTING RULES:
- Put every mathematical, physics, chemistry, and biology formula inside LaTeX delimiters: use $...$ for inline formulas and $$...$$ for displayed formulas.
- MATRICES & DETERMINANTS (CRITICAL):
  - Always write matrices with standard LaTeX matrix environments: $\begin{bmatrix} a & b \\ c & d \end{bmatrix}$, $\begin{pmatrix} a & b \\ c & d \end{pmatrix}$, or $\begin{vmatrix} a & b \\ c & d \end{vmatrix}$.
  - Use double backslashes for row breaks in the matrix (e.g. \\\\).
  - In the JSON output, escape all backslashes properly so row separation is written as double backslashes in JSON strings.
  - Never collapse matrix rows into a single row.
- PHYSICS QUESTION & ANSWER FORMAT (CRITICAL):
  - Always state given numerical values clearly with appropriate SI or CGS units inside LaTeX: e.g. $m = 2.5\,\mathrm{kg}$, $v = 12\,\mathrm{m/s}$, $B = 0.4\,\mathrm{T}$, $\lambda = 589\,\mathrm{nm}$, $T = 300\,\mathrm{K}$.
  - State any fundamental constants or assumptions (e.g. $g = 9.8\,\mathrm{m/s^2}$, $c = 3\times10^8\,\mathrm{m/s}$, $\varepsilon_0 = 8.85\times10^{-12}\,\mathrm{F/m}$, frictionless surface, ideal gas).
  - Preserve all vector arrows ($\vec{v}$, $\vec{F}$, $\vec{E}$, $\vec{B}$), unit vectors ($\hat{i}, \hat{j}, \hat{k}$), dot/cross products ($\vec{\tau} = \vec{r}\times\vec{F}$), tensors, angles ($\theta = 30^\circ$, $\phi$), powers, and scientific notation ($6.626\times10^{-34}\,\mathrm{J\cdot s}$).
  - All options for numerical/physics questions MUST include explicit physical units ($...$).
  - The "explanation" MUST provide:
    1. Given parameters & target variable
    2. Formula / principle applied (e.g. Bernoulli equation, Gauss's law, Faraday's law)
    3. Step-by-step mathematical substitution & derivation
    4. Concluding answer with units matching the correct option.
- CHEMISTRY QUESTION & ANSWER FORMAT (CRITICAL):
  - Use standard chemical notation or \ce{...} for all chemical species and balanced chemical equations: e.g. $\ce{2H2 + O2 -> 2H2O}$, $\ce{CaCO3 ->[\Delta] CaO + CO2}$, $\ce{N2(g) + 3H2(g) <=> 2NH3(g)}$.
  - Explicitly preserve all chemical subscripts, superscripts, ionic charges, oxidation states, and coordination complexes: e.g. $\ce{H2SO4}$, $\ce{SO4^{2-}}$, $\ce{Fe^{3+}}$, $\ce{KMnO4}$, $\ce{[Fe(CN)6]^{4-}}$, $\ce{[Co(NH3)6]^{3+}}$, $\ce{Cr2O7^{2-}}$.
  - In organic chemistry, state complete IUPAC nomenclature, reaction reagents (e.g. $\ce{LiAlH4}$, $\ce{PCC}$, $\ce{NaBH4}$, $\ce{HBr/ROOR}$), and clear intermediate / major product names.
  - In physical chemistry (thermodynamics, electrochemistry, kinetics), state temperature ($T = 298\,\mathrm{K}$), pressure, cell notation (e.g. $\ce{Zn|Zn^{2+}(1M)||Cu^{2+}(1M)|Cu}$), standard reduction potentials ($E^\circ$), rate constants ($k$), and half-life ($t_{1/2}$).
  - The "explanation" MUST explain the chemical principle, reaction mechanism, stoichiometric coefficients, or electronic configuration step-by-step.
- Options must be distinct, plausible choices (labeled without "A)" prefixes, just the clear option text).
- "correctAnswer" must match one of the options EXACTLY (or an array of correct letters like ["A", "C"] for multi-correct).
- "explanation" must provide a thorough step-by-step solution, the formula used, and derivation with full LaTeX formatting.
- CRITICAL JSON ESCAPING: In the JSON output, escape all LaTeX backslashes properly (e.g. write "\\alpha", "\\frac{a}{b}", "\\vec{v}", "\\theta", "\\Delta", "\\ce{...}", "\\begin{bmatrix}..." with escaped backslashes in JSON strings).

OUTPUT FORMAT:
Return ONLY a valid JSON array of question objects (no markdown code blocks, no intro, no extra text).
[
  {
    "id": string (unique identifier like "pyq_1"),
    "type": "mcq",
    "questionFormat": "mcq" | "diagram" | "assertion" | "fib" | "true_false",
    "questionText": string (clear question statement with proper LaTeX formatting),
    "questionImage": string (optional complete valid SVG markup <svg viewBox='0 0 450 250' ...>...</svg> for questions with circuit diagrams, ray optics, graphs, pulleys, biological figures, or chemical structures),
    "difficulty": "easy" | "medium" | "hard",
    "marks": number (${marksPerQuestion}),
    "negativeMark": number (${negativeMarks}),
    "options": [string, string, string, string],
    "correctAnswer": string (MUST EXACTLY match one of the options),
    "explanation": string (step-by-step solution with formulas in LaTeX/markdown),
    "chapter": string (the specific chapter name),
    "pyqReference": string (e.g. "NEET 2023", "JEE Main 2024 Shift 2", "MHT-CET 2022")
  }
]
`

    const formatDirectives: Record<string, string> = {
      mcq: `CRITICAL FORMAT REQUIREMENT:
All questions in this batch MUST be multiple-choice questions ("questionFormat": "mcq").
Provide exactly 4 distinct answer options in the "options" array.
"correctAnswer" MUST match one of the 4 options exactly.`,

      diagram: `CRITICAL FORMAT REQUIREMENT (DIAGRAM / VISUAL / FIGURE-BASED QUESTION):
All questions in this batch MUST be authentic Diagram / Figure-Based Questions ("questionFormat": "diagram").
A valid, complete, professionally rendered inline SVG diagram MUST be provided in the "questionImage" field.

1. "questionText":
   - MUST explicitly refer to the diagram (e.g., "Refer to the given circuit diagram below: What is the equivalent resistance between terminals A and B?", "In the given ray diagram, find the position of the image formed by the concave mirror:", "Identify the labels (A), (B), and (C) in the given biological structure / cell diagram:", "In the given indicator (P-V) thermodynamic cycle, determine the net work done:").

2. "questionImage":
   - MUST be a valid, complete, high-contrast, scalable SVG string:
     '<svg viewBox="0 0 450 250" xmlns="http://www.w3.org/2000/svg" style="background:#ffffff; font-family:sans-serif;">...</svg>'
   - RULES TO MAKE THE DIAGRAM 100% PROPER & ACCURATE:
     * Background: Always include a clean white background rect:
       <rect width="450" height="260" fill="#ffffff" rx="10" stroke="#cbd5e1" stroke-width="1.5"/>
     * Standard Dimensions: Use viewBox="0 0 450 250" with comfortable padding so no text or shape is cut off.
     * High Contrast & Proper Colors:
       - Outlines / Wires / Geometric boundaries: stroke="#1e293b" (dark slate), stroke-width="2.5"
       - Incident rays / currents / vectors: stroke="#2563eb" (blue) or stroke="#dc2626" (red) with arrowheads
       - Dimensions / Measurements / Focal points: stroke="#64748b" (slate), stroke-dasharray="4 3"
       - Highlights / Labels / Question targets: fill="#f1f5f9" for boxes, stroke="#0284c7"
     * Typography & Text Labels:
       - Use clean sans-serif text: <text x="..." y="..." font-size="13" font-weight="bold" fill="#0f172a" text-anchor="middle">...</text>
       - Label all critical values clearly (e.g. "R₁ = 6 Ω", "12 V", "F", "2F", "P (kPa)", "V (L)", "[A]", "[B]").
     * Content by Subject:
       - Physics: Electric circuits (resistors, batteries, capacitors, switches), ray optics (mirrors, lenses, light rays with directional arrows), mechanics (pulley systems, masses on ramps with friction/normal vectors), P-V cycle graphs (clockwise/counterclockwise loops with arrows).
       - Biology: Plant/animal cell organelle callouts, nephron, reflex arc, human heart chambers, leaf transverse section with parts labeled (A), (B), (C), (D).
       - Chemistry: Galvanic electrochemical cells (electrodes, salt bridge, voltmeter), unit cell lattices, organic reaction flowchart with missing compound [X], titration curve graph.
       - Math: Coordinate geometry, circles with tangents, parabola/hyperbola, triangles with angles.
     * Valid SVG: Close all tags properly (<line ... />, <circle ... />, <rect ... />, <path ... />). Never leave unclosed tags.
     * JSON Escaping: In the JSON output, escape all double quotes inside the SVG string with \\" or use single quotes.

3. "options": Exactly 4 distinct plausible options based on the diagram.
4. "correctAnswer": Exactly matching one of the 4 options.
5. "explanation": Thorough step-by-step solution referencing the diagram calculations.`,

      assertion: `CRITICAL FORMAT REQUIREMENT:
All questions in this batch MUST be Assertion & Reason questions ("questionFormat": "assertion").
The "questionText" MUST be formulated with:
Assertion (A): [Clear scientific/mathematical assertion statement]
Reason (R): [Clear explanatory reason statement]
The "options" array MUST be:
[
  "Both (A) and (R) are true and (R) is the correct explanation of (A)",
  "Both (A) and (R) are true but (R) is not the correct explanation of (A)",
  "(A) is true but (R) is false",
  "(A) is false but (R) is true"
]
"correctAnswer" MUST match one of these 4 standard options.`,

      fib: `CRITICAL FORMAT REQUIREMENT:
All questions in this batch MUST be Fill in the Blanks questions ("questionFormat": "fib").
The "questionText" MUST contain a fill-in-the-blank "______" or ask to compute a missing value.
Provide 4 distinct choices in the "options" array to fill the blank.
"correctAnswer" MUST match one of the 4 options.`,

      descriptive: `CRITICAL FORMAT REQUIREMENT (DESCRIPTIVE QUESTIONS):
All questions in this batch MUST be in-depth Descriptive Questions ("questionFormat": "descriptive", "type": "descriptive").
Formulate a rich conceptual, theoretical, or mathematical derivation problem (e.g. explain a mechanism, derive a fundamental equation, state laws with proof, or discuss key biological/chemical/physical processes).
Provide:
- "correctAnswer": A comprehensive model/reference answer outlining the ideal complete response.
- "explanation": A detailed scoring rubric listing point-by-point key concepts, formulas, and criteria required for marks.
- "wordLimit": Recommended word limit between 150 and 250 words.
- "options": Empty array [].`,

      true_false: `CRITICAL FORMAT REQUIREMENT:
All questions in this batch MUST be True or False questions ("questionFormat": "true_false").
The "questionText" must start with "True or False: " followed by a clear conceptual statement.
The "options" array MUST be exactly ["True", "False"].
"correctAnswer" MUST be either "True" or "False".`,

      mcq_multi: `CRITICAL FORMAT REQUIREMENT (MULTIPLE CORRECT OPTIONS):
All questions in this batch MUST be Multiple Choice with One or More than One Correct Options ("questionFormat": "mcq_multi").
Provide exactly 4 distinct, plausible answer choices in the "options" array (index 0 = Option A, index 1 = Option B, index 2 = Option C, index 3 = Option D).
Between 1 and 4 options can be correct (typically 2 or 3 correct options).
"correctAnswer" MUST be an array of letters corresponding to all correct options, e.g. ["A", "C"] or ["A", "B", "D"] or ["B", "C"].
"explanation" MUST explicitly verify and discuss EACH of the four options (A, B, C, D) one by one, explaining why each is correct or incorrect.`,

      mcq_multiple: `CRITICAL FORMAT REQUIREMENT (MULTIPLE CORRECT OPTIONS):
All questions in this batch MUST be Multiple Choice with One or More than One Correct Options ("questionFormat": "mcq_multi").
Provide exactly 4 distinct, plausible answer choices in the "options" array (index 0 = Option A, index 1 = Option B, index 2 = Option C, index 3 = Option D).
Between 1 and 4 options can be correct (typically 2 or 3 correct options).
"correctAnswer" MUST be an array of letters corresponding to all correct options, e.g. ["A", "C"] or ["A", "B", "D"].
"explanation" MUST explicitly verify and discuss EACH of the four options (A, B, C, D) one by one.`,

      match_following: `CRITICAL FORMAT REQUIREMENT:
All questions in this batch MUST be Match the Following questions ("questionFormat": "match_following").
In "questionText", format two distinct columns:
List-I:
(P) ...
(Q) ...
(R) ...
(S) ...
List-II:
(1) ...
(2) ...
(3) ...
(4) ...
Provide 4 distinct matching code combinations in "options" (e.g. "P-2, Q-3, R-4, S-1").
"correctAnswer" MUST match one of the 4 options.`,

      numerical: `CRITICAL FORMAT REQUIREMENT:
All questions in this batch MUST be Numerical Answer / Integer Type questions ("questionFormat": "numerical").
The question statement must ask for a precise numerical or integer calculation.
Provide 4 distinct numerical answer options in "options".
"correctAnswer" MUST match one of the 4 options.`,

      short_answer: `CRITICAL FORMAT REQUIREMENT:
All questions in this batch MUST be Short Conceptual Answer questions ("questionFormat": "short_answer").
Formulate a direct, high-yield question.
Provide 4 succinct, definitive options.
"correctAnswer" MUST match one of the 4 options.`,

      long_descriptive: `CRITICAL FORMAT REQUIREMENT:
All questions in this batch MUST be Comprehensive / Descriptive Case questions ("questionFormat": "long_descriptive").
Formulate an in-depth analytical question.
Provide 4 distinct structured conclusions or solutions in "options".
"correctAnswer" MUST match one of the 4 options.`,

      case_passage: `CRITICAL FORMAT REQUIREMENT:
All questions in this batch MUST be Case Study / Passage-Based questions ("questionFormat": "case_passage").
The "questionText" MUST begin with a concise case scenario or comprehension passage (1-2 paragraphs), followed by a specific analytical question testing it.
Provide 4 distinct options.
"correctAnswer" MUST match one of the 4 options.`,

      coding_essay: `CRITICAL FORMAT REQUIREMENT:
All questions in this batch MUST be Analytical / Writing / Evaluation questions ("questionFormat": "coding_essay").
Provide 4 structured evaluation choices in "options".
"correctAnswer" MUST match one of the 4 options.`
    }

    interface GenerationTask {
      formatId: string
      formatLabel: string
      targetCount: number
      marks: number
    }

    const generationTasks: GenerationTask[] = []

    if (activeBlueprintFormats.length > 0) {
      for (const fmt of activeBlueprintFormats) {
        const fmtCount = Number(fmt.count) || 0
        if (fmtCount <= 0) continue

        // Fast chunks of 6 questions maximize parallel generation speed across keys
        const chunkSize = fmt.id === "diagram" ? 3 : 6
        const numSubChunks = Math.ceil(fmtCount / chunkSize)
        const baseSub = Math.floor(fmtCount / numSubChunks)
        const remSub = fmtCount % numSubChunks
        for (let s = 0; s < numSubChunks; s++) {
          const subCount = baseSub + (s < remSub ? 1 : 0)
          generationTasks.push({
            formatId: fmt.id as any,
            formatLabel: fmt.label || fmt.id,
            targetCount: subCount,
            marks: Number(fmt.marks) || marksPerQuestion,
          })
        }
      }
    } else {
      if (questionPattern === "diagram_based" || questionPattern === "diagram") {
        const chunkSize = 3
        const numSubChunks = Math.ceil(count / chunkSize)
        const baseSub = Math.floor(count / numSubChunks)
        const remSub = count % numSubChunks
        for (let s = 0; s < numSubChunks; s++) {
          generationTasks.push({
            formatId: "diagram",
            formatLabel: "Diagram / Visual",
            targetCount: baseSub + (s < remSub ? 1 : 0),
            marks: marksPerQuestion,
          })
        }
      } else if (questionPattern === "assertion_reason" || questionPattern === "assertion") {
        const chunkSize = 6
        const numSubChunks = Math.ceil(count / chunkSize)
        const baseSub = Math.floor(count / numSubChunks)
        const remSub = count % numSubChunks
        for (let s = 0; s < numSubChunks; s++) {
          generationTasks.push({
            formatId: "assertion",
            formatLabel: "Assertion & Reason",
            targetCount: baseSub + (s < remSub ? 1 : 0),
            marks: marksPerQuestion,
          })
        }
      } else if (questionPattern === "mixed") {
        // High quality mixed pattern with Diagrams, Assertion & MCQ
        const diagramCount = Math.max(1, Math.round(count * 0.3))
        const assertionCount = Math.max(1, Math.round(count * 0.3))
        const mcqCount = Math.max(1, count - diagramCount - assertionCount)

        generationTasks.push({
          formatId: "diagram",
          formatLabel: "Diagram / Visual",
          targetCount: diagramCount,
          marks: marksPerQuestion,
        })
        generationTasks.push({
          formatId: "assertion",
          formatLabel: "Assertion & Reason",
          targetCount: assertionCount,
          marks: marksPerQuestion,
        })
        generationTasks.push({
          formatId: "mcq",
          formatLabel: "MCQ",
          targetCount: mcqCount,
          marks: marksPerQuestion,
        })
      } else {
        const chunkSize = 6
        const numSubChunks = Math.ceil(count / chunkSize)
        const baseSub = Math.floor(count / numSubChunks)
        const remSub = count % numSubChunks
        for (let s = 0; s < numSubChunks; s++) {
          generationTasks.push({
            formatId: "mcq",
            formatLabel: "MCQ",
            targetCount: baseSub + (s < remSub ? 1 : 0),
            marks: marksPerQuestion,
          })
        }
      }
    }

    console.log(`[CompetitiveAI] Dispatching ${generationTasks.length} format-specific tasks in parallel across ${keys.length} API keys...`)

    // Dispatch all format tasks simultaneously across the key pool with buffer to absorb deduplication
    const chunkPromises = generationTasks.map(async (task, taskIdx) => {
      const requestedCount = task.targetCount
      // Buffer of +1 ensures Gemini generates enough questions to satisfy count without slow top-up calls
      const promptCount = requestedCount + (requestedCount <= 5 ? 1 : 2)
      
      // Distribute chapters across tasks if multiple chapters exist
      let taskChapters = chaptersList
      if (chaptersArray.length > 1) {
        const assigned = chaptersArray.filter((_, idx) => idx % generationTasks.length === taskIdx)
        if (assigned.length > 0) {
          taskChapters = assigned.join(", ")
        }
      }

      const taskPrompt = `Generate exactly ${promptCount} authentic, distinct, non-repeating Previous Years Questions (PYQs) for ${exam} (${subject}) on: ${taskChapters}.

${formatDirectives[task.formatId] || formatDirectives.mcq}

Ensure all generated questions have "questionFormat": "${task.formatId}".
Return raw JSON array ONLY.`

      const result = await generateContentWithKeyRotation({
        payload: {
          contents: [
            {
              parts: [
                { text: `${systemInstruction}\n\nTask: ${taskPrompt}` }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.35 + ((taskIdx % 3) * 0.05),
            responseMimeType: "application/json",
          }
        },
        timeoutMs: 12000
      })

      return {
        formatId: task.formatId,
        text: result.text
      }
    })

    // Set of seen texts to prevent duplicate questions within the batch and existing
    const seenTexts = new Set(
      Array.isArray(existingQuestions)
        ? existingQuestions.map((t: string) => String(t).toLowerCase().replace(/[^a-z0-9]/g, ""))
        : []
    )

    const normalizeGeneratedText = (value: unknown) =>
      String(value || "")
        .replace(/\u000c/g, "\\frac")
        .replace(/\u0008/g, "\\b")
        .trim()

    function formatSingleQuestion(q: any, idx: number, forcedFormat?: string) {
      const questionText = normalizeGeneratedText(q.questionText || "Question")
      const rawFormat = String(forcedFormat || q.questionFormat || q.type || "").toLowerCase().trim()
      
      const isTF =
        forcedFormat === "true_false" ||
        rawFormat === "true_false" ||
        rawFormat === "truefalse" ||
        rawFormat === "tf" ||
        questionText.toLowerCase().startsWith("true or false") ||
        questionText.toLowerCase().startsWith("true/false") ||
        (Array.isArray(q.options) && q.options.length === 2 && q.options.some((o: string) => String(o).toLowerCase() === "true"))

      const isAR =
        !isTF && (
          forcedFormat === "assertion" ||
          rawFormat === "assertion" ||
          rawFormat === "assertion_reason" ||
          rawFormat === "assertion-reason" ||
          questionText.toLowerCase().includes("assertion (a)") ||
          questionText.toLowerCase().includes("assertion:")
        )

      const isDescriptive =
        forcedFormat === "descriptive" ||
        rawFormat === "descriptive" ||
        q.type === "descriptive" ||
        forcedFormat === "short_answer" ||
        forcedFormat === "long_descriptive"

      const isDiagram =
        !isDescriptive && (
          forcedFormat === "diagram" ||
          rawFormat === "diagram" ||
          rawFormat === "diagram_based" ||
          Boolean(q.questionImage && String(q.questionImage).includes("<svg"))
        )

      const isFIB =
        !isDescriptive && !isTF && !isAR && !isDiagram && (
          forcedFormat === "fib" ||
          rawFormat === "fib" ||
          rawFormat === "fill_in_the_blanks" ||
          rawFormat === "fill-in-the-blanks" ||
          questionText.includes("______")
        )

      const isMulti =
        !isDescriptive && !isTF && !isAR && !isDiagram && !isFIB && (
          forcedFormat === "mcq_multi" ||
          forcedFormat === "mcq_multiple" ||
          rawFormat === "mcq_multi" ||
          rawFormat === "mcq_multiple" ||
          (Array.isArray(q.correctAnswer) && q.correctAnswer.length > 1)
        )

      const formatType = isDescriptive
        ? "descriptive"
        : isTF
        ? "true_false"
        : isAR
        ? "assertion"
        : isDiagram
        ? "diagram"
        : isFIB
        ? "fib"
        : isMulti
        ? "mcq_multi"
        : "mcq"

      let options: string[] = []
      let correctAnswer: any = ""

      if (formatType === "descriptive") {
        options = []
        correctAnswer = normalizeGeneratedText(q.correctAnswer || "Model reference solution outlining key concepts and derivations.")
      } else if (formatType === "true_false") {
        options = ["True", "False"]
        const rawAns = String(q.correctAnswer || "").toLowerCase().trim()
        if (rawAns === "false" || rawAns === "f" || rawAns === "option b" || rawAns.includes("false")) {
          correctAnswer = "False"
        } else {
          correctAnswer = "True"
        }
      } else if (formatType === "mcq_multi") {
        options = Array.isArray(q.options) && q.options.length >= 4
          ? q.options.slice(0, 4).map(normalizeGeneratedText)
          : Array.isArray(q.options) && q.options.length > 0
          ? q.options.map(normalizeGeneratedText)
          : ["Option A", "Option B", "Option C", "Option D"]

        while (options.length < 4) {
          options.push(`Option ${String.fromCharCode(65 + options.length)}`)
        }

        // Parse multiple correct choices
        let multiCorrect: string[] = []
        if (Array.isArray(q.correctAnswer)) {
          multiCorrect = q.correctAnswer.map((a: any) => String(a).trim()).filter(Boolean)
        } else if (typeof q.correctAnswer === "string") {
          const raw = q.correctAnswer.trim()
          if (raw.startsWith("[") && raw.endsWith("]")) {
            try {
              const p = JSON.parse(raw)
              if (Array.isArray(p)) multiCorrect = p.map((a: any) => String(a).trim()).filter(Boolean)
            } catch {}
          }
          if (multiCorrect.length === 0) {
            const letterMatches = raw.match(/\b([A-D])\b/g)
            if (letterMatches && letterMatches.length > 0) {
              multiCorrect = Array.from(new Set(letterMatches))
            } else {
              multiCorrect = raw.split(/,|\band\b|&/i).map((s: string) => s.trim()).filter(Boolean)
            }
          }
        }

        const normalizedLetters: string[] = []
        for (const item of multiCorrect) {
          const clean = item.replace(/[\(\)\[\]]/g, "").replace(/^option\s*/i, "").trim().toUpperCase()
          if (["A", "B", "C", "D"].includes(clean)) {
            if (!normalizedLetters.includes(clean)) normalizedLetters.push(clean)
          } else {
            const optIdx = options.findIndex(o => o.toLowerCase() === item.toLowerCase())
            if (optIdx >= 0) {
              const letCode = String.fromCharCode(65 + optIdx)
              if (!normalizedLetters.includes(letCode)) normalizedLetters.push(letCode)
            }
          }
        }

        correctAnswer = normalizedLetters.length > 0 ? normalizedLetters : ["A", "C"]
      } else {
        options = Array.isArray(q.options) && q.options.length >= 4
          ? q.options.slice(0, 4).map(normalizeGeneratedText)
          : Array.isArray(q.options) && q.options.length > 0
          ? q.options.map(normalizeGeneratedText)
          : ["Option A", "Option B", "Option C", "Option D"]

        while (options.length < 4) {
          options.push(`Option ${String.fromCharCode(65 + options.length)}`)
        }

        correctAnswer = normalizeGeneratedText(q.correctAnswer || options[0])
        if (!options.includes(correctAnswer)) {
          correctAnswer = options[0]
        }
      }

      const matchedBlueprint = activeBlueprintFormats.find((b: any) => b.id === formatType)
      const assignedMarks = matchedBlueprint && Number(matchedBlueprint.marks) > 0
        ? Number(matchedBlueprint.marks)
        : Number(q.marks) || (isDescriptive ? 5 : marksPerQuestion)

      const questionImage = normalizeGeneratedText(q.questionImage || q.diagramSvg || q.image || "")

      return {
        id: `pyq_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 7)}`,
        type: isDescriptive ? "descriptive" : isTF ? "truefalse" : isAR ? "assertion" : isFIB ? "fillblanks" : "mcq",
        questionFormat: formatType,
        questionText,
        questionImage: questionImage || undefined,
        difficulty: ["easy", "medium", "hard"].includes(q.difficulty) ? q.difficulty : "medium",
        marks: assignedMarks,
        negativeMark: isDescriptive ? 0 : Number(q.negativeMark ?? negativeMarks),
        options,
        correctAnswer,
        explanation: normalizeGeneratedText(q.explanation || (isDescriptive ? "Comprehensive scoring rubric outlining essential theoretical derivation and steps." : "No explanation provided.")),
        chapter: String(q.chapter || chaptersArray[0] || "General"),
        pyqReference: String(q.pyqReference || `${exam} PYQ Trend`),
        wordLimit: isDescriptive ? Number(q.wordLimit) || 200 : undefined,
      }
    }

    // Collect raw items per format
    const poolByFormat: Record<string, any[]> = {
      mcq: [],
      diagram: [],
      assertion: [],
      fib: [],
      true_false: [],
      descriptive: [],
    }

    let totalParsed = 0
    let lastError: string | null = null

    if (stream) {
      const encoder = new TextEncoder()
      const readable = new ReadableStream({
        async start(controller) {
          const send = (payload: unknown) => {
            try {
              controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`))
            } catch {}
          }

          // Active heartbeat prevents Vercel idle connection drop
          const heartbeat = setInterval(() => {
            send({ type: "ping" })
          }, 2000)

          const producedByFormat: Record<string, number> = {
            mcq: 0,
            diagram: 0,
            assertion: 0,
            fib: 0,
            true_false: 0,
            descriptive: 0,
          }
          const requiredByFormat: Record<string, number> = {
            mcq: activeBlueprintFormats.length > 0 ? 0 : count,
            diagram: 0,
            assertion: 0,
            fib: 0,
            true_false: 0,
            descriptive: 0,
          }
          if (activeBlueprintFormats.length > 0) {
            for (const fmt of activeBlueprintFormats) {
              requiredByFormat[fmt.id] = Number(fmt.count) || 0
            }
          }

          let totalSent = 0

          const takeQuestions = (rawItems: any[], formatId: string) => {
            const required = requiredByFormat[formatId] ?? count
            const room = Math.max(0, required - (producedByFormat[formatId] || 0))
            const batch: any[] = []
            for (const raw of rawItems) {
              if (batch.length >= room) break
              const questionText = normalizeGeneratedText(raw.questionText || "Question")
              const normalizedText = questionText.toLowerCase().replace(/[^a-z0-9]/g, "")
              if (!normalizedText || seenTexts.has(normalizedText)) continue
              seenTexts.add(normalizedText)
              batch.push(formatSingleQuestion(raw, totalSent + batch.length, formatId))
            }
            producedByFormat[formatId] = (producedByFormat[formatId] || 0) + batch.length
            totalSent += batch.length
            return batch
          }

          try {
            await Promise.all(chunkPromises.map(async (promise) => {
              try {
                const value = await promise
                const parsed = robustJsonParse(value.text)
                if (!Array.isArray(parsed)) return
                const batch = takeQuestions(parsed, value.formatId)
                if (batch.length > 0) send({ type: "batch", questions: batch })
              } catch (taskErr: any) {
                lastError = taskErr?.message || "Task failed"
                console.warn("[CompetitiveAI] Stream task failed:", lastError)
              }
            }))

            const formatsToFill = activeBlueprintFormats.length > 0
              ? activeBlueprintFormats.map((fmt: any) => fmt.id)
              : ["mcq"]

            for (const formatId of formatsToFill) {
              const required = requiredByFormat[formatId] || 0
              const deficit = required - (producedByFormat[formatId] || 0)
              if (deficit <= 0) continue
              try {
                const topUpPrompt = `Generate exactly ${deficit} authentic, unique Previous Years Questions (PYQs) for ${exam} (${subject}) on: ${chaptersList}.

${formatDirectives[formatId] || formatDirectives.mcq}

Ensure all generated questions have "questionFormat": "${formatId}".
Return raw JSON array ONLY.`
                const topUpRes = await generateContentWithKeyRotation({
                  payload: {
                    contents: [{ parts: [{ text: `${systemInstruction}\n\nTask: ${topUpPrompt}` }] }],
                    generationConfig: { temperature: 0.4, responseMimeType: "application/json" },
                  },
                  timeoutMs: 10000,
                })
                const topUpParsed = robustJsonParse(topUpRes.text)
                if (Array.isArray(topUpParsed)) {
                  const batch = takeQuestions(topUpParsed, formatId)
                  if (batch.length > 0) send({ type: "batch", questions: batch })
                }
              } catch (topUpErr: any) {
                console.warn(`[CompetitiveAI] Stream top-up for ${formatId} skipped: ${topUpErr?.message || topUpErr}`)
              }
            }

            if (totalSent === 0) {
              send({ type: "error", error: lastError || "Failed to generate questions. Please click Create Questions again." })
            } else {
              send({ type: "done", count: totalSent })
            }
          } catch (streamErr: any) {
            send({ type: "error", error: streamErr?.message || "Failed to generate questions." })
          } finally {
            clearInterval(heartbeat)
            controller.close()
          }
        },
      })

      return new Response(readable, {
        headers: {
          "Content-Type": "application/x-ndjson; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          "X-Accel-Buffering": "no",
        },
      })
    }

    const settledChunks = await Promise.allSettled(chunkPromises)

    for (let i = 0; i < settledChunks.length; i++) {
      const res = settledChunks[i]
      if (res.status === "fulfilled") {
        try {
          const parsed = robustJsonParse(res.value.text)
          const assignedFormat = res.value.formatId
          if (Array.isArray(parsed)) {
            totalParsed += parsed.length
            for (const item of parsed) {
              if (poolByFormat[assignedFormat]) {
                poolByFormat[assignedFormat].push(item)
              } else {
                poolByFormat.mcq.push(item)
              }
            }
          }
        } catch (pErr: any) {
          console.warn(`[CompetitiveAI] Task ${i + 1} JSON parse warning:`, pErr.message)
        }
      } else {
        lastError = res.reason?.message || "Task failed"
        console.warn(`[CompetitiveAI] Task ${i + 1} failed:`, lastError)
      }
    }

    if (totalParsed === 0) {
      console.error("[CompetitiveAI] All tasks failed. Last error:", lastError)
      return NextResponse.json(
        { error: lastError || "Failed to generate questions. Please verify your internet or click Generate again." },
        { status: 502 }
      )
    }

    const finalQuestions: any[] = []

    // Strictly satisfy each active format's exact count
    if (activeBlueprintFormats.length > 0) {
      for (const fmt of activeBlueprintFormats) {
        const requiredCount = Number(fmt.count) || 0
        if (requiredCount <= 0) continue

        const rawList = poolByFormat[fmt.id] || []
        const formattedList: any[] = []

        for (const raw of rawList) {
          const questionText = normalizeGeneratedText(raw.questionText || "Question")
          const normalizedText = questionText.toLowerCase().replace(/[^a-z0-9]/g, "")
          if (seenTexts.has(normalizedText)) continue
          seenTexts.add(normalizedText)

          formattedList.push(formatSingleQuestion(raw, finalQuestions.length + formattedList.length, fmt.id))
          if (formattedList.length >= requiredCount) break
        }

        // Fast top-up if deficit exists for this specific format
        if (formattedList.length < requiredCount) {
          const deficit = requiredCount - formattedList.length
          console.log(`[CompetitiveAI] Deficit for ${fmt.id}: got ${formattedList.length}/${requiredCount}, topping up ${deficit}...`)
          try {
            const topUpPrompt = `Generate exactly ${deficit} authentic, unique Previous Years Questions (PYQs) for ${exam} (${subject}) on: ${chaptersList}.

${formatDirectives[fmt.id] || formatDirectives.mcq}

Ensure all generated questions have "questionFormat": "${fmt.id}".
Return raw JSON array ONLY.`

            const topUpRes = await generateContentWithKeyRotation({
              payload: {
                contents: [{ parts: [{ text: `${systemInstruction}\n\nTask: ${topUpPrompt}` }] }],
                generationConfig: { temperature: 0.4, responseMimeType: "application/json" }
              },
              timeoutMs: 10000
            })
            const topUpParsed = robustJsonParse(topUpRes.text)
            if (Array.isArray(topUpParsed)) {
              for (const raw of topUpParsed) {
                const questionText = normalizeGeneratedText(raw.questionText || "Question")
                const normalizedText = questionText.toLowerCase().replace(/[^a-z0-9]/g, "")
                if (!seenTexts.has(normalizedText)) {
                  seenTexts.add(normalizedText)
                  formattedList.push(formatSingleQuestion(raw, finalQuestions.length + formattedList.length, fmt.id))
                  if (formattedList.length >= requiredCount) break
                }
              }
            }
          } catch (tErr: any) {
            console.warn(`[CompetitiveAI] Top-up for ${fmt.id} skipped: ${tErr?.message || tErr}`)
          }
        }

        // Enforce exact count for this format
        finalQuestions.push(...formattedList.slice(0, requiredCount))
      }
    } else {
      const allRaw = Object.values(poolByFormat).flat()
      for (const raw of allRaw) {
        const questionText = normalizeGeneratedText(raw.questionText || "Question")
        const normalizedText = questionText.toLowerCase().replace(/[^a-z0-9]/g, "")
        if (seenTexts.has(normalizedText)) continue
        seenTexts.add(normalizedText)
        finalQuestions.push(formatSingleQuestion(raw, finalQuestions.length, raw.questionFormat || undefined))
        if (finalQuestions.length >= count) break
      }
    }

    return NextResponse.json({
      success: true,
      count: finalQuestions.length,
      questions: finalQuestions,
    })
  } catch (err: any) {
    console.error("[GenerateCompetitiveQuestions] Error:", err)
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 })
  }
}
