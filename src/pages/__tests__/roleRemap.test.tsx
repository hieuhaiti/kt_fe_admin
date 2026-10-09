import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Outlet } from 'react-router-dom'
import { renderWithProviders } from '@/test/renderWithProviders'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useAuthStore } from '@/stores/common/useAuthStore'
import { newsCommentService, statisticsService } from '@/service'
import { navConfig } from '@/constant/common'
import App from '@/App'
import LandingPage from '@/pages/Landing'
import NewsComments from '@/pages/NewsComments'

vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), success: vi.fn() }, ToastContainer: () => null,
}))
vi.mock('@/layout/mainLayout', () => ({ MainLayout: () => <Outlet /> }))
vi.mock('@/pages/MapLayers/ImportGeoJson', () => ({ default: () => <h1>Import page</h1> }))

function setRole(code: string, permissions: Record<string, Record<string, boolean>>) {
  useAuthStore.setState({
    user: { id: 2, email: 'role@test.invalid', role: { code, permissions } },
    isAuthenticated: true, isAdmin: code !== 'citizen', isInitializing: false, loggedOut: false,
  })
}
function renderPage(element: React.ReactNode, path = '/') {
  return renderWithProviders(
    <MemoryRouter initialEntries={[path]}>
      <TooltipProvider>{element}</TooltipProvider>
    </MemoryRouter>
  )
}
beforeEach(() => { vi.spyOn(useAuthStore.getState(), 'initialize').mockResolvedValue(undefined) })
afterEach(() => vi.restoreAllMocks())
const commentResponse = {
  message: 'OK', status: 200,
  data: { items: [{ id: 1, content: 'Bình luận kiểm thử', newsTitle: 'Bài viết', isApproved: false }] },
} satisfies Awaited<ReturnType<typeof newsCommentService.getAll>>

describe.each(['ubnd_tinh', 'so_nnmt'])('%s read-only comments', (role) => {
  beforeEach(() => setRole(role, { comments: { read: true }, news: { read: true } }))
  it('allows the actual comments route without approve permission', async () => {
    vi.spyOn(newsCommentService, 'getAll').mockResolvedValue(commentResponse)
    renderPage(<App />, '/news-comments')
    expect(await screen.findByText('Bình luận kiểm thử')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Duyệt' })).not.toBeInTheDocument()
    expect(screen.queryByTitle('Xóa')).not.toBeInTheDocument()
  })
  it('includes comments shortcut but not dashboard', () => {
    const dashboard = vi.spyOn(statisticsService, 'getDashboard')
    renderPage(<LandingPage />)
    expect(screen.getByRole('link', { name: 'Bình luận' })).toHaveAttribute('href', '/news-comments')
    expect(screen.queryByRole('link', { name: 'Tổng quan' })).not.toBeInTheDocument()
    expect(dashboard).not.toHaveBeenCalled()
    expect(navConfig.flatMap(item => item.subItems ?? []).find(item => item.path === '/news-comments')?.permission)
      .toEqual({ resource: 'comments', action: 'read' })
  })
})
describe('import route remap', () => {
  it.each<{ permissions: Record<string, boolean>; allowed: boolean }>([
    { permissions: { read: true, import: true }, allowed: true },
    { permissions: { read: true, create: true }, allowed: false },
  ])('requires import rather than create: $allowed', async ({ permissions, allowed }) => {
    setRole('so_nnmt', { map_layers: permissions })
    renderPage(<App />, '/map-layers/import-geojson')
    await waitFor(() => expect(screen.getByRole('heading', {
      name: allowed ? 'Import page' : /Không có quyền truy cập/,
    })).toBeInTheDocument())
  })
})
describe('comment query and action boundaries', () => {
  it('retains approve/delete for system admin', async () => {
    setRole('system_admin', {})
    vi.spyOn(newsCommentService, 'getAll').mockResolvedValue(commentResponse)
    renderPage(<NewsComments />)
    expect(await screen.findByRole('button', { name: 'Duyệt' })).toBeInTheDocument()
    expect(screen.getByTitle('Xóa')).toBeInTheDocument()
  })
  it('renders denial instead of empty comments', async () => {
    setRole('ubnd_tinh', { comments: { read: true } })
    vi.spyOn(newsCommentService, 'getAll').mockRejectedValue({ status: 403 })
    renderPage(<NewsComments />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Bạn không có quyền xem nội dung này.')
    expect(screen.queryByText('Không có bình luận')).not.toBeInTheDocument()
  })
  it('keeps citizen out of Admin', async () => {
    setRole('citizen', { comments: { read: true } })
    renderPage(<App />, '/news-comments')
    expect(await screen.findByRole('heading', { name: /Không có quyền truy cập/ })).toBeInTheDocument()
    expect(screen.queryByText('Bình luận tin tức')).not.toBeInTheDocument()
  })
})
