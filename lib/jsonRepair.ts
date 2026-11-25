/**
 * Repairs unescaped LaTeX backslashes, malformed unicode escapes, and literal control
 * characters inside JSON string literals BEFORE JSON.parse interprets \f/\b/\t/\r/\n.
 */
export function sanitizeJsonString(jsonStr: string): string {
  let inString = false
  let result = ""

  for (let i = 0; i < jsonStr.length; i++) {
    const ch = jsonStr[i]

    if (!inString) {
      if (ch === '"') inString = true
      result += ch
      continue
    }

    if (ch === "\\") {
      const next = jsonStr[i + 1]
      if (next === undefined) {
        result += "\\\\"
        break
      }

      if (next === '"' || next === "\\" || next === "/") {
        result += "\\" + next
        i++
      } else if (next === "u") {
        // Only treat \uXXXX as JSON unicode escape when followed by 4 hex digits
        const hex = jsonStr.slice(i + 2, i + 6)
        if (/^[0-9a-fA-F]{4}$/.test(hex)) {
          result += "\\u"
          i++
        } else {
          // e.g. \uparrow, \underline -> escape the backslash
          result += "\\\\u"
          i++
        }
      } else if (/^[bfnrt]$/.test(next)) {
        const rest = jsonStr.slice(i + 1, i + 24)
        const isLatexEscapeCollision =
          (next === "f" && /^(?:frac|tfrac|dfrac|cfrac|forall|fbox|flat|frown|footnotesize)\b/i.test(rest)) ||
          (next === "b" && /^(?:beta|bar|binom|boldsymbol|bot|bowtie|brace|brack|breve|bullet|bigcap|bigcup|bigoplus|bigotimes|bigvee|bigwedge|backsim|because|between|bmod|bm|bigg?|Bigg?)\b/i.test(rest)) ||
          (next === "n" && /^(?:nabla|nu(?![a-zA-Z])|neq|ne(?![a-zA-Z])|neg|ni(?![a-zA-Z])|notin|ngeq|nleq|nsupset|nsubset|natural|nmid|not(?=[A-Z]|in|eq))\b/.test(rest)) ||
          (next === "r" && /^(?:rho|rightarrow|Rightarrow|right|rceil|rfloor|rangle|restriction|risingdotseq|rhd|rm(?![a-zA-Z])|rbrace|rbrack|root|ratio)\b/.test(rest)) ||
          (next === "t" && /^(?:theta|Theta|tau|text|textbf|textit|textrm|textstyle|times|tanh|tan(?![a-zA-Z])|to(?![a-zA-Z])|tilde|triangledown|triangleleft|triangleright|triangle|top(?![a-zA-Z])|therefore)\b/.test(rest))

        if (isLatexEscapeCollision) {
          result += "\\\\" + next
          i++
        } else {
          result += "\\" + next
          i++
        }
      } else {
        // Any other backslash (e.g. \alpha, \sigma, \ce, \sqrt, \times, \pi) is NOT valid JSON -> double escape it
        result += "\\\\"
      }
      continue
    }

    if (ch === '"') {
      inString = false
      result += ch
    } else if (ch === "\n") {
      result += "\\n"
    } else if (ch === "\r") {
      result += "\\r"
    } else if (ch === "\t") {
      result += "\\t"
    } else if (ch.charCodeAt(0) < 0x20) {
      // Strip illegal raw ASCII control chars inside JSON string
      result += ""
    } else {
      result += ch
    }
  }

  return result
}

export function removeTrailingCommas(jsonStr: string): string {
  // Strip trailing commas outside strings cleanly
  let inString = false
  let escaped = false
  let out = ""

  for (let i = 0; i < jsonStr.length; i++) {
    const ch = jsonStr[i]
    if (inString) {
      out += ch
      if (escaped) {
        escaped = false
      } else if (ch === "\\") {
        escaped = true
      } else if (ch === '"') {
        inString = false
      }
      continue
    }

    if (ch === '"') {
      inString = true
      out += ch
      continue
    }

    if (ch === ",") {
      let j = i + 1
      while (j < jsonStr.length && /\s/.test(jsonStr[j])) j++
      if (jsonStr[j] === "}" || jsonStr[j] === "]") {
        continue
      }
    }
    out += ch
  }
  return out
}

