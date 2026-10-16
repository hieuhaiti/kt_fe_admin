import { z } from 'zod'
import { utm48nToLngLat } from '@/lib/coordinates'

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

function declaredEpsg(value: Record<string, unknown>): 4326 | 32648 | undefined {
  if (value.crs === undefined) return undefined
  const crs = value.crs
  const name = record(crs) && record(crs.properties) ? crs.properties.name : undefined
  if (typeof name === 'string') {
    if (/^(EPSG:4326|urn:ogc:def:crs:EPSG::4326|urn:ogc:def:crs:OGC:1\.3:CRS84)$/i.test(name)) return 4326
    if (/^(EPSG:32648|urn:ogc:def:crs:EPSG::32648)$/i.test(name)) return 32648
  }
  throw new Error('Chỉ hỗ trợ GeoJSON dùng EPSG:4326 hoặc EPSG:32648. Hãy kiểm tra hệ tọa độ của tệp.')
}

/** Detect the supported source CRS; preserve features, properties and Z. */
export function normalizeGeoJson(value: unknown): {
  geojson: GeoJSON.GeoJSON
  sourceEpsg: 4326 | 32648
} {
  if (!record(value)) throw new Error('Tệp phải chứa một đối tượng GeoJSON.')
  const declarations = new Set<4326 | 32648>()
  let positions = 0
  let allWgs84 = true
  let allUtm48n = true
  const inspectCoordinates = (coordinates: unknown, depth = 0): void => {
    if (!Array.isArray(coordinates) || depth > 4) throw new Error('Tọa độ GeoJSON không hợp lệ.')
    if (typeof coordinates[0] !== 'number') {
      coordinates.forEach(child => inspectCoordinates(child, depth + 1))
      return
    }
    if (![2, 3].includes(coordinates.length) || !coordinates.every(n => typeof n === 'number' && Number.isFinite(n))) {
      throw new Error('Mỗi điểm cần có hai hoặc ba tọa độ là số hữu hạn.')
    }
    const [x, y] = coordinates
    positions += 1
    allWgs84 &&= Math.abs(x) <= 180 && Math.abs(y) <= 90
    allUtm48n &&= x >= 100000 && x <= 900000 && y >= 0 && y <= 10000000
  }
  const inspect = (item: unknown, depth = 0): void => {
    if (!record(item) || depth > 32) throw new Error('Hình học GeoJSON không hợp lệ.')
    const declared = declaredEpsg(item)
    if (declared !== undefined) declarations.add(declared)
    if (item.type === 'FeatureCollection' && Array.isArray(item.features)) item.features.forEach(child => inspect(child, depth + 1))
    else if (item.type === 'Feature') inspect(item.geometry, depth + 1)
    else if (item.type === 'GeometryCollection' && Array.isArray(item.geometries)) item.geometries.forEach(child => inspect(child, depth + 1))
    else inspectCoordinates(item.coordinates)
  }
  inspect(value)
  if (declarations.size > 1) throw new Error('Tệp khai báo nhiều hệ tọa độ khác nhau. Hãy thống nhất hệ tọa độ trước khi tải lên.')
  // Undeclared projected data uses the application's explicit UTM 48N convention.
  const sourceEpsg = declarations.values().next().value ?? (positions > 0 && allWgs84 ? 4326 : positions > 0 && allUtm48n ? 32648 : undefined)
  if (sourceEpsg === undefined) {
    throw new Error('Không nhận diện được hệ tọa độ hoặc tệp có tọa độ không hợp lệ. Chỉ hỗ trợ EPSG:4326 và EPSG:32648; hãy kiểm tra hoặc khai báo CRS trong tệp.')
  }
  const projectCoordinates = (coordinates: unknown, depth = 0): unknown => {
    if (!Array.isArray(coordinates) || depth > 4) throw new Error('Tọa độ GeoJSON không hợp lệ.')
    if (typeof coordinates[0] !== 'number') return coordinates.map(child => projectCoordinates(child, depth + 1))
    if (![2, 3].includes(coordinates.length) || !coordinates.every(n => typeof n === 'number' && Number.isFinite(n))) {
      throw new Error('Mỗi điểm cần có hai hoặc ba tọa độ là số hữu hạn.')
    }
    const [x, y, z] = coordinates
    if (x < 100000 || x > 900000 || y < 0 || y > 10000000) {
      throw new Error('Tọa độ nằm ngoài phạm vi UTM 48N (EPSG:32648). Hãy kiểm tra hệ tọa độ nguồn.')
    }
    const { lng, lat } = utm48nToLngLat(x, y)
    if (!Number.isFinite(lng) || !Number.isFinite(lat) || lat < 0 || lat > 84) {
      throw new Error('Không chuyển được tọa độ EPSG:32648. Hãy kiểm tra dữ liệu nguồn.')
    }
    return coordinates.length === 3 ? [lng, lat, z] : [lng, lat]
  }
  const visit = (item: unknown, depth = 0): unknown => {
    if (!record(item) || depth > 32) throw new Error('Hình học GeoJSON không hợp lệ.')
    const declared = declaredEpsg(item)
    if (declared !== undefined && declared !== sourceEpsg) {
      throw new Error('Tệp khai báo nhiều hệ tọa độ khác nhau. Hãy thống nhất hệ tọa độ trước khi tải lên.')
    }
    const result = { ...item }
    if (sourceEpsg === 32648) {
      // Projected bounds/CRS cannot be retained on longitude/latitude output.
      delete result.crs
      delete result.bbox
    }
    if (item.type === 'FeatureCollection' && Array.isArray(item.features)) {
      result.features = item.features.map(feature => visit(feature, depth + 1))
    } else if (item.type === 'Feature') {
      result.geometry = visit(item.geometry, depth + 1)
    } else if (item.type === 'GeometryCollection' && Array.isArray(item.geometries)) {
      result.geometries = item.geometries.map(geometry => visit(geometry, depth + 1))
    } else if (sourceEpsg === 32648) {
      result.coordinates = projectCoordinates(item.coordinates)
    }
    return result
  }
  const normalized = visit(value)
  return { geojson: validateGeoJson(sourceEpsg === 4326 ? value : normalized), sourceEpsg }
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
