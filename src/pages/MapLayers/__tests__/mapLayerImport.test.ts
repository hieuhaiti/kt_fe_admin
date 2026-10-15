import { describe, expect, it } from 'vitest'
import { createLayerIdentifiers, layerIdentifiersSchema, readImportJobId, validateGeoJson } from '../mapLayerImport'

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
