import mongoose, { Schema, Document } from "mongoose"

export interface IGlobalSettings extends Document {
  platformName: string
  supportEmail: string
  supportPhone: string
  proctoring: {
    faceDetection: boolean
    tabSwitch: boolean
    fullscreen: boolean
    mobileFaceDetection: boolean
    maxWarnings: number
  }
  updatedAt: Date
}

const GlobalSettingsSchema = new Schema<IGlobalSettings>(
  {
    platformName: { type: String, default: "Progrentures Exam Platform" },
    supportEmail: { type: String, default: "support@progrentures.com" },
    supportPhone: { type: String, default: "+91 93094 70958" },
    proctoring: {
      faceDetection: { type: Boolean, default: true },
      tabSwitch: { type: Boolean, default: true },
      fullscreen: { type: Boolean, default: true },
      mobileFaceDetection: { type: Boolean, default: false },
      maxWarnings: { type: Number, default: 3 },
    },
  },
  { timestamps: true }
)

const GlobalSettings =
  (mongoose.models.GlobalSettings as mongoose.Model<IGlobalSettings>) ||
  mongoose.model<IGlobalSettings>("GlobalSettings", GlobalSettingsSchema)

export default GlobalSettings
