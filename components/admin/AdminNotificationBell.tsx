"use client"

import { useState, useEffect, useRef } from "react"
import { Bell, MessageSquare, Check, X, Send, Clock, Building2, ExternalLink, RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react"
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
  const [isOpen, setIsOpen] = useState(false)
  const [queries, setQueries] = useState<QueryItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [activeQuery, setActiveQuery] = useState<QueryItem | null>(null)
  const [replyText, setReplyText] = useState("")
  const [sendingReply, setSendingReply] = useState(false)

  const dropdownRef = useRef<HTMLDivElement>(null)

  const fetchQueries = async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/admin/queries", { credentials: "include" })
      const data = await res.json()
      if (data.success) {
        setQueries(data.queries || [])
        setUnreadCount(data.unreadCount || 0)
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
    const interval = setInterval(fetchQueries, 30000) // Poll every 30 seconds
    return () => clearInterval(interval)
  }, [isSuperAdmin])

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }
    return () => document.removeEventListener("mousedown", handleClickOutside)
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

      toast.success(status === "resolved" ? "Query resolved and reply sent!" : "Reply sent to organization successfully!")
      setQueries((prev) =>
        prev.map((item) =>
          item._id === activeQuery._id
            ? { ...item, adminReply: replyText.trim(), status, isReadByAdmin: true }
            : item
        )
      )
      setActiveQuery(null)
      setReplyText("")
      fetchQueries()
    } catch (err: any) {
      toast.error(err.message || "Failed to send reply")
    } finally {
      setSendingReply(false)
    }
  }

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen)
          if (!isOpen) fetchQueries()
        }}
        className="relative p-2 rounded-xl text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors cursor-pointer"
        aria-label="View notifications"
        title="Organization Queries & Notifications"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-rose-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse shadow-xs">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="fixed sm:absolute right-4 sm:right-0 top-14 sm:top-full mt-2 w-[340px] sm:w-[400px] max-w-[95vw] bg-white rounded-2xl shadow-2xl border border-gray-200 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header */}
          <div className="p-3.5 px-4 border-b border-gray-100 bg-gray-50/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare size={16} className="text-[#2D3A4A]" />
              <h3 className="font-bold text-xs sm:text-sm text-gray-900">Organization Requests</h3>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={fetchQueries}
                disabled={loading}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
                title="Refresh notifications"
              >
                <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* List or Active Query View */}
          {activeQuery ? (
            /* Active Query Reply Drawer/View */
            <div className="p-4 space-y-3 max-h-[460px] overflow-y-auto">
              <button
                type="button"
                onClick={() => setActiveQuery(null)}
                className="text-xs font-semibold text-gray-500 hover:text-gray-800 flex items-center gap-1 cursor-pointer"
              >
                ← Back to notifications
              </button>

              <div className="p-3 rounded-xl bg-gray-50 border border-gray-200/80 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Building2 size={14} className="text-[#2D3A4A] shrink-0" />
                    <span className="font-bold text-xs text-gray-900 truncate">{activeQuery.instituteName}</span>
                    {activeQuery.instituteCode && (
                      <span className="text-[10px] font-mono px-1.5 py-0.2 bg-white rounded border border-gray-200">
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

                <p className="text-xs font-semibold text-[#324158]">{activeQuery.subject}</p>
                <p className="text-xs text-gray-700 whitespace-pre-wrap bg-white p-2.5 rounded-lg border border-gray-100 leading-relaxed">
                  {activeQuery.message}
                </p>
                <div className="flex flex-wrap items-center gap-3 text-[10px] text-gray-400 pt-1">
                  <span>From: {activeQuery.contactEmail}</span>
                  {activeQuery.contactPhone && <span>Tel: {activeQuery.contactPhone}</span>}
                  <span>{new Date(activeQuery.createdAt).toLocaleDateString()}</span>
                </div>
              </div>

              {/* Reply Section */}
              <div className="space-y-2 pt-1">
                <label className="text-xs font-bold text-gray-700 block">
                  Reply to Organization:
                </label>
                <textarea
                  rows={3}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Type your response here (e.g. Your exam quota has been updated to 30 exams)..."
                  className="w-full text-xs p-2.5 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#2D3A4A]/20 focus:border-[#2D3A4A] transition-all resize-none"
                />

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleSendReply("resolved")}
                    disabled={sendingReply || !replyText.trim()}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1"
                  >
                    <CheckCircle2 size={13} className="text-emerald-600" />
                    <span>Resolve & Reply</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSendReply("replied")}
                    disabled={sendingReply || !replyText.trim()}
                    className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#2D3A4A] text-white hover:bg-[#1E293B] shadow-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1"
                  >
                    <Send size={13} />
                    <span>{sendingReply ? "Sending..." : "Send Reply"}</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Queries List */
            <div className="max-h-[380px] overflow-y-auto divide-y divide-gray-100">
              {loading && queries.length === 0 ? (
                <div className="p-8 text-center text-xs text-gray-400">Loading requests...</div>
              ) : queries.length === 0 ? (
                <div className="p-8 text-center space-y-1">
                  <CheckCircle2 size={24} className="text-emerald-500 mx-auto mb-1" />
                  <p className="text-xs font-bold text-gray-700">All caught up!</p>
                  <p className="text-[11px] text-gray-400">No pending organization queries at the moment.</p>
                </div>
              ) : (
                queries.map((q) => {
                  const isUnread = !q.isReadByAdmin
                  return (
                    <div
                      key={q._id}
                      onClick={() => handleOpenQuery(q)}
                      className={`p-3 px-4 hover:bg-gray-50 transition-colors cursor-pointer text-left space-y-1 ${
                        isUnread ? "bg-amber-50/40" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {isUnread && <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />}
                          <span className="font-bold text-xs text-gray-900 truncate">{q.instituteName}</span>
                          {q.instituteCode && (
                            <span className="text-[9px] font-mono px-1 bg-gray-100 text-gray-500 rounded">
                              {q.instituteCode}
                            </span>
                          )}
                        </div>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                            q.status === "resolved"
                              ? "bg-slate-100 text-slate-600"
                              : q.status === "replied"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-amber-50 text-amber-700 font-bold"
                          }`}
                        >
                          {q.status}
                        </span>
                      </div>

                      <p className="text-xs font-medium text-[#324158] truncate">{q.subject}</p>
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
                        <span className="text-xs font-semibold text-[#2D3A4A] hover:underline">
                          {q.adminReply ? "View / Update Reply →" : "Reply →"}
                        </span>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          )}

          {/* Footer */}
          <div className="p-2.5 px-4 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between text-xs">
            <span className="text-[11px] text-gray-400">Progrentures Support Desk</span>
            <Link
              href="/admin/queries"
              onClick={() => setIsOpen(false)}
              className="text-xs font-bold text-[#2D3A4A] hover:underline flex items-center gap-1"
            >
              <span>View All In Dedicated Page</span>
              <ExternalLink size={11} />
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
