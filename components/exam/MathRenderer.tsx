"use client"

import React, { memo } from "react"
import katex from "katex"
import "katex/dist/katex.min.css"

interface MathRendererProps {
  content: string
  className?: string
}

function normalizeFormulaText(value: string): string {
  if (!value) return ""
  return value
    .replace(/\u000c/g, "\\frac")
    .replace(/\u0008/g, "\\b")
    .replace(/\u0009/g, " ")
    .replace(/\\\(|\\\)/g, "$")
    .replace(/\\\[|\\\]/g, "$$")
}

const MATH_REGEX = /(\$\$[\s\S]*?\$\$|\$(?!\$)[\s\S]+?\$|\\begin\{(?:bmatrix|pmatrix|vmatrix|Vmatrix|matrix|smallmatrix|cases|aligned|array)\}[\s\S]*?\\end\{(?:bmatrix|pmatrix|vmatrix|Vmatrix|matrix|smallmatrix|cases|aligned|array)\})/g

function isStandaloneFormula(value: string): boolean {
  return /^[-+]?\\(?:frac|sqrt|dfrac|tfrac|binom|text|mathrm|mathbf|vec|hat|bar|sin|cos|tan|log|ln|lim|sum|int|prod|left|right|times|cdot|pm|leq?|geq?|neq|approx|infty|alpha|beta|gamma|delta|Delta|theta|lambda|mu|pi|rho|sigma|phi|omega|rightarrow|leftarrow|begin\{(?:bmatrix|pmatrix|vmatrix|Vmatrix|matrix|cases))\b/.test(
    value.trim()
  )
}

const formulaCache = new Map<string, string>()

function renderFormula(formula: string, displayMode: boolean): string {
  const trimmed = formula.trim()
  const cacheKey = `${displayMode ? "d" : "i"}:${trimmed}`
  const cached = formulaCache.get(cacheKey)
  if (cached) return cached

  let html: string
  try {
    html = katex.renderToString(trimmed, {
      displayMode,
      throwOnError: false,
      strict: "ignore",
      trust: false,
    })
  } catch {
    html = trimmed
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;")
  }

  if (formulaCache.size > 800) formulaCache.clear()
  formulaCache.set(cacheKey, html)
  return html
}

export const MathRenderer = memo(function MathRenderer({ content, className = "" }: MathRendererProps) {
  if (!content) return null

  const normalized = normalizeFormulaText(content)
  const parts = normalized.split(MATH_REGEX)

  return (
    <div className={`leading-relaxed text-sm ${className}`}>
      {parts.map((part, index) => {
        if (!part) return null

        // Display math: $$ ... $$
        if (part.startsWith("$$") && part.endsWith("$$")) {
          return (
            <div
              key={index}
              className="my-3 overflow-x-auto rounded-xl bg-slate-50/80 border border-slate-200/60 px-4 py-2 text-center shadow-2xs dark:bg-white/5"
              dangerouslySetInnerHTML={{
                __html: renderFormula(part.slice(2, -2), true),
              }}
            />
          )
        }

        // Inline math: $ ... $
        if (part.startsWith("$") && part.endsWith("$")) {
          const innerMath = part.slice(1, -1)
          const isMatrixOrEnv = /\\begin\{(?:bmatrix|pmatrix|vmatrix|Vmatrix|matrix|smallmatrix|cases|aligned|array)\}/.test(
            innerMath
          )

          if (isMatrixOrEnv) {
            return (
              <span
                key={index}
                className="mx-1 inline-flex items-center overflow-x-auto max-w-full rounded-lg border border-slate-200/80 bg-slate-50/90 px-2 py-1 text-slate-900 align-middle shadow-2xs dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-100"
                dangerouslySetInnerHTML={{
                  __html: renderFormula(innerMath, false),
                }}
              />
            )
          }

          return (
            <span
              key={index}
              className="inline text-slate-900 dark:text-slate-100 align-baseline"
              dangerouslySetInnerHTML={{
                __html: renderFormula(innerMath, false),
              }}
            />
          )
        }

        // Raw matrix or environment without dollar signs
        if (
          /^\\begin\{(?:bmatrix|pmatrix|vmatrix|Vmatrix|matrix|smallmatrix|cases|aligned|array)\}/.test(
            part.trim()
          )
        ) {
          return (
            <div
              key={index}
              className="my-3 overflow-x-auto rounded-xl bg-slate-50/90 border border-slate-200/80 px-4 py-2.5 text-center shadow-2xs dark:border-slate-800 dark:bg-slate-900/60"
              dangerouslySetInnerHTML={{
                __html: renderFormula(part, true),
              }}
            />
          )
        }

        if (isStandaloneFormula(part)) {
          return (
            <span
              key={index}
              className="inline text-slate-900 dark:text-slate-100 align-baseline"
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
})
