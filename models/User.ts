import mongoose, { Schema, Document } from "mongoose"
import bcrypt from "bcryptjs"

export interface IUser extends Document {
  name: string
  email: string
  password: string
  role: "super_admin" | "admin" | "institute" | "student"
  rollNumber?: string
  instituteId?: mongoose.Types.ObjectId
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
  },
  { timestamps: true }
)

// IMPORTANT: async middleware in Mongoose must NOT accept `next` as a parameter.
// Mongoose detects async functions and resolves the returned Promise automatically.
// Passing `next` and then calling it causes "next is not a function" errors.
UserSchema.pre("save", async function () {
  if (!this.isModified("password")) return
  this.password = await bcrypt.hash(this.password, 10)
})

UserSchema.methods.comparePassword = async function (password: string): Promise<boolean> {
  return bcrypt.compare(password, this.password)
}

// Safe model registration — prevents OverwriteModelError on hot-reload
const User = (mongoose.models.User as mongoose.Model<IUser>) ||
  mongoose.model<IUser>("User", UserSchema)
export default User
