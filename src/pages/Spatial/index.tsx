import { useMemo, useState } from 'react'
import { mapLayerService, statisticsService, useApiMutation, useApiQuery } from '@/service'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { AdministrativeUnit, ForestType, MapLayer } from '@/types/api'
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  Layers3,
  MapPinned,
  RefreshCcw,
  Route,
  Trees,
} from 'lucide-react'

type SpatialForestType = Extract<ForestType, 'total' | 'natural' | 'planted'>

interface ForestChangeItem {
  unitCode?: string
  name?: string
  fromAreaHa?: number
  toAreaHa?: number
  deltaAreaHa?: number
  deltaPct?: number
  fromCoveragePct?: number | null
  toCoveragePct?: number | null
  trend?: 'increase' | 'decrease' | 'stable'
}

interface ForestChangeResponse {
  fromYear?: number
  toYear?: number
  forestType?: SpatialForestType
  items?: ForestChangeItem[]
  summary?: {
    unitCount?: number
    totalDeltaHa?: number
    increasedCount?: number
    decreasedCount?: number
  } | null
  rasterAnalysis?: {
    available?: boolean
    note?: string
  }
  no_data?: boolean
}

interface ResidentialDistanceResponse {
  type?: 'FeatureCollection'
  thresholdM?: number
  residentialLayer?: { code?: string; name?: string }
  forestLayer?: { code?: string; name?: string }
  features?: Array<{
    properties?: {
      featureId?: string
      distanceM?: number
    }
  }>
  metadata?: {
    returned?: number
    limit?: number
    thresholdM?: number
  }
}

const FOREST_TYPES: { value: SpatialForestType; label: string }[] = [
  { value: 'total', label: 'Tổng diện tích rừng' },
  { value: 'natural', label: 'Rừng tự nhiên' },
  { value: 'planted', label: 'Rừng trồng' },
]

const ALL_UNITS_VALUE = '__all_units__'

function formatNumber(value?: number | null, maximumFractionDigits = 2) {
  if (value == null || Number.isNaN(value)) return '-'
  return value.toLocaleString('vi-VN', { maximumFractionDigits })
}

function formatHa(value?: number | null) {
  if (value == null || Number.isNaN(value)) return '-'
  return `${value.toLocaleString('vi-VN', { maximumFractionDigits: 2 })} ha`
}

function formatPct(value?: number | null) {
  if (value == null || Number.isNaN(value)) return '-'
  return `${value.toLocaleString('vi-VN', { maximumFractionDigits: 2 })}%`
}

function layerLabel(layer: MapLayer) {
  return layer.name_vi || layer.name || layer.code
}

function getLayersPayload(data: any): MapLayer[] {
  const payload = data?.data
  if (Array.isArray(payload?.items)) return payload.items
  if (Array.isArray(payload?.mapLayers)) return payload.mapLayers
  if (Array.isArray(payload)) return payload
  return []
}

function matchesLayerKeywords(layer: MapLayer, keywords: string[]) {
  const haystack = [layer.code, layer.name_vi, layer.name_en, layer.table_name, layer.category]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  return keywords.some((keyword) => haystack.includes(keyword))
}

