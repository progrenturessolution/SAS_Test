"use client"

import { useState, useRef, useEffect, use, ReactNode } from "react"
import { createPortal } from "react-dom"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import {
  Check, Plus, X, Trash2, Search, AlertCircle, Info,
  FileText, CheckSquare, List, Code2, AlignLeft, Loader2, Upload, Pencil, MoreVertical,
  Shield, Camera, Maximize, AlertTriangle
} from "lucide-react"

// ─── Types (same as create page) ─────────────────────────────────────────────

type Difficulty = "easy" | "medium" | "hard"
type QuestionType = "mcq" | "truefalse" | "descriptive" | "fillblanks" | "coding"

interface MCQQuestion {
  id: string; type: "mcq"
  questionText: string; difficulty: Difficulty; marks: number
  negativeMark?: number
  options: string[]; correctAnswer: string; explanation: string
  questionImage?: string; optionImages?: string[]; codeSnippet?: string
}
interface TrueFalseQuestion {
  id: string; type: "truefalse"
  questionText: string; difficulty: Difficulty; marks: number
  negativeMark?: number
  correctAnswer: "True" | "False"; explanation: string
  questionImage?: string; codeSnippet?: string
}
interface DescriptiveQuestion {
  id: string; type: "descriptive"
  questionText: string; difficulty: Difficulty; marks: number
  negativeMark?: number
  wordLimit: string; modelAnswer: string; rubric: string[]
  questionImage?: string; codeSnippet?: string
}
interface FillBlanksQuestion {
  id: string; type: "fillblanks"
  questionText: string; difficulty: Difficulty; marks: number
  negativeMark?: number
  blanks: { answer: string; alsoAccept: string[] }[]
  caseInsensitive: boolean
  questionImage?: string; codeSnippet?: string
}
interface CodingQuestion {
  id: string; type: "coding"
  questionText: string; difficulty: Difficulty; marks: number
  negativeMark?: number
  codeTemplate: string
  codeTemplates: Record<string, string>
  driverCode: Record<string, string>
  testCases: { input: string; expectedOutput: string; hidden?: boolean }[]
  constraints: string[]; languages: string[]
  questionImage?: string
}
type Question = MCQQuestion | TrueFalseQuestion | DescriptiveQuestion | FillBlanksQuestion | CodingQuestion

interface Step1Form {
  title: string; duration: string
  passMarks: string; totalMarks: string; instructions: string; questionsPerMin: string
}
interface Step2Form {
  startDate: string; startTime: string; endDate: string; endTime: string
  randomize: boolean; showResults: boolean; allowReview: boolean; negativeMarking: boolean
  sectionNegativeMark: number;
  proctoring: {
    faceDetection: boolean
    tabSwitch: boolean
    fullscreen: boolean
    aiProctoring: boolean
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const inputCls = "w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
const labelCls = "block text-sm font-medium text-[#2D3A4A] mb-1.5"

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_TEMPLATES: Record<string, string> = {
  python: "class Solution:\n    def solve(self, input_val):\n        # Write your code here\n        pass\n",
  javascript: "class Solution {\n    solve(inputVal) {\n        // Write your code here\n    }\n}\n",
  java: "public class Solution {\n    public Object solve(Object inputVal) {\n        // Write your code here\n        return null;\n    }\n}",
  cpp: "#include <iostream>\n#include <string>\n#include <vector>\n\nclass Solution {\npublic:\n    std::string solve(std::string input) {\n        // Write your code here\n        return \"\";\n    }\n};",
  go: "package main\n\nimport \"fmt\"\n\ntype Solution struct{}\n\nfunc (s *Solution) Solve(input interface{}) interface{} {\n    // Write your code here\n    return nil\n}",
  rust: "struct Solution;\n\nimpl Solution {\n    pub fn solve(input: String) -> String {\n        // Write your code here\n        String::new()\n    }\n}"
}

const DEFAULT_DRIVERS: Record<string, string> = {
  python: "if __name__ == '__main__':\n    import sys, json\n    sol = Solution()\n    for line in sys.stdin:\n        if not line.strip(): continue\n        try:\n            data = json.loads(line)\n            result = sol.solve(*data) if isinstance(data, list) else sol.solve(data)\n            print(json.dumps(result))\n        except Exception as e: sys.stderr.write(str(e))",
  javascript: "const readline = require('readline');\nconst rl = readline.createInterface({ input: process.stdin });\nconst sol = new Solution();\nrl.on('line', (line) => {\n    if (!line.trim()) return;\n    try {\n        const data = JSON.parse(line);\n        const result = Array.isArray(data) ? sol.solve(...data) : sol.solve(data);\n        console.log(JSON.stringify(result));\n    }\n    catch (e) { console.error(e); }\n});",
  java: "import java.util.Scanner;\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        Solution sol = new Solution();\n        while (sc.hasNextLine()) {\n            String line = sc.nextLine();\n            if (line.trim().isEmpty()) continue;\n            System.out.println(sol.solve(line));\n        }\n    }\n}",
  cpp: "#include <iostream>\n#include <string>\nint main() {\n    std::string line;\n    Solution sol;\n    while (std::getline(std::cin, line)) {\n        if (line.empty()) continue;\n        std::cout << sol.solve(line) << std::endl;\n    }\n    return 0;\n}",
  go: "func main() {\n    var input string\n    sol := Solution{}\n    for {\n        _, err := fmt.Scanln(&input)\n        if err != nil { break }\n        fmt.Println(sol.Solve(input))\n    }\n}",
  rust: "fn main() {\n    use std::io::{self, BufRead};\n    let stdin = io::stdin();\n    for line in stdin.lock().lines() {\n        let s = line.unwrap();\n        if s.trim().is_empty() { continue; }\n        println!(\"{}\", Solution::solve(s));\n    }\n}"
}

const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  easy: "bg-green-100 text-green-700",
  medium: "bg-yellow-100 text-yellow-700",
  hard: "bg-red-100 text-red-700",
}

const TYPE_META: Record<QuestionType, { label: string; color: string; icon: React.ReactNode }> = {
  mcq:         { label: "MCQ",         color: "bg-blue-100 text-blue-700",     icon: <List size={13}/> },
  descriptive: { label: "Descriptive", color: "bg-purple-100 text-purple-700", icon: <AlignLeft size={13}/> },
  truefalse:   { label: "True/False",  color: "bg-teal-100 text-teal-700",     icon: <CheckSquare size={13}/> },
  fillblanks:  { label: "Fill Blanks", color: "bg-amber-100 text-amber-700",   icon: <FileText size={13}/> },
  coding:      { label: "Coding",      color: "bg-red-100 text-red-700",       icon: <Code2 size={13}/> },
}

// ─── Stepper ──────────────────────────────────────────────────────────────────

function Stepper({ step }: { step: number }) {
  const steps = [{ n: 1, label: "Exam Details" }, { n: 2, label: "Settings" }, { n: 3, label: "Questions" }]
  return (
    <div className="flex items-center justify-center gap-0">
      {steps.map((s, i) => (
        <div key={s.n} className="flex items-center">
          <div className="flex flex-col items-center gap-1">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-all
              ${step > s.n ? "bg-primary border-primary text-white"
                : step === s.n ? "bg-[#2D3A4A] border-[#2D3A4A] text-white"
                : "bg-white border-gray-200 text-gray-400"}`}>
              {step > s.n ? <Check size={16}/> : s.n}
            </div>
            <div className="text-center">
              <p className={`text-[10px] uppercase tracking-wide font-semibold ${step >= s.n ? "text-[#2D3A4A]" : "text-gray-400"}`}>STEP {s.n}</p>
              <p className={`text-xs font-medium ${step >= s.n ? "text-primary" : "text-gray-400"}`}>{s.label}</p>
            </div>
          </div>
          {i < steps.length - 1 && (
            <div className={`w-24 h-0.5 mx-3 mb-5 transition-colors ${step > s.n ? "bg-primary" : "bg-gray-200"}`} />
          )}
        </div>
      ))}
    </div>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button type="button" onClick={onChange}
      className={`relative w-12 h-6 rounded-full transition-colors focus:outline-none ${checked ? "bg-[#2D3A4A]" : "bg-gray-200"}`}>
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? "translate-x-6" : "translate-x-0"}`} />
    </button>
  )
}

// ─── Step 1 ───────────────────────────────────────────────────────────────────

function Step1({ form, setForm }: { form: Step1Form; setForm: React.Dispatch<React.SetStateAction<Step1Form>> }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-8">
      <h2 className="text-xl font-bold text-[#2D3A4A] mb-6">Basic Information</h2>
      <div className="space-y-5">
        <div>
          <label className={labelCls}>Exam Title <span className="text-red-500">*</span></label>
          <input value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))}
            placeholder="Enter exam title..." className={inputCls} />
        </div>
        <div className="grid grid-cols-2 gap-5">
          <div>
            <label className={labelCls}>Duration (minutes) <span className="text-red-500">*</span></label>
            <input type="number" value={form.duration} onChange={e => setForm(f => ({...f, duration: e.target.value}))}
              placeholder="e.g., 60" min="1" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Questions Per Minute <span className="text-xs text-gray-400 font-normal">(Optional)</span></label>
            <input type="number" value={form.questionsPerMin} onChange={e => setForm(f => ({...f, questionsPerMin: e.target.value}))}
              placeholder="e.g., 1.5" min="0.1" step="0.1" className={inputCls} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-5">
          <div>
            <label className={labelCls}>Pass Marks <span className="text-red-500">*</span></label>
            <input type="number" value={form.passMarks} onChange={e => setForm(f => ({...f, passMarks: e.target.value}))}
              placeholder="e.g., 40" min="0" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Total Marks <span className="text-red-500">*</span></label>
            <input type="number" value={form.totalMarks} onChange={e => setForm(f => ({...f, totalMarks: e.target.value}))}
              placeholder="e.g., 100" min="1" className={inputCls} />
          </div>
        </div>
        <div>
          <label className={labelCls}>Instructions</label>
          <textarea value={form.instructions} onChange={e => setForm(f => ({...f, instructions: e.target.value}))}
            rows={4} placeholder="Enter exam instructions for students..." className={inputCls + " resize-none"} />
        </div>
      </div>
    </div>
  )
}

