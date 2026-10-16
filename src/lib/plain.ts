import { english, type Key, type Translator } from "./i18n"
import type { SeasonName } from "./stats"
import type { CityDesk, DayOutlook, DeskResponse } from "./types"

export type RiskLevel = "unknown" | "unlikely" | "small" | "real" | "likely" | "very_likely"

export const RISK_COLOR: Record<RiskLevel, string> = {
  unknown: "#5c564c",
  unlikely: "#7fa89a",
  small: "#d6b25e",
  real: "#e08a3c",
  likely: "#e24a2e",
  very_likely: "#ff3b30",
}

export function riskWord(level: RiskLevel, tr: Translator = english): string {
  return tr.t(`risk.${level}`)
}

/** Translated name for a place id, falling back to the name the data carries. */
export function placeName(id: string, fallback: string, tr: Translator = english): string {
  const key = `city.${id}`
  return tr.has(key) ? tr.t(key) : fallback
}

export function stateName(state: string, tr: Translator = english): string {
  const key = `state.${state}`
  return tr.has(key) ? tr.t(key) : state
}

export function regionName(id: string, fallback: string, tr: Translator = english): string {
  const key = `region.${id}`
  return tr.has(key) ? tr.t(key) : fallback
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

export function chanceInWords(probability: number | null, tr: Translator = english): string {
  if (probability == null || !Number.isFinite(probability)) return tr.t("chance.unknown")
  if (probability < 0.05) return tr.t("chance.lt20")
  if (probability < 0.1) return tr.t("chance.lt10")
  if (probability >= 0.95) return tr.t("chance.certain")
  return tr.t("chance.about", { n: Math.round(probability * 10) })
}

export type DayKind = "dry" | "showers" | "rain" | "heavy_possible" | "heavy_risk" | "unknown"

export function dayWord(kind: DayKind, tr: Translator = english): string {
  return tr.t(`dayKind.${kind}`)
}

export function dayKind(day: DayOutlook): DayKind {
  if (day.rainChance == null) return "unknown"
  if ((day.heavyChance ?? 0) >= 0.25) return "heavy_risk"
  if ((day.heavyChance ?? 0) >= 0.1) return "heavy_possible"
  if ((day.medianMm ?? 0) >= 10 && day.rainChance >= 0.6) return "rain"
  if (day.rainChance >= 0.3) return "showers"
  return "dry"
}

export function roundedMm(value: number | null, tr: Translator = english): string {
  if (value == null || !Number.isFinite(value)) return tr.t("common.dash")
  if (value < 1) return tr.t("mm.under1")
  return tr.t("mm.about", { n: Math.round(value) })
}

export type Ground = { kind: "dry" | "wet" | "soaked"; title: string; detail: string; asOf: string | null }

export function groundStatus(city: CityDesk, tr: Translator = english): Ground | null {
  const satellite = city.satellite
  if (!satellite || satellite.days.length === 0) return null
  const sum = satellite.days.reduce((acc, day) => acc + day.mm, 0)
  const asOf = satellite.latest ? tr.date(satellite.latest.date) : null
  const total = tr.t("ground.tenDays", { mm: Math.round(sum), days: satellite.days.length })
  if (satellite.antecedent === "extreme") {
    return { kind: "soaked", title: tr.t("ground.soakedTitle"), detail: tr.t("ground.soakedDetail", { total }), asOf }
  }
  if (satellite.antecedent === "wet") {
    return { kind: "wet", title: tr.t("ground.wetTitle"), detail: tr.t("ground.wetDetail", { total }), asOf }
  }
  return {
    kind: "dry",
    title: tr.t(sum < 10 ? "ground.dryTitle" : "ground.okTitle"),
    detail: tr.t("ground.dryDetail", { total }),
    asOf,
  }
}

/** Below this many heavy days per season, the October–December change is noise for planning. */
const OND_RELEVANT_DAYS = 0.3

export type Future = { title: string; detail: string; uncertain: boolean }

export function futureOutlook(response: DeskResponse, city: CityDesk, tr: Translator = english): Future[] {
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
    const change = changeSentence(before, after, climate.heavyDaysPct, tr)
    return [
      {
        title: tr.t("future.title", {
          region: regionName(region.id, region.name, tr),
          season: tr.t(`seasonName.${season}`),
        }),
        detail: uncertain ? `${change} ${tr.t("future.uncertain")}` : change,
        uncertain,
      },
    ]
  })
}

