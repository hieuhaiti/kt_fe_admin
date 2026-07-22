/** Response từ GET /fire-risk/latest — trùng shape với fire-risk.controller#getLatest. */
export interface FireRiskProvinceSummary {
  maxLevel?: number
  avgRiskLevel?: number | null
  riskLevelDist?: Record<'0' | '1' | '2' | '3' | '4' | '5', number>
  blendCaseHa?: { withInput: number; withoutInput: number }
  confidenceHa?: { none: number; low: number; medium: number; high: number }
  pNesterovProvMean?: number
  s2CoverageRatio?: number
  [key: string]: any
}

export interface FireRiskPNesterovStats {
  mean?: number
  max?: number
  p10?: number
  p50?: number
  p90?: number
  levelBreaks?: { p1: number; p2: number; p3: number; p4: number }
}

/** Feature từ repo.getFeatures — 1 row/district/level, có geometry polygon. */
export interface FireRiskFeature {
  id: number
  risk_level: 1 | 2 | 3 | 4 | 5
  district_code: string | null
  district_name: string | null
  area_ha: string | number
  p_nesterov_mean: string | number | null
  ndvi_mean: string | number | null
  geometry: any | null
  properties?: Record<string, any>
}

export interface FireRiskDistrictStat {
  name: string
  unitCode: number | string
  s2Coverage?: number
  pNesterovMean?: number
  /** Centroid WGS84 sau reproject GEE. Server strip trước khi trả /latest. */
  centroid?: { lat: number; lng: number }
  /** GEE reduceRegions xuất level 0-5 (0 = thiếu ảnh). Server persist tất cả. */
  riskLevelDist?: Record<'0' | '1' | '2' | '3' | '4' | '5', number>
  blendCaseHa?: { withInput: number; withoutInput: number }
  confidenceHa?: { none: number; low: number; medium: number; high: number }
  /** @deprecated Field cũ trước v4 refactor — snapshot mới không có nữa. */
  totalForestHa?: number
}

export interface FireRiskSnapshot {
  id: number | string
  analysisDate: string
  status: string
  provinceSummary?: FireRiskProvinceSummary
  pNesterovStats?: FireRiskPNesterovStats
  districtStats?: FireRiskDistrictStat[]
  s2CoverageRatio?: number | string
  geoserverLayer?: string | null
  geeTileUrl?: string | null
  geeMapId?: string | null
  geeTileGeneratedAt?: string | null
  /** GeoTIFF ZIP URL clip theo RanhGioiTinh_Polygon, sinh bởi GEE
   *  `image.getDownloadURL()` ở cuối `runAnalysis`. TTL ~24h. */
  geeDownloadUrl?: string | null
  computedAt?: string
  publishedAt?: string | null
}

export interface FireRiskRiskLevelViz {
  bands: string[]
  min: number
  max: number
  palette: string[]
}

export interface FireRiskLatestData {
  snapshot: FireRiskSnapshot
  features: FireRiskFeature[]
  geeTileUrl?: string | null
  geeMapId?: string | null
  riskLevelViz?: FireRiskRiskLevelViz
  stale?: boolean
  computing?: boolean
}

export interface FireRiskMapParams {
  minRiskLevel?: number
}

export interface FireRiskMapData {
  type: 'FeatureCollection'
  features: any[]
  analysisDate?: string
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
  geoserver_layer?: string | null
  createdAt?: string
  [key: string]: any
}

export interface FireRiskHistoryData {
  items: FireRiskHistoryItem[]
  pagination: import('./index').Pagination
}

export interface FireRiskRefreshBody {
  analysisDate?: string
  submitExport?: boolean
}

export interface FireRiskHistoryParams {
  page?: number
  limit?: number
}
