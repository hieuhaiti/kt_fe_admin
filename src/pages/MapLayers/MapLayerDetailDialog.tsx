import type { ReactNode } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { mapLayerService, useApiQuery } from '@/service'
import type { ApiResponse, MapLayer } from '@/types/api'
import { formatDateTime } from '@/lib/date'
import { getMapLayerCategoryLabel } from '@/constant/mapLayerConstant'
import {
  buildGeoserverDownloadUrl,
  buildGeoserverGeoJsonUrl,
  downloadGeoJsonFile,
  downloadRasterFile,
} from '@/lib/geoserver'
import { toast } from 'react-toastify'
import { useState } from 'react'
import {
  CalendarClock,
  Database,
  Download,
  Info,
  RefreshCw,
} from 'lucide-react'

interface MapLayerDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  layerCode: string | null
}

type MapLayerDetailData = MapLayer | { mapLayer?: MapLayer }

const LAYER_KIND_LABEL: Record<string, string> = {
  basemap: 'Lớp nền',
  overlay: 'Lớp chuyên đề',
}

function getLayerDetail(response?: ApiResponse<MapLayerDetailData>): MapLayer | null {
  const data = response?.data
  if (!data) return null
  if ('mapLayer' in data) return data.mapLayer ?? null
  return data as MapLayer
}

