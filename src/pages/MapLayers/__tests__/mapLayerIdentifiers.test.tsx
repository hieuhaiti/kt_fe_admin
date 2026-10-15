import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MapLayerFormDialog from '../MapLayerFormDialog'

const { queryResult } = vi.hoisted(() => ({ queryResult: { data: undefined as unknown } }))
vi.mock('@/service', () => ({
  mapLayerService: { getByCode: vi.fn() },
  useApiQuery: () => queryResult,
}))
vi.mock('@/components/features/GeoJsonMapPreview', () => ({ default: () => null }))
vi.mock('@/lib/checkStyleDebug', () => ({ checkStyleLog: vi.fn() }))
vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

afterEach(() => {
  cleanup()
  queryResult.data = undefined
})

describe('map layer form identifiers', () => {
  it('preserves hyphens in code but generates a valid table_name', async () => {
    const onSubmit = vi.fn()
    render(<MapLayerFormDialog open onOpenChange={vi.fn()} layerCode={null} onSubmit={onSubmit} />)
    await userEvent.click(screen.getByRole('tab', { name: 'GeoTIFF' }))
    const file = new File(['TIFF'], 'forest.tif', { type: 'image/tiff' })
    Object.defineProperty(file, 'slice', { value: () => ({ arrayBuffer: async () => new Uint8Array([0x49, 0x49, 0x2a, 0]).buffer }) })
    await userEvent.upload(document.querySelector<HTMLInputElement>('input[type=file]')!, file)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Tải GeoTIFF và tạo lớp' })).not.toBeDisabled())
    const input = screen.getByLabelText(/Tên lớp dữ liệu/)
    fireEvent.change(input, { target: { value: 'Biến động lớp phủ Kon Tum 1991-2023 tesst' } })
    const form = input.closest('form')
    if (!form) throw new Error('Layer form not found')
    fireEvent.submit(form)
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      code: 'bien_dong_lop_phu_kon_tum_1991-2023_tesst',
      table_name: 'bien_dong_lop_phu_kon_tum_1991_2023_tesst',
    }), file)
  })

  it('keeps an existing layer code and physical table_name unchanged when editing', () => {
    const onSubmit = vi.fn()
    queryResult.data = { data: {
      code: 'forest_1991-2023', name_vi: 'Rừng Kon Tum',
      table_name: 'existing_forest_table', geometry_type: 'RASTER',
      is_active: true, is_public: false,
    } }
    render(<MapLayerFormDialog open onOpenChange={vi.fn()} layerCode="forest_1991-2023" onSubmit={onSubmit} />)
    const input = screen.getByLabelText(/Tên lớp dữ liệu/)
    fireEvent.change(input, { target: { value: 'Rừng Kon Tum cập nhật' } })
    const form = input.closest('form')
    if (!form) throw new Error('Layer form not found')
    fireEvent.submit(form)
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      code: 'forest_1991-2023', table_name: 'existing_forest_table',
    }))
  })
  it('only saves metadata when a GeoJSON file is previewed while editing', async () => {
    const onSubmit = vi.fn(), onImport = vi.fn()
    queryResult.data = { data: {
      code: 'forest', name_vi: 'Rừng Kon Tum', table_name: 'forest', geometry_type: 'POLYGON',
      is_active: true, is_public: false,
    } }
    render(<MapLayerFormDialog open onOpenChange={vi.fn()} layerCode="forest" canImport onImport={onImport} onSubmit={onSubmit} />)
    const text = JSON.stringify({ type: 'Point', coordinates: [108, 14] })
    const file = new File([text], 'preview.geojson', { type: 'application/geo+json' })
    Object.defineProperty(file, 'text', { value: async () => text })
    const input = document.querySelector<HTMLInputElement>('input[type=file]')!
    await userEvent.upload(input, file)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Lưu thông tin' }).hasAttribute('disabled')).toBe(false))
    await userEvent.click(screen.getByRole('button', { name: 'Lưu thông tin' }))
    expect(onImport).not.toHaveBeenCalled()
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ code: 'forest', table_name: 'forest', geometry_type: 'POLYGON' }))
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('geometry_data')
  })
})
