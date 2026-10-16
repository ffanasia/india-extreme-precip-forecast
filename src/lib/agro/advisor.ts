import { addDays, diffDays, parseIso } from "../dates"
import { english, type Key, type Params, type Translator } from "../i18n"
import { ozoneStress, summariseAirDay } from "./air"
import {
  cropName,
  diseaseName,
  diseaseScout,
  stageFocus,
  stageName,
  stageNitrogen,
  stageOn,
  type Crop,
  type Stage,
} from "./crops"
import type { DayAir, FarmPoint, WeatherHour } from "./types"

export type Verdict = "good" | "fair" | "avoid" | "none"
export type ActivityId = "sow" | "spray" | "fertilise" | "irrigate" | "harvest" | "fieldwork"

export function activityLabel(id: ActivityId, tr: Translator = english): string {
  return tr.t(`activity.${id}`)
}

/** Labels are display text; `tag` marks the cases the planner logic needs to recognise. */
export type ActivityTag = "frost" | "waitRain" | "preSow"

/** `score` ranks days with the same verdict; higher is better. Without it the earliest day wins. */
export type DayActivity = {
  verdict: Verdict
  label: string
  reason: string
  window?: string
  score?: number
  tag?: ActivityTag
}

export type DayWeather = {
  tMax: number | null
  tMin: number | null
  tMean: number | null
  feelsMax: number | null
  rain: number
  rainProbMax: number | null
  rhMean: number | null
  windMax: number | null
  gustMax: number | null
  et0: number
  soilTop: number | null
  soilRoot: number | null
  radiation: number | null
}

export type DayPlan = {
  date: string
  das: number | null
  stage: Stage | null
  weather: DayWeather
  air: DayAir | null
  heavyChance: number | null
  waterDeficit: number | null
  activities: Partial<Record<ActivityId, DayActivity>>
}

export type AlertKind = "heat" | "cold" | "disease" | "wind" | "rain" | "air" | "ozone"
export type FarmAlert = {
  kind: AlertKind
  severity: "watch" | "warning"
  dates: string[]
  title: string
  detail: string
  diseaseId?: string
}

export type BestPick = { activity: ActivityId; date: string | null; window?: string; verdict: Verdict; text: string; reason: string }

export type FarmPlan = {
  crop: Crop
  sownOn: string | null
  days: DayPlan[]
  stageToday: Stage | null
  dasToday: number | null
  nextStage: { stage: Stage; date: string } | null
  activities: ActivityId[]
  best: BestPick[]
  alerts: FarmAlert[]
  insights: string[]
  air: { worst: DayAir | null }
}

export type PlanInput = {
  point: FarmPoint
  crop: Crop
  sownOn: string | null
  today: string
  lastIrrigated?: string | null
  heavyChance?: Map<string, number | null>
  tr?: Translator
}

/** Volumetric soil water at field capacity and wilting point for a medium loam. */
const FIELD_CAPACITY = 0.32
const WILTING_POINT = 0.17
const WATERLOGGED = 0.4
const DRY_TOPSOIL = 0.16
const RICE_PERCOLATION_MM = 4
const RICE_TOP_UP_MM = 35

export function hourOf(time: string): number {
  return Number(time.slice(11, 13))
}

function periodOf(hour: number): Key {
  if (hour < 5 || hour >= 20) return "period.night"
  if (hour < 12) return "period.morning"
  if (hour < 16) return "period.afternoon"
  return "period.evening"
}

export function formatHourRange(start: number, endExclusive: number, tr: Translator = english): string {
  if (tr.lang !== "en") {
    const twelve = (hour: number) => (hour % 12 === 0 ? 12 : hour % 12)
    const p1 = periodOf(start % 24)
    const p2 = periodOf((endExclusive - 1) % 24)
    if (p1 === p2) return tr.t("hours.same", { period: tr.t(p1), from: twelve(start), to: twelve(endExclusive) })
    return tr.t("hours.cross", { p1: tr.t(p1), from: twelve(start), p2: tr.t(periodOf(endExclusive % 24)), to: twelve(endExclusive) })
  }
  const label = (hour: number) => {
    const h = hour % 24
    const suffix = h < 12 ? "am" : "pm"
    const twelve = h % 12 === 0 ? 12 : h % 12
    return { twelve, suffix }
  }
  const a = label(start)
  const b = label(endExclusive)
  if (a.suffix === b.suffix) return `${a.twelve}–${b.twelve} ${b.suffix}`
  return `${a.twelve} ${a.suffix}–${b.twelve} ${b.suffix}`
}

export function dayName(iso: string, tr: Translator = english): string {
  return tr.day(iso)
}

function mean(values: (number | null)[]): number | null {
  const ready = values.filter((value): value is number => value != null)
  return ready.length ? ready.reduce((sum, value) => sum + value, 0) / ready.length : null
}

