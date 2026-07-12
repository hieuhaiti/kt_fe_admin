import type { ApiResponse } from '@/types/api'
import { tokenManager } from '@/lib/tokenManager'
import { emitSessionExpired } from '@/lib/sessionEvents'
import { toast } from 'react-toastify'

const API_BASE = (
  import.meta.env.VITE_BASE_URL_BE ||
  import.meta.env.VITE_API_BASE_URL ||
  ''
).trim().replace(/\/$/, '')
const DEFAULT_LANG = (import.meta.env.VITE_DEFAULT_LANG as string) || 'vi'
let refreshPromise: Promise<string | null> | null = null
let authSessionExpired = false

export interface RequestOptions {
  params?: Record<string, any>
  useForm?: boolean
  lang?: string
  skipLang?: boolean
  headers?: Record<string, string>
  mapApiKey?: string
  anonymousId?: string
}

function getAccessToken() {
  try {
    return tokenManager.getAccessToken() || undefined
  } catch {
    return undefined
  }
}

function getAnonymousId() {
  try {
    return tokenManager.getAnonymousId() || undefined
  } catch {
    return undefined
  }
}

async function handleResponse<T>(res: Response, isAuthEndpoint = false): Promise<ApiResponse<T>> {
  const contentType = res.headers.get('content-type') || ''
  const isJson = contentType.includes('application/json')
  const body = isJson ? await res.json() : undefined

  if (!res.ok) {
    const err: any = new Error(body?.message || res.statusText || 'Request failed')
    err.status = res.status
    err.body = body
    err.isAuthRequest = isAuthEndpoint

    if (res.status !== 401 || isAuthEndpoint) {
      const errors = body?.errors
      if (Array.isArray(errors) && errors.length) {
        const detail = errors
          .map((e: any) => (typeof e === 'string' ? e : e.message || e))
          .join('\n')
        toast.error(body?.message ? `${body.message}\n${detail}` : detail, {
          autoClose: 8000,
        })
      } else {
        toast.error(body?.message || `Lỗi ${res.status}`, { autoClose: 5000 })
      }
    }

    throw err
  }

  return body as ApiResponse<T>
}

function buildHeaders(opts: RequestOptions = {}, hasJsonBody = false): Record<string, string> {
  const headers: Record<string, string> = {}

  if (hasJsonBody) headers['Content-Type'] = 'application/json'

  const token = getAccessToken()
  if (token) headers['Authorization'] = `Bearer ${token}`

  if (opts.mapApiKey) headers['X-Map-Api-Key'] = opts.mapApiKey

  const anonymousId = opts.anonymousId ?? getAnonymousId()
  if (anonymousId && !token) headers['x-anonymous-id'] = anonymousId

  if (opts.headers) Object.assign(headers, opts.headers)

  return headers
}

function buildQuery(url: string, opts: RequestOptions = {}): string {
  const params: Record<string, any> = { ...(opts.params ?? {}) }
  if (!opts.skipLang && params.lang === undefined) params.lang = opts.lang ?? DEFAULT_LANG

  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
  if (!entries.length) return url

  const qs = new URLSearchParams(entries.map(([k, v]) => [k, String(v)]) as any).toString()
  return url.includes('?') ? `${url}&${qs}` : `${url}?${qs}`
}

function getRefreshToken() {
  try {
    return tokenManager.getRefreshToken() || undefined
  } catch {
    return undefined
  }
}

function markSessionExpired() {
  if (authSessionExpired) return
  authSessionExpired = true
  clearTokens()
  emitSessionExpired()
}

function isAuthUrl(url: string) {
  return (
    url.includes('auth/login') ||
    url.includes('auth/register') ||
    url.includes('auth/refresh') ||
    url.includes('auth/logout') ||
    url.includes('auth/forgot-password') ||
    url.includes('auth/reset-password') ||
    url.includes('auth/verify-email') ||
    url.includes('auth/resend-verification')
  )
}

