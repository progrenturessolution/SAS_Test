"use client"

import React, { useState, useEffect, useMemo } from "react"
import { Calendar as CalendarIcon, Clock, ChevronLeft, ChevronRight } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface ExamDateTimePickerProps {
  label: string
  sublabel?: string
  date: string // "YYYY-MM-DD"
  time: string // "HH:mm" (24-hour format)
  onDateChange: (date: string) => void
  onTimeChange: (time: string) => void
  minDate?: string
  referenceStart?: { date: string; time: string } // For end-time shortcuts (+30m, +1h, etc.)
  accentColor?: "blue" | "emerald" | "default"
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
]

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]

const COMMON_MINUTES = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"]

export function ExamDateTimePicker({
  label,
  sublabel,
  date,
  time,
  onDateChange,
  onTimeChange,
  minDate,
  referenceStart,
  accentColor = "default",
}: ExamDateTimePickerProps) {
  const [popoverOpen, setPopoverOpen] = useState(false)

  // Current view month & year for calendar
  const initialDateObj = useMemo(() => {
    if (date) {
      if (date.includes("T")) {
        const dObj = new Date(date)
        if (!isNaN(dObj.getTime())) return dObj
      }
      const [y, m, d] = date.split("-").map(Number)
      if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
        return new Date(y, m - 1, d)
      }
    }
    return new Date()
  }, [date])

  const [viewYear, setViewYear] = useState(initialDateObj.getFullYear())
  const [viewMonth, setViewMonth] = useState(initialDateObj.getMonth())

  useEffect(() => {
    if (date) {
      if (date.includes("T")) {
        const dObj = new Date(date)
        if (!isNaN(dObj.getTime())) {
          setViewYear(dObj.getFullYear())
          setViewMonth(dObj.getMonth())
          return
        }
      }
      const [y, m, d] = date.split("-").map(Number)
      if (!isNaN(y) && !isNaN(m)) {
        setViewYear(y)
        setViewMonth(m - 1)
      }
    }
  }, [date])

  // Convert 24h string ("HH:mm") to 12h representation
  const { hour12, minute, period } = useMemo(() => {
    if (!time) {
      return { hour12: "10", minute: "00", period: "AM" }
    }
    const [hStr, mStr] = time.split(":")
    const rawH = parseInt(hStr || "0", 10)
    const m = mStr ? mStr.padStart(2, "0") : "00"
    const p = rawH >= 12 ? "PM" : "AM"
    const h = rawH % 12 === 0 ? 12 : rawH % 12
    return {
      hour12: String(h).padStart(2, "0"),
      minute: m,
      period: p,
    }
  }, [time])

  // Convert 12h back to 24h string ("HH:mm")
  const updateTime12 = (newH12: string, newM: string, newP: string) => {
    let h24 = parseInt(newH12, 10)
    if (newP === "PM" && h24 < 12) h24 += 12
    if (newP === "AM" && h24 === 12) h24 = 0
    const formatted = `${String(h24).padStart(2, "0")}:${newM.padStart(2, "0")}`
    onTimeChange(formatted)
  }

  // Ensure current minute and 59 (End of Day) are always selectable
  const minuteOptions = useMemo(() => {
    const set = new Set([...COMMON_MINUTES, "59"])
    if (minute) set.add(minute)
    return Array.from(set).sort((a, b) => parseInt(a, 10) - parseInt(b, 10))
  }, [minute])

  // Calendar calculations
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const firstDayWeekday = new Date(viewYear, viewMonth, 1).getDay()

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11)
      setViewYear(y => y - 1)
    } else {
      setViewMonth(m => m - 1)
    }
  }

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0)
      setViewYear(y => y + 1)
    } else {
      setViewMonth(m => m + 1)
    }
  }

  const selectDay = (day: number) => {
    const formattedDate = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
    onDateChange(formattedDate)
    setPopoverOpen(false)
  }

  // Quick Date Setters
  const setQuickDate = (offsetDays: number) => {
    const d = new Date()
    d.setDate(d.getDate() + offsetDays)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, "0")
    const day = String(d.getDate()).padStart(2, "0")
    onDateChange(`${y}-${m}-${day}`)
    setViewYear(y)
    setViewMonth(d.getMonth())
    setPopoverOpen(false)
  }

  // Human-readable formatted date
  const displayFormattedDate = useMemo(() => {
    if (!date) return "Select Date"
    try {
      if (date.includes("T")) {
        const dObj = new Date(date)
        if (!isNaN(dObj.getTime())) {
          return dObj.toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
            year: "numeric"
          })
        }
      }
      const [y, m, d] = date.split("-").map(Number)
      const obj = new Date(y, m - 1, d)
      return obj.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric"
      })
    } catch {
      return date
    }
  }, [date])



  return (
    <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-sm hover:border-gray-300 transition-all space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 border-b border-gray-100 pb-3">
        <div className="min-w-0">
          <h4 className="text-sm font-bold text-[#2D3A4A] flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#2D3A4A] shrink-0" />
            <span className="truncate">{label}</span>
          </h4>
          {sublabel && (
            <p className="text-[11px] text-gray-500 font-medium mt-0.5 line-clamp-1">{sublabel}</p>
          )}
        </div>
        {date && time && (
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-gray-50 border border-gray-200/60 text-[#2D3A4A] tracking-tight shrink-0 whitespace-nowrap">
            {hour12}:{minute} {period}
          </span>
        )}
      </div>

      {/* Main Selectors (Date Button + Segmented Time Picker) */}
      <div className="space-y-3">
        {/* Date Selector Popover */}
        <div>
          <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
            Date
          </label>
          <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="w-full flex items-center justify-between gap-3 px-3.5 py-2.5 bg-gray-50/70 hover:bg-gray-100/70 border border-gray-200 rounded-xl text-left text-sm font-semibold text-[#2D3A4A] transition-all focus:outline-none focus:ring-2 focus:ring-[#2D3A4A]/20 shadow-2xs"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-600 shrink-0 shadow-2xs">
                    <CalendarIcon size={14} />
                  </div>
                  <span className="truncate font-bold">{displayFormattedDate}</span>
                </div>
                <span className="text-xs font-bold text-gray-400 shrink-0">Change</span>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-4 bg-white rounded-2xl shadow-xl border border-gray-100 z-50" align="start">
              {/* Quick Presets */}
              <div className="flex gap-1.5 mb-3.5 pb-3 border-b border-gray-100">
                <button
                  type="button"
                  onClick={() => setQuickDate(0)}
                  className="flex-1 py-1.5 text-xs font-bold rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-700 transition-colors"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => setQuickDate(1)}
                  className="flex-1 py-1.5 text-xs font-bold rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-700 transition-colors"
                >
                  Tomorrow
                </button>
                <button
                  type="button"
                  onClick={() => setQuickDate(2)}
                  className="flex-1 py-1.5 text-xs font-bold rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-700 transition-colors"
                >
                  +2 Days
                </button>
              </div>

              {/* Month & Year Navigation */}
              <div className="flex items-center justify-between mb-3 px-1">
                <span className="text-sm font-black text-[#2D3A4A]">
                  {MONTH_NAMES[viewMonth]} {viewYear}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handlePrevMonth}
                    className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-600 transition-colors"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={handleNextMonth}
                    className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-600 transition-colors"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>

              {/* Weekday Names */}
              <div className="grid grid-cols-7 text-center mb-1.5">
                {WEEKDAYS.map((wd) => (
                  <span key={wd} className="text-[10px] font-bold text-gray-400 py-1">
                    {wd}
                  </span>
                ))}
              </div>

              {/* Days Grid */}
              <div className="grid grid-cols-7 gap-1 text-center">
                {Array.from({ length: firstDayWeekday }).map((_, i) => (
                  <div key={`empty-${i}`} className="h-8" />
                ))}

                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1
                  const checkStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
                  const isSelected = date === checkStr
                  const todayStr = new Date().toISOString().split("T")[0]
                  const isToday = todayStr === checkStr

                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => selectDay(day)}
                      className={`h-8 w-8 mx-auto rounded-lg text-xs font-bold transition-all flex items-center justify-center ${
                        isSelected
                          ? "bg-[#2D3A4A] text-white shadow-md scale-105"
                          : isToday
                          ? "border border-primary text-primary hover:bg-primary/5"
                          : "text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      {day}
                    </button>
                  )
                })}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Intuitive Time Selector (Hour, Minute, AM/PM) */}
        <div>
          <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
            Time (12-Hour)
          </label>
          <div className="flex items-center justify-between gap-2 bg-gray-50/70 px-3 py-2 rounded-xl border border-gray-200">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-600 shrink-0 shadow-2xs">
                <Clock size={14} />
              </div>

              {/* Hour select */}
              <select
                value={hour12}
                onChange={(e) => updateTime12(e.target.value, minute, period)}
                className="bg-white border border-gray-200 rounded-lg py-1.5 px-2.5 text-xs font-bold text-[#2D3A4A] focus:outline-none focus:ring-1 focus:ring-[#2D3A4A] shrink-0 cursor-pointer shadow-2xs"
              >
                {Array.from({ length: 12 }).map((_, i) => {
                  const val = String(i + 1).padStart(2, "0")
                  return (
                    <option key={val} value={val}>
                      {val}
                    </option>
                  )
                })}
              </select>

              <span className="text-gray-400 font-bold">:</span>

              {/* Minute select */}
              <select
                value={minute}
                onChange={(e) => updateTime12(hour12, e.target.value, period)}
                className="bg-white border border-gray-200 rounded-lg py-1.5 px-2.5 text-xs font-bold text-[#2D3A4A] focus:outline-none focus:ring-1 focus:ring-[#2D3A4A] shrink-0 cursor-pointer shadow-2xs"
              >
                {minuteOptions.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            {/* AM / PM Toggle buttons */}
            <div className="flex bg-white border border-gray-200 rounded-lg p-0.5 shrink-0 shadow-2xs">
              <button
                type="button"
                onClick={() => updateTime12(hour12, minute, "AM")}
                className={`px-3 py-1 rounded text-xs font-bold transition-all ${
                  period === "AM"
                    ? "bg-[#2D3A4A] text-white shadow-xs"
                    : "text-gray-400 hover:text-gray-700"
                }`}
              >
                AM
              </button>
              <button
                type="button"
                onClick={() => updateTime12(hour12, minute, "PM")}
                className={`px-3 py-1 rounded text-xs font-bold transition-all ${
                  period === "PM"
                    ? "bg-[#2D3A4A] text-white shadow-xs"
                    : "text-gray-400 hover:text-gray-700"
                }`}
              >
                PM
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
