import { readFileSync, statSync } from "node:fs"
import path from "node:path"

import type { ClimatologyFile } from "./types"

let cached: { mtimeMs: number; data: ClimatologyFile } | null = null

export function climatologyPath(): string {
  return path.join(process.cwd(), "data", "climatology.json")
}

export function loadClimatology(): ClimatologyFile {
  const file = climatologyPath()
  const stat = statSync(file)
  if (cached && cached.mtimeMs === stat.mtimeMs) return cached.data
  const data = JSON.parse(readFileSync(file, "utf8")) as ClimatologyFile
  cached = { mtimeMs: stat.mtimeMs, data }
  return data
}
