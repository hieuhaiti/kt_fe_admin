import apiClient from './common/apiClient'
import type {
  ForestClassLatestData,
  ForestClassHistoryData,
  ForestClassHistoryParams,
  ForestClassRefreshBody,
  ForestClassRefreshData,
  ForestClassDistrictExportsData,
  ForestClassPublishRasterData,
} from '@/types/api'
import { serviceForestClassificationPath } from '@/constant/serviceConstant'

export default {
  /** GET /forest-classification/latest */
  getLatest: () =>
    apiClient.get<ForestClassLatestData>(`${serviceForestClassificationPath}/latest`),

  /** GET /forest-classification/history (perm: forest_classification.manage) */
  getHistory: (params?: ForestClassHistoryParams) =>
    apiClient.get<ForestClassHistoryData>(`${serviceForestClassificationPath}/history`, { params }),

  /** GET /forest-classification/published-history — nguồn kỳ ổn định cho so sánh. */
  getPublishedHistory: (params?: ForestClassHistoryParams) =>
    apiClient.get<ForestClassHistoryData>(`${serviceForestClassificationPath}/published-history`, {
      params,
    }),

  /** GET /forest-classification/snapshot/:id — chi tiết một kỳ để so sánh tùy chọn. */
  getSnapshot: (id: number | string) =>
    apiClient.get<ForestClassLatestData>(`${serviceForestClassificationPath}/snapshot/${id}`),

  /** POST /forest-classification/refresh */
  refresh: (data: ForestClassRefreshBody) =>
    apiClient.post<ForestClassRefreshData>(`${serviceForestClassificationPath}/refresh`, data),

  /** GET /forest-classification/snapshots/:id/districts — list N per-district
   *  download URL + status (migration 040 chia GEE export theo huyện).
   *  Trả về `{ snapshotId, year, month, attempt, scaleM, total, completed,
   *  failed, aggregate:{totalHa,forestHa,byClass}, districts:[{...}] }`.
   */
  getDistrictExports: (snapshotId: number | string) =>
    apiClient.get<ForestClassDistrictExportsData>(
      `${serviceForestClassificationPath}/snapshots/${snapshotId}/districts`
    ),

  /** POST /forest-classification/snapshots/:id/publish-raster — publish district rasters. */
  publishSnapshotRaster: (id: number | string, force?: boolean) =>
    apiClient.post<ForestClassPublishRasterData>(
      `${serviceForestClassificationPath}/snapshots/${id}/publish-raster${force ? '?force=1' : ''}`
    ),

  /** GET /map/rasters/ingest-jobs/:id — poll raster ingest progress. Cùng
      endpoint với fire-risk (raster-ingest queue shared cho mọi resource). */
  getIngestJob: (jobId: number | string) =>
    apiClient.get<{
      id: number | string
      status: string
      progress: number | null
      geoserver_layer?: string | null
      minio_key?: string | null
      error_log?: string | null
    }>(`/map/rasters/ingest-jobs/${jobId}`),

  // ── Ground truth: zones ─────────────────────────────────────────────────
  listGtZones: (params?: {
    page?: number
    limit?: number
    from?: string
    to?: string
    classId?: number
  }) =>
    apiClient.get<{ items: any[] }>(`${serviceForestClassificationPath}/ground-truth/zones`, {
      params,
    }),

  createGtZone: (body: {
    name?: string
    observedAt: string
    classId: number
    source?: string
    notes?: string
    geom: any
  }) => apiClient.post<any>(`${serviceForestClassificationPath}/ground-truth/zones`, body),

  bulkGtZone: (featureCollection: any) =>
    apiClient.post<{ inserted: number; ids: number[] }>(
      `${serviceForestClassificationPath}/ground-truth/zones/bulk`,
      featureCollection
    ),

  deleteGtZone: (id: number | string) =>
    apiClient.del<any>(`${serviceForestClassificationPath}/ground-truth/zones/${id}`),

  // ── Ground truth: points ────────────────────────────────────────────────
  listGtPoints: (params?: {
    page?: number
    limit?: number
    from?: string
    to?: string
    classId?: number
  }) =>
    apiClient.get<{ items: any[] }>(`${serviceForestClassificationPath}/ground-truth/points`, {
      params,
    }),

  createGtPoint: (body: {
    observedAt: string
    classId: number
    lng: number
    lat: number
    source?: string
    photoUrl?: string
    reporterName?: string
    notes?: string
  }) => apiClient.post<any>(`${serviceForestClassificationPath}/ground-truth/points`, body),

  bulkGtPoint: (points: any[]) =>
    apiClient.post<{ inserted: number; ids: number[] }>(
      `${serviceForestClassificationPath}/ground-truth/points/bulk`,
      { points }
    ),

  deleteGtPoint: (id: number | string) =>
    apiClient.del<any>(`${serviceForestClassificationPath}/ground-truth/points/${id}`),
}
