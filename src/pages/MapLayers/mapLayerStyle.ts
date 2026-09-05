export type StyleGeometryKind = 'point' | 'line' | 'polygon' | 'raster'
export type StyleValueType = 'color' | 'number' | 'boolean' | 'enum' | 'dasharray'

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

export interface StylePropertyDefinition {
  key: keyof MapLayerDefaultStyle
  label: string
  type: StyleValueType
  geometryTypes: StyleGeometryKind[]
  min?: number
  max?: number
  step?: number
  options?: readonly string[]
  defaultValue: string | number | boolean | number[]
}

export const STYLE_PROPERTY_DEFINITIONS: readonly StylePropertyDefinition[] = [
  {
    key: 'fillColor',
    label: 'Màu nền vùng',
    type: 'color',
    geometryTypes: ['polygon'],
    defaultValue: '#F0F0F0',
  },
  {
    key: 'fillOpacity',
    label: 'Độ trong suốt nền vùng',
    type: 'number',
    geometryTypes: ['polygon'],
    min: 0,
    max: 1,
    step: 0.05,
    defaultValue: 0.15,
  },
  {
    key: 'fillAntialias',
    label: 'Khử răng cưa vùng',
    type: 'boolean',
    geometryTypes: ['polygon'],
    defaultValue: true,
  },
  {
    key: 'strokeColor',
    label: 'Màu đường viền',
    type: 'color',
    geometryTypes: ['polygon', 'line'],
    defaultValue: '#333333',
  },
  {
    key: 'strokeOpacity',
    label: 'Độ trong suốt đường viền',
    type: 'number',
    geometryTypes: ['polygon', 'line'],
    min: 0,
    max: 1,
    step: 0.05,
    defaultValue: 1,
  },
  {
    key: 'strokeWidth',
    label: 'Độ rộng đường viền',
    type: 'number',
    geometryTypes: ['polygon', 'line'],
    min: 0,
    max: 24,
    step: 0.5,
    defaultValue: 2,
  },
  {
    key: 'strokeBlur',
    label: 'Độ mờ đường viền',
    type: 'number',
    geometryTypes: ['polygon', 'line'],
    min: 0,
    max: 24,
    step: 0.5,
    defaultValue: 0,
  },
  {
    key: 'strokeDasharray',
    label: 'Nét gạch đường viền',
    type: 'dasharray',
    geometryTypes: ['polygon', 'line'],
    defaultValue: [2, 2],
  },
  {
    key: 'strokeOffset',
    label: 'Độ lệch đường viền',
    type: 'number',
    geometryTypes: ['polygon', 'line'],
    min: -24,
    max: 24,
    step: 0.5,
    defaultValue: 0,
  },
  {
    key: 'lineCap',
    label: 'Kiểu đầu đường',
    type: 'enum',
    geometryTypes: ['polygon', 'line'],
    options: ['butt', 'round', 'square'],
    defaultValue: 'round',
  },
  {
    key: 'lineJoin',
    label: 'Kiểu nối đường',
    type: 'enum',
    geometryTypes: ['polygon', 'line'],
    options: ['bevel', 'round', 'miter'],
    defaultValue: 'round',
  },
  {
    key: 'circleColor',
    label: 'Màu điểm',
    type: 'color',
    geometryTypes: ['point'],
    defaultValue: '#0F766E',
  },
  {
    key: 'circleOpacity',
    label: 'Độ trong suốt điểm',
    type: 'number',
    geometryTypes: ['point'],
    min: 0,
    max: 1,
    step: 0.05,
    defaultValue: 0.95,
  },
  {
    key: 'circleRadius',
    label: 'Bán kính điểm',
    type: 'number',
    geometryTypes: ['point'],
    min: 0,
    max: 50,
    step: 0.5,
    defaultValue: 5.5,
  },
  {
    key: 'circleBlur',
    label: 'Độ mờ điểm',
    type: 'number',
    geometryTypes: ['point'],
    min: -1,
    max: 1,
    step: 0.05,
    defaultValue: 0,
  },
  {
    key: 'circleStrokeColor',
    label: 'Màu viền điểm',
    type: 'color',
    geometryTypes: ['point'],
    defaultValue: '#FFFFFF',
  },
  {
    key: 'circleStrokeOpacity',
    label: 'Độ trong suốt viền điểm',
    type: 'number',
    geometryTypes: ['point'],
    min: 0,
    max: 1,
    step: 0.05,
    defaultValue: 1,
  },
  {
    key: 'circleStrokeWidth',
    label: 'Độ rộng viền điểm',
    type: 'number',
    geometryTypes: ['point'],
    min: 0,
    max: 24,
    step: 0.5,
    defaultValue: 1.5,
  },
  {
    key: 'opacity',
    label: 'Độ trong suốt raster',
    type: 'number',
    geometryTypes: ['raster'],
    min: 0,
    max: 1,
    step: 0.05,
    defaultValue: 0.72,
  },
  {
    key: 'rasterOpacity',
    label: 'Độ trong suốt raster (tên mới)',
    type: 'number',
    geometryTypes: ['raster'],
    min: 0,
    max: 1,
    step: 0.05,
    defaultValue: 0.72,
  },
  {
    key: 'brightnessMin',
    label: 'Độ sáng tối thiểu raster',
    type: 'number',
    geometryTypes: ['raster'],
    min: 0,
    max: 1,
    step: 0.05,
    defaultValue: 0,
  },
  {
    key: 'brightnessMax',
    label: 'Độ sáng tối đa raster',
    type: 'number',
    geometryTypes: ['raster'],
    min: 0,
    max: 1,
    step: 0.05,
    defaultValue: 1,
  },
  {
    key: 'contrast',
    label: 'Độ tương phản raster',
    type: 'number',
    geometryTypes: ['raster'],
    min: -1,
    max: 1,
    step: 0.05,
    defaultValue: 0,
  },
  {
    key: 'saturation',
    label: 'Độ bão hòa raster',
    type: 'number',
    geometryTypes: ['raster'],
    min: -1,
    max: 1,
    step: 0.05,
    defaultValue: 0,
  },
  {
    key: 'hueRotate',
    label: 'Xoay màu raster',
    type: 'number',
    geometryTypes: ['raster'],
    min: -360,
    max: 360,
    step: 1,
    defaultValue: 0,
  },
  {
    key: 'fadeDuration',
    label: 'Thời gian chuyển raster',
    type: 'number',
    geometryTypes: ['raster'],
    min: 0,
    max: 60000,
    step: 50,
    defaultValue: 250,
  },
  {
    key: 'resampling',
    label: 'Nội suy raster',
    type: 'enum',
    geometryTypes: ['raster'],
    options: ['linear', 'nearest'],
    defaultValue: 'linear',
  },
  {
    key: 'visible_by_default',
    label: 'Hiển thị mặc định',
    type: 'boolean',
    geometryTypes: ['point', 'line', 'polygon', 'raster'],
    defaultValue: false,
  },
]

