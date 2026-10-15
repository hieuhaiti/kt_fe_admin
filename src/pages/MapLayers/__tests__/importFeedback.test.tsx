import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { toast } from 'react-toastify'
import { renderWithProviders } from '@/test/renderWithProviders'
import { useAuthStore } from '@/stores/common/useAuthStore'
import { mapLayerService } from '@/service'
import apiClient from '@/service/common/apiClient'
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

async function selectRaster() {
  renderWithProviders(<MemoryRouter><MapLayerPage /></MemoryRouter>)
  await userEvent.click(screen.getByRole('button', { name: /Thêm lớp dữ liệu/ }))
  await userEvent.click(screen.getByRole('tab', { name: 'GeoTIFF' }))
  fireEvent.change(screen.getByLabelText(/Tên lớp dữ liệu/), { target: { value: 'Rừng Kon Tum 2026' } })
  const file = new File(['TIFF'], 'kontum.tif', { type: 'image/tiff' })
  Object.defineProperty(file, 'slice', { value: () => ({ arrayBuffer: async () => new Uint8Array([0x49, 0x49, 0x2a, 0]).buffer }) })
  await userEvent.upload(document.querySelector<HTMLInputElement>('input[type=file]')!, file)
  await waitFor(() => expect(screen.getByRole('button', { name: 'Tải GeoTIFF và tạo lớp' })).not.toBeDisabled())
  return file
}
it('sends actual TIFF multipart, closes on persisted success, and does not publish', async () => {
  const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ message: 'Created', status: 201, data: { code: 'rung_kon_tum_2026', geometry_type: 'RASTER', source_url: 'file:///data/unique.tif' } })
  const publish = vi.spyOn(mapLayerService, 'publish')
  const file = await selectRaster()
  await userEvent.click(screen.getByRole('button', { name: 'Tải GeoTIFF và tạo lớp' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  const [url, body, multipart] = post.mock.calls[0]
  expect(url).toMatch(/map\/layers$/)
  expect(body).toBeInstanceOf(FormData)
  const form = body as FormData
  expect(form.get('raster_file')).toBe(file)
  expect(form.get('geometry_type')).toBe('RASTER')
  expect(form.get('is_public')).toBe('false')
  expect(form.has('source_url')).toBe(false)
  expect(multipart).toBe(true)
  expect(toast.success).toHaveBeenCalledTimes(1)
  expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('Đã tải GeoTIFF'))
  expect(publish).not.toHaveBeenCalled()
})
it('keeps the dialog and selected file after upload failure without reporting success', async () => {
  vi.spyOn(apiClient, 'post').mockRejectedValue(new Error('connection lost'))
  await selectRaster()
  await userEvent.click(screen.getByRole('button', { name: 'Tải GeoTIFF và tạo lớp' }))
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Kiểm tra kết nối')))
  expect(screen.getByRole('dialog')).toBeInTheDocument()
  expect(screen.getByText('kontum.tif')).toBeInTheDocument()
  expect(toast.success).not.toHaveBeenCalled()
})
it('does not create an empty raster layer without a file', async () => {
  const create = vi.spyOn(mapLayerService, 'create')
  renderWithProviders(<MemoryRouter><MapLayerPage /></MemoryRouter>)
  await userEvent.click(screen.getByRole('button', { name: /Thêm lớp dữ liệu/ }))
  await userEvent.click(screen.getByRole('tab', { name: 'GeoTIFF' }))
  const name = screen.getByLabelText(/Tên lớp dữ liệu/)
  fireEvent.change(name, { target: { value: 'Empty raster' } })
  expect(screen.getByRole('button', { name: 'Tải GeoTIFF và tạo lớp' })).toBeDisabled()
  fireEvent.submit(name.closest('form')!)
  expect(create).not.toHaveBeenCalled()
})
