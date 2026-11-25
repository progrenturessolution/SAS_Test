export interface SvgValidationResult {
  valid: boolean
  sanitizedSvg?: string
  errors: string[]
  warnings: string[]
  primitiveCount: number
  textLabels: string[]
  viewBox?: { minX: number; minY: number; width: number; height: number }
}

const UNSAFE_TAG_RE = /<\s*(script|foreignObject|iframe|object|embed|applet|meta|link|base)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>|<\s*(script|foreignObject|iframe|object|embed|applet|meta|link|base)\b[^>]*\/?>/gi
const EVENT_HANDLER_RE = /\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi
const JS_URI_RE = /\b(href|xlink:href|src)\s*=\s*(?:"\s*(?:javascript|vbscript|data:text\/html)[^"]*"|'\s*(?:javascript|vbscript|data:text\/html)[^']*')/gi
const EXTERNAL_HREF_RE = /<\s*image\b[^>]*\b(?:href|xlink:href)\s*=\s*(?:"https?:\/\/[^"]*"|'https?:\/\/[^']*')[^>]*\/?>/gi

function extractSingleSvgBlock(raw: string): string | null {
  let clean = String(raw || "").trim()
  if (!clean) return null

  // Unescape JSON-escaped quotes/newlines if a serialized SVG snippet slipped through
  if (clean.includes('\\"') || clean.includes("\\n")) {
    clean = clean.replace(/\\"/g, '"').replace(/\\n/g, "\n").replace(/\\t/g, " ")
  }

  const startIdx = clean.search(/<svg\b/i)
  const endIdx = clean.lastIndexOf("</svg>")
  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) return null

  const slice = clean.slice(startIdx, endIdx + 6).trim()
  // Ensure there is only one <svg> root tag
  const openSvgMatches = slice.match(/<svg\b/gi)
  if (!openSvgMatches || openSvgMatches.length !== 1) return null

  return slice
}

