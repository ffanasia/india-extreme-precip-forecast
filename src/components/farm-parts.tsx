"use client"

import { AlertTriangle, CloudRain, Droplets, Flame, Leaf, Snowflake, SprayCan, Sprout, Sun, Wheat, Wind } from "lucide-react"
import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { addDays } from "@/lib/dates"
import { AQI_COLOR, ozoneStress } from "@/lib/agro/air"
import {
  activityLabel,
  spanLabel,
  type ActivityId,
  type AlertKind,
  type DayPlan,
  type FarmPlan,
  type Verdict,
} from "@/lib/agro/advisor"
import { cropById, stageFocus, stageName, type Crop } from "@/lib/agro/crops"
import type { CropSuggestions, Suggestion } from "@/lib/agro/regions"
import type { AirOverview, AqiCategory, DayAir } from "@/lib/agro/types"
import type { Translator } from "@/lib/i18n"
import { placeName, stateName } from "@/lib/plain"

export const VERDICT_COLOR: Record<Verdict, string> = {
  good: "#5fa36a",
  fair: "#d6b25e",
  avoid: "#e24a2e",
  none: "#5c564c",
}

function verdictWord(verdict: Verdict, tr: Translator): string {
  return verdict === "none" ? tr.t("common.dash") : tr.t(`verdict.${verdict}`)
}

