import mongoose from "mongoose"
import dns from "dns"

try {
  dns.setDefaultResultOrder("ipv4first")
  dns.setServers(["8.8.8.8", "1.1.1.1"])
} catch {}

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/dummy"

declare global {
  // eslint-disable-next-line no-var
  var mongoose: { conn: typeof import("mongoose") | null; promise: Promise<typeof import("mongoose")> | null }
}

let cached = global.mongoose

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null }
}

async function connectDB() {
  if (cached.conn) {
    return cached.conn
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    }
    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      console.log("✅ Database connected successfully to MongoDB!")
      return mongoose
    })
  }

  try {
    cached.conn = await cached.promise
  } catch (e) {
    cached.promise = null
    console.error("❌ MongoDB connection failed:", e)
    throw e
  }

  return cached.conn
}

export default connectDB
