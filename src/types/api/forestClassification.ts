// Types cho forest-classification API. Mirror shape từ
// server/src/controllers/forest-classification.controller.js formatSnapshot().
//
// province_summary structure (từ pipeline):
//   - byClass: { [classId: 0..10]: haNumber }
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
  status: string                       // pending | computing | completed | failed | published
  trigger?: string                     // cron | manual | user
  provinceSummary?: ForestClassProvinceSummary
  oobAccuracy?: number | null
  testAccuracy?: number | null
  testKappa?: number | null
  sampleQuotas?: any
  modelParams?: any
  durationMs?: number | null
  geoserverLayer?: string | null
  geeTileUrl?: string | null
  geeMapId?: string | null
  geeTileGeneratedAt?: string | null
  geeDownloadUrl?: string | null
  geoserverDownloadUrl?: string | null
  downloadFilename?: string | null
  computedAt?: string | null
  publishedAt?: string | null
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

export interface ForestClassLatestData {
  snapshot: ForestClassSnapshot | null
  districtAreas: ForestClassDistrictArea[]
  geeTileUrl?: string | null
  geeMapId?: string | null
  classifiedViz?: any
  stale?: boolean
  computing?: boolean
}

// Row từ /history: server trả snake_case. Client tolerant cả 2 để tương thích
// snapshot cũ (formatSnapshot camelCase từ /latest vs raw row snake_case
// từ listCompleted).
export interface ForestClassHistoryItem {
  id: number
  year: number
  month: number
  status: string
  trigger?: string
  oob_accuracy?: number | null
  duration_ms?: number | null
  province_summary?: ForestClassProvinceSummary
  computed_at?: string | null
  published_at?: string | null
  created_at?: string | null
  gee_tile_url?: string | null
  gee_tile_generated_at?: string | null
  gee_download_url?: string | null
  geoserver_layer?: string | null
  geoserver_store?: string | null
  minio_key?: string | null
  error_message?: string | null
  [key: string]: any
}

export interface ForestClassHistoryData {
  items: ForestClassHistoryItem[]
  pagination?: import('./index').Pagination
}

export interface ForestClassRefreshBody {
  year?: number
  month?: number
  groundTruthAssetId?: string
  gtBufferM?: number
  minFieldTest?: number
}

export interface ForestClassHistoryParams {
  page?: number
  limit?: number
  hasGeoserverLayer?: boolean | string
}
