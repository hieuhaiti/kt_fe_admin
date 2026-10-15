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
const POINT_LAYER_ID = 'preview-points'

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
  const collectGeometry = (geometry: GeoJSON.Geometry) => {
    if (geometry.type === 'GeometryCollection') geometry.geometries.forEach(collectGeometry)
    else collectCoordinates(geometry.coordinates, points)
  }
  features.forEach((feature) => {
    if (feature.geometry) collectGeometry(feature.geometry)
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



export default function GeoJsonMapPreview({
  geojson,
  heightClassName = 'h-72',
}: GeoJsonMapPreviewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)


  function updatePreviewData(map: maplibregl.Map, data: GeoJSON.GeoJSON | null) {
    const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined
    if (!source) return
    source.setData(data ?? EMPTY_FEATURE_COLLECTION)
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

      map.addLayer({
        id: POINT_LAYER_ID,
        type: 'circle',
        source: SOURCE_ID,
        filter: ['==', '$type', 'Point'],
        paint: {
          'circle-radius': 6,
          'circle-color': '#1d4ed8',
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 1,
        },
      })
      updatePreviewData(map, geojson)
    })

    mapRef.current = map

    return () => {
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
