import { NextResponse } from "next/server"

// Judge0 CE via RapidAPI
const JUDGE0_URL = process.env.JUDGE0_URL || "https://judge0-ce.p.rapidapi.com"
const JUDGE0_KEY = process.env.JUDGE0_KEY || ""

// Judge0 language IDs: https://ce.judge0.com/languages
const LANG_MAP: Record<string, { id: number; name: string }> = {
  python:     { id: 71, name: "Python (3.8.1)" },
  javascript: { id: 63, name: "JavaScript (Node.js 12.14.0)" },
  typescript: { id: 74, name: "TypeScript (3.7.4)" },
  java:       { id: 62, name: "Java (OpenJDK 13.0.1)" },
  cpp:        { id: 54, name: "C++ (GCC 9.2.0)" },
  c:          { id: 50, name: "C (GCC 9.2.0)" },
  go:         { id: 60, name: "Go (1.13.5)" },
  rust:       { id: 73, name: "Rust (1.40.0)" },
}

async function pollResult(token: string): Promise<Record<string, unknown>> {
  const maxAttempts = 20
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 1500))
    const res = await fetch(
      `${JUDGE0_URL}/submissions/${token}?base64_encoded=true&fields=stdout,stderr,compile_output,status,exit_code,time,memory`,
      {
        method: "GET",
        headers: {
          "X-RapidAPI-Key": JUDGE0_KEY,
          "X-RapidAPI-Host": "judge0-ce.p.rapidapi.com",
        },
      }
    )
    if (!res.ok) continue
    const data = await res.json()
    // Status id <= 2 means "In Queue" or "Processing"
    if (data.status?.id <= 2) continue
    return data
  }
  throw new Error("Execution timed out")
}

function decodeBase64(str: string | null | undefined): string {
  if (!str) return ""
  try {
    return Buffer.from(str, "base64").toString("utf-8")
  } catch {
    return str
  }
}

export async function POST(req: Request) {
  try {
    const { code, language, stdin = "" } = await req.json()

    if (!code || !language) {
      return NextResponse.json({ error: "code and language are required" }, { status: 400 })
    }

    if (!JUDGE0_KEY) {
      return NextResponse.json({ error: "Judge0 API key is not configured" }, { status: 500 })
    }

    const lang = LANG_MAP[language.toLowerCase()]
    if (!lang) {
      return NextResponse.json(
        { error: `Unsupported language: ${language}. Supported: ${Object.keys(LANG_MAP).join(", ")}` },
        { status: 400 }
      )
    }

    // Submit to Judge0
    const submitRes = await fetch(`${JUDGE0_URL}/submissions?base64_encoded=true&wait=false`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-RapidAPI-Key": JUDGE0_KEY,
        "X-RapidAPI-Host": "judge0-ce.p.rapidapi.com",
      },
      body: JSON.stringify({
        language_id: lang.id,
        source_code: Buffer.from(code).toString("base64"),
        stdin: stdin ? Buffer.from(stdin).toString("base64") : "",
        cpu_time_limit: 5,
        memory_limit: 128000,
      }),
    })

    if (!submitRes.ok) {
      const text = await submitRes.text()
      console.error("[Judge0] Submit error:", submitRes.status, text)
      return NextResponse.json({ error: "Code execution service error" }, { status: 502 })
    }

    const { token } = await submitRes.json()
    if (!token) {
      return NextResponse.json({ error: "Failed to create submission" }, { status: 502 })
    }

    // Poll for result
    const result = await pollResult(token)

    const stdout = decodeBase64(result.stdout as string)
    const stderr = decodeBase64(result.stderr as string)
    const compileOutput = decodeBase64(result.compile_output as string)

    return NextResponse.json({
      stdout,
      stderr,
      compile_output: compileOutput,
      exit_code: result.exit_code ?? 0,
      language: lang.name,
      time: result.time,
      memory: result.memory,
    })
  } catch (err) {
    console.error("[Judge0] Code run error:", err)
    const message = err instanceof Error ? err.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
