import Attempt from "@/models/Attempt"
import Institute from "@/models/Institute"
import User from "@/models/User"
import { computePublicExamCapacity, type PublicExamCapacity } from "@/lib/publicExamCapacity"

export type { PublicExamCapacity }

export interface ExamInstituteRef {
  instituteId?: unknown
  createdBy?: unknown
  _id?: unknown
}

/**
 * Resolves the owning Institute document for an exam (using exam.instituteId
 * or falling back to the exam creator's instituteId).
 */
export async function resolveExamInstitute(
  exam: ExamInstituteRef | null | undefined,
  options?: { includeLogo?: boolean }
) {
  if (!exam) return null

  const selectFields = options?.includeLogo === false
    ? "name code themeColor limits.maxStudents status"
    : "name code logo themeColor limits.maxStudents status"

  let targetInstId = exam.instituteId ? String(exam.instituteId) : ""
  if (!targetInstId && exam.createdBy) {
    try {
      const creator = await User.findById(exam.createdBy).select("instituteId").lean()
      if (creator?.instituteId) {
        targetInstId = String(creator.instituteId)
      }
    } catch {
      // Ignore invalid/non-ObjectId createdBy strings (e.g. legacy system IDs)
    }
  }

  if (!targetInstId) return null

  try {
    return await Institute.findById(targetInstId).select(selectFields).lean()
  } catch {
    return null
  }
}

/**
 * Loads the public attempt count vs institute maxStudents limit for a given exam.
 * Returns null if the exam does not belong to an institute with a numeric maxStudents limit.
 */
export async function getPublicExamCapacity(
  exam: ExamInstituteRef | null | undefined,
  preloadedInstitute?: { limits?: { maxStudents?: number } } | null
): Promise<PublicExamCapacity | null> {
  if (!exam?._id) return null

  const countQuery = Attempt.countDocuments({
    examId: exam._id,
    candidateType: "public",
    status: { $in: ["in-progress", "submitted", "auto-submitted", "graded"] },
  })

  // Parallelize Institute lookup (without heavy base64 logo) and Attempt seat count when possible
  const [inst, usedSeats] = await Promise.all([
    preloadedInstitute !== undefined
      ? Promise.resolve(preloadedInstitute)
      : resolveExamInstitute(exam, { includeLogo: false }),
    countQuery,
  ])

  if (!inst) return null

  const rawLimit = inst.limits?.maxStudents
  const maxStudents = typeof rawLimit === "number" && Number.isFinite(rawLimit) ? rawLimit : 100

  return computePublicExamCapacity(maxStudents, usedSeats)
}
