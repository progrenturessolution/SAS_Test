import mongoose, { Schema, Document } from "mongoose"
import bcrypt from "bcryptjs"

export interface IUser extends Document {
  name: string
  email: string
  password: string
  role: "super_admin" | "admin" | "institute" | "student"
  rollNumber?: string
  instituteId?: mongoose.Types.ObjectId
  phone?: string
  batch?: string
  totalFees?: number
  completedFees?: number
  pendingFees?: number
  status?: "active" | "deactivated"
  isActive?: boolean
  deactivationReason?: string
  examPassword?: string
  createdAt: Date
  comparePassword(password: string): Promise<boolean>
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["super_admin", "admin", "institute", "student"], default: "institute" },
    rollNumber: { type: String, trim: true },
    instituteId: { type: Schema.Types.ObjectId, ref: "Institute" },
    phone: { type: String, trim: true, default: "" },
    batch: { type: String, trim: true, default: "" },
    totalFees: { type: Number, default: 0 },
    completedFees: { type: Number, default: 0 },
    pendingFees: { type: Number, default: 0 },
    status: { type: String, enum: ["active", "deactivated"], default: "active" },
    isActive: { type: Boolean, default: true },
    deactivationReason: { type: String, default: "", trim: true },
    examPassword: { type: String, default: "", trim: true },
  },
  { timestamps: true, strict: false }
)

// IMPORTANT: async middleware in Mongoose must NOT accept `next` as a parameter.
// Mongoose detects async functions and resolves the returned Promise automatically.
// Passing `next` and then calling it causes "next is not a function" errors.
UserSchema.pre("save", async function () {
  if (!this.isModified("password")) return
  this.password = await bcrypt.hash(this.password, 10)
})

UserSchema.index({ role: 1, instituteId: 1, email: 1 })
UserSchema.index({ role: 1, instituteId: 1, rollNumber: 1 })
UserSchema.index({ role: 1, rollNumber: 1 })

UserSchema.methods.comparePassword = async function (password: string): Promise<boolean> {
  return bcrypt.compare(password, this.password)
}

// In Next.js dev mode, invalidate cached model if it lacks the latest schema fields
if (mongoose.models.User) {
  const paths = (mongoose.models.User as any).schema?.paths || {}
  if (!paths.totalFees || !paths.phone || !paths.batch || !paths.status || !paths.deactivationReason || !paths.examPassword) {
    delete (mongoose.models as any).User
  }
}

// Safe model registration — prevents OverwriteModelError on hot-reload
const User = (mongoose.models.User as mongoose.Model<IUser>) ||
  mongoose.model<IUser>("User", UserSchema)
export default User
