export const MATH_DELIMITED_REGEX =
  /(\$\$[\s\S]*?\$\$|\$(?!\$)[\s\S]+?\$|\\ce\{[\s\S]*?\}|\\begin\{(?:bmatrix|pmatrix|vmatrix|Vmatrix|matrix|smallmatrix|cases|aligned|array)\}[\s\S]*?\\end\{(?:bmatrix|pmatrix|vmatrix|Vmatrix|matrix|smallmatrix|cases|aligned|array)\})/g

const KNOWN_MATH_WORDS = new Set([
  "sin",
  "cos",
  "tan",
  "cot",
  "sec",
  "csc",
  "arcsin",
  "arccos",
  "arctan",
  "sinh",
  "cosh",
  "tanh",
  "log",
  "ln",
  "lg",
  "lim",
  "exp",
  "max",
  "min",
  "mod",
  "deg",
  "det",
  "sqrt",
  "const",
  "constant",
  "or",
])

/**
 * Repairs control character collisions from JSON escapes and converts \(...\)/\[...\] to $/$$.
 */
export function repairControlAndDelimiters(value: string): string {
  if (!value) return ""
  return value
    .replace(/\u000c(?=(?:frac|tfrac|dfrac|cfrac|forall|fbox|flat|frown)?)/g, "\\f")
    .replace(
      /\u0008(?=(?:beta|bar|binom|boldsymbol|bot|bowtie|brace|brack|breve|bullet|big|begin))/gi,
      "\\b"
    )
    .replace(
      /\u0009(?=(?:theta|tau|text|textbf|textit|textrm|textstyle|times|tanh|tan\b|to\b|tilde|triangle|top\b|therefore))/gi,
      "\\t"
    )
    .replace(/\u000d(?=(?:rho|rightarrow|Rightarrow|right|root))/gi, "\\r")
    .replace(/\u0009/g, " ")
    .replace(/\\\(|\\\)/g, "$")
    .replace(/\\\[|\\\]/g, "$$")
    .replace(/\\ce\s+([A-Z(][A-Za-z0-9()_^{}+=-]*)/g, "\\ce{$1}")
    .replace(/\\ce(?=[A-Z(][A-Za-z0-9]*(?:\d|[()]))([A-Za-z0-9()_^{}+=-]+)/g, "\\ce{$1}")
}

export function wrapBareMhchemBlocks(input: string): string {
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

function stripBalancedCommandArgs(text: string): string {
  let cleaned = text
  for (let pass = 0; pass < 3; pass++) {
    cleaned = cleaned.replace(
      /\\(?:text|textbf|textit|textrm|mathrm|mathbf|mathit|mathsf|mathtt|operatorname|ce)\{(?:[^{}]|\\[a-zA-Z]+)*\}/g,
      " "
    )
  }
  return cleaned
}

/**
 * Detects whether an entire trimmed option/fragment (without $...$) is a standalone math/unit
 * formula such as "2.5 \mu\text{F}", "f_0/2", "0.123 \text{\AA}", "10^{-4} \text{ T}",
 * "2 \Omega", "3 \epsilon_0 A / d", or "(2n+1)\frac{\lambda}{2}".
 */
export function isBareStandaloneMath(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed || trimmed.includes("\n") || trimmed.includes("|") || trimmed.includes("$")) {
    return false
  }
  if (/https?:\/\/|[A-Za-z]:\\/.test(trimmed)) return false
  // Protect snake_case identifiers like expected_output or two_sum
  if (/[a-zA-Z]{2,}_[a-zA-Z]{2,}/.test(trimmed)) return false

  const hasLatexCommand = /\\[a-zA-Z]+/.test(trimmed)
  const hasMathScript =
    /(?:^|[^a-zA-Z])[a-zA-Z0-9)\]}]+(?:_\{?[a-zA-Z0-9+-]+\}?|\^\{?[-+a-zA-Z0-9]+\}?)(?![a-zA-Z_])/.test(
      trimmed
    )

  if (!hasLatexCommand && !hasMathScript) return false

  // Remove \text{...}, subscript/superscript braces (e.g. V_{rms}, 10^{-4}), and \command names
  let residual = stripBalancedCommandArgs(trimmed)
  residual = residual
    .replace(/[_^]\{[^{}]*\}/g, " ")
    .replace(/\\[a-zA-Z]+/g, " ")

  const multiLetterWords = residual.match(/[a-zA-Z]{2,}/g) || []
  const hasProseWord = multiLetterWords.some((w) => !KNOWN_MATH_WORDS.has(w.toLowerCase()))
  return !hasProseWord
}

