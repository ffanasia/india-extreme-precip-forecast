export type ThresholdId = "heavy" | "very_heavy" | "extreme" | "local"
export type WindowId = "24h" | "72h" | "7d"

export type City = {
  id: string
  name: string
  state: string
  lat: number
  lon: number
  regionId: string
}

export type Region = {
  id: string
  name: string
  lat: number
  lon: number
  blurb: string
}

export const THRESHOLDS: {
  id: ThresholdId
  label: string
  mm: number | null
  detail: string
}[] = [
  {
    id: "heavy",
    label: "Heavy",
    mm: 64.5,
    detail: "IMD heavy rain: 64.5 mm or more in a day",
  },
  {
    id: "very_heavy",
    label: "Very heavy",
    mm: 115.6,
    detail: "IMD very heavy rain: 115.6 mm or more in a day",
  },
  {
    id: "extreme",
    label: "Extremely heavy",
    mm: 204.5,
    detail: "IMD extremely heavy rain: 204.5 mm or more in a day",
  },
  {
    id: "local",
    label: "Local R99p",
    mm: null,
    detail: "99th percentile of ERA5 wet days (≥1 mm), 1991–2020",
  },
]

export const WINDOWS: { id: WindowId; label: string; short: string; days: number }[] = [
  { id: "24h", label: "24 hours", short: "24h", days: 1 },
  { id: "72h", label: "72 hours", short: "72h", days: 3 },
  { id: "7d", label: "7 days", short: "7d", days: 7 },
]

export const REGIONS: Region[] = [
  {
    id: "western_himalaya",
    name: "Western Himalaya",
    lat: 32.5,
    lon: 76.5,
    blurb: "Foothills and the Kashmir valley, where western disturbances add a winter extreme-rain season.",
  },
  {
    id: "northwest",
    name: "Northwest India",
    lat: 28.2,
    lon: 74.8,
    blurb: "Plains from Punjab to Rajasthan. Heavy rain is sharply seasonal and often tied to monsoon depressions.",
  },
  {
    id: "gangetic",
    name: "Gangetic plains",
    lat: 25.6,
    lon: 84.8,
    blurb: "The Ganga valley from Awadh to the delta, a frequent track for monsoon lows.",
  },
  {
    id: "northeast",
    name: "Northeast India",
    lat: 26.14,
    lon: 91.74,
    blurb: "Assam and the surrounding hills. Orographic rain makes high daily totals climatologically common.",
  },
  {
    id: "central",
    name: "Central India",
    lat: 22.2,
    lon: 78.3,
    blurb: "The monsoon core zone. Extreme days here often come with lows and depressions from the Bay of Bengal.",
  },
  {
    id: "gujarat",
    name: "Gujarat",
    lat: 23.02,
    lon: 72.57,
    blurb: "A sharp north–south gradient, with the south coast much wetter than the north.",
  },
  {
    id: "west_coast",
    name: "West coast",
    lat: 15.7,
    lon: 74.2,
    blurb: "Western Ghats orographic rain. Mumbai, Goa, and Kerala hold most of the mainland's heaviest daily totals.",
  },
  {
    id: "east_coast",
    name: "East coast",
    lat: 17.0,
    lon: 83.1,
    blurb: "Bay of Bengal landfall coast. The southeast depends more on the northeast monsoon.",
  },
  {
    id: "south_interior",
    name: "South interior",
    lat: 15.2,
    lon: 78.0,
    blurb: "Deccan plateau. Extremes are less frequent than on either coast, but urban flooding thresholds are still crossed.",
  },
]

export const CITIES: City[] = [
  { id: "srinagar", name: "Srinagar", state: "Jammu and Kashmir", lat: 34.0837, lon: 74.7973, regionId: "western_himalaya" },
  { id: "dehradun", name: "Dehradun", state: "Uttarakhand", lat: 30.3165, lon: 78.0322, regionId: "western_himalaya" },
  { id: "amritsar", name: "Amritsar", state: "Punjab", lat: 31.634, lon: 74.8723, regionId: "northwest" },
  { id: "delhi", name: "New Delhi", state: "Delhi", lat: 28.6139, lon: 77.209, regionId: "northwest" },
  { id: "jaipur", name: "Jaipur", state: "Rajasthan", lat: 26.9124, lon: 75.7873, regionId: "northwest" },
  { id: "jodhpur", name: "Jodhpur", state: "Rajasthan", lat: 26.2389, lon: 73.0243, regionId: "northwest" },
  { id: "lucknow", name: "Lucknow", state: "Uttar Pradesh", lat: 26.8467, lon: 80.9462, regionId: "gangetic" },
  { id: "patna", name: "Patna", state: "Bihar", lat: 25.5941, lon: 85.1376, regionId: "gangetic" },
  { id: "kolkata", name: "Kolkata", state: "West Bengal", lat: 22.5726, lon: 88.3639, regionId: "gangetic" },
  { id: "guwahati", name: "Guwahati", state: "Assam", lat: 26.1445, lon: 91.7362, regionId: "northeast" },
  { id: "bhopal", name: "Bhopal", state: "Madhya Pradesh", lat: 23.2599, lon: 77.4126, regionId: "central" },
  { id: "nagpur", name: "Nagpur", state: "Maharashtra", lat: 21.1458, lon: 79.0882, regionId: "central" },
  { id: "ahmedabad", name: "Ahmedabad", state: "Gujarat", lat: 23.0225, lon: 72.5714, regionId: "gujarat" },
  { id: "mumbai", name: "Mumbai", state: "Maharashtra", lat: 19.076, lon: 72.8777, regionId: "west_coast" },
  { id: "panaji", name: "Panaji", state: "Goa", lat: 15.4909, lon: 73.8278, regionId: "west_coast" },
  { id: "thiruvananthapuram", name: "Thiruvananthapuram", state: "Kerala", lat: 8.5241, lon: 76.9366, regionId: "west_coast" },
  { id: "bhubaneswar", name: "Bhubaneswar", state: "Odisha", lat: 20.2961, lon: 85.8245, regionId: "east_coast" },
  { id: "visakhapatnam", name: "Visakhapatnam", state: "Andhra Pradesh", lat: 17.6868, lon: 83.2185, regionId: "east_coast" },
  { id: "chennai", name: "Chennai", state: "Tamil Nadu", lat: 13.0827, lon: 80.2707, regionId: "east_coast" },
  { id: "hyderabad", name: "Hyderabad", state: "Telangana", lat: 17.385, lon: 78.4867, regionId: "south_interior" },
  { id: "bengaluru", name: "Bengaluru", state: "Karnataka", lat: 12.9716, lon: 77.5946, regionId: "south_interior" },
]

