import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { render } from '@testing-library/react'
import { createTestQueryClient } from '@/test/renderWithProviders'
import { UserMenu } from '../UserMenu'
import { useAuthStore } from '@/stores/common/useAuthStore'
import { authService } from '@/service'

vi.mock('react-toastify', () => ({ toast: { error: vi.fn() } }))
beforeEach(() =>
  useAuthStore.setState({
    user: {
      id: 2,
      email: 'logout@test.invalid',
      full_name: 'Test account',
      role: { code: 'ubnd_tinh' },
    },
    isAuthenticated: true,
    isAdmin: true,
    isInitializing: false,
  })
)
afterEach(() => vi.restoreAllMocks())

describe.each([true, false])('logout cleanup when API success is %s', (success) => {
  it('clears the previous account query cache on both paths', async () => {
    const logout = vi.spyOn(authService, 'logout')
    if (success) logout.mockResolvedValue({ message: 'OK', status: 200 })
    else logout.mockRejectedValue(new Error('Offline'))
    const client = createTestQueryClient()
    client.setQueryData(['private-users'], { items: ['previous-account-only'] })
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <UserMenu />
        </MemoryRouter>
      </QueryClientProvider>
    )
    const trigger = screen.getByRole('button', { name: 'Test account' })
    trigger.focus()
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Đăng xuất' }))
    await waitFor(() => expect(useAuthStore.getState().isAuthenticated).toBe(false))
    expect(client.getQueryCache().getAll()).toHaveLength(0)
    expect(useAuthStore.getState().user).toBeNull()
  })
})