async function requestWithRefresh(
  url: string,
  opts: RequestInit,
  isRetry = false
): Promise<Response> {
  const res = await fetch(`${API_BASE}${url}`, opts)

  if (res.status !== 401) return res

  if (isRetry || isAuthUrl(url) || authSessionExpired) return res
  const refreshToken = getRefreshToken()
  if (!refreshToken) {
    markSessionExpired()
    return res
  }

  try {
    if (!refreshPromise) {
      refreshPromise = fetch(`${API_BASE}/auth/refresh?lang=${DEFAULT_LANG}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      })
        .then(async (refreshRes) => {
          if (!refreshRes.ok) return null
          const refreshBody = await refreshRes.json()
          const newAccess = refreshBody?.data?.accessToken
          const newRefresh = refreshBody?.data?.refreshToken
          if (!newAccess) return null
          setTokens({ accessToken: newAccess, refreshToken: newRefresh })
          return newAccess as string
        })
        .finally(() => {
          refreshPromise = null
        })
    }

    const newAccess = await refreshPromise
    if (!newAccess) {
      markSessionExpired()
      return res
    }

    const newOpts = {
      ...opts,
      headers: {
        ...(opts.headers || {}),
        Authorization: `Bearer ${newAccess}`,
      },
    }
    return await requestWithRefresh(url, newOpts, true)
  } catch {
    markSessionExpired()
    return res
  }
}

export async function get<T = any>(
  url: string,
  paramsOrOpts?: Record<string, any> | RequestOptions
): Promise<ApiResponse<T>> {
  const opts = normalizeGetOpts(paramsOrOpts)
  const finalUrl = buildQuery(url, opts)
  const res = await requestWithRefresh(finalUrl, {
    method: 'GET',
    headers: buildHeaders(opts, false),
  })
  return handleResponse(res, isAuthUrl(url))
}

function normalizeGetOpts(input?: Record<string, any> | RequestOptions): RequestOptions {
  if (!input) return {}
  if ('params' in input || 'lang' in input || 'skipLang' in input || 'headers' in input ||
      'mapApiKey' in input || 'anonymousId' in input || 'useForm' in input) {
    return input as RequestOptions
  }
  return { params: input as Record<string, any> }
}

export async function post<T = any>(
  url: string,
  data?: any,
  useFormOrOpts?: boolean | RequestOptions
): Promise<ApiResponse<T>> {
  const opts = normalizeBodyOpts(useFormOrOpts)
  const useForm = opts.useForm === true
  const headers = buildHeaders(opts, !useForm)
  const body = useForm ? data : JSON.stringify(data ?? {})

  const finalUrl = buildQuery(url, opts)
  const res = await requestWithRefresh(finalUrl, { method: 'POST', headers, body })
  return handleResponse(res, isAuthUrl(url))
}

export async function put<T = any>(
  url: string,
  data?: any,
  useFormOrOpts?: boolean | RequestOptions
): Promise<ApiResponse<T>> {
  const opts = normalizeBodyOpts(useFormOrOpts)
  const useForm = opts.useForm === true
  const headers = buildHeaders(opts, !useForm)
  const body = useForm ? data : JSON.stringify(data ?? {})

  const finalUrl = buildQuery(url, opts)
  const res = await requestWithRefresh(finalUrl, { method: 'PUT', headers, body })
  return handleResponse(res, isAuthUrl(url))
}

export async function patch<T = any>(
  url: string,
  data?: any,
  optsInput?: RequestOptions
): Promise<ApiResponse<T>> {
  const opts = optsInput ?? {}
  const useForm = opts.useForm === true
  const headers = buildHeaders(opts, !useForm)
  const body = useForm ? data : JSON.stringify(data ?? {})

  const finalUrl = buildQuery(url, opts)
  const res = await requestWithRefresh(finalUrl, { method: 'PATCH', headers, body })
  return handleResponse(res, isAuthUrl(url))
}

export async function del<T = any>(
  url: string,
  data?: any,
  optsInput?: RequestOptions
): Promise<ApiResponse<T>> {
  const opts = optsInput ?? {}
  const headers = buildHeaders(opts, data !== undefined)
  const body = data !== undefined ? JSON.stringify(data) : undefined

  const finalUrl = buildQuery(url, opts)
  const res = await requestWithRefresh(finalUrl, { method: 'DELETE', headers, body })
  return handleResponse(res, isAuthUrl(url))
}

function normalizeBodyOpts(input?: boolean | RequestOptions): RequestOptions {
  if (input === undefined) return {}
  if (typeof input === 'boolean') return { useForm: input }
  return input
}

export function setTokens({
  accessToken,
  refreshToken,
}: {
  accessToken?: string
  refreshToken?: string
}) {
  try {
    authSessionExpired = false
    if (accessToken) tokenManager.setAccessToken(accessToken)
    if (refreshToken) tokenManager.setRefreshToken(refreshToken)
  } catch {}
}

export function clearTokens() {
  try {
    tokenManager.clearAll()
  } catch {}
}

export default { get, post, put, patch, del, setTokens, clearTokens }