function max(values: (number | null)[]): number | null {
  const ready = values.filter((value): value is number => value != null)
  return ready.length ? Math.max(...ready) : null
}

function min(values: (number | null)[]): number | null {
  const ready = values.filter((value): value is number => value != null)
  return ready.length ? Math.min(...ready) : null
}

export function summariseWeatherDay(hours: WeatherHour[]): DayWeather {
  return {
    tMax: max(hours.map((hour) => hour.temp)),
    tMin: min(hours.map((hour) => hour.temp)),
    tMean: mean(hours.map((hour) => hour.temp)),
    feelsMax: max(hours.map((hour) => hour.feels)),
    rain: hours.reduce((sum, hour) => sum + (hour.rain ?? 0), 0),
    rainProbMax: max(hours.map((hour) => hour.rainProb)),
    rhMean: mean(hours.map((hour) => hour.rh)),
    windMax: max(hours.map((hour) => hour.wind)),
    gustMax: max(hours.map((hour) => hour.gust)),
    et0: hours.reduce((sum, hour) => sum + (hour.et0 ?? 0), 0),
    soilTop: mean(hours.map((hour) => hour.soilTop)),
    soilRoot: mean(hours.map((hour) => hour.soilRoot)),
    radiation: hours.some((hour) => hour.radiation != null)
      ? hours.reduce((sum, hour) => sum + (hour.radiation ?? 0), 0) * 0.0036
      : null,
  }
}

type Window = { start: number; end: number; hours: number }

/** Longest run of consecutive qualifying hours; ties go to the earlier run. */
export function longestRun(flags: { hour: number; ok: boolean }[]): Window | null {
  let best: Window | null = null
  let start: number | null = null
  let previous: number | null = null
  const close = (end: number) => {
    if (start == null) return
    const run = { start, end, hours: end - start }
    if (!best || run.hours > best.hours) best = run
  }
  for (const flag of flags) {
    if (flag.ok && start != null && previous != null && flag.hour !== previous + 1) {
      close(previous + 1)
      start = flag.hour
    } else if (flag.ok && start == null) {
      start = flag.hour
    } else if (!flag.ok && start != null && previous != null) {
      close(previous + 1)
      start = null
    }
    previous = flag.hour
  }
  if (start != null && previous != null) close(previous + 1)
  return best
}

function rainAhead(all: WeatherHour[], index: number, hours: number): { mm: number; prob: number } {
  const slice = all.slice(index, index + hours)
  return {
    mm: slice.reduce((sum, hour) => sum + (hour.rain ?? 0), 0),
    prob: Math.max(0, ...slice.map((hour) => hour.rainProb ?? 0)),
  }
}

type SprayCheck = "ok" | "rain" | "windy" | "calm" | "hot" | "dry" | "night"

export function sprayHour(all: WeatherHour[], index: number, strict: boolean): SprayCheck {
  const hour = all[index]
  const h = hourOf(hour.time)
  if (h < 6 || h > 17) return "night"
  const ahead = rainAhead(all, index, 5)
  if (ahead.mm >= (strict ? 0.3 : 0.8) || ahead.prob >= (strict ? 40 : 60)) return "rain"
  const wind = hour.wind ?? 0
  const gust = hour.gust ?? wind
  if (wind > (strict ? 15 : 20) || gust > (strict ? 25 : 32)) return "windy"
  if (wind < (strict ? 3 : 2)) return "calm"
  if ((hour.temp ?? 0) > (strict ? 30 : 33)) return "hot"
  if ((hour.rh ?? 100) < (strict ? 40 : 30)) return "dry"
  return "ok"
}

const SPRAY_REASON: Record<Exclude<SprayCheck, "ok" | "night">, Key> = {
  rain: "spray.rain",
  windy: "spray.windy",
  calm: "spray.calm",
  hot: "spray.hot",
  dry: "spray.dry",
}

function dominant<T extends string>(checks: T[], skip: T[]): T | null {
  const counts = new Map<T, number>()
  for (const check of checks) {
    if (skip.includes(check)) continue
    counts.set(check, (counts.get(check) ?? 0) + 1)
  }
  let best: T | null = null
  for (const [key, count] of counts) if (best == null || count > (counts.get(best) ?? 0)) best = key
  return best
}

