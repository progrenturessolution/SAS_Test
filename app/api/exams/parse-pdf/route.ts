import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"

// Regex patterns to detect question types and extract content
const MCQ_OPTION_RE = /^(?:\(|\[)?([A-Ea-e])(?:\)|\]|\.)\s*(.+)$/
const ANSWER_LINE_RE = /^(?:correct\s*answer|correct|answer|ans)\s*[:=-]\s*([A-Ea-e])/i
const BLANK_RE = /_{2,}/g
const TRUE_FALSE_RE = /\b(true|false)\b/i
const QUESTION_NUMBER_RE = /^(?:Q(?:uestion)?\.?\s*)?(\d+)\s*[.):-]\s*(.*)/i

interface ExtractedQuestion {
  type: "mcq" | "truefalse" | "descriptive" | "fillblanks"
  questionText: string
  difficulty: "easy" | "medium" | "hard"
  marks: number
  options?: string[]
  correctAnswer?: string
  explanation?: string
  blanks?: { answer: string; alsoAccept: string[] }[]
  caseInsensitive?: boolean
  wordLimit?: string
  modelAnswer?: string
  rubric?: string[]
}

function detectDifficulty(text: string): "easy" | "medium" | "hard" {
  const lower = text.toLowerCase()
  if (lower.includes("[hard]") || lower.includes("(hard)") || lower.includes("difficulty: hard")) return "hard"
  if (lower.includes("[easy]") || lower.includes("(easy)") || lower.includes("difficulty: easy")) return "easy"
  return "medium"
}

function detectMarks(text: string): number {
  const match = text.match(/\[(\d+)\s*marks?\]/i) || text.match(/\((\d+)\s*marks?\)/i)
  return match ? parseInt(match[1]) : 1
}

function extractMCQOptions(lines: string[]): { options: string[]; correctAnswer: string } {
  const options: string[] = []
  let correctAnswer = ""
  for (const line of lines) {
    const m = line.match(MCQ_OPTION_RE)
    if (m) {
      let opt = m[2]
        .replace(/\s*\*\s*$/, "")
        .replace(/^\*\s*/, "")
        .replace(/\s*\(correct\)\s*$/i, "")
        .replace(/\s*\[correct\]\s*$/i, "")
        .replace(/\s*âœ“\s*$/g, "")
        .replace(/\s*✓\s*$/g, "")
        .trim()

      const isCorrect =
        line.includes("*") ||
        line.includes("âœ“") ||
        line.includes("✓") ||
        line.includes("[correct]") ||
        line.toLowerCase().includes("(correct)")

      options.push(opt)
      const optionLetter = m[1].toUpperCase()
      if (isCorrect && !correctAnswer) correctAnswer = optionLetter
    }
  }

  // Secondary check: look for an explicit answer line in the question block (e.g. Answer: B, Correct: C)
  if (!correctAnswer) {
    for (const line of lines) {
      const ansMatch = line.match(ANSWER_LINE_RE)
      if (ansMatch) {
        correctAnswer = ansMatch[1].toUpperCase()
        break
      }
    }
  }

  return { options, correctAnswer: correctAnswer || (options.length > 0 ? "A" : "") }
}

async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  // Method 1: unpdf (Modern PDF.js wrapper, handles PDF 1.7/2.0 streams & XRef cleanly)
  try {
    const { extractText } = await import("unpdf")
    const { text } = await extractText(new Uint8Array(buffer))
    const fullText = Array.isArray(text) ? text.join("\n") : (text || "")
    if (fullText && fullText.trim().length > 0) {
      return fullText
    }
  } catch (unpdfErr) {
    console.warn("[unpdf] Direct extraction warning:", unpdfErr)
  }

  // Method 2: Fallback to pdf-parse with un-pooled Buffer
  try {
    // @ts-ignore - pdf-parse doesn't have type definitions
    const pdfParse = (await import("pdf-parse")).default
    const pdfBuffer = Buffer.alloc(buffer.length)
    buffer.copy(pdfBuffer)
    const parsed = await pdfParse(pdfBuffer)
    if (parsed && parsed.text) return parsed.text
  } catch (pdfParseErr) {
    console.warn("[pdf-parse] Fallback parse warning:", pdfParseErr)
  }

  return ""
}

