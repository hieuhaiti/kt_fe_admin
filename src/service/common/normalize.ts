import type { ApiResponse, Pagination } from '@/types/api'

/**
 * Backend trả về list dạng:
 *   { data: { items: T[] }, metadata: { page, limit, total, totalPages } }
 *
 * Nhưng nhiều page cũ đọc `data.<pluralKey>` và `data.pagination`.
 * Hàm này thêm các alias mà không phá vỡ shape gốc, giúp giai đoạn migrate mượt hơn.
 */
export function normalizeList<T = unknown>(
  res: ApiResponse<Record<string, unknown>>,
  pluralKey: string
): ApiResponse<Record<string, unknown> & { items: T[]; [key: string]: unknown }> {
  if (!res || !res.data) return res as unknown as ApiResponse<Record<string, unknown> & { items: T[]; [key: string]: unknown }>
  const data = res.data
  const items = (data.items ?? data[pluralKey] ?? []) as T[]
  const pagination = (res.metadata as Pagination | undefined) ?? (data.pagination as Pagination | undefined)
  const enriched = {
    ...data,
    items,
    [pluralKey]: items,
    pagination,
  }
  return { ...res, data: enriched }
}

/**
 * Wrapper: một số detail endpoint (auth/me, news/:slug) trả về
 * `{ data: { user | news | comment } }` nhưng nhiều pages truy cập `data.data.user`.
 * Helper này giúp cast trường hợp hai lớp, trả về đối tượng flat lẫn dạng wrapper.
 */
export function unwrap<T>(res: ApiResponse<unknown>, key?: string): ApiResponse<T> {
  if (!res || !res.data) return res as unknown as ApiResponse<T>
  if (key && typeof res.data === 'object' && key in (res.data as Record<string, unknown>)) {
    return res as unknown as ApiResponse<T>
  }
  return res as unknown as ApiResponse<T>
}
