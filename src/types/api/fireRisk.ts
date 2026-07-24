/** Response từ GET /fire-risk/latest — trùng shape với fire-risk.controller#getLatest. */
export interface FireRiskProvinceSummary {
  maxLevel?: number
  avgRiskLevel?: number | null
  riskLevelDist?: Record<'0' | '1' | '2' | '3' | '4' | '5', number>
  s2CoverageRatio?: number
  [key: string]: any
}

/** Feature từ repo.getFeatures — 1 row/district/level, có geometry polygon. */
export interface FireRiskFeature {
  id: number
  risk_level: 1 | 2 | 3 | 4 | 5
  district_code: string | null
  district_name: string | null
  area_ha: string | number
  geometry: any | null
  properties?: Record<string, any>
}

export interface FireRiskDistrictStat {
  name: string
  unitCode: number | string
  s2Coverage?: number
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
  /** GeoTIFF ZIP URL clip theo RanhGioiTinh_Polygon, sinh bởi GEE
   *  `image.getDownloadURL()` ở cuối `runAnalysis`. TTL ~24h. */
  geeDownloadUrl?: string | null
}

export interface FireRiskLatestData {
  snapshot: FireRiskSnapshot
  features: FireRiskFeature[]
  stale?: boolean
  computing?: boolean
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
  gee_download_url?: string | null
  geoserver_layer?: string | null
  error_message?: string | null
  [key: string]: any
}

export interface FireRiskHistoryData {
  items: FireRiskHistoryItem[]
  pagination: import('./index').Pagination
}

export interface FireRiskRefreshBody {
  analysisDate?: string
  submitExport?: boolean
  enableRf?: boolean
  inputFireAssetId?: string
}

export interface FireRiskHistoryParams {
  page?: number
  limit?: number
  hasGeoserverLayer?: boolean | string
}
