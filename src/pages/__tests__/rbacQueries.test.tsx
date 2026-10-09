import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { act, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { renderWithProviders } from '@/test/renderWithProviders'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useAuthStore } from '@/stores/common/useAuthStore'
import { fireRiskService, forestClassificationService, statisticsService } from '@/service'
import FireRiskPage from '@/pages/FireRisk'
import ForestPage from '@/pages/ForestClassification'
import DashboardPage from '@/pages/Dashboard'

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }))
vi.mock('@/components/features/FireRiskMap', () => ({ default: () => null }))
vi.mock('@/components/features/ForestMap', () => ({ default: () => null }))
vi.mock('@/components/features/GeeProcessingStatus', () => ({ default: () => null }))
vi.mock('@/pages/FireRisk/GroundTruthCard', () => ({ default: () => null }))
vi.mock('@/pages/ForestClassification/ForestGroundTruthCard', () => ({ default: () => null }))

const cases = [
  {
    name: 'fire',
    resource: 'fire_risk',
    service: fireRiskService,
    Page: FireRiskPage,
    historyTitle: 'Lịch sử chạy phân tích',
  },
  {
    name: 'forest',
    resource: 'forest_classification',
    service: forestClassificationService,
    Page: ForestPage,
    historyTitle: 'Lịch sử chạy phân loại',
  },
] as const

const setUser = (resource: string, manage: boolean) =>
  useAuthStore.setState({
    user: {
      id: 2,
      email: 'role@test.invalid',
      role: {
        code: manage ? 'so_nnmt' : 'ubnd_tinh',
        permissions: { [resource]: { read: true, manage } },
      },
    },
    isAuthenticated: true,
    isAdmin: true,
    isInitializing: false,
    loggedOut: false,
  })

beforeEach(() => {
  vi.spyOn(fireRiskService, 'getMap').mockResolvedValue({ data: {} } as Awaited<
    ReturnType<typeof fireRiskService.getMap>
  >)
})
afterEach(() => vi.restoreAllMocks())

describe.each(cases)(
  '$name page authorization with real query hooks',
  ({ resource, service, Page, historyTitle }) => {
    it('never requests internal history for a read-only role, including processing polling', async () => {
      setUser(resource, false)
      const latest = vi.spyOn(service, 'getLatest').mockResolvedValue({
        data: {
          snapshot: null,
          processing: { queue: { status: 'running' } },
        },
      } as Awaited<ReturnType<typeof service.getLatest>>)
      const history = vi.spyOn(service, 'getHistory')
      let poll: (() => void) | undefined
      vi.spyOn(window, 'setInterval').mockImplementation((handler, delay) => {
        if (delay === 20_000 && typeof handler === 'function') poll = handler as () => void
        return 123
      })
      vi.spyOn(window, 'clearInterval').mockImplementation(() => undefined)
      renderWithProviders(
        <MemoryRouter>
          <TooltipProvider>
            <Page />
          </TooltipProvider>
        </MemoryRouter>
      )
      await waitFor(() => expect(poll).toBeDefined())
      await act(async () => {
        poll?.()
      })
      await waitFor(() => expect(latest.mock.calls.length).toBeGreaterThan(1))
      expect(history).not.toHaveBeenCalled()
      expect(screen.queryByText(historyTitle)).not.toBeInTheDocument()
    })
    it('requests internal history for a manager and shows successful empty data', async () => {
      setUser(resource, true)
      vi.spyOn(service, 'getLatest').mockResolvedValue({ data: { snapshot: null } } as Awaited<
        ReturnType<typeof service.getLatest>
      >)
      const history = vi
        .spyOn(service, 'getHistory')
        .mockResolvedValue({ message: 'OK', status: 200, data: { items: [] } } as Awaited<
          ReturnType<typeof service.getHistory>
        >)
      renderWithProviders(
        <MemoryRouter>
          <TooltipProvider>
            <Page />
          </TooltipProvider>
        </MemoryRouter>
      )
      await waitFor(() => expect(history).toHaveBeenCalledOnce())
      expect(await screen.findByText(historyTitle)).toBeInTheDocument()
      expect(await screen.findByText(/Chưa có bản ghi/)).toBeInTheDocument()
    })
    it('renders forbidden history as error instead of an empty table', async () => {
      setUser(resource, true)
      vi.spyOn(service, 'getLatest').mockResolvedValue({ data: { snapshot: null } } as Awaited<
        ReturnType<typeof service.getLatest>
      >)
      vi.spyOn(service, 'getHistory').mockRejectedValue({ status: 403 })
      renderWithProviders(
        <MemoryRouter>
          <TooltipProvider>
            <Page />
          </TooltipProvider>
        </MemoryRouter>
      )
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Bạn không có quyền xem nội dung này.'
      )
      expect(screen.queryByText(/Chưa có bản ghi/)).not.toBeInTheDocument()
    })
    it('does not render fake summaries when latest data fails', async () => {
      setUser(resource, false)
      vi.spyOn(service, 'getLatest').mockRejectedValue({ status: 500 })
      renderWithProviders(
        <MemoryRouter>
          <TooltipProvider>
            <Page />
          </TooltipProvider>
        </MemoryRouter>
      )
      expect(await screen.findByRole('alert')).toHaveTextContent('Không tải được')
      expect(screen.queryByText('Tổng diện tích')).not.toBeInTheDocument()
    })
  }
)

describe('dashboard query ownership', () => {
  it('uses force false initially and true only for explicit refresh', async () => {
    const getDashboard = vi
      .spyOn(statisticsService, 'getDashboard')
      .mockResolvedValue({ data: {} } as Awaited<ReturnType<typeof statisticsService.getDashboard>>)
    renderWithProviders(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    )
    const refresh = await screen.findByRole('button', { name: 'Làm mới' })
    expect(getDashboard).toHaveBeenNthCalledWith(1, { force: false })
    fireEvent.click(refresh)
    await waitFor(() => expect(getDashboard).toHaveBeenNthCalledWith(2, { force: true }))
  })
  it('renders an error, not empty KPIs, on request failure', async () => {
    vi.spyOn(statisticsService, 'getDashboard').mockRejectedValue({ status: 403 })
    renderWithProviders(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    )
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Bạn không có quyền xem nội dung này.'
    )
    expect(screen.queryByText('Tổng diện tích rừng')).not.toBeInTheDocument()
  })
})
