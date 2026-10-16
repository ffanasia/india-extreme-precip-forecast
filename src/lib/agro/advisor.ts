import { addDays, diffDays, formatDay, formatWeekday, parseIso } from "../dates"
import { ozoneStress, summariseAirDay } from "./air"
import { stageOn, type Crop, type Stage } from "./crops"
import type { DayAir, FarmPoint, WeatherHour } from "./types"

export type Verdict = "good" | "fair" | "avoid" | "none"
export type ActivityId = "sow" | "spray" | "fertilise" | "irrigate" | "harvest" | "fieldwork"

export const ACTIVITY_LABEL: Record<ActivityId, string> = {
  sow: "Sow",
  spray: "Spray",
  fertilise: "Top-dress fertiliser",
  irrigate: "Irrigate",
  harvest: "Harvest",
  fieldwork: "Field work",
}

/** `score` ranks days with the same verdict; higher is better. Without it the earliest day wins. */
export type DayActivity = { verdict: Verdict; label: string; reason: string; window?: string; score?: number }

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

export function formatHourRange(start: number, endExclusive: number): string {
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

export function dayName(iso: string): string {
  return `${formatWeekday(iso)} ${formatDay(iso)}`
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

const SPRAY_REASON: Record<Exclude<SprayCheck, "ok" | "night">, string> = {
  rain: "Rain is due within a few hours and would wash the spray off.",
  windy: "Too windy: spray would drift onto neighbouring fields and people.",
  calm: "Air is too still: fine droplets hang and drift unpredictably.",
  hot: "Too hot: spray evaporates before it works and can scorch leaves.",
  dry: "Air is very dry: droplets evaporate before reaching the leaf.",
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

function sprayFor(all: WeatherHour[], indices: number[]): DayActivity {
  const strict = indices.map((index) => ({ hour: hourOf(all[index].time), check: sprayHour(all, index, true) }))
  const strictRun = longestRun(strict.map((item) => ({ hour: item.hour, ok: item.check === "ok" })))
  if (strictRun && strictRun.hours >= 3) {
    const window = formatHourRange(strictRun.start, strictRun.end)
    return {
      verdict: "good",
      label: window,
      window,
      score: strictRun.hours,
      reason: "Light wind, no rain for several hours, and mild temperature.",
    }
  }
  const relaxed = indices.map((index) => ({ hour: hourOf(all[index].time), ok: sprayHour(all, index, false) === "ok" }))
  const relaxedRun = longestRun(relaxed)
  const blocker = dominant(strict.map((item) => item.check), ["ok", "night"]) as keyof typeof SPRAY_REASON | null
  if (relaxedRun && relaxedRun.hours >= 2) {
    const window = formatHourRange(relaxedRun.start, relaxedRun.end)
    return {
      verdict: "fair",
      label: window,
      window,
      score: relaxedRun.hours,
      reason: `Only a short or marginal window. ${blocker ? SPRAY_REASON[blocker] : ""}`.trim(),
    }
  }
  return { verdict: "avoid", label: "No window", reason: blocker ? SPRAY_REASON[blocker] : "No suitable hours today." }
}

function fieldworkFor(all: WeatherHour[], indices: number[], airByTime: Map<string, number | null>): DayActivity {
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
  const outside = {
    smoke: "Unhealthy air outside these hours. Wear an N95 mask for long shifts.",
    heat: "Too hot outside these hours. Rest in shade and drink water often.",
    rain: "Rain outside these hours.",
  }
  const blocked = {
    smoke: "Air is unhealthy for much of the day. Wear an N95 mask and take breaks.",
    heat: "Heat stress for much of the day. Work early or late and drink water often.",
    rain: "Rain for much of the day.",
  }
  if (run && run.hours >= 6) {
    const window = formatHourRange(run.start, run.end)
    return {
      verdict: "good",
      label: window,
      window,
      score: run.hours,
      reason: issue ? outside[issue] : "Comfortable conditions for outdoor work all day.",
    }
  }
  if (run && run.hours >= 2) {
    const window = formatHourRange(run.start, run.end)
    return { verdict: "fair", label: window, window, score: run.hours, reason: issue ? blocked[issue] : "Only part of the day is comfortable." }
  }
  if (issue) return { verdict: "avoid", label: "Limit work", reason: blocked[issue] }
  return { verdict: "avoid", label: "Limit work", reason: issue || "Conditions are poor for outdoor work all day." }
}

function harvestFor(
  crop: Crop,
  all: WeatherHour[],
  indices: number[],
  today: DayWeather,
  tomorrow: DayWeather | null,
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
    return { verdict: "avoid", label: "Rain", reason: picked ? "Rain today would wet open bolls." : "Rain today would wet the cut crop." }
  }
  if (run && run.hours >= 5 && nextRain < 2) {
    const window = formatHourRange(run.start, run.end)
    return {
      verdict: "good",
      label: window,
      window,
      score: run.hours,
      reason: picked
        ? "Dry: pick once the dew has lifted so the lint stays clean."
        : "Dry, with no rain due tomorrow, so the cut crop can dry in the field.",
    }
  }
  if (run && run.hours >= 3) {
    const window = formatHourRange(run.start, run.end)
    return {
      verdict: "fair",
      label: window,
      window,
      score: run.hours,
      reason:
        nextRain >= 2
          ? picked
            ? "Dry today, but rain tomorrow. Pick open bolls today."
            : "Dry today, but rain tomorrow. Cut only what you can bring in and cover."
          : "Humid. Produce will dry slowly; dry it fully before storing.",
    }
  }
  return { verdict: "avoid", label: "Too humid", reason: "Humid or showery all day. The crop will stay damp." }
}

function fertiliseFor(
  stage: Stage | null,
  day: DayWeather,
  next: DayWeather | null,
  heavyToday: number | null,
  heavyNext: number | null,
  irrigating: boolean,
  crop: Crop,
): DayActivity {
  if (!stage?.nitrogen) return { verdict: "none", label: "Not due", reason: "No nitrogen dose is due at this stage." }
  const nextRain = next?.rain ?? 0
  if ((heavyToday ?? 0) >= 0.1 || (heavyNext ?? 0) >= 0.1) {
    return { verdict: "avoid", label: "Heavy rain", reason: "Heavy rain is possible within two days and would wash fertiliser off the field." }
  }
  if (day.rain >= 15 || nextRain >= 20) {
    return {
      verdict: "avoid",
      label: "Rain due",
      reason: `About ${Math.round(Math.max(day.rain, nextRain))} mm of rain in a day would carry fertiliser off the field.`,
    }
  }
  if ((day.soilTop ?? 0) >= WATERLOGGED && crop.id !== "rice") {
    return { verdict: "avoid", label: "Too wet", reason: "The field is waterlogged. Nitrogen is lost from saturated soil." }
  }
  if (crop.id === "rice") {
    return { verdict: "good", label: "Good", reason: "Lower standing water to a thin layer, broadcast, and do not drain for two days." }
  }
  const lightRain = day.rain + nextRain >= 2 && day.rain + nextRain < 15
  if (irrigating || lightRain || (day.soilTop ?? 0) >= 0.22) {
    return {
      verdict: "good",
      label: "Good",
      reason: irrigating
        ? "Apply just before today's irrigation so it soaks in."
        : lightRain
          ? "Light rain is due to wash it into the soil, with no heavy rain to wash it away."
          : "Soil is moist and no heavy rain is due for two days.",
    }
  }
  return { verdict: "fair", label: "Dry soil", reason: "Soil is dry. Apply just before you irrigate so it is not lost to the air." }
}

function sowFor(crop: Crop, date: string, day: DayWeather, next: DayWeather | null, heavyNext: number | null): DayActivity {
  const month = parseIso(date).month
  const [low, high] = crop.sowTemp
  const temp = day.tMean
  const inSeason = crop.sowMonths.includes(month)
  const nextRain = (next?.rain ?? 0) + day.rain
  if ((day.soilTop ?? 0) >= WATERLOGGED && crop.id !== "rice") {
    return { verdict: "avoid", label: "Too wet", reason: "The field is waterlogged. Seed will rot and the soil will crust." }
  }
  if (nextRain >= 25 || (heavyNext ?? 0) >= 0.1) {
    return { verdict: "avoid", label: "Heavy rain", reason: "Heavy rain right after sowing washes seed out and crusts the soil." }
  }
  if (temp != null && (temp < low - 2 || temp > high + 2)) {
    return {
      verdict: "avoid",
      label: temp < low ? "Too cold" : "Too hot",
      reason: `Average temperature about ${Math.round(temp)} °C. ${crop.name} germinates best between ${low} and ${high} °C.`,
    }
  }
  const notes: string[] = []
  if (!inSeason) notes.push(`This is outside the usual ${crop.startLabel} months for ${crop.name.toLowerCase()}.`)
  if (temp != null && (temp < low || temp > high)) notes.push(`Temperature is just outside the best range (${low}–${high} °C).`)
  if (crop.id === "rice") {
    if (nextRain < 5 && (day.soilTop ?? 0) < 0.3) notes.push("Puddle the field with standing water before transplanting.")
  } else if ((day.soilTop ?? 1) < DRY_TOPSOIL) {
    notes.push("Topsoil is dry. Give a pre-sowing irrigation and sow when the soil is workable.")
  }
  const score = temp == null ? 0 : -Math.abs(temp - (low + high) / 2)
  if (notes.length) return { verdict: "fair", label: "Possible", reason: notes.join(" "), score }
  return {
    verdict: "good",
    label: "Good",
    reason: `Temperature suits ${crop.name.toLowerCase()}, soil is workable, and no heavy rain is due.`,
    score,
  }
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

export function spanLabel(dates: string[]): string {
  if (dates.length === 1) return dayName(dates[0])
  return `${dayName(dates[0])} – ${dayName(dates[dates.length - 1])}`
}

export function wetHours(hours: WeatherHour[], tMin: number, tMax: number, rh = 90): number {
  return hours.filter((hour) => {
    if (hour.temp == null || hour.temp < tMin || hour.temp > tMax) return false
    return (hour.rh ?? 0) >= rh || (hour.rain ?? 0) >= 0.2
  }).length
}

export function buildPlan(input: PlanInput): FarmPlan {
  const { point, crop, sownOn, today } = input
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
      irrigate = { verdict: "none", label: "Stop", reason: "Stop irrigating so the crop dries down for harvest." }
    } else if ((weather.soilTop ?? 0) >= WATERLOGGED || weather.rain >= 20) {
      irrigate = { verdict: "avoid", label: "Too wet", reason: "Soil is saturated. Open drains instead." }
    } else if (growing && stage?.coldMin != null && next?.tMin != null && next.tMin <= stage.coldMin) {
      irrigate = { verdict: "good", label: "Evening", reason: `Frost risk tonight (${Math.round(next.tMin)} °C). A light irrigation this evening keeps the crop warmer.` }
    } else if (deficit >= threshold) {
      irrigate =
        rainSoon >= 10
          ? { verdict: "avoid", label: "Wait for rain", reason: `About ${Math.round(rainSoon)} mm of rain is due within two days.` }
          : {
              verdict: "good",
              label: "Irrigate",
              reason: ponded
                ? "Standing water will have dropped by about 3 cm. Top up to 5 cm."
                : stage?.irrigation === "critical"
                  ? `Root-zone water is running low at a stage that is sensitive to stress (about ${Math.round(deficit)} mm used).`
                  : `Root-zone water is running low (about ${Math.round(deficit)} mm used).`,
            }
    } else if (growing && stage?.heatMax != null && next?.tMax != null && next.tMax >= stage.heatMax && rainSoon < 5) {
      irrigate = { verdict: "fair", label: "Before heat", reason: `Hot day tomorrow (${Math.round(next.tMax)} °C). Irrigating today helps the crop cope.` }
    } else if (deficit >= threshold * 0.75 && rainSoon < 10) {
      irrigate = { verdict: "fair", label: "Soon", reason: `Soil water is getting low (about ${Math.round(deficit)} mm used).` }
    } else {
      irrigate = { verdict: "none", label: "Not needed", reason: weather.rain >= 5 ? "Rain is doing the job." : "Soil still has enough water." }
    }
    if (stage?.irrigation === "light" && irrigate.verdict === "good" && !irrigate.label.startsWith("Evening")) {
      irrigate = { ...irrigate, reason: `${irrigate.reason} Keep it light at this stage.` }
    }
    if (!growing && irrigate.verdict === "good") {
      irrigate = { ...irrigate, label: "Pre-sowing", reason: "Soil is dry. A pre-sowing irrigation gives a moist seed bed." }
    }
    activities.irrigate = irrigate
    if (irrigate.verdict === "good" && !irrigate.label.startsWith("Evening")) deficit = 0
    deficit = Math.min(totalWater * (ponded ? 2 : 1), Math.max(0, deficit + etc + (ponded ? RICE_PERCOLATION_MM : 0) - effectiveRain))

    if (!growing) {
      activities.sow = sowFor(crop, date, weather, next, heavy(addDays(date, 1)))
    } else {
      activities.spray =
        stage?.irrigation === "stop"
          ? { verdict: "none", label: "Not needed", reason: "Spraying this close to harvest rarely pays and can leave residues." }
          : sprayFor(all, indices)
      activities.fertilise = fertiliseFor(stage, weather, next, heavy(date), heavy(addDays(date, 1)), irrigate.verdict === "good", crop)
      if (stage?.harvest) activities.harvest = harvestFor(crop, all, indices, weather, next)
    }
    activities.fieldwork = fieldworkFor(all, indices, airByTime)

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
        text: none ? (activity === "irrigate" ? "Not needed this week" : "Not due this week") : "No suitable day this week",
        reason: sample?.reason ?? "",
      }
    }
    const item = pick.activities[activity]!
    return {
      activity,
      date: pick.date,
      window: item.window,
      verdict: item.verdict,
      text: item.window ? `${dayName(pick.date)}, ${item.window}` : dayName(pick.date),
      reason: item.reason,
    }
  })

  const alerts = buildAlerts(crop, days, point)
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
  plan.insights = buildInsights(plan, point)
  return plan
}

