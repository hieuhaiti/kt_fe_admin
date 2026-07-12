import apiClient from '@/service/common/apiClient'
import { serviceMapApiPath, serviceMapDataPath } from '@/constant/serviceConstant'
import type {
  ApiResponse,
  ApiKey,
  ApiKeyListData,
  ApiKeyListParams,
  CreateApiKeyBody,
  CreateApiKeyResponseData,
  MapApi,
  MapApiListData,
  MapApiListParams,
  CreateMapApiBody,
  UpdateMapApiBody,
  MapApiKeyIssueData,
  MapDataFeaturesQuery,
  MapDataFeaturesResponse,
  PublicMapLayerApiData,
} from '@/types/api'

const mapApiService = {
  // ── Admin CRUD ──

  /** GET /map-apis */
  getAll: (params?: MapApiListParams) =>
    apiClient.get<MapApiListData>(serviceMapApiPath, { params }),

  /** GET /map-apis/:mapApiId */
  getById: (mapApiId: number | string) =>
    apiClient.get<MapApi>(`${serviceMapApiPath}/${mapApiId}`),

  /** POST /map-apis — returns raw_key ONCE */
  create: (data: CreateMapApiBody) =>
    apiClient.post<MapApiKeyIssueData>(serviceMapApiPath, data),

  /** PATCH /map-apis/:mapApiId */
  update: (mapApiId: number | string, data: UpdateMapApiBody) =>
    apiClient.patch<MapApi>(`${serviceMapApiPath}/${mapApiId}`, data),

  /** POST /map-apis/:mapApiId/regenerate — returns new raw_key ONCE */
  regenerate: (mapApiId: number | string) =>
    apiClient.post<MapApiKeyIssueData>(`${serviceMapApiPath}/${mapApiId}/regenerate`),

  /** PATCH /map-apis/:mapApiId/revoke */
  revoke: (mapApiId: number | string) =>
    apiClient.patch<MapApi>(`${serviceMapApiPath}/${mapApiId}/revoke`),

  /** DELETE /map-apis/:mapApiId */
  delete: (mapApiId: number | string) =>
    apiClient.del<ApiResponse<{}>>(`${serviceMapApiPath}/${mapApiId}`),

  // ── Consumer (/map-data — needs X-Map-Api-Key header) ──

  /** GET /map-data/layer */
  getConsumerLayer: (rawKey: string) =>
    apiClient.get<MapApi>(`${serviceMapDataPath}/layer`, { mapApiKey: rawKey }),

  /** GET /map-data/features?bbox=&limit=&offset= */
  getConsumerFeatures: (rawKey: string, query?: MapDataFeaturesQuery) =>
    apiClient.get<MapDataFeaturesResponse>(`${serviceMapDataPath}/features`, {
      mapApiKey: rawKey,
      params: query,
    }),

  // ── Legacy shims (kept so existing pages don't crash) ──

  /** Legacy public slug tester — Postman no longer exposes this; return no-op. */
  getBySlugWithKey: (slug: string, apikey: string) =>
    apiClient.get<PublicMapLayerApiData>(`${serviceMapApiPath}/${slug}`, {
      params: { apikey },
    }),

  /** Legacy permission endpoints — not in Postman. Return empty lists. */
  getPermissions: (_apiId: number | string) =>
    Promise.resolve({ message: '', status: 200, data: [] } as ApiResponse<any[]>),
  addPermission: (_apiId: number | string, _data: any) =>
    Promise.resolve({ message: '', status: 200, data: null } as ApiResponse<null>),
  deletePermission: (_apiId: number | string, _permissionId: number | string) =>
    Promise.resolve({ message: '', status: 200, data: null } as ApiResponse<null>),

  /** Legacy shares endpoints — removed */
  getShares: (_apiId: number | string) =>
    Promise.resolve({ message: '', status: 200, data: [] } as ApiResponse<any[]>),
  createShare: (_apiId: number | string, _data: any) =>
    Promise.resolve({ message: '', status: 200, data: null } as ApiResponse<null>),
  deleteShare: (_apiId: number | string, _shareId: number | string) =>
    Promise.resolve({ message: '', status: 200, data: null } as ApiResponse<null>),

  /**
   * Legacy /api-keys endpoints — Postman merged them into /map-apis.
   * These aliases forward to /map-apis.
   */
  getApiKeys: (params?: ApiKeyListParams) =>
    apiClient.get<ApiKeyListData | ApiKey[]>(serviceMapApiPath, { params }),
  getApiKeyById: (id: number | string) =>
    apiClient.get<ApiKey>(`${serviceMapApiPath}/${id}`),
  createApiKey: (data: CreateApiKeyBody) =>
    apiClient.post<CreateApiKeyResponseData>(serviceMapApiPath, data),
  revokeApiKey: (apiKeyId: number | string) =>
    apiClient.patch<ApiKey>(`${serviceMapApiPath}/${apiKeyId}/revoke`),
  deleteApiKey: (apiKeyId: number | string) =>
    apiClient.del<ApiResponse<{}>>(`${serviceMapApiPath}/${apiKeyId}`),

  // Backward-compatible aliases
  getShareKeys: (params?: ApiKeyListParams) =>
    apiClient.get<ApiKeyListData | ApiKey[]>(serviceMapApiPath, { params }),
  createShareKey: (data: CreateApiKeyBody) =>
    apiClient.post<CreateApiKeyResponseData>(serviceMapApiPath, data),
  revokeShareKey: (apiKeyId: number | string) =>
    apiClient.patch<ApiKey>(`${serviceMapApiPath}/${apiKeyId}/revoke`),
}

export default mapApiService
