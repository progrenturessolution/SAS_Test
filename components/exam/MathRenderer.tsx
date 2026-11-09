"use client"

import React from "react"
import katex from "katex"
import "katex/dist/katex.min.css"

interface MathRendererProps {
  content: string
  className?: string
}

function normalizeFormulaText(value: string): string {
  return value
    .replace(/\\\\/g, "\\")
    .replace(/\u000c/g, "\\frac")
    .replace(/\u0008/g, "\\b")
    .replace(/\u0009/g, " ")
    .replace(/\\\(/g, "$")
    .replace(/\\\)/g, "$")
    .replace(/\\\[/g, "$$")
    .replace(/\\\]/g, "$$")
}

function isStandaloneFormula(value: string): boolean {
  return /^[-+]?\\(?:frac|sqrt|dfrac|tfrac|binom|text|mathrm|mathbf|vec|hat|bar|sin|cos|tan|log|ln|lim|sum|int|prod|left|right|times|cdot|pm|leq?|geq?|neq|approx|infty|alpha|beta|gamma|delta|Delta|theta|lambda|mu|pi|rho|sigma|phi|omega|rightarrow|leftarrow)\b/.test(
    value.trim()
  )
}

function renderFormula(formula: string, displayMode: boolean): string {
  try {
    return katex.renderToString(formula.trim(), {
      displayMode,
      throwOnError: false,
      strict: "ignore",
      trust: false,
    })
  } catch {
    return formula
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;")
  }
}

export function MathRenderer({ content, className = "" }: MathRendererProps) {
  if (!content) return null

  const parts = normalizeFormulaText(content).split(
    /(\$\$[\s\S]*?\$\$|\$[^$\n]+\$)/g
  )

  return (
    <div className={`leading-relaxed text-sm ${className}`}>
      {parts.map((part, index) => {
        if (part.startsWith("$$") && part.endsWith("$$")) {
          return (
            <div
              key={index}
              className="my-2.5 overflow-x-auto rounded-md bg-slate-900/5 px-3 py-1.5 text-center dark:bg-white/5"
              dangerouslySetInnerHTML={{
                __html: renderFormula(part.slice(2, -2), true),
              }}
            />
          )
        }

        if (part.startsWith("$") && part.endsWith("$")) {
          return (
            <span
              key={index}
              className="mx-0.5 inline-block rounded border border-indigo-100/60 bg-indigo-50 px-1.5 py-0.5 text-[0.9em] text-indigo-900 dark:border-indigo-900/40 dark:bg-indigo-950/40 dark:text-indigo-200"
              dangerouslySetInnerHTML={{
                __html: renderFormula(part.slice(1, -1), false),
              }}
            />
          )
        }

        if (isStandaloneFormula(part)) {
          return (
            <span
              key={index}
              className="mx-0.5 inline-block rounded border border-indigo-100/60 bg-indigo-50 px-1.5 py-0.5 text-[0.9em] text-indigo-900 dark:border-indigo-900/40 dark:bg-indigo-950/40 dark:text-indigo-200"
              dangerouslySetInnerHTML={{
                __html: renderFormula(part, false),
              }}
            />
          )
        }

        return (
          <span key={index} className="whitespace-pre-wrap">
            {part}
          </span>
        )
      })}
    </div>
  )
}
