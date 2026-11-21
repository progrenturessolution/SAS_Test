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
  CheckCheck,
  ShieldCheck,
  User,
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
  isReadByInstitute?: boolean
  adminReply?: string
  adminRepliedAt?: string
  adminRepliedByName?: string
  replies?: Array<{
    _id?: string
    senderRole: "admin" | "institute"
    senderName: string
    message: string
    createdAt: string
    isRead?: boolean
  }>
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

  // Prevent background scroll when drawer is open
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
      const newReplyObj = {
        senderRole: "admin" as const,
        senderName: "Progrentures Support",
        message: replyText.trim(),
        createdAt: new Date().toISOString(),
      }
      const existingReplies = activeQuery.replies
        ? [...activeQuery.replies]
        : (activeQuery.adminReply
        ? [{ senderRole: "admin" as const, senderName: activeQuery.adminRepliedByName || "Support", message: activeQuery.adminReply, createdAt: activeQuery.adminRepliedAt || activeQuery.createdAt }]
        : [])

      const updated = {
        ...activeQuery,
        adminReply: replyText.trim(),
        status,
        isReadByAdmin: true,
        adminRepliedAt: new Date().toISOString(),
        replies: [...existingReplies, newReplyObj],
      }
      setReplyText("")
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

  const getInitials = (name: string) => {
    const clean = (name || "").replace(/[^a-zA-Z0-9 ]/g, "").trim()
    const parts = clean.split(" ").filter(Boolean)
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    return clean.slice(0, 2).toUpperCase() || "OR"
  }

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

      {/* ── Portal-Rendered Slide-Over Drawer ── */}
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
            <aside className="relative flex flex-col w-full sm:w-[480px] md:w-[510px] h-full bg-white shadow-2xl z-10 animate-in slide-in-from-right duration-200 border-l border-gray-200">
              {/* Header */}
              <div className="p-4 px-5 border-b border-gray-200 bg-[#324158] text-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-amber-400">
                    <MessageSquare size={17} />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm leading-tight text-white">
                      Organization Communications
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

              {/* View 1: Active Query WhatsApp Conversation Stream */}
              {activeQuery ? (
                <div className="flex-1 flex flex-col min-h-0 bg-[#f8fafc]">
                  {/* Top Header of Active Query */}
                  <div className="p-3.5 px-4 bg-white border-b border-gray-200 flex items-center justify-between gap-3 shrink-0">
                    <button
                      type="button"
                      onClick={() => setActiveQuery(null)}
                      className="text-xs font-bold text-[#324158] hover:opacity-80 flex items-center gap-1 cursor-pointer py-1"
                    >
                      <ArrowLeft size={15} />
                      <span>All requests</span>
                    </button>

                    <div className="flex items-center gap-1.5">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          activeQuery.status === "resolved"
                            ? "bg-slate-100 text-slate-700"
                            : activeQuery.status === "replied"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-amber-100 text-amber-800 border border-amber-200"
                        }`}
                      >
                        {activeQuery.status}
                      </span>
                    </div>
                  </div>

                  {/* WhatsApp Conversation Stream */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {/* Organization Identity Card */}
                    <div className="p-3 rounded-xl bg-white border border-gray-200 flex items-center gap-3 shadow-2xs">
                      <div className="w-10 h-10 rounded-2xl bg-[#324158] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                        {getInitials(activeQuery.instituteName)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs text-gray-900 truncate">
                            {activeQuery.instituteName}
                          </span>
                          {activeQuery.instituteCode && (
                            <span className="text-[10px] font-mono px-1.5 py-0.2 bg-[#eaf0f8] text-[#324158] font-bold rounded">
                              {activeQuery.instituteCode}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-gray-500 truncate flex items-center gap-2 mt-0.5">
                          <span>{activeQuery.contactEmail}</span>
                          {activeQuery.contactPhone && <span>• {activeQuery.contactPhone}</span>}
                        </p>
                      </div>
                    </div>

                    {/* Left Bubble: Institute's Query */}
                    <div className="flex items-start gap-2 max-w-[88%]">
                      <div className="w-7 h-7 rounded-lg bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-[9px] shrink-0 mt-0.5">
                        {getInitials(activeQuery.instituteName)}
                      </div>
                      <div className="bg-white rounded-2xl rounded-tl-xs p-3.5 border border-gray-200 shadow-2xs space-y-1.5 text-left w-full">
                        <div className="flex items-center justify-between gap-1 text-[10px]">
                          <span className="font-bold text-[#324158] capitalize">
                            {activeQuery.category?.replace("_", " ")}
                          </span>
                          <span className="text-gray-400">
                            {new Date(activeQuery.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        <p className="text-xs font-bold text-[#324158]">{activeQuery.subject}</p>
                        <p className="text-xs text-gray-800 whitespace-pre-wrap leading-relaxed">
                          {activeQuery.message}
                        </p>
                      </div>
                    </div>

                    {/* Multi-reply WhatsApp stream: each reply appears sequentially without replacing each other! */}
                    {Array.isArray(activeQuery.replies) && activeQuery.replies.length > 0 ? (
                      activeQuery.replies.map((r, rIdx) => {
                        const isAdmin = r.senderRole === "admin"
                        return (
                          <div
                            key={rIdx}
                            className={`flex items-start gap-2 max-w-[88%] ${isAdmin ? "ml-auto justify-end" : ""}`}
                          >
                            {!isAdmin && (
                              <div className="w-7 h-7 rounded-lg bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-[9px] shrink-0 mt-0.5">
                                {getInitials(activeQuery.instituteName)}
                              </div>
                            )}

                            <div
                              className={`p-3.5 rounded-2xl shadow-2xs space-y-1.5 text-left w-full ${
                                isAdmin
                                  ? "bg-[#324158] text-white rounded-tr-xs"
                                  : "bg-white text-gray-800 rounded-tl-xs border border-gray-200"
                              }`}
                            >
                              <div
                                className={`flex items-center justify-between text-[11px] border-b pb-1 ${
                                  isAdmin ? "text-slate-200 border-white/10" : "text-gray-500 border-gray-100"
                                }`}
                              >
                                <span className="font-bold flex items-center gap-1">
                                  {isAdmin && <ShieldCheck size={12} className="text-emerald-400" />}
                                  {r.senderName || (isAdmin ? "Progrentures Support" : "Organization")}
                                </span>
                                <span className={isAdmin ? "text-slate-300 text-[10px]" : "text-gray-400 text-[10px]"}>
                                  {r.createdAt
                                    ? new Date(r.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                                    : ""}
                                </span>
                              </div>
                              <p className={`text-xs whitespace-pre-wrap leading-relaxed ${isAdmin ? "text-slate-100" : "text-gray-800"}`}>
                                {r.message}
                              </p>
                              {isAdmin && (
                                <div className="flex justify-end items-center gap-1 text-[10px] text-slate-300 pt-0.5">
                                  <span
                                    className="inline-flex items-center shrink-0 ml-0.5"
                                    title={
                                      (typeof (r as any).isRead === "boolean"
                                        ? (r as any).isRead
                                        : activeQuery.isReadByInstitute)
                                        ? "Read by organization"
                                        : "Delivered"
                                    }
                                  >
                                    <CheckCheck
                                      size={16}
                                      strokeWidth={2.2}
                                      className={`shrink-0 ${
                                        (typeof (r as any).isRead === "boolean"
                                          ? (r as any).isRead
                                          : activeQuery.isReadByInstitute)
                                          ? "text-sky-400"
                                          : "text-slate-400"
                                      }`}
                                    />
                                  </span>
                                </div>
                              )}
                            </div>

                            {isAdmin && (
                              <div className="w-7 h-7 rounded-lg bg-[#324158] text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                                <ShieldCheck size={14} />
                              </div>
                            )}
                          </div>
                        )
                      })
                    ) : activeQuery.adminReply ? (
                      <div className="flex items-start gap-2 max-w-[88%] ml-auto justify-end">
                        <div className="bg-[#324158] text-white rounded-2xl rounded-tr-xs p-3.5 shadow-2xs space-y-1.5 text-left w-full">
                          <div className="flex items-center justify-between text-[11px] text-slate-200 border-b border-white/10 pb-1">
                            <span className="font-bold flex items-center gap-1">
                              <ShieldCheck size={12} className="text-emerald-400" />
                              {activeQuery.adminRepliedByName || "Progrentures Support"}
                            </span>
                            <span className="text-[10px] text-slate-300">
                              {activeQuery.adminRepliedAt
                                ? new Date(activeQuery.adminRepliedAt).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })
                                : ""}
                            </span>
                          </div>
                          <p className="text-xs text-slate-100 whitespace-pre-wrap leading-relaxed">
                            {activeQuery.adminReply}
                          </p>
                          <div className="flex justify-end items-center gap-1 text-[10px] text-slate-300 pt-0.5">
                            <span
                              className="inline-flex items-center shrink-0 ml-0.5"
                              title={activeQuery.isReadByInstitute ? "Read by organization" : "Delivered"}
                            >
                              <CheckCheck
                                size={16}
                                strokeWidth={2.2}
                                className={`shrink-0 ${
                                  activeQuery.isReadByInstitute ? "text-sky-400" : "text-slate-400"
                                }`}
                              />
                            </span>
                          </div>
                        </div>
                        <div className="w-7 h-7 rounded-lg bg-[#324158] text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                          <ShieldCheck size={14} />
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {/* WhatsApp-Style Reply Bar at Bottom */}
                  <div className="p-3.5 bg-white border-t border-gray-200 space-y-2 shrink-0">
                    <label className="text-[11px] font-bold text-gray-700 block">
                      {activeQuery.adminReply ? "Send Follow-up to Organization:" : "Write Reply to Organization:"}
                    </label>
                    <textarea
                      rows={3}
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder={`Type your reply to ${activeQuery.instituteName}...`}
                      className="w-full text-xs p-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#324158]/15 focus:border-[#324158] transition-all resize-none leading-relaxed"
                    />

                    <div className="flex items-center justify-between gap-2 pt-1">
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
                          className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1"
                        >
                          <CheckCircle2 size={13} className="text-emerald-600" />
                          <span>Resolve</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSendReply("replied")}
                          disabled={sendingReply || !replyText.trim()}
                          className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-[#324158] text-white hover:bg-[#1E293B] shadow-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1"
                        >
                          <Send size={13} />
                          <span>{sendingReply ? "Sending..." : "Send Reply"}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* View 2: WhatsApp-Style Queries List */
                <div className="flex-1 flex flex-col min-h-0">
                  {/* Filter Tabs */}
                  <div className="p-3 px-4 border-b border-gray-100 bg-gray-50/80 flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setFilterTab("all")}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        filterTab === "all"
                          ? "bg-[#324158] text-white shadow-xs"
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

                  {/* Scrollable list with WhatsApp-style cards */}
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
                            className={`p-3.5 px-4 hover:bg-[#eaf0f8]/50 transition-all cursor-pointer text-left flex items-start gap-3 border-l-4 ${
                              isUnread ? "bg-amber-50/50 border-l-amber-500" : "border-l-transparent"
                            }`}
                          >
                            {/* Institute Avatar */}
                            <div className="w-10 h-10 rounded-2xl bg-[#324158] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs mt-0.5">
                              {getInitials(q.instituteName)}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0 space-y-1">
                              <div className="flex items-center justify-between gap-1.5">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span className="font-bold text-xs text-gray-900 truncate">
                                    {q.instituteName}
                                  </span>
                                  {q.instituteCode && (
                                    <span className="text-[9px] font-mono px-1.5 py-0.2 bg-[#eaf0f8] text-[#324158] font-bold rounded">
                                      {q.instituteCode}
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] text-gray-400 shrink-0">
                                  {new Date(q.createdAt).toLocaleDateString([], {
                                    month: "short",
                                    day: "numeric",
                                  })}
                                </span>
                              </div>

                              <p className="text-xs font-semibold text-[#324158] truncate">{q.subject}</p>
                              <p className="text-[11px] text-gray-500 truncate flex items-center gap-1.5">
                                {q.adminReply ? (
                                  <>
                                    <span
                                      className="inline-flex items-center shrink-0"
                                      title={q.isReadByInstitute ? "Read by organization" : "Delivered"}
                                    >
                                      <CheckCheck
                                        size={15}
                                        strokeWidth={2.2}
                                        className={`shrink-0 ${q.isReadByInstitute ? "text-sky-500" : "text-gray-400"}`}
                                      />
                                    </span>
                                    <span className="truncate">{q.adminReply}</span>
                                  </>
                                ) : (
                                  <span className="truncate">{q.message}</span>
                                )}
                              </p>

                              <div className="flex items-center justify-between pt-0.5 text-[10px]">
                                <span className="capitalize text-gray-400 font-medium">
                                  {q.category?.replace("_", " ")}
                                </span>
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider ${
                                      q.status === "resolved"
                                        ? "bg-slate-100 text-slate-700"
                                        : q.status === "replied"
                                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                        : "bg-amber-100 text-amber-800 font-bold"
                                    }`}
                                  >
                                    {q.status}
                                  </span>
                                  {isUnread && (
                                    <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0 animate-ping" />
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              )}

              {/* Drawer Footer */}
              <div className="p-3 px-5 border-t border-gray-100 bg-gray-50/80 flex items-center justify-between text-xs shrink-0">
                <span className="text-[11px] text-gray-500">Progrentures Support Desk</span>
                <Link
                  href="/admin/queries"
                  onClick={() => setIsOpen(false)}
                  className="text-xs font-bold text-[#324158] hover:underline flex items-center gap-1"
                >
                  <span>Open Full Communications Hub</span>
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
