"use client"

import { useState, useEffect, useCallback, use } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { CheckCircle2, Circle, ChevronDown, Play, Flag } from "lucide-react"
import { ExamHeader, ProctoringCamera } from "@/components/exam/ExamShared"
import { ProctoringWarning } from "@/components/exam/ProctoringWarning"
import { useProctoring } from "@/hooks/use-proctoring"
import { CodingPageSkeleton } from "@/components/SkeletonLoaders"

interface TestCase { input: string; expectedOutput: string; hidden?: boolean }
interface CodingQuestion {
  _id: string
  questionText: string
  marks: number
  difficulty?: string
  codeTemplate?: string
  testCases?: TestCase[]
  constraints?: string[]
  timeLimit?: number
  memoryLimit?: number
}
interface ExamData {
  _id: string
  title: string
  duration: number
  sections: { name: string; type: string; questionRange: string; questions: CodingQuestion[] }[]
  proctoring: { enabled: boolean; tabSwitch: boolean; fullscreenExit: boolean; faceDetection: boolean; maxWarnings: number }
}

const LANGUAGES = ["Python 3", "Java", "C++", "JavaScript"]

const DEFAULT_CODE: Record<string, string> = {
  "Python 3": `class Solution:\n    def solve(self):\n        # Write your solution here\n        pass`,
  Java: `class Solution {\n    public int[] solve() {\n        // Write your solution here\n        return new int[]{};\n    }\n}`,
  "C++": `#include <vector>\nusing namespace std;\n\nclass Solution {\npublic:\n    vector<int> solve() {\n        // Write your solution here\n        return {};\n    }\n};`,
  JavaScript: `/**\n * @param {number[]} nums\n * @param {number} target\n * @return {number[]}\n */\nvar solve = function(nums, target) {\n    // Write your solution here\n};`,
}

