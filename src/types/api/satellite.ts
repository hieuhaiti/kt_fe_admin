export interface SatelliteBaseBody {
  startDate: string
  endDate: string
  cloudCover?: number
}

export interface SatelliteRgbBody extends SatelliteBaseBody {}

export interface SatelliteNdviBody extends SatelliteBaseBody {
  ndviMinThresh?: number
}

export interface SatelliteHeatMapBody {
  startDate: string
  endDate: string
}

export interface SatelliteClassifiedBody extends SatelliteBaseBody {
  /** Tháng neo mô hình (1-12); bỏ trống để dùng tháng của endDate. */
  month?: number
}

export interface SatelliteAreaStats {
  className?: string
  areaHa: number
  areaPct?: number
  color?: string
  [key: string]: any
}

export interface SatelliteResponse {
  resultId?: number
  tileUrl?: string
  tileUrlTemplate?: string
  geeTileUrl?: string
  mapId?: string
  legend?: any
  statistics?: SatelliteAreaStats[]
  stats?: any
  metadata?: {
    downloadUrl?: string | null
    downloadFilename?: string | null
    [key: string]: any
  }
  downloadUrl?: string | null
  downloadFilename?: string | null
  geoserverLayer?: string | null
  cached?: boolean
  bbox?: [number, number, number, number]
  [key: string]: any
}
