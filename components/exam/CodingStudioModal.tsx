"use client"

import { useState } from "react"
import Editor from "@monaco-editor/react"
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Code2,
  Eye,
  FileText,
  Info,
  Loader2,
  Lock,
  Play,
  Plus,
  RotateCcw,
  Sparkles,
  Terminal,
  Trash2,
  X,
} from "lucide-react"

export type CodingDifficulty = "easy" | "medium" | "hard"

export interface StudioCodingQuestion {
  id: string
  type: "coding"
  questionText: string
  difficulty: CodingDifficulty
  marks: number
  negativeMark?: number
  codeTemplate: string
  codeTemplates: Record<string, string>
  driverCode: Record<string, string>
  testCases: { input: string; expectedOutput: string; hidden?: boolean }[]
  constraints: string[]
  languages: string[]
  questionImage?: string
}

export const DEFAULT_TEMPLATES: Record<string, string> = {
  python: "class Solution:\n    def solve(self, nums, target):\n        # Write your code here\n        pass\n",
  javascript: "class Solution {\n    solve(nums, target) {\n        // Write your code here\n    }\n}\n",
  java: "public class Solution {\n    public int[] solve(int[] nums, int target) {\n        // Write your code here\n        return new int[]{0, 1};\n    }\n}",
  cpp: "#include <iostream>\n#include <vector>\n\nclass Solution {\npublic:\n    std::vector<int> solve(std::vector<int>& nums, int target) {\n        // Write your code here\n        return {0, 1};\n    }\n};",
  go: "package main\n\ntype Solution struct{}\n\nfunc (s *Solution) Solve(nums []int, target int) []int {\n    // Write your code here\n    return []int{0, 1}\n}",
  rust: "struct Solution;\n\nimpl Solution {\n    pub fn solve(nums: Vec<i32>, target: i32) -> Vec<i32> {\n        // Write your code here\n        vec![0, 1]\n    }\n}",
}

export const DEFAULT_DRIVERS: Record<string, string> = {
  python:
    "if __name__ == '__main__':\n    import sys, json, inspect\n    sol = Solution()\n    for line in sys.stdin:\n        if not line.strip(): continue\n        try:\n            data = json.loads(line)\n            if isinstance(data, dict):\n                sig = inspect.signature(sol.solve)\n                params = list(sig.parameters.keys())\n                if len(params) == 1 and params[0] not in data:\n                    result = sol.solve(data)\n                else:\n                    filtered_data = {k: v for k, v in data.items() if k in params}\n                    result = sol.solve(**filtered_data)\n            elif isinstance(data, list):\n                result = sol.solve(*data)\n            else:\n                result = sol.solve(data)\n            print(json.dumps(result))\n        except Exception as e: sys.stderr.write(str(e))",
  javascript:
    "const readline = require('readline');\nconst rl = readline.createInterface({ input: process.stdin });\nconst sol = new Solution();\nfunction getParamNames(func) {\n    const str = func.toString();\n    const result = str.slice(str.indexOf('(') + 1, str.indexOf(')')).match(/([^\\s,]+)/g);\n    return result === null ? [] : result;\n}\nrl.on('line', (line) => {\n    if (!line.trim()) return;\n    try {\n        const data = JSON.parse(line);\n        let result;\n        if (typeof data === 'object' && !Array.isArray(data)) {\n            const params = getParamNames(sol.solve);\n            if (params.length === 1 && !(params[0] in data)) {\n                result = sol.solve(data);\n            } else {\n                const args = params.map(p => data[p]);\n                result = sol.solve(...args);\n            }\n        } else if (Array.isArray(data)) {\n            result = sol.solve(...data);\n        } else {\n            result = sol.solve(data);\n        }\n        console.log(JSON.stringify(result));\n    }\n    catch (e) { console.error(e); }\n});",
  java:
    "import java.util.Scanner;\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        Solution sol = new Solution();\n        while (sc.hasNextLine()) {\n            String line = sc.nextLine();\n            if (line.trim().isEmpty()) continue;\n            System.out.println(sol.solve(line));\n        }\n    }\n}",
  cpp:
    "#include <iostream>\n#include <string>\nint main() {\n    std::string line;\n    Solution sol;\n    while (std::getline(std::cin, line)) {\n        if (line.empty()) continue;\n        std::cout << sol.solve(line) << std::endl;\n    }\n    return 0;\n}",
  go:
    "func main() {\n    var input string\n    sol := Solution{}\n    for {\n        _, err := fmt.Scanln(&input)\n        if err != nil { break }\n        fmt.Println(sol.Solve(input))\n    }\n}",
  rust:
    "fn main() {\n    use std::io::{self, BufRead};\n    let stdin = io::stdin();\n    for line in stdin.lock().lines() {\n        let s = line.unwrap();\n        if s.trim().is_empty() { continue; }\n        println!(\"{}\", Solution::solve(s));\n    }\n}",
}

const ALL_LANGUAGES = ["Python", "Java", "C++", "JavaScript", "Go", "Rust"] as const

const MONACO_LANG_MAP: Record<string, string> = {
  python: "python",
  javascript: "javascript",
  java: "java",
  "c++": "cpp",
  cpp: "cpp",
  go: "go",
  rust: "rust",
}

const normalizeLangKey = (lang: string) => {
  const lower = lang.trim().toLowerCase()
  return lower === "c++" ? "cpp" : lower
}

interface TestRunItem {
  caseIndex: number
  input: string | null
  expectedOutput: string | null
  actualOutput: string | null
  stderr?: string | null
  passed: boolean
  hidden: boolean
  status: string
  time: string | null
  memory: number | null
}

