import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { robustJsonParse } from "@/lib/jsonRepair"
import { generateContentWithKeyRotation, getGeminiApiKeys } from "@/lib/gemini"

interface QuestionBlueprint {
  mcq?: number
  truefalse?: number
  descriptive?: number
  fillblanks?: number
}

interface DefaultMarks {
  mcq?: number
  truefalse?: number
  descriptive?: number
  fillblanks?: number
}

interface TopicItem {
  topic: string
  count: number
}

export async function POST(req: Request) {
  try {
    const session = await getSession(req)
    const canGenerate = session && (
      ["super_admin", "admin", "institute", "coaching_institute"].includes(session.role) ||
      Boolean(session.instituteId)
    )
    if (!canGenerate) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 })
    }

    const body = await req.json()
    const {
      topic,
      topics,
      questionType,
      count,
      subject = "General",
      grade = "General",
      difficulty = "medium",
      marks,
      negativeMark,
      additionalPrompt = "",
      blueprint,
      defaultMarks,
    } = body as {
      topic?: string
      topics?: TopicItem[]
      questionType?: "mcq" | "truefalse" | "fillblanks" | "descriptive"
      count?: number
      subject?: string
      grade?: string
      difficulty?: string
      marks?: number
      negativeMark?: number
      additionalPrompt?: string
      blueprint?: QuestionBlueprint
      defaultMarks?: DefaultMarks
    }

    const keys = getGeminiApiKeys()
    if (keys.length === 0) {
      return NextResponse.json({ error: "No Gemini API keys configured in .env" }, { status: 500 })
    }

    // ─── Mode A: Single Question Type (from Modal AI Generator) ─────────────
    if (questionType) {
      // Normalize topics list
      let parsedTopics: TopicItem[] = []
      if (Array.isArray(topics) && topics.length > 0) {
        parsedTopics = topics
          .map(t => ({ topic: String(t.topic || "").trim(), count: Math.max(1, Number(t.count) || 1) }))
          .filter(t => Boolean(t.topic))
      } else if (topic && topic.trim()) {
        parsedTopics = [{ topic: topic.trim(), count: Math.max(1, Number(count) || 1) }]
      }

      if (parsedTopics.length === 0) {
        return NextResponse.json({ error: "At least one topic is required" }, { status: 400 })
      }

      const totalCount = parsedTopics.reduce((s, t) => s + t.count, 0)
      if (totalCount > 40) {
        return NextResponse.json({ error: "Maximum 40 questions can be generated at once" }, { status: 400 })
      }

      const qMarks = Number(marks) || (questionType === "mcq" ? 4 : questionType === "descriptive" ? 5 : 2)
      const qNegMark = typeof negativeMark === "number" ? negativeMark : (questionType === "mcq" ? 1 : 0)

      let typeSpecificPrompt = ""
      if (questionType === "mcq") {
        typeSpecificPrompt = `
Generate exactly ${totalCount} Multiple Choice Questions (type: "mcq").
Rules:
- "questionText": Clear, unambiguous conceptual or problem-solving question. Use LaTeX math for equations (e.g. $F = ma$, $\\frac{a}{b}$).
- "options": Array of exactly 4 plausible distinct choices.
- "correctAnswer": Must be strictly one of "A", "B", "C", or "D" corresponding to the index (0=A, 1=B, 2=C, 3=D) of the correct choice in the "options" array.
- "explanation": Concise conceptual explanation of the answer.
- "difficulty": "${difficulty}"
- "marks": ${qMarks}
- "negativeMark": ${qNegMark}
`
      } else if (questionType === "truefalse") {
        typeSpecificPrompt = `
Generate exactly ${totalCount} True/False Questions (type: "truefalse").
Rules:
- "questionText": A clear statement that is definitively true or false.
- "correctAnswer": Strictly either "True" or "False".
- "explanation": Brief explanation of why the statement is true or false.
- "difficulty": "${difficulty}"
- "marks": ${qMarks}
- "negativeMark": ${qNegMark}
`
      } else if (questionType === "fillblanks") {
        typeSpecificPrompt = `
Generate exactly ${totalCount} Fill in the Blanks Questions (type: "fillblanks").
Rules:
- "questionText": A sentence containing '___' (3 underscores) at the position where the student should fill the answer. Example: "Water boils at ___ degrees Celsius at sea level."
- "blanks": Array of objects: [{ "answer": "100", "alsoAccept": ["100°C", "hundred"] }]
- "caseInsensitive": true
- "difficulty": "${difficulty}"
- "marks": ${qMarks}
- "negativeMark": ${qNegMark}
`
      } else {
        typeSpecificPrompt = `
Generate exactly ${totalCount} Descriptive Questions (type: "descriptive").
Rules:
- "questionText": Thoughtful descriptive question prompt testing analytical understanding.
- "wordLimit": Realistic word limit, e.g. "100-150 words".
- "modelAnswer": Comprehensive sample answer.
- "rubric": Array of 3-4 evaluation criteria.
- "difficulty": "${difficulty}"
- "marks": ${qMarks}
- "negativeMark": 0
`
      }

      const instructionsPrompt = `
You are an expert examination question author and academic curriculum designer.
Generate exactly ${totalCount} high-quality ${questionType.toUpperCase()} questions based on the requested topics.

Topic Breakdown:
${parsedTopics.map((t, i) => `- Topic ${i + 1}: "${t.topic}" (Generate exactly ${t.count} question${t.count > 1 ? "s" : ""})`).join("\n")}

Subject: "${subject}"
Grade Level: "${grade}"
Target Difficulty: "${difficulty}"
${additionalPrompt?.trim() ? `Additional Instructions: "${additionalPrompt.trim()}"` : ""}

${typeSpecificPrompt}

Mathematical & Scientific Notation:
For any math, physics, or chemistry equation, use standard LaTeX math syntax (e.g. $E = mc^2$, $\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$).

Output Format:
Return ONLY a valid, parseable JSON object with a single "questions" array. No markdown code blocks, no text before or after the JSON.
{
  "questions": [ ... ]
}
`.trim()

      const geminiResult = await generateContentWithKeyRotation({
        payload: {
          contents: [
            {
              role: "user",
              parts: [{ text: instructionsPrompt }],
            },
          ],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 8192,
            responseMimeType: "application/json",
          },
        },
        timeoutMs: 25000,
      })

      const parsed = robustJsonParse<{ questions?: any[] }>(geminiResult.text)
      if (!parsed || !Array.isArray(parsed.questions) || parsed.questions.length === 0) {
        return NextResponse.json(
          { error: "AI could not generate questions for this topic. Please try with a clearer topic name." },
          { status: 502 }
        )
      }

      const formattedQuestions = parsed.questions.map((q: any, idx: number) => {
        const id = `gen_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 7)}`
        const diff = ["easy", "medium", "hard"].includes(q.difficulty) ? q.difficulty : difficulty

        if (questionType === "mcq") {
          const rawOptions = Array.isArray(q.options) && q.options.length >= 2
            ? q.options.slice(0, 4)
            : ["Option A", "Option B", "Option C", "Option D"]
          while (rawOptions.length < 4) {
            rawOptions.push(`Option ${String.fromCharCode(65 + rawOptions.length)}`)
          }
          let correct = String(q.correctAnswer || "A").trim().toUpperCase()
          if (!["A", "B", "C", "D"].includes(correct)) {
            // If answer was returned as full text, find matching index
            const matchedIdx = rawOptions.findIndex((o: string) => o.toLowerCase() === String(q.correctAnswer).toLowerCase())
            correct = matchedIdx >= 0 ? String.fromCharCode(65 + matchedIdx) : "A"
          }
          return {
            id,
            type: "mcq" as const,
            questionText: String(q.questionText || "").trim(),
            difficulty: diff,
            marks: qMarks,
            negativeMark: qNegMark,
            options: rawOptions.map(String),
            correctAnswer: correct,
            explanation: String(q.explanation || "").trim(),
          }
        }

        if (questionType === "truefalse") {
          const rawAns = String(q.correctAnswer || "True").toLowerCase()
          const correct = rawAns.includes("false") ? "False" : "True"
          return {
            id,
            type: "truefalse" as const,
            questionText: String(q.questionText || "").trim(),
            difficulty: diff,
            marks: qMarks,
            negativeMark: qNegMark,
            correctAnswer: correct as "True" | "False",
            explanation: String(q.explanation || "").trim(),
          }
        }

        if (questionType === "fillblanks") {
          let text = String(q.questionText || "").trim()
          if (!text.includes("___")) {
            text += " ___"
          }
          const blanks = Array.isArray(q.blanks) && q.blanks.length > 0
            ? q.blanks.map((b: any) => ({
                answer: String(b.answer || "").trim(),
                alsoAccept: Array.isArray(b.alsoAccept) ? b.alsoAccept.map(String) : [],
              }))
            : [{ answer: "correct answer", alsoAccept: [] }]
          return {
            id,
            type: "fillblanks" as const,
            questionText: text,
            difficulty: diff,
            marks: qMarks,
            negativeMark: qNegMark,
            blanks,
            caseInsensitive: true,
          }
        }

        // Descriptive
        const rubricArr = Array.isArray(q.rubric) && q.rubric.length > 0
          ? q.rubric.map(String)
          : ["Clear conceptual explanation", "Accurate terms and formulas", "Logical conclusion"]
        return {
          id,
          type: "descriptive" as const,
          questionText: String(q.questionText || "").trim(),
          difficulty: diff,
          marks: qMarks,
          negativeMark: 0,
          wordLimit: String(q.wordLimit || "100-150 words"),
          modelAnswer: String(q.modelAnswer || "").trim(),
          rubric: rubricArr,
        }
      })

      return NextResponse.json({
        success: true,
        count: formattedQuestions.length,
        questions: formattedQuestions,
      })
    }

    // ─── Mode B: Legacy Blueprint Mode (Multi-Format) ───────────────────────
    if (!topic || !topic.trim()) {
      return NextResponse.json({ error: "Topic is required for question generation" }, { status: 400 })
    }

    const bp = blueprint || { mcq: 5, truefalse: 3, descriptive: 2, fillblanks: 3 }
    const dm = defaultMarks || { mcq: 4, truefalse: 2, descriptive: 5, fillblanks: 2 }

    const mcqCount = Math.max(0, Number(bp.mcq) || 0)
    const tfCount = Math.max(0, Number(bp.truefalse) || 0)
    const descCount = Math.max(0, Number(bp.descriptive) || 0)
    const fibCount = Math.max(0, Number(bp.fillblanks) || 0)
    const totalCount = mcqCount + tfCount + descCount + fibCount

    if (totalCount === 0) {
      return NextResponse.json({ error: "Please select at least 1 question to generate" }, { status: 400 })
    }

    if (totalCount > 40) {
      return NextResponse.json({ error: "Maximum 40 questions can be generated per batch" }, { status: 400 })
    }

    const mcqMarks = Number(dm.mcq) || 4
    const tfMarks = Number(dm.truefalse) || 2
    const descMarks = Number(dm.descriptive) || 5
    const fibMarks = Number(dm.fillblanks) || 2

    const instructionsPrompt = `
You are an expert examination problem author and academic curriculum designer.
Generate exactly the requested number of high-quality questions on the specified topic.

Target Topic: "${topic.trim()}"
Subject: "${subject}"
Grade Level: "${grade}"
Target Difficulty: "${difficulty}"
${additionalPrompt?.trim() ? `Additional Instructions: "${additionalPrompt.trim()}"` : ""}

Requested Question Breakdown:
${mcqCount > 0 ? `- Exactly ${mcqCount} Multiple Choice Questions (type: "mcq", marks: ${mcqMarks})` : ""}
${tfCount > 0 ? `- Exactly ${tfCount} True/False Questions (type: "truefalse", marks: ${tfMarks})` : ""}
${descCount > 0 ? `- Exactly ${descCount} Descriptive Questions (type: "descriptive", marks: ${descMarks})` : ""}
${fibCount > 0 ? `- Exactly ${fibCount} Fill in the Blanks Questions (type: "fillblanks", marks: ${fibMarks})` : ""}

Rules for each format:
1. For "mcq":
   - "options": Array of exactly 4 plausible, distinct choices.
   - "correctAnswer": Must be strictly "A", "B", "C", or "D".
   - "explanation": Concise, conceptual step-by-step solution.
2. For "truefalse":
   - "questionText": A clear, unambiguous statement.
   - "correctAnswer": Strictly either "True" or "False".
   - "explanation": Why the statement is true or false.
3. For "descriptive":
   - "questionText": Conceptual or analytical prompt testing deep understanding.
   - "wordLimit": Realistic word limit (e.g. "50-100 words" or "100-150 words").
   - "modelAnswer": Ideal sample answer meeting all requirements.
   - "rubric": Array of 3 to 4 specific evaluation bullet points.
4. For "fillblanks":
   - "questionText": Sentence containing '___' (3 underscores) for the blank.
   - "blanks": Array of objects: [{ "answer": "Primary Answer", "alsoAccept": ["synonym1"] }]
   - "caseInsensitive": true.

Mathematical & Scientific Notation:
For any mathematical formula or scientific expression, use standard LaTeX math syntax (e.g. $F = ma$, $\\frac{a}{b}$, $H_2SO_4$).

Output Format:
Return ONLY a valid, parseable JSON object with a single "questions" array.
{
  "questions": [ ... ]
}
`.trim()

    const geminiResult = await generateContentWithKeyRotation({
      payload: {
        contents: [
          {
            role: "user",
            parts: [{ text: instructionsPrompt }],
          },
        ],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 8192,
          responseMimeType: "application/json",
        },
      },
      timeoutMs: 25000,
    })

    const parsed = robustJsonParse<{ questions?: any[] }>(geminiResult.text)
    if (!parsed || !Array.isArray(parsed.questions) || parsed.questions.length === 0) {
      return NextResponse.json(
        { error: "AI could not parse the requested questions. Please retry with a more specific topic." },
        { status: 502 }
      )
    }

    const formattedQuestions = parsed.questions.map((q: any, idx: number) => {
      const qType = ["mcq", "truefalse", "descriptive", "fillblanks"].includes(q.type) ? q.type : "mcq"
      const diff = ["easy", "medium", "hard"].includes(q.difficulty) ? q.difficulty : "medium"
      const id = `gen_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 7)}`

      if (qType === "mcq") {
        const rawOptions = Array.isArray(q.options) && q.options.length >= 2 ? q.options.slice(0, 4) : ["Option A", "Option B", "Option C", "Option D"]
        while (rawOptions.length < 4) {
          rawOptions.push(`Option ${String.fromCharCode(65 + rawOptions.length)}`)
        }
        let correct = String(q.correctAnswer || "A").trim().toUpperCase()
        if (!["A", "B", "C", "D"].includes(correct)) {
          const matchedIdx = rawOptions.findIndex((o: string) => o.toLowerCase() === String(q.correctAnswer).toLowerCase())
          correct = matchedIdx >= 0 ? String.fromCharCode(65 + matchedIdx) : "A"
        }
        return {
          id,
          type: "mcq" as const,
          questionText: String(q.questionText || "Question text").trim(),
          difficulty: diff,
          marks: Number(q.marks) || mcqMarks,
          negativeMark: Number(q.negativeMark) || 1,
          options: rawOptions.map(String),
          correctAnswer: correct,
          explanation: String(q.explanation || "").trim(),
        }
      }

      if (qType === "truefalse") {
        const correct = String(q.correctAnswer).toLowerCase().includes("false") ? "False" : "True"
        return {
          id,
          type: "truefalse" as const,
          questionText: String(q.questionText || "Question statement").trim(),
          difficulty: diff,
          marks: Number(q.marks) || tfMarks,
          negativeMark: Number(q.negativeMark) || 0,
          correctAnswer: correct as "True" | "False",
          explanation: String(q.explanation || "").trim(),
        }
      }

      if (qType === "descriptive") {
        const rubricArr = Array.isArray(q.rubric) && q.rubric.length > 0
          ? q.rubric.map(String)
          : ["Accurate technical explanation", "Key terms defined", "Clear reasoning"]
        return {
          id,
          type: "descriptive" as const,
          questionText: String(q.questionText || "Descriptive prompt").trim(),
          difficulty: diff,
          marks: Number(q.marks) || descMarks,
          wordLimit: String(q.wordLimit || "100-150 words"),
          modelAnswer: String(q.modelAnswer || "").trim(),
          rubric: rubricArr,
        }
      }

      // fillblanks
      let text = String(q.questionText || "The unit is ___.").trim()
      if (!text.includes("___")) {
        text += " ___"
      }
      const blanks = Array.isArray(q.blanks) && q.blanks.length > 0
        ? q.blanks.map((b: any) => ({
            answer: String(b.answer || "").trim(),
            alsoAccept: Array.isArray(b.alsoAccept) ? b.alsoAccept.map(String) : [],
          }))
        : [{ answer: "Answer", alsoAccept: [] }]
      return {
        id,
        type: "fillblanks" as const,
        questionText: text,
        difficulty: diff,
        marks: Number(q.marks) || fibMarks,
        negativeMark: Number(q.negativeMark) || 0,
        blanks,
        caseInsensitive: true,
      }
    })

    return NextResponse.json({
      success: true,
      topic,
      count: formattedQuestions.length,
      questions: formattedQuestions,
    })
  } catch (error) {
    console.error("Exam question generation error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate questions with AI" },
      { status: 500 }
    )
  }
}
