"use client"

import { LocateFixed, RefreshCw } from "lucide-react"
import Link from "next/link"
import { useEffect, useMemo, useState, type ReactNode } from "react"

import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { LanguagePicker, TranslationNote, useLanguage } from "@/components/language"
import type { Translator } from "@/lib/i18n"
import {
  RISK_COLOR,
  adviceFor,
  agreement,
  dayKind,
  dayWord,
  futureOutlook,
  groundStatus,
  headline,
  nearestCity,
  placeName,
  riskLevel,
  riskWord,
  roundedMm,
  sameWeekHistory,
  stateName,
  typicalYear,
  weekLine,
  type DayKind,
  type RiskLevel,
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
  const { tr } = useLanguage()
  const [data, setData] = useState<DeskResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [chosenId, setChosenId] = useState<string | null>(null)
  const [locating, setLocating] = useState(false)
  const [locationNote, setLocationNote] = useState<((tr: Translator) => string) | null>(null)

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
      setLocationNote(() => (t: Translator) => t.t("simple.locUnsupported"))
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
          setLocationNote(() => (t: Translator) => t.t("simple.locOutside"))
          return
        }
        choose(found.city.id)
        const { id, name } = found.city
        const km = Math.round(found.km)
        setLocationNote(() => (t: Translator) =>
          t.t(found.km > 120 ? "simple.locFar" : "simple.locNear", { city: placeName(id, name, t), km }),
        )
      },
      () => {
        setLocating(false)
        setLocationNote(() => (t: Translator) => t.t("simple.locDenied"))
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
      (data?.cities ?? [])
        .map((item) => ({
          value: item.id,
          label: `${placeName(item.id, item.name, tr)}, ${stateName(item.state, tr)}`,
        }))
        .sort((a, b) => a.label.localeCompare(b.label, tr.locale)),
    [data, tr],
  )

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl flex-wrap items-end justify-between gap-3 px-4 py-3">
          <div>
            <p className="font-heading text-[1.7rem] leading-none italic">Varsha</p>
            <p className="mt-1 text-[11px] tracking-[0.18em] text-muted-foreground uppercase">{tr.t("app.rainTagline")}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <LanguagePicker />
            <Button variant="outline" size="sm" onClick={() => void load(true)} disabled={loading}>
              <RefreshCw className={loading ? "animate-spin" : ""} />
              {tr.t("ui.refresh")}
            </Button>
            <Link href="/farm" className={buttonVariants({ variant: "outline", size: "sm" })}>
              {tr.t("nav.farm")}
            </Link>
            <Link href="/" className={buttonVariants({ variant: "ghost", size: "sm" })}>
              {tr.t("nav.desk")}
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-5 px-4 py-5">
        <TranslationNote />
        <section className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Select
            items={items}
            value={city?.id ?? null}
            onValueChange={(value) => {
              if (typeof value === "string") choose(value)
            }}
            disabled={!data}
          >
            <SelectTrigger className="h-11 w-full text-base sm:flex-1" aria-label={tr.t("simple.chooseArea")}>
              <SelectValue placeholder={tr.t("simple.chooseArea")} />
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
            {locating ? tr.t("simple.locating") : tr.t("simple.useLocation")}
          </Button>
        </section>
        {locationNote && <p className="-mt-2 text-sm text-muted-foreground">{locationNote(tr)}</p>}
        {data && !chosenId && city && (
          <p className="-mt-2 text-sm text-muted-foreground">{tr.t("simple.showingTop")}</p>
        )}

        {error && (
          <div className="rounded-xl border border-vermillion/40 px-4 py-3 text-base text-vermillion">
            {tr.t("simple.loadError")}
          </div>
        )}

        {loading && !data && <LoadingCards tr={tr} />}

        {data && city && <CityGuide data={data} city={city} tr={tr} />}

        {data && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{tr.t("simple.across")}</CardTitle>
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
                          <span className="block text-base">{placeName(item.id, item.name, tr)}</span>
                          <span className="block text-xs text-muted-foreground">{stateName(item.state, tr)}</span>
                        </span>
                        <RiskPill level={level} tr={tr} />
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
              <span className="text-paper">{tr.t("simple.guidance")}</span> {tr.t("simple.follow")}
            </p>
            <p>{tr.t("simple.how")}</p>
            <p>{tr.t("simple.updated", { time: tr.issued(data.generatedAt) })}</p>
          </footer>
        )}
      </main>
    </div>
  )
}

