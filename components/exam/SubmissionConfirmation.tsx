"use client"

import Link from "next/link"
import { CheckCircle2, Clock, FileCheck2, Home, MailCheck, User } from "lucide-react"
import { ProcrentureLogo } from "@/components/exam/ExamShared"

interface InstituteBrand {
  name?: string
  code?: string
  logo?: string | null
  themeColor?: string
}

export interface SubmissionConfirmationProps {
  examId: string
  examTitle?: string
  studentName?: string
  rollNumber?: string
  submittedAt?: string
  institute?: InstituteBrand | null
}

function formatSubmissionTime(value?: string) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  })
}

export function SubmissionConfirmation({
  examId,
  examTitle,
  studentName,
  rollNumber,
  submittedAt,
  institute,
}: SubmissionConfirmationProps) {
  const accentColor = institute?.themeColor || "#131B2A"
  const formattedTime = formatSubmissionTime(submittedAt)

  return (
    <div className="min-h-screen bg-[#F8F9FD] flex flex-col">
      <header className="bg-white border-b border-slate-100 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <ProcrentureLogo
              small={!institute?.logo}
              src={institute?.logo}
              alt={institute?.name}
            />
            {institute?.name && (
              <span className="text-sm font-bold text-slate-700 truncate">
                {institute.name}
              </span>
            )}
          </div>
          <Link
            href={`/exam/${examId}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors shrink-0"
          >
            <Home className="w-3.5 h-3.5" />
            Exam Portal
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="max-w-lg w-full bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="h-1.5 w-full" style={{ backgroundColor: accentColor }} />

          <div className="p-6 sm:p-10 text-center">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-6 ring-8 ring-emerald-50/50">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 mb-4">
              <FileCheck2 className="w-3.5 h-3.5" />
              Submission Recorded
            </span>

            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 leading-snug">
              Thank You! Your exam has been submitted successfully. Your result will be shared with you later.
            </h1>

            {examTitle && (
              <p className="mt-3 text-sm font-medium text-slate-500">
                {examTitle}
              </p>
            )}

            {(studentName || rollNumber || formattedTime) && (
              <div className="mt-6 rounded-2xl bg-slate-50 border border-slate-100 p-4 text-left space-y-2.5">
                {studentName && (
                  <div className="flex items-center justify-between gap-3 text-xs sm:text-sm">
                    <span className="inline-flex items-center gap-1.5 text-slate-500">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      Candidate
                    </span>
                    <span className="font-semibold text-slate-800 text-right">
                      {studentName}
                      {rollNumber ? ` (${rollNumber})` : ""}
                    </span>
                  </div>
                )}

                {formattedTime && (
                  <div className="flex items-center justify-between gap-3 text-xs sm:text-sm">
                    <span className="inline-flex items-center gap-1.5 text-slate-500">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      Submitted At
                    </span>
                    <span className="font-semibold text-slate-800 text-right">
                      {formattedTime}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between gap-3 text-xs sm:text-sm">
                  <span className="inline-flex items-center gap-1.5 text-slate-500">
                    <MailCheck className="w-3.5 h-3.5 text-slate-400" />
                    Result Status
                  </span>
                  <span className="font-semibold text-amber-700 text-right">
                    Pending Release
                  </span>
                </div>
              </div>
            )}

            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href={`/exam/${examId}`}
                style={{ backgroundColor: accentColor }}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white shadow-sm hover:opacity-95 transition-opacity"
              >
                <Home className="w-4 h-4" />
                Return to Exam Portal
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

