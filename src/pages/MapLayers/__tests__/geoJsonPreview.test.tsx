import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import GeoJsonMapPreview from '@/components/features/GeoJsonMapPreview'
const { map } = vi.hoisted(() => ({ map: {
  addControl: vi.fn(), on: vi.fn(), once: vi.fn(), addSource: vi.fn(), addLayer: vi.fn(),
  getSource: vi.fn(() => ({ setData: vi.fn() })), fitBounds: vi.fn(), isStyleLoaded: vi.fn(() => true), remove: vi.fn(),
} }))
vi.mock('maplibre-gl', () => ({ default: {
  Map: class { constructor() { return map } }, NavigationControl: class {},
} }))
afterEach(() => { cleanup(); vi.clearAllMocks() })
it('renders points as a source layer, includes collection bounds, and cleans up the map', () => {
  const data: GeoJSON.GeometryCollection = { type: 'GeometryCollection', geometries: [
    { type: 'Point', coordinates: [108, 14] },
    { type: 'MultiPoint', coordinates: [[109, 15], [107, 13]] },
  ] }
  const { unmount } = render(<GeoJsonMapPreview geojson={data} />)
  const load = map.on.mock.calls.find(([event]) => event === 'load')?.[1] as (() => void) | undefined
  expect(load).toBeDefined()
  load?.()
  expect(map.addSource).toHaveBeenCalledWith('preview-source', expect.objectContaining({ data }))
  expect(map.addLayer).toHaveBeenCalledWith(expect.objectContaining({ type: 'circle', source: 'preview-source' }))
  expect(map.fitBounds).toHaveBeenCalledWith([[107, 13], [109, 15]], expect.any(Object))
  unmount()
  expect(map.remove).toHaveBeenCalledTimes(1)
})
