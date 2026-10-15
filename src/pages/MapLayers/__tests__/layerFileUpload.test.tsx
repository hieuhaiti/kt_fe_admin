import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LayerFileUpload from '../LayerFileUpload'
import MapLayerFormDialog from '../MapLayerFormDialog'

vi.mock('@/service', () => ({ mapLayerService: { getByCode: vi.fn() }, useApiQuery: () => ({ data: undefined }) }))
vi.mock('@/components/features/GeoJsonMapPreview', () => ({ default: ({ geojson }: { geojson: GeoJSON.FeatureCollection }) => <div data-testid="preview">{geojson.features?.length}</div> }))
vi.mock('@/lib/checkStyleDebug', () => ({ checkStyleLog: vi.fn() }))
vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))
afterEach(cleanup)
const collection = { type: 'FeatureCollection', features: [
  { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [108, 14] } },
  { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [109, 15] } },
] }
function makeFile(text = JSON.stringify(collection), name = 'forest.geojson') {
  const file = new File([text], name, { type: 'application/geo+json' })
  Object.defineProperty(file, 'text', { value: async () => text })
  return file
}
function fileInput(container: HTMLElement) {
  const input = container.querySelector<HTMLInputElement>('input[type=file]')
  if (!input) throw new Error('Missing upload input')
  return input
}
describe('shared layer file picker', () => {
  it('validates and previews all features, then clears the selection', async () => {
    const onFileChange = vi.fn(), onValidationChange = vi.fn()
    const { container } = render(<LayerFileUpload kind="geojson" onFileChange={onFileChange} onValidationChange={onValidationChange} />)
    const file = makeFile()
    await userEvent.upload(fileInput(container), file)
    await waitFor(() => expect(onFileChange).toHaveBeenLastCalledWith(file, collection))
    expect(screen.getByTestId('preview').textContent).toBe('2')
    expect(onValidationChange).toHaveBeenLastCalledWith(false)
    await userEvent.click(screen.getByRole('button', { name: 'Bỏ tệp đã chọn' }))
    expect(onFileChange).toHaveBeenLastCalledWith(null, null)
    expect(screen.queryByTestId('preview')).toBeNull()
  })
  it.each(['{', JSON.stringify({ type: 'FeatureCollection', features: [] })])('blocks invalid GeoJSON: %s', async text => {
    const onFileChange = vi.fn(), onValidationChange = vi.fn()
    const { container } = render(<LayerFileUpload kind="geojson" onFileChange={onFileChange} onValidationChange={onValidationChange} />)
    await userEvent.upload(fileInput(container), makeFile(text))
    await screen.findByRole('alert')
    expect(onValidationChange).toHaveBeenLastCalledWith(true)
    expect(onFileChange).toHaveBeenLastCalledWith(null, null)
    expect(screen.queryByTestId('preview')).toBeNull()
  })
  it('invalidates a valid previous file when another selection is rejected', async () => {
    const onFileChange = vi.fn(), onValidationChange = vi.fn()
    const { container } = render(<LayerFileUpload kind="geojson" onFileChange={onFileChange} onValidationChange={onValidationChange} />)
    await userEvent.upload(fileInput(container), makeFile())
    await screen.findByTestId('preview')
    await userEvent.upload(fileInput(container), makeFile('{}', 'second.geojson'))
    await screen.findByRole('alert')
    expect(onFileChange).toHaveBeenLastCalledWith(null, null)
    expect(onValidationChange).toHaveBeenLastCalledWith(true)
    expect(screen.queryByTestId('preview')).toBeNull()
  })
  it('dispatches full file import only after successful validation, and clears it on tab switch', async () => {
    const onImport = vi.fn(), onSubmit = vi.fn()
    const { container } = render(<MapLayerFormDialog open onOpenChange={vi.fn()} layerCode={null} canImport onImport={onImport} onSubmit={onSubmit} />)
    expect(screen.getByRole('button', { name: 'Nhập GeoJSON' }).hasAttribute('disabled')).toBe(true)
    const name = screen.getByLabelText(/Tên lớp dữ liệu/)
    fireEvent.change(name, { target: { value: 'Rừng 1991-2023' } })
    const file = makeFile()
    await userEvent.upload(fileInput(container.ownerDocument.body), file)
    await screen.findByTestId('preview')
    await userEvent.click(screen.getByRole('button', { name: 'Nhập GeoJSON' }))
    expect(onImport).toHaveBeenCalledWith(expect.objectContaining({ code: 'rung_1991-2023', table_name: 'rung_1991_2023', geometry_type: 'POINT' }), file)
    expect(onSubmit).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('tab', { name: 'GeoTIFF' }))
    await userEvent.click(screen.getByRole('tab', { name: 'GeoJSON' }))
    expect(screen.queryByTestId('preview')).toBeNull()
    expect(screen.getByRole('button', { name: 'Nhập GeoJSON' }).hasAttribute('disabled')).toBe(true)
  })
})
