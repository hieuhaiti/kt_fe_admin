export interface FireRiskProvinceSummary {
  provinceCode?: string
  provinceName?: string
  avgRiskLevel?: number
  maxRiskLevel?: number
  areaHa?: number
  analysisDate?: string
  [key: string]: any
}

export interface FireRiskDistrictStat {
  districtCode: string
  districtName: string
  avgRiskLevel: number
  maxRiskLevel: number
  areaHa: number
  [key: string]: any
}

export interface FireRiskPNesterovStat {
  index: number
  category: string
  areaHa: number
  [key: string]: any
}

export interface FireRiskLatestData {
  provinceSummary: FireRiskProvinceSummary
  districtStats: FireRiskDistrictStat[]
  pNesterovStats: FireRiskPNesterovStat[]
  features: any[]
  stale?: boolean
  analysisDate?: string
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
  id: number
  analysisDate: string
  status: string
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
