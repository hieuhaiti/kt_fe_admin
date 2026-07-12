export type GeometryTypePostman =
  | 'POINT'
  | 'MULTIPOINT'
  | 'LINESTRING'
  | 'MULTILINESTRING'
  | 'POLYGON'
  | 'MULTIPOLYGON'
  | 'GEOMETRY'
  | 'RASTER'

/** Legacy lowercase alias */
export type GeometryType = 'point' | 'line' | 'polygon' | GeometryTypePostman

export type LayerKind = 'basemap' | 'overlay'
export type SourceFormat = 'shapefile' | 'geojson' | 'kml' | 'geotiff' | 'filegdb'
export type ImportMode = 'overwrite' | 'append'
export type ImportJobStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface MapLayer {
  id?: number
  code: string
  name_vi?: string
  name_en?: string
  table_name?: string
  schema_name?: string
  geometry_type?: GeometryType
  epsg_code?: number
  category?: string
  layer_kind?: LayerKind
  is_active?: boolean
  is_public?: boolean
  is_editable?: boolean
  is_published?: boolean
  sort_order?: number
  workspace?: string
  createdAt?: string
  updatedAt?: string

  name?: string
  geometry_data?: object | string
  properties?: Record<string, any>
  is_lost_forest?: boolean
  created_by?: number
  created_at?: string
  updated_at?: string
}

export interface MapLayerListData {
  items?: MapLayer[]
  mapLayers: MapLayer[]
  pagination?: import('./index').Pagination
}

export interface MapLayerListParams {
  category?: string
  layer_kind?: LayerKind
  is_active?: boolean
  is_public?: boolean

  page?: number
  limit?: number
  search?: string
  sortBy?: string
  sortOrder?: 'ASC' | 'DESC'
  geometry_type?: string
}

export interface CreateMapLayerBody {
  code: string
  name_vi: string
  name_en?: string
  table_name: string
  schema_name?: string
  geometry_type: GeometryType
  epsg_code?: number
  category?: string
  layer_kind?: LayerKind
  is_active?: boolean
  is_public?: boolean
  is_editable?: boolean

  name?: string
  geometry_data?: object | string
  properties?: Record<string, any>
}

export interface PatchMapLayerBody {
  name_vi?: string
  name_en?: string
  is_public?: boolean
  category?: string
  sort_order?: number
}

export interface PatchMapLayerActiveBody {
  is_active: boolean
}

export interface ImportGeoJsonInlineBody {
  source_format: 'geojson'
  import_mode: ImportMode
  auto_publish?: boolean
  geojson: {
    type: 'FeatureCollection'
    features: any[]
  }
}

export interface ImportJob {
  id: number
  job_id?: string
  layer_code?: string
  source_format?: SourceFormat
  status: ImportJobStatus
  progress?: number
  error_message?: string
  createdAt?: string
  updatedAt?: string
}

export interface HarvestRasterBody {
  tif_path: string
  geoserver_layer?: string
  truncate_cache?: boolean
}

export interface CalculateLostAreaBody {
  points: Array<{ latitude: number; longitude: number }>
  auto_close_polygon?: boolean
}

export interface CalculateLostAreaResult {
  area_m2: number
  area_ha: number
  perimeter_m?: number
}
