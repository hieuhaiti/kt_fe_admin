// Types cho forest-classification API. Mirror shape từ
// server/src/controllers/forest-classification.controller.js formatSnapshot().
//
// province_summary structure (từ pipeline):
//   - byClass: { [classId: 0..12]: haNumber }
//   - totalHa: number

export interface ForestClassProvinceSummary {
  byClass?: Record<string, number>
  totalHa?: number
  [key: string]: any
}

export interface ForestClassSnapshot {
  id: number | string
  year: number
  month: number
  status: string // pending | computing | completed | failed | published
  provinceSummary?: ForestClassProvinceSummary
  oobAccuracy?: number | null
  testKappa?: number | null
  geoserverLayer?: string | null
  geeTileUrl?: string | null
  geeTileGeneratedAt?: string | null
  geeDownloadUrl?: string | null
  geoserverDownloadUrl?: string | null
  downloadFilename?: string | null
  computedAt?: string | null
  errorMessage?: string | null
  [key: string]: any
}

// Server trả nested structure trong /latest response — mỗi huyện là 1 object
// với `classes[]` con, đã group sẵn (không phải flat rows). Client render trực
// tiếp không cần regroup.
export interface ForestClassDistrictClassArea {
  classId: number
  className?: string | null
  areaHa: number
}

export interface ForestClassDistrictArea {
  districtCode?: string | null
  districtName?: string | null
  classes: ForestClassDistrictClassArea[]
  [key: string]: any
}

export interface ForestClassAreaComparisonMetric {
  currentHa: number
  previousHa: number
  deltaHa: number
  changePct: number | null
}

export interface ForestClassClassComparison extends ForestClassAreaComparisonMetric {
  classId: number
  className: string
}

export interface ForestClassDistrictComparison {
  districtCode?: string | null
  districtName?: string | null
  forest: ForestClassAreaComparisonMetric
}

export interface ForestClassComparison {
  previousSnapshot: {
    id: number | string
    year: number
    month: number
    computedAt?: string | null
    publishedAt?: string | null
  }
  province: {
    total: ForestClassAreaComparisonMetric
    forest: ForestClassAreaComparisonMetric
    classes: ForestClassClassComparison[]
  }
  districts: ForestClassDistrictComparison[]
}

export interface ForestClassLatestData {
  snapshot: ForestClassSnapshot | null
  districtAreas: ForestClassDistrictArea[]
  comparison?: ForestClassComparison | null
  geeTileUrl?: string | null
  stale?: boolean
  computing?: boolean
}

export interface ForestClassDistrictExport {
  id: number | string
  districtCode: string
  districtName: string
  status: 'pending' | 'computing' | 'exporting' | 'completed' | 'published' | 'failed' | 'skipped'
  scaleM: number | null
  areaByClass: Record<string, number> | null
  totalAreaHa: number | null
  forestAreaHa: number | null
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

export interface ForestClassDistrictExportsData {
  snapshotId: number | string
  snapshotStatus?: string
  year: number
  month: number
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
  readyCount?: number
  ready?: number
  queuedCount?: number
  failedPublishCount?: number
  missingCount?: number
  geoserverLayers?: string[]
  aggregate: {
    totalHa: number
    forestHa: number
    byClass: Record<string, number>
  }
  districts: ForestClassDistrictExport[]
}

export interface ForestClassPublishRasterData {
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

// Row từ /history: server trả snake_case. Client tolerant cả 2 để tương thích
// snapshot cũ (formatSnapshot camelCase từ /latest vs raw row snake_case
// từ listCompleted).
export interface ForestClassHistoryItem {
  id: number | string
  year: number
  month: number
  status: string
  oob_accuracy?: number | null
  duration_ms?: number | null
  province_summary?: ForestClassProvinceSummary
  computed_at?: string | null
  published_at?: string | null
  gee_tile_url?: string | null
  gee_tile_generated_at?: string | null
  gee_download_url?: string | null
  geoserver_layer?: string | null
  district_total?: number
  district_source_count?: number
  district_geoserver_count?: number
  district_ready_count?: number
  geoserver_layers?: string[]
  totalDistricts?: number
  sourceCount?: number
  districtLayerCount?: number
  readyCount?: number
  geoserverLayers?: string[]
  error_message?: string | null
  [key: string]: any
}

export interface ForestClassHistoryData {
  items: ForestClassHistoryItem[]
}

export interface ForestClassRefreshBody {
  year?: number
  month?: number
  groundTruthAssetId?: string
  gtBufferM?: number
  minFieldTest?: number
}

export interface ForestClassRefreshData {
  run: {
    year: number
    month: number
    status: 'queued'
  }
}

export interface ForestClassHistoryParams {
  page?: number
  limit?: number
  hasGeoserverLayer?: boolean | string
}
