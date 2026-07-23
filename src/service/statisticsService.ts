import apiClient from './common/apiClient'
import type {
  AdministrativeUnit,
  LandcoverStat,
  DashboardStats,
  AdminUnitParams,
  LandcoverParams,
  DashboardParams,
} from '@/types/api'
import { serviceStatsPath } from '@/constant/serviceConstant'

export default {
  // ── /stats ──

  /** GET /stats/administrative-units?level= */
  getAdminUnits: (params: AdminUnitParams) =>
    apiClient.get<{ units: AdministrativeUnit[] }>(`${serviceStatsPath}/administrative-units`, {
      params,
    }),

  /** GET /stats/landcover?year=&forest_type=&by=&from=&to= */
  getLandcover: (params?: LandcoverParams) =>
    apiClient.get<{ items: LandcoverStat[] }>(`${serviceStatsPath}/landcover`, {
      params,
    }),

  /** GET /stats/dashboard?force= */
  getDashboard: (params?: DashboardParams) =>
    apiClient.get<DashboardStats>(`${serviceStatsPath}/dashboard`, { params }),

}
