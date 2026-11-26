"use client"

import { useEffect, useState, useMemo, useRef, useCallback } from "react"
import { createPortal } from "react-dom"
import Link from "next/link"
import {
  Search,
  X,
  UserPlus,
  MoreVertical,
  User,
  Mail,
  Phone,
  CreditCard,
  Calendar,
  Award,
  Edit3,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  BookOpen,
  KeyRound,
  ShieldCheck,
  UserX,
  UserCheck,
  ShieldAlert,
  Lock,
  Eye,
  EyeOff,
  Users,
  FileSpreadsheet,
  Upload,
  Download,
} from "lucide-react"
import * as XLSX from "xlsx"
import { AdminListSkeleton } from "@/components/SkeletonLoaders"
import { Toaster } from "@/components/ui/toaster"
import { toast } from "sonner"

interface Student {
  _id: string
  studentName: string
  email: string
  rollNumber: string
  phone?: string
  batch?: string
  totalFees?: number
  completedFees?: number
  pendingFees?: number
  status?: "active" | "deactivated"
  isActive?: boolean
  deactivationReason?: string
  examPassword?: string
  createdAt?: string
  totalAttempts: number
  lastAttempt: string
  avgPercentage?: number
}

interface ParsedExcelStudentRow {
  rowNumber: number
  name: string
  email: string
  rollNumber: string
  password: string
  phone: string
  batch: string
  totalFees: number
  completedFees: number
  error?: string
}

interface BulkUploadSummary {
  createdCount: number
  skippedCount: number
  skippedRows: {
    rowNumber: number
    name: string
    email: string
    rollNumber: string
    reason: string
  }[]
}

interface StudentActionMenuProps {
  student: Student
  isDeactivated: boolean
  isOpen: boolean
  activating: boolean
  deleting: boolean
  ariaLabel?: string
  onToggle: () => void
  onClose: () => void
  onViewProfile: () => void
  onEdit: () => void
  onActivate: () => void
  onDeactivate: () => void
  onDelete: () => void
}

