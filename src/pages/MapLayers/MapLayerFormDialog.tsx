import { useEffect, useMemo, useRef, useState } from 'react'
import { z } from 'zod'
import { Code2, FileJson, List, Plus, Trash2 } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { mapLayerService, useApiQuery } from '@/service'
import GeoJsonMapPreview from '@/components/features/GeoJsonMapPreview'
import type {
  ApiResponse,
  CreateMapLayerBody,
  GeometryType,
  MapLayer,
  MapLayerLegend,
  MapLayerLegendEntry,
  MapLayerDefaultStyle,
} from '@/types/api'
import { getStyleDefinitions, parseStyleJson, stringifyStyle } from './mapLayerStyle'
import { toast } from 'react-toastify'
import { MAP_LAYER_CATEGORY_OPTIONS } from '@/constant/mapLayerConstant'

const COLOR_HEX_REGEX = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/

function toFullHexColor(hex: string): string {
  const trimmed = hex.trim()
  if (/^#[0-9A-Fa-f]{6}$/.test(trimmed)) return trimmed
  if (/^#[0-9A-Fa-f]{3}$/.test(trimmed)) {
    const r = trimmed[1]
    const g = trimmed[2]
    const b = trimmed[3]
    return `#${r}${r}${g}${g}${b}${b}`
  }
  return '#2D7B2E'
}

interface MapLayerFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  layerCode: string | null
  onSubmit: (data: CreateMapLayerBody) => void
  isLoading?: boolean
}

type MapLayerDetailData = MapLayer | { mapLayer?: MapLayer }

const mapLayerSchema = z.object({
  category: z.string().trim().min(1, { message: 'Vui lòng chọn nhóm lớp' }).max(60),
  layer_group: z.string().trim().max(80).optional().or(z.literal('')),
  name: z
    .string({ message: 'Tên lớp bản đồ là bắt buộc' })
    .trim()
    .min(2, { message: 'Tên lớp bản đồ phải có ít nhất 2 ký tự' })
    .max(200, { message: 'Tên lớp bản đồ không được vượt quá 200 ký tự' }),
  geometry_type: z.enum(['polygon', 'line', 'point', 'raster'], {
    message: "Kiểu hình học phải là một trong: 'polygon', 'line', 'point', 'raster'",
  }),
  properties: z.record(z.string(), z.unknown()).nullable().optional(),
  is_active: z.boolean().optional(),
  is_public: z.boolean().optional(),
})

function stringifyJson(value: unknown): string {
  if (!value) return ''
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return ''
  }
}

function extractGeoJson(raw: unknown): GeoJSON.GeoJSON | null {
  if (!raw || typeof raw !== 'object') return null
  const candidate = raw as Record<string, unknown>
  if (candidate.type === 'FeatureCollection' && Array.isArray(candidate.features))
    return raw as GeoJSON.FeatureCollection
  if (candidate.type === 'Feature' && candidate.geometry) return raw as GeoJSON.Feature
  if (typeof candidate.type === 'string' && candidate.coordinates) return raw as GeoJSON.Geometry
  return null
}

function toNumber(value: string): number | null {
  const parsed = Number(value.trim())
  return Number.isFinite(parsed) ? parsed : null
}

function extractPointCoordinates(raw: unknown): { lat: number; lng: number } | null {
  if (!raw) return null
  let input = raw
  if (typeof raw === 'string') {
    try {
      input = JSON.parse(raw)
    } catch {
      return null
    }
  }
  if (!input || typeof input !== 'object') return null
  const geometry = extractGeoJson(input)
  if (!geometry) return null

  if (
    geometry.type === 'Point' &&
    Array.isArray(geometry.coordinates) &&
    geometry.coordinates.length >= 2
  ) {
    const lng = Number(geometry.coordinates[0])
    const lat = Number(geometry.coordinates[1])
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng }
  }

  if (
    geometry.type === 'Feature' &&
    geometry.geometry?.type === 'Point' &&
    Array.isArray(geometry.geometry.coordinates) &&
    geometry.geometry.coordinates.length >= 2
  ) {
    const lng = Number(geometry.geometry.coordinates[0])
    const lat = Number(geometry.geometry.coordinates[1])
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng }
  }

  return null
}

function toLayerCode(value: string): string {
  const ascii = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 54)

  const code = ascii || `layer_${Date.now()}`
  return /^[a-z_]/.test(code) ? code : `layer_${code}`
}

