export type EnsemblePayload = {
  daily?: Record<string, unknown>
}

export type ParsedModel = {
  id: string
  label: string
  members: (number | null)[][]
}

export type ParsedEnsemble = {
  dates: string[]
  models: ParsedModel[]
}

export function labelForModel(id: string): string {
  if (id.includes("ecmwf")) return "ECMWF IFS"
  if (id.includes("gefs") || id.includes("gfs")) return "NCEP GEFS"
  return id
}

export function parseEnsemble(payload: EnsemblePayload): ParsedEnsemble {
  const daily = payload.daily
  if (!daily || !Array.isArray(daily.time)) {
    throw new Error("Ensemble response did not include a daily time axis")
  }
  const dates = daily.time.filter((value): value is string => typeof value === "string")
  const groups = new Map<string, { index: number; values: (number | null)[] }[]>()
  for (const [key, value] of Object.entries(daily)) {
    const match = key.match(/^precipitation_sum_member(\d+)_(.+)$/)
    if (!match || !Array.isArray(value)) continue
    const model = match[2]
    const list = groups.get(model) ?? []
    list.push({
      index: Number(match[1]),
      values: value.map((entry) => (typeof entry === "number" && Number.isFinite(entry) ? entry : null)),
    })
    groups.set(model, list)
  }
  const models = [...groups.entries()].map(([id, members]) => ({
    id,
    label: labelForModel(id),
    members: members.sort((a, b) => a.index - b.index).map((member) => member.values),
  }))
  if (models.length === 0) throw new Error("Ensemble response contained no precipitation members")
  return { dates, models }
}

export function ensembleUrl(lat: number, lon: number): string {
  const query = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    daily: "precipitation_sum",
    models: "ecmwf_ifs025,gfs_seamless",
    forecast_days: "7",
    timezone: "Asia/Kolkata",
    cell_selection: "land",
  })
  return `https://ensemble-api.open-meteo.com/v1/ensemble?${query}`
}