const DIFFICULTY_STYLES: Record<CodingDifficulty, { pill: string; badge: string; label: string }> = {
  easy: {
    pill: "bg-emerald-50 text-emerald-700 border-emerald-300",
    badge: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    label: "Easy",
  },
  medium: {
    pill: "bg-amber-50 text-amber-700 border-amber-300",
    badge: "bg-amber-50 text-amber-700 border border-amber-200",
    label: "Medium",
  },
  hard: {
    pill: "bg-rose-50 text-rose-700 border-rose-300",
    badge: "bg-rose-50 text-rose-700 border border-rose-200",
    label: "Hard",
  },
}

export function CodingStudioModal({
  onSave,
  onClose,
  initial,
}: {
  onSave: (q: StudioCodingQuestion) => void
  onClose: () => void
  initial?: StudioCodingQuestion
}) {
  const blank = (): StudioCodingQuestion => ({
    id: Math.random().toString(36).slice(2),
    type: "coding",
    questionText: "",
    difficulty: "medium",
    marks: 15,
    negativeMark: 0,
    codeTemplate: DEFAULT_TEMPLATES.python,
    codeTemplates: { ...DEFAULT_TEMPLATES },
    driverCode: { ...DEFAULT_DRIVERS },
    testCases: [{ input: "", expectedOutput: "", hidden: false }],
    constraints: [],
    languages: ["Python", "JavaScript"],
  })

  const [q, setQ] = useState<StudioCodingQuestion>(() => {
    const base = initial ?? blank()
    const templates: Record<string, string> = { ...DEFAULT_TEMPLATES }
    Object.entries(base.codeTemplates || {}).forEach(([k, v]) => {
      templates[normalizeLangKey(k)] = v
    })
    const drivers: Record<string, string> = { ...DEFAULT_DRIVERS }
    Object.entries(base.driverCode || {}).forEach(([k, v]) => {
      drivers[normalizeLangKey(k)] = v
    })
    return {
      ...base,
      constraints: Array.isArray(base.constraints) ? base.constraints : [],
      languages: Array.isArray(base.languages) && base.languages.length > 0 ? base.languages : ["Python", "JavaScript"],
      testCases:
        Array.isArray(base.testCases) && base.testCases.length > 0
          ? base.testCases
          : [{ input: "", expectedOutput: "", hidden: false }],
      codeTemplates: templates,
      driverCode: drivers,
    }
  })

  const [activeLang, setActiveLang] = useState<string>(() =>
    normalizeLangKey(initial?.languages?.[0] || "python")
  )
  const [leftTab, setLeftTab] = useState<"description" | "preview" | "guide">("description")
  const [editorMode, setEditorMode] = useState<"template" | "driver">("template")
  const [consoleTab, setConsoleTab] = useState<"testcase" | "result">("testcase")
  const [activeCaseIdx, setActiveCaseIdx] = useState(0)
  const [mobilePane, setMobilePane] = useState<"problem" | "editor" | "console">("problem")

  const [newConstraint, setNewConstraint] = useState("")
  const [error, setError] = useState("")
  const [aiPrompt, setAiPrompt] = useState("")
  const [isAiGenerating, setIsAiGenerating] = useState(false)
  const [aiError, setAiError] = useState("")

  const [isTesting, setIsTesting] = useState(false)
  const [testError, setTestError] = useState("")
  const [testResults, setTestResults] = useState<TestRunItem[] | null>(null)
  const [testSummary, setTestSummary] = useState<{ totalPassed: number; totalCases: number } | null>(null)

  const handleToggleLanguage = (lang: string) => {
    const key = normalizeLangKey(lang)
    setQ((prev) => {
      const exists = prev.languages.some((l) => normalizeLangKey(l) === key)
      const nextLangs = exists
        ? prev.languages.filter((l) => normalizeLangKey(l) !== key)
        : [...prev.languages, lang]

      if (exists && activeLang === key && nextLangs.length > 0) {
        setActiveLang(normalizeLangKey(nextLangs[0]))
      } else if (!exists) {
        setActiveLang(key)
      }
      return { ...prev, languages: nextLangs }
    })
  }

  const handleAiGenerate = async () => {
    if (!aiPrompt.trim()) return
    setIsAiGenerating(true)
    setAiError("")
    setError("")
    try {
      const res = await fetch("/api/admin/generate-coding-question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          prompt: aiPrompt,
          languages: q.languages.length > 0 ? q.languages : ["Python", "Java", "C++", "JavaScript"],
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || "Failed to generate coding problem")
      }
      const data = json.data || {}
      const normalizedIncomingTemplates: Record<string, string> = {}
      Object.entries(data.codeTemplates || {}).forEach(([k, v]) => {
        normalizedIncomingTemplates[normalizeLangKey(k)] = String(v || "")
      })

      setQ((prev) => {
        const langs = prev.languages.length > 0 ? prev.languages : ["Python", "Java", "C++", "JavaScript"]
        return {
          ...prev,
          questionText: data.questionText || prev.questionText,
          difficulty: (data.difficulty as CodingDifficulty) || prev.difficulty,
          constraints: Array.isArray(data.constraints) ? data.constraints : prev.constraints,
          codeTemplates: {
            ...prev.codeTemplates,
            ...normalizedIncomingTemplates,
          },
          testCases:
            Array.isArray(data.testCases) && data.testCases.length > 0
              ? data.testCases.map((tc: { input?: string; expectedOutput?: string; hidden?: boolean }) => ({
                  input: tc.input ?? "",
                  expectedOutput: tc.expectedOutput ?? "",
                  hidden: Boolean(tc.hidden),
                }))
              : prev.testCases,
          languages: langs,
        }
      })

      const firstGeneratedLang = Object.keys(normalizedIncomingTemplates)[0]
      if (firstGeneratedLang) {
        setActiveLang(firstGeneratedLang)
      }
      setActiveCaseIdx(0)
      setTestResults(null)
      setTestSummary(null)
    } catch (err: unknown) {
      setAiError(err instanceof Error ? err.message : "Failed to generate")
    } finally {
      setIsAiGenerating(false)
    }
  }

  const handleRunTests = async () => {
    setTestError("")
    if (q.languages.length === 0) {
      setConsoleTab("result")
      setMobilePane("console")
      setTestError("Enable at least one language before running tests.")
      return
    }
    const validCases = q.testCases.filter((tc) => tc.input.trim() || tc.expectedOutput.trim())
    if (validCases.length === 0) {
      setConsoleTab("result")
      setMobilePane("console")
      setTestError("Add at least one test case with input or expected output.")
      return
    }

    const codeToRun = q.codeTemplates[activeLang] || ""
    const driverToRun = q.driverCode[activeLang] || ""
    setConsoleTab("result")
    setMobilePane("console")
    setIsTesting(true)

    try {
      const res = await fetch("/api/code/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: codeToRun,
          language: activeLang,
          testCases: validCases,
          visibleOnly: false,
          driverCode: driverToRun,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || "Code execution request failed")
      }
      setTestResults(Array.isArray(data.results) ? data.results : [])
      setTestSummary({
        totalPassed: Number(data.totalPassed || 0),
        totalCases: Number(data.totalCases || validCases.length),
      })
    } catch (err: unknown) {
      setTestError(err instanceof Error ? err.message : "Unable to reach code runner")
      setTestResults(null)
      setTestSummary(null)
    } finally {
      setIsTesting(false)
    }
  }

  const handleAddCase = () => {
    const nextIdx = q.testCases.length
    setQ((prev) => ({
      ...prev,
      testCases: [...prev.testCases, { input: "", expectedOutput: "", hidden: false }],
    }))
    setActiveCaseIdx(nextIdx)
    setConsoleTab("testcase")
  }

  const handleDeleteCase = (idx: number) => {
    if (q.testCases.length <= 1) return
    setQ((prev) => ({
      ...prev,
      testCases: prev.testCases.filter((_, i) => i !== idx),
    }))
    setActiveCaseIdx((prevIdx) => Math.max(0, Math.min(prevIdx, q.testCases.length - 2)))
  }

  const handleAddConstraint = () => {
    const val = newConstraint.trim()
    if (!val) return
    setQ((prev) => ({ ...prev, constraints: [...prev.constraints, val] }))
    setNewConstraint("")
  }

  const handleResetEditorCode = () => {
    if (editorMode === "template") {
      setQ((prev) => ({
        ...prev,
        codeTemplates: { ...prev.codeTemplates, [activeLang]: DEFAULT_TEMPLATES[activeLang] || "" },
      }))
    } else {
      setQ((prev) => ({
        ...prev,
        driverCode: { ...prev.driverCode, [activeLang]: DEFAULT_DRIVERS[activeLang] || "" },
      }))
    }
  }

  const handleSave = () => {
    if (!q.questionText.trim()) {
      setError("Problem statement is required.")
      setLeftTab("description")
      setMobilePane("problem")
      return
    }
    if (q.languages.length === 0) {
      setError("At least one programming language must be enabled.")
      setLeftTab("description")
      setMobilePane("problem")
      return
    }
    const primaryKey = normalizeLangKey(q.languages[0])
    onSave({
      ...q,
      codeTemplate: q.codeTemplates[primaryKey] || q.codeTemplate || DEFAULT_TEMPLATES.python,
    })
  }

  const safeCaseIdx = Math.min(activeCaseIdx, Math.max(0, q.testCases.length - 1))
  const currentCase = q.testCases[safeCaseIdx] || { input: "", expectedOutput: "", hidden: false }
  const visiblePreviewCases = q.testCases.filter((tc) => !tc.hidden)
  const monacoLanguage = MONACO_LANG_MAP[activeLang] || "python"
  const activeEditorValue =
    editorMode === "template" ? q.codeTemplates[activeLang] || "" : q.driverCode[activeLang] || ""

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/55 backdrop-blur-xs animate-in fade-in-50">
      <div className="w-full max-w-[1440px] h-[92vh] bg-[#F5F6FA] rounded-2xl border border-[#cbd5e1] shadow-2xl flex flex-col overflow-hidden">
        {/* ── LeetCode Top Studio Navbar ── */}
        <div className="bg-white border-b border-[#cbd5e1] px-3 sm:px-4 py-2.5 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-[#eaf0f8] border border-[#cbd5e1] flex items-center justify-center text-[#324158] shrink-0">
              <Code2 size={16} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-bold text-[#324158] truncate">
                  Coding Challenge Studio
                </h2>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${DIFFICULTY_STYLES[q.difficulty].badge}`}>
                  {DIFFICULTY_STYLES[q.difficulty].label}
                </span>
                <span className="hidden sm:inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#eaf0f8] text-[#324158] border border-[#cbd5e1]">
                  {q.marks} Marks
                </span>
              </div>
            </div>
          </div>

          {/* Inline AI Problem Quick-Generator */}
          <div className="order-3 xl:order-2 w-full xl:w-auto xl:flex-1 xl:max-w-md flex items-center gap-1.5">
            <div className="relative flex-1">
              <Sparkles size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#324158]/70 pointer-events-none" />
              <input
                type="text"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    handleAiGenerate()
                  }
                }}
                disabled={isAiGenerating}
                placeholder="AI auto-fill (e.g. Two Sum, Valid Palindrome)..."
                className="w-full h-9 pl-8 pr-3 text-xs font-medium bg-[#F5F6FA] hover:bg-white focus:bg-white border border-[#cbd5e1] rounded-xl text-[#324158] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#324158]/20 focus:border-[#324158] transition-all"
              />
            </div>
            <button
              type="button"
              onClick={handleAiGenerate}
              disabled={isAiGenerating || !aiPrompt.trim()}
              className="h-9 px-3 bg-primary hover:bg-[#253244] text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 disabled:opacity-50 transition-all shrink-0 cursor-pointer"
            >
              {isAiGenerating ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              <span className="hidden sm:inline">{isAiGenerating ? "Generating..." : "AI Fill"}</span>
            </button>
          </div>

          {/* Studio Action Controls */}
          <div className="order-2 xl:order-3 flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleRunTests}
              disabled={isTesting}
              title="Run active Starter Code + Driver Runner against Test Cases"
              className="h-9 px-3 rounded-xl border border-[#cbd5e1] bg-[#eaf0f8] hover:bg-[#dde7f4] text-[#324158] text-xs font-bold flex items-center gap-1.5 disabled:opacity-60 transition-colors cursor-pointer"
            >
              {isTesting ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
              <span className="hidden sm:inline">{isTesting ? "Running..." : "Test Run"}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-3 rounded-xl border border-[#cbd5e1] bg-white hover:bg-[#F5F6FA] text-[#324158] text-xs font-semibold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="h-9 px-4 rounded-xl bg-primary hover:bg-[#253244] text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
            >
              <Check size={14} />
              <span>Save Question</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close coding studio"
              className="w-8 h-8 rounded-lg text-slate-400 hover:text-[#324158] hover:bg-[#F5F6FA] flex items-center justify-center transition-colors cursor-pointer sm:hidden"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Inline Error / AI Error Strip */}
        {(error || aiError) && (
          <div className="px-4 py-2 bg-rose-50 border-b border-rose-200 flex items-center justify-between gap-2 text-xs text-rose-700 font-semibold shrink-0">
            <div className="flex items-center gap-1.5">
              <AlertCircle size={14} className="shrink-0" />
              <span>{error || aiError}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setError("")
                setAiError("")
              }}
              className="text-rose-500 hover:text-rose-700 cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Mobile Pane Switcher */}
        <div className="lg:hidden px-2.5 pt-2 shrink-0">
          <div className="grid grid-cols-3 bg-white border border-[#cbd5e1] rounded-xl p-1 gap-1">
            {(
              [
                { id: "problem", label: "Description", icon: FileText },
                { id: "editor", label: "Code Editor", icon: Code2 },
                { id: "console", label: `Cases (${q.testCases.length})`, icon: Terminal },
              ] as const
            ).map((item) => {
              const Icon = item.icon
              const active = mobilePane === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setMobilePane(item.id)}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    active ? "bg-primary text-white" : "text-slate-600 hover:bg-[#F5F6FA]"
                  }`}
                >
                  <Icon size={13} />
                  <span>{item.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Main LeetCode Split-Screen Workspace ── */}
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-2.5 p-2.5">
          {/* LEFT PANE: Problem Statement, Preview & Setup */}
          <div
            className={`${
              mobilePane === "problem" ? "flex" : "hidden lg:flex"
            } flex-1 lg:flex-none lg:w-[43%] flex-col bg-white rounded-xl border border-[#cbd5e1] overflow-hidden min-h-0 shadow-2xs`}
          >
            {/* LeetCode Left Pane Tabs */}
            <div className="bg-[#f8fafc] border-b border-[#cbd5e1] px-2.5 pt-2 flex items-center gap-1 shrink-0">
              {(
                [
                  { id: "description", label: "Description", icon: FileText },
                  { id: "preview", label: "Student Preview", icon: Eye },
                  { id: "guide", label: "Guide", icon: Info },
                ] as const
              ).map((tab) => {
                const Icon = tab.icon
                const active = leftTab === tab.id
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setLeftTab(tab.id)}
                    className={`px-3 py-2 text-xs font-bold flex items-center gap-1.5 rounded-t-lg border-b-2 transition-all cursor-pointer ${
                      active
                        ? "bg-white text-[#324158] border-[#324158]"
                        : "text-slate-500 border-transparent hover:text-[#324158] hover:bg-white/60"
                    }`}
                  >
                    <Icon size={13} />
                    <span>{tab.label}</span>
                  </button>
                )
              })}
            </div>

            {/* Left Pane Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
              {leftTab === "description" && (
                <>
                  {/* Problem Statement */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-[#324158]">
                        Problem Statement <span className="text-rose-500">*</span>
                      </label>
                      <span className="text-[11px] text-slate-400 font-medium">
                        Supports plain text & specs
                      </span>
                    </div>
                    <textarea
                      value={q.questionText}
                      onChange={(e) => {
                        setError("")
                        setQ({ ...q, questionText: e.target.value })
                      }}
                      rows={6}
                      placeholder="Write a clear problem description including input format, expected output, and edge cases..."
                      className="w-full p-3 rounded-xl border border-[#cbd5e1] bg-white hover:border-[#324158]/50 text-xs sm:text-sm leading-relaxed text-[#324158] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#324158]/20 focus:border-[#324158] transition-all resize-y min-h-[130px]"
                    />
                  </div>

                  {/* Difficulty Pills + Marks + Negative Mark */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                    <div className="sm:col-span-6">
                      <label className="block text-xs font-bold text-[#324158] mb-1.5">
                        Difficulty
                      </label>
                      <div className="grid grid-cols-3 gap-1.5 bg-[#F5F6FA] p-1 rounded-xl border border-[#cbd5e1]">
                        {(["easy", "medium", "hard"] as const).map((level) => {
                          const active = q.difficulty === level
                          return (
                            <button
                              key={level}
                              type="button"
                              onClick={() => setQ({ ...q, difficulty: level })}
                              className={`h-8 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                                active
                                  ? DIFFICULTY_STYLES[level].pill
                                  : "bg-transparent border-transparent text-slate-500 hover:text-[#324158]"
                              }`}
                            >
                              {DIFFICULTY_STYLES[level].label}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                    <div className="sm:col-span-3">
                      <label className="block text-xs font-bold text-[#324158] mb-1.5">
                        Marks <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={q.marks}
                        onChange={(e) => setQ({ ...q, marks: Math.max(1, +e.target.value || 1) })}
                        className="w-full h-10 px-3 rounded-xl border border-[#cbd5e1] bg-white text-xs font-bold text-[#324158] focus:outline-none focus:ring-2 focus:ring-[#324158]/20 focus:border-[#324158]"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <label className="block text-xs font-bold text-[#324158] mb-1.5">
                        Negative
                      </label>
                      <input
                        type="number"
                        step="0.25"
                        min={0}
                        value={q.negativeMark || 0}
                        onChange={(e) => setQ({ ...q, negativeMark: Math.max(0, +e.target.value || 0) })}
                        className="w-full h-10 px-3 rounded-xl border border-[#cbd5e1] bg-white text-xs font-bold text-[#324158] focus:outline-none focus:ring-2 focus:ring-[#324158]/20 focus:border-[#324158]"
                      />
                    </div>
                  </div>

                  {/* Enabled Languages */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-[#324158]">
                        Allowed Languages <span className="text-rose-500">*</span>
                      </label>
                      <span className="text-[11px] text-slate-500 font-medium">
                        {q.languages.length} selected
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {ALL_LANGUAGES.map((lang) => {
                        const key = normalizeLangKey(lang)
                        const enabled = q.languages.some((l) => normalizeLangKey(l) === key)
                        return (
                          <button
                            key={lang}
                            type="button"
                            onClick={() => handleToggleLanguage(lang)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                              enabled
                                ? "bg-primary text-white border-primary shadow-2xs"
                                : "bg-[#F5F6FA] text-slate-600 border-[#cbd5e1] hover:border-[#324158] hover:bg-white"
                            }`}
                          >
                            {enabled && <Check size={12} />}
                            <span>{lang}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Constraints Editor */}
                  <div className="bg-[#F5F6FA] border border-[#cbd5e1] rounded-xl p-3 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-[#324158]">
                        Constraints ({q.constraints.length})
                      </label>
                      <span className="text-[10px] font-semibold text-slate-500">
                        Shown in problem description
                      </span>
                    </div>
                    {q.constraints.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {q.constraints.map((c, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-[#cbd5e1] font-mono text-[11px] text-[#324158]"
                          >
                            <span>{c}</span>
                            <button
                              type="button"
                              onClick={() =>
                                setQ((prev) => ({
                                  ...prev,
                                  constraints: prev.constraints.filter((_, i) => i !== idx),
                                }))
                              }
                              className="text-slate-400 hover:text-rose-600 cursor-pointer"
                            >
                              <X size={12} />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={newConstraint}
                        onChange={(e) => setNewConstraint(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault()
                            handleAddConstraint()
                          }
                        }}
                        placeholder="e.g. 1 <= nums.length <= 10^4"
                        className="flex-1 h-8 px-2.5 text-xs font-mono bg-white border border-[#cbd5e1] rounded-lg text-[#324158] placeholder:text-slate-400 focus:outline-none focus:border-[#324158]"
                      />
                      <button
                        type="button"
                        onClick={handleAddConstraint}
                        disabled={!newConstraint.trim()}
                        className="h-8 px-2.5 rounded-lg bg-white hover:bg-[#eaf0f8] border border-[#cbd5e1] text-[#324158] text-xs font-bold flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                      >
                        <Plus size={13} /> Add
                      </button>
                    </div>
                  </div>

                  {/* Optional Diagram / Image URL */}
                  <div>
                    <label className="block text-xs font-bold text-[#324158] mb-1.5">
                      Diagram / Image URL <span className="text-slate-400 font-normal">(Optional)</span>
                    </label>
                    <input
                      value={q.questionImage || ""}
                      onChange={(e) => setQ({ ...q, questionImage: e.target.value })}
                      placeholder="https://example.com/tree-diagram.png"
                      className="w-full h-9 px-3 rounded-xl border border-[#cbd5e1] bg-white hover:border-[#324158]/50 text-xs text-[#324158] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#324158]/20 focus:border-[#324158]"
                    />
                  </div>
                </>
              )}

              {leftTab === "preview" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-[#cbd5e1]">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-[#324158]">Problem Statement</span>
                      <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${DIFFICULTY_STYLES[q.difficulty].badge}`}>
                        {DIFFICULTY_STYLES[q.difficulty].label}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-slate-500">{q.marks} pts</span>
                  </div>

                  <p className="text-sm text-[#324158] leading-relaxed whitespace-pre-wrap">
                    {q.questionText.trim() || "Your problem statement will appear here for candidates."}
                  </p>

                  {q.questionImage?.trim() && (
                    <div className="rounded-xl border border-[#cbd5e1] bg-[#F5F6FA] p-2">
                      <img
                        src={q.questionImage}
                        alt="Problem diagram"
                        className="max-h-48 w-auto mx-auto rounded-lg object-contain"
                      />
                    </div>
                  )}

                  {visiblePreviewCases.length > 0 && (
                    <div className="space-y-2.5">
                      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        Examples ({visiblePreviewCases.length} visible)
                      </p>
                      {visiblePreviewCases.map((tc, idx) => (
                        <div key={idx} className="bg-[#F5F6FA] border border-[#cbd5e1] rounded-xl p-3 space-y-1.5">
                          <p className="text-[11px] font-bold text-[#324158]">Example {idx + 1}:</p>
                          <div className="font-mono text-xs text-[#324158] space-y-1">
                            <div>
                              <span className="font-bold text-slate-500">Input: </span>
                              <span>{tc.input || "(empty)"}</span>
                            </div>
                            <div>
                              <span className="font-bold text-slate-500">Output: </span>
                              <span>{tc.expectedOutput || "(empty)"}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {q.constraints.length > 0 && (
                    <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3">
                      <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wider mb-1.5">
                        Constraints
                      </p>
                      <ul className="space-y-1">
                        {q.constraints.map((c, idx) => (
                          <li key={idx} className="font-mono text-xs text-amber-900">
                            • {c}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {leftTab === "guide" && (
                <div className="bg-[#F5F6FA] border border-[#cbd5e1] rounded-xl p-4 space-y-3 text-xs text-[#324158] leading-relaxed">
                  <p className="font-bold text-sm text-[#324158] flex items-center gap-2">
                    <Info size={15} /> How LeetCode-style Evaluation Works
                  </p>
                  <ol className="list-decimal list-inside space-y-2 text-slate-600">
                    <li>
                      Write the <b>Problem Statement</b>, pick <b>Difficulty & Marks</b>, and add optional <b>Constraints</b>.
                    </li>
                    <li>
                      Enable the <b>Languages</b> candidates are allowed to code in.
                    </li>
                    <li>
                      In the top-right <b>Starter Code</b> editor, define the class/function signature the candidate sees.
                    </li>
                    <li>
                      Switch to <b>Driver Runner</b> to review or customize the hidden wrapper that parses <code>stdin</code> and prints <code>stdout</code>.
                    </li>
                    <li>
                      Add visible and hidden <b>Test Cases</b> below, then click <b>Test Run</b> to execute against Judge0 before saving.
                    </li>
                  </ol>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT PANE: Split Vertically — Top Code Editor + Bottom Testcase Console */}
          <div
            className={`${
              mobilePane !== "problem" ? "flex" : "hidden lg:flex"
            } flex-1 lg:w-[57%] flex-col gap-2.5 min-h-0`}
          >
            {/* RIGHT TOP: Monaco Code Studio */}
            <div
              className={`${
                mobilePane === "editor" ? "flex" : mobilePane === "console" ? "hidden lg:flex" : "flex"
              } flex-[1.4] min-h-[250px] flex-col bg-white rounded-xl border border-[#cbd5e1] overflow-hidden shadow-2xs`}
            >
              {/* Editor Header Toolbar */}
              <div className="bg-[#f8fafc] border-b border-[#cbd5e1] px-3 py-2 flex flex-wrap items-center justify-between gap-2 shrink-0">
                {/* Editor Mode Switch: Starter Template vs Driver Runner */}
                <div className="flex items-center gap-1 bg-white border border-[#cbd5e1] rounded-lg p-0.5">
                  <button
                    type="button"
                    onClick={() => setEditorMode("template")}
                    className={`px-2.5 py-1 rounded-md text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                      editorMode === "template"
                        ? "bg-primary text-white"
                        : "text-slate-600 hover:text-[#324158] hover:bg-[#F5F6FA]"
                    }`}
                  >
                    <Code2 size={12} />
                    <span>Starter Code</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditorMode("driver")}
                    className={`px-2.5 py-1 rounded-md text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                      editorMode === "driver"
                        ? "bg-primary text-white"
                        : "text-slate-600 hover:text-[#324158] hover:bg-[#F5F6FA]"
                    }`}
                  >
                    <Terminal size={12} />
                    <span>Driver Runner</span>
                  </button>
                </div>

                {/* Language Switcher + Reset */}
                <div className="flex items-center gap-2">
                  {q.languages.length > 0 && (
                    <div className="flex items-center gap-1 overflow-x-auto max-w-[280px] sm:max-w-none">
                      {q.languages.map((lang) => {
                        const key = normalizeLangKey(lang)
                        const isActive = activeLang === key
                        return (
                          <button
                            key={lang}
                            type="button"
                            onClick={() => setActiveLang(key)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer shrink-0 ${
                              isActive
                                ? "bg-[#eaf0f8] text-[#324158] border-[#324158]"
                                : "bg-white text-slate-600 border-[#cbd5e1] hover:text-[#324158]"
                            }`}
                          >
                            {lang}
                          </button>
                        )
                      })}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleResetEditorCode}
                    title={`Reset ${editorMode === "template" ? "Starter Code" : "Driver Code"} to default`}
                    className="h-7 px-2 rounded-lg border border-[#cbd5e1] bg-white hover:bg-[#F5F6FA] text-slate-600 hover:text-[#324158] text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                  >
                    <RotateCcw size={11} />
                    <span className="hidden sm:inline">Reset</span>
                  </button>
                </div>
              </div>

              {/* Monaco Editor Body */}
              <div className="flex-1 min-h-0 bg-[#1e2a38] relative">
                {q.languages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-300 p-6 text-center gap-2">
                    <Code2 size={28} className="text-slate-400" />
                    <p className="text-sm font-semibold text-white">No languages enabled</p>
                    <p className="text-xs text-slate-400">
                      Select at least one language in the left Description panel to edit starter and driver code.
                    </p>
                  </div>
                ) : (
                  <Editor
                    height="100%"
                    path={`studio-${q.id}-${editorMode}-${activeLang}`}
                    key={`studio-${editorMode}-${activeLang}`}
                    language={monacoLanguage}
                    theme="sas-dark"
                    beforeMount={(monaco) => {
                      monaco.editor.defineTheme("sas-dark", {
                        base: "vs-dark",
                        inherit: true,
                        rules: [],
                        colors: {
                          "editor.background": "#1e2a38",
                          "editorGutter.background": "#18222e",
                          "editorLineNumber.foreground": "#64748b",
                          "editorLineNumber.activeForeground": "#e2e8f0",
                          "editor.lineHighlightBackground": "#263445",
                        },
                      })
                    }}
                    value={activeEditorValue}
                    onChange={(val) => {
                      const nextVal = val ?? ""
                      if (editorMode === "template") {
                        setQ((prev) => ({
                          ...prev,
                          codeTemplates: { ...prev.codeTemplates, [activeLang]: nextVal },
                        }))
                      } else {
                        setQ((prev) => ({
                          ...prev,
                          driverCode: { ...prev.driverCode, [activeLang]: nextVal },
                        }))
                      }
                    }}
                    options={{
                      minimap: { enabled: false },
                      scrollBeyondLastLine: false,
                      fontSize: 13,
                      lineNumbers: "on",
                      glyphMargin: false,
                      folding: true,
                      lineDecorationsWidth: 10,
                      lineNumbersMinChars: 3,
                      automaticLayout: true,
                      bracketPairColorization: { enabled: true },
                      autoClosingBrackets: "always",
                      autoClosingQuotes: "always",
                      tabSize: 4,
                      padding: { top: 12, bottom: 12 },
                      wordWrap: "on",
                      fixedOverflowWidgets: true,
                      scrollbar: {
                        vertical: "visible",
                        horizontal: "visible",
                        useShadows: false,
                        verticalScrollbarSize: 9,
                        horizontalScrollbarSize: 9,
                      },
                    }}
                    loading={
                      <div className="flex items-center justify-center h-full text-slate-300 text-xs font-mono">
                        Loading Code Studio...
                      </div>
                    }
                  />
                )}
              </div>

              {/* Editor Status Bar */}
              <div className="bg-[#18222e] border-t border-slate-700/70 px-3 py-1.5 flex items-center justify-between text-[11px] shrink-0">
                <span className="text-slate-300 font-medium">
                  {editorMode === "template"
                    ? `Editing Visible Candidate Template (${activeLang})`
                    : `Editing Hidden Internal Driver (${activeLang}) — reads stdin, prints stdout`}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    editorMode === "template"
                      ? "bg-[#324158] text-white border border-slate-600"
                      : "bg-amber-500/20 text-amber-200 border border-amber-400/30"
                  }`}
                >
                  {editorMode === "template" ? "VISIBLE TO CANDIDATE" : "HIDDEN RUNNER"}
                </span>
              </div>
            </div>

            {/* RIGHT BOTTOM: LeetCode Testcase & Test Result Console */}
            <div
              className={`${
                mobilePane === "console" ? "flex" : mobilePane === "editor" ? "hidden lg:flex" : "flex"
              } flex-1 min-h-[210px] flex-col bg-white rounded-xl border border-[#cbd5e1] overflow-hidden shadow-2xs`}
            >
              {/* Console Tab Bar */}
              <div className="bg-[#f8fafc] border-b border-[#cbd5e1] px-3 py-1.5 flex items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setConsoleTab("testcase")}
                    className={`px-2.5 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                      consoleTab === "testcase"
                        ? "bg-white text-[#324158] border border-[#cbd5e1] shadow-2xs"
                        : "text-slate-500 hover:text-[#324158]"
                    }`}
                  >
                    <CheckCircle2 size={13} className="text-emerald-600" />
                    <span>Testcase ({q.testCases.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setConsoleTab("result")}
                    className={`px-2.5 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                      consoleTab === "result"
                        ? "bg-white text-[#324158] border border-[#cbd5e1] shadow-2xs"
                        : "text-slate-500 hover:text-[#324158]"
                    }`}
                  >
                    <Terminal size={13} />
                    <span>Test Result</span>
                    {testSummary && (
                      <span
                        className={`ml-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                          testSummary.totalPassed === testSummary.totalCases
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-rose-100 text-rose-700"
                        }`}
                      >
                        {testSummary.totalPassed}/{testSummary.totalCases}
                      </span>
                    )}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleAddCase}
                  className="h-7 px-2.5 rounded-lg border border-[#cbd5e1] bg-white hover:bg-[#eaf0f8] text-[#324158] text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Plus size={12} />
                  <span>Add Case</span>
                </button>
              </div>

              {/* Console Body */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
                {consoleTab === "testcase" ? (
                  <>
                    {/* Case Tabs Row */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {q.testCases.map((tc, i) => {
                          const isSelected = safeCaseIdx === i
                          const resultItem = testResults?.[i]
                          return (
                            <button
                              key={i}
                              type="button"
                              onClick={() => setActiveCaseIdx(i)}
                              className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                                isSelected
                                  ? "bg-primary text-white border-primary shadow-2xs"
                                  : "bg-[#F5F6FA] text-[#324158] border-[#cbd5e1] hover:bg-[#eaf0f8]"
                              }`}
                            >
                              {resultItem && (
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    resultItem.passed ? "bg-emerald-400" : "bg-rose-400"
                                  }`}
                                />
                              )}
                              <span>Case {i + 1}</span>
                              {tc.hidden && <Lock size={10} className="opacity-80" />}
                            </button>
                          )
                        })}
                        <button
                          type="button"
                          onClick={handleAddCase}
                          title="Add new test case"
                          className="w-7 h-7 rounded-lg bg-[#F5F6FA] hover:bg-[#eaf0f8] border border-[#cbd5e1] text-[#324158] flex items-center justify-center transition-colors cursor-pointer"
                        >
                          <Plus size={13} />
                        </button>
                      </div>

                      <div className="flex items-center gap-2.5">
                        <label className="flex items-center gap-1.5 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={Boolean(currentCase.hidden)}
                            onChange={(e) => {
                              const checked = e.target.checked
                              setQ((prev) => ({
                                ...prev,
                                testCases: prev.testCases.map((tc, idx) =>
                                  idx === safeCaseIdx ? { ...tc, hidden: checked } : tc
                                ),
                              }))
                            }}
                            className="rounded border-[#cbd5e1] text-[#324158] focus:ring-[#324158]"
                          />
                          <span className="text-[11px] font-bold text-slate-600">Hidden Case</span>
                        </label>
                        {q.testCases.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleDeleteCase(safeCaseIdx)}
                            title="Delete current test case"
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Active Case Input / Expected Output */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                          Input (stdin)
                        </label>
                        <textarea
                          rows={4}
                          value={currentCase.input}
                          onChange={(e) => {
                            const val = e.target.value
                            setQ((prev) => ({
                              ...prev,
                              testCases: prev.testCases.map((tc, idx) =>
                                idx === safeCaseIdx ? { ...tc, input: val } : tc
                              ),
                            }))
                          }}
                          placeholder="e.g. [2,7,11,15]\n9"
                          className="w-full p-2.5 text-xs font-mono bg-white border border-[#cbd5e1] rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#324158]/20 focus:border-[#324158] resize-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                          Expected Output (stdout)
                        </label>
                        <textarea
                          rows={4}
                          value={currentCase.expectedOutput}
                          onChange={(e) => {
                            const val = e.target.value
                            setQ((prev) => ({
                              ...prev,
                              testCases: prev.testCases.map((tc, idx) =>
                                idx === safeCaseIdx ? { ...tc, expectedOutput: val } : tc
                              ),
                            }))
                          }}
                          placeholder="e.g. [0,1]"
                          className="w-full p-2.5 text-xs font-mono bg-white border border-[#cbd5e1] rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#324158]/20 focus:border-[#324158] resize-none"
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="space-y-3">
                    {isTesting && (
                      <div className="flex items-center justify-center py-8 gap-2.5 text-xs font-semibold text-[#324158]">
                        <Loader2 size={16} className="animate-spin" />
                        <span>Executing {activeLang} code against {q.testCases.length} test case(s)...</span>
                      </div>
                    )}

                    {!isTesting && testError && (
                      <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-semibold flex items-center gap-2">
                        <AlertCircle size={15} className="shrink-0" />
                        <span>{testError}</span>
                      </div>
                    )}

                    {!isTesting && !testError && !testResults && (
                      <div className="flex flex-col items-center justify-center py-7 text-center space-y-2">
                        <p className="text-xs text-slate-500">
                          Run your Starter Code + Driver Runner against your Test Cases to verify output before saving.
                        </p>
                        <button
                          type="button"
                          onClick={handleRunTests}
                          className="h-8 px-3.5 rounded-xl bg-primary hover:bg-[#253244] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                        >
                          <Play size={12} /> Run Sample Tests
                        </button>
                      </div>
                    )}

                    {!isTesting && testResults && (
                      <div className="space-y-2.5">
                        {testSummary && (
                          <div className="flex items-center justify-between bg-[#F5F6FA] border border-[#cbd5e1] rounded-xl px-3 py-2">
                            <span
                              className={`text-xs font-bold ${
                                testSummary.totalPassed === testSummary.totalCases
                                  ? "text-emerald-700"
                                  : "text-rose-700"
                              }`}
                            >
                              {testSummary.totalPassed === testSummary.totalCases
                                ? "Accepted — All test cases passed"
                                : `${testSummary.totalPassed} / ${testSummary.totalCases} test cases passed`}
                            </span>
                            <span className="text-[11px] font-semibold text-slate-500 uppercase">
                              {activeLang}
                            </span>
                          </div>
                        )}

                        <div className="space-y-2">
                          {testResults.map((res, idx) => (
                            <div
                              key={idx}
                              className="p-2.5 rounded-xl border border-[#cbd5e1] bg-[#F5F6FA] space-y-1.5"
                            >
                              <div className="flex items-center justify-between text-xs">
                                <div className="flex items-center gap-2 font-bold text-[#324158]">
                                  <span>Case {idx + 1}</span>
                                  <span
                                    className={`text-[10px] px-2 py-0.5 rounded-full ${
                                      res.passed
                                        ? "bg-emerald-100 text-emerald-700"
                                        : "bg-rose-100 text-rose-700"
                                    }`}
                                  >
                                    {res.status || (res.passed ? "Passed" : "Failed")}
                                  </span>
                                </div>
                                {res.time && (
                                  <span className="text-[11px] font-mono text-slate-500">
                                    {res.time}s
                                  </span>
                                )}
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono text-[11px]">
                                <div className="bg-white border border-[#cbd5e1] rounded-lg p-2">
                                  <span className="text-[9px] font-bold text-slate-400 uppercase block mb-0.5">
                                    Input
                                  </span>
                                  <span className="text-slate-800 whitespace-pre-wrap break-all">
                                    {res.input ?? "(hidden)"}
                                  </span>
                                </div>
                                <div className="bg-white border border-[#cbd5e1] rounded-lg p-2">
                                  <span className="text-[9px] font-bold text-slate-400 uppercase block mb-0.5">
                                    Expected
                                  </span>
                                  <span className="text-slate-800 whitespace-pre-wrap break-all">
                                    {res.expectedOutput ?? "(hidden)"}
                                  </span>
                                </div>
                                <div className="bg-white border border-[#cbd5e1] rounded-lg p-2">
                                  <span className="text-[9px] font-bold text-slate-400 uppercase block mb-0.5">
                                    Output / Error
                                  </span>
                                  <span
                                    className={`whitespace-pre-wrap break-all ${
                                      res.stderr ? "text-rose-600" : "text-slate-800"
                                    }`}
                                  >
                                    {res.stderr || res.actualOutput || "(empty)"}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

