import { cropById } from "./crops"

export type CropKind = "cereal" | "millet" | "pulse" | "oilseed" | "fibre" | "cash" | "vegetable" | "spice" | "fruit" | "plantation"
export type Water = "low" | "medium" | "high"

export type FieldCrop = { id: string; kind: CropKind; water: Water }

/** Every crop that appears in a place profile. Names live in the message catalogue under `fc.<id>`. */
export const FIELD_CROPS: FieldCrop[] = [
  { id: "rice", kind: "cereal", water: "high" },
  { id: "wheat", kind: "cereal", water: "medium" },
  { id: "maize", kind: "cereal", water: "medium" },
  { id: "barley", kind: "cereal", water: "low" },
  { id: "bajra", kind: "millet", water: "low" },
  { id: "jowar", kind: "millet", water: "low" },
  { id: "ragi", kind: "millet", water: "low" },
  { id: "chickpea", kind: "pulse", water: "low" },
  { id: "pigeonpea", kind: "pulse", water: "low" },
  { id: "greengram", kind: "pulse", water: "low" },
  { id: "blackgram", kind: "pulse", water: "low" },
  { id: "lentil", kind: "pulse", water: "low" },
  { id: "mothbean", kind: "pulse", water: "low" },
  { id: "guar", kind: "pulse", water: "low" },
  { id: "soybean", kind: "oilseed", water: "medium" },
  { id: "groundnut", kind: "oilseed", water: "medium" },
  { id: "mustard", kind: "oilseed", water: "low" },
  { id: "sesame", kind: "oilseed", water: "low" },
  { id: "castor", kind: "oilseed", water: "low" },
  { id: "cotton", kind: "fibre", water: "medium" },
  { id: "jute", kind: "fibre", water: "high" },
  { id: "sugarcane", kind: "cash", water: "high" },
  { id: "potato", kind: "vegetable", water: "medium" },
  { id: "onion", kind: "vegetable", water: "medium" },
  { id: "vegetables", kind: "vegetable", water: "medium" },
  { id: "tapioca", kind: "vegetable", water: "medium" },
  { id: "chilli", kind: "spice", water: "medium" },
  { id: "turmeric", kind: "spice", water: "high" },
  { id: "cumin", kind: "spice", water: "low" },
  { id: "blackpepper", kind: "spice", water: "high" },
  { id: "cardamom", kind: "spice", water: "high" },
  { id: "saffron", kind: "spice", water: "low" },
  { id: "mango", kind: "fruit", water: "medium" },
  { id: "banana", kind: "fruit", water: "high" },
  { id: "orange", kind: "fruit", water: "medium" },
  { id: "apple", kind: "fruit", water: "medium" },
  { id: "walnut", kind: "fruit", water: "medium" },
  { id: "litchi", kind: "fruit", water: "medium" },
  { id: "coconut", kind: "plantation", water: "high" },
  { id: "arecanut", kind: "plantation", water: "high" },
  { id: "cashew", kind: "plantation", water: "low" },
  { id: "rubber", kind: "plantation", water: "high" },
  { id: "tea", kind: "plantation", water: "high" },
]

export type Profile = {
  /** Message key suffix under `soil.` */
  soil: string
  kharif: string[]
  rabi: string[]
  zaid: string[]
  perennial: string[]
}

