import { buildDesk } from "@/lib/fuse"
import { loadClimatology } from "@/lib/climatology"
import { loadLive } from "@/lib/live"

export async function GET(request: Request) {
  try {
    const climatology = loadClimatology()
    const refresh = new URL(request.url).searchParams.get("refresh") === "1"
    const { bundle, fromCache } = await loadLive(refresh)
    const desk = buildDesk(climatology, bundle, new Date().toISOString(), fromCache)
    return Response.json(desk)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Forecast desk failed"
    const missing = message.includes("ENOENT") || message.includes("climatology.json")
    return Response.json(
      {
        error: missing
          ? "Climatology has not been built. Run npm run climatology."
          : message,
      },
      { status: missing ? 503 : 500 },
    )
  }
}
