"use client"

import { RefreshCw } from "lucide-react"
import Link from "next/link"
import { useEffect, useMemo, useState, type ReactNode } from "react"

import {
  AirAcrossIndia,
  AirWeek,
  Alerts,
  BestDays,
  Calendar,
  DayDetail,
  Insights,
  Section,
  StageTimeline,
  WeatherTable,
} from "@/components/farm-parts"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { buildPlan } from "@/lib/agro/advisor"
import { CROPS, cropById } from "@/lib/agro/crops"
import type { FarmResponse } from "@/lib/agro/types"
import { formatIssued, todayInKolkata } from "@/lib/dates"
import { CITIES } from "@/lib/domain"
import type { DeskResponse } from "@/lib/types"

const CITY_KEY = "varsha.city"
const FARM_KEY = "varsha.farm"

type Setup = { city: string; crop: string; sown: string; irrigated: string }

function defaultCrop(): string {
  const month = Number(todayInKolkata().slice(5, 7))
  return month >= 5 && month <= 8 ? "rice" : "wheat"
}

function readSetup(): Setup {
  const params = new URLSearchParams(window.location.search)
  let stored: Partial<Setup> = {}
  try {
    stored = JSON.parse(window.localStorage.getItem(FARM_KEY) ?? "{}") as Partial<Setup>
  } catch {
    stored = {}
  }
  const city = params.get("city") ?? stored.city ?? window.localStorage.getItem(CITY_KEY) ?? "delhi"
  return {
    city: CITIES.some((item) => item.id === city) ? city : "delhi",
    crop: cropById(params.get("crop") ?? stored.crop)?.id ?? defaultCrop(),
    sown: params.get("sown") ?? stored.sown ?? "",
    irrigated: params.get("irrigated") ?? stored.irrigated ?? "",
  }
}

const CITY_ITEMS = [...CITIES]
  .sort((a, b) => a.name.localeCompare(b.name))
  .map((city) => ({ value: city.id, label: `${city.name}, ${city.state}` }))
const CROP_ITEMS = CROPS.map((crop) => ({ value: crop.id, label: `${crop.name} (${crop.local}) · ${crop.season}` }))

