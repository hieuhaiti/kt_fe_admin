export interface ApiResponse<T = any> {
  message: string
  status: number
  data?: T
  /** Server sends pagination via top-level `metadata` for list endpoints */
  metadata?: Pagination | Record<string, any>
  errors?: string[]
  options?: Record<string, any>
}

export interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
  hasMore?: boolean
}

// Core
export type * from './authen'
export type * from './user'
export type * from './notification'

// Content
export type * from './news'
export type * from './newsComment'
export type * from './document'
export type * from './citizenFeedback'

// Map + GIS
export type * from './mapImage'
export type * from './mapLayer'
export type * from './mapLayerApi'
export type * from './apiKey'

// GEE / satellite / weather / fire risk / mobile
export type * from './weather'
export type * from './remoteSensing'
export type * from './fireRisk'
export type * from './satellite'
export type * from './forestClassification'
export type * from './mobile'

// Stats / spatial
export type * from './statistics'

// Legacy / kept as-is
export type * from './search'
export type * from './cronAlert'
