import mongoose, { Schema, Document } from "mongoose"

export interface ISupportQuery extends Document {
  instituteId: mongoose.Types.ObjectId
  instituteName: string
  instituteCode?: string
  contactEmail: string
  contactPhone?: string
  submittedBy?: mongoose.Types.ObjectId
  submittedByName?: string
  subject: string
  category: "general" | "quota_increase" | "billing_fees" | "feature_request" | "technical_issue" | "other"
  message: string
  status: "pending" | "replied" | "resolved"
  isReadByAdmin: boolean
  isReadByInstitute: boolean
  adminReply?: string
  adminRepliedAt?: Date
  adminRepliedByName?: string
  createdAt: Date
  updatedAt: Date
}

const SupportQuerySchema = new Schema<ISupportQuery>(
  {
    instituteId: { type: Schema.Types.ObjectId, ref: "Institute", required: true },
    instituteName: { type: String, required: true },
    instituteCode: { type: String, default: "" },
    contactEmail: { type: String, required: true },
    contactPhone: { type: String, default: "" },
    submittedBy: { type: Schema.Types.ObjectId, ref: "User" },
    submittedByName: { type: String, default: "" },
    subject: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: ["general", "quota_increase", "billing_fees", "feature_request", "technical_issue", "other"],
      default: "general",
    },
    message: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["pending", "replied", "resolved"],
      default: "pending",
    },
    isReadByAdmin: { type: Boolean, default: false },
    isReadByInstitute: { type: Boolean, default: true },
    adminReply: { type: String, default: "" },
    adminRepliedAt: { type: Date },
    adminRepliedByName: { type: String, default: "" },
  },
  { timestamps: true }
)

const SupportQuery =
  (mongoose.models.SupportQuery as mongoose.Model<ISupportQuery>) ||
  mongoose.model<ISupportQuery>("SupportQuery", SupportQuerySchema)

export default SupportQuery

