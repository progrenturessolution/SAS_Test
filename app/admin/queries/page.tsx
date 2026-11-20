"use client"

import { useState, useEffect } from "react"
import {
  MessageSquare,
  Building2,
  Clock,
  Send,
  CheckCircle2,
  AlertCircle,
  Filter,
  Search,
  RefreshCw,
  Mail,
  Phone,
  Check,
} from "lucide-react"
import { toast } from "sonner"
import { AdminListSkeleton } from "@/components/SkeletonLoaders"

interface QueryItem {
  _id: string
  instituteName: string
  instituteCode?: string
  contactEmail: string
  contactPhone?: string
  submittedByName?: string
  subject: string
  category: string
  message: string
  status: "pending" | "replied" | "resolved"
  isReadByAdmin: boolean
  adminReply?: string
  adminRepliedAt?: string
  adminRepliedByName?: string
  createdAt: string
}

export default function AdminQueriesPage() {
  const [queries, setQueries] = useState<QueryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "replied" | "resolved">("all")
  const [selectedQuery, setSelectedQuery] = useState<QueryItem | null>(null)
  const [replyText, setReplyText] = useState("")
  const [submittingReply, setSubmittingReply] = useState(false)

  const fetchQueries = async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/admin/queries", { credentials: "include" })
      const data = await res.json()
      if (data.success) {
        setQueries(data.queries || [])
        if (!selectedQuery && data.queries?.length > 0) {
          setSelectedQuery(data.queries[0])
          setReplyText(data.queries[0].adminReply || "")
        }
      }
    } catch (err) {
      console.error("Failed to load queries:", err)
      toast.error("Failed to load organization queries")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchQueries()
  }, [])

  const handleSelectQuery = async (q: QueryItem) => {
    setSelectedQuery(q)
    setReplyText(q.adminReply || "")
    if (!q.isReadByAdmin) {
      try {
        await fetch(`/api/admin/queries/${q._id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ markRead: true }),
        })
        setQueries((prev) => prev.map((item) => (item._id === q._id ? { ...item, isReadByAdmin: true } : item)))
      } catch (err) {
        console.error("Failed to mark as read:", err)
      }
    }
  }

  const handleSendReply = async (status: "replied" | "resolved" = "replied") => {
    if (!selectedQuery || !replyText.trim()) {
      toast.error("Please enter a reply message")
      return
    }

    try {
      setSubmittingReply(true)
      const res = await fetch(`/api/admin/queries/${selectedQuery._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reply: replyText.trim(), status }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to send reply")

      toast.success(status === "resolved" ? "Query resolved and reply saved!" : "Reply sent to organization successfully!")
      const updatedQuery = {
        ...selectedQuery,
        adminReply: replyText.trim(),
        status,
        isReadByAdmin: true,
        adminRepliedAt: new Date().toISOString(),
      }
      setSelectedQuery(updatedQuery)
      setQueries((prev) => prev.map((q) => (q._id === selectedQuery._id ? updatedQuery : q)))
    } catch (err: any) {
      toast.error(err.message || "Failed to send reply")
    } finally {
      setSubmittingReply(false)
    }
  }

  const filtered = queries.filter((q) => {
    const query = search.trim().toLowerCase()
    const matchesSearch =
      !query ||
      q.instituteName?.toLowerCase().includes(query) ||
      q.instituteCode?.toLowerCase().includes(query) ||
      q.subject?.toLowerCase().includes(query) ||
      q.message?.toLowerCase().includes(query)

    if (!matchesSearch) return false
    if (statusFilter !== "all" && q.status !== statusFilter) return false
    return true
  })

  const pendingCount = queries.filter((q) => q.status === "pending").length
  const repliedCount = queries.filter((q) => q.status === "replied").length
  const resolvedCount = queries.filter((q) => q.status === "resolved").length

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#324158]">
            Organization Queries & Requests
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Incoming support queries, quota requests, and communications from registered institutes.
          </p>
        </div>
        <button
          type="button"
          onClick={fetchQueries}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors shadow-2xs cursor-pointer w-fit"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-3.5 sm:p-4 rounded-2xl border border-gray-200 shadow-2xs">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              statusFilter === "all" ? "bg-[#2D3A4A] text-white shadow-xs" : "bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200"
            }`}
          >
            All ({queries.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("pending")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              statusFilter === "pending"
                ? "bg-amber-600 text-white shadow-xs"
                : "bg-gray-50 text-amber-700 hover:bg-amber-50 border border-gray-200"
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${statusFilter === "pending" ? "bg-white" : "bg-amber-500"}`} />
            Pending ({pendingCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("replied")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              statusFilter === "replied"
                ? "bg-blue-600 text-white shadow-xs"
                : "bg-gray-50 text-blue-700 hover:bg-blue-50 border border-gray-200"
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${statusFilter === "replied" ? "bg-white" : "bg-blue-500"}`} />
            Replied ({repliedCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("resolved")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              statusFilter === "resolved"
                ? "bg-emerald-700 text-white shadow-xs"
                : "bg-gray-50 text-emerald-700 hover:bg-emerald-50 border border-gray-200"
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${statusFilter === "resolved" ? "bg-white" : "bg-emerald-500"}`} />
            Resolved ({resolvedCount})
          </button>
        </div>

        <div className="relative w-full md:w-72">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search queries..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2D3A4A]/10 focus:border-[#2D3A4A] transition-all"
          />
        </div>
      </div>

      {/* Main Grid: Queries List (Left) + Selected Query & Reply (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Queries List */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-gray-200 shadow-2xs overflow-hidden">
          <div className="p-3.5 px-4 bg-gray-50/70 border-b border-gray-100 flex items-center justify-between text-xs font-bold text-gray-500 uppercase tracking-wider">
            <span>Requests ({filtered.length})</span>
            {pendingCount > 0 && <span className="text-amber-600 font-semibold">{pendingCount} pending reply</span>}
          </div>

          <div className="divide-y divide-gray-100 max-h-[640px] overflow-y-auto">
            {loading ? (
              <div className="p-6">
                <AdminListSkeleton />
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-12 text-center text-gray-400 text-xs">
                No organization requests match your search or filter.
              </div>
            ) : (
              filtered.map((q) => {
                const isSelected = selectedQuery?._id === q._id
                const isUnread = !q.isReadByAdmin
                return (
                  <div
                    key={q._id}
                    onClick={() => handleSelectQuery(q)}
                    className={`p-4 transition-all cursor-pointer text-left space-y-1.5 border-l-4 ${
                      isSelected
                        ? "bg-slate-50/90 border-l-[#2D3A4A]"
                        : isUnread
                        ? "bg-amber-50/30 border-l-amber-500 hover:bg-amber-50/50"
                        : "border-l-transparent hover:bg-gray-50/70"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {isUnread && <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />}
                        <span className="font-bold text-xs text-gray-900 truncate">{q.instituteName}</span>
                        {q.instituteCode && (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 bg-gray-100 text-gray-600 rounded">
                            {q.instituteCode}
                          </span>
                        )}
                      </div>
                      <span
                        className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          q.status === "resolved"
                            ? "bg-slate-100 text-slate-700"
                            : q.status === "replied"
                            ? "bg-blue-50 text-blue-700 border border-blue-200"
                            : "bg-amber-50 text-amber-700 border border-amber-200 font-bold"
                        }`}
                      >
                        {q.status}
                      </span>
                    </div>

                    <p className="text-xs font-semibold text-[#324158] truncate">{q.subject}</p>
                    <p className="text-[11px] text-gray-500 line-clamp-2 leading-relaxed">{q.message}</p>

                    <div className="flex items-center justify-between text-[10px] text-gray-400 pt-1">
                      <span className="flex items-center gap-1">
                        <Clock size={11} />
                        {new Date(q.createdAt).toLocaleDateString([], {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <span className="text-slate-500 font-medium capitalize">{q.category?.replace("_", " ")}</span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Right Column: Query Detail & Reply Panel */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-gray-200 shadow-2xs overflow-hidden">
          {selectedQuery ? (
            <div className="p-5 sm:p-6 space-y-5">
              {/* Query Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Building2 size={16} className="text-[#2D3A4A]" />
                    <h2 className="text-sm sm:text-base font-bold text-gray-900">{selectedQuery.instituteName}</h2>
                    {selectedQuery.instituteCode && (
                      <span className="text-xs font-mono px-2 py-0.5 bg-gray-100 rounded text-gray-600">
                        {selectedQuery.instituteCode}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Mail size={12} /> {selectedQuery.contactEmail}
                    </span>
                    {selectedQuery.contactPhone && (
                      <span className="flex items-center gap-1">
                        <Phone size={12} /> {selectedQuery.contactPhone}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock size={12} /> {new Date(selectedQuery.createdAt).toLocaleString()}
                    </span>
                  </div>
                </div>

                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider w-fit ${
                    selectedQuery.status === "resolved"
                      ? "bg-slate-100 text-slate-700"
                      : selectedQuery.status === "replied"
                      ? "bg-blue-50 text-blue-700 border border-blue-200"
                      : "bg-amber-50 text-amber-700 border border-amber-200 font-bold"
                  }`}
                >
                  {selectedQuery.status}
                </span>
              </div>

              {/* Query Content */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-[#324158]">{selectedQuery.subject}</h3>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                    {selectedQuery.category?.replace("_", " ")}
                  </span>
                </div>
                <div className="p-4 rounded-xl bg-gray-50 border border-gray-200/80 text-xs text-gray-800 whitespace-pre-wrap leading-relaxed">
                  {selectedQuery.message}
                </div>
              </div>

              {/* Previous Admin Reply if exists */}
              {selectedQuery.adminReply && (
                <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200/80 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-blue-950 flex items-center gap-1.5">
                      <CheckCircle2 size={13} className="text-blue-600" />
                      Previous Admin Reply:
                    </span>
                    {selectedQuery.adminRepliedAt && (
                      <span className="text-[10px] text-blue-600">
                        {new Date(selectedQuery.adminRepliedAt).toLocaleString()}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-blue-900 whitespace-pre-wrap leading-relaxed">
                    {selectedQuery.adminReply}
                  </p>
                </div>
              )}

              {/* Reply Box */}
              <div className="space-y-3 pt-2 border-t border-gray-100">
                <label className="text-xs font-bold text-gray-800 block">
                  {selectedQuery.adminReply ? "Update Reply / Follow Up:" : "Write Reply to Organization:"}
                </label>
                <textarea
                  rows={4}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Type your response to this organization (e.g. Your exam quota has been updated from 20 to 50 exams)..."
                  className="w-full text-xs p-3 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#2D3A4A]/20 focus:border-[#2D3A4A] transition-all resize-none leading-relaxed"
                />

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <a
                    href={`mailto:${selectedQuery.contactEmail}?subject=${encodeURIComponent(
                      "Re: " + selectedQuery.subject
                    )}`}
                    className="text-xs text-slate-500 hover:text-slate-800 underline font-medium flex items-center gap-1"
                  >
                    <Mail size={12} />
                    <span>Or email {selectedQuery.contactEmail} directly</span>
                  </a>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleSendReply("resolved")}
                      disabled={submittingReply || !replyText.trim()}
                      className="px-4 py-2 rounded-xl text-xs font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <CheckCircle2 size={14} className="text-emerald-600" />
                      <span>Resolve & Reply</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSendReply("replied")}
                      disabled={submittingReply || !replyText.trim()}
                      className="px-5 py-2 rounded-xl text-xs font-semibold bg-[#2D3A4A] text-white hover:bg-[#1E293B] shadow-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <Send size={14} />
                      <span>{submittingReply ? "Sending..." : "Send Reply"}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-16 text-center text-gray-400 text-xs">
              Select a query from the left to view details and send a reply.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

