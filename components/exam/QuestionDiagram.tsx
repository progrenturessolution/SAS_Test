"use client"

import React, { useState } from "react"
import { ZoomIn, ZoomOut, Maximize2, X } from "lucide-react"
import { validateAndSanitizeSvg } from "@/lib/ai/diagramValidator"

interface QuestionDiagramProps {
  src?: string | null
  alt?: string
  className?: string
  title?: string
}

export function QuestionDiagram({ src, alt = "Question Diagram", className = "", title }: QuestionDiagramProps) {
  const [isZoomed, setIsZoomed] = useState(false)

  if (!src || typeof src !== "string") return null
  let trimmed = src.trim()
  if (!trimmed) return null

  // If SVG was HTML-escaped, unescape it
  if (trimmed.includes("&lt;svg") && trimmed.includes("&gt;")) {
    trimmed = trimmed
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&amp;/g, "&")
  }

  // Check if string contains raw SVG markup
  const isSvg = trimmed.startsWith("<svg") || (trimmed.includes("<svg") && trimmed.includes("</svg>"))

  let cleanSvg = ""
  if (isSvg) {
    const svgCheck = validateAndSanitizeSvg(trimmed)
    if (svgCheck.valid && svgCheck.sanitizedSvg) {
      cleanSvg = svgCheck.sanitizedSvg
    } else {
      // Fall back to safe static strip of active elements so even legacy malformed SVGs remain safe
      cleanSvg = trimmed
        .replace(/<\s*(script|foreignObject|iframe|object|embed)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
        .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
      const match = cleanSvg.match(/<svg[\s\S]*?<\/svg>/i)
      cleanSvg = match ? match[0] : ""
      if (cleanSvg && !cleanSvg.includes("viewBox") && !cleanSvg.includes("viewbox")) {
        const wMatch = cleanSvg.match(/width=["']?(\d+)["']?/i)
        const hMatch = cleanSvg.match(/height=["']?(\d+)["']?/i)
        if (wMatch && hMatch) {
          cleanSvg = cleanSvg.replace(/<svg\b/i, `<svg viewBox="0 0 ${wMatch[1]} ${hMatch[1]}"`)
        }
      }
    }
  }

  const imageSrc = !isSvg
    ? trimmed.startsWith("data:") || trimmed.startsWith("http") || trimmed.startsWith("/")
      ? trimmed
      : `data:image/svg+xml;utf8,${encodeURIComponent(trimmed)}`
    : ""

  return (
    <>
      <div className={`my-4 p-3.5 sm:p-5 bg-white rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col items-center justify-center max-w-full overflow-hidden group relative transition-all print:my-2 print:p-2 print:border-slate-300 print:shadow-none print-avoid-break ${className}`}>
        {/* Quick Zoom Trigger */}
        <button
          type="button"
          onClick={() => setIsZoomed(true)}
          className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs flex items-center gap-1 shadow-xs cursor-pointer z-10 print:hidden"
          title="Zoom Diagram"
        >
          <Maximize2 size={13} />
          <span className="text-[10px] font-bold">Zoom</span>
        </button>

        {isSvg ? (
          <div
            className="w-full flex items-center justify-center overflow-x-auto [&_svg]:max-w-full [&_svg]:h-auto [&_svg]:max-h-72 sm:[&_svg]:max-h-84 select-none cursor-pointer print:[&_svg]:max-h-56 print:cursor-default"
            onClick={() => setIsZoomed(true)}
            dangerouslySetInnerHTML={{ __html: cleanSvg }}
          />
        ) : (
          <img
            src={imageSrc}
            alt={alt}
            className="max-w-full max-h-72 sm:max-h-84 object-contain rounded-lg select-none cursor-pointer print:max-h-56 print:cursor-default"
            onClick={() => setIsZoomed(true)}
            loading="lazy"
          />
        )}

        <div className="flex items-center gap-2 mt-2.5 pt-2 border-t border-slate-100 w-full justify-center print:mt-1 print:pt-1">
          <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse print:hidden" />
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider print:text-[9px]">
            {title || "Diagram / Figure Reference"}
          </span>
        </div>
      </div>

      {/* Fullscreen Zoom Modal */}
      {isZoomed && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-8 animate-in fade-in duration-150"
          onClick={() => setIsZoomed(false)}
        >
          <div
            className="bg-white rounded-3xl p-5 sm:p-6 max-w-3xl w-full max-h-[90vh] overflow-auto shadow-2xl relative flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                {title || "Enlarged Diagram / Figure Reference"}
              </span>
              <button
                type="button"
                onClick={() => setIsZoomed(false)}
                className="p-1.5 hover:bg-slate-100 text-slate-500 rounded-xl transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="w-full flex items-center justify-center py-2 overflow-auto">
              {isSvg ? (
                <div
                  className="w-full flex items-center justify-center [&_svg]:max-w-full [&_svg]:h-auto [&_svg]:max-h-[65vh]"
                  dangerouslySetInnerHTML={{ __html: cleanSvg }}
                />
              ) : (
                <img
                  src={imageSrc}
                  alt={alt}
                  className="max-w-full max-h-[65vh] object-contain rounded-xl"
                />
              )}
            </div>

            <p className="text-[11px] text-slate-400 mt-3 text-center">
              Click anywhere outside or close button to dismiss
            </p>
          </div>
        </div>
      )}
    </>
  )
}

