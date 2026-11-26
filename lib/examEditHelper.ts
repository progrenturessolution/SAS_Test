export type ExamSectionSource = "exam" | "entrance" | "other"

const ENTRANCE_EXAM_TYPES = new Set([
  "NEET",
  "JEE_MAIN",
  "JEE_ADVANCED",
  "MHT_CET",
  "CBSE_BOARD",
  "COMPETITIVE",
  "CUET",
  "NDA",
  "BITSAT",
])

export function getExamSectionSource(exam: { examType?: string } | null | undefined): ExamSectionSource {
  const type = String(exam?.examType || "").trim().toUpperCase()
  if (type === "OTHER" || type === "OTHER_EXAMS") {
    return "other"
  }
  if (ENTRANCE_EXAM_TYPES.has(type)) {
    return "entrance"
  }
  return "exam"
}

export function getExamSectionLabel(exam: { examType?: string } | null | undefined): string {
  const source = getExamSectionSource(exam)
  if (source === "entrance") return "Entrance Exam"
  if (source === "other") return "Other Exam"
  return "Exam Section"
}

export function getExamEditUrl(exam: { _id: string; examType?: string; subject?: string } | null | undefined): string {
  if (!exam?._id) return "/admin/exams"
  const source = getExamSectionSource(exam)
  if (source === "other") {
    return `/admin/other-exams?edit=${exam._id}`
  }
  if (source === "entrance") {
    return `/admin/ai-generator?edit=${exam._id}`
  }
  return `/admin/exams/${exam._id}/edit`
}

