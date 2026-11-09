"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { BookOpen, Search, Plus } from "lucide-react"
import { AdminListSkeleton } from "@/components/SkeletonLoaders"
import { Toaster } from "@/components/ui/toaster"

interface QuestionItem {
  sectionName: string
  sectionType: string
  questionText: string
  type: string
  marks: number
  difficulty: string
  examTitle: string
  examId: string
}

export default function QuestionsPage() {
  const [questions, setQuestions] = useState<QuestionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [filterType, setFilterType] = useState("all")

  useEffect(() => {
    fetch("/api/exams", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        const qs: QuestionItem[] = []
        for (const exam of d.exams || []) {
          for (const sec of exam.sections || []) {
            for (const q of sec.questions || []) {
              qs.push({
                sectionName: sec.name,
                sectionType: sec.type,
                questionText: q.questionText,
                type: q.type,
                marks: q.marks,
                difficulty: q.difficulty,
                examTitle: exam.title,
                examId: exam._id,
              })
            }
          }
        }
        setQuestions(qs)
        setLoading(false)
      })
  }, [])

  const typeLabel: Record<string, string> = {
    mcq: "MCQ",
    truefalse: "True/False",
    descriptive: "Descriptive",
    fillblanks: "Fill Blanks",
    coding: "Coding",
  }

  const diffColor: Record<string, string> = {
    easy: "bg-green-50 text-green-600",
    medium: "bg-yellow-50 text-yellow-600",
    hard: "bg-red-50 text-red-600",
  }

  const filtered = questions.filter((q) => {
    const matchSearch =
      q.questionText?.toLowerCase().includes(search.toLowerCase()) ||
      q.examTitle?.toLowerCase().includes(search.toLowerCase())
    const matchType = filterType === "all" || q.type === filterType
    return matchSearch && matchType
  })

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-primary">Question Bank</h1>
          <p className="text-sm text-gray-500 mt-0.5">All questions across your exams</p>
        </div>
        <Link
          href="/admin/exams/create"
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-accent transition-colors"
        >
          <Plus size={15} />
          Add via New Exam
        </Link>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:border-[#10B981]"
            placeholder="Search questions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:border-[#10B981]"
        >
          <option value="all">All Types</option>
          <option value="mcq">MCQ</option>
          <option value="truefalse">True/False</option>
          <option value="descriptive">Descriptive</option>
          <option value="fillblanks">Fill Blanks</option>
          <option value="coding">Coding</option>
        </select>
        <span className="text-sm text-gray-400">{filtered.length} questions</span>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
        {loading ? (
          <AdminListSkeleton />
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <BookOpen size={32} className="mx-auto text-gray-300 mb-3" />
            <p className="text-sm text-gray-400">No questions found.</p>
            <Link href="/admin/exams/create" className="text-[#10B981] text-sm hover:underline mt-1 inline-block">
              Create an exam to add questions
            </Link>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                {["Question", "Type", "Marks", "Difficulty", "Exam"].map((h) => (
                  <th key={h} className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-5 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((q, i) => (
                <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 last:border-0">
                  <td className="px-5 py-4 max-w-xs">
                    <p className="text-sm text-gray-700 truncate">{q.questionText || "—"}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{q.sectionName}</p>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full font-medium">
                      {typeLabel[q.type] || q.type}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-600 font-medium">{q.marks}</td>
                  <td className="px-5 py-4">
                    <span className={`text-xs px-2 py-1 rounded-full capitalize ${diffColor[q.difficulty] || "bg-gray-100 text-gray-500"}`}>
                      {q.difficulty}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <Link href={`/admin/exams`} className="text-sm text-[#10B981] hover:underline">
                      {q.examTitle}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <Toaster />
    </div>
  )
}
