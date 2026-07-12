import apiClient from './common/apiClient'
import type {
  SatelliteRgbBody,
  SatelliteNdviBody,
  SatelliteHeatMapBody,
  SatelliteClassifiedBody,
  SatelliteCompareBody,
  SatelliteResponse,
} from '@/types/api'
import { serviceSatellitePath } from '@/constant/serviceConstant'

/**
 * On-demand GEE satellite services.
 * Postman route "/satellite/*" — legacy cron endpoints kept in cronAlertService.
 */
export default {
  /** POST /satellite/rgb */
  rgb: (data: SatelliteRgbBody) =>
    apiClient.post<SatelliteResponse>(`${serviceSatellitePath}/rgb`, data),

  /** POST /satellite/ndvi */
  ndvi: (data: SatelliteNdviBody) =>
    apiClient.post<SatelliteResponse>(`${serviceSatellitePath}/ndvi`, data),

  /** POST /satellite/heat-map */
  heatMap: (data: SatelliteHeatMapBody) =>
    apiClient.post<SatelliteResponse>(`${serviceSatellitePath}/heat-map`, data),

  /** POST /satellite/classified (7-class quick classification) */
  classified: (data: SatelliteClassifiedBody) =>
    apiClient.post<SatelliteResponse>(`${serviceSatellitePath}/classified`, data),

  /** POST /satellite/compare */
  compare: (data: SatelliteCompareBody) =>
    apiClient.post<SatelliteResponse>(`${serviceSatellitePath}/compare`, data),
}
