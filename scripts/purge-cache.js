const { rmSync, existsSync, readdirSync } = require("fs")
const { join } = require("path")

const root = "/vercel/share/v0-project"

// Remove everything under .next to force full recompile
const nextDir = join(root, ".next")
if (existsSync(nextDir)) {
  rmSync(nextDir, { recursive: true, force: true })
  console.log("Removed .next/")
} else {
  console.log(".next/ not found (already clean)")
}

// Remove next-auth from node_modules
const nextAuthDir = join(root, "node_modules", "next-auth")
if (existsSync(nextAuthDir)) {
  rmSync(nextAuthDir, { recursive: true, force: true })
  console.log("Removed node_modules/next-auth/")
} else {
  console.log("node_modules/next-auth not found (already removed)")
}

// Remove pnpm lock cache for next-auth
const cacheDir = join(root, "node_modules", ".cache")
if (existsSync(cacheDir)) {
  rmSync(cacheDir, { recursive: true, force: true })
  console.log("Removed node_modules/.cache/")
} else {
  console.log("node_modules/.cache not found")
}

console.log("Done — Next.js will fully recompile on next request.")