function aqiWord(category: AqiCategory, tr: Translator): string {
  return tr.t(`aqi.${category}`)
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

export function StageTimeline({ plan, today, tr }: { plan: FarmPlan; today: string; tr: Translator }) {
  const { crop, dasToday } = plan
  const total = crop.stages[crop.stages.length - 1].to + 1
  const windowEnd = plan.days[plan.days.length - 1]?.das ?? null
  return (
    <div>
      <div className="relative flex h-9 w-full overflow-hidden rounded-lg ring-1 ring-foreground/10">
        {crop.stages.map((stage, index) => {
          const active = plan.stageToday?.id === stage.id
          const name = stageName(crop, stage, tr)
          return (
            <div
              key={stage.id}
              className={`flex items-center justify-center border-r border-background/60 text-[10px] leading-tight last:border-r-0 sm:text-xs ${
                active ? "bg-saffron/80 text-background" : index % 2 ? "bg-muted" : "bg-secondary"
              }`}
              style={{ width: `${((stage.to - stage.from + 1) / total) * 100}%` }}
              title={name}
            >
              <span className="hidden truncate px-1 md:inline">{name}</span>
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
              <span className={past ? "text-muted-foreground line-through decoration-muted-foreground/50" : ""}>
                {stageName(crop, stage, tr)}
              </span>
              <span className="shrink-0 font-mono text-xs text-muted-foreground">
                {start ? tr.date(start) : tr.t("stage.dayN", { n: stage.from })}
              </span>
            </li>
          )
        })}
      </ol>
      {plan.stageToday ? (
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          <span className="text-paper">{tr.t("stage.now", { stage: stageName(crop, plan.stageToday, tr) })}</span>{" "}
          {stageFocus(crop, plan.stageToday, tr)}
        </p>
      ) : (
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {plan.sownOn && plan.sownOn > today
            ? tr.t("stage.planned", { day: tr.day(plan.sownOn) })
            : tr.t("stage.addDate")}
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

export function BestDays({ plan, tr }: { plan: FarmPlan; tr: Translator }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {plan.best.map((item) => (
        <div key={item.activity} className="rounded-xl bg-muted/50 px-3.5 py-3" style={{ borderLeft: `4px solid ${VERDICT_COLOR[item.verdict]}` }}>
          <p className="flex items-center gap-2 text-xs tracking-[0.12em] text-muted-foreground uppercase">
            {ACTIVITY_ICON[item.activity]}
            {activityLabel(item.activity, tr)}
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
  tr,
}: {
  plan: FarmPlan
  selected: string | null
  onSelect: (date: string) => void
  tr: Translator
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
                  <span className="block text-sm">{tr.weekday(day.date)}</span>
                  <span className="block text-xs text-muted-foreground">{tr.date(day.date)}</span>
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {plan.days.some((day) => day.stage) && (
            <tr>
              <td className="text-xs text-muted-foreground">{tr.t("cal.stage")}</td>
              {plan.days.map((day) => {
                const name = day.stage ? stageName(plan.crop, day.stage, tr) : null
                return (
                  <td key={day.date} className="max-w-0 truncate px-1 text-center text-[11px] text-muted-foreground" title={name ?? undefined}>
                    {name ? shortStage(name, tr) : tr.t("cal.notSown")}
                  </td>
                )
              })}
            </tr>
          )}
          {plan.activities.map((activity) => (
            <tr key={activity}>
              <td className="text-xs text-muted-foreground">{activityLabel(activity, tr)}</td>
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
                      <span className="text-[11px] font-medium">{verdictWord(verdict, tr)}</span>
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

function shortStage(name: string, tr: Translator): string {
  if (tr.lang !== "en") return name
  return name.split(" and ")[0].replace("initiation", "init.")
}

export function DayDetail({ day, crop, tr }: { day: DayPlan; crop: Crop; tr: Translator }) {
  const w = day.weather
  const dash = tr.t("common.dash")
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-heading text-xl">{tr.day(day.date)}</p>
        {day.stage && day.das != null && (
          <p className="text-sm text-muted-foreground">
            {tr.t("detail.dayStage", { n: day.das, stage: stageName(crop, day.stage, tr) })}
          </p>
        )}
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
        <Stat label={tr.t("stat.temperature")} value={w.tMin != null && w.tMax != null ? `${Math.round(w.tMin)}–${Math.round(w.tMax)} °C` : dash} />
        <Stat label={tr.t("stat.rain")} value={`${w.rain < 0.5 ? "0" : Math.round(w.rain)} mm${w.rainProbMax != null ? ` · ${Math.round(w.rainProbMax)}%` : ""}`} />
        <Stat label={tr.t("stat.humidity")} value={w.rhMean != null ? `${Math.round(w.rhMean)}%` : dash} />
        <Stat label={tr.t("stat.wind")} value={w.windMax != null ? `${Math.round(w.windMax)}, ${Math.round(w.gustMax ?? 0)} km/h` : dash} />
        <Stat label={tr.t("stat.waterUse")} value={`${(w.et0 * (day.stage?.kc ?? 0.3)).toFixed(1)} mm`} />
        <Stat label={tr.t("stat.topsoil")} value={w.soilTop != null ? `${Math.round(w.soilTop * 100)}%` : dash} />
        <Stat
          label={tr.t("stat.air")}
          value={day.air?.aqi ? `${day.air.aqi.value} ${aqiWord(day.air.aqi.category, tr)}` : tr.t("common.noData")}
        />
        <Stat label={tr.t("stat.heavy")} value={day.heavyChance != null ? `${Math.round(day.heavyChance * 100)}%` : dash} />
      </dl>
      <ul className="space-y-2.5">
        {(Object.keys(day.activities) as ActivityId[]).map((activity) => {
          const item = day.activities[activity]!
          return (
            <li key={activity} className="flex gap-3 text-sm leading-6">
              <span className="mt-1.5 inline-block size-2.5 shrink-0 rounded-full" style={{ background: VERDICT_COLOR[item.verdict] }} />
              <span>
                <span className="text-paper">
                  {activityLabel(activity, tr)}: {item.verdict === "none" ? item.label : verdictWord(item.verdict, tr)}
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

export function Alerts({ plan, tr }: { plan: FarmPlan; tr: Translator }) {
  if (plan.alerts.length === 0) {
    return <p className="text-sm leading-6 text-muted-foreground">{tr.t("alerts.none")}</p>
  }
  return (
    <ul className="space-y-3">
      {plan.alerts.map((alert) => (
        <li
          key={`${alert.kind}-${alert.diseaseId ?? ""}-${alert.dates[0]}`}
          className="rounded-lg bg-muted/50 px-3 py-2.5"
          style={{ borderLeft: `4px solid ${alert.severity === "warning" ? "#e24a2e" : "#d6b25e"}` }}
        >
          <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
            {ALERT_ICON[alert.kind]}
            {alert.title}
            <span className="font-normal text-muted-foreground">· {spanLabel(alert.dates, tr)}</span>
          </p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{alert.detail}</p>
        </li>
      ))}
    </ul>
  )
}

export function AirWeek({ days, tr }: { days: DayPlan[]; tr: Translator }) {
  const withAir = days.filter((day) => day.air)
  if (withAir.length === 0) {
    return <p className="text-sm text-muted-foreground">{tr.t("air.none")}</p>
  }
  return (
    <div className="space-y-3">
      <div className="-mx-1 overflow-x-auto px-1">
        <table className="w-full min-w-[420px] text-sm">
          <thead>
            <tr className="text-left text-[11px] tracking-[0.1em] text-muted-foreground uppercase">
              <th className="py-1 font-normal">{tr.t("air.colDay")}</th>
              <th className="py-1 font-normal">{tr.t("air.colAqi")}</th>
              <th className="py-1 font-normal">{tr.t("air.colPm")}</th>
              <th className="py-1 font-normal">{tr.t("air.colOzone")}</th>
              <th className="py-1 font-normal">{tr.t("air.colHaze")}</th>
            </tr>
          </thead>
          <tbody>
            {withAir.map((day) => (
              <tr key={day.date} className="border-t border-border">
                <td className="py-1.5">{tr.day(day.date)}</td>
                <td className="py-1.5"><AqiChip air={day.air!} tr={tr} /></td>
                <td className="py-1.5 font-mono text-xs">{day.air!.pm25 != null ? `${Math.round(day.air!.pm25)} µg/m³` : tr.t("common.dash")}</td>
                <td className="py-1.5">{tr.t(`ozone.${ozoneStress(day.air!.aot40) ?? "low"}`)}</td>
                <td className="py-1.5">{hazeWord(day.air!.aod, tr)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs leading-5 text-muted-foreground">{tr.t("air.note")}</p>
    </div>
  )
}

export function AqiChip({ air, tr }: { air: DayAir; tr: Translator }) {
  if (!air.aqi) return <span className="text-muted-foreground">{tr.t("common.dash")}</span>
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block size-2.5 rounded-full" style={{ background: AQI_COLOR[air.aqi.category] }} />
      <span className="font-mono text-xs">{air.aqi.value}</span>
      <span className="text-xs">{aqiWord(air.aqi.category, tr)}</span>
    </span>
  )
}

function hazeWord(aod: number | null, tr: Translator): string {
  if (aod == null) return tr.t("common.dash")
  if (aod < 0.4) return tr.t("haze.clear")
  if (aod < 0.8) return tr.t("haze.light")
  if (aod < 1.2) return tr.t("haze.hazy")
  return tr.t("haze.thick")
}

export function WeatherTable({ days, tr }: { days: DayPlan[]; tr: Translator }) {
  const dash = tr.t("common.dash")
  const round = (value: number | null) => (value == null ? dash : String(Math.round(value)))
  const rows: { label: string; cell: (day: DayPlan) => string }[] = [
    { label: tr.t("wx.maxMin"), cell: (day) => `${round(day.weather.tMax)} / ${round(day.weather.tMin)}` },
    { label: tr.t("wx.rain"), cell: (day) => (day.weather.rain < 0.5 ? "0" : String(Math.round(day.weather.rain))) },
    { label: tr.t("wx.rainChance"), cell: (day) => (day.weather.rainProbMax != null ? `${Math.round(day.weather.rainProbMax)}%` : dash) },
    { label: tr.t("wx.heavy"), cell: (day) => (day.heavyChance != null ? `${Math.round(day.heavyChance * 100)}%` : dash) },
    { label: tr.t("wx.humidity"), cell: (day) => (day.weather.rhMean != null ? `${Math.round(day.weather.rhMean)}%` : dash) },
    { label: tr.t("wx.gusts"), cell: (day) => round(day.weather.gustMax) },
    { label: tr.t("wx.evaporation"), cell: (day) => day.weather.et0.toFixed(1) },
    { label: tr.t("wx.topsoil"), cell: (day) => (day.weather.soilTop != null ? `${Math.round(day.weather.soilTop * 100)}%` : dash) },
    { label: tr.t("wx.sunlight"), cell: (day) => (day.weather.radiation != null ? day.weather.radiation.toFixed(0) : dash) },
  ]
  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <table className="w-full min-w-[600px] text-sm">
        <thead>
          <tr>
            <th className="w-32" />
            {days.map((day) => (
              <th key={day.date} className="pb-1 text-center text-xs font-normal text-muted-foreground">
                {tr.day(day.date)}
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

export function AirAcrossIndia({
  overview,
  selectedId,
  onSelect,
  tr,
}: {
  overview: AirOverview[]
  selectedId: string
  onSelect: (id: string) => void
  tr: Translator
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
              <span className="block text-sm">{placeName(item.id, item.name, tr)}</span>
              <span className="block text-[11px] text-muted-foreground">
                {item.worst?.aqi && item.worst.date !== item.today?.date
                  ? tr.t("air.worst", { category: tr.lower(aqiWord(item.worst.aqi.category, tr)), day: tr.weekday(item.worst.date) })
                  : stateName(item.state, tr)}
              </span>
            </span>
            {item.today ? (
              <AqiChip air={item.today} tr={tr} />
            ) : (
              <span className="text-xs text-muted-foreground">{tr.t("common.noData")}</span>
            )}
          </button>
        </li>
      ))}
    </ul>
  )
}

const WATER_COLOR = { low: "#7fa89a", medium: "#d6b25e", high: "#8fb3c9" } as const

export function WhatGrows({
  suggestions,
  annualRainMm,
  currentCrop,
  onPlan,
  tr,
}: {
  suggestions: CropSuggestions
  annualRainMm: number | null
  currentCrop: string
  onPlan: (cropId: string) => void
  tr: Translator
}) {
  const dry = annualRainMm != null && annualRainMm < 600
  const soilKey = `soil.${suggestions.soil}`
  const groups = [
    { key: "now", title: tr.t("grow.sowNow", { season: tr.t(`season.${suggestions.season}`) }), items: suggestions.now, showFit: true },
    { key: "next", title: tr.t("grow.next", { season: tr.t(`season.${suggestions.next}`) }), items: suggestions.upcoming, showFit: false },
    { key: "perennial", title: tr.t("grow.perennial"), items: suggestions.perennial, showFit: false },
  ].filter((group) => group.items.length > 0)
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {tr.has(soilKey) ? tr.t("grow.soil", { soil: tr.t(soilKey) }) : null}
      </p>
      <div className="grid gap-4 lg:grid-cols-3">
        {groups.map((group) => (
          <div key={group.key}>
            <p className="text-xs tracking-[0.12em] text-muted-foreground uppercase">{group.title}</p>
            <ul className="mt-2 space-y-2">
              {group.items.map((item) => (
                <CropRow
                  key={item.id}
                  item={item}
                  showFit={group.showFit}
                  current={item.id === currentCrop}
                  onPlan={onPlan}
                  tr={tr}
                />
              ))}
            </ul>
          </div>
        ))}
      </div>
      {dry && (
        <p className="text-sm leading-6 text-muted-foreground">
          {tr.t("grow.dryNote")} {annualRainMm != null && tr.t("grow.rain", { mm: Math.round(annualRainMm / 10) * 10 })}
        </p>
      )}
      <p className="text-xs leading-5 text-muted-foreground">{tr.t("grow.note")}</p>
    </div>
  )
}

function CropRow({
  item,
  showFit,
  current,
  onPlan,
  tr,
}: {
  item: Suggestion
  showFit: boolean
  current: boolean
  onPlan: (cropId: string) => void
  tr: Translator
}) {
  const nameKey = `fc.${item.id}`
  const name = tr.has(nameKey) ? tr.t(nameKey) : item.id
  const fit = showFit && item.fit && item.fit.verdict !== "offSeason" ? item.fit : null
  const temp = fit?.meanTemp != null ? Math.round(fit.meanTemp) : null
  return (
    <li className={`rounded-lg px-3 py-2 ${current ? "bg-accent" : "bg-muted/50"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium">{name}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Droplets className="size-3" style={{ color: WATER_COLOR[item.water] }} />
            {tr.t(`water.${item.water}`)}
          </p>
          {fit && (
            <p className="mt-0.5 text-xs" style={{ color: fit.verdict === "good" ? "#5fa36a" : "#d6b25e" }}>
              {tr.t(`fit.${fit.verdict}`, { temp: temp ?? tr.t("common.dash") })}
            </p>
          )}
        </div>
        {item.plannable && cropById(item.id) && !current && (
          <Button variant="outline" size="xs" className="shrink-0" onClick={() => onPlan(item.id)}>
            {tr.t("grow.plan")}
          </Button>
        )}
      </div>
    </li>
  )
}
