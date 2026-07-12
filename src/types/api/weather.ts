export type WeatherLayerType = 'temp' | 'rain' | 'cloud' | 'wind' | 'pressure' | string

export interface WeatherLayer {
  type: WeatherLayerType
  name?: string
  owmLayer?: string
  tileUrl?: string
  tileUrlTemplate?: string
  attribution?: string
  legend?: any
  updatedAt?: string
}

export interface WeatherPointData {
  lng: number
  lat: number
  temperature?: number
  humidity?: number
  pressure?: number
  windSpeed?: number
  windDeg?: number
  description?: string
  icon?: string
  timestamp?: string
  [key: string]: any
}

export interface WindGridCell {
  lng: number
  lat: number
  u: number
  v: number
  speed?: number
  direction?: number
}

export interface WindGridData {
  bbox: [number, number, number, number]
  grid: number
  cells: WindGridCell[]
  timestamp?: string
}

export interface WeatherLayersParams {
  type?: WeatherLayerType
}

export interface WeatherPointParams {
  lng: number
  lat: number
}

export interface WindGridParams {
  bbox: string
  grid?: number
}
