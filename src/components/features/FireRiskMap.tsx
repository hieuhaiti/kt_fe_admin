import { useEffect, useMemo, useRef } from 'react'
import maplibregl, { type GeoJSONSource, type LngLatBoundsLike } from 'maplibre-gl'

interface FireRiskMapProps {
  geojson: GeoJSON.FeatureCollection | null
  /** Fallback raster tile URL — dùng khi GeoServer WMS chưa publish.
   *  Server luôn cố sinh `snapshot.geeTileUrl` (không cần GCS). URL có TTL
   *  ~24h → có thể expired với snapshot cũ, maplibre log 404 nhưng không crash. */
  rasterTileUrl?: string | null
  /** LayerManager điều khiển visibility + opacity của từng lớp. */
  districtVisible?: boolean
  districtOpacity?: number
  heatVisible?: boolean
  heatOpacity?: number
  heightClassName?: string
}

const SOURCE_ID = 'fire-risk-source'
const BASEMAP_SOURCE_ID = 'osm-basemap'
const BASEMAP_LAYER_ID = 'osm-basemap-layer'
const RASTER_SOURCE_ID = 'fire-risk-raster'
const RASTER_LAYER_ID = 'fire-risk-raster-layer'
const FILL_LAYER_ID = 'fire-risk-fill'
const LINE_LAYER_ID = 'fire-risk-line'

const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }

// Bám palette RISK_LEVEL_VIZ ở fire-risk.service.js (cùng bảng với FireRiskPage).
const LEVEL_COLORS: Record<number, string> = {
  1: '#00a65a',
  2: '#f6e84a',
  3: '#f39c12',
  4: '#e74c3c',
  5: '#7b241c',
}

const LEVEL_LABEL: Record<number, string> = {
  1: 'Cấp I — Thấp',
  2: 'Cấp II — Trung bình',
  3: 'Cấp III — Cao',
  4: 'Cấp IV — Nguy hiểm',
  5: 'Cấp V — Cực kỳ nguy hiểm',
}

// Fallback khi FeatureCollection không có geometry: bounds Kon Tum để map không bay tứ tán.
const KON_TUM_CENTER: [number, number] = [107.98, 14.55]

// ─────────────────────────────────────────────────────────────────────────────
// UTM 48N → WGS84 reprojection.
//
// Server persist geometry ở EPSG:32648 (UTM 48N meters) — thấy qua
// geometry.crs.properties.name === "EPSG:32648". maplibre chỉ nhận WGS84 nên
// mọi coordinate phải reproject trước khi setData/fitBounds. Không có proj4
// trong deps admin nên implement inverse Transverse Mercator theo Snyder §8.
// (Code mirror với client MonitoringAndAlerting để 2 UI cùng behavior.)
// ─────────────────────────────────────────────────────────────────────────────
const UTM48N_ZONE = 48
const UTM_A = 6378137
const UTM_E2 = 0.00669437999014
const UTM_K0 = 0.9996

