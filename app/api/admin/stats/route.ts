import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import connectDB from "@/lib/mongodb"
import Exam from "@/models/Exam"
import Attempt from "@/models/Attempt"

// GET /api/admin/stats
export async function GET() {
  const session = await getSession()
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  try {
    await connectDB()

    // Determine query restriction based on user role/ownership
    const query = {
      $or: [{ createdBy: session.id }, { sharedWith: session.email }]
    };

    const accessibleExams = await Exam.find(query, '_id sections status createdAt').lean();
    const examIds = accessibleExams.map(ex => ex._id);

    const totalExams = accessibleExams.length;
    const activeExams = accessibleExams.filter(e => e.status === 'active').length;

    const totalQuestions = accessibleExams.reduce((sum, exam) => {
      return sum + (exam.sections || []).reduce((s: number, sec: { questions: unknown[] }) => s + (sec.questions?.length || 0), 0)
    }, 0)

    const thisMonth = new Date()
    thisMonth.setDate(1)
    thisMonth.setHours(0, 0, 0, 0)
    
    const examsThisMonth = accessibleExams.filter(e => e.createdAt && new Date(e.createdAt) >= thisMonth).length;

    const attemptsCount = await Attempt.countDocuments({ examId: { $in: examIds } })
    const studentsThisMonth = await Attempt.countDocuments({ examId: { $in: examIds }, startedAt: { $gte: thisMonth } })

    return NextResponse.json({
      totalExams,
      activeExams,
      totalQuestions,
      studentsEnrolled: attemptsCount, // Each attempt essentially maps to an enrolled student acting on an exam
      examsThisMonth,
      studentsThisMonth,
    })
  } catch (error) {
    console.error("Stats error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}