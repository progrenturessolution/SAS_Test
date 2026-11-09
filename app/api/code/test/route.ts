import { NextResponse } from "next/server"

const JUDGE0_URL = process.env.JUDGE0_URL || "http://16.192.215.199:2358"

const LANG_MAP: Record<string, number> = {
  python: 71, javascript: 63, typescript: 74,
  java: 62, cpp: 54, c: 50, go: 60, rust: 73,
}

function assembleFullCode(code: string, driverCode: string, language: string): string {
  const lang = (language || "").toLowerCase().trim()
  if (!driverCode || !driverCode.trim()) return code

  // If user provided their own main function, do not attach driver code
  if ((lang === "java" || lang === "cpp" || lang === "c") && /\bmain\s*\(/.test(code)) {
    return code
  }
  if (lang === "python" && (/if\s+__name__\s*==\s*['"]__main__['"]/.test(code) || /def\s+main\s*\(/.test(code))) {
    return code
  }

  if (lang === "java") {
    const importRegex = /^\s*import\s+[^;]+;\s*$/gm
    const imports = new Set<string>()
    imports.add("import java.util.*;")
    imports.add("import java.lang.reflect.*;")

    const cleanCode = code.replace(importRegex, (m) => {
      imports.add(m.trim())
      return ""
    })

    // Remove `public` from `public class Solution`
    const nonPublicCode = cleanCode.replace(/\bpublic\s+class\s+Solution\b/g, "class Solution")

    // Robust reflection runner for Solution class
    const robustJavaDriver = `
public class Main {
    public static void main(String[] args) throws Exception {
        Scanner sc = new Scanner(System.in);
        List<String> lines = new ArrayList<>();
        while (sc.hasNextLine()) {
            String l = sc.nextLine().trim();
            if (!l.isEmpty()) lines.add(l);
        }
        if (lines.isEmpty()) return;

        Solution sol = new Solution();
        Method[] methods = Solution.class.getDeclaredMethods();
        Method targetMethod = null;
        for (Method m : methods) {
            if (m.getName().equals("solve") || Modifier.isPublic(m.getModifiers())) {
                targetMethod = m;
                break;
            }
        }
        if (targetMethod == null) return;

        Class<?>[] paramTypes = targetMethod.getParameterTypes();
        Object[] invokeArgs = new Object[paramTypes.length];

        for (int i = 0; i < paramTypes.length && i < lines.size(); i++) {
            Class<?> pt = paramTypes[i];
            String val = lines.get(i);
            if (pt == int[].class) {
                val = val.replace("[", "").replace("]", "").replace(",", " ").trim();
                String[] parts = val.isEmpty() ? new String[0] : val.split("\\\\s+");
                int[] arr = new int[parts.length];
                for (int j = 0; j < parts.length; j++) arr[j] = Integer.parseInt(parts[j]);
                invokeArgs[i] = arr;
            } else if (pt == long[].class) {
                val = val.replace("[", "").replace("]", "").replace(",", " ").trim();
                String[] parts = val.isEmpty() ? new String[0] : val.split("\\\\s+");
                long[] arr = new long[parts.length];
                for (int j = 0; j < parts.length; j++) arr[j] = Long.parseLong(parts[j]);
                invokeArgs[i] = arr;
            } else if (pt == double[].class) {
                val = val.replace("[", "").replace("]", "").replace(",", " ").trim();
                String[] parts = val.isEmpty() ? new String[0] : val.split("\\\\s+");
                double[] arr = new double[parts.length];
                for (int j = 0; j < parts.length; j++) arr[j] = Double.parseDouble(parts[j]);
                invokeArgs[i] = arr;
            } else if (pt == String[].class) {
                val = val.replace("[", "").replace("]", "").replace(String.valueOf('\"'), "").trim();
                String[] parts = val.isEmpty() ? new String[0] : val.split("[,\\\\s]+");
                invokeArgs[i] = parts;
            } else if (pt == int.class || pt == Integer.class) {
                invokeArgs[i] = Integer.parseInt(val.trim());
            } else if (pt == long.class || pt == Long.class) {
                invokeArgs[i] = Long.parseLong(val.trim());
            } else if (pt == double.class || pt == Double.class) {
                invokeArgs[i] = Double.parseDouble(val.trim());
            } else if (pt == boolean.class || pt == Boolean.class) {
                invokeArgs[i] = Boolean.parseBoolean(val.trim());
            } else if (pt == String.class) {
                val = val.replace(String.valueOf('\"'), "").trim();
                invokeArgs[i] = val;
            } else {
                invokeArgs[i] = val;
            }
        }

        Object result = targetMethod.invoke(sol, invokeArgs);
        if (result instanceof int[]) {
            System.out.println(Arrays.toString((int[]) result));
        } else if (result instanceof long[]) {
            System.out.println(Arrays.toString((long[]) result));
        } else if (result instanceof double[]) {
            System.out.println(Arrays.toString((double[]) result));
        } else if (result instanceof boolean[]) {
            System.out.println(Arrays.toString((boolean[]) result));
        } else if (result instanceof Object[]) {
            System.out.println(Arrays.toString((Object[]) result));
        } else {
            System.out.println(result);
        }
    }
}
`
    const importHeader = Array.from(imports).join("\n")
    return `${importHeader}\n\n${nonPublicCode}\n\n${robustJavaDriver}`.trim()
  }

  if (lang === "python") {
    const robustPyDriver = `
if __name__ == '__main__':
    import sys, json, inspect
    sol = Solution()
    lines = [l.strip() for l in sys.stdin if l.strip()]
    if lines:
        methods = [getattr(sol, name) for name in dir(sol) if callable(getattr(sol, name)) and not name.startswith('_')]
        target_method = getattr(sol, 'solve', methods[0] if methods else None)
        if target_method:
            sig = inspect.signature(target_method)
            num_params = len(sig.parameters)
            parsed_args = []
            for l in lines:
                try:
                    parsed_args.append(json.loads(l))
                except Exception:
                    try:
                        parsed_args.append(int(l))
                    except Exception:
                        parsed_args.append(l)
            
            if len(parsed_args) == num_params:
                res = target_method(*parsed_args)
            elif len(parsed_args) == 1 and isinstance(parsed_args[0], list) and len(parsed_args[0]) == num_params:
                res = target_method(*parsed_args[0])
            elif len(parsed_args) == 1:
                res = target_method(parsed_args[0])
            else:
                res = target_method(*parsed_args)
            print(json.dumps(res))
`
    return `${code}\n\n${robustPyDriver}`.trim()
  }

  if (lang === "javascript" || lang === "typescript") {
    const robustJsDriver = `
const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin });
const sol = new Solution();
const lines = [];
rl.on('line', (l) => {
    if (l.trim()) lines.push(l.trim());
});
rl.on('close', () => {
    if (!lines.length) return;
    const targetMethod = sol.solve ? sol.solve.bind(sol) : Object.values(sol).find(f => typeof f === 'function');
    if (!targetMethod) return;
    const parsedArgs = lines.map(l => {
        try { return JSON.parse(l); } catch(e) { return isNaN(Number(l)) ? l : Number(l); }
    });
    let result;
    if (parsedArgs.length === targetMethod.length) {
        result = targetMethod(...parsedArgs);
    } else if (parsedArgs.length === 1 && Array.isArray(parsedArgs[0]) && parsedArgs[0].length === targetMethod.length) {
        result = targetMethod(...parsedArgs[0]);
    } else {
        result = targetMethod(...parsedArgs);
    }
    console.log(JSON.stringify(result));
});
`
    return `${code}\n\n${robustJsDriver}`.trim()
  }

  if (lang === "cpp" || lang === "c") {
    const includeRegex = /^\s*#include\s*<[^>]+>\s*$/gm
    const includes = new Set<string>()
    const cleanCode = code.replace(includeRegex, (m) => {
      includes.add(m.trim())
      return ""
    })
    const cleanDriver = driverCode.replace(includeRegex, (m) => {
      includes.add(m.trim())
      return ""
    })
    return `${Array.from(includes).join("\n")}\n\n${cleanCode}\n\n${cleanDriver}`.trim()
  }

  return `${code}\n\n${driverCode}`
}

async function submitToJudge0(code: string, language: string, stdin: string, timeLimit: number, memoryLimit: number): Promise<string> {
  const langId = LANG_MAP[language.toLowerCase()]
  if (!langId) throw new Error(`Unsupported language: ${language}`)

  const res = await fetch(`${JUDGE0_URL}/submissions?base64_encoded=true&wait=false`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
      { headers: { "Content-Type": "application/json" } }
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

    const fullCode = assembleFullCode(code, driverCode, language)
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
            input: tc.hidden ? null : tc.input,
            expectedOutput: tc.hidden ? null : tc.expectedOutput,
            actualOutput: tc.hidden ? null : (compileOutput || stdout),
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