function CityGuide({ data, city, tr }: { data: DeskResponse; city: CityDesk; tr: Translator }) {
  const top = headline(city, tr)
  const ground = groundStatus(city, tr)
  const advice = adviceFor(city, ground, tr)
  const future = futureOutlook(data, city, tr)
  const history = sameWeekHistory(city, tr)
  const agree = agreement(city, tr)
  const week = weekLine(city, tr)

  return (
    <>
      <section
        className="rounded-xl bg-card px-4 py-5 ring-1 ring-foreground/10"
        style={{ borderLeft: `6px solid ${RISK_COLOR[top.level]}` }}
        aria-live="polite"
      >
        <p className="text-sm text-muted-foreground">
          {placeName(city.id, city.name, tr)}, {stateName(city.state, tr)}
        </p>
        <h1 className="mt-1 font-heading text-2xl leading-tight sm:text-3xl">{top.title}</h1>
        <p className="mt-3 text-base leading-7">{top.detail}</p>
        {week && <p className="mt-2 text-base leading-7">{week}</p>}
        {agree && <p className="mt-2 text-sm leading-6 text-muted-foreground">{agree}</p>}
      </section>

      {city.days.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{tr.t("simple.dayByDay")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-7">
              {city.days.map((day) => {
                const kind = dayKind(day)
                return (
                  <li key={day.date} className="rounded-lg bg-muted/60 px-2.5 py-2.5">
                    <p className="text-sm font-medium">{tr.weekday(day.date, "long")}</p>
                    <p className="text-xs text-muted-foreground">{tr.date(day.date)}</p>
                    <span className="mt-2 block h-1.5 rounded-full" style={{ background: DAY_COLOR[kind] }} />
                    <p className="mt-2 text-sm leading-5">{dayWord(kind, tr)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {tr.t("simple.rainChance", {
                        pct: day.rainChance == null ? tr.t("common.dash") : `${Math.round(day.rainChance * 100)}%`,
                      })}
                    </p>
                    <p className="text-xs text-muted-foreground">{roundedMm(day.medianMm, tr)}</p>
                  </li>
                )
              })}
            </ol>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">{tr.t("simple.dayNote")}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{tr.t("simple.whatToDo")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="farm">
            <TabsList>
              <TabsTrigger value="farm">{tr.t("simple.tabFarm")}</TabsTrigger>
              <TabsTrigger value="business">{tr.t("simple.tabBusiness")}</TabsTrigger>
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
        <InfoCard title={ground ? ground.title : tr.t("simple.recentRain")}>
          {ground ? (
            <>
              <p>{ground.detail}</p>
              {ground.asOf && (
                <p className="mt-2 text-xs text-muted-foreground">{tr.t("simple.satAsOf", { date: ground.asOf })}</p>
              )}
            </>
          ) : (
            <p className="text-muted-foreground">{tr.t("simple.noSat")}</p>
          )}
        </InfoCard>
        <InfoCard title={tr.t("simple.normal")}>
          <p>{typicalYear(city, tr)}</p>
          {history && <p className="mt-2">{history}</p>}
          <p className="mt-2 text-xs text-muted-foreground">{tr.t("simple.heavyDef")}</p>
        </InfoCard>
      </div>

      {future.length > 0 && (
        <InfoCard title={tr.t("simple.ahead")}>
          {future.map((item) => (
            <div key={item.title} className="mb-3">
              <p className="text-xs text-muted-foreground">{item.title}</p>
              <p className="mt-1">{item.detail}</p>
            </div>
          ))}
          <p className="mt-2 text-xs text-muted-foreground">{tr.t("simple.aheadNote")}</p>
        </InfoCard>
      )}

      {data.season.note && (
        <p className="text-sm leading-6 text-muted-foreground">
          <span className="text-paper">{tr.t(`seasonTitle.${seasonId(data.season.id)}`)}.</span>{" "}
          {tr.t(`seasonNote.${seasonId(data.season.id)}`)}
        </p>
      )}
    </>
  )
}

function seasonId(id: string): "sw" | "ne" | "winter" | "pre" {
  return id === "sw" || id === "ne" || id === "winter" ? id : "pre"
}

function RiskPill({ level, tr }: { level: RiskLevel; tr: Translator }) {
  return (
    <span className="flex shrink-0 items-center gap-2 text-sm">
      <span className="inline-block size-2.5 rounded-full" style={{ background: RISK_COLOR[level] }} />
      {riskWord(level, tr)}
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

function LoadingCards({ tr }: { tr: Translator }) {
  return (
    <div className="space-y-5" aria-busy="true">
      <div className="rounded-xl bg-card px-4 py-5 ring-1 ring-foreground/10">
        <div className="h-4 w-32 animate-pulse rounded bg-muted" />
        <div className="mt-3 h-8 w-3/4 animate-pulse rounded bg-muted" />
        <div className="mt-4 h-4 w-full animate-pulse rounded bg-muted" />
        <div className="mt-2 h-4 w-2/3 animate-pulse rounded bg-muted" />
      </div>
      <p className="text-center text-sm text-muted-foreground">{tr.t("simple.loading")}</p>
    </div>
  )
}
