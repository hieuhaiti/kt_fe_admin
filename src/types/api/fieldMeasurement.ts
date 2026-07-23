export type FieldMeasurementStatus = 'draft' | 'submitted' | 'verified' | 'rejected'

export interface GeoJsonPolygon {
  type: 'Polygon'
  coordinates: number[][][]
}

export interface FieldMeasurementPhoto {
  id: number
  measurementId: number
  originalName?: string | null
  mimeType?: string | null
  sizeBytes?: number | null
  takenAt?: string | null
  uploadedBy?: number | null
  createdAt?: string | null
}

export interface FieldMeasurement {
  id: number
  code: string
  areaId?: number | null
  layerId?: number | null
  points?: Array<{ lng: number; lat: number; accuracy_m?: number | null }>
  geom?: GeoJsonPolygon | null
  areaM2?: number | string | null
  avgAccuracyM?: number | string | null
  communeCode?: string | null
  affectedFeatures?: Array<Record<string, unknown>>
  oldLandUse?: string | null
  newLandUse?: string | null
  note?: string | null
  status: FieldMeasurementStatus
  reviewNote?: string | null
  measuredBy?: number | null
  verifiedBy?: number | null
  startedAt?: string | null
  finishedAt?: string | null
  submittedAt?: string | null
  verifiedAt?: string | null
  createdAt?: string | null
  updatedAt?: string | null
  photos?: FieldMeasurementPhoto[]
}

export interface FieldMeasurementListParams {
  page?: number
  limit?: number
  status?: FieldMeasurementStatus
  commune_code?: string
  area_id?: number
  from?: string
  to?: string
}

export interface FieldMeasurementListData {
  items: FieldMeasurement[]
}

export interface MeasurementTimelineItem {
  id: number
  code: string
  area_m2?: number | string | null
  old_land_use?: string | null
  new_land_use?: string | null
  status: FieldMeasurementStatus
  avg_accuracy_m?: number | string | null
  finished_at?: string | null
  submitted_at?: string | null
  verified_at?: string | null
  created_at?: string | null
}

export interface MonitoredArea {
  id: number
  code: string
  name?: string | null
  refGeom?: GeoJsonPolygon | null
  communeCode?: string | null
  note?: string | null
  createdBy?: number | null
  createdAt?: string | null
  updatedAt?: string | null
  timeline?: MeasurementTimelineItem[]
}

export interface MonitoredAreaListParams {
  page?: number
  limit?: number
  commune_code?: string
}

export interface MonitoredAreaListData {
  items: MonitoredArea[]
}

export interface CreateMonitoredAreaBody {
  name?: string | null
  geom: GeoJsonPolygon
  communeCode?: string | null
  note?: string | null
}

export interface GeoJsonFeatureCollection {
  type: 'FeatureCollection'
  features: Array<Record<string, unknown>>
}
