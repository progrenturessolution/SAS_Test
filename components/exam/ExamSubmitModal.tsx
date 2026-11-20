import React from "react"

export interface ExamSubmitModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  submitting?: boolean
  totalAnswered: number
  totalQuestions: number
  markedForReview?: number
  warnings?: number
  maxWarnings?: number
  confirmText?: string
}

export function ExamSubmitModal({
  isOpen,
  onClose,
  onConfirm,
  submitting = false,
  totalAnswered,
  totalQuestions,
  markedForReview = 0,
  warnings = 0,
  maxWarnings = 3,
  confirmText = "Confirm & Submit",
}: ExamSubmitModalProps) {
  if (!isOpen) return null

  const remaining = Math.max(0, totalQuestions - totalAnswered)

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[#0F172A]/50 backdrop-blur-xs transition-opacity duration-200"
        onClick={onClose}
      />

      {/* Modal Dialog Box */}
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl sm:max-w-2xl relative overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200/80 p-6 sm:p-9">
        {/* Header */}
        <div className="mb-6">
          <h3 className="text-2xl sm:text-[28px] font-bold text-[#0F172A] tracking-tight">
            Ready to Submit?
          </h3>
          <p className="text-sm sm:text-base text-slate-500 font-normal mt-1.5 leading-relaxed">
            Please review your attempt summary below before submitting the exam.
          </p>
        </div>

        {/* 3 Metric Cards */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4.5 mb-6">
          {/* Answered */}
          <div className="bg-[#F4F6FA] border border-slate-200/60 rounded-2xl p-4 sm:p-5 text-left">
            <span className="text-xs sm:text-sm font-semibold text-slate-700 block">
              Answered
            </span>
            <span className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] mt-2 block tracking-tight">
              {totalAnswered}
            </span>
          </div>

          {/* Remaining */}
          <div className="bg-[#F4F6FA] border border-slate-200/60 rounded-2xl p-4 sm:p-5 text-left">
            <span className="text-xs sm:text-sm font-semibold text-slate-700 block">
              Remaining
            </span>
            <span className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] mt-2 block tracking-tight">
              {remaining}
            </span>
          </div>

          {/* Total Questions */}
          <div className="bg-[#F4F6FA] border border-slate-200/60 rounded-2xl p-4 sm:p-5 text-left">
            <span className="text-xs sm:text-sm font-semibold text-slate-700 block">
              Total Questions
            </span>
            <span className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] mt-2 block tracking-tight">
              {totalQuestions}
            </span>
          </div>
        </div>

        {/* Divider + Inline Metrics Row */}
        <div className="border-t border-slate-100 pt-5 pb-7 sm:pb-8">
          <div className="flex items-center justify-between text-xs sm:text-sm">
            {/* Marked for Review */}
            <div className="flex-1 flex items-center justify-between pr-4 sm:pr-8">
              <span className="font-semibold text-slate-800">Marked for Review</span>
              <span className="font-bold text-[#0F172A] text-sm sm:text-base">
                {markedForReview}
              </span>
            </div>

            {/* Vertical Divider */}
            <div className="h-6 w-px bg-slate-200 shrink-0" />

            {/* Proctoring Warnings */}
            <div className="flex-1 flex items-center justify-between pl-4 sm:pl-8">
              <span className="font-semibold text-slate-800 truncate mr-2">Proctoring Warnings</span>
              <span className="font-bold text-[#0F172A] text-sm sm:text-base shrink-0">
                {warnings} / {maxWarnings}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons (Right-aligned) */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-6 sm:px-7 py-2.5 sm:py-3 rounded-2xl border border-slate-300 hover:border-slate-400 bg-white text-slate-900 text-xs sm:text-sm font-bold hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={submitting}
            className="inline-flex items-center gap-2.5 px-6 sm:px-7 py-2.5 sm:py-3 rounded-2xl bg-[#0F172A] hover:bg-[#1E293B] active:bg-[#020617] text-white text-xs sm:text-sm font-bold shadow-sm transition-all cursor-pointer disabled:opacity-60"
          >
            <span>{submitting ? "Submitting..." : confirmText}</span>
            <span className="text-sm sm:text-base leading-none">→</span>
          </button>
        </div>
      </div>
    </div>
  )
}
