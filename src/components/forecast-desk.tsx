"use client"

import { RefreshCw } from "lucide-react"
import Link from "next/link"
import { useEffect, useMemo, useState, type ReactNode } from "react"

import { Briefing } from "@/components/briefing"
import { IndiaMap, type MapPoint } from "@/components/india-map"
import { MethodDialog } from "@/components/method-dialog"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatDay, formatIssued, formatRange } from "@/lib/dates"
import { THRESHOLDS, WINDOWS, type ThresholdId, type WindowId } from "@/lib/domain"
import { categoryColor, climateColor, formatPercent, formatSignedPercent, CATEGORY_LABEL } from "@/lib/format"
import type { SeasonName } from "@/lib/stats"
import type { DeskResponse } from "@/lib/types"

type Mode = "week" | "climate"

export function ForecastDesk() {
  const [data, setData] = useState<DeskResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<Mode>("week")
  const [windowId, setWindowId] = useState<WindowId>("72h")
  const [thresholdId, setThresholdId] = useState<ThresholdId>("heavy")
  const [season, setSeason] = useState<SeasonName>("jjas")
  const [chosenId, setChosenId] = useState<string | null>(null)
  const [query, setQuery] = useState("")

  async function load(refresh = false) {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(refresh ? "/api/forecast?refresh=1" : "/api/forecast", { cache: "no-store" })
      const body = (await response.json()) as DeskResponse & { error?: string }
      if (!response.ok) throw new Error(body.error ?? "The forecast desk could not be loaded")
      setData(body)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The forecast desk could not be loaded")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load(false)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  const selectedId = useMemo(() => {
    if (!data) return null
    if (chosenId && data.cities.some((city) => city.id === chosenId)) return chosenId
    const ranked = [...data.cities].sort(
      (a, b) => (b.views["72h"].heavy.probability ?? -1) - (a.views["72h"].heavy.probability ?? -1),
    )
    return ranked[0]?.id ?? null
  }, [chosenId, data])

  const selected = data?.cities.find((city) => city.id === selectedId) ?? null
  const region = data?.regions.find((item) => item.id === selected?.regionId) ?? null
  const needle = query.trim().toLowerCase()

  const ranked = useMemo(() => {
    if (!data) return []
    return data.cities
      .filter((city) => {
        if (!needle) return true
        return `${city.name} ${city.state} ${city.regionName}`.toLowerCase().includes(needle)
      })
      .sort((a, b) => {
        if (mode === "climate") {
          const left = data.regions.find((item) => item.id === a.regionId)?.[season].heavyDaysPct ?? -999
          const right = data.regions.find((item) => item.id === b.regionId)?.[season].heavyDaysPct ?? -999
          return right - left
        }
        return (b.views[windowId][thresholdId].probability ?? -1) - (a.views[windowId][thresholdId].probability ?? -1)
      })
  }, [data, mode, needle, season, thresholdId, windowId])

  const points: MapPoint[] = useMemo(() => {
    if (!data) return []
    return data.cities.map((city) => {
      const view = city.views[windowId][thresholdId]
      const shift = data.regions.find((item) => item.id === city.regionId)?.[season].heavyDaysPct ?? null
      const dimmed = needle.length > 0 && !`${city.name} ${city.state} ${city.regionName}`.toLowerCase().includes(needle)
      if (mode === "climate") {
        return {
          id: city.id,
          name: city.name,
          state: city.state,
          lat: city.lat,
          lon: city.lon,
          color: climateColor(shift),
          radius: 7,
          label: formatSignedPercent(shift),
          dimmed,
        }
      }
      const probability = view.probability ?? 0
      return {
        id: city.id,
        name: city.name,
        state: city.state,
        lat: city.lat,
        lon: city.lon,
        color: categoryColor(view.category),
        radius: 5 + Math.min(probability, 1) * 9,
        label: formatPercent(view.probability),
        dimmed,
      }
    })
  }, [data, mode, needle, season, thresholdId, windowId])

  const windowMeta = WINDOWS.find((item) => item.id === windowId)
  const sampleWindow = selected?.views[windowId][thresholdId].window
  const aboveWatch = ranked.filter((city) => {
    const probability = city.views[windowId][thresholdId].probability ?? 0
    return probability >= 0.1
  }).length

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground lg:h-dvh lg:overflow-hidden">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border px-4 py-3 sm:px-5">
        <div>
          <p className="font-heading text-[1.7rem] leading-none italic">Varsha</p>
          <p className="mt-1 text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
            Mainland India · extreme precipitation
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Tabs value={mode} onValueChange={(value) => setMode(value === "climate" ? "climate" : "week")}>
            <TabsList>
              <TabsTrigger value="week">This week</TabsTrigger>
              <TabsTrigger value="climate">Climate shift</TabsTrigger>
            </TabsList>
          </Tabs>
          <MethodDialog />
          <Link href="/simple" className={buttonVariants({ variant: "outline", size: "sm" })}>
            Simple guide
          </Link>
          <Link href="/farm" className={buttonVariants({ variant: "outline", size: "sm" })}>
            Farm planner
          </Link>
          <Button variant="outline" size="sm" onClick={() => void load(true)} disabled={loading}>
            <RefreshCw className={loading ? "animate-spin" : ""} />
            Refresh
          </Button>
        </div>
      </header>

      <div className="desk-grid">
        <section className="desk-controls border-border lg:border-r">
          <div className="space-y-4 px-4 py-4">
            {mode === "week" ? (
              <>
                <Control label="Window">
                  {WINDOWS.map((item) => (
                    <Button
                      key={item.id}
                      size="sm"
                      variant={windowId === item.id ? "default" : "outline"}
                      aria-pressed={windowId === item.id}
                      onClick={() => setWindowId(item.id)}
                    >
                      {item.short}
                    </Button>
                  ))}
                </Control>
                <Control label="Daily threshold">
                  {THRESHOLDS.map((item) => (
                    <Button
                      key={item.id}
                      size="sm"
                      variant={thresholdId === item.id ? "default" : "outline"}
                      aria-pressed={thresholdId === item.id}
                      onClick={() => setThresholdId(item.id)}
                    >
                      {item.mm == null ? "R99p" : item.mm}
                    </Button>
                  ))}
                </Control>
              </>
            ) : (
              <Control label="Extreme season">
                <Button size="sm" variant={season === "jjas" ? "default" : "outline"} aria-pressed={season === "jjas"} onClick={() => setSeason("jjas")}>
                  JJAS
                </Button>
                <Button size="sm" variant={season === "ond" ? "default" : "outline"} aria-pressed={season === "ond"} onClick={() => setSeason("ond")}>
                  OND
                </Button>
              </Control>
            )}
            {data && (
              <p className="text-sm leading-6 text-muted-foreground">
                <span className="text-paper">{data.season.title}. </span>
                {data.season.note}
              </p>
            )}
            {data && mode === "week" && (
              <p className="text-xs leading-5 text-muted-foreground">
                {sampleWindow?.start
                  ? `${windowMeta?.label} covers ${formatRange(sampleWindow.start, sampleWindow.end)}. `
                  : ""}
                Colour is the chance of at least one day at or above the threshold, averaged across IFS and GEFS.
                {aboveWatch === 0
                  ? " No anchor is at 10% or higher."
                  : ` ${aboveWatch} ${aboveWatch === 1 ? "anchor is" : "anchors are"} at 10% or higher.`}
              </p>
            )}
            {data && mode === "climate" && (
              <LegendClimate />
            )}
            {data && mode === "week" && <LegendWeek />}
          </div>
        </section>

        <section className="desk-list flex min-h-0 flex-col border-border lg:h-full lg:overflow-hidden lg:border-r">
          <div className="px-4 py-3">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Find a city or state"
              aria-label="Find a city or state"
            />
          </div>
          <Separator />
          <div className="min-h-0 flex-1 overflow-y-auto lg:max-h-full">
            <ul className="px-2 py-2">
              {ranked.map((city) => {
                const view = city.views[windowId][thresholdId]
                const shift = data?.regions.find((item) => item.id === city.regionId)?.[season].heavyDaysPct ?? null
                const active = city.id === selectedId
                return (
                  <li key={city.id}>
                    <button
                      type="button"
                      onClick={() => setChosenId(city.id)}
                      className={`flex w-full items-baseline justify-between gap-3 rounded-lg px-2 py-2 text-left ${
                        active ? "bg-accent" : "hover:bg-muted"
                      }`}
                    >
                      <span>
                        <span className="block text-sm">{city.name}</span>
                        <span className="block text-[11px] text-muted-foreground">
                          {mode === "climate"
                            ? city.regionName
                            : view.peak
                              ? `Peak ${formatDay(view.peak.date)}`
                              : CATEGORY_LABEL[view.category]}
                        </span>
                      </span>
                      <span className="font-mono text-sm">
                        {mode === "climate" ? formatSignedPercent(shift) : formatPercent(view.probability)}
                      </span>
                    </button>
                  </li>
                )
              })}
              {data && ranked.length === 0 && (
                <li className="px-2 py-6 text-sm text-muted-foreground">No anchor matches that search.</li>
              )}
            </ul>
          </div>
        </section>

        <main className="desk-map flex h-full min-h-[440px] flex-col">
          <div className="relative min-h-0 flex-1">
            {error && (
              <div className="absolute inset-x-4 top-4 z-10 rounded-lg border border-vermillion/40 bg-background/95 px-3 py-2 text-sm text-vermillion">
                {error}
              </div>
            )}
            {loading && !data && (
              <div className="absolute inset-x-0 top-16 z-10 text-center text-sm text-muted-foreground">
                Reading ECMWF IFS, NCEP GEFS, and satellite-informed rain for 21 anchors.
              </div>
            )}
            <IndiaMap
              points={points}
              selectedId={selectedId}
              highlightRegion={mode === "climate" ? selected?.regionId ?? null : null}
              onSelect={setChosenId}
            />
          </div>
          {data && (
            <div className="flex flex-wrap gap-2 border-t border-border px-3 py-2">
              <SourceChip label="ERA5" status={data.sources.era5.status} />
              <SourceChip label="CMIP6" status={data.sources.cmip6.status} />
              <SourceChip label="Real-time" status={data.sources.realtime.status} />
              <SourceChip label="Satellite" status={data.sources.satellite.status} />
              <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                {data.fromCache ? "Cached ensemble" : "Live ensemble"} · {formatIssued(data.generatedAt)} IST
              </span>
            </div>
          )}
        </main>

        <aside className="desk-briefing border-border lg:h-full lg:overflow-hidden lg:border-l">
          {data ? (
            <Briefing
              city={selected}
              region={region}
              windowId={windowId}
              thresholdId={thresholdId}
              mode={mode}
              season={season}
            />
          ) : (
            <div className="px-5 py-6 text-sm leading-6 text-muted-foreground">
              {loading
                ? "The first pull asks both ensembles and NASA POWER for every anchor. Later refreshes reuse a 30-minute cache."
                : error ?? "Waiting for the forecast."}
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}

function Control({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-[11px] tracking-[0.16em] text-muted-foreground uppercase">{label}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  )
}

function LegendWeek() {
  const items = [
    ["Quiet", "#8d8678"],
    ["Watch", "#d6b25e"],
    ["Likely", "#e08a3c"],
    ["High", "#e24a2e"],
    ["Severe", "#f4efe4"],
  ] as const
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
      {items.map(([label, color]) => (
        <li key={label} className="flex items-center gap-1.5">
          <span className="inline-block size-2 rounded-full" style={{ background: color }} />
          {label}
        </li>
      ))}
    </ul>
  )
}

function LegendClimate() {
  return (
    <p className="text-xs leading-5 text-muted-foreground">
      Marker colour is the multi-model change in seasonal days of at least 64.5 mm, from fewer extremes in brown to more
      in vermillion. States with one dominant zone are outlined when you select a city in that zone.
    </p>
  )
}

function SourceChip({ label, status }: { label: string; status: "ready" | "degraded" | "down" }) {
  return (
    <Badge variant="outline" className="bg-background/80">
      <span
        className={`size-1.5 rounded-full ${
          status === "ready" ? "bg-monsoon" : status === "degraded" ? "bg-saffron" : "bg-vermillion"
        }`}
      />
      {label}
    </Badge>
  )
}
