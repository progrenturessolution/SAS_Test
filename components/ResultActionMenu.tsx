"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { createPortal } from "react-dom"
import Link from "next/link"
import { MoreVertical, Award, ShieldAlert, BarChart2, ExternalLink } from "lucide-react"

interface ResultActionMenuProps {
  result: {
    _id: string
    examId?: string
    studentName: string
    rollNumber: string
    isGraded?: boolean
  }
}

interface MenuPosition {
  top?: number
  bottom?: number
  left: number
  maxHeight: number
}

export function ResultActionMenu({ result }: ResultActionMenuProps) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [menuPos, setMenuPos] = useState<MenuPosition>({ top: 0, left: 0, maxHeight: 300 })
  const menuRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const viewportHeight = window.innerHeight
    const viewportWidth = window.innerWidth

    if (rect.bottom < 0 || rect.top > viewportHeight) {
      setOpen(false)
      return
    }

    const menuWidth = 210
    const menuEstimatedHeight = 180

    let left = rect.right - menuWidth
    if (left < 8) left = 8
    if (left + menuWidth > viewportWidth - 8) {
      left = Math.max(8, viewportWidth - menuWidth - 8)
    }

    const spaceBelow = viewportHeight - rect.bottom
    const spaceAbove = rect.top

    if (spaceBelow < menuEstimatedHeight && spaceAbove > spaceBelow) {
      setMenuPos({
        top: undefined,
        bottom: viewportHeight - rect.top + 6,
        left,
        maxHeight: Math.max(140, spaceAbove - 16),
      })
    } else {
      setMenuPos({
        top: rect.bottom + 6,
        bottom: undefined,
        left,
        maxHeight: Math.max(140, spaceBelow - 16),
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

  const analyticsUrl = result.examId
    ? `/exam/${result.examId}/result/analytics?attemptId=${result._id}`
    : `/exam/result/analytics?attemptId=${result._id}`

  const resultCardUrl = result.examId
    ? `/exam/${result.examId}/result?attemptId=${result._id}`
    : `/exam/result?attemptId=${result._id}`

  return (
    <div className="relative inline-block text-left">
      <button
        ref={triggerRef}
        type="button"
        onClick={handleOpen}
        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
        title="More actions"
        aria-label="Actions"
      >
        <MoreVertical size={16} />
      </button>

      {mounted &&
        open &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              position: "fixed",
              top: menuPos.top !== undefined ? `${menuPos.top}px` : "auto",
              bottom: menuPos.bottom !== undefined ? `${menuPos.bottom}px` : "auto",
              left: `${menuPos.left}px`,
              maxHeight: `${menuPos.maxHeight}px`,
              zIndex: 9999,
            }}
            className="w-52 rounded-2xl bg-white border border-slate-200/90 shadow-xl py-1.5 overflow-y-auto text-xs font-medium text-slate-700 animate-in fade-in-0 zoom-in-95 duration-100"
          >
            {/* Review & Grade */}
            <Link
              href={`/admin/results/${result._id}/review`}
              onClick={() => setOpen(false)}
              className="flex items-center justify-between px-3.5 py-2 hover:bg-slate-50 hover:text-slate-900 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <Award size={14} className="text-slate-500" />
                <span className="font-semibold text-slate-800">Review &amp; Grade</span>
              </div>
              {!result.isGraded && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200/60">
                  Pending
                </span>
              )}
            </Link>

            {/* Proctoring Logs */}
            <Link
              href={`/admin/results/${result._id}`}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3.5 py-2 hover:bg-slate-50 hover:text-slate-900 transition-colors"
            >
              <ShieldAlert size={14} className="text-slate-500" />
              <span>Proctoring Logs</span>
            </Link>

            <div className="my-1 border-t border-slate-100" />

            {/* Comprehensive Analytics */}
            <Link
              href={analyticsUrl}
              target="_blank"
              onClick={() => setOpen(false)}
              className="flex items-center justify-between px-3.5 py-2 hover:bg-slate-50 hover:text-slate-900 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <BarChart2 size={14} className="text-slate-500" />
                <span>View Analytics</span>
              </div>
              <ExternalLink size={11} className="text-slate-400" />
            </Link>

            {/* Student Result Card */}
            <Link
              href={resultCardUrl}
              target="_blank"
              onClick={() => setOpen(false)}
              className="flex items-center justify-between px-3.5 py-2 hover:bg-slate-50 hover:text-slate-900 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <ExternalLink size={14} className="text-slate-500" />
                <span>Result Summary</span>
              </div>
            </Link>
          </div>,
          document.body
        )}
    </div>
  )
}

