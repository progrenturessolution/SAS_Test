"use client"

import { useState, useRef, useEffect } from "react"
import { createPortal } from "react-dom"
import Link from "next/link"
import { Eye, EyeOff, Pencil, Trash2, Link2, BarChart2, Share2, MoreVertical, Copy, Check } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { toast } from "sonner"

interface ExamActionMenuProps {
  exam: {
    _id: string
    title: string
    status: string
  }
  onToggleStatus: (id: string, status: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onShare: (id: string, email: string) => Promise<void>
  onCopy: (id: string) => void
  copied: boolean
}

export function ExamActionMenu({
  exam,
  onToggleStatus,
  onDelete,
  onShare,
  onCopy,
  copied,
}: ExamActionMenuProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 })
  const menuRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const { toast: uiToast } = useToast()

  useEffect(() => {
    setMounted(true)
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node) && 
          triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside)
      window.addEventListener("scroll", () => setOpen(false), { once: true })
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [open])

  const handleOpen = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setMenuPos({
      top: rect.bottom + window.scrollY + 8,
      left: rect.right - 192 // width of menu
    })
    setOpen(!open)
  }

  const handleToggleStatus = async () => {
    setLoading(true)
    try {
      await onToggleStatus(exam._id, exam.status)
      const newStatus = exam.status === "active" ? "draft" : "active"
      toast.success(newStatus === "active" ? "Published successfully" : "Unpublished successfully")
      setOpen(false)
    } catch (error) {
      toast.error("Failed to update exam status")
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm(`Delete "${exam.title}"? This action cannot be undone.`)) return
    setLoading(true)
    try {
      await onDelete(exam._id)
      toast.success("Exam deleted successfully")
      setOpen(false)
    } catch (error) {
      toast.error("Failed to delete exam")
    } finally {
      setLoading(false)
    }
  }

  const handleShare = async () => {
    const email = prompt("Enter the email of the person you want to share this exam with:")
    if (!email) return
    setLoading(true)
    try {
      await onShare(exam._id, email)
      toast.success(`Exam shared with ${email}`)
      setOpen(false)
    } catch (error) {
      toast.error("Failed to share exam")
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = () => {
    onCopy(exam._id)
    toast.success("Link copied to clipboard")
    setOpen(false)
  }

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        onClick={handleOpen}
        className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
        title="More options"
      >
        <MoreVertical size={16} className="text-gray-500 hover:text-gray-700" />
      </button>

      {open && mounted && createPortal(
        <div 
          ref={menuRef}
          style={{ position: "absolute", top: menuPos.top, left: menuPos.left }}
          className="w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-[9999] overflow-hidden"
        >
          {/* Status Toggle */}
          <button
            onClick={handleToggleStatus}
            disabled={loading}
            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors text-sm text-left border-b border-gray-100"
          >
            {exam.status === "active" ? (
              <>
                <Eye size={14} className="text-blue-500" />
                <span className="flex-1">Unpublish</span>
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Active</span>
              </>
            ) : (
              <>
                <EyeOff size={14} className="text-gray-400" />
                <span className="flex-1">Publish</span>
                <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">Draft</span>
              </>
            )}
          </button>

          {/* Copy Link */}
          <button
            onClick={handleCopy}
            disabled={loading}
            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors text-sm text-left border-b border-gray-100"
          >
            {copied ? (
              <>
                <Check size={14} className="text-green-500" />
                <span className="flex-1">Link Copied</span>
              </>
            ) : (
              <>
                <Link2 size={14} className="text-gray-500" />
                <span className="flex-1">Copy Link</span>
              </>
            )}
          </button>

          {/* Edit */}
          <Link
            href={`/admin/exams/${exam._id}/edit`}
            onClick={() => setOpen(false)}
            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors text-sm border-b border-gray-100"
          >
            <Pencil size={14} className="text-emerald-500" />
            <span className="flex-1">Edit</span>
          </Link>

          {/* View Results */}
          <Link
            href={`/admin/results?examId=${exam._id}`}
            onClick={() => setOpen(false)}
            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors text-sm border-b border-gray-100"
          >
            <BarChart2 size={14} className="text-purple-500" />
            <span className="flex-1">Results</span>
          </Link>

          {/* Share */}
          <button
            onClick={handleShare}
            disabled={loading}
            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors text-sm border-b border-gray-100 text-left"
          >
            <Share2 size={14} className="text-blue-500" />
            <span className="flex-1">Share Exam</span>
          </button>

          {/* Delete - Red warning style */}
          <button
            onClick={handleDelete}
            disabled={loading}
            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-red-50 transition-colors text-sm text-red-600"
          >
            <Trash2 size={14} />
            <span className="flex-1">Delete</span>
          </button>
        </div>,
        document.body
      )}
    </div>
  )
}

