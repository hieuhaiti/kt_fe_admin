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

  // ── Ground truth: zones ─────────────────────────────────────────────────
  listGtZones: (params?: { page?: number; limit?: number; from?: string; to?: string; classId?: number }) =>
    apiClient.get<ApiResponse<any[]>>(
      `${serviceForestClassificationPath}/ground-truth/zones`, { params }),

  createGtZone: (body: {
    name?: string; observedAt: string; classId: number;
    source?: string; notes?: string; geom: any;
  }) =>
    apiClient.post<ApiResponse<any>>(
      `${serviceForestClassificationPath}/ground-truth/zones`, body),

  bulkGtZone: (featureCollection: any) =>
    apiClient.post<ApiResponse<{ inserted: number; ids: number[] }>>(
      `${serviceForestClassificationPath}/ground-truth/zones/bulk`, featureCollection),

  deleteGtZone: (id: number | string) =>
    apiClient.delete<ApiResponse<any>>(
      `${serviceForestClassificationPath}/ground-truth/zones/${id}`),

  // ── Ground truth: points ────────────────────────────────────────────────
  listGtPoints: (params?: { page?: number; limit?: number; from?: string; to?: string; classId?: number }) =>
    apiClient.get<ApiResponse<any[]>>(
      `${serviceForestClassificationPath}/ground-truth/points`, { params }),

  createGtPoint: (body: {
    observedAt: string; classId: number; lng: number; lat: number;
    source?: string; photoUrl?: string; reporterName?: string; notes?: string;
  }) =>
    apiClient.post<ApiResponse<any>>(
      `${serviceForestClassificationPath}/ground-truth/points`, body),

  bulkGtPoint: (points: any[]) =>
    apiClient.post<ApiResponse<{ inserted: number; ids: number[] }>>(
      `${serviceForestClassificationPath}/ground-truth/points/bulk`, { points }),

  deleteGtPoint: (id: number | string) =>
    apiClient.delete<ApiResponse<any>>(
      `${serviceForestClassificationPath}/ground-truth/points/${id}`),
}
