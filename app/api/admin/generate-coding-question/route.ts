import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { robustJsonParse } from "@/lib/jsonRepair"

export async function POST(req: Request) {
  try {
    const session = await getSession(req)
    const canGenerateCoding = session && (
      ["super_admin", "admin", "institute", "coaching_institute"].includes(session.role) ||
      Boolean(session.instituteId)
    )
    if (!canGenerateCoding) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { prompt, languages = ["Python", "Java", "C++", "JavaScript"] } = await req.json()
    if (!prompt || !prompt.trim()) {
      return NextResponse.json({ error: "Problem description or title is required" }, { status: 400 })
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "GEMINI_API_KEY is not configured in .env" }, { status: 500 })
    }

    const langsList = Array.isArray(languages) && languages.length > 0 
      ? languages.join(", ") 
      : "Python, Java, C++, JavaScript"

    const systemInstruction = `
You are an expert programming exam problem designer.
Given a user request or problem title, generate a complete, professional LeetCode-style coding question.
Return ONLY valid raw JSON (no markdown fences, no extra text outside the JSON).
The JSON must follow this exact structure:
{
  "title": string,
  "difficulty": "easy" | "medium" | "hard",
  "questionText": string (clear problem statement with Examples and Constraints in markdown),
  "constraints": string[],
  "codeTemplates": {
    "python": string (class Solution with solve method),
    "java": string (public class Solution with solve method),
    "javascript": string (class Solution with solve method),
    "cpp": string (class Solution with solve method)
  },
  "testCases": [
    { "input": string, "expectedOutput": string, "hidden": boolean }
  ]
}

Rules:
1. Provide codeTemplates for these languages: ${langsList}.
2. Each template MUST use a class named Solution and a method named solve(...).
3. In testCases, each parameter is on a separate line in "input".
4. Provide at least 2 visible test cases (hidden: false) and 2 hidden test cases (hidden: true).
5. Make sure "expectedOutput" is formatted cleanly (e.g. true / false, or [0, 1], or numeric/string output matching the problem).
6. Do NOT include markdown code fences (\`\`\`json) in the response. Return raw JSON only.
`

    // Correct, live Gemini model names in priority order
    const models = [
      "gemini-2.0-flash",
      "gemini-1.5-flash",
      "gemini-2.0-flash-lite",
      "gemini-1.5-flash-8b",
    ]
    let lastError: any = null
    let responseText = ""

    for (const model of models) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 25000)

        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [{
              parts: [{ text: `${systemInstruction}\n\nProblem Request: ${prompt}` }]
            }],
            generationConfig: {
              temperature: 0.2,
              responseMimeType: "application/json"
            }
          })
        })
        clearTimeout(timeoutId)

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          lastError = errData?.error?.message || `HTTP ${res.status}`
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
      return NextResponse.json({ error: lastError || "Failed to generate from Gemini AI" }, { status: 502 })
    }

    const parsed = robustJsonParse(responseText)

    return NextResponse.json({ success: true, data: parsed })
  } catch (err: any) {
    console.error("[GenerateCodingQuestion] Error:", err)
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 })
  }
}
