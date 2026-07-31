export interface LayerSeriesGroup {
  id?: number
  code: string
  name_vi: string
  name_en?: string | null
  step_count: number
  min_year: number | null
  max_year: number | null
  geoserver_layer: string
  geoserver_store?: string
  geoserver_style?: string | null
  default_style?: string | null
  is_active?: boolean
  is_public?: boolean
  created_at?: string
  updated_at?: string
}

export interface LayerSeriesGroupPayload {
  code: string
  name_vi: string
  name_en?: string | null
  // 2 field kỹ thuật — server tự suy ra từ layer con hoặc dùng default nếu client bỏ trống.
  geoserver_store?: string
  geoserver_layer?: string
  geoserver_style?: string | null
  is_active?: boolean
  is_public?: boolean
}

export interface LayerSeriesStep {
  id: number
  layer_code: string
  geoserver_layer: string
  year_from: number
  year_to: number
  label: string
  time?: string
  tile_url: string | null
}

export interface LayerSeriesTimeline {
  group: {
    code: string
    name_vi: string
    name_en?: string | null
    geoserver_layer: string
    default_style?: string | null
  }
  mode: 'discrete'
  snap: 'nearest'
  default_index: number | null
  min_year: number | null
  max_year: number | null
  steps: LayerSeriesStep[]
}

export interface LayerSeriesGroupsListData {
  items: LayerSeriesGroup[]
}
