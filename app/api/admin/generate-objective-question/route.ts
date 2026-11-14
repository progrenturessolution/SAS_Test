import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { robustJsonParse } from "@/lib/jsonRepair"
import { generateContentWithKeyRotation, getGeminiApiKeys } from "@/lib/gemini"

export const maxDuration = 120

export async function POST(req: Request) {
  try {
    const session = await getSession(req)
    const canGenerate = session && (
      ["super_admin", "admin", "institute", "coaching_institute"].includes(session.role) ||
      Boolean(session.instituteId)
    )
    if (!canGenerate) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { prompt, topics, type = "mcq", marks = 1, difficulty = "medium" } = await req.json()
    const requestedTopics = Array.isArray(topics)
      ? topics.filter((item: any) => typeof item.topic === "string" && item.topic.trim() && Number(item.count) > 0).slice(0, 10)
      : []
    const isBulk = requestedTopics.length > 0
    const totalQuestions = isBulk
      ? requestedTopics.reduce((sum: number, item: any) => sum + Math.min(60, Math.floor(Number(item.count) || 1)), 0)
      : 1

    const effectivePrompt = isBulk
      ? requestedTopics.map((item: any, index: number) => `${index + 1}. ${item.topic.trim()} — generate ${Math.min(60, Math.floor(Number(item.count)))} questions`).join("\n")
      : prompt

    if (!isBulk && (typeof prompt !== "string" || !prompt.trim())) {
      return NextResponse.json({ error: "Topic or question prompt is required" }, { status: 400 })
    }
    if (type !== "mcq" && type !== "truefalse" && type !== "fillblanks") {
      return NextResponse.json({ error: "Unsupported objective question type" }, { status: 400 })
    }

    const keys = getGeminiApiKeys()
    if (keys.length === 0) {
      return NextResponse.json({ error: "GEMINI_API_KEY is not configured" }, { status: 500 })
    }

    const shape = type === "mcq"
      ? `{"questionText":"string","options":["string","string","string","string"],"correctAnswer":"A","explanation":"string"}`
      : type === "truefalse"
        ? `{"questionText":"string","correctAnswer":"True","explanation":"string"}`
        : `{"questionText":"string containing one or more ___ blank markers","blanks":[{"answer":"string","alsoAccept":["string"]}]}`

    const questionKind = type === "mcq"
      ? "multiple-choice question with exactly four options"
      : type === "truefalse"
        ? "clear true/false statement"
        : "fill-in-the-blanks question with one or more blank markers"

    const promptText = `You are an expert exam question writer. Create ${isBulk ? "the requested questions for every topic below" : `one ${questionKind}`}.
Topic/request:
${effectivePrompt.trim()}
Difficulty: ${difficulty}
Marks: ${Number(marks) || 1}

Return only valid JSON ${isBulk ? `as an array, with each item in this exact shape: ${shape}` : `in this exact shape: ${shape}`}
For MCQ, correctAnswer must be exactly one of A, B, C, or D and options must be distinct.
For True/False, correctAnswer must be exactly True or False.
For Fill in the Blanks, questionText must contain one ___ marker for every item in blanks. Return the answers in the same order as the markers.
For any mathematical formula or scientific notation, use standard LaTeX math syntax (e.g. $F = ma$, $\\frac{a}{b}$, $H_2SO_4$).
Avoid ambiguous wording, trick questions, duplicate options, markdown headings, and markdown code fences.`

    const timeoutMs = Math.min(120_000, Math.max(20_000, totalQuestions * 2500))

    const geminiResult = await generateContentWithKeyRotation({
      payload: {
        contents: [
          {
            role: "user",
            parts: [{ text: promptText }],
          },
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 8192,
          responseMimeType: "application/json",
        },
      },
      timeoutMs,
    })

    const parsed = robustJsonParse<any>(geminiResult.text)
    if (!parsed) {
      throw new Error("Gemini returned invalid JSON")
    }

    const items = isBulk ? (Array.isArray(parsed) ? parsed : (parsed.questions || [parsed])) : (Array.isArray(parsed) ? parsed : [parsed])
    if (!Array.isArray(items) || items.length === 0) throw new Error("Gemini returned no questions")

    const validItems = []
    for (const item of items) {
      if (typeof item.questionText !== "string" || !item.questionText.trim()) continue

      if (type === "mcq") {
        if (item.options && !Array.isArray(item.options) && typeof item.options === "object") {
          item.options = ["A", "B", "C", "D"].map((k) => item.options[k]).filter(Boolean)
        }
        if (!Array.isArray(item.options) || item.options.length < 2) continue
        while (item.options.length < 4) item.options.push(`Option ${item.options.length + 1}`)
        item.options = item.options.slice(0, 4)

        if (typeof item.correctAnswer === "number") {
          const map: Record<number, string> = { 0: "A", 1: "B", 2: "C", 3: "D" }
          item.correctAnswer = map[item.correctAnswer] ?? "A"
        }
        if (typeof item.correctAnswer === "string") {
          const match = item.correctAnswer.trim().toUpperCase().match(/([A-D])/)
          if (match) item.correctAnswer = match[1]
        }
        if (!["A", "B", "C", "D"].includes(item.correctAnswer)) item.correctAnswer = "A"
      }

      if (type === "truefalse") {
        if (typeof item.correctAnswer === "boolean") {
          item.correctAnswer = item.correctAnswer ? "True" : "False"
        } else if (typeof item.correctAnswer === "string") {
          item.correctAnswer = item.correctAnswer.trim().toLowerCase() === "false" ? "False" : "True"
        } else {
          item.correctAnswer = "True"
        }
      }

      if (type === "fillblanks") {
        if (!Array.isArray(item.blanks) || item.blanks.length === 0) {
          item.blanks = [{ answer: "answer", alsoAccept: [] }]
        } else {
          item.blanks = item.blanks.filter((b: any) => typeof b.answer === "string" && b.answer.trim())
          if (item.blanks.length === 0) {
            item.blanks = [{ answer: "answer", alsoAccept: [] }]
          }
        }
      }

      validItems.push(item)
    }

    if (validItems.length === 0) throw new Error("Gemini returned no valid questions. Please try again.")
    return NextResponse.json({ success: true, data: isBulk ? validItems : validItems[0] })
  } catch (error) {
    console.error("[GenerateObjectiveQuestion] Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate question" },
      { status: 500 }
    )
  }
}
