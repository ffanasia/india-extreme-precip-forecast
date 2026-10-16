"use client"

import { LocateFixed, RefreshCw } from "lucide-react"
import Link from "next/link"
import { useEffect, useMemo, useState, type ReactNode } from "react"

import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatDay, formatIssued } from "@/lib/dates"
import {
  DAY_WORDS,
  RISK_COLOR,
  RISK_WORDS,
  adviceFor,
  agreement,
  dayKind,
  futureOutlook,
  groundStatus,
  headline,
  nearestCity,
  riskLevel,
  roundedMm,
  sameWeekHistory,
  typicalYear,
  weekLine,
  type DayKind,
} from "@/lib/plain"
import type { CityDesk, DeskResponse } from "@/lib/types"

const STORAGE_KEY = "varsha.city"

const DAY_COLOR: Record<DayKind, string> = {
  unknown: "#5c564c",
  dry: "#7fa89a",
  showers: "#8fb3c9",
  rain: "#d6b25e",
  heavy_possible: "#e08a3c",
  heavy_risk: "#e24a2e",
}

export function SimpleView() {
  const [data, setData] = useState<DeskResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [chosenId, setChosenId] = useState<string | null>(null)
  const [locating, setLocating] = useState(false)
  const [locationNote, setLocationNote] = useState<string | null>(null)

  async function load(refresh = false) {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(refresh ? "/api/forecast?refresh=1" : "/api/forecast", { cache: "no-store" })
      const body = (await response.json()) as DeskResponse & { error?: string }
      if (!response.ok) throw new Error(body.error ?? "The forecast could not be loaded")
      setData(body)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The forecast could not be loaded")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const fromUrl = new URLSearchParams(window.location.search).get("city")
      const stored = fromUrl ?? window.localStorage.getItem(STORAGE_KEY)
      if (stored) setChosenId(stored)
      void load(false)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  function choose(id: string) {
    setChosenId(id)
    window.localStorage.setItem(STORAGE_KEY, id)
    const url = new URL(window.location.href)
    url.searchParams.set("city", id)
    window.history.replaceState(null, "", url)
  }

  function locate() {
    if (!data) return
    if (!("geolocation" in navigator)) {
      setLocationNote("This browser cannot share your location. Pick a place from the list instead.")
      return
    }
    setLocating(true)
    setLocationNote(null)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false)
        const found = nearestCity(data.cities, position.coords.latitude, position.coords.longitude)
        if (!found) return
        if (found.km > 400) {
          setLocationNote("You seem to be outside mainland India. Pick a place from the list.")
          return
        }
        choose(found.city.id)
        setLocationNote(
          found.km > 120
            ? `The nearest forecast point is ${found.city.name}, about ${Math.round(found.km)} km away. Rain at your farm can differ.`
            : `Showing ${found.city.name}, about ${Math.round(found.km)} km from you.`,
        )
      },
      () => {
        setLocating(false)
        setLocationNote("Location was not shared. Pick a place from the list instead.")
      },
      { timeout: 10_000, maximumAge: 600_000 },
    )
  }

  const ranked = useMemo(() => {
    if (!data) return []
    return [...data.cities].sort(
      (a, b) => (b.views["72h"].heavy.probability ?? -1) - (a.views["72h"].heavy.probability ?? -1),
    )
  }, [data])

  const city = useMemo(() => {
    if (!data) return null
    return data.cities.find((item) => item.id === chosenId) ?? ranked[0] ?? null
  }, [chosenId, data, ranked])

  const items = useMemo(
    () =>
      [...(data?.cities ?? [])]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((item) => ({ value: item.id, label: `${item.name}, ${item.state}` })),
    [data],
  )

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl flex-wrap items-end justify-between gap-3 px-4 py-3">
          <div>
            <p className="font-heading text-[1.7rem] leading-none italic">Varsha</p>
            <p className="mt-1 text-[11px] tracking-[0.18em] text-muted-foreground uppercase">Heavy rain guide</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => void load(true)} disabled={loading}>
              <RefreshCw className={loading ? "animate-spin" : ""} />
              Refresh
            </Button>
            <Link href="/" className={buttonVariants({ variant: "ghost", size: "sm" })}>
              Detailed desk
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-5 px-4 py-5">
        <section className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Select
            items={items}
            value={city?.id ?? null}
            onValueChange={(value) => {
              if (typeof value === "string") choose(value)
            }}
            disabled={!data}
          >
            <SelectTrigger className="h-11 w-full text-base sm:flex-1" aria-label="Choose your area">
              <SelectValue placeholder="Choose your area" />
            </SelectTrigger>
            <SelectContent>
              {items.map((item) => (
                <SelectItem key={item.value} value={item.value} className="py-2 text-base">
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" className="h-11 text-base" onClick={locate} disabled={!data || locating}>
            <LocateFixed className={locating ? "animate-pulse" : ""} />
            {locating ? "Finding you…" : "Use my location"}
          </Button>
        </section>
        {locationNote && <p className="-mt-2 text-sm text-muted-foreground">{locationNote}</p>}
        {data && !chosenId && city && (
          <p className="-mt-2 text-sm text-muted-foreground">
            Showing the place with the highest heavy-rain risk right now. Choose your area above.
          </p>
        )}

        {error && (
          <div className="rounded-xl border border-vermillion/40 px-4 py-3 text-base text-vermillion">
            {error}. Check your internet connection and press Refresh.
          </div>
        )}

        {loading && !data && <LoadingCards />}

        {data && city && <CityGuide data={data} city={city} />}

        {data && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Across mainland India, next 3 days</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-border">
                {ranked.map((item) => {
                  const level = riskLevel(item.views["72h"].heavy.probability)
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => {
                          choose(item.id)
                          window.scrollTo({ top: 0, behavior: "smooth" })
                        }}
                        className={`flex w-full items-center justify-between gap-3 px-1 py-2.5 text-left hover:bg-muted ${
                          item.id === city?.id ? "bg-accent" : ""
                        }`}
                      >
                        <span>
                          <span className="block text-base">{item.name}</span>
                          <span className="block text-xs text-muted-foreground">{item.state}</span>
                        </span>
                        <RiskPill level={level} />
                      </button>
                    </li>
                  )
                })}
              </ul>
            </CardContent>
          </Card>
        )}

        {data && (
          <footer className="space-y-3 pb-6 text-sm leading-6 text-muted-foreground">
            <p>
              <span className="text-paper">This is guidance, not an official warning.</span> For warnings in your
              district, follow the{" "}
              <a className="underline underline-offset-4" href="https://mausam.imd.gov.in/" target="_blank" rel="noreferrer">
                India Meteorological Department
              </a>
              , the Meghdoot app for farm advisories, and your local authorities.
            </p>
            <p>
              How it works: Varsha reads 80 runs of the European (ECMWF) and American (NCEP) weather models and counts how
              many show heavy rain. It checks recent rain from NASA satellite-based estimates, compares with 30 years of
              past weather (ERA5), and looks ahead with climate model projections (CMIP6). Each forecast point stands for
              the area around a city, not a single field.
            </p>
            <p>Updated {formatIssued(data.generatedAt)} IST.</p>
          </footer>
        )}
      </main>
    </div>
  )
}

