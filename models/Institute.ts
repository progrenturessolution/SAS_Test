import mongoose, { Schema, Document, Types } from "mongoose"

export interface IInstituteLimits {
  maxStudents: number
  maxExams: number
  examTypes: string[]
  customQuestionTypes: ("mcq" | "truefalse" | "descriptive" | "fillblanks" | "coding")[]
  features: {
    neetJeeGenerator: boolean
    aiProctoring: boolean
    pdfImport: boolean
  }
}

export interface IInstitute extends Document {
  name: string

  code: string
  email: string
  phone?: string
  address?: string
  city?: string
  contactPerson?: string
  logo?: string
  limits: IInstituteLimits
  validUntil?: Date
  status: "active" | "suspended" | "expired"
  adminUserId?: Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

const InstituteSchema = new Schema<IInstitute>(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    address: { type: String, trim: true },
    city: { type: String, trim: true },
    contactPerson: { type: String, trim: true },
    logo: { type: String },
    limits: {
      maxStudents: { type: Number, default: 100 },
      maxExams: { type: Number, default: 20 },
      examTypes: {
        type: [String],
        default: ["NEET", "JEE_MAIN", "JEE_ADVANCED", "MHT_CET", "CBSE_BOARD", "CUSTOM"],
      },
      customQuestionTypes: {
        type: [String],
        enum: ["mcq", "truefalse", "descriptive", "fillblanks", "coding"],
        default: ["mcq", "truefalse", "descriptive", "fillblanks", "coding"],
      },
      features: {
        neetJeeGenerator: { type: Boolean, default: true },
        aiProctoring: { type: Boolean, default: true },
        pdfImport: { type: Boolean, default: true },
      },
    },
    validUntil: { type: Date },
    status: {
      type: String,
      enum: ["active", "suspended", "expired"],
      default: "active",
    },
    adminUserId: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
)

const Institute =
  (mongoose.models.Institute as mongoose.Model<IInstitute>) ||
  mongoose.model<IInstitute>("Institute", InstituteSchema)

export default Institute
