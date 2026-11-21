"use client"

import { useState, useEffect, useMemo, useRef } from "react"
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
  CheckCheck,
  ChevronRight,
  ArrowLeft,
  Sparkles,
  MapPin,
  ExternalLink,
  ShieldCheck,
  User,
  Inbox,
} from "lucide-react"
import { toast } from "sonner"
import { AdminListSkeleton } from "@/components/SkeletonLoaders"

interface QueryItem {
  _id: string
  instituteId?: string
  instituteName: string
  instituteCode?: string
  instituteCity?: string
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

interface InstituteThread {
  instituteId: string
  instituteName: string
  instituteCode: string
  instituteCity: string
  contactEmail: string
  contactPhone: string
  queries: QueryItem[]
  latestQuery: QueryItem
  unreadCount: number
  pendingCount: number
  status: "pending" | "replied" | "resolved"
}

const CATEGORY_META: Record<string, { label: string; bg: string; text: string }> = {
  quota_increase: { label: "Quota Increase", bg: "bg-purple-50 border-purple-200", text: "text-purple-700" },
  billing_fees: { label: "Billing & Fees", bg: "bg-blue-50 border-blue-200", text: "text-blue-700" },
  feature_request: { label: "Feature Request", bg: "bg-indigo-50 border-indigo-200", text: "text-indigo-700" },
  technical_issue: { label: "Technical Issue", bg: "bg-rose-50 border-rose-200", text: "text-rose-700" },
  general: { label: "General Query", bg: "bg-slate-50 border-slate-200", text: "text-slate-700" },
  other: { label: "General Query", bg: "bg-slate-50 border-slate-200", text: "text-slate-700" },
}

const QUICK_TEMPLATES = [
  "Hello! We have reviewed your request and your quota has been successfully increased.",
  "Hello! This issue has been addressed and updated. Please verify on your portal.",
  "Hello! Could you please share more details or a screenshot so we can help you promptly?",
]

export default function AdminQueriesPage() {
  const [queries, setQueries] = useState<QueryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "unread" | "pending" | "replied" | "resolved">("all")
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null)
  const [replyText, setReplyText] = useState("")
  const [targetQueryId, setTargetQueryId] = useState<string | null>(null)
  const [submittingReply, setSubmittingReply] = useState(false)
  const [mobileChatOpen, setMobileChatOpen] = useState(false)

  const chatEndRef = useRef<HTMLDivElement>(null)

