import { describe, it, expect } from 'vitest'
import {
  getStyleDefinitions,
  parseStyleJson,
  cleanStyleObject,
  stringifyStyle,
  getStyleDefinition,
} from '../mapLayerStyle'

describe('W035 — Map Layer Opacity Controls & Scale Verification', () => {
  const opacityKeys = [
    'fillOpacity',
    'strokeOpacity',
    'circleOpacity',
    'circleStrokeOpacity',
    'opacity',
    'rasterOpacity',
  ] as const

  it('every opacity property is strictly normalized to scale 0–1 with step 0.05', () => {
    opacityKeys.forEach((key) => {
      const def = getStyleDefinition(key)
      expect(def, `Definition for ${key} must exist`).toBeDefined()
      expect(def?.type).toBe('number')
      expect(def?.min).toBe(0)
      expect(def?.max).toBe(1)
      expect(def?.step).toBe(0.05)
      expect(def?.label).not.toContain('0-100')
      expect(def?.label).toMatch(/(?:0\s*ẩn[,\s]*1\s*hiện|Mức hiển thị)/)
    })
  })

  it('geometry filtering binds correct opacity controls to geometry types', () => {
    const polygonDefs = getStyleDefinitions('polygon').map((d) => d.key)
    expect(polygonDefs).toContain('fillOpacity')
    expect(polygonDefs).toContain('strokeOpacity')
    expect(polygonDefs).toContain('opacity')
    expect(polygonDefs).not.toContain('circleOpacity')

    const lineDefs = getStyleDefinitions('line').map((d) => d.key)
    expect(lineDefs).toContain('strokeOpacity')
    expect(lineDefs).toContain('opacity')
    expect(lineDefs).not.toContain('fillOpacity')
    expect(lineDefs).not.toContain('circleOpacity')

    const pointDefs = getStyleDefinitions('point').map((d) => d.key)
    expect(pointDefs).toContain('circleOpacity')
    expect(pointDefs).toContain('circleStrokeOpacity')
    expect(pointDefs).toContain('opacity')
    expect(pointDefs).not.toContain('fillOpacity')

    const rasterDefs = getStyleDefinitions('raster').map((d) => d.key)
    expect(rasterDefs).toContain('rasterOpacity')
    expect(rasterDefs).toContain('opacity')
    expect(rasterDefs).not.toContain('fillOpacity')
    expect(rasterDefs).not.toContain('circleOpacity')
  })

  it('simulated persistence: parseStyleJson and cleanStyleObject preserve opacity values on readback', () => {
    // Polygon style change
    const updatedPolygon = { fillOpacity: 0.65, strokeOpacity: 0.85, strokeWidth: 3 }

    const cleaned = cleanStyleObject(updatedPolygon)
    expect(cleaned).toEqual(updatedPolygon)

    const jsonStr = stringifyStyle(cleaned)
    const readback = parseStyleJson(jsonStr, 'polygon')
    expect(readback.error).toBeUndefined()
    expect(readback.style?.fillOpacity).toBe(0.65)
    expect(readback.style?.strokeOpacity).toBe(0.85)

    // Point style change
    const updatedPoint = { circleOpacity: 0.45, circleStrokeOpacity: 0.75, circleRadius: 6 }
    const cleanedPoint = cleanStyleObject(updatedPoint)
    const pointJson = stringifyStyle(cleanedPoint)
    const pointReadback = parseStyleJson(pointJson, 'point')
    expect(pointReadback.error).toBeUndefined()
    expect(pointReadback.style?.circleOpacity).toBe(0.45)
    expect(pointReadback.style?.circleStrokeOpacity).toBe(0.75)

    // Raster style change
    const updatedRaster = { rasterOpacity: 0.55, opacity: 0.8 }
    const cleanedRaster = cleanStyleObject(updatedRaster)
    const rasterJson = stringifyStyle(cleanedRaster)
    const rasterReadback = parseStyleJson(rasterJson, 'raster')
    expect(rasterReadback.error).toBeUndefined()
    expect(rasterReadback.style?.rasterOpacity).toBe(0.55)
    expect(rasterReadback.style?.opacity).toBe(0.8)
  })

  it('rejects out-of-range opacity values (> 1 or < 0)', () => {
    const invalidHigh = parseStyleJson('{"fillOpacity": 1.5}', 'polygon')
    expect(invalidHigh.error).toMatch(/không hợp lệ/)

    const invalidLow = parseStyleJson('{"fillOpacity": -0.1}', 'polygon')
    expect(invalidLow.error).toMatch(/không hợp lệ/)
  })
})