function sprayFor(all: WeatherHour[], indices: number[], tr: Translator): DayActivity {
  const strict = indices.map((index) => ({ hour: hourOf(all[index].time), check: sprayHour(all, index, true) }))
  const strictRun = longestRun(strict.map((item) => ({ hour: item.hour, ok: item.check === "ok" })))
  if (strictRun && strictRun.hours >= 3) {
    const window = formatHourRange(strictRun.start, strictRun.end, tr)
    return { verdict: "good", label: window, window, score: strictRun.hours, reason: tr.t("spray.good") }
  }
  const relaxed = indices.map((index) => ({ hour: hourOf(all[index].time), ok: sprayHour(all, index, false) === "ok" }))
  const relaxedRun = longestRun(relaxed)
  const blocker = dominant(strict.map((item) => item.check), ["ok", "night"]) as keyof typeof SPRAY_REASON | null
  if (relaxedRun && relaxedRun.hours >= 2) {
    const window = formatHourRange(relaxedRun.start, relaxedRun.end, tr)
    return {
      verdict: "fair",
      label: window,
      window,
      score: relaxedRun.hours,
      reason: blocker ? `${tr.t("spray.marginal")} ${tr.t(SPRAY_REASON[blocker])}` : tr.t("spray.marginal"),
    }
  }
  return { verdict: "avoid", label: tr.t("spray.noWindow"), reason: tr.t(blocker ? SPRAY_REASON[blocker] : "spray.noHours") }
}

function fieldworkFor(
  all: WeatherHour[],
  indices: number[],
  airByTime: Map<string, number | null>,
  tr: Translator,
): DayActivity {
  const flags = indices
    .filter((index) => {
      const h = hourOf(all[index].time)
      return h >= 6 && h <= 18
    })
    .map((index) => {
      const hour = all[index]
      const pm = airByTime.get(hour.time) ?? null
      const hot = (hour.feels ?? hour.temp ?? 0) >= 35
      const wet = (hour.rain ?? 0) >= 0.5
      const smoky = pm != null && pm >= 90
      return { hour: hourOf(hour.time), ok: !hot && !wet && !smoky, hot, wet, smoky }
    })
  const run = longestRun(flags)
  const hot = flags.filter((flag) => flag.hot).length
  const wet = flags.filter((flag) => flag.wet).length
  const smoky = flags.filter((flag) => flag.smoky).length
  const issue =
    smoky >= Math.max(hot, wet) && smoky > 0
      ? "smoke"
      : hot >= wet && hot > 0
        ? "heat"
        : wet > 0
          ? "rain"
          : null
  const outside: Record<string, Key> = { smoke: "work.outsideSmoke", heat: "work.outsideHeat", rain: "work.outsideRain" }
  const blocked: Record<string, Key> = { smoke: "work.blockedSmoke", heat: "work.blockedHeat", rain: "work.blockedRain" }
  if (run && run.hours >= 6) {
    const window = formatHourRange(run.start, run.end, tr)
    return {
      verdict: "good",
      label: window,
      window,
      score: run.hours,
      reason: tr.t(issue ? outside[issue] : "work.comfortable"),
    }
  }
  if (run && run.hours >= 2) {
    const window = formatHourRange(run.start, run.end, tr)
    return { verdict: "fair", label: window, window, score: run.hours, reason: tr.t(issue ? blocked[issue] : "work.partial") }
  }
  return { verdict: "avoid", label: tr.t("work.limit"), reason: tr.t(issue ? blocked[issue] : "work.allPoor") }
}

function harvestFor(
  crop: Crop,
  all: WeatherHour[],
  indices: number[],
  today: DayWeather,
  tomorrow: DayWeather | null,
  tr: Translator,
): DayActivity {
  const picked = crop.id === "cotton"
  const flags = indices
    .filter((index) => {
      const h = hourOf(all[index].time)
      return h >= 9 && h <= 17
    })
    .map((index) => ({
      hour: hourOf(all[index].time),
      ok: (all[index].rain ?? 0) < 0.1 && (all[index].rh ?? 100) < 75 && (all[index].rainProb ?? 0) < 40,
    }))
  const run = longestRun(flags)
  const nextRain = tomorrow?.rain ?? 0
  if (today.rain >= 2 || (today.rainProbMax ?? 0) >= 60) {
    return { verdict: "avoid", label: tr.t("harvest.rainLabel"), reason: tr.t(picked ? "harvest.rainPick" : "harvest.rainCut") }
  }
  if (run && run.hours >= 5 && nextRain < 2) {
    const window = formatHourRange(run.start, run.end, tr)
    return { verdict: "good", label: window, window, score: run.hours, reason: tr.t(picked ? "harvest.goodPick" : "harvest.goodCut") }
  }
  if (run && run.hours >= 3) {
    const window = formatHourRange(run.start, run.end, tr)
    return {
      verdict: "fair",
      label: window,
      window,
      score: run.hours,
      reason: tr.t(nextRain >= 2 ? (picked ? "harvest.tomorrowPick" : "harvest.tomorrowCut") : "harvest.humid"),
    }
  }
  return { verdict: "avoid", label: tr.t("harvest.humidLabel"), reason: tr.t("harvest.damp") }
}