// ─── Step 2 ───────────────────────────────────────────────────────────────────

function Step2({ form, setForm }: { form: Step2Form; setForm: React.Dispatch<React.SetStateAction<Step2Form>> }) {
  const toggles: { key: keyof Step2Form; label: string; desc: string }[] = [
    { key: "randomize",      label: "Randomize Questions",    desc: "Display questions in random order for each student" },
    { key: "showResults",    label: "Show Results Immediately", desc: "Students can see their results right after submission" },
    { key: "allowReview",    label: "Allow Review",            desc: "Students can review their answers after submission" },
    { key: "negativeMarking", label: "Enable Negative Marking", desc: "Deduct marks for wrong answers" },
  ]

  const proctoringToggles = [
    { key: "faceDetection", label: "Face Detection", desc: "Monitors candidate through camera", icon: <Camera size={16} /> },
    { key: "tabSwitch",     label: "Tab-Switch Prevention", desc: "Warns when student leaves the tab", icon: <AlertTriangle size={16} /> },
    { key: "fullscreen",    label: "Enforce Fullscreen", desc: "Exits exam if fullscreen is closed", icon: <Maximize size={16} /> },
    { key: "aiProctoring",  label: "AI Status Analysis", desc: "Analyzes face positioning and focus", icon: <Shield size={16} /> },
  ] as const

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm">
      <h2 className="text-xl font-bold text-[#2D3A4A] mb-6">Exam Settings</h2>
      <div className="space-y-8">
        <div>
          <h3 className="text-base font-bold text-[#2D3A4A] mb-4 flex items-center gap-2">
            <div className="w-1.5 h-6 bg-[#3D4B5C] rounded-full" />
            Schedule & Timeline
          </h3>
          <div className="grid grid-cols-2 gap-6 bg-gray-50/50 p-6 rounded-2xl border border-gray-100">
            <div>
              <label className={labelCls}>Start Date and Time</label>
              <div className="flex gap-2">
                <input type="date" value={form.startDate} onChange={e => setForm(f => ({...f, startDate: e.target.value}))} className={inputCls} />
                <input type="time" value={form.startTime} onChange={e => setForm(f => ({...f, startTime: e.target.value}))} className={inputCls} />
              </div>
            </div>
            <div>
              <label className={labelCls}>End Date and Time</label>
              <div className="flex gap-2">
                <input type="date" value={form.endDate} onChange={e => setForm(f => ({...f, endDate: e.target.value}))} className={inputCls} />
                <input type="time" value={form.endTime} onChange={e => setForm(f => ({...f, endTime: e.target.value}))} className={inputCls} />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <h3 className="text-base font-bold text-[#2D3A4A] mb-4 flex items-center gap-2">
              <div className="w-1.5 h-6 bg-[#3D4B5C] rounded-full" />
              Evaluation Options
            </h3>
            <div className="space-y-3">
              {toggles.map(t => (
                <div key={t.key} className="flex flex-col border border-transparent rounded-xl hover:border-gray-200 transition-all">
                  <div className="flex items-center justify-between p-3">
                    <div className="flex-1 pr-4">
                      <p className="text-sm font-bold text-[#2D3A4A]">{t.label}</p>
                      <p className="text-[11px] text-gray-500 font-medium leading-relaxed mt-0.5">{t.desc}</p>
                    </div>
                    <Toggle checked={form[t.key] as boolean} onChange={() => setForm(f => ({...f, [t.key]: !f[t.key]}))} />
                  </div>
                  {t.key === "negativeMarking" && form.negativeMarking && (
                    <div className="pb-4 px-4">
                       <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                        <label className="text-[11px] font-bold text-gray-500 uppercase mb-2 block">Default Negative Mark</label>
                        <input
                          type="number"
                          step="0.25"
                          min="0"
                          value={form.sectionNegativeMark}
                          onChange={e => setForm(f => ({...f, sectionNegativeMark: +e.target.value}))}
                          className={`${inputCls} bg-white`}
                          placeholder="e.g. 0.25"
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-base font-bold text-[#2D3A4A] mb-4 flex items-center gap-2">
              <div className="w-1.5 h-6 bg-red-400 rounded-full" />
              Proctoring Security
            </h3>
            <div className="space-y-3">
              {proctoringToggles.map(pt => (
                <div key={pt.key} className="flex items-center justify-between p-3 rounded-xl border border-transparent hover:border-gray-200 hover:bg-white transition-all bg-gray-50/50">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${form.proctoring[pt.key] ? 'bg-primary/10 text-primary' : 'bg-gray-200 text-gray-400'}`}>
                      {pt.icon}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[#2D3A4A]">{pt.label}</p>
                      <p className="text-[11px] text-gray-500 font-medium mt-0.5">{pt.desc}</p>
                    </div>
                  </div>
                  <Toggle 
                    checked={form.proctoring[pt.key]} 
                    onChange={() => setForm(f => ({
                      ...f, 
                      proctoring: { ...f.proctoring, [pt.key]: !f.proctoring[pt.key] }
                    }))} 
                  />
                </div>
              ))}
              <div className="mt-4 p-4 bg-blue-50/50 rounded-xl border border-blue-100/50 border-dashed">
                <p className="text-[10px] text-blue-600 font-bold uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                   <Info size={12} /> Pro-Tip
                </p>
                <p className="text-xs text-blue-800 leading-relaxed font-medium">
                  Enabling Face Detection & AI Status Analysis requires students to have a working webcam.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Step 3 (Questions) ───────────────────────────────────────────────────────

type ModalType = QuestionType | null

function ModalShell({ title, icon, onClose, children }: {
  title: string; icon: React.ReactNode; onClose: () => void; children: React.ReactNode
}) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  
  if (!mounted) return null
  
  return createPortal(
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col pointer-events-auto">
          <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
            {icon}
            <h3 className="text-lg font-bold text-[#2D3A4A] flex-1">{title}</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
          </div>
          <div className="overflow-y-auto flex-1 px-6 py-4">{children}</div>
        </div>
      </div>
    </>,
    document.body
  )
}

function ModalFooter({ note, onCancel, onSave }: { note: string; onCancel: () => void; onSave: () => void }) {
  return (
    <div className="flex items-center justify-between pt-4 border-t border-gray-100 mt-4">
      <p className="text-xs text-gray-400">{note}</p>
      <div className="flex gap-2">
        <button onClick={onCancel} className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
        <button onClick={onSave} className="px-4 py-2 rounded-lg bg-[#2D3A4A] text-white text-sm font-medium hover:bg-[#1e2a38]">Save Question</button>
      </div>
    </div>
  )
}

function MCQModal({ onSave, onClose, initial }: { onSave: (q: MCQQuestion) => void; onClose: () => void; initial?: MCQQuestion }) {
  const blank = (): MCQQuestion => ({ id: Math.random().toString(36).slice(2), type: "mcq", questionText: "", difficulty: "medium", marks: 1, options: ["","","",""], correctAnswer: "", explanation: "", questionImage: "", optionImages: ["","","",""], codeSnippet: "" })
  const [q, setQ] = useState<MCQQuestion>(initial ?? blank())
  const [error, setError] = useState("")
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({})
  const save = () => {
    if (!q.questionText.trim()) return setError("Question text is required")
    if (q.options.filter(o => o.trim()).length < 2) return setError("At least 2 options required")
    if (!q.correctAnswer) return setError("Select the correct answer")
    onSave(q); onClose()
  }
  return (
    <ModalShell title={initial ? "Edit MCQ Question" : "Add MCQ Question"} icon={<div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center"><List size={18} className="text-blue-600"/></div>} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className={labelCls}>Question Text *</label>
          <textarea value={q.questionText} onChange={e => setQ({...q, questionText: e.target.value})} rows={4} placeholder="Enter your question..." className={inputCls + " resize-none"} />
        </div>
        <div>
          <label className={labelCls}>Code Snippet <span className="text-gray-400 font-normal">(Optional)</span></label>
          <textarea value={q.codeSnippet || ""} onChange={e => setQ({...q, codeSnippet: e.target.value})} rows={3} placeholder="Paste code snippet here (Python, JavaScript, etc.)..." className="w-full p-3 bg-[#1e2a38] text-white font-mono text-xs rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none" />
        </div>
        <div>
          <label className={labelCls}>Question Image URL <span className="text-gray-400 font-normal">(Optional)</span></label>
          <div className="flex gap-2">
            <input value={q.questionImage || ""} onChange={e => { setQ({...q, questionImage: e.target.value}); setImageErrors({...imageErrors, question: false}) }} 
              placeholder="https://example.com/image.png" className={inputCls} />
          </div>
          {q.questionImage && (
            <div className="mt-2 p-3 border border-gray-200 rounded-lg bg-gray-50">
              <img src={q.questionImage} alt="Question preview" className="max-w-xs max-h-48 rounded-lg object-contain"
                onError={() => setImageErrors({...imageErrors, question: true})} onLoad={() => setImageErrors({...imageErrors, question: false})} />
              {imageErrors.question && <p className="text-xs text-red-500 mt-1">Failed to load image</p>}
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className={labelCls}>Difficulty *</label>
            <select value={q.difficulty} onChange={e => setQ({...q, difficulty: e.target.value as Difficulty})} className={inputCls}>
              <option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option>
            </select></div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>Marks *</label>
              <input type="number" value={q.marks} onChange={e => setQ({...q, marks: +e.target.value})} min={1} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Neg. Mark</label>
              <input type="number" step="0.25" value={q.negativeMark || 0} onChange={e => setQ({...q, negativeMark: +e.target.value})} min={0} className={inputCls} placeholder="0" />
            </div>
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-2"><label className={labelCls + " mb-0"}>OPTIONS</label><span className="text-xs text-gray-400">Click a letter to mark correct</span></div>
          <div className="space-y-3">
            {q.options.map((opt, i) => (
              <div key={i}>
                <div className={`flex items-center gap-3 border rounded-lg px-3 py-2 transition-colors ${q.correctAnswer === String.fromCharCode(65+i) ? "border-[#10B981] bg-green-50" : "border-gray-200"}`}>
                  <button type="button" onClick={() => setQ({...q, correctAnswer: String.fromCharCode(65+i)})}
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${q.correctAnswer === String.fromCharCode(65+i) ? "bg-[#10B981] text-white" : "border-2 border-gray-300 text-gray-400"}`}>
                    {q.correctAnswer === String.fromCharCode(65+i) ? <Check size={13}/> : String.fromCharCode(65+i)}
                  </button>
                  <input value={opt} onChange={e => { const opts = [...q.options]; opts[i] = e.target.value; setQ({...q, options: opts}) }}
                    placeholder={`Option ${String.fromCharCode(65+i)}...`} className="flex-1 text-sm bg-transparent focus:outline-none" />
                </div>
                <div className="flex items-center gap-1.5 border-t border-gray-100 pt-1.5 mt-1">
                  <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Image URL:</span>
                  <input 
                    value={q.optionImages?.[i] || ""} 
                    onChange={e => {
                      const img = [...(q.optionImages || ["","","",""])];
                      img[i] = e.target.value;
                      setQ({...q, optionImages: img})
                    }}
                    placeholder="Optional image URL for this option..."
                    className="flex-1 text-[10px] bg-transparent focus:outline-none border-none p-0 text-blue-500" 
                  />
                </div>
                {q.optionImages?.[i] && (
                  <div className="mt-1 p-2 border border-gray-100 rounded-lg bg-gray-50">
                    <img src={q.optionImages[i]} alt={`Option ${String.fromCharCode(65+i)} preview`} className="max-w-xs max-h-32 rounded-lg object-contain"
                      onError={() => setImageErrors({...imageErrors, [`opt${i}`]: true})} onLoad={() => setImageErrors({...imageErrors, [`opt${i}`]: false})} />
                    {imageErrors[`opt${i}`] && <p className="text-xs text-red-500 mt-1">Failed to load image</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        <div><label className={labelCls}>Explanation <span className="text-gray-400 font-normal">(Optional)</span></label>
          <textarea value={q.explanation} onChange={e => setQ({...q, explanation: e.target.value})} rows={2} className={inputCls + " resize-none"} /></div>
        {error && <p className="text-sm text-red-500 flex items-center gap-1"><AlertCircle size={14}/>{error}</p>}
      </div>
      <ModalFooter note="* required" onCancel={onClose} onSave={save} />
    </ModalShell>
  )
}

function TrueFalseModal({ onSave, onClose, initial }: { onSave: (q: TrueFalseQuestion) => void; onClose: () => void; initial?: TrueFalseQuestion }) {
  const blank = (): TrueFalseQuestion => ({ id: Math.random().toString(36).slice(2), type: "truefalse", questionText: "", difficulty: "medium", marks: 1, correctAnswer: "True", explanation: "", questionImage: "", codeSnippet: "" })
  const [q, setQ] = useState<TrueFalseQuestion>(initial ?? blank())
  const [error, setError] = useState("")
  const [imageError, setImageError] = useState(false)
  const save = () => { if (!q.questionText.trim()) return setError("Question text is required"); onSave(q); onClose() }
  return (
    <ModalShell title={initial ? "Edit True/False" : "Add True/False"} icon={<div className="w-9 h-9 rounded-lg bg-teal-50 flex items-center justify-center"><CheckSquare size={18} className="text-teal-600"/></div>} onClose={onClose}>
      <div className="space-y-4">
        <div><label className={labelCls}>Question Text *</label>
          <textarea value={q.questionText} onChange={e => setQ({...q, questionText: e.target.value})} rows={4} className={inputCls + " resize-none"} /></div>
        <div>
          <label className={labelCls}>Code Snippet <span className="text-gray-400 font-normal">(Optional)</span></label>
          <textarea value={q.codeSnippet || ""} onChange={e => setQ({...q, codeSnippet: e.target.value})} rows={3} placeholder="Paste code snippet here (Python, JavaScript, etc.)..." className="w-full p-3 bg-[#1e2a38] text-white font-mono text-xs rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none" />
        </div>
        <div>
          <label className={labelCls}>Question Image URL <span className="text-gray-400 font-normal">(Optional)</span></label>
          <div className="flex gap-2">
            <input value={q.questionImage || ""} onChange={e => { setQ({...q, questionImage: e.target.value}); setImageError(false) }} 
              placeholder="https://example.com/image.png" className={inputCls} />
          </div>
          {q.questionImage && (
            <div className="mt-2 p-3 border border-gray-200 rounded-lg bg-gray-50">
              <img src={q.questionImage} alt="Question preview" className="max-w-xs max-h-48 rounded-lg object-contain"
                onError={() => setImageError(true)} onLoad={() => setImageError(false)} />
              {imageError && <p className="text-xs text-red-500 mt-1">Failed to load image</p>}
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className={labelCls}>Difficulty</label>
            <select value={q.difficulty} onChange={e => setQ({...q, difficulty: e.target.value as Difficulty})} className={inputCls}>
              <option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option>
            </select></div>
          <div><label className={labelCls}>Marks</label>
            <input type="number" value={q.marks} onChange={e => setQ({...q, marks: +e.target.value})} min={1} className={inputCls} /></div>
        </div>
        <div>
          <label className={labelCls}>Correct Answer</label>
          <div className="flex gap-3">
            {["True","False"].map(v => (
              <button key={v} type="button" onClick={() => setQ({...q, correctAnswer: v as "True"|"False"})}
                className={`flex-1 py-2.5 rounded-lg border-2 text-sm font-semibold transition-colors ${q.correctAnswer === v ? v === "True" ? "border-[#10B981] bg-green-50 text-[#10B981]" : "border-red-400 bg-red-50 text-red-600" : "border-gray-200 text-gray-500"}`}>
                {v}
              </button>
            ))}
          </div>
        </div>
        {error && <p className="text-sm text-red-500 flex items-center gap-1"><AlertCircle size={14}/>{error}</p>}
      </div>
      <ModalFooter note="* required" onCancel={onClose} onSave={save} />
    </ModalShell>
  )
}

function DescriptiveModal({ onSave, onClose, initial }: { onSave: (q: DescriptiveQuestion) => void; onClose: () => void; initial?: DescriptiveQuestion }) {
  const blank = (): DescriptiveQuestion => ({ id: Math.random().toString(36).slice(2), type: "descriptive", questionText: "", difficulty: "medium", marks: 5, wordLimit: "", modelAnswer: "", rubric: [], questionImage: "", codeSnippet: "" })
  const [q, setQ] = useState<DescriptiveQuestion>(initial ?? blank())
  const [error, setError] = useState("")
  const [imageError, setImageError] = useState(false)
  const save = () => { if (!q.questionText.trim()) return setError("Question text is required"); onSave(q); onClose() }
  return (
    <ModalShell title={initial ? "Edit Descriptive" : "Add Descriptive"} icon={<div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center"><AlignLeft size={18} className="text-purple-600"/></div>} onClose={onClose}>
      <div className="space-y-4">
        <div><label className={labelCls}>Question Text *</label>
          <textarea value={q.questionText} onChange={e => setQ({...q, questionText: e.target.value})} rows={4} className={inputCls + " resize-none"} /></div>
        <div>
          <label className={labelCls}>Code Snippet <span className="text-gray-400 font-normal">(Optional)</span></label>
          <textarea value={q.codeSnippet || ""} onChange={e => setQ({...q, codeSnippet: e.target.value})} rows={3} placeholder="Paste code snippet here (Python, JavaScript, etc.)..." className="w-full p-3 bg-[#1e2a38] text-white font-mono text-xs rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none" />
        </div>
        <div>
          <label className={labelCls}>Question Image URL <span className="text-gray-400 font-normal">(Optional)</span></label>
          <div className="flex gap-2">
            <input value={q.questionImage || ""} onChange={e => { setQ({...q, questionImage: e.target.value}); setImageError(false) }} 
              placeholder="https://example.com/image.png" className={inputCls} />
          </div>
          {q.questionImage && (
            <div className="mt-2 p-3 border border-gray-200 rounded-lg bg-gray-50">
              <img src={q.questionImage} alt="Question preview" className="max-w-xs max-h-48 rounded-lg object-contain"
                onError={() => setImageError(true)} onLoad={() => setImageError(false)} />
              {imageError && <p className="text-xs text-red-500 mt-1">Failed to load image</p>}
            </div>
          )}
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div><label className={labelCls}>Difficulty</label>
            <select value={q.difficulty} onChange={e => setQ({...q, difficulty: e.target.value as Difficulty})} className={inputCls}>
              <option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option>
            </select></div>
          <div><label className={labelCls}>Marks</label>
            <input type="number" value={q.marks || ""} onChange={e => setQ({...q, marks: +e.target.value})} min={1} className={inputCls} /></div>
          <div><label className={labelCls}>Word Limit</label>
            <input type="number" value={q.wordLimit || ""} onChange={e => setQ({...q, wordLimit: e.target.value})} placeholder="0 = no limit" className={inputCls} /></div>
        </div>
        <div><label className={labelCls}>Model Answer</label>
          <textarea value={q.modelAnswer} onChange={e => setQ({...q, modelAnswer: e.target.value})} rows={3} className={inputCls + " resize-none"} /></div>
        {error && <p className="text-sm text-red-500 flex items-center gap-1"><AlertCircle size={14}/>{error}</p>}
      </div>
      <ModalFooter note="* required" onCancel={onClose} onSave={save} />
    </ModalShell>
  )
}

function FillBlanksModal({ onSave, onClose, initial }: { onSave: (q: FillBlanksQuestion) => void; onClose: () => void; initial?: FillBlanksQuestion }) {
  const blank = (): FillBlanksQuestion => ({ id: Math.random().toString(36).slice(2), type: "fillblanks", questionText: "", difficulty: "medium", marks: 1, blanks: [{ answer: "", alsoAccept: [] }], caseInsensitive: true, questionImage: "", codeSnippet: "" })
  const [q, setQ] = useState<FillBlanksQuestion>(initial ?? blank())
  const [error, setError] = useState("")
  const [imageError, setImageError] = useState(false)
  const save = () => {
    if (!q.questionText.trim()) return setError("Question text is required")
    if (q.blanks.some(b => !b.answer.trim())) return setError("All blank answers are required")
    onSave(q); onClose()
  }
  return (
    <ModalShell title={initial ? "Edit Fill Blanks" : "Add Fill Blanks"} icon={<div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center"><FileText size={18} className="text-amber-600"/></div>} onClose={onClose}>
      <div className="space-y-4">
        <div><label className={labelCls}>Question Text * <span className="text-xs text-gray-400">(use ___ for blanks)</span></label>
          <textarea value={q.questionText} onChange={e => setQ({...q, questionText: e.target.value})} rows={4} className={inputCls + " resize-none"} /></div>
        <div>
          <label className={labelCls}>Code Snippet <span className="text-gray-400 font-normal">(Optional)</span></label>
          <textarea value={q.codeSnippet || ""} onChange={e => setQ({...q, codeSnippet: e.target.value})} rows={3} placeholder="Paste code snippet here (Python, JavaScript, etc.)..." className="w-full p-3 bg-[#1e2a38] text-white font-mono text-xs rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none" />
        </div>
        <div>
          <label className={labelCls}>Question Image URL <span className="text-gray-400 font-normal">(Optional)</span></label>
          <div className="flex gap-2">
            <input value={q.questionImage || ""} onChange={e => { setQ({...q, questionImage: e.target.value}); setImageError(false) }} 
              placeholder="https://example.com/image.png" className={inputCls} />
          </div>
          {q.questionImage && (
            <div className="mt-2 p-3 border border-gray-200 rounded-lg bg-gray-50">
              <img src={q.questionImage} alt="Question preview" className="max-w-xs max-h-48 rounded-lg object-contain"
                onError={() => setImageError(true)} onLoad={() => setImageError(false)} />
              {imageError && <p className="text-xs text-red-500 mt-1">Failed to load image</p>}
            </div>
          )}
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className={labelCls + " mb-0"}>Blank Answers</label>
            <button type="button" onClick={() => setQ({...q, blanks: [...q.blanks, { answer: "", alsoAccept: [] }]})}
              className="text-xs text-[#10B981] font-medium flex items-center gap-1"><Plus size={13}/>Add Blank</button>
          </div>
          <div className="space-y-2">
            {q.blanks.map((b, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs text-gray-400 w-6">#{i+1}</span>
                <input value={b.answer} onChange={e => { const blanks = [...q.blanks]; blanks[i] = {...b, answer: e.target.value}; setQ({...q, blanks}) }}
                  placeholder="Correct answer..." className={inputCls + " flex-1"} />
                {q.blanks.length > 1 && <button type="button" onClick={() => setQ({...q, blanks: q.blanks.filter((_,j) => j !== i)})} className="text-gray-400 hover:text-red-500"><X size={15}/></button>}
              </div>
            ))}
          </div>
        </div>
        {error && <p className="text-sm text-red-500 flex items-center gap-1"><AlertCircle size={14}/>{error}</p>}
      </div>
      <ModalFooter note="* required" onCancel={onClose} onSave={save} />
    </ModalShell>
  )
}

function CodingModal({ onSave, onClose, initial }: {
  onSave: (q: CodingQuestion) => void; onClose: () => void; initial?: CodingQuestion
}) {
  const blank = (): CodingQuestion => ({
    id: Math.random().toString(36).slice(2), type: "coding",
    questionText: "", difficulty: "hard", marks: 15,
    codeTemplate: "",
    codeTemplates: { ...DEFAULT_TEMPLATES },
    driverCode: { ...DEFAULT_DRIVERS },
    testCases: [{ input: "", expectedOutput: "" }],
    constraints: [], languages: ["Python", "JavaScript"],
    questionImage: ""
  })

  // Merge initial data with defaults for missing fields (new multi-lang support)
  const [q, setQ] = useState<CodingQuestion>(() => {
    const base = initial ?? blank()
    const templates = { ...DEFAULT_TEMPLATES, ...(base.codeTemplates || {}) }
    const drivers = { ...DEFAULT_DRIVERS, ...(base.driverCode || {}) }
    const langs = base.languages?.length ? base.languages : ["Python", "JavaScript"]
    return { ...base, codeTemplates: templates, driverCode: drivers, languages: langs }
  })
  const [activeLang, setActiveLang] = useState<string>(q.languages[0]?.toLowerCase() || "python")
  const [error, setError] = useState("")
  const [imageError, setImageError] = useState(false)

  const save = () => {
    if (!q.questionText.trim()) return setError("Problem statement is required")
    if (q.languages.length === 0) return setError("At least one language must be enabled")
    onSave(q); onClose()
  }

  return (
    <ModalShell title={initial ? "Edit Coding Question" : "Add Coding Question"} icon={<div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center"><Code2 size={18} className="text-red-600"/></div>} onClose={onClose}>
      <div className="space-y-4 pb-4 overflow-y-auto max-h-[85vh] px-1">
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-[11px] text-blue-700 leading-relaxed">
          <p className="font-bold mb-1 flex items-center gap-1"><Info size={12}/> How to create a LeetCode-style problem:</p>
          <ol className="list-decimal list-inside space-y-0.5 ml-1">
            <li>Write the <b>Problem Statement</b> and set <b>Marks</b>.</li>
            <li>Enable the <b>Languages</b> you want to support.</li>
            <li>Under each language tab, the <b>Initial Template</b> is what the student sees.</li>
            <li>The <b>Driver Code</b> (hidden) is what executes the student's code and reads test cases via <code>stdin</code>.</li>
            <li>Add <b>Test Cases</b> with the specific inputs your Driver expects.</li>
          </ol>
        </div>

        <div>
          <label className={labelCls}>Problem Statement *</label>
          <textarea value={q.questionText} onChange={e => setQ({...q, questionText: e.target.value})}
            rows={4} placeholder="Describe the problem clearly..."
            className={inputCls + " resize-none"} />
        </div>
        <div>
          <label className={labelCls}>Problem Image URL <span className="text-gray-400 font-normal">(Optional)</span></label>
          <div className="flex gap-2">
            <input value={q.questionImage || ""} onChange={e => { setQ({...q, questionImage: e.target.value}); setImageError(false) }} 
              placeholder="https://example.com/image.png" className={inputCls} />
          </div>
          {q.questionImage && (
            <div className="mt-2 p-3 border border-gray-200 rounded-lg bg-gray-50">
              <img src={q.questionImage} alt="Problem preview" className="max-w-xs max-h-48 rounded-lg object-contain"
                onError={() => setImageError(true)} onLoad={() => setImageError(false)} />
              {imageError && <p className="text-xs text-red-500 mt-1">Failed to load image</p>}
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Difficulty *</label>
            <select value={q.difficulty} onChange={e => setQ({...q, difficulty: e.target.value as Difficulty})} className={inputCls}>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>Marks *</label>
              <input type="number" value={q.marks} onChange={e => setQ({...q, marks: +e.target.value})} min={1} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Neg. Mark</label>
              <input type="number" step="0.25" value={q.negativeMark || 0} onChange={e => setQ({...q, negativeMark: +e.target.value})} min={0} className={inputCls} placeholder="0" />
            </div>
          </div>
        </div>

        <div>
          <label className={labelCls}>Enabled Languages</label>
          <div className="flex gap-2 flex-wrap mb-4">
            {["Python","Java","C++","JavaScript","Go","Rust"].map(lang => {
              const active = q.languages.includes(lang)
              return (
                <button key={lang} type="button" onClick={() => setQ(prev => {
                  const langs = active ? prev.languages.filter(l => l !== lang) : [...prev.languages, lang]
                  return { ...prev, languages: langs }
                })} className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all
                  ${active ? "bg-[#2D3A4A] text-white border-[#2D3A4A] shadow-md" : "bg-white border-gray-100 text-gray-500 hover:border-gray-300"}`}>
                  {lang}
                </button>
              )
            })}
          </div>

          {q.languages.length > 0 && (
            <div className="border border-gray-100 rounded-2xl overflow-hidden bg-gray-50/30">
              <div className="flex bg-gray-100/50 p-1">
                {q.languages.map(lang => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => setActiveLang(lang.toLowerCase())}
                    className={`flex-1 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${
                      activeLang === lang.toLowerCase() ? "bg-white text-[#2D3A4A] shadow-sm" : "text-gray-400 hover:text-gray-600"
                    }`}
                  >
                    {lang}
                  </button>
                ))}
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Initial Template</label>
                    <span className="text-[9px] text-[#10B981] font-bold">VISIBLE TO STUDENT</span>
                  </div>
                  <textarea
                    value={q.codeTemplates[activeLang] || ""}
                    onChange={e => setQ({
                      ...q,
                      codeTemplates: { ...q.codeTemplates, [activeLang]: e.target.value }
                    })}
                    rows={6}
                    className="w-full p-3 bg-[#1e2a38] text-white font-mono text-xs rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Driver Code</label>
                    <span className="text-[9px] text-red-400 font-bold">HIDDEN INTERNAL RUNNER</span>
                  </div>
                  <textarea
                    value={q.driverCode[activeLang] || ""}
                    onChange={e => setQ({
                       ...q,
                       driverCode: { ...q.driverCode, [activeLang]: e.target.value }
                    })}
                    rows={4}
                    className="w-full p-3 bg-gray-100 text-[#2D3A4A] font-mono text-xs rounded-xl border border-gray-200 focus:outline-none"
                  />
                  <p className="text-[9px] text-gray-400 mt-1.5">Use <code>stdin</code> to read inputs from test cases and print output for validation.</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className={labelCls + " mb-0"}>Test Cases</label>
            <button type="button" onClick={() => setQ({ ...q, testCases: [...q.testCases, { input: "", expectedOutput: "" }] })}
              className="text-xs text-[#10B981] font-semibold flex items-center gap-1 hover:text-[#059669]"><Plus size={13}/>Add Case</button>
          </div>
          <div className="space-y-3">
            {q.testCases.map((tc, i) => (
              <div key={i} className="border border-gray-200 rounded-xl p-3 bg-gray-50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-gray-500">Case {i + 1}</span>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={!!tc.hidden}
                        onChange={e => {
                          const t = [...q.testCases]; t[i] = { ...t[i], hidden: e.target.checked }; setQ({ ...q, testCases: t })
                        }}
                        className="w-3.5 h-3.5 accent-[#2D3A4A]" />
                      <span className="text-xs text-gray-500">Hidden</span>
                    </label>
                    {q.testCases.length > 1 && (
                      <button onClick={() => setQ({ ...q, testCases: q.testCases.filter((_, j) => j !== i) })} className="text-gray-400 hover:text-red-500"><X size={14}/></button>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Input (stdin)</p>
                    <textarea value={tc.input} onChange={e => {
                      const t = [...q.testCases]; t[i] = { ...t[i], input: e.target.value }; setQ({ ...q, testCases: t })
                    }} rows={3} className={inputCls + " font-mono text-xs resize-none"} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Expected Output</p>
                    <textarea value={tc.expectedOutput} onChange={e => {
                      const t = [...q.testCases]; t[i] = { ...t[i], expectedOutput: e.target.value }; setQ({ ...q, testCases: t })
                    }} rows={3} className={inputCls + " font-mono text-xs resize-none"} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        {error && <p className="text-sm text-red-500 flex items-center gap-1"><AlertCircle size={14}/>{error}</p>}
      </div>
      <ModalFooter note="* required" onCancel={onClose} onSave={save} />
    </ModalShell>
  )
}

// ─── Question Menu (Portal) ──────────────────────────────────────────────────

function QuestionMenu({ q, onEdit, onDelete, onClose, anchorRect }: { q: Question; onEdit: (q: Question) => void; onDelete: (id: string) => void; onClose: () => void; anchorRect: DOMRect | null }) {
  const [mounted, setMounted] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  useEffect(() => setMounted(true), [])
  
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    if (mounted) {
      const timer = setTimeout(() => {
        document.addEventListener("click", handleClickOutside)
      }, 10)
      return () => {
        clearTimeout(timer)
        document.removeEventListener("click", handleClickOutside)
      }
    }
  }, [mounted, onClose])
  
  if (!mounted || !anchorRect) return null

  const top = anchorRect.bottom + window.scrollY + 5
  const left = anchorRect.right - 160
  
  return createPortal(
    <>
      <div ref={menuRef} style={{ top, left }} className="fixed z-100 bg-white border border-gray-100 rounded-lg shadow-xl overflow-hidden min-w-40 animate-in fade-in zoom-in duration-100">
        <button onClick={() => { onEdit(q); onClose() }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 text-left border-b border-gray-50">
          <Pencil size={14} className="text-blue-500" />
          <span className="flex-1">Edit Question</span>
        </button>
        <button onClick={() => { onDelete(q.id); onClose() }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 text-left">
          <Trash2 size={14}/> 
          <span className="flex-1">Delete</span>
        </button>
      </div>
    </>,
    document.body
  )
}

// ─── Step 3 Component ─────────────────────────────────────────────────────────

function Step3({ questions, setQuestions }: { questions: Question[]; setQuestions: React.Dispatch<React.SetStateAction<Question[]>> }) {
  const [modal, setModal] = useState<ModalType>(null)
  const [editQ, setEditQ] = useState<Question | null>(null)
  const [search, setSearch] = useState("")
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null)
  const [filterType, setFilterType] = useState<QuestionType | "all">("all")
  const [pdfUploading, setPdfUploading] = useState(false)
  const [pdfError, setPdfError] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)
  
  const openMenu = (qId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    setAnchorRect(rect)
    setMenuOpen(qId === menuOpen ? null : qId)
  }

  const saveQuestion = (q: Question) => {
    setQuestions(prev => {
      const idx = prev.findIndex(p => p.id === q.id)
      if (idx >= 0) { const next = [...prev]; next[idx] = q; return next }
      return [...prev, q]
    })
  }

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.type !== "application/pdf") return setPdfError("Please upload a PDF file")
    setPdfUploading(true)
    setPdfError("")
    try {
      const formData = new FormData()
      formData.append("file", file)
      const res = await fetch("/api/exams/parse-pdf", { method: "POST", body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to parse PDF")
      if (data.questions?.length) {
        setQuestions(prev => [...prev, ...data.questions.map((q: Omit<Question, "id">) => ({...q, id: Math.random().toString(36).slice(2)}))])
        setPdfError("")
      }
    } catch (err) {
      setPdfError(err instanceof Error ? err.message : "Failed to upload PDF")
    } finally {
      setPdfUploading(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  const totalMarks = questions.reduce((s, q) => s + q.marks, 0)
  const typeCounts: Record<QuestionType, number> = { mcq: 0, truefalse: 0, descriptive: 0, fillblanks: 0, coding: 0 }
  questions.forEach(q => typeCounts[q.type]++)
  
  let filtered = questions.filter(q => q.questionText.toLowerCase().includes(search.toLowerCase()))
  if (filterType !== "all") {
    filtered = filtered.filter(q => q.type === filterType)
  }

  const addBtns: { type: QuestionType; label: string }[] = [
    { type: "mcq", label: "MCQ" }, { type: "truefalse", label: "True/False" },
    { type: "descriptive", label: "Descriptive" }, { type: "fillblanks", label: "Fill Blanks" },
    { type: "coding", label: "Coding" },
  ]

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-xl font-bold text-[#2D3A4A]">Questions</h2>
            <p className="text-xs text-gray-400 mt-0.5">{questions.length} questions selected · Total: {totalMarks} marks</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => fileRef.current?.click()} disabled={pdfUploading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60">
              <Upload size={15}/>{pdfUploading ? "Uploading..." : "Upload from PDF"}
            </button>
            <input ref={fileRef} type="file" accept="application/pdf" onChange={handlePdfUpload} className="hidden" />
            <div className="relative group">
              <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#2D3A4A] text-white text-sm font-medium hover:bg-[#1e2a38] transition-colors">
                <Plus size={15}/> Add Question
              </button>
              <div className="absolute right-0 top-full pt-1.5 w-44 z-30 hidden group-hover:block before:absolute before:inset-0 before:h-2 before:-top-2 before:bg-transparent">
                <div className="bg-white border border-gray-100 rounded-xl shadow-lg">
                  {addBtns.map(b => (
                    <button key={b.type} onClick={() => { setEditQ(null); setModal(b.type); }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 first:rounded-t-xl last:rounded-b-xl transition-colors">
                      {TYPE_META[b.type].icon}{TYPE_META[b.type].label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {pdfError && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 flex items-center gap-2"><AlertCircle size={14}/>{pdfError}</div>}

        <div className="flex items-center gap-4 mb-4 flex-wrap">
          <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">QUESTION TYPES:</span>
          {(["mcq","truefalse","descriptive","fillblanks","coding"] as QuestionType[]).map(t => (
            <button 
              key={t} 
              onClick={() => { setEditQ(null); setModal(t); }}
              className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full ${TYPE_META[t].color} border border-current/20 hover:scale-105 hover:shadow-sm active:scale-95 transition-all duration-200 cursor-pointer uppercase tracking-tight`}
            >
              {TYPE_META[t].icon} {TYPE_META[t].label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4 mb-4">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search questions..."
            className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2D3A4A]/30 focus:border-[#2D3A4A]" />
          <select value={filterType} onChange={e => setFilterType(e.target.value as QuestionType | "all")}
            className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#2D3A4A]">
            <option value="all">All Types</option>
            {(["mcq","truefalse","descriptive","fillblanks","coding"] as QuestionType[]).map(t => (
              <option key={t} value={t}>{TYPE_META[t].label}</option>
            ))}
          </select>
        </div>

        {filtered.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-xl">
            {questions.length === 0 ? "No questions yet. Add your first question above or upload from PDF." : "No questions match your search."}
          </div>
        ) : (
          <div className="space-y-2 overflow-y-auto max-h-137.5 pr-2 custom-scrollbar">
            {filtered.map((q, idx) => {
              const meta = TYPE_META[q.type]
              return (
                <div key={q.id} className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors group">
                  <span className="text-xs font-bold text-gray-400 w-5 pt-0.5 shrink-0">{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[#2D3A4A] font-medium line-clamp-2">{q.questionText || <span className="text-gray-400 italic">No question text</span>}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${meta.color}`}>{meta.icon}{meta.label}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${DIFFICULTY_COLORS[q.difficulty]}`}>{q.difficulty}</span>
                      <span className="text-[10px] text-gray-400">{q.marks} mark{q.marks !== 1 ? "s" : ""}</span>
                    </div>
                  </div>
                  <button onClick={e => openMenu(q.id, e)} className="p-1.5 rounded-lg hover:bg-white text-gray-400 hover:text-[#2D3A4A]">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
                  </button>
                  {menuOpen === q.id && (
                    <QuestionMenu
                      q={q}
                      anchorRect={anchorRect}
                      onEdit={q => { setEditQ(q); setModal(q.type) }}
                      onDelete={id => setQuestions(prev => prev.filter(p => p.id !== id))}
                      onClose={() => setMenuOpen(null)}
                    />
                  )}
                </div>
              )
            })}
          </div>
        )}
        
        <div className="pt-4 border-t border-gray-100">
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-sm font-semibold text-[#2D3A4A]">{questions.length} questions selected</span>
            <span className="text-gray-300">·</span>
            <span className="text-sm text-gray-500">Total: {totalMarks} marks</span>
            {Object.entries(typeCounts).filter(([,c]) => c > 0).map(([t, c]) => (
              <span key={t}><span className="text-gray-300 mx-1">·</span><span className="text-sm text-gray-500">{c} {TYPE_META[t as QuestionType].label}</span></span>
            ))}
          </div>
        </div>
      </div>
      {modal === "mcq"         && <MCQModal         onSave={saveQuestion as (q: MCQQuestion) => void}         onClose={() => { setModal(null); setEditQ(null) }} initial={editQ?.type === "mcq" ? editQ : undefined} />}
      {modal === "truefalse"   && <TrueFalseModal   onSave={saveQuestion as (q: TrueFalseQuestion) => void}   onClose={() => { setModal(null); setEditQ(null) }} initial={editQ?.type === "truefalse" ? editQ : undefined} />}
      {modal === "descriptive" && <DescriptiveModal onSave={saveQuestion as (q: DescriptiveQuestion) => void} onClose={() => { setModal(null); setEditQ(null) }} initial={editQ?.type === "descriptive" ? editQ : undefined} />}
      {modal === "fillblanks"  && <FillBlanksModal  onSave={saveQuestion as (q: FillBlanksQuestion) => void}  onClose={() => { setModal(null); setEditQ(null) }} initial={editQ?.type === "fillblanks" ? editQ : undefined} />}
      {modal === "coding"      && <CodingModal      onSave={saveQuestion as (q: CodingQuestion) => void}      onClose={() => { setModal(null); setEditQ(null) }} initial={editQ?.type === "coding" ? editQ : undefined} />}
    </div>
  )
}

// ─── Main Edit Page ───────────────────────────────────────────────────────────

export default function EditExamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [notFound, setNotFound] = useState(false)

  const [step1, setStep1] = useState<Step1Form>({ title: "", duration: "", passMarks: "", totalMarks: "", instructions: "", questionsPerMin: "" })
  const [step2, setStep2] = useState<Step2Form>({ 
    startDate: "", startTime: "", endDate: "", endTime: "", 
    randomize: true, showResults: true, allowReview: false, negativeMarking: false,
    sectionNegativeMark: 0,
    proctoring: {
      faceDetection: true,
      tabSwitch: true,
      fullscreen: true,
      aiProctoring: false
    }
  })
  const [questions, setQuestions] = useState<Question[]>([])

  // Load existing exam data
  useEffect(() => {
    fetch(`/api/exams/${id}`)
      .then(r => r.json())
      .then(data => {
        if (!data.exam) { setNotFound(true); setLoading(false); return }
        const exam = data.exam
        setStep1({
          title: exam.title || "",
          duration: String(exam.duration || ""),
          passMarks: String(exam.passMarks || ""),
          totalMarks: String(exam.totalMarks || ""),
          instructions: (exam.instructions || []).join("\n"),
          questionsPerMin: exam.questionsPerMin ? String(exam.questionsPerMin) : "",
        })
        
        setStep2({
          startDate: exam.settings?.startDate ? new Date(exam.settings.startDate).toISOString().split('T')[0] : "",
          startTime: exam.settings?.startTime || "",
          endDate: exam.settings?.endDate ? new Date(exam.settings.endDate).toISOString().split('T')[0] : "",
          endTime: exam.settings?.endTime || "",
          randomize: exam.settings?.randomize ?? true,
          showResults: exam.settings?.showResults ?? true,
          allowReview: exam.settings?.allowReview ?? false,
          negativeMarking: exam.settings?.negativeMarking ?? false,
          sectionNegativeMark: exam.sections?.[0]?.sectionNegativeMark || 0,
          proctoring: {
            faceDetection: exam.settings?.proctoring?.faceDetection ?? true,
            tabSwitch: exam.settings?.proctoring?.tabSwitch ?? true,
            fullscreen: exam.settings?.proctoring?.fullscreen ?? true,
            aiProctoring: exam.settings?.proctoring?.aiProctoring ?? false,
          }
        })
        const allQ = (exam.sections || []).flatMap((sec: any) =>
          (sec.questions || []).map((q: any) => {
            const base = { ...q, id: Math.random().toString(36).slice(2) }
            if (q.type === "coding") {
              return {
                ...base,
                languages: q.languages?.length ? q.languages : ["Python", "JavaScript"],
                codeTemplates: q.codeTemplates || { python: q.codeTemplate || DEFAULT_TEMPLATES.python, javascript: DEFAULT_TEMPLATES.javascript },
                driverCode: q.driverCode || DEFAULT_DRIVERS
              }
            }
            return base
          })
        )
        setQuestions(allQ)
        setLoading(false)
      })
      .catch(() => { setNotFound(true); setLoading(false) })
  }, [id])

  const validateStep1 = () => {
    if (!step1.title.trim()) return "Exam title is required"
    if (!step1.duration || +step1.duration < 1) return "Valid duration is required"
    if (!step1.totalMarks || +step1.totalMarks < 1) return "Total marks are required"
    if (!step1.passMarks || +step1.passMarks < 0) return "Pass marks are required"
    return ""
  }

  const handleNext = () => {
    setError("")
    if (step === 1) { const err = validateStep1(); if (err) return setError(err) }
    setStep(s => s + 1)
  }

  const handleSubmit = async (status: "draft" | "active") => {
    setError(""); setSaving(true)
    try {
      const sections = [{
        name: "Questions",
        type: questions[0]?.type || "mcq",
        negativeMarking: step2.negativeMarking,
        sectionNegativeMark: step2.sectionNegativeMark,
        questionRange: `1-${questions.length}`,
        questions: questions.map(({ id: _id, ...q }) => ({
          ...q,
          correctAnswer: q.type === "fillblanks"
            ? (q as FillBlanksQuestion).blanks.map(b => b.answer)
            : (q as MCQQuestion | TrueFalseQuestion).correctAnswer ?? ""
        }))
      }]
      const payload = {
        title: step1.title,
        subject: "",
        description: step1.instructions,
        instructions: step1.instructions.split("\n").filter(Boolean),
        duration: +step1.duration,
        totalMarks: +step1.totalMarks,
        passMarks: +step1.passMarks,
        questionsPerMin: step1.questionsPerMin ? +step1.questionsPerMin : undefined,
        status,
        sections,
        settings: {
          randomize: step2.randomize,
          showResults: step2.showResults,
          allowReview: step2.allowReview,
          negativeMarking: step2.negativeMarking,
          startDate: step2.startDate ? new Date(step2.startDate) : undefined,
          startTime: step2.startTime || undefined,
          endDate: step2.endDate ? new Date(step2.endDate) : undefined,
          endTime: step2.endTime || undefined,
          proctoring: step2.proctoring,
        }
      }
      const res = await fetch(`/api/exams/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to save exam")
      router.push("/admin/exams")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save exam")
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-[#F5F6FA] flex items-center justify-center">
      <div className="flex items-center gap-3 text-gray-500">
        <Loader2 className="animate-spin" size={20}/><span className="text-sm">Loading exam...</span>
      </div>
    </div>
  )

  if (notFound) return (
    <div className="min-h-screen bg-[#F5F6FA] flex items-center justify-center">
      <div className="text-center">
        <p className="text-2xl font-bold text-[#2D3A4A] mb-2">Exam Not Found</p>
        <Link href="/admin/exams" className="px-5 py-2.5 bg-[#2D3A4A] text-white rounded-lg text-sm font-medium hover:bg-[#1e2a38]">Back to Exams</Link>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#F5F6FA]">
      <div className="sticky top-0 z-40 bg-white border-b border-gray-100 px-8 py-4 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
            <button onClick={() => { toast.info("Changes discarded. Redirecting..."); setTimeout(() => router.push("/admin/exams"), 500) }} className="hover:text-[#10B981] bg-none border-none cursor-pointer font-inherit">Exams</button>
            <span>/</span><span className="text-[#2D3A4A] font-medium">Edit Exam</span>
          </div>
          <h1 className="text-xl font-bold text-[#2D3A4A]">Edit: {step1.title}</h1>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => { toast.info("Changes discarded. Redirecting..."); setTimeout(() => router.push("/admin/exams"), 500) }} className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={() => handleSubmit("draft")} disabled={saving} className="px-4 py-2 rounded-lg border border-[#2D3A4A] text-[#2D3A4A] text-sm font-medium hover:bg-gray-50 disabled:opacity-60">Save Draft</button>
        </div>
      </div>

      <div className="sticky top-16 z-30 bg-white border-b border-gray-100 px-8 py-6"><Stepper step={step} /></div>

      <div className="max-w-4xl mx-auto px-8 py-8">
        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 flex items-center gap-2"><AlertCircle size={14}/>{error}</div>}
        {step === 1 && <Step1 form={step1} setForm={setStep1} />}
        {step === 2 && <Step2 form={step2} setForm={setStep2} />}
        {step === 3 && <Step3 questions={questions} setQuestions={setQuestions} />}

        <div className="flex items-center justify-between mt-6">
          {step > 1 ? <button onClick={() => setStep(s => s - 1)} className="px-6 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">Back</button> : <div />}
          {step < 3 ? (
            <button onClick={handleNext} className="px-6 py-2.5 rounded-lg bg-[#2D3A4A] text-white text-sm font-medium hover:bg-[#1e2a38]">
              {step === 1 ? "Next: Settings" : "Next: Questions"}
            </button>
          ) : (
            <button onClick={() => handleSubmit("active")} disabled={saving} className="px-6 py-2.5 rounded-lg bg-[#2D3A4A] text-white text-sm font-medium hover:bg-[#1e2a38] disabled:opacity-60">
              {saving ? "Saving..." : "Save Changes"}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
