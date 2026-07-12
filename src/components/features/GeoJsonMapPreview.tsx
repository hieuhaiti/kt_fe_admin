import { useEffect, useRef } from 'react'
import maplibregl, { type GeoJSONSource, type LngLatBoundsLike } from 'maplibre-gl'

interface GeoJsonMapPreviewProps {
  geojson: GeoJSON.GeoJSON | null
  heightClassName?: string
}

const SOURCE_ID = 'preview-source'
const BASEMAP_SOURCE_ID = 'osm-basemap'
const BASEMAP_LAYER_ID = 'osm-basemap-layer'
const FILL_LAYER_ID = 'preview-fill'
const LINE_LAYER_ID = 'preview-line'

const EMPTY_FEATURE_COLLECTION: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [],
}

function collectCoordinates(
  value: unknown,
  out: Array<[number, number]> = []
): Array<[number, number]> {
  if (!value) return out
  if (
    Array.isArray(value) &&
    value.length >= 2 &&
    typeof value[0] === 'number' &&
    typeof value[1] === 'number'
  ) {
    out.push([value[0], value[1]])
    return out
  }
  if (Array.isArray(value)) value.forEach((item) => collectCoordinates(item, out))
  return out
}

function getBoundsFromGeoJson(geojson: GeoJSON.GeoJSON): LngLatBoundsLike | null {
  const features =
    geojson.type === 'FeatureCollection'
      ? geojson.features
      : geojson.type === 'Feature'
        ? [geojson]
        : [{ type: 'Feature', geometry: geojson, properties: {} } as GeoJSON.Feature]

  const points: Array<[number, number]> = []
  features.forEach((feature) => {
    if (!feature.geometry) return
    const geom = feature.geometry as GeoJSON.Geometry
    if (geom.type !== 'GeometryCollection') {
      collectCoordinates(geom.coordinates, points)
    }
  })

  if (!points.length) return null

  let minLng = points[0][0]
  let minLat = points[0][1]
  let maxLng = points[0][0]
  let maxLat = points[0][1]

  points.forEach(([lng, lat]) => {
    minLng = Math.min(minLng, lng)
    minLat = Math.min(minLat, lat)
    maxLng = Math.max(maxLng, lng)
    maxLat = Math.max(maxLat, lat)
  })

  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ]
}

function extractPointCoordinates(geojson: GeoJSON.GeoJSON): Array<[number, number]> {
  const features =
    geojson.type === 'FeatureCollection'
      ? geojson.features
      : geojson.type === 'Feature'
        ? [geojson]
        : [{ type: 'Feature', geometry: geojson, properties: {} } as GeoJSON.Feature]

  const points: Array<[number, number]> = []

  features.forEach((feature) => {
    if (!feature.geometry) return
    if (feature.geometry.type === 'Point') {
      const coordinates = feature.geometry.coordinates
      if (Array.isArray(coordinates) && coordinates.length >= 2) {
        points.push([Number(coordinates[0]), Number(coordinates[1])])
      }
    }
    if (feature.geometry.type === 'MultiPoint') {
      feature.geometry.coordinates.forEach((coordinates) => {
        if (Array.isArray(coordinates) && coordinates.length >= 2) {
          points.push([Number(coordinates[0]), Number(coordinates[1])])
        }
      })
    }
  })

  return points.filter(([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat))
}

function createPinElement(): HTMLDivElement {
  const pin = document.createElement('div')
  pin.style.width = '16px'
  pin.style.height = '16px'
  pin.style.background = '#1d4ed8'
  pin.style.border = '1px solid #ffffff'
  pin.style.borderRadius = '50% 50% 50% 0'
  pin.style.boxShadow = '0 1px 4px rgba(0,0,0,0.35)'
  pin.style.transform = 'rotate(-45deg)'

  const dot = document.createElement('div')
  dot.style.width = '5px'
  dot.style.height = '5px'
  dot.style.background = '#ffffff'
  dot.style.borderRadius = '50%'
  dot.style.position = 'absolute'
  dot.style.left = '5px'
  dot.style.top = '5px'

  pin.appendChild(dot)
  return pin
}

export default function GeoJsonMapPreview({
  geojson,
  heightClassName = 'h-72',
}: GeoJsonMapPreviewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markersRef = useRef<maplibregl.Marker[]>([])

  function clearPointMarkers() {
    markersRef.current.forEach((marker) => marker.remove())
    markersRef.current = []
  }

  function updatePointMarkers(map: maplibregl.Map, data: GeoJSON.GeoJSON | null) {
    clearPointMarkers()
    if (!data) return
    const pointCoordinates = extractPointCoordinates(data)
    pointCoordinates.forEach((lngLat) => {
      const marker = new maplibregl.Marker({
        element: createPinElement(),
        anchor: 'bottom',
      })
        .setLngLat(lngLat)
        .addTo(map)
      markersRef.current.push(marker)
    })
  }

  function updatePreviewData(map: maplibregl.Map, data: GeoJSON.GeoJSON | null) {
    const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined
    if (!source) return
    source.setData(data ?? EMPTY_FEATURE_COLLECTION)
    updatePointMarkers(map, data)
    if (!data) return
    const bounds = getBoundsFromGeoJson(data)
    if (bounds) {
      map.fitBounds(bounds, { padding: 40, duration: 300, maxZoom: 17 })
    }
  }

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          [BASEMAP_SOURCE_ID]: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors',
          },
        },
        layers: [
          {
            id: BASEMAP_LAYER_ID,
            type: 'raster',
            source: BASEMAP_SOURCE_ID,
          },
        ],
      },
      center: [106.5, 11.5],
      zoom: 5,
      attributionControl: false,
    })

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right')

    map.on('load', () => {
      map.addSource(SOURCE_ID, {
        type: 'geojson',
        data: geojson ?? EMPTY_FEATURE_COLLECTION,
      })

      map.addLayer({
        id: FILL_LAYER_ID,
        type: 'fill',
        source: SOURCE_ID,
        paint: {
          'fill-color': '#2563eb',
          'fill-opacity': 0.2,
        },
      })

      map.addLayer({
        id: LINE_LAYER_ID,
        type: 'line',
        source: SOURCE_ID,
        paint: {
          'line-color': '#1d4ed8',
          'line-width': 2,
        },
      })

      updatePreviewData(map, geojson)
    })

    mapRef.current = map

    return () => {
      clearPointMarkers()
      map.remove()
      mapRef.current = null
    }
  }, [geojson])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (!map.isStyleLoaded()) {
      map.once('load', () => updatePreviewData(map, geojson))
      return
    }
    updatePreviewData(map, geojson)
  }, [geojson])

  return (
    <div
      ref={containerRef}
      className={`w-full overflow-hidden rounded border ${heightClassName}`}
    />
  )
}
