export type WeatherHour = {
  time: string
  temp: number | null
  feels: number | null
  rh: number | null
  rain: number | null
  rainProb: number | null
  wind: number | null
  gust: number | null
  et0: number | null
  soilTop: number | null
  soilRoot: number | null
  soilTemp: number | null
  radiation: number | null
  isDay: boolean
}

export type AirHour = {
  time: string
  pm25: number | null
  pm10: number | null
  o3: number | null
  no2: number | null
  dust: number | null
  aod: number | null
}

export type FarmPoint = {
  id: string
  name: string
  state: string
  regionId: string
  lat: number
  lon: number
  elevation: number | null
  weather: WeatherHour[]
  air: AirHour[]
}

export type FarmBundle = {
  fetchedAt: string
  points: FarmPoint[]
  weatherError?: string
  airError?: string
}

export type AqiCategory = "Good" | "Satisfactory" | "Moderate" | "Poor" | "Very poor" | "Severe"

export type DayAir = {
  date: string
  hours: number
  pm25: number | null
  pm10: number | null
  o3Max8h: number | null
  aot40: number | null
  aod: number | null
  dustMax: number | null
  aqi: { value: number; category: AqiCategory; dominant: "PM2.5" | "PM10" } | null
}

export type AirOverview = {
  id: string
  name: string
  state: string
  today: DayAir | null
  worst: DayAir | null
}

export type FarmResponse = {
  generatedAt: string
  fromCache: boolean
  today: string
  point: FarmPoint
  overview: AirOverview[]
  errors: string[]
}
