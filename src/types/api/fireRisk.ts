/** Response từ GET /fire-risk/latest — trùng shape với fire-risk.controller#getLatest. */
import type { GeeDistrictExportProgress, GeeProcessingState } from './geeProcessing'

export interface FireRiskProvinceSummary {
  maxLevel?: number
  avgRiskLevel?: number | null
  riskLevelDist?: Record<'0' | '1' | '2' | '3' | '4' | '5', number>
  s2CoverageRatio?: number
  [key: string]: any
}

/** Feature từ repo.getFeatures — 1 row/district/level, có geometry polygon. */
export interface FireRiskFeature {
  id: number | string
  risk_level: 1 | 2 | 3 | 4 | 5
  district_code: string | null
  district_name: string | null
  area_ha: string | number
  geometry?: any | null
  properties?: Record<string, any>
}

export interface FireRiskDistrictStat {
  name: string | null
  unitCode: number | string | null
  s2Coverage?: number
  pNesterovMean?: number | null
  /** Centroid WGS84 sau reproject GEE. Server strip trước khi trả /latest. */
  centroid?: { lat: number; lng: number }
  /** GEE reduceRegions xuất level 0-5 (0 = thiếu ảnh). Server persist tất cả. */
  riskLevelDist?: Record<'0' | '1' | '2' | '3' | '4' | '5', number>
  /** @deprecated Field cũ trước v4 refactor — snapshot mới không có nữa. */
  totalForestHa?: number
}

export interface FireRiskSnapshot {
  id: number | string
  analysisDate: string
  status: string
  provinceSummary?: FireRiskProvinceSummary
  districtStats?: FireRiskDistrictStat[]
  geoserverLayer?: string | null
  geeTileUrl?: string | null
  geeTileGeneratedAt?: string | null
  /** GeoTIFF URL clip theo RanhGioiTinh_Polygon, sinh bởi GEE
   *  `image.getDownloadURL()` ở cuối `runAnalysis`; chỉ tồn tại vài giờ. */
  geeDownloadUrl?: string | null
  geoserverDownloadUrl?: string | null
  downloadFilename?: string | null
  computedAt?: string | null
  publishedAt?: string | null
  districtExportSummary?: GeeDistrictExportProgress | Record<string, unknown> | null
  errorMessage?: string | null
  retryCount?: number
  nextRetryAt?: string | null
  lastRetryError?: string | null
}

export interface FireRiskLatestData {
  snapshot: FireRiskSnapshot | null
  features: FireRiskFeature[]
  stale?: boolean
  computing?: boolean
  processing?: GeeProcessingState
}

export interface FireRiskDistrictExport {
  id: number | string
  districtCode: string
  districtName: string
  status: 'pending' | 'computing' | 'exporting' | 'completed' | 'published' | 'failed' | 'skipped'
  scaleM: number | null
  areaStats: Record<string, any> | null
  totalAreaHa: number | null
  /** Public aliases returned when infrastructure-only fields are hidden. */
  tileUrl?: string | null
  tileGeneratedAt?: string | null
  geeTileUrl?: string | null
  geeDownloadUrl?: string | null
  geeDownloadFilename?: string | null
  geoserverDownloadUrl?: string | null
  downloadFilename?: string | null
  geeGeneratedAt?: string | null
  minioKey?: string | null
  geoserverLayer?: string | null
  geoserverStore?: string | null
  rasterIngestJobId?: number | string | null
  rasterIngestStatus?: string | null
  errorMessage?: string | null
  durationMs?: number | null
  startedAt?: string | null
  completedAt?: string | null
}

export interface FireRiskDistrictExportsData {
  snapshotId: number | string
  snapshotStatus?: string
  analysisDate: string
  attempt: number
  scaleM: number | null
  total: number
  discoveredTotal?: number
  expectedTotal?: number
  districtCodeCount?: number
  coverageScope?: 'districtMosaic'
  coverageCount?: number
  fullyPublished?: boolean
  completed: number
  failed: number
  skipped: number
  pending: number
  sourceCount?: number
  storedCount?: number
  publishedCount?: number
  geoserverCount?: number
  readyCount?: number
  ready?: number
  queuedCount?: number
  failedPublishCount?: number
  missingCount?: number
  geoserverLayers?: string[]
  aggregate: {
    totalHa: number
    byLevel: Record<string, number>
  }
  districts: FireRiskDistrictExport[]
}

export interface FireRiskPublishRasterData {
  snapshotId: number | string
  /** Legacy whole-province raster ingest response. */
  jobId?: number | string
  status?: string
  layerCode?: string
  deduplicated?: boolean
  geoserverLayer?: string
  /** District batch response. */
  total?: number
  totalDistricts?: number
  districtCodeCount?: number
  fullyPublished?: boolean
  sourceCount?: number
  storedCount?: number
  available?: number
  publishedCount?: number
  geoserverCount?: number
  readyCount?: number
  ready?: number
  published?: number
  queued?: number
  queuedCount?: number
  enqueued?: number
  enqueuedCount?: number
  missing?: number
  missingCount?: number
  unavailable?: number
  failed?: number
  failedCount?: number
  alreadyPublished?: boolean
  jobs?: Array<{
    districtCode: string
    districtName?: string
    jobId: number | string
    status: string
    layerCode?: string
    deduplicated?: boolean
    existing?: boolean
  }>
}

export interface FireRiskMapParams {
  minRiskLevel?: number
}

export interface FireRiskMapData {
  type: 'FeatureCollection'
  features: any[]
}

export interface FireRiskHistoryItem {
  id: number | string
  analysis_date: string
  analysisDate?: string
  status: string
  s2_coverage_ratio?: string | number
  province_summary?: FireRiskProvinceSummary
  computed_at?: string
  published_at?: string | null
  gee_tile_url?: string | null
  gee_tile_generated_at?: string | null
  gee_download_url?: string | null
  geoserver_layer?: string | null
  district_total?: number
  district_source_count?: number
  district_stored_count?: number
  district_geoserver_count?: number
  district_ready_count?: number
  district_code_count?: number
  fully_published?: boolean
  geoserver_layers?: string[]
  totalDistricts?: number
  sourceCount?: number
  storedCount?: number
  districtLayerCount?: number
  readyCount?: number
  districtCodeCount?: number
  fullyPublished?: boolean
  geoserverLayers?: string[]
  error_message?: string | null
  [key: string]: any
}

export interface FireRiskHistoryData {
  items: FireRiskHistoryItem[]
}

export interface FireRiskRefreshBody {
  analysisDate?: string
  submitExport?: boolean
  enableRf?: boolean
  inputFireAssetId?: string
}

export interface FireRiskRefreshData {
  run: {
    analysisDate: string
    status: 'queued' | 'computing'
    deduplicated: boolean
    processing: GeeProcessingState
  }
}

export interface FireRiskHistoryParams {
  page?: number
  limit?: number
  hasGeoserverLayer?: boolean | string
}
