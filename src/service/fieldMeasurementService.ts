import apiClient from './common/apiClient'
import { serviceFieldMeasurementPath, serviceMonitoredAreaPath } from '@/constant/serviceConstant'
import type {
  CreateMonitoredAreaBody,
  FieldMeasurement,
  FieldMeasurementListData,
  FieldMeasurementListParams,
  GeoJsonFeatureCollection,
  MonitoredArea,
  MonitoredAreaListData,
  MonitoredAreaListParams,
} from '@/types/api'

export default {
  getAll: (params?: FieldMeasurementListParams) =>
    apiClient.get<FieldMeasurementListData>(serviceFieldMeasurementPath, { params }),

  getById: (id: number) => apiClient.get<FieldMeasurement>(`${serviceFieldMeasurementPath}/${id}`),

  verify: (id: number) =>
    apiClient.post<FieldMeasurement>(`${serviceFieldMeasurementPath}/${id}/verify`),

  reject: (id: number, reviewNote: string) =>
    apiClient.post<FieldMeasurement>(`${serviceFieldMeasurementPath}/${id}/reject`, {
      reviewNote,
    }),

  exportGeoJson: (params?: Pick<FieldMeasurementListParams, 'commune_code' | 'from' | 'to'>) =>
    apiClient.get<GeoJsonFeatureCollection>(`${serviceFieldMeasurementPath}/export`, {
      params: { ...params, format: 'geojson' },
    }),

  getAreas: (params?: MonitoredAreaListParams) =>
    apiClient.get<MonitoredAreaListData>(serviceMonitoredAreaPath, { params }),

  getAreaById: (id: number) => apiClient.get<MonitoredArea>(`${serviceMonitoredAreaPath}/${id}`),

  createArea: (data: CreateMonitoredAreaBody) =>
    apiClient.post<MonitoredArea>(serviceMonitoredAreaPath, data),
}
