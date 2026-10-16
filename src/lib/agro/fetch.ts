import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

import { CITIES } from "../domain"
import { getJson } from "../http"
import type { AirHour, FarmBundle, FarmPoint, WeatherHour } from "./types"

const CACHE_PATH = path.join(process.cwd(), "data", "cache", "farm.json")
const TTL_MS = 60 * 60 * 1000

const WEATHER_VARS = [
  "temperature_2m",
  "apparent_temperature",
  "relative_humidity_2m",
  "precipitation",
  "precipitation_probability",
  "wind_speed_10m",
  "wind_gusts_10m",
  "et0_fao_evapotranspiration",
  "soil_moisture_3_to_9cm",
  "soil_moisture_9_to_27cm",
  "soil_temperature_6cm",
  "shortwave_radiation",
  "is_day",
] as const

const AIR_VARS = ["pm2_5", "pm10", "ozone", "nitrogen_dioxide", "dust", "aerosol_optical_depth"] as const

type Hourly<K extends string> = { time: string[] } & Partial<Record<K, (number | null)[]>>
type WeatherPayload = { latitude: number; longitude: number; elevation?: number; hourly?: Hourly<(typeof WEATHER_VARS)[number]> }
type AirPayload = { latitude: number; longitude: number; hourly?: Hourly<(typeof AIR_VARS)[number]> }

function coordinates() {
  return {
    latitude: CITIES.map((city) => city.lat.toFixed(4)).join(","),
    longitude: CITIES.map((city) => city.lon.toFixed(4)).join(","),
  }
}

export function weatherUrl(): string {
  const query = new URLSearchParams({
    ...coordinates(),
    hourly: WEATHER_VARS.join(","),
    timezone: "Asia/Kolkata",
    forecast_days: "8",
    past_days: "2",
    wind_speed_unit: "kmh",
  })
  return `https://api.open-meteo.com/v1/forecast?${query}`
}

export function airUrl(): string {
  const query = new URLSearchParams({
    ...coordinates(),
    hourly: AIR_VARS.join(","),
    timezone: "Asia/Kolkata",
    forecast_days: "5",
    past_days: "2",
  })
  return `https://air-quality-api.open-meteo.com/v1/air-quality?${query}`
}

function asList<T>(payload: T | T[]): T[] {
  return Array.isArray(payload) ? payload : [payload]
}

function at(series: (number | null)[] | undefined, index: number): number | null {
  const value = series?.[index]
  return value == null || !Number.isFinite(value) ? null : value
}

export function parseWeather(payload: WeatherPayload): WeatherHour[] {
  const hourly = payload.hourly
  if (!hourly?.time) return []
  return hourly.time.map((time, index) => ({
    time,
    temp: at(hourly.temperature_2m, index),
    feels: at(hourly.apparent_temperature, index),
    rh: at(hourly.relative_humidity_2m, index),
    rain: at(hourly.precipitation, index),
    rainProb: at(hourly.precipitation_probability, index),
    wind: at(hourly.wind_speed_10m, index),
    gust: at(hourly.wind_gusts_10m, index),
    et0: at(hourly.et0_fao_evapotranspiration, index),
    soilTop: at(hourly.soil_moisture_3_to_9cm, index),
    soilRoot: at(hourly.soil_moisture_9_to_27cm, index),
    soilTemp: at(hourly.soil_temperature_6cm, index),
    radiation: at(hourly.shortwave_radiation, index),
    isDay: at(hourly.is_day, index) === 1,
  }))
}

export function parseAir(payload: AirPayload): AirHour[] {
  const hourly = payload.hourly
  if (!hourly?.time) return []
  return hourly.time.map((time, index) => ({
    time,
    pm25: at(hourly.pm2_5, index),
    pm10: at(hourly.pm10, index),
    o3: at(hourly.ozone, index),
    no2: at(hourly.nitrogen_dioxide, index),
    dust: at(hourly.dust, index),
    aod: at(hourly.aerosol_optical_depth, index),
  }))
}

async function readCache(): Promise<FarmBundle | null> {
  try {
    const parsed = JSON.parse(await readFile(CACHE_PATH, "utf8")) as FarmBundle
    if (!parsed.fetchedAt || !Array.isArray(parsed.points)) return null
    if (parsed.points.length !== CITIES.length) return null
    if (Date.now() - new Date(parsed.fetchedAt).getTime() > TTL_MS) return null
    return parsed
  } catch {
    return null
  }
}

export async function loadFarm(refresh = false): Promise<{ bundle: FarmBundle; fromCache: boolean }> {
  if (!refresh) {
    const cached = await readCache()
    if (cached) return { bundle: cached, fromCache: true }
  }
  const [weather, air] = await Promise.allSettled([
    getJson<WeatherPayload | WeatherPayload[]>(weatherUrl(), 3, 45_000),
    getJson<AirPayload | AirPayload[]>(airUrl(), 3, 45_000),
  ])
  if (weather.status === "rejected") {
    throw new Error(`Farm weather could not be fetched: ${String(weather.reason)}`)
  }
  const weatherList = asList(weather.value)
  const airList = air.status === "fulfilled" ? asList(air.value) : []
  const points: FarmPoint[] = CITIES.map((city, index) => ({
    id: city.id,
    name: city.name,
    state: city.state,
    regionId: city.regionId,
    lat: city.lat,
    lon: city.lon,
    elevation: weatherList[index]?.elevation ?? null,
    weather: weatherList[index] ? parseWeather(weatherList[index]) : [],
    air: airList[index] ? parseAir(airList[index]) : [],
  }))
  const bundle: FarmBundle = {
    fetchedAt: new Date().toISOString(),
    points,
    airError: air.status === "rejected" ? String(air.reason) : undefined,
  }
  await mkdir(path.dirname(CACHE_PATH), { recursive: true })
  await writeFile(CACHE_PATH, JSON.stringify(bundle))
  return { bundle, fromCache: false }
}
