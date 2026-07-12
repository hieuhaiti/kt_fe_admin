import apiClient from './common/apiClient'
import type {
  ApiResponse,
  RemoteImage,
  RemoteImageListData,
  RemoteImageListParams,
  UploadUrlParams,
  UploadUrlData,
  UpdateRemoteImageBody,
  CogUrlData,
  DownloadUrlParams,
  DownloadUrlData,
  StartProcessingBody,
  PublicRemoteLayer,
  PublicRemoteLayersParams,
  RemoteBandStat,
} from '@/types/api'
import { serviceRemoteSensingPath } from '@/constant/serviceConstant'

export default {
  /**
   * POST /remote-sensing/images (multipart)
   * body: raster_file, thumbnail_file?, name, description, satellite, image_type,
   *       acquisition_date, bbox, province_code, cloud_percent, resolution_m,
   *       epsg_code, band_count, is_public
   */
  createImage: (data: FormData) =>
    apiClient.post<RemoteImage>(`${serviceRemoteSensingPath}/images`, data, true),

  /** GET /remote-sensing/upload-url?fileName= */
  getUploadUrl: (params: UploadUrlParams) =>
    apiClient.get<UploadUrlData>(`${serviceRemoteSensingPath}/upload-url`, { params }),

  /** GET /remote-sensing/images */
  listImages: (params?: RemoteImageListParams) =>
    apiClient.get<RemoteImageListData>(`${serviceRemoteSensingPath}/images`, { params }),

  /** GET /remote-sensing/images/:remoteImageId (id or uuid) */
  getImage: (remoteImageId: number | string) =>
    apiClient.get<RemoteImage>(`${serviceRemoteSensingPath}/images/${remoteImageId}`),

  /** PATCH /remote-sensing/images/:remoteImageId */
  updateImage: (remoteImageId: number | string, data: UpdateRemoteImageBody) =>
    apiClient.patch<RemoteImage>(
      `${serviceRemoteSensingPath}/images/${remoteImageId}`,
      data
    ),

  /** GET /remote-sensing/images/:remoteImageId/cog-url */
  getCogUrl: (remoteImageId: number | string) =>
    apiClient.get<CogUrlData>(
      `${serviceRemoteSensingPath}/images/${remoteImageId}/cog-url`
    ),

  /** GET /remote-sensing/images/:remoteImageId/download?fileId= */
  getDownloadUrl: (remoteImageId: number | string, params?: DownloadUrlParams) =>
    apiClient.get<DownloadUrlData>(
      `${serviceRemoteSensingPath}/images/${remoteImageId}/download`,
      { params }
    ),

  /** GET /remote-sensing/images/:remoteImageId/statistics */
  getStatistics: (remoteImageId: number | string) =>
    apiClient.get<{ statistics: RemoteBandStat[] }>(
      `${serviceRemoteSensingPath}/images/${remoteImageId}/statistics`
    ),

  /** POST /remote-sensing/images/:remoteImageId/process */
  startProcessing: (remoteImageId: number | string, data: StartProcessingBody) =>
    apiClient.post<{ jobId: string }>(
      `${serviceRemoteSensingPath}/images/${remoteImageId}/process`,
      data
    ),

  /** GET /remote-sensing/layers (public, completed + is_public) */
  listPublicLayers: (params?: PublicRemoteLayersParams) =>
    apiClient.get<{ layers: PublicRemoteLayer[] }>(
      `${serviceRemoteSensingPath}/layers`,
      { params }
    ),

  /** DELETE /remote-sensing/images/:remoteImageId?hardDelete= */
  deleteImage: (remoteImageId: number | string, hardDelete = false) =>
    apiClient.del<ApiResponse<{}>>(
      `${serviceRemoteSensingPath}/images/${remoteImageId}`,
      undefined,
      { params: { hardDelete } }
    ),
}
