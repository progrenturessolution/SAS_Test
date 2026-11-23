"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { createPortal } from "react-dom"
import Link from "next/link"
import { Eye, EyeOff, Pencil, Trash2, Link2, BarChart2, Share2, MoreVertical, Check, Globe } from "lucide-react"
import { toast } from "sonner"
import { getExamEditUrl } from "@/lib/examEditHelper"

interface ExamActionMenuProps {
  exam: {
    _id: string
    title: string
    status: string
    examType?: string
    subject?: string
  }
  onToggleStatus: (id: string, status: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onShare: (id: string, email: string) => Promise<void>
  onCopy: (id: string) => void
  onCopyPublic?: (id: string) => void
  copied: boolean
  copiedPublic?: boolean
}

interface MenuPosition {
  top?: number
  bottom?: number
  left: number
  maxHeight: number
}

export function ExamActionMenu({
  exam,
  onToggleStatus,
  onDelete,
  onShare,
  onCopy,
  onCopyPublic,
  copied,
  copiedPublic = false,
}: ExamActionMenuProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [localCopiedPublic, setLocalCopiedPublic] = useState(false)
  const [menuPos, setMenuPos] = useState<MenuPosition>({ top: 0, left: 0, maxHeight: 300 })
  const menuRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const viewportHeight = window.innerHeight
    const viewportWidth = window.innerWidth

    // If trigger button is scrolled completely outside viewport, dismiss menu
    if (rect.bottom < 0 || rect.top > viewportHeight) {
      setOpen(false)
      return
    }

    const menuWidth = 192 // w-48 (12rem)
    const menuEstimatedHeight = 265

    // Clamp horizontal position so menu stays within viewport
    let left = rect.right - menuWidth
    if (left < 8) left = 8
    if (left + menuWidth > viewportWidth - 8) {
      left = Math.max(8, viewportWidth - menuWidth - 8)
    }

    const spaceBelow = viewportHeight - rect.bottom
    const spaceAbove = rect.top

    // If not enough space below AND more space above, open UPWARDS
    if (spaceBelow < menuEstimatedHeight && spaceAbove > spaceBelow) {
      setMenuPos({
        top: undefined,
        bottom: viewportHeight - rect.top + 6,
        left,
        maxHeight: Math.max(160, spaceAbove - 16),
      })
    } else {
      // Otherwise open DOWNWARDS
      setMenuPos({
        top: rect.bottom + 6,
        bottom: undefined,
        left,
        maxHeight: Math.max(160, spaceBelow - 16),
      })
    }
  }, [])

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) return

    function handleClickOutside(e: MouseEvent | TouchEvent) {
      const target = e.target as Node
      if (
        menuRef.current &&
        !menuRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        setOpen(false)
      }
    }

    function handleScrollOrResize() {
      updatePosition()
    }

    // Capture phase listener catches scroll events from <main>, window, or any scrollable container
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
  }, [open, updatePosition])

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!open) {
      updatePosition()
      setOpen(true)
    } else {
      setOpen(false)
    }
  }

  const handleToggleStatus = async () => {
    setLoading(true)
    try {
      await onToggleStatus(exam._id, exam.status)
      const newStatus = exam.status === "active" ? "draft" : "active"
      toast.success(newStatus === "active" ? "Published successfully" : "Unpublished successfully")
      setOpen(false)
    } catch {
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
    } catch {
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
    } catch {
      toast.error("Failed to share exam")
    } finally {
      setLoading(false)
    }
  }

  const isPublicCopied = copiedPublic || localCopiedPublic

  const handleCopy = () => {
    onCopy(exam._id)
    toast.success("Link copied to clipboard")
    setOpen(false)
  }

  const handleCopyPublic = () => {
    if (onCopyPublic) {
      onCopyPublic(exam._id)
    } else {
      navigator.clipboard.writeText(`${window.location.origin}/exam/${exam._id}?type=public`)
      setLocalCopiedPublic(true)
      setTimeout(() => setLocalCopiedPublic(false), 2000)
      toast.success("Public exam link copied! Anyone can take this exam without institute login.")
    }
    setOpen(false)
  }

  return (
    <div className="relative inline-block text-left">
      <button
        ref={triggerRef}
        type="button"
        onClick={handleOpen}
        className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-500 hover:text-gray-700"
        title="More options"
        aria-label="More options"
      >
        <MoreVertical size={16} />
      </button>

      {open && mounted && createPortal(
        <>
          {/* Invisible backdrop to dismiss whenever clicking anywhere on screen */}
          <div
            className="fixed inset-0 cursor-default"
            style={{ zIndex: 9998 }}
            onClick={(e) => {
              e.stopPropagation()
              setOpen(false)
            }}
          />
          <div
            ref={menuRef}
            style={{
              position: "fixed",
              top: menuPos.top !== undefined ? `${menuPos.top}px` : undefined,
              bottom: menuPos.bottom !== undefined ? `${menuPos.bottom}px` : undefined,
              left: `${menuPos.left}px`,
              maxHeight: `${menuPos.maxHeight}px`,
              zIndex: 9999,
            }}
            className="w-48 bg-white border border-gray-200 rounded-xl shadow-xl z-[9999] overflow-y-auto overscroll-contain divide-y divide-gray-100"
          >
          {/* Status Toggle */}
          <button
            type="button"
            onClick={handleToggleStatus}
            disabled={loading}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 hover:bg-[#eaf0f8] hover:text-[#324158] transition-colors text-sm text-left font-medium text-gray-700"
          >
            {exam.status === "active" ? (
              <>
                <Eye size={15} className="text-[#324158] shrink-0" />
                <span className="flex-1">Unpublish</span>
                <span className="text-[10px] font-semibold bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Active</span>
              </>
            ) : (
              <>
                <EyeOff size={15} className="text-[#324158] shrink-0" />
                <span className="flex-1">Publish</span>
                <span className="text-[10px] font-semibold bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">Draft</span>
              </>
            )}
          </button>

          {/* Copy Link */}
          <button
            type="button"
            onClick={handleCopy}
            disabled={loading}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 hover:bg-[#eaf0f8] hover:text-[#324158] transition-colors text-sm text-left font-medium text-gray-700"
          >
            {copied ? (
              <>
                <Check size={15} className="text-[#324158] shrink-0" />
                <span className="flex-1 text-[#324158]">Link Copied!</span>
              </>
            ) : (
              <>
                <Link2 size={15} className="text-[#324158] shrink-0" />
                <span className="flex-1">Copy Link</span>
              </>
            )}
          </button>

          {/* Copy Public Link */}
          <button
            type="button"
            onClick={handleCopyPublic}
            disabled={loading}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 hover:bg-[#eaf0f8] hover:text-[#324158] transition-colors text-sm text-left font-medium text-gray-700"
          >
            {isPublicCopied ? (
              <>
                <Check size={15} className="text-emerald-600 shrink-0" />
                <span className="flex-1 text-emerald-700 font-semibold">Public Link Copied!</span>
              </>
            ) : (
              <>
                <Globe size={15} className="text-[#324158] shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="block leading-tight">Copy Public Link</span>
                  <span className="text-[10px] text-gray-400 block font-normal">Open to any aspirant</span>
                </div>
                <span className="text-[10px] font-bold bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-200/60 shrink-0">Public</span>
              </>
            )}
          </button>

          {/* Edit */}
          <Link
            href={getExamEditUrl(exam)}
            onClick={() => setOpen(false)}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 hover:bg-[#eaf0f8] hover:text-[#324158] transition-colors text-sm font-medium text-gray-700"
          >
            <Pencil size={15} className="text-[#324158] shrink-0" />
            <span className="flex-1">Edit Exam</span>
          </Link>

          {/* View Results */}
          <Link
            href={`/admin/results?examId=${exam._id}`}
            onClick={() => setOpen(false)}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 hover:bg-[#eaf0f8] hover:text-[#324158] transition-colors text-sm font-medium text-gray-700"
          >
            <BarChart2 size={15} className="text-[#324158] shrink-0" />
            <span className="flex-1">View Results</span>
          </Link>

          {/* Share */}
          <button
            type="button"
            onClick={handleShare}
            disabled={loading}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 hover:bg-[#eaf0f8] hover:text-[#324158] transition-colors text-sm text-left font-medium text-gray-700"
          >
            <Share2 size={15} className="text-[#324158] shrink-0" />
            <span className="flex-1">Share Exam</span>
          </button>

          {/* Delete - Always visible, never cut off */}
          <button
            type="button"
            onClick={handleDelete}
            disabled={loading}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 hover:bg-red-50 text-red-600 transition-colors text-sm text-left font-medium"
          >
            <Trash2 size={15} className="text-[#324158] group-hover:text-red-600 shrink-0" />
            <span className="flex-1">Delete Exam</span>
          </button>
        </div>
      </>,
      document.body
    )}
    </div>
  )
}

