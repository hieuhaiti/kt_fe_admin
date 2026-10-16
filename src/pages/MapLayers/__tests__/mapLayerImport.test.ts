import { describe, expect, it } from 'vitest'
import { createLayerIdentifiers, layerIdentifiersSchema, readImportJobId, validateGeoJson, normalizeGeoJson } from '../mapLayerImport'

const point = { type: 'Feature', properties: { name: 'Kon Tum' }, geometry: { type: 'Point', coordinates: [108, 14.35] } }
describe('layer import validation', () => {
  it.each([7, '7', '9007199254740993'])('preserves valid API job id %s', value => {
    expect(readImportJobId(value)).toBe(String(value))
  })
  it.each([undefined, null, 0, -1, 1.5, 'abc', '', '1/2', Number.MAX_SAFE_INTEGER + 1])('rejects invalid job id %s', value => {
    expect(readImportJobId(value)).toBeNull()
  })
  it('generates stable identifiers without changing names', () => {
    expect(createLayerIdentifiers('🌲')).toEqual(createLayerIdentifiers('🌲'))
  })
  it.each(['Biến động 1991-2023', '2026 Kon Tum', 'Đắk Glei / rừng @ 2026', '-', 'A', '🌲', 'R'.repeat(200)])('normalizes %s to valid identifiers', name => {
    const result = createLayerIdentifiers(name)
    expect(layerIdentifiersSchema.safeParse(result).success).toBe(true)
    expect(result.table_name).toMatch(/^[a-zA-Z_][a-zA-Z0-9_]*$/)
  })
  it('preserves the valid code hyphen but removes it from table_name', () => {
    expect(createLayerIdentifiers('Biến động lớp phủ Kon Tum 1991-2023 tesst')).toEqual({
      code: 'bien_dong_lop_phu_kon_tum_1991-2023_tesst', table_name: 'bien_dong_lop_phu_kon_tum_1991_2023_tesst',
    })
  })
  it('accepts XYZ positions without removing elevation', () => {
    const geometry = { type: 'Point', coordinates: [108, 14, 123.4] }
    expect(validateGeoJson(geometry)).toBe(geometry)
    expect(geometry.coordinates[2]).toBe(123.4)
  })
  it('preserves the entire collection and properties without mutating data', () => {
    const collection = { type: 'FeatureCollection', features: [point, { ...point, geometry: { type: 'Point', coordinates: [108.1, 14.4] } }] }
    expect(validateGeoJson(collection)).toBe(collection)
    expect(collection.features).toHaveLength(2)
  })
  it.each([
    null, {}, { type: 'FeatureCollection', features: [] },
    { ...point, geometry: { type: 'Point', coordinates: [500000, 1500000] } },
    { type: 'LineString', coordinates: [[108, 14]] },
    { type: 'Polygon', coordinates: [[[108, 14], [109, 14], [109, 15], [108, 15]]] },
    { type: 'Point', coordinates: [NaN, 14] },
    { type: 'Point', coordinates: [108, 14, 123, 4] },
    { ...point, crs: { properties: { name: 'EPSG:3405' } } },
  ])('rejects malformed/empty/projected data: %j', value => {
    expect(() => validateGeoJson(value)).toThrow()
  })
  it('accepts closed polygons and mixed geometry collections', () => {
    const geometry = { type: 'GeometryCollection', geometries: [point.geometry, { type: 'Polygon', coordinates: [[[108,14], [109,14], [109,15], [108,14]]] }] }
    expect(validateGeoJson(geometry)).toBe(geometry)
  })
})

