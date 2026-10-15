import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { toast } from 'react-toastify'
import { renderWithProviders } from '@/test/renderWithProviders'
import { useAuthStore } from '@/stores/common/useAuthStore'
import { mapLayerService } from '@/service'
import MapLayerPage from '../index'
vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }))
vi.mock('@/components/features/GeoJsonMapPreview', () => ({ default: () => <div data-testid="file-preview" /> }))
vi.mock('@/lib/checkStyleDebug', () => ({ checkStyleLog: vi.fn() }))
beforeEach(() => {
  vi.clearAllMocks()
  useAuthStore.setState({ user: { id: 1, email: 'admin@test.invalid', role: { code: 'system_admin' } }, isAuthenticated: true, isInitializing: false, loggedOut: false })
  vi.spyOn(mapLayerService, 'getAll').mockResolvedValue({ message: 'OK', status: 200, data: { mapLayers: [] } })
  vi.spyOn(mapLayerService, 'importFile').mockResolvedValue({ message: 'Accepted', status: 202, data: { job_id: '16', code: 'test10101', status: 'processing', sync: true } })
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })
async function submitGeoJson() {
  renderWithProviders(<MemoryRouter><MapLayerPage /></MemoryRouter>)
  await userEvent.click(screen.getByRole('button', { name: /Thêm lớp dữ liệu/ }))
  fireEvent.change(screen.getByLabelText(/Tên lớp dữ liệu/), { target: { value: 'test10101' } })
  const text = JSON.stringify({ type: 'Point', coordinates: [108, 14, 123] })
  const file = new File([text], 'kontum.geojson', { type: 'application/geo+json' })
  Object.defineProperty(file, 'text', { value: async () => text })
  await userEvent.upload(document.querySelector<HTMLInputElement>('input[type=file]')!, file)
  await screen.findByTestId('file-preview')
  await userEvent.click(screen.getByRole('button', { name: 'Nhập GeoJSON' }))
}
it('closes the dialog on the exact processing response with string job_id and reports accepted, not completed', async () => {
  vi.spyOn(mapLayerService, 'getImportJob').mockResolvedValue({ message: 'OK', status: 200, data: { id: '16', status: 'processing' } })
  await submitGeoJson()
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(toast.info).toHaveBeenCalledWith(expect.stringContaining('Đã tiếp nhận'))
  expect(toast.success).not.toHaveBeenCalled()
  expect(await screen.findByText(/Đã tiếp nhận tệp. Đang xử lý/)).toBeInTheDocument()
  expect(mapLayerService.getImportJob).toHaveBeenCalledWith('16')
  const form = vi.mocked(mapLayerService.importFile).mock.calls[0][0]
  expect(form.get('new_layer')).toBe('true')
  expect(form.get('file')).toBeInstanceOf(File)
})
it('reports completed only when the job has completed', async () => {
  vi.spyOn(mapLayerService, 'getImportJob').mockResolvedValue({ message: 'OK', status: 200, data: { id: '16', status: 'completed' } })
  await submitGeoJson()
  await waitFor(() => expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('Đã nhập GeoJSON')))
  expect(toast.success).toHaveBeenCalledTimes(1)
  expect(screen.queryByRole('dialog')).toBeNull()
})
it('reports processing failure instead of a false success', async () => {
  vi.spyOn(mapLayerService, 'getImportJob').mockResolvedValue({ message: 'OK', status: 200, data: { id: '16', status: 'failed', error_log: 'Geometry has Z dimension but column does not' } })
  await submitGeoJson()
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Geometry has Z dimension')))
  expect(toast.success).not.toHaveBeenCalled()
  expect(screen.queryByRole('dialog')).toBeNull()
})
it('prevents publishing a raster with no source', async () => {
  vi.mocked(mapLayerService.getAll).mockResolvedValue({ message: 'OK', status: 200, data: { mapLayers: [{ id: 1, code: 'raster', name_vi: 'Raster', geometry_type: 'RASTER', is_active: true, source_url: null }] } })
  renderWithProviders(<MemoryRouter><MapLayerPage /></MemoryRouter>)
  const publish = await screen.findByTitle('Cần tải GeoTIFF lên kho ảnh hoặc cấu hình nguồn dữ liệu trước khi công bố')
  expect(publish).toBeDisabled()
})