function CityGuide({ data, city }: { data: DeskResponse; city: CityDesk }) {
  const top = headline(city)
  const ground = groundStatus(city)
  const advice = adviceFor(city, ground)
  const future = futureOutlook(data, city)
  const history = sameWeekHistory(city)
  const agree = agreement(city)
  const week = weekLine(city)

  return (
    <>
      <section
        className="rounded-xl bg-card px-4 py-5 ring-1 ring-foreground/10"
        style={{ borderLeft: `6px solid ${RISK_COLOR[top.level]}` }}
        aria-live="polite"
      >
        <p className="text-sm text-muted-foreground">
          {city.name}, {city.state}
        </p>
        <h1 className="mt-1 font-heading text-2xl leading-tight sm:text-3xl">{top.title}</h1>
        <p className="mt-3 text-base leading-7">{top.detail}</p>
        {week && <p className="mt-2 text-base leading-7">{week}</p>}
        {agree && <p className="mt-2 text-sm leading-6 text-muted-foreground">{agree}</p>}
      </section>

      {city.days.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Day by day</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-7">
              {city.days.map((day) => {
                const kind = dayKind(day)
                return (
                  <li key={day.date} className="rounded-lg bg-muted/60 px-2.5 py-2.5">
                    <p className="text-sm font-medium">{weekdayOf(day.date)}</p>
                    <p className="text-xs text-muted-foreground">{formatDay(day.date)}</p>
                    <span className="mt-2 block h-1.5 rounded-full" style={{ background: DAY_COLOR[kind] }} />
                    <p className="mt-2 text-sm leading-5">{DAY_WORDS[kind]}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Rain chance {day.rainChance == null ? "—" : `${Math.round(day.rainChance * 100)}%`}
                    </p>
                    <p className="text-xs text-muted-foreground">{roundedMm(day.medianMm)}</p>
                  </li>
                )
              })}
            </ol>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              Rain chance means at least 2.5 mm in the day. The amount is a middle estimate; storms can bring much more
              in one spot.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">What to do</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="farm">
            <TabsList>
              <TabsTrigger value="farm">On the farm</TabsTrigger>
              <TabsTrigger value="business">Business and travel</TabsTrigger>
            </TabsList>
            <TabsContent value="farm">
              <AdviceList items={advice.farm} />
            </TabsContent>
            <TabsContent value="business">
              <AdviceList items={advice.business} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <div className="grid gap-5 sm:grid-cols-2">
        <InfoCard title={ground ? ground.title : "Recent rain"}>
          {ground ? (
            <>
              <p>{ground.detail}</p>
              {ground.asOf && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Satellite-based estimate up to {ground.asOf}. It runs a few days behind.
                </p>
              )}
            </>
          ) : (
            <p className="text-muted-foreground">Recent satellite rain estimates are not available for this place.</p>
          )}
        </InfoCard>
        <InfoCard title="Is this normal?">
          <p>{typicalYear(city)}</p>
          {history && <p className="mt-2">{history}</p>}
          <p className="mt-2 text-xs text-muted-foreground">Heavy rain means 6.5 cm (65 mm) or more in one day.</p>
        </InfoCard>
      </div>

      {future.length > 0 && (
        <InfoCard title="Looking ahead: the 2030s and 2040s">
          {future.map((item) => (
            <div key={item.title} className="mb-3">
              <p className="text-xs text-muted-foreground">{item.title}</p>
              <p className="mt-1">{item.detail}</p>
            </div>
          ))}
          <p className="mt-2 text-xs text-muted-foreground">
            This is for long-term planning, such as crop choice, drainage, and storage. It says nothing about this week.
          </p>
        </InfoCard>
      )}

      {data.season.note && (
        <p className="text-sm leading-6 text-muted-foreground">
          <span className="text-paper">{data.season.title}.</span> {plainSeason(data.season.id)}
        </p>
      )}
    </>
  )
}