function fertiliseFor(
  stage: Stage | null,
  day: DayWeather,
  next: DayWeather | null,
  heavyToday: number | null,
  heavyNext: number | null,
  irrigating: boolean,
  crop: Crop,
  tr: Translator,
): DayActivity {
  if (!stage?.nitrogen) return { verdict: "none", label: tr.t("fert.notDue"), reason: tr.t("fert.notDueReason") }
  const nextRain = next?.rain ?? 0
  if ((heavyToday ?? 0) >= 0.1 || (heavyNext ?? 0) >= 0.1) {
    return { verdict: "avoid", label: tr.t("fert.heavyLabel"), reason: tr.t("fert.heavyReason") }
  }
  if (day.rain >= 15 || nextRain >= 20) {
    return {
      verdict: "avoid",
      label: tr.t("fert.rainLabel"),
      reason: tr.t("fert.rainReason", { mm: Math.round(Math.max(day.rain, nextRain)) }),
    }
  }
  if ((day.soilTop ?? 0) >= WATERLOGGED && crop.id !== "rice") {
    return { verdict: "avoid", label: tr.t("fert.wetLabel"), reason: tr.t("fert.wetReason") }
  }
  if (crop.id === "rice") {
    return { verdict: "good", label: tr.t("common.good"), reason: tr.t("fert.rice") }
  }
  const lightRain = day.rain + nextRain >= 2 && day.rain + nextRain < 15
  if (irrigating || lightRain || (day.soilTop ?? 0) >= 0.22) {
    return {
      verdict: "good",
      label: tr.t("common.good"),
      reason: tr.t(irrigating ? "fert.withIrrigation" : lightRain ? "fert.lightRain" : "fert.moist"),
    }
  }
  return { verdict: "fair", label: tr.t("fert.dryLabel"), reason: tr.t("fert.dryReason") }
}

function sowFor(
  crop: Crop,
  date: string,
  day: DayWeather,
  next: DayWeather | null,
  heavyNext: number | null,
  tr: Translator,
): DayActivity {
  const name = tr.lower(cropName(crop, tr))
  const month = parseIso(date).month
  const [low, high] = crop.sowTemp
  const temp = day.tMean
  const inSeason = crop.sowMonths.includes(month)
  const nextRain = (next?.rain ?? 0) + day.rain
  if ((day.soilTop ?? 0) >= WATERLOGGED && crop.id !== "rice") {
    return { verdict: "avoid", label: tr.t("sow.wetLabel"), reason: tr.t("sow.wetReason") }
  }
  if (nextRain >= 25 || (heavyNext ?? 0) >= 0.1) {
    return { verdict: "avoid", label: tr.t("sow.heavyLabel"), reason: tr.t("sow.heavyReason") }
  }
  if (temp != null && (temp < low - 2 || temp > high + 2)) {
    return {
      verdict: "avoid",
      label: tr.t(temp < low ? "sow.coldLabel" : "sow.hotLabel"),
      reason: tr.t("sow.tempReason", { temp: Math.round(temp), crop: cropName(crop, tr), low, high }),
    }
  }
  const notes: string[] = []
  if (!inSeason) notes.push(tr.t("sow.offSeason", { crop: name }))
  if (temp != null && (temp < low || temp > high)) notes.push(tr.t("sow.tempEdge", { low, high }))
  if (crop.id === "rice") {
    if (nextRain < 5 && (day.soilTop ?? 0) < 0.3) notes.push(tr.t("sow.puddle"))
  } else if ((day.soilTop ?? 1) < DRY_TOPSOIL) {
    notes.push(tr.t("sow.dryTop"))
  }
  const score = temp == null ? 0 : -Math.abs(temp - (low + high) / 2)
  if (notes.length) return { verdict: "fair", label: tr.t("common.possible"), reason: notes.join(" "), score }
  return { verdict: "good", label: tr.t("common.good"), reason: tr.t("sow.good", { crop: name }), score }
}

export function bestDay(days: DayPlan[], activity: ActivityId, verdict: Verdict): DayPlan | null {
  let best: DayPlan | null = null
  for (const day of days) {
    const item = day.activities[activity]
    if (item?.verdict !== verdict) continue
    const current = best?.activities[activity]
    if (!best || (item.score ?? 0) > (current?.score ?? 0)) best = day
  }
  return best
}

function groupDates(dates: string[]): string[][] {
  const groups: string[][] = []
  for (const date of dates) {
    const last = groups[groups.length - 1]
    if (last && diffDays(last[last.length - 1], date) === 1) last.push(date)
    else groups.push([date])
  }
  return groups
}

export function spanLabel(dates: string[], tr: Translator = english): string {
  if (dates.length === 1) return tr.day(dates[0])
  return tr.t("span.range", { from: tr.day(dates[0]), to: tr.day(dates[dates.length - 1]) })
}