/**
 * Strips markdown code fences and locates top-level JSON array or object delimiters.
 */
function stripCodeFencesAndPreamble(raw: string): string {
  let cleaned = String(raw || "")
    .replace(/^```(?:json|JSON)?\s*\n?/gm, "")
    .replace(/\n?```\s*$/gm, "")
    .trim()

  const firstBracket = cleaned.indexOf("[")
  const firstBrace = cleaned.indexOf("{")

  let startIdx = -1
  let openChar = ""
  let closeChar = ""
  if (firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace)) {
    startIdx = firstBracket
    openChar = "["
    closeChar = "]"
  } else if (firstBrace !== -1) {
    startIdx = firstBrace
    openChar = "{"
    closeChar = "}"
  }

  if (startIdx === -1) return cleaned

  // Walk balanced depth respecting string literals so nested array `]` never truncates an open root array
  let inString = false
  let escaped = false
  let depth = 0
  let balancedEndIdx = -1

  for (let i = startIdx; i < cleaned.length; i++) {
    const ch = cleaned[i]
    if (inString) {
      if (escaped) escaped = false
      else if (ch === "\\") escaped = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') {
      inString = true
      continue
    }
    if (ch === openChar) depth++
    else if (ch === closeChar) {
      depth--
      if (depth === 0) {
        balancedEndIdx = i
        break
      }
    }
  }

  return balancedEndIdx > startIdx
    ? cleaned.slice(startIdx, balancedEndIdx + 1)
    : cleaned.slice(startIdx)
}

/**
 * Salvages valid complete JSON objects from a truncated JSON array (e.g. MAX_TOKENS cutoff).
 */
export function salvageJsonArrayObjects<T = any>(rawText: string): T[] {
  const sanitized = removeTrailingCommas(sanitizeJsonString(rawText.replace(/^```(?:json|JSON)?\s*\n?/gm, "")))
  const startBracket = sanitized.indexOf("[")
  const slice = startBracket !== -1 ? sanitized.slice(startBracket + 1) : sanitized

  const items: T[] = []
  let inString = false
  let escaped = false
  let depth = 0
  let objStart = -1

  for (let i = 0; i < slice.length; i++) {
    const ch = slice[i]
    if (inString) {
      if (escaped) escaped = false
      else if (ch === "\\") escaped = true
      else if (ch === '"') inString = false
      continue
    }

    if (ch === '"') {
      inString = true
      continue
    }
    if (ch === "{") {
      if (depth === 0) objStart = i
      depth++
    } else if (ch === "}") {
      depth--
      if (depth === 0 && objStart !== -1) {
        const candidate = slice.slice(objStart, i + 1)
        try {
          items.push(JSON.parse(candidate) as T)
        } catch {
          // Ignore malformed individual object and continue salvaging subsequent objects
        }
        objStart = -1
      } else if (depth < 0) {
        depth = 0
      }
    }
  }

  return items
}

/**
 * Parses Gemini JSON output safely. Always repairs unescaped LaTeX backslashes FIRST
 * so JSON.parse does not silently corrupt \frac, \theta, \times, \beta, \rho, etc.
 */
export function robustJsonParse<T = any>(jsonString: string): T {
  const cleaned = stripCodeFencesAndPreamble(jsonString)

  // Stage 1: Sanitize LaTeX backslashes, illegal control chars, and trailing commas FIRST
  const repaired = removeTrailingCommas(sanitizeJsonString(cleaned))
  try {
    return JSON.parse(repaired) as T
  } catch (err1) {
    // Stage 2: Exact raw fallback (only reached if Stage 1 over-escaped an edge construct)
    try {
      return JSON.parse(removeTrailingCommas(cleaned)) as T
    } catch {
      // Stage 3: Check if this looks like a truncated JSON array and salvage valid complete objects
      const trimmed = cleaned.trim()
      if (trimmed.startsWith("[")) {
        const salvaged = salvageJsonArrayObjects<any>(cleaned)
        if (salvaged.length > 0) {
          return salvaged as unknown as T
        }
      }
      throw new Error(
        `Unable to parse AI JSON output cleanly: ${err1 instanceof Error ? err1.message : String(err1)}`
      )
    }
  }
}
