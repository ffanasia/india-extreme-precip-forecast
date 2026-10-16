import { formatDay, formatWeekday } from "./dates"
import type { SeasonName } from "./stats"
import type { CityDesk, DayOutlook, DeskResponse } from "./types"

export type RiskLevel = "unknown" | "unlikely" | "small" | "real" | "likely" | "very_likely"

export const RISK_WORDS: Record<RiskLevel, string> = {
  unknown: "No forecast right now",
  unlikely: "Unlikely",
  small: "Small chance",
  real: "Real chance",
  likely: "Likely",
  very_likely: "Very likely",
}

export const RISK_COLOR: Record<RiskLevel, string> = {
  unknown: "#5c564c",
  unlikely: "#7fa89a",
  small: "#d6b25e",
  real: "#e08a3c",
  likely: "#e24a2e",
  very_likely: "#ff3b30",
}

/** Same breakpoints as the detailed desk categories, so both views rank places identically. */
export function riskLevel(probability: number | null): RiskLevel {
  if (probability == null || !Number.isFinite(probability)) return "unknown"
  if (probability < 0.1) return "unlikely"
  if (probability < 0.25) return "small"
  if (probability < 0.45) return "real"
  if (probability < 0.7) return "likely"
  return "very_likely"
}

export function chanceInWords(probability: number | null): string {
  if (probability == null || !Number.isFinite(probability)) return "not known"
  if (probability < 0.05) return "less than 1 in 20"
  if (probability < 0.1) return "less than 1 in 10"
  if (probability >= 0.95) return "almost certain"
  return `about ${Math.round(probability * 10)} in 10`
}

export type DayKind = "dry" | "showers" | "rain" | "heavy_possible" | "heavy_risk" | "unknown"

export const DAY_WORDS: Record<DayKind, string> = {
  unknown: "No forecast",
  dry: "Mostly dry",
  showers: "Some showers",
  rain: "Rainy",
  heavy_possible: "Heavy rain possible",
  heavy_risk: "Heavy rain risk",
}

export function dayKind(day: DayOutlook): DayKind {
  if (day.rainChance == null) return "unknown"
  if ((day.heavyChance ?? 0) >= 0.25) return "heavy_risk"
  if ((day.heavyChance ?? 0) >= 0.1) return "heavy_possible"
  if ((day.medianMm ?? 0) >= 10 && day.rainChance >= 0.6) return "rain"
  if (day.rainChance >= 0.3) return "showers"
  return "dry"
}

export function dayLabel(iso: string): string {
  return `${formatWeekday(iso)} ${formatDay(iso)}`
}

export function roundedMm(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—"
  if (value < 1) return "under 1 mm"
  return `about ${Math.round(value)} mm`
}

export type Ground = { kind: "dry" | "wet" | "soaked"; title: string; detail: string; asOf: string | null }

export function groundStatus(city: CityDesk): Ground | null {
  const satellite = city.satellite
  if (!satellite || satellite.days.length === 0) return null
  const total = satellite.days.reduce((sum, day) => sum + day.mm, 0)
  const asOf = satellite.latest ? formatDay(satellite.latest.date) : null
  const tenDays = `${Math.round(total)} mm of rain in the last ${satellite.days.length} days`
  if (satellite.antecedent === "extreme") {
    return {
      kind: "soaked",
      title: "Ground is soaked",
      detail: `Very heavy rain fell in the last three days (${tenDays}). Fields may already be waterlogged, and streams and drains can rise fast with any more rain.`,
      asOf,
    }
  }
  if (satellite.antecedent === "wet") {
    return {
      kind: "wet",
      title: "Ground is already wet",
      detail: `The last three days were wetter than usual here (${tenDays}). More rain will run off and pool sooner than normal.`,
      asOf,
    }
  }
  return {
    kind: "dry",
    title: total < 10 ? "Ground has been dry" : "Ground is not waterlogged",
    detail: `Satellite estimate: ${tenDays}. The soil can still take in some rain before water starts to pool.`,
    asOf,
  }
}

const SEASON_WORDS: Record<SeasonName, string> = {
  jjas: "June–September monsoon",
  ond: "October–December rains",
}

/** Below this many heavy days per season, the October–December change is noise for planning. */
const OND_RELEVANT_DAYS = 0.3

export type Future = { title: string; detail: string; uncertain: boolean }

