"use client"

import { AlertTriangle, CloudRain, Droplets, Flame, Leaf, Snowflake, SprayCan, Sprout, Sun, Wheat, Wind } from "lucide-react"
import type { ReactNode } from "react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { addDays, formatDay, formatWeekday } from "@/lib/dates"
import { AQI_COLOR, ozoneStress } from "@/lib/agro/air"
import {
  ACTIVITY_LABEL,
  dayName,
  spanLabel,
  type ActivityId,
  type AlertKind,
  type DayPlan,
  type FarmPlan,
  type Verdict,
} from "@/lib/agro/advisor"
import type { AirOverview, DayAir } from "@/lib/agro/types"

export const VERDICT_COLOR: Record<Verdict, string> = {
  good: "#5fa36a",
  fair: "#d6b25e",
  avoid: "#e24a2e",
  none: "#5c564c",
}

const VERDICT_WORD: Record<Verdict, string> = {
  good: "Good",
  fair: "Possible",
  avoid: "Avoid",
  none: "—",
}

export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-baseline justify-between gap-2">
        <CardTitle className="text-lg">{title}</CardTitle>
        {action}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

export function Insights({ plan }: { plan: FarmPlan }) {
  return (
    <ul className="space-y-3">
      {plan.insights.map((item) => (
        <li key={item} className="flex gap-3 text-base leading-7">
          <span className="mt-2.5 inline-block size-1.5 shrink-0 rounded-full bg-saffron" />
          {item}
        </li>
      ))}
    </ul>
  )
}

export function StageTimeline({ plan, today }: { plan: FarmPlan; today: string }) {
  const { crop, dasToday } = plan
  const total = crop.stages[crop.stages.length - 1].to + 1
  const windowEnd = plan.days[plan.days.length - 1]?.das ?? null
  return (
    <div>
      <div className="relative flex h-9 w-full overflow-hidden rounded-lg ring-1 ring-foreground/10">
        {crop.stages.map((stage, index) => {
          const active = plan.stageToday?.id === stage.id
          return (
            <div
              key={stage.id}
              className={`flex items-center justify-center border-r border-background/60 text-[10px] leading-tight last:border-r-0 sm:text-xs ${
                active ? "bg-saffron/80 text-background" : index % 2 ? "bg-muted" : "bg-secondary"
              }`}
              style={{ width: `${((stage.to - stage.from + 1) / total) * 100}%` }}
              title={stage.name}
            >
              <span className="hidden truncate px-1 md:inline">{stage.name}</span>
            </div>
          )
        })}
        {dasToday != null && dasToday >= 0 && (
          <>
            {windowEnd != null && (
              <span
                className="absolute inset-y-0 bg-paper/15 ring-1 ring-paper/50"
                style={{
                  left: `${(Math.min(dasToday, total) / total) * 100}%`,
                  width: `${((Math.min(windowEnd, total) - Math.min(dasToday, total)) / total) * 100}%`,
                }}
              />
            )}
            <span className="absolute inset-y-0 w-0.5 bg-paper" style={{ left: `${(Math.min(dasToday, total - 1) / total) * 100}%` }} />
          </>
        )}
      </div>
      <ol className="mt-3 grid gap-1.5 text-sm sm:grid-cols-2">
        {crop.stages.map((stage) => {
          const start = plan.sownOn ? addDays(plan.sownOn, stage.from) : null
          const active = plan.stageToday?.id === stage.id
          const past = dasToday != null && dasToday > stage.to
          return (
            <li key={stage.id} className={`flex justify-between gap-3 rounded-md px-2 py-1 ${active ? "bg-accent" : ""}`}>
              <span className={past ? "text-muted-foreground line-through decoration-muted-foreground/50" : ""}>{stage.name}</span>
              <span className="shrink-0 font-mono text-xs text-muted-foreground">
                {start ? formatDay(start) : `day ${stage.from}`}
              </span>
            </li>
          )
        })}
      </ol>
      {plan.stageToday ? (
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          <span className="text-paper">Now: {plan.stageToday.name}.</span> {plan.stageToday.focus}
        </p>
      ) : (
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {plan.sownOn && plan.sownOn > today
            ? `${crop.startLabel[0].toUpperCase()}${crop.startLabel.slice(1)} is planned for ${dayName(plan.sownOn)}. Dates above follow from that.`
            : `Add your ${crop.startLabel} date to see the crop stage on each day. Until then the plan shows sowing advice.`}
        </p>
      )}
    </div>
  )
}