function weekdayOf(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number)
  return new Intl.DateTimeFormat("en-IN", { weekday: "long", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, day)),
  )
}

function plainSeason(id: string): string {
  switch (id) {
    case "sw":
      return "This is the main monsoon season. Heavy rain is most common now, especially on the west coast, in central India, and in the northeast."
    case "ne":
      return "The main monsoon has left most of India. Tamil Nadu, south Andhra Pradesh, and nearby coasts still get their rainy season now, and cyclones can bring very heavy rain."
    case "winter":
      return "Heavy rain is uncommon now. The far north can still get rain and snow from winter storms."
    default:
      return "Before the monsoon, short but violent thunderstorms can bring heavy rain, hail, and strong wind to small areas."
  }
}

function RiskPill({ level }: { level: keyof typeof RISK_WORDS }) {
  return (
    <span className="flex shrink-0 items-center gap-2 text-sm">
      <span className="inline-block size-2.5 rounded-full" style={{ background: RISK_COLOR[level] }} />
      {RISK_WORDS[level]}
    </span>
  )
}

function AdviceList({ items }: { items: string[] }) {
  return (
    <ul className="mt-3 space-y-2.5">
      {items.map((item) => (
        <li key={item} className="flex gap-3 text-base leading-7">
          <span className="mt-2.5 inline-block size-1.5 shrink-0 rounded-full bg-saffron" />
          {item}
        </li>
      ))}
    </ul>
  )
}

function InfoCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-base leading-7">{children}</CardContent>
    </Card>
  )
}

function LoadingCards() {
  return (
    <div className="space-y-5" aria-busy="true">
      <div className="rounded-xl bg-card px-4 py-5 ring-1 ring-foreground/10">
        <div className="h-4 w-32 animate-pulse rounded bg-muted" />
        <div className="mt-3 h-8 w-3/4 animate-pulse rounded bg-muted" />
        <div className="mt-4 h-4 w-full animate-pulse rounded bg-muted" />
        <div className="mt-2 h-4 w-2/3 animate-pulse rounded bg-muted" />
      </div>
      <p className="text-center text-sm text-muted-foreground">
        Getting the latest weather model runs and satellite rain for 21 places. The first load takes a few seconds.
      </p>
    </div>
  )
}