type FormGeometryKind = 'point' | 'line' | 'polygon' | 'raster'

function toApiGeometryType(type: FormGeometryKind): CreateMapLayerBody['geometry_type'] {
  if (type === 'point') return 'POINT'
  if (type === 'line') return 'LINESTRING'
  if (type === 'polygon') return 'POLYGON'
  if (type === 'raster') return 'RASTER'
  return type
}

function toFormGeometryType(type?: GeometryType | null): FormGeometryKind {
  const upper = String(type || '').toUpperCase()
  if (upper === 'POINT' || upper === 'MULTIPOINT') return 'point'
  if (upper === 'LINESTRING' || upper === 'MULTILINESTRING') return 'line'
  if (upper === 'RASTER') return 'raster'
  return 'polygon'
}

// Suy ra kiểu hình học chính từ nội dung GeoJSON (Feature / FeatureCollection / Geometry).
function inferGeometryKind(raw: unknown): 'point' | 'line' | 'polygon' | null {
  const collect = (value: unknown): string | null => {
    if (!value || typeof value !== 'object') return null
    const candidate = value as Record<string, unknown>
    if (candidate.type === 'FeatureCollection' && Array.isArray(candidate.features)) {
      for (const feature of candidate.features) {
        const type = collect(feature)
        if (type) return type
      }
      return null
    }
    if (candidate.type === 'Feature') return collect(candidate.geometry)
    if (typeof candidate.type === 'string') return candidate.type
    return null
  }
  const t = collect(raw)
  if (!t) return null
  if (t === 'Point' || t === 'MultiPoint') return 'point'
  if (t === 'LineString' || t === 'MultiLineString') return 'line'
  if (t === 'Polygon' || t === 'MultiPolygon') return 'polygon'
  return null
}