export function getStyleDefinitions(geometryType: StyleGeometryKind): StylePropertyDefinition[] {
  return STYLE_PROPERTY_DEFINITIONS.filter((definition) =>
    definition.geometryTypes.includes(geometryType)
  )
}

export function normalizeStyleObject(value: unknown): MapLayerDefaultStyle {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(
    Object.entries(value).filter(([key]) =>
      STYLE_PROPERTY_DEFINITIONS.some((definition) => definition.key === key)
    )
  ) as MapLayerDefaultStyle
}

export function getStyleDefinition(key: string): StylePropertyDefinition | undefined {
  return STYLE_PROPERTY_DEFINITIONS.find((definition) => definition.key === key)
}

export function isValidStyleValue(definition: StylePropertyDefinition, value: unknown): boolean {
  if (definition.type === 'color')
    return typeof value === 'string' && /^#(?:[\\da-fA-F]{3}|[\\da-fA-F]{6})$/.test(value)
  if (definition.type === 'boolean') return typeof value === 'boolean'
  if (definition.type === 'enum')
    return typeof value === 'string' && definition.options?.includes(value) === true
  if (definition.type === 'dasharray') {
    return (
      Array.isArray(value) &&
      value.length <= 8 &&
      value.every((item) => typeof item === 'number' && Number.isFinite(item) && item >= 0)
    )
  }
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    (definition.min === undefined || value >= definition.min) &&
    (definition.max === undefined || value <= definition.max)
  )
}

export function validateStyleObject(
  value: unknown,
  geometryType: StyleGeometryKind
): { style: MapLayerDefaultStyle; error?: string } {
  if (value === null || value === undefined || value === '') return { style: {} }
  if (typeof value !== 'object' || Array.isArray(value))
    return { style: {}, error: 'Kiểu vẽ phải là JSON object' }

  const allowed = getStyleDefinitions(geometryType)
  const style: Record<string, unknown> = {}
  for (const [key, rawValue] of Object.entries(value)) {
    const definition = allowed.find((item) => item.key === key)
    if (!definition)
      return { style: {}, error: `Thuộc tính không phù hợp với kiểu ${geometryType}: ${key}` }
    if (!isValidStyleValue(definition, rawValue))
      return { style: {}, error: `Giá trị của ${definition.label} không hợp lệ` }
    style[key] = rawValue
  }
  return { style: style as MapLayerDefaultStyle }
}

export function parseStyleJson(
  text: string,
  geometryType: StyleGeometryKind
): { style: MapLayerDefaultStyle; error?: string } {
  if (!text.trim()) return { style: {} }
  try {
    return validateStyleObject(JSON.parse(text), geometryType)
  } catch (error: unknown) {
    return {
      style: {},
      error: `JSON kiểu vẽ không hợp lệ: ${error instanceof Error ? error.message : 'lỗi cú pháp'}`,
    }
  }
}

export function stringifyStyle(value: unknown): string {
  const normalized = normalizeStyleObject(value)
  return Object.keys(normalized).length > 0 ? JSON.stringify(normalized, null, 2) : ''
}
