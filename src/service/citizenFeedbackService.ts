import apiClient from './common/apiClient'
import type {
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
  create: (data: FormData) => apiClient.post<CitizenFeedback>(serviceFeedbackPath, data, true),

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
  getMap: (params?: Pick<FeedbackListParams, 'status' | 'category' | 'priority' | 'bbox'>) =>
    apiClient.get<FeedbackFeatureCollection>(`${serviceAdminFeedbackPath}/map`, { params }),

  /** GET /admin/feedback/:feedbackId (includes statusLogs) */
  getAdminById: (feedbackId: number | string) =>
    apiClient.get<CitizenFeedback>(`${serviceAdminFeedbackPath}/${feedbackId}`),

  /** PATCH /admin/feedback/:feedbackId/status  body: { toStatus, note } */
  updateStatus: (feedbackId: number | string, data: UpdateFeedbackStatusBody) =>
    apiClient.patch<CitizenFeedback>(`${serviceAdminFeedbackPath}/${feedbackId}/status`, data),
}