export function wetHours(hours: WeatherHour[], tMin: number, tMax: number, rh = 90): number {
  return hours.filter((hour) => {
    if (hour.temp == null || hour.temp < tMin || hour.temp > tMax) return false
    return (hour.rh ?? 0) >= rh || (hour.rain ?? 0) >= 0.2
  }).length
}

export function buildPlan(input: PlanInput): FarmPlan {
  const { point, crop, sownOn, today } = input
  const tr = input.tr ?? english
  const t = (key: Key, params?: Params) => tr.t(key, params)
  const all = point.weather
  const byDate = new Map<string, number[]>()
  all.forEach((hour, index) => {
    const date = hour.time.slice(0, 10)
    const list = byDate.get(date) ?? []
    list.push(index)
    byDate.set(date, list)
  })
  const dates = Array.from({ length: 7 }, (_, index) => addDays(today, index)).filter(
    (date) => (byDate.get(date)?.length ?? 0) >= 20,
  )
  const airByTime = new Map(point.air.map((hour) => [hour.time, hour.pm25]))
  const weatherDays = new Map(dates.map((date) => [date, summariseWeatherDay((byDate.get(date) ?? []).map((index) => all[index]))]))
  const nextOf = (date: string) => {
    const next = addDays(date, 1)
    return weatherDays.get(next) ?? (byDate.has(next) ? summariseWeatherDay(byDate.get(next)!.map((index) => all[index])) : null)
  }
  const heavy = (date: string) => input.heavyChance?.get(date) ?? null

  const dasOf = (date: string) => (sownOn ? diffDays(sownOn, date) : null)
  const stageFor = (date: string) => {
    const das = dasOf(date)
    return das == null ? null : stageOn(crop, das)
  }

  const todayWeather = weatherDays.get(dates[0])
  const firstStage = stageFor(dates[0] ?? today)
  const ponded = firstStage?.irrigation === "ponded"
  const rootMm = !firstStage || firstStage === crop.stages[0] ? 200 : 400
  const totalWater = (FIELD_CAPACITY - WILTING_POINT) * rootMm
  let deficit = ponded
    ? 0
    : Math.min(totalWater, Math.max(0, (FIELD_CAPACITY - (todayWeather?.soilRoot ?? FIELD_CAPACITY)) * rootMm))
  if (input.lastIrrigated) {
    const since = diffDays(input.lastIrrigated, today)
    if (since >= 0 && since <= 10) deficit = Math.min(deficit, since * (todayWeather?.et0 ?? 4) * (firstStage?.kc ?? 0.5))
  }

  const days: DayPlan[] = dates.map((date) => {
    const indices = byDate.get(date) ?? []
    const weather = weatherDays.get(date)!
    const next = nextOf(date)
    const das = dasOf(date)
    const stage = stageFor(date)
    const growing = stage != null && das != null && das >= 0
    const activities: Partial<Record<ActivityId, DayActivity>> = {}

    const kc = stage?.kc ?? 0.3
    const etc = weather.et0 * kc
    const effectiveRain = weather.rain < 2 ? 0 : weather.rain * 0.8
    const rainSoon = weather.rain + (next?.rain ?? 0)
    const threshold = ponded
      ? RICE_TOP_UP_MM
      : crop.depletion * totalWater * (stage?.irrigation === "critical" ? 0.7 : 1)
    const deficitToday = deficit
    let irrigate: DayActivity
    if (stage?.irrigation === "stop") {
      irrigate = { verdict: "none", label: t("irr.stopLabel"), reason: t("irr.stop") }
    } else if ((weather.soilTop ?? 0) >= WATERLOGGED || weather.rain >= 20) {
      irrigate = { verdict: "avoid", label: t("irr.wetLabel"), reason: t("irr.wet") }
    } else if (growing && stage?.coldMin != null && next?.tMin != null && next.tMin <= stage.coldMin) {
      irrigate = { verdict: "good", tag: "frost", label: t("irr.frostLabel"), reason: t("irr.frost", { temp: Math.round(next.tMin) }) }
    } else if (deficit >= threshold) {
      const used = { mm: Math.round(deficit) }
      irrigate =
        rainSoon >= 10
          ? { verdict: "avoid", tag: "waitRain", label: t("irr.waitLabel"), reason: t("irr.wait", { mm: Math.round(rainSoon) }) }
          : {
              verdict: "good",
              label: t("irr.goLabel"),
              reason: ponded ? t("irr.rice") : t(stage?.irrigation === "critical" ? "irr.critical" : "irr.low", used),
            }
    } else if (growing && stage?.heatMax != null && next?.tMax != null && next.tMax >= stage.heatMax && rainSoon < 5) {
      irrigate = { verdict: "fair", label: t("irr.heatLabel"), reason: t("irr.heat", { temp: Math.round(next.tMax) }) }
    } else if (deficit >= threshold * 0.75 && rainSoon < 10) {
      irrigate = { verdict: "fair", label: t("irr.soonLabel"), reason: t("irr.soon", { mm: Math.round(deficit) }) }
    } else {
      irrigate = { verdict: "none", label: t("common.notNeeded"), reason: t(weather.rain >= 5 ? "irr.rainDoing" : "irr.enough") }
    }
    if (stage?.irrigation === "light" && irrigate.verdict === "good" && irrigate.tag !== "frost") {
      irrigate = { ...irrigate, reason: `${irrigate.reason} ${t("irr.lightNote")}` }
    }
    if (!growing && irrigate.verdict === "good") {
      irrigate = { ...irrigate, tag: "preSow", label: t("irr.preSowLabel"), reason: t("irr.preSow") }
    }
    activities.irrigate = irrigate
    if (irrigate.verdict === "good" && irrigate.tag !== "frost") deficit = 0
    deficit = Math.min(totalWater * (ponded ? 2 : 1), Math.max(0, deficit + etc + (ponded ? RICE_PERCOLATION_MM : 0) - effectiveRain))

    if (!growing) {
      activities.sow = sowFor(crop, date, weather, next, heavy(addDays(date, 1)), tr)
    } else {
      activities.spray =
        stage?.irrigation === "stop"
          ? { verdict: "none", label: t("common.notNeeded"), reason: t("spray.nearHarvest") }
          : sprayFor(all, indices, tr)
      activities.fertilise = fertiliseFor(stage, weather, next, heavy(date), heavy(addDays(date, 1)), irrigate.verdict === "good", crop, tr)
      if (stage?.harvest) activities.harvest = harvestFor(crop, all, indices, weather, next, tr)
    }
    activities.fieldwork = fieldworkFor(all, indices, airByTime, tr)

    return {
      date,
      das,
      stage,
      weather,
      air: summariseAirDay(date, point.air),
      heavyChance: heavy(date),
      waterDeficit: ponded ? null : deficitToday,
      activities,
    }
  })

  const activities: ActivityId[] = []
  for (const id of ["sow", "spray", "fertilise", "irrigate", "harvest", "fieldwork"] as ActivityId[]) {
    if (days.some((day) => day.activities[id] && day.activities[id]!.verdict !== "none")) activities.push(id)
    else if (id === "irrigate" && days.some((day) => day.activities.irrigate)) activities.push(id)
  }

  const best: BestPick[] = activities.map((activity) => {
    const pick = bestDay(days, activity, "good") ?? bestDay(days, activity, "fair")
    if (!pick) {
      const sample = days.find((day) => day.activities[activity])?.activities[activity]
      const none = days.every((day) => {
        const verdict = day.activities[activity]?.verdict
        return verdict === "none" || (activity === "irrigate" && verdict === "avoid")
      })
      return {
        activity,
        date: null,
        verdict: none ? "none" : "avoid",
        text: t(none ? (activity === "irrigate" ? "best.notNeeded" : "best.notDue") : "best.noDay"),
        reason: sample?.reason ?? "",
      }
    }
    const item = pick.activities[activity]!
    return {
      activity,
      date: pick.date,
      window: item.window,
      verdict: item.verdict,
      text: item.window ? t("best.window", { day: tr.day(pick.date), window: item.window }) : tr.day(pick.date),
      reason: item.reason,
    }
  })

  const alerts = buildAlerts(crop, days, point, tr)
  const dasToday = sownOn ? diffDays(sownOn, today) : null
  const stageToday = dasToday != null && dasToday >= 0 ? stageOn(crop, dasToday) : null
  let nextStage: FarmPlan["nextStage"] = null
  if (sownOn) {
    const upcoming = crop.stages.find((stage) => dasToday == null || stage.from > dasToday)
    if (upcoming) nextStage = { stage: upcoming, date: addDays(sownOn, upcoming.from) }
  }
  const worst = days
    .map((day) => day.air)
    .filter((air): air is DayAir => air?.aqi != null)
    .sort((a, b) => (b.aqi?.value ?? 0) - (a.aqi?.value ?? 0))[0] ?? null

  const plan: FarmPlan = {
    crop,
    sownOn,
    days,
    stageToday,
    dasToday,
    nextStage,
    activities,
    best,
    alerts,
    insights: [],
    air: { worst },
  }
  plan.insights = buildInsights(plan, point, tr)
  return plan
}

