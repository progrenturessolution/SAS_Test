import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { robustJsonParse } from "@/lib/jsonRepair"
import { generateContentWithKeyRotation, getGeminiApiKeys } from "@/lib/gemini"

async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  // Method 1: unpdf
  try {
    const { extractText } = await import("unpdf")
    const { text } = await extractText(new Uint8Array(buffer))
    const fullText = Array.isArray(text) ? text.join("\n") : (text || "")
    if (fullText && fullText.trim().length > 0) {
      return fullText
    }
  } catch (err) {
    console.warn("[unpdf] extraction warning:", err)
  }

  // Method 2: pdf-parse
  try {
    // @ts-ignore
    const pdfParse = (await import("pdf-parse")).default
    const pdfBuffer = Buffer.alloc(buffer.length)
    buffer.copy(pdfBuffer)
    const parsed = await pdfParse(pdfBuffer)
    if (parsed && parsed.text) return parsed.text
  } catch (err) {
    console.warn("[pdf-parse] extraction warning:", err)
  }

  return ""
}

export async function POST(req: Request) {
  try {
    const session = await getSession(req)
    const canParsePdf = session && (
      ["super_admin", "admin", "institute", "coaching_institute"].includes(session.role) ||
      Boolean(session.instituteId)
    )
    if (!canParsePdf) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json({ error: "No PDF file provided" }, { status: 400 })
    }

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "Uploaded file must be a PDF" }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const srcBuffer = Buffer.from(arrayBuffer)
    const rawText = await extractTextFromPDF(srcBuffer)

    if (!rawText || rawText.trim().length === 0) {
      return NextResponse.json({
        error: "Could not extract readable text from this PDF. Please make sure the PDF has selectable text (not scanned images).",
      }, { status: 400 })
    }

    const cleanedText = rawText.replace(/\r/g, " ").replace(/\t/g, " ").replace(/\s+/g, " ").trim()
    const snippet = cleanedText.substring(0, 6000)

    // Analyze extracted text using Gemini to find chapters and key topics
    const keys = getGeminiApiKeys()
    let detectedChapters: string[] = []
    let detectedTopics: string[] = []

    if (keys.length > 0) {
      const prompt = `Analyze this extracted syllabus or study material text and identify:
1. "chapters": list of 1 to 5 main chapter or unit names.
2. "topics": list of 3 to 10 specific topics or concepts mentioned in this text.

Return ONLY raw JSON with format:
{
  "chapters": ["Chapter 1", "Chapter 2"],
  "topics": ["Topic A", "Topic B", "Topic C"]
}

TEXT:
${snippet.substring(0, 3000)}`

      try {
        const result = await generateContentWithKeyRotation({
          payload: {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.1, responseMimeType: "application/json" }
          },
          timeoutMs: 20000
        })

        if (result.text) {
          const parsed = robustJsonParse(result.text)
          if (parsed && Array.isArray(parsed.chapters)) detectedChapters = parsed.chapters
          if (parsed && Array.isArray(parsed.topics)) detectedTopics = parsed.topics
        }
      } catch (err: any) {
        console.warn("[ParseSyllabusPdf] Gemini key pool warning:", err?.message)
      }
    }

    return NextResponse.json({
      success: true,
      fileName: file.name,
      fileSize: file.size,
      wordCount: cleanedText.split(/\s+/).length,
      detectedChapters,
      detectedTopics,
      extractedText: snippet,
    })
  } catch (err: any) {
    console.error("[ParseSyllabusPdf] Error:", err)
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 })
  }
}
