import apiClient from './common/apiClient'
import type {
  ApiResponse,
  News,
  NewsData,
  NewsListData,
  NewsListParams,
  PatchNewsStatusBody,
  UpdateNewsBody,
} from '@/types/api'
import { serviceNewsPath, serviceAdminNewsPath } from '@/constant/serviceConstant'

export default {
  /** GET /news (public list) */
  getPublicList: (params?: NewsListParams) =>
    apiClient.get<NewsListData>(serviceNewsPath, { params }),

  /** GET /news/:slug (public detail by slug) */
  getBySlug: (slug: string) => apiClient.get<NewsData>(`${serviceNewsPath}/${slug}`),

  /** GET /admin/news (admin list — includes drafts) */
  getAll: (params?: NewsListParams) =>
    apiClient.get<NewsListData>(serviceAdminNewsPath, { params }),

  /** GET /admin/news/:newsId (admin detail, includes vi+en translations) */
  getById: (newsId: number | string) =>
    apiClient.get<NewsData>(`${serviceAdminNewsPath}/${newsId}`),

  /**
   * POST /admin/news
   * Multipart body: lang, title, summary, content, status, cover (File)
   */
  create: (data: FormData) => apiClient.post<News>(serviceAdminNewsPath, data, true),

  /** PATCH /admin/news/:newsId (partial: status + expectedUpdatedAt) */
  patchStatus: (newsId: number | string, data: PatchNewsStatusBody) =>
    apiClient.patch<News>(`${serviceAdminNewsPath}/${newsId}`, data),

  /**
   * PUT /admin/news/:newsId
   * body: { status, expectedUpdatedAt, translations: { vi:{...}, en?:{...} } }
   */
  update: (newsId: number | string, data: UpdateNewsBody) =>
    apiClient.put<News>(`${serviceAdminNewsPath}/${newsId}`, data),

  /** DELETE /admin/news/:newsId */
  delete: (newsId: number | string) =>
    apiClient.del<ApiResponse<{}>>(`${serviceAdminNewsPath}/${newsId}`),
}
