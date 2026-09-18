"use client"

import { useState, useEffect } from "react"
import { AlertTriangle, X, Shield } from "lucide-react"

interface ProctoringWarningProps {
  warningCount: number
  maxWarnings: number
  warningType: string | null
  onDismiss: () => void
  autoSubmitted: boolean
}

export function ProctoringWarning({
  warningCount,
  maxWarnings,
  warningType,
  onDismiss,
  autoSubmitted,
}: ProctoringWarningProps) {
  if (!warningType && !autoSubmitted) return null

  const messages: Record<string, string> = {
    "tab-switch": "⚠️ WARNING: You switched tabs or minimized the browser. This is not allowed during the exam.",
    "fullscreen-exit": "⚠️ WARNING: You exited fullscreen mode. Please return to fullscreen immediately.",
    "face-not-detected": "⚠️ WARNING: No face detected. Please look at the camera.",
    "multiple-faces": "⚠️ WARNING: Multiple faces detected! This is considered cheating.",
    "no-face": "⚠️ WARNING: No face detected. Please look at the camera.",
  }

  const remaining = maxWarnings - warningCount

  if (autoSubmitted) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 text-center shadow-2xl">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield size={28} className="text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Exam Auto-Submitted</h2>
          <p className="text-gray-600 text-sm leading-relaxed">
            Your exam has been automatically submitted due to exceeding the maximum number of proctoring violations ({maxWarnings} warnings).
          </p>
          <p className="text-gray-500 text-xs mt-3">Redirecting to results...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl p-7 max-w-md w-full mx-4 shadow-2xl border-t-4 border-red-500">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center shrink-0">
              <AlertTriangle size={20} className="text-red-500" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900">Proctoring Warning</h2>
              <p className="text-xs text-red-500 font-semibold">Warning {warningCount} of {maxWarnings}</p>
            </div>
          </div>
          <button onClick={onDismiss} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <p className="text-sm text-gray-700 leading-relaxed mb-5">
          {messages[warningType!] || "A proctoring violation was detected."}
        </p>

        <div className={`p-3 rounded-xl text-sm font-medium ${remaining <= 1 ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>
          {remaining <= 0
            ? "This was your final warning. Your exam will be submitted."
            : `You have ${remaining} warning${remaining === 1 ? "" : "s"} remaining before automatic submission.`}
        </div>

        <button
          onClick={onDismiss}
          className="mt-4 w-full py-3 bg-[#2D3A4A] text-white font-semibold rounded-xl text-sm hover:bg-[#1e2a38] transition-colors"
        >
          I Understand - Continue Exam
        </button>
      </div>
    </div>
  )
}