describe('GeoJSON CRS normalization', () => {
  const crs = { type: 'name', properties: { name: 'EPSG:32648' } }
  const coordinates = [500000, 1500000, 123.4]
  const projectedPoint = { type: 'Point', coordinates }

  it('converts declared UTM48N without changing properties, ids, elevation or source data', () => {
    const input = { type: 'FeatureCollection', crs, bbox: [500000, 1500000, 500000, 1500000], features: [
      { type: 'Feature', id: 'forest-1', properties: { name: 'Kon Tum', value: 0 }, geometry: projectedPoint },
    ] }
    const before = JSON.stringify(input)
    const result = normalizeGeoJson(input)
    expect(result.sourceEpsg).toBe(32648)
    expect(result.geojson.type).toBe('FeatureCollection')
    if (result.geojson.type !== 'FeatureCollection') throw new Error('Expected FeatureCollection')
    const feature = result.geojson.features[0]
    expect(feature.id).toBe('forest-1')
    expect(feature.properties).toEqual(input.features[0].properties)
    if (feature.geometry.type !== 'Point') throw new Error('Expected Point')
    // UTM central meridian: 500000 E is exactly 105° E in zone 48.
    expect(feature.geometry.coordinates[0]).toBeCloseTo(105, 8)
    expect(feature.geometry.coordinates[1]).toBeCloseTo(13.568451278, 7)
    expect(feature.geometry.coordinates[2]).toBe(123.4)
    expect(result.geojson).not.toHaveProperty('crs')
    expect(result.geojson).not.toHaveProperty('bbox')
    expect(JSON.stringify(input)).toBe(before)
    expect(normalizeGeoJson(result.geojson).geojson).toBe(result.geojson)
  })

  it('accepts the EPSG URN form', () => {
    expect(normalizeGeoJson({ ...projectedPoint, crs: { properties: { name: 'urn:ogc:def:crs:EPSG::32648' } } }).sourceEpsg).toBe(32648)
  })

  it('detects undeclared coordinates within the two supported CRSs', () => {
    expect(normalizeGeoJson(projectedPoint).sourceEpsg).toBe(32648)
    expect(normalizeGeoJson(point).geojson).toBe(point)
  })

  const ring = [[500000, 1500000], [500100, 1500000], [500100, 1500100], [500000, 1500000]]
  it.each([
    projectedPoint,
    { type: 'MultiPoint', coordinates: [[500000, 1500000], [500100, 1500000]] },
    { type: 'LineString', coordinates: ring },
    { type: 'MultiLineString', coordinates: [ring] },
    { type: 'Polygon', coordinates: [ring] },
    { type: 'MultiPolygon', coordinates: [[ring]] },
    { type: 'GeometryCollection', geometries: [projectedPoint, { type: 'Polygon', coordinates: [ring] }] },
  ])('preserves geometry type and validates converted %j', geometry => {
    const result = normalizeGeoJson({ ...geometry, crs }).geojson
    expect(result.type).toBe(geometry.type)
    expect(validateGeoJson(result)).toBe(result)
  })

  it.each([
    { ...projectedPoint, crs: { properties: { name: 'EPSG:3405' } } },
    { type: 'Point', crs, coordinates: [NaN, 1500000] },
    { type: 'Point', crs, coordinates: [500000, -1] },
    { type: 'Point', crs, coordinates: [108, 14] },
    { type: 'Polygon', crs, coordinates: [[[500000, 1500000], [500100, 1500000], [500100, 1500100], [500000, 1500100]]] },
    { type: 'FeatureCollection', crs, features: [{ ...point, crs: { properties: { name: 'EPSG:4326' } } }] },
  ])('rejects unsupported, conflicting or invalid projected data: %j', input => {
    expect(() => normalizeGeoJson(input)).toThrow()
  })

  it('does not override a declared WGS84 CRS for projected coordinates', () => {
    expect(() => normalizeGeoJson({ ...projectedPoint, crs: { properties: { name: 'EPSG:4326' } } })).toThrow()
  })
  it('rejects undeclared mixed coordinate units and unknown ranges', () => {
    expect(() => normalizeGeoJson({ type: 'MultiPoint', coordinates: [[108, 14], [500000, 1500000]] })).toThrow(/Không nhận diện/)
    expect(() => normalizeGeoJson({ type: 'Point', coordinates: [9999999, 1500000] })).toThrow(/Không nhận diện/)
  })
})