function StudentActionMenu({
  isDeactivated,
  isOpen,
  activating,
  deleting,
  ariaLabel = "More options",
  onToggle,
  onClose,
  onViewProfile,
  onEdit,
  onActivate,
  onDeactivate,
  onDelete,
}: StudentActionMenuProps) {
  const [mounted, setMounted] = useState(false)
  const [menuPos, setMenuPos] = useState<{ top?: number; bottom?: number; left: number; maxHeight: number } | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()

    // Skip invisible/display:none trigger elements so a hidden mobile/desktop copy never opens a portal at (0,0)
    if (rect.width === 0 || rect.height === 0) {
      setMenuPos(null)
      return
    }

    const viewportHeight = window.innerHeight
    const viewportWidth = window.innerWidth

    if (rect.bottom < 0 || rect.top > viewportHeight) {
      onClose()
      return
    }

    const menuWidth = 192 // w-48
    const estimatedHeight = 205
    let left = rect.right - menuWidth
    if (left < 8) left = 8
    if (left + menuWidth > viewportWidth - 8) {
      left = Math.max(8, viewportWidth - menuWidth - 8)
    }

    const spaceBelow = viewportHeight - rect.bottom
    const spaceAbove = rect.top

    if (spaceBelow < estimatedHeight && spaceAbove > spaceBelow) {
      setMenuPos({
        top: undefined,
        bottom: viewportHeight - rect.top + 6,
        left,
        maxHeight: Math.max(150, spaceAbove - 16),
      })
    } else {
      setMenuPos({
        top: rect.bottom + 6,
        bottom: undefined,
        left,
        maxHeight: Math.max(150, spaceBelow - 16),
      })
    }
  }, [onClose])

  useEffect(() => {
    if (!isOpen) {
      setMenuPos(null)
      return
    }
    updatePosition()

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node
      if (
        menuRef.current &&
        !menuRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        onClose()
      }
    }

    const handleScrollOrResize = () => updatePosition()

    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("touchstart", handleClickOutside, { passive: true })
    document.addEventListener("scroll", handleScrollOrResize, { capture: true, passive: true })
    window.addEventListener("resize", handleScrollOrResize, { passive: true })

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("touchstart", handleClickOutside)
      document.removeEventListener("scroll", handleScrollOrResize, { capture: true })
      window.removeEventListener("resize", handleScrollOrResize)
    }
  }, [isOpen, updatePosition, onClose])

  return (
    <div className="relative inline-block text-left">
      <button
        ref={triggerRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          if (!isOpen) updatePosition()
          onToggle()
        }}
        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
        title={ariaLabel}
        aria-label={ariaLabel}
        aria-expanded={isOpen}
      >
        <MoreVertical size={16} />
      </button>

      {mounted &&
        isOpen &&
        menuPos &&
        createPortal(
          <div
            ref={menuRef}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "fixed",
              left: `${menuPos.left}px`,
              ...(menuPos.top !== undefined ? { top: `${menuPos.top}px` } : { bottom: `${menuPos.bottom}px` }),
              maxHeight: `${menuPos.maxHeight}px`,
            }}
            className="w-48 overflow-y-auto rounded-xl bg-white border border-gray-200 shadow-xl py-1 z-[9999] focus:outline-none animate-in fade-in zoom-in-95 duration-100"
          >
            <button
              type="button"
              onClick={onViewProfile}
              className="w-full px-3.5 py-2 text-left text-xs font-semibold text-gray-700 hover:bg-[#eaf0f8] hover:text-[#324158] flex items-center gap-2 cursor-pointer transition-colors"
            >
              <User size={14} className="text-[#324158]" />
              <span>View Profile</span>
            </button>

            <button
              type="button"
              onClick={onEdit}
              className="w-full px-3.5 py-2 text-left text-xs font-semibold text-gray-700 hover:bg-[#eaf0f8] hover:text-[#324158] flex items-center gap-2 cursor-pointer transition-colors"
            >
              <Edit3 size={14} className="text-[#324158]" />
              <span>Edit Aspirant</span>
            </button>

            {isDeactivated ? (
              <button
                type="button"
                disabled={activating}
                onClick={onActivate}
                className="w-full px-3.5 py-2 text-left text-xs font-semibold text-emerald-700 hover:bg-emerald-50 flex items-center gap-2 cursor-pointer transition-colors disabled:opacity-50"
              >
                <UserCheck size={14} />
                <span>{activating ? "Activating..." : "Activate Aspirant"}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onDeactivate}
                className="w-full px-3.5 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-[#eaf0f8] hover:text-[#324158] flex items-center gap-2 cursor-pointer transition-colors"
              >
                <UserX size={14} className="text-[#324158]" />
                <span>Deactivate Aspirant</span>
              </button>
            )}

            <div className="border-t border-gray-100 my-1" />

            <button
              type="button"
              disabled={deleting}
              onClick={onDelete}
              className="w-full px-3.5 py-2 text-left text-xs font-semibold text-red-600 hover:bg-red-50 flex items-center gap-2 cursor-pointer transition-colors disabled:opacity-50"
            >
              <Trash2 size={14} />
              <span>{deleting ? "Removing..." : "Remove Aspirant"}</span>
            </button>
          </div>,
          document.body
        )}
    </div>
  )
}

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "deactivated">("all")
  const [feesFilter, setFeesFilter] = useState<"all" | "completed" | "pending">("all")
  const [themeColor, setThemeColor] = useState<string>("#1E293B")

  // Modals & Popups
  const [showAddStudent, setShowAddStudent] = useState(false)
  const [showBulkUpload, setShowBulkUpload] = useState(false)
  const [showAddPassword, setShowAddPassword] = useState(false)
  const [showEditPassword, setShowEditPassword] = useState(false)
  const [profileStudent, setProfileStudent] = useState<Student | null>(null)
  const [editStudent, setEditStudent] = useState<Student | null>(null)
  const [activeMenuStudentId, setActiveMenuStudentId] = useState<string | null>(null)

  // Bulk Excel Upload state
  const bulkFileInputRef = useRef<HTMLInputElement>(null)
  const [bulkFileName, setBulkFileName] = useState("")
  const [bulkRows, setBulkRows] = useState<ParsedExcelStudentRow[]>([])
  const [bulkParseError, setBulkParseError] = useState("")
  const [uploadingBulk, setUploadingBulk] = useState(false)
  const [bulkResult, setBulkResult] = useState<BulkUploadSummary | null>(null)

  // Deactivate state
  const [deactivateTarget, setDeactivateTarget] = useState<Student | null>(null)
  const [deactivateReason, setDeactivateReason] = useState("")
  const [deactivating, setDeactivating] = useState(false)
  const [activatingId, setActivatingId] = useState<string | null>(null)

  // Add Form state
  const [addForm, setAddForm] = useState({
    name: "",
    email: "",
    rollNumber: "",
    password: "",
    phone: "",
    batch: "",
    totalFees: "",
    completedFees: "",
  })
  const [addError, setAddError] = useState("")
  const [savingAdd, setSavingAdd] = useState(false)

  // Edit Form state
  const [editForm, setEditForm] = useState({
    id: "",
    name: "",
    email: "",
    rollNumber: "",
    password: "",
    phone: "",
    batch: "",
    totalFees: "",
    completedFees: "",
  })
  const [editError, setEditError] = useState("")
  const [savingEdit, setSavingEdit] = useState(false)

  // Access permission state
  const [hasAspirantsAccess, setHasAspirantsAccess] = useState<boolean | null>(null)

  // Deleting state
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Load theme color and access permissions
  useEffect(() => {
    fetch("/api/admin/institute-access", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        if (data.themeColor) setThemeColor(data.themeColor)
        if (data.hasAspirantsAccess !== undefined) {
          setHasAspirantsAccess(data.hasAspirantsAccess !== false)
        } else {
          setHasAspirantsAccess(true)
        }
      })
      .catch(() => {
        setHasAspirantsAccess(true)
      })

    const handleThemeUpdate = (e: any) => {
      if (e.detail?.themeColor) setThemeColor(e.detail.themeColor)
    }
    window.addEventListener("institute-settings-updated", handleThemeUpdate)
    return () => window.removeEventListener("institute-settings-updated", handleThemeUpdate)
  }, [])

  const closeActionMenu = useCallback(() => {
    setActiveMenuStudentId(null)
  }, [])

  const loadStudents = () => {
    setLoading(true)
    fetch("/api/admin/students")
      .then((r) => r.json())
      .then((d) => {
        setStudents(d.students || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(loadStudents, [])

  // Dynamic fee calculation for Add Form: Pending = Total - Completed
  const addCalculatedPending = useMemo(() => {
    const total = Math.max(0, Number(addForm.totalFees) || 0)
    const completed = Math.max(0, Number(addForm.completedFees) || 0)
    return Math.max(0, total - completed)
  }, [addForm.totalFees, addForm.completedFees])

  // Dynamic fee calculation for Edit Form: Pending = Total - Completed
  const editCalculatedPending = useMemo(() => {
    const total = Math.max(0, Number(editForm.totalFees) || 0)
    const completed = Math.max(0, Number(editForm.completedFees) || 0)
    return Math.max(0, total - completed)
  }, [editForm.totalFees, editForm.completedFees])

  // Handle Add Student
  const handleAddStudent = async (event: React.FormEvent) => {
    event.preventDefault()
    setAddError("")
    setSavingAdd(true)
    try {
      const parsedTotal = Math.max(0, Number(addForm.totalFees) || 0)
      const parsedCompleted = Math.max(0, Number(addForm.completedFees) || 0)

      const payload = {
        name: addForm.name.trim(),
        email: addForm.email.trim(),
        rollNumber: addForm.rollNumber.trim(),
        password: addForm.password,
        phone: addForm.phone.trim(),
        batch: addForm.batch.trim(),
        totalFees: parsedTotal,
        completedFees: parsedCompleted,
      }

      const response = await fetch("/api/admin/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to add aspirant")

      toast.success("Aspirant added successfully!")

      // Optimistically update state so fees reflect immediately
      if (data.student) {
        const newStu: Student = {
          _id: data.student._id,
          studentName: data.student.studentName,
          email: data.student.email,
          rollNumber: data.student.rollNumber,
          phone: data.student.phone || "",
          batch: data.student.batch || "",
          totalFees: data.student.totalFees ?? parsedTotal,
          completedFees: data.student.completedFees ?? parsedCompleted,
          pendingFees: data.student.pendingFees ?? Math.max(0, parsedTotal - parsedCompleted),
          examPassword: addForm.password,
          createdAt: new Date().toISOString(),
          totalAttempts: 0,
          lastAttempt: "",
          avgPercentage: undefined,
        }
        setStudents((prev) => [newStu, ...prev.filter((s) => s.email !== newStu.email)])
      }

      setAddForm({
        name: "",
        email: "",
        rollNumber: "",
        password: "",
        phone: "",
        batch: "",
        totalFees: "",
        completedFees: "",
      })
      setShowAddStudent(false)
      loadStudents()
    } catch (error) {
      setAddError(error instanceof Error ? error.message : "Failed to add aspirant")
    } finally {
      setSavingAdd(false)
    }
  }

  // Open Edit Modal with Student Data
  const openEditModal = (student: Student) => {
    setEditStudent(student)
    setEditForm({
      id: student._id,
      name: student.studentName,
      email: student.email,
      rollNumber: student.rollNumber,
      password: "",
      phone: student.phone || "",
      batch: student.batch || "",
      totalFees: student.totalFees !== undefined ? String(student.totalFees) : "0",
      completedFees: student.completedFees !== undefined ? String(student.completedFees) : "0",
    })
    setEditError("")
    setActiveMenuStudentId(null)
  }

  // Handle Edit Student
  const handleSaveEdit = async (event: React.FormEvent) => {
    event.preventDefault()
    setEditError("")
    setSavingEdit(true)
    try {
      const parsedTotal = Math.max(0, Number(editForm.totalFees) || 0)
      const parsedCompleted = Math.max(0, Number(editForm.completedFees) || 0)

      const payload: any = {
        id: editForm.id,
        name: editForm.name.trim(),
        email: editForm.email.trim(),
        rollNumber: editForm.rollNumber.trim(),
        phone: editForm.phone.trim(),
        batch: editForm.batch.trim(),
        totalFees: parsedTotal,
        completedFees: parsedCompleted,
      }
      if (editForm.password && editForm.password.trim().length >= 6) {
        payload.password = editForm.password.trim()
      }

      const response = await fetch("/api/admin/students", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to update aspirant")

      toast.success("Aspirant updated successfully!")
      setEditStudent(null)

      // Update in-memory state
      setStudents((prev) =>
        prev.map((s) =>
          s._id === editForm.id
            ? {
                ...s,
                studentName: payload.name,
                email: payload.email,
                rollNumber: payload.rollNumber,
                phone: payload.phone,
                batch: payload.batch,
                totalFees: parsedTotal,
                completedFees: parsedCompleted,
                pendingFees: Math.max(0, parsedTotal - parsedCompleted),
                examPassword: payload.password || s.examPassword,
              }
            : s
        )
      )

      if (profileStudent && profileStudent._id === editForm.id) {
        setProfileStudent((prev) =>
          prev
            ? {
                ...prev,
                studentName: payload.name,
                email: payload.email,
                rollNumber: payload.rollNumber,
                phone: payload.phone,
                batch: payload.batch,
                totalFees: parsedTotal,
                completedFees: parsedCompleted,
                pendingFees: Math.max(0, parsedTotal - parsedCompleted),
                examPassword: payload.password || prev.examPassword,
              }
            : null
        )
      }

      loadStudents()
    } catch (error) {
      setEditError(error instanceof Error ? error.message : "Failed to update aspirant")
    } finally {
      setSavingEdit(false)
    }
  }

  // Handle Activate Student
  const handleActivateStudent = async (student: Student) => {
    setActiveMenuStudentId(null)
    setActivatingId(student._id)
    try {
      const response = await fetch("/api/admin/students", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: student._id,
          action: "toggle_status",
          status: "active",
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to activate aspirant")

      toast.success(`"${student.studentName}" has been activated. Exam login is allowed.`)

      setStudents((prev) =>
        prev.map((s) =>
          s._id === student._id
            ? { ...s, status: "active", isActive: true, deactivationReason: "" }
            : s
        )
      )

      if (profileStudent && profileStudent._id === student._id) {
        setProfileStudent((prev) =>
          prev ? { ...prev, status: "active", isActive: true, deactivationReason: "" } : null
        )
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to activate aspirant")
    } finally {
      setActivatingId(null)
    }
  }

  // Handle Confirm Deactivate with Reason
  const handleConfirmDeactivate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!deactivateTarget) return
    setDeactivating(true)
    try {
      const reason = deactivateReason.trim() || "Account deactivated by coaching administration."
      const response = await fetch("/api/admin/students", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: deactivateTarget._id,
          action: "toggle_status",
          status: "deactivated",
          deactivationReason: reason,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to deactivate aspirant")

      toast.success(`"${deactivateTarget.studentName}" has been deactivated. Exam login is blocked.`)

      setStudents((prev) =>
        prev.map((s) =>
          s._id === deactivateTarget._id
            ? { ...s, status: "deactivated", isActive: false, deactivationReason: reason }
            : s
        )
      )

      if (profileStudent && profileStudent._id === deactivateTarget._id) {
        setProfileStudent((prev) =>
          prev ? { ...prev, status: "deactivated", isActive: false, deactivationReason: reason } : null
        )
      }

      setDeactivateTarget(null)
      setDeactivateReason("")
    } catch (error: any) {
      toast.error(error.message || "Failed to deactivate aspirant")
    } finally {
      setDeactivating(false)
    }
  }

  // Handle Delete / Remove Student
  const handleDeleteStudent = async (student: Student) => {
    setActiveMenuStudentId(null)
    const confirmed = window.confirm(
      `Are you sure you want to remove "${student.studentName}"? This will delete the aspirant account from your coaching institute.`
    )
    if (!confirmed) return

    setDeletingId(student._id)
    try {
      const response = await fetch(`/api/admin/students?id=${student._id}`, {
        method: "DELETE",
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to remove aspirant")

      toast.success(`Aspirant "${student.studentName}" removed successfully.`)
      setStudents((prev) => prev.filter((s) => s._id !== student._id))
      if (profileStudent?._id === student._id) setProfileStudent(null)
      if (editStudent?._id === student._id) setEditStudent(null)
    } catch (error: any) {
      toast.error(error.message || "Failed to remove aspirant")
    } finally {
      setDeletingId(null)
    }
  }

  const resetBulkUploadState = () => {
    setBulkFileName("")
    setBulkRows([])
    setBulkParseError("")
    setBulkResult(null)
    if (bulkFileInputRef.current) bulkFileInputRef.current.value = ""
  }

  const handleDownloadSampleExcel = () => {
    const sampleRows = [
      {
        Name: "Aarav Sharma",
        Email: "aarav.sharma@example.com",
        "Roll Number": "JEE-2026-001",
        Password: "pass1234",
        Phone: "9876543210",
        Batch: "JEE Batch A - 2026",
        "Total Fees": 25000,
        "Completed Fees": 15000,
      },
      {
        Name: "Diya Patel",
        Email: "diya.patel@example.com",
        "Roll Number": "NEET-2026-002",
        Password: "diya2026",
        Phone: "9123456789",
        Batch: "NEET Target - 2026",
        "Total Fees": 30000,
        "Completed Fees": 30000,
      },
    ]

    const worksheet = XLSX.utils.json_to_sheet(sampleRows)
    worksheet["!cols"] = [
      { wch: 20 },
      { wch: 28 },
      { wch: 16 },
      { wch: 14 },
      { wch: 15 },
      { wch: 22 },
      { wch: 12 },
      { wch: 15 },
    ]
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Aspirants")
    XLSX.writeFile(workbook, "aspirants-upload-template.xlsx")
    toast.success("Sample Excel template downloaded!")
  }

  const handleExcelFileChange = async (file: File | undefined) => {
    if (!file) return
    setBulkParseError("")
    setBulkResult(null)
    setBulkRows([])

    const ext = file.name.split(".").pop()?.toLowerCase()
    if (!ext || !["xlsx", "xls", "csv"].includes(ext)) {
      setBulkParseError("Please upload a valid Excel (.xlsx, .xls) or CSV (.csv) file.")
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setBulkParseError("Excel file size must be less than 5MB.")
      return
    }

    try {
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: "array" })
      const firstSheetName = workbook.SheetNames[0]
      if (!firstSheetName) {
        setBulkParseError("The uploaded workbook has no sheets.")
        return
      }

      const sheet = workbook.Sheets[firstSheetName]
      const rawJson = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: "",
        raw: false,
      })

      if (rawJson.length === 0) {
        setBulkParseError("No rows found in the uploaded Excel sheet.")
        return
      }

      const normalizeKey = (key: string) =>
        key
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "")

      const pickField = (row: Record<string, unknown>, aliases: string[]) => {
        for (const [k, v] of Object.entries(row)) {
          if (aliases.includes(normalizeKey(k))) {
            return String(v ?? "").trim()
          }
        }
        return ""
      }

      const existingEmails = new Set(students.map((s) => s.email?.toLowerCase()).filter(Boolean))
      const existingRolls = new Set(students.map((s) => s.rollNumber?.trim().toLowerCase()).filter(Boolean))
      const seenSheetEmails = new Set<string>()
      const seenSheetRolls = new Set<string>()
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

      const parsed: ParsedExcelStudentRow[] = rawJson
        .map((row, idx) => {
          const rowNumber = idx + 2
          const name = pickField(row, ["name", "fullname", "studentname", "aspirantname", "candidatename"])
          const email = pickField(row, ["email", "emailaddress", "mail", "studentemail"]).toLowerCase()
          const rollNumber = pickField(row, ["rollnumber", "rollno", "roll", "candidateid", "studentid", "id"])
          const password = pickField(row, ["password", "exampassword", "pass", "loginpassword"])
          const phone = pickField(row, ["phone", "phonenumber", "mobile", "mobilenumber", "contact", "contactnumber"])
          const batch = pickField(row, ["batch", "class", "course", "batchclass"])
          const totalFees = Math.max(0, Number(pickField(row, ["totalfees", "totalfee", "fees", "fee"])) || 0)
          const completedFees = Math.max(0, Number(pickField(row, ["completedfees", "paidfees", "paid", "feespaid", "completedfee"])) || 0)

          if (!name && !email && !rollNumber && !password && !phone && !batch) {
            return null
          }

          let error = ""
          if (!name || !email || !rollNumber || !password) {
            error = "Missing required column (Name, Email, Roll Number, or Password)"
          } else if (!emailPattern.test(email)) {
            error = "Invalid email format"
          } else if (password.length < 6) {
            error = "Password must be at least 6 characters"
          } else if (seenSheetEmails.has(email)) {
            error = "Duplicate email in file"
          } else if (seenSheetRolls.has(rollNumber.toLowerCase())) {
            error = "Duplicate roll number in file"
          } else if (existingEmails.has(email)) {
            error = "Email already registered"
          } else if (existingRolls.has(rollNumber.toLowerCase())) {
            error = "Roll number already exists"
          }

          if (email) seenSheetEmails.add(email)
          if (rollNumber) seenSheetRolls.add(rollNumber.toLowerCase())

          return {
            rowNumber,
            name,
            email,
            rollNumber,
            password,
            phone,
            batch,
            totalFees,
            completedFees,
            ...(error ? { error } : {}),
          }
        })
        .filter((item): item is ParsedExcelStudentRow => item !== null)

      if (parsed.length === 0) {
        setBulkParseError("No non-empty rows found in the uploaded sheet.")
        return
      }

      setBulkFileName(file.name)
      setBulkRows(parsed)
    } catch (err) {
      console.error("Failed to parse Excel:", err)
      setBulkParseError("Could not read this file. Please ensure it matches the Excel template format.")
    }
  }

  const handleConfirmBulkUpload = async () => {
    const validRows = bulkRows.filter((r) => !r.error)
    if (validRows.length === 0) {
      setBulkParseError("No valid rows available to import. Please check the errors below.")
      return
    }

    setUploadingBulk(true)
    setBulkParseError("")
    try {
      const response = await fetch("/api/admin/students/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ students: validRows }),
      })
      const data = await response.json()
      if (!response.ok) {
        if (data.skippedRows) {
          setBulkResult({
            createdCount: data.createdCount || 0,
            skippedCount: data.skippedCount || data.skippedRows.length,
            skippedRows: data.skippedRows,
          })
        }
        throw new Error(data.error || "Failed to upload aspirants")
      }

      setBulkResult({
        createdCount: data.createdCount || 0,
        skippedCount: data.skippedCount || 0,
        skippedRows: data.skippedRows || [],
      })
      toast.success(`${data.createdCount} aspirant${data.createdCount === 1 ? "" : "s"} imported successfully!`)
      loadStudents()
    } catch (err: any) {
      setBulkParseError(err?.message || "Failed to import aspirants")
    } finally {
      setUploadingBulk(false)
    }
  }

  const activeCount = useMemo(
    () => students.filter((s) => s.status !== "deactivated" && s.isActive !== false).length,
    [students]
  )
  const deactivatedCount = useMemo(
    () => students.filter((s) => s.status === "deactivated" || s.isActive === false).length,
    [students]
  )
  const completedFeesCount = useMemo(() => {
    return students.filter((s) => {
      const total = s.totalFees || 0
      const completed = s.completedFees || 0
      const pending = s.pendingFees !== undefined ? s.pendingFees : Math.max(0, total - completed)
      return total > 0 && pending <= 0
    }).length
  }, [students])
  const pendingFeesCount = useMemo(() => {
    return students.filter((s) => {
      const total = s.totalFees || 0
      const completed = s.completedFees || 0
      const pending = s.pendingFees !== undefined ? s.pendingFees : Math.max(0, total - completed)
      return pending > 0
    }).length
  }, [students])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return students.filter((s) => {
      const matchesSearch =
        !query ||
        s.studentName?.toLowerCase().includes(query) ||
        s.email?.toLowerCase().includes(query) ||
        s.rollNumber?.toLowerCase().includes(query) ||
        s.batch?.toLowerCase().includes(query)

      if (!matchesSearch) return false

      const isDeactivated = s.status === "deactivated" || s.isActive === false
      if (statusFilter === "active" && isDeactivated) return false
      if (statusFilter === "deactivated" && !isDeactivated) return false

      const total = s.totalFees || 0
      const completed = s.completedFees || 0
      const pending = s.pendingFees !== undefined ? s.pendingFees : Math.max(0, total - completed)
      const isFullPaid = total > 0 && pending <= 0
      const hasPending = pending > 0

      if (feesFilter === "completed" && !isFullPaid) return false
      if (feesFilter === "pending" && !hasPending) return false

      return true
    })
  }, [students, search, statusFilter, feesFilter])

  const totalFeesSum = students.reduce((sum, s) => sum + (s.totalFees || 0), 0)
  const totalCompletedSum = students.reduce((sum, s) => sum + (s.completedFees || 0), 0)
  const totalPendingSum = students.reduce((sum, s) => sum + (s.pendingFees || 0), 0)

  if (hasAspirantsAccess === false) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4 border border-amber-200 shadow-sm">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-[#324158] mb-2">Access Restricted</h2>
        <p className="text-gray-500 max-w-md text-sm mb-6 leading-relaxed">
          Your organization does not have permission to access the Aspirants Section. Please contact your administrator to enable this module.
        </p>
        <Link
          href="/admin"
          className="px-5 py-2.5 rounded-xl bg-[#324158] text-white text-sm font-semibold hover:bg-[#324158]/90 transition-all shadow-xs"
        >
          Return to Dashboard
        </Link>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* ── Top Header Bar with Center Search & Right-Aligned Add Student Button ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 border-b border-gray-200 pb-5">
        {/* Left: Title & Subtitle */}
        <div className="shrink-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">Aspirants</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            Registered aspirants allowed to access your coaching portal and exams.
          </p>
        </div>

        {/* Center: Search Bar */}
        <div className="flex-1 w-full max-w-full md:max-w-md mx-auto">
          <div className="relative w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              className="w-full pl-10 pr-9 py-2.5 border border-slate-200 rounded-xl text-xs sm:text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 shadow-2xs transition-all"
              placeholder="Search by name, email, roll number, batch..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                title="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Right: Bulk Upload & Add Student Buttons */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5 shrink-0 w-full md:w-auto">
          <button
            type="button"
            onClick={() => {
              resetBulkUploadState()
              setShowBulkUpload(true)
            }}
            className="w-full sm:w-auto rounded-xl px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 shadow-2xs transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <FileSpreadsheet size={16} className="text-emerald-600" />
            <span>Upload Excel</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setAddError("")
              setShowAddStudent(true)
            }}
            style={{ backgroundColor: themeColor || "#1E293B" }}
            className="w-full sm:w-auto rounded-xl px-5 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-xs hover:opacity-90 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <UserPlus size={16} />
            <span>Add Aspirant</span>
          </button>
        </div>
      </div>

      {/* ── Stat Cards (2x2 on Mobile, 4 Cols on Desktop - Brand Styling) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-5">
        <button
          type="button"
          onClick={() => {
            setStatusFilter("all")
            setFeesFilter("all")
          }}
          className={`text-left bg-gradient-to-br from-white to-[#f8fafd] rounded-2xl border p-3.5 sm:p-5 shadow-xs hover:shadow-sm transition-all cursor-pointer ${
            statusFilter === "all" && feesFilter === "all"
              ? "border-[#324158] ring-2 ring-[#324158]/20 bg-[#f4f7fb]"
              : "border-slate-200/80 hover:border-[#324158]/40"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Aspirants</p>
            <div className="w-8 h-8 rounded-xl bg-[#eaf0f8] text-[#324158] flex items-center justify-center">
              <Users size={16} />
            </div>
          </div>
          <p className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-[#324158] tracking-tight">{students.length}</p>
          <p className="text-[10px] sm:text-xs text-slate-500 mt-1">Enrolled students</p>
        </button>

        <button
          type="button"
          onClick={() => setFeesFilter(feesFilter === "completed" ? "all" : "completed")}
          className={`text-left bg-gradient-to-br from-white to-[#f8fafd] rounded-2xl border p-3.5 sm:p-5 shadow-xs hover:shadow-sm transition-all cursor-pointer ${
            feesFilter === "completed"
              ? "border-[#324158] ring-2 ring-[#324158]/20 bg-[#f4f7fb]"
              : "border-slate-200/80 hover:border-[#324158]/40"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider">Fees Collected</p>
            <div className="w-8 h-8 rounded-xl bg-[#eaf0f8] text-[#324158] flex items-center justify-center">
              <CreditCard size={16} />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-2">
            <p className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-[#324158] tracking-tight">
              ₹{totalCompletedSum.toLocaleString()}
            </p>
            <span className="text-[10px] sm:text-xs text-slate-400 truncate">/ ₹{totalFeesSum.toLocaleString()}</span>
          </div>
          <p className="text-[10px] sm:text-xs text-emerald-600 font-semibold mt-1">Paid in full or partial</p>
        </button>

        <button
          type="button"
          onClick={() => setFeesFilter(feesFilter === "pending" ? "all" : "pending")}
          className={`text-left bg-gradient-to-br from-white to-[#f8fafd] rounded-2xl border p-3.5 sm:p-5 shadow-xs hover:shadow-sm transition-all cursor-pointer ${
            feesFilter === "pending"
              ? "border-[#324158] ring-2 ring-[#324158]/20 bg-[#f4f7fb]"
              : "border-slate-200/80 hover:border-[#324158]/40"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider">Pending Fees</p>
            <div className="w-8 h-8 rounded-xl bg-[#eaf0f8] text-[#324158] flex items-center justify-center">
              <AlertCircle size={16} />
            </div>
          </div>
          <p className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-[#324158] tracking-tight">
            ₹{totalPendingSum.toLocaleString()}
          </p>
          <p className="text-[10px] sm:text-xs text-slate-500 mt-1">Due balance</p>
        </button>

        <div className="bg-gradient-to-br from-white to-[#f8fafd] rounded-2xl border border-slate-200/80 p-3.5 sm:p-5 shadow-xs hover:shadow-sm transition-all">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider">Exam Attempts</p>
            <div className="w-8 h-8 rounded-xl bg-[#eaf0f8] text-[#324158] flex items-center justify-center">
              <Award size={16} />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-2">
            <p className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-[#324158] tracking-tight">
              {students.reduce((s, st) => s + st.totalAttempts, 0)}
            </p>
            {students.length > 0 && (
              <span className="text-[10px] sm:text-xs text-slate-500 font-semibold">
                ({Math.round(students.reduce((s, st) => s + (st.avgPercentage || 0), 0) / students.length)}% avg)
              </span>
            )}
          </div>
          <p className="text-[10px] sm:text-xs text-slate-500 mt-1">Tests submitted</p>
        </div>
      </div>

      {/* ── Filters Bar: Status & Fees Filters ── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 sm:p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
        {/* Left: Filter Buttons */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Status Filters */}
          {/* Status Filters */}
          <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200/70">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider px-2">Status:</span>
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              style={statusFilter === "all" ? { backgroundColor: themeColor } : undefined}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                statusFilter === "all"
                  ? "text-white shadow-xs font-bold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white"
              }`}
            >
              All ({students.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("active")}
              style={statusFilter === "active" ? { backgroundColor: themeColor } : undefined}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                statusFilter === "active"
                  ? "text-white shadow-xs font-bold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white"
              }`}
            >
              Active ({activeCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("deactivated")}
              style={statusFilter === "deactivated" ? { backgroundColor: themeColor } : undefined}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                statusFilter === "deactivated"
                  ? "text-white shadow-xs font-bold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white"
              }`}
            >
              Deactivated ({deactivatedCount})
            </button>
          </div>

          {/* Fees Filters */}
          <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200/70">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider px-2">Fees:</span>
            <button
              type="button"
              onClick={() => setFeesFilter("all")}
              style={feesFilter === "all" ? { backgroundColor: themeColor } : undefined}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                feesFilter === "all"
                  ? "text-white shadow-xs font-bold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white"
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setFeesFilter("completed")}
              style={feesFilter === "completed" ? { backgroundColor: themeColor } : undefined}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                feesFilter === "completed"
                  ? "text-white shadow-xs font-bold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white"
              }`}
            >
              Completed Fees ({completedFeesCount})
            </button>
            <button
              type="button"
              onClick={() => setFeesFilter("pending")}
              style={feesFilter === "pending" ? { backgroundColor: themeColor } : undefined}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                feesFilter === "pending"
                  ? "text-white shadow-xs font-bold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white"
              }`}
            >
              Pending Fees ({pendingFeesCount})
            </button>
          </div>

          {/* Reset Filters Button */}
          {(statusFilter !== "all" || feesFilter !== "all" || search) && (
            <button
              type="button"
              onClick={() => {
                setStatusFilter("all")
                setFeesFilter("all")
                setSearch("")
              }}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <X size={12} />
              <span>Reset</span>
            </button>
          )}
        </div>

        {/* Right: Counter */}
        <div className="text-xs text-slate-500 font-medium">
          Showing <span className="font-bold text-[#324158]">{filtered.length}</span> of {students.length} aspirants
        </div>
      </div>

      {/* ── Student Data Section (Responsive Table on Desktop & Native Touch Cards on Mobile) ── */}
      <div className="bg-white rounded-2xl border border-gray-200/90 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-6">
            <AdminListSkeleton />
          </div>
        ) : (
          <>
            {/* 1. Desktop & Tablet Table (>= 768px) */}
            <div className="hidden md:block overflow-x-auto min-h-[300px]">
              <table className="w-full text-left border-collapse min-w-[760px]">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/70 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                    <th className="px-6 py-3.5">Aspirant</th>
                    <th className="px-6 py-3.5">Roll Number</th>
                    <th className="px-6 py-3.5">Fees Status</th>
                    <th className="px-6 py-3.5 text-center">Attempts</th>
                    <th className="px-6 py-3.5">Avg Score</th>
                    <th className="px-6 py-3.5">Last Attempt</th>
                    <th className="px-6 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-16 text-gray-400 text-sm">
                        {search || statusFilter !== "all" || feesFilter !== "all" ? (
                          <div className="flex flex-col items-center justify-center gap-2">
                            <p className="font-medium text-slate-600">No aspirants match the selected filter criteria.</p>
                            <button
                              type="button"
                              onClick={() => {
                                setSearch("")
                                setStatusFilter("all")
                                setFeesFilter("all")
                              }}
                              className="text-xs text-[#2D3A4A] underline font-semibold hover:opacity-80 cursor-pointer"
                            >
                              Reset all filters
                            </button>
                          </div>
                        ) : (
                          "No registered aspirants found."
                        )}
                      </td>
                    </tr>
                  ) : (
                    filtered.map((s) => {
                      const total = s.totalFees || 0
                      const completed = s.completedFees || 0
                      const pending = s.pendingFees !== undefined ? s.pendingFees : Math.max(0, total - completed)
                      const isFullPaid = total > 0 && pending <= 0
                      const hasPending = pending > 0
                      const isDeactivated = s.status === "deactivated" || s.isActive === false
                      const isMenuOpen = activeMenuStudentId === `desktop-${s._id}`

                      return (
                        <tr key={s._id} className="hover:bg-slate-50/70 transition-colors">
                          {/* Student Name & Email */}
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div
                                className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-2xs relative"
                                style={{ backgroundColor: themeColor || "#1E293B" }}
                              >
                                {s.studentName?.charAt(0)?.toUpperCase() || "S"}
                                {isDeactivated && (
                                  <span
                                    className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-slate-600 border-2 border-white"
                                    title="Deactivated"
                                  />
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <p
                                    className={`font-semibold text-sm leading-snug truncate ${
                                      isDeactivated ? "text-slate-500" : "text-gray-900"
                                    }`}
                                  >
                                    {s.studentName}
                                  </p>
                                  {isDeactivated ? (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                      Deactivated
                                    </span>
                                  ) : (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                      Active
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-gray-400 truncate">{s.email}</p>
                              </div>
                            </div>
                          </td>

                          {/* Roll Number & Batch */}
                          <td className="px-6 py-4">
                            <span className="font-mono text-xs font-semibold px-2.5 py-1 bg-gray-100 text-gray-700 rounded-lg border border-gray-200">
                              {s.rollNumber || "—"}
                            </span>
                            {s.batch && <p className="text-[11px] text-gray-400 mt-1 truncate">{s.batch}</p>}
                          </td>

                          {/* Fees Status */}
                          <td className="px-6 py-4">
                            <div className="space-y-1">
                              <div className="text-xs font-semibold text-gray-800">
                                ₹{completed.toLocaleString()}{" "}
                                <span className="text-gray-400 font-normal">/ ₹{total.toLocaleString()}</span>
                              </div>
                              {total > 0 ? (
                                isFullPaid ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    Paid in Full
                                  </span>
                                ) : hasPending ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                                    ₹{pending.toLocaleString()} Due
                                  </span>
                                ) : null
                              ) : (
                                <span className="text-[11px] text-gray-400">No fee set</span>
                              )}
                            </div>
                          </td>

                          {/* Attempts */}
                          <td className="px-6 py-4 text-center font-semibold text-gray-700">{s.totalAttempts}</td>

                          {/* Avg Score */}
                          <td className="px-6 py-4">
                            {s.avgPercentage != null ? (
                              <div className="flex items-center gap-2">
                                <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-emerald-600 rounded-full"
                                    style={{ width: `${Math.min(Math.round(s.avgPercentage), 100)}%` }}
                                  />
                                </div>
                                <span className="text-xs font-semibold text-gray-700">
                                  {Math.round(s.avgPercentage)}%
                                </span>
                              </div>
                            ) : (
                              <span className="text-gray-400 text-xs">—</span>
                            )}
                          </td>

                          {/* Last Attempt */}
                          <td className="px-6 py-4 text-xs text-gray-500">
                            {s.lastAttempt
                              ? new Date(s.lastAttempt).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })
                              : "—"}
                          </td>

                          {/* 3-Dot Action Menu */}
                          <td className="px-6 py-4 text-right">
                            <StudentActionMenu
                              student={s}
                              isDeactivated={isDeactivated}
                              isOpen={isMenuOpen}
                              activating={activatingId === s._id}
                              deleting={deletingId === s._id}
                              ariaLabel="More options"
                              onToggle={() => setActiveMenuStudentId(isMenuOpen ? null : `desktop-${s._id}`)}
                              onClose={closeActionMenu}
                              onViewProfile={() => {
                                setProfileStudent(s)
                                setActiveMenuStudentId(null)
                              }}
                              onEdit={() => openEditModal(s)}
                              onActivate={() => handleActivateStudent(s)}
                              onDeactivate={() => {
                                setActiveMenuStudentId(null)
                                setDeactivateTarget(s)
                                setDeactivateReason("")
                              }}
                              onDelete={() => handleDeleteStudent(s)}
                            />
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* 2. Mobile Native Card List (< 768px) */}
            <div className="block md:hidden divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <div className="text-center py-12 px-4 text-gray-400 text-sm">
                  {search || statusFilter !== "all" || feesFilter !== "all" ? (
                    <div className="flex flex-col items-center justify-center gap-2">
                      <p className="font-medium text-slate-600">No aspirants match the selected filter criteria.</p>
                      <button
                        type="button"
                        onClick={() => {
                          setSearch("")
                          setStatusFilter("all")
                          setFeesFilter("all")
                        }}
                        className="text-xs text-[#2D3A4A] underline font-semibold hover:opacity-80 cursor-pointer"
                      >
                        Reset all filters
                      </button>
                    </div>
                  ) : (
                    "No registered aspirants found."
                  )}
                </div>
              ) : (
                filtered.map((s) => {
                  const total = s.totalFees || 0
                  const completed = s.completedFees || 0
                  const pending = s.pendingFees !== undefined ? s.pendingFees : Math.max(0, total - completed)
                  const isFullPaid = total > 0 && pending <= 0
                  const hasPending = pending > 0
                  const isDeactivated = s.status === "deactivated" || s.isActive === false
                  const isMenuOpen = activeMenuStudentId === `mobile-${s._id}`

                  return (
                    <div key={s._id} className="p-4 space-y-3 hover:bg-slate-50/60 transition-colors">
                      {/* Top Row: Avatar, Name, Email & 3-dot Menu */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div
                            className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-2xs relative"
                            style={{ backgroundColor: themeColor || "#1E293B" }}
                          >
                            {s.studentName?.charAt(0)?.toUpperCase() || "S"}
                            {isDeactivated && (
                              <span
                                className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-slate-600 border-2 border-white"
                                title="Deactivated"
                              />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p
                                className={`font-bold text-sm leading-snug truncate ${
                                  isDeactivated ? "text-slate-500" : "text-gray-900"
                                }`}
                              >
                                {s.studentName}
                              </p>
                              {isDeactivated ? (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                  Deactivated
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  Active
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-400 truncate">{s.email}</p>
                          </div>
                        </div>

                        {/* 3-Dot Action Menu */}
                        <div className="shrink-0">
                          <StudentActionMenu
                            student={s}
                            isDeactivated={isDeactivated}
                            isOpen={isMenuOpen}
                            activating={activatingId === s._id}
                            deleting={deletingId === s._id}
                            ariaLabel="Aspirant options"
                            onToggle={() => setActiveMenuStudentId(isMenuOpen ? null : `mobile-${s._id}`)}
                            onClose={closeActionMenu}
                            onViewProfile={() => {
                              setProfileStudent(s)
                              setActiveMenuStudentId(null)
                            }}
                            onEdit={() => openEditModal(s)}
                            onActivate={() => handleActivateStudent(s)}
                            onDeactivate={() => {
                              setActiveMenuStudentId(null)
                              setDeactivateTarget(s)
                              setDeactivateReason("")
                            }}
                            onDelete={() => handleDeleteStudent(s)}
                          />
                        </div>
                      </div>

                      {/* Badges Row: Roll Number, Batch & Fee Status */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                        <span className="font-mono text-xs font-semibold px-2 py-0.5 bg-gray-100 text-gray-700 rounded-md border border-gray-200">
                          Roll: {s.rollNumber || "—"}
                        </span>
                        {s.batch && (
                          <span className="text-xs font-medium px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md">
                            {s.batch}
                          </span>
                        )}
                        {total > 0 ? (
                          isFullPaid ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Paid in Full
                            </span>
                          ) : hasPending ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                              ₹{pending.toLocaleString()} Due
                            </span>
                          ) : null
                        ) : null}
                      </div>

                      {/* Stats Footer: Fees, Tests, Avg Score */}
                      <div className="grid grid-cols-3 gap-2 p-2.5 bg-gray-50/70 rounded-xl border border-gray-100 text-center">
                        <div>
                          <p className="text-[10px] uppercase font-bold text-gray-400">Fees (₹)</p>
                          <p className="text-xs font-bold text-gray-800 mt-0.5">
                            {completed > 0 ? completed.toLocaleString() : "0"}{" "}
                            <span className="text-[10px] text-gray-400 font-normal">/ {total.toLocaleString()}</span>
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase font-bold text-gray-400">Tests</p>
                          <p className="text-xs font-bold text-gray-800 mt-0.5">{s.totalAttempts}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase font-bold text-gray-400">Avg Score</p>
                          <p className="text-xs font-bold text-gray-800 mt-0.5">
                            {s.avgPercentage != null ? `${Math.round(s.avgPercentage)}%` : "—"}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </>
        )}
      </div>

      {/* ═════════════════════════════════════════════════════════════════════
          ADD STUDENT MODAL (Responsive Fixed Header & Footer - NO ORANGE)
      ═════════════════════════════════════════════════════════════════════ */}
      {showAddStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-lg max-h-[92vh] flex flex-col rounded-2xl sm:rounded-3xl border border-gray-200/90 bg-white shadow-2xl overflow-hidden my-auto">
            {/* Modal Header */}
            <div className="px-5 sm:px-6 py-4 border-b border-gray-100 flex items-start justify-between shrink-0 bg-white">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-gray-900 leading-snug">Add New Aspirant</h2>
                <p className="mt-0.5 text-[11px] sm:text-xs text-gray-500">
                  Register aspirant credentials and setup fee structure for your coaching.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddStudent(false)}
                className="p-1.5 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleAddStudent} className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                {addError && (
                  <div className="rounded-xl bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs font-medium text-red-600 flex items-center gap-2">
                    <AlertCircle size={15} className="shrink-0" />
                    <span>{addError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Aspirant Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={addForm.name}
                      onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                      placeholder="e.g. Rahul Sharma"
                      className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-xs sm:text-sm font-normal outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Roll Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={addForm.rollNumber}
                      onChange={(e) => setAddForm({ ...addForm, rollNumber: e.target.value })}
                      placeholder="e.g. ROLL-101"
                      className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-xs sm:text-sm font-normal outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Email Address <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={addForm.email}
                      onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                      placeholder="rahul@example.com"
                      className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-xs sm:text-sm font-normal outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Exam Password <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showAddPassword ? "text" : "password"}
                        required
                        minLength={6}
                        value={addForm.password}
                        onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                        placeholder="Min 6 characters"
                        className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 pr-10 text-xs sm:text-sm font-normal outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowAddPassword(!showAddPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                        tabIndex={-1}
                      >
                        {showAddPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Phone Number (Optional)</label>
                    <input
                      type="tel"
                      value={addForm.phone}
                      onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                      placeholder="e.g. +91 9876543210"
                      className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-xs sm:text-sm font-normal outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Batch / Class (Optional)</label>
                    <input
                      type="text"
                      value={addForm.batch}
                      onChange={(e) => setAddForm({ ...addForm, batch: e.target.value })}
                      placeholder="e.g. JEE Batch A - 2026"
                      className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-xs sm:text-sm font-normal outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 transition-all"
                    />
                  </div>
                </div>

                {/* ── Fee Details Section ── */}
                <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <CreditCard size={14} className="text-slate-500" /> Coaching Fees Setup
                    </span>
                    <span className="text-[10px] font-semibold text-slate-500">Auto-balanced calculation</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-gray-600 mb-1">Total Fees (₹)</label>
                      <input
                        type="number"
                        min={0}
                        step={100}
                        value={addForm.totalFees}
                        onChange={(e) => setAddForm({ ...addForm, totalFees: e.target.value })}
                        placeholder="e.g. 50000"
                        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold outline-none focus:border-slate-800 transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-gray-600 mb-1">Completed Fees (₹)</label>
                      <input
                        type="number"
                        min={0}
                        step={100}
                        value={addForm.completedFees}
                        onChange={(e) => setAddForm({ ...addForm, completedFees: e.target.value })}
                        placeholder="e.g. 30000"
                        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold outline-none focus:border-slate-800 transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-gray-600 mb-1">Pending Fees (₹)</label>
                      <div className="w-full rounded-xl border border-slate-200 bg-slate-100/90 px-3 py-2 text-xs font-bold text-slate-800 flex items-center justify-between shadow-2xs">
                        <span>₹{addCalculatedPending.toLocaleString()}</span>
                        <span className="text-[10px] font-semibold text-slate-500 uppercase">Auto</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-400">
                    Pending Fees is auto-calculated as Total Fees minus Completed Fees.
                  </p>
                </div>
              </div>

              {/* Fixed Footer */}
              <div className="px-5 sm:px-6 py-3.5 bg-gray-50/90 border-t border-gray-100 flex items-center justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowAddStudent(false)}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-white hover:border-gray-300 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingAdd}
                  style={{ backgroundColor: themeColor || "#1E293B" }}
                  className="px-6 py-2.5 rounded-xl text-xs font-bold text-white shadow-xs hover:opacity-90 active:scale-95 disabled:opacity-60 transition-all cursor-pointer flex items-center gap-2"
                >
                  {savingAdd ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> Adding Aspirant...
                    </>
                  ) : (
                    "Add Aspirant"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════
          EDIT STUDENT MODAL (Responsive Fixed Header & Footer - NO ORANGE)
      ═════════════════════════════════════════════════════════════════════ */}
      {editStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-lg max-h-[92vh] flex flex-col rounded-2xl sm:rounded-3xl border border-gray-200/90 bg-white shadow-2xl overflow-hidden my-auto">
            {/* Modal Header */}
            <div className="px-5 sm:px-6 py-4 border-b border-gray-100 flex items-start justify-between shrink-0 bg-white">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-gray-900 leading-snug">Edit Aspirant Details</h2>
                <p className="mt-0.5 text-[11px] sm:text-xs text-gray-500">
                  Update aspirant personal information, credentials, and fee balances.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditStudent(null)}
                className="p-1.5 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleSaveEdit} className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                {editError && (
                  <div className="rounded-xl bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs font-medium text-red-600 flex items-center gap-2">
                    <AlertCircle size={15} className="shrink-0" />
                    <span>{editError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Aspirant Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-xs sm:text-sm font-normal outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Roll Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={editForm.rollNumber}
                      onChange={(e) => setEditForm({ ...editForm, rollNumber: e.target.value })}
                      className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-xs sm:text-sm font-normal outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Email Address <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={editForm.email}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                      className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-xs sm:text-sm font-normal outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Reset Password (Optional)
                    </label>
                    <div className="relative">
                      <input
                        type={showEditPassword ? "text" : "password"}
                        minLength={6}
                        value={editForm.password}
                        onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                        placeholder="Leave blank to keep current"
                        className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 pr-10 text-xs sm:text-sm font-normal outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowEditPassword(!showEditPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                        tabIndex={-1}
                      >
                        {showEditPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {editStudent?.examPassword && (
                      <p className="mt-1 text-[11px] text-slate-500">
                        Current password: <span className="font-mono font-semibold text-slate-800 select-all">{editStudent.examPassword}</span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Phone Number</label>
                    <input
                      type="tel"
                      value={editForm.phone}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                      placeholder="e.g. +91 9876543210"
                      className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-xs sm:text-sm font-normal outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Batch / Class</label>
                    <input
                      type="text"
                      value={editForm.batch}
                      onChange={(e) => setEditForm({ ...editForm, batch: e.target.value })}
                      placeholder="e.g. JEE Batch A - 2026"
                      className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-xs sm:text-sm font-normal outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 transition-all"
                    />
                  </div>
                </div>

                {/* ── Fee Details Section ── */}
                <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <CreditCard size={14} className="text-slate-500" /> Coaching Fees Balance
                    </span>
                    <span className="text-[10px] font-semibold text-slate-500">Auto-balanced calculation</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-gray-600 mb-1">Total Fees (₹)</label>
                      <input
                        type="number"
                        min={0}
                        step={100}
                        value={editForm.totalFees}
                        onChange={(e) => setEditForm({ ...editForm, totalFees: e.target.value })}
                        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold outline-none focus:border-slate-800 transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-gray-600 mb-1">Completed Fees (₹)</label>
                      <input
                        type="number"
                        min={0}
                        step={100}
                        value={editForm.completedFees}
                        onChange={(e) => setEditForm({ ...editForm, completedFees: e.target.value })}
                        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold outline-none focus:border-slate-800 transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-gray-600 mb-1">Pending Fees (₹)</label>
                      <div className="w-full rounded-xl border border-slate-200 bg-slate-100/90 px-3 py-2 text-xs font-bold text-slate-800 flex items-center justify-between shadow-2xs">
                        <span>₹{editCalculatedPending.toLocaleString()}</span>
                        <span className="text-[10px] font-semibold text-slate-500 uppercase">Auto</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-400">
                    Pending Fees is auto-calculated as Total Fees minus Completed Fees.
                  </p>
                </div>
              </div>

              {/* Fixed Footer */}
              <div className="px-5 sm:px-6 py-3.5 bg-gray-50/90 border-t border-gray-100 flex items-center justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setEditStudent(null)}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-white hover:border-gray-300 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  style={{ backgroundColor: themeColor || "#1E293B" }}
                  className="px-6 py-2.5 rounded-xl text-xs font-bold text-white shadow-xs hover:opacity-90 active:scale-95 disabled:opacity-60 transition-all cursor-pointer flex items-center gap-2"
                >
                  {savingEdit ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> Saving Changes...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════
          DEACTIVATE STUDENT MODAL (Prompt for Custom Reason - NO ORANGE)
      ═════════════════════════════════════════════════════════════════════ */}
      {deactivateTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-lg max-h-[92vh] flex flex-col rounded-2xl sm:rounded-3xl border border-gray-200/90 bg-white shadow-2xl overflow-hidden my-auto">
            {/* Modal Header */}
            <div className="px-5 sm:px-6 py-4 border-b border-gray-100 flex items-start justify-between shrink-0 bg-white">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700 shrink-0">
                  <UserX size={18} />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-gray-900 leading-snug">
                    Deactivate Aspirant
                  </h2>
                  <p className="text-[11px] sm:text-xs text-gray-500">
                    Block exam entrance and specify reason for aspirant
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDeactivateTarget(null)
                  setDeactivateReason("")
                }}
                className="p-1.5 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleConfirmDeactivate} className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                {/* Target Student Identity Info */}
                <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200/80 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate">{deactivateTarget.studentName}</p>
                    <p className="text-[11px] text-slate-500 truncate">{deactivateTarget.email}</p>
                    <div className="flex items-center gap-1.5 mt-1 font-mono text-[10px] text-slate-700">
                      <span>Roll: {deactivateTarget.rollNumber}</span>
                      {deactivateTarget.batch && <span>• {deactivateTarget.batch}</span>}
                    </div>
                  </div>
                  {deactivateTarget.pendingFees !== undefined && deactivateTarget.pendingFees > 0 && (
                    <div className="text-right shrink-0">
                      <p className="text-[10px] font-bold uppercase text-slate-400">Pending Fees</p>
                      <p className="text-xs font-bold text-slate-800">₹{deactivateTarget.pendingFees.toLocaleString()}</p>
                    </div>
                  )}
                </div>

                {/* Notice Alert */}
                <div className="p-3.5 bg-slate-100/70 rounded-xl border border-slate-200 flex items-start gap-2.5 text-xs text-slate-700 leading-relaxed">
                  <ShieldAlert size={16} className="text-slate-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-semibold text-slate-900 block mb-0.5">Exam Login Will Be Blocked:</strong>
                    When deactivated, this aspirant cannot enter or attempt exams. The reason you enter below will be shown directly on their screen when they try to log in.
                  </div>
                </div>

                {/* Reason Input */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-gray-700">
                      Deactivation Reason <span className="text-red-500">*</span>
                    </label>
                    <span className="text-[10px] text-slate-500 font-medium">Shown on aspirant screen</span>
                  </div>

                  {/* Quick Preset Buttons */}
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      "Pending coaching fees not cleared. Please contact the office.",
                      "Coaching fee balance overdue.",
                      "Attendance shortage. Please meet the administrator.",
                      "Account temporarily suspended by administration.",
                    ].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setDeactivateReason(preset)}
                        className="text-[10px] font-medium px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors text-left cursor-pointer"
                      >
                        + {preset.length > 32 ? preset.slice(0, 32) + "..." : preset}
                      </button>
                    ))}
                  </div>

                  <textarea
                    rows={3}
                    required
                    value={deactivateReason}
                    onChange={(e) => setDeactivateReason(e.target.value)}
                    placeholder="e.g. Please clear your remaining coaching fee balance at the front desk to resume exam access."
                    className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-xs sm:text-sm font-normal outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 transition-all resize-none"
                  />
                  <p className="text-[11px] text-slate-400">
                    Be specific so the aspirant knows why their account is locked and what steps to take.
                  </p>
                </div>
              </div>

              {/* Fixed Footer */}
              <div className="px-5 sm:px-6 py-3.5 bg-gray-50/90 border-t border-gray-100 flex items-center justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setDeactivateTarget(null)
                    setDeactivateReason("")
                  }}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-white hover:border-gray-300 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={deactivating || !deactivateReason.trim()}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 active:scale-95 disabled:opacity-60 transition-all cursor-pointer flex items-center gap-2 shadow-xs"
                >
                  {deactivating ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> Deactivating...
                    </>
                  ) : (
                    <>
                      <UserX size={14} /> Deactivate Aspirant
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════
          STUDENT PROFILE MODAL (Horizontal Responsive Dialog - NO ORANGE)
      ═════════════════════════════════════════════════════════════════════ */}
      {profileStudent && (() => {
        const total = profileStudent.totalFees || 0
        const completed = profileStudent.completedFees || 0
        const pending =
          profileStudent.pendingFees !== undefined
            ? profileStudent.pendingFees
            : Math.max(0, total - completed)
        const isPaidInFull = total > 0 && pending <= 0
        const isDeactivated =
          profileStudent.status === "deactivated" || profileStudent.isActive === false

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4 md:p-6 backdrop-blur-xs overflow-y-auto">
            <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl sm:rounded-3xl border border-gray-200/90 bg-white shadow-2xl overflow-hidden my-auto">
              {/* Modal Top Header Bar */}
              <div className="flex items-center justify-between px-5 sm:px-7 py-4 border-b border-gray-100 bg-white shrink-0">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: themeColor || "#1E293B" }}
                  />
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-gray-900 leading-snug">Aspirant Profile</h2>
                    <p className="text-[11px] text-gray-500">Complete enrollment, fees balance, and exam performance</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setProfileStudent(null)}
                  className="p-1.5 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
                  aria-label="Close"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Modal Scrollable Body - Horizontal Grid on Desktop, Stack on Mobile */}
              <div className="overflow-y-auto p-4 sm:p-6 lg:p-7 space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-start">
                  {/* ── Left Column: Student Identity & Contact Info (5 Cols) ── */}
                  <div className="lg:col-span-5 space-y-4">
                    {/* Identity Card */}
                    <div className="p-5 rounded-2xl bg-slate-50/70 border border-slate-200/80 flex flex-col sm:flex-row lg:flex-col items-center sm:items-start lg:items-start gap-4">
                      <div
                        className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-2xl font-bold shrink-0 shadow-xs"
                        style={{ backgroundColor: themeColor || "#1E293B" }}
                      >
                        {profileStudent.studentName?.charAt(0)?.toUpperCase() || "S"}
                      </div>
                      <div className="text-center sm:text-left lg:text-left min-w-0 flex-1 w-full">
                        <h3 className="text-lg sm:text-xl font-bold text-gray-900 leading-snug truncate">
                          {profileStudent.studentName}
                        </h3>
                        <div className="flex flex-wrap items-center justify-center sm:justify-start lg:justify-start gap-1.5 mt-2">
                          <span className="font-mono text-xs font-bold px-2.5 py-1 bg-white text-slate-800 rounded-lg border border-slate-200 shadow-2xs">
                            Roll: {profileStudent.rollNumber}
                          </span>
                          {profileStudent.batch && (
                            <span className="text-xs font-semibold px-2.5 py-1 bg-slate-200/70 text-slate-700 rounded-lg">
                              {profileStudent.batch}
                            </span>
                          )}
                        </div>
                        <div className="mt-3">
                          {isDeactivated ? (
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-300">
                              <UserX size={13} className="text-slate-600" /> Account Deactivated
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                              <ShieldCheck size={13} /> Active Aspirant
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Contact & Registration Details Card */}
                    <div className="p-4 rounded-2xl bg-white border border-gray-200/80 shadow-2xs space-y-2.5">
                      <div className="flex items-center gap-3 p-2.5 rounded-xl bg-gray-50/70">
                        <div className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-500 shrink-0">
                          <Mail size={14} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] uppercase font-bold text-gray-400">Email Address</p>
                          <p className="text-xs font-semibold text-gray-900 truncate">{profileStudent.email}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 p-2.5 rounded-xl bg-gray-50/70">
                        <div className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-500 shrink-0">
                          <Phone size={14} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] uppercase font-bold text-gray-400">Phone Number</p>
                          <p className="text-xs font-semibold text-gray-900 truncate">
                            {profileStudent.phone || "Not provided"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 p-2.5 rounded-xl bg-gray-50/70">
                        <div className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-500 shrink-0">
                          <BookOpen size={14} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] uppercase font-bold text-gray-400">Batch / Class</p>
                          <p className="text-xs font-semibold text-gray-900 truncate">
                            {profileStudent.batch || "General"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 p-2.5 rounded-xl bg-gray-50/70">
                        <div className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-500 shrink-0">
                          <Calendar size={14} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] uppercase font-bold text-gray-400">Enrolled On</p>
                          <p className="text-xs font-semibold text-gray-900 truncate">
                            {profileStudent.createdAt
                              ? new Date(profileStudent.createdAt).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })
                              : "Registered"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 p-2.5 rounded-xl bg-gray-50/70">
                        <div className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-500 shrink-0">
                          <KeyRound size={14} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] uppercase font-bold text-gray-400">Exam Password</p>
                          {profileStudent.examPassword ? (
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <span className="text-xs font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200 select-all">
                                {profileStudent.examPassword}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(profileStudent.examPassword || "")
                                  toast.success("Password copied to clipboard!")
                                }}
                                className="text-[10px] font-semibold text-[#324158] hover:underline cursor-pointer"
                              >
                                Copy
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <span className="text-[11px] font-medium text-amber-700">
                                Not recorded (legacy account)
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  const target = profileStudent
                                  setProfileStudent(null)
                                  openEditModal(target)
                                }}
                                className="text-[10px] font-bold text-[#324158] bg-white border border-slate-200 hover:bg-slate-100 px-2 py-0.5 rounded cursor-pointer transition-colors"
                              >
                                Set Password
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ── Right Column: Fees Breakdown & Exam Stats (7 Cols) ── */}
                  <div className="lg:col-span-7 space-y-4">
                    {/* Deactivation Notice Banner if deactivated */}
                    {isDeactivated && (
                      <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 text-white space-y-3 border border-slate-800 shadow-md">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div className="flex items-center gap-2">
                            <ShieldAlert className="text-slate-300 shrink-0" size={17} />
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                              Account Deactivated (Exam Login Blocked)
                            </span>
                          </div>
                          <button
                            type="button"
                            disabled={activatingId === profileStudent._id}
                            onClick={() => handleActivateStudent(profileStudent)}
                            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0 shadow-xs"
                          >
                            <UserCheck size={13} />
                            <span>{activatingId === profileStudent._id ? "Activating..." : "Activate Now"}</span>
                          </button>
                        </div>
                        <div className="p-3 bg-slate-800/90 rounded-xl border border-slate-700/80">
                          <p className="text-[10px] uppercase font-bold text-slate-400">
                            Reason shown to aspirant when attempting exam login:
                          </p>
                          <p className="text-xs text-white font-medium mt-1 leading-relaxed">
                            {profileStudent.deactivationReason || "Your aspirant account has been deactivated. Please contact your coaching administrator."}
                          </p>
                        </div>
                        <p className="text-[11px] text-slate-400">
                          This aspirant is currently locked out of all coaching exams. Click &ldquo;Activate Now&rdquo; to restore access.
                        </p>
                      </div>
                    )}

                    {/* Fees Breakdown Card */}
                    <div className="p-5 rounded-2xl bg-white border border-gray-200/90 shadow-2xs space-y-4">
                      <div className="flex items-center justify-between gap-2 pb-3 border-b border-gray-100">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
                            <CreditCard size={15} />
                          </div>
                          <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                            Coaching Fees Breakdown
                          </h3>
                        </div>
                        {total > 0 && (
                          <span
                            className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                              isPaidInFull
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-slate-100 text-slate-800 border-slate-200"
                            }`}
                          >
                            {isPaidInFull ? "Paid in Full" : `₹${pending.toLocaleString()} Balance Due`}
                          </span>
                        )}
                      </div>

                      {/* 3 Horizontal Stat Blocks */}
                      <div className="grid grid-cols-3 gap-2.5 sm:gap-3 text-center">
                        <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Fees</p>
                          <p className="text-sm sm:text-base font-extrabold text-gray-900 mt-1">
                            ₹{total.toLocaleString()}
                          </p>
                        </div>

                        <div className="p-3 bg-emerald-50/60 border border-emerald-100 rounded-xl">
                          <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Completed</p>
                          <p className="text-sm sm:text-base font-extrabold text-emerald-800 mt-1">
                            ₹{completed.toLocaleString()}
                          </p>
                        </div>

                        <div className="p-3 bg-slate-100/80 border border-slate-200 rounded-xl">
                          <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Pending</p>
                          <p className="text-sm sm:text-base font-extrabold text-slate-900 mt-1">
                            ₹{pending.toLocaleString()}
                          </p>
                        </div>
                      </div>

                      {total > 0 && (
                        <div className="space-y-1.5 pt-1">
                          <div className="flex items-center justify-between text-[11px] text-gray-500 font-medium">
                            <span>Fee Collection Progress</span>
                            <span className="font-bold text-gray-900">
                              {Math.min(100, Math.round((completed / (total || 1)) * 100))}%
                            </span>
                          </div>
                          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-600 rounded-full transition-all"
                              style={{
                                width: `${Math.min(100, Math.round((completed / (total || 1)) * 100))}%`,
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Academic & Exam Activity Card */}
                    <div className="p-5 rounded-2xl bg-white border border-gray-200/90 shadow-2xs space-y-4">
                      <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
                        <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
                          <Award size={15} />
                        </div>
                        <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                          Exam Activity & Performance
                        </h3>
                      </div>

                      <div className="grid grid-cols-3 gap-2.5 sm:gap-3 text-center">
                        <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Tests Taken</p>
                          <p className="text-base sm:text-lg font-extrabold text-gray-900 mt-1">
                            {profileStudent.totalAttempts}
                          </p>
                        </div>

                        <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Average Score</p>
                          <p className="text-base sm:text-lg font-extrabold text-gray-900 mt-1">
                            {profileStudent.avgPercentage != null ? `${Math.round(profileStudent.avgPercentage)}%` : "—"}
                          </p>
                        </div>

                        <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Last Test</p>
                          <p className="text-xs font-bold text-gray-800 mt-1.5 truncate">
                            {profileStudent.lastAttempt
                              ? new Date(profileStudent.lastAttempt).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })
                              : "No attempts"}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Portal Exam Credentials Notice */}
                    <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/70 flex items-start gap-3 text-xs text-slate-600">
                      <KeyRound size={15} className="text-[#324158] shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p className="leading-relaxed">
                          <strong className="text-slate-800 font-semibold">Aspirant Exam Login:</strong> Aspirant can log in to attend coaching tests with Roll Number (<strong>{profileStudent.rollNumber}</strong>) or registered email (<strong>{profileStudent.email}</strong>).
                        </p>
                        <p className="text-xs text-slate-700">
                          Password:{" "}
                          {profileStudent.examPassword ? (
                            <strong className="font-mono text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200 select-all">
                              {profileStudent.examPassword}
                            </strong>
                          ) : (
                            <span className="text-amber-700 font-medium">
                              Legacy encrypted password — click &ldquo;Set Password&rdquo; or &ldquo;Edit Aspirant&rdquo; to set a visible password.
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Bottom Footer Actions */}
              <div className="px-5 sm:px-7 py-3.5 bg-gray-50/90 border-t border-gray-100 flex items-center justify-end gap-2.5 sm:gap-3 shrink-0 flex-wrap">
                <button
                  type="button"
                  onClick={() => setProfileStudent(null)}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-white hover:border-gray-300 transition-colors cursor-pointer"
                >
                  Close
                </button>
                {isDeactivated ? (
                  <button
                    type="button"
                    disabled={activatingId === profileStudent._id}
                    onClick={() => handleActivateStudent(profileStudent)}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <UserCheck size={14} />
                    <span>{activatingId === profileStudent._id ? "Activating..." : "Activate Aspirant"}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      const target = profileStudent
                      setProfileStudent(null)
                      setDeactivateTarget(target)
                      setDeactivateReason("")
                    }}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <UserX size={14} className="text-slate-500" />
                    <span>Deactivate Aspirant</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    const studentToEdit = profileStudent
                    setProfileStudent(null)
                    openEditModal(studentToEdit)
                  }}
                  style={{ backgroundColor: themeColor || "#1E293B" }}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-xs hover:opacity-90 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Edit3 size={14} />
                  <span>Edit Aspirant</span>
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ═════════════════════════════════════════════════════════════════════
          BULK UPLOAD EXCEL MODAL
      ═════════════════════════════════════════════════════════════════════ */}
      {showBulkUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl sm:rounded-3xl border border-gray-200/90 bg-white shadow-2xl overflow-hidden my-auto">
            {/* Modal Header */}
            <div className="px-5 sm:px-6 py-4 border-b border-gray-100 flex items-start justify-between shrink-0 bg-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-center text-emerald-700 shrink-0">
                  <FileSpreadsheet size={20} />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-gray-900 leading-snug">
                    Upload Aspirants via Excel Sheet
                  </h2>
                  <p className="text-[11px] sm:text-xs text-gray-500">
                    Bulk-import students using `.xlsx`, `.xls`, or `.csv` files with instant row validation.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowBulkUpload(false)
                  resetBulkUploadState()
                }}
                className="p-1.5 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
                aria-label="Close bulk upload modal"
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
              {/* Step 1: Template Download & Required Columns Guide */}
              <div className="p-4 rounded-2xl bg-slate-50/90 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1.5 min-w-0">
                  <p className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Required &amp; Optional Columns
                  </p>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    <strong className="text-slate-900">Required:</strong>{" "}
                    <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 text-[11px]">Name</code>,{" "}
                    <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 text-[11px]">Email</code>,{" "}
                    <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 text-[11px]">Roll Number</code>,{" "}
                    <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 text-[11px]">Password</code> (min 6 chars)
                  </p>
                  <p className="text-[11px] text-slate-500">
                    <strong>Optional:</strong> Phone, Batch, Total Fees, Completed Fees
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadSampleExcel}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-xs font-bold text-slate-800 shadow-2xs transition-colors cursor-pointer shrink-0"
                >
                  <Download size={14} className="text-emerald-600" />
                  <span>Download Sample Excel</span>
                </button>
              </div>

              {/* Error Alert */}
              {bulkParseError && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700 flex items-center gap-2.5">
                  <AlertCircle size={15} className="shrink-0 text-red-600" />
                  <span>{bulkParseError}</span>
                </div>
              )}

              {/* Success / Result Summary */}
              {bulkResult && (
                <div className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50/70 space-y-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2.5">
                      <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                      <div>
                        <p className="text-sm font-bold text-emerald-950">
                          Import Completed: {bulkResult.createdCount} aspirant{bulkResult.createdCount === 1 ? "" : "s"} added
                        </p>
                        {bulkResult.skippedCount > 0 && (
                          <p className="text-xs text-amber-800 font-medium">
                            {bulkResult.skippedCount} row{bulkResult.skippedCount === 1 ? "" : "s"} skipped due to conflicts or validation rules.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  {bulkResult.skippedRows.length > 0 && (
                    <div className="max-h-36 overflow-y-auto rounded-xl border border-amber-200 bg-white divide-y divide-amber-100 text-xs">
                      {bulkResult.skippedRows.map((sr, i) => (
                        <div key={i} className="px-3 py-2 flex items-center justify-between gap-3">
                          <span className="font-semibold text-slate-800 truncate">
                            Row {sr.rowNumber}: {sr.name || sr.email || sr.rollNumber || "Empty"}
                          </span>
                          <span className="text-amber-700 font-medium shrink-0">{sr.reason}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Step 2: File Upload Area */}
              {bulkRows.length === 0 ? (
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault()
                    const droppedFile = e.dataTransfer.files?.[0]
                    handleExcelFileChange(droppedFile)
                  }}
                  className="border-2 border-dashed border-slate-300 hover:border-slate-400 rounded-2xl p-8 sm:p-10 text-center bg-slate-50/40 transition-colors"
                >
                  <input
                    ref={bulkFileInputRef}
                    id="bulk-excel-upload-input"
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={(e) => handleExcelFileChange(e.target.files?.[0])}
                    className="hidden"
                  />
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3 border border-emerald-200/70">
                    <Upload size={22} />
                  </div>
                  <p className="text-sm font-bold text-slate-800">
                    Drag &amp; drop your Excel sheet here
                  </p>
                  <p className="text-xs text-slate-500 mt-1 mb-4">
                    Supports `.xlsx`, `.xls`, and `.csv` up to 500 students per sheet (max 5MB)
                  </p>
                  <label
                    htmlFor="bulk-excel-upload-input"
                    style={{ backgroundColor: themeColor || "#1E293B" }}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-xs hover:opacity-90 cursor-pointer transition-all"
                  >
                    <FileSpreadsheet size={15} />
                    <span>Choose Excel File</span>
                  </label>
                </div>
              ) : (
                /* Step 3: Preview Parsed Rows */
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      <span className="font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                        {bulkFileName}
                      </span>
                      <span className="font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                        {bulkRows.filter((r) => !r.error).length} Ready to Import
                      </span>
                      {bulkRows.some((r) => r.error) && (
                        <span className="font-semibold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200">
                          {bulkRows.filter((r) => r.error).length} Skipped / Invalid
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={resetBulkUploadState}
                      className="text-xs font-semibold text-slate-600 hover:text-slate-900 underline cursor-pointer self-start sm:self-auto"
                    >
                      Choose Another File
                    </button>
                  </div>

                  <div className="rounded-2xl border border-slate-200 overflow-auto max-h-72">
                    <table className="w-full min-w-[760px] text-left border-collapse text-xs">
                      <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200">
                        <tr className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                          <th className="px-3.5 py-2.5">Row</th>
                          <th className="px-3.5 py-2.5">Name</th>
                          <th className="px-3.5 py-2.5">Email</th>
                          <th className="px-3.5 py-2.5">Roll No</th>
                          <th className="px-3.5 py-2.5">Phone</th>
                          <th className="px-3.5 py-2.5">Batch</th>
                          <th className="px-3.5 py-2.5">Fees (Paid / Total)</th>
                          <th className="px-3.5 py-2.5">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {bulkRows.map((row) => (
                          <tr
                            key={row.rowNumber}
                            className={row.error ? "bg-rose-50/40" : "hover:bg-slate-50/60"}
                          >
                            <td className="px-3.5 py-2 font-mono text-slate-400">#{row.rowNumber}</td>
                            <td className="px-3.5 py-2 font-semibold text-slate-900">{row.name || "—"}</td>
                            <td className="px-3.5 py-2 text-slate-600">{row.email || "—"}</td>
                            <td className="px-3.5 py-2 font-mono text-slate-700">{row.rollNumber || "—"}</td>
                            <td className="px-3.5 py-2 text-slate-600">{row.phone || "—"}</td>
                            <td className="px-3.5 py-2 text-slate-600">{row.batch || "—"}</td>
                            <td className="px-3.5 py-2 text-slate-700">
                              ₹{row.completedFees.toLocaleString()} / ₹{row.totalFees.toLocaleString()}
                            </td>
                            <td className="px-3.5 py-2 whitespace-nowrap">
                              {row.error ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                                  {row.error}
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                  Ready
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 sm:px-6 py-3.5 bg-gray-50/90 border-t border-gray-100 flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setShowBulkUpload(false)
                  resetBulkUploadState()
                }}
                className="px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-white hover:border-gray-300 transition-colors cursor-pointer"
              >
                Close
              </button>
              {!bulkResult && (
                <button
                  type="button"
                  onClick={handleConfirmBulkUpload}
                  disabled={uploadingBulk || bulkRows.filter((r) => !r.error).length === 0}
                  style={{ backgroundColor: themeColor || "#1E293B" }}
                  className="px-6 py-2.5 rounded-xl text-xs font-bold text-white shadow-xs hover:opacity-90 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer flex items-center gap-2"
                >
                  {uploadingBulk ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Importing Aspirants...</span>
                    </>
                  ) : (
                    <>
                      <Upload size={14} />
                      <span>
                        Import {bulkRows.filter((r) => !r.error).length || ""} Aspirant
                        {bulkRows.filter((r) => !r.error).length === 1 ? "" : "s"}
                      </span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <Toaster />
    </div>
  )
}
