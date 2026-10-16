import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

import { CMIP6_MODELS, CITIES, EXTREME_MM, HEAVY_MM, REGIONS, VERY_HEAVY_MM } from "../src/lib/domain"
import { assertDailyContinuity } from "../src/lib/dates"
import { getJson, mapPool } from "../src/lib/http"
import {
  countAtLeast,
  finite,
  mean,
  percentChange,
  quantile,
  rollingSums,
  roundTo,
  seasonalStats,
  wetDayPercentile,
  type SeasonName,
  type SeasonStats,
} from "../src/lib/stats"
import type { ClimatologyFile, ClimateSeason, RegionClimate } from "../src/lib/types"

const RAW = path.join(process.cwd(), "data", "raw")
const OUT = path.join(process.cwd(), "data", "climatology.json")
const HISTORICAL: [string, string] = ["1991-01-01", "2014-12-31"]
const FUTURE: [string, string] = ["2031-01-01", "2049-12-31"]

type ArchiveResponse = {
  latitude: number
  longitude: number
  elevation?: number
  daily: { time: string[]; precipitation_sum: (number | null)[] }
}

type ClimatePoint = {
  latitude: number
  longitude: number
  elevation?: number
  daily: Record<string, (number | null)[] | string[]>
}

function archiveUrl(lat: number, lon: number): string {
  const query = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    start_date: "1991-01-01",
    end_date: "2020-12-31",
    daily: "precipitation_sum",
    timezone: "Asia/Kolkata",
    cell_selection: "land",
  })
  return `https://archive-api.open-meteo.com/v1/archive?${query}`
}

function climateUrl(regions: typeof REGIONS): string {
  const query = new URLSearchParams({
    latitude: regions.map((region) => region.lat).join(","),
    longitude: regions.map((region) => region.lon).join(","),
    start_date: "1991-01-01",
    end_date: "2049-12-31",
    models: CMIP6_MODELS.map((model) => model.id).join(","),
    daily: "precipitation_sum",
    timezone: "Asia/Kolkata",
    cell_selection: "land",
  })
  return `https://climate-api.open-meteo.com/v1/climate?${query}`
}

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as T
  } catch {
    return null
  }
}

function sliceRange(dates: string[], values: (number | null)[], start: string, end: string) {
  const nextDates: string[] = []
  const nextValues: (number | null)[] = []
  dates.forEach((date, index) => {
    if (date >= start && date <= end) {
      nextDates.push(date)
      nextValues.push(values[index] ?? null)
    }
  })
  return { dates: nextDates, values: nextValues }
}

function changeSeason(models: ClimateSeason["models"]): Omit<ClimateSeason, "models"> {
  const historical = averageSeason(models.map((model) => model.historical))
  const future = averageSeason(models.map((model) => model.future))
  const heavyChanges = models
    .map((model) => model.heavyDaysPct)
    .filter((value): value is number => value != null)
  const rounded = (value: number | null) => (value == null ? null : roundTo(value, 1))
  return {
    historical,
    future,
    totalPct: rounded(percentChange(future.meanTotal, historical.meanTotal)),
    rx1dayPct: rounded(percentChange(future.meanRx1day, historical.meanRx1day)),
    heavyDaysPct: rounded(percentChange(future.meanHeavyDays, historical.meanHeavyDays)),
    veryHeavyDaysPct: rounded(percentChange(future.meanVeryHeavyDays, historical.meanVeryHeavyDays)),
    heavyDaysSpread: heavyChanges.length ? [Math.min(...heavyChanges), Math.max(...heavyChanges)] : null,
  }
}

function averageSeason(rows: SeasonStats[]): SeasonStats {
  return {
    years: Math.round(mean(rows.map((row) => row.years))),
    meanTotal: roundTo(mean(rows.map((row) => row.meanTotal)), 1),
    meanRx1day: roundTo(mean(rows.map((row) => row.meanRx1day)), 1),
    meanHeavyDays: roundTo(mean(rows.map((row) => row.meanHeavyDays)), 2),
    meanVeryHeavyDays: roundTo(mean(rows.map((row) => row.meanVeryHeavyDays)), 2),
  }
}

