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

  /** POST /forest-classification/snapshots/:id/publish-raster — enqueue MinIO→GeoServer */
  publishSnapshotRaster: (id: number | string, force?: boolean) =>
    apiClient.post<ApiResponse<{
      snapshotId: number
      jobId: number
      status: string
      deduplicated: boolean
      alreadyPublished?: boolean
      geoserverLayer?: string
    }>>(`${serviceForestClassificationPath}/snapshots/${id}/publish-raster${force ? '?force=1' : ''}`),

  /** GET /map/rasters/ingest-jobs/:id — poll raster ingest progress. Cùng
      endpoint với fire-risk (raster-ingest queue shared cho mọi resource). */
  getIngestJob: (jobId: number | string) =>
    apiClient.get<ApiResponse<{
      id: number
      status: string
      progress: number
      geoserver_layer?: string | null
      minio_key?: string | null
      error_log?: string | null
    }>>(`/map/rasters/ingest-jobs/${jobId}`),

  // ── Ground truth: zones ─────────────────────────────────────────────────
  listGtZones: (params?: { page?: number; limit?: number; from?: string; to?: string; classId?: number }) =>
    apiClient.get<{ items: any[] }>(
      `${serviceForestClassificationPath}/ground-truth/zones`, { params }),

  createGtZone: (body: {
    name?: string; observedAt: string; classId: number;
    source?: string; notes?: string; geom: any;
  }) =>
    apiClient.post<ApiResponse<any>>(
      `${serviceForestClassificationPath}/ground-truth/zones`, body),

  bulkGtZone: (featureCollection: any) =>
    apiClient.post<{ inserted: number; ids: number[] }>(
      `${serviceForestClassificationPath}/ground-truth/zones/bulk`, featureCollection),

  deleteGtZone: (id: number | string) =>
    apiClient.del<any>(
      `${serviceForestClassificationPath}/ground-truth/zones/${id}`),

  // ── Ground truth: points ────────────────────────────────────────────────
  listGtPoints: (params?: { page?: number; limit?: number; from?: string; to?: string; classId?: number }) =>
    apiClient.get<{ items: any[] }>(
      `${serviceForestClassificationPath}/ground-truth/points`, { params }),

  createGtPoint: (body: {
    observedAt: string; classId: number; lng: number; lat: number;
    source?: string; photoUrl?: string; reporterName?: string; notes?: string;
  }) =>
    apiClient.post<ApiResponse<any>>(
      `${serviceForestClassificationPath}/ground-truth/points`, body),

  bulkGtPoint: (points: any[]) =>
    apiClient.post<{ inserted: number; ids: number[] }>(
      `${serviceForestClassificationPath}/ground-truth/points/bulk`, { points }),

  deleteGtPoint: (id: number | string) =>
    apiClient.del<any>(
      `${serviceForestClassificationPath}/ground-truth/points/${id}`),
}
