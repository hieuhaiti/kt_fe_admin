import apiClient from './common/apiClient'
import type {
  ApiResponse,
  WeatherLayer,
  WeatherPointData,
  WindGridData,
  WeatherLayersParams,
  WeatherPointParams,
  WindGridParams,
} from '@/types/api'
import { serviceWeatherPath } from '@/constant/serviceConstant'

const API_BASE = import.meta.env.VITE_API_BASE_URL || ''

export default {
  /** GET /weather/layers?type= */
  getLayers: (params?: WeatherLayersParams) =>
    apiClient.get<{ layers: WeatherLayer[] }>(`${serviceWeatherPath}/layers`, { params }),

  /** GET /weather/point?lng=&lat= */
  getPoint: (params: WeatherPointParams) =>
    apiClient.get<WeatherPointData>(`${serviceWeatherPath}/point`, { params }),

  /** GET /weather/wind-grid?bbox=&grid= */
  getWindGrid: (params: WindGridParams) =>
    apiClient.get<WindGridData>(`${serviceWeatherPath}/wind-grid`, { params }),

  /**
   * Build the tile URL for GET /weather/tiles/:layer/:z/:x/:y
   * (returned as a template that MapLibre/Leaflet can substitute).
   */
  buildTileUrlTemplate: (layer: string) =>
    `${API_BASE}${serviceWeatherPath}/tiles/${layer}/{z}/{x}/{y}`,

  /** POST /weather/refresh (perm: weather:manage) */
  refresh: () => apiClient.post<ApiResponse<{}>>(`${serviceWeatherPath}/refresh`),
}
