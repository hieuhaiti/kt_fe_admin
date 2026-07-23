export interface MapApiScope {
  read?: boolean
  rate_per_min?: number
  bbox_limit?: number
  [key: string]: any
}

export interface MapApi {
  id: number
  name: string
  description?: string
  layer_id?: number
  layer_code?: string
  scope?: MapApiScope
  key_prefix?: string
  key_last4?: string
  is_active?: boolean
  expires_at?: string | null
  last_used_at?: string | null
  request_count?: number
  created_by?: number
  createdAt?: string
  updatedAt?: string
  layer_name_vi?: string

  slug?: string
  endpoint_url?: string
  http_method?: string
  status?: string
  published_at?: string
  created_at?: string
  updated_at?: string
}

/** Legacy alias */
export type MapLayerApi = MapApi

export interface MapApiListData {
  items?: MapApi[]
  apis: MapApi[]
  pagination?: import('./index').Pagination
}

/** Legacy alias */
export type MapLayerApiListData = MapApiListData

export interface MapApiListParams {
  page?: number
  limit?: number
  q?: string
  is_active?: boolean
  layer_id?: number

  status?: string
  sortBy?: string
  sortOrder?: 'ASC' | 'DESC'
}

export type MapLayerApiListParams = MapApiListParams

export interface CreateMapApiBody {
  name: string
  layer_id: number
  description?: string
  scope?: MapApiScope
  is_active?: boolean
  expires_at?: string | null
}

export interface UpdateMapApiBody {
  name?: string
  description?: string
  scope?: MapApiScope
  is_active?: boolean
  expires_at?: string | null
}

/** Legacy aliases so old import paths keep compiling. */
export type CreateMapLayerApiBody = CreateMapApiBody
export type UpdateMapLayerApiBody = UpdateMapApiBody

/** Response of POST /map-apis and /map-apis/:id/regenerate — raw key returned once. */
export interface MapApiKeyIssueData {
  api: MapApi
  apiKey?: string
  raw_key?: string
}

/** Consumer-side (/map-data/*) — used from citizen apps */
export interface MapDataFeaturesQuery {
  bbox?: string
  limit?: number
  offset?: number
}

export interface MapDataFeaturesResponse {
  type: 'FeatureCollection'
  features: any[]
  total: number
  returned: number
  hasMore: boolean
}
