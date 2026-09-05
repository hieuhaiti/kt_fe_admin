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
  [key: string]: unknown
}

export interface SatelliteLegendItem {
  classId?: number
  className?: string
  color?: string
  name?: string
  label?: string
}

export interface SatelliteResponse {
  resultId?: number
  tileUrl?: string
  tileUrlTemplate?: string
  geeTileUrl?: string
  mapId?: string
  legend?: SatelliteLegendItem[] | Record<string, unknown>
  statistics?: SatelliteAreaStats[]
  stats?: Record<string, unknown>
  metadata?: {
    downloadUrl?: string | null
    downloadFilename?: string | null
    [key: string]: unknown
  }
  downloadUrl?: string | null
  downloadFilename?: string | null
  geoserverLayer?: string | null
  cached?: boolean
  bbox?: [number, number, number, number]
  [key: string]: unknown
}
