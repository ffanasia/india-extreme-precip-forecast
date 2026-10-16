import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { formatDay } from "@/lib/dates"
import type { ThresholdId, WindowId } from "@/lib/domain"
import { THRESHOLDS } from "@/lib/domain"
import {
  CATEGORY_LABEL,
  CONFIDENCE_LABEL,
  formatMm,
  formatPercent,
  formatSignedPercent,
} from "@/lib/format"
import type { CityDesk, DeskResponse } from "@/lib/types"
import type { SeasonName } from "@/lib/stats"

const MODEL_COLOR: Record<string, string> = {
  "ECMWF IFS": "#e3a008",
  "NCEP GEFS": "#7fa89a",
}

export function Briefing({
  city,
  region,
  windowId,
  thresholdId,
  mode,
  season,
}: {
  city: CityDesk | null
  region: DeskResponse["regions"][number] | null
  windowId: WindowId
  thresholdId: ThresholdId
  mode: "week" | "climate"
  season: SeasonName
}) {
  if (!city || !region) {
    return (
      <div className="flex h-full items-center px-5 text-sm text-muted-foreground">
        Choose an anchor on the map or in the list.
      </div>
    )
  }
  const view = city.views[windowId][thresholdId]
  const threshold = THRESHOLDS.find((item) => item.id === thresholdId)
  const climate = season === "jjas" ? region.jjas : region.ond
  const seasonLabel = season === "jjas" ? "June–September" : "October–December"
  const analog = city.analogs[windowId]

  return (
    <article className="flex h-full min-h-0 flex-col">
      <header className="px-5 pt-5 pb-4">
        <p className="text-[11px] tracking-[0.16em] text-muted-foreground uppercase">{city.state}</p>
        <h2 className="font-heading text-3xl leading-none italic">{city.name}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{city.regionName}</p>
      </header>
      <Separator />
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
        {mode === "week" ? (
          <WeekHero city={city} view={view} thresholdLabel={threshold?.detail ?? ""} />
        ) : (
          <ClimateHero region={region} climate={climate} seasonLabel={seasonLabel} />
        )}

        {mode === "week" && (
          <>
            <Plume models={city.plume} threshold={view.thresholdMm} />
            <section className="space-y-2">
              <h3 className="text-[11px] tracking-[0.16em] text-muted-foreground uppercase">Ensembles</h3>
              {view.byModel.length === 0 && (
                <p className="text-sm text-muted-foreground">{city.ensembleError ?? "No ensemble members."}</p>
              )}
              {view.byModel.map((model) => (
                <div key={model.id} className="space-y-1">
                  <div className="flex items-baseline justify-between text-sm">
                    <span>
                      {model.label}
                      <span className="ml-2 font-mono text-xs text-muted-foreground">{model.members} members</span>
                    </span>
                    <span className="font-mono">{formatPercent(model.probability)}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(100, (model.probability ?? 0) * 100)}%`,
                        background: MODEL_COLOR[model.label] ?? "#f3eee4",
                      }}
                    />
                  </div>
                </div>
              ))}
              <p className="text-sm leading-6 text-muted-foreground">
                {view.climatologyYears > 0
                  ? view.climatologyHits === 0
                    ? `None of the ${view.climatologyYears} ERA5 years from 1991–2020 reached ${formatMm(view.thresholdMm)} in this calendar window.`
                    : `${view.climatologyHits} of ${view.climatologyYears} ERA5 years (1991–2020) had a day of at least ${formatMm(view.thresholdMm)} in this calendar window.`
                  : "The ERA5 window sample is empty."}
              </p>
            </section>
            <section>
              <h3 className="text-[11px] tracking-[0.16em] text-muted-foreground uppercase">ERA5 analog</h3>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {analog
                  ? `Closest ${windowId === "24h" ? "day" : "sequence"} in 1991–2020 is ${analog.year}: peak ${formatMm(analog.peakMm)}, window total ${formatMm(analog.windowMm)}, RMSE ${analog.rmse.toFixed(1)} mm/day against the ensemble median.`
                  : "No analog until the ensemble median is in."}
              </p>
            </section>
            <SatelliteNote city={city} />
            <p className="text-sm leading-6 text-muted-foreground">
              Climate context, not mixed into the probability: {seasonLabel} days of at least 64.5 mm at the{" "}
              {region.name} centroid change by {formatSignedPercent(climate.heavyDaysPct)} from 1991–2014 to 2031–2049.
            </p>
          </>
        )}

        {mode === "climate" && (
          <>
            <p className="text-sm leading-6 text-muted-foreground">{region.blurb}</p>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <Metric label="Historical heavy days / season" value={climate.historical.meanHeavyDays.toFixed(2)} />
              <Metric label="2031–2049 heavy days / season" value={climate.future.meanHeavyDays.toFixed(2)} />
              <Metric label="Rx1day change" value={formatSignedPercent(climate.rx1dayPct)} />
              <Metric
                label="Model spread, heavy days"
                value={
                  climate.heavyDaysSpread
                    ? `${formatSignedPercent(climate.heavyDaysSpread[0])} to ${formatSignedPercent(climate.heavyDaysSpread[1])}`
                    : "—"
                }
              />
            </dl>
            <ul className="space-y-2 text-sm">
              {climate.models.map((model) => (
                <li key={model.id} className="flex items-baseline justify-between gap-3">
                  <span>{model.label}</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {model.historical.meanHeavyDays.toFixed(2)} → {model.future.meanHeavyDays.toFixed(2)}{" "}
                    <span className="text-paper">{formatSignedPercent(model.heavyDaysPct)}</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-sm leading-6 text-muted-foreground">
              At {city.name} itself, ERA5 recorded {city.era5.heavyDays} heavy days in {city.era5.years} years
              (about {(city.era5.heavyDays / city.era5.years).toFixed(1)} per year) and a wet-day R99p of{" "}
              {formatMm(city.localR99p)}. The climate numbers are for the regional centroid, not this city&apos;s grid
              cell.
            </p>
            <p className="text-sm leading-6 text-muted-foreground">
              This week&apos;s equal-weight chance of {formatMm(view.thresholdMm)} is {formatPercent(view.probability)}
              {view.window.start ? ` (${view.window.start === view.window.end ? formatDay(view.window.start) : `${formatDay(view.window.start)}–${formatDay(view.window.end)}`})` : ""}.
            </p>
          </>
        )}
      </div>
    </article>
  )
}

function WeekHero({
  city,
  view,
  thresholdLabel,
}: {
  city: CityDesk
  view: CityDesk["views"][WindowId][ThresholdId]
  thresholdLabel: string
}) {
  const span =
    view.window.start && view.window.end
      ? view.window.start === view.window.end
        ? formatDay(view.window.start)
        : `${formatDay(view.window.start)} – ${formatDay(view.window.end)}`
      : "Dates pending"
  return (
    <section>
      <p className="text-[11px] tracking-[0.16em] text-muted-foreground uppercase">
        Chance of at least one day · {span}
      </p>
      <p className="font-mono text-5xl tracking-tight text-paper">{formatPercent(view.probability)}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Badge variant={view.category === "severe" || view.category === "high" ? "destructive" : "secondary"}>
          {CATEGORY_LABEL[view.category]}
        </Badge>
        {view.confidence !== "quiet" && <Badge variant="outline">{CONFIDENCE_LABEL[view.confidence]}</Badge>}
      </div>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        Threshold {formatMm(view.thresholdMm)}. {thresholdLabel}. Local wet-day R99p at {city.name} is{" "}
        {formatMm(city.localR99p)}.
        {view.peak ? ` Peak ensemble day is ${formatDay(view.peak.date)} at ${formatPercent(view.peak.probability)}.` : ""}
      </p>
    </section>
  )
}

function ClimateHero({
  region,
  climate,
  seasonLabel,
}: {
  region: DeskResponse["regions"][number]
  climate: DeskResponse["regions"][number]["jjas"]
  seasonLabel: string
}) {
  return (
    <section>
      <p className="text-[11px] tracking-[0.16em] text-muted-foreground uppercase">
        {region.name} · {seasonLabel} days ≥ 64.5 mm
      </p>
      <p className="font-mono text-5xl tracking-tight text-paper">{formatSignedPercent(climate.heavyDaysPct)}</p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Multi-model mean change from {climate.historical.years} historical seasons to {climate.future.years} seasons in
        2031–2049. HighResMIP, closest to RCP8.5, bias-corrected to ERA5-Land. Not a forecast for this week.
      </p>
    </section>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border px-3 py-2">
      <dt className="text-[11px] leading-4 text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-mono text-sm">{value}</dd>
    </div>
  )
}

function SatelliteNote({ city }: { city: CityDesk }) {
  if (!city.satellite) {
    return (
      <section>
        <h3 className="text-[11px] tracking-[0.16em] text-muted-foreground uppercase">Satellite</h3>
        <p className="mt-1 text-sm text-muted-foreground">{city.satelliteError ?? "No recent observation."}</p>
      </section>
    )
  }
  const note =
    city.satellite.antecedent === "extreme"
      ? "A recent observed day already reached the heavy-rain category."
      : city.satellite.antecedent === "wet"
        ? "The latest observed days are wet relative to the local ERA5 3-day 95th percentile."
        : "Recent observed rain is below the local ERA5 3-day 95th percentile."
  const max = Math.max(8, ...city.satellite.days.map((day) => day.mm))
  return (
    <section>
      <h3 className="text-[11px] tracking-[0.16em] text-muted-foreground uppercase">Satellite-informed rain</h3>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">
        {city.satellite.latest
          ? `Latest valid day ${formatDay(city.satellite.latest.date)}: ${formatMm(city.satellite.latest.mm)}.`
          : "No valid day."}{" "}
        {city.satellite.threeDayMm != null
          ? `Latest three observed days sum to ${formatMm(city.satellite.threeDayMm)}.`
          : ""}{" "}
        {note}
      </p>
      <div className="mt-2 flex h-12 items-end gap-1" aria-hidden>
        {city.satellite.days.map((day) => (
          <div key={day.date} className="flex-1 rounded-sm bg-monsoon/80" style={{ height: `${Math.max(8, (day.mm / max) * 100)}%` }} title={`${day.date}: ${day.mm} mm`} />
        ))}
      </div>
    </section>
  )
}

function Plume({ models, threshold }: { models: CityDesk["plume"]; threshold: number }) {
  const dates = models[0]?.days.map((day) => day.date) ?? []
  if (dates.length === 0) return null
  const highs = models.flatMap((model) => model.days.map((day) => day.p90))
  const dataMax = Math.max(...highs, 1)
  const thresholdOnScale = threshold <= dataMax * 1.35
  const maxY = (thresholdOnScale ? Math.max(threshold, dataMax) : dataMax) * 1.18
  const width = 320
  const height = 128
  const padL = 34
  const padR = 8
  const padT = 8
  const padB = 20
  const innerW = width - padL - padR
  const innerH = height - padT - padB
  const xAt = (index: number) => padL + (dates.length === 1 ? innerW / 2 : (index / (dates.length - 1)) * innerW)
  const yAt = (value: number) => padT + innerH - (Math.max(0, value) / maxY) * innerH

  return (
    <section>
      <h3 className="text-[11px] tracking-[0.16em] text-muted-foreground uppercase">Ensemble plume</h3>
      <svg viewBox={`0 0 ${width} ${height}`} className="mt-2 w-full" role="img" aria-label="Daily precipitation quantiles">
        {[0, 0.5, 1].map((fraction) => {
          const value = maxY * fraction
          const y = yAt(value)
          return (
            <g key={fraction}>
              <line x1={padL} x2={width - padR} y1={y} y2={y} stroke="#3a342b" strokeWidth="1" />
              <text x={padL - 4} y={y + 3} textAnchor="end" fill="#b7ab96" fontSize="9" fontFamily="ui-monospace, monospace">
                {Math.round(value)}
              </text>
            </g>
          )
        })}
        {thresholdOnScale && (
          <line
            x1={padL}
            x2={width - padR}
            y1={yAt(threshold)}
            y2={yAt(threshold)}
            stroke="#e24a2e"
            strokeDasharray="3 3"
            strokeWidth="1"
          />
        )}
        {models.map((model) => {
          const byDate = new Map(model.days.map((day) => [day.date, day]))
          const present = dates.flatMap((date, index) => {
            const day = byDate.get(date)
            return day ? [{ index, day }] : []
          })
          if (present.length === 0) return null
          const band = [
            ...present.map((item) => `${xAt(item.index)},${yAt(item.day.p90)}`),
            ...[...present].reverse().map((item) => `${xAt(item.index)},${yAt(item.day.p10)}`),
          ].join(" ")
          const median = present.map((item) => `${xAt(item.index)},${yAt(item.day.p50)}`).join(" ")
          const color = MODEL_COLOR[model.label] ?? "#f3eee4"
          return (
            <g key={model.id}>
              <polygon points={band} fill={color} opacity="0.22" />
              <polyline points={median} fill="none" stroke={color} strokeWidth="1.6" />
            </g>
          )
        })}
        {dates.map((date, index) => (
          <text
            key={date}
            x={xAt(index)}
            y={height - 4}
            textAnchor="middle"
            fill="#b7ab96"
            fontSize="9"
            fontFamily="ui-monospace, monospace"
          >
            {formatDay(date).split(" ")[0]}
          </text>
        ))}
      </svg>
      <p className="mt-1 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
        <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-saffron" />IFS p10–p90</span>
        <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-monsoon" />GEFS p10–p90</span>
        <span>
          {thresholdOnScale
            ? "Dashed line is the threshold."
            : `The ${formatMm(threshold)} threshold sits above this plume.`}
        </span>
      </p>
    </section>
  )
}