function utm48nToLngLat(easting: number, northing: number): { lng: number; lat: number } {
  const x = easting - 500000
  const y = northing // UTM 48N bắc bán cầu → không cần offset 10_000_000
  const e1 = (1 - Math.sqrt(1 - UTM_E2)) / (1 + Math.sqrt(1 - UTM_E2))
  const eSq = UTM_E2 / (1 - UTM_E2)

  const M = y / UTM_K0
  const mu = M / (UTM_A * (1 - UTM_E2 / 4 - (3 * UTM_E2 ** 2) / 64 - (5 * UTM_E2 ** 3) / 256))
  const phi1 =
    mu +
    ((3 * e1) / 2 - (27 * e1 ** 3) / 32) * Math.sin(2 * mu) +
    ((21 * e1 ** 2) / 16 - (55 * e1 ** 4) / 32) * Math.sin(4 * mu) +
    ((151 * e1 ** 3) / 96) * Math.sin(6 * mu) +
    ((1097 * e1 ** 4) / 512) * Math.sin(8 * mu)

  const sinPhi1 = Math.sin(phi1)
  const cosPhi1 = Math.cos(phi1)
  const tanPhi1 = Math.tan(phi1)
  const N1 = UTM_A / Math.sqrt(1 - UTM_E2 * sinPhi1 ** 2)
  const T1 = tanPhi1 ** 2
  const C1 = eSq * cosPhi1 ** 2
  const R1 = (UTM_A * (1 - UTM_E2)) / (1 - UTM_E2 * sinPhi1 ** 2) ** 1.5
  const D = x / (N1 * UTM_K0)

  const latRad =
    phi1 -
    ((N1 * tanPhi1) / R1) *
      (D ** 2 / 2 -
        ((5 + 3 * T1 + 10 * C1 - 4 * C1 ** 2 - 9 * eSq) * D ** 4) / 24 +
        ((61 + 90 * T1 + 298 * C1 + 45 * T1 ** 2 - 252 * eSq - 3 * C1 ** 2) * D ** 6) / 720)
  const lngRad =
    (D -
      ((1 + 2 * T1 + C1) * D ** 3) / 6 +
      ((5 - 2 * C1 + 28 * T1 - 3 * C1 ** 2 + 8 * eSq + 24 * T1 ** 2) * D ** 5) / 120) /
    cosPhi1

  const lng0Rad = (((UTM48N_ZONE - 1) * 6 - 180 + 3) * Math.PI) / 180
  return {
    lng: ((lng0Rad + lngRad) * 180) / Math.PI,
    lat: (latRad * 180) / Math.PI,
  }
}

// Heuristic: WGS84 luôn |lng| ≤ 180, |lat| ≤ 90. UTM meters cỡ ~10⁵–10⁶.
function looksLikeUtm(x: number, y: number): boolean {
  return Math.abs(x) > 360 || Math.abs(y) > 90
}

/**
 * Reproject geometry Polygon/MultiPolygon từ UTM 48N → WGS84 nếu cần.
 * Trả về geometry mới (WGS84) hoặc null nếu rỗng/không hợp lệ.
 */
function reprojectGeometry(geometry: any): any {
  if (!geometry?.type || !Array.isArray(geometry.coordinates)) return null
  const crsName: string = geometry?.crs?.properties?.name || ''
  const forceUtm = crsName.includes('32648')

  const convertPt = (pt: number[]): number[] => {
    const [x, y] = pt
    if (forceUtm || looksLikeUtm(x, y)) {
      const { lng, lat } = utm48nToLngLat(x, y)
      return [lng, lat]
    }
    return [x, y]
  }
  const convertRing = (ring: number[][]): number[][] => ring.map(convertPt)
  const convertPolygon = (poly: number[][][]): number[][][] => poly.map(convertRing)

  if (geometry.type === 'Polygon') {
    if (!geometry.coordinates.length) return null
    return { type: 'Polygon', coordinates: convertPolygon(geometry.coordinates) }
  }
  if (geometry.type === 'MultiPolygon') {
    if (!geometry.coordinates.length) return null
    return { type: 'MultiPolygon', coordinates: geometry.coordinates.map(convertPolygon) }
  }
  return null
}

function collectCoords(v: unknown, out: Array<[number, number]> = []): Array<[number, number]> {
  if (!v) return out
  if (Array.isArray(v) && typeof v[0] === 'number' && typeof v[1] === 'number') {
    out.push([v[0] as number, v[1] as number])
    return out
  }
  if (Array.isArray(v)) v.forEach((x) => collectCoords(x, out))
  return out
}

function getBounds(fc: GeoJSON.FeatureCollection): LngLatBoundsLike | null {
  const points: Array<[number, number]> = []
  fc.features.forEach((f) => {
    if (!f.geometry || f.geometry.type === 'GeometryCollection') return
    collectCoords((f.geometry as any).coordinates, points)
  })
  if (!points.length) return null
  let [minLng, minLat] = points[0]
  let [maxLng, maxLat] = points[0]
  for (const [lng, lat] of points) {
    if (lng < minLng) minLng = lng
    if (lat < minLat) minLat = lat
    if (lng > maxLng) maxLng = lng
    if (lat > maxLat) maxLat = lat
  }
  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ]
}