export function futureOutlook(response: DeskResponse, city: CityDesk): Future[] {
  const region = response.regions.find((item) => item.id === city.regionId)
  if (!region) return []
  const seasons: SeasonName[] = ["jjas"]
  if (region.ond.historical.meanHeavyDays >= OND_RELEVANT_DAYS) {
    if (response.season.id === "ne") seasons.unshift("ond")
    else seasons.push("ond")
  }
  return seasons.flatMap((season) => {
    const climate = region[season]
    const before = climate.historical.meanHeavyDays
    const after = climate.future.meanHeavyDays
    if (!Number.isFinite(before) || !Number.isFinite(after)) return []
    const spread = climate.heavyDaysSpread
    const uncertain = spread != null && spread[0] < 0 && spread[1] > 0
    return [
      {
        title: `${region.name}, ${SEASON_WORDS[season]}`,
        detail: `${changeSentence(before, after, climate.heavyDaysPct)}${
          uncertain ? " The three climate models do not agree on the direction, so treat this as uncertain." : ""
        }`,
        uncertain,
      },
    ]
  })
}

function changeSentence(before: number, after: number, pct: number | null): string {
  if (before < 0.05 && after < 0.05) {
    return "Heavy-rain days almost never happen in this season, today or in the 2030s and 2040s."
  }
  if (before < 1 && after < 1) {
    const now = Math.round(before * 10)
    const later = Math.round(after * 10)
    const trend = later > now ? "slightly more often" : later < now ? "slightly less often" : "about as often"
    const tenths = (value: number) => (value === 0 ? "less than 1" : `about ${value}`)
    return `Heavy-rain days are rare in this season and should stay rare, coming ${trend}: ${tenths(now)} in every 10 seasons today, and ${tenths(later)} in every 10 in the 2030s and 2040s.`
  }
  const rounded = pct == null ? 0 : Math.round(pct)
  const direction =
    Math.abs(rounded) < 5
      ? "about the same number of heavy-rain days in the 2030s and 2040s as in 1991–2014"
      : `about ${Math.abs(rounded)}% ${rounded > 0 ? "more" : "fewer"} heavy-rain days in the 2030s and 2040s than in 1991–2014`
  return `Climate models expect ${direction}: roughly ${daysWord(after)} a season, against ${daysWord(before)} today.`
}

function daysWord(value: number): string {
  const rounded = value < 3 ? Math.round(value * 10) / 10 : Math.round(value)
  return `${rounded} ${rounded === 1 ? "day" : "days"}`
}

export function typicalYear(city: CityDesk): string {
  const perYear = city.era5.heavyDays / Math.max(city.era5.years, 1)
  if (perYear < 0.5) return `Heavy rain is rare in ${city.name}: less than one day in two years, on average.`
  if (perYear < 1.5) return `In a typical year, ${city.name} gets heavy rain on about one day.`
  return `In a typical year, ${city.name} gets heavy rain on about ${Math.round(perYear)} days.`
}

export function sameWeekHistory(city: CityDesk): string | null {
  const view = city.views["7d"].heavy
  if (view.climatologyYears === 0) return null
  if (view.climatologyHits === 0) {
    return `In the last ${view.climatologyYears} years, this same week never had a heavy-rain day here.`
  }
  return `In the last ${view.climatologyYears} years, this same week had a heavy-rain day in ${view.climatologyHits} of them.`
}

export type Advice = { farm: string[]; business: string[] }

