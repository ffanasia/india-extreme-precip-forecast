export type PowerPayload = {
  properties?: { parameter?: { PRECTOTCORR?: Record<string, number> } }
  header?: { sources?: string[]; fill_value?: number }
}

export function parsePower(payload: PowerPayload): { date: string; mm: number }[] {
  const series = payload.properties?.parameter?.PRECTOTCORR ?? {}
  return Object.entries(series)
    .filter(([, value]) => typeof value === "number" && value > -900)
    .map(([stamp, value]) => ({
      date: `${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)}`,
      mm: Math.round(value * 100) / 100,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

export function powerUrl(lat: number, lon: number, start: string, end: string): string {
  const query = new URLSearchParams({
    parameters: "PRECTOTCORR",
    community: "RE",
    longitude: String(lon),
    latitude: String(lat),
    start: start.replaceAll("-", ""),
    end: end.replaceAll("-", ""),
    format: "JSON",
  })
  return `https://power.larc.nasa.gov/api/temporal/daily/point?${query}`
}

export const SATELLITE_PRODUCT =
  "NASA POWER PRECTOTCORR from GEOS-IT, a satellite- and gauge-informed precipitation analysis"

export function antecedentOf(
  days: { date: string; mm: number }[],
  threeDayP95: number,
): {
  latest: { date: string; mm: number } | null
  threeDayMm: number | null
  threeDayDates: string[]
  antecedent: "dry" | "wet" | "extreme"
} {
  if (days.length === 0) {
    return { latest: null, threeDayMm: null, threeDayDates: [], antecedent: "dry" }
  }
  const recent = days.slice(-3)
  const threeDayMm = recent.reduce((sum, day) => sum + day.mm, 0)
  const latest = days[days.length - 1]
  let antecedent: "dry" | "wet" | "extreme" = "dry"
  if (recent.some((day) => day.mm >= 64.5)) antecedent = "extreme"
  else if (threeDayMm >= threeDayP95) antecedent = "wet"
  return {
    latest,
    threeDayMm,
    threeDayDates: recent.map((day) => day.date),
    antecedent,
  }
}
