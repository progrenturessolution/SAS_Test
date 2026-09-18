"use client"

import { useState, useEffect, use } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { 
  ChevronLeft, Loader2, Save, User, FileText, 
  CheckCircle, XCircle, AlertTriangle, Code, 
  MessageSquare, History, Award, Check
} from "lucide-react"

interface Section {
  name: string
  type: string
  questions: any[]
}

interface Answer {
  questionId: string
  sectionType: string
  answer: any
  correct?: boolean
  marks?: number
  manualScore?: number
  autoScore?: number
}

interface Attempt {
  _id: string
  examId: { _id: string; title: string; totalMarks: number; passMarks: number; duration: number; sections: Section[] }
  studentName: string
  rollNumber: string
  studentEmail: string
  score: number
  maxScore: number
  status: string
  answers: Answer[]
  isGraded: boolean
  submittedAt: string
  proctoring: { warnings: number; events: any[] }
}

export default function GradeAttemptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [attempt, setAttempt] = useState<Attempt | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [manualScores, setManualScores] = useState<Record<string, number>>({})
  const [success, setSuccess] = useState(false)
  const [filterType, setFilterType] = useState("all")

  useEffect(() => {
    fetch(`/api/admin/attempts/${id}/grade`)
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          console.error('Failed to fetch attempt:', data.error)
          setLoading(false)
          return
        }
        const att = data.attempt
        if (!att) {
          console.error('No attempt data returned')
          setLoading(false)
          return
        }
        setAttempt(att)
        // Initialize manual scores from existing data
        const scores: Record<string, number> = {}
        const answers = att.answers || []
        answers.forEach((ans: any) => {
          // If manualScore is set (and not just the default 0 for an ungraded attempt), use it.
          // Or if it's already graded, use manualScore.
          // FIX: If it's an MCQ/TrueFalse and manualScore is 0 but marks > 0, it was likely corrupted, so prefer marks.
          const isAutoGradable = ans.sectionType === 'mcq' || ans.sectionType === 'truefalse'
          if (att.isGraded) {
             if (isAutoGradable && ans.manualScore === undefined && ans.autoScore > 0) {
                scores[ans.questionId] = ans.autoScore
             } else {
                scores[ans.questionId] = ans.manualScore !== undefined ? ans.manualScore : (ans.autoScore || 0)
             }
          } else {
            // Not graded yet, prefer marks
            scores[ans.questionId] = ans.autoScore !== undefined ? ans.autoScore : 0
          }
        })
        setManualScores(scores)
        setLoading(false)
      })
      .catch(err => {
        console.error('Error fetching attempt:', err)
        setLoading(false)
      })
  }, [id])

  const handleScoreChange = (qId: string, val: string, max: number) => {
    if (val === "" || val === "-") {
      setManualScores(prev => ({ ...prev, [qId]: val as any }))
      return;
    }
    const num = parseFloat(val)
    if (isNaN(num)) return
    setManualScores(prev => ({ ...prev, [qId]: Math.min(Math.max(-max, num), max) }))
  }

  const saveGrades = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/attempts/${id}/grade`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: Object.entries(manualScores).map(([qId, score]) => ({ questionId: qId, manualScore: isNaN(parseFloat(score as any)) ? 0 : parseFloat(score as any) }))
        })
      })
      if (res.ok) {
        setSuccess(true)
        setTimeout(() => setSuccess(false), 3000)
        // Refresh local state or redirect
        const data = await res.json()
        if (attempt) setAttempt({ ...attempt, score: data.newScore, isGraded: true, status: "graded" })
      }
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  const resetToAuto = () => {
    if (!attempt) return
    const scores: Record<string, number> = {}
    attempt.answers.forEach(ans => {
      scores[ans.questionId] = ans.autoScore || 0
    })
    setManualScores(scores)
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
        <p className="text-sm font-medium text-gray-400">Loading attempt data...</p>
      </div>
    </div>
  )

  if (!attempt) return <div className="p-10 text-center">Attempt not found</div>

  const exam = attempt.examId
  const questions = exam?.sections?.flatMap(s => s.questions.map(q => ({ ...q, sectionType: s.type }))) || []

  return (
    <div className="flex flex-col h-screen bg-[#F5F6FA]">
      {/* Top Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20 px-8 py-4 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-5">
           <Link href={`/admin/results${exam?._id ? `?examId=${exam._id}` : ""}`} className="p-2 hover:bg-gray-50 rounded-lg transition-colors text-gray-400 hover:text-accent">
             <ChevronLeft size={20} />
           </Link>
           <div className="h-6 w-px bg-gray-200" />
           <div>
             <h1 className="text-lg font-bold text-foreground tracking-tight">Manual Grading</h1>
             <p className="text-xs text-gray-400 font-medium">{exam.title} • {attempt.studentName}</p>
           </div>
        </div>
          <button onClick={resetToAuto} className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-600 rounded-xl text-xs font-bold hover:bg-gray-200 transition-all">
            <History size={14} /> Reset to Auto
          </button>
          <button onClick={saveGrades} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:bg-accent transition-all shadow-md active:scale-95 disabled:opacity-50">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? "Saving..." : "Submit Grades"}
          </button>
      </header>

      <main className="flex-1 max-w-6xl mx-auto px-8 py-10 grid grid-cols-12 gap-8 overflow-y-auto custom-scrollbar">
        
        {/* Sidebar Info */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
           <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm sticky top-24">
              <div className="flex items-center gap-4 mb-6">
                 <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center">
                    <User size={24} className="text-blue-500" />
                 </div>
                 <div>
                    <h3 className="font-bold text-foreground leading-tight">{attempt.studentName}</h3>
                    <p className="text-xs text-gray-400 font-medium">{attempt.studentEmail}</p>
                 </div>
              </div>

              <div className="space-y-4">
                 <div className="flex justify-between items-center py-2 border-b border-dashed border-gray-100 text-sm">
                    <span className="text-gray-400 font-medium flex items-center gap-2"><Award size={14} /> Total Score</span>
                    <span className="font-bold text-foreground">{attempt.score} / {attempt.maxScore}</span>
                 </div>
                 <div className="flex justify-between items-center py-2 border-b border-dashed border-gray-100 text-sm">
                    <span className="text-gray-400 font-medium flex items-center gap-2"><History size={14} /> Status</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-black ${attempt.isGraded ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>
                       {attempt.isGraded ? "Graded" : "Needs Review"}
                    </span>
                 </div>
                 <div className="flex justify-between items-center py-2 text-sm">
                    <span className="text-gray-400 font-medium flex items-center gap-2"><AlertTriangle size={14} /> Proctoring Logs</span>
                    <span className={`font-bold ${attempt.proctoring.warnings > 0 ? "text-orange-600" : "text-gray-400"}`}>{attempt.proctoring.warnings} Warnings</span>
                 </div>
              </div>

              <div className="mt-8 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                 <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Internal Note</p>
                 <p className="text-xs text-gray-500 leading-relaxed italic">Grading this attempt will update the student's result immediately. Ensure all descriptive and coding questions are reviewed.</p>
              </div>
           </div>
        </div>

        {/* Question List */}
        <div className="col-span-12 lg:col-span-8 space-y-6">
           {/* Type Filter */}
           <div className="flex items-center gap-2 p-1 bg-white border border-gray-100 rounded-2xl shadow-sm w-fit">
              {['all', 'mcq', 'descriptive', 'coding', 'fillblanks'].map(type => (
                 <button 
                    key={type}
                    onClick={() => setFilterType(type)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all capitalize ${
                       filterType === type ? "bg-primary text-white shadow-md" : "text-gray-400 hover:bg-gray-50"
                    }`}
                 >
                    {type}
                 </button>
              ))}
           </div>

           {questions.filter(q => filterType === 'all' || q.type === filterType).map((q, idx) => {
              const ans = attempt.answers.find(a => a.questionId === (q._id?.toString() || q.id))
              const isManual = q.type === "descriptive" || q.type === "coding" || q.type === "fillblanks"
              const currentScore = manualScores[q._id || q.id] ?? (ans?.manualScore ?? ans?.marks ?? 0)

              return (
                 <div key={q._id || q.id} className="bg-white rounded-3xl overflow-hidden border border-gray-100 shadow-sm flex flex-col">
                    {/* Header */}
                    <div className="px-6 py-4 bg-gray-50/50 border-b border-gray-100 flex items-center justify-between">
                       <div className="flex items-center gap-3">
                          <span className="text-xs font-black text-gray-300">Q{idx + 1}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                             q.type === 'mcq' ? 'bg-blue-100 text-blue-700' :
                             q.type === 'coding' ? 'bg-red-100 text-red-700' :
                             'bg-purple-100 text-purple-700'
                          }`}>
                             {q.type}
                          </span>
                       </div>
                       <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                             <span className="text-[10px] font-bold text-gray-400 uppercase">Score</span>
                             <input 
                                type="number" 
                                value={currentScore} 
                                onChange={(e) => handleScoreChange(q._id || q.id, e.target.value, q.marks)}
                                className="w-14 h-8 text-center text-sm font-bold rounded-lg border border-blue-200 bg-blue-50/30 ring-blue-500/20 focus:ring-1 focus:outline-none transition-all"
                             />
                             <span className="text-xs font-bold text-gray-300">/ {q.marks}</span>
                          </div>
                       </div>
                    </div>

                    {/* Content */}
                    <div className="p-6 space-y-5">
                       <div>
                          <p className="text-sm font-bold text-foreground mb-2 whitespace-pre-wrap">{q.questionText}</p>
                       </div>

                       {/* Student's Answer */}
                       <div className="space-y-2">
                          <div className="flex items-center gap-2 mb-1">
                             <div className={`w-6 h-6 rounded-full flex items-center justify-center ${ans?.answer ? "bg-green-100" : "bg-red-50"}`}>
                                {ans?.answer ? <CheckCircle size={12} className="text-green-600" /> : <XCircle size={12} className="text-red-400" />}
                             </div>
                             <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Student Response</span>
                          </div>

                          <div className={`rounded-2xl p-4 border ${
                             q.type === 'coding' ? "bg-[#1e2a38] text-white font-mono text-xs overflow-x-auto" : "bg-gray-50 text-foreground text-sm leading-relaxed"
                          }`}>
                             {q.type === 'coding' ? (
                                <pre className="whitespace-pre-wrap">{ans?.answer || "// No response provided"}</pre>
                             ) : q.type === 'mcq' ? (
                                <p className="font-bold">Correct Option: {q.correctAnswer} <span className="mx-2 text-gray-300">|</span> Student Picked: {ans?.answer !== undefined ? String(ans.answer) : 'None'}</p>
                             ) : (
                                <p className="whitespace-pre-wrap">{ans?.answer || "No response provided."}</p>
                             )}
                          </div>
                       </div>

                       {/* Question Specific Data (Rubric/Cases) */}
                       {q.type === 'coding' && (
                          <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                             <div className="flex items-center gap-2 mb-3">
                                <Code size={14} className="text-gray-400" />
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Auto Evaluation</span>
                             </div>
                             <div className="flex gap-4">
                                <div className="text-xs">
                                   <span className="text-gray-400">Status: </span>
                                   <span className={`font-bold ${ans?.correct ? "text-green-600" : "text-red-500"}`}>{ans?.correct ? "Passed All Tests" : "Failed / Partial"}</span>
                                </div>
                                <div className="text-xs">
                                   <span className="text-gray-400">Initial Auto marks: </span>
                                   <span className="font-bold">{ans?.marks || 0}</span>
                                </div>
                             </div>
                          </div>
                       )}

                       {q.type === 'descriptive' && (
                          <div className="bg-purple-50/30 rounded-2xl p-4 border border-purple-100">
                             <div className="flex items-center gap-2 mb-3">
                                <MessageSquare size={14} className="text-purple-400" />
                                <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest">Model Answer / Rubric</span>
                             </div>
                             <p className="text-xs text-purple-900 leading-relaxed">{q.modelAnswer || "No model answer provided by examiner."}</p>
                          </div>
                       )}
                    </div>
                 </div>
              )
           })}
        </div>
      </main>
    </div>
  )
}
