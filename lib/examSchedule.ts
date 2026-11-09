export interface ExamScheduleSettings {
  startDate?: string | Date
  startTime?: string
  endDate?: string | Date
  endTime?: string
}

/**
 * Parses startDate (string or Date) and optional startTime ("HH:mm")
 * into a local Date object.
 */
export function getExamStartDateTime(settings?: ExamScheduleSettings): Date | null {
  if (!settings?.startDate) return null
  try {
    // 1. If it's already a Date instance, return it directly
    if (settings.startDate instanceof Date) {
      return isNaN(settings.startDate.getTime()) ? null : settings.startDate
    }

    if (typeof settings.startDate === "string") {
      const trimmed = settings.startDate.trim()
      // 2. If it's an ISO timestamp (e.g. "2026-10-14T20:00:00.000Z"), parse it directly!
      // DO NOT split on "T" because that extracts the UTC date which causes timezone day shifts!
      if (trimmed.includes("T")) {
        const parsed = new Date(trimmed)
        if (!isNaN(parsed.getTime())) return parsed
      }

      // 3. If it's a plain local date string "YYYY-MM-DD" from form inputs
      const datePart = trimmed
      const timePart = settings.startTime || "00:00"
      const [y, m, d] = datePart.split("-").map(Number)
      const [hours, mins] = timePart.split(":").map(Number)
      if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
        const dt = new Date(y, m - 1, d, hours || 0, mins || 0, 0, 0)
        return isNaN(dt.getTime()) ? null : dt
      }
    }

    const fallback = new Date(settings.startDate)
    return isNaN(fallback.getTime()) ? null : fallback
  } catch {
    return null
  }
}

/**
 * Parses endDate (string or Date) and optional endTime ("HH:mm")
 * into a local Date object. Defaults to 23:59:59 if endTime is omitted.
 */
export function getExamEndDateTime(settings?: ExamScheduleSettings): Date | null {
  if (!settings?.endDate) return null
  try {
    // 1. If it's already a Date instance, return it directly
    if (settings.endDate instanceof Date) {
      return isNaN(settings.endDate.getTime()) ? null : settings.endDate
    }

    if (typeof settings.endDate === "string") {
      const trimmed = settings.endDate.trim()
      // 2. If it's an ISO timestamp (e.g. "2026-10-14T21:00:00.000Z"), parse it directly!
      if (trimmed.includes("T")) {
        const parsed = new Date(trimmed)
        if (!isNaN(parsed.getTime())) return parsed
      }

      // 3. If it's a plain local date string "YYYY-MM-DD" from form inputs
      const datePart = trimmed
      const timePart = settings.endTime || "23:59"
      const [y, m, d] = datePart.split("-").map(Number)
      const [hours, mins] = timePart.split(":").map(Number)
      if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
        const dt = new Date(y, m - 1, d, hours ?? 23, mins ?? 59, 59, 999)
        return isNaN(dt.getTime()) ? null : dt
      }
    }

    const fallback = new Date(settings.endDate)
    return isNaN(fallback.getTime()) ? null : fallback
  } catch {
    return null
  }
}

/**
 * Formats seconds into human-readable countdown:
 * "1d 02h 15m" or "02:15:30" or "05:42"
 */
export function formatCountdown(totalSeconds: number): string {
  if (totalSeconds <= 0) return "00:00"
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`
  }
  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
  }
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
}

/**
 * Formats a Date object into readable string:
 * e.g., "Thu, Oct 15, 2026, 2:30 PM"
 */
export function formatScheduleDateTime(d: Date | null): string {
  if (!d) return ""
  return d.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
}

/**
 * Number of seconds before exam start time when candidates are permitted
 * to enter the setup screen to configure their camera, verify permissions, and review instructions.
 */
export const SETUP_WINDOW_SECONDS = 5 * 60 // 5 minutes (300 seconds)

/**
 * Evaluates the schedule status relative to current timestamp
 */
export function getScheduleStatus(settings?: ExamScheduleSettings, now: number = Date.now()) {
  const startDt = getExamStartDateTime(settings)
  const endDt = getExamEndDateTime(settings)

  const isBeforeStart = startDt ? now < startDt.getTime() : false
  const isAfterEnd = endDt ? now > endDt.getTime() : false
  const canStart = !isBeforeStart && !isAfterEnd

  const secondsUntilStart = startDt && isBeforeStart ? Math.ceil((startDt.getTime() - now) / 1000) : 0
  const secondsUntilEnd = endDt ? Math.max(0, Math.floor((endDt.getTime() - now) / 1000)) : null

  // Candidates can enter the setup/instructions screen if the exam is not ended AND
  // (exam is already started OR we are within 5 minutes of start time)
  const canEnterSetup = !isAfterEnd && (
    !startDt ||
    !isBeforeStart ||
    secondsUntilStart <= SETUP_WINDOW_SECONDS
  )

  const secondsUntilSetup = startDt && secondsUntilStart > SETUP_WINDOW_SECONDS
    ? secondsUntilStart - SETUP_WINDOW_SECONDS
    : 0

  return {
    startDt,
    endDt,
    isBeforeStart,
    isAfterEnd,
    canStart,
    canEnterSetup,
    secondsUntilStart,
    secondsUntilSetup,
    secondsUntilEnd,
  }
}
