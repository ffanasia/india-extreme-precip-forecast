import {
  CITIES,
  REGIONS,
  THRESHOLDS,
  WINDOWS,
  regionById,
  seasonContext,
  thresholdMillimetres,
  type ThresholdId,
  type WindowId,
} from "./domain"
import { parseIso, todayInKolkata } from "./dates"
import { antecedentOf, SATELLITE_PRODUCT } from "./satellite"
import {
  anyDayExceedance,
  blendProbabilities,
  categoryFor,
  confidenceFor,
  dailyExceedance,
  dayQuantiles,
  findAnalog,
  indexByDate,
  windowExceedance,
} from "./stats"
import type { CityDesk, CityView, ClimatologyFile, DeskResponse, LiveBundle, RegionClimate } from "./types"
import type { ParsedEnsemble } from "./ensemble"

const ERA5_FIRST_YEAR = 1991
const ERA5_LAST_YEAR = 2020

function emptyViews(thresholdMm: number, window: { start: string; end: string }): CityView {
  return {
    probability: null,
    byModel: [],
    peak: null,
    climatologyHits: 0,
    climatologyYears: 0,
    thresholdMm,
    category: "unavailable",
    confidence: "quiet",
    window,
  }
}

function buildViews(
  ensemble: ParsedEnsemble | null,
  byDate: Map<string, number | null>,
  localR99p: number,
): Record<WindowId, Record<ThresholdId, CityView>> {
  const dates = ensemble?.dates ?? []
  const views = {} as Record<WindowId, Record<ThresholdId, CityView>>
  for (const window of WINDOWS) {
    const slice = dates.slice(0, window.days)
    const start = slice[0] ?? ""
    const end = slice[slice.length - 1] ?? ""
    const span = { start, end }
    views[window.id] = {} as Record<ThresholdId, CityView>
    for (const threshold of THRESHOLDS) {
      const thresholdMm = thresholdMillimetres(threshold.id, localR99p)
      if (!ensemble || slice.length === 0) {
        views[window.id][threshold.id] = emptyViews(thresholdMm, span)
        continue
      }
      const byModel = ensemble.models.map((model) => {
        const members = model.members.map((member) => member.slice(0, slice.length))
        return {
          id: model.id,
          label: model.label,
          probability: anyDayExceedance(members, thresholdMm),
          members: model.members.length,
        }
      })
      const probability = blendProbabilities(byModel.map((model) => model.probability))
      let peak: { date: string; probability: number } | null = null
      slice.forEach((date, index) => {
        const daily = blendProbabilities(
          ensemble.models.map((model) => dailyExceedance(model.members, index, thresholdMm)),
        )
        if (daily == null) return
        if (!peak || daily > peak.probability) peak = { date, probability: daily }
      })
      const climatology = windowExceedance(byDate, slice, thresholdMm, ERA5_FIRST_YEAR, ERA5_LAST_YEAR)
      views[window.id][threshold.id] = {
        probability,
        byModel,
        peak,
        climatologyHits: climatology.hits,
        climatologyYears: climatology.years,
        thresholdMm,
        category: categoryFor(probability),
        confidence: confidenceFor(
          byModel.map((model) => model.probability).filter((value): value is number => value != null),
          probability,
        ),
        window: span,
      }
    }
  }
  return views
}

function buildAnalogs(
  ensemble: ParsedEnsemble | null,
  byDate: Map<string, number | null>,
): Record<WindowId, { year: number; rmse: number; peakMm: number; windowMm: number } | null> {
  const analogs = {} as Record<WindowId, { year: number; rmse: number; peakMm: number; windowMm: number } | null>
  for (const window of WINDOWS) {
    if (!ensemble) {
      analogs[window.id] = null
      continue
    }
    const dates = ensemble.dates.slice(0, window.days)
    const median = dates.map((_, index) => {
      const medians = ensemble.models
        .map((model) => dayQuantiles(model.members, index)?.p50)
        .filter((value): value is number => value != null)
      if (medians.length === 0) return null
      return medians.reduce((sum, value) => sum + value, 0) / medians.length
    })
    if (median.some((value) => value == null)) {
      analogs[window.id] = null
      continue
    }
    analogs[window.id] = findAnalog(byDate, dates, median as number[], ERA5_FIRST_YEAR, ERA5_LAST_YEAR)
  }
  return analogs
}

