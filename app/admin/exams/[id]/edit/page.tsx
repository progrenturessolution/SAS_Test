"use client"

import { use, Suspense } from "react"
import { Loader2 } from "lucide-react"
import ExamWizard from "@/components/exam/ExamWizard"

function EditExamContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return <ExamWizard editId={id} />
}

export default function EditExamPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
          <div className="flex items-center gap-3 text-slate-500 bg-white px-5 py-3 rounded-2xl border border-slate-200/80 shadow-xs">
            <Loader2 className="animate-spin text-[#324158]" size={20} />
            <span className="text-sm font-semibold text-[#324158]">Loading exam...</span>
          </div>
        </div>
      }
    >
      <EditExamContent params={params} />
    </Suspense>
  )
}
