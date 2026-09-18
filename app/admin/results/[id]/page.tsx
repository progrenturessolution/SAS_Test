"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ShieldAlert, TabletSmartphone, Maximize, Camera, CheckCircle, XCircle, ArrowLeft } from "lucide-react"

interface ProcEvent {
  type: string
  timestamp: string
  details?: string
}

interface AttemptDetail {
  _id: string
  studentName: string
  studentEmail: string
  rollNumber: string
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

const eventIcon = (type: string) => {
  if (type === "tab-switch") return <TabletSmartphone size={14} className="text-orange-500" />
  if (type === "fullscreen-exit") return <Maximize size={14} className="text-blue-500" />
  if (type === "face-not-detected" || type === "no-face") return <Camera size={14} className="text-red-500" />
  return <ShieldAlert size={14} className="text-gray-500" />
}

const eventLabel = (type: string) => {
  const m: Record<string, string> = {
    "tab-switch": "Tab Switch Detected",
    "fullscreen-exit": "Fullscreen Exit",
    "face-not-detected": "Face Not Detected",
    "no-face": "No Face Detected",
    "multiple-faces": "Multiple Faces Detected",
  }
  return m[type] || type
}

export default function ResultDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [attempt, setAttempt] = useState<AttemptDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    params.then(({ id }) => {
      fetch(`/api/admin/results/${id}`)
        .then((r) => r.json())
        .then((d) => { setAttempt(d.attempt); setLoading(false) })
    })
  }, [params])

  if (loading) return <div className="p-8 text-gray-400">Loading...</div>
  if (!attempt) return <div className="p-8 text-gray-400">Result not found.</div>

  return (
    <div className="p-8 max-w-4xl">
      <Link href="/admin/results" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-6">
        <ArrowLeft size={16} /> Back to Results
      </Link>

      <h1 className="text-2xl font-bold text-[#2D3A4A] mb-6">Proctoring Report</h1>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-5 mb-6">
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h2 className="font-semibold text-[#2D3A4A] mb-3">Student Info</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Name</span><span className="font-medium">{attempt.studentName}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Email</span><span>{attempt.studentEmail}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Roll No.</span><span>{attempt.rollNumber}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Status</span>
              <span className={`capitalize text-xs px-2 py-0.5 rounded-full ${attempt.status === "submitted" ? "bg-green-100 text-green-700" : attempt.status === "auto-submitted" ? "bg-red-100 text-red-600" : "bg-gray-100 text-gray-600"}`}>
                {attempt.status.replace("-", " ")}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h2 className="font-semibold text-[#2D3A4A] mb-3">Score Summary</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Score</span><span className="font-medium">{attempt.score ?? "—"} / {attempt.maxScore ?? "—"}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Percentage</span><span>{attempt.percentage ?? "—"}%</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Result</span>
              {attempt.passed != null ? (
                attempt.passed
                  ? <span className="flex items-center gap-1 text-green-600"><CheckCircle size={12} /> Pass</span>
                  : <span className="flex items-center gap-1 text-red-500"><XCircle size={12} /> Fail</span>
              ) : <span className="text-gray-400">—</span>}
            </div>
            <div className="flex justify-between"><span className="text-gray-500">Submitted</span>
              <span>{attempt.submittedAt ? new Date(attempt.submittedAt).toLocaleString() : "—"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Proctoring Summary */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 mb-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-[#2D3A4A]">Proctoring Summary</h2>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium px-3 py-1 rounded-full ${attempt.proctoring.warnings > 0 ? "bg-orange-50 text-orange-600" : "bg-green-50 text-green-600"}`}>
              {attempt.proctoring.warnings} Warning{attempt.proctoring.warnings !== 1 ? "s" : ""}
            </span>
            {attempt.proctoring.autoSubmitted && (
              <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full">Auto-submitted</span>
            )}
          </div>
        </div>

        {attempt.proctoring.events.length === 0 ? (
          <div className="text-sm text-gray-400 text-center py-6">No proctoring events recorded. Clean session.</div>
        ) : (
          <div className="space-y-2">
            {attempt.proctoring.events.map((ev, i) => (
              <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="mt-0.5">{eventIcon(ev.type)}</div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-700">{eventLabel(ev.type)}</p>
                  {ev.details && <p className="text-xs text-gray-400">{ev.details}</p>}
                </div>
                <span className="text-xs text-gray-400">{new Date(ev.timestamp).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
