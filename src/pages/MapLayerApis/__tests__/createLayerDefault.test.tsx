import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { renderWithProviders } from '@/test/renderWithProviders'
import { useAuthStore } from '@/stores/common/useAuthStore'
import { mapLayerApiService, mapLayerService } from '@/service'
import type { MapLayer, MapLayerApi } from '@/types/api'
import MapLayerApiListPage from '../MapLayerApiListPage'

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const layer: MapLayer = {
  id: 150,
  code: 'forest_2025',
  name_vi: 'Lớp rừng 2025',
  schema_name: 'gis',
  table_name: 'forest_2025',
  geometry_type: 'MULTIPOLYGON',
}
const otherLayer: MapLayer = { id: 151, code: 'forest_2026', name_vi: 'Lớp rừng 2026' }
const existingApi: MapLayerApi = {
  id: 9,
  name: 'Khóa hiện có',
  layer_id: 42,
  layer_code: 'boundary',
  layer_name_vi: 'Ranh giới',
  is_active: true,
}

beforeEach(() => {
  useAuthStore.setState({
    user: { id: 1, email: 'admin@test.invalid', role: { code: 'system_admin' } },
    isAuthenticated: true,
    isInitializing: false,
    loggedOut: false,
  })
  vi.spyOn(mapLayerService, 'getAll').mockImplementation(async (params) => ({
    message: 'OK',
    status: 200,
    data: { mapLayers: params?.q === layer.code ? [layer] : [otherLayer] },
  }))
  vi.spyOn(mapLayerApiService, 'getAll').mockResolvedValue({
    message: 'OK',
    status: 200,
    data: { apis: [existingApi] },
  })
  vi.spyOn(mapLayerApiService, 'getById').mockResolvedValue({
    message: 'OK',
    status: 200,
    data: existingApi,
  })
})
afterEach(() => vi.restoreAllMocks())

function renderPage() {
  return renderWithProviders(
    <MemoryRouter>
      <MapLayerApiListPage />
    </MemoryRouter>
  )
}
async function selectFilterLayer() {
  fireEvent.click(screen.getByRole('combobox', { name: 'Tất cả lớp bản đồ' }))
  fireEvent.change(screen.getByPlaceholderText('Tìm theo tên hoặc mã lớp...'), {
    target: { value: layer.code },
  })
  fireEvent.click(await screen.findByRole('button', { name: /Lớp rừng 2025/ }))
}
function openCreate() {
  fireEvent.click(screen.getByRole('button', { name: 'Tạo khóa' }))
  return screen.getByRole('dialog', { name: 'Tạo khóa API bản đồ' })
}

describe('map API create layer defaults', () => {
  it('prefills a searched layer outside the first page and submits its numeric ID', async () => {
    const create = vi
      .spyOn(mapLayerApiService, 'create')
      .mockResolvedValue({ message: 'OK', status: 200, data: { api: existingApi } })
    renderPage()
    await selectFilterLayer()
    expect(mapLayerService.getAll).toHaveBeenCalledWith(expect.objectContaining({ q: layer.code }))
    const dialog = openCreate()
    expect(
      within(dialog).getByRole('combobox', { name: 'Lớp rừng 2025 (forest_2025)' })
    ).toBeEnabled()
    fireEvent.change(within(dialog).getByLabelText(/Tên gợi nhớ/), {
      target: { value: 'Khóa mới' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Tạo khóa API' }))
    await waitFor(() =>
      expect(create).toHaveBeenCalledWith(expect.objectContaining({ layer_id: 150 }))
    )
  })
  it('allows another layer and restores the filter layer when reopened', async () => {
    const create = vi
      .spyOn(mapLayerApiService, 'create')
      .mockResolvedValue({ message: 'OK', status: 200, data: { api: existingApi } })
    renderPage()
    await selectFilterLayer()
    const dialog = openCreate()
    const layerTrigger = within(dialog).getByRole('combobox', {
      name: 'Lớp rừng 2025 (forest_2025)',
    })
    await userEvent.click(layerTrigger)
    await waitFor(() => expect(layerTrigger).toHaveAttribute('aria-expanded', 'true'))
    const popover = document.getElementById(layerTrigger.getAttribute('aria-controls')!)!
    await userEvent.click(await within(popover).findByRole('button', { name: /Lớp rừng 2026/ }))
    expect(
      within(dialog).getByRole('combobox', { name: 'Lớp rừng 2026 (forest_2026)' })
    ).toBeInTheDocument()
    fireEvent.change(within(dialog).getByLabelText(/Tên gợi nhớ/), {
      target: { value: 'Khóa khác' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Tạo khóa API' }))
    await waitFor(() =>
      expect(create).toHaveBeenCalledWith(expect.objectContaining({ layer_id: 151 }))
    )
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(
      screen.getByRole('combobox', { name: 'Lớp rừng 2025 (forest_2025)' })
    ).toBeInTheDocument()
    expect(
      within(openCreate()).getByRole('combobox', { name: 'Lớp rừng 2025 (forest_2025)' })
    ).toBeInTheDocument()
  })
  it('clears the create default when the filter is all', async () => {
    renderPage()
    await selectFilterLayer()
    fireEvent.click(within(openCreate()).getByRole('button', { name: 'Hủy' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    fireEvent.click(screen.getByRole('combobox', { name: 'Lớp rừng 2025 (forest_2025)' }))
    fireEvent.click(screen.getByRole('button', { name: 'Tất cả lớp bản đồ' }))
    const dialog = openCreate()
    expect(within(dialog).getByRole('combobox', { name: 'Chọn lớp bản đồ' })).toBeInTheDocument()
    expect(within(dialog).queryByText(/forest_2025/)).not.toBeInTheDocument()
  })
  it('keeps the existing key layer in edit mode', async () => {
    renderPage()
    await selectFilterLayer()
    fireEvent.click(await screen.findByRole('button', { name: 'Chỉnh sửa' }))
    const dialog = await screen.findByRole('dialog', { name: 'Sửa khóa API bản đồ' })
    expect(
      await within(dialog).findByRole('combobox', { name: 'Ranh giới (boundary)' })
    ).toBeDisabled()
  })
})
