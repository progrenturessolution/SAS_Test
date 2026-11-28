"use client"

import { Suspense, use, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { SubmissionConfirmation } from "@/components/exam/SubmissionConfirmation"

interface ConfirmationData {
  examTitle?: string
  studentName?: string
  rollNumber?: string
  submittedAt?: string
  isPublic?: boolean
  institute?: {
    name?: string
    code?: string
    logo?: string | null
    themeColor?: string
  } | null
}

function SubmittedPageContent({ examId }: { examId: string }) {
  const searchParams = useSearchParams()
  const attemptId = searchParams.get("attemptId")
  const hasPublicParam = searchParams.get("access") === "public" || searchParams.get("type") === "public"

  const [data, setData] = useState<ConfirmationData>({ isPublic: hasPublicParam })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    async function loadDetails() {
      try {
        const [attemptRes, examRes] = await Promise.all([
          attemptId ? fetch(`/api/attempts/${attemptId}`).then((r) => (r.ok ? r.json() : null)).catch(() => null) : Promise.resolve(null),
          fetch(`/api/exams/${examId}`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
        ])

        if (!active) return

        const attempt = attemptRes?.attempt
        const attemptExam = typeof attempt?.examId === "object" ? attempt.examId : null
        const exam = examRes?.exam || attemptExam

        setData({
          examTitle: exam?.title,
          studentName: attempt?.studentName,
          rollNumber: attempt?.rollNumber,
          submittedAt: attempt?.submittedAt,
          isPublic: hasPublicParam || attempt?.candidateType === "public",
          institute: exam?.institute || attemptExam?.institute || null,
        })
      } finally {
        if (active) setLoading(false)
      }
    }

    loadDetails()
    return () => {
      active = false
    }
  }, [examId, attemptId, hasPublicParam])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9FD]">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-[#131B2A] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-500 text-sm font-medium">Finalizing your submission...</p>
        </div>
      </div>
    )
  }

  return (
    <SubmissionConfirmation
      examId={examId}
      examTitle={data.examTitle}
      studentName={data.studentName}
      rollNumber={data.rollNumber}
      submittedAt={data.submittedAt}
      institute={data.institute}
      isPublic={data.isPublic}
    />
  )
}

export default function ExamSubmittedPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)

  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#F8F9FD]">
          <div className="w-10 h-10 border-4 border-[#131B2A] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <SubmittedPageContent examId={id} />
    </Suspense>
  )
}