function sourceStatus(ready: number, total: number): "ready" | "degraded" | "down" {
  if (ready === 0) return "down"
  if (ready < total) return "degraded"
  return "ready"
}

export function buildDesk(
  climatology: ClimatologyFile,
  live: LiveBundle | null,
  generatedAt: string,
  fromCache: boolean,
): DeskResponse {
  const liveById = new Map(live?.cities.map((city) => [city.id, city]) ?? [])
  const referenceDates =
    live?.cities.find((city) => city.ensemble && city.ensemble.dates.length > 0)?.ensemble?.dates ?? []
  const seasonMonth = referenceDates[0] ? parseIso(referenceDates[0]).month : parseIso(todayInKolkata()).month

  const cities: CityDesk[] = CITIES.map((city) => {
    const record = climatology.era5.cities[city.id]
    if (!record) throw new Error(`Climatology is missing ${city.name}`)
    const byDate = indexByDate(climatology.era5.dates, record.values)
    const liveCity = liveById.get(city.id)
    const ensemble = liveCity?.ensemble ?? null
    const satelliteDays = liveCity?.satellite ?? null
    const wetness = satelliteDays ? antecedentOf(satelliteDays, record.summary.threeDayP95) : null
    const region = regionById(city.regionId)
    return {
      id: city.id,
      name: city.name,
      state: city.state,
      lat: city.lat,
      lon: city.lon,
      regionId: city.regionId,
      regionName: region.name,
      localR99p: record.summary.r99p,
      era5: record.summary,
      satellite: satelliteDays
        ? {
            product: SATELLITE_PRODUCT,
            days: satelliteDays.slice(-10),
            ...wetness!,
          }
        : null,
      satelliteError: liveCity?.satelliteError,
      plume: (ensemble?.models ?? []).map((model) => ({
        id: model.id,
        label: model.label,
        members: model.members.length,
        days: ensemble!.dates.flatMap((date, index) => {
          const quantiles = dayQuantiles(model.members, index)
          return quantiles ? [{ date, ...quantiles }] : []
        }),
      })),
      analogs: buildAnalogs(ensemble, byDate),
      views: buildViews(ensemble, byDate, record.summary.r99p),
      ensembleError: liveCity?.ensembleError,
    }
  })

  const ensembleReady = cities.filter((city) => !city.ensembleError && city.plume.length > 0).length
  const satelliteReady = cities.filter((city) => city.satellite && !city.satelliteError).length
  const memberSummary = cities
    .flatMap((city) => city.plume.map((model) => `${model.label} ${model.members}`))
    .filter((value, index, list) => list.indexOf(value) === index)
  const errors: { source: string; message: string }[] = []
  for (const city of cities) {
    if (city.ensembleError) errors.push({ source: `Ensemble · ${city.name}`, message: city.ensembleError })
    if (city.satelliteError) errors.push({ source: `Satellite · ${city.name}`, message: city.satelliteError })
  }

  return {
    generatedAt,
    fromCache,
    timezone: "Asia/Kolkata",
    season: seasonContext(seasonMonth),
    sources: {
      era5: {
        label: "ERA5",
        period: `${climatology.era5.start} – ${climatology.era5.end}`,
        status: "ready",
        detail: "ECMWF ERA5 daily precipitation, 1991–2020, via the Open-Meteo archive. Land grid cell.",
      },
      cmip6: {
        label: "CMIP6",
        status: "ready",
        detail: climatology.cmip6.scenario,
      },
      realtime: {
        label: "Real-time cycle",
        status: live ? sourceStatus(ensembleReady, cities.length) : "down",
        detail: live
          ? `${memberSummary.join(" · ") || "No members returned"} · equal model weight`
          : "Ensemble forecast has not been fetched",
      },
      satellite: {
        label: "Satellite",
        status: live ? sourceStatus(satelliteReady, cities.length) : "down",
        detail: SATELLITE_PRODUCT,
      },
    },
    errors: errors.slice(0, 8),
    cities,
    regions: REGIONS.map((region) => {
      const climate = climatology.cmip6.regions[region.id] as RegionClimate | undefined
      if (!climate) throw new Error(`CMIP6 region missing: ${region.name}`)
      return {
        id: region.id,
        name: region.name,
        blurb: region.blurb,
        jjas: climate.seasons.jjas,
        ond: climate.seasons.ond,
      }
    }),
  }
}
