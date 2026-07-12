export interface ForestClassLatestData {
  year: number
  month: number
  tileUrl?: string
  tileUrlTemplate?: string
  legend?: Array<{ code: string; label: string; color: string; areaHa?: number }>
  bbox?: [number, number, number, number]
  updatedAt?: string
  [key: string]: any
}

export interface ForestClassHistoryItem {
  id: number
  year: number
  month: number
  status: string
  createdAt?: string
  [key: string]: any
}

export interface ForestClassHistoryData {
  items: ForestClassHistoryItem[]
  pagination: import('./index').Pagination
}

export interface ForestClassRefreshBody {
  year: number
  month: number
}

export interface ForestClassHistoryParams {
  page?: number
  limit?: number
}
