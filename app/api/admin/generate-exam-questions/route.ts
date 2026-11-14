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
      subject = "General",
      grade = "General",
      difficulty = "medium",
      additionalPrompt = "",
      blueprint = { mcq: 5, truefalse: 3, descriptive: 2, fillblanks: 3 },
      defaultMarks = { mcq: 4, truefalse: 2, descriptive: 5, fillblanks: 2 },
    } = body as {
      topic: string
      subject?: string
      grade?: string
      difficulty?: string
      additionalPrompt?: string
      blueprint?: QuestionBlueprint
      defaultMarks?: DefaultMarks
    }

    if (!topic || !topic.trim()) {
      return NextResponse.json({ error: "Topic is required for question generation" }, { status: 400 })
    }

    const mcqCount = Math.max(0, Number(blueprint.mcq) || 0)
    const tfCount = Math.max(0, Number(blueprint.truefalse) || 0)
    const descCount = Math.max(0, Number(blueprint.descriptive) || 0)
    const fibCount = Math.max(0, Number(blueprint.fillblanks) || 0)
    const totalCount = mcqCount + tfCount + descCount + fibCount

    if (totalCount === 0) {
      return NextResponse.json({ error: "Please select at least 1 question to generate" }, { status: 400 })
    }

    if (totalCount > 40) {
      return NextResponse.json({ error: "Maximum 40 questions can be generated per batch" }, { status: 400 })
    }

    const keys = getGeminiApiKeys()
    if (keys.length === 0) {
      return NextResponse.json({ error: "No Gemini API keys configured in .env" }, { status: 500 })
    }

    const mcqMarks = Number(defaultMarks.mcq) || 4
    const tfMarks = Number(defaultMarks.truefalse) || 2
    const descMarks = Number(defaultMarks.descriptive) || 5
    const fibMarks = Number(defaultMarks.fillblanks) || 2

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
   - "correctAnswer": String that matches one of the 4 options EXACTLY character-for-character.
   - "explanation": Concise, conceptual step-by-step solution.
2. For "truefalse":
   - "questionText": A clear, unambiguous statement.
   - "correctAnswer": Strictly either "True" or "False".
   - "explanation": Why the statement is true or false.
3. For "descriptive":
   - "questionText": Conceptual or analytical prompt testing deep understanding.
   - "wordLimit": Realistic word limit (e.g. "50-100 words" or "100-150 words").
   - "modelAnswer": Ideal sample answer meeting all requirements.
   - "rubric": Array of 3 to 4 specific evaluation bullet points (e.g. ["Clear definition provided", "Key equation cited", "Relevant application example"]).
4. For "fillblanks":
   - "questionText": The sentence containing the blank. MUST contain '______' (six underscores) representing the missing word or phrase.
   - "blanks": Array with an object: [{ "answer": "Primary Answer", "alsoAccept": ["synonym1", "variant2"] }].
   - "caseInsensitive": true.

Mathematical & Scientific Notation:
For any mathematical formula, chemical reaction, unit, or scientific expression, you MUST use standard LaTeX math syntax (e.g. $F = ma$, $\\frac{a}{b}$, $\\sqrt{x^2 + y^2}$, $\\theta$, $H_2SO_4$).

Output Format:
Return ONLY a valid, parseable JSON object with a single "questions" array. No markdown code blocks, no text before or after the JSON.
{
  "questions": [
    {
      "type": "mcq",
      "questionText": "...",
      "difficulty": "easy" | "medium" | "hard",
      "marks": ${mcqMarks},
      "negativeMark": 1,
      "options": ["A", "B", "C", "D"],
      "correctAnswer": "A",
      "explanation": "..."
    },
    {
      "type": "truefalse",
      "questionText": "...",
      "difficulty": "easy" | "medium" | "hard",
      "marks": ${tfMarks},
      "negativeMark": 0,
      "correctAnswer": "True",
      "explanation": "..."
    },
    {
      "type": "descriptive",
      "questionText": "...",
      "difficulty": "easy" | "medium" | "hard",
      "marks": ${descMarks},
      "wordLimit": "100-150 words",
      "modelAnswer": "...",
      "rubric": ["Criterion 1", "Criterion 2", "Criterion 3"]
    },
    {
      "type": "fillblanks",
      "questionText": "The unit of force is ______.",
      "difficulty": "easy" | "medium" | "hard",
      "marks": ${fibMarks},
      "blanks": [{ "answer": "Newton", "alsoAccept": ["newton", "N"] }],
      "caseInsensitive": true
    }
  ]
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

    // Format & validate questions
    const formattedQuestions = parsed.questions.map((q: any, idx: number) => {
      const qType = ["mcq", "truefalse", "descriptive", "fillblanks"].includes(q.type) ? q.type : "mcq"
      const diff = ["easy", "medium", "hard"].includes(q.difficulty) ? q.difficulty : "medium"
      const id = `gen_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 7)}`

      if (qType === "mcq") {
        const rawOptions = Array.isArray(q.options) && q.options.length >= 2 ? q.options.slice(0, 4) : ["Option A", "Option B", "Option C", "Option D"]
        while (rawOptions.length < 4) {
          rawOptions.push(`Option ${String.fromCharCode(65 + rawOptions.length)}`)
        }
        let correct = String(q.correctAnswer || rawOptions[0]).trim()
        if (!rawOptions.includes(correct)) {
          const matched = rawOptions.find((o: string) => o.toLowerCase() === correct.toLowerCase())
          correct = matched || rawOptions[0]
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
      let text = String(q.questionText || "Fill in the blank ______.").trim()
      if (!text.includes("______")) {
        text += " ______"
      }
      let blanksArr = Array.isArray(q.blanks) && q.blanks.length > 0
        ? q.blanks.map((b: any) => ({
            answer: String(b?.answer || "").trim() || "answer",
            alsoAccept: Array.isArray(b?.alsoAccept) ? b.alsoAccept.map(String) : [],
          }))
        : [{ answer: "answer", alsoAccept: [] }]

      return {
        id,
        type: "fillblanks" as const,
        questionText: text,
        difficulty: diff,
        marks: Number(q.marks) || fibMarks,
        blanks: blanksArr,
        caseInsensitive: q.caseInsensitive !== false,
      }
    })

    return NextResponse.json({
      success: true,
      count: formattedQuestions.length,
      questions: formattedQuestions,
    })
  } catch (err: any) {
    console.error("[generate-exam-questions] Error:", err)
    return NextResponse.json(
      { error: err?.message || "Internal server error during question generation" },
      { status: 500 }
    )
  }
}

