import type { ApiResponse, Pagination } from '@/types/api'

/**
 * Backend trả về list dạng:
 *   { data: { items: T[] }, metadata: { page, limit, total, totalPages } }
 *
 * Nhưng nhiều page cũ đọc `data.<pluralKey>` và `data.pagination`.
 * Hàm này thêm các alias mà không phá vỡ shape gốc, giúp giai đoạn migrate mượt hơn.
 */
export function normalizeList<_T = any>(res: ApiResponse<any>, pluralKey: string): ApiResponse<any> {
  if (!res || !res.data) return res
  const data = res.data
  const items = data.items ?? data[pluralKey] ?? []
  const pagination = (res.metadata as Pagination | undefined) ?? data.pagination
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
export function unwrap<T>(res: ApiResponse<any>, key?: string): ApiResponse<T> {
  if (!res || !res.data) return res as ApiResponse<T>
  if (key && typeof res.data === 'object' && key in res.data) {
    return res as ApiResponse<T>
  }
  return res as ApiResponse<T>
}