function changeSentence(before: number, after: number, pct: number | null, tr: Translator): string {
  if (before < 0.05 && after < 0.05) return tr.t("future.none")
  if (before < 1 && after < 1) {
    const now = Math.round(before * 10)
    const later = Math.round(after * 10)
    const trend = tr.t(later > now ? "future.trendMore" : later < now ? "future.trendLess" : "future.trendSame")
    const tenths = (value: number) => (value === 0 ? tr.t("future.tenthsLt1") : tr.t("future.tenthsAbout", { n: value }))
    return tr.t("future.rare", { trend, now: tenths(now), later: tenths(later) })
  }
  const rounded = pct == null ? 0 : Math.round(pct)
  const params = { pct: Math.abs(rounded), after: daysWord(after, tr), before: daysWord(before, tr) }
  if (Math.abs(rounded) < 5) return tr.t("future.same", params)
  return tr.t(rounded > 0 ? "future.more" : "future.fewer", params)
}

export function daysWord(value: number, tr: Translator = english): string {
  const rounded = value < 3 ? Math.round(value * 10) / 10 : Math.round(value)
  return tr.t(rounded === 1 ? "days.one" : "days.many", { n: rounded })
}

export function typicalYear(city: CityDesk, tr: Translator = english): string {
  const perYear = city.era5.heavyDays / Math.max(city.era5.years, 1)
  const name = placeName(city.id, city.name, tr)
  if (perYear < 0.5) return tr.t("typical.rare", { city: name })
  if (perYear < 1.5) return tr.t("typical.one", { city: name })
  return tr.t("typical.many", { city: name, n: Math.round(perYear) })
}

export function sameWeekHistory(city: CityDesk, tr: Translator = english): string | null {
  const view = city.views["7d"].heavy
  if (view.climatologyYears === 0) return null
  if (view.climatologyHits === 0) return tr.t("history.never", { years: view.climatologyYears })
  return tr.t("history.some", { years: view.climatologyYears, hits: view.climatologyHits })
}

export type Advice = { farm: string[]; business: string[] }

