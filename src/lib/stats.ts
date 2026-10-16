import { addDays, isLeapYear } from "./dates"

export function mean(values: number[]): number {
  if (values.length === 0) return Number.NaN
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

export function quantile(values: number[], probability: number): number {
  if (values.length === 0) return Number.NaN
  const sorted = [...values].sort((a, b) => a - b)
  if (sorted.length === 1) return sorted[0]
  const index = (sorted.length - 1) * probability
  const lower = Math.floor(index)
  const upper = Math.ceil(index)
  if (lower === upper) return sorted[lower]
  const weight = index - lower
  return sorted[lower] * (1 - weight) + sorted[upper] * weight
}

export function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

export function percentChange(future: number, historical: number): number | null {
  if (!Number.isFinite(future) || !Number.isFinite(historical)) return null
  if (historical === 0) return future === 0 ? 0 : null
  return ((future - historical) / historical) * 100
}

export function finite(values: (number | null | undefined)[]): number[] {
  return values.filter((value): value is number => value != null && Number.isFinite(value))
}

export type Category = "quiet" | "watch" | "likely" | "high" | "severe" | "unavailable"
export type Confidence = "quiet" | "low" | "moderate" | "high"

export function categoryFor(probability: number | null): Category {
  if (probability == null || !Number.isFinite(probability)) return "unavailable"
  if (probability < 0.1) return "quiet"
  if (probability < 0.25) return "watch"
  if (probability < 0.45) return "likely"
  if (probability < 0.7) return "high"
  return "severe"
}

export function confidenceFor(modelProbabilities: number[], blended: number | null): Confidence {
  if (blended == null || !Number.isFinite(blended) || blended < 0.1) return "quiet"
  if (modelProbabilities.length < 2) return blended >= 0.25 ? "moderate" : "low"
  const gap = Math.abs(modelProbabilities[0] - modelProbabilities[1])
  if (blended >= 0.25 && gap <= 0.2) return "high"
  if (gap >= 0.35) return "low"
  if (blended >= 0.15) return "moderate"
  return "low"
}

export function anyDayExceedance(members: (number | null)[][], threshold: number): number | null {
  let used = 0
  let hits = 0
  for (const series of members) {
    if (series.length === 0 || series.some((value) => value == null || !Number.isFinite(value))) continue
    used += 1
    if (series.some((value) => (value as number) >= threshold)) hits += 1
  }
  if (used === 0) return null
  return hits / used
}

export function dailyExceedance(
  members: (number | null)[][],
  dayIndex: number,
  threshold: number,
): number | null {
  const values = finite(members.map((member) => member[dayIndex]))
  if (values.length === 0) return null
  return values.filter((value) => value >= threshold).length / values.length
}

export function dayQuantiles(
  members: (number | null)[][],
  dayIndex: number,
): { p10: number; p50: number; p90: number; mean: number } | null {
  const values = finite(members.map((member) => member[dayIndex]))
  if (values.length === 0) return null
  return {
    p10: quantile(values, 0.1),
    p50: quantile(values, 0.5),
    p90: quantile(values, 0.9),
    mean: mean(values),
  }
}

export function blendProbabilities(probabilities: (number | null)[]): number | null {
  const ready = probabilities.filter((value): value is number => value != null && Number.isFinite(value))
  if (ready.length === 0) return null
  return mean(ready)
}

export function wetDayPercentile(
  values: (number | null)[],
  probability: number,
  wetMinimum = 1,
): number | null {
  const wet = values.filter((value): value is number => value != null && value >= wetMinimum)
  if (wet.length === 0) return null
  return quantile(wet, probability)
}

export function rollingSums(values: (number | null)[], window: number): number[] {
  const sums: number[] = []
  for (let index = 0; index <= values.length - window; index++) {
    let sum = 0
    let complete = true
    for (let offset = 0; offset < window; offset++) {
      const value = values[index + offset]
      if (value == null || !Number.isFinite(value)) {
        complete = false
        break
      }
      sum += value
    }
    if (complete) sums.push(sum)
  }
  return sums
}

export type SeasonName = "jjas" | "ond"

export function inSeason(iso: string, season: SeasonName): boolean {
  const month = Number(iso.slice(5, 7))
  if (season === "jjas") return month >= 6 && month <= 9
  return month >= 10 && month <= 12
}

export type SeasonStats = {
  years: number
  meanTotal: number
  meanRx1day: number
  meanHeavyDays: number
  meanVeryHeavyDays: number
}

export function seasonalStats(
  dates: string[],
  values: (number | null)[],
  season: SeasonName,
  heavy = 64.5,
  veryHeavy = 115.6,
): SeasonStats | null {
  const minimumDays = season === "jjas" ? 110 : 85
  const years = new Map<number, { sum: number; max: number; heavy: number; veryHeavy: number; days: number }>()
  for (let index = 0; index < dates.length; index++) {
    if (!inSeason(dates[index], season)) continue
    const value = values[index]
    if (value == null || !Number.isFinite(value)) continue
    const year = Number(dates[index].slice(0, 4))
    const row = years.get(year) ?? { sum: 0, max: 0, heavy: 0, veryHeavy: 0, days: 0 }
    row.sum += value
    row.max = Math.max(row.max, value)
    row.days += 1
    if (value >= heavy) row.heavy += 1
    if (value >= veryHeavy) row.veryHeavy += 1
    years.set(year, row)
  }
  const rows = [...years.values()].filter((row) => row.days >= minimumDays)
  if (rows.length === 0) return null
  return {
    years: rows.length,
    meanTotal: mean(rows.map((row) => row.sum)),
    meanRx1day: mean(rows.map((row) => row.max)),
    meanHeavyDays: mean(rows.map((row) => row.heavy)),
    meanVeryHeavyDays: mean(rows.map((row) => row.veryHeavy)),
  }
}

function windowDatesForYear(year: number, startMonthDay: string, days: number): string[] | null {
  if (startMonthDay === "02-29" && !isLeapYear(year)) return null
  const start = `${year}-${startMonthDay}`
  return Array.from({ length: days }, (_, index) => addDays(start, index))
}

export function indexByDate(dates: string[], values: (number | null)[]): Map<string, number | null> {
  const map = new Map<string, number | null>()
  dates.forEach((date, index) => map.set(date, values[index] ?? null))
  return map
}

export function windowExceedance(
  byDate: Map<string, number | null>,
  forecastDates: string[],
  threshold: number,
  firstYear: number,
  lastYear: number,
): { hits: number; years: number } {
  if (forecastDates.length === 0) return { hits: 0, years: 0 }
  const startMonthDay = forecastDates[0].slice(5)
  let hits = 0
  let years = 0
  for (let year = firstYear; year <= lastYear; year++) {
    const windowDates = windowDatesForYear(year, startMonthDay, forecastDates.length)
    if (!windowDates) continue
    const series: number[] = []
    let complete = true
    for (const date of windowDates) {
      if (!byDate.has(date)) {
        complete = false
        break
      }
      const value = byDate.get(date)
      if (value == null || !Number.isFinite(value)) {
        complete = false
        break
      }
      series.push(value)
    }
    if (!complete) continue
    years += 1
    if (Math.max(...series) >= threshold) hits += 1
  }
  return { hits, years }
}

export function findAnalog(
  byDate: Map<string, number | null>,
  forecastDates: string[],
  median: number[],
  firstYear: number,
  lastYear: number,
): { year: number; rmse: number; peakMm: number; windowMm: number } | null {
  if (forecastDates.length === 0 || median.length !== forecastDates.length) return null
  const startMonthDay = forecastDates[0].slice(5)
  let best: { year: number; rmse: number; peakMm: number; windowMm: number } | null = null
  for (let year = firstYear; year <= lastYear; year++) {
    const windowDates = windowDatesForYear(year, startMonthDay, forecastDates.length)
    if (!windowDates) continue
    const series: number[] = []
    let complete = true
    for (const date of windowDates) {
      const value = byDate.get(date)
      if (value == null || !Number.isFinite(value)) {
        complete = false
        break
      }
      series.push(value)
    }
    if (!complete) continue
    const squared = series.reduce((sum, value, index) => sum + (value - median[index]) ** 2, 0)
    const rmse = Math.sqrt(squared / series.length)
    const peakMm = Math.max(...series)
    const windowMm = series.reduce((sum, value) => sum + value, 0)
    if (
      !best ||
      rmse < best.rmse - 1e-9 ||
      (Math.abs(rmse - best.rmse) <= 1e-9 && year > best.year)
    ) {
      best = { year, rmse, peakMm, windowMm }
    }
  }
  return best
}

export function countAtLeast(values: (number | null)[], threshold: number): number {
  return values.filter((value) => value != null && value >= threshold).length
}
