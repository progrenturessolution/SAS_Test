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
  Eye,
  EyeOff,
  Copy,
  AlertTriangle,
} from "lucide-react"
import { toast } from "sonner"
import { formatDateDDMMYYYY } from "@/lib/utils"

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
  {
    value: "COMPETITIVE",
    label: "Competitive Test",
    description: "Access to AI Competitive Test Studio (NEET, JEE, MHT-CET, etc.)",
  },
  {
    value: "OTHER",
    label: "Other Exams",
    description: "Access to Other Competitive & Government Exams Studio",
  },
] as const

function normalizeExamTypes(rawTypes: string[] = []): string[] {
  const result: string[] = []
  const hasComp = rawTypes.some((t) =>
    ["COMPETITIVE", "NEET", "JEE_MAIN", "JEE_ADVANCED", "MHT_CET", "CBSE_BOARD"].includes(String(t).toUpperCase())
  )
  const hasOther = rawTypes.some((t) => ["OTHER", "OTHER_EXAMS"].includes(String(t).toUpperCase()))
  if (hasComp) result.push("COMPETITIVE")
  if (hasOther) result.push("OTHER")
  return result
}

const CUSTOM_QUESTION_TYPE_OPTIONS = [
  { value: "mcq", label: "MCQ" },
  { value: "assertion", label: "Assertion & Reason" },
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
  adminPassword?: string
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

  // 2-Step Delete Confirmation state
  const [deleteTarget, setDeleteTarget] = useState<Institute | null>(null)
  const [deleteStep, setDeleteStep] = useState<1 | 2>(1)
  const [deletingInstitute, setDeletingInstitute] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Registration Form state
  const [formName, setFormName] = useState("")
  const [formCode, setFormCode] = useState("")
  const [formEmail, setFormEmail] = useState("")
  const [formPassword, setFormPassword] = useState("")
  const [showFormPassword, setShowFormPassword] = useState(false)
  const [formPhone, setFormPhone] = useState("")
  const [formCity, setFormCity] = useState("")
  const [formContactPerson, setFormContactPerson] = useState("")
  const [formMaxStudents, setFormMaxStudents] = useState(100)
  const [formMaxExams, setFormMaxExams] = useState(20)
  const [formExamTypes, setFormExamTypes] = useState<string[]>(["COMPETITIVE", "OTHER"])
  const [formCustomQuestionTypes, setFormCustomQuestionTypes] = useState<string[]>(ALL_CUSTOM_QUESTION_TYPES)
  const [formPdfImport, setFormPdfImport] = useState(true)
  const [formValidUntil, setFormValidUntil] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState("")

  // Edit Organization state
  const [editName, setEditName] = useState("")
  const [editCode, setEditCode] = useState("")
  const [editEmail, setEditEmail] = useState("")
  const [editPhone, setEditPhone] = useState("")
  const [editCity, setEditCity] = useState("")
  const [editAddress, setEditAddress] = useState("")
  const [editContactPerson, setEditContactPerson] = useState("")
  const [editMaxStudents, setEditMaxStudents] = useState(100)
  const [editMaxExams, setEditMaxExams] = useState(20)
  const [editExamTypes, setEditExamTypes] = useState<string[]>([])
  const [editCustomQuestionTypes, setEditCustomQuestionTypes] = useState<string[]>(ALL_CUSTOM_QUESTION_TYPES)
  const [editPdfImport, setEditPdfImport] = useState(true)
  const [editValidUntil, setEditValidUntil] = useState("")
  const [editStatus, setEditStatus] = useState<"active" | "suspended">("active")
  const [editPassword, setEditPassword] = useState("")
  const [showEditPassword, setShowEditPassword] = useState(false)
  const [savingLimits, setSavingLimits] = useState(false)
  const [editError, setEditError] = useState("")

  // Password reset state
  const [newPassword, setNewPassword] = useState("")
  const [showResetPassword, setShowResetPassword] = useState(false)
  const [resettingPassword, setResettingPassword] = useState(false)
  const [showDetailPassword, setShowDetailPassword] = useState(false)

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

  // Close action menu when clicking anywhere on the screen
  useEffect(() => {
    if (!openActionMenu) return
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest("[data-institute-action-menu]")) {
        setOpenActionMenu(null)
      }
    }
    document.addEventListener("mousedown", handleOutsideClick)
    document.addEventListener("touchstart", handleOutsideClick, { passive: true })
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick)
      document.removeEventListener("touchstart", handleOutsideClick)
    }
  }, [openActionMenu])

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
            pdfImport: true,
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
      setShowFormPassword(false)
      setFormPhone("")
      setFormCity("")
      setFormContactPerson("")
      setFormMaxStudents(100)
      setFormMaxExams(20)
      setFormExamTypes(["COMPETITIVE", "OTHER"])
      setFormCustomQuestionTypes(ALL_CUSTOM_QUESTION_TYPES)
      setFormValidUntil("")
      await fetchInstitutes()
    } catch (err: any) {
      setFormError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // Open Edit Organization Modal
  const openEditLimits = (inst: Institute) => {
    setShowEditLimitsModal(inst)
    setEditName(inst.name || "")
    setEditCode(inst.code || "")
    setEditEmail(inst.email || "")
    setEditPhone(inst.phone || "")
    setEditCity(inst.city || "")
    setEditAddress(inst.address || "")
    setEditContactPerson(inst.contactPerson || "")
    setEditPassword("")
    setShowEditPassword(false)
    setEditMaxStudents(inst.limits?.maxStudents ?? 100)
    setEditMaxExams(inst.limits?.maxExams ?? 20)
    setEditExamTypes(normalizeExamTypes(inst.limits?.examTypes ?? []))
    setEditCustomQuestionTypes(inst.limits?.customQuestionTypes ?? ALL_CUSTOM_QUESTION_TYPES)
    setEditPdfImport(true)
    setEditStatus(inst.status === "suspended" ? "suspended" : "active")
    setEditValidUntil(
      inst.validUntil ? new Date(inst.validUntil).toISOString().split("T")[0] : ""
    )
    setEditError("")
  }

  // Handle Save Organization Changes
  const handleSaveLimits = async () => {
    if (!showEditLimitsModal) return
    setEditError("")

    if (!editName.trim()) {
      setEditError("Organization Name is required.")
      return
    }
    if (!editCode.trim()) {
      setEditError("Organization Code is required.")
      return
    }
    if (!editEmail.trim()) {
      setEditError("Login Email is required.")
      return
    }
    if (editPassword.trim() && editPassword.trim().length < 6) {
      setEditError("Password must be at least 6 characters long.")
      return
    }
    setSavingLimits(true)

    try {
      const payload: any = {
        name: editName.trim(),
        code: editCode.trim().toUpperCase(),
        email: editEmail.trim().toLowerCase(),
        phone: editPhone.trim(),
        city: editCity.trim(),
        address: editAddress.trim(),
        contactPerson: editContactPerson.trim(),
        status: editStatus,
        validUntil: editValidUntil || null,
        limits: {
          maxStudents: editMaxStudents,
          maxExams: editMaxExams,
          examTypes: editExamTypes,
          customQuestionTypes: editCustomQuestionTypes,
          features: {
            neetJeeGenerator: editExamTypes.includes("COMPETITIVE"),
            aiProctoring: true,
            pdfImport: true,
          },
        },
      }
      if (editPassword.trim()) {
        payload.password = editPassword.trim()
      }

      const res = await fetch(`/api/admin/institutes/${showEditLimitsModal._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (!res.ok) {
        setEditError(data.error || "Failed to update organization")
        return
      }

      setSuccessMessage(data.message || "Organization details updated successfully!")

      if (selectedInstitute && selectedInstitute._id === showEditLimitsModal._id) {
        setSelectedInstitute((prev) =>
          prev
            ? {
                ...prev,
                name: editName.trim(),
                code: editCode.trim().toUpperCase(),
                email: editEmail.trim().toLowerCase(),
                phone: editPhone.trim(),
                city: editCity.trim(),
                address: editAddress.trim(),
                contactPerson: editContactPerson.trim(),
                ...(editPassword.trim() ? { adminPassword: editPassword.trim() } : {}),
                status: editStatus,
                validUntil: editValidUntil || undefined,
                limits: {
                  ...prev.limits,
                  maxStudents: editMaxStudents,
                  maxExams: editMaxExams,
                  examTypes: editExamTypes,
                  customQuestionTypes: editCustomQuestionTypes,
                  features: {
                    ...prev.limits?.features,
                    neetJeeGenerator: editExamTypes.includes("COMPETITIVE"),
                    pdfImport: true,
                  },
                },
              }
            : null
        )
      }

      setShowEditLimitsModal(null)
      await fetchInstitutes()
    } catch (err: any) {
      setEditError(err.message || "Failed to update organization")
    } finally {
      setSavingLimits(false)
    }
  }

  // Handle Toggle Status
  const handleToggleStatus = async (inst: Institute) => {
    const nextStatus = inst.status === "active" ? "suspended" : "active"
    const confirmMsg =
      nextStatus === "suspended"
        ? `Are you sure you want to DEACTIVATE "${inst.name}"? Their teachers & students will be blocked from logging in.`
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

  const handleDeleteInstitute = (inst: Institute) => {
    setDeleteTarget(inst)
    setDeleteStep(1)
  }

  const confirmDeleteInstitute = async () => {
    if (!deleteTarget) return
    const inst = deleteTarget
    setDeletingInstitute(true)
    try {
      const res = await fetch(`/api/admin/institutes/${inst._id}`, { method: "DELETE" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to delete institute")

      setSelectedInstitute((current) => (current?._id === inst._id ? null : current))
      setDeleteTarget(null)
      setDeleteStep(1)
      await fetchInstitutes()

      // Show prominent success notification
      const msg = `Institute "${inst.name}" (${inst.code}) and all related records were successfully deleted.`
      toast.success(msg)
      setSuccessMessage(msg)
      setTimeout(() => setSuccessMessage(null), 8000)
    } catch (err: any) {
      toast.error(err.message || "Failed to delete institute")
      alert(err.message || "Failed to delete institute")
    } finally {
      setDeletingInstitute(false)
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

      toast.success(`Password successfully updated for ${showResetPasswordModal.name}!`)
      setInstitutes(prev => prev.map(inst => inst._id === showResetPasswordModal._id ? { ...inst, adminPassword: newPassword } : inst))
      setSelectedInstitute(current => current?._id === showResetPasswordModal._id ? { ...current, adminPassword: newPassword } : current)
      setShowResetPasswordModal(null)
      setNewPassword("")
      setShowResetPassword(false)
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
          <h1 className="text-2xl font-bold text-[#324158] flex items-center gap-2.5">
            <Building2 className="w-6 h-6 text-[#324158]" />
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

      {/* Prominent Success Message Banner after Deletion or Updates */}
      {successMessage && (
        <div className="flex items-center justify-between p-4 bg-emerald-50 border border-emerald-200/90 rounded-2xl shadow-xs text-emerald-900 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-emerald-950">Action Completed</p>
              <p className="text-xs text-emerald-800 font-medium mt-0.5">{successMessage}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="p-1.5 text-emerald-700 hover:text-emerald-900 hover:bg-emerald-100/60 rounded-xl transition-colors cursor-pointer"
            aria-label="Dismiss message"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 4 Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4.5 rounded-2xl bg-white border border-slate-200/90 shadow-xs hover:border-[#324158]/40 hover:shadow-sm transition-all">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-1.5">
            <span>Registered Organizations</span>
            <div className="w-8 h-8 rounded-xl bg-[#324158]/8 text-[#324158] flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-[#324158]">{totalInstitutesCount}</div>
          <span className="text-[11px] text-emerald-600 font-semibold mt-1 inline-block">
            {activeInstitutesCount} Active Centers
          </span>
        </div>

        <div className="p-4.5 rounded-2xl bg-white border border-slate-200/90 shadow-xs hover:border-[#324158]/40 hover:shadow-sm transition-all">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-1.5">
            <span>Active Organizations</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-[#324158]">{activeInstitutesCount}</div>
          <span className="text-[11px] text-slate-500 font-medium mt-1 inline-block">
            {totalInstitutesCount - activeInstitutesCount} Deactivated
          </span>
        </div>

        <div className="p-4.5 rounded-2xl bg-white border border-slate-200/90 shadow-xs hover:border-[#324158]/40 hover:shadow-sm transition-all">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-1.5">
            <span>Total Students Enrolled</span>
            <div className="w-8 h-8 rounded-xl bg-[#324158]/8 text-[#324158] flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-[#324158]">{totalPlatformStudents}</div>
          <span className="text-[11px] text-slate-400 font-medium mt-1 inline-block">Across all organization batches</span>
        </div>

        <div className="p-4.5 rounded-2xl bg-white border border-slate-200/90 shadow-xs hover:border-[#324158]/40 hover:shadow-sm transition-all">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-1.5">
            <span>Total Exams Conducted</span>
            <div className="w-8 h-8 rounded-xl bg-[#324158]/8 text-[#324158] flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-[#324158]">{totalPlatformExams}</div>
          <span className="text-[11px] text-slate-400 font-medium mt-1 inline-block">NEET, JEE & Custom Tests</span>
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
              {st === "all" ? "All" : st === "active" ? "Active" : "Deactivated"}
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
          <Loader2 className="w-6 h-6 animate-spin mb-2 text-[#324158]" />
          <span className="text-xs">Loading organizations...</span>
        </div>
      ) : filteredInstitutes.length === 0 ? (
        <div className="py-16 text-center rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/50 flex flex-col items-center justify-center">
          <Building2 className="w-10 h-10 text-gray-300 mb-3" />
          <h3 className="text-sm font-bold text-[#324158] mb-1">No Organizations Found</h3>
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
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filteredInstitutes.map((inst) => {
            const studentPct = Math.min(Math.round(((inst.usage?.studentsEnrolled || 0) / (inst.limits?.maxStudents || 100)) * 100), 100)
            const examPct = Math.min(Math.round(((inst.usage?.examsCreated || 0) / (inst.limits?.maxExams || 20)) * 100), 100)
            const allowedTypes = normalizeExamTypes(inst.limits?.examTypes || [])

            return (
              <article
                key={inst._id}
                onClick={() => setSelectedInstitute(inst)}
                className="group relative cursor-pointer rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs transition-all duration-200 hover:-translate-y-1 hover:border-[#324158]/50 hover:shadow-lg flex flex-col justify-between"
              >
                <div>
                  {/* Top Row: Avatar, Name, and Action Menu */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#324158] text-white text-lg font-bold shadow-xs">
                        {inst.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <h3 className="truncate text-base font-bold text-[#324158] group-hover:text-[#1e2a38] transition-colors">
                          {inst.name}
                        </h3>
                        <p className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-500 truncate">
                          <MapPin className="h-3 w-3 shrink-0 text-slate-400" />
                          <span>{inst.city || "Location not added"}</span>
                        </p>
                      </div>
                    </div>

                    <div className="relative shrink-0" data-institute-action-menu="true" onClick={(event) => event.stopPropagation()}>
                      <button
                        type="button"
                        aria-label={`Actions for ${inst.name}`}
                        onClick={() => setOpenActionMenu(openActionMenu === inst._id ? null : inst._id)}
                        className="rounded-xl p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-[#324158] cursor-pointer"
                      >
                        <MoreVertical className="h-5 w-5" />
                      </button>
                      {openActionMenu === inst._id && (
                        <>
                          {/* Invisible full-screen backdrop to dismiss menu on any screen click */}
                          <div
                            className="fixed inset-0 z-10 cursor-default"
                            onClick={(e) => {
                              e.stopPropagation()
                              setOpenActionMenu(null)
                            }}
                          />
                          <div className="absolute right-0 top-9 z-20 w-52 rounded-xl border border-slate-200 bg-white p-1.5 text-left shadow-xl animate-in fade-in zoom-in-95 duration-100">
                            <button
                              type="button"
                              onClick={() => {
                                setOpenActionMenu(null)
                                setSelectedInstitute(inst)
                              }}
                              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-[#eaf0f8] hover:text-[#324158] cursor-pointer transition-colors"
                            >
                              <Eye className="h-3.5 w-3.5 text-[#324158]" /> View details
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setOpenActionMenu(null)
                                openEditLimits(inst)
                              }}
                              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 hover:bg-[#eaf0f8] hover:text-[#324158] cursor-pointer transition-colors"
                            >
                              <Sliders className="h-3.5 w-3.5 text-[#324158]" /> Edit Organization
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setOpenActionMenu(null)
                                setShowResetPasswordModal(inst)
                                setNewPassword("")
                              }}
                              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 hover:bg-[#eaf0f8] hover:text-[#324158] cursor-pointer transition-colors"
                            >
                              <KeyRound className="h-3.5 w-3.5 text-[#324158]" /> Reset password
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setOpenActionMenu(null)
                                handleToggleStatus(inst)
                              }}
                              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 hover:bg-[#eaf0f8] hover:text-[#324158] cursor-pointer transition-colors"
                            >
                              {inst.status === "active" ? (
                                <XCircle className="h-3.5 w-3.5 text-[#324158]" />
                              ) : (
                                <CheckCircle2 className="h-3.5 w-3.5 text-[#324158]" />
                              )}
                              {inst.status === "active" ? "Deactivate institute" : "Activate institute"}
                            </button>
                            <div className="my-1 border-t border-slate-100" />
                            <button
                              type="button"
                              onClick={() => {
                                setOpenActionMenu(null)
                                handleDeleteInstitute(inst)
                              }}
                              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5 text-rose-500" /> Delete institute
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Second Row: Code, Status & Validity Badges */}
                  <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
                    <span className="rounded-md border border-[#324158]/15 bg-[#324158]/5 px-2 py-0.5 font-mono text-[10px] font-bold text-[#324158]">
                      {inst.code}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                        inst.status === "active"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-rose-200 bg-rose-50 text-rose-700"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          inst.status === "active" ? "bg-emerald-500" : "bg-rose-500"
                        }`}
                      />
                      {inst.status === "active" ? "Active" : "Deactivated"}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                      <Calendar size={11} className="text-slate-400" />
                      <span>{inst.validUntil ? `Valid: ${formatDateDDMMYYYY(inst.validUntil)}` : "Lifetime"}</span>
                    </span>
                  </div>

                  {/* Usage Quota Meters Box */}
                  <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Students</p>
                          <span className="text-[10px] font-semibold text-slate-500">{studentPct}%</span>
                        </div>
                        <p className="mt-0.5 text-sm font-bold text-[#324158]">
                          {inst.usage?.studentsEnrolled || 0}{" "}
                          <span className="text-[11px] font-normal text-slate-400">
                            / {inst.limits?.maxStudents ?? 100}
                          </span>
                        </p>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200">
                          <div
                            className={`h-full rounded-full transition-all ${
                              studentPct >= 90 ? "bg-rose-500" : studentPct >= 70 ? "bg-amber-500" : "bg-[#324158]"
                            }`}
                            style={{ width: `${studentPct}%` }}
                          />
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Exams</p>
                          <span className="text-[10px] font-semibold text-slate-500">{examPct}%</span>
                        </div>
                        <p className="mt-0.5 text-sm font-bold text-[#324158]">
                          {inst.usage?.examsCreated || 0}{" "}
                          <span className="text-[11px] font-normal text-slate-400">
                            / {inst.limits?.maxExams ?? 20}
                          </span>
                        </p>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200">
                          <div
                            className={`h-full rounded-full transition-all ${
                              examPct >= 90 ? "bg-rose-500" : examPct >= 70 ? "bg-amber-500" : "bg-emerald-600"
                            }`}
                            style={{ width: `${examPct}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Permissions preview */}
                    {allowedTypes.length > 0 && (
                      <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex flex-wrap gap-1">
                        {allowedTypes.map((t) => (
                          <span
                            key={t}
                            className="px-1.5 py-0.5 rounded text-[9px] font-semibold tracking-wide uppercase bg-white border border-slate-200 text-[#324158]"
                          >
                            {t === "COMPETITIVE" ? "Competitive" : t === "OTHER" ? "Other Exams" : "Exam"}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Contact Info */}
                  <div className="mt-3.5 space-y-1.5 text-[11px] text-slate-600">
                    <p className="flex items-center gap-2 truncate">
                      <Mail className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <span className="truncate">{inst.email}</span>
                    </p>
                    {inst.phone && (
                      <p className="flex items-center gap-2 truncate">
                        <Phone className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                        <span>{inst.phone}</span>
                      </p>
                    )}
                  </div>
                </div>
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
                          <div className="w-9 h-9 rounded-lg bg-gray-100 text-[#324158] font-bold flex items-center justify-center shrink-0 border border-gray-200">
                            {inst.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-[#324158] text-sm flex items-center gap-1.5">
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
                                  studentPct >= 90 ? "text-red-600" : "text-[#324158]"
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
                                  examPct >= 90 ? "text-red-600" : "text-[#324158]"
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
                          {inst.status === "active" ? "Active" : "Deactivated"}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedInstitute(inst)}
                            title="View details"
                            className="p-1.5 rounded-lg border border-gray-200 text-[#324158] hover:bg-[#eaf0f8] cursor-pointer transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5 text-[#324158]" />
                          </button>

                          <button
                            onClick={() => openEditLimits(inst)}
                            title="Edit Organization"
                            className="p-1.5 rounded-lg border border-gray-200 text-[#324158] hover:bg-[#eaf0f8] cursor-pointer transition-colors"
                          >
                            <Sliders className="w-3.5 h-3.5 text-[#324158]" />
                          </button>

                          <button
                            onClick={() => {
                              setShowResetPasswordModal(inst)
                              setNewPassword("")
                            }}
                            title="Reset Password"
                            className="p-1.5 rounded-lg border border-gray-200 text-[#324158] hover:bg-[#eaf0f8] cursor-pointer transition-colors"
                          >
                            <KeyRound className="w-3.5 h-3.5 text-[#324158]" />
                          </button>

                          <button
                            onClick={() => handleToggleStatus(inst)}
                            title={inst.status === "active" ? "Deactivate Institute" : "Activate Institute"}
                            className={`px-2 py-1 rounded-lg text-[11px] font-medium border cursor-pointer transition-colors ${
                              inst.status === "active"
                                ? "border-amber-200 text-amber-700 hover:bg-amber-50"
                                : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                            }`}
                          >
                            {inst.status === "active" ? "Deactivate" : "Activate"}
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
            <div className="flex items-start justify-between border-b border-slate-100 p-5 bg-white">
              <div className="flex items-center gap-3.5">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#324158] text-xl font-bold text-white shadow-xs">
                  {selectedInstitute.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-[#324158]">{selectedInstitute.name}</h2>
                  <p className="mt-0.5 text-xs text-slate-500">Institute code: <span className="font-mono font-semibold text-[#324158] bg-[#324158]/5 px-2 py-0.5 rounded border border-[#324158]/15">{selectedInstitute.code}</span></p>
                </div>
              </div>
              <button type="button" onClick={() => setSelectedInstitute(null)} aria-label="Close institute details" className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200/90 bg-white p-4.5 shadow-xs">
                <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">Contact details</p>
                <div className="space-y-2.5 text-xs text-slate-700">
                  <p className="flex items-start gap-2.5"><Mail className="mt-0.5 h-4 w-4 shrink-0 text-[#324158]" /> <span className="font-medium text-slate-800">{selectedInstitute.email}</span></p>
                  {selectedInstitute.phone && <p className="flex items-start gap-2.5"><Phone className="mt-0.5 h-4 w-4 shrink-0 text-[#324158]" /> <span className="font-medium text-slate-800">{selectedInstitute.phone}</span></p>}
                  {selectedInstitute.contactPerson && <p className="flex items-start gap-2.5"><Users className="mt-0.5 h-4 w-4 shrink-0 text-[#324158]" /> <span className="font-medium text-slate-800">{selectedInstitute.contactPerson}</span></p>}
                  {selectedInstitute.city && <p className="flex items-start gap-2.5"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#324158]" /> <span className="font-medium text-slate-800">{selectedInstitute.city}</span></p>}
                  {selectedInstitute.address && <p className="flex items-start gap-2.5"><Building2 className="mt-0.5 h-4 w-4 shrink-0 text-[#324158]" /> <span className="font-medium text-slate-800">{selectedInstitute.address}</span></p>}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200/90 bg-white p-4.5 shadow-xs">
                <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">Account status</p>
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${selectedInstitute.status === "active" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${selectedInstitute.status === "active" ? "bg-emerald-500" : "bg-red-500"}`} />
                  {selectedInstitute.status === "active" ? "Active" : "Deactivated"}
                </span>
                <p className="mt-4 text-xs font-medium text-slate-500">Subscription Valid Until</p>
                <p className="mt-1 text-sm font-bold text-[#324158]">{formatDateDDMMYYYY(selectedInstitute.validUntil)}</p>
                <p className="mt-4 text-xs font-medium text-slate-500">Registered on</p>
                <p className="mt-1 text-sm font-bold text-[#324158]">{formatDateDDMMYYYY(selectedInstitute.createdAt)}</p>
              </div>

              {/* Portal Login Credentials */}
              <div className="rounded-2xl border border-slate-200/90 bg-gradient-to-b from-[#f8fafc] to-[#eaf0f8]/40 p-4.5 sm:col-span-2 shadow-xs">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <KeyRound className="h-4 w-4 text-[#324158]" />
                    <p className="text-[11px] font-bold uppercase tracking-wider text-[#324158]">
                      Portal Login Credentials
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowResetPasswordModal(selectedInstitute)
                      setNewPassword("")
                      setShowResetPassword(false)
                    }}
                    className="text-[11px] font-bold text-[#324158] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    Reset Password
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {/* Email */}
                  <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Login Email / Username
                    </p>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-semibold text-slate-800 truncate select-all">
                        {selectedInstitute.email}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(selectedInstitute.email)
                          toast.success("Login email copied to clipboard!")
                        }}
                        className="text-slate-400 hover:text-[#324158] p-1 rounded transition-colors cursor-pointer"
                        title="Copy Email"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Password */}
                  <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Portal Password
                    </p>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-semibold text-slate-800 select-all">
                        {selectedInstitute.adminPassword ? (
                          showDetailPassword ? selectedInstitute.adminPassword : "••••••••••••"
                        ) : (
                          <span className="text-slate-400 font-normal italic">
                            •••••••• (Reset password to reveal)
                          </span>
                        )}
                      </span>
                      <div className="flex items-center gap-1">
                        {selectedInstitute.adminPassword && (
                          <button
                            type="button"
                            onClick={() => setShowDetailPassword((prev) => !prev)}
                            className="p-1 rounded text-slate-400 hover:text-[#324158] transition-colors cursor-pointer"
                            title={showDetailPassword ? "Hide password" : "Show password"}
                          >
                            {showDetailPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5 text-[#324158]" />}
                          </button>
                        )}
                        {selectedInstitute.adminPassword && (
                          <button
                            type="button"
                            onClick={() => {
                              if (selectedInstitute.adminPassword) {
                                navigator.clipboard.writeText(selectedInstitute.adminPassword)
                                toast.success("Password copied to clipboard!")
                              }
                            }}
                            className="p-1 rounded text-slate-400 hover:text-[#324158] transition-colors cursor-pointer"
                            title="Copy Password"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200/90 bg-white p-4.5 sm:col-span-2 shadow-xs">
                <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">Usage and quotas</p>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-100"><p className="text-xs text-slate-500 font-medium">Students</p><p className="mt-1 text-lg font-bold text-[#324158]">{selectedInstitute.usage?.studentsEnrolled || 0} <span className="text-xs font-normal text-slate-400">/ {selectedInstitute.limits?.maxStudents ?? 100}</span></p></div>
                  <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-100"><p className="text-xs text-slate-500 font-medium">Exams</p><p className="mt-1 text-lg font-bold text-[#324158]">{selectedInstitute.usage?.examsCreated || 0} <span className="text-xs font-normal text-slate-400">/ {selectedInstitute.limits?.maxExams ?? 20}</span></p></div>
                  <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-100"><p className="text-xs text-slate-500 font-medium">Student limit</p><p className="mt-1 text-lg font-bold text-[#324158]">{selectedInstitute.limits?.maxStudents ?? 100}</p></div>
                  <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-100"><p className="text-xs text-slate-500 font-medium">Exam limit</p><p className="mt-1 text-lg font-bold text-[#324158]">{selectedInstitute.limits?.maxExams ?? 20}</p></div>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200/90 bg-white p-4.5 sm:col-span-2 shadow-xs">
                <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">Enabled features</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    ["PDF Import", selectedInstitute.limits?.features?.pdfImport],
                  ].map(([label, enabled]) => (
                    <span key={String(label)} className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${enabled ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-100 text-slate-400"}`}>
                      {enabled ? "Enabled" : "Disabled"} · {String(label)}
                    </span>
                  ))}
                </div>
                <p className="mb-2 mt-4 text-[11px] font-bold uppercase tracking-wider text-slate-400">Allowed Exam Creation</p>
                <div className="flex flex-wrap gap-2">
                  {normalizeExamTypes(selectedInstitute.limits?.examTypes || []).map((type) => (
                    <span key={type} className="rounded-full border border-[#324158]/20 bg-[#324158]/5 px-2.5 py-1 text-[11px] font-bold text-[#324158]">
                      {type === "COMPETITIVE" ? "Competitive Test" : "Other Exams"}
                    </span>
                  ))}
                  {normalizeExamTypes(selectedInstitute.limits?.examTypes || []).length === 0 && (
                    <span className="text-xs text-slate-400">No exam creation access granted</span>
                  )}
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
                  <h3 className="text-sm font-bold text-[#324158]">Register Coaching Institute</h3>
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
                  <div className="relative">
                    <input
                      type={showFormPassword ? "text" : "password"}
                      required
                      minLength={6}
                      placeholder="••••••••"
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                      className="w-full px-3 py-2 pr-10 rounded-lg border border-gray-200 focus:outline-none focus:border-[#2D3A4A]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowFormPassword((prev) => !prev)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                      title={showFormPassword ? "Hide password" : "Show password"}
                      aria-label={showFormPassword ? "Hide password" : "Show password"}
                    >
                      {showFormPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
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
                <span className="font-bold text-[#324158] block">
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

                <div>
                  <span className="font-semibold text-gray-700 block mb-1.5">
                    Exam Creation Access
                  </span>
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    {EXAM_ACCESS_OPTIONS.map((option) => {
                      const isChecked = formExamTypes.includes(option.value)
                      return (
                        <label
                          key={option.value}
                          className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-all ${
                            isChecked
                              ? "border-[#2D3A4A] bg-[#2D3A4A]/5 shadow-xs"
                              : "border-gray-200 bg-white hover:bg-gray-50"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) =>
                              setFormExamTypes((current) =>
                                e.target.checked
                                  ? [...current, option.value]
                                  : current.filter((value) => value !== option.value)
                              )
                            }
                            className="mt-0.5 rounded text-[#324158]"
                          />
                          <div className="flex-1">
                            <span className="text-xs font-semibold text-gray-800 block">{option.label}</span>
                            <span className="text-[11px] text-gray-500 block leading-tight mt-0.5">{option.description}</span>
                          </div>
                        </label>
                      )
                    })}
                  </div>
                  <span className="mt-1.5 block text-[10px] text-gray-400">
                    Select which test creation modules this institute can access. Unchecked options will remain visible but disabled.
                  </span>
                </div>

                {/* Validity Expiry */}
                <div>
                  <label className="font-semibold text-gray-700 block mb-1">
                    Subscription Valid Until (Optional)
                  </label>
                  <input
                    type="date"
                    value={formValidUntil}
                    onChange={(e) => setFormValidUntil(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white focus:outline-none focus:border-[#2D3A4A]"
                  />
                  <span className="text-[10px] text-gray-400 mt-1 block">
                    Leave blank for unlimited validity
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

      {/* ─── Modal 2: Edit Organization ─── */}
      {showEditLimitsModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-gray-100 shrink-0">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-[#324158]">
                  Edit Organization: {showEditLimitsModal.name}
                </h3>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Update profile, login credentials, quota limits, and access permissions
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowEditLimitsModal(null)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer p-1 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body (Scrollable) */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs">
              {/* Error Message */}
              {editError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{editError}</span>
                </div>
              )}

              {/* ── 1. Basic Details ── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-gray-700 block mb-1">
                    Organization Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Apex Science Academy"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:border-[#324158] font-medium"
                  />
                </div>

                <div>
                  <label className="font-bold text-gray-700 block mb-1">
                    Unique Code (Prefix) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. APEX01"
                    value={editCode}
                    onChange={(e) => setEditCode(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 uppercase font-mono focus:outline-none focus:border-[#324158] font-bold"
                  />
                </div>
              </div>

              {/* ── 2. Login Credentials ── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-gray-700 block mb-1">
                    Login Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="admin@apexacademy.com"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:border-[#324158] font-medium"
                  />
                </div>

                <div>
                  <label className="font-bold text-gray-700 block mb-1">
                    Change Password{" "}
                    <span className="text-[10px] font-normal text-gray-400">
                      (Leave blank to keep existing)
                    </span>
                  </label>
                  <div className="relative">
                    <input
                      type={showEditPassword ? "text" : "password"}
                      value={editPassword}
                      onChange={(e) => setEditPassword(e.target.value)}
                      placeholder="Enter new portal password"
                      className="w-full px-3 py-2 pr-10 rounded-lg border border-gray-200 bg-white font-medium focus:outline-none focus:border-[#324158]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowEditPassword(!showEditPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#324158] cursor-pointer"
                      title={showEditPassword ? "Hide password" : "Show password"}
                    >
                      {showEditPassword ? (
                        <EyeOff className="w-4 h-4 text-[#324158]" />
                      ) : (
                        <Eye className="w-4 h-4 text-[#324158]" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* ── 3. Contact & Location ── */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-medium text-gray-700 block mb-1">Contact Person</label>
                  <input
                    type="text"
                    placeholder="e.g. Dr. Rajesh Sharma"
                    value={editContactPerson}
                    onChange={(e) => setEditContactPerson(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:border-[#324158]"
                  />
                </div>

                <div>
                  <label className="font-medium text-gray-700 block mb-1">Phone Number</label>
                  <input
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:border-[#324158]"
                  />
                </div>

                <div>
                  <label className="font-medium text-gray-700 block mb-1">City / Region</label>
                  <input
                    type="text"
                    placeholder="e.g. Pune / Mumbai"
                    value={editCity}
                    onChange={(e) => setEditCity(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:border-[#324158]"
                  />
                </div>
              </div>

              {/* Address */}
              <div>
                <label className="font-medium text-gray-700 block mb-1">Address (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. 402, Knowledge Park, Senapati Bapat Road"
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:border-[#324158]"
                />
              </div>

              {/* ── 4. Status & Subscription Expiry ── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Account Status</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white font-medium focus:outline-none focus:border-[#324158]"
                  >
                    <option value="active">Active (Access Allowed)</option>
                    <option value="suspended">Deactivated (Access Blocked)</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-gray-700 block mb-1">
                    Subscription Valid Until (Optional)
                  </label>
                  <input
                    type="date"
                    value={editValidUntil}
                    onChange={(e) => setEditValidUntil(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:border-[#324158]"
                  />
                </div>
              </div>

              {/* ── 5. Quota Limits ── */}
              <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 space-y-3">
                <span className="font-bold text-[#324158] block">
                  Quota Limits & Access Configuration
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-gray-700 block mb-1">Max Student Quota</label>
                    <input
                      type="number"
                      min={1}
                      value={editMaxStudents}
                      onChange={(e) => setEditMaxStudents(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white focus:outline-none focus:border-[#324158]"
                    />
                    <span className="text-[10px] text-gray-400">
                      Currently: {showEditLimitsModal.usage?.studentsEnrolled || 0} enrolled
                    </span>
                  </div>

                  <div>
                    <label className="font-semibold text-gray-700 block mb-1">Max Exams Quota</label>
                    <input
                      type="number"
                      min={1}
                      value={editMaxExams}
                      onChange={(e) => setEditMaxExams(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white focus:outline-none focus:border-[#324158]"
                    />
                    <span className="text-[10px] text-gray-400">
                      Currently: {showEditLimitsModal.usage?.examsCreated || 0} created
                    </span>
                  </div>
                </div>

                {/* Exam Creation Access */}
                <div>
                  <label className="font-semibold text-gray-700 block mb-1.5">
                    Exam Creation Access
                  </label>
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    {EXAM_ACCESS_OPTIONS.map((option) => {
                      const isChecked = editExamTypes.includes(option.value)
                      return (
                        <label
                          key={option.value}
                          className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-all ${
                            isChecked
                              ? "border-[#324158] bg-[#324158]/5 shadow-xs"
                              : "border-gray-200 bg-white hover:bg-gray-50"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) =>
                              setEditExamTypes((current) =>
                                e.target.checked
                                  ? [...current, option.value]
                                  : current.filter((value) => value !== option.value)
                              )
                            }
                            className="mt-0.5 rounded text-[#324158]"
                          />
                          <div className="flex-1">
                            <span className="text-xs font-semibold text-gray-800 block">
                              {option.label}
                            </span>
                            <span className="text-[11px] text-gray-500 block leading-tight mt-0.5">
                              {option.description}
                            </span>
                          </div>
                        </label>
                      )
                    })}
                  </div>
                  <span className="mt-1.5 block text-[10px] text-gray-400">
                    Control which test creation modules this institute can access. Unchecked options will remain visible but disabled.
                  </span>
                </div>

                {/* Question Types Access */}
                <div>
                  <label className="font-semibold text-gray-700 block mb-1.5">
                    Permitted Question Types
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {CUSTOM_QUESTION_TYPE_OPTIONS.map((qType) => {
                      const isChecked = editCustomQuestionTypes.includes(qType.value)
                      return (
                        <label
                          key={qType.value}
                          className={`flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer transition-all ${
                            isChecked
                              ? "border-[#324158] bg-[#324158]/5 font-semibold text-slate-900"
                              : "border-gray-200 bg-white text-slate-600 hover:bg-gray-50"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) =>
                              setEditCustomQuestionTypes((current) =>
                                e.target.checked
                                  ? [...current, qType.value]
                                  : current.filter((v) => v !== qType.value)
                              )
                            }
                            className="rounded text-[#324158]"
                          />
                          <span className="text-xs">{qType.label}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 border-t border-gray-100 flex items-center justify-end gap-2.5 shrink-0 bg-gray-50/50">
              <button
                type="button"
                onClick={() => setShowEditLimitsModal(null)}
                className="px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 cursor-pointer font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveLimits}
                disabled={savingLimits}
                className="px-5 py-2 rounded-lg bg-[#324158] hover:bg-[#1e2a38] text-white font-medium shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50 transition-colors"
              >
                {savingLimits && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{savingLimits ? "Saving Changes..." : "Update Organization"}</span>
              </button>
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
                <KeyRound className="w-4 h-4 text-[#324158]" />
                <h3 className="text-sm font-bold text-[#324158]">Reset Admin Password</h3>
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
                <div className="relative">
                  <input
                    type={showResetPassword ? "text" : "password"}
                    placeholder="Min 6 characters..."
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2 pr-10 rounded-lg border border-gray-200 font-mono text-xs focus:outline-none focus:border-[#2D3A4A]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPassword((prev) => !prev)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                    title={showResetPassword ? "Hide password" : "Show password"}
                    aria-label={showResetPassword ? "Hide password" : "Show password"}
                  >
                    {showResetPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
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

      {/* ─── Modal 4: 2-Step Permanent Delete Confirmation ─── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl border border-rose-200/80 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-6 border-b border-rose-100 bg-rose-50/50">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 shadow-xs">
                    {deleteStep === 1 ? <Trash2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5 text-rose-600" />}
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-700">
                      Step {deleteStep} of 2 Confirmation
                    </span>
                    <h3 className="text-base font-bold text-slate-900 mt-1">
                      {deleteStep === 1 ? "Delete Organization?" : "Final Permanent Warning"}
                    </h3>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!deletingInstitute) {
                      setDeleteTarget(null)
                      setDeleteStep(1)
                    }
                  }}
                  className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 text-xs">
              {deleteStep === 1 ? (
                <>
                  <p className="text-slate-600 text-sm leading-relaxed">
                    Are you sure you want to delete <strong className="text-slate-900 font-bold">{deleteTarget.name}</strong> (<span className="font-mono text-slate-700 font-semibold">{deleteTarget.code}</span>)?
                  </p>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-1.5 text-slate-600">
                    <p className="font-semibold text-slate-800">Please Note:</p>
                    <p>• Organization admin login will be revoked immediately.</p>
                    <p>• You will be asked for a second and final confirmation before any data is permanently erased.</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-4 space-y-2.5 text-rose-900">
                    <p className="font-bold text-sm text-rose-950 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>This action CANNOT be undone!</span>
                    </p>
                    <p className="leading-relaxed text-rose-800">
                      Deleting <strong className="font-bold">{deleteTarget.name}</strong> will <strong>permanently destroy</strong> all data associated with it:
                    </p>
                    <ul className="list-disc list-inside space-y-1 font-semibold text-rose-900 text-[11px] pl-1">
                      <li>All exams, tests, and question papers</li>
                      <li>All enrolled student accounts and credentials</li>
                      <li>All student test attempts, scores, and analytics</li>
                      <li>All proctoring logs and activity history</li>
                    </ul>
                  </div>
                  <p className="text-slate-500 text-[11px] leading-relaxed">
                    Click below only if you are 100% sure you want to permanently delete this organization and all its data.
                  </p>
                </>
              )}

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-100">
                {deleteStep === 1 ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(null)}
                      className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 transition-colors cursor-pointer text-xs"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteStep(2)}
                      className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold transition-colors cursor-pointer text-xs flex items-center gap-1.5 shadow-sm"
                    >
                      <span>Proceed to Final Warning</span>
                      <span>→</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled={deletingInstitute}
                      onClick={() => setDeleteStep(1)}
                      className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 transition-colors cursor-pointer text-xs disabled:opacity-50"
                    >
                      ← Back
                    </button>
                    <button
                      type="button"
                      disabled={deletingInstitute}
                      onClick={confirmDeleteInstitute}
                      className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold transition-all cursor-pointer text-xs flex items-center gap-2 shadow-sm disabled:opacity-60"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{deletingInstitute ? "Deleting permanently..." : "Confirm & Delete Permanently"}</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
