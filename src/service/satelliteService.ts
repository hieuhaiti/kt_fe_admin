import apiClient from './common/apiClient'
import type {
  SatelliteRgbBody,
  SatelliteNdviBody,
  SatelliteHeatMapBody,
  SatelliteClassifiedBody,
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

  /** POST /satellite/classified (11-class RF, lopPhuRungFinal v3) */
  classified: (data: SatelliteClassifiedBody) =>
    apiClient.post<SatelliteResponse>(`${serviceSatellitePath}/classified`, data),
}
