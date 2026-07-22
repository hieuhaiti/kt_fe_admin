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

  /** POST /fire-risk/snapshots/:id/publish-raster — enqueue MinIO→GeoServer */
  publishSnapshotRaster: (id: number | string, force?: boolean) =>
    apiClient.post<ApiResponse<{
      snapshotId: number
      jobId: number
      status: string
      layerCode: string
      deduplicated: boolean
      alreadyPublished?: boolean
      geoserverLayer?: string
    }>>(`${serviceFireRiskPath}/snapshots/${id}/publish-raster${force ? '?force=1' : ''}`),

  /** GET /map/rasters/ingest-jobs/:id — poll raster ingest progress */
  getIngestJob: (jobId: number | string) =>
    apiClient.get<ApiResponse<{
      id: number
      status: string
      progress: number
      geoserver_layer?: string | null
      minio_key?: string | null
      error_log?: string | null
    }>>(`/map/rasters/ingest-jobs/${jobId}`),

  // ── Ground truth: zones (GeoJSON) ─────────────────────────────────────────
  listGtZones: (params?: { page?: number; limit?: number; from?: string; to?: string; severity?: number }) =>
    apiClient.get<{ items: any[] }>(`${serviceFireRiskPath}/ground-truth/zones`, { params }),

  createGtZone: (body: {
    name?: string; occurredAt: string; severity: number;
    source?: string; notes?: string; geom: any;
  }) =>
    apiClient.post<ApiResponse<any>>(`${serviceFireRiskPath}/ground-truth/zones`, body),

  bulkGtZone: (featureCollection: any) =>
    apiClient.post<{ inserted: number; ids: number[] }>(
      `${serviceFireRiskPath}/ground-truth/zones/bulk`, featureCollection),

  deleteGtZone: (id: number | string) =>
    apiClient.del<any>(`${serviceFireRiskPath}/ground-truth/zones/${id}`),

  // ── Ground truth: points ──────────────────────────────────────────────────
  listGtPoints: (params?: { page?: number; limit?: number; from?: string; to?: string; severity?: number }) =>
    apiClient.get<{ items: any[] }>(`${serviceFireRiskPath}/ground-truth/points`, { params }),

  createGtPoint: (body: {
    occurredAt: string; severity: number; lng: number; lat: number;
    source?: string; photoUrl?: string; reporterName?: string; notes?: string;
  }) =>
    apiClient.post<ApiResponse<any>>(`${serviceFireRiskPath}/ground-truth/points`, body),

  bulkGtPoint: (points: any[]) =>
    apiClient.post<{ inserted: number; ids: number[] }>(
      `${serviceFireRiskPath}/ground-truth/points/bulk`, { points }),

  deleteGtPoint: (id: number | string) =>
    apiClient.del<any>(`${serviceFireRiskPath}/ground-truth/points/${id}`),
}
