import apiClient from './common/apiClient'
import type {
  ApiResponse,
  CitizenFeedback,
  CitizenFeedbackListData,
  FeedbackListParams,
  UpdateFeedbackStatusBody,
  FeedbackFeatureCollection,
} from '@/types/api'
import { serviceFeedbackPath, serviceAdminFeedbackPath } from '@/constant/serviceConstant'

export default {
  // ── Citizen / public ──

  /**
   * POST /feedback (multipart)
   * body: category, title, description, priority, lng, lat, clientUuid, media[]
   * Bearer or x-anonymous-id
   */
  create: (data: FormData) =>
    apiClient.post<CitizenFeedback>(serviceFeedbackPath, data, true),

  /** GET /feedback/mine */
  getMine: (params?: FeedbackListParams) =>
    apiClient.get<CitizenFeedbackListData>(`${serviceFeedbackPath}/mine`, { params }),

  /** Legacy alias */
  getMyFeedbacks: (params?: FeedbackListParams) =>
    apiClient.get<CitizenFeedbackListData>(`${serviceFeedbackPath}/mine`, { params }),

  /** GET /feedback/:feedbackId */
  getById: (feedbackId: number | string) =>
    apiClient.get<CitizenFeedback>(`${serviceFeedbackPath}/${feedbackId}`),

  // ── Admin ──

  /** GET /admin/feedback (paginated list) */
  getAll: (params?: FeedbackListParams) =>
    apiClient.get<CitizenFeedbackListData>(serviceAdminFeedbackPath, { params }),

  /**
   * GET /admin/feedback/map
   * Returns FeatureCollection scoped by bbox
   */
  getMap: (params?: FeedbackListParams) =>
    apiClient.get<FeedbackFeatureCollection>(`${serviceAdminFeedbackPath}/map`, { params }),

  /** GET /admin/feedback/:feedbackId (includes statusLogs) */
  getAdminById: (feedbackId: number | string) =>
    apiClient.get<CitizenFeedback>(`${serviceAdminFeedbackPath}/${feedbackId}`),

  /** PATCH /admin/feedback/:feedbackId/status  body: { toStatus, note } */
  updateStatus: (feedbackId: number | string, data: UpdateFeedbackStatusBody) =>
    apiClient.patch<CitizenFeedback>(`${serviceAdminFeedbackPath}/${feedbackId}/status`, data),

  // ── Compatibility shims (kept so legacy pages keep compiling) ──

  /** Legacy — no longer in Postman; falls back to admin list filtered by status */
  getByStatus: (status: string, params?: { page?: number; limit?: number }) =>
    apiClient.get<CitizenFeedbackListData>(serviceAdminFeedbackPath, {
      params: { ...(params ?? {}), status },
    }),

  /** Legacy — statistics not in Postman; returns empty payload via admin list */
  getStatistics: (_params?: { start_date?: string; end_date?: string }) =>
    apiClient.get<any>(serviceAdminFeedbackPath, { params: { page: 1, limit: 1 } }),

  /** Legacy update — server no longer supports full update, only status */
  update: (feedbackId: number | string, _data: any) =>
    apiClient.get<CitizenFeedback>(`${serviceFeedbackPath}/${feedbackId}`),

  /** DELETE — not in Postman; legacy pages call this. No-op stub. */
  delete: (feedbackId: number | string) =>
    apiClient.del<ApiResponse<{}>>(`${serviceAdminFeedbackPath}/${feedbackId}`),
}