function parseViewBox(svgOpenTag: string): { minX: number; minY: number; width: number; height: number } | null {
  const vbMatch = svgOpenTag.match(/\bviewBox\s*=\s*["']\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s*["']/i)
  if (vbMatch) {
    const minX = Number(vbMatch[1])
    const minY = Number(vbMatch[2])
    const width = Number(vbMatch[3])
    const height = Number(vbMatch[4])
    if ([minX, minY, width, height].every(Number.isFinite) && width >= 40 && height >= 40) {
      return { minX, minY, width, height }
    }
    return null
  }

  const wMatch = svgOpenTag.match(/\bwidth\s*=\s*["']\s*(\d+(?:\.\d+)?)(?:px)?\s*["']/i)
  const hMatch = svgOpenTag.match(/\bheight\s*=\s*["']\s*(\d+(?:\.\d+)?)(?:px)?\s*["']/i)
  if (wMatch && hMatch) {
    const width = Number(wMatch[1])
    const height = Number(hMatch[1])
    if (Number.isFinite(width) && Number.isFinite(height) && width >= 40 && height >= 40) {
      return { minX: 0, minY: 0, width, height }
    }
  }
  return null
}

function checkBalancedSvgTags(svg: string): boolean {
  // Verify self-closing tags and matching open/close tags for standard SVG elements
  const stripped = svg
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<\?[\s\S]*?\?>/g, "")
  const tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9:-]*)(?:\s[^>]*)?\/?>/g
  const stack: string[] = []
  let match: RegExpExecArray | null

  while ((match = tagRegex.exec(stripped)) !== null) {
    const full = match[0]
    const tag = match[1].toLowerCase()
    if (full.endsWith("/>")) continue
    if (full.startsWith("</")) {
      const top = stack.pop()
      if (top !== tag) return false
    } else {
      stack.push(tag)
    }
  }
  return stack.length === 0
}

export function extractSvgTextLabels(svg: string): string[] {
  const labels: string[] = []
  const textRe = /<text\b[^>]*>([\s\S]*?)<\/text>/gi
  let m: RegExpExecArray | null
  while ((m = textRe.exec(svg)) !== null) {
    const inner = m[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
    if (inner) labels.push(inner)
  }
  return labels
}

/**
 * Validates and sanitizes an educational SVG diagram for safety, well-formed XML structure,
 * non-empty geometric primitives, readable bounding viewBox, and coordinate sanity.
 */
export function validateAndSanitizeSvg(rawSvg: string | undefined | null): SvgValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (!rawSvg || typeof rawSvg !== "string") {
    return { valid: false, errors: ["Missing SVG diagram string"], warnings, primitiveCount: 0, textLabels: [] }
  }

  let svg = extractSingleSvgBlock(rawSvg)
  if (!svg) {
    return {
      valid: false,
      errors: ["Diagram does not contain a valid single <svg>...</svg> block"],
      warnings,
      primitiveCount: 0,
      textLabels: [],
    }
  }

  // Block dangerous active content explicitly before sanitization
  if (/<script\b/i.test(svg) || /\son[a-z]+\s*=/i.test(svg) || /javascript:/i.test(svg)) {
    errors.push("SVG contains forbidden executable scripts or event handlers")
  }
  if (/<foreignObject\b/i.test(svg) || /<iframe\b/i.test(svg)) {
    errors.push("SVG contains forbidden embedded HTML elements (<foreignObject>/<iframe>)")
  }
  if (EXTERNAL_HREF_RE.test(svg)) {
    errors.push("SVG contains disallowed external <image> URL references")
  }

  if (errors.length > 0) {
    return { valid: false, errors, warnings, primitiveCount: 0, textLabels: [] }
  }

  // Defense-in-depth strip any remaining hazardous attributes/tags
  svg = svg
    .replace(UNSAFE_TAG_RE, "")
    .replace(EVENT_HANDLER_RE, "")
    .replace(JS_URI_RE, "")

  if (!checkBalancedSvgTags(svg)) {
    return {
      valid: false,
      errors: ["SVG contains malformed or unclosed XML tags"],
      warnings,
      primitiveCount: 0,
      textLabels: [],
    }
  }

  const openTagMatch = svg.match(/^<svg\b[^>]*>/i)
  if (!openTagMatch) {
    return { valid: false, errors: ["Missing <svg> opening tag"], warnings, primitiveCount: 0, textLabels: [] }
  }

  let openTag = openTagMatch[0]
  const parsedVb = parseViewBox(openTag)
  if (!parsedVb) {
    return {
      valid: false,
      errors: ["SVG must declare a valid positive viewBox (or numeric width & height >= 40)"],
      warnings,
      primitiveCount: 0,
      textLabels: [],
    }
  }

  // Ensure xmlns and viewBox attributes are explicitly present on <svg>
  if (!/\bxmlns\s*=/i.test(openTag)) {
    openTag = openTag.replace(/^<svg\b/i, '<svg xmlns="http://www.w3.org/2000/svg"')
  }
  if (!/\bviewBox\s*=/i.test(openTag)) {
    openTag = openTag.replace(
      /^<svg\b/i,
      `<svg viewBox="${parsedVb.minX} ${parsedVb.minY} ${parsedVb.width} ${parsedVb.height}"`
    )
  }
  svg = openTag + svg.slice(openTagMatch[0].length)

  const primitiveMatches = svg.match(/<(path|circle|rect|line|polygon|polyline|ellipse)\b/gi) || []
  const primitiveCount = primitiveMatches.length
  const textLabels = extractSvgTextLabels(svg)

  if (primitiveCount < 2) {
    errors.push(`SVG diagram too sparse (${primitiveCount} geometric primitive(s); expected at least 2)`)
  }

  if (textLabels.length === 0) {
    warnings.push("SVG diagram contains no <text> labels")
  }

  // Reject raw unrendered LaTeX commands or $math$ delimiters inside SVG <text> labels
  const rawTexLabel = textLabels.find((lbl) => /\\(?:ce|frac|sqrt|text|overset|xrightarrow)\b|\$[^$\n]+\$/.test(lbl))
  if (rawTexLabel) {
    errors.push(
      `SVG <text> contains raw LaTeX ("${rawTexLabel.slice(0, 40)}"); use Unicode subscripts/superscripts (e.g. H₂SO₄, NO₂, sp², ⁺, ⁻) or <tspan> instead`
    )
  }

  // Check if <text> coordinates lie wildly outside viewBox
  const textCoordRe = /<text\b[^>]*\bx\s*=\s*["']\s*([-\d.]+)\s*["'][^>]*\by\s*=\s*["']\s*([-\d.]+)\s*["']/gi
  let tMatch: RegExpExecArray | null
  let clippedCount = 0
  while ((tMatch = textCoordRe.exec(svg)) !== null) {
    const tx = Number(tMatch[1])
    const ty = Number(tMatch[2])
    if (
      tx < parsedVb.minX - 10 ||
      ty < parsedVb.minY - 5 ||
      tx > parsedVb.minX + parsedVb.width + 10 ||
      ty > parsedVb.minY + parsedVb.height + 15
    ) {
      clippedCount++
    }
  }
  if (clippedCount > 0) {
    warnings.push(`${clippedCount} SVG text label(s) extend near or beyond viewBox bounds`)
  }

  return {
    valid: errors.length === 0,
    sanitizedSvg: errors.length === 0 ? svg : undefined,
    errors,
    warnings,
    primitiveCount,
    textLabels,
    viewBox: parsedVb,
  }
}

export function computeSvgFingerprint(svg: string): string {
  const tags = (svg.match(/<(path|circle|rect|line|polygon|polyline|ellipse|text)\b/gi) || [])
    .map((t) => t.slice(1).toLowerCase())
    .reduce<Record<string, number>>((acc, t) => {
      acc[t] = (acc[t] || 0) + 1
      return acc
    }, {})

  const tagSummary = Object.entries(tags)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${v}`)
    .join(",")

  const labels = extractSvgTextLabels(svg)
    .map((l) => l.toLowerCase().replace(/[^a-z0-9]/g, ""))
    .filter(Boolean)
    .sort()
    .join("|")

  const numCount = (svg.match(/-?\d+(?:\.\d+)?/g) || []).length
  return `${tagSummary}#nums:${numCount}#labels:${labels}`
}