function buildAlerts(crop: Crop, days: DayPlan[], point: FarmPoint): FarmAlert[] {
  const alerts: FarmAlert[] = []
  const hoursOf = (date: string) => point.weather.filter((hour) => hour.time.startsWith(date))

  const heatDays = days.filter((day) => day.stage?.heatMax != null && (day.weather.tMax ?? -99) >= day.stage.heatMax)
  for (const group of groupDates(heatDays.map((day) => day.date))) {
    const peak = Math.max(...group.map((date) => days.find((day) => day.date === date)!.weather.tMax ?? 0))
    const stage = days.find((day) => day.date === group[0])!.stage!
    alerts.push({
      kind: "heat",
      severity: peak >= (stage.heatMax ?? 0) + 2 ? "warning" : "watch",
      dates: group,
      title: `Heat stress at ${stage.name.toLowerCase()}`,
      detail: `Up to ${Math.round(peak)} °C, above the ${stage.heatMax} °C that ${crop.name.toLowerCase()} tolerates at this stage. Irrigate the evening before if the soil is dry.`,
    })
  }

  const coldDays = days.filter((day) => day.stage?.coldMin != null && (day.weather.tMin ?? 99) <= day.stage.coldMin)
  for (const group of groupDates(coldDays.map((day) => day.date))) {
    const low = Math.min(...group.map((date) => days.find((day) => day.date === date)!.weather.tMin ?? 99))
    alerts.push({
      kind: "cold",
      severity: low <= 0 ? "warning" : "watch",
      dates: group,
      title: "Frost risk",
      detail: `Night temperature down to ${Math.round(low)} °C. Irrigate lightly in the evening; moist soil holds heat through the night. Cover nurseries with straw or sheeting.`,
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
        title: `${disease.name} weather`,
        detail: `${group.length >= 2 ? "Several" : "A"} humid day${group.length >= 2 ? "s" : ""} at ${disease.tMin}–${disease.tMax} °C favour${group.length >= 2 ? "" : "s"} ${disease.name.toLowerCase()}. ${disease.scout}`,
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
      title: "Strong wind can flatten the crop",
      detail: `Gusts up to ${Math.round(gust)} km/h. Do not irrigate just before the wind; wet soil makes lodging worse.`,
    })
  }

  const wet = days.filter((day) => (day.heavyChance ?? 0) >= 0.1 || day.weather.rain >= 64.5)
  for (const group of groupDates(wet.map((day) => day.date))) {
    const chance = Math.max(...group.map((date) => days.find((day) => day.date === date)!.heavyChance ?? 0))
    alerts.push({
      kind: "rain",
      severity: chance >= 0.25 ? "warning" : "watch",
      dates: group,
      title: "Heavy rain possible",
      detail: `${chance > 0 ? `About ${Math.round(chance * 10)} in 10 ensemble runs show 65 mm or more in a day. ` : ""}Clear field drains and keep harvested produce covered.`,
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
      title: `${worst.aqi!.category} air quality`,
      detail: `Estimated AQI ${worst.aqi!.value}, mostly from ${worst.aqi!.dominant}. Field workers should wear N95 masks for long shifts, and older people and children should limit hard outdoor work.`,
    })
  }

  if (crop.ozone !== "low") {
    const ozoneDays = days.filter((day) => ozoneStress(day.air?.aot40 ?? null) === "high")
    for (const group of groupDates(ozoneDays.map((day) => day.date))) {
      alerts.push({
        kind: "ozone",
        severity: "watch",
        dates: group,
        title: "High afternoon ozone",
        detail: `Ground-level ozone enters leaves and slows growth. ${crop.name} is ${crop.ozone === "high" ? "among the more sensitive crops" : "moderately sensitive"}. There is no field treatment; it is context for yield, not a reason to change today's work.`,
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

function buildInsights(plan: FarmPlan, point: FarmPoint): string[] {
  const insights: string[] = []
  const { crop, stageToday, dasToday, days } = plan
  const pick = (id: ActivityId) => plan.best.find((item) => item.activity === id)

  if (stageToday && dasToday != null) {
    insights.push(
      `Your ${crop.name.toLowerCase()} is at ${stageToday.name.toLowerCase()}, day ${dasToday} after ${crop.startLabel}. ${stageToday.focus}`,
    )
  } else if (plan.sownOn && dasToday != null && dasToday < 0) {
    insights.push(`${crop.startLabel[0].toUpperCase()}${crop.startLabel.slice(1)} is planned for ${dayName(plan.sownOn)}.`)
  } else {
    const sow = pick("sow")
    if (sow?.date) {
      insights.push(
        sow.verdict === "good"
          ? `Best day to sow ${crop.name.toLowerCase()} this week: ${dayName(sow.date)}. ${sow.reason}`
          : `${dayName(sow.date)} is the best of a mixed week for sowing. ${sow.reason}`,
      )
    } else if (sow) {
      insights.push(`No good sowing day this week. ${sow.reason}`)
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
    const when = disease.dates[0] === days[0]?.date ? `through ${spanLabel(disease.dates).split(" – ").pop()}` : `from ${dayName(disease.dates[0])}`
    insights.push(
      window
        ? `${disease.title} ${when}. Scout the field first; if it needs a spray, the earliest usable window is ${dayName(window.date)}, ${window.activities.spray!.window}.`
        : `${disease.title} ${when}. Scout the field; there is no clean spray window in that spell.`,
    )
  } else if (spray?.date) {
    insights.push(`Best spray window: ${spray.text}. ${spray.reason}`)
  }

  const fertilise = pick("fertilise")
  if (fertilise?.date && stageToday?.nitrogen) {
    insights.push(`${stageToday.nitrogen} Best day: ${dayName(fertilise.date)}. ${fertilise.reason}`)
  } else if (plan.nextStage?.stage.nitrogen && plan.nextStage.date <= days[days.length - 1]?.date) {
    insights.push(`Nitrogen will be due from ${dayName(plan.nextStage.date)}, when the crop reaches ${plan.nextStage.stage.name.toLowerCase()}.`)
  }

  const irrigate = pick("irrigate")
  if (irrigate?.date && irrigate.verdict !== "none") {
    insights.push(`Irrigation: ${irrigate.text}. ${irrigate.reason}`)
  } else if (irrigate && stageToday?.irrigation !== "stop") {
    insights.push("No irrigation needed this week on current soil moisture and forecast rain.")
  }

  const harvest = pick("harvest")
  if (harvest) {
    insights.push(harvest.date ? `Best harvest day: ${harvest.text}. ${harvest.reason}` : `Harvest: ${harvest.text.toLowerCase()}. ${harvest.reason}`)
  }

  if (plan.nextStage && plan.nextStage.date > (days[days.length - 1]?.date ?? "") && stageToday) {
    insights.push(`Next stage, ${plan.nextStage.stage.name.toLowerCase()}, starts about ${dayName(plan.nextStage.date)}.`)
  }

  const worst = plan.air.worst
  if (worst?.aqi && worst.aqi.value > 200) {
    const month = parseIso(worst.date).month
    const burningBelt = ["northwest", "gangetic"].includes(point.regionId) && (month === 10 || month === 11)
    insights.push(
      `Air quality reaches ${worst.aqi.category.toLowerCase()} on ${dayName(worst.date)} (PM2.5 about ${Math.round(worst.pm25 ?? 0)} µg/m³).${
        burningBelt
          ? " Smoke from paddy residue burning adds to this every October and November. Mulching straw with a Happy Seeder or Super Seeder, or treating it with the PUSA decomposer, avoids burning."
          : ""
      }`,
    )
  }
  const hazy = days.filter((day) => (day.air?.aod ?? 0) >= 1)
  if (hazy.length >= 2) {
    insights.push(`Thick haze on ${hazy.length} days cuts the sunlight reaching the crop and slows drying of harvested produce.`)
  }

  return insights
}
