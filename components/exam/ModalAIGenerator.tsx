"use client"

import React, { useState } from "react"
import { Sparkles, Plus, X, Loader2 } from "lucide-react"
import { toast } from "sonner"

interface TopicRow {
  id: string
  topic: string
  count: number
}

interface ModalAIGeneratorProps {
  questionType: "mcq" | "truefalse" | "fillblanks" | "descriptive"
  defaultMarks?: number
  defaultDifficulty?: "easy" | "medium" | "hard"
  onFillSingle: (question: any) => void
  onSaveBatch: (questions: any[]) => void
}

export function ModalAIGenerator({
  questionType,
  defaultMarks,
  defaultDifficulty = "medium",
  onFillSingle,
  onSaveBatch,
}: ModalAIGeneratorProps) {
  // Batch topics list
  const [topicRows, setTopicRows] = useState<TopicRow[]>([
    { id: "row-1", topic: "", count: 1 },
  ])
  const [loadingBatch, setLoadingBatch] = useState(false)

  // Single quick topic
  const [singleTopic, setSingleTopic] = useState("")
  const [loadingSingle, setLoadingSingle] = useState(false)

  const handleAddRow = () => {
    if (topicRows.length >= 10) {
      toast.info("Maximum 10 topics can be added at once")
      return
    }
    setTopicRows(prev => [
      ...prev,
      { id: Math.random().toString(36).slice(2, 9), topic: "", count: 1 },
    ])
  }

  const handleRemoveRow = (id: string) => {
    if (topicRows.length <= 1) return
    setTopicRows(prev => prev.filter(r => r.id !== id))
  }

  const handleTopicChange = (id: string, value: string) => {
    setTopicRows(prev => prev.map(r => (r.id === id ? { ...r, topic: value } : r)))
  }

  const handleCountChange = (id: string, value: number) => {
    const safeCount = Math.max(1, Math.min(20, value || 1))
    setTopicRows(prev => prev.map(r => (r.id === id ? { ...r, count: safeCount } : r)))
  }

  // Generate All Topics (Batch)
  const handleGenerateBatch = async () => {
    const validTopics = topicRows
      .map(r => ({ topic: r.topic.trim(), count: r.count }))
      .filter(r => r.topic.length > 0)

    if (validTopics.length === 0) {
      toast.error("Please enter at least one topic")
      return
    }

    const totalQuestions = validTopics.reduce((s, t) => s + t.count, 0)
    setLoadingBatch(true)

    try {
      const res = await fetch("/api/admin/generate-exam-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          questionType,
          topics: validTopics,
          marks: defaultMarks,
          difficulty: defaultDifficulty,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate questions")
      }

      if (!data.questions || data.questions.length === 0) {
        throw new Error("No questions returned from AI")
      }

      toast.success(`${data.questions.length} questions successfully generated & added to exam!`)
      onSaveBatch(data.questions)
    } catch (err) {
      console.error("Batch generate error:", err)
      toast.error(err instanceof Error ? err.message : "Failed to generate questions with AI")
    } finally {
      setLoadingBatch(false)
    }
  }

  // Single Quick Generate (fills form)
  const handleGenerateSingle = async () => {
    const topic = singleTopic.trim()
    if (!topic) {
      toast.error("Please enter a topic to generate")
      return
    }

    setLoadingSingle(true)
    try {
      const res = await fetch("/api/admin/generate-exam-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          questionType,
          topic,
          count: 1,
          marks: defaultMarks,
          difficulty: defaultDifficulty,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate question")
      }

      if (!data.questions || data.questions.length === 0) {
        throw new Error("No question returned from AI")
      }

      const generated = data.questions[0]
      onFillSingle(generated)
      toast.success("Question generated! You can review or edit it below.")
    } catch (err) {
      console.error("Single generate error:", err)
      toast.error(err instanceof Error ? err.message : "Failed to generate question with AI")
    } finally {
      setLoadingSingle(false)
    }
  }

  const totalRequested = topicRows.reduce((s, r) => s + (r.topic.trim() ? r.count : 0), 0)

  return (
    <div className="space-y-3 mb-5">
      {/* 1. Batch Topics Container */}
      <div className="bg-[#F0F7FF] border border-[#D0E2FF] rounded-2xl p-4 sm:p-5 space-y-3 shadow-2xs">
        <div className="flex items-center justify-between">
          <h4 className="text-xs sm:text-sm font-bold text-[#1D4ED8] tracking-tight">
            Generate up to 10 topics at once
          </h4>
          {totalRequested > 0 && (
            <span className="text-[11px] font-semibold text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded-full">
              {totalRequested} question{totalRequested !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* Topic Rows */}
        <div className="space-y-2">
          {topicRows.map((row, idx) => (
            <div key={row.id} className="flex items-center gap-2">
              <input
                type="text"
                value={row.topic}
                onChange={(e) => handleTopicChange(row.id, e.target.value)}
                placeholder={`Topic ${idx + 1}`}
                className="flex-1 bg-white border border-gray-200 rounded-xl px-3.5 py-2 text-sm text-[#2D3A4A] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-2xs"
              />
              <input
                type="number"
                min={1}
                max={20}
                value={row.count}
                onChange={(e) => handleCountChange(row.id, parseInt(e.target.value, 10))}
                className="w-16 bg-white border border-gray-200 rounded-xl px-2 py-2 text-sm text-center font-semibold text-[#2D3A4A] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-2xs"
                title="Number of questions"
              />
              {idx === topicRows.length - 1 && topicRows.length < 10 ? (
                <button
                  type="button"
                  onClick={handleAddRow}
                  className="w-10 h-10 bg-white border border-gray-200 rounded-xl flex items-center justify-center text-gray-500 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50/50 transition-colors cursor-pointer shrink-0 shadow-2xs"
                  title="Add another topic"
                >
                  <Plus size={16} />
                </button>
              ) : topicRows.length > 1 ? (
                <button
                  type="button"
                  onClick={() => handleRemoveRow(row.id)}
                  className="w-10 h-10 bg-white border border-gray-200 rounded-xl flex items-center justify-center text-gray-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50/50 transition-colors cursor-pointer shrink-0 shadow-2xs"
                  title="Remove topic"
                >
                  <X size={15} />
                </button>
              ) : (
                <div className="w-10 shrink-0" />
              )}
            </div>
          ))}
        </div>

        {/* Generate All Topics Button */}
        <div>
          <button
            type="button"
            disabled={loadingBatch || loadingSingle}
            onClick={handleGenerateBatch}
            className="bg-[#2D3A4A] hover:bg-[#1e2a38] text-white text-xs sm:text-sm font-semibold px-4 py-2.5 rounded-xl shadow-xs flex items-center gap-2 transition-all cursor-pointer disabled:opacity-60"
          >
            {loadingBatch ? (
              <>
                <Loader2 size={15} className="animate-spin text-blue-300" />
                <span>Generating {totalRequested > 0 ? `${totalRequested} ` : ""}Questions...</span>
              </>
            ) : (
              <>
                <Sparkles size={15} className="text-amber-300" />
                <span>Generate All Topics</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 2. Single Topic Bar */}
      <div className="bg-white border border-gray-200 rounded-2xl p-1.5 sm:p-2 shadow-xs flex items-center gap-2">
        <input
          type="text"
          value={singleTopic}
          onChange={(e) => setSingleTopic(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              handleGenerateSingle()
            }
          }}
          placeholder="AI topic, e.g. photosynthesis..."
          className="flex-1 bg-transparent px-3 py-1.5 text-sm text-[#2D3A4A] placeholder-gray-400 focus:outline-none"
        />
        <button
          type="button"
          disabled={loadingSingle || loadingBatch || !singleTopic.trim()}
          onClick={handleGenerateSingle}
          className="bg-[#2D3A4A] hover:bg-[#1e2a38] text-white text-xs sm:text-sm font-semibold px-4 py-2 rounded-xl shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60 shrink-0"
        >
          {loadingSingle ? (
            <>
              <Loader2 size={14} className="animate-spin text-blue-300" />
              <span>Generating...</span>
            </>
          ) : (
            <>
              <Sparkles size={14} className="text-amber-300" />
              <span>Generate</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}
