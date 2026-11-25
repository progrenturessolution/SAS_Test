import { registerHooks } from "node:module"
import { existsSync } from "node:fs"
import path from "node:path"
import { pathToFileURL, fileURLToPath } from "node:url"

const ROOT_DIR = process.cwd()

function resolveCandidateFile(basePath) {
  for (const candidate of [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.mts`,
    path.join(basePath, "index.ts"),
    path.join(basePath, "index.tsx"),
  ]) {
    if (existsSync(candidate)) {
      return pathToFileURL(candidate).href
    }
  }
  return null
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      const target = path.join(ROOT_DIR, specifier.slice(2))
      const resolvedUrl = resolveCandidateFile(target)
      if (resolvedUrl) {
        return { url: resolvedUrl, shortCircuit: true }
      }
    }

    if (
      (specifier.startsWith("./") || specifier.startsWith("../")) &&
      context.parentURL &&
      context.parentURL.startsWith("file:") &&
      !specifier.endsWith(".js") &&
      !specifier.endsWith(".mjs") &&
      !specifier.endsWith(".ts") &&
      !specifier.endsWith(".tsx") &&
      !specifier.endsWith(".json")
    ) {
      const parentDir = path.dirname(fileURLToPath(context.parentURL))
      const target = path.resolve(parentDir, specifier)
      const resolvedUrl = resolveCandidateFile(target)
      if (resolvedUrl) {
        return { url: resolvedUrl, shortCircuit: true }
      }
    }

    return nextResolve(specifier, context)
  },
})
