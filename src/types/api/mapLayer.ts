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

export interface MapLayerLegendEntry {
  label: string
  color: string
  value?: string | number | null
  min?: number | null
  max?: number | null
}

export interface MapLayerLegend {
  entries: MapLayerLegendEntry[]
}

export interface MapLayerDefaultStyle {
  fillColor?: string
  fillOpacity?: number
  fillAntialias?: boolean
  strokeColor?: string
  strokeOpacity?: number
  strokeWidth?: number
  strokeBlur?: number
  strokeDasharray?: number[]
  strokeOffset?: number
  lineCap?: 'butt' | 'round' | 'square'
  lineJoin?: 'bevel' | 'round' | 'miter'
  circleColor?: string
  circleOpacity?: number
  circleRadius?: number
  circleBlur?: number
  circleStrokeColor?: string
  circleStrokeOpacity?: number
  circleStrokeWidth?: number
  opacity?: number
  rasterOpacity?: number
  brightnessMin?: number
  brightnessMax?: number
  contrast?: number
  saturation?: number
  hueRotate?: number
  fadeDuration?: number
  resampling?: 'linear' | 'nearest'
  visible_by_default?: boolean
}

export interface MapLayer {
  id?: number
  code: string
  name_vi?: string | null
  name_en?: string | null
  description_vi?: string | null
  description_en?: string | null
  table_name?: string | null
  schema_name?: string | null
  geometry_column?: string | null
  geometry_type?: GeometryType | null
  epsg_code?: number | null
  geoserver_layer?: string | null
  geoserver_store?: string | null
  source_url?: string | null
  default_style?: MapLayerDefaultStyle | null
  min_zoom?: number | null
  max_zoom?: number | null
  label_field?: string | null
  category?: string | null
  layer_kind?: LayerKind | null
  layer_group?: string | null
  data_year?: number | null
  source_dataset?: string | null
  source_layer_name?: string | null
  is_active?: boolean
  is_public?: boolean
  is_editable?: boolean
  is_published?: boolean
  sort_order?: number | null
  layer_permissions?: Record<string, unknown> | null
  remote_sensing_image_id?: number | string | null
  feature_count?: number | string | null
  bbox?: GeoJSON.Geometry | null
  last_updated_at?: string | null
  workspace?: string | null
  createdAt?: string | null
  updatedAt?: string | null

  legend_config?: MapLayerLegend | null
  legend?: MapLayerLegend | null

  name?: string
  geometry_data?: object | string
  properties?: Record<string, unknown>
  is_lost_forest?: boolean
  created_by?: number
  created_at?: string | null
  updated_at?: string | null
}

export interface MapLayerListData {
  items?: MapLayer[]
  mapLayers: MapLayer[]
  pagination?: import('./index').Pagination
}

export interface MapLayerListParams {
  category?: string
  layer_kind?: LayerKind
  layer_group?: string
  data_year?: number
  geometry_type?: string
  is_active?: boolean
  is_public?: boolean
  publish_data?: boolean

  page?: number
  limit?: number
  q?: string
  sortBy?: string
  sortOrder?: 'ASC' | 'DESC'
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
  layer_group?: string | null
  is_active?: boolean
  is_public?: boolean
  is_editable?: boolean
  default_style?: MapLayerDefaultStyle | null
  legend_config?: MapLayerLegend | null

  name?: string
  geometry_data?: object | string
  properties?: Record<string, unknown>
}

export interface PatchMapLayerBody {
  name_vi?: string
  name_en?: string | null
  description_vi?: string | null
  description_en?: string | null
  schema_name?: string
  table_name?: string
  geometry_type?: GeometryType
  epsg_code?: number
  category?: string
  layer_kind?: LayerKind
  layer_group?: string | null
  is_active?: boolean
  is_public?: boolean
  is_editable?: boolean
  data_year?: number | null
  sort_order?: number
  default_style?: MapLayerDefaultStyle | null
  legend_config?: MapLayerLegend | null
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
    features: GeoJSON.Feature[]
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