export default function CodingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const searchParams = useSearchParams()
  const attemptId = searchParams.get("attemptId")
  const router = useRouter()

  const [exam, setExam] = useState<ExamData | null>(null)
  const [timeLeft, setTimeLeft] = useState(0)
  const [currentQ, setCurrentQ] = useState(0)
  const [lang, setLang] = useState("Python 3")
  const [codes, setCodes] = useState<Record<string, string>>({})
  const [activeCase, setActiveCase] = useState(0)
  const [testResults, setTestResults] = useState<Record<number, { output: string; passed: boolean } | null>>({})
  const [running, setRunning] = useState(false)
  const [activeTab, setActiveTab] = useState<"problem" | "code" | "tests">("code")
  const [activeWarning, setActiveWarning] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!attemptId) { router.push(`/exam/${id}`); return }
    fetch(`/api/exams/${id}`).then((r) => r.json()).then((d) => {
      setExam(d.exam)
      setTimeLeft(d.exam.duration * 60)
      // Seed default code for each question
      const section = d.exam.sections?.find((s: { type: string }) => s.type === "coding")
      if (section) {
        const initCodes: Record<string, string> = {}
        section.questions.forEach((q: CodingQuestion) => {
          initCodes[q._id] = q.codeTemplate || DEFAULT_CODE["Python"]
        })
        setCodes(initCodes)
      }
    })
  }, [id, attemptId, router])

  const handleAutoSubmit = useCallback(() => {
    if (!attemptId || !exam) return
    setSubmitting(true)
    const section = exam.sections.find((s) => s.type === "coding")
    const answers = section?.questions.map((q) => ({
      questionId: q._id,
      sectionType: "coding",
      answer: codes[q._id] ?? "",
    })) ?? []
    fetch(`/api/attempts/${attemptId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers, autoSubmit: true }),
    }).then(() => router.push(`/exam/${id}/result?attemptId=${attemptId}`))
  }, [attemptId, exam, codes, id, router])

  const { state: procState, requestFullscreen } = useProctoring({
    attemptId,
    maxWarnings: exam?.proctoring?.maxWarnings ?? 3,
    enableFaceDetection: exam?.proctoring?.faceDetection ?? false,
    enableTabSwitch: exam?.proctoring?.tabSwitch ?? true,
    enableFullscreen: exam?.proctoring?.fullscreenExit ?? true,
    onAutoSubmit: handleAutoSubmit,
    onWarning: (type) => setActiveWarning(type),
  })

  useEffect(() => {
    if (exam?.proctoring?.fullscreenExit) requestFullscreen()
  }, [exam, requestFullscreen])

  useEffect(() => {
    if (!exam || timeLeft <= 0) return
    const t = setInterval(() => setTimeLeft((p) => { if (p <= 1) { clearInterval(t); handleAutoSubmit(); return 0 } return p - 1 }), 1000)
    return () => clearInterval(t)
  }, [exam, handleAutoSubmit, timeLeft])

  const handleRunCode = async () => {
    if (!exam) return
    const section = exam.sections.find((s) => s.type === "coding")
    const q = section?.questions[currentQ]
    if (!q?.testCases?.length) return
    setRunning(true)
    // Simulate run (in a real app this would call a code execution API)
    await new Promise((r) => setTimeout(r, 1200))
    const results: Record<number, { output: string; passed: boolean }> = {}
    q.testCases.forEach((tc, i) => {
      results[i] = { output: tc.expectedOutput, passed: Math.random() > 0.3 }
    })
    setTestResults(results)
    setRunning(false)
  }

  const handleSubmitCode = async () => {
    if (!attemptId || !exam) return
    setSubmitting(true)
    const section = exam.sections.find((s) => s.type === "coding")
    const answers = section?.questions.map((q) => ({
      questionId: q._id,
      sectionType: "coding",
      answer: codes[q._id] ?? "",
    })) ?? []
    await fetch(`/api/attempts/${attemptId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers, autoSubmit: false, timeSpent: exam.duration * 60 - timeLeft }),
    })
    router.push(`/exam/${id}/result?attemptId=${attemptId}`)
  }

  if (!exam) return <CodingPageSkeleton />

  const section = exam.sections.find((s) => s.type === "coding")
  if (!section) return <div className="flex h-screen items-center justify-center text-gray-400">No coding section found.</div>

  const questions = section.questions
  const question = questions[currentQ]
  const currentCode = codes[question?._id] ?? DEFAULT_CODE[lang]
  const testCases = question?.testCases ?? []

  const sectionTabs = exam.sections.map((s, i) => {
    const paths: Record<string, string> = { mcq: "take", truefalse: "take", descriptive: "descriptive", fillblanks: "fill-blanks", coding: "coding" }
    return { label: `${s.name} (${s.questionRange})`, path: paths[s.type] ?? "take" }
  })

  return (
    <div className="flex flex-col h-screen bg-white overflow-hidden">
      <ProctoringWarning
        warningCount={procState.warnings}
        maxWarnings={exam?.proctoring?.maxWarnings ?? 3}
        warningType={activeWarning}
        onDismiss={() => setActiveWarning(null)}
        autoSubmitted={procState.autoSubmitted}
      />

      <ExamHeader
        title={exam?.title || "Loading"}
        section={section?.name || ""}
        timeLeft={timeLeft}
        duration={exam?.duration || 0}
        studentName="Student"
        rollNo="N/A"
        onSubmit={handleSubmitCode}
        warningCount={procState.warnings}
        maxWarnings={exam?.proctoring?.maxWarnings ?? 3}
      />

      <div className="flex-1 overflow-y-auto">
        {/* Question Metadata Section */}
        <div className="bg-white border-b border-gray-100 px-4 py-3 sticky top-0 z-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="px-3 py-1.5 bg-[#2D3A4A] text-white text-sm font-bold rounded">Q{currentQ + 1}</div>
            <div className="px-3 py-1.5 bg-blue-100 text-blue-600 text-xs font-semibold rounded-full">{question?.marks} Marks</div>
            {question?.difficulty && (
              <div className={`px-3 py-1.5 text-xs font-semibold rounded-full ${
                question.difficulty === "easy" ? "bg-green-100 text-green-600" :
                question.difficulty === "medium" ? "bg-yellow-100 text-yellow-600" :
                "bg-red-100 text-red-600"
              }`}>
                {question.difficulty.charAt(0).toUpperCase() + question.difficulty.slice(1)}
              </div>
            )}
            <button onClick={() => {}} className="ml-auto p-1 hover:bg-gray-100 rounded">
              <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
              </svg>
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-6 border-t border-gray-100 pt-3">
            {(["problem", "code", "tests"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-2 text-sm font-semibold transition-colors relative ${
                  activeTab === tab
                    ? "text-[#2D3A4A]"
                    : "text-gray-500 hover:text-gray-700"
                } ${activeTab === tab ? "border-b-2 border-[#2D3A4A]" : ""}`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Content Area */}
        <div className="px-4 py-4">
          {/* Problem Tab */}
          {activeTab === "problem" && question && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-[#1a2535] mb-3">Problem Description</h2>
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{question.questionText}</p>
              </div>

              {testCases.filter((tc) => !tc.hidden).length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-[#1a2535] mb-3">Examples</h3>
                  <div className="space-y-3">
                    {testCases.filter((tc) => !tc.hidden).map((tc, i) => (
                      <div key={i} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                        <p className="text-xs font-bold text-gray-600 mb-2">Example {i + 1}</p>
                        <div className="font-mono text-xs text-gray-700 space-y-1">
                          <p><span className="font-semibold">Input:</span> {tc.input}</p>
                          <p><span className="font-semibold">Output:</span> {tc.expectedOutput}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {question.constraints && question.constraints.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-[#1a2535] mb-3">Constraints</h3>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    {question.constraints.map((c, i) => (
                      <p key={i} className="text-xs text-amber-700 font-medium">• {c}</p>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-4 text-xs text-gray-500">
                {question.timeLimit && <span>⏱️ Time Limit: {question.timeLimit}s</span>}
                {question.memoryLimit && <span>💾 Memory: {question.memoryLimit} MB</span>}
              </div>
            </div>
          )}

          {/* Code Tab */}
          {activeTab === "code" && (
            <div className="space-y-3">
              {/* Language Selector */}
              <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
                <span className="text-sm font-bold text-gray-600">Language:</span>
                <div className="flex gap-2">
                  {LANGUAGES.map((l) => (
                    <button
                      key={l}
                      onClick={() => setLang(l)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors ${
                        l === lang
                          ? "bg-[#2D3A4A] text-white"
                          : "border border-gray-200 text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              {/* Code Editor */}
              <div className="bg-[#1e1e2e] rounded-lg overflow-hidden border border-gray-700">
                <div className="flex">
                  <div className="p-3 pr-2 select-none bg-[#252535] border-r border-gray-700">
                    {currentCode.split("\n").map((_, i) => (
                      <div key={i} className="text-gray-600 text-xs font-mono leading-6 text-right pr-2 min-w-[32px]">
                        {i + 1}
                      </div>
                    ))}
                  </div>
                  <textarea
                    value={currentCode}
                    onChange={(e) => setCodes((p) => ({ ...p, [question._id]: e.target.value }))}
                    className="flex-1 p-3 bg-transparent text-gray-200 font-mono text-xs leading-6 resize-none focus:outline-none"
                    spellCheck={false}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleRunCode}
                  disabled={running}
                  className="flex-1 px-4 py-3 border-2 border-gray-300 text-gray-700 font-bold text-sm rounded-lg hover:bg-gray-50 disabled:opacity-60 flex items-center justify-center gap-2 transition-colors"
                >
                  <Play size={18} />
                  {running ? "Running..." : "Run Code"}
                </button>
                <button
                  onClick={handleSubmitCode}
                  disabled={submitting}
                  className="flex-1 px-4 py-3 bg-[#10B981] text-white font-bold text-sm rounded-lg hover:bg-[#059669] disabled:opacity-60 transition-colors"
                >
                  {submitting ? "Submitting..." : "Submit"}
                </button>
              </div>
            </div>
          )}

          {/* Test Results Tab */}
          {activeTab === "tests" && (
            <div className="space-y-3">
              {Object.keys(testResults).length > 0 ? (
                <>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-sm font-bold text-gray-600">Test Results:</span>
                    <span className="text-sm font-bold text-[#10B981]">
                      {Object.values(testResults).filter(r => r?.passed).length}/{Object.keys(testResults).length} Passed
                    </span>
                  </div>
                  <div className="space-y-2">
                    {testCases.filter((_, i) => testResults[i]).map((tc, i) => (
                      <div key={i} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center gap-3 mb-3">
                          <span className="text-sm font-bold text-gray-600">Test {i + 1}</span>
                          <span className={`text-xs font-semibold px-2 py-1 rounded ${
                            testResults[i]?.passed
                              ? "bg-green-100 text-[#10B981]"
                              : "bg-red-100 text-red-600"
                          }`}>
                            {testResults[i]?.passed ? "✓ Passed" : "✗ Failed"}
                          </span>
                          {tc.input && <span className="ml-auto text-xs text-gray-500">{tc.input}</span>}
                        </div>
                        <div className="font-mono text-xs text-gray-700 space-y-1">
                          <p><span className="font-semibold">Expected:</span> {tc.expectedOutput}</p>
                          <p><span className="font-semibold">Your Output:</span> {testResults[i]?.output}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                  <Circle size={32} className="mb-2 opacity-20" />
                  <p className="text-sm">Run code to see test results</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="bg-white border-t border-gray-100 px-4 py-3 flex items-center justify-between text-sm">
        <button onClick={() => setCurrentQ(Math.max(0, currentQ - 1))} className="p-2 hover:bg-gray-100 rounded">
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-gray-600">{currentQ + 1}/{questions.length}</span>
          <button onClick={() => {}} className="p-2 hover:bg-gray-100 rounded" title="Mark for review">
            <Flag size={18} className="text-gray-600" />
          </button>
        </div>

        <button onClick={() => setCurrentQ(Math.min(questions.length - 1, currentQ + 1))} className="p-2 hover:bg-gray-100 rounded">
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  )
}
