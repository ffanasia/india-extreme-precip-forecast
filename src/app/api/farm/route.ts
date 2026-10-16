import { todayInKolkata } from "@/lib/dates"
import { CITIES } from "@/lib/domain"
import { airDates, summariseAirDay } from "@/lib/agro/air"
import { loadFarm } from "@/lib/agro/fetch"
import type { AirOverview, FarmResponse } from "@/lib/agro/types"

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const cityId = params.get("city") ?? CITIES[0].id
  if (!CITIES.some((city) => city.id === cityId)) {
    return Response.json({ error: `Unknown place: ${cityId}` }, { status: 400 })
  }
  try {
    const { bundle, fromCache } = await loadFarm(params.get("refresh") === "1")
    const today = todayInKolkata()
    const point = bundle.points.find((item) => item.id === cityId)!
    const overview: AirOverview[] = bundle.points.map((item) => {
      const days = airDates(item.air)
        .filter((date) => date >= today)
        .map((date) => summariseAirDay(date, item.air))
        .filter((day) => day != null)
      return {
        id: item.id,
        name: item.name,
        state: item.state,
        today: days.find((day) => day.date === today) ?? null,
        worst: [...days].sort((a, b) => (b.aqi?.value ?? 0) - (a.aqi?.value ?? 0))[0] ?? null,
      }
    })
    const errors = [bundle.weatherError, bundle.airError].filter((value): value is string => Boolean(value))
    const body: FarmResponse = { generatedAt: bundle.fetchedAt, fromCache, today, point, overview, errors }
    return Response.json(body)
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Farm data failed" }, { status: 502 })
  }
}