function getLayerSearchText(layer: MapLayer) {
  return [layer.code, layer.name_vi, layer.name_en, layer.table_name, layer.category]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

function isQueryableVectorLayer(layer: MapLayer) {
  const geometryType = String(layer.geometry_type ?? '').toUpperCase()
  return Boolean(layer.code && layer.table_name && geometryType !== 'RASTER')
}

function isForestDistanceLayer(layer: MapLayer) {
  const haystack = getLayerSearchText(layer)
  const isChangeLayer =
    haystack.includes('bien_dong') ||
    haystack.includes('biendong') ||
    haystack.includes('biến động') ||
    haystack.includes('bien dong') ||
    haystack.includes('change')

  if (isChangeLayer) return false

  return matchesLayerKeywords(layer, ['rừng', 'rung', 'forest', 'lớp phủ rừng', 'lop phu rung', 'lopphurung'])
}

function getMutationErrorMessage(error: unknown, fallback: string) {
  const err = error as { message?: string; body?: { message?: string; errors?: unknown[] } }
  const detail = Array.isArray(err?.body?.errors)
    ? err.body.errors
        .map((item) => (typeof item === 'string' ? item : (item as { message?: string })?.message))
        .filter(Boolean)
        .join(', ')
    : ''
  return [err?.body?.message || err?.message || fallback, detail].filter(Boolean).join(' - ')
}

export default function SpatialPage() {
  const [fromYear, setFromYear] = useState('2020')
  const [toYear, setToYear] = useState('2022')
  const [unitCode, setUnitCode] = useState('')
  const [forestType, setForestType] = useState<SpatialForestType>('total')

  const [residentialCode, setResidentialCode] = useState('')
  const [forestCode, setForestCode] = useState('')
  const [threshold, setThreshold] = useState('500')
  const [limit, setLimit] = useState('500')

  const unitsQuery = useApiQuery(
    ['spatial-admin-units', 'district'],
    () => statisticsService.getAdminUnits({ level: 'district' }),
    {},
    false,
    false
  )

  const layersQuery = useApiQuery(
    ['spatial-map-layers'],
    () => mapLayerService.getAll({ limit: 200, is_active: true }),
    {},
    false,
    false
  )

  const forestChangeMutation = useApiMutation(() =>
    statisticsService.getForestChange({
      from_year: Number(fromYear),
      to_year: Number(toYear),
      forest_type: forestType,
      unit_code: unitCode || undefined,
    })
  )

  const residentialMutation = useApiMutation(() =>
    statisticsService.getResidentialDistance({
      residential_code: residentialCode,
      forest_code: forestCode,
      threshold_m: Number(threshold) || undefined,
      limit: Number(limit) || undefined,
    })
  )

  const units = (unitsQuery.data?.data?.units ?? []) as AdministrativeUnit[]
  const layers = useMemo(() => getLayersPayload(layersQuery.data), [layersQuery.data])

  const residentialLayers = useMemo(() => {
    const queryableLayers = layers.filter(isQueryableVectorLayer)
    return queryableLayers.filter((layer) =>
      matchesLayerKeywords(layer, ['dân cư', 'dan cu', 'dancu', 'residential', 'khu dân', 'khu dan'])
    )
  }, [layers])

  const forestLayers = useMemo(() => {
    const queryableLayers = layers.filter(isQueryableVectorLayer)
    return queryableLayers.filter(isForestDistanceLayer)
  }, [layers])

  const unitOptions = useMemo(
    () => [
      { value: ALL_UNITS_VALUE, label: 'Tất cả đơn vị' },
      { value: '62', label: 'Tỉnh Kon Tum' },
      ...units.map((unit) => ({ value: unit.code, label: `${unit.name} (${unit.code})` })),
    ],
    [units]
  )

  const residentialLayerOptions = useMemo(
    () =>
      residentialLayers.map((layer) => ({
        value: layer.code,
        label: `${layerLabel(layer)} (${layer.code})`,
      })),
    [residentialLayers]
  )

  const forestLayerOptions = useMemo(
    () =>
      forestLayers.map((layer) => ({
        value: layer.code,
        label: `${layerLabel(layer)} (${layer.code})`,
      })),
    [forestLayers]
  )

  const forestResult = (forestChangeMutation.data?.data ?? {}) as ForestChangeResponse
  const forestData = forestResult.items ?? []
  const residentialResult = (residentialMutation.data?.data ?? {}) as ResidentialDistanceResponse
  const residentialFeatures = residentialResult.features ?? []

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="shrink-0 space-y-2 border-b p-6 pb-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Phân tích không gian</h1>
            <p className="text-muted-foreground text-sm">
              Công cụ phân tích biến động rừng và khoảng cách dân cư - rừng từ dữ liệu GIS đã import.
            </p>
          </div>
          <Badge variant="outline" className="w-fit gap-1">
            <Layers3 className="size-3.5" />
            Spatial / PostGIS
          </Badge>
        </div>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto p-6">
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Trees className="text-primary size-5" />
                  Thay đổi lớp phủ rừng
                </CardTitle>
                <CardDescription>
                  So sánh diện tích và tỷ lệ che phủ rừng giữa hai mốc thời gian.
                </CardDescription>
              </div>
              {forestResult.rasterAnalysis?.available === false && (
                <Badge variant="secondary" className="w-fit">
                  Chưa có raster/NDVI
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <div className="space-y-1.5">
                <Label htmlFor="from-year">Từ năm</Label>
                <Input
                  id="from-year"
                  type="number"
                  min="2000"
                  max="2100"
                  value={fromYear}
                  onChange={(e) => setFromYear(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="to-year">Đến năm</Label>
                <Input
                  id="to-year"
                  type="number"
                  min="2000"
                  max="2100"
                  value={toYear}
                  onChange={(e) => setToYear(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Loại rừng</Label>
                <DropdownSelect
                  value={forestType}
                  options={FOREST_TYPES}
                  onChange={(value) => setForestType(value as SpatialForestType)}
                />
              </div>
              <div className="space-y-1.5 xl:col-span-2">
                <Label>Mã đơn vị</Label>
                <DropdownSelect
                  value={unitCode || ALL_UNITS_VALUE}
                  options={unitOptions}
                  onChange={(value) => setUnitCode(value === ALL_UNITS_VALUE ? '' : value)}
                  disabled={unitsQuery.isFetching}
                  placeholder="Chọn đơn vị hành chính"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button
                onClick={() => forestChangeMutation.mutate(undefined as any)}
                disabled={
                  forestChangeMutation.isPending ||
                  !fromYear ||
                  !toYear ||
                  fromYear === toYear
                }
                className="w-full sm:w-auto"
              >
                {forestChangeMutation.isPending ? (
                  <RefreshCcw className="mr-2 size-4 animate-spin" />
                ) : (
                  <BarChart3 className="mr-2 size-4" />
                )}
                Phân tích biến động
              </Button>
              {fromYear === toYear && (
                <p className="text-destructive text-sm">Hai mốc thời gian phải khác nhau.</p>
              )}
            </div>

            {forestResult.summary && (
              <div className="grid gap-3 md:grid-cols-4">
                <MetricCard label="Đơn vị phân tích" value={formatNumber(forestResult.summary.unitCount, 0)} />
                <MetricCard label="Tổng biến động" value={formatHa(forestResult.summary.totalDeltaHa)} />
                <MetricCard label="Tăng diện tích" value={formatNumber(forestResult.summary.increasedCount, 0)} />
                <MetricCard label="Giảm diện tích" value={formatNumber(forestResult.summary.decreasedCount, 0)} />
              </div>
            )}

            <div className="overflow-hidden rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Đơn vị</TableHead>
                    <TableHead>Mã</TableHead>
                    <TableHead className="text-right">Diện tích đầu kỳ</TableHead>
                    <TableHead className="text-right">Diện tích cuối kỳ</TableHead>
                    <TableHead className="text-right">Biến động</TableHead>
                    <TableHead className="text-right">Tỷ lệ</TableHead>
                    <TableHead>Xu hướng</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {forestData.map((item, index) => (
                    <TableRow key={item.unitCode ?? index}>
                      <TableCell className="font-medium">{item.name ?? '-'}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {item.unitCode ?? '-'}
                      </TableCell>
                      <TableCell className="text-right">{formatHa(item.fromAreaHa)}</TableCell>
                      <TableCell className="text-right">{formatHa(item.toAreaHa)}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatHa(item.deltaAreaHa)}
                      </TableCell>
                      <TableCell className="text-right">{formatPct(item.deltaPct)}</TableCell>
                      <TableCell>
                        <TrendBadge trend={item.trend} />
                      </TableCell>
                    </TableRow>
                  ))}
                  {!forestData.length && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-muted-foreground h-24 text-center">
                        {forestChangeMutation.isPending
                          ? 'Đang phân tích dữ liệu...'
                          : 'Chọn tham số và bấm phân tích để xem kết quả.'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {forestResult.rasterAnalysis?.note && (
              <p className="text-muted-foreground text-xs">{forestResult.rasterAnalysis.note}</p>
            )}

            {forestChangeMutation.isError && (
              <ErrorNotice
                message={getMutationErrorMessage(
                  forestChangeMutation.error,
                  'Không thể phân tích biến động rừng.'
                )}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Route className="text-primary size-5" />
              Khoảng cách dân cư - rừng
            </CardTitle>
            <CardDescription>
              Tìm các đối tượng dân cư nằm trong ngưỡng khoảng cách tới lớp rừng đã chọn.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-1.5">
                <Label>Layer dân cư</Label>
                <DropdownSelect
                  value={residentialCode}
                  options={residentialLayerOptions}
                  onChange={setResidentialCode}
                  disabled={layersQuery.isFetching || !residentialLayers.length}
                  placeholder={layersQuery.isFetching ? 'Đang tải layer...' : 'Chọn layer dân cư'}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Layer rừng</Label>
                <DropdownSelect
                  value={forestCode}
                  options={forestLayerOptions}
                  onChange={setForestCode}
                  disabled={layersQuery.isFetching || !forestLayers.length}
                  placeholder={layersQuery.isFetching ? 'Đang tải layer...' : 'Chọn layer rừng'}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="threshold">Ngưỡng khoảng cách (m)</Label>
                <Input
                  id="threshold"
                  type="number"
                  min="1"
                  max="50000"
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="limit">Giới hạn kết quả</Label>
                <Input
                  id="limit"
                  type="number"
                  min="1"
                  max="5000"
                  value={limit}
                  onChange={(e) => setLimit(e.target.value)}
                />
              </div>
            </div>

            {!layersQuery.isFetching && !layers.length && (
              <p className="text-muted-foreground rounded-md border border-dashed p-3 text-sm">
                Chưa có layer GIS khả dụng trong registry. Hãy import hoặc kích hoạt layer trước khi phân tích.
              </p>
            )}

            {!layersQuery.isFetching && Boolean(layers.length) && (!residentialLayers.length || !forestLayers.length) && (
              <p className="text-muted-foreground rounded-md border border-dashed p-3 text-sm">
                Chưa tìm thấy đủ layer dân cư và layer rừng dạng vector phù hợp. Hãy kiểm tra mã, tên, nhóm layer trong registry trước khi phân tích.
              </p>
            )}

            <Button
              onClick={() => residentialMutation.mutate(undefined as any)}
              disabled={
                residentialMutation.isPending ||
                !residentialCode ||
                !forestCode ||
                residentialCode === forestCode
              }
              className="w-full sm:w-auto"
            >
              {residentialMutation.isPending ? (
                <RefreshCcw className="mr-2 size-4 animate-spin" />
              ) : (
                <MapPinned className="mr-2 size-4" />
              )}
              Phân tích khoảng cách
            </Button>

            {residentialCode && forestCode && residentialCode === forestCode && (
              <p className="text-destructive text-sm">Layer dân cư và layer rừng phải khác nhau.</p>
            )}

            {residentialMutation.isError && (
              <ErrorNotice
                message={getMutationErrorMessage(
                  residentialMutation.error,
                  'Không thể phân tích khoảng cách dân cư - rừng.'
                )}
              />
            )}

            {residentialMutation.data && (
              <div className="grid gap-3 md:grid-cols-3">
                <MetricCard
                  label="Đối tượng phù hợp"
                  value={formatNumber(residentialResult.metadata?.returned ?? residentialFeatures.length, 0)}
                />
                <MetricCard
                  label="Ngưỡng phân tích"
                  value={`${formatNumber(residentialResult.thresholdM ?? Number(threshold), 0)} m`}
                />
                <MetricCard
                  label="Giới hạn trả về"
                  value={formatNumber(residentialResult.metadata?.limit ?? Number(limit), 0)}
                />
              </div>
            )}

            <div className="overflow-hidden rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Feature ID</TableHead>
                    <TableHead className="text-right">Khoảng cách gần nhất</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {residentialFeatures.slice(0, 10).map((feature, index) => (
                    <TableRow key={feature.properties?.featureId ?? index}>
                      <TableCell className="font-mono text-xs">
                        {feature.properties?.featureId ?? '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatNumber(feature.properties?.distanceM)} m
                      </TableCell>
                    </TableRow>
                  ))}
                  {!residentialFeatures.length && (
                    <TableRow>
                      <TableCell colSpan={2} className="text-muted-foreground h-24 text-center">
                        {residentialMutation.isPending
                          ? 'Đang phân tích khoảng cách...'
                          : 'Chọn hai layer và bấm phân tích để xem kết quả.'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {residentialFeatures.length > 10 && (
              <p className="text-muted-foreground text-xs">
                Đang hiển thị 10 đối tượng gần nhất trong tổng số {residentialFeatures.length} kết quả.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function DropdownSelect({
  value,
  options,
  onChange,
  disabled,
  placeholder = 'Chọn',
}: {
  value: string
  options: Array<{ value: string; label: string }>
  onChange: (value: string) => void
  disabled?: boolean
  placeholder?: string
}) {
  const selectedLabel = options.find((option) => option.value === value)?.label

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" className="w-full justify-between" disabled={disabled}>
          <span className="truncate">{selectedLabel ?? placeholder}</span>
          <ChevronDown className="size-4 shrink-0 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-(--radix-dropdown-menu-trigger-width)">
        {options.map((option) => (
          <DropdownMenuItem key={option.value} onSelect={() => onChange(option.value)}>
            {option.label}
          </DropdownMenuItem>
        ))}
        {!options.length && <DropdownMenuItem disabled>Chưa có dữ liệu</DropdownMenuItem>}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-4">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  )
}

function ErrorNotice({ message }: { message: string }) {
  return (
    <div className="border-destructive/20 bg-destructive/10 text-destructive flex items-start gap-2 rounded-md border p-3 text-sm">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <p>{message}</p>
    </div>
  )
}

function TrendBadge({ trend }: { trend?: ForestChangeItem['trend'] }) {
  if (trend === 'increase') {
    return (
      <Badge className="border-success/20 bg-success/10 text-success hover:bg-success/10">
        Tăng
      </Badge>
    )
  }

  if (trend === 'decrease') {
    return <Badge variant="destructive">Giảm</Badge>
  }

  return (
    <Badge variant="outline" className="gap-1">
      <CheckCircle2 className="size-3" />
      Ổn định
    </Badge>
  )
}
