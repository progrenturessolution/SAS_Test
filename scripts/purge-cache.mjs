import { rmSync, existsSync } from "fs"
import { join } from "path"

const root = "/vercel/share/v0-project"
const targets = [
  join(root, ".next"),
  join(root, "node_modules", "next-auth"),
  join(root, "node_modules", ".cache"),
]

for (const t of targets) {
  if (existsSync(t)) {
    rmSync(t, { recursive: true, force: true })
    console.log(`Removed: ${t}`)
  } else {
    console.log(`Not found (OK): ${t}`)
  }
}
console.log("Done. Next.js will fully recompile from source on next request.")
