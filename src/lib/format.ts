import type { Category, Confidence } from "./stats"

export function formatPercent(probability: number | null): string {
  if (probability == null || !Number.isFinite(probability)) return "—"
  const percent = probability * 100
  if (percent === 0) return "0%"
  if (percent < 0.1) return "<0.1%"
  if (percent < 10) return `${percent.toFixed(1)}%`
  return `${Math.round(percent)}%`
}

export function formatMm(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—"
  if (Math.abs(value) >= 100) return `${Math.round(value)} mm`
  return `${value.toFixed(1)} mm`
}

export function formatSignedPercent(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—"
  const rounded = Math.abs(value) >= 10 ? Math.round(value) : Math.round(value * 10) / 10
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
  return `${rounded > 0 ? "+" : ""}${text}%`
}

export const CATEGORY_LABEL: Record<Category, string> = {
  quiet: "Quiet",
  watch: "Watch",
  likely: "Likely",
  high: "High",
  severe: "Severe",
  unavailable: "No ensemble",
}

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  quiet: "Quiet",
  low: "Low agreement",
  moderate: "Partial agreement",
  high: "Models agree",
}

export function categoryColor(category: Category): string {
  switch (category) {
    case "watch":
      return "#d6b25e"
    case "likely":
      return "#e08a3c"
    case "high":
      return "#e24a2e"
    case "severe":
      return "#f4efe4"
    case "unavailable":
      return "#5c564c"
    default:
      return "#8d8678"
  }
}

export function climateColor(percent: number | null): string {
  if (percent == null || !Number.isFinite(percent)) return "#5c564c"
  if (percent < 0) return mix("#8a8478", "#8c5e3c", Math.min(1, percent / -40))
  if (percent < 25) return mix("#8a8478", "#e3a008", percent / 25)
  if (percent < 60) return mix("#e3a008", "#e08a3c", (percent - 25) / 35)
  return mix("#e08a3c", "#e24a2e", Math.min(1, (percent - 60) / 40))
}

function mix(from: string, to: string, amount: number): string {
  const start = hex(from)
  const end = hex(to)
  const channel = (index: number) => Math.round(start[index] + (end[index] - start[index]) * amount)
  return `rgb(${channel(0)} ${channel(1)} ${channel(2)})`
}

function hex(value: string): [number, number, number] {
  const raw = value.slice(1)
  return [parseInt(raw.slice(0, 2), 16), parseInt(raw.slice(2, 4), 16), parseInt(raw.slice(4, 6), 16)]
}