export function FarmPlanner() {
  const [setup, setSetup] = useState<Setup | null>(null)
  const [farm, setFarm] = useState<FarmResponse | null>(null)
  const [desk, setDesk] = useState<DeskResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => setSetup(readSetup()), 0)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!setup) return
    window.localStorage.setItem(FARM_KEY, JSON.stringify(setup))
    window.localStorage.setItem(CITY_KEY, setup.city)
    const url = new URL(window.location.href)
    for (const [key, value] of Object.entries(setup)) {
      if (value) url.searchParams.set(key, value)
      else url.searchParams.delete(key)
    }
    window.history.replaceState(null, "", url)
  }, [setup])

  const cityId = setup?.city ?? null

  async function load(id: string, refresh = false) {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/farm?city=${id}${refresh ? "&refresh=1" : ""}`, { cache: "no-store" })
      const body = (await response.json()) as FarmResponse & { error?: string }
      if (!response.ok) throw new Error(body.error ?? "Farm weather could not be loaded")
      setFarm(body)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Farm weather could not be loaded")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!cityId) return
    const timer = window.setTimeout(() => void load(cityId), 0)
    return () => window.clearTimeout(timer)
  }, [cityId])

  useEffect(() => {
    let cancelled = false
    fetch("/api/forecast", { cache: "no-store" })
      .then((response) => (response.ok ? (response.json() as Promise<DeskResponse>) : null))
      .then((body) => {
        if (!cancelled && body) setDesk(body)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  const crop = cropById(setup?.crop) ?? CROPS[0]
  const plan = useMemo(() => {
    if (!farm || !setup || farm.point.id !== setup.city) return null
    const heavy = desk?.cities.find((city) => city.id === setup.city)?.days
    return buildPlan({
      point: farm.point,
      crop,
      sownOn: setup.sown || null,
      today: farm.today,
      lastIrrigated: setup.irrigated || null,
      heavyChance: heavy ? new Map(heavy.map((day) => [day.date, day.heavyChance])) : undefined,
    })
  }, [crop, desk, farm, setup])

  const activeDate = plan?.days.some((day) => day.date === selectedDate) ? selectedDate : plan?.days[0]?.date ?? null
  const activeDay = plan?.days.find((day) => day.date === activeDate) ?? null
  const update = (patch: Partial<Setup>) => setSetup((current) => (current ? { ...current, ...patch } : current))
  const today = farm?.today ?? todayInKolkata()
  const cityName = CITIES.find((item) => item.id === cityId)?.name

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-3 px-4 py-3">
          <div>
            <p className="font-heading text-[1.7rem] leading-none italic">Varsha</p>
            <p className="mt-1 text-[11px] tracking-[0.18em] text-muted-foreground uppercase">Farm planner</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => cityId && void load(cityId, true)} disabled={loading || !cityId}>
              <RefreshCw className={loading ? "animate-spin" : ""} />
              Refresh
            </Button>
            <Link href="/simple" className={buttonVariants({ variant: "ghost", size: "sm" })}>
              Rain guide
            </Link>
            <Link href="/" className={buttonVariants({ variant: "ghost", size: "sm" })}>
              Detailed desk
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-5 px-4 py-5">
        <section className="grid gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Place">
            <Select items={CITY_ITEMS} value={setup?.city ?? null} onValueChange={(value) => typeof value === "string" && update({ city: value })}>
              <SelectTrigger className="h-10 w-full" aria-label="Place">
                <SelectValue placeholder="Choose a place" />
              </SelectTrigger>
              <SelectContent>
                {CITY_ITEMS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Crop">
            <Select items={CROP_ITEMS} value={setup?.crop ?? null} onValueChange={(value) => typeof value === "string" && update({ crop: value })}>
              <SelectTrigger className="h-10 w-full" aria-label="Crop">
                <SelectValue placeholder="Choose a crop" />
              </SelectTrigger>
              <SelectContent>
                {CROP_ITEMS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={`${crop.startLabel[0].toUpperCase()}${crop.startLabel.slice(1)} date`}>
            <div className="flex gap-2">
              <Input
                type="date"
                className="h-10"
                value={setup?.sown ?? ""}
                max={addYears(today, 1)}
                onChange={(event) => update({ sown: event.target.value })}
                aria-label={`${crop.startLabel} date`}
              />
              {setup?.sown && (
                <Button variant="ghost" className="h-10" onClick={() => update({ sown: "" })}>
                  Not sown
                </Button>
              )}
            </div>
          </Field>
          <Field label="Last irrigated (optional)">
            <div className="flex gap-2">
              <Input
                type="date"
                className="h-10"
                value={setup?.irrigated ?? ""}
                max={today}
                onChange={(event) => update({ irrigated: event.target.value })}
                aria-label="Last irrigated"
              />
              {setup?.irrigated && (
                <Button variant="ghost" className="h-10" onClick={() => update({ irrigated: "" })}>
                  Clear
                </Button>
              )}
            </div>
          </Field>
          <p className="text-xs leading-5 text-muted-foreground sm:col-span-2 lg:col-span-4">
            Leave the {crop.startLabel} date empty to plan sowing. Soil moisture comes from a weather model that does not know
            about your own irrigation, so adding the last irrigation date keeps the water advice honest.
          </p>
        </section>

        {error && (
          <div className="rounded-xl border border-vermillion/40 px-4 py-3 text-sm text-vermillion">
            {error}. Check your connection and press Refresh.
          </div>
        )}

        {!plan && !error && (
          <div className="space-y-3 rounded-xl bg-card p-5 ring-1 ring-foreground/10" aria-busy="true">
            <div className="h-5 w-1/3 animate-pulse rounded bg-muted" />
            <div className="h-4 w-full animate-pulse rounded bg-muted" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
            <p className="pt-2 text-sm text-muted-foreground">
              Reading hourly weather, soil moisture, and air quality{cityName ? ` for ${cityName}` : ""}.
            </p>
          </div>
        )}

        {plan && farm && (
          <>
            <Section title={`This week for your ${crop.name.toLowerCase()} near ${farm.point.name}`}>
              <Insights plan={plan} />
            </Section>

            <Section title="Best day for each job">
              <BestDays plan={plan} />
            </Section>

            <Section
              title="Day-by-day plan"
              action={<span className="text-xs text-muted-foreground">Select a day for the reasons</span>}
            >
              <Calendar plan={plan} selected={activeDate} onSelect={setSelectedDate} />
              {activeDay && (
                <div className="mt-4 border-t border-border pt-4">
                  <DayDetail day={activeDay} />
                </div>
              )}
            </Section>

            <div className="grid gap-5 lg:grid-cols-2">
              <Section title="Crop stage">
                <StageTimeline plan={plan} today={today} />
              </Section>
              <Section title="Alerts">
                <Alerts plan={plan} />
              </Section>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <Section title="Air pollution and crop stress">
                <AirWeek days={plan.days} />
              </Section>
              <Section title="Weather behind the plan">
                <WeatherTable days={plan.days} />
              </Section>
            </div>

            <Section title="Air quality across mainland India today">
              <AirAcrossIndia overview={farm.overview} selectedId={farm.point.id} onSelect={(id) => update({ city: id })} />
            </Section>

            <footer className="space-y-2 pb-6 text-xs leading-5 text-muted-foreground">
              <p>
                Hourly weather, soil moisture, and evaporation come from the Open-Meteo forecast (ECMWF and NCEP models). Air
                quality comes from the Copernicus CAMS global forecast. The heavy-rain chance comes from the 80-member ensemble
                on the detailed desk. Crop stages, water use, and thresholds are typical values for Indian varieties under
                medium loam soil; your variety, soil, and local practice can shift them by days.
              </p>
              <p>
                This is planning guidance, not a prescription. Follow the label for any pesticide, and check your district
                agromet advisory (Meghdoot app) and Krishi Vigyan Kendra for local recommendations.
              </p>
              <p>
                Updated {formatIssued(farm.generatedAt)} IST{farm.errors.length ? ` · ${farm.errors.join(" · ")}` : ""}.
              </p>
            </footer>
          </>
        )}
      </main>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] tracking-[0.14em] text-muted-foreground uppercase">{label}</p>
      {children}
    </div>
  )
}

function addYears(iso: string, years: number): string {
  return `${Number(iso.slice(0, 4)) + years}${iso.slice(4)}`
}
