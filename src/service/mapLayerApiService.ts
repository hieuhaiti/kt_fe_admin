import apiClient from '@/service/common/apiClient'
import { serviceMapApiPath, serviceMapDataPath } from '@/constant/serviceConstant'
import type {
  ApiResponse,
  MapApi,
  MapApiListData,
  MapApiListParams,
  CreateMapApiBody,
  UpdateMapApiBody,
  MapApiKeyIssueData,
  MapDataFeaturesQuery,
  MapDataFeaturesResponse,
} from '@/types/api'

const mapApiService = {
  // ── Admin CRUD ──

  /** GET /map-apis */
  getAll: (params?: MapApiListParams) =>
    apiClient.get<MapApiListData>(serviceMapApiPath, { params }),

  /** GET /map-apis/:mapApiId */
  getById: (mapApiId: number | string) => apiClient.get<MapApi>(`${serviceMapApiPath}/${mapApiId}`),

  /** POST /map-apis — returns raw_key ONCE */
  create: (data: CreateMapApiBody) => apiClient.post<MapApiKeyIssueData>(serviceMapApiPath, data),

  /** PATCH /map-apis/:mapApiId */
  update: (mapApiId: number | string, data: UpdateMapApiBody) =>
    apiClient.patch<MapApi>(`${serviceMapApiPath}/${mapApiId}`, data),

  /** POST /map-apis/:mapApiId/regenerate — returns new raw_key ONCE */
  regenerate: (mapApiId: number | string) =>
    apiClient.post<MapApiKeyIssueData>(`${serviceMapApiPath}/${mapApiId}/regenerate`),

  /** PATCH /map-apis/:mapApiId body: { is_active: false } */
  revoke: (mapApiId: number | string) =>
    apiClient.patch<MapApi>(`${serviceMapApiPath}/${mapApiId}`, { is_active: false }),

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

}

export default mapApiService
