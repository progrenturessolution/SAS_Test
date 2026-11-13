import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { robustJsonParse } from "@/lib/jsonRepair"
import { generateContentWithKeyRotation, getGeminiApiKeys } from "@/lib/gemini"

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

    const keys = getGeminiApiKeys()
    if (keys.length === 0) {
      return NextResponse.json({ error: "No Gemini API keys configured in .env" }, { status: 500 })
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

    let responseText = ""
    try {
      const result = await generateContentWithKeyRotation({
        payload: {
          contents: [{
            parts: [{ text: `${systemInstruction}\n\nProblem Request: ${prompt}` }]
          }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json"
          }
        },
        timeoutMs: 25000
      })
      responseText = result.text
    } catch (aiErr: any) {
      console.error("[GenerateCodingQuestion] Gemini pool error:", aiErr)
      return NextResponse.json({ error: aiErr?.message || "Failed to generate from Gemini AI" }, { status: 502 })
    }

    if (!responseText) {
      return NextResponse.json({ error: "Empty response received from Gemini AI" }, { status: 502 })
    }

    const parsed = robustJsonParse(responseText)

    return NextResponse.json({ success: true, data: parsed })
  } catch (err: any) {
    console.error("[GenerateCodingQuestion] Error:", err)
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 })
  }
}