export function adviceFor(city: CityDesk, ground: Ground | null, tr: Translator = english): Advice {
  const three = riskLevel(city.views["72h"].heavy.probability)
  const week = riskLevel(city.views["7d"].heavy.probability)
  const veryHeavy = (city.views["7d"].very_heavy.probability ?? 0) >= 0.1
  const peak = city.views["7d"].heavy.peak
  const peakDay = peak ? tr.day(peak.date) : null
  const dryDays = city.days
    .filter((day) => dayKind(day) === "dry")
    .slice(0, 3)
    .map((day) => tr.weekday(day.date))
    .join(", ")
  const wet = ground?.kind === "wet" || ground?.kind === "soaked"
  const serious = three === "likely" || three === "very_likely" || week === "likely" || week === "very_likely"
  const watch = !serious && (three === "real" || week === "real" || week === "small" || three === "small")
  const t = (key: Key, params?: Record<string, string | number>) => tr.t(key, params)

  if (three === "unknown" && week === "unknown") {
    return { farm: [t("advice.unknownFarm")], business: [t("advice.unknownBusiness")] }
  }

  if (serious) {
    const farm = [
      peakDay ? t("advice.harvestBy", { day: peakDay }) : t("advice.harvestNow"),
      t("advice.noSpray"),
      t("advice.clearDrains"),
      t("advice.moveAnimals"),
      t("advice.holdSowing"),
    ]
    const business = [
      peakDay ? t("advice.delaysAround", { day: peakDay }) : t("advice.delays"),
      t("advice.liftStock"),
      t("advice.pauseWork"),
      t("advice.power"),
    ]
    if (veryHeavy || wet) {
      farm.push(t("advice.rivers"))
      business.push(t("advice.underpass"))
    }
    return { farm, business }
  }

  if (watch) {
    return {
      farm: [
        dryDays ? t("advice.dryDays", { days: dryDays }) : t("advice.flexible"),
        t("advice.tarps"),
        wet ? t("advice.openDrainsWet") : t("advice.checkDrains"),
      ],
      business: [t("advice.slack"), t("advice.roof")],
    }
  }

  const { wetDays, totalMm } = weekRain(city)
  if (wetDays >= 3) {
    return {
      farm: [
        wetDays === city.days.length
          ? t("advice.showersAll", { n: wetDays })
          : t("advice.showersSome", { n: wetDays, total: city.days.length }),
        dryDays ? t("advice.sprayDryDays", { days: dryDays }) : t("advice.sprayDrySpells"),
        t("advice.skipIrrigation", { mm: Math.round(totalMm) }),
        t("advice.coverHarvest"),
      ],
      business: [t("advice.showersBusiness"), t("advice.coverGoods")],
    }
  }

  return {
    farm: [
      t("advice.goodWindow"),
      ground?.kind === "dry" && totalMm < 10 ? t("advice.planIrrigation") : t("advice.checkSoil"),
    ],
    business: [t("advice.normalBusiness")],
  }
}

export function weekRain(city: CityDesk): { wetDays: number; totalMm: number } {
  return {
    wetDays: city.days.filter((day) => (day.rainChance ?? 0) >= 0.5).length,
    totalMm: city.days.reduce((sum, day) => sum + (day.medianMm ?? 0), 0),
  }
}

export function headline(city: CityDesk, tr: Translator = english): { level: RiskLevel; title: string; detail: string } {
  const view = city.views["72h"].heavy
  const level = riskLevel(view.probability)
  if (level === "unknown") {
    return { level, title: tr.t("headline.unknownTitle"), detail: tr.t("headline.unknownDetail") }
  }
  const detail = tr.t("headline.detail", { chance: chanceInWords(view.probability, tr) })
  const peak = view.peak && view.peak.probability >= 0.1 ? tr.t("headline.peak", { day: tr.day(view.peak.date) }) : null
  return {
    level,
    title: tr.t("headline.title", { risk: tr.lower(riskWord(level, tr)) }),
    detail: peak ? `${detail} ${peak}` : detail,
  }
}

export function weekLine(city: CityDesk, tr: Translator = english): string {
  const week = city.views["7d"]
  const heavy = riskLevel(week.heavy.probability)
  if (heavy === "unknown") return ""
  const veryHeavy = week.very_heavy.probability ?? 0
  const line = tr.t("week.line", {
    risk: tr.lower(riskWord(heavy, tr)),
    chance: chanceInWords(week.heavy.probability, tr),
  })
  return veryHeavy >= 0.1 ? `${line} ${tr.t("week.veryHeavy", { chance: chanceInWords(veryHeavy, tr) })}` : line
}

export function agreement(city: CityDesk, tr: Translator = english): string | null {
  const models = city.views["72h"].heavy.byModel.filter((model) => model.probability != null)
  if (models.length < 2) return null
  const [a, b] = models
  const gap = Math.abs((a.probability ?? 0) - (b.probability ?? 0))
  if (Math.max(a.probability ?? 0, b.probability ?? 0) < 0.1) return tr.t("agree.bothLow")
  if (gap <= 0.15) return tr.t("agree.agree")
  return tr.t("agree.disagree")
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
