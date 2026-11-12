import mongoose from "mongoose"
import dns from "dns"

try {
  dns.setDefaultResultOrder("ipv4first")
  dns.setServers(["8.8.8.8", "1.1.1.1"])
} catch {}

const rawMongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || "mongodb://localhost:27017/dummy"

// Cache the resolved URI so DNS lookup only happens ONCE per process lifetime
let resolvedUriCache: string | null = null

async function getEffectiveMongoUri(uri: string): Promise<string> {
  if (!uri.startsWith("mongodb+srv://")) return uri
  // Return cached URI if already resolved — skips DNS on every cold start
  if (resolvedUriCache) return resolvedUriCache

  try {
    const customResolver = new dns.promises.Resolver()
    customResolver.setServers(["8.8.8.8", "1.1.1.1"])

    const parsed = new URL(uri)
    const hostname = parsed.hostname
    const srvRecords = await customResolver.resolveSrv(`_mongodb._tcp.${hostname}`)
    if (!srvRecords || srvRecords.length === 0) {
      resolvedUriCache = uri
      return uri
    }

    const hosts = srvRecords.map((r) => `${r.name}:${r.port}`).join(",")
    let txtParams = ""
    try {
      const txtRecords = await customResolver.resolveTxt(hostname)
      if (txtRecords && txtRecords.length > 0) {
        txtParams = txtRecords.map((r) => r.join("")).join("&")
      }
    } catch {}

    const auth = parsed.username ? `${parsed.username}:${parsed.password}@` : ""
    const dbPath = parsed.pathname || "/myDatabase"
    const searchParams = new URLSearchParams(parsed.search)
    searchParams.set("ssl", "true")
    if (txtParams) {
      const txtParsed = new URLSearchParams(txtParams)
      txtParsed.forEach((v, k) => {
        if (!searchParams.has(k)) searchParams.set(k, v)
      })
    }

    resolvedUriCache = `mongodb://${auth}${hosts}${dbPath}?${searchParams.toString()}`
    return resolvedUriCache
  } catch (e) {
    console.warn("Could not pre-resolve SRV:", e)
    resolvedUriCache = uri
    return uri
  }
}

declare global {
  // eslint-disable-next-line no-var
  var mongoose: { conn: typeof import("mongoose") | null; promise: Promise<any> | null }
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
      // Connection pool — reduces per-request overhead
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 8000,
      socketTimeoutMS: 30000,
      connectTimeoutMS: 10000,
    }
    cached.promise = (async () => {
      const uri = await getEffectiveMongoUri(rawMongoUri)
      return mongoose.connect(uri, opts).then((mongooseInstance) => {
        console.log("✅ Database connected successfully to MongoDB!")
        return mongooseInstance
      })
    })()
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
