"use client"

import React, { useEffect, useState } from "react"

interface CoachingThemeWrapperProps {
  children: React.ReactNode
  isInstitute: boolean
  initialThemeColor?: string
}

export default function CoachingThemeWrapper({
  children,
  isInstitute,
  initialThemeColor = "#2D3A4A",
}: CoachingThemeWrapperProps) {
  const [themeColor, setThemeColor] = useState<string>(initialThemeColor)

  useEffect(() => {
    if (!isInstitute) return

    // Set on :root so all global portals/modals/variables inherit it
    if (themeColor) {
      document.documentElement.style.setProperty("--primary", themeColor)
      document.documentElement.style.setProperty("--brand-theme", themeColor)
    }

    const handleSettingsUpdated = (event: any) => {
      const newColor = event?.detail?.themeColor
      if (newColor) {
        setThemeColor(newColor)
        document.documentElement.style.setProperty("--primary", newColor)
        document.documentElement.style.setProperty("--brand-theme", newColor)
        return
      }

      fetch("/api/admin/institute-access", { credentials: "include" })
        .then((res) => res.json())
        .then((data) => {
          if (data?.themeColor) {
            setThemeColor(data.themeColor)
            document.documentElement.style.setProperty("--primary", data.themeColor)
            document.documentElement.style.setProperty("--brand-theme", data.themeColor)
          }
        })
        .catch(() => {})
    }

    window.addEventListener("institute-settings-updated", handleSettingsUpdated)
    return () => {
      window.removeEventListener("institute-settings-updated", handleSettingsUpdated)
    }
  }, [isInstitute, themeColor])

  if (!isInstitute) {
    return <>{children}</>
  }

  return (
    <div
      className="coaching-portal w-full min-h-screen"
      style={
        {
          "--primary": themeColor,
          "--brand-theme": themeColor,
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  )
}

