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
  Plus,
  X,
  HelpCircle,
} from "lucide-react"
import { toast } from "sonner"
import { AdminListSkeleton } from "@/components/SkeletonLoaders"

interface QueryReply {
  _id?: string
  senderRole: "admin" | "institute"
  senderName: string
  message: string
  createdAt: string
  isRead?: boolean
}

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
  isReadByInstitute?: boolean
  adminReply?: string
  adminRepliedAt?: string
  adminRepliedByName?: string
  replies?: QueryReply[]
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

interface ChatMessage {
  id: string
  queryId: string
  senderRole: "admin" | "institute"
  senderName: string
  message: string
  subject?: string
  category?: string
  status?: string
  createdAt: string
  isOriginalQuery?: boolean
  isRead?: boolean
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

// Extract all messages from a query (initial message + each reply in order)
function getQueryMessages(q: QueryItem): ChatMessage[] {
  const msgs: ChatMessage[] = []

  // 1. Initial query from institute (read status = admin has read it)
  msgs.push({
    id: `query-${q._id}`,
    queryId: q._id,
    senderRole: "institute",
    senderName: q.submittedByName || q.instituteName || "Institute Admin",
    subject: q.subject,
    category: q.category,
    message: q.message,
    status: q.status,
    createdAt: q.createdAt,
    isOriginalQuery: true,
    isRead: Boolean(q.isReadByAdmin),
  })

  // 2. All subsequent replies
  if (Array.isArray(q.replies) && q.replies.length > 0) {
    q.replies.forEach((r, idx) => {
      const isMsgRead =
        typeof r.isRead === "boolean"
          ? r.isRead
          : r.senderRole === "admin"
          ? Boolean(q.isReadByInstitute)
          : Boolean(q.isReadByAdmin)

      msgs.push({
        id: r._id || `reply-${q._id}-${idx}`,
        queryId: q._id,
        senderRole: r.senderRole || "admin",
        senderName: r.senderName || (r.senderRole === "admin" ? "Progrentures Support Desk" : q.instituteName),
        message: r.message,
        createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : q.createdAt,
        isOriginalQuery: false,
        isRead: isMsgRead,
      })
    })
  } else if (q.adminReply) {
    // Fallback for legacy queries with single adminReply
    msgs.push({
      id: `admin-reply-${q._id}`,
      queryId: q._id,
      senderRole: "admin",
      senderName: q.adminRepliedByName || "Progrentures Support Desk",
      message: q.adminReply,
      createdAt: q.adminRepliedAt ? new Date(q.adminRepliedAt).toISOString() : q.createdAt,
      isOriginalQuery: false,
      isRead: Boolean(q.isReadByInstitute),
    })
  }

  return msgs.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
}

export default function AdminQueriesPage() {
  const [queries, setQueries] = useState<QueryItem[]>([])
  const [isSuperAdmin, setIsSuperAdmin] = useState(true)
  const [currentInstitute, setCurrentInstitute] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [themeColor, setThemeColor] = useState<string>("#2D3A4A")
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "unread" | "pending" | "replied" | "resolved">("all")
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null)
  const [replyText, setReplyText] = useState("")
  const [targetQueryId, setTargetQueryId] = useState<string | null>(null)
  const [submittingReply, setSubmittingReply] = useState(false)
  const [mobileChatOpen, setMobileChatOpen] = useState(false)

  // State for Organization creating a new query
  const [showNewQueryModal, setShowNewQueryModal] = useState(false)
  const [newSubject, setNewSubject] = useState("")
  const [newCategory, setNewCategory] = useState("quota_increase")
  const [newMessage, setNewMessage] = useState("")
  const [submittingNewQuery, setSubmittingNewQuery] = useState(false)

  const chatEndRef = useRef<HTMLDivElement>(null)

