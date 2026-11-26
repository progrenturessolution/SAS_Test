import mongoose, { Schema, Document } from "mongoose"

export interface IQuestion {
  _id?: string
  type: "mcq" | "mcq_multi" | "assertion" | "truefalse" | "descriptive" | "fillblanks" | "diagram" | "coding"
  questionFormat?: string
  assertionText?: string
  reasonText?: string
  questionText: string
  explanation?: string
  chapter?: string
  topic?: string
  subject?: string
  grade?: string
  classLevel?: string
  options?: string[]
  correctAnswer?: string | string[]
  modelAnswer?: string
  rubric?: string[]
  caseInsensitive?: boolean
  pyqReference?: string
  learningObjective?: string
  marks: number
  difficulty?: "easy" | "medium" | "hard"
  wordLimit?: number
  blanks?: { id: number; label: string; answer: string; alsoAccept?: string[] }[]
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
  examType: string
  subject: string
  description: string
  instructions: string[]
  duration: number
  minDuration?: number
  totalMarks: number
  passMarks: number
  status: "draft" | "active" | "closed"
  sections: {
    name: string
    type: "mcq" | "assertion" | "truefalse" | "descriptive" | "fillblanks" | "coding"
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
    minDuration?: number
    randomize: boolean
    showResults: boolean
    resultsPublished?: boolean
    allowReview: boolean
    negativeMarking: boolean
    allowCalculator?: boolean
    enableCalculator?: boolean
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
    competitiveGenerator?: {
      selectedExam: string
      selectedGrade: string
      selectedSubjects: string[]
      selectedSubject: string
      activeSubjectTab: string
      selectedChapters: string[]
      selectedTopics: string[]
      uploadedSyllabusText: string
      uploadedPdf: { name: string; size: number; wordCount: number } | null
      blueprintFormats: { id: string; label: string; checked: boolean; count: number; marks: number }[]
      subjectDist: Record<string, { questions: number; marksPerQuestion: number; marks: number }>
      class11Weightage: number
      class12Weightage: number
      questionCount: number
      difficulty: string
      pattern: string
      focusPYQ: boolean
    }
  }
  createdBy: string
  instituteId?: mongoose.Types.ObjectId | string
  sharedWith?: string[]
  createdAt: Date
  updatedAt: Date
  class?: string
  questionsPerMin?: number
}

const QuestionSchema = new Schema<IQuestion>({
  type: { type: String, enum: ["mcq", "mcq_multi", "assertion", "truefalse", "descriptive", "fillblanks", "diagram", "coding"], required: true },
  topic: String,
  classLevel: String,
  modelAnswer: String,
  rubric: [String],
  caseInsensitive: { type: Boolean, default: true },
  pyqReference: String,
  learningObjective: String,
  questionFormat: String,
  assertionText: String,
  reasonText: String,
  questionText: { type: String, required: true },
  explanation: String,
  chapter: String,
  subject: String,
  grade: String,
  options: [String],
  correctAnswer: Schema.Types.Mixed,
  marks: { type: Number, required: true, default: 1 },
  difficulty: { type: String, enum: ["easy", "medium", "hard"], default: "medium" },
  wordLimit: Number,
  blanks: [{ id: Number, label: String, answer: String, alsoAccept: [String] }],
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
    examType: { type: String, default: "CUSTOM" },
    subject: { type: String, default: "" },
    description: { type: String, default: "" },
    instructions: [String],
    duration: { type: Number, required: true },
    minDuration: { type: Number },
    totalMarks: { type: Number, required: true },
    passMarks: { type: Number, required: true },
    status: { type: String, enum: ["draft", "active", "closed"], default: "draft" },
    class: String,
    questionsPerMin: { type: Number },
    sections: [
      {
        name: String,
        type: { type: String, enum: ["mcq", "mcq_multi", "assertion", "truefalse", "descriptive", "fillblanks", "diagram", "coding"] },
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
      minDuration: { type: Number },
      randomize: { type: Boolean, default: false },
      showResults: { type: Boolean, default: true },
      resultsPublished: { type: Boolean, default: false },
      allowReview: { type: Boolean, default: false },
      negativeMarking: { type: Boolean, default: false },
      allowCalculator: { type: Boolean, default: false },
      enableCalculator: { type: Boolean, default: false },
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
      competitiveGenerator: { type: Schema.Types.Mixed },
    },
    createdBy: { type: String, required: true },
    instituteId: { type: Schema.Types.ObjectId, ref: "Institute", index: true },
    sharedWith: [{ type: String }],
  },
  { timestamps: true }
)

// Safe model registration: reuse an already-registered model to prevent
// OverwriteModelError on hot-reloads and serverless cold-start race conditions.
if (mongoose.models.Exam) {
  mongoose.deleteModel("Exam")
}
const Exam = mongoose.model<IExam>("Exam", ExamSchema)

export default Exam