function formatJson(value: unknown): string {
  if (value === null || value === undefined) return '-'
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function formatCount(value?: number | string | null): string {
  if (value === null || value === undefined || value === '') return '-'
  const count = Number(value)
  return Number.isFinite(count) ? count.toLocaleString('vi-VN') : String(value)
}

function CodeValue({ children }: { children?: ReactNode }) {
  if (children === null || children === undefined || children === '') return <>-</>
  return (
    <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs break-all">{children}</code>
  )
}

function DetailField({
  label,
  children,
  wide = false,
}: {
  label: string
  children: ReactNode
  wide?: boolean
}) {
  return (
    <div className={wide ? 'space-y-1 sm:col-span-2' : 'space-y-1'}>
      <dt className="text-muted-foreground text-xs font-medium">{label}</dt>
      <dd className="text-sm break-words">{children ?? '-'}</dd>
    </div>
  )
}

function JsonValue({
  value,
  emptyLabel,
}: {
  value?: Record<string, unknown> | GeoJSON.Geometry | null
  emptyLabel: string
}) {
  if (!value || Object.keys(value).length === 0) {
    return <p className="text-muted-foreground text-sm">{emptyLabel}</p>
  }

  return (
    <pre className="bg-muted/60 max-h-56 overflow-auto rounded-md border p-3 text-xs whitespace-pre-wrap">
      {formatJson(value)}
    </pre>
  )
}

function BooleanBadge({
  value,
  trueLabel,
  falseLabel,
  tone = 'success',
}: {
  value?: boolean
  trueLabel: string
  falseLabel: string
  tone?: 'success' | 'info' | 'warning'
}) {
  if (value === undefined) return <Badge variant="secondary">Chưa xác định</Badge>

  const toneClass = {
    info: 'border-info/30 bg-info/10 text-info',
    success: 'border-success/30 bg-success/10 text-success',
    warning: 'border-warning/30 bg-warning/10 text-warning',
  }[tone]

  return (
    <Badge variant="outline" className={value ? toneClass : 'text-muted-foreground'}>
      {value ? trueLabel : falseLabel}
    </Badge>
  )
}

export default function MapLayerDetailDialog({
  open,
  onOpenChange,
  layerCode,
}: MapLayerDetailDialogProps) {
  const dbQuery = useApiQuery(
    ['mapLayer', layerCode],
    () => mapLayerService.getByCode(layerCode!),
    { enabled: !!layerCode && open, staleTime: 0 },
    false,
    false
  )

  const layer = getLayerDetail(dbQuery.data as ApiResponse<MapLayerDetailData> | undefined)
  const isPublished = !!layer?.geoserver_layer
  const createdAt = layer?.created_at ?? layer?.createdAt
  const updatedAt = layer?.updated_at ?? layer?.updatedAt

  // Auto-detect định dạng nguồn:
  //  1. geometry_type = RASTER → chắc chắn TIFF (coverage).
  //  2. source_url chứa .tif/.tiff → gốc là GeoTIFF, ưu tiên tải TIFF dù metadata
  //     có thể ghi POLYGON (backend đã vectorize để hiển thị, nhưng file gốc
  //     vẫn nằm trên GeoServer dưới dạng coverage store cùng tên).
  //  3. Còn lại → dùng GeoJSON (WFS).
  const hasTiffSource = /\.(tif|tiff)($|[?#])/i.test(String(layer?.source_url || ''))
  const isRaster = String(layer?.geometry_type || '').toUpperCase() === 'RASTER'
  const preferTiff = isRaster || hasTiffSource
  const geoJsonUrl = buildGeoserverGeoJsonUrl(layer?.geoserver_layer)
  const geoTiffUrl = buildGeoserverDownloadUrl(layer?.geoserver_layer)
  const downloadUrl = preferTiff ? geoTiffUrl : geoJsonUrl
  const downloadFormatLabel = preferTiff ? 'GeoTIFF' : 'GeoJSON'
  const canDownload = !!(layer && isPublished && downloadUrl)
  const [downloading, setDownloading] = useState(false)

  async function handleDownload() {
    if (!layer || !downloadUrl) return
    const baseName = layer.code || layer.name_vi || 'layer'
    setDownloading(true)
    try {
      if (preferTiff) {
        await downloadRasterFile(downloadUrl, baseName)
      } else {
        await downloadGeoJsonFile(downloadUrl, baseName)
      }
      toast.success(`Đã tải xuống ${downloadFormatLabel}`)
    } catch (err: any) {
      toast.error(err?.message || `Không thể tải ${downloadFormatLabel}`)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-[calc(100%-2rem)] max-w-5xl flex-col gap-0 overflow-hidden p-0">
        <div className="shrink-0 border-b px-6 py-5 pr-12">
          <DialogTitle>Chi tiết lớp dữ liệu bản đồ</DialogTitle>
          <DialogDescription className="mt-1">
            Thông tin metadata, nguồn dữ liệu và cấu hình công bố của lớp đã chọn
          </DialogDescription>
        </div>

        {dbQuery.isLoading ? (
          <div
            className="text-muted-foreground flex min-h-56 items-center justify-center gap-2 px-6"
            role="status"
          >
            <RefreshCw className="size-4 animate-spin" aria-hidden="true" />
            Đang tải thông tin lớp dữ liệu...
          </div>
        ) : dbQuery.isError ? (
          <div className="flex min-h-56 flex-col items-center justify-center gap-3 px-6 text-center">
            <p className="text-destructive" role="alert">
              Không thể tải thông tin lớp dữ liệu.
            </p>
            <Button variant="outline" size="sm" onClick={() => dbQuery.refetch()}>
              <RefreshCw className="size-4" aria-hidden="true" />
              Thử lại
            </Button>
          </div>
        ) : layer ? (
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <div className="mb-5">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold break-words">
                    {layer.name_vi || layer.name || layer.code}
                  </h3>
                  <div className="text-muted-foreground mt-1 flex items-center gap-2 text-sm">
                    <span>Mã lớp</span>
                    <CodeValue>{layer.code}</CodeValue>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <BooleanBadge
                    value={layer.is_active}
                    trueLabel="Đang hoạt động"
                    falseLabel="Ngừng hoạt động"
                  />
                  <BooleanBadge
                    value={layer.is_public}
                    trueLabel="Công khai"
                    falseLabel="Nội bộ"
                    tone="info"
                  />
                  <Badge
                    variant="outline"
                    className={
                      isPublished ? 'border-info/30 bg-info/10 text-info' : 'text-muted-foreground'
                    }
                  >
                    {isPublished ? 'Đã công bố bản đồ' : 'Chưa công bố bản đồ'}
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!canDownload || downloading}
                    onClick={handleDownload}
                    title={
                      canDownload
                        ? preferTiff
                          ? 'Tải file GeoTIFF gốc (WCS)'
                          : 'Tải feature vector dạng GeoJSON (WFS)'
                        : 'Layer chưa công bố lên GeoServer'
                    }
                  >
                    <Download className="size-4" aria-hidden="true" />
                    {downloading ? `Đang tải ${downloadFormatLabel}…` : `Tải ${downloadFormatLabel}`}
                  </Button>
                </div>
              </div>
              {layer.description_vi && (
                <p className="text-muted-foreground mt-3 text-sm whitespace-pre-wrap">
                  {layer.description_vi}
                </p>
              )}
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Info className="text-primary size-4" aria-hidden="true" />
                    Thông tin nghiệp vụ
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
                    <DetailField label="ID">{layer.id ?? '-'}</DetailField>
                    <DetailField label="Mã lớp">
                      <CodeValue>{layer.code}</CodeValue>
                    </DetailField>
                    <DetailField label="Tên tiếng Việt">{layer.name_vi || '-'}</DetailField>
                    <DetailField label="Tên tiếng Anh">{layer.name_en || '-'}</DetailField>
                    <DetailField label="Mô tả tiếng Việt" wide>
                      <span className="whitespace-pre-wrap">{layer.description_vi || '-'}</span>
                    </DetailField>
                    <DetailField label="Mô tả tiếng Anh" wide>
                      <span className="whitespace-pre-wrap">{layer.description_en || '-'}</span>
                    </DetailField>
                    <DetailField label="Danh mục">
                      {getMapLayerCategoryLabel(layer.category)}
                    </DetailField>
                    <DetailField label="Loại lớp">
                      {layer.layer_kind
                        ? (LAYER_KIND_LABEL[layer.layer_kind] ?? layer.layer_kind)
                        : '-'}
                    </DetailField>
                    <DetailField label="Nhóm dữ liệu">
                      <CodeValue>{layer.layer_group}</CodeValue>
                    </DetailField>
                    <DetailField label="Năm dữ liệu">{layer.data_year ?? '-'}</DetailField>
                    <DetailField label="Thứ tự hiển thị">{layer.sort_order ?? '-'}</DetailField>
                  </dl>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Database className="text-primary size-4" aria-hidden="true" />
                    Dữ liệu không gian
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
                    <DetailField label="Kiểu dữ liệu">
                      <Badge variant="secondary">{layer.geometry_type || '-'}</Badge>
                    </DetailField>
                    <DetailField label="Hệ tọa độ">
                      {layer.epsg_code ? <CodeValue>EPSG:{layer.epsg_code}</CodeValue> : '-'}
                    </DetailField>
                    <DetailField label="Schema">
                      <CodeValue>{layer.schema_name}</CodeValue>
                    </DetailField>
                    <DetailField label="Bảng dữ liệu">
                      <CodeValue>{layer.table_name}</CodeValue>
                    </DetailField>
                    <DetailField label="Cột hình học">
                      <CodeValue>{layer.geometry_column}</CodeValue>
                    </DetailField>
                    <DetailField label="Số đối tượng">
                      {formatCount(layer.feature_count)}
                    </DetailField>
                    <DetailField label="Mức zoom nhỏ nhất">{layer.min_zoom ?? '-'}</DetailField>
                    <DetailField label="Mức zoom lớn nhất">{layer.max_zoom ?? '-'}</DetailField>
                    <DetailField label="Trường nhãn">
                      <CodeValue>{layer.label_field}</CodeValue>
                    </DetailField>
                    <DetailField label="Phạm vi không gian" wide>
                      <JsonValue value={layer.bbox} emptyLabel="Chưa có thông tin phạm vi." />
                    </DetailField>
                  </dl>
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <CalendarClock className="text-primary size-4" aria-hidden="true" />
                    Thời gian cập nhật
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-3">
                    <DetailField label="Ngày tạo">
                      {createdAt ? formatDateTime(createdAt) : '-'}
                    </DetailField>
                    <DetailField label="Cập nhật metadata">
                      {updatedAt ? formatDateTime(updatedAt) : '-'}
                    </DetailField>
                    <DetailField label="Cập nhật dữ liệu gần nhất">
                      {layer.last_updated_at ? formatDateTime(layer.last_updated_at) : '-'}
                    </DetailField>
                  </dl>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          <div className="text-muted-foreground flex min-h-56 items-center justify-center px-6">
            Không có dữ liệu lớp bản đồ.
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
