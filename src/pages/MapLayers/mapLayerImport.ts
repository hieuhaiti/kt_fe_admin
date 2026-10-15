import { z } from 'zod'

export const layerIdentifiersSchema = z.object({
  code: z.string().min(2).max(60).regex(/^[a-zA-Z0-9_-]+$/),
  table_name: z.string().max(120).regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/),
})

export function createLayerIdentifiers(name: string) {
  const slug = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 54)
  const base = slug || 'layer'
  const code = /^[a-z_]/.test(base) && base.length >= 2 ? base : `layer_${base}`
  return layerIdentifiersSchema.parse({ code, table_name: code.replace(/-/g, '_') })
}

export function readImportJobId(value: unknown): string | null {
  if (typeof value === 'number') return Number.isSafeInteger(value) && value > 0 ? String(value) : null
  return typeof value === 'string' && /^[1-9]\d*$/.test(value) ? value : null
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/** Validate without repairing coordinates, dropping features or guessing a projected CRS. */
export function validateGeoJson(value: unknown): GeoJSON.GeoJSON {
  const position = (point: unknown): point is number[] =>
    Array.isArray(point) && [2, 3].includes(point.length) && point.every(n => typeof n === 'number' && Number.isFinite(n)) &&
    Math.abs(point[0]) <= 180 && Math.abs(point[1]) <= 90
  const line = (points: unknown, minimum: number): points is number[][] =>
    Array.isArray(points) && points.length >= minimum && points.every(position)
  const ring = (points: unknown) => {
    if (!line(points, 4)) return false
    const first = points[0], last = points[points.length - 1]
    return first.length === last.length && first.every((n, i) => n === last[i])
  }
  const list = (items: unknown, check: (item: unknown) => boolean): boolean =>
    Array.isArray(items) && items.length > 0 && items.every(check)
  const polygon = (rings: unknown) => list(rings, ring)
  const geometry = (item: unknown, depth = 0): boolean => {
    if (!record(item) || depth > 32) return false
    switch (item.type) {
      case 'Point': return position(item.coordinates)
      case 'MultiPoint': return list(item.coordinates, position)
      case 'LineString': return line(item.coordinates, 2)
      case 'MultiLineString': return list(item.coordinates, points => line(points, 2))
      case 'Polygon': return polygon(item.coordinates)
      case 'MultiPolygon': return list(item.coordinates, polygon)
      case 'GeometryCollection': return list(item.geometries, child => geometry(child, depth + 1))
      default: return false
    }
  }
  const feature = (item: unknown): boolean => record(item) && item.type === 'Feature' &&
    (item.properties === null || record(item.properties)) && geometry(item.geometry)
  if (!record(value)) throw new Error('Tệp phải chứa một đối tượng GeoJSON.')
  if (value.crs !== undefined) {
    const crs = value.crs
    const name = record(crs) && record(crs.properties) ? crs.properties.name : undefined
    if (typeof name !== 'string' || !/^(EPSG:4326|urn:ogc:def:crs:EPSG::4326|urn:ogc:def:crs:OGC:1\.3:CRS84)$/i.test(name)) {
      throw new Error('GeoJSON cần dùng WGS 84 (EPSG:4326). Hãy chuyển hệ tọa độ trước khi nhập.')
    }
  }
  const valid = value.type === 'FeatureCollection' ? list(value.features, feature)
    : value.type === 'Feature' ? feature(value) : geometry(value)
  if (!valid) throw new Error('GeoJSON rỗng hoặc có hình học không hợp lệ. Kiểm tra tọa độ WGS 84, số điểm và vòng khép kín.')
  // All supported GeoJSON shapes and their coordinates were checked above.
  return value as unknown as GeoJSON.GeoJSON
}
