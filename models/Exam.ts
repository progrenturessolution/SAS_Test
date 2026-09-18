import mongoose, { Schema, Document } from "mongoose"

export interface IQuestion {
  _id?: string
  type: "mcq" | "truefalse" | "descriptive" | "fillblanks" | "coding"
  questionText: string
  options?: string[]
  correctAnswer?: string | string[]
  marks: number
  difficulty?: "easy" | "medium" | "hard"
  wordLimit?: number
  blanks?: { id: number; label: string; answer: string }[]
  codeTemplate?: string
  codeTemplates?: Record<string, string>
  testCases?: { input: string; expectedOutput: string; hidden?: boolean }[]
  constraints?: string[]
  timeLimit?: number
  memoryLimit?: number
  scoringMode?: "all" | "partial"
  negativeMark?: number // Negative marks for this specific question
  driverCode?: Record<string, string>
  languages?: string[]
  questionImage?: string
  optionImages?: string[]
  codeSnippet?: string
}

export interface IExam extends Document {
  title: string
  subject: string
  description: string
  instructions: string[]
  duration: number
  totalMarks: number
  passMarks: number
  status: "draft" | "active" | "closed"
  sections: {
    name: string
    type: "mcq" | "truefalse" | "descriptive" | "fillblanks" | "coding"
    questionRange: string
    negativeMarking?: boolean
    sectionNegativeMark?: number // Default negative marks for all questions in this section
    questions: IQuestion[]
  }[]
  proctoring: {
    enabled: boolean
    faceDetection: boolean
    tabSwitch: boolean
    fullscreenExit: boolean
    maxWarnings: number
  }
  settings: {
    randomize: boolean
    showResults: boolean
    allowReview: boolean
    negativeMarking: boolean
    startDate?: Date
    startTime?: string
    endDate?: Date
    endTime?: string
    proctoring?: {
      faceDetection: boolean
      tabSwitch: boolean
      fullscreen: boolean
      aiProctoring: boolean
    }
  }
  createdBy: string
  sharedWith?: string[]
  createdAt: Date
  updatedAt: Date
  class?: string
}

const QuestionSchema = new Schema<IQuestion>({
  type: { type: String, enum: ["mcq", "truefalse", "descriptive", "fillblanks", "coding"], required: true },
  questionText: { type: String, required: true },
  options: [String],
  correctAnswer: Schema.Types.Mixed,
  marks: { type: Number, required: true, default: 1 },
  difficulty: { type: String, enum: ["easy", "medium", "hard"], default: "medium" },
  wordLimit: Number,
  blanks: [{ id: Number, label: String, answer: String }],
  codeTemplate: String,
  codeTemplates: { type: Map, of: String },
  testCases: [{ input: String, expectedOutput: String, hidden: Boolean }],
  constraints: [String],
  timeLimit: Number,
  memoryLimit: Number,
  scoringMode: { type: String, enum: ["all", "partial"], default: "partial" },
  negativeMark: { type: Number, default: 0 },
  driverCode: { type: Map, of: String },
  languages: [String],
  questionImage: String,
  optionImages: [String],
  codeSnippet: String,
})

const ExamSchema = new Schema<IExam>(
  {
    title: { type: String, required: true },
    subject: { type: String, default: "" },
    description: { type: String, default: "" },
    instructions: [String],
    duration: { type: Number, required: true },
    totalMarks: { type: Number, required: true },
    passMarks: { type: Number, required: true },
    status: { type: String, enum: ["draft", "active", "closed"], default: "draft" },
    class: String,
    sections: [
      {
        name: String,
        type: { type: String, enum: ["mcq", "truefalse", "descriptive", "fillblanks", "coding"] },
        questionRange: String,
        negativeMarking: { type: Boolean, default: false },
        sectionNegativeMark: { type: Number, default: 0 },
        questions: [QuestionSchema],
      },
    ],
    proctoring: {
      enabled: { type: Boolean, default: true },
      faceDetection: { type: Boolean, default: true },
      tabSwitch: { type: Boolean, default: true },
      fullscreenExit: { type: Boolean, default: true },
      maxWarnings: { type: Number, default: 3 },
    },
    settings: {
      randomize: { type: Boolean, default: false },
      showResults: { type: Boolean, default: true },
      allowReview: { type: Boolean, default: false },
      negativeMarking: { type: Boolean, default: false },
      startDate: { type: Date },
      startTime: { type: String },
      endDate: { type: Date },
      endTime: { type: String },
      proctoring: {
        faceDetection: { type: Boolean, default: true },
        tabSwitch: { type: Boolean, default: true },
        fullscreen: { type: Boolean, default: true },
        aiProctoring: { type: Boolean, default: false },
      },
    },
    createdBy: { type: String, required: true },
    sharedWith: [{ type: String }],
  },
  { timestamps: true }
)

// Safe model registration: reuse an already-registered model to prevent
// OverwriteModelError on hot-reloads and serverless cold-start race conditions.
const Exam =
  (mongoose.models.Exam as mongoose.Model<IExam>) ||
  mongoose.model<IExam>("Exam", ExamSchema)

export default Exam