function roundSeason(stats: SeasonStats): SeasonStats {
  return {
    years: stats.years,
    meanTotal: roundTo(stats.meanTotal, 1),
    meanRx1day: roundTo(stats.meanRx1day, 1),
    meanHeavyDays: roundTo(stats.meanHeavyDays, 2),
    meanVeryHeavyDays: roundTo(stats.meanVeryHeavyDays, 2),
  }
}

function seasonForModel(
  dates: string[],
  values: (number | null)[],
  season: SeasonName,
  model: (typeof CMIP6_MODELS)[number],
): ClimateSeason["models"][number] {
  const historicalSlice = sliceRange(dates, values, HISTORICAL[0], HISTORICAL[1])
  const futureSlice = sliceRange(dates, values, FUTURE[0], FUTURE[1])
  const historical = seasonalStats(historicalSlice.dates, historicalSlice.values, season)
  const future = seasonalStats(futureSlice.dates, futureSlice.values, season)
  if (!historical || !future) {
    throw new Error(`${model.label} is missing a complete ${season} sample`)
  }
  return {
    id: model.id,
    label: model.label,
    historical: roundSeason(historical),
    future: roundSeason(future),
    heavyDaysPct:
      percentChange(future.meanHeavyDays, historical.meanHeavyDays) == null
        ? null
        : roundTo(percentChange(future.meanHeavyDays, historical.meanHeavyDays) as number, 1),
    rx1dayPct:
      percentChange(future.meanRx1day, historical.meanRx1day) == null
        ? null
        : roundTo(percentChange(future.meanRx1day, historical.meanRx1day) as number, 1),
  }
}

function nearestRegion(lat: number, lon: number) {
  return REGIONS.reduce((best, region) => {
    const distance = (region.lat - lat) ** 2 + (region.lon - lon) ** 2
    return distance < best.distance ? { distance, region } : best
  }, { distance: Number.POSITIVE_INFINITY, region: REGIONS[0] }).region
}

async function loadEra5() {
  await mkdir(path.join(RAW, "era5"), { recursive: true })
  const rows = await mapPool(CITIES, 4, async (city) => {
    const file = path.join(RAW, "era5", `${city.id}.json`)
    let payload = await readJson<ArchiveResponse>(file)
    if (!payload) {
      process.stdout.write(`ERA5 ${city.name}\n`)
      payload = await getJson<ArchiveResponse>(archiveUrl(city.lat, city.lon), 4, 120_000)
      await writeFile(file, JSON.stringify(payload))
    }
    const dates = payload.daily.time
    assertDailyContinuity(dates)
    const values = payload.daily.precipitation_sum.map((value) =>
      value == null || !Number.isFinite(value) ? null : roundTo(value, 2),
    )
    const annual = new Map<number, number>()
    dates.forEach((date, index) => {
      const value = values[index]
      if (value == null) return
      const year = Number(date.slice(0, 4))
      annual.set(year, (annual.get(year) ?? 0) + value)
    })
    const r99p = wetDayPercentile(values, 0.99)
    const all = finite(values)
    const three = rollingSums(values, 3)
    if (r99p == null || all.length === 0 || three.length === 0) {
      throw new Error(`ERA5 sample for ${city.name} is empty`)
    }
    const summary = {
      years: annual.size,
      wetDays: values.filter((value) => value != null && value >= 1).length,
      r99p: roundTo(r99p, 1),
      p95All: roundTo(quantile(all, 0.95), 1),
      p99All: roundTo(quantile(all, 0.99), 1),
      heavyDays: countAtLeast(values, HEAVY_MM),
      veryHeavyDays: countAtLeast(values, VERY_HEAVY_MM),
      extremeHeavyDays: countAtLeast(values, EXTREME_MM),
      threeDayP95: roundTo(quantile(three, 0.95), 1),
      meanAnnual: roundTo(mean([...annual.values()]), 1),
    }
    process.stdout.write(
      `  ${city.name}: annual ${summary.meanAnnual} mm, R99p ${summary.r99p} mm, heavy days ${summary.heavyDays}\n`,
    )
    return {
      id: city.id,
      dates,
      record: {
        latitude: payload.latitude,
        longitude: payload.longitude,
        elevation: payload.elevation ?? null,
        values,
        summary,
      },
    }
  })
  const dates = rows[0].dates
  for (const row of rows) {
    if (row.dates.length !== dates.length || row.dates[0] !== dates[0] || row.dates.at(-1) !== dates.at(-1)) {
      throw new Error(`ERA5 dates for ${row.id} do not match the first city`)
    }
  }
  return { dates, cities: Object.fromEntries(rows.map((row) => [row.id, row.record])) }
}

