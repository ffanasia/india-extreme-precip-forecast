"use client"

import { geoMercator, geoPath } from "d3-geo"
import type { FeatureCollection, Geometry } from "geojson"
import { useEffect, useMemo, useRef, useState } from "react"

import { STATE_REGION } from "@/lib/domain"

export type MapPoint = {
  id: string
  name: string
  state: string
  lat: number
  lon: number
  color: string
  radius: number
  label: string
  dimmed: boolean
}

type Outline = FeatureCollection<Geometry, { name?: string }>

export function IndiaMap({
  points,
  selectedId,
  highlightRegion,
  onSelect,
}: {
  points: MapPoint[]
  selectedId: string | null
  highlightRegion: string | null
  onSelect: (id: string) => void
}) {
  const host = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 720, height: 780 })
  const [outline, setOutline] = useState<Outline | null>(null)
  const [outlineError, setOutlineError] = useState<string | null>(null)
  const [hover, setHover] = useState<string | null>(null)

  useEffect(() => {
    const node = host.current
    if (!node) return
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      if (width > 0 && height > 0) setSize({ width, height })
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch("/geo/india-mainland.json")
      .then((response) => {
        if (!response.ok) throw new Error("The mainland outline did not load")
        return response.json() as Promise<Outline>
      })
      .then((geo) => {
        if (!cancelled) setOutline(geo)
      })
      .catch((error: unknown) => {
        if (!cancelled) setOutlineError(error instanceof Error ? error.message : "Map outline failed")
      })
    return () => {
      cancelled = true
    }
  }, [])

  const drawn = useMemo(() => {
    if (!outline) return null
    const projection = geoMercator().fitExtent(
      [
        [16, 16],
        [size.width - 16, size.height - 16],
      ],
      outline,
    )
    return { path: geoPath(projection), projection }
  }, [outline, size])

  return (
    <div ref={host} className="map-field relative h-full min-h-[460px] w-full">
      <span className="pointer-events-none absolute top-4 left-4 text-[10px] tracking-[0.22em] text-muted-foreground/80 uppercase">
        Arabian Sea
      </span>
      <span className="pointer-events-none absolute top-4 right-4 text-[10px] tracking-[0.22em] text-muted-foreground/80 uppercase">
        Bay of Bengal
      </span>
      {outlineError && (
        <p className="absolute inset-x-0 top-1/2 text-center text-sm text-vermillion">{outlineError}</p>
      )}
      {drawn && outline && (
        <svg className="absolute inset-0 h-full w-full" role="img" aria-label="Mainland India">
          {outline.features.map((feature) => {
            const name = feature.properties?.name ?? "state"
            const region = STATE_REGION[name]
            const active = Boolean(highlightRegion && region === highlightRegion)
            return (
              <path
                key={name}
                d={drawn.path(feature) ?? ""}
                fill={active ? "#3a3124" : "#221e18"}
                stroke={active ? "#e3a008" : "#4e463b"}
                strokeWidth={active ? 1.15 : 0.7}
              />
            )
          })}
        </svg>
      )}
      {drawn &&
        points.map((point) => {
          const xy = drawn.projection([point.lon, point.lat])
          if (!xy) return null
          const [x, y] = xy
          const selected = point.id === selectedId
          const showLabel = selected || hover === point.id
          const placeLeft = x > size.width * 0.72
          return (
            <button
              key={point.id}
              type="button"
              aria-label={`${point.name}, ${point.state}, ${point.label}`}
              aria-pressed={selected}
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron"
              style={{ left: x, top: y }}
              onClick={() => onSelect(point.id)}
              onMouseEnter={() => setHover(point.id)}
              onMouseLeave={() => setHover((current) => (current === point.id ? null : current))}
              onFocus={() => setHover(point.id)}
              onBlur={() => setHover((current) => (current === point.id ? null : current))}
            >
              <span
                className="block rounded-full"
                style={{
                  width: point.radius * 2,
                  height: point.radius * 2,
                  background: point.color,
                  opacity: point.dimmed ? 0.28 : 1,
                  boxShadow: selected
                    ? "0 0 0 5px rgba(227,160,8,0.38), 0 0 0 1px #14120e"
                    : "0 0 0 2px rgba(20,18,14,0.85)",
                }}
              />
              {showLabel && !point.dimmed && (
                <span
                  className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-left text-[11px] whitespace-nowrap text-paper ${
                    placeLeft ? "right-full pr-2" : "left-full pl-2"
                  }`}
                >
                  <span className="font-heading text-[13px] italic">{point.name}</span>
                  <span className="ml-1.5 font-mono text-[10px] text-muted-foreground">{point.label}</span>
                </span>
              )}
            </button>
          )
        })}
    </div>
  )
}
