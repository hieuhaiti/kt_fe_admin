/**
 * Postman no longer separates "api keys" from map-apis — each POST /map-apis
 * response yields a single raw key, and regenerate produces a new raw key.
 * Types kept as aliases for legacy pages/dialogs.
 */
import type { MapApi, MapApiKeyIssueData } from './mapLayerApi'

export type ApiKeyStatus = 'active' | 'revoked' | 'expired'

export type ApiKey = MapApi & {
  masked_key?: string
  key_masked?: string
  api_key?: string
  plain_key?: string
  map_layer_api_ids?: number[]
  status?: ApiKeyStatus
}

export interface ApiKeyListData {
  api_keys?: ApiKey[]
  items?: ApiKey[]
  keys?: ApiKey[]
  apis?: ApiKey[]
  pagination?: import('./index').Pagination
}

export interface CreateApiKeyBody {
  name: string
  layer_id?: number
  scope?: {
    read?: boolean
    rate_per_min?: number
    bbox_limit?: number
    [key: string]: any
  }
  is_active?: boolean
  expires_at?: string | null

  // legacy field for pages built against old model
  map_layer_api_ids?: number[]
}

export interface ApiKeyListParams {
  page?: number
  limit?: number
  q?: string
  is_active?: boolean
  layer_id?: number

  // legacy
  status?: ApiKeyStatus
}

export type CreateApiKeyResponseData = MapApiKeyIssueData

// Backward-compatible aliases
export type ShareKey = ApiKey
export type ShareKeyListData = ApiKeyListData
export type CreateShareKeyBody = CreateApiKeyBody
