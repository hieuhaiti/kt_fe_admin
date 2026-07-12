import apiClient from './common/apiClient'
import type {
  ApiResponse,
  ForestClassLatestData,
  ForestClassHistoryData,
  ForestClassHistoryParams,
  ForestClassRefreshBody,
} from '@/types/api'
import { serviceForestClassificationPath } from '@/constant/serviceConstant'

export default {
  /** GET /forest-classification/latest */
  getLatest: () =>
    apiClient.get<ForestClassLatestData>(`${serviceForestClassificationPath}/latest`),

  /** GET /forest-classification/history (perm: forest_classification.manage) */
  getHistory: (params?: ForestClassHistoryParams) =>
    apiClient.get<ForestClassHistoryData>(
      `${serviceForestClassificationPath}/history`,
      { params }
    ),

  /** POST /forest-classification/refresh */
  refresh: (data: ForestClassRefreshBody) =>
    apiClient.post<ApiResponse<{ jobId?: string }>>(
      `${serviceForestClassificationPath}/refresh`,
      data
    ),
}