const ACTIVITY_ICON: Record<ActivityId, ReactNode> = {
  sow: <Sprout className="size-4" />,
  spray: <SprayCan className="size-4" />,
  fertilise: <Leaf className="size-4" />,
  irrigate: <Droplets className="size-4" />,
  harvest: <Wheat className="size-4" />,
  fieldwork: <Sun className="size-4" />,
}

export function BestDays({ plan }: { plan: FarmPlan }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {plan.best.map((item) => (
        <div key={item.activity} className="rounded-xl bg-muted/50 px-3.5 py-3" style={{ borderLeft: `4px solid ${VERDICT_COLOR[item.verdict]}` }}>
          <p className="flex items-center gap-2 text-xs tracking-[0.12em] text-muted-foreground uppercase">
            {ACTIVITY_ICON[item.activity]}
            {ACTIVITY_LABEL[item.activity]}
          </p>
          <p className="mt-1.5 text-base font-medium">{item.text}</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.reason}</p>
        </div>
      ))}
    </div>
  )
}

export function Calendar({
  plan,
  selected,
  onSelect,
}: {
  plan: FarmPlan
  selected: string | null
  onSelect: (date: string) => void
}) {
  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <table className="w-full min-w-[640px] border-separate border-spacing-1 text-sm">
        <thead>
          <tr>
            <th className="w-28 text-left text-xs font-normal text-muted-foreground" />
            {plan.days.map((day) => (
              <th key={day.date} className="p-0 font-normal">
                <button
                  type="button"
                  onClick={() => onSelect(day.date)}
                  aria-pressed={selected === day.date}
                  className={`w-full rounded-md px-1 py-1.5 text-center ${selected === day.date ? "bg-accent" : "hover:bg-muted"}`}
                >
                  <span className="block text-sm">{formatWeekday(day.date)}</span>
                  <span className="block text-xs text-muted-foreground">{formatDay(day.date)}</span>
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {plan.days.some((day) => day.stage) && (
            <tr>
              <td className="text-xs text-muted-foreground">Stage</td>
              {plan.days.map((day) => (
                <td key={day.date} className="truncate px-1 text-center text-[11px] text-muted-foreground" title={day.stage?.name}>
                  {day.stage ? shortStage(day.stage.name) : "Not sown"}
                </td>
              ))}
            </tr>
          )}
          {plan.activities.map((activity) => (
            <tr key={activity}>
              <td className="text-xs text-muted-foreground">{ACTIVITY_LABEL[activity]}</td>
              {plan.days.map((day) => {
                const item = day.activities[activity]
                const verdict = item?.verdict ?? "none"
                return (
                  <td key={day.date} className="p-0">
                    <button
                      type="button"
                      onClick={() => onSelect(day.date)}
                      title={item?.reason}
                      className="flex h-11 w-full flex-col items-center justify-center rounded-md px-1 text-center"
                      style={{ background: `${VERDICT_COLOR[verdict]}${verdict === "none" ? "33" : "40"}` }}
                    >
                      <span className="text-[11px] font-medium">{VERDICT_WORD[verdict]}</span>
                      {item?.window && verdict !== "avoid" ? (
                        <span className="text-[10px] leading-tight text-muted-foreground">{item.window}</span>
                      ) : item && verdict !== "none" && verdict !== "good" ? (
                        <span className="text-[10px] leading-tight text-muted-foreground">{item.label}</span>
                      ) : null}
                    </button>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function shortStage(name: string): string {
  return name.split(" and ")[0].replace("initiation", "init.")
}

export function DayDetail({ day }: { day: DayPlan }) {
  const w = day.weather
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-heading text-xl">{dayName(day.date)}</p>
        {day.stage && day.das != null && (
          <p className="text-sm text-muted-foreground">
            Day {day.das} · {day.stage.name}
          </p>
        )}
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
        <Stat label="Temperature" value={w.tMin != null && w.tMax != null ? `${Math.round(w.tMin)}–${Math.round(w.tMax)} °C` : "—"} />
        <Stat label="Rain" value={`${w.rain < 0.5 ? "0" : Math.round(w.rain)} mm${w.rainProbMax != null ? ` · ${Math.round(w.rainProbMax)}%` : ""}`} />
        <Stat label="Humidity" value={w.rhMean != null ? `${Math.round(w.rhMean)}%` : "—"} />
        <Stat label="Wind, gusts" value={w.windMax != null ? `${Math.round(w.windMax)}, ${Math.round(w.gustMax ?? 0)} km/h` : "—"} />
        <Stat label="Crop water use" value={`${(w.et0 * (day.stage?.kc ?? 0.3)).toFixed(1)} mm`} />
        <Stat label="Topsoil moisture" value={w.soilTop != null ? `${Math.round(w.soilTop * 100)}%` : "—"} />
        <Stat label="Air (AQI)" value={day.air?.aqi ? `${day.air.aqi.value} ${day.air.aqi.category}` : "No data"} />
        <Stat label="Heavy rain chance" value={day.heavyChance != null ? `${Math.round(day.heavyChance * 100)}%` : "—"} />
      </dl>
      <ul className="space-y-2.5">
        {(Object.keys(day.activities) as ActivityId[]).map((activity) => {
          const item = day.activities[activity]!
          return (
            <li key={activity} className="flex gap-3 text-sm leading-6">
              <span className="mt-1.5 inline-block size-2.5 shrink-0 rounded-full" style={{ background: VERDICT_COLOR[item.verdict] }} />
              <span>
                <span className="text-paper">
                  {ACTIVITY_LABEL[activity]}: {item.verdict === "none" ? item.label : VERDICT_WORD[item.verdict]}
                  {item.window && item.verdict !== "avoid" ? `, ${item.window}` : ""}.
                </span>{" "}
                <span className="text-muted-foreground">{item.reason}</span>
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] tracking-[0.1em] text-muted-foreground uppercase">{label}</dt>
      <dd className="mt-0.5">{value}</dd>
    </div>
  )
}

const ALERT_ICON: Record<AlertKind, ReactNode> = {
  heat: <Flame className="size-4" />,
  cold: <Snowflake className="size-4" />,
  disease: <Leaf className="size-4" />,
  wind: <Wind className="size-4" />,
  rain: <CloudRain className="size-4" />,
  air: <AlertTriangle className="size-4" />,
  ozone: <AlertTriangle className="size-4" />,
}

export function Alerts({ plan }: { plan: FarmPlan }) {
  if (plan.alerts.length === 0) {
    return <p className="text-sm leading-6 text-muted-foreground">No weather, disease, or air alerts for this crop this week.</p>
  }
  return (
    <ul className="space-y-3">
      {plan.alerts.map((alert) => (
        <li
          key={`${alert.kind}-${alert.title}-${alert.dates[0]}`}
          className="rounded-lg bg-muted/50 px-3 py-2.5"
          style={{ borderLeft: `4px solid ${alert.severity === "warning" ? "#e24a2e" : "#d6b25e"}` }}
        >
          <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
            {ALERT_ICON[alert.kind]}
            {alert.title}
            <span className="font-normal text-muted-foreground">· {spanLabel(alert.dates)}</span>
          </p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{alert.detail}</p>
        </li>
      ))}
    </ul>
  )
}

const OZONE_WORD = { low: "Low", moderate: "Moderate", high: "High" } as const

export function AirWeek({ days }: { days: DayPlan[] }) {
  const withAir = days.filter((day) => day.air)
  if (withAir.length === 0) {
    return <p className="text-sm text-muted-foreground">Air quality forecasts are not available for this place right now.</p>
  }
  return (
    <div className="space-y-3">
      <div className="-mx-1 overflow-x-auto px-1">
        <table className="w-full min-w-[420px] text-sm">
          <thead>
            <tr className="text-left text-[11px] tracking-[0.1em] text-muted-foreground uppercase">
              <th className="py-1 font-normal">Day</th>
              <th className="py-1 font-normal">AQI</th>
              <th className="py-1 font-normal">PM2.5</th>
              <th className="py-1 font-normal">Ozone stress</th>
              <th className="py-1 font-normal">Haze</th>
            </tr>
          </thead>
          <tbody>
            {withAir.map((day) => (
              <tr key={day.date} className="border-t border-border">
                <td className="py-1.5">{formatWeekday(day.date)} {formatDay(day.date)}</td>
                <td className="py-1.5"><AqiChip air={day.air!} /></td>
                <td className="py-1.5 font-mono text-xs">{day.air!.pm25 != null ? `${Math.round(day.air!.pm25)} µg/m³` : "—"}</td>
                <td className="py-1.5">{OZONE_WORD[ozoneStress(day.air!.aot40) ?? "low"]}</td>
                <td className="py-1.5">{hazeWord(day.air!.aod)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs leading-5 text-muted-foreground">
        From the CAMS global air-quality forecast, five days ahead. AQI follows CPCB bands for PM2.5 and PM10. Ozone stress
        uses AOT40, the daytime ozone above 40 ppb that drives crop yield loss. CAMS tends to overestimate surface ozone over
        India, so read it as higher or lower than usual rather than as a measured value.
      </p>
    </div>
  )
}

export function AqiChip({ air }: { air: DayAir }) {
  if (!air.aqi) return <span className="text-muted-foreground">—</span>
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block size-2.5 rounded-full" style={{ background: AQI_COLOR[air.aqi.category] }} />
      <span className="font-mono text-xs">{air.aqi.value}</span>
      <span className="text-xs">{air.aqi.category}</span>
    </span>
  )
}

function hazeWord(aod: number | null): string {
  if (aod == null) return "—"
  if (aod < 0.4) return "Clear"
  if (aod < 0.8) return "Light"
  if (aod < 1.2) return "Hazy"
  return "Thick"
}

export function WeatherTable({ days }: { days: DayPlan[] }) {
  const rows: { label: string; cell: (day: DayPlan) => string }[] = [
    { label: "Max / min °C", cell: (day) => `${round(day.weather.tMax)} / ${round(day.weather.tMin)}` },
    { label: "Rain mm", cell: (day) => (day.weather.rain < 0.5 ? "0" : String(Math.round(day.weather.rain))) },
    { label: "Rain chance", cell: (day) => (day.weather.rainProbMax != null ? `${Math.round(day.weather.rainProbMax)}%` : "—") },
    { label: "Heavy rain", cell: (day) => (day.heavyChance != null ? `${Math.round(day.heavyChance * 100)}%` : "—") },
    { label: "Humidity", cell: (day) => (day.weather.rhMean != null ? `${Math.round(day.weather.rhMean)}%` : "—") },
    { label: "Gusts km/h", cell: (day) => round(day.weather.gustMax) },
    { label: "Evaporation mm", cell: (day) => day.weather.et0.toFixed(1) },
    { label: "Topsoil water", cell: (day) => (day.weather.soilTop != null ? `${Math.round(day.weather.soilTop * 100)}%` : "—") },
    { label: "Sunlight MJ/m²", cell: (day) => (day.weather.radiation != null ? day.weather.radiation.toFixed(0) : "—") },
  ]
  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <table className="w-full min-w-[600px] text-sm">
        <thead>
          <tr>
            <th className="w-32" />
            {days.map((day) => (
              <th key={day.date} className="pb-1 text-center text-xs font-normal text-muted-foreground">
                {formatWeekday(day.date)} {formatDay(day.date)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-t border-border">
              <td className="py-1.5 text-xs text-muted-foreground">{row.label}</td>
              {days.map((day) => (
                <td key={day.date} className="py-1.5 text-center font-mono text-xs">
                  {row.cell(day)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function round(value: number | null): string {
  return value == null ? "—" : String(Math.round(value))
}

export function AirAcrossIndia({
  overview,
  selectedId,
  onSelect,
}: {
  overview: AirOverview[]
  selectedId: string
  onSelect: (id: string) => void
}) {
  const ranked = [...overview].sort((a, b) => (b.today?.aqi?.value ?? -1) - (a.today?.aqi?.value ?? -1))
  return (
    <ul className="grid gap-x-6 sm:grid-cols-2">
      {ranked.map((item) => (
        <li key={item.id} className="border-b border-border">
          <button
            type="button"
            onClick={() => onSelect(item.id)}
            className={`flex w-full items-center justify-between gap-3 px-1 py-2 text-left hover:bg-muted ${item.id === selectedId ? "bg-accent" : ""}`}
          >
            <span>
              <span className="block text-sm">{item.name}</span>
              <span className="block text-[11px] text-muted-foreground">
                {item.worst?.aqi && item.worst.date !== item.today?.date
                  ? `Worst: ${item.worst.aqi.category.toLowerCase()} on ${formatWeekday(item.worst.date)}`
                  : item.state}
              </span>
            </span>
            {item.today ? <AqiChip air={item.today} /> : <span className="text-xs text-muted-foreground">No data</span>}
          </button>
        </li>
      ))}
    </ul>
  )
}
