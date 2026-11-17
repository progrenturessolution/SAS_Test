"use client"

import Link from "next/link"
import { Layers, Sparkles, Clock, ArrowLeft, CheckCircle2 } from "lucide-react"

export default function OtherExamsPage() {
  return (
    <div className="p-6 sm:p-10 max-w-4xl mx-auto min-h-screen flex flex-col justify-center items-center text-center">
      <div className="w-20 h-20 rounded-3xl bg-blue-50 border border-blue-200/80 flex items-center justify-center text-blue-600 mb-6 shadow-sm animate-pulse">
        <Layers size={40} />
      </div>

      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200/60 text-blue-700 text-xs font-bold uppercase tracking-wider mb-3">
        <Sparkles size={14} />
        <span>Module In Active Development</span>
      </div>

      <h1 className="text-3xl sm:text-4xl font-extrabold text-[#1a2535] tracking-tight mb-3">
        Other Exams Studio
      </h1>

      <p className="text-gray-500 max-w-lg text-sm sm:text-base leading-relaxed mb-8">
        We are actively engineering support for state board exams, scholarship tests, Olympiads, and custom certification evaluations. This module will be released soon!
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-2xl mb-10 text-left">
        {[
          { title: "State & Board Papers", desc: "ICSE, State Boards & Olympiad frameworks" },
          { title: "Scholarship & Aptitude", desc: "Foundation & General mental ability test templates" },
          { title: "Custom Question Banks", desc: "Bulk import and custom subject mapping" },
        ].map((item, i) => (
          <div key={i} className="p-4 rounded-xl bg-white border border-gray-200 shadow-2xs">
            <div className="flex items-center gap-2 text-xs font-bold text-gray-800 mb-1">
              <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
              <span>{item.title}</span>
            </div>
            <p className="text-[11px] text-gray-500 leading-normal">{item.desc}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-white text-xs font-bold hover:opacity-90 transition-all shadow-sm cursor-pointer"
        >
          <ArrowLeft size={14} />
          Back to Dashboard
        </Link>
        <Link
          href="/admin/ai-generator"
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-700 text-xs font-bold hover:bg-gray-50 transition-all shadow-2xs cursor-pointer"
        >
          Explore Competitive Tests
        </Link>
      </div>
    </div>
  )
}