function formatHa(v: unknown): string {
  const n = Number(v)
  if (!isFinite(n)) return '—'
  return `${n.toLocaleString('vi-VN', { maximumFractionDigits: 0 })} ha`
}

// NOTE — sau bước dedupe trong drawable, mỗi polygon = 1 huyện với maxLevel
// = cấp cao nhất của huyện. Popup ưu tiên `maxLevel` (chắc chắn được set),
// fallback về `riskLevel`. `areaHa` là ha ở CHÍNH cấp maxLevel — server trả
// theo feature (huyện × cấp), sau dedupe ta giữ feature cấp cao nhất.
// KHÔNG hiện P Nesterov để đồng bộ chính sách với FireRiskPage.
function buildPopupHtml(props: Record<string, any>): string {
  const level = Number(props.maxLevel ?? props.riskLevel ?? props.risk_level ?? 0)
  const name = props.districtName ?? props.district_name ?? '—'
  const code = props.districtCode ?? props.district_code ?? '—'
  const areaHa = props.areaHa ?? props.area_ha
  const s2 = props.s2Coverage ?? props?.properties?.s2Coverage
  const color = LEVEL_COLORS[level] || '#64748b'
  return `
    <div style="font-size:12px;min-width:200px">
      <div style="font-weight:600;margin-bottom:4px">${name} <span style="color:#64748b">(${code})</span></div>
      <div style="display:inline-block;padding:2px 6px;border-radius:4px;background:${color};color:#fff;margin-bottom:6px">
        ${LEVEL_LABEL[level] || `Cấp ${level}`}
      </div>
      <div>Diện tích ở cấp cao nhất: <b>${formatHa(areaHa)}</b></div>
      ${s2 != null ? `<div>S2 coverage: <b>${(Number(s2) * 100).toFixed(1)}%</b></div>` : ''}
    </div>
  `
}

