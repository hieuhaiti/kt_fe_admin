export type AdminUnitLevel = 'province' | 'district' | 'commune'
export type ForestType = 'total' | 'natural' | 'planted' | 'non_forest'

export interface AdministrativeUnit {
  code: string
  name: string
  level: AdminUnitLevel
  parentCode?: string | null
  geometry?: any
  [key: string]: any
}

export interface LandcoverStat {
  unitCode?: string
  unitName?: string
  name?: string
  nameEn?: string
  year?: number
  forestType?: ForestType
  areaKm2?: number | null
  population?: number | null
  forestAreaHa?: number | null
  areaHa?: number | null
  coveragePct?: number | null
  changePct?: number | null
  [key: string]: any
}

export interface DashboardDistrictCoverage {
  name: string
  unitCode: string
  coveragePct: number
  forestAreaHa?: number
}

export interface DashboardForestBlock {
  totalForestHa?: number
  naturalForestHa?: number
  plantedForestHa?: number
  provinceCoveragePct?: number
  lowCoverageDistricts?: DashboardDistrictCoverage[]
  topCoverageDistricts?: DashboardDistrictCoverage[]
  districts?: DashboardDistrictCoverage[]
}

export interface DashboardFeedbackBlock {
  total?: number
  byStatus?: Record<string, number>
}

export interface DashboardFireRiskBlock {
  available?: boolean
  note?: string
  snapshotId?: number | string
  analysisDate?: string
  avgLevel?: number | null
  minLevel?: number | null
  maxLevel?: number | null
  riskLevelDist?: Record<string, number>
  s2CoverageRatio?: number | null
  hotspotDistrictCount?: number
  hotspotMinLevel?: number
  geoserverLayer?: string | null
  geeDownloadUrl?: string | null
  publishedAt?: string | null
}

export interface DashboardForestClassificationBlock {
  available?: boolean
  note?: string
  snapshotId?: number | string
  year?: number
  month?: number
  status?: string
  totalAreaHa?: number | null
  forestAreaHa?: number | null
  forestCoveragePct?: number | null
  byClass?: Record<string, number>
  dominantClassId?: number | null
  dominantClassName?: string | null
  dominantClassAreaHa?: number | null
  oobAccuracy?: number | null
  testAccuracy?: number | null
  testKappa?: number | null
  s2ImageCount?: number | null
  landsatImageCount?: number | null
  geoserverLayer?: string | null
  geeDownloadUrl?: string | null
  computedAt?: string | null
  publishedAt?: string | null
  comparison?: {
    previousSnapshotId: number | string
    previousYear: number
    previousMonth: number
    forestDeltaHa?: number | null
    forestChangePct?: number | null
  } | null
}

export interface DashboardStats {
  scope?: 'executive' | 'operational'
  year?: number
  forest?: DashboardForestBlock
  feedback?: DashboardFeedbackBlock
  fireAlerts?: DashboardFireRiskBlock
  forestClassification?: DashboardForestClassificationBlock
  cached?: boolean
  computedAt?: string
}

// ── Params ──
export interface AdminUnitParams {
  level: AdminUnitLevel
}

export interface LandcoverParams {
  year?: number
  forest_type?: ForestType
  by?: 'district' | 'commune' | 'province'
  from?: number
  to?: number
}

export interface DashboardParams {
  force?: boolean
}

// ── Legacy (kept for pages not yet migrated) ──
export interface BorderStationCommune {
  id: number
  name: string
  district_id?: number
}

export interface BorderStation {
  id: number
  name: string
  latitude: number
  longitude: number
  commune?: BorderStationCommune
  [key: string]: any
}

export interface BorderStationWithDistance extends BorderStation {
  distance_meters: number
}

export interface BorderStationsByDistrictData {
  items: BorderStation[]
  total: number
}

export interface BorderStationsByRadiusData {
  items: BorderStationWithDistance[]
  total: number
}
