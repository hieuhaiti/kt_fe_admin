import { useEffect, useRef } from 'react'
import maplibregl, { type GeoJSONSource, type LngLatBoundsLike } from 'maplibre-gl'
import type { FeedbackFeatureCollection } from '@/types/api'

interface FeedbackMapProps {
  data: FeedbackFeatureCollection | null
  isLoading?: boolean
  isError?: boolean
  onSelect: (id: number | string) => void
}

const SOURCE_ID = 'feedback-source'
const LAYER_ID = 'feedback-points'
const EMPTY_DATA: FeedbackFeatureCollection = { type: 'FeatureCollection', features: [] }

function getBounds(data: FeedbackFeatureCollection): LngLatBoundsLike | null {
  const coordinates = data.features
    .map((feature) => feature.geometry?.coordinates)
    .filter(
      (value): value is [number, number] =>
        Array.isArray(value) && Number.isFinite(value[0]) && Number.isFinite(value[1])
    )

  if (!coordinates.length) return null

  const bounds = coordinates.reduce(
    (current, [lng, lat]) => ({
      minLng: Math.min(current.minLng, lng),
      minLat: Math.min(current.minLat, lat),
      maxLng: Math.max(current.maxLng, lng),
      maxLat: Math.max(current.maxLat, lat),
    }),
    {
      minLng: coordinates[0][0],
      minLat: coordinates[0][1],
      maxLng: coordinates[0][0],
      maxLat: coordinates[0][1],
    }
  )

  return [
    [bounds.minLng, bounds.minLat],
    [bounds.maxLng, bounds.maxLat],
  ]
}

export default function FeedbackMap({ data, isLoading, isError, onSelect }: FeedbackMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const onSelectRef = useRef(onSelect)
  const dataRef = useRef(data)

  useEffect(() => {
    onSelectRef.current = onSelect
  }, [onSelect])

  useEffect(() => {
    dataRef.current = data
  }, [data])

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          basemap: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors',
          },
        },
        layers: [{ id: 'basemap', type: 'raster', source: 'basemap' }],
      },
      center: [107.95, 14.35],
      zoom: 7,
    })

    map.addControl(new maplibregl.NavigationControl(), 'top-right')
    map.on('load', () => {
      const currentData = dataRef.current
      map.addSource(SOURCE_ID, { type: 'geojson', data: currentData ?? EMPTY_DATA })
      map.addLayer({
        id: LAYER_ID,
        type: 'circle',
        source: SOURCE_ID,
        paint: {
          'circle-color': [
            'match',
            ['get', 'priority'],
            'urgent',
            '#dc2626',
            'high',
            '#f97316',
            'normal',
            '#2563eb',
            '#64748b',
          ],
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 7, 6, 13, 10],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2,
          'circle-opacity': 0.9,
        },
      })

      map.on('mouseenter', LAYER_ID, () => {
        map.getCanvas().style.cursor = 'pointer'
      })
      map.on('mouseleave', LAYER_ID, () => {
        map.getCanvas().style.cursor = ''
      })
      map.on('click', LAYER_ID, (event) => {
        const id = event.features?.[0]?.properties?.id
        if (id !== undefined && id !== null) onSelectRef.current(id)
      })

      if (currentData) {
        const bounds = getBounds(currentData)
        if (bounds) map.fitBounds(bounds, { padding: 56, duration: 300, maxZoom: 14 })
      }
    })

    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return
    const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined
    source?.setData(data ?? EMPTY_DATA)

    if (data) {
      const bounds = getBounds(data)
      if (bounds) map.fitBounds(bounds, { padding: 56, duration: 300, maxZoom: 14 })
    }
  }, [data])

  const isEmpty = !isLoading && !isError && (data?.features.length ?? 0) === 0

  return (
    <div className="relative h-[min(68vh,680px)] min-h-96 w-full overflow-hidden rounded-md border">
      <div ref={containerRef} className="size-full" aria-label="Bản đồ phản ánh hiện trường" />
      {(isLoading || isError || isEmpty) && (
        <div className="bg-background/90 absolute inset-0 z-10 flex items-center justify-center p-6 text-center text-sm">
          {isLoading
            ? 'Đang tải điểm phản ánh...'
            : isError
              ? 'Không thể tải bản đồ phản ánh.'
              : 'Không có điểm phản ánh phù hợp bộ lọc.'}
        </div>
      )}
    </div>
  )
}
