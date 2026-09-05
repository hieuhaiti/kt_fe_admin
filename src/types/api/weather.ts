export type WeatherLayerType = 'temp' | 'rain' | 'cloud' | 'wind' | 'pressure' | string

export interface WeatherLayer {
  type: WeatherLayerType
  name?: string
  owmLayer?: string
  tileUrl?: string
  tileUrlTemplate?: string
  attribution?: string
  legend?: Record<string, unknown> | Array<Record<string, unknown>>
  updatedAt?: string
}

export interface WeatherPointData {
  lng: number
  lat: number
  location?: string
  stale?: boolean
  cached?: boolean
  temp?: number
  temperature?: number
  feelsLike?: number
  humidity?: number
  pressure?: number
  windSpeed?: number
  windDeg?: number
  wind?: {
    speed?: number
    deg?: number
    [key: string]: unknown
  }
  clouds?: number
  visibility?: number
  description?: string
  weather?: {
    description?: string
    [key: string]: unknown
  }
  icon?: string
  timestamp?: string
  observedAt?: string
  fetchedAt?: string
  [key: string]: unknown
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