  const fetchQueries = async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/admin/queries", { credentials: "include" })
      const data = await res.json()
      if (data.success) {
        setQueries(data.queries || [])
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

  // Group queries into WhatsApp-like Institute Threads
  const instituteThreads = useMemo(() => {
    const threadMap: Record<string, InstituteThread> = {}

    queries.forEach((q) => {
      const key = q.instituteId || q.instituteCode || q.instituteName || "unknown"
      if (!threadMap[key]) {
        threadMap[key] = {
          instituteId: key,
          instituteName: q.instituteName || "Organization",
          instituteCode: q.instituteCode || "",
          instituteCity: q.instituteCity || "",
          contactEmail: q.contactEmail || "",
          contactPhone: q.contactPhone || "",
          queries: [],
          latestQuery: q,
          unreadCount: 0,
          pendingCount: 0,
          status: "resolved",
        }
      }

      threadMap[key].queries.push(q)
      if (!q.isReadByAdmin) threadMap[key].unreadCount += 1
      if (q.status === "pending") threadMap[key].pendingCount += 1

      if (new Date(q.createdAt) > new Date(threadMap[key].latestQuery.createdAt)) {
        threadMap[key].latestQuery = q
      }
    })

    // Sort queries inside each thread chronologically (oldest to newest for WhatsApp chat stream)
    Object.values(threadMap).forEach((thread) => {
      thread.queries.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      if (thread.pendingCount > 0) {
        thread.status = "pending"
      } else if (thread.queries.some((q) => q.status === "replied")) {
        thread.status = "replied"
      } else {
        thread.status = "resolved"
      }
    })

    // Sort threads by latest message descending
    return Object.values(threadMap).sort(
      (a, b) => new Date(b.latestQuery.createdAt).getTime() - new Date(a.latestQuery.createdAt).getTime()
    )
  }, [queries])

  // Filtered threads based on search and status
  const filteredThreads = useMemo(() => {
    return instituteThreads.filter((thread) => {
      const query = search.trim().toLowerCase()
      const matchesSearch =
        !query ||
        thread.instituteName.toLowerCase().includes(query) ||
        thread.instituteCode.toLowerCase().includes(query) ||
        thread.contactEmail.toLowerCase().includes(query) ||
        thread.queries.some(
          (q) => q.subject.toLowerCase().includes(query) || q.message.toLowerCase().includes(query)
        )

      if (!matchesSearch) return false

      if (statusFilter === "unread") return thread.unreadCount > 0
      if (statusFilter === "pending") return thread.pendingCount > 0
      if (statusFilter === "replied") return thread.status === "replied"
      if (statusFilter === "resolved") return thread.status === "resolved"

      return true
    })
  }, [instituteThreads, search, statusFilter])

  // Select initial thread on first load
  useEffect(() => {
    if (!selectedThreadId && filteredThreads.length > 0) {
      setSelectedThreadId(filteredThreads[0].instituteId)
    }
  }, [filteredThreads, selectedThreadId])

  // Current active thread
  const activeThread = useMemo(() => {
    return instituteThreads.find((t) => t.instituteId === selectedThreadId) || null
  }, [instituteThreads, selectedThreadId])

  // Auto-scroll chat to bottom when active thread or messages change
  useEffect(() => {
    if (activeThread) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
      // Auto-select latest pending query to reply to
      const latestPending = [...activeThread.queries].reverse().find((q) => q.status === "pending")
      if (latestPending) {
        setTargetQueryId(latestPending._id)
      } else if (activeThread.queries.length > 0) {
        setTargetQueryId(activeThread.queries[activeThread.queries.length - 1]._id)
      }
    }
  }, [activeThread?.instituteId, activeThread?.queries.length])

