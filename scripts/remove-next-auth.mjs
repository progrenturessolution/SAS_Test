// Forcibly remove next-auth from node_modules so the browser bundle
// no longer includes its React client (which polls /api/auth/session).
import { rmSync, existsSync } from "fs"
import { resolve } from "path"

const root = new URL("../", import.meta.url).pathname
const paths = [
  resolve(root, "node_modules/next-auth"),
  resolve(root, "node_modules/.pnpm"),
]

let removed = 0
for (const p of paths) {
  // Only remove the next-auth directory inside .pnpm, not the whole .pnpm
  if (p.endsWith(".pnpm")) {
    // Find next-auth inside .pnpm
    const { readdirSync } = await import("fs")
    try {
      const entries = readdirSync(p)
      for (const entry of entries) {
        if (entry.startsWith("next-auth")) {
          const full = resolve(p, entry)
          rmSync(full, { recursive: true, force: true })
          console.log(`[cache-bust] Removed ${full}`)
          removed++
        }
      }
    } catch { /* .pnpm may not exist */ }
    continue
  }
  if (existsSync(p)) {
    rmSync(p, { recursive: true, force: true })
    console.log(`[cache-bust] Removed ${p}`)
    removed++
  }
}

if (removed === 0) {
  console.log("[cache-bust] next-auth not found in node_modules — already clean.")
} else {
  console.log(`[cache-bust] Done. Removed ${removed} path(s).`)
}