export default function FireRiskMap({
  geojson,
  rasterTileUrl,
  districtVisible = true,
  districtOpacity = 0.45,
  heatVisible = true,
  heatOpacity = 0.65,
  heightClassName = 'h-96',
}: FireRiskMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const popupRef = useRef<maplibregl.Popup | null>(null)

  // NOTE — 3 việc ở đây, đồng bộ với client MonitoringAndAlerting:
  //   1. Bỏ feature không có geometry (maplibre crash nếu geometry undefined).
  //   2. Reproject geometry UTM 48N → WGS84 nếu server trả EPSG:32648
  //      (thấy qua crs.properties.name). Nếu bỏ bước này, polygon bay ra
  //      ngoài phạm vi Trái đất và map hiện "chưa có geometry" dù có coords.
  //   3. Dedupe theo districtCode + giữ maxLevel — server trả 1 feature /
  //      (huyện × cấp), 3-5 feature cùng geometry chồng lên nhau. Dedupe →
  //      1 polygon / huyện, tô màu THEO cấp cao nhất (giống client). Không
  //      dedupe thì polygon cấp thấp đè lên cấp cao dẫn tới "sai màu".
  //   4. Gán sẵn `color` (LEVEL_COLORS[maxLevel]) vào properties → paint layer
  //      chỉ cần `['get', 'color']`, tránh phải match trong maplibre.
  const drawable = useMemo<GeoJSON.FeatureCollection>(() => {
    if (!geojson) return EMPTY
    const byCode = new Map<string, {
      geometry: GeoJSON.Geometry
      properties: Record<string, any>
      maxLevel: number
    }>()
    for (const f of geojson.features) {
      const geom = reprojectGeometry(f?.geometry)
      if (!geom) continue
      const props: Record<string, any> = { ...(f.properties as any) }
      const code = String(props.districtCode ?? props.district_code ?? '')
      const level = Number(props.riskLevel ?? props.risk_level ?? 0) || 0
      const key = code || `__anon_${byCode.size}`
      const cur = byCode.get(key)
      if (!cur) {
        byCode.set(key, {
          geometry: geom as GeoJSON.Geometry,
          properties: props,
          maxLevel: level,
        })
      } else if (level > cur.maxLevel) {
        cur.maxLevel = level
        // Giữ geometry đầu tiên (đều cùng polygon huyện), nhưng update properties
        // sang feature cấp cao hơn để popup show đúng thông tin đỉnh cấp.
        cur.properties = props
      }
    }
    const features: GeoJSON.Feature[] = []
    for (const v of byCode.values()) {
      features.push({
        type: 'Feature',
        geometry: v.geometry,
        properties: {
          ...v.properties,
          maxLevel: v.maxLevel,
          color: LEVEL_COLORS[v.maxLevel] || '#94a3b8',
        },
      })
    }
    return { type: 'FeatureCollection', features }
  }, [geojson])

  const hasGeometry = drawable.features.length > 0

  function apply(map: maplibregl.Map) {
    const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined
    if (!source) return
    source.setData(drawable)
    const bounds = getBounds(drawable)
    if (bounds) map.fitBounds(bounds, { padding: 40, duration: 300, maxZoom: 12 })
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
        layers: [{ id: BASEMAP_LAYER_ID, type: 'raster', source: BASEMAP_SOURCE_ID }],
      },
      center: KON_TUM_CENTER,
      zoom: 7.5,
      attributionControl: false,
    })
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right')

    map.on('load', () => {
      map.addSource(SOURCE_ID, { type: 'geojson', data: drawable })

      // Fill + line dùng chung `properties.color` (đã set trong drawable
      // theo maxLevel của huyện, đồng bộ với client MonitoringAndAlerting).
      // Opacity 0.45 = đủ nhìn màu qua basemap OSM, không đè hết chi tiết.
      map.addLayer({
        id: FILL_LAYER_ID,
        type: 'fill',
        source: SOURCE_ID,
        paint: {
          'fill-color': ['get', 'color'],
          'fill-opacity': districtOpacity,
        },
        layout: { visibility: districtVisible ? 'visible' : 'none' },
      })

      map.addLayer({
        id: LINE_LAYER_ID,
        type: 'line',
        source: SOURCE_ID,
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 1.8,
        },
        layout: { visibility: districtVisible ? 'visible' : 'none' },
      })

      map.on('click', FILL_LAYER_ID, (e) => {
        const f = e.features?.[0]
        if (!f) return
        popupRef.current?.remove()
        popupRef.current = new maplibregl.Popup({ closeButton: true })
          .setLngLat(e.lngLat)
          .setHTML(buildPopupHtml(f.properties as any))
          .addTo(map)
      })
      map.on('mouseenter', FILL_LAYER_ID, () => (map.getCanvas().style.cursor = 'pointer'))
      map.on('mouseleave', FILL_LAYER_ID, () => (map.getCanvas().style.cursor = ''))

      apply(map)
    })

    mapRef.current = map

    return () => {
      popupRef.current?.remove()
      popupRef.current = null
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (!map.isStyleLoaded() || !map.getSource(SOURCE_ID)) {
      map.once('load', () => apply(map))
      return
    }
    apply(map)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawable])

  // ── Fallback raster layer (WMS GeoServer hoặc GEE tile URL) ──────────────
  // NOTE — chèn raster GIỮA basemap và fill polygon huyện: OSM ở dưới, raster
  // cấp cháy ở giữa (mờ), vector polygon huyện ở trên cùng. Nhờ vậy user thấy
  // cả pixel-level (raster) lẫn boundary (vector).
  //
  // rasterTileUrl thay đổi (URL mới, snapshot refresh, hoặc chuyển null → có)
  // → xoá layer/source cũ, thêm lại. Không cần restart map.
  // NOTE — dep CHỈ là rasterTileUrl, KHÔNG có heat*. Nếu để heat* ở đây,
  // mỗi lần user kéo slider opacity thì layer bị recreate (mất tile cache
  // + nháy màn hình). Visibility + opacity update qua effect riêng bên dưới.
  //
  // Vấn đề trước đó: admin không hiện raster vì `map.once('load', setup)`
  // register callback cho lần load KẾ TIẾP; nếu map đã load rồi thì callback
  // không bao giờ chạy. Đã guard bằng `map.isStyleLoaded()`. Thêm log để
  // debug URL nếu vẫn không lên.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const setup = () => {
      if (map.getLayer(RASTER_LAYER_ID)) map.removeLayer(RASTER_LAYER_ID)
      if (map.getSource(RASTER_SOURCE_ID)) map.removeSource(RASTER_SOURCE_ID)
      if (!rasterTileUrl) {
        console.debug('[FireRiskMap] no rasterTileUrl → skip raster layer')
        return
      }
      console.debug('[FireRiskMap] adding raster layer:', rasterTileUrl.slice(0, 80) + '...')
      map.addSource(RASTER_SOURCE_ID, {
        type: 'raster',
        tiles: [rasterTileUrl],
        tileSize: 256,
        attribution: 'Fire Risk raster (GeoServer WMS / Earth Engine)',
      })
      // beforeId = FILL_LAYER_ID → chèn dưới fill huyện, trên basemap.
      map.addLayer(
        {
          id: RASTER_LAYER_ID,
          type: 'raster',
          source: RASTER_SOURCE_ID,
          paint: { 'raster-opacity': heatOpacity },
          layout: { visibility: heatVisible ? 'visible' : 'none' },
        },
        map.getLayer(FILL_LAYER_ID) ? FILL_LAYER_ID : undefined,
      )
    }
    if (map.isStyleLoaded()) setup()
    else map.once('load', setup)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rasterTileUrl])

  // District layer visibility + opacity — cập nhật khi props thay đổi mà
  // không cần recreate layer/source.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const apply = () => {
      if (map.getLayer(FILL_LAYER_ID)) {
        map.setPaintProperty(FILL_LAYER_ID, 'fill-opacity', districtOpacity)
        map.setLayoutProperty(FILL_LAYER_ID, 'visibility', districtVisible ? 'visible' : 'none')
      }
      if (map.getLayer(LINE_LAYER_ID)) {
        map.setLayoutProperty(LINE_LAYER_ID, 'visibility', districtVisible ? 'visible' : 'none')
      }
    }
    if (map.isStyleLoaded()) apply()
    else map.once('load', apply)
  }, [districtVisible, districtOpacity])

  // Raster layer visibility + opacity — separate effect để không recreate
  // khi user chỉ toggle visibility (giữ tile cache).
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.getLayer(RASTER_LAYER_ID)) return
    map.setPaintProperty(RASTER_LAYER_ID, 'raster-opacity', heatOpacity)
    map.setLayoutProperty(RASTER_LAYER_ID, 'visibility', heatVisible ? 'visible' : 'none')
  }, [heatVisible, heatOpacity])

  return (
    <div className="relative">
      <div
        ref={containerRef}
        className={`w-full overflow-hidden rounded-md border ${heightClassName}`}
      />
      {!hasGeometry && (
        <div className="pointer-events-none absolute inset-x-0 top-2 mx-auto w-fit rounded-md bg-amber-50/95 px-3 py-1 text-xs text-amber-800 shadow">
          Không có polygon để hiển thị (snapshot chưa có geometry).
        </div>
      )}
      {/* Legend */}
      <div className="absolute bottom-2 left-2 rounded-md bg-white/95 p-2 text-xs shadow">
        <div className="mb-1 font-semibold">Cấp cảnh báo</div>
        {[1, 2, 3, 4, 5].map((l) => (
          <div key={l} className="flex items-center gap-2">
            <span
              className="inline-block h-3 w-3 rounded-sm border"
              style={{ backgroundColor: LEVEL_COLORS[l] }}
            />
            <span>{LEVEL_LABEL[l]}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