async function loadCmip6(): Promise<Record<string, RegionClimate>> {
  await mkdir(path.join(RAW, "cmip6"), { recursive: true })
  const file = path.join(RAW, "cmip6", "regions.json")
  let points = await readJson<ClimatePoint[]>(file)
  if (!points) {
    process.stdout.write("CMIP6 HighResMIP, nine regions, 1991–2049\n")
    const payload = await getJson<ClimatePoint[] | ClimatePoint>(climateUrl(REGIONS), 3, 180_000)
    points = Array.isArray(payload) ? payload : [payload]
    await writeFile(file, JSON.stringify(points))
  }
  if (points.length !== REGIONS.length) {
    throw new Error(`Expected ${REGIONS.length} CMIP6 locations, received ${points.length}`)
  }
  const regions: Record<string, RegionClimate> = {}
  for (const point of points) {
    const region = nearestRegion(point.latitude, point.longitude)
    const dates = point.daily.time
    if (!Array.isArray(dates) || typeof dates[0] !== "string") throw new Error("CMIP6 time axis missing")
    assertDailyContinuity(dates as string[])
    const seasons = {} as RegionClimate["seasons"]
    for (const season of ["jjas", "ond"] as const) {
      const models = CMIP6_MODELS.map((model) => {
        const key = `precipitation_sum_${model.id}`
        const values = point.daily[key]
        if (!Array.isArray(values)) throw new Error(`${key} missing for ${region.name}`)
        return seasonForModel(
          dates as string[],
          values.map((value) => (typeof value === "number" ? value : null)),
          season,
          model,
        )
      })
      seasons[season] = { ...changeSeason(models), models }
      const headline = seasons[season]
      process.stdout.write(
        `  ${region.name} ${season}: heavy days ${headline.historical.meanHeavyDays} → ${headline.future.meanHeavyDays} (${headline.heavyDaysPct ?? "n/a"}%)\n`,
      )
    }
    regions[region.id] = {
      latitude: point.latitude,
      longitude: point.longitude,
      elevation: point.elevation ?? null,
      seasons,
    }
  }
  for (const region of REGIONS) {
    if (!regions[region.id]) throw new Error(`No CMIP6 point matched ${region.name}`)
  }
  return regions
}

async function main() {
  const era5 = await loadEra5()
  const cmip6 = await loadCmip6()
  const file: ClimatologyFile = {
    generatedAt: new Date().toISOString(),
    era5: {
      source: "ECMWF ERA5 via the Open-Meteo archive API, land grid cell, Asia/Kolkata civil days",
      start: "1991-01-01",
      end: "2020-12-31",
      dates: era5.dates,
      cities: era5.cities,
    },
    cmip6: {
      source:
        "CMIP6 HighResMIP daily precipitation via the Open-Meteo climate API, statistically downscaled and bias-corrected to ERA5-Land at about 10 km",
      scenario:
        "HighResMIP projections through 2049, described by Open-Meteo as the high-resolution CMIP6 runs closest to RCP8.5. Scenario spread is small before 2050, and this is not a full SSP ensemble.",
      biasCorrection:
        "Linear monthly bias correction onto ERA5-Land. The climate-change signal is retained.",
      historical: HISTORICAL,
      future: FUTURE,
      models: CMIP6_MODELS.map((model) => ({ ...model })),
      regions: cmip6,
    },
  }
  await mkdir(path.dirname(OUT), { recursive: true })
  await writeFile(OUT, JSON.stringify(file))
  process.stdout.write(`Wrote ${OUT}\n`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
