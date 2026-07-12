import apiClient from './common/apiClient'
import type {
  ApiResponse,
  FireRiskLatestData,
  FireRiskMapData,
  FireRiskMapParams,
  FireRiskHistoryData,
  FireRiskHistoryParams,
  FireRiskRefreshBody,
} from '@/types/api'
import { serviceFireRiskPath } from '@/constant/serviceConstant'

export default {
  /** GET /fire-risk/latest?minRiskLevel= */
  getLatest: (params?: FireRiskMapParams) =>
    apiClient.get<FireRiskLatestData>(`${serviceFireRiskPath}/latest`, { params }),

  /** GET /fire-risk/map?minRiskLevel= */
  getMap: (params?: FireRiskMapParams) =>
    apiClient.get<FireRiskMapData>(`${serviceFireRiskPath}/map`, { params }),

  /** GET /fire-risk/history (perm: fire_risk.manage) */
  getHistory: (params?: FireRiskHistoryParams) =>
    apiClient.get<FireRiskHistoryData>(`${serviceFireRiskPath}/history`, { params }),

  /** POST /fire-risk/refresh */
  refresh: (data?: FireRiskRefreshBody) =>
    apiClient.post<ApiResponse<{ jobId?: string }>>(`${serviceFireRiskPath}/refresh`, data ?? {}),
}
