"use client"

import { useEffect, useState, use } from "react"
import Link from "next/link"
import {
  ShieldAlert, TabletSmartphone, Maximize, Camera, Users,
  CheckCircle2, XCircle, ArrowLeft, Award, Clock,
  User, Check, AlertTriangle, ShieldCheck
} from "lucide-react"

interface ProcEvent {
  type: string
  timestamp: string
  details?: string
}

interface AttemptDetail {
  _id: string
  studentName: string
  studentEmail: string
  studentPhone?: string
  rollNumber: string
  candidateType?: "institute" | "public"
  examId: string
  startedAt: string
  submittedAt?: string
  status: string
  score?: number
  maxScore?: number
  percentage?: number
  passed?: boolean
  proctoring: {
    warnings: number
    autoSubmitted?: boolean
    events: ProcEvent[]
  }
}

const getEventBadge = (type: string) => {
  switch (type) {
    case "tab-switch":
      return {
        icon: <TabletSmartphone size={14} className="text-amber-600" />,
        label: "Tab Switch Detected",
        bgColor: "bg-amber-50",
        borderColor: "border-amber-200/80",
        textColor: "text-amber-900",
      }
    case "fullscreen-exit":
      return {
        icon: <Maximize size={14} className="text-blue-600" />,
        label: "Fullscreen Exit",
        bgColor: "bg-blue-50",
        borderColor: "border-blue-200/80",
        textColor: "text-blue-900",
      }
    case "face-not-detected":
    case "no-face":
      return {
        icon: <Camera size={14} className="text-rose-600" />,
        label: "No Face Detected",
        bgColor: "bg-rose-50",
        borderColor: "border-rose-200/80",
        textColor: "text-rose-900",
      }
    case "multiple-faces":
      return {
        icon: <Users size={14} className="text-purple-600" />,
        label: "Multiple Faces Detected",
        bgColor: "bg-purple-50",
        borderColor: "border-purple-200/80",
        textColor: "text-purple-900",
      }
    default:
      return {
        icon: <ShieldAlert size={14} className="text-slate-600" />,
        label: type.replace(/-/g, " "),
        bgColor: "bg-slate-50",
        borderColor: "border-slate-200",
        textColor: "text-slate-900",
      }
  }
}

