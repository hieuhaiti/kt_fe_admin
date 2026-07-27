import apiClient from './common/apiClient'
import type {
  ApiResponse,
  SatelliteRgbBody,
  SatelliteNdviBody,
  SatelliteHeatMapBody,
  SatelliteClassifiedBody,
  SatelliteResponse,
} from '@/types/api'
import { serviceSatellitePath } from '@/constant/serviceConstant'

/**
 * On-demand GEE satellite services.
 * Postman route "/satellite/*" — legacy cron endpoints kept in cronAlertService.
 */
export default {
  /** POST /satellite/rgb */
  rgb: (data: SatelliteRgbBody) =>
    apiClient.post<SatelliteResponse>(`${serviceSatellitePath}/rgb`, data),

  /** POST /satellite/ndvi */
  ndvi: (data: SatelliteNdviBody) =>
    apiClient.post<SatelliteResponse>(`${serviceSatellitePath}/ndvi`, data),

  /** POST /satellite/heat-map */
  heatMap: (data: SatelliteHeatMapBody) =>
    apiClient.post<SatelliteResponse>(`${serviceSatellitePath}/heat-map`, data),

  /** POST /satellite/classified (11-class RF, lopPhuRungFinal v3) */
  classified: (data: SatelliteClassifiedBody) =>
    apiClient.post<SatelliteResponse>(`${serviceSatellitePath}/classified`, data),

  /** POST /satellite/results/:id/publish-raster — enqueue raster-ingest job.
   *  Không cần GEE_GCS_BUCKET, cùng cơ chế với fire-risk/forest-classification.
   *  Response { jobId, layerCode, status, deduplicated, alreadyPublished? }.
   *  Force re-publish khi force=true. */
  publishResult: (resultId: number | string, force?: boolean) =>
    apiClient.post<ApiResponse<{
      resultId: number
      jobId?: number
      status?: string
      layerCode?: string
      deduplicated?: boolean
      alreadyPublished?: boolean
      geoserverLayer?: string
    }>>(`${serviceSatellitePath}/results/${resultId}/publish-raster${force ? '?force=1' : ''}`),

  /** GET /map/rasters/ingest-jobs/:id — poll trạng thái raster ingest. Cùng
   *  endpoint chung với fire-risk + forest-classification. */
  getIngestJob: (jobId: number | string) =>
    apiClient.get<ApiResponse<{
      id: number
      status: string
      progress: number
      geoserver_layer?: string | null
      minio_key?: string | null
      error_log?: string | null
    }>>(`/map/rasters/ingest-jobs/${jobId}`),
}
