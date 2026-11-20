"use client"

import { useState, useEffect } from "react"
import { createPortal } from "react-dom"
import {
  Bell,
  MessageSquare,
  Check,
  X,
  Send,
  Clock,
  Building2,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  Mail,
  Phone,
  ArrowLeft,
  ChevronRight,
} from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"

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

export default function AdminNotificationBell({ isSuperAdmin = false }: { isSuperAdmin?: boolean }) {
  const [mounted, setMounted] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [queries, setQueries] = useState<QueryItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [filterTab, setFilterTab] = useState<"all" | "pending" | "replied">("all")
  const [activeQuery, setActiveQuery] = useState<QueryItem | null>(null)
  const [replyText, setReplyText] = useState("")
  const [sendingReply, setSendingReply] = useState(false)

  // Ensure portal only mounts on client
  useEffect(() => {
    setMounted(true)
  }, [])

  const fetchQueries = async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/admin/queries", { credentials: "include" })
      const data = await res.json()
      if (data.success) {
        setQueries(data.queries || [])
        setUnreadCount(data.unreadCount || 0)
        // If an active query is open, sync its state
        if (activeQuery) {
          const updated = (data.queries || []).find((q: QueryItem) => q._id === activeQuery._id)
          if (updated) setActiveQuery(updated)
        }
      }
    } catch (err) {
      console.error("Failed to load notifications:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isSuperAdmin) return
    fetchQueries()
    const interval = setInterval(fetchQueries, 30000) // Poll every 30s
    return () => clearInterval(interval)
  }, [isSuperAdmin])

  // Prevent background scroll on mobile/desktop when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = "unset"
    }
    return () => {
      document.body.style.overflow = "unset"
    }
  }, [isOpen])

  // Escape key closes drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown)
    }
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen])

  if (!isSuperAdmin) return null

  const handleOpenQuery = async (q: QueryItem) => {
    setActiveQuery(q)
    setReplyText(q.adminReply || "")
    if (!q.isReadByAdmin) {
      try {
        await fetch(`/api/admin/queries/${q._id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ markRead: true }),
        })
        setQueries((prev) => prev.map((item) => (item._id === q._id ? { ...item, isReadByAdmin: true } : item)))
        setUnreadCount((c) => Math.max(0, c - 1))
      } catch (err) {
        console.error("Failed to mark as read:", err)
      }
    }
  }

  const handleSendReply = async (status: "replied" | "resolved" = "replied") => {
    if (!activeQuery || !replyText.trim()) {
      toast.error("Please enter a reply message")
      return
    }

    try {
      setSendingReply(true)
      const res = await fetch(`/api/admin/queries/${activeQuery._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reply: replyText.trim(), status }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to send reply")

      toast.success(status === "resolved" ? "Query resolved and reply saved!" : "Reply sent to organization successfully!")
      const updated = {
        ...activeQuery,
        adminReply: replyText.trim(),
        status,
        isReadByAdmin: true,
        adminRepliedAt: new Date().toISOString(),
      }
      setActiveQuery(updated)
      setQueries((prev) => prev.map((item) => (item._id === activeQuery._id ? updated : item)))
      fetchQueries()
    } catch (err: any) {
      toast.error(err.message || "Failed to send reply")
    } finally {
      setSendingReply(false)
    }
  }

  const filteredQueries = queries.filter((q) => {
    if (filterTab === "pending") return q.status === "pending"
    if (filterTab === "replied") return q.status === "replied" || q.status === "resolved"
    return true
  })

  const pendingCount = queries.filter((q) => q.status === "pending").length

  return (
    <>
      {/* ── Bell Trigger Button ── */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(true)
          fetchQueries()
        }}
        className="relative p-2 rounded-xl text-gray-700 hover:text-gray-900 hover:bg-gray-100 transition-colors cursor-pointer"
        aria-label="View organization notifications"
        title="Organization Queries & Notifications"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-rose-600 text-white text-[10px] font-extrabold rounded-full flex items-center justify-center animate-pulse shadow-xs">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* ── Portal-Rendered Slide-Over Drawer (Never Clipped, 100% Mobile Responsive) ── */}
      {mounted &&
        isOpen &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex justify-end">
            {/* Backdrop overlay */}
            <div
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/45 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
            />

            {/* Slide-Over Drawer Container */}
            <aside className="relative flex flex-col w-full sm:w-[460px] md:w-[490px] h-full bg-white shadow-2xl z-10 animate-in slide-in-from-right duration-200 border-l border-gray-200">
              {/* Header */}
              <div className="p-4 px-5 border-b border-gray-200 bg-[#2D3A4A] text-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-amber-400">
                    <MessageSquare size={17} />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm leading-tight text-white">
                      Organization Requests
                    </h3>
                    <p className="text-[11px] text-slate-300">
                      {pendingCount > 0 ? `${pendingCount} queries awaiting reply` : "All queries replied"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={fetchQueries}
                    disabled={loading}
                    className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                    title="Refresh queries"
                  >
                    <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false)
                      setActiveQuery(null)
                    }}
                    className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                    title="Close notifications"
                  >
                    <X size={19} />
                  </button>
                </div>
              </div>

              {/* View 1: Active Query Detail & Reply Panel */}
              {activeQuery ? (
                <div className="flex-1 flex flex-col min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4">
                  {/* Back button */}
                  <button
                    type="button"
                    onClick={() => setActiveQuery(null)}
                    className="text-xs font-bold text-[#2D3A4A] hover:opacity-80 flex items-center gap-1.5 cursor-pointer w-fit py-1"
                  >
                    <ArrowLeft size={14} />
                    <span>Back to all requests</span>
                  </button>

                  {/* Organization Card Info */}
                  <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Building2 size={16} className="text-[#2D3A4A] shrink-0" />
                        <span className="font-bold text-xs sm:text-sm text-gray-900 truncate">
                          {activeQuery.instituteName}
                        </span>
                        {activeQuery.instituteCode && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 bg-white border border-gray-200 rounded text-gray-600">
                            {activeQuery.instituteCode}
                          </span>
                        )}
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          activeQuery.status === "resolved"
                            ? "bg-slate-100 text-slate-700"
                            : activeQuery.status === "replied"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-amber-50 text-amber-700 border border-amber-200"
                        }`}
                      >
                        {activeQuery.status}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <p className="text-xs font-bold text-[#324158]">{activeQuery.subject}</p>
                      <p className="text-xs text-gray-800 whitespace-pre-wrap bg-white p-3 rounded-lg border border-gray-200 leading-relaxed">
                        {activeQuery.message}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-gray-500 pt-1">
                      <span className="flex items-center gap-1">
                        <Mail size={12} className="text-gray-400" />
                        {activeQuery.contactEmail}
                      </span>
                      {activeQuery.contactPhone && (
                        <span className="flex items-center gap-1">
                          <Phone size={12} className="text-gray-400" />
                          {activeQuery.contactPhone}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock size={12} className="text-gray-400" />
                        {new Date(activeQuery.createdAt).toLocaleString([], {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Previous Reply if any */}
                  {activeQuery.adminReply && (
                    <div className="p-3.5 rounded-xl bg-emerald-50/90 border border-emerald-200 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-emerald-950 flex items-center gap-1.5">
                          <CheckCircle2 size={13} className="text-emerald-600" />
                          Your Reply:
                        </span>
                        {activeQuery.adminRepliedAt && (
                          <span className="text-[10px] text-emerald-700">
                            {new Date(activeQuery.adminRepliedAt).toLocaleString([], {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-emerald-900 whitespace-pre-wrap leading-relaxed">
                        {activeQuery.adminReply}
                      </p>
                    </div>
                  )}

                  {/* Reply Form */}
                  <div className="space-y-2 pt-2 border-t border-gray-100 mt-auto">
                    <label className="text-xs font-bold text-gray-800 block">
                      {activeQuery.adminReply ? "Update Reply / Send Follow Up:" : "Write Reply to Organization:"}
                    </label>
                    <textarea
                      rows={4}
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Type your response here (e.g. Your exam quota has been increased to 50 exams)..."
                      className="w-full text-xs p-3 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#2D3A4A]/20 focus:border-[#2D3A4A] transition-all resize-none leading-relaxed"
                    />

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
                      <a
                        href={`mailto:${activeQuery.contactEmail}?subject=${encodeURIComponent(
                          "Re: " + activeQuery.subject
                        )}`}
                        className="text-[11px] text-slate-500 hover:text-slate-800 underline font-medium flex items-center gap-1"
                      >
                        <Mail size={12} />
                        <span>Email directly</span>
                      </a>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleSendReply("resolved")}
                          disabled={sendingReply || !replyText.trim()}
                          className="px-3 py-2 rounded-xl text-xs font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1"
                        >
                          <CheckCircle2 size={13} className="text-emerald-600" />
                          <span>Resolve</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSendReply("replied")}
                          disabled={sendingReply || !replyText.trim()}
                          className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#2D3A4A] text-white hover:bg-[#1E293B] shadow-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1"
                        >
                          <Send size={13} />
                          <span>{sendingReply ? "Sending..." : "Send Reply"}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* View 2: Queries List */
                <div className="flex-1 flex flex-col min-h-0">
                  {/* Filter Tabs */}
                  <div className="p-3 px-4 border-b border-gray-100 bg-gray-50/70 flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setFilterTab("all")}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        filterTab === "all"
                          ? "bg-[#2D3A4A] text-white shadow-xs"
                          : "text-gray-600 hover:bg-gray-200/60"
                      }`}
                    >
                      All ({queries.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterTab("pending")}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        filterTab === "pending"
                          ? "bg-amber-600 text-white shadow-xs"
                          : "text-amber-800 hover:bg-amber-100/60"
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${filterTab === "pending" ? "bg-white" : "bg-amber-500"}`} />
                      Pending ({pendingCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterTab("replied")}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        filterTab === "replied"
                          ? "bg-emerald-700 text-white shadow-xs"
                          : "text-gray-600 hover:bg-gray-200/60"
                      }`}
                    >
                      Replied ({queries.filter((q) => q.status === "replied" || q.status === "resolved").length})
                    </button>
                  </div>

                  {/* Scrollable list */}
                  <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
                    {loading && queries.length === 0 ? (
                      <div className="p-12 text-center text-xs text-gray-400">Loading requests...</div>
                    ) : filteredQueries.length === 0 ? (
                      <div className="p-12 text-center space-y-2">
                        <CheckCircle2 size={28} className="text-emerald-500 mx-auto" />
                        <p className="text-xs font-bold text-gray-800">No requests found</p>
                        <p className="text-[11px] text-gray-400">
                          {filterTab === "pending"
                            ? "All organization queries have been addressed!"
                            : "No incoming queries from organizations yet."}
                        </p>
                      </div>
                    ) : (
                      filteredQueries.map((q) => {
                        const isUnread = !q.isReadByAdmin
                        return (
                          <div
                            key={q._id}
                            onClick={() => handleOpenQuery(q)}
                            className={`p-4 hover:bg-gray-50/80 transition-all cursor-pointer text-left space-y-1.5 border-l-4 ${
                              isUnread ? "bg-amber-50/40 border-l-amber-500" : "border-l-transparent"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 min-w-0">
                                {isUnread && <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />}
                                <span className="font-bold text-xs text-gray-900 truncate">
                                  {q.instituteName}
                                </span>
                                {q.instituteCode && (
                                  <span className="text-[9px] font-mono px-1.5 py-0.2 bg-gray-100 text-gray-600 rounded">
                                    {q.instituteCode}
                                  </span>
                                )}
                              </div>
                              <span
                                className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                  q.status === "resolved"
                                    ? "bg-slate-100 text-slate-700"
                                    : q.status === "replied"
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
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
                              <span className="text-xs font-bold text-[#2D3A4A] flex items-center gap-0.5 hover:underline">
                                <span>{q.adminReply ? "View Reply" : "Reply"}</span>
                                <ChevronRight size={13} />
                              </span>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              )}

              {/* Footer */}
              <div className="p-3 px-5 border-t border-gray-100 bg-gray-50/80 flex items-center justify-between text-xs shrink-0">
                <span className="text-[11px] text-gray-500">Progrentures Support Desk</span>
                <Link
                  href="/admin/queries"
                  onClick={() => setIsOpen(false)}
                  className="text-xs font-bold text-[#2D3A4A] hover:underline flex items-center gap-1"
                >
                  <span>Open Full Screen Page</span>
                  <ExternalLink size={12} />
                </Link>
              </div>
            </aside>
          </div>,
          document.body
        )}
    </>
  )
}
