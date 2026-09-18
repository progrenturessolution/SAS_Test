import { useEffect, useRef, useCallback, useState } from "react"

export interface ProctoringEvent {
  type: "tab-switch" | "face-not-detected" | "fullscreen-exit" | "multiple-faces" | "no-face"
  timestamp: Date
  details?: string
}

export interface ProctoringState {
  warnings: number
  events: ProctoringEvent[]
  autoSubmitted: boolean
  isFullscreen: boolean
}

interface UseProctoringOptions {
  attemptId: string | null
  maxWarnings: number
  enableFaceDetection: boolean
  enableTabSwitch: boolean
  enableFullscreen: boolean
  onAutoSubmit: () => void
  onWarning: (type: string, count: number) => void
  initialWarnings?: number
  isActive?: boolean
}

export function useProctoring({
  attemptId,
  maxWarnings,
  enableFaceDetection,
  enableTabSwitch,
  enableFullscreen,
  onAutoSubmit,
  onWarning,
  initialWarnings = 0,
  isActive = true,
}: UseProctoringOptions) {
  const [state, setState] = useState<ProctoringState>({
    warnings: initialWarnings,
    events: [],
    autoSubmitted: false,
    isFullscreen: true,
  })

  const stateRef = useRef(state)
  stateRef.current = state
  const autoSubmittedRef = useRef(false)

  // Log event to DB and update local state
  const logEvent = useCallback(
    async (type: ProctoringEvent["type"], details?: string) => {
      if (autoSubmittedRef.current) return

      const event: ProctoringEvent = { type, timestamp: new Date(), details }

      setState((prev) => {
        const newWarnings = prev.warnings + 1
        const newEvents = [...prev.events, event]

        if (attemptId) {
          fetch(`/api/attempts/${attemptId}/proctor`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ event, warnings: newWarnings }),
          }).catch(() => { })
        }

        onWarning(type, newWarnings)

        if (newWarnings >= maxWarnings && !autoSubmittedRef.current) {
          autoSubmittedRef.current = true
          setTimeout(() => onAutoSubmit(), 1500)
          return { warnings: newWarnings, events: newEvents, autoSubmitted: true, isFullscreen: prev.isFullscreen }
        }

        return { warnings: newWarnings, events: newEvents, autoSubmitted: false, isFullscreen: prev.isFullscreen }
      })
    },
    [attemptId, maxWarnings, onAutoSubmit, onWarning]
  )

  // Tab switch / visibility change & Window Blur
  useEffect(() => {
    if (!enableTabSwitch || !isActive) return

    const handleVisibility = () => {
      if (document.hidden) {
        logEvent("tab-switch", "Window hidden (switched tab or minimized)")
      }
    }

    const handleBlur = () => {
      // Small delay to check if it's actually hidden or just clicking a UI element/os dialog
      // This reduces false positives from some browser extensions or system popups
      setTimeout(() => {
        if (!document.hasFocus()) {
          logEvent("tab-switch", "Window lost focus (clicked outside or Alt+Tab)")
        }
      }, 100)
    }

    document.addEventListener("visibilitychange", handleVisibility)
    window.addEventListener("blur", handleBlur)

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility)
      window.removeEventListener("blur", handleBlur)
    }
  }, [enableTabSwitch, logEvent, isActive])

  // Fullscreen exit
  useEffect(() => {
    if (!enableFullscreen || !isActive) return
    const handleFullscreen = () => {
      setState(prev => ({ ...prev, isFullscreen: !!document.fullscreenElement }))
    }
    document.addEventListener("fullscreenchange", handleFullscreen)

    // Initial check
    handleFullscreen()

    return () => document.removeEventListener("fullscreenchange", handleFullscreen)
  }, [enableFullscreen, isActive])

  // Request fullscreen on mount
  const requestFullscreen = useCallback(() => {
    if (enableFullscreen && document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => { })
    }
  }, [enableFullscreen])

  return { state, logEvent, requestFullscreen }
}