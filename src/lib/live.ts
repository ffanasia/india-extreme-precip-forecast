import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

import { CITIES } from "./domain"
import { addDays, todayInKolkata } from "./dates"
import { ensembleUrl, parseEnsemble, type EnsemblePayload } from "./ensemble"
import { getJson, mapPool } from "./http"
import { parsePower, powerUrl, type PowerPayload } from "./satellite"
import type { LiveBundle, LiveCity } from "./types"

const CACHE_PATH = path.join(process.cwd(), "data", "cache", "live.json")
const TTL_MS = 30 * 60 * 1000

async function readCache(): Promise<LiveBundle | null> {
  try {
    const raw = await readFile(CACHE_PATH, "utf8")
    const parsed = JSON.parse(raw) as LiveBundle
    if (!parsed.fetchedAt || !Array.isArray(parsed.cities)) return null
    if (Date.now() - new Date(parsed.fetchedAt).getTime() > TTL_MS) return null
    return parsed
  } catch {
    return null
  }
}

async function writeCache(bundle: LiveBundle): Promise<void> {
  await mkdir(path.dirname(CACHE_PATH), { recursive: true })
  await writeFile(CACHE_PATH, JSON.stringify(bundle))
}

async function fetchCity(city: (typeof CITIES)[number], start: string, end: string): Promise<LiveCity> {
  const [ensembleResult, satelliteResult] = await Promise.allSettled([
    getJson<EnsemblePayload>(ensembleUrl(city.lat, city.lon), 3, 45_000),
    getJson<PowerPayload>(powerUrl(city.lat, city.lon, start, end), 3, 45_000),
  ])
  const cityLive: LiveCity = { id: city.id, ensemble: null, satellite: null }
  if (ensembleResult.status === "fulfilled") {
    try {
      cityLive.ensemble = parseEnsemble(ensembleResult.value)
    } catch (error) {
      cityLive.ensembleError = error instanceof Error ? error.message : String(error)
    }
  } else {
    cityLive.ensembleError =
      ensembleResult.reason instanceof Error ? ensembleResult.reason.message : String(ensembleResult.reason)
  }
  if (satelliteResult.status === "fulfilled") {
    cityLive.satellite = parsePower(satelliteResult.value)
    if (cityLive.satellite.length === 0) cityLive.satelliteError = "NASA POWER returned no recent precipitation"
  } else {
    cityLive.satelliteError =
      satelliteResult.reason instanceof Error ? satelliteResult.reason.message : String(satelliteResult.reason)
  }
  return cityLive
}

export async function loadLive(refresh = false): Promise<{ bundle: LiveBundle; fromCache: boolean }> {
  if (!refresh) {
    const cached = await readCache()
    if (cached) return { bundle: cached, fromCache: true }
  }
  const end = todayInKolkata()
  const start = addDays(end, -16)
  const cities = await mapPool(CITIES, 5, (city) => fetchCity(city, start, end))
  const bundle: LiveBundle = { fetchedAt: new Date().toISOString(), cities }
  await writeCache(bundle)
  return { bundle, fromCache: false }
}