  // Handle selecting a thread
  const handleSelectThread = async (thread: InstituteThread) => {
    setSelectedThreadId(thread.instituteId)
    setMobileChatOpen(true)
    setReplyText("")

    // Mark unread queries in this thread as read
    const unreadQueries = thread.queries.filter((q) => !q.isReadByAdmin)
    if (unreadQueries.length > 0) {
      for (const q of unreadQueries) {
        try {
          await fetch(`/api/admin/queries/${q._id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ markRead: true }),
          })
        } catch (e) {
          console.error("Mark read error:", e)
        }
      }
      setQueries((prev) =>
        prev.map((q) => (unreadQueries.some((u) => u._id === q._id) ? { ...q, isReadByAdmin: true } : q))
      )
    }
  }

  // Handle sending reply
  const handleSendReply = async (status: "replied" | "resolved" = "replied") => {
    if (!targetQueryId || !replyText.trim()) {
      toast.error("Please enter a reply message before sending.")
      return
    }

    try {
      setSubmittingReply(true)
      const res = await fetch(`/api/admin/queries/${targetQueryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reply: replyText.trim(), status }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to send reply")

      toast.success(status === "resolved" ? "Query resolved and reply saved!" : "Reply sent to organization successfully!")
      setReplyText("")

      // Update queries state
      const updatedTimestamp = new Date().toISOString()
      setQueries((prev) =>
        prev.map((q) =>
          q._id === targetQueryId
            ? {
                ...q,
                adminReply: replyText.trim(),
                status,
                isReadByAdmin: true,
                adminRepliedAt: updatedTimestamp,
              }
            : q
        )
      )
    } catch (err: any) {
      toast.error(err.message || "Failed to send reply")
    } finally {
      setSubmittingReply(false)
    }
  }

  const totalUnread = instituteThreads.reduce((acc, t) => acc + t.unreadCount, 0)
  const totalPending = instituteThreads.reduce((acc, t) => acc + t.pendingCount, 0)

  // Get Initials for avatar
  const getInitials = (name: string) => {
    const clean = name.replace(/[^a-zA-Z0-9 ]/g, "").trim()
    const parts = clean.split(" ").filter(Boolean)
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    return clean.slice(0, 2).toUpperCase() || "OR"
  }

  // Format timestamp like WhatsApp
  const formatTime = (isoString: string) => {
    const date = new Date(isoString)
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }

  const formatDateHeader = (isoString: string) => {
    const date = new Date(isoString)
    const today = new Date()
    const isToday =
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    if (isToday) return "Today"
    return date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })
  }

  return (
    <div className="p-3 sm:p-5 lg:p-6 max-w-7xl mx-auto space-y-4">
      {/* Page Title & Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-200">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#324158] text-white flex items-center justify-center shadow-xs">
              <MessageSquare size={16} />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#324158]">
              Organization Communications
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            WhatsApp-style organized conversation threads for queries, quota increases, and institute support.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={fetchQueries}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 hover:bg-[#eaf0f8] hover:text-[#324158] transition-colors shadow-2xs cursor-pointer"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Main WhatsApp-Style Two-Column Hub Container */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden h-[calc(100vh-180px)] min-h-[600px] flex">
        {/* ─── LEFT COLUMN: WhatsApp Chats List ─── */}
        <aside
          className={`w-full md:w-[360px] lg:w-[410px] shrink-0 border-r border-gray-200 flex flex-col bg-white ${
            mobileChatOpen ? "hidden md:flex" : "flex"
          }`}
        >
          {/* Top Bar of Left Column */}
          <div className="p-3.5 bg-slate-50/80 border-b border-gray-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#324158] tracking-wider uppercase flex items-center gap-1.5">
                <Building2 size={14} className="text-[#324158]" />
                Institutes ({instituteThreads.length})
              </span>
              <div className="flex items-center gap-1.5">
                {totalPending > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                    {totalPending} Pending
                  </span>
                )}
                {totalUnread > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-500 text-white animate-pulse">
                    {totalUnread} New
                  </span>
                )}
              </div>
            </div>

            {/* Search Bar */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search institute name, code, message..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#324158]/15 focus:border-[#324158] transition-all"
              />
            </div>

            {/* WhatsApp Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none text-[11px]">
              <button
                type="button"
                onClick={() => setStatusFilter("all")}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer shrink-0 ${
                  statusFilter === "all"
                    ? "bg-[#324158] text-white shadow-xs"
                    : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
                }`}
              >
                All ({instituteThreads.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("unread")}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1 ${
                  statusFilter === "unread"
                    ? "bg-rose-600 text-white shadow-xs"
                    : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
                }`}
              >
                Unread {totalUnread > 0 && `(${totalUnread})`}
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("pending")}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1 ${
                  statusFilter === "pending"
                    ? "bg-amber-600 text-white shadow-xs"
                    : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
                }`}
              >
                Pending {totalPending > 0 && `(${totalPending})`}
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("replied")}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer shrink-0 ${
                  statusFilter === "replied"
                    ? "bg-emerald-700 text-white shadow-xs"
                    : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
                }`}
              >
                Replied
              </button>
            </div>
          </div>

          {/* Scrollable WhatsApp Chats List */}
          <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
            {loading && queries.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-400">Loading conversations...</div>
            ) : filteredThreads.length === 0 ? (
              <div className="p-10 text-center space-y-2">
                <Inbox size={28} className="text-gray-300 mx-auto" />
                <p className="text-xs font-bold text-gray-800">No conversations found</p>
                <p className="text-[11px] text-gray-400">No organization matches the selected filter.</p>
              </div>
            ) : (
              filteredThreads.map((thread) => {
                const isSelected = selectedThreadId === thread.instituteId
                const hasUnread = thread.unreadCount > 0
                const hasPending = thread.pendingCount > 0
                const latest = thread.latestQuery

                return (
                  <div
                    key={thread.instituteId}
                    onClick={() => handleSelectThread(thread)}
                    className={`p-3.5 px-4 transition-all cursor-pointer flex items-start gap-3 border-l-4 ${
                      isSelected
                        ? "bg-[#eaf0f8]/70 border-l-[#324158]"
                        : hasUnread
                        ? "bg-amber-50/40 border-l-amber-500 hover:bg-amber-50/70"
                        : "border-l-transparent hover:bg-slate-50/80"
                    }`}
                  >
                    {/* Institute Avatar */}
                    <div className="relative shrink-0">
                      <div className="w-11 h-11 rounded-2xl bg-[#324158] text-white flex items-center justify-center font-bold text-xs shadow-xs">
                        {getInitials(thread.instituteName)}
                      </div>
                      {hasPending && (
                        <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-amber-500 border-2 border-white" />
                      )}
                    </div>

                    {/* Chat Content Preview */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <h3 className="text-xs font-bold text-gray-900 truncate">{thread.instituteName}</h3>
                          {thread.instituteCode && (
                            <span className="text-[9px] font-mono px-1.5 py-0.2 bg-gray-100 text-[#324158] font-bold rounded shrink-0">
                              {thread.instituteCode}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-gray-400 shrink-0">
                          {formatTime(latest.createdAt)}
                        </span>
                      </div>

                      {/* Subject + Snippet with WhatsApp Checkmark */}
                      <p className="text-xs font-semibold text-[#324158] truncate">{latest.subject}</p>
                      <p className="text-[11px] text-gray-500 truncate flex items-center gap-1">
                        {latest.adminReply ? (
                          <>
                            <CheckCheck size={13} className="text-blue-500 shrink-0" />
                            <span className="truncate">{latest.adminReply}</span>
                          </>
                        ) : (
                          <span className="truncate">{latest.message}</span>
                        )}
                      </p>

                      {/* Bottom badges row */}
                      <div className="flex items-center justify-between pt-0.5 text-[10px]">
                        <span className="text-gray-400 font-medium">
                          {thread.queries.length} {thread.queries.length === 1 ? "query" : "queries"}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {hasPending ? (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800">
                              Pending
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-emerald-100 text-emerald-800 flex items-center gap-0.5">
                              <CheckCheck size={11} />
                              Replied
                            </span>
                          )}
                          {hasUnread && (
                            <span className="min-w-4 h-4 px-1 rounded-full bg-rose-500 text-white font-extrabold text-[9px] flex items-center justify-center">
                              {thread.unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </aside>

        {/* ─── RIGHT COLUMN: WhatsApp Chat Window ─── */}
        <main
          className={`flex-1 flex flex-col bg-[#f8fafc] min-w-0 ${
            mobileChatOpen ? "flex" : "hidden md:flex"
          }`}
        >
          {activeThread ? (
            <>
              {/* WhatsApp Chat Top Header */}
              <div className="p-3 px-4 sm:px-6 bg-white border-b border-gray-200 flex items-center justify-between gap-3 shrink-0 shadow-2xs">
                <div className="flex items-center gap-3 min-w-0">
                  {/* Mobile Back Button */}
                  <button
                    type="button"
                    onClick={() => setMobileChatOpen(false)}
                    className="md:hidden p-1.5 rounded-lg text-gray-600 hover:bg-gray-100 cursor-pointer"
                    title="Back to institutes"
                  >
                    <ArrowLeft size={18} />
                  </button>

                  {/* Active Institute Avatar */}
                  <div className="w-10 h-10 rounded-2xl bg-[#324158] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                    {getInitials(activeThread.instituteName)}
                  </div>

                  {/* Name and Meta */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-bold text-gray-900 truncate">{activeThread.instituteName}</h2>
                      {activeThread.instituteCode && (
                        <span className="text-[10px] font-mono px-2 py-0.5 bg-[#eaf0f8] text-[#324158] font-bold rounded">
                          {activeThread.instituteCode}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2.5 text-[11px] text-gray-500 mt-0.5">
                      <a
                        href={`mailto:${activeThread.contactEmail}`}
                        className="hover:text-[#324158] hover:underline flex items-center gap-1"
                      >
                        <Mail size={11} />
                        <span>{activeThread.contactEmail}</span>
                      </a>
                      {activeThread.contactPhone && (
                        <a
                          href={`tel:${activeThread.contactPhone}`}
                          className="hover:text-[#324158] hover:underline flex items-center gap-1"
                        >
                          <Phone size={11} />
                          <span>{activeThread.contactPhone}</span>
                        </a>
                      )}
                      {activeThread.instituteCity && (
                        <span className="flex items-center gap-1 text-gray-400">
                          <MapPin size={11} />
                          <span>{activeThread.instituteCity}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Header Status / Direct Mail */}
                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href={`mailto:${activeThread.contactEmail}?subject=Support%20Progrentures%20-%20${encodeURIComponent(
                      activeThread.instituteName
                    )}`}
                    className="hidden sm:flex items-center gap-1 px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <Mail size={12} />
                    <span>Email Direct</span>
                  </a>
                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      activeThread.pendingCount > 0
                        ? "bg-amber-100 text-amber-800 border border-amber-200"
                        : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                    }`}
                  >
                    {activeThread.pendingCount > 0 ? `${activeThread.pendingCount} Pending` : "All Replied"}
                  </span>
                </div>
              </div>

              {/* WhatsApp Messages Canvas / Stream */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-[#f8fafc]">
                {activeThread.queries.map((q, idx) => {
                  const cat = CATEGORY_META[q.category] || CATEGORY_META.general
                  const showDateHeader =
                    idx === 0 ||
                    formatDateHeader(q.createdAt) !== formatDateHeader(activeThread.queries[idx - 1].createdAt)

                  return (
                    <div key={q._id} className="space-y-4">
                      {/* Date Separator Pill */}
                      {showDateHeader && (
                        <div className="flex items-center justify-center my-3">
                          <span className="px-3 py-1 rounded-full text-[10px] font-bold text-gray-500 bg-white border border-gray-200 shadow-2xs">
                            {formatDateHeader(q.createdAt)}
                          </span>
                        </div>
                      )}

                      {/* 1. Left Bubble: Institute's Query Message */}
                      <div className="flex items-start gap-2 max-w-[90%] sm:max-w-[78%]">
                        <div className="w-8 h-8 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-[10px] shrink-0 mt-1">
                          {getInitials(activeThread.instituteName)}
                        </div>

                        <div className="bg-white rounded-2xl rounded-tl-xs p-4 border border-gray-200 shadow-xs space-y-2 text-left w-full">
                          {/* Bubble Top Meta */}
                          <div className="flex items-center justify-between gap-2 border-b border-gray-100 pb-2">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${cat.bg} ${cat.text}`}>
                              {cat.label}
                            </span>
                            <span
                              className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${
                                q.status === "resolved"
                                  ? "bg-slate-100 text-slate-700"
                                  : q.status === "replied"
                                  ? "bg-blue-50 text-blue-700"
                                  : "bg-amber-100 text-amber-800"
                              }`}
                            >
                              {q.status}
                            </span>
                          </div>

                          {/* Subject & Message */}
                          <div>
                            <h4 className="text-xs sm:text-sm font-bold text-[#324158]">{q.subject}</h4>
                            <p className="text-xs text-gray-800 whitespace-pre-wrap leading-relaxed mt-1">
                              {q.message}
                            </p>
                          </div>

                          {/* Timestamp & Sender */}
                          <div className="flex items-center justify-between text-[10px] text-gray-400 pt-1">
                            <span className="flex items-center gap-1">
                              <User size={10} />
                              {q.submittedByName || "Institute Admin"}
                            </span>
                            <span>{formatTime(q.createdAt)}</span>
                          </div>
                        </div>
                      </div>

                      {/* 2. Right Bubble: Admin's Reply (if replied) */}
                      {q.adminReply && (
                        <div className="flex items-start gap-2 max-w-[90%] sm:max-w-[78%] ml-auto justify-end">
                          <div className="bg-[#324158] text-white rounded-2xl rounded-tr-xs p-4 shadow-sm space-y-2 text-left w-full">
                            <div className="flex items-center justify-between border-b border-white/10 pb-1.5 text-xs">
                              <span className="font-bold flex items-center gap-1.5 text-slate-200">
                                <ShieldCheck size={13} className="text-emerald-400" />
                                {q.adminRepliedByName || "Progrentures Support Desk"}
                              </span>
                              <span className="text-[10px] text-slate-300">
                                In response to: &quot;{q.subject.slice(0, 22)}...&quot;
                              </span>
                            </div>

                            <p className="text-xs text-slate-100 whitespace-pre-wrap leading-relaxed">
                              {q.adminReply}
                            </p>

                            <div className="flex items-center justify-end gap-1.5 text-[10px] text-slate-300 pt-1">
                              <span>{q.adminRepliedAt ? formatTime(q.adminRepliedAt) : ""}</span>
                              <CheckCheck size={14} className="text-emerald-400" />
                            </div>
                          </div>

                          <div className="w-8 h-8 rounded-xl bg-[#324158] text-white flex items-center justify-center shrink-0 mt-1 shadow-xs">
                            <ShieldCheck size={16} />
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
                <div ref={chatEndRef} />
              </div>

              {/* WhatsApp-Style Bottom Reply Box */}
              <div className="p-3 sm:p-4 bg-white border-t border-gray-200 space-y-2 shrink-0">
                {/* Target Query Selector if multiple exist */}
                {activeThread.queries.length > 1 && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-gray-500 text-[11px] font-semibold shrink-0">Replying to:</span>
                    <select
                      value={targetQueryId || ""}
                      onChange={(e) => setTargetQueryId(e.target.value)}
                      className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 bg-gray-50 font-medium text-gray-800 focus:outline-none focus:border-[#324158] max-w-sm truncate"
                    >
                      {activeThread.queries.map((q) => (
                        <option key={q._id} value={q._id}>
                          [{q.status.toUpperCase()}] {q.subject} ({formatDateHeader(q.createdAt)})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Quick Reply Template Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  <span className="text-[10px] font-bold text-gray-400 shrink-0 flex items-center gap-1">
                    <Sparkles size={11} className="text-amber-500" /> Quick:
                  </span>
                  {QUICK_TEMPLATES.map((tmpl, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setReplyText(tmpl)}
                      className="px-2.5 py-1 rounded-lg bg-gray-50 hover:bg-[#eaf0f8] hover:text-[#324158] text-[10px] text-gray-600 font-medium border border-gray-200 transition-colors shrink-0 text-left cursor-pointer"
                    >
                      {tmpl.slice(0, 38)}...
                    </button>
                  ))}
                </div>

                {/* Main Textarea and Action Buttons */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2.5">
                  <textarea
                    rows={2}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder={`Type your reply to ${activeThread.instituteName}...`}
                    className="w-full text-xs p-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#324158]/15 focus:border-[#324158] transition-all resize-none leading-relaxed"
                  />

                  <div className="flex items-center justify-end gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleSendReply("resolved")}
                      disabled={submittingReply || !replyText.trim()}
                      className="px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                      title="Send response and mark ticket as resolved"
                    >
                      <CheckCircle2 size={14} className="text-emerald-600" />
                      <span className="whitespace-nowrap">Resolve</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSendReply("replied")}
                      disabled={submittingReply || !replyText.trim()}
                      className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-[#324158] text-white hover:bg-[#1e2a38] shadow-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <Send size={14} />
                      <span className="whitespace-nowrap">{submittingReply ? "Sending..." : "Send Reply"}</span>
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* Empty State when no conversation selected */
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3">
              <div className="w-16 h-16 rounded-3xl bg-[#eaf0f8] text-[#324158] flex items-center justify-center shadow-xs">
                <MessageSquare size={28} />
              </div>
              <h3 className="text-base font-bold text-gray-800">Progrentures Support Desk</h3>
              <p className="text-xs text-gray-500 max-w-sm">
                Select an organization from the left chat list to view their communication stream, respond to queries, or resolve requests.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
