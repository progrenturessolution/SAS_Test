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
const customDnsResolver = new dns.promises.Resolver({ timeout: 2000, tries: 1 })
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
 * Custom socket lookup racing public-DNS (8.8.8.8 / 1.1.1.1) in parallel with OS lookup
 * plus a 5-minute cache so slow Windows OS getaddrinfo stalls never delay logins or DB calls.
 */
const resilientLookup: LookupFunction = (hostname, options, callback) => {
  const safeOpts: dns.LookupOptions = typeof options === "object" && options !== null ? options : {}
  const wantAll = Boolean(safeOpts.all)
  const now = Date.now()
  const cachedEntry = hostDnsCache.get(hostname)

  // Serve fresh cached IPv4 immediately to avoid repeated DNS lookups on Atlas traffic
  if (cachedEntry && now < cachedEntry.expiresAt && cachedEntry.addresses.length > 0) {
    deliverLookupResult(wantAll, cachedEntry.addresses, callback)
    return
  }

  let settled = false
  let pending = 2
  let lastErr: NodeJS.ErrnoException | null = null

  const cacheAndDeliver = (addresses: string[]) => {
    if (settled || addresses.length === 0) return
    settled = true
    const ts = Date.now()
    hostDnsCache.set(hostname, {
      addresses,
      expiresAt: ts + 300_000,
      staleUntil: ts + 1_800_000,
    })
    deliverLookupResult(wantAll, addresses, callback)
  }

  const finishFailure = (err: NodeJS.ErrnoException | null) => {
    if (err) lastErr = err
    pending--
    if (settled || pending > 0) return
    settled = true
    if (cachedEntry && Date.now() < cachedEntry.staleUntil && cachedEntry.addresses.length > 0) {
      deliverLookupResult(wantAll, cachedEntry.addresses, callback)
      return
    }
    callback(lastErr, wantAll ? [] : ("" as unknown as dns.LookupAddress[]), 4)
  }

  dns.lookup(hostname, { ...safeOpts, family: 4 }, (err, address) => {
    if (!err) {
      const list = Array.isArray(address)
        ? address.map((item) => item.address).filter(Boolean)
        : typeof address === "string" && address
        ? [address]
        : []
      if (list.length > 0) {
        cacheAndDeliver(list)
        return
      }
    }
    finishFailure(err)
  })

  customDnsResolver
    .resolve4(hostname)
    .then((resolved) => {
      if (resolved && resolved.length > 0) {
        cacheAndDeliver(resolved)
        return
      }
      finishFailure(null)
    })
    .catch((err) => {
      finishFailure(err as NodeJS.ErrnoException)
    })
}

async function getEffectiveMongoUri(uri: string): Promise<string> {
  if (!uri.startsWith("mongodb+srv://")) return uri
  if (resolvedUriCache) return resolvedUriCache

  try {
    const parsed = new URL(uri)
    const hostname = parsed.hostname
    const [srvRecords, txtRecords] = await Promise.all([
      customDnsResolver.resolveSrv(`_mongodb._tcp.${hostname}`),
      customDnsResolver.resolveTxt(hostname).catch(() => []),
    ])
    if (!srvRecords || srvRecords.length === 0) {
      return uri
    }

    const hosts = srvRecords.map((r) => `${r.name}:${r.port}`).join(",")
    const txtParams =
      txtRecords && txtRecords.length > 0
        ? txtRecords.map((r) => r.join("")).join("&")
        : ""

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
    maxPoolSize: 10,
    minPoolSize: 1,
    maxIdleTimeMS: 120000,
    serverSelectionTimeoutMS: 8000,
    socketTimeoutMS: 25000,
    connectTimeoutMS: 8000,
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
