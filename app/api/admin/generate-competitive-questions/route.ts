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
        if (!allowedExamTypes.includes(examType.trim().toUpperCase())) {
          return NextResponse.json(
            { error: `Your institute does not have access to ${String(exam).replaceAll("_", " ")} question generation.` },
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

    const formatDirectives: Record<string, string> = {
      mcq: `CRITICAL FORMAT REQUIREMENT:
All questions in this batch MUST be multiple-choice questions ("questionFormat": "mcq").
Provide exactly 4 distinct answer options in the "options" array.
"correctAnswer" MUST match one of the 4 options exactly.`,

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

      true_false: `CRITICAL FORMAT REQUIREMENT:
All questions in this batch MUST be True or False questions ("questionFormat": "true_false").
The "questionText" must start with "True or False: " followed by a clear conceptual statement.
The "options" array MUST be exactly ["True", "False"].
"correctAnswer" MUST be either "True" or "False".`
    }

    interface GenerationTask {
      formatId: "mcq" | "assertion" | "fib" | "true_false"
      formatLabel: string
      targetCount: number
      marks: number
    }

    const generationTasks: GenerationTask[] = []

    if (activeBlueprintFormats.length > 0) {
      for (const fmt of activeBlueprintFormats) {
        const fmtCount = Number(fmt.count) || 0
        if (fmtCount <= 0) continue

        // Small chunks return the first questions much sooner and can run on separate API keys.
        const chunkSize = 8
        const numSubChunks = Math.ceil(fmtCount / chunkSize)
        const baseSub = Math.floor(fmtCount / numSubChunks)
        const remSub = fmtCount % numSubChunks
        for (let s = 0; s < numSubChunks; s++) {
          const subCount = baseSub + (s < remSub ? 1 : 0)
          generationTasks.push({
            formatId: fmt.id,
            formatLabel: fmt.label || fmt.id,
            targetCount: subCount,
            marks: Number(fmt.marks) || marksPerQuestion,
          })
        }
      }
      } else {
      const chunkSize = 8
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

    console.log(`[CompetitiveAI] Dispatching ${generationTasks.length} format-specific tasks in parallel across ${keys.length} API keys...`)

    // Dispatch all format tasks simultaneously across the key pool with buffer to absorb deduplication
    const chunkPromises = generationTasks.map(async (task, taskIdx) => {
      const requestedCount = task.targetCount
      
      // Distribute chapters across tasks if multiple chapters exist
      let taskChapters = chaptersList
      if (chaptersArray.length > 1) {
        const assigned = chaptersArray.filter((_, idx) => idx % generationTasks.length === taskIdx)
        if (assigned.length > 0) {
          taskChapters = assigned.join(", ")
        }
      }

      const taskPrompt = `Generate exactly ${requestedCount} authentic, distinct, non-repeating Previous Years Questions (PYQs) for ${exam} (${subject}) on: ${taskChapters}.

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
        timeoutMs: 40000
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

      const isFIB =
        !isTF && !isAR && (
          forcedFormat === "fib" ||
          rawFormat === "fib" ||
          rawFormat === "fill_in_the_blanks" ||
          rawFormat === "fill-in-the-blanks" ||
          questionText.includes("______")
        )

      const formatType = isTF
        ? "true_false"
        : isAR
        ? "assertion"
        : isFIB
        ? "fib"
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

      const matchedBlueprint = activeBlueprintFormats.find((b: any) => b.id === formatType)
      const assignedMarks = matchedBlueprint && Number(matchedBlueprint.marks) > 0
        ? Number(matchedBlueprint.marks)
        : Number(q.marks) || marksPerQuestion

      return {
        id: `pyq_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 7)}`,
        type: "mcq",
        questionFormat: formatType,
        questionText,
        difficulty: ["easy", "medium", "hard"].includes(q.difficulty) ? q.difficulty : "medium",
        marks: assignedMarks,
        negativeMark: Number(q.negativeMark ?? negativeMarks),
        options,
        correctAnswer,
        explanation: normalizeGeneratedText(q.explanation || "No explanation provided."),
        chapter: String(q.chapter || chaptersArray[0] || "General"),
        pyqReference: String(q.pyqReference || `${exam} PYQ Trend`),
      }
    }

    // Collect raw items per format
    const poolByFormat: Record<string, any[]> = {
      mcq: [],
      assertion: [],
      fib: [],
      true_false: [],
    }

    let totalParsed = 0
    let lastError: string | null = null

    if (stream) {
      const encoder = new TextEncoder()
      const readable = new ReadableStream({
        async start(controller) {
          const send = (payload: unknown) => {
            controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`))
          }

          const producedByFormat: Record<string, number> = {
            mcq: 0,
            assertion: 0,
            fib: 0,
            true_false: 0,
          }
          const requiredByFormat: Record<string, number> = {
            mcq: activeBlueprintFormats.length > 0 ? 0 : count,
            assertion: 0,
            fib: 0,
            true_false: 0,
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
                  timeoutMs: 25000,
                })
                const topUpParsed = robustJsonParse(topUpRes.text)
                if (Array.isArray(topUpParsed)) {
                  const batch = takeQuestions(topUpParsed, formatId)
                  if (batch.length > 0) send({ type: "batch", questions: batch })
                }
              } catch (topUpErr) {
                console.warn(`[CompetitiveAI] Stream top-up for ${formatId} skipped:`, topUpErr)
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
              timeoutMs: 12000
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
          } catch (tErr) {
            console.warn(`[CompetitiveAI] Top-up for ${fmt.id} skipped:`, tErr)
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
        finalQuestions.push(formatSingleQuestion(raw, finalQuestions.length, "mcq"))
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
