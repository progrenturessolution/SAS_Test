"use client"

import { Suspense } from "react"
import { Loader2 } from "lucide-react"
import ExamWizard from "@/components/exam/ExamWizard"

export default function CreateExamPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
          <div className="flex items-center gap-3 text-slate-500 bg-white px-5 py-3 rounded-2xl border border-slate-200/80 shadow-xs">
            <Loader2 className="animate-spin text-[#324158]" size={20} />
            <span className="text-sm font-semibold text-[#324158]">Loading...</span>
          </div>
        </div>
      }
    >
      <ExamWizard />
    </Suspense>
  )
}