export default function MapLayerFormDialog({
  open,
  onOpenChange,
  layerCode,
  onSubmit,
  isLoading = false,
}: MapLayerFormDialogProps) {
  const [category, setCategory] = useState<string>('forest_district')
  const [layerGroup, setLayerGroup] = useState<string>('')
  const [layerKind, setLayerKind] = useState<'basemap' | 'overlay'>('overlay')
  const [name, setName] = useState<string>('')
  const [geometryType, setGeometryType] = useState<FormGeometryKind>('polygon')
  const [rasterFileName, setRasterFileName] = useState<string>('')
  const [isActive, setIsActive] = useState<'true' | 'false'>('true')
  const [isPublic, setIsPublic] = useState<'true' | 'false'>('false')
  const [latitude, setLatitude] = useState<string>('')
  const [longitude, setLongitude] = useState<string>('')
  const [geometryDataText, setGeometryDataText] = useState<string>('')
  const [propertiesText, setPropertiesText] = useState<string>('')
  const [legendMode, setLegendMode] = useState<'list' | 'json'>('list')
  const [legendEntries, setLegendEntries] = useState<MapLayerLegendEntry[]>([])
  const [legendJsonText, setLegendJsonText] = useState<string>('')
  const [styleMode, setStyleMode] = useState<'list' | 'json'>('list')
  const [styleValues, setStyleValues] = useState<MapLayerDefaultStyle>({})
  const [styleJsonText, setStyleJsonText] = useState<string>('')
  const [selectedStyleKey, setSelectedStyleKey] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  function isTiffFile(file: File): boolean {
    const name = file.name.toLowerCase()
    return /\.(tif|tiff)$/.test(name) || file.type === 'image/tiff'
  }

  async function detectTiffMagicBytes(file: File): Promise<boolean> {
    const bytes = new Uint8Array(await file.slice(0, 4).arrayBuffer())
    const le =
      bytes[0] === 0x49 &&
      bytes[1] === 0x49 &&
      (bytes[2] === 0x2a || bytes[2] === 0x2b) &&
      bytes[3] === 0x00
    const be =
      bytes[0] === 0x4d &&
      bytes[1] === 0x4d &&
      bytes[2] === 0x00 &&
      (bytes[3] === 0x2a || bytes[3] === 0x2b)
    return le || be
  }

  async function handleOpenGeometryFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    if (isTiffFile(file)) {
      const isTiff = await detectTiffMagicBytes(file)
      if (!isTiff) {
        toast.error('File có đuôi .tif/.tiff nhưng không phải GeoTIFF hợp lệ')
        return
      }
      setGeometryType('raster')
      setRasterFileName(file.name)
      setLatitude('')
      setLongitude('')
      setGeometryDataText('')
      toast.success(
        `Đã ghi nhận ${file.name} là raster — nạp thực tế qua Import Raster / Ingest GEE`
      )
      return
    }

    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      const kind = inferGeometryKind(parsed)
      if (!kind) {
        toast.error('Không nhận diện được GeoJSON hợp lệ trong file')
        return
      }
      setGeometryType(kind)
      setRasterFileName('')

      if (kind === 'point') {
        const point = extractPointCoordinates(parsed)
        if (point) {
          setLatitude(String(point.lat))
          setLongitude(String(point.lng))
          setGeometryDataText('')
          toast.success(`Đã nạp Point từ ${file.name}`)
          return
        }
      }

      setGeometryDataText(stringifyJson(parsed))
      setLatitude('')
      setLongitude('')
      toast.success(`Đã nạp GeoJSON từ ${file.name}`)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'lỗi parse'
      toast.error(`File không phải GeoJSON/TIFF hợp lệ: ${message}`)
    }
  }

  const layerQuery = useApiQuery(
    ['mapLayer', layerCode],
    () => mapLayerService.getByCode(layerCode!),
    { enabled: !!layerCode && open, staleTime: 0 },
    false,
    false
  )

  const responseData = (layerQuery.data as ApiResponse<MapLayerDetailData>)?.data
  const layer =
    (responseData && 'mapLayer' in responseData
      ? (responseData as { mapLayer?: MapLayer }).mapLayer
      : (responseData as MapLayer)) ?? null
  const isEdit = !!layerCode

  // Dialog state must be reset/hydrated when the selected API record changes.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!open) return
    if (!isEdit) {
      setCategory('forest_district')
      setLayerGroup('')
      setLayerKind('overlay')
      setName('')
      setGeometryType('polygon')
      setIsActive('true')
      setIsPublic('false')
      setLatitude('')
      setLongitude('')
      setGeometryDataText('')
      setPropertiesText('')
      setLegendEntries([])
      setLegendJsonText('')
      setLegendMode('list')
      setStyleValues({})
      setStyleJsonText('')
      setStyleMode('list')
      setSelectedStyleKey('')
      return
    }

    if (layer) {
      setCategory(layer.category || 'forest_district')
      setLayerGroup(layer.layer_group || '')
      setLayerKind(layer.layer_kind === 'basemap' ? 'basemap' : 'overlay')
      setName(layer.name_vi || layer.name || '')
      setGeometryType(toFormGeometryType(layer.geometry_type))
      setIsActive(layer.is_active ? 'true' : 'false')
      setIsPublic(layer.is_public ? 'true' : 'false')
      const point = extractPointCoordinates(layer.geometry_data)
      if (toFormGeometryType(layer.geometry_type) === 'point' && point) {
        setLatitude(String(point.lat))
        setLongitude(String(point.lng))
        setGeometryDataText('')
      } else {
        setLatitude('')
        setLongitude('')
        setGeometryDataText(stringifyJson(layer.geometry_data))
      }
      setPropertiesText(stringifyJson(layer.properties))

      const existingLegend = layer.legend_config || layer.legend
      if (
        existingLegend &&
        Array.isArray(existingLegend.entries) &&
        existingLegend.entries.length > 0
      ) {
        setLegendEntries(existingLegend.entries)
        setLegendJsonText(JSON.stringify(existingLegend, null, 2))
      } else {
        setLegendEntries([])
        setLegendJsonText('')
      }
      setLegendMode('list')
      const hydratedStyle = layer.default_style || {}
      setStyleValues(hydratedStyle)
      setStyleJsonText(stringifyStyle(hydratedStyle))
      setStyleMode('list')
      setSelectedStyleKey('')
    }
  }, [open, isEdit, layer])
  /* eslint-enable react-hooks/set-state-in-effect */

  function handleSwitchLegendMode(targetMode: 'list' | 'json') {
    if (targetMode === legendMode) return
    if (targetMode === 'json') {
      const obj: MapLayerLegend = { entries: legendEntries }
      setLegendJsonText(legendEntries.length > 0 ? JSON.stringify(obj, null, 2) : '')
      setLegendMode('json')
      return
    }

    // Chuyển sang 'list' từ 'json'
    if (!legendJsonText.trim()) {
      setLegendEntries([])
      setLegendMode('list')
      return
    }

    try {
      const parsed = JSON.parse(legendJsonText.trim())
      if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.entries)) {
        toast.error(
          'JSON không hợp lệ: phải có định dạng {"entries": [{"label": "...", "color": "#hex"}]}'
        )
        return
      }
      const list: MapLayerLegendEntry[] = (parsed.entries as Record<string, unknown>[]).map(
        (item) => ({
          label: typeof item?.label === 'string' ? item.label : '',
          color: typeof item?.color === 'string' ? item.color : '#2D7B2E',
        })
      )
      setLegendEntries(list)
      setLegendMode('list')
    } catch (err: unknown) {
      toast.error(`JSON không hợp lệ: ${err instanceof Error ? err.message : 'lỗi cú pháp'}`)
    }
  }

  function handleAddLegendEntry() {
    setLegendEntries((prev) => [...prev, { label: '', color: '#2D7B2E' }])
  }

  function handleUpdateLegendEntry(index: number, patch: Partial<MapLayerLegendEntry>) {
    setLegendEntries((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  }

  function handleRemoveLegendEntry(index: number) {
    setLegendEntries((prev) => prev.filter((_, i) => i !== index))
  }

  function handleSwitchStyleMode(targetMode: 'list' | 'json') {
    if (targetMode === styleMode) return
    if (targetMode === 'json') {
      setStyleJsonText(stringifyStyle(styleValues))
      setStyleMode('json')
      return
    }

    const parsed = parseStyleJson(styleJsonText, geometryType)
    if (parsed.error) {
      toast.error(parsed.error)
      return
    }
    setStyleValues(parsed.style)
    setStyleMode('list')
  }

  const styleDefinitions = useMemo(() => getStyleDefinitions(geometryType), [geometryType])

  function handleAddStyleProperty(key: string) {
    const definition = styleDefinitions.find((item) => item.key === key)
    if (!definition) return
    setStyleValues((current) => ({ ...current, [key]: definition.defaultValue }))
    setSelectedStyleKey('')
  }

  function handleUpdateStyleValue(key: keyof MapLayerDefaultStyle, rawValue: string | boolean) {
    const definition = styleDefinitions.find((item) => item.key === key)
    if (!definition) return
    let value: string | number | boolean | number[] = rawValue
    if (definition.type === 'number') value = Number(rawValue)
    if (definition.type === 'dasharray') {
      value = String(rawValue)
        .split(',')
        .map((item) => Number(item.trim()))
        .filter((item) => Number.isFinite(item))
    }
    setStyleValues((current) => ({ ...current, [key]: value }))
  }

  function handleRemoveStyleProperty(key: keyof MapLayerDefaultStyle) {
    setStyleValues((current) => {
      const next = { ...current }
      delete next[key]
      return next
    })
  }

  const geometryPreview = useMemo(() => {
    if (geometryType === 'raster') {
      return { error: null as string | null, geojson: null as GeoJSON.GeoJSON | null }
    }
    if (geometryType === 'point') {
      if (!latitude.trim() || !longitude.trim()) {
        return { error: null as string | null, geojson: null as GeoJSON.GeoJSON | null }
      }
      const lat = toNumber(latitude)
      const lng = toNumber(longitude)
      if (lat === null || lng === null) {
        return { error: 'Latitude/Longitude không hợp lệ', geojson: null }
      }
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return { error: 'Latitude/Longitude vượt phạm vi hợp lệ', geojson: null }
      }
      return {
        error: null,
        geojson: { type: 'Point', coordinates: [lng, lat] } as GeoJSON.Geometry,
      }
    }

    if (!geometryDataText.trim())
      return { error: null as string | null, geojson: null as GeoJSON.GeoJSON | null }
    try {
      const parsed = JSON.parse(geometryDataText.trim())
      const geojson = extractGeoJson(parsed)
      if (!geojson) return { error: 'Không nhận diện được GeoJSON để preview', geojson: null }
      return { error: null, geojson }
    } catch {
      return { error: 'JSON không hợp lệ', geojson: null }
    }
  }, [geometryType, geometryDataText, latitude, longitude])

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    // Dữ liệu hình học chỉ dùng để preview client; server không cần khi tạo/sửa
    // metadata layer (chỉ cần geometry_type). Nếu user có nhập → validate; không
    // nhập → bỏ qua, cho phép submit shell layer trống, nạp dữ liệu sau qua import.
    if (geometryType === 'point' && (latitude.trim() || longitude.trim())) {
      const lat = toNumber(latitude)
      const lng = toNumber(longitude)
      if (lat === null || lng === null) {
        toast.error('Latitude/Longitude không hợp lệ')
        return
      }
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        toast.error('Latitude/Longitude vượt phạm vi hợp lệ')
        return
      }
    }

    let properties: Record<string, unknown> | undefined
    if (propertiesText.trim()) {
      try {
        const parsed: unknown = JSON.parse(propertiesText.trim())
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          properties = parsed as Record<string, unknown>
        } else {
          toast.error('Properties phải là JSON object hợp lệ')
          return
        }
      } catch {
        toast.error('Properties phải là JSON hợp lệ')
        return
      }
    }

    let entriesToProcess: MapLayerLegendEntry[] = []
    if (legendMode === 'json') {
      if (legendJsonText.trim()) {
        try {
          const parsed = JSON.parse(legendJsonText.trim())
          if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.entries)) {
            toast.error('JSON chú giải không hợp lệ: phải có định dạng {"entries": [...] }')
            return
          }
          entriesToProcess = (parsed.entries as Record<string, unknown>[]).map((e) => ({
            label: typeof e?.label === 'string' ? e.label : '',
            color: typeof e?.color === 'string' ? e.color : '',
          }))
        } catch (err: unknown) {
          toast.error(
            `JSON chú giải không hợp lệ: ${err instanceof Error ? err.message : 'lỗi cú pháp'}`
          )
          return
        }
      }
    } else {
      entriesToProcess = legendEntries
    }

    const cleanedEntries: MapLayerLegendEntry[] = []
    for (let i = 0; i < entriesToProcess.length; i++) {
      const entry = entriesToProcess[i]
      const label = entry.label.trim()
      const color = entry.color.trim()
      if (!label && !color) continue
      if (!label) {
        toast.error(`Mục chú giải thứ ${i + 1} chưa có nhãn (label)`)
        return
      }
      if (!COLOR_HEX_REGEX.test(color)) {
        toast.error(
          `Mục chú giải "${label}" có mã màu "${color}" không hợp lệ (cần mã hex #RGB hoặc #RRGGBB)`
        )
        return
      }
      cleanedEntries.push({ label, color })
    }

    if (cleanedEntries.length > 50) {
      toast.error('Số lượng mục chú giải không được vượt quá 50 mục')
      return
    }

    const legend_config: MapLayerLegend | null =
      cleanedEntries.length > 0 ? { entries: cleanedEntries } : null

    let default_style: MapLayerDefaultStyle | null = null
    if (styleMode === 'json') {
      const parsedStyle = parseStyleJson(styleJsonText, geometryType)
      if (parsedStyle.error) {
        toast.error(parsedStyle.error)
        return
      }
      default_style = Object.keys(parsedStyle.style).length > 0 ? parsedStyle.style : null
    } else {
      const parsedStyle = parseStyleJson(JSON.stringify(styleValues), geometryType)
      if (parsedStyle.error) {
        toast.error(parsedStyle.error)
        return
      }
      default_style = Object.keys(parsedStyle.style).length > 0 ? parsedStyle.style : null
    }

    const fullValidation = mapLayerSchema.safeParse({
      category,
      layer_group: layerGroup.trim(),
      name: name.trim(),
      geometry_type: geometryType,
      properties: properties ?? null,
      is_active: isActive === 'true',
      is_public: isPublic === 'true',
    })
    if (!fullValidation.success) {
      const first = fullValidation.error.issues[0]
      toast.error(first?.message || 'Dữ liệu không hợp lệ')
      return
    }

    const code = isEdit && layer?.code ? layer.code : toLayerCode(name.trim())
    const trimmedLayerGroup = layerGroup.trim()
    onSubmit({
      code,
      name_vi: name.trim(),
      table_name: isEdit && layer?.table_name ? layer.table_name : code,
      schema_name: isEdit ? layer?.schema_name || 'gis' : 'gis',
      category,
      layer_kind: layerKind,
      layer_group: trimmedLayerGroup ? trimmedLayerGroup : null,
      geometry_type: toApiGeometryType(geometryType),
      epsg_code: 4326,
      is_active: isActive === 'true',
      is_public: isPublic === 'true',
      is_editable: true,
      default_style,
      legend_config,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        <DialogTitle>{isEdit ? 'Chỉnh sửa lớp dữ liệu' : 'Thêm lớp dữ liệu mới'}</DialogTitle>
        <DialogDescription>
          {isEdit
            ? 'Cập nhật thông tin lớp dữ liệu bản đồ'
            : 'Tạo lớp dữ liệu theo nhóm nghiệp vụ và kiểu hình học'}
        </DialogDescription>

        <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label>
              Nhóm lớp <span className="text-destructive">*</span>
            </Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Chọn nhóm lớp" />
              </SelectTrigger>
              <SelectContent>
                {MAP_LAYER_CATEGORY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>
              Loại lớp <span className="text-destructive">*</span>
            </Label>
            <Select
              value={layerKind}
              onValueChange={(v) => setLayerKind(v as 'basemap' | 'overlay')}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="basemap">Lớp nền</SelectItem>
                <SelectItem value="overlay">Lớp phủ</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">
              {layerKind === 'basemap'
                ? 'Lớp nền sẽ tự động được bật khi user vào bản đồ, hiển thị ở mục "Lớp nền" trong sidebar.'
                : 'Lớp phủ mặc định tắt, được gom nhóm theo "Nhóm lớp" trong sidebar.'}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="map-layer-group">Nhóm phụ </Label>
            <Input
              id="map-layer-group"
              value={layerGroup}
              onChange={(e) => setLayerGroup(e.target.value)}
              placeholder="Ví dụ: nhiet_do_be_mat"
              maxLength={80}
            />
            <p className="text-muted-foreground text-xs">Tùy chọn.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="map-layer-name">
              Tên lớp dữ liệu <span className="text-destructive">*</span>
            </Label>
            <Input
              id="map-layer-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nhập tên lớp dữ liệu"
            />
          </div>

          <div className="space-y-2">
            <Label>
              Kiểu hình học <span className="text-destructive">*</span>
            </Label>
            <Select
              value={geometryType}
              onValueChange={(v) => setGeometryType(v as typeof geometryType)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="point">Point</SelectItem>
                <SelectItem value="line">Line</SelectItem>
                <SelectItem value="polygon">Polygon</SelectItem>
                <SelectItem value="raster">Raster (GeoTIFF)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Trạng thái</Label>
            <Select value={isActive} onValueChange={(v) => setIsActive(v as 'true' | 'false')}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">Đang hoạt động</SelectItem>
                <SelectItem value="false">Ngừng hoạt động</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Phạm vi hiển thị</Label>
            <Select value={isPublic} onValueChange={(v) => setIsPublic(v as 'true' | 'false')}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="false">Nội bộ</SelectItem>
                <SelectItem value="true">Công khai trên WebGIS</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="border-border/80 bg-muted/20 space-y-3 rounded-lg border p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <Label className="text-sm font-semibold">Kiểu vẽ mặc định</Label>
                <p className="text-muted-foreground text-xs">
                  Màu sắc và cách hiển thị trên bản đồ Mapbox, theo kiểu {geometryType}.
                </p>
              </div>
              <div className="bg-background flex items-center gap-1 rounded-md border p-0.5">
                <Button
                  type="button"
                  variant={styleMode === 'list' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-7 px-2.5 text-xs"
                  onClick={() => handleSwitchStyleMode('list')}
                >
                  <List className="mr-1.5 size-3.5" aria-hidden="true" /> Danh sách
                </Button>
                <Button
                  type="button"
                  variant={styleMode === 'json' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-7 px-2.5 text-xs"
                  onClick={() => handleSwitchStyleMode('json')}
                >
                  <Code2 className="mr-1.5 size-3.5" aria-hidden="true" /> JSON
                </Button>
              </div>
            </div>
            {styleMode === 'json' ? (
              <Textarea
                rows={8}
                value={styleJsonText}
                onChange={(e) => setStyleJsonText(e.target.value)}
                placeholder={
                  '{\n  "fillColor": "#F0F0F0",\n  "fillOpacity": 0.15,\n  "strokeColor": "#333333",\n  "strokeWidth": 2\n}'
                }
                className="font-mono text-xs"
              />
            ) : (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Select value={selectedStyleKey} onValueChange={handleAddStyleProperty}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Chọn thuộc tính Mapbox..." />
                    </SelectTrigger>
                    <SelectContent>
                      {styleDefinitions
                        .filter((definition) => styleValues[definition.key] === undefined)
                        .map((definition) => (
                          <SelectItem key={definition.key} value={String(definition.key)}>
                            {definition.label} ({definition.key})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                {Object.entries(styleValues).map(([key, value]) => {
                  const definition = styleDefinitions.find((item) => item.key === key)
                  if (!definition) return null
                  return (
                    <div
                      key={key}
                      className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_auto] items-center gap-2"
                    >
                      <Label className="text-xs">
                        {definition.label}
                        <span className="text-muted-foreground block font-mono">{key}</span>
                      </Label>
                      {definition.type === 'color' ? (
                        <div className="flex gap-2">
                          <Input
                            type="color"
                            value={String(value)}
                            onChange={(e) =>
                              handleUpdateStyleValue(definition.key, e.target.value.toUpperCase())
                            }
                            className="h-9 w-12 cursor-pointer p-1"
                          />
                          <Input
                            value={String(value)}
                            onChange={(e) => handleUpdateStyleValue(definition.key, e.target.value)}
                          />
                        </div>
                      ) : definition.type === 'enum' ? (
                        <Select
                          value={String(value)}
                          onValueChange={(next) => handleUpdateStyleValue(definition.key, next)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {definition.options?.map((option) => (
                              <SelectItem key={option} value={option}>
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : definition.type === 'boolean' ? (
                        <Select
                          value={String(value)}
                          onValueChange={(next) =>
                            handleUpdateStyleValue(definition.key, next === 'true')
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="true">Có</SelectItem>
                            <SelectItem value="false">Không</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : definition.type === 'dasharray' ? (
                        <Input
                          value={Array.isArray(value) ? value.join(', ') : String(value)}
                          onChange={(e) => handleUpdateStyleValue(definition.key, e.target.value)}
                          placeholder="2, 2"
                        />
                      ) : (
                        <Input
                          type="number"
                          min={definition.min}
                          max={definition.max}
                          step={definition.step}
                          value={String(value)}
                          onChange={(e) => handleUpdateStyleValue(definition.key, e.target.value)}
                        />
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive size-8"
                        onClick={() => handleRemoveStyleProperty(definition.key)}
                        title="Xóa thuộc tính"
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                      </Button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Chú giải lớp bản đồ (Legend Config) */}
          <div className="border-border/80 bg-muted/20 space-y-3 rounded-lg border p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <Label className="text-sm font-semibold">Chú giải lớp bản đồ</Label>
                <p className="text-muted-foreground text-xs">
                  Cấu hình màu sắc và nhãn hiển thị trong bảng chú giải trên WebGIS.
                </p>
              </div>
              <div className="bg-background flex items-center gap-1 rounded-md border p-0.5">
                <Button
                  type="button"
                  variant={legendMode === 'list' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-7 px-2.5 text-xs"
                  onClick={() => handleSwitchLegendMode('list')}
                >
                  <List className="mr-1.5 size-3.5" aria-hidden="true" />
                  Danh sách
                </Button>
                <Button
                  type="button"
                  variant={legendMode === 'json' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-7 px-2.5 text-xs"
                  onClick={() => handleSwitchLegendMode('json')}
                >
                  <Code2 className="mr-1.5 size-3.5" aria-hidden="true" />
                  JSON
                </Button>
              </div>
            </div>

            {legendMode === 'list' ? (
              <div className="space-y-2.5">
                {legendEntries.length === 0 ? (
                  <div className="text-muted-foreground rounded-md border border-dashed py-4 text-center text-xs">
                    Chưa có mục chú giải nào. Nhấn &quot;Thêm mục chú giải&quot; bên dưới để tạo
                    mới.
                  </div>
                ) : (
                  <div className="max-h-60 space-y-2 overflow-y-auto pr-1">
                    {legendEntries.map((entry, index) => (
                      <div
                        // Entries are ordered form rows and have no persisted identifier.
                        // eslint-disable-next-line react-x/no-array-index-key
                        key={index}
                        className="flex items-center gap-2"
                      >
                        <div className="relative flex shrink-0 items-center">
                          <input
                            type="color"
                            className="border-border size-8 cursor-pointer rounded border bg-transparent p-0.5"
                            value={toFullHexColor(entry.color)}
                            onChange={(e) =>
                              handleUpdateLegendEntry(index, {
                                color: e.target.value.toUpperCase(),
                              })
                            }
                            title="Chọn màu"
                          />
                        </div>
                        <Input
                          className="w-24 shrink-0 font-mono text-xs uppercase"
                          value={entry.color}
                          onChange={(e) =>
                            handleUpdateLegendEntry(index, { color: e.target.value })
                          }
                          placeholder="#2D7B2E"
                          maxLength={7}
                        />
                        <Input
                          className="flex-1 text-sm"
                          value={entry.label}
                          onChange={(e) =>
                            handleUpdateLegendEntry(index, { label: e.target.value })
                          }
                          placeholder={`Nhãn chú giải (ví dụ: Rừng, Mặt nước...)`}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-destructive size-8 shrink-0"
                          onClick={() => handleRemoveLegendEntry(index)}
                          title="Xóa mục này"
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex justify-start">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={handleAddLegendEntry}
                  >
                    <Plus className="mr-1.5 size-3.5" aria-hidden="true" />
                    Thêm mục chú giải
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Textarea
                  rows={6}
                  value={legendJsonText}
                  onChange={(e) => setLegendJsonText(e.target.value)}
                  placeholder={`{\n  "entries": [\n    {"label": "Rừng", "color": "#2D7B2E"},\n    {"label": "Mặt nước", "color": "#1A73E8"}\n  ]\n}`}
                  className="font-mono text-xs"
                />
                <p className="text-muted-foreground text-[11px]">
                  Nhập cấu trúc JSON hợp lệ dạng:{' '}
                  <code>
                    &#123;&quot;entries&quot;: [&#123;&quot;label&quot;: &quot;...&quot;,
                    &quot;color&quot;: &quot;#hex&quot;&#125;]&#125;
                  </code>
                </p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".geojson,.json,.tif,.tiff,application/geo+json,application/json,image/tiff"
              className="hidden"
              onChange={handleOpenGeometryFile}
            />
            <div className="flex items-center justify-between gap-2">
              <Label>Dữ liệu hình học </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <FileJson className="size-4" aria-hidden="true" />
                Mở file GeoJSON / GeoTIFF
              </Button>
            </div>
            {geometryType === 'raster' ? (
              <div className="border-muted bg-muted/20 space-y-1 rounded-md border p-3">
                <p className="text-sm font-medium">Raster (GeoTIFF)</p>
                <p className="text-muted-foreground text-xs">
                  {rasterFileName ? `Đã ghi nhận: ${rasterFileName}` : 'Chưa chọn file raster.'}
                </p>
                <p className="text-muted-foreground text-xs">
                  Form chỉ lưu metadata (geometry_type = RASTER). Nạp file thực tế qua chức năng{' '}
                  <strong>Ingest Raster</strong> hoặc <strong>GeoServer Coverage Store</strong>.
                </p>
              </div>
            ) : geometryType === 'point' ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="latitude">Latitude</Label>
                  <Input
                    id="latitude"
                    value={latitude}
                    onChange={(e) => setLatitude(e.target.value)}
                    placeholder="Ví dụ: 14.35"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="longitude">Longitude</Label>
                  <Input
                    id="longitude"
                    value={longitude}
                    onChange={(e) => setLongitude(e.target.value)}
                    placeholder="Ví dụ: 108"
                  />
                </div>
              </div>
            ) : (
              <Textarea
                id="geometry-data"
                rows={8}
                value={geometryDataText}
                onChange={(e) => setGeometryDataText(e.target.value)}
                placeholder='{"type":"Polygon","coordinates":[[[108,14.3],[108.1,14.3],[108.1,14.4],[108,14.3]]]}'
              />
            )}
            {geometryType !== 'raster' && geometryPreview.error && (
              <p className="text-destructive text-xs">{geometryPreview.error}</p>
            )}
            {geometryType !== 'raster' && !geometryPreview.error && geometryPreview.geojson && (
              <div className="border-muted bg-muted/20 rounded-md border p-2">
                <p className="text-muted-foreground mb-2 text-xs">Preview bản đồ</p>
                <GeoJsonMapPreview geojson={geometryPreview.geojson} />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="properties">Properties (JSON, tùy chọn)</Label>
            <Textarea
              id="properties"
              rows={6}
              value={propertiesText}
              onChange={(e) => setPropertiesText(e.target.value)}
              placeholder='{"source":"survey","year":2026}'
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Hủy
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Đang xử lý...' : isEdit ? 'Cập nhật' : 'Tạo mới'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
