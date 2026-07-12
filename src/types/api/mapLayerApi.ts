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
  is_active?: boolean
  layer_id?: number

  status?: string
  search?: string
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

/** Legacy: public map layer api metadata for /public tester page */
export interface PublicMapLayerApiData {
  id: number
  name: string
  slug: string
  description?: string
  endpoint_url: string
  http_method: string
  status: string
}

/** Legacy permission types kept for pages */
export type PrincipalType = 'user' | 'role' | 'public'
export type PermissionLevel = 'view' | 'edit' | 'manage'
export type ApiStatus = 'draft' | 'published'
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface ApiPermission {
  id: number
  map_layer_api_id: number
  principal_type: PrincipalType
  user_id?: number | null
  role_id?: number | null
  can_view: boolean
  can_edit: boolean
  can_delete: boolean
  can_share: boolean
  created_at: string
}

export interface AddPermissionBody {
  principal_type: PrincipalType
  user_id?: number | null
  role_id?: number | null
  can_view?: boolean
  can_edit?: boolean
  can_delete?: boolean
  can_share?: boolean
}

export interface ApiShare {
  id: number
  map_layer_api_id: number
  shared_with_type: PrincipalType
  shared_with_user_id?: number | null
  shared_with_role_id?: number | null
  permission_level: PermissionLevel
  expires_at?: string
  created_at: string
}

export interface CreateShareBody {
  shared_with_type: PrincipalType
  shared_with_user_id?: number | null
  shared_with_role_id?: number | null
  permission_level?: PermissionLevel
  expires_at?: string
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
