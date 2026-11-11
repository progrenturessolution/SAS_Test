"use client"

import { useEffect, useState } from "react"
import {
  Building2,
  Plus,
  Search,
  Users,
  FileText,
  ShieldCheck,
  AlertCircle,
  MoreVertical,
  CheckCircle2,
  XCircle,
  Edit2,
  KeyRound,
  Trash2,
  Lock,
  Calendar,
  Sparkles,
  GraduationCap,
  Sliders,
  RefreshCw,
  Phone,
  Mail,
  MapPin,
  X,
  Loader2,
} from "lucide-react"

interface InstituteLimits {
  maxStudents: number
  maxExams: number
  examTypes: string[]
  customQuestionTypes: string[]
  features: {
    neetJeeGenerator: boolean
    aiProctoring: boolean
    pdfImport: boolean
  }
}

const EXAM_ACCESS_OPTIONS = [
  { value: "NEET", label: "NEET (UG)" },
  { value: "JEE_MAIN", label: "JEE Main" },
  { value: "JEE_ADVANCED", label: "JEE Advanced" },
  { value: "MHT_CET", label: "MHT-CET" },
  { value: "CBSE_BOARD", label: "CBSE Board" },
  { value: "CUSTOM", label: "Custom Tests" },
] as const

const CUSTOM_QUESTION_TYPE_OPTIONS = [
  { value: "mcq", label: "MCQ" },
  { value: "truefalse", label: "True / False" },
  { value: "descriptive", label: "Descriptive" },
  { value: "fillblanks", label: "Fill Blanks" },
  { value: "coding", label: "Coding" },
] as const
const ALL_CUSTOM_QUESTION_TYPES = CUSTOM_QUESTION_TYPE_OPTIONS.map((option) => option.value)

interface InstituteUsage {
  examsCreated: number
  studentsEnrolled: number
  examLimit: number
  studentLimit: number
  isExamLimitReached: boolean
  isStudentLimitReached: boolean
}

interface Institute {
  _id: string
  name: string
  code: string
  email: string
  phone?: string
  city?: string
  address?: string
  contactPerson?: string
  limits: InstituteLimits
  validUntil?: string
  status: "active" | "suspended" | "expired"
  createdAt: string
  usage: InstituteUsage
}

async function readApiResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") ?? ""
  if (!contentType.includes("application/json")) {
    throw new Error(`Request failed with status ${response.status}`)
  }
  return response.json() as Promise<T>
}

