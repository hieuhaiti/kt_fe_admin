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

export interface DashboardStats {
  totals?: Record<string, number>
  landcover?: LandcoverStat[]
  fireRisk?: any
  updatedAt?: string
  [key: string]: any
}

export interface ForestChangeItem {
  unitCode?: string
  unitName?: string
  fromYear: number
  toYear: number
  forestType: ForestType
  areaFromHa: number
  areaToHa: number
  deltaHa: number
  deltaPct: number
  trend: 'up' | 'down' | 'flat'
}

export interface ResidentialDistanceFeatureCollection {
  type: 'FeatureCollection'
  features: any[]
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

export interface ForestChangeParams {
  from_year: number
  to_year: number
  forest_type?: ForestType
  unit_code?: string
}

export interface ResidentialDistanceParams {
  residential_code: string
  forest_code: string
  threshold_m?: number
  limit?: number
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