export const STATE_REGION: Record<string, string> = {
  "Jammu and Kashmir": "western_himalaya",
  Ladakh: "western_himalaya",
  "Himachal Pradesh": "western_himalaya",
  Uttarakhand: "western_himalaya",
  Punjab: "northwest",
  Haryana: "northwest",
  Delhi: "northwest",
  Chandigarh: "northwest",
  Rajasthan: "northwest",
  "Uttar Pradesh": "gangetic",
  Bihar: "gangetic",
  Jharkhand: "gangetic",
  "West Bengal": "gangetic",
  Sikkim: "northeast",
  Assam: "northeast",
  "Arunachal Pradesh": "northeast",
  Nagaland: "northeast",
  Manipur: "northeast",
  Mizoram: "northeast",
  Tripura: "northeast",
  Meghalaya: "northeast",
  Odisha: "east_coast",
  "Andhra Pradesh": "east_coast",
  "Tamil Nadu": "east_coast",
  Puducherry: "east_coast",
  Chhattisgarh: "central",
  "Madhya Pradesh": "central",
  Goa: "west_coast",
  Kerala: "west_coast",
  Gujarat: "gujarat",
  "Dadra and Nagar Haveli and Daman and Diu": "gujarat",
  Telangana: "south_interior",
}

export const CMIP6_MODELS = [
  {
    id: "MPI_ESM1_2_XR",
    label: "MPI-ESM1-2-XR",
    center: "Max Planck Institute for Meteorology",
    resolutionKm: 51,
  },
  {
    id: "EC_Earth3P_HR",
    label: "EC-Earth3P-HR",
    center: "EC-Earth / SMHI",
    resolutionKm: 29,
  },
  {
    id: "MRI_AGCM3_2_S",
    label: "MRI-AGCM3-2-S",
    center: "Meteorological Research Institute, Japan",
    resolutionKm: 20,
  },
] as const

export const HEAVY_MM = 64.5
export const VERY_HEAVY_MM = 115.6
export const EXTREME_MM = 204.5

export function regionById(id: string): Region {
  const region = REGIONS.find((item) => item.id === id)
  if (!region) throw new Error(`Unknown region ${id}`)
  return region
}

export function cityById(id: string): City {
  const city = CITIES.find((item) => item.id === id)
  if (!city) throw new Error(`Unknown city ${id}`)
  return city
}

export function thresholdMillimetres(id: ThresholdId, localR99p: number): number {
  if (id === "heavy") return HEAVY_MM
  if (id === "very_heavy") return VERY_HEAVY_MM
  if (id === "extreme") return EXTREME_MM
  return localR99p
}

export type SeasonContext = { id: string; title: string; note: string }

export function seasonContext(month: number): SeasonContext {
  if (month >= 6 && month <= 9) {
    return {
      id: "sw",
      title: "Southwest monsoon",
      note: "June to September is the main extreme-rain season for most of the mainland. The west coast, central India, and the northeast carry the highest climatological risk.",
    }
  }
  if (month >= 10 && month <= 12) {
    return {
      id: "ne",
      title: "Withdrawal and northeast monsoon",
      note: "The southwest monsoon has withdrawn from much of the mainland. Extreme daily rain is climatologically more relevant along the southeast coast, where the northeast monsoon is underway.",
    }
  }
  if (month <= 2) {
    return {
      id: "winter",
      title: "Winter",
      note: "Widespread monsoon extremes are out of season. Northern anchors can still see heavy precipitation from western disturbances. Totals here are liquid-equivalent.",
    }
  }
  return {
    id: "pre",
    title: "Pre-monsoon",
    note: "March to May brings thunderstorms, nor'westers in the east, and short-lived convective extremes. Ensembles often disagree on where a cell will sit.",
  }
}
