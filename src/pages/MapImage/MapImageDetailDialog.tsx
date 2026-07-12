import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { mapImageService, useApiQuery } from '@/service'
import type { ApiResponse, MapImage } from '@/types/api'
import { parseLink, isPdf } from '@/lib/utils'
import { UserText } from '@/components/common/UserText'
import { formatDateTime } from '@/lib/date'
import { FileImage } from 'phosphor-react'
interface MapImageDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mapImageId: number | null
}

export default function MapImageDetailDialog({
  open,
  onOpenChange,
  mapImageId,
}: MapImageDetailDialogProps) {
  const dbQuery = useApiQuery(
    ['mapImage', mapImageId],
    () => mapImageService.getById(mapImageId!),
    { enabled: !!mapImageId && open, staleTime: 0 },
    false,
    false
  )
  const mapImage = (() => {
    const d = (dbQuery.data as ApiResponse<any>)?.data
    return (d ? (d.mapImage ?? d.pdfMap ?? d) : null) as MapImage | null
  })()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] max-w-3xl overflow-y-auto">
        <DialogTitle>Chi tiết ảnh bản đồ</DialogTitle>
        <DialogDescription>Thông tin chi tiết ảnh bản đồ đã chọn</DialogDescription>

        {mapImage ? (
          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <span className="font-semibold">ID:</span>
              <span className="col-span-2">{mapImage.id}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <span className="font-semibold">Tên:</span>
              <span className="col-span-2">{mapImage.name}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <span className="font-semibold">Mô tả:</span>
              <span className="col-span-2">{mapImage.description || '-'}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <span className="font-semibold">Trạng thái:</span>
              <span className="col-span-2">
                {mapImage.is_active ? (
                  <Badge variant="default">Kích hoạt</Badge>
                ) : (
                  <Badge variant="secondary">Không kích hoạt</Badge>
                )}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <span className="font-semibold">Ảnh:</span>
              <span className="col-span-2">
                {mapImage.image_url ? (
                  isPdf(mapImage.image_url) ? (
                    <div className="flex h-64 items-center justify-center rounded-md border bg-gradient-to-br from-sky-50 to-sky-100">
                      <div className="text-center">
                        <FileImage className="mx-auto mb-2 h-12 w-12 text-sky-700" />
                        <span className="text-sm font-medium text-sky-700">PDF File</span>
                      </div>
                    </div>
                  ) : (
                    <img
                      src={parseLink(mapImage.image_url)}
                      alt={mapImage.name}
                      className="max-h-64 w-full rounded-md border object-contain"
                    />
                  )
                ) : (
                  '-'
                )}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <span className="font-semibold">Tạo bởi:</span>
              <span className="col-span-2">
                <UserText userId={mapImage.created_by} />
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <span className="font-semibold">Ngày tạo:</span>
              <span className="col-span-2">
                {mapImage.created_at ? formatDateTime(mapImage.created_at) : '-'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <span className="font-semibold">Cập nhật lúc:</span>
              <span className="col-span-2">
                {mapImage.updated_at ? formatDateTime(mapImage.updated_at) : '-'}
              </span>
            </div>
          </div>
        ) : (
          <div className="text-muted-foreground py-8 text-center">Đang tải dữ liệu...</div>
        )}
      </DialogContent>
    </Dialog>
  )
}