export function adviceFor(city: CityDesk, ground: Ground | null): Advice {
  const three = riskLevel(city.views["72h"].heavy.probability)
  const week = riskLevel(city.views["7d"].heavy.probability)
  const veryHeavy = (city.views["7d"].very_heavy.probability ?? 0) >= 0.1
  const peak = city.views["7d"].heavy.peak
  const when = peak ? ` before ${dayLabel(peak.date)}` : ""
  const around = peak ? ` around ${dayLabel(peak.date)}` : ""
  const dryDays = city.days.filter((day) => dayKind(day) === "dry").slice(0, 3).map((day) => formatWeekday(day.date))
  const wet = ground?.kind === "wet" || ground?.kind === "soaked"
  const serious = three === "likely" || three === "very_likely" || week === "likely" || week === "very_likely"
  const watch = !serious && (three === "real" || week === "real" || week === "small" || three === "small")

  if (three === "unknown" && week === "unknown") {
    return {
      farm: ["The forecast models could not be reached. Check the IMD district forecast before planning field work."],
      business: ["The forecast models could not be reached. Check the IMD district forecast before planning outdoor work."],
    }
  }

  if (serious) {
    const farm = [
      `Harvest any crop that is ready and move it under cover${when}.`,
      "Do not spray pesticide or apply fertiliser now. Rain will wash it off.",
      "Clear field drains and bunds so water can leave the field.",
      "Move animals, fodder, and stored grain to higher, covered ground.",
      "Hold off on sowing or transplanting in low-lying fields until the rain passes.",
    ]
    const business = [
      `Expect road delays and waterlogging${around}. Move urgent deliveries earlier.`,
      "Lift stock off warehouse floors and check roof drains and shutters.",
      "Plan to pause outdoor work, concrete pours, and site excavation on the wettest days.",
      "Charge phones and backup power. Agree a plan with staff for travel to work.",
    ]
    if (veryHeavy || wet) {
      farm.push("Stay away from rivers and nullahs. Never cross a flooded road or causeway.")
      business.push("Keep people and vehicles away from underpasses and riverside roads.")
    }
    return { farm, business }
  }

  if (watch) {
    return {
      farm: [
        dryDays.length
          ? `Plan spraying and harvest for the drier days: ${dryDays.join(", ")}.`
          : "Keep spraying and harvest flexible this week.",
        "Keep tarpaulins ready for harvested crop and fodder.",
        wet
          ? "Fields are already wet. Open drains now so a heavy shower does not waterlog them."
          : "Check that field drains are clear.",
      ],
      business: [
        "Keep some slack in delivery and site schedules this week.",
        "Check roof drains and keep ground-floor stock raised.",
      ],
    }
  }

  const { wetDays, totalMm } = weekRain(city)
  if (wetDays >= 3) {
    return {
      farm: [
        wetDays === city.days.length
          ? `Heavy rain is not expected, but showers are likely on all ${wetDays} days.`
          : `Heavy rain is not expected, but showers are likely on ${wetDays} of the next ${city.days.length} days.`,
        dryDays.length
          ? `Spray and apply fertiliser on the drier days (${dryDays.join(", ")}), with a few dry hours afterwards.`
          : "Spray and apply fertiliser only in dry spells, with a few dry hours afterwards.",
        `Hold off on irrigation. About ${Math.round(totalMm)} mm of rain is expected over the week.`,
        "Keep harvested crop covered and dry.",
      ],
      business: [
        "Showers on most days may slow outdoor work and deliveries a little. Heavy rain is not expected.",
        "Keep goods in transit covered.",
      ],
    }
  }

  return {
    farm: [
      "A good window for spraying, fertiliser, and harvest. Heavy rain is not expected.",
      ground?.kind === "dry" && totalMm < 10
        ? "If your crop needs water, plan irrigation. Little rain is expected."
        : "Check soil moisture before irrigating.",
    ],
    business: ["Normal operations. Heavy rain is not expected to disrupt roads or outdoor work this week."],
  }
}

export function weekRain(city: CityDesk): { wetDays: number; totalMm: number } {
  return {
    wetDays: city.days.filter((day) => (day.rainChance ?? 0) >= 0.5).length,
    totalMm: city.days.reduce((sum, day) => sum + (day.medianMm ?? 0), 0),
  }
}

export function headline(city: CityDesk): { level: RiskLevel; title: string; detail: string } {
  const view = city.views["72h"].heavy
  const level = riskLevel(view.probability)
  if (level === "unknown") {
    return {
      level,
      title: "Forecast not available",
      detail: "The forecast models could not be reached for this place. Try again in a few minutes.",
    }
  }
  const peak = view.peak && view.peak.probability >= 0.1 ? ` Most likely on ${dayLabel(view.peak.date)}.` : ""
  return {
    level,
    title: `Heavy rain in the next 3 days: ${RISK_WORDS[level].toLowerCase()}`,
    detail: `The chance of at least one day with heavy rain (6.5 cm or more) is ${chanceInWords(view.probability)}.${peak}`,
  }
}

export function weekLine(city: CityDesk): string {
  const week = city.views["7d"]
  const heavy = riskLevel(week.heavy.probability)
  if (heavy === "unknown") return ""
  const veryHeavy = week.very_heavy.probability ?? 0
  const extra =
    veryHeavy >= 0.1 ? ` Very heavy rain (11.5 cm or more) is also possible, ${chanceInWords(veryHeavy)}.` : ""
  return `Over the full 7 days, heavy rain is ${RISK_WORDS[heavy].toLowerCase()} (${chanceInWords(week.heavy.probability)}).${extra}`
}

export function agreement(city: CityDesk): string | null {
  const models = city.views["72h"].heavy.byModel.filter((model) => model.probability != null)
  if (models.length < 2) return null
  const [a, b] = models
  const gap = Math.abs((a.probability ?? 0) - (b.probability ?? 0))
  if (Math.max(a.probability ?? 0, b.probability ?? 0) < 0.1) return "The European and American forecast models both show little heavy rain."
  if (gap <= 0.15) return "The European and American forecast models broadly agree."
  return "The European and American forecast models disagree, so this forecast may change. Check again tomorrow."
}

export function nearestCity<T extends { lat: number; lon: number }>(
  cities: T[],
  lat: number,
  lon: number,
): { city: T; km: number } | null {
  let best: { city: T; km: number } | null = null
  for (const city of cities) {
    const km = haversineKm(lat, lon, city.lat, city.lon)
    if (!best || km < best.km) best = { city, km }
  }
  return best
}

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rad = Math.PI / 180
  const dLat = (lat2 - lat1) * rad
  const dLon = (lon2 - lon1) * rad
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2
  return 6371 * 2 * Math.asin(Math.sqrt(a))
}
