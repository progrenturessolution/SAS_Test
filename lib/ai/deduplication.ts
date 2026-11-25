import type { CanonicalQuestion } from "./canonicalSchema"
import { computeSvgFingerprint } from "./diagramValidator"

export type DuplicateReason =
  | "exact_text"
  | "normalized_text"
  | "rephrased_semantic"
  | "numeric_template_clone"
  | "formula_signature_overlap"
  | "duplicate_diagram"
  | "learning_objective_saturation"

export interface DuplicateCheckResult {
  isDuplicate: boolean
  reason?: DuplicateReason
  matchedQuestionId?: string
  similarity?: number
  detail?: string
}

interface QuestionFingerprint {
  id: string
  exactNorm: string
  alphaNorm: string
  numericSkeleton: string
  bigrams: Set<string>
  contentTokens: Set<string>
  formulaSignature: string
  svgFingerprint: string
  learningObjectiveNorm: string
  numericValuesSignature: string
}

const STOPWORDS = new Set([
  "the", "is", "are", "was", "were", "a", "an", "and", "or", "of", "to", "in", "on", "at", "by",
  "for", "from", "with", "which", "what", "when", "where", "who", "whom", "whose", "how", "why",
  "following", "statement", "statements", "correct", "incorrect", "true", "false", "find",
  "calculate", "determine", "value", "given", "below", "respectively", "among", "between", "into",
  "that", "this", "these", "those", "does", "not", "can", "will", "be", "has", "have", "had",
  "assertion", "reason", "both", "one", "option", "options",
])

export function normalizeAlphaText(text: string): string {
  return String(text || "")
    .toLowerCase()
    .replace(/\$/g, "")
    .replace(/\\[a-z]+/g, (m) => m.slice(1))
    .replace(/[^a-z0-9]/g, "")
}

export function buildNumericSkeleton(text: string): { skeleton: string; valuesSig: string } {
  const nums: string[] = []
  const cleaned = String(text || "")
    .toLowerCase()
    .replace(/\$/g, "")
    .replace(/(\d+(?:\.\d+)?)\s*(?:×10\^\{?-?\d+\}?|e[+-]?\d+)?/gi, (full) => {
      nums.push(full.trim())
      return " <num> "
    })
    .replace(/[^a-z<>]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  return {
    skeleton: cleaned,
    valuesSig: nums.join(","),
  }
}

function tokenizeContent(text: string): { tokens: Set<string>; bigrams: Set<string> } {
  const words = String(text || "")
    .toLowerCase()
    .replace(/\$|\\[a-z]+/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w))

  const tokens = new Set(words)
  const bigrams = new Set<string>()
  for (let i = 0; i < words.length - 1; i++) {
    bigrams.add(`${words[i]}_${words[i + 1]}`)
  }
  return { tokens, bigrams }
}

function extractFormulaSignature(text: string): string {
  const formulas = [
    ...(String(text || "").match(/\$\$[\s\S]*?\$\$/g) || []),
    ...(String(text || "").match(/\$[^$\n]+\$/g) || []),
  ]
  if (formulas.length === 0) return ""
  return formulas
    .map((f) => f.replace(/[\s${}]/g, "").replace(/\d+(?:\.\d+)?/g, "N").toLowerCase())
    .filter((f) => f.length >= 4)
    .sort()
    .join("|")
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let intersection = 0
  for (const item of a) {
    if (b.has(item)) intersection++
  }
  const union = a.size + b.size - intersection
  return union === 0 ? 0 : intersection / union
}

function diceWordsSimilarity(aStr: string, bStr: string): number {
  const aWords = new Set(aStr.split(" ").filter(Boolean))
  const bWords = new Set(bStr.split(" ").filter(Boolean))
  return jaccardSimilarity(aWords, bWords)
}

export function computeQuestionFingerprint(q: Pick<CanonicalQuestion, "id" | "questionText" | "options" | "questionImage" | "learningObjective">): QuestionFingerprint {
  const stem = String(q.questionText || "").trim()
  const exactNorm = stem.toLowerCase().replace(/\s+/g, " ")
  const alphaNorm = normalizeAlphaText(stem)
  const { skeleton, valuesSig } = buildNumericSkeleton(stem)
  const { tokens, bigrams } = tokenizeContent(stem)
  const formulaSignature = extractFormulaSignature(`${stem} ${(q.options || []).join(" ")}`)
  const svgFingerprint = q.questionImage && q.questionImage.includes("<svg")
    ? computeSvgFingerprint(q.questionImage)
    : ""
  const learningObjectiveNorm = String(q.learningObjective || "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  return {
    id: q.id,
    exactNorm,
    alphaNorm,
    numericSkeleton: skeleton,
    numericValuesSignature: valuesSig,
    bigrams,
    contentTokens: tokens,
    formulaSignature,
    svgFingerprint,
    learningObjectiveNorm,
  }
}

export interface DeduplicatorOptions {
  maxPerLearningObjective?: number
  semanticThreshold?: number
  numericCloneThreshold?: number
}

export class QuestionDeduplicator {
  private readonly fingerprints: QuestionFingerprint[] = []
  private readonly objectiveCounts = new Map<string, number>()
  private readonly maxPerObjective: number
  private readonly semanticThreshold: number
  private readonly numericCloneThreshold: number

