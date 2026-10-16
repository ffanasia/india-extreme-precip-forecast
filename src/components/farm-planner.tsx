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
  WhatGrows,
} from "@/components/farm-parts"
import { LanguagePicker, TranslationNote, useLanguage } from "@/components/language"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { buildPlan } from "@/lib/agro/advisor"
import { CROPS, cropById, cropName, cropSeason } from "@/lib/agro/crops"
import { suggestCrops } from "@/lib/agro/regions"
import type { FarmResponse } from "@/lib/agro/types"
import { todayInKolkata } from "@/lib/dates"
import { CITIES } from "@/lib/domain"
import { placeName, stateName } from "@/lib/plain"
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


export function FarmPlanner() {
  const { tr } = useLanguage()
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
      setError(caught instanceof Error ? caught.message : "Farm weather could not be loaded")    } finally {
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
      tr,
    })
  }, [crop, desk, farm, setup, tr])

  const cityItems = useMemo(
    () =>
      CITIES.map((city) => ({ value: city.id, label: `${placeName(city.id, city.name, tr)}, ${stateName(city.state, tr)}` })).sort(
        (a, b) => a.label.localeCompare(b.label, tr.locale),
      ),
    [tr],
  )
  const cropItems = useMemo(
    () =>
      CROPS.map((item) => ({
        value: item.id,
        label:
          tr.lang === "en"
            ? `${item.name} (${item.local}) · ${item.season}`
            : `${cropName(item, tr)} · ${cropSeason(item, tr)}`,
      })),
    [tr],
  )

  const annualRain = desk?.cities.find((city) => city.id === cityId)?.era5.meanAnnual ?? null
  const suggestions = useMemo(() => {
    if (!cityId || !farm) return null
    const temps = plan?.days.map((day) => day.weather.tMean).filter((value): value is number => value != null) ?? []
    const meanTemp = temps.length ? temps.reduce((sum, value) => sum + value, 0) / temps.length : null
    return suggestCrops(cityId, Number(farm.today.slice(5, 7)), meanTemp, annualRain)
  }, [annualRain, cityId, farm, plan])

  const activeDate = plan?.days.some((day) => day.date === selectedDate) ? selectedDate : plan?.days[0]?.date ?? null
  const activeDay = plan?.days.find((day) => day.date === activeDate) ?? null
  const update = (patch: Partial<Setup>) => setSetup((current) => (current ? { ...current, ...patch } : current))
  const today = farm?.today ?? null
  const cityRecord = CITIES.find((item) => item.id === cityId)
  const cityName = cityRecord ? placeName(cityRecord.id, cityRecord.name, tr) : null
  const startLabel = crop.startLabel

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-3 px-4 py-3">
          <div>
            <p className="font-heading text-[1.7rem] leading-none italic">Varsha</p>
            <p className="mt-1 text-[11px] tracking-[0.18em] text-muted-foreground uppercase">{tr.t("app.farmTagline")}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <LanguagePicker />
            <Button variant="outline" size="sm" onClick={() => cityId && void load(cityId, true)} disabled={loading || !cityId}>
              <RefreshCw className={loading ? "animate-spin" : ""} />
              {tr.t("ui.refresh")}
            </Button>
            <Link href="/simple" className={buttonVariants({ variant: "ghost", size: "sm" })}>
              {tr.t("nav.rain")}
            </Link>
            <Link href="/" className={buttonVariants({ variant: "ghost", size: "sm" })}>
              {tr.t("nav.desk")}
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-5 px-4 py-5">
        <TranslationNote />
        <section className="grid gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:grid-cols-2 lg:grid-cols-4">
          <Field label={tr.t("farm.place")}>
            <Select items={cityItems} value={setup?.city ?? null} onValueChange={(value) => typeof value === "string" && update({ city: value })}>
              <SelectTrigger className="h-10 w-full" aria-label={tr.t("farm.place")}>
                <SelectValue placeholder={tr.t("farm.choosePlace")} />
              </SelectTrigger>
              <SelectContent>
                {cityItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={tr.t("farm.crop")}>
            <Select items={cropItems} value={setup?.crop ?? null} onValueChange={(value) => typeof value === "string" && update({ crop: value })}>
              <SelectTrigger className="h-10 w-full" aria-label={tr.t("farm.crop")}>
                <SelectValue placeholder={tr.t("farm.chooseCrop")} />
              </SelectTrigger>
              <SelectContent>
                {cropItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={tr.t(`field.${startLabel}`)}>
            <div className="flex gap-2">
              <Input
                type="date"
                className="h-10"
                value={setup?.sown ?? ""}
                max={today ? addYears(today, 1) : undefined}
                onChange={(event) => update({ sown: event.target.value })}
                aria-label={tr.t(`field.${startLabel}`)}
              />
              {setup?.sown && (
                <Button variant="ghost" className="h-10" onClick={() => update({ sown: "" })}>
                  {tr.t("farm.notSown")}
                </Button>
              )}
            </div>
          </Field>
          <Field label={tr.t("farm.lastIrrigated")}>
            <div className="flex gap-2">
              <Input
                type="date"
                className="h-10"
                value={setup?.irrigated ?? ""}
                max={today ?? undefined}
                onChange={(event) => update({ irrigated: event.target.value })}
                aria-label={tr.t("farm.lastIrrigated")}
              />
              {setup?.irrigated && (
                <Button variant="ghost" className="h-10" onClick={() => update({ irrigated: "" })}>
                  {tr.t("farm.clear")}
                </Button>
              )}
            </div>
          </Field>
          <p className="text-xs leading-5 text-muted-foreground sm:col-span-2 lg:col-span-4">{tr.t("farm.setupNote")}</p>
        </section>

        {error && (
          <div className="rounded-xl border border-vermillion/40 px-4 py-3 text-sm text-vermillion">
            {tr.t("farm.loadError")}
          </div>
        )}

        {!plan && !error && (
          <div className="space-y-3 rounded-xl bg-card p-5 ring-1 ring-foreground/10" aria-busy="true">
            <div className="h-5 w-1/3 animate-pulse rounded bg-muted" />
            <div className="h-4 w-full animate-pulse rounded bg-muted" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
            <p className="pt-2 text-sm text-muted-foreground">{tr.t("farm.loading", { city: cityName ?? "" })}</p>
          </div>
        )}

        {plan && farm && (
          <>
            <Section
              title={tr.t("farm.thisWeek", {
                crop: tr.lower(cropName(crop, tr)),
                city: placeName(farm.point.id, farm.point.name, tr),
              })}
            >
              <Insights plan={plan} />
            </Section>

            <Section title={tr.t("farm.bestJobs")}>
              <BestDays plan={plan} tr={tr} />
            </Section>

            <Section
              title={tr.t("farm.dayPlan")}
              action={<span className="text-xs text-muted-foreground">{tr.t("farm.selectDay")}</span>}
            >
              <Calendar plan={plan} selected={activeDate} onSelect={setSelectedDate} tr={tr} />
              {activeDay && (
                <div className="mt-4 border-t border-border pt-4">
                  <DayDetail day={activeDay} crop={crop} tr={tr} />
                </div>
              )}
            </Section>

            <div className="grid gap-5 lg:grid-cols-2">
              <Section title={tr.t("farm.stage")}>
                <StageTimeline plan={plan} today={farm.today} tr={tr} />
              </Section>
              <Section title={tr.t("farm.alerts")}>
                <Alerts plan={plan} tr={tr} />
              </Section>
            </div>

            {suggestions && (
              <Section title={tr.t("grow.title", { city: placeName(farm.point.id, farm.point.name, tr) })}>
                <WhatGrows
                  suggestions={suggestions}
                  annualRainMm={annualRain}
                  currentCrop={crop.id}
                  onPlan={(id) => {
                    update({ crop: id, sown: "", irrigated: "" })
                    window.scrollTo({ top: 0, behavior: "smooth" })
                  }}
                  tr={tr}
                />
              </Section>
            )}

            <div className="grid gap-5 lg:grid-cols-2">
              <Section title={tr.t("farm.air")}>
                <AirWeek days={plan.days} tr={tr} />
              </Section>
              <Section title={tr.t("farm.weather")}>
                <WeatherTable days={plan.days} tr={tr} />
              </Section>
            </div>

            <Section title={tr.t("farm.airIndia")}>
              <AirAcrossIndia overview={farm.overview} selectedId={farm.point.id} onSelect={(id) => update({ city: id })} tr={tr} />
            </Section>

            <footer className="space-y-2 pb-6 text-xs leading-5 text-muted-foreground">
              <p>{tr.t("farm.sources")}</p>
              <p>{tr.t("farm.disclaimer")}</p>
              <p>
                {tr.t("farm.updated", { time: tr.issued(farm.generatedAt) })}
                {farm.errors.length ? ` · ${farm.errors.join(" · ")}` : ""}
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
