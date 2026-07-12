export type SatelliteSource =
  | 'sentinel1'
  | 'sentinel2'
  | 'landsat8'
  | 'landsat9'
  | 'modis'
  | 'vnredsat'
  | 'other'
  | string

export type RemoteImageType =
  | 'rgb'
  | 'multispectral'
  | 'sar'
  | 'thermal'
  | 'ndvi'
  | 'other'
  | string

export type RemoteImageStatus = 'pending' | 'processing' | 'completed' | 'failed'

export type RemoteJobType = 'full_pipeline' | 'cog_only' | 'stats_only' | 'thumbnail_only'

export interface RemoteBandStat {
  bandIndex: number
  min: number
  max: number
  mean: number
  std: number
  histogram?: number[]
}

export interface RemoteImage {
  id: number
  uuid?: string
  name: string
  description?: string
  satellite: SatelliteSource
  imageType: RemoteImageType
  acquisitionDate?: string
  bbox?: string
  provinceCode?: string
  cloudPercent?: number
  resolutionM?: number
  epsgCode?: number
  bandCount?: number
  isPublic?: boolean
  isFeatured?: boolean
  status: RemoteImageStatus
  cogUrl?: string
  thumbnailUrl?: string
  fileSize?: number
  createdBy?: number
  createdAt?: string
  updatedAt?: string
  statistics?: RemoteBandStat[]
}

export interface RemoteImageListData {
  images: RemoteImage[]
  pagination: import('./index').Pagination
}

export interface RemoteImageListParams {
  page?: number
  limit?: number
  satellite?: SatelliteSource
  image_type?: RemoteImageType
  status?: RemoteImageStatus
  is_public?: boolean
  province_code?: string
  year?: number
  date_from?: string
  date_to?: string
  bbox?: string
  keyword?: string
  sort_by?: string
  sort_order?: 'ASC' | 'DESC'
}

export interface UploadUrlParams {
  fileName: string
}

export interface UploadUrlData {
  uploadUrl: string
  expiresIn?: number
  key?: string
  headers?: Record<string, string>
}

export interface UpdateRemoteImageBody {
  name?: string
  description?: string
  cloud_percent?: number
  is_public?: boolean
  is_featured?: boolean
  status?: RemoteImageStatus
  expectedUpdatedAt: string
}

export interface CogUrlData {
  cogUrl: string
  expiresAt: string
  webgisHint?: any
}

export interface DownloadUrlParams {
  fileId?: number | string
}

export interface DownloadUrlData {
  url: string
  expiresAt?: string
}

export interface StartProcessingBody {
  job_type: RemoteJobType
  priority?: number
}

export interface PublicRemoteLayer {
  id: number
  name: string
  satellite: SatelliteSource
  imageType: RemoteImageType
  cogUrl: string
  thumbnailUrl?: string
  bbox?: string
  expiresAt?: string
}

export interface PublicRemoteLayersParams {
  satellite?: SatelliteSource
  image_type?: RemoteImageType
  province_code?: string
  bbox?: string
  limit?: number
}
