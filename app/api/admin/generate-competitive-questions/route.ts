import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { robustJsonParse } from "@/lib/jsonRepair"

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

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "GEMINI_API_KEY is not configured in .env" }, { status: 500 })
    }

    const activeBlueprintFormats = Array.isArray(blueprintFormats)
      ? blueprintFormats.filter((f: any) => f.checked && (Number(f.count) > 0))
      : []

    const blueprintSummary = activeBlueprintFormats.length > 0
      ? activeBlueprintFormats.map((f: any) => `- ${f.label} (${f.id}): ${f.count} questions, ${f.marks} marks each`).join("\n")
      : ""

    const count = Math.min(Math.max(Number(questionCount) || 5, 1), 30)
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

    const userPrompt = `Generate ${count} authentic, non-repeating Previous Years Questions (PYQs) / most asked questions for ${exam} (${subject}) on chapters: ${chaptersList}. Focus on highest-frequency repeated patterns. Difficulty: ${difficulty}.`

    const models = ["gemini-3.5-flash-lite", "gemini-flash-latest", "gemini-3.8-flash", "gemini-flash-lite-latest", "gemini-2.5-flash"]
    let lastError: any = null
    let responseText = ""

    for (const model of models) {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: `${systemInstruction}\n\nTask: ${userPrompt}` }
                ]
              }
            ],
            generationConfig: {
              temperature: 0.35,
              responseMimeType: "application/json",
            }
          })
        })

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          lastError = errData?.error?.message || `HTTP ${res.status}`
          console.warn(`[CompetitiveAI] Model ${model} failed:`, lastError)
          continue
        }

        const data = await res.json()
        responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || ""
        if (responseText) break
      } catch (err: any) {
        lastError = err?.message || "Fetch error"
      }
    }

    if (!responseText) {
      return NextResponse.json({ error: lastError || "Failed to generate questions from AI model" }, { status: 502 })
    }

    let questions: any[]
    try {
      questions = robustJsonParse(responseText)
    } catch (parseErr: any) {
      console.error("[CompetitiveAI] JSON parse failed:", parseErr.message, "Response preview:", responseText.slice(0, 300))
      return NextResponse.json(
        { error: `Failed to parse AI response: ${parseErr.message}. Please click Generate again.` },
        { status: 500 }
      )
    }

    if (!Array.isArray(questions)) {
      return NextResponse.json({ error: "Invalid response format received from AI" }, { status: 500 })
    }

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
