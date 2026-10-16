import type { Category, Confidence, SeasonName, SeasonStats } from "./stats"
import type { ThresholdId, WindowId } from "./domain"

export type Era5CityRecord = {
  latitude: number
  longitude: number
  elevation: number | null
  values: (number | null)[]
  summary: {
    years: number
    wetDays: number
    r99p: number
    p95All: number
    p99All: number
    heavyDays: number
    veryHeavyDays: number
    extremeHeavyDays: number
    threeDayP95: number
    meanAnnual: number
  }
}

export type ClimatologyFile = {
  generatedAt: string
  era5: {
    source: string
    start: string
    end: string
    dates: string[]
    cities: Record<string, Era5CityRecord>
  }
  cmip6: {
    source: string
    scenario: string
    biasCorrection: string
    historical: [string, string]
    future: [string, string]
    models: { id: string; label: string; center: string; resolutionKm: number }[]
    regions: Record<string, RegionClimate>
  }
}

export type RegionClimate = {
  latitude: number
  longitude: number
  elevation: number | null
  seasons: Record<SeasonName, ClimateSeason>
}

export type ClimateSeason = {
  historical: SeasonStats
  future: SeasonStats
  totalPct: number | null
  rx1dayPct: number | null
  heavyDaysPct: number | null
  veryHeavyDaysPct: number | null
  heavyDaysSpread: [number, number] | null
  models: {
    id: string
    label: string
    historical: SeasonStats
    future: SeasonStats
    heavyDaysPct: number | null
    rx1dayPct: number | null
  }[]
}

export type ParsedModel = {
  id: string
  label: string
  members: (number | null)[][]
}

export type ParsedEnsemble = {
  dates: string[]
  models: ParsedModel[]
}

export type LiveCity = {
  id: string
  ensemble: ParsedEnsemble | null
  ensembleError?: string
  satellite: { date: string; mm: number }[] | null
  satelliteError?: string
}

export type LiveBundle = {
  fetchedAt: string
  cities: LiveCity[]
}

export type CityView = {
  probability: number | null
  byModel: { id: string; label: string; probability: number | null; members: number }[]
  peak: { date: string; probability: number } | null
  climatologyHits: number
  climatologyYears: number
  thresholdMm: number
  category: Category
  confidence: Confidence
  window: { start: string; end: string }
}

export type CityDesk = {
  id: string
  name: string
  state: string
  lat: number
  lon: number
  regionId: string
  regionName: string
  localR99p: number
  era5: Era5CityRecord["summary"]
  satellite: {
    product: string
    days: { date: string; mm: number }[]
    latest: { date: string; mm: number } | null
    threeDayMm: number | null
    threeDayDates: string[]
    antecedent: "dry" | "wet" | "extreme"
  } | null
  satelliteError?: string
  plume: {
    id: string
    label: string
    members: number
    days: { date: string; p10: number; p50: number; p90: number; mean: number }[]
  }[]
  days: DayOutlook[]
  analogs: Record<WindowId, { year: number; rmse: number; peakMm: number; windowMm: number } | null>
  views: Record<WindowId, Record<ThresholdId, CityView>>
  ensembleError?: string
}

export type DayOutlook = {
  date: string
  medianMm: number | null
  rainChance: number | null
  heavyChance: number | null
  veryHeavyChance: number | null
}

export type DeskResponse = {
  generatedAt: string
  fromCache: boolean
  timezone: "Asia/Kolkata"
  season: { id: string; title: string; note: string }
  sources: {
    era5: { label: string; period: string; status: "ready"; detail: string }
    cmip6: { label: string; status: "ready"; detail: string }
    realtime: { label: string; status: "ready" | "degraded" | "down"; detail: string }
    satellite: { label: string; status: "ready" | "degraded" | "down"; detail: string }
  }
  errors: { source: string; message: string }[]
  cities: CityDesk[]
  regions: {
    id: string
    name: string
    blurb: string
    jjas: ClimateSeason
    ond: ClimateSeason
  }[]
}