export default function ResultDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [attempt, setAttempt] = useState<AttemptDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/admin/results/${id}`)
      .then((r) => r.json())
      .then((d) => {
        setAttempt(d.attempt)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 bg-[#F8F9FD]">
        <div className="w-10 h-10 border-4 border-[#131B2A] border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs font-semibold text-slate-500">Loading proctoring audit log...</p>
      </div>
    )
  }

  if (!attempt) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 bg-[#F8F9FD]">
        <XCircle size={40} className="text-rose-400 mb-2" />
        <h2 className="text-base font-bold text-slate-800">Result Not Found</h2>
        <p className="text-xs text-slate-500 mt-1 mb-4">Could not retrieve attempt proctoring logs.</p>
        <Link
          href="/admin/results"
          className="text-xs font-semibold text-slate-700 bg-white border border-slate-200 px-4 py-2 rounded-xl hover:bg-slate-50 transition-colors"
        >
          ← Back to Results
        </Link>
      </div>
    )
  }

  const warnings = attempt.proctoring?.warnings || 0
  const events = attempt.proctoring?.events || []
  const isClean = warnings === 0 && events.length === 0

  return (
    <div className="min-h-screen bg-[#F8F9FD] text-slate-800 p-4 sm:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
          <div>
            <Link
              href="/admin/results"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors mb-2"
            >
              <ArrowLeft size={14} /> Back to Results
            </Link>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Proctoring &amp; Integrity Audit
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Automated surveillance alerts, tab-switching log, and session telemetry
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              href={`/admin/results/${attempt._id}/review`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-[#131B2A] hover:bg-[#1f293d] text-white shadow-2xs transition-colors"
            >
              <Award size={13} /> Review &amp; Grade
            </Link>
          </div>
        </div>

        {/* 3 Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: Aspirant Information */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#131B2A] text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-2xs">
                {attempt.studentName?.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                  {attempt.studentName}
                </h3>
                <p className="text-[11px] text-slate-400 font-medium truncate">{attempt.studentEmail}</p>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-2.5 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Mobile Number:</span>
                <span className="font-semibold text-slate-800">{attempt.studentPhone || "Not provided"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Roll Number:</span>
                <span className="font-semibold text-slate-800">{attempt.rollNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Submission:</span>
                <span className="font-semibold text-slate-800 capitalize">
                  {attempt.status?.replace("-", " ") || "Submitted"}
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: Performance Summary */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Exam Score
              </span>
              {attempt.passed != null && (
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    attempt.passed
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200/70"
                      : "bg-rose-50 text-rose-700 border border-rose-200/70"
                  }`}
                >
                  {attempt.passed ? "PASSED" : "FAILED"}
                </span>
              )}
            </div>

            <div>
              <p className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                {attempt.score ?? "—"} <span className="text-xs sm:text-sm font-medium text-slate-400">/ {attempt.maxScore ?? "—"}</span>
              </p>
              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-2">
                <div
                  className="bg-[#131B2A] h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(0, attempt.percentage || 0))}%` }}
                />
              </div>
            </div>

            <div className="border-t border-slate-100 pt-2 text-[11px] text-slate-500 flex items-center justify-between">
              <span>Percentage: <strong className="text-slate-800">{attempt.percentage ?? "—"}%</strong></span>
              <span>{attempt.submittedAt ? new Date(attempt.submittedAt).toLocaleDateString() : ""}</span>
            </div>
          </div>

          {/* Card 3: Proctoring Integrity */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Session Status
              </span>
              {attempt.proctoring?.autoSubmitted ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500 text-white">
                  Auto-submitted
                </span>
              ) : isClean ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/70">
                  Clean Session
                </span>
              ) : (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200/70">
                  Violations Logged
                </span>
              )}
            </div>

            <div>
              <p className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                {warnings} <span className="text-xs sm:text-sm font-medium text-slate-400">Warnings</span>
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                {events.length} proctoring telemetry event{events.length !== 1 ? "s" : ""} recorded
              </p>
            </div>

            <div className="border-t border-slate-100 pt-2 text-[11px] text-slate-400">
              Exam window integrity monitoring
            </div>
          </div>
        </div>

        {/* Proctoring Event Stream */}
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-2xs p-4 sm:p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
            <div>
              <h2 className="text-xs sm:text-sm font-bold text-slate-900">
                Detailed Violation &amp; Event Stream
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Chronological timeline of candidate actions during the examination
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700">
              {events.length} Event{events.length !== 1 ? "s" : ""}
            </span>
          </div>

          {events.length === 0 ? (
            <div className="text-center py-12 px-4 space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center mx-auto text-emerald-600">
                <ShieldCheck size={24} />
              </div>
              <h3 className="text-xs sm:text-sm font-bold text-slate-800">
                Clean Proctoring Record
              </h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                The candidate stayed within the designated examination environment without tab switches, camera obstructions, or multi-face detection.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {events.map((ev, i) => {
                const badge = getEventBadge(ev.type)
                const date = new Date(ev.timestamp)
                const timeStr = isNaN(date.getTime()) ? ev.timestamp : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })

                return (
                  <div
                    key={i}
                    className="py-3 sm:py-3.5 flex items-start justify-between gap-3 hover:bg-slate-50/50 rounded-xl px-2 transition-colors"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className={`w-8 h-8 rounded-xl ${badge.bgColor} border ${badge.borderColor} flex items-center justify-center shrink-0 mt-0.5`}>
                        {badge.icon}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className={`text-xs sm:text-[13px] font-bold ${badge.textColor}`}>
                            {badge.label}
                          </p>
                          <span className="text-[10px] text-slate-400 font-mono">
                            #{i + 1}
                          </span>
                        </div>
                        {ev.details && (
                          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed break-words">
                            {ev.details}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-slate-100/70 px-2 py-0.5 rounded-md">
                        <Clock size={11} className="text-slate-400" />
                        <span>{timeStr}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