  constructor(existingQuestions: Array<Pick<CanonicalQuestion, "id" | "questionText" | "options" | "questionImage" | "learningObjective">> = [], opts: DeduplicatorOptions = {}) {
    this.maxPerObjective = opts.maxPerLearningObjective ?? 3
    this.semanticThreshold = opts.semanticThreshold ?? 0.68
    this.numericCloneThreshold = opts.numericCloneThreshold ?? 0.78

    for (const eq of existingQuestions) {
      this.add(eq)
    }
  }

  add(q: Pick<CanonicalQuestion, "id" | "questionText" | "options" | "questionImage" | "learningObjective">): void {
    const fp = computeQuestionFingerprint(q)
    this.fingerprints.push(fp)
    if (fp.learningObjectiveNorm.length >= 6) {
      this.objectiveCounts.set(
        fp.learningObjectiveNorm,
        (this.objectiveCounts.get(fp.learningObjectiveNorm) || 0) + 1
      )
    }
  }

  check(q: Pick<CanonicalQuestion, "id" | "questionText" | "options" | "questionImage" | "learningObjective">): DuplicateCheckResult {
    const fp = computeQuestionFingerprint(q)

    // Guard against over-concentration on an identical narrow micro-learning-objective
    if (fp.learningObjectiveNorm.length >= 10) {
      const count = this.objectiveCounts.get(fp.learningObjectiveNorm) || 0
      if (count >= this.maxPerObjective) {
        return {
          isDuplicate: true,
          reason: "learning_objective_saturation",
          detail: `Learning objective "${fp.learningObjectiveNorm}" already reached cap (${count}/${this.maxPerObjective})`,
        }
      }
    }

    for (const existing of this.fingerprints) {
      // Skip text/semantic collision when two questions carry distinct non-empty SVG diagrams
      const hasDistinctDiagrams =
        Boolean(fp.svgFingerprint) &&
        Boolean(existing.svgFingerprint) &&
        fp.svgFingerprint !== existing.svgFingerprint
      if (hasDistinctDiagrams) {
        continue
      }

      // 1. Exact stem match
      if (fp.exactNorm === existing.exactNorm) {
        return {
          isDuplicate: true,
          reason: "exact_text",
          matchedQuestionId: existing.id,
          similarity: 1,
          detail: "Exact question text duplicate",
        }
      }

      // 2. Normalized alphanumeric match
      if (fp.alphaNorm.length >= 16 && fp.alphaNorm === existing.alphaNorm) {
        return {
          isDuplicate: true,
          reason: "normalized_text",
          matchedQuestionId: existing.id,
          similarity: 1,
          detail: "Normalized text duplicate",
        }
      }

      // 3. Duplicate diagram fingerprint
      if (fp.svgFingerprint && existing.svgFingerprint && fp.svgFingerprint === existing.svgFingerprint) {
        // Also require reasonable stem overlap or identical labels so different conceptual questions reusing standard triangle don't fail unnecessarily
        const tokenSim = jaccardSimilarity(fp.contentTokens, existing.contentTokens)
        if (tokenSim >= 0.45) {
          return {
            isDuplicate: true,
            reason: "duplicate_diagram",
            matchedQuestionId: existing.id,
            similarity: tokenSim,
            detail: "Duplicate SVG diagram geometry & labels with similar stem",
          }
        }
      }

      // 4. Same numerical template with changed numerical constants
      if (fp.numericSkeleton.length >= 25 && existing.numericSkeleton.length >= 25) {
        const skelSim = diceWordsSimilarity(fp.numericSkeleton, existing.numericSkeleton)
        if (skelSim >= this.numericCloneThreshold) {
          const isNumericTemplate =
            fp.numericSkeleton.includes("<num>") && existing.numericSkeleton.includes("<num>")
          return {
            isDuplicate: true,
            reason: isNumericTemplate ? "numeric_template_clone" : "rephrased_semantic",
            matchedQuestionId: existing.id,
            similarity: skelSim,
            detail: isNumericTemplate
              ? `Same problem template with swapped numbers (${(skelSim * 100).toFixed(0)}% match)`
              : `Rephrased stem match (${(skelSim * 100).toFixed(0)}%)`,
          }
        }
      }

      // 5. Rephrased semantic similarity (content tokens + bigrams)
      if (fp.contentTokens.size >= 5 && existing.contentTokens.size >= 5) {
        const unigramSim = jaccardSimilarity(fp.contentTokens, existing.contentTokens)
        const bigramSim = jaccardSimilarity(fp.bigrams, existing.bigrams)
        const weighted = unigramSim * 0.65 + bigramSim * 0.35
        if (weighted >= this.semanticThreshold || (unigramSim >= 0.72 && bigramSim >= 0.4)) {
          return {
            isDuplicate: true,
            reason: "rephrased_semantic",
            matchedQuestionId: existing.id,
            similarity: weighted,
            detail: `High semantic overlap (${(weighted * 100).toFixed(0)}%)`,
          }
        }
      }

      // 6. Same formula/chemical reaction + moderate stem overlap (catches formula rewordings)
      if (
        fp.formulaSignature &&
        existing.formulaSignature &&
        fp.formulaSignature === existing.formulaSignature
      ) {
        const unigramSim = jaccardSimilarity(fp.contentTokens, existing.contentTokens)
        if (unigramSim >= 0.5) {
          return {
            isDuplicate: true,
            reason: "formula_signature_overlap",
            matchedQuestionId: existing.id,
            similarity: unigramSim,
            detail: "Identical core mathematical/chemical formula signature with similar stem",
          }
        }
      }
    }

    return { isDuplicate: false }
  }
}
