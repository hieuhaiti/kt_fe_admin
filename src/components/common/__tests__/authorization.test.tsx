import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { renderWithProviders } from '@/test/renderWithProviders'
import { useAuthStore } from '@/stores/common/useAuthStore'
import { ProtectedRoute } from '../ProtectedRoute'
import { QueryErrorNotice } from '../QueryErrorNotice'

vi.mock('react-toastify', () => ({ toast: { error: vi.fn() } }))

beforeEach(() => {
  useAuthStore.setState({
    user: { id: 2, email: 'viewer@test.invalid', role: { code: 'ubnd_tinh', permissions: {} } },
    isAuthenticated: true,
    isAdmin: true,
    isInitializing: false,
    loggedOut: false,
  })
})

describe('permission and error states', () => {
  it('denies deep links without dashboard permission', () => {
    renderWithProviders(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route
            element={
              <ProtectedRoute permission={{ resource: 'statistics', action: 'dashboard' }} />
            }
          >
            <Route path="/dashboard" element={<h1>Private statistics</h1>} />
          </Route>
          <Route path="/403" element={<h1>Forbidden</h1>} />
        </Routes>
      </MemoryRouter>
    )
    expect(screen.getByRole('heading', { name: 'Forbidden' })).toBeInTheDocument()
    expect(screen.queryByText('Private statistics')).not.toBeInTheDocument()
  })
  it('does not offer retry for permission denial or show empty data', () => {
    renderWithProviders(
      <QueryErrorNotice title="Lịch sử" error={{ status: 403 }} onRetry={vi.fn()} />
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Bạn không có quyền xem nội dung này.')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByText('Chưa có bản ghi.')).not.toBeInTheDocument()
  })
  it('offers retry for a failed data request', () => {
    const retry = vi.fn()
    renderWithProviders(
      <QueryErrorNotice title="Số liệu" error={{ status: 500 }} onRetry={retry} />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
    expect(retry).toHaveBeenCalledOnce()
  })
})