function buildAlerts(crop: Crop, days: DayPlan[], point: FarmPoint, tr: Translator): FarmAlert[] {
  const alerts: FarmAlert[] = []
  const name = tr.lower(cropName(crop, tr))
  const hoursOf = (date: string) => point.weather.filter((hour) => hour.time.startsWith(date))

  const heatDays = days.filter((day) => day.stage?.heatMax != null && (day.weather.tMax ?? -99) >= day.stage.heatMax)
  for (const group of groupDates(heatDays.map((day) => day.date))) {
    const peak = Math.max(...group.map((date) => days.find((day) => day.date === date)!.weather.tMax ?? 0))
    const stage = days.find((day) => day.date === group[0])!.stage!
    alerts.push({
      kind: "heat",
      severity: peak >= (stage.heatMax ?? 0) + 2 ? "warning" : "watch",
      dates: group,
      title: tr.t("alert.heatTitle", { stage: tr.lower(stageName(crop, stage, tr)) }),
      detail: tr.t("alert.heat", { temp: Math.round(peak), max: stage.heatMax ?? 0, crop: name }),
    })
  }

  const coldDays = days.filter((day) => day.stage?.coldMin != null && (day.weather.tMin ?? 99) <= day.stage.coldMin)
  for (const group of groupDates(coldDays.map((day) => day.date))) {
    const low = Math.min(...group.map((date) => days.find((day) => day.date === date)!.weather.tMin ?? 99))
    alerts.push({
      kind: "cold",
      severity: low <= 0 ? "warning" : "watch",
      dates: group,
      title: tr.t("alert.coldTitle"),
      detail: tr.t("alert.cold", { temp: Math.round(low) }),
    })
  }

  for (const disease of crop.diseases) {
    const risky = days.filter((day) => {
      if (!day.stage || !disease.stages.includes(day.stage.id)) return false
      return wetHours(hoursOf(day.date), disease.tMin, disease.tMax, disease.rh) >= disease.wetHours
    })
    for (const group of groupDates(risky.map((day) => day.date))) {
      alerts.push({
        kind: "disease",
        severity: group.length >= 2 ? "warning" : "watch",
        dates: group,
        diseaseId: disease.id,
        title: tr.t("alert.diseaseTitle", { disease: diseaseName(crop, disease, tr) }),
        detail: tr.t(group.length >= 2 ? "alert.diseaseMany" : "alert.diseaseOne", {
          low: disease.tMin,
          high: disease.tMax,
          disease: tr.lower(diseaseName(crop, disease, tr)),
          scout: diseaseScout(crop, disease, tr),
        }),
      })
    }
  }

  const windy = days.filter((day) => day.stage?.lodging && (day.weather.gustMax ?? 0) >= 45)
  for (const group of groupDates(windy.map((day) => day.date))) {
    const gust = Math.max(...group.map((date) => days.find((day) => day.date === date)!.weather.gustMax ?? 0))
    alerts.push({
      kind: "wind",
      severity: gust >= 60 ? "warning" : "watch",
      dates: group,
      title: tr.t("alert.windTitle"),
      detail: tr.t("alert.wind", { gust: Math.round(gust) }),
    })
  }

  const wet = days.filter((day) => (day.heavyChance ?? 0) >= 0.1 || day.weather.rain >= 64.5)
  for (const group of groupDates(wet.map((day) => day.date))) {
    const chance = Math.max(...group.map((date) => days.find((day) => day.date === date)!.heavyChance ?? 0))
    alerts.push({
      kind: "rain",
      severity: chance >= 0.25 ? "warning" : "watch",
      dates: group,
      title: tr.t("alert.rainTitle"),
      detail:
        chance > 0
          ? `${tr.t("alert.rainChance", { n: Math.round(chance * 10) })} ${tr.t("alert.rainAction")}`
          : tr.t("alert.rainAction"),
    })
  }

  const badAir = days.filter((day) => day.air?.aqi && ["Poor", "Very poor", "Severe"].includes(day.air.aqi.category))
  for (const group of groupDates(badAir.map((day) => day.date))) {
    const worst = group
      .map((date) => days.find((day) => day.date === date)!.air!)
      .sort((a, b) => (b.aqi?.value ?? 0) - (a.aqi?.value ?? 0))[0]
    alerts.push({
      kind: "air",
      severity: worst.aqi!.value > 300 ? "warning" : "watch",
      dates: group,
      title: tr.t("alert.airTitle", { category: tr.t(`aqi.${worst.aqi!.category}`) }),
      detail: tr.t("alert.air", { aqi: worst.aqi!.value, pollutant: worst.aqi!.dominant }),
    })
  }

  if (crop.ozone !== "low") {
    const ozoneDays = days.filter((day) => ozoneStress(day.air?.aot40 ?? null) === "high")
    for (const group of groupDates(ozoneDays.map((day) => day.date))) {
      alerts.push({
        kind: "ozone",
        severity: "watch",
        dates: group,
        title: tr.t("alert.ozoneTitle"),
        detail: tr.t(crop.ozone === "high" ? "alert.ozoneHigh" : "alert.ozoneMedium", { crop: cropName(crop, tr) }),
      })
    }
  }

  const order: Record<AlertKind, number> = { rain: 0, heat: 1, cold: 2, wind: 3, disease: 4, air: 5, ozone: 6 }
  return alerts.sort(
    (a, b) =>
      (a.severity === b.severity ? 0 : a.severity === "warning" ? -1 : 1) ||
      a.dates[0].localeCompare(b.dates[0]) ||
      order[a.kind] - order[b.kind],
  )
}

