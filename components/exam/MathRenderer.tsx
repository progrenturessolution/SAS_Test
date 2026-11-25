"use client"

import React, { memo } from "react"
import katex from "katex"
import "katex/dist/katex.min.css"
import "katex/contrib/mhchem"

interface MathRendererProps {
  content: string
  className?: string
}

function wrapBareMhchemBlocks(input: string): string {
  let out = ""
  let inDisplay = false
  let inInline = false

  for (let i = 0; i < input.length; i++) {
    if (!inInline && input.startsWith("$$", i)) {
      inDisplay = !inDisplay
      out += "$$"
      i++
      continue
    }
    if (!inDisplay && input[i] === "$" && (i === 0 || input[i - 1] !== "\\")) {
      inInline = !inInline
      out += "$"
      continue
    }

    if (!inDisplay && !inInline && input.startsWith("\\ce{", i)) {
      let depth = 0
      let j = i + 3
      for (; j < input.length; j++) {
        if (input[j] === "\\") {
          j++
          continue
        }
        if (input[j] === "{") depth++
        else if (input[j] === "}") {
          depth--
          if (depth === 0) break
        }
      }
      if (depth === 0 && j < input.length) {
        out += `$${input.slice(i, j + 1)}$`
        i = j
        continue
      }
    }

    out += input[i]
  }
  return out
}

function normalizeFormulaText(value: string): string {
  if (!value) return ""
  const repaired = value
    .replace(/\u000c(?=(?:frac|tfrac|dfrac|cfrac|forall|fbox|flat|frown)?)/g, "\\f")
    .replace(/\u0008(?=(?:beta|bar|binom|boldsymbol|bot|bowtie|brace|brack|breve|bullet|big|begin))/gi, "\\b")
    .replace(/\u0009(?=(?:theta|tau|text|textbf|textit|textrm|textstyle|times|tanh|tan\b|to\b|tilde|triangle|top\b|therefore))/gi, "\\t")
    .replace(/\u000d(?=(?:rho|rightarrow|Rightarrow|right|root))/gi, "\\r")
    .replace(/\u0009/g, " ")
    .replace(/\\\(|\\\)/g, "$")
    .replace(/\\\[|\\\]/g, "$$")
    .replace(/\\ce\s+([A-Z(][A-Za-z0-9()_^{}+=-]*)/g, "\\ce{$1}")
    .replace(/\\ce(?=[A-Z(][A-Za-z0-9]*(?:\d|[()]))([A-Za-z0-9()_^{}+=-]+)/g, "\\ce{$1}")

  return wrapBareMhchemBlocks(repaired)
}

const MATH_REGEX = /(\$\$[\s\S]*?\$\$|\$(?!\$)[\s\S]+?\$|\\ce\{[\s\S]*?\}|\\begin\{(?:bmatrix|pmatrix|vmatrix|Vmatrix|matrix|smallmatrix|cases|aligned|array)\}[\s\S]*?\\end\{(?:bmatrix|pmatrix|vmatrix|Vmatrix|matrix|smallmatrix|cases|aligned|array)\})/g

function isStandaloneFormula(value: string): boolean {
  return /^[-+]?\\(?:ce|frac|sqrt|dfrac|tfrac|binom|text|mathrm|mathbf|vec|hat|bar|sin|cos|tan|log|ln|lim|sum|int|prod|left|right|times|cdot|pm|leq?|geq?|neq|approx|infty|alpha|beta|gamma|delta|Delta|theta|lambda|mu|pi|rho|sigma|phi|omega|rightarrow|leftarrow|rightleftharpoons|xrightarrow|xleftarrow|begin\{(?:bmatrix|pmatrix|vmatrix|Vmatrix|matrix|cases))\b/.test(
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
      trust: true,
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

        // Inline chemistry: \ce{ ... }
        if (part.startsWith("\\ce{") && part.endsWith("}")) {
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

        return renderTextWithOptionalTable(part, index)
      })}
    </div>
  )
})

function renderTextWithOptionalTable(text: string, keyPrefix: number): React.ReactNode {
  const lines = text.split("\n")
  const hasTable = lines.some(
    (line, idx) =>
      line.trim().startsWith("|") &&
      line.trim().endsWith("|") &&
      lines[idx + 1] &&
      /^\s*\|(?:\s*:?-+:?\s*\|)+\s*$/.test(lines[idx + 1])
  )

  if (!hasTable) {
    return (
      <span key={keyPrefix} className="whitespace-pre-wrap">
        {text}
      </span>
    )
  }

  const blocks: React.ReactNode[] = []
  let i = 0
  while (i < lines.length) {
    if (
      lines[i].trim().startsWith("|") &&
      lines[i].trim().endsWith("|") &&
      lines[i + 1] &&
      /^\s*\|(?:\s*:?-+:?\s*\|)+\s*$/.test(lines[i + 1])
    ) {
      const splitRow = (row: string) =>
        row
          .trim()
          .slice(1, -1)
          .split("|")
          .map((c) => c.trim())

      const headers = splitRow(lines[i])
      i += 2
      const rows: string[][] = []
      while (i < lines.length && lines[i].trim().startsWith("|") && lines[i].trim().endsWith("|")) {
        rows.push(splitRow(lines[i]))
        i++
      }
      blocks.push(
        <div key={`${keyPrefix}-tbl-${i}`} className="my-2 overflow-x-auto">
          <table className="min-w-full border-collapse border border-slate-300 text-xs">
            <thead className="bg-slate-100">
              <tr>
                {headers.map((h, hi) => (
                  <th key={hi} className="border border-slate-300 px-2.5 py-1.5 text-left font-semibold text-slate-800">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri} className="even:bg-slate-50/70">
                  {headers.map((_, ci) => (
                    <td key={ci} className="border border-slate-300 px-2.5 py-1.5 text-slate-700">
                      {r[ci] || ""}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    } else {
      const proseLines: string[] = []
      while (
        i < lines.length &&
        !(
          lines[i].trim().startsWith("|") &&
          lines[i].trim().endsWith("|") &&
          lines[i + 1] &&
          /^\s*\|(?:\s*:?-+:?\s*\|)+\s*$/.test(lines[i + 1])
        )
      ) {
        proseLines.push(lines[i])
        i++
      }
      if (proseLines.length > 0) {
        blocks.push(
          <span key={`${keyPrefix}-txt-${i}`} className="whitespace-pre-wrap">
            {proseLines.join("\n") + (i < lines.length ? "\n" : "")}
          </span>
        )
      }
    }
  }

  return <React.Fragment key={keyPrefix}>{blocks}</React.Fragment>
}
