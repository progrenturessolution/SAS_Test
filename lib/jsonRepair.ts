/**
 * Robust JSON parser that handles LLM responses containing raw LaTeX backslashes
 * (e.g. \alpha, \frac, \vec, \theta, \Delta, \times, etc.) which cause "Bad escaped character in JSON".
 */

function sanitizeJsonString(jsonStr: string): string {
  let result = ""
  let inString = false
  let i = 0
  const len = jsonStr.length

  while (i < len) {
    const ch = jsonStr[i]

    if (!inString) {
      if (ch === '"') {
        inString = true
      }
      result += ch
      i++
    } else {
      // Inside string literal
      if (ch === '"') {
        inString = false
        result += ch
        i++
      } else if (ch === "\\") {
        if (i + 1 >= len) {
          result += "\\\\"
          i++
          continue
        }
        const next = jsonStr[i + 1]

        // If it's already an escaped backslash "\\" or escaped quote '\"' or '\/'
        if (next === '"' || next === "\\" || next === "/") {
          result += ch + next
          i += 2
        } else if (next === "u") {
          // Check if followed by 4 hex digits
          const hex = jsonStr.slice(i + 2, i + 6)
          if (/^[0-9a-fA-F]{4}$/.test(hex)) {
            result += "\\u" + hex
            i += 6
          } else {
            // e.g. \uparrow, \upsilon, \under -> not valid unicode escape, double backslash
            result += "\\\\u"
            i += 2
          }
        } else if (/^[bfnrt]$/.test(next)) {
          // Check if following characters form a LaTeX command word
          const rest = jsonStr.slice(i + 1, i + 15)
          if (/^(frac|beta|bar|binom|nabla|nu|neq|rho|rightarrow|right|root|theta|tau|text|times|tan|to|tilde|triangle|top)/i.test(rest)) {
            result += "\\\\" + next
            i += 2
          } else {
            // Legitimate JSON whitespace escapes: \n, \t, \r, \b, \f
            result += ch + next
            i += 2
          }
        } else {
          // Any other character following \ is an INVALID JSON escape in standard JSON
          // (e.g. \alpha, \vec, \Delta, \sin, \cos, \lambda, \omega, \(, \), \{, \}, etc.)
          result += "\\\\" + next
          i += 2
        }
      } else if (ch === "\n") {
        result += "\\n"
        i++
      } else if (ch === "\r") {
        result += "\\r"
        i++
      } else if (ch === "\t") {
        result += "\\t"
        i++
      } else {
        result += ch
        i++
      }
    }
  }

  return result
}

function removeTrailingCommas(str: string): string {
  return str.replace(/,\s*([}\]])/g, "$1")
}

export function robustJsonParse<T = any>(jsonString: string): T {
  let cleaned = jsonString.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim()
  cleaned = removeTrailingCommas(cleaned)

  // Attempt 1: Direct JSON.parse
  try {
    return JSON.parse(cleaned)
  } catch (err1) {
    // Attempt 2: Sanitize character-by-character using state machine
    try {
      const sanitized = sanitizeJsonString(cleaned)
      return JSON.parse(sanitized)
    } catch (err2) {
      // Attempt 3: Regex-based fallback
      try {
        const regexFixed = cleaned.replace(/\\(?!["\\/bfnrt]|u[0-9a-fA-F]{4})/g, "\\\\")
        return JSON.parse(regexFixed)
      } catch (err3) {
        // Attempt 4: Extract JSON array or object if surrounded by markdown or commentary
        const arrayMatch = cleaned.match(/\[\s*\{[\s\S]*\}\s*\]/)
        if (arrayMatch) {
          try {
            const sanitizedArray = sanitizeJsonString(removeTrailingCommas(arrayMatch[0]))
            return JSON.parse(sanitizedArray)
          } catch {}
        }

        const objMatch = cleaned.match(/\{[\s\S]*\}/)
        if (objMatch) {
          try {
            const sanitizedObj = sanitizeJsonString(removeTrailingCommas(objMatch[0]))
            return JSON.parse(sanitizedObj)
          } catch {}
        }

        throw err2
      }
    }
  }
}
