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

export interface SatelliteClassifiedBody extends SatelliteBaseBody {}

export interface SatelliteAreaStats {
  className?: string
  areaHa: number
  areaPct?: number
  color?: string
  [key: string]: any
}

export interface SatelliteResponse {
  tileUrl?: string
  tileUrlTemplate?: string
  mapId?: string
  legend?: any
  statistics?: SatelliteAreaStats[]
  bbox?: [number, number, number, number]
  [key: string]: any
}
