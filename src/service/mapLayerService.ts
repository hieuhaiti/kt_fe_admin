import apiClient from './common/apiClient'
import type {
  ApiResponse,
  MapLayer,
  MapLayerListData,
  MapLayerListParams,
  CreateMapLayerBody,
  PatchMapLayerBody,
  PatchMapLayerActiveBody,
  ImportGeoJsonInlineBody,
  ImportJob,
  HarvestRasterBody,
} from '@/types/api'
import {
  serviceMapLayerPath,
  serviceMapImportJobPath,
  serviceMapRasterHarvestPath,
} from '@/constant/serviceConstant'

export default {
  /** GET /map/layers */
  getAll: (params?: MapLayerListParams) =>
    apiClient.get<MapLayerListData>(serviceMapLayerPath, { params }),

  /** GET /map/layers/:mapLayerCode */
  getByCode: (mapLayerCode: string) =>
    apiClient.get<MapLayer>(`${serviceMapLayerPath}/${mapLayerCode}`),

  /** Legacy: numeric id lookup no longer exists — falls back to code */
  getById: (idOrCode: number | string) =>
    apiClient.get<MapLayer>(`${serviceMapLayerPath}/${idOrCode}`),

  /** POST /map/layers */
  create: (data: CreateMapLayerBody) => apiClient.post<MapLayer>(serviceMapLayerPath, data),

  /** PATCH /map/layers/:mapLayerCode */
  patch: (mapLayerCode: string, data: PatchMapLayerBody) =>
    apiClient.patch<MapLayer>(`${serviceMapLayerPath}/${mapLayerCode}`, data),

  /** Legacy alias */
  update: (mapLayerCode: string, data: PatchMapLayerBody) =>
    apiClient.patch<MapLayer>(`${serviceMapLayerPath}/${mapLayerCode}`, data),

  /** DELETE /map/layers/:mapLayerCode */
  delete: (mapLayerCode: string) =>
    apiClient.del<ApiResponse<{}>>(`${serviceMapLayerPath}/${mapLayerCode}`),

  /** POST /map/layers/:mapLayerCode/publish */
  publish: (mapLayerCode: string) =>
    apiClient.post<ApiResponse<{}>>(`${serviceMapLayerPath}/${mapLayerCode}/publish`),

  /** DELETE /map/layers/:mapLayerCode/publish */
  unpublish: (mapLayerCode: string) =>
    apiClient.del<ApiResponse<{}>>(`${serviceMapLayerPath}/${mapLayerCode}/publish`),

  /** PATCH /map/layers/:mapLayerCode/active */
  setActive: (mapLayerCode: string, data: PatchMapLayerActiveBody) =>
    apiClient.patch<MapLayer>(`${serviceMapLayerPath}/${mapLayerCode}/active`, data),

  /**
   * Legacy toggle-status: server no longer supports toggle; caller must send
   * the desired boolean via `setActive` instead. We keep this signature for
   * pages not yet migrated — it flips based on the current known layer.
   */
  toggleStatus: (mapLayerCode: string, currentActive?: boolean) =>
    apiClient.patch<MapLayer>(`${serviceMapLayerPath}/${mapLayerCode}/active`, {
      is_active: !currentActive,
    }),

  /**
   * POST /map/layers/import-file  (multipart, async — returns 202 + job_id)
   * body: file, code, name_vi, source_format, import_mode, srid_input,
   *       source_layer_name, category, layer_kind, is_public, auto_publish
   */
  importFile: (data: FormData) =>
    apiClient.post<{ jobId: string }>(`${serviceMapLayerPath}/import-file`, data, true),

  /** POST /map/layers/:mapLayerCode/import  (sync GeoJSON import) */
  importInline: (mapLayerCode: string, data: ImportGeoJsonInlineBody) =>
    apiClient.post<MapLayer>(`${serviceMapLayerPath}/${mapLayerCode}/import`, data),

  /** GET /map/layers/:mapLayerCode/import-jobs */
  listImportJobs: (mapLayerCode: string) =>
    apiClient.get<{ jobs: ImportJob[] }>(`${serviceMapLayerPath}/${mapLayerCode}/import-jobs`),

  /** GET /map/import-jobs/:importJobId */
  getImportJob: (importJobId: string) =>
    apiClient.get<ImportJob>(`${serviceMapImportJobPath}/${importJobId}`),

  /** POST /map/rasters/:coverageStore/harvest */
  harvestRaster: (coverageStore: string, data: HarvestRasterBody) =>
    apiClient.post<ApiResponse<{}>>(
      `${serviceMapRasterHarvestPath}/${coverageStore}/harvest`,
      data
    ),

  // ── Legacy shims ──

  /**
   * Legacy /map-layers/import-geojson multipart flow. New API only accepts
   * inline JSON via `POST /map/layers/:code/import`. This shim requires the
   * caller to have `mapLayerCode` in FormData under `code`.
   */
  importGeoJson: (data: FormData) =>
    apiClient.post<{ jobId: string }>(`${serviceMapLayerPath}/import-file`, data, true),

  /** Legacy Excel import — server no longer supports Excel; use import-file */
  importExcel: (data: FormData) =>
    apiClient.post<{ jobId: string }>(`${serviceMapLayerPath}/import-file`, data, true),

  /** Legacy category-based queries — not in Postman. Kept as no-op empty result. */
  getByCategory: (_categoryId: number) =>
    Promise.resolve({ message: '', status: 200, data: [] as MapLayer[] } as ApiResponse<MapLayer[]>),

  /** Legacy category toggle — not in Postman. Kept as no-op. */
  toggleStatusByCategory: (_categoryId: number) =>
    Promise.resolve({ message: '', status: 200, data: {} } as ApiResponse<{}>),

  /**
   * Legacy calculate-lost-area — not in Postman. Kept as a stub that throws so
   * callers surface the missing endpoint rather than silently succeeding.
   */
  calculateLostArea: (_data: any): Promise<ApiResponse<any>> =>
    Promise.reject(
      new Error('calculateLostArea không còn được backend hỗ trợ theo Postman v2')
    ),
}
