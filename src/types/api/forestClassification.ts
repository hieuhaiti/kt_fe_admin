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
  status: string // pending | computing | completed | failed | published
  provinceSummary?: ForestClassProvinceSummary
  oobAccuracy?: number | null
  testKappa?: number | null
  geoserverLayer?: string | null
  geeTileUrl?: string | null
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

// Row từ /history: server trả snake_case. Client tolerant cả 2 để tương thích
// snapshot cũ (formatSnapshot camelCase từ /latest vs raw row snake_case
// từ listCompleted).
export interface ForestClassHistoryItem {
  id: number
  year: number
  month: number
  status: string
  oob_accuracy?: number | null
  duration_ms?: number | null
  province_summary?: ForestClassProvinceSummary
  computed_at?: string | null
  published_at?: string | null
  gee_tile_url?: string | null
  gee_download_url?: string | null
  geoserver_layer?: string | null
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
