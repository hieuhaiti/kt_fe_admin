import apiClient from './common/apiClient'
import type {
  NewsComment,
  NewsCommentListData,
  NewsCommentAdminListParams,
  CreatePublicCommentBody,
  ApproveCommentBody,
} from '@/types/api'
import { serviceNewsPath, serviceAdminCommentsPath } from '@/constant/serviceConstant'

export default {
  /** GET /news/:newsId/comments (approved only) */
  getByNewsId: (newsId: number | string, params?: { page?: number; limit?: number }) =>
    apiClient.get<NewsCommentListData>(`${serviceNewsPath}/${newsId}/comments`, { params }),

  /** POST /news/:newsId/comments (citizen) */
  create: (newsId: number | string, data: CreatePublicCommentBody) =>
    apiClient.post<NewsComment>(`${serviceNewsPath}/${newsId}/comments`, data),

  /** GET /admin/comments (paginated, targetType=news) */
  getAll: (params?: NewsCommentAdminListParams) =>
    apiClient.get<NewsCommentListData>(serviceAdminCommentsPath, { params }),

  /** PATCH /admin/comments/:commentId/approve */
  approve: (commentId: number | string, data: ApproveCommentBody = { isApproved: true }) =>
    apiClient.patch<NewsComment>(`${serviceAdminCommentsPath}/${commentId}/approve`, data),

  /** DELETE /admin/comments/:commentId */
  delete: (commentId: number | string) =>
    apiClient.del<Record<string, never>>(`${serviceAdminCommentsPath}/${commentId}`),

  /** Backwards-compat alias */
  adminDelete: (commentId: number | string) =>
    apiClient.del<Record<string, never>>(`${serviceAdminCommentsPath}/${commentId}`),

  /** GET /admin/comments/:commentId */
  getById: (commentId: number | string) =>
    apiClient.get<NewsComment>(`${serviceAdminCommentsPath}/${commentId}`),
}