/** Typical cropping around each anchor, after ICAR agro-climatic zone descriptions. */
export const PROFILES: Record<string, Profile> = {
  srinagar: { soil: "karewa", kharif: ["rice", "maize"], rabi: ["mustard", "wheat", "lentil"], zaid: ["vegetables"], perennial: ["apple", "walnut", "saffron"] },
  dehradun: { soil: "doon", kharif: ["rice", "maize", "soybean"], rabi: ["wheat", "mustard", "lentil"], zaid: ["vegetables"], perennial: ["litchi", "mango", "sugarcane"] },
  amritsar: { soil: "alluvial", kharif: ["rice", "cotton", "maize"], rabi: ["wheat", "mustard", "potato"], zaid: ["greengram", "maize"], perennial: ["sugarcane"] },
  delhi: { soil: "alluvial", kharif: ["rice", "bajra", "jowar", "cotton"], rabi: ["wheat", "mustard", "chickpea"], zaid: ["vegetables", "greengram"], perennial: ["sugarcane"] },
  jaipur: { soil: "sandyLoam", kharif: ["bajra", "guar", "greengram", "groundnut"], rabi: ["mustard", "wheat", "chickpea", "barley"], zaid: ["vegetables"], perennial: [] },
  jodhpur: { soil: "desert", kharif: ["bajra", "mothbean", "guar", "sesame"], rabi: ["cumin", "mustard", "chickpea"], zaid: [], perennial: [] },
  lucknow: { soil: "alluvial", kharif: ["rice", "maize", "pigeonpea"], rabi: ["wheat", "potato", "mustard", "lentil", "chickpea"], zaid: ["greengram", "blackgram", "vegetables"], perennial: ["sugarcane", "mango"] },
  patna: { soil: "alluvial", kharif: ["rice", "maize"], rabi: ["wheat", "lentil", "maize", "potato"], zaid: ["greengram"], perennial: ["banana", "litchi", "mango"] },
  kolkata: { soil: "delta", kharif: ["rice", "jute"], rabi: ["potato", "mustard", "rice", "vegetables"], zaid: ["sesame", "vegetables"], perennial: ["banana", "coconut"] },
  guwahati: { soil: "acidAlluvial", kharif: ["rice", "jute"], rabi: ["mustard", "potato", "vegetables"], zaid: ["rice"], perennial: ["tea", "banana", "arecanut"] },
  bhopal: { soil: "black", kharif: ["soybean", "maize", "rice", "pigeonpea"], rabi: ["wheat", "chickpea", "lentil"], zaid: ["greengram"], perennial: [] },
  nagpur: { soil: "black", kharif: ["cotton", "soybean", "pigeonpea"], rabi: ["chickpea", "wheat"], zaid: ["vegetables"], perennial: ["orange"] },
  ahmedabad: { soil: "goradu", kharif: ["cotton", "groundnut", "castor", "bajra"], rabi: ["wheat", "cumin", "mustard"], zaid: ["bajra", "vegetables"], perennial: [] },
  mumbai: { soil: "laterite", kharif: ["rice", "ragi"], rabi: ["vegetables", "blackgram"], zaid: [], perennial: ["mango", "coconut", "cashew"] },
  panaji: { soil: "laterite", kharif: ["rice"], rabi: ["vegetables", "blackgram"], zaid: [], perennial: ["cashew", "coconut", "arecanut", "mango"] },
  thiruvananthapuram: { soil: "laterite", kharif: ["rice", "tapioca"], rabi: ["rice", "vegetables"], zaid: [], perennial: ["coconut", "rubber", "banana", "blackpepper", "cardamom"] },
  bhubaneswar: { soil: "lateriteAlluvial", kharif: ["rice"], rabi: ["greengram", "blackgram", "groundnut", "vegetables"], zaid: ["vegetables"], perennial: ["coconut", "cashew"] },
  visakhapatnam: { soil: "redLoam", kharif: ["rice", "sugarcane"], rabi: ["blackgram", "greengram", "groundnut"], zaid: ["sesame"], perennial: ["cashew", "coconut", "mango"] },
  chennai: { soil: "coastal", kharif: ["rice", "groundnut"], rabi: ["rice", "blackgram", "groundnut"], zaid: ["sesame", "vegetables"], perennial: ["coconut", "sugarcane", "banana"] },
  hyderabad: { soil: "redBlack", kharif: ["cotton", "rice", "maize", "pigeonpea"], rabi: ["rice", "groundnut", "chickpea", "maize"], zaid: ["vegetables"], perennial: ["turmeric", "chilli", "mango"] },
  bengaluru: { soil: "redLoam", kharif: ["ragi", "maize", "pigeonpea", "groundnut"], rabi: ["chickpea", "vegetables"], zaid: ["vegetables"], perennial: ["mango", "coconut"] },
}

export type Season = "kharif" | "rabi" | "zaid"

/** The season whose sowing window is open or about to open in a given month. */
export function sowingSeason(month: number): Season {
  if (month >= 6 && month <= 8) return "kharif"
  if (month >= 9 || month <= 1) return "rabi"
  return "zaid"
}

export function nextSeason(season: Season): Season {
  return season === "kharif" ? "rabi" : season === "rabi" ? "zaid" : "kharif"
}

export type Suggestion = {
  id: string
  water: Water
  kind: CropKind
  plannable: boolean
  /** Only set for crops the planner models: today's sowing fit from the 7-day temperature. */
  fit?: { verdict: "good" | "warm" | "cool" | "offSeason"; meanTemp: number | null }
}

export type CropSuggestions = {
  season: Season
  next: Season
  now: Suggestion[]
  upcoming: Suggestion[]
  perennial: Suggestion[]
  soil: string
}

function suggestion(id: string, month: number, meanTemp: number | null): Suggestion {
  const crop = FIELD_CROPS.find((item) => item.id === id)
  if (!crop) throw new Error(`Unknown field crop ${id}`)
  const planned = cropById(id)
  let fit: Suggestion["fit"]
  if (planned) {
    const [low, high] = planned.sowTemp
    if (!planned.sowMonths.includes(month)) fit = { verdict: "offSeason", meanTemp }
    else if (meanTemp != null && meanTemp > high) fit = { verdict: "warm", meanTemp }
    else if (meanTemp != null && meanTemp < low) fit = { verdict: "cool", meanTemp }
    else fit = { verdict: "good", meanTemp }
  }
  return { id, water: crop.water, kind: crop.kind, plannable: Boolean(planned), fit }
}

const WATER_RANK: Record<Water, number> = { low: 0, medium: 1, high: 2 }

export function suggestCrops(placeId: string, month: number, meanTemp: number | null, annualRainMm: number | null): CropSuggestions | null {
  const profile = PROFILES[placeId]
  if (!profile) return null
  const season = sowingSeason(month)
  const next = nextSeason(season)
  const dry = annualRainMm != null && annualRainMm < 600
  const rank = (items: Suggestion[]) =>
    dry ? [...items].sort((a, b) => WATER_RANK[a.water] - WATER_RANK[b.water]) : items
  return {
    season,
    next,
    now: rank(profile[season].map((id) => suggestion(id, month, meanTemp))),
    upcoming: rank(profile[next].map((id) => suggestion(id, month, meanTemp))),
    perennial: profile.perennial.map((id) => suggestion(id, month, meanTemp)),
    soil: profile.soil,
  }
}
