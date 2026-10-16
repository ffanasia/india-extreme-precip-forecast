import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { categoryFor } from "./stats"
import { chanceInWords, dayKind, haversineKm, nearestCity, riskLevel } from "./plain"

describe("riskLevel", () => {
  it("uses the same breakpoints as the detailed desk", () => {
    const pairs = [
      [null, "unknown", "unavailable"],
      [0.02, "unlikely", "quiet"],
      [0.12, "small", "watch"],
      [0.3, "real", "likely"],
      [0.5, "likely", "high"],
      [0.8, "very_likely", "severe"],
    ] as const
    for (const [probability, plain, desk] of pairs) {
      assert.equal(riskLevel(probability), plain)
      assert.equal(categoryFor(probability), desk)
    }
  })
})

describe("chanceInWords", () => {
  it("speaks in natural frequencies", () => {
    assert.equal(chanceInWords(0.017), "less than 1 in 20")
    assert.equal(chanceInWords(0.07), "less than 1 in 10")
    assert.equal(chanceInWords(0.34), "about 3 in 10")
    assert.equal(chanceInWords(0.96), "almost certain")
    assert.equal(chanceInWords(null), "not known")
  })
})

describe("dayKind", () => {
  const day = { date: "2026-10-17", medianMm: 0, rainChance: 0, heavyChance: 0, veryHeavyChance: 0 }
  it("puts heavy-rain risk ahead of the expected amount", () => {
    assert.equal(dayKind({ ...day, medianMm: 40, rainChance: 1, heavyChance: 0.3 }), "heavy_risk")
    assert.equal(dayKind({ ...day, medianMm: 40, rainChance: 1, heavyChance: 0.12 }), "heavy_possible")
    assert.equal(dayKind({ ...day, medianMm: 20, rainChance: 0.9 }), "rain")
    assert.equal(dayKind({ ...day, medianMm: 1, rainChance: 0.4 }), "showers")
    assert.equal(dayKind(day), "dry")
    assert.equal(dayKind({ ...day, rainChance: null }), "unknown")
  })
})

describe("nearestCity", () => {
  it("picks the closest anchor by great-circle distance", () => {
    const cities = [
      { id: "mumbai", lat: 19.076, lon: 72.8777 },
      { id: "pune", lat: 18.5204, lon: 73.8567 },
    ]
    assert.equal(nearestCity(cities, 18.6, 73.7)?.city.id, "pune")
    const km = haversineKm(19.076, 72.8777, 18.5204, 73.8567)
    assert.ok(km > 115 && km < 125)
  })
})
