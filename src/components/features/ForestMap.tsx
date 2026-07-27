import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'

export type RasterLoadStatus = 'idle' | 'loading' | 'ready' | 'error'

interface ForestMapProps {
  /** WMS raster tile URL — build từ resolveRasterTileUrl (ưu tiên GeoServer,
   *  fallback GEE tile URL có thời hạn). */
  rasterTileUrl?: string | null
  /** Legend items để hiển thị bảng chú giải 11 lớp góc dưới bản đồ. */
  legend?: Array<{ classId: number; name: string; color: string }>
  /** Opacity 0-1 cho raster overlay. */
  opacity?: number
  visible?: boolean
  heightClassName?: string
  onRasterStatusChange?: (status: RasterLoadStatus) => void
}

const BASEMAP_SOURCE_ID = 'osm-basemap'
const BASEMAP_LAYER_ID = 'osm-basemap-layer'
const RASTER_SOURCE_ID = 'forest-class-raster'
const RASTER_LAYER_ID = 'forest-class-raster-layer'

// Kon Tum province center — dùng làm fallback khi chưa có bounds.
const KON_TUM_CENTER: [number, number] = [107.98, 14.55]

/**
 * Bản đồ preview raster phân loại rừng 11 lớp. Skeleton tối giản so với
 * FireRiskMap: không vector layer huyện (forest chỉ có raster), không popup
 * click, không reproject UTM (server serve WMS 3857 sẵn).
 *
 * Effect separation giống FireRiskMap:
 *   - Init map 1 lần (empty deps)
 *   - Raster lifecycle theo `rasterTileUrl` (recreate source khi URL đổi)
 *   - Visibility + opacity dùng setLayoutProperty/setPaintProperty riêng
 *     → toggle/kéo slider không teardown source, giữ tile cache.
 */
export default function ForestMap({
  rasterTileUrl,
  legend,
  opacity = 0.75,
  visible = true,
  heightClassName = 'h-96',
  onRasterStatusChange,
}: ForestMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const [rasterStatus, setRasterStatus] = useState<RasterLoadStatus>('idle')
  const onRasterStatusChangeRef = useRef(onRasterStatusChange)

  useEffect(() => {
    onRasterStatusChangeRef.current = onRasterStatusChange
  }, [onRasterStatusChange])

  // Init map một lần khi mount. Cleanup destroy khi unmount.
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
        layers: [{ id: BASEMAP_LAYER_ID, type: 'raster', source: BASEMAP_SOURCE_ID }],
      },
      center: KON_TUM_CENTER,
      zoom: 8,
      attributionControl: false,
    })
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right')

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Raster lifecycle theo URL. Đổi URL → xoá source cũ + add lại.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    let failed = false
    const updateStatus = (status: RasterLoadStatus) => {
      setRasterStatus(status)
      onRasterStatusChangeRef.current?.(status)
    }
    const handleSourceData = (event: any) => {
      if (!failed && event.sourceId === RASTER_SOURCE_ID && event.isSourceLoaded) {
        updateStatus('ready')
      }
    }
    const handleSourceError = (event: any) => {
      if (event.sourceId !== RASTER_SOURCE_ID) return
      failed = true
      updateStatus('error')
    }
    const setup = () => {
      if (map.getLayer(RASTER_LAYER_ID)) map.removeLayer(RASTER_LAYER_ID)
      if (map.getSource(RASTER_SOURCE_ID)) map.removeSource(RASTER_SOURCE_ID)
      if (!rasterTileUrl) {
        updateStatus('idle')
        return
      }
      failed = false
      updateStatus('loading')
      try {
        map.addSource(RASTER_SOURCE_ID, {
          type: 'raster',
          tiles: [rasterTileUrl],
          tileSize: 256,
          attribution: 'Bản đồ phân loại lớp phủ rừng',
        })
        map.addLayer({
          id: RASTER_LAYER_ID,
          type: 'raster',
          source: RASTER_SOURCE_ID,
          paint: { 'raster-opacity': opacity },
          layout: { visibility: visible ? 'visible' : 'none' },
        })
      } catch {
        failed = true
        updateStatus('error')
      }
    }
    map.on('sourcedata', handleSourceData)
    map.on('error', handleSourceError)
    if (map.isStyleLoaded()) setup()
    else map.once('load', setup)
    return () => {
      map.off('load', setup)
      map.off('sourcedata', handleSourceData)
      map.off('error', handleSourceError)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rasterTileUrl])

  // Visibility + opacity separate effect — chỉ set paint/layout, không recreate.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.getLayer(RASTER_LAYER_ID)) return
    map.setPaintProperty(RASTER_LAYER_ID, 'raster-opacity', opacity)
    map.setLayoutProperty(RASTER_LAYER_ID, 'visibility', visible ? 'visible' : 'none')
  }, [visible, opacity])

  return (
    <div className={`relative ${heightClassName}`}>
      <div ref={containerRef} className="h-full w-full overflow-hidden rounded-md border" />
      {rasterStatus === 'idle' && (
        <div className="pointer-events-none absolute inset-x-0 top-2 mx-auto w-fit rounded-md bg-amber-50/95 px-3 py-1 text-xs text-amber-800 shadow">
          Chưa có dữ liệu bản đồ khả dụng.
        </div>
      )}
      {rasterStatus === 'loading' && (
        <div className="pointer-events-none absolute inset-x-0 top-2 mx-auto w-fit rounded-md bg-sky-50/95 px-3 py-1 text-xs text-sky-800 shadow">
          Đang tải dữ liệu bản đồ...
        </div>
      )}
      {rasterStatus === 'error' && (
        <div className="pointer-events-none absolute inset-x-0 top-2 mx-auto w-fit rounded-md bg-red-50/95 px-3 py-1 text-xs text-red-700 shadow">
          Không tải được dữ liệu bản đồ.
        </div>
      )}
      {/* Legend góc dưới trái */}
      {legend && legend.length > 0 && (
        <div className="absolute bottom-2 left-2 max-h-64 overflow-y-auto rounded-md bg-white/95 p-2 text-xs shadow">
          <div className="mb-1 font-semibold">Chú giải 11 lớp</div>
          {legend.map((c) => (
            <div key={c.classId} className="flex items-center gap-2">
              <span
                className="inline-block h-3 w-3 rounded-sm border"
                style={{ backgroundColor: c.color }}
              />
              <span className="truncate" title={c.name}>
                {c.classId} – {c.name}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
