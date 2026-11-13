import { NextResponse } from "next/server"
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

    if (session.instituteId) {
      const Institute = (await import("@/models/Institute")).default
      const inst = await Institute.findById(session.instituteId).lean()
      if (inst && inst.limits?.features?.neetJeeGenerator === false) {
        return NextResponse.json(
          { error: "NEET / JEE / MHT-CET Question Studio is not enabled in your institute plan. Please contact support." },
          { status: 403 }
        )
      }
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
    } = body

    if (session.instituteId) {
      const Institute = (await import("@/models/Institute")).default
      const inst = await Institute.findById(session.instituteId).select("limits").lean()
      const examType = String(exam)
      if (inst && inst.limits?.features?.neetJeeGenerator === false) {
        return NextResponse.json(
          { error: "NEET / JEE / MHT-CET Question Studio is not enabled for your institute." },
          { status: 403 }
        )
      }
      const allowedExamTypes = Array.isArray(inst?.limits?.examTypes)
        ? inst.limits.examTypes.map((type) => String(type).trim().toUpperCase())
        : ["NEET", "JEE_MAIN", "JEE_ADVANCED", "MHT_CET", "CBSE_BOARD", "CUSTOM"]
      if (!allowedExamTypes.includes(examType.trim().toUpperCase())) {
        return NextResponse.json(
          { error: `Your institute does not have access to ${String(exam).replaceAll("_", " ")} question generation.` },
          { status: 403 }
        )
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

    const blueprintSummary = activeBlueprintFormats.length > 0
      ? activeBlueprintFormats.map((f: any) => `- ${f.label} (${f.id}): ${f.count} questions, ${f.marks} marks each`).join("\n")
      : ""

    const count = Math.min(Math.max(Number(questionCount) || 5, 1), 45)
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

    const systemInstruction = `
You are a senior National Examination Paper Setter and competitive entrance examination researcher specializing in NTA NEET (UG), JEE Main, JEE Advanced, and State MHT-CET.
Your task is to generate ${count} authentic examination questions for the specified chapter(s): ${chaptersList}.
${topicsList ? `SPECIFIC TOPICS / CONCEPTS TO FOCUS ON: ${topicsList}\n` : ""}
${syllabusText ? `UPLOADED SYLLABUS / STUDY MATERIAL EXTRACT:\n${syllabusText.substring(0, 4000)}\n(CRITICAL INSTRUCTION: Formulate questions directly testing the above uploaded syllabus material!)\n` : ""}

CORE REQUIREMENT 1: PREVIOUS YEARS QUESTIONS (PYQs) & MOST FREQUENTLY ASKED CONCEPTS:
- Base the questions directly on real Previous Years Questions (PYQs) from NEET (2015-2024), JEE Main (2018-2025), JEE Advanced, and MHT-CET, or the most frequently asked, highest-yield repeated question models from these chapters.
- Ensure the questions reflect actual questions asked by NTA and State boards.
- For each question, provide an authentic "pyqReference" tag (e.g. "NEET 2023", "NEET 2021 (Repeated Pattern)", "JEE Main 2024 Shift 1", "JEE Main 2022", "MHT-CET 2022", "High Frequency PYQ").

CORE REQUIREMENT 2: ABSOLUTE ZERO REPETITION / NEVER DUPLICATE:
- DO NOT REPEAT ANY QUESTIONS. Every single question generated MUST test a distinct concept, different formula, different calculation, or different scientific phenomenon.
- Never generate two questions with similar numerical values, phrasing, or identical problem statements.
${existingListText ? `- STRICT: DO NOT REPEAT OR DUPLICATE ANY OF THESE PREVIOUSLY GENERATED QUESTIONS:\n${existingListText}\n` : ""}

EXAMINATION TARGET: ${exam}
CLASS / GRADE: Class ${grade === "both" ? "11 & 12 (Full Syllabus)" : grade}
SUBJECT: ${subject}
CHAPTERS COVERED: ${chaptersList}
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
  - Always write matrices with standard LaTeX matrix environments: $\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}$, $\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}$, or $\\begin{vmatrix} a & b \\\\ c & d \\end{vmatrix}$.
  - Use double backslashes for row breaks in the matrix (e.g. \\\\).
  - In the JSON output, escape all backslashes properly so row separation is written as double backslashes in JSON strings.
  - Never collapse matrix rows into a single row.
- Physics formulas must preserve vectors, cross/dot products, units, tensors, angles, constants, signs, powers, subscripts, and scientific notation: $\\vec{v}$, $\\vec{\\tau} = \\vec{r} \\times \\vec{F}$, $\\Delta x$, $\\theta$, $\\omega$, $9.8\\,\\mathrm{m\\,s^{-2}}$, $6.02\\times10^{23}$.
- Chemistry formulas must preserve subscripts, superscript charges, oxidation states, equilibrium arrows, states, and conditions: $2\\mathrm{H_2}+\\mathrm{O_2}\\rightarrow2\\mathrm{H_2O}$, $\\mathrm{SO_4^{2-}}$, $\\mathrm{NH_4^+}$, $\\rightleftharpoons$, $\\xrightarrow{\\Delta}$.
- Biology formulas and genetics notation must use LaTeX too: $p^2+2pq+q^2=1$, $\\mathrm{Aa}\\times\\mathrm{Aa}$, $\\mathrm{ATP}\\rightarrow\\mathrm{ADP}+\\mathrm{P_i}$.
- Never write raw Unicode replacement characters or programming escape sequences for formulas. Never remove backslashes from LaTeX commands.
- Options must be distinct, plausible choices (labeled without "A)" prefixes, just the clear option text).
- "correctAnswer" must match one of the options EXACTLY.
- "explanation" must provide a thorough step-by-step solution, the formula used, and derivation with full LaTeX formatting.
- CRITICAL JSON ESCAPING: In the JSON output, escape all LaTeX backslashes properly (e.g. write "\\alpha", "\\frac{a}{b}", "\\vec{v}", "\\theta", "\\Delta", "\\begin{bmatrix}..." with escaped backslashes in JSON strings).

OUTPUT FORMAT:
Return ONLY a valid JSON array of question objects (no markdown code blocks, no intro, no extra text).
[
  {
    "id": string (unique identifier like "pyq_1"),
    "type": "mcq",
    "questionFormat": "mcq" | "assertion" | "fib" | "true_false",
    "questionText": string (clear question statement with proper LaTeX formatting),
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

    // Decide number of parallel chunks based on count and number of keys in pool
    const numChunks = count <= 6 
      ? 1 
      : Math.min(Math.max(Math.ceil(count / 9), 2), keys.length, 4)

    // Calculate question counts per chunk (e.g. 30 -> [10, 10, 10]; 25 -> [9, 8, 8])
    const baseCount = Math.floor(count / numChunks)
    const remainder = count % numChunks
    const chunkCounts = Array.from({ length: numChunks }, (_, i) => baseCount + (i < remainder ? 1 : 0))

    const chunkFoci = [
      "Core definitions, fundamental formula application, direct laws, and introductory PYQ patterns",
      "Numerical calculation problems, variable relationships, graphical analysis, and standard entrance examination models",
      "Conceptual derivations, Assertion-Reason statements, fill-in-the-blanks, and multi-concept PYQ problems",
      "Advanced analytical synthesis, tricky edge cases, and high-yield repeat questions from recent entrance exams",
    ]

    console.log(`[CompetitiveAI] Generating ${count} questions across ${numChunks} parallel chunks using ${keys.length} API keys in pool...`)

    // Dispatch all chunks simultaneously across the key pool
    const chunkPromises = chunkCounts.map(async (chunkSize, chunkIdx) => {
      const focusText = chunkFoci[chunkIdx % chunkFoci.length]
      
      // If multiple chapters were selected, distribute them across chunks for comprehensive coverage
      let chunkChapters = chaptersList
      if (chaptersArray.length > 1) {
        const assigned = chaptersArray.filter((_, idx) => idx % numChunks === chunkIdx)
        if (assigned.length > 0) {
          chunkChapters = assigned.join(", ")
        }
      }

      const chunkPrompt = `Generate exactly ${chunkSize} authentic, distinct, non-repeating Previous Years Questions (PYQs) for ${exam} (${subject}) on: ${chunkChapters}.
Batch Focus (${chunkIdx + 1}/${numChunks}): ${focusText}.
Ensure all ${chunkSize} questions are completely unique and test different concepts. Return raw JSON array ONLY.`

      const result = await generateContentWithKeyRotation({
        payload: {
          contents: [
            {
              parts: [
                { text: `${systemInstruction}\n\nTask: ${chunkPrompt}` }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.35 + (chunkIdx * 0.05), // Slight temperature variation for diversity
            responseMimeType: "application/json",
          }
        },
        timeoutMs: 40000
      })

      return result.text
    })

    const settledChunks = await Promise.allSettled(chunkPromises)
    const parsedQuestions: any[] = []
    let lastError: string | null = null

    for (let i = 0; i < settledChunks.length; i++) {
      const res = settledChunks[i]
      if (res.status === "fulfilled") {
        try {
          const parsed = robustJsonParse(res.value)
          if (Array.isArray(parsed)) {
            parsedQuestions.push(...parsed)
          }
        } catch (pErr: any) {
          console.warn(`[CompetitiveAI] Chunk ${i + 1} JSON parse warning:`, pErr.message)
        }
      } else {
        lastError = res.reason?.message || "Chunk generation failed"
        console.warn(`[CompetitiveAI] Chunk ${i + 1} failed:`, lastError)
      }
    }

    if (parsedQuestions.length === 0) {
      console.error("[CompetitiveAI] All parallel generation chunks failed. Last error:", lastError)
      return NextResponse.json(
        { error: lastError || "Failed to generate questions. Please verify your internet or click Generate again." },
        { status: 502 }
      )
    }

    const questions: any[] = parsedQuestions

    // Set of seen texts to prevent duplicate questions within the batch and existing
    const seenTexts = new Set(
      Array.isArray(existingQuestions)
        ? existingQuestions.map((t: string) => String(t).toLowerCase().replace(/[^a-z0-9]/g, ""))
        : []
    )

    const formattedQuestions: any[] = []

    for (let idx = 0; idx < questions.length; idx++) {
      const q = questions[idx]
      const normalizeGeneratedText = (value: unknown) =>
        String(value || "")
          .replace(/\u000c/g, "\\frac")
          .replace(/\u0008/g, "\\b")
          .trim()
      const questionText = normalizeGeneratedText(q.questionText || "Question")
      const normalizedText = questionText.toLowerCase().replace(/[^a-z0-9]/g, "")

      // Deduplication check: skip if identical question was already generated
      if (seenTexts.has(normalizedText)) {
        continue
      }
      seenTexts.add(normalizedText)

      const rawFormat = String(q.questionFormat || q.type || "").toLowerCase().trim()
      const isTF =
        rawFormat === "true_false" ||
        rawFormat === "truefalse" ||
        rawFormat === "tf" ||
        questionText.toLowerCase().startsWith("true or false") ||
        questionText.toLowerCase().startsWith("true/false")

      const formatType = isTF
        ? "true_false"
        : ["mcq", "assertion", "fib"].includes(rawFormat)
        ? rawFormat
        : "mcq"

      let options: string[] = []
      let correctAnswer = ""

      if (formatType === "true_false") {
        options = ["True", "False"]
        const rawAns = String(q.correctAnswer || "").toLowerCase().trim()
        if (rawAns === "false" || rawAns === "f" || rawAns === "option b" || rawAns.includes("false")) {
          correctAnswer = "False"
        } else {
          correctAnswer = "True"
        }
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

      formattedQuestions.push({
        id: `pyq_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 7)}`,
        type: "mcq",
        questionFormat: formatType,
        questionText,
        difficulty: ["easy", "medium", "hard"].includes(q.difficulty) ? q.difficulty : "medium",
        marks: Number(q.marks) || marksPerQuestion,
        negativeMark: Number(q.negativeMark ?? negativeMarks),
        options,
        correctAnswer,
        explanation: normalizeGeneratedText(q.explanation || "No explanation provided."),
        chapter: String(q.chapter || chapters[0] || "General"),
        pyqReference: String(q.pyqReference || `${exam} PYQ Trend`),
      })
    }

    return NextResponse.json({
      success: true,
      count: formattedQuestions.length,
      questions: formattedQuestions,
    })
  } catch (err: any) {
    console.error("[GenerateCompetitiveQuestions] Error:", err)
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 })
  }
}