export default function InstitutesManagementPage() {
  const [institutes, setInstitutes] = useState<Institute[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "suspended">("all")

  // Modals state
  const [showRegisterModal, setShowRegisterModal] = useState(false)
  const [showEditLimitsModal, setShowEditLimitsModal] = useState<Institute | null>(null)
  const [showResetPasswordModal, setShowResetPasswordModal] = useState<Institute | null>(null)
  const [selectedInstitute, setSelectedInstitute] = useState<Institute | null>(null)
  const [openActionMenu, setOpenActionMenu] = useState<string | null>(null)

  // Registration Form state
  const [formName, setFormName] = useState("")
  const [formCode, setFormCode] = useState("")
  const [formEmail, setFormEmail] = useState("")
  const [formPassword, setFormPassword] = useState("")
  const [formPhone, setFormPhone] = useState("")
  const [formCity, setFormCity] = useState("")
  const [formContactPerson, setFormContactPerson] = useState("")
  const [formMaxStudents, setFormMaxStudents] = useState(100)
  const [formMaxExams, setFormMaxExams] = useState(20)
  const [formExamTypes, setFormExamTypes] = useState<string[]>(EXAM_ACCESS_OPTIONS.map((option) => option.value))
  const [formCustomQuestionTypes, setFormCustomQuestionTypes] = useState<string[]>(ALL_CUSTOM_QUESTION_TYPES)
  const [formPdfImport, setFormPdfImport] = useState(true)
  const [formValidUntil, setFormValidUntil] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState("")

  // Edit Limits state
  const [editMaxStudents, setEditMaxStudents] = useState(100)
  const [editMaxExams, setEditMaxExams] = useState(20)
  const [editExamTypes, setEditExamTypes] = useState<string[]>([])
  const [editCustomQuestionTypes, setEditCustomQuestionTypes] = useState<string[]>(ALL_CUSTOM_QUESTION_TYPES)
  const [editPdfImport, setEditPdfImport] = useState(true)
  const [editValidUntil, setEditValidUntil] = useState("")
  const [editStatus, setEditStatus] = useState<"active" | "suspended">("active")
  const [savingLimits, setSavingLimits] = useState(false)

  // Password reset state
  const [newPassword, setNewPassword] = useState("")
  const [resettingPassword, setResettingPassword] = useState(false)

  const fetchInstitutes = async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/admin/institutes")
      const data = await readApiResponse<{ institutes?: Institute[]; error?: string }>(res)
      if (res.ok) {
        setInstitutes(data.institutes || [])
      } else {
        console.error("Error fetching institutes:", data.error)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchInstitutes()
  }, [])

  // Handle Register Coaching
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError("")
    setSubmitting(true)

    try {
      const res = await fetch("/api/admin/institutes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName,
          code: formCode,
          email: formEmail,
          password: formPassword,
          phone: formPhone,
          city: formCity,
          contactPerson: formContactPerson,
          maxStudents: formMaxStudents,
          maxExams: formMaxExams,
          examTypes: formExamTypes,
          customQuestionTypes: formCustomQuestionTypes,
          features: {
            pdfImport: formPdfImport,
          },
          validUntil: formValidUntil || undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to register coaching")

      setShowRegisterModal(false)
      // Reset form
      setFormName("")
      setFormCode("")
      setFormEmail("")
      setFormPassword("")
      setFormPhone("")
      setFormCity("")
      setFormContactPerson("")
      setFormMaxStudents(100)
      setFormMaxExams(20)
      setFormExamTypes(EXAM_ACCESS_OPTIONS.map((option) => option.value))
      setFormCustomQuestionTypes(ALL_CUSTOM_QUESTION_TYPES)
      setFormValidUntil("")
      await fetchInstitutes()
    } catch (err: any) {
      setFormError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // Open Edit Limits Modal
  const openEditLimits = (inst: Institute) => {
    setShowEditLimitsModal(inst)
    setEditMaxStudents(inst.limits?.maxStudents ?? 100)
    setEditMaxExams(inst.limits?.maxExams ?? 20)
    setEditExamTypes(inst.limits?.examTypes ?? EXAM_ACCESS_OPTIONS.map((option) => option.value))
    setEditCustomQuestionTypes(inst.limits?.customQuestionTypes ?? ALL_CUSTOM_QUESTION_TYPES)
    setEditPdfImport(inst.limits?.features?.pdfImport ?? true)
    setEditStatus(inst.status === "suspended" ? "suspended" : "active")
    setEditValidUntil(
      inst.validUntil ? new Date(inst.validUntil).toISOString().split("T")[0] : ""
    )
  }

  // Handle Save Limits
  const handleSaveLimits = async () => {
    if (!showEditLimitsModal) return
    setSavingLimits(true)

    try {
      const res = await fetch(`/api/admin/institutes/${showEditLimitsModal._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: editStatus,
          validUntil: editValidUntil || null,
          limits: {
            maxStudents: editMaxStudents,
            maxExams: editMaxExams,
            examTypes: editExamTypes,
            customQuestionTypes: editCustomQuestionTypes,
            features: {
              pdfImport: editPdfImport,
            },
          },
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to update limits")

      setShowEditLimitsModal(null)
      await fetchInstitutes()
    } catch (err: any) {
      alert("Error: " + err.message)
    } finally {
      setSavingLimits(false)
    }
  }

  // Handle Toggle Status
  const handleToggleStatus = async (inst: Institute) => {
    const nextStatus = inst.status === "active" ? "suspended" : "active"
    const confirmMsg =
      nextStatus === "suspended"
        ? `Are you sure you want to SUSPEND "${inst.name}"? Their teachers & students will be blocked from logging in.`
        : `Re-activate "${inst.name}"?`

    if (!confirm(confirmMsg)) return

    try {
      const res = await fetch(`/api/admin/institutes/${inst._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      })
      if (!res.ok) throw new Error("Failed to update status")
      await fetchInstitutes()
    } catch (err: any) {
      alert(err.message)
    }
  }

  const handleDeleteInstitute = async (inst: Institute) => {
    if (!confirm(`Delete "${inst.name}" permanently? This will remove the institute, admin login, all students, exams, attempts, and related records. This action cannot be undone.`)) {
      return
    }

    try {
      const res = await fetch(`/api/admin/institutes/${inst._id}`, { method: "DELETE" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to delete institute")

      setSelectedInstitute((current) => (current?._id === inst._id ? null : current))
      await fetchInstitutes()
    } catch (err: any) {
      alert(err.message || "Failed to delete institute")
    }
  }

  // Handle Reset Password
  const handleResetPassword = async () => {
    if (!showResetPasswordModal || !newPassword) return
    setResettingPassword(true)

    try {
      const res = await fetch(
        `/api/admin/institutes/${showResetPasswordModal._id}/reset-password`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ newPassword }),
        }
      )

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to reset password")

      alert(`Password successfully updated for ${showResetPasswordModal.name}!`)
      setShowResetPasswordModal(null)
      setNewPassword("")
    } catch (err: any) {
      alert("Error: " + err.message)
    } finally {
      setResettingPassword(false)
    }
  }

  // Filtered Institutes
  const filteredInstitutes = institutes.filter((inst) => {
    const matchesSearch =
      inst.name.toLowerCase().includes(search.toLowerCase()) ||
      inst.code.toLowerCase().includes(search.toLowerCase()) ||
      inst.email.toLowerCase().includes(search.toLowerCase()) ||
      (inst.city && inst.city.toLowerCase().includes(search.toLowerCase()))

    const matchesStatus =
      statusFilter === "all" ? true : inst.status === statusFilter

    return matchesSearch && matchesStatus
  })

  // Metrics calculation
  const totalInstitutesCount = institutes.length
  const activeInstitutesCount = institutes.filter((i) => i.status === "active").length
  const totalPlatformStudents = institutes.reduce(
    (acc, i) => acc + (i.usage?.studentsEnrolled || 0),
    0
  )
  const totalPlatformExams = institutes.reduce(
    (acc, i) => acc + (i.usage?.examsCreated || 0),
    0
  )

  return (
    <div className="p-6 sm:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-gray-100">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
            <span>Super Admin</span>
            <span>•</span>
            <span>Multi-Tenant Architecture</span>
          </div>
          <h1 className="text-2xl font-bold text-[#45505F] flex items-center gap-2.5">
            <Building2 className="w-6 h-6 text-[#2D3A4A]" />
            <span>Organizations</span>
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Register organizations, allocate student & exam quotas, and configure access permissions.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowRegisterModal(true)}
          className="px-4 py-2.5 rounded-lg bg-[#2D3A4A] hover:bg-[#1e2a38] text-white text-xs font-semibold shadow-sm flex items-center gap-2 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Register New Organization</span>
        </button>
      </div>

      {/* 4 Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-white border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between text-gray-500 text-xs font-medium mb-1">
            <span>Registered Organizations</span>
            <Building2 className="w-4 h-4 text-[#2D3A4A]" />
          </div>
          <div className="text-2xl font-bold text-[#2D3A4A]">{totalInstitutesCount}</div>
          <span className="text-[11px] text-emerald-600 font-medium">
            {activeInstitutesCount} Active Centers
          </span>
        </div>

        <div className="p-4 rounded-xl bg-white border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between text-gray-500 text-xs font-medium mb-1">
            <span>Active Organizations</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-[#2D3A4A]">{activeInstitutesCount}</div>
          <span className="text-[11px] text-gray-400">
            {totalInstitutesCount - activeInstitutesCount} Suspended
          </span>
        </div>

        <div className="p-4 rounded-xl bg-white border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between text-gray-500 text-xs font-medium mb-1">
            <span>Total Students Enrolled</span>
            <Users className="w-4 h-4 text-[#2D3A4A]" />
          </div>
          <div className="text-2xl font-bold text-[#2D3A4A]">{totalPlatformStudents}</div>
          <span className="text-[11px] text-gray-400">Across all organization batches</span>
        </div>

        <div className="p-4 rounded-xl bg-white border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between text-gray-500 text-xs font-medium mb-1">
            <span>Total Exams Conducted</span>
            <FileText className="w-4 h-4 text-[#2D3A4A]" />
          </div>
          <div className="text-2xl font-bold text-[#2D3A4A]">{totalPlatformExams}</div>
          <span className="text-[11px] text-gray-400">NEET, JEE & Custom Tests</span>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-xl bg-white border border-gray-200 shadow-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by organization name, code, email, or city..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 text-xs rounded-lg border border-gray-200 bg-gray-50/50 text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#2D3A4A] focus:bg-white"
          />
        </div>

        <div className="flex items-center gap-1.5 self-end sm:self-auto">
          {(["all", "active", "suspended"] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all cursor-pointer ${
                statusFilter === st
                  ? "bg-[#2D3A4A] text-white shadow-xs"
                  : "bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200"
              }`}
            >
              {st}
            </button>
          ))}
          <button
            onClick={fetchInstitutes}
            title="Refresh"
            className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Institutes Table / Cards */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin mb-2 text-[#2D3A4A]" />
          <span className="text-xs">Loading organizations...</span>
        </div>
      ) : filteredInstitutes.length === 0 ? (
        <div className="py-16 text-center rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/50 flex flex-col items-center justify-center">
          <Building2 className="w-10 h-10 text-gray-300 mb-3" />
          <h3 className="text-sm font-bold text-[#45505F] mb-1">No Organizations Found</h3>
          <p className="text-xs text-gray-400 max-w-sm mb-4">
            {search || statusFilter !== "all"
              ? "Try adjusting your search query or status filter."
              : "Get started by registering your first organization."}
          </p>
          <button
            onClick={() => setShowRegisterModal(true)}
            className="px-4 py-2 rounded-lg bg-[#2D3A4A] text-white text-xs font-semibold hover:bg-[#1e2a38] transition-all cursor-pointer"
          >
            + Register Organization
          </button>
        </div>
      ) : (
        <>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredInstitutes.map((inst) => {
            const studentPct = Math.min(Math.round(((inst.usage?.studentsEnrolled || 0) / (inst.limits?.maxStudents || 100)) * 100), 100)
            const examPct = Math.min(Math.round(((inst.usage?.examsCreated || 0) / (inst.limits?.maxExams || 20)) * 100), 100)

            return (
              <article
                key={inst._id}
                onClick={() => setSelectedInstitute(inst)}
                className="group relative cursor-pointer rounded-2xl border border-gray-200 bg-white p-5 shadow-xs transition-all hover:-translate-y-0.5 hover:border-[#2D3A4A]/30 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-gray-100 text-lg font-bold text-[#2D3A4A]">
                      {inst.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-bold text-[#2D3A4A]">{inst.name}</h3>
                      <p className="mt-1 flex items-center gap-1 text-[11px] text-gray-400">
                        <MapPin className="h-3 w-3" /> {inst.city || "Location not added"}
                      </p>
                    </div>
                  </div>
                  <div className="relative shrink-0" onClick={(event) => event.stopPropagation()}>
                    <button
                      type="button"
                      aria-label={`Actions for ${inst.name}`}
                      onClick={() => setOpenActionMenu(openActionMenu === inst._id ? null : inst._id)}
                      className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-[#2D3A4A]"
                    >
                      <MoreVertical className="h-5 w-5" />
                    </button>
                    {openActionMenu === inst._id && (
                      <div className="absolute right-0 top-9 z-20 w-48 rounded-xl border border-gray-200 bg-white p-1.5 text-left shadow-lg">
                        <button type="button" onClick={() => { setOpenActionMenu(null); openEditLimits(inst) }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50">
                          <Sliders className="h-3.5 w-3.5" /> Edit quotas & features
                        </button>
                        <button type="button" onClick={() => { setOpenActionMenu(null); setShowResetPasswordModal(inst); setNewPassword("") }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50">
                          <KeyRound className="h-3.5 w-3.5" /> Reset password
                        </button>
                        <button type="button" onClick={() => { setOpenActionMenu(null); handleToggleStatus(inst) }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50">
                          {inst.status === "active" ? <XCircle className="h-3.5 w-3.5 text-amber-600" /> : <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
                          {inst.status === "active" ? "Suspend institute" : "Activate institute"}
                        </button>
                        <button type="button" onClick={() => { setOpenActionMenu(null); handleDeleteInstitute(inst) }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50">
                          <Trash2 className="h-3.5 w-3.5" /> Delete institute
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between gap-2">
                  <span className="rounded-md border border-gray-200 bg-gray-50 px-2 py-1 font-mono text-[10px] font-semibold text-gray-600">{inst.code}</span>
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-bold ${inst.status === "active" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${inst.status === "active" ? "bg-emerald-500" : "bg-red-500"}`} />
                    {inst.status === "active" ? "Active" : "Suspended"}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 border-y border-gray-100 py-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Students</p>
                    <p className="mt-1 text-sm font-bold text-[#2D3A4A]">{inst.usage?.studentsEnrolled || 0} <span className="text-[11px] font-medium text-gray-400">/ {inst.limits?.maxStudents ?? 100}</span></p>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100"><div className={`h-full rounded-full ${studentPct >= 90 ? "bg-red-500" : studentPct >= 70 ? "bg-amber-500" : "bg-[#2D3A4A]"}`} style={{ width: `${studentPct}%` }} /></div>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Exams</p>
                    <p className="mt-1 text-sm font-bold text-[#2D3A4A]">{inst.usage?.examsCreated || 0} <span className="text-[11px] font-medium text-gray-400">/ {inst.limits?.maxExams ?? 20}</span></p>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100"><div className={`h-full rounded-full ${examPct >= 90 ? "bg-red-500" : examPct >= 70 ? "bg-amber-500" : "bg-emerald-600"}`} style={{ width: `${examPct}%` }} /></div>
                  </div>
                </div>

                <div className="space-y-2 text-[11px] text-gray-500">
                  <p className="flex items-center gap-2 truncate"><Mail className="h-3.5 w-3.5 shrink-0 text-gray-400" /> {inst.email}</p>
                  {inst.phone && <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-gray-400" /> {inst.phone}</p>}
                </div>
                <p className="mt-4 text-center text-[11px] font-semibold text-[#2D3A4A] opacity-70 transition-opacity group-hover:opacity-100">Click to view full institute details</p>
              </article>
            )
          })}
        </div>

        <div className="hidden bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-200 text-gray-500 uppercase tracking-wider font-semibold text-[11px]">
                  <th className="py-3 px-4">Coaching Details</th>
                  <th className="py-3 px-4">Contact Info</th>
                  <th className="py-3 px-4">Quota & Usage</th>
                  <th className="py-3 px-4">Features Granted</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredInstitutes.map((inst) => {
                  const studentPct = Math.min(
                    Math.round(
                      ((inst.usage?.studentsEnrolled || 0) /
                        (inst.limits?.maxStudents || 100)) *
                        100
                    ),
                    100
                  )
                  const examPct = Math.min(
                    Math.round(
                      ((inst.usage?.examsCreated || 0) / (inst.limits?.maxExams || 20)) * 100
                    ),
                    100
                  )

                  return (
                    <tr key={inst._id} className="hover:bg-gray-50/60 transition-colors">
                      {/* Name & Code */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-lg bg-gray-100 text-[#2D3A4A] font-bold flex items-center justify-center shrink-0 border border-gray-200">
                            {inst.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-[#2D3A4A] text-sm flex items-center gap-1.5">
                              <span>{inst.name}</span>
                              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 border border-gray-200">
                                {inst.code}
                              </span>
                            </div>
                            {inst.city && (
                              <span className="text-[11px] text-gray-400 flex items-center gap-1 mt-0.5">
                                <MapPin className="w-3 h-3" />
                                {inst.city}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Contact Info */}
                      <td className="py-3.5 px-4 text-gray-600">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-gray-700">
                            <Mail className="w-3.5 h-3.5 text-gray-400" />
                            <span className="font-medium">{inst.email}</span>
                          </div>
                          {inst.phone && (
                            <div className="flex items-center gap-1.5 text-gray-500 text-[11px]">
                              <Phone className="w-3 h-3 text-gray-400" />
                              <span>{inst.phone}</span>
                            </div>
                          )}
                          {inst.contactPerson && (
                            <div className="text-[11px] text-gray-400">
                              POC: <span className="text-gray-600">{inst.contactPerson}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Quota & Usage Progress Bars */}
                      <td className="py-3.5 px-4 min-w-[190px]">
                        <div className="space-y-2">
                          {/* Students Quota */}
                          <div>
                            <div className="flex justify-between text-[11px] font-medium mb-1">
                              <span className="text-gray-500">Students:</span>
                              <span
                                className={`font-bold ${
                                  studentPct >= 90 ? "text-red-600" : "text-[#2D3A4A]"
                                }`}
                              >
                                {inst.usage?.studentsEnrolled || 0} /{" "}
                                {inst.limits?.maxStudents ?? 100}
                              </span>
                            </div>
                            <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  studentPct >= 90
                                    ? "bg-red-500"
                                    : studentPct >= 70
                                    ? "bg-amber-500"
                                    : "bg-[#2D3A4A]"
                                }`}
                                style={{ width: `${studentPct}%` }}
                              />
                            </div>
                          </div>

                          {/* Exams Quota */}
                          <div>
                            <div className="flex justify-between text-[11px] font-medium mb-1">
                              <span className="text-gray-500">Exams Created:</span>
                              <span
                                className={`font-bold ${
                                  examPct >= 90 ? "text-red-600" : "text-[#2D3A4A]"
                                }`}
                              >
                                {inst.usage?.examsCreated || 0} / {inst.limits?.maxExams ?? 20}
                              </span>
                            </div>
                            <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  examPct >= 90
                                    ? "bg-red-500"
                                    : examPct >= 70
                                    ? "bg-amber-500"
                                    : "bg-emerald-600"
                                }`}
                                style={{ width: `${examPct}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Features */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap gap-1">
                          {inst.limits?.features?.pdfImport ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-50 text-purple-700 border border-purple-200">
                              PDF Import
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-400 line-through">
                              PDF
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            inst.status === "active"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-red-50 text-red-700 border border-red-200"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              inst.status === "active" ? "bg-emerald-500" : "bg-red-500"
                            }`}
                          />
                          {inst.status === "active" ? "Active" : "Suspended"}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openEditLimits(inst)}
                            title="Edit Quotas & Permissions"
                            className="p-1.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-100 cursor-pointer transition-colors"
                          >
                            <Sliders className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => {
                              setShowResetPasswordModal(inst)
                              setNewPassword("")
                            }}
                            title="Reset Password"
                            className="p-1.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-100 cursor-pointer transition-colors"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleToggleStatus(inst)}
                            title={inst.status === "active" ? "Suspend Institute" : "Activate Institute"}
                            className={`px-2 py-1 rounded-lg text-[11px] font-medium border cursor-pointer transition-colors ${
                              inst.status === "active"
                                ? "border-amber-200 text-amber-700 hover:bg-amber-50"
                                : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                            }`}
                          >
                            {inst.status === "active" ? "Suspend" : "Activate"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
        </>
      )}

      {selectedInstitute && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-xl">
            <div className="flex items-start justify-between border-b border-gray-100 p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-gray-200 bg-gray-100 text-xl font-bold text-[#2D3A4A]">
                  {selectedInstitute.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-[#2D3A4A]">{selectedInstitute.name}</h2>
                  <p className="mt-1 text-xs text-gray-500">Institute code: <span className="font-mono font-semibold text-gray-700">{selectedInstitute.code}</span></p>
                </div>
              </div>
              <button type="button" onClick={() => setSelectedInstitute(null)} aria-label="Close institute details" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-4">
                <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-gray-400">Contact details</p>
                <div className="space-y-2.5 text-xs text-gray-700">
                  <p className="flex items-start gap-2"><Mail className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" /> {selectedInstitute.email}</p>
                  {selectedInstitute.phone && <p className="flex items-start gap-2"><Phone className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" /> {selectedInstitute.phone}</p>}
                  {selectedInstitute.contactPerson && <p className="flex items-start gap-2"><Users className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" /> {selectedInstitute.contactPerson}</p>}
                  {selectedInstitute.city && <p className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" /> {selectedInstitute.city}</p>}
                  {selectedInstitute.address && <p className="flex items-start gap-2"><Building2 className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" /> {selectedInstitute.address}</p>}
                </div>
              </div>
              <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-4">
                <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-gray-400">Account status</p>
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${selectedInstitute.status === "active" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${selectedInstitute.status === "active" ? "bg-emerald-500" : "bg-red-500"}`} />
                  {selectedInstitute.status === "active" ? "Active" : "Suspended"}
                </span>
                <p className="mt-4 text-xs text-gray-500">Valid until</p>
                <p className="mt-1 text-sm font-semibold text-[#2D3A4A]">{selectedInstitute.validUntil ? new Date(selectedInstitute.validUntil).toLocaleDateString() : "No expiry set"}</p>
                <p className="mt-4 text-xs text-gray-500">Registered on</p>
                <p className="mt-1 text-sm font-semibold text-[#2D3A4A]">{new Date(selectedInstitute.createdAt).toLocaleDateString()}</p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-4 sm:col-span-2">
                <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-gray-400">Usage and quotas</p>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div><p className="text-xs text-gray-500">Students</p><p className="mt-1 text-lg font-bold text-[#2D3A4A]">{selectedInstitute.usage?.studentsEnrolled || 0} <span className="text-xs font-medium text-gray-400">/ {selectedInstitute.limits?.maxStudents ?? 100}</span></p></div>
                  <div><p className="text-xs text-gray-500">Exams</p><p className="mt-1 text-lg font-bold text-[#2D3A4A]">{selectedInstitute.usage?.examsCreated || 0} <span className="text-xs font-medium text-gray-400">/ {selectedInstitute.limits?.maxExams ?? 20}</span></p></div>
                  <div><p className="text-xs text-gray-500">Student limit</p><p className="mt-1 text-lg font-bold text-[#2D3A4A]">{selectedInstitute.limits?.maxStudents ?? 100}</p></div>
                  <div><p className="text-xs text-gray-500">Exam limit</p><p className="mt-1 text-lg font-bold text-[#2D3A4A]">{selectedInstitute.limits?.maxExams ?? 20}</p></div>
                </div>
              </div>
              <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-4 sm:col-span-2">
                <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-gray-400">Enabled features</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    ["PDF Import", selectedInstitute.limits?.features?.pdfImport],
                  ].map(([label, enabled]) => (
                    <span key={String(label)} className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${enabled ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-gray-200 bg-gray-100 text-gray-400"}`}>
                      {enabled ? "Enabled" : "Disabled"} · {String(label)}
                    </span>
                  ))}
                </div>
                <p className="mb-2 mt-4 text-[11px] font-bold uppercase tracking-wider text-gray-400">Allowed exam categories</p>
                <div className="flex flex-wrap gap-2">
                  {(selectedInstitute.limits?.examTypes || []).map((examType) => (
                    <span key={examType} className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                      {EXAM_ACCESS_OPTIONS.find(option => option.value === examType)?.label || examType}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal 1: Register New Coaching ─── */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#2D3A4A] text-white flex items-center justify-center">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#45505F]">Register Coaching Institute</h3>
                  <p className="text-[11px] text-gray-400">
                    Create an isolated tenant account with customized student & exam limits.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowRegisterModal(false)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRegister} className="p-5 space-y-4 text-xs">
              {formError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Basic Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Institute Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Apex Science Academy"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:border-[#2D3A4A]"
                  />
                </div>

                <div>
                  <label className="font-bold text-gray-700 block mb-1">
                    Unique Code (Prefix) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. APEX01"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 uppercase font-mono focus:outline-none focus:border-[#2D3A4A]"
                  />
                </div>
              </div>

              {/* Login Credentials */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Login Email *</label>
                  <input
                    type="email"
                    required
                    placeholder="admin@apexacademy.com"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:border-[#2D3A4A]"
                  />
                </div>

                <div>
                  <label className="font-bold text-gray-700 block mb-1">Initial Password *</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="••••••••"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:border-[#2D3A4A]"
                  />
                </div>
              </div>

              {/* Location & Contact */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-medium text-gray-600 block mb-1">Contact Person</label>
                  <input
                    type="text"
                    placeholder="Dr. Rajesh Sharma"
                    value={formContactPerson}
                    onChange={(e) => setFormContactPerson(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:border-[#2D3A4A]"
                  />
                </div>

                <div>
                  <label className="font-medium text-gray-600 block mb-1">Phone Number</label>
                  <input
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:border-[#2D3A4A]"
                  />
                </div>

                <div>
                  <label className="font-medium text-gray-600 block mb-1">City / Region</label>
                  <input
                    type="text"
                    placeholder="e.g. Pune / Mumbai"
                    value={formCity}
                    onChange={(e) => setFormCity(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:border-[#2D3A4A]"
                  />
                </div>
              </div>

              {/* Limits Configuration */}
              <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 space-y-3">
                <span className="font-bold text-[#45505F] block">
                  Quota Limits & Access Configuration
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-gray-700 block mb-1">
                      Max Student Limit
                    </label>
                    <input
                      type="number"
                      min={10}
                      max={10000}
                      value={formMaxStudents}
                      onChange={(e) => setFormMaxStudents(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white focus:outline-none focus:border-[#2D3A4A]"
                    />
                    <span className="text-[10px] text-gray-400">Total students permitted in tests</span>
                  </div>

                  <div>
                    <label className="font-semibold text-gray-700 block mb-1">
                      Max Exams Limit
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={500}
                      value={formMaxExams}
                      onChange={(e) => setFormMaxExams(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white focus:outline-none focus:border-[#2D3A4A]"
                    />
                    <span className="text-[10px] text-gray-400">Total exams coaching can create</span>
                  </div>
                </div>

                {/* Feature Permissions Checkboxes */}
                <div>
                  <span className="font-semibold text-gray-700 block mb-1.5">
                    Permitted Features
                  </span>
                  <div className="grid grid-cols-1 gap-2">
                    <label className="flex items-center gap-2 p-2 rounded-lg bg-white border border-gray-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formPdfImport}
                        onChange={(e) => setFormPdfImport(e.target.checked)}
                        className="rounded text-[#2D3A4A]"
                      />
                      <span className="text-[11px] font-medium text-gray-700">
                        PDF Paper Import
                      </span>
                    </label>
                  </div>
                </div>

                <div>
                  <span className="font-semibold text-gray-700 block mb-1.5">
                    Competitive Exam Access
                  </span>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {EXAM_ACCESS_OPTIONS.map((option) => (
                      <label key={option.value} className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white p-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formExamTypes.includes(option.value)}
                          onChange={(e) => setFormExamTypes((current) => e.target.checked
                            ? [...current, option.value]
                            : current.filter((value) => value !== option.value))}
                          className="rounded text-[#2D3A4A]"
                        />
                        <span className="text-[11px] font-medium text-gray-700">{option.label}</span>
                      </label>
                    ))}
                  </div>
                  <span className="mt-1 block text-[10px] text-gray-400">
                    Select the competitive exam formats this institute can conduct. Custom Tests are configured below.
                  </span>
                </div>

                <div>
                  <span className="font-semibold text-gray-700 block mb-1.5">
                    Custom Test Question-Type Access
                  </span>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {CUSTOM_QUESTION_TYPE_OPTIONS.map((option) => (
                      <label key={option.value} className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white p-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formCustomQuestionTypes.includes(option.value)}
                          onChange={(e) => setFormCustomQuestionTypes((current) => e.target.checked
                            ? [...current, option.value]
                            : current.filter((value) => value !== option.value))}
                          className="rounded text-[#2D3A4A]"
                        />
                        <span className="text-[11px] font-medium text-gray-700">{option.label}</span>
                      </label>
                    ))}
                  </div>
                  <span className="mt-1 block text-[10px] text-gray-400">
                    These question types will be available only when creating a Custom Test.
                  </span>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowRegisterModal(false)}
                  className="px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 cursor-pointer font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-lg bg-[#2D3A4A] hover:bg-[#1e2a38] text-white font-medium shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{submitting ? "Registering..." : "Register Coaching Institute"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Modal 2: Edit Quotas & Permissions ─── */}
      {showEditLimitsModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-lg">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div>
                <h3 className="text-sm font-bold text-[#45505F]">
                  Edit Quotas & Features: {showEditLimitsModal.name}
                </h3>
                <span className="font-mono text-[10px] text-gray-400">
                  Code: {showEditLimitsModal.code}
                </span>
              </div>
              <button
                onClick={() => setShowEditLimitsModal(null)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              {/* Status Toggle */}
              <div>
                <label className="font-bold text-gray-700 block mb-1">Account Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white font-medium"
                >
                  <option value="active">Active (Access Allowed)</option>
                  <option value="suspended">Suspended (Access Blocked)</option>
                </select>
              </div>

              {/* Quota inputs */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Max Student Quota</label>
                  <input
                    type="number"
                    min={1}
                    value={editMaxStudents}
                    onChange={(e) => setEditMaxStudents(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200"
                  />
                  <span className="text-[10px] text-gray-400">
                    Currently: {showEditLimitsModal.usage?.studentsEnrolled || 0} enrolled
                  </span>
                </div>

                <div>
                  <label className="font-bold text-gray-700 block mb-1">Max Exams Quota</label>
                  <input
                    type="number"
                    min={1}
                    value={editMaxExams}
                    onChange={(e) => setEditMaxExams(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200"
                  />
                  <span className="text-[10px] text-gray-400">
                    Currently: {showEditLimitsModal.usage?.examsCreated || 0} created
                  </span>
                </div>
              </div>

              {/* Features */}
              <div>
                <label className="font-bold text-gray-700 block mb-2">Enabled Features</label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 p-2 rounded-lg border border-gray-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editPdfImport}
                      onChange={(e) => setEditPdfImport(e.target.checked)}
                    />
                    <span className="font-medium text-gray-700">Syllabus & PDF Paper Import</span>
                  </label>
                </div>

                <div>
                  <label className="font-bold text-gray-700 block mb-2">Competitive Exam Access</label>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {EXAM_ACCESS_OPTIONS.map((option) => (
                      <label key={option.value} className="flex items-center gap-2 rounded-lg border border-gray-200 p-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editExamTypes.includes(option.value)}
                          onChange={(e) => setEditExamTypes((current) => e.target.checked
                            ? [...current, option.value]
                            : current.filter((value) => value !== option.value))}
                        />
                        <span className="text-xs font-medium text-gray-700">{option.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="font-bold text-gray-700 block mb-2">Custom Test Question-Type Access</label>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {CUSTOM_QUESTION_TYPE_OPTIONS.map((option) => (
                      <label key={option.value} className="flex items-center gap-2 rounded-lg border border-gray-200 p-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editCustomQuestionTypes.includes(option.value)}
                          onChange={(e) => setEditCustomQuestionTypes((current) => e.target.checked
                            ? [...current, option.value]
                            : current.filter((value) => value !== option.value))}
                        />
                        <span className="text-xs font-medium text-gray-700">{option.label}</span>
                      </label>
                    ))}
                  </div>
                  <span className="mt-1 block text-[10px] text-gray-400">
                    These question types will be available only for Custom Tests.
                  </span>
                </div>
              </div>

              {/* Validity Expiry */}
              <div>
                <label className="font-bold text-gray-700 block mb-1">
                  Subscription Valid Until (Optional)
                </label>
                <input
                  type="date"
                  value={editValidUntil}
                  onChange={(e) => setEditValidUntil(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200"
                />
              </div>

              {/* Save Button */}
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowEditLimitsModal(null)}
                  className="px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveLimits}
                  disabled={savingLimits}
                  className="px-5 py-2 rounded-lg bg-[#2D3A4A] hover:bg-[#1e2a38] text-white font-medium shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {savingLimits && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{savingLimits ? "Saving..." : "Save Changes"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal 3: Reset Password ─── */}
      {showResetPasswordModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-sm">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-[#2D3A4A]" />
                <h3 className="text-sm font-bold text-[#45505F]">Reset Admin Password</h3>
              </div>
              <button
                onClick={() => setShowResetPasswordModal(null)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <p className="text-gray-500">
                Set a new login password for{" "}
                <strong className="text-gray-800">{showResetPasswordModal.name}</strong> (
                {showResetPasswordModal.email}):
              </p>

              <div>
                <label className="font-bold text-gray-700 block mb-1">New Password *</label>
                <input
                  type="text"
                  placeholder="Min 6 characters..."
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 font-mono"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowResetPasswordModal(null)}
                  className="px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleResetPassword}
                  disabled={resettingPassword || newPassword.length < 6}
                  className="px-4 py-2 rounded-lg bg-[#2D3A4A] text-white font-medium hover:bg-[#1e2a38] disabled:opacity-50 cursor-pointer"
                >
                  {resettingPassword ? "Updating..." : "Update Password"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
