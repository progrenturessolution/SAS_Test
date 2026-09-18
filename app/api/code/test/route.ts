import { NextResponse } from "next/server"

const JUDGE0_URL = process.env.JUDGE0_URL || "https://judge0-ce.p.rapidapi.com"
const JUDGE0_KEY = process.env.JUDGE0_KEY || ""

const LANG_MAP: Record<string, number> = {
  python: 71, javascript: 63, typescript: 74,
  java: 62, cpp: 54, c: 50, go: 60, rust: 73,
}

async function submitToJudge0(code: string, language: string, stdin: string, timeLimit: number, memoryLimit: number): Promise<string> {
  const langId = LANG_MAP[language.toLowerCase()]
  if (!langId) throw new Error(`Unsupported language: ${language}`)

  const res = await fetch(`${JUDGE0_URL}/submissions?base64_encoded=true&wait=false`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-RapidAPI-Key": JUDGE0_KEY,
      "X-RapidAPI-Host": "judge0-ce.p.rapidapi.com",
    },
    body: JSON.stringify({
      language_id: langId,
      source_code: Buffer.from(code).toString("base64"),
      stdin: stdin ? Buffer.from(stdin).toString("base64") : "",
      cpu_time_limit: timeLimit,
      memory_limit: memoryLimit * 1024, // KB
    }),
  })
  if (!res.ok) throw new Error(`Judge0 submit failed: ${res.status}`)
  const { token } = await res.json()
  if (!token) throw new Error("No token returned from Judge0")
  return token
}

async function pollJudge0(token: string): Promise<Record<string, unknown>> {
  for (let i = 0; i < 15; i++) {
    await new Promise(r => setTimeout(r, 1500))
    const res = await fetch(
      `${JUDGE0_URL}/submissions/${token}?base64_encoded=true&fields=stdout,stderr,compile_output,status,exit_code,time,memory`,
      { headers: { "X-RapidAPI-Key": JUDGE0_KEY, "X-RapidAPI-Host": "judge0-ce.p.rapidapi.com" } }
    )
    if (!res.ok) continue
    const data = await res.json()
    if (data.status?.id <= 2) continue // In Queue / Processing
    return data
  }
  throw new Error("Execution timed out")
}

function decode(b64: string | null | undefined): string {
  if (!b64) return ""
  try { return Buffer.from(b64, "base64").toString("utf-8") } catch { return b64 }
}

function normalizeOutput(s: string): string {
  return s.trim().replace(/\r\n/g, "\n").replace(/\r/g, "\n")
}

function normalizeLenient(s: string): string {
  return s.replace(/\s+/g, "");
}

export async function POST(req: Request) {
  try {
    const {
      code, language,
      testCases = [],   // [{ input, expectedOutput, hidden? }]
      timeLimit = 5,
      memoryLimit = 128,
      visibleOnly = false,
      driverCode = "",
    } = await req.json()

    if (!code || !language) {
      return NextResponse.json({ error: "code and language are required" }, { status: 400 })
    }

    const fullCode = driverCode ? `${code}\n\n${driverCode}` : code
    if (!JUDGE0_KEY) {
      return NextResponse.json({ error: "Judge0 API key not configured" }, { status: 500 })
    }
    if (!testCases.length) {
      return NextResponse.json({ error: "No test cases provided" }, { status: 400 })
    }

    const casesToRun = visibleOnly
      ? testCases.filter((tc: { hidden?: boolean }) => !tc.hidden)
      : testCases

    // Submit all cases to Judge0 in parallel
    const tokens: (string | null)[] = await Promise.all(
      casesToRun.map(async (tc: { input: string }) => {
        try {
          return await submitToJudge0(fullCode, language, tc.input || "", timeLimit, memoryLimit)
        } catch {
          return null
        }
      })
    )

    // Poll all cases in parallel
    const results = await Promise.all(
      tokens.map(async (token, i) => {
        const tc = casesToRun[i] as { input: string; expectedOutput: string; hidden?: boolean }
        if (!token) {
          return {
            caseIndex: i,
            input: tc.input,
            expectedOutput: tc.expectedOutput,
            actualOutput: "",
            passed: false,
            hidden: !!tc.hidden,
            status: "Submission Error",
            time: null,
            memory: null,
          }
        }

        try {
          const data = await pollJudge0(token)
          const stdout = decode(data.stdout as string)
          const stderr = decode(data.stderr as string)
          const compileOutput = decode(data.compile_output as string)
          const statusId = (data.status as { id?: number })?.id || 0
          const statusName = (data.status as { description?: string })?.description || "Unknown"
          
          // A case passes if there's no compilation error AND the output matches.
          // We provide a lenient fallback that ignores all whitespace variations 
          // (e.g. [1, 2] vs [1,2]).
          const s1 = normalizeOutput(stdout)
          const s2 = normalizeOutput(tc.expectedOutput)
          const passed = !compileOutput && (s1 === s2 || normalizeLenient(s1) === normalizeLenient(s2))

          // If Judge0 says "Accepted" but our internal check says "failed", it's a Wrong Answer.
          const finalStatus = (statusId === 3 && !passed) ? "Wrong Answer" : statusName

          return {
            caseIndex: i,
            input: tc.hidden ? null : tc.input,              // hide input for hidden cases
            expectedOutput: tc.hidden ? null : tc.expectedOutput,
            actualOutput: tc.hidden ? null : stdout,
            stderr: tc.hidden ? null : (stderr || compileOutput || null),
            passed,
            hidden: !!tc.hidden,
            status: finalStatus,
            time: data.time ?? null,
            memory: data.memory ?? null,
          }
        } catch {
          return {
            caseIndex: i,
            input: tc.hidden ? null : tc.input,
            expectedOutput: tc.hidden ? null : tc.expectedOutput,
            actualOutput: null,
            passed: false,
            hidden: !!tc.hidden,
            status: "Time Limit Exceeded",
            time: null,
            memory: null,
          }
        }
      })
    )

    const totalPassed = results.filter(r => r.passed).length
    const totalCases = results.length
    const allPassed = totalPassed === totalCases

    return NextResponse.json({ results, totalPassed, totalCases, allPassed })
  } catch (err) {
    console.error("[CodeTest] Error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
