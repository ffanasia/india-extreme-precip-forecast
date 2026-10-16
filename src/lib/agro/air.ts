import type { AirHour, AqiCategory, DayAir } from "./types"

type Breakpoint = [low: number, high: number, aqiLow: number, aqiHigh: number]

/** CPCB National AQI breakpoints for 24-hour means, µg/m³. */
const PM25: Breakpoint[] = [
  [0, 30, 0, 50],
  [30, 60, 51, 100],
  [60, 90, 101, 200],
  [90, 120, 201, 300],
  [120, 250, 301, 400],
  [250, 500, 401, 500],
]
const PM10: Breakpoint[] = [
  [0, 50, 0, 50],
  [50, 100, 51, 100],
  [100, 250, 101, 200],
  [250, 350, 201, 300],
  [350, 430, 301, 400],
  [430, 800, 401, 500],
]
export function subIndex(value: number, table: Breakpoint[]): number {
  for (const [low, high, aqiLow, aqiHigh] of table) {
    if (value <= high) {
      return Math.round(aqiLow + ((Math.max(value, low) - low) * (aqiHigh - aqiLow)) / (high - low))
    }
  }
  return 500
}

export function aqiCategory(value: number): AqiCategory {
  if (value <= 50) return "Good"
  if (value <= 100) return "Satisfactory"
  if (value <= 200) return "Moderate"
  if (value <= 300) return "Poor"
  if (value <= 400) return "Very poor"
  return "Severe"
}

export const AQI_COLOR: Record<AqiCategory, string> = {
  Good: "#5fa36a",
  Satisfactory: "#a3c45a",
  Moderate: "#e3c34a",
  Poor: "#e08a3c",
  "Very poor": "#e24a2e",
  Severe: "#9c2a1e",
}

/** Ozone µg/m³ to ppb at 25 °C and 1 atm. */
export function ozonePpb(microgramsPerCubicMetre: number): number {
  return microgramsPerCubicMetre / 1.96
}

/**
 * Daily share of AOT40: the sum over daylight hours (08:00–19:59) of ozone above 40 ppb.
 * The UNECE critical level for wheat yield is 3000 ppb·h over three months, about 33 ppb·h a day.
 */
export function dailyAot40(hours: AirHour[]): number | null {
  const daylight = hours.filter((hour) => {
    const h = Number(hour.time.slice(11, 13))
    return h >= 8 && h < 20 && hour.o3 != null
  })
  if (daylight.length < 8) return null
  return daylight.reduce((sum, hour) => sum + Math.max(0, ozonePpb(hour.o3 as number) - 40), 0)
}

export function maxRolling(values: (number | null)[], window: number): number | null {
  let best: number | null = null
  for (let start = 0; start + window <= values.length; start++) {
    const slice = values.slice(start, start + window)
    if (slice.some((value) => value == null)) continue
    const average = (slice as number[]).reduce((sum, value) => sum + value, 0) / window
    if (best == null || average > best) best = average
  }
  return best
}

function meanOf(values: (number | null)[]): number | null {
  const ready = values.filter((value): value is number => value != null)
  return ready.length ? ready.reduce((sum, value) => sum + value, 0) / ready.length : null
}

/**
 * AQI from particles only. CAMS global surface ozone runs well above station readings over India,
 * so an ozone sub-index would dominate almost everywhere; ozone is reported separately as crop stress.
 */
export function particleAqi(
  pm25: number | null,
  pm10: number | null,
): { value: number; dominant: "PM2.5" | "PM10" } | null {
  const parts: { dominant: "PM2.5" | "PM10"; value: number }[] = []
  if (pm25 != null) parts.push({ dominant: "PM2.5", value: subIndex(pm25, PM25) })
  if (pm10 != null) parts.push({ dominant: "PM10", value: subIndex(pm10, PM10) })
  return parts.sort((a, b) => b.value - a.value)[0] ?? null
}
export function summariseAirDay(date: string, hours: AirHour[]): DayAir | null {
  const day = hours.filter((hour) => hour.time.startsWith(date))
  const valid = day.filter((hour) => hour.pm25 != null)
  if (valid.length < 16) return null
  const pm25 = meanOf(day.map((hour) => hour.pm25))
  const pm10 = meanOf(day.map((hour) => hour.pm10))
  const o3Max8h = maxRolling(day.map((hour) => hour.o3), 8)
  const top = particleAqi(pm25, pm10)
  return {
    date,
    hours: valid.length,
    pm25,
    pm10,
    o3Max8h,
    aot40: dailyAot40(day),
    aod: meanOf(day.map((hour) => hour.aod)),
    dustMax: day.reduce<number | null>((max, hour) => (hour.dust == null ? max : Math.max(max ?? 0, hour.dust)), null),
    aqi: top ? { value: top.value, category: aqiCategory(top.value), dominant: top.dominant } : null,
  }
}

export function airDates(hours: AirHour[]): string[] {
  return [...new Set(hours.map((hour) => hour.time.slice(0, 10)))]
}

export type OzoneStress = "low" | "moderate" | "high"

/**
 * Bands are set well above the ~33 ppb·h/day critical-level rate because CAMS overestimates
 * surface ozone over India; "high" should still mean high after a sizeable bias.
 */
export function ozoneStress(aot40: number | null): OzoneStress | null {
  if (aot40 == null) return null
  if (aot40 < 150) return "low"
  if (aot40 < 400) return "moderate"
  return "high"
}
