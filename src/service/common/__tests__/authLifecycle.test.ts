import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('react-toastify', () => ({ toast: { error: vi.fn() } }))
vi.mock('@/lib/checkStyleDebug', () => ({ checkStyleLog: vi.fn() }))

beforeEach(() => {
  vi.resetModules()
  localStorage.clear()
  localStorage.setItem('access_token', 'test-access')
  localStorage.setItem('refresh_token', 'test-refresh')
})
afterEach(() => vi.unstubAllGlobals())

const response = (status: number, data: unknown = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

describe('401/403 request lifecycle', () => {
  it('refreshes once and retries once on 401', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response(401))
      .mockResolvedValueOnce(
        response(200, {
          data: { accessToken: 'new-access', refreshToken: 'new-refresh' },
        })
      )
      .mockResolvedValueOnce(response(200, { data: { items: [] } }))
    vi.stubGlobal('fetch', fetcher)
    const { get } = await import('../apiClient')
    await get('/private')
    expect(fetcher).toHaveBeenCalledTimes(3)
    expect(fetcher.mock.calls[1][0]).toContain('/auth/refresh')
    expect(fetcher.mock.calls[2][1].headers.Authorization).toBe('Bearer new-access')
  })
  it('never refreshes or clears tokens for 403', async () => {
    const fetcher = vi.fn().mockResolvedValue(response(403, { message: 'Denied' }))
    vi.stubGlobal('fetch', fetcher)
    const { get } = await import('../apiClient')
    await expect(get('/private')).rejects.toMatchObject({ status: 403 })
    expect(fetcher).toHaveBeenCalledOnce()
    expect(localStorage.getItem('access_token')).toBe('test-access')
  })
  it('does not loop when refresh fails', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response(401))
      .mockResolvedValueOnce(response(401))
    vi.stubGlobal('fetch', fetcher)
    const { get } = await import('../apiClient')
    await expect(get('/private')).rejects.toMatchObject({ status: 401 })
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(localStorage.getItem('access_token')).toBeNull()
  })
  it('does not refresh a second time when the retried request returns 401', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response(401))
      .mockResolvedValueOnce(
        response(200, {
          data: { accessToken: 'new-access', refreshToken: 'new-refresh' },
        })
      )
      .mockResolvedValueOnce(response(401))
    vi.stubGlobal('fetch', fetcher)
    const { get } = await import('../apiClient')
    await expect(get('/private')).rejects.toMatchObject({ status: 401 })
    expect(fetcher).toHaveBeenCalledTimes(3)
    expect(
      fetcher.mock.calls.filter(([url]) => String(url).includes('/auth/refresh'))
    ).toHaveLength(1)
  })
  it('shares one in-flight refresh between concurrent requests', async () => {
    let finishRefresh!: (value: Response) => void
    const refreshResult = new Promise<Response>((resolve) => {
      finishRefresh = resolve
    })
    const fetcher = vi.fn((url: string, init: RequestInit) => {
      if (url.includes('/auth/refresh')) return refreshResult
      const authorization = (init.headers as Record<string, string>).Authorization
      return Promise.resolve(response(authorization === 'Bearer new-access' ? 200 : 401))
    })
    vi.stubGlobal('fetch', fetcher)
    const { get } = await import('../apiClient')
    const requests = [get('/private-a'), get('/private-b')]
    await vi.waitFor(() => {
      expect(fetcher.mock.calls.filter(([url]) => url.includes('/auth/refresh'))).toHaveLength(1)
    })
    finishRefresh(
      response(200, { data: { accessToken: 'new-access', refreshToken: 'new-refresh' } })
    )
    await Promise.all(requests)
    expect(fetcher.mock.calls.filter(([url]) => url.includes('/auth/refresh'))).toHaveLength(1)
    expect(fetcher).toHaveBeenCalledTimes(5)
  })
})