function readBalancedGroup(src: string, openIdx: number, openChar = "{", closeChar = "}"): number {
  if (src[openIdx] !== openChar) return -1
  let depth = 0
  for (let i = openIdx; i < src.length; i++) {
    if (src[i] === "\\") {
      i++
      continue
    }
    if (src[i] === openChar) depth++
    else if (src[i] === closeChar) {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

function readTrailingScriptsAndUnit(src: string, startIdx: number): number {
  let idx = startIdx
  while (idx < src.length) {
    // Attached subscript/superscript like ^2, _{0}, ^{-4}
    if (src[idx] === "^" || src[idx] === "_") {
      if (src[idx + 1] === "{") {
        const end = readBalancedGroup(src, idx + 1)
        if (end !== -1) {
          idx = end + 1
          continue
        }
      } else {
        const m = src.slice(idx + 1).match(/^[-+]?[a-zA-Z0-9]+/)
        if (m) {
          idx += 1 + m[0].length
          continue
        }
      }
    }

    // Immediate algebraic suffix like f_0 or /2 or \text{ J}
    const unitMatch = src.slice(idx).match(/^\s*(?:\\text\{[^{}]*\}|\\mathrm\{[^{}]*\})/)
    if (unitMatch) {
      idx += unitMatch[0].length
      continue
    }

    const simpleToken = src.slice(idx).match(/^(?:[a-zA-Z](?:_\{?[a-zA-Z0-9]+\}?|\^\{?[-+a-zA-Z0-9]+\}?)?)/)
    if (simpleToken && !/[a-zA-Z]{2,}/.test(src.slice(idx))) {
      idx += simpleToken[0].length
      continue
    }

    break
  }
  return idx
}

const STRUCTURAL_LATEX_RE =
  /^\\(?:d?frac|tfrac|cfrac|binom|sqrt|overset|underset|vec|hat|bar|tilde|dot|ddot|mathrm|mathbf|text)\b/

const GREEK_OR_OP_RE =
  /^\\(?:alpha|beta|gamma|delta|Delta|epsilon|varepsilon|zeta|eta|theta|Theta|iota|kappa|lambda|Lambda|mu|nu|xi|pi|Pi|rho|sigma|Sigma|tau|phi|Phi|chi|psi|Psi|omega|Omega|infty|pm|mp|times|div|cdot|leq?|geq?|neq|approx|equiv|propto|rightarrow|leftarrow|Rightarrow|leftrightarrow|AA)(?![a-zA-Z])/

/**
 * Wraps bare inline LaTeX / sub-superscript fragments inside mixed prose sentences without $...$.
 */
export function wrapBareInlineMath(text: string): string {
  if (!text || (!text.includes("\\") && !text.includes("_") && !text.includes("^"))) {
    return text
  }

  let out = ""
  let i = 0

  while (i < text.length) {
    // Skip URLs or Windows paths intact
    const rest = text.slice(i)
    const urlMatch = rest.match(/^(?:https?:\/\/\S+|[A-Za-z]:\\\S+)/)
    if (urlMatch) {
      out += urlMatch[0]
      i += urlMatch[0].length
      continue
    }

    // 1. Numeric scientific notation / unit expression: "2 \times 10^{-5} \text{ T}", "2.5 \mu\text{F}", "0.123 \text{\AA}"
    const sciMatch = rest.match(
      /^[-+]?\d+(?:\.\d+)?(?:\^\{[-+a-zA-Z0-9]+\}|\^[0-9]+)?(?:\s*(?:\\times|\\cdot)\s*10(?:\^\{?[-+]?\d+\}?)?|\s*\\(?:mu|Omega|lambda|alpha|beta|gamma|delta|theta|pi|sigma|epsilon|varepsilon|rho|phi|omega)(?:_\{?[a-zA-Z0-9]+\}?|\^\{?[-+a-zA-Z0-9]+\}?)?)*(?:\s*\\text\{(?:\\AA|[^{}]+)\})+/
    )
    if (sciMatch && sciMatch[0].includes("\\")) {
      out += `$${sciMatch[0]}$`
      i += sciMatch[0].length
      continue
    }

    const numSciOnly = rest.match(
      /^[-+]?\d+(?:\.\d+)?\s*(?:\\times|\\cdot)\s*10(?:\^\{?[-+]?\d+\}?)?(?:\s*\\text\{[^{}]*\})?/
    )
    if (numSciOnly) {
      out += `$${numSciOnly[0]}$`
      i += numSciOnly[0].length
      continue
    }

    const numGreekOnly = rest.match(
      /^[-+]?\d+(?:\.\d+)?\s*\\(?:mu|Omega|lambda|alpha|beta|gamma|delta|theta|pi|sigma|epsilon|varepsilon|rho|phi|omega)(?:_\{?[a-zA-Z0-9]+\}?|\^\{?[-+a-zA-Z0-9]+\}?)?(?:\s*\\text\{[^{}]*\})?/
    )
    if (numGreekOnly) {
      out += `$${numGreekOnly[0]}$`
      i += numGreekOnly[0].length
      continue
    }

    // 2. Balanced structural LaTeX commands (\frac{...}{...}, \sqrt{...}, etc.)
    const structMatch = rest.match(STRUCTURAL_LATEX_RE)
    if (structMatch) {
      // Pull back short algebraic prefix already emitted to `out` (like "(2n+1)" or "t" or "2")
      let prefix = ""
      const parenBack = out.match(/(\([^()\s]{1,20}\)|[-+]?\d+(?:\.\d+)?|\b[a-zA-Z])$/)
      if (parenBack) {
        prefix = parenBack[1]
        out = out.slice(0, out.length - prefix.length)
      }

      let cursor = i + structMatch[0].length
      // Optional [...] for \sqrt[n]{...}
      if (text[cursor] === "[") {
        const bracketEnd = readBalancedGroup(text, cursor, "[", "]")
        if (bracketEnd !== -1) cursor = bracketEnd + 1
      }
      // Consume 1 or 2 {...} argument groups
      let groups = 0
      while (groups < 2 && text[cursor] === "{") {
        const groupEnd = readBalancedGroup(text, cursor)
        if (groupEnd === -1) break
        cursor = groupEnd + 1
        groups++
      }
      if (groups > 0) {
        cursor = readTrailingScriptsAndUnit(text, cursor)
        out += `$${prefix}${text.slice(i, cursor)}$`
        i = cursor
        continue
      }
      out += prefix
    }

    // 3. Standalone Greek / operator LaTeX symbols (\lambda, \Omega, \epsilon_0, \times, ...)
    const greekMatch = rest.match(GREEK_OR_OP_RE)
    if (greekMatch) {
      let prefix = ""
      const varBack = out.match(/(?:^|(?<=[\s(\[{=+\-*/]))([a-zA-Z]|\d+(?:\.\d+)?)$/)
      if (varBack) {
        prefix = varBack[1]
        out = out.slice(0, out.length - prefix.length)
      }
      const end = readTrailingScriptsAndUnit(text, i + greekMatch[0].length)
      out += `$${prefix}${text.slice(i, end)}$`
      i = end
      continue
    }

    // 4. Compact math variable subscripts/superscripts like f_0, f_0/2, R_1, 10^{-4}, m/s^2
    const prevChar = i > 0 ? text[i - 1] : ""
    if (!/[a-zA-Z0-9_\\]/.test(prevChar)) {
      const tokenMatch = rest.match(
        /^(?:[a-zA-Z](?:_\{?[a-zA-Z0-9+-]+\}?|\^\{?[-+a-zA-Z0-9]+\}?)(?:\/[a-zA-Z0-9]+)?|\d+(?:\^\{[-+a-zA-Z0-9]+\}|\^[0-9]+))(?![a-zA-Z_])/
      )
      if (tokenMatch) {
        out += `$${tokenMatch[0]}$`
        i += tokenMatch[0].length
        continue
      }
    }

    out += text[i]
    i++
  }

  return out
}

/**
 * Normalizes formulas, chemistry \ce{...}, and bare inline/standalone Physics & Math LaTeX
 * into KaTeX-ready delimited expressions.
 */
export function normalizeMathContent(value: string): string {
  if (!value) return ""
  const withDelimiters = wrapBareMhchemBlocks(repairControlAndDelimiters(value))
  const parts = withDelimiters.split(MATH_DELIMITED_REGEX)

  return parts
    .map((part) => {
      if (!part) return ""
      if (
        (part.startsWith("$$") && part.endsWith("$$")) ||
        (part.startsWith("$") && part.endsWith("$")) ||
        (part.startsWith("\\ce{") && part.endsWith("}")) ||
        part.startsWith("\\begin{")
      ) {
        return part
      }

      const trimmed = part.trim()
      if (trimmed && isBareStandaloneMath(trimmed)) {
        const leading = part.slice(0, part.indexOf(trimmed))
        const trailing = part.slice(part.indexOf(trimmed) + trimmed.length)
        return `${leading}$${trimmed}$${trailing}`
      }

      if (!part.includes("\\") && !part.includes("_") && !part.includes("^")) {
        return part
      }

      // Process line by line so markdown pipe tables keep intact
      return part
        .split("\n")
        .map((line) => (line.trim().startsWith("|") && line.trim().endsWith("|") ? line : wrapBareInlineMath(line)))
        .join("\n")
    })
    .join("")
}

