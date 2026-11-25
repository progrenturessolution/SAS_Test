import mongoose, { type ConnectOptions } from "mongoose"
import dns from "dns"
import type { LookupFunction } from "net"

try {
  dns.setDefaultResultOrder("ipv4first")
  dns.setServers(["8.8.8.8", "1.1.1.1"])
} catch {}

const rawMongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || "mongodb://localhost:27017/dummy"

// Cache the resolved SRV URI and recent host lookups across transient DNS hiccups
let resolvedUriCache: string | null = null
const hostDnsCache = new Map<string, { addresses: string[]; expiresAt: number; staleUntil: number }>()
const customDnsResolver = new dns.promises.Resolver()
try {
  customDnsResolver.setServers(["8.8.8.8", "1.1.1.1", "9.9.9.9"])
} catch {}

const deliverLookupResult = (
  all: boolean | undefined,
  addresses: string[],
  callback: Parameters<LookupFunction>[2]
) => {
  if (all) {
    callback(
      null,
      addresses.map((address) => ({ address, family: 4 }))
    )
    return
  }
  callback(null, addresses[0], 4)
}

/**
 * Custom socket lookup with public-DNS (8.8.8.8 / 1.1.1.1) and short-lived cache fallback
 * so transient Windows OS getaddrinfo ENOTFOUND glitches do not drop MongoDB Atlas calls.
 */
const resilientLookup: LookupFunction = (hostname, options, callback) => {
  const safeOpts: dns.LookupOptions = typeof options === "object" && options !== null ? options : {}
  const wantAll = Boolean(safeOpts.all)
  const now = Date.now()
  const cachedEntry = hostDnsCache.get(hostname)

  // Serve fresh cached IPv4 immediately to avoid repeated OS getaddrinfo failures on Atlas heartbeats
  if (cachedEntry && now < cachedEntry.expiresAt && cachedEntry.addresses.length > 0) {
    deliverLookupResult(wantAll, cachedEntry.addresses, callback)
    return
  }

  dns.lookup(hostname, safeOpts, async (err, address, family) => {
    if (!err) {
      const list = Array.isArray(address)
        ? address.map((item) => item.address).filter(Boolean)
        : typeof address === "string" && address
        ? [address]
        : []
      if (list.length > 0) {
        hostDnsCache.set(hostname, {
          addresses: list,
          expiresAt: Date.now() + 60_000,
          staleUntil: Date.now() + 900_000,
        })
      }
      callback(null, address as string | dns.LookupAddress[], family)
      return
    }

    try {
      const resolved = await customDnsResolver.resolve4(hostname)
      if (resolved && resolved.length > 0) {
        hostDnsCache.set(hostname, {
          addresses: resolved,
          expiresAt: Date.now() + 60_000,
          staleUntil: Date.now() + 900_000,
        })
        deliverLookupResult(wantAll, resolved, callback)
        return
      }
    } catch {}

    if (cachedEntry && Date.now() < cachedEntry.staleUntil && cachedEntry.addresses.length > 0) {
      deliverLookupResult(wantAll, cachedEntry.addresses, callback)
      return
    }

    callback(err, wantAll ? [] : ("" as unknown as dns.LookupAddress[]), 4)
  })
}

async function getEffectiveMongoUri(uri: string): Promise<string> {
  if (!uri.startsWith("mongodb+srv://")) return uri
  if (resolvedUriCache) return resolvedUriCache

  try {
    const parsed = new URL(uri)
    const hostname = parsed.hostname
    const srvRecords = await customDnsResolver.resolveSrv(`_mongodb._tcp.${hostname}`)
    if (!srvRecords || srvRecords.length === 0) {
      return uri
    }

    const hosts = srvRecords.map((r) => `${r.name}:${r.port}`).join(",")
    let txtParams = ""
    try {
      const txtRecords = await customDnsResolver.resolveTxt(hostname)
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

export function invalidateMongoCache() {
  cached.conn = null
  cached.promise = null
  resolvedUriCache = null
}

function isTransientMongoError(err: any): boolean {
  const name = String(err?.name || "")
  const message = String(err?.message || "")
  const causeCode = String(err?.cause?.code || err?.code || "")
  return (
    name.includes("MongoNetworkError") ||
    name.includes("MongoServerSelectionError") ||
    message.includes("ENOTFOUND") ||
    message.includes("EAI_AGAIN") ||
    message.includes("ETIMEDOUT") ||
    message.includes("ECONNRESET") ||
    causeCode === "ENOTFOUND" ||
    causeCode === "EAI_AGAIN"
  )
}

if (mongoose.connection.listenerCount("disconnected") === 0) {
  mongoose.connection.on("disconnected", () => {
    cached.conn = null
    cached.promise = null
  })
}

async function connectWithRetry(attempt = 0): Promise<typeof import("mongoose")> {
  const opts: ConnectOptions = {
    bufferCommands: false,
    maxPoolSize: 3,
    minPoolSize: 0,
    maxIdleTimeMS: 60000,
    serverSelectionTimeoutMS: 12000,
    socketTimeoutMS: 25000,
    connectTimeoutMS: 12000,
    family: 4,
    autoSelectFamily: false,
    lookup: resilientLookup,
    retryReads: true,
    retryWrites: true,
  }

  try {
    const uri = await getEffectiveMongoUri(rawMongoUri)
    const instance = await mongoose.connect(uri, opts)
    if (attempt > 0) {
      console.log("✅ Database reconnected to MongoDB after transient network error.")
    }
    return instance
  } catch (err) {
    resolvedUriCache = null
    if (attempt === 0 && isTransientMongoError(err)) {
      await new Promise((r) => setTimeout(r, 400))
      return connectWithRetry(1)
    }
    throw err
  }
}

async function connectDB() {
  // Never reuse a disconnected handle if the connection dropped between requests
  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn
  }

  if (mongoose.connection.readyState !== 2 && cached.conn) {
    cached.conn = null
  }

  if (!cached.promise) {
    cached.promise = connectWithRetry().then((mongooseInstance) => {
      console.log("✅ Database connected successfully to MongoDB!")
      return mongooseInstance
    })
  }

  try {
    cached.conn = await cached.promise
  } catch (e) {
    cached.conn = null
    cached.promise = null
    console.warn("❌ MongoDB connection failed:", (e as any)?.message || e)
    throw e
  }

  return cached.conn
}

export default connectDB
