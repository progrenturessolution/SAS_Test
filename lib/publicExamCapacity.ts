export interface PublicExamCapacity {
  maxStudents: number
  usedSeats: number
  remainingSeats: number
  limitReached: boolean
}

/**
 * Pure calculation for public participant capacity given an institute's maxStudents limit
 * and current count of public attempts on an exam.
 */
export function computePublicExamCapacity(
  maxStudents: number,
  usedSeats: number
): PublicExamCapacity {
  const safeMax = Math.max(0, Math.floor(Number(maxStudents) || 0))
  const safeUsed = Math.max(0, Math.floor(Number(usedSeats) || 0))
  const remainingSeats = Math.max(0, safeMax - safeUsed)
  return {
    maxStudents: safeMax,
    usedSeats: safeUsed,
    remainingSeats,
    limitReached: safeUsed >= safeMax,
  }
}