function buildInsights(plan: FarmPlan, point: FarmPoint, tr: Translator): string[] {
  const insights: string[] = []
  const { crop, stageToday, dasToday, days } = plan
  const pick = (id: ActivityId) => plan.best.find((item) => item.activity === id)
  const name = tr.lower(cropName(crop, tr))
  const stageWord = (stage: Stage) => tr.lower(stageName(crop, stage, tr))

  if (stageToday && dasToday != null) {
    insights.push(
      tr.t("insight.stage", {
        crop: name,
        stage: stageWord(stageToday),
        das: dasToday,
        start: tr.t(`start.${crop.startLabel}`),
        focus: stageFocus(crop, stageToday, tr),
      }),
    )
  } else if (plan.sownOn && dasToday != null && dasToday < 0) {
    insights.push(tr.t("insight.planned", { start: tr.t(`startTitle.${crop.startLabel}`), day: tr.day(plan.sownOn) }))
  } else {
    const sow = pick("sow")
    if (sow?.date) {
      const params = { crop: name, day: tr.day(sow.date), reason: sow.reason }
      insights.push(tr.t(sow.verdict === "good" ? "insight.sowGood" : "insight.sowMixed", params))
    } else if (sow) {
      insights.push(tr.t("insight.sowNone", { reason: sow.reason }))
    }
  }

  const disease = plan.alerts.find((alert) => alert.kind === "disease")
  const spray = pick("spray")
  if (disease) {
    const usable = days.filter(
      (day) =>
        day.date <= disease.dates[disease.dates.length - 1] &&
        day.activities.spray?.window &&
        day.activities.spray.verdict !== "avoid",
    )
    const window = usable[0]
    const source = crop.diseases.find((item) => item.id === disease.diseaseId)
    const params = { disease: source ? diseaseName(crop, source, tr) : disease.title, span: spanLabel(disease.dates, tr) }
    insights.push(
      window
        ? tr.t("insight.diseaseWindow", { ...params, day: tr.day(window.date), window: window.activities.spray!.window ?? "" })
        : tr.t("insight.diseaseNoWindow", params),
    )
  } else if (spray?.date) {
    insights.push(tr.t("insight.spray", { when: spray.text, reason: spray.reason }))
  }

  const fertilise = pick("fertilise")
  const nitrogen = stageToday ? stageNitrogen(crop, stageToday, tr) : null
  if (fertilise?.date && nitrogen) {
    insights.push(tr.t("insight.fertilise", { nitrogen, day: tr.day(fertilise.date), reason: fertilise.reason }))
  } else if (plan.nextStage?.stage.nitrogen && plan.nextStage.date <= days[days.length - 1]?.date) {
    insights.push(tr.t("insight.nitrogenSoon", { day: tr.day(plan.nextStage.date), stage: stageWord(plan.nextStage.stage) }))
  }

  const irrigate = pick("irrigate")
  if (irrigate?.date && irrigate.verdict !== "none") {
    insights.push(tr.t("insight.irrigate", { when: irrigate.text, reason: irrigate.reason }))
  } else if (irrigate && stageToday?.irrigation !== "stop") {
    insights.push(tr.t("insight.noIrrigation"))
  }

  const harvest = pick("harvest")
  if (harvest) {
    insights.push(
      harvest.date
        ? tr.t("insight.harvest", { when: harvest.text, reason: harvest.reason })
        : tr.t("insight.harvestNone", { text: tr.lower(harvest.text), reason: harvest.reason }),
    )
  }

  if (plan.nextStage && plan.nextStage.date > (days[days.length - 1]?.date ?? "") && stageToday) {
    insights.push(tr.t("insight.nextStage", { stage: stageWord(plan.nextStage.stage), day: tr.day(plan.nextStage.date) }))
  }

  const worst = plan.air.worst
  if (worst?.aqi && worst.aqi.value > 200) {
    const month = parseIso(worst.date).month
    const burningBelt = ["northwest", "gangetic"].includes(point.regionId) && (month === 10 || month === 11)
    const line = tr.t("insight.air", {
      category: tr.lower(tr.t(`aqi.${worst.aqi.category}`)),
      day: tr.day(worst.date),
      pm: Math.round(worst.pm25 ?? 0),
    })
    insights.push(burningBelt ? `${line} ${tr.t("insight.burning")}` : line)
  }
  const hazy = days.filter((day) => (day.air?.aod ?? 0) >= 1)
  if (hazy.length >= 2) insights.push(tr.t("insight.haze", { n: hazy.length }))

  return insights
}
