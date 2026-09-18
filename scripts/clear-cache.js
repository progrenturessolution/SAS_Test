/**
 * Clears the Next.js .next build cache so Turbopack recompiles from scratch.
 * Run: node scripts/clear-cache.js
 */
const fs = require("fs")
const path = require("path")

const nextDir = path.join(__dirname, "../.next")
if (fs.existsSync(nextDir)) {
  fs.rmSync(nextDir, { recursive: true, force: true })
  console.log("[clear-cache] Deleted .next directory — Next.js will do a fresh compile on next start.")
} else {
  console.log("[clear-cache] .next directory not found — nothing to clear.")
}
