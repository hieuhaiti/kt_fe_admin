import apiClient from './common/apiClient'
import type {
  ApiResponse,
  AdministrativeUnit,
  LandcoverStat,
  DashboardStats,
  ForestChangeItem,
  ResidentialDistanceFeatureCollection,
  AdminUnitParams,
  LandcoverParams,
  DashboardParams,
  ForestChangeParams,
  ResidentialDistanceParams,
  BorderStationsByDistrictData,
  BorderStationsByRadiusData,
} from '@/types/api'
import { serviceStatsPath, serviceSpatialPath } from '@/constant/serviceConstant'

export interface BorderStationsByRadiusParams {
  lng: number
  lat: number
  radius: number
}

export default {
  // ── /stats ──

  /** GET /stats/administrative-units?level= */
  getAdminUnits: (params: AdminUnitParams) =>
    apiClient.get<{ units: AdministrativeUnit[] }>(
      `${serviceStatsPath}/administrative-units`,
      { params }
    ),

  /** GET /stats/landcover?year=&forest_type=&by=&from=&to= */
  getLandcover: (params?: LandcoverParams) =>
    apiClient.get<{ items: LandcoverStat[] }>(`${serviceStatsPath}/landcover`, {
      params,
    }),

  /** GET /stats/dashboard?force= */
  getDashboard: (params?: DashboardParams) =>
    apiClient.get<DashboardStats>(`${serviceStatsPath}/dashboard`, { params }),

  // ── /spatial ──

  /** GET /spatial/forest-change?from_year=&to_year=&forest_type=&unit_code= */
  getForestChange: (params: ForestChangeParams) =>
    apiClient.get<{ items: ForestChangeItem[] }>(`${serviceSpatialPath}/forest-change`, {
      params,
    }),

  /** GET /spatial/residential-distance?residential_code=&forest_code=&threshold_m=&limit= */
  getResidentialDistance: (params: ResidentialDistanceParams) =>
    apiClient.get<ResidentialDistanceFeatureCollection>(
      `${serviceSpatialPath}/residential-distance`,
      { params }
    ),

  // ── Legacy (not in Postman) — kept so pages compile; return empty payload ──

  getByDistrict: (_districtId: number) =>
    Promise.resolve({
      message: '',
      status: 200,
      data: { items: [], total: 0 } as BorderStationsByDistrictData,
    } as ApiResponse<BorderStationsByDistrictData>),

  getByRadius: (_params: BorderStationsByRadiusParams) =>
    Promise.resolve({
      message: '',
      status: 200,
      data: { items: [], total: 0 } as BorderStationsByRadiusData,
    } as ApiResponse<BorderStationsByRadiusData>),
}
