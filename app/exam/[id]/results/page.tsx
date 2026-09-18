"use client"

import { useState, useEffect, use, Suspense } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Loader2, ClipboardList } from "lucide-react"

// ─── Inner Component ──────────────────────────────────────────────────────────

function ResultsLookupInner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()

  const [rollNumber, setRollNumber] = useState("")
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [examInfo, setExamInfo] = useState<{ title: string; subject: string } | null>(null)

  useEffect(() => {
    fetch(`/api/exams/${id}`)
      .then(r => r.json())
      .then(data => {
        if (data.exam) {
          setExamInfo({ title: data.exam.title, subject: data.exam.subject })
        } else {
          console.warn('No exam data returned')
        }
      })
      .catch((err) => {
        console.warn('Error fetching exam info:', err)
      })
  }, [id])

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!rollNumber.trim() && !email.trim()) {
      setError("Please enter your Roll Number or Email")
      return
    }
    setLoading(true)
    setError("")

    try {
      const res = await fetch(`/api/exams/${id}/results/lookup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rollNumber: rollNumber.trim(),
          email: email.trim().toLowerCase(),
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Result not found")
        setLoading(false)
        return
      }

      if (data.attempt?._id) {
        router.push(`/exam/${id}/result/analytics?attemptId=${data.attempt._id}`)
      } else {
        setError("Result not found")
        setLoading(false)
      }
    } catch {
      setError("Something went wrong. Please try again.")
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#f0f3f8] relative overflow-hidden">
      {/* ─── Decorative Background Circles ─────────────────────────────────── */}
      <div className="absolute top-[-80px] right-[-60px] w-[320px] h-[320px] rounded-full bg-[#d8dfe9]/40 pointer-events-none" />
      <div className="absolute top-[60px] right-[40px] w-[180px] h-[180px] rounded-full bg-[#c5d0de]/30 pointer-events-none" />
      <div className="absolute bottom-[-100px] left-[-80px] w-[280px] h-[280px] rounded-full bg-[#d8dfe9]/30 pointer-events-none" />

      {/* ─── Header ───────────────────────────────────────────────────────── */}
      <header className="w-full px-8 py-4 flex items-center justify-between z-10">
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/logo.png"
            alt="Progrentures Solution"
            width={72}
            height={24}
            priority
            className="object-contain"
          />
        </Link>
        <button className="px-5 py-2 bg-[#2D3A4A] text-white text-sm font-medium rounded-lg hover:bg-[#1e2a38] transition-colors">
          Need Help?
        </button>
      </header>

      {/* ─── Main Card ────────────────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center px-4 py-6 z-10">
        <div className="w-full max-w-[440px]">
          <div className="bg-white rounded-2xl shadow-lg shadow-gray-200/60 border border-gray-100/80 px-8 py-10">
            {/* Icon */}
            <div className="flex justify-center mb-5">
              <div className="w-12 h-12 rounded-xl bg-[#f0f3f8] flex items-center justify-center">
                <ClipboardList size={22} className="text-[#2D3A4A]" />
              </div>
            </div>

            {/* Title */}
            <h1 className="text-2xl font-bold text-[#1a2535] text-center mb-1.5">
              View Your Results
            </h1>
            <p className="text-sm text-gray-400 text-center mb-7">
              Enter your credentials to access your exam results
            </p>

            {/* Form */}
            <form onSubmit={handleLookup} className="space-y-5">
              {/* Exam ID (read-only) */}
              <div>
                <label className="block text-sm font-medium text-[#2D3A4A] mb-1.5">
                  Exam ID / Code
                </label>
                <input
                  type="text"
                  value={examInfo?.title ? `${examInfo.title}` : id}
                  readOnly
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm text-gray-500 bg-gray-50 cursor-not-allowed outline-none"
                />
              </div>

              {/* Roll Number */}
              <div>
                <label className="block text-sm font-medium text-[#2D3A4A] mb-1.5">
                  Roll Number / Student ID
                </label>
                <input
                  type="text"
                  value={rollNumber}
                  onChange={(e) => { setRollNumber(e.target.value); setError("") }}
                  placeholder="Enter your roll number"
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2D3A4A]/15 focus:border-[#2D3A4A]/40 transition-all"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-[#2D3A4A] mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError("") }}
                  placeholder="Enter your email address"
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2D3A4A]/15 focus:border-[#2D3A4A]/40 transition-all"
                />
              </div>

              {/* Error */}
              {error && (
                <div className="px-4 py-2.5 rounded-lg bg-red-50 border border-red-100 text-sm text-red-600">
                  {error}
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-[#2D3A4A] text-white font-semibold rounded-lg hover:bg-[#1e2a38] transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Looking up...
                  </>
                ) : (
                  "View Results"
                )}
              </button>
            </form>

            {/* Helper text */}
            <p className="text-xs text-gray-400 text-center mt-5">
              Forgot your credentials? Contact your exam administrator
            </p>
          </div>
        </div>
      </div>

      {/* ─── Footer ───────────────────────────────────────────────────────── */}
      <footer className="w-full px-8 py-4 flex items-center justify-between text-xs text-gray-400 z-10">
        <span>2026 Progrentures Solutions. All rights reserved.</span>
        <div className="flex items-center gap-6">
          <Link href="#" className="hover:text-gray-600 transition-colors">Privacy Policy</Link>
          <Link href="#" className="hover:text-gray-600 transition-colors">Terms of Service</Link>
          <Link href="#" className="hover:text-gray-600 transition-colors">Support</Link>
        </div>
      </footer>
    </div>
  )
}

// ─── Default Export with Suspense ──────────────────────────────────────────────

export default function ResultsLookupPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#f0f3f8] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-[#2D3A4A] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <ResultsLookupInner params={params} />
    </Suspense>
  )
}
