import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { addDays } from "../dates"
import { aqiCategory, dailyAot40, particleAqi, subIndex, summariseAirDay } from "./air"
import { buildPlan, formatHourRange, longestRun, sprayHour, wetHours } from "./advisor"
import { CROPS, cropById, stageOn } from "./crops"
import type { AirHour, FarmPoint, WeatherHour } from "./types"

const TODAY = "2026-11-20"

function hour(date: string, h: number, patch: Partial<WeatherHour> = {}): WeatherHour {
  return {
    time: `${date}T${String(h).padStart(2, "0")}:00`,
    temp: 22,
    feels: 22,
    rh: 60,
    rain: 0,
    rainProb: 0,
    wind: 8,
    gust: 14,
    et0: h >= 7 && h <= 17 ? 0.4 : 0,
    soilTop: 0.25,
    soilRoot: 0.3,
    soilTemp: 20,
    radiation: h >= 7 && h <= 17 ? 400 : 0,
    isDay: h >= 6 && h <= 18,
    ...patch,
  }
}

function week(patch: (date: string, h: number) => Partial<WeatherHour> = () => ({})): WeatherHour[] {
  const hours: WeatherHour[] = []
  for (let day = 0; day < 8; day++) {
    const date = addDays(TODAY, day)
    for (let h = 0; h < 24; h++) hours.push(hour(date, h, patch(date, h)))
  }
  return hours
}

function point(weather: WeatherHour[], air: AirHour[] = []): FarmPoint {
  return { id: "x", name: "Test", state: "Punjab", regionId: "northwest", lat: 30, lon: 75, elevation: 200, weather, air }
}

describe("CPCB AQI", () => {
  it("interpolates PM2.5 and PM10 sub-indices and takes the worse", () => {
    assert.equal(subIndex(30, [[0, 30, 0, 50]]), 50)
    const aqi = particleAqi(105, 120)
    assert.equal(aqi?.dominant, "PM2.5")
    assert.equal(aqiCategory(aqi!.value), "Poor")
    assert.equal(aqiCategory(45), "Good")
    assert.equal(aqiCategory(450), "Severe")
  })

  it("needs most of the day before scoring air", () => {
    const air: AirHour[] = Array.from({ length: 10 }, (_, h) => ({
      time: `${TODAY}T${String(h).padStart(2, "0")}:00`,
      pm25: 50,
      pm10: 80,
      o3: 60,
      no2: 10,
      dust: 1,
      aod: 0.3,
    }))
    assert.equal(summariseAirDay(TODAY, air), null)
  })
})

describe("AOT40", () => {
  it("sums daylight ozone above 40 ppb", () => {
    const air: AirHour[] = Array.from({ length: 24 }, (_, h) => ({
      time: `${TODAY}T${String(h).padStart(2, "0")}:00`,
      pm25: 20,
      pm10: 30,
      o3: 1.96 * 50,
      no2: null,
      dust: null,
      aod: null,
    }))
    assert.ok(Math.abs((dailyAot40(air) ?? 0) - 120) < 1e-6)
  })
})

describe("hour windows", () => {
  it("finds the longest contiguous run, preferring the earlier on ties", () => {
    const tie = [6, 7, 8, 9, 10, 11, 12].map((h) => ({ hour: h, ok: h !== 9 }))
    assert.deepEqual(longestRun(tie), { start: 6, end: 9, hours: 3 })
    const later = [6, 7, 8, 9, 10, 11, 12].map((h) => ({ hour: h, ok: h !== 7 }))
    assert.deepEqual(longestRun(later), { start: 8, end: 13, hours: 5 })
    assert.equal(formatHourRange(6, 10), "6–10 am")
    assert.equal(formatHourRange(11, 14), "11 am–2 pm")
  })

  it("rejects spray hours with rain ahead or strong wind", () => {
    const hours = week((date, h) => (h === 10 ? { rain: 2, rainProb: 80 } : h === 15 ? { wind: 25, gust: 40 } : {}))
    const index = (h: number) => hours.findIndex((item) => item.time === `${TODAY}T${String(h).padStart(2, "0")}:00`)
    assert.equal(sprayHour(hours, index(7), true), "rain")
    assert.equal(sprayHour(hours, index(15), true), "windy")
    assert.equal(sprayHour(hours, index(12), true), "ok")
    assert.equal(sprayHour(hours, index(21), true), "night")
  })
})

describe("crop stages", () => {
  it("covers every day of every crop without gaps", () => {
    for (const crop of CROPS) {
      for (let index = 1; index < crop.stages.length; index++) {
        assert.equal(crop.stages[index].from, crop.stages[index - 1].to + 1, `${crop.id} gap at ${crop.stages[index].id}`)
      }
    }
    const wheat = cropById("wheat")!
    assert.equal(stageOn(wheat, 22)?.id, "crown_root")
    assert.equal(stageOn(wheat, 400)?.id, "maturity")
    assert.equal(stageOn(wheat, -1), null)
  })

  it("counts humid hours inside the disease temperature band", () => {
    const hours = Array.from({ length: 24 }, (_, h) => hour(TODAY, h, { rh: h < 12 ? 95 : 60, temp: h < 6 ? 8 : 15 }))
    assert.equal(wetHours(hours, 10, 20), 6)
  })
})

describe("buildPlan", () => {
  it("schedules irrigation once root-zone water runs low, and not before rain", () => {
    const dry = buildPlan({
      point: point(week(() => ({ soilRoot: 0.2, soilTop: 0.14, temp: 26 }))),
      crop: cropById("wheat")!,
      sownOn: addDays(TODAY, -22),
      today: TODAY,
    })
    assert.equal(dry.stageToday?.id, "crown_root")
    assert.equal(dry.days[0].activities.irrigate?.verdict, "good")

    const rainy = buildPlan({
      point: point(week((date, h) => ({ soilRoot: 0.2, soilTop: 0.14, rain: date === addDays(TODAY, 1) && h === 15 ? 20 : 0 }))),
      crop: cropById("wheat")!,
      sownOn: addDays(TODAY, -22),
      today: TODAY,
    })
    assert.equal(rainy.days[0].activities.irrigate?.tag, "waitRain")
    assert.equal(rainy.days[0].activities.irrigate?.label, "Wait for rain")
  })

  it("raises a frost alert at a sensitive stage and suggests evening irrigation", () => {
    const plan = buildPlan({
      point: point(week((date, h) => (date === addDays(TODAY, 2) && h < 7 ? { temp: 1 } : {}))),
      crop: cropById("mustard")!,
      sownOn: addDays(TODAY, -45),
      today: TODAY,
    })
    const frost = plan.alerts.find((alert) => alert.kind === "cold")
    assert.deepEqual(frost?.dates, [addDays(TODAY, 2)])
    assert.equal(plan.days[1].activities.irrigate?.tag, "frost")
  })

  it("switches to sowing advice before the crop is in the ground", () => {
    const plan = buildPlan({ point: point(week(() => ({ temp: 20 }))), crop: cropById("wheat")!, sownOn: null, today: TODAY })
    assert.ok(plan.activities.includes("sow"))
    assert.ok(!plan.activities.includes("spray"))
    assert.equal(plan.best.find((item) => item.activity === "sow")?.verdict, "good")
  })
})
