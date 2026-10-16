import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  anyDayExceedance,
  categoryFor,
  confidenceFor,
  findAnalog,
  indexByDate,
  percentChange,
  quantile,
  seasonalStats,
  wetDayPercentile,
  windowExceedance,
} from "./stats"

describe("quantile", () => {
  it("interpolates the empirical percentile", () => {
    assert.equal(quantile([1, 2, 3, 4, 5], 0.5), 3)
    assert.equal(quantile([1, 2, 3, 4, 5], 0.1), 1.4)
    assert.equal(quantile([10], 0.99), 10)
  })
})

describe("exceedance", () => {
  it("counts members that hit the threshold on any day and drops incomplete members", () => {
    const members = [
      [10, 70],
      [1, 2],
      [80, 0],
      [null, 200],
    ]
    assert.equal(anyDayExceedance(members, 64.5), 2 / 3)
  })
})

describe("categories", () => {
  it("keeps quiet below 10 percent and severe at 70 percent", () => {
    assert.equal(categoryFor(0.099), "quiet")
    assert.equal(categoryFor(0.1), "watch")
    assert.equal(categoryFor(0.7), "severe")
    assert.equal(categoryFor(null), "unavailable")
  })

  it("requires the two models to agree before calling confidence high", () => {
    assert.equal(confidenceFor([0.5, 0.55], 0.525), "high")
    assert.equal(confidenceFor([0.8, 0.1], 0.45), "low")
    assert.equal(confidenceFor([0.6], 0.6), "moderate")
    assert.equal(confidenceFor([0.02, 0.03], 0.025), "quiet")
  })
})

describe("percent change", () => {
  it("returns null when the historical rate is zero and the future rate is not", () => {
    assert.equal(percentChange(2, 0), null)
    assert.equal(percentChange(0, 0), 0)
    assert.equal(percentChange(15, 10), 50)
  })
})

describe("wet-day percentile", () => {
  it("ignores dry days", () => {
    const values = [0, 0, 1, 2, 3, 4, 100]
    assert.equal(wetDayPercentile(values, 1), 100)
  })
})

describe("climatological window", () => {
  const dates = ["1991-10-17", "1991-10-18", "1992-10-17", "1992-10-18"]
  const values = [10, 80, 1, 2]
  const byDate = indexByDate(dates, values)

  it("counts years whose window maximum reaches the threshold", () => {
    const rate = windowExceedance(byDate, ["2026-10-17", "2026-10-18"], 64.5, 1991, 1992)
    assert.deepEqual(rate, { hits: 1, years: 2 })
  })

  it("picks the historical window with the smaller RMSE", () => {
    const analog = findAnalog(byDate, ["2026-10-17", "2026-10-18"], [70, 10], 1991, 1992)
    assert.equal(analog?.year, 1992)
    assert.ok(analog && analog.rmse < 50)
  })
})

describe("seasonal stats", () => {
  it("averages complete JJAS seasons and skips a short year", () => {
    const dates: string[] = []
    const values: number[] = []
    for (const year of [1991, 1992]) {
      for (let month = 6; month <= 9; month++) {
        const days = month === 6 || month === 9 ? 30 : 31
        for (let day = 1; day <= days; day++) {
          if (year === 1992 && month > 6) continue
          dates.push(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`)
          values.push(day === 1 && month === 7 ? 80 : 2)
        }
      }
    }
    const stats = seasonalStats(dates, values, "jjas")
    assert.equal(stats?.years, 1)
    assert.equal(stats?.meanHeavyDays, 1)
    assert.equal(stats?.meanRx1day, 80)
  })
})
