import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { mapLayerService, useApiQuery } from '@/service'
import GeoJsonMapPreview from '@/components/features/GeoJsonMapPreview'
import type { ApiResponse, MapLayer } from '@/types/api'
import { formatDateTime } from '@/lib/date'
import { StatusDotBadge } from '@/components/common/StatusDotBadge'
import { ACTIVE_LABEL, ACTIVE_CLASS, ACTIVE_DOT } from '@/constant/mapLayerConstant'

interface MapLayerDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  layerId: number | null
}

type MapLayerDetailData = MapLayer | { mapLayer?: MapLayer }

function extractGeoJson(raw: unknown): GeoJSON.GeoJSON | null {
  if (!raw) return null
  let value = raw
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw)
    } catch {
      return null
    }
  }
  if (!value || typeof value !== 'object') return null

  const obj = value as any
  if (obj.type === 'FeatureCollection' && Array.isArray(obj.features)) {
    return obj as GeoJSON.FeatureCollection
  }
  if (obj.type === 'Feature' && obj.geometry) {
    return obj as GeoJSON.Feature
  }
  if (typeof obj.type === 'string' && obj.coordinates) {
    return obj as GeoJSON.Geometry
  }
  return null
}

function formatJson(value: unknown): string {
  if (!value) return '-'
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

export default function MapLayerDetailDialog({
  open,
  onOpenChange,
  layerId,
}: MapLayerDetailDialogProps) {
  const dbQuery = useApiQuery(
    ['mapLayer', layerId],
    () => mapLayerService.getById(layerId!),
    { enabled: !!layerId && open, staleTime: 0 },
    false,
    false
  )

  const responseData = (dbQuery.data as ApiResponse<MapLayerDetailData>)?.data
  const layer =
    responseData && 'mapLayer' in responseData
      ? ((responseData as { mapLayer?: MapLayer }).mapLayer ?? null)
      : ((responseData as MapLayer) ?? null)
  const previewGeoJson = extractGeoJson(layer?.geometry_data)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] max-w-4xl overflow-y-auto">
        <DialogTitle>Chi tiết lớp dữ liệu bản đồ</DialogTitle>
        <DialogDescription>Thông tin chi tiết lớp dữ liệu đã chọn</DialogDescription>

        {layer ? (
          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <span className="font-semibold">ID:</span>
              <span className="col-span-2">{layer.id}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <span className="font-semibold">Tên lớp:</span>
              <span className="col-span-2">{layer.name_vi || layer.name || layer.code}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <span className="font-semibold">Nhóm lớp:</span>
              <span className="col-span-2">{layer.category || '-'}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <span className="font-semibold">Kiểu hình học:</span>
              <span className="col-span-2">{layer.geometry_type || '-'}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <span className="font-semibold">Trạng thái:</span>
              <span className="col-span-2">
                <StatusDotBadge
                  label={ACTIVE_LABEL[String(layer.is_active)]}
                  badgeClass={ACTIVE_CLASS[String(layer.is_active)]}
                  dotClass={ACTIVE_DOT[String(layer.is_active)]}
                />
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <span className="font-semibold">Ngày tạo:</span>
              <span className="col-span-2">
                {layer.created_at ? formatDateTime(layer.created_at) : '-'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <span className="font-semibold">Cập nhật:</span>
              <span className="col-span-2">
                {layer.updated_at ? formatDateTime(layer.updated_at) : '-'}
              </span>
            </div>

            <div className="space-y-2">
              <p className="font-semibold">Geometry Data</p>
              <pre className="bg-muted max-h-64 overflow-auto rounded-md p-3 text-xs">
                {formatJson(layer.geometry_data)}
              </pre>
            </div>
            {previewGeoJson && (
              <div className="space-y-2">
                <p className="font-semibold">Preview bản đồ</p>
                <GeoJsonMapPreview geojson={previewGeoJson} />
              </div>
            )}

            <div className="space-y-2">
              <p className="font-semibold">Properties</p>
              <pre className="bg-muted max-h-64 overflow-auto rounded-md p-3 text-xs">
                {formatJson(layer.properties)}
              </pre>
            </div>
          </div>
        ) : (
          <div>Không có dữ liệu</div>
        )}
      </DialogContent>
    </Dialog>
  )
}