  const fetchQueries = async (isBackground = false) => {
    try {
      if (!isBackground) setLoading(true)
      const res = await fetch("/api/admin/queries", { credentials: "include" })
      const data = await res.json()
      if (data.success) {
        setQueries(data.queries || [])
        setIsSuperAdmin(data.isSuperAdmin !== false)
        if (data.institute) setCurrentInstitute(data.institute)
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("queries-updated"))
        }
      }
    } catch (err) {
      console.error("Failed to load queries:", err)
      if (!isBackground) toast.error("Failed to load organization queries")
    } finally {
      if (!isBackground) setLoading(false)
    }
  }

  useEffect(() => {
    fetchQueries()
    const interval = setInterval(() => fetchQueries(true), 12000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    fetch("/api/admin/institute-access", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        if (data.themeColor) setThemeColor(data.themeColor)
      })
      .catch(() => {})
  }, [])

  // Group queries into WhatsApp-like Institute Threads (for Super Admin)
  // Or list tickets for organization
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
      if (isSuperAdmin ? !q.isReadByAdmin : !q.isReadByInstitute) {
        threadMap[key].unreadCount += 1
      }
      if (q.status === "pending") threadMap[key].pendingCount += 1

      if (new Date(q.createdAt) > new Date(threadMap[key].latestQuery.createdAt)) {
        threadMap[key].latestQuery = q
      }
    })

    // Sort queries inside each thread chronologically
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

    return Object.values(threadMap).sort(
      (a, b) => new Date(b.latestQuery.createdAt).getTime() - new Date(a.latestQuery.createdAt).getTime()
    )
  }, [queries, isSuperAdmin])

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

  // Flatten all messages for the active thread chronologically
  const activeThreadMessages = useMemo(() => {
    if (!activeThread) return []
    const allMsgs: ChatMessage[] = []
    activeThread.queries.forEach((q) => {
      allMsgs.push(...getQueryMessages(q))
    })
    return allMsgs.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  }, [activeThread])

  // Auto-scroll chat to bottom when active thread or messages change
  useEffect(() => {
    if (activeThread) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
      // Auto-select latest query to reply to
      const latestPending = [...activeThread.queries].reverse().find((q) => q.status === "pending")
      if (latestPending) {
        setTargetQueryId(latestPending._id)
      } else if (activeThread.queries.length > 0) {
        setTargetQueryId(activeThread.queries[activeThread.queries.length - 1]._id)
      }
    }
  }, [activeThread?.instituteId, activeThreadMessages.length])

  // Handle selecting a thread
  const handleSelectThread = async (thread: InstituteThread) => {
    setSelectedThreadId(thread.instituteId)
    setMobileChatOpen(true)
    setReplyText("")

    // Mark unread queries in this thread as read
    const unreadQueries = thread.queries.filter((q) => (isSuperAdmin ? !q.isReadByAdmin : !q.isReadByInstitute))
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
        prev.map((q) =>
          unreadQueries.some((u) => u._id === q._id)
            ? { ...q, [isSuperAdmin ? "isReadByAdmin" : "isReadByInstitute"]: true }
            : q
        )
      )
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("queries-updated"))
      }
    }
  }

  // Handle sending a reply (Appends to replies without overwriting!)
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
      if (!res.ok) throw new Error(data.error || "Failed to send message")

      toast.success(status === "resolved" ? "Query resolved and reply saved!" : "Message sent successfully!")
      setReplyText("")

      // Update queries state by appending new reply
      const updatedTimestamp = new Date().toISOString()
      const newReplyObj: QueryReply = {
        senderRole: isSuperAdmin ? "admin" : "institute",
        senderName: isSuperAdmin ? "Progrentures Support Desk" : (currentInstitute?.name || "Institute Admin"),
        message: replyText.trim(),
        createdAt: updatedTimestamp,
        isRead: false,
      }

      setQueries((prev) =>
        prev.map((q) => {
          if (q._id !== targetQueryId) return q
          const existingReplies: QueryReply[] = q.replies
            ? [...q.replies]
            : (q.adminReply
            ? [{ senderRole: "admin" as const, senderName: q.adminRepliedByName || "Support", message: q.adminReply, createdAt: q.adminRepliedAt || q.createdAt, isRead: q.isReadByInstitute }]
            : [])
          return {
            ...q,
            adminReply: isSuperAdmin ? replyText.trim() : q.adminReply,
            status: isSuperAdmin ? status : "pending",
            isReadByAdmin: isSuperAdmin,
            isReadByInstitute: !isSuperAdmin,
            adminRepliedAt: isSuperAdmin ? updatedTimestamp : q.adminRepliedAt,
            replies: [...existingReplies, newReplyObj],
          }
        })
      )
    } catch (err: any) {
      toast.error(err.message || "Failed to send reply")
    } finally {
      setSubmittingReply(false)
    }
  }

  // Handle submitting a brand new support query (for Institute)
  const handleSubmitNewQuery = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newSubject.trim() || !newMessage.trim()) {
      toast.error("Subject and message details are required.")
      return
    }

    try {
      setSubmittingNewQuery(true)
      const res = await fetch("/api/admin/queries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: newSubject.trim(),
          category: newCategory,
          message: newMessage.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to submit request")

      toast.success("Support query submitted successfully!")
      setShowNewQueryModal(false)
      setNewSubject("")
      setNewMessage("")
      await fetchQueries()
    } catch (err: any) {
      toast.error(err.message || "Failed to submit request")
    } finally {
      setSubmittingNewQuery(false)
    }
  }

  const totalUnread = instituteThreads.reduce((acc, t) => acc + t.unreadCount, 0)
  const totalPending = instituteThreads.reduce((acc, t) => acc + t.pendingCount, 0)

  const getInitials = (name: string) => {
    const clean = (name || "").replace(/[^a-zA-Z0-9 ]/g, "").trim()
    const parts = clean.split(" ").filter(Boolean)
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    return clean.slice(0, 2).toUpperCase() || "OR"
  }

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
    <div className="h-[calc(100dvh-5rem)] flex flex-col min-h-0 overflow-hidden p-3 sm:p-5 max-w-7xl mx-auto space-y-3">
      {/* Page Header */}
      <div className="shrink-0 flex items-center justify-between gap-3 pb-2 border-b border-gray-200">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#324158] text-white flex items-center justify-center shadow-xs">
            <MessageSquare size={16} />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-[#324158]">
              {isSuperAdmin ? "Organization Communications" : "Platform Support & Communications"}
            </h1>
            <p className="text-[11px] sm:text-xs text-gray-500">
              {isSuperAdmin
                ? "WhatsApp-style communication hub for organization queries & requests."
                : "Live support chat with Progrentures Platform Administrator."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!isSuperAdmin && (
            <button
              type="button"
              onClick={() => setShowNewQueryModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#324158] text-white rounded-xl text-xs font-semibold hover:bg-[#1e2a38] transition-colors shadow-2xs cursor-pointer"
            >
              <Plus size={14} />
              <span>New Request</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => fetchQueries(false)}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 hover:bg-[#eaf0f8] hover:text-[#324158] transition-colors shadow-2xs cursor-pointer"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Main WhatsApp Hub Container (With strict min-h-0 and overscroll containment to fix mouse wheel scrolling!) */}
      <div className="flex-1 min-h-0 flex overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xs">
        {/* ─── LEFT COLUMN: WhatsApp Chats List ─── */}
        <aside
          className={`w-full md:w-[350px] lg:w-[390px] shrink-0 border-r border-gray-200 flex flex-col min-h-0 h-full bg-white overflow-hidden ${
            mobileChatOpen ? "hidden md:flex" : "flex"
          }`}
        >
          {/* Top Bar of Left Column */}
          <div className="p-3 bg-slate-50/90 border-b border-gray-200 space-y-2.5 shrink-0">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#324158] tracking-wider uppercase flex items-center gap-1.5">
                <Building2 size={13} className="text-[#324158]" />
                {isSuperAdmin ? `Institutes (${instituteThreads.length})` : "Your Topics"}
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
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder={isSuperAdmin ? "Search institute, code, query..." : "Search topics, messages..."}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#324158]/15 focus:border-[#324158] transition-all"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none text-[11px]">
              <button
                type="button"
                onClick={() => setStatusFilter("all")}
                style={statusFilter === "all" ? { backgroundColor: themeColor || "#2D3A4A" } : undefined}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer shrink-0 ${
                  statusFilter === "all"
                    ? "text-white shadow-xs font-bold"
                    : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
                }`}
              >
                All ({instituteThreads.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("pending")}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                  statusFilter === "pending"
                    ? "bg-amber-600 text-white shadow-xs shadow-amber-600/30 font-bold"
                    : "bg-white text-amber-700 hover:bg-amber-50 border border-amber-200/80"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${statusFilter === "pending" ? "bg-white" : "bg-amber-500"}`} />
                Pending {totalPending > 0 && `(${totalPending})`}
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("unread")}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                  statusFilter === "unread"
                    ? "bg-rose-600 text-white shadow-xs shadow-rose-600/30 font-bold"
                    : "bg-white text-rose-700 hover:bg-rose-50 border border-rose-200/80"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${statusFilter === "unread" ? "bg-white" : "bg-rose-500"}`} />
                Unread {totalUnread > 0 && `(${totalUnread})`}
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("replied")}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                  statusFilter === "replied"
                    ? "bg-emerald-600 text-white shadow-xs shadow-emerald-600/30 font-bold"
                    : "bg-white text-emerald-700 hover:bg-emerald-50 border border-emerald-200/80"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${statusFilter === "replied" ? "bg-white" : "bg-emerald-500"}`} />
                Replied
              </button>
            </div>
          </div>

          {/* Scrollable List with strict overscroll containment */}
          <div
            className="flex-1 min-h-0 overflow-y-auto overscroll-contain divide-y divide-gray-100"
            style={{ overscrollBehavior: "contain" }}
          >
            {loading && queries.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-400">Loading conversations...</div>
            ) : filteredThreads.length === 0 ? (
              <div className="p-10 text-center space-y-2">
                <Inbox size={28} className="text-gray-300 mx-auto" />
                <p className="text-xs font-bold text-gray-800">No conversations found</p>
                <p className="text-[11px] text-gray-400">No requests match the selected filter.</p>
              </div>
            ) : (
              filteredThreads.map((thread) => {
                const isSelected = selectedThreadId === thread.instituteId
                const hasUnread = thread.unreadCount > 0
                const hasPending = thread.pendingCount > 0
                const latest = thread.latestQuery
                const threadMsgs = thread.queries.flatMap((q) => getQueryMessages(q))
                const lastMsg = threadMsgs[threadMsgs.length - 1] || null
                const isLastMsgMine = lastMsg
                  ? isSuperAdmin
                    ? lastMsg.senderRole === "admin"
                    : lastMsg.senderRole === "institute"
                  : false

                return (
                  <div
                    key={thread.instituteId}
                    onClick={() => handleSelectThread(thread)}
                    className={`p-3.5 px-4 transition-all cursor-pointer flex items-start gap-3 border-l-4 ${
                      isSelected
                        ? "bg-[#eaf0f8]/80 border-l-[#324158]"
                        : hasUnread
                        ? "bg-amber-50/40 border-l-amber-500 hover:bg-amber-50/70"
                        : "border-l-transparent hover:bg-slate-50/80"
                    }`}
                  >
                    {/* Avatar */}
                    <div className="relative shrink-0">
                      <div className="w-10 h-10 rounded-2xl bg-[#324158] text-white flex items-center justify-center font-bold text-xs shadow-xs">
                        {isSuperAdmin ? getInitials(thread.instituteName) : <ShieldCheck size={18} />}
                      </div>
                      {hasPending && (
                        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-amber-500 border-2 border-white" />
                      )}
                    </div>

                    {/* Preview */}
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
                          {formatTime(lastMsg ? lastMsg.createdAt : latest.createdAt)}
                        </span>
                      </div>

                      <p className="text-xs font-semibold text-[#324158] truncate">{latest.subject}</p>
                      <p className="text-[11px] text-gray-500 truncate flex items-center gap-1.5">
                        {isLastMsgMine && (
                          <span
                            className="inline-flex items-center shrink-0"
                            title={lastMsg?.isRead ? "Read by recipient" : "Delivered"}
                          >
                            <CheckCheck
                              size={15}
                              strokeWidth={2.2}
                              className={`shrink-0 ${lastMsg?.isRead ? "text-sky-500" : "text-gray-400"}`}
                            />
                          </span>
                        )}
                        <span className="truncate">{lastMsg?.message || latest.message}</span>
                      </p>

                      <div className="flex items-center justify-between pt-0.5 text-[10px]">
                        <span className="text-gray-400 font-medium">
                          {thread.queries.length} {thread.queries.length === 1 ? "ticket" : "tickets"}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {hasPending ? (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800">
                              Pending
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-emerald-100 text-emerald-800 flex items-center gap-0.5">
                              <CheckCheck size={12} strokeWidth={2.2} className="shrink-0" />
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

        {/* ─── RIGHT COLUMN: WhatsApp Chat Stream & Message Input ─── */}
        <main
          className={`flex-1 min-w-0 h-full flex flex-col min-h-0 overflow-hidden bg-[#f8fafc] ${
            mobileChatOpen ? "flex" : "hidden md:flex"
          }`}
        >
          {activeThread ? (
            <>
              {/* WhatsApp Chat Top Header */}
              <div className="p-3 px-4 sm:px-6 bg-white border-b border-gray-200 flex items-center justify-between gap-3 shrink-0 shadow-2xs">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={() => setMobileChatOpen(false)}
                    className="md:hidden p-1.5 rounded-lg text-gray-600 hover:bg-gray-100 cursor-pointer"
                    title="Back to list"
                  >
                    <ArrowLeft size={18} />
                  </button>

                  <div className="w-10 h-10 rounded-2xl bg-[#324158] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                    {isSuperAdmin ? getInitials(activeThread.instituteName) : <ShieldCheck size={20} />}
                  </div>

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

                <div className="flex items-center gap-2 shrink-0">
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

              {/* WhatsApp Messages Scroll Canvas (With overscroll-contain so mouse wheel scrolling never escapes!) */}
              <div
                className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-4 bg-[#f8fafc]"
                style={{ overscrollBehavior: "contain" }}
              >
                {activeThreadMessages.map((msg, idx) => {
                  const cat = msg.category ? (CATEGORY_META[msg.category] || CATEGORY_META.general) : null
                  const showDateHeader =
                    idx === 0 ||
                    formatDateHeader(msg.createdAt) !== formatDateHeader(activeThreadMessages[idx - 1].createdAt)

                  // Determine side:
                  // For Super Admin: Admin is Right, Institute is Left
                  // For Institute: Institute is Right, Admin is Left
                  const isSenderUser = isSuperAdmin ? msg.senderRole === "admin" : msg.senderRole === "institute"

                  return (
                    <div key={msg.id} className="space-y-3">
                      {showDateHeader && (
                        <div className="flex items-center justify-center my-3">
                          <span className="px-3 py-1 rounded-full text-[10px] font-bold text-gray-500 bg-white border border-gray-200 shadow-2xs">
                            {formatDateHeader(msg.createdAt)}
                          </span>
                        </div>
                      )}

                      {/* Chat Bubble Container */}
                      <div className={`flex items-start gap-2 max-w-[88%] sm:max-w-[78%] ${isSenderUser ? "ml-auto justify-end" : ""}`}>
                        {!isSenderUser && (
                          <div className="w-8 h-8 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-[10px] shrink-0 mt-1">
                            {isSuperAdmin ? getInitials(activeThread.instituteName) : <ShieldCheck size={14} className="text-[#324158]" />}
                          </div>
                        )}

                        <div
                          className={`p-3.5 rounded-2xl shadow-xs text-left w-full space-y-1.5 ${
                            isSenderUser
                              ? "bg-[#324158] text-white rounded-tr-xs"
                              : "bg-white text-gray-900 border border-gray-200 rounded-tl-xs"
                          }`}
                        >
                          {/* Bubble Top Row for query details */}
                          {msg.isOriginalQuery && (
                            <div className="flex items-center justify-between gap-2 border-b border-gray-100 pb-1.5">
                              {cat && (
                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${cat.bg} ${cat.text}`}>
                                  {cat.label}
                                </span>
                              )}
                              <span
                                className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${
                                  msg.status === "resolved"
                                    ? "bg-slate-100 text-slate-700"
                                    : msg.status === "replied"
                                    ? "bg-blue-50 text-blue-700"
                                    : "bg-amber-100 text-amber-800"
                                }`}
                              >
                                {msg.status}
                              </span>
                            </div>
                          )}

                          {/* Message Header */}
                          <div className="flex items-center justify-between gap-2">
                            <span className={`text-[11px] font-bold flex items-center gap-1 ${isSenderUser ? "text-slate-200" : "text-gray-700"}`}>
                              {msg.senderRole === "admin" && <ShieldCheck size={12} className={isSenderUser ? "text-emerald-400" : "text-[#324158]"} />}
                              {msg.senderName}
                            </span>
                            {msg.subject && msg.isOriginalQuery && (
                              <span className={`text-[10px] font-bold truncate max-w-[200px] ${isSenderUser ? "text-slate-300" : "text-[#324158]"}`}>
                                {msg.subject}
                              </span>
                            )}
                          </div>

                          {/* Subject banner if original query */}
                          {msg.subject && !isSenderUser && msg.isOriginalQuery && (
                            <h4 className="text-xs font-bold text-[#324158]">{msg.subject}</h4>
                          )}

                          {/* Message Body */}
                          <p className={`text-xs whitespace-pre-wrap leading-relaxed ${isSenderUser ? "text-slate-100" : "text-gray-800"}`}>
                            {msg.message}
                          </p>

                          {/* Footer with time & WhatsApp checkmarks */}
                          <div className={`flex items-center justify-end gap-1.5 text-[10px] pt-0.5 ${isSenderUser ? "text-slate-300" : "text-gray-400"}`}>
                            <span className="tabular-nums">{formatTime(msg.createdAt)}</span>
                            {isSenderUser && (
                              <span
                                className="inline-flex items-center shrink-0 ml-0.5"
                                title={msg.isRead ? "Read by recipient" : "Delivered"}
                              >
                                <CheckCheck
                                  size={16}
                                  strokeWidth={2.2}
                                  className={`shrink-0 transition-colors ${
                                    msg.isRead ? "text-sky-400" : "text-slate-400"
                                  }`}
                                />
                              </span>
                            )}
                          </div>
                        </div>

                        {isSenderUser && (
                          <div className="w-8 h-8 rounded-xl bg-[#324158] text-white flex items-center justify-center shrink-0 mt-1 shadow-xs">
                            {isSuperAdmin ? <ShieldCheck size={15} /> : <User size={15} />}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
                <div ref={chatEndRef} />
              </div>

              {/* Bottom Message Input Bar */}
              <div className="p-3 sm:p-4 bg-white border-t border-gray-200 space-y-2 shrink-0">
                {/* Target Query Selector if multiple tickets exist */}
                {activeThread.queries.length > 1 && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-gray-500 text-[11px] font-semibold shrink-0">Thread:</span>
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

                {/* Quick Templates (for Admin) */}
                {isSuperAdmin && (
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
                )}

                {/* Input & Action Buttons */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2.5">
                  <textarea
                    rows={2}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder={
                      isSuperAdmin
                        ? `Type your reply to ${activeThread.instituteName}...`
                        : "Type your message to Progrentures Support Desk..."
                    }
                    className="w-full text-xs p-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#324158]/15 focus:border-[#324158] transition-all resize-none leading-relaxed"
                  />

                  <div className="flex items-center justify-end gap-2 shrink-0">
                    {isSuperAdmin && (
                      <button
                        type="button"
                        onClick={() => handleSendReply("resolved")}
                        disabled={submittingReply || !replyText.trim()}
                        className="px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                        title="Send response and mark as resolved"
                      >
                        <CheckCircle2 size={14} className="text-emerald-600" />
                        <span className="whitespace-nowrap">Resolve</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleSendReply("replied")}
                      disabled={submittingReply || !replyText.trim()}
                      className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-[#324158] text-white hover:bg-[#1e2a38] shadow-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <Send size={14} />
                      <span className="whitespace-nowrap">{submittingReply ? "Sending..." : "Send Message"}</span>
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* Empty State */
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3">
              <div className="w-16 h-16 rounded-3xl bg-[#eaf0f8] text-[#324158] flex items-center justify-center shadow-xs">
                <MessageSquare size={28} />
              </div>
              <h3 className="text-base font-bold text-gray-800">
                {isSuperAdmin ? "Progrentures Support Desk" : "Welcome to Support"}
              </h3>
              <p className="text-xs text-gray-500 max-w-sm">
                {isSuperAdmin
                  ? "Select an organization from the left chat list to view communications, send messages, or resolve requests."
                  : "Click 'New Request' above to submit a quota increase or support inquiry to our team."}
              </p>
            </div>
          )}
        </main>
      </div>

      {/* New Request Modal for Institute */}
      {showNewQueryModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-4 px-5 border-b border-gray-100 bg-slate-50/70">
              <div className="flex items-center gap-2">
                <MessageSquare size={16} className="text-[#324158]" />
                <h3 className="text-sm font-bold text-[#324158]">New Support Request</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowNewQueryModal(false)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitNewQuery} className="p-5 space-y-4 text-xs">
              <div>
                <label className="font-bold text-gray-700 block mb-1">Request Category:</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white font-medium focus:outline-none focus:border-[#324158]"
                >
                  <option value="quota_increase">Exam / Aspirant Quota Increase</option>
                  <option value="billing_fees">Billing, License & Validity</option>
                  <option value="feature_request">Feature Request / Customization</option>
                  <option value="technical_issue">Technical Support / Bug</option>
                  <option value="general">General Support</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-gray-700 block mb-1">Subject / Summary:</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Request to increase max exams from 20 to 50"
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 font-medium focus:outline-none focus:border-[#324158]"
                />
              </div>

              <div>
                <label className="font-bold text-gray-700 block mb-1">Message Details:</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Describe your requirement, reason, or details..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  className="w-full p-3 rounded-xl border border-gray-200 font-medium focus:outline-none focus:border-[#324158] resize-none leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowNewQueryModal(false)}
                  className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 cursor-pointer font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingNewQuery}
                  className="px-5 py-2 rounded-xl bg-[#324158] text-white hover:bg-[#1e2a38] font-bold shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Send size={13} />
                  <span>{submittingNewQuery ? "Submitting..." : "Send Request"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
