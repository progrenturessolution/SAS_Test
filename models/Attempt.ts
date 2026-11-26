import mongoose, { Schema, Document, Types } from "mongoose"

export interface IAttempt extends Document {
  examId: Types.ObjectId | string
  studentName: string
  studentEmail: string
  studentPhone?: string
  rollNumber: string
  startedAt: Date
  submittedAt?: Date
  timeSpent?: number
  status: "in-progress" | "submitted" | "auto-submitted" | "graded"
  answers: {
    questionId: string
    sectionType: string
    answer: string | string[]
    isMarkedForReview?: boolean
    testResults?: any
    totalPassed?: number
    totalCases?: number
    manualScore?: number
    earnedMarks?: number
    isCorrect?: boolean
    feedback?: string
    aiEvaluation?: {
      score?: number
      maxScore?: number
      verdict?: string
      whyRight?: string
      whyWrong?: string
      feedback?: string
    }
  }[]
  score?: number
  manualScore?: number
  maxScore?: number
  percentage?: number
  passed?: boolean
  isGraded?: boolean
  sectionResults?: {
    name: string
    type: string
    attempted: number
    total: number
    correctOrMarked: number
    score: number
    maxScore: number
  }[]
  proctoring: {
    warnings: number
    events: {
      type: "tab-switch" | "face-not-detected" | "fullscreen-exit" | "multiple-faces" | "no-face"
      timestamp: Date
      details?: string
    }[]
    autoSubmitted?: boolean
  }
  timeLeft?: number
  lastSavedAt?: Date
  candidateType?: "institute" | "public"
}

const SectionResultSchema = new Schema(
  {
    name: { type: String, default: "" },
    type: { type: String, default: "mcq" },
    attempted: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    correctOrMarked: { type: Number, default: 0 },
    score: { type: Number, default: 0 },
    maxScore: { type: Number, default: 0 },
  },
  { _id: false, strict: false }
)

const AttemptSchema = new Schema<IAttempt>(
  {
    examId: { type: Schema.Types.ObjectId, ref: "Exam", required: true, index: true },
    studentName: { type: String, required: true },
    studentEmail: { type: String, required: true },
    studentPhone: { type: String, trim: true, default: "" },
    rollNumber: { type: String, required: true },
    startedAt: { type: Date, default: Date.now },
    candidateType: { type: String, enum: ["institute", "public"], default: "institute", index: true },
    submittedAt: Date,
    timeSpent: Number,
    status: { type: String, enum: ["in-progress", "submitted", "auto-submitted", "graded"], default: "in-progress" },
    answers: [
      {
        questionId: String,
        sectionType: String,
        answer: Schema.Types.Mixed,
        isMarkedForReview: { type: Boolean, default: false },
        testResults: Schema.Types.Mixed,
        totalPassed: Number,
        totalCases: Number,
        manualScore: { type: Number },
        earnedMarks: { type: Number },
        isCorrect: { type: Boolean },
        feedback: { type: String },
        aiEvaluation: {
          score: Number,
          maxScore: Number,
          verdict: String,
          whyRight: String,
          whyWrong: String,
          feedback: String,
        },
      },
    ],
    score: Number,
    manualScore: { type: Number },
    maxScore: Number,
    percentage: Number,
    passed: Boolean,
    isGraded: { type: Boolean, default: false },
    sectionResults: {
      type: [SectionResultSchema],
      default: [],
    },
    proctoring: {
      warnings: { type: Number, default: 0 },
      events: [
        {
          type: { type: String, enum: ["tab-switch", "face-not-detected", "fullscreen-exit", "multiple-faces", "no-face"] },
          timestamp: { type: Date, default: Date.now },
          details: String,
        },
      ],
      autoSubmitted: { type: Boolean, default: false },
    },
    timeLeft: Number,
    lastSavedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
)

if (mongoose.models.Attempt) {
  mongoose.deleteModel("Attempt");
}
const Attempt = mongoose.model<IAttempt>("Attempt", AttemptSchema)
export default Attempt