export async function POST(req: Request) {
  const session = await getSession(req)
  const canImportQuestions = session && (
    ["admin", "institute", "super_admin", "coaching_institute"].includes(session.role) ||
    Boolean(session.instituteId)
  )
  if (!canImportQuestions) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (session.instituteId) {
    const Institute = (await import("@/models/Institute")).default
    const institute = await Institute.findById(session.instituteId).select("limits").lean()
    if (institute?.limits?.features?.pdfImport === false) {
      return NextResponse.json({ error: "PDF Paper Import is not enabled for this institute." }, { status: 403 })
    }
  }

  try {
    const formData = await req.formData()
    const file = formData.get("file") as File | null
    if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 })
    if (file.type !== "application/pdf") return NextResponse.json({ error: "File must be a PDF" }, { status: 400 })

    const arrayBuffer = await file.arrayBuffer()
    const srcBuffer = Buffer.from(arrayBuffer)
    const pdfBuffer = Buffer.alloc(srcBuffer.length)
    srcBuffer.copy(pdfBuffer)
    
    const text = await extractTextFromPDF(pdfBuffer)

    if (!text || text.trim().length === 0) {
      return NextResponse.json({ error: "No text could be extracted from this PDF. Make sure it is a text-based PDF." }, { status: 400 })
    }

    // Split into lines
    const rawLines = text.split("\n").map((l: string) => l.trim()).filter(Boolean)

    // Filter out decorative divider lines (e.g. ===, ---)
    const lines = rawLines.filter(l => !/^[=\-_]{3,}$/.test(l))

    const questions: ExtractedQuestion[] = []
    let currentLines: string[] = []
    let inQuestion = false

    const processBlock = (block: string[]) => {
      if (block.length === 0) return
      const fullText = block.join(" ")
      const marks = detectMarks(fullText)
      const difficulty = detectDifficulty(fullText)
      
      // Question prompt lines are ONLY the lines BEFORE options start
      const firstOptionIdx = block.findIndex(l => MCQ_OPTION_RE.test(l))
      const rawQuestionLines = firstOptionIdx !== -1 ? block.slice(0, firstOptionIdx) : block.filter(l => !MCQ_OPTION_RE.test(l) && !ANSWER_LINE_RE.test(l))
      const questionLines = rawQuestionLines.filter(l => !ANSWER_LINE_RE.test(l))
      const cleanText = questionLines
        .join("\n")
        .replace(/\[.*?\]/g, "")
        .replace(/\(.*?marks?\)/gi, "")
        .trim()

      if (!cleanText) return

      // Detect Fill in Blanks
      if (BLANK_RE.test(fullText)) {
        const blanksCount = (fullText.match(BLANK_RE) || []).length
        questions.push({
          type: "fillblanks",
          questionText: cleanText,
          difficulty, marks,
          blanks: Array.from({ length: blanksCount }, () => ({ answer: "", alsoAccept: [] })),
          caseInsensitive: true,
        })
        return
      }

      // Detect True/False
      const isTF = TRUE_FALSE_RE.test(fullText) && (fullText.toLowerCase().includes("true or false") || fullText.toLowerCase().includes("true/false"))
      if (isTF) {
        questions.push({
          type: "truefalse",
          questionText: cleanText,
          difficulty, marks,
          correctAnswer: "True",
          explanation: "",
        })
        return
      }

      // Detect MCQ (has A. B. C. D. options)
      const optionLines = block.filter(l => MCQ_OPTION_RE.test(l))
      if (optionLines.length >= 2) {
        const { options, correctAnswer } = extractMCQOptions(block)
        questions.push({
          type: "mcq",
          questionText: cleanText,
          difficulty, marks,
          options: options.length > 0 ? options : ["", "", "", ""],
          correctAnswer,
          explanation: "",
        })
        return
      }

      // Default: Descriptive
      questions.push({
        type: "descriptive",
        questionText: cleanText,
        difficulty, marks,
        wordLimit: "",
        modelAnswer: "",
        rubric: [],
      })
    }

    for (const line of lines) {
      const isNewQuestion = QUESTION_NUMBER_RE.test(line)
      if (isNewQuestion) {
        if (inQuestion && currentLines.length > 0) processBlock(currentLines)
        const m = line.match(QUESTION_NUMBER_RE)
        currentLines = [m ? m[2] : line]
        inQuestion = true
      } else if (inQuestion) {
        currentLines.push(line)
      }
    }
    if (inQuestion && currentLines.length > 0) processBlock(currentLines)

    // Fallback: if no numbered questions found, try splitting by blank lines
    if (questions.length === 0) {
      const blocks = text.split(/\n{2,}/).map((b: string) => b.trim()).filter((b: string) => b.length > 20)
      for (const block of blocks.slice(0, 30)) {
        const blockLines = block.split("\n").map((l: string) => l.trim()).filter(Boolean)
        if (blockLines.length > 0) processBlock(blockLines)
      }
    }

    return NextResponse.json({ questions, count: questions.length })
  } catch (error) {
    console.error("[parse-pdf API] PDF parse error:", error)
    return NextResponse.json({ error: "Failed to parse PDF. Make sure it is a valid text-based PDF." }, { status: 500 })
  }
}
