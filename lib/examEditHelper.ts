export function getExamEditUrl(exam: { _id: string; examType?: string; subject?: string } | null | undefined): string {
  if (!exam?._id) return "/admin/exams"
  const type = String(exam.examType || "").trim().toUpperCase()
  if (type === "OTHER") {
    return `/admin/other-exams?edit=${exam._id}`
  }
  if (["NEET", "JEE_MAIN", "JEE_ADVANCED", "MHT_CET", "CBSE_BOARD", "COMPETITIVE", "CUET", "NDA", "BITSAT"].includes(type)) {
    return `/admin/ai-generator?edit=${exam._id}`
  }
  return `/admin/exams/${exam._id}/edit`
}

