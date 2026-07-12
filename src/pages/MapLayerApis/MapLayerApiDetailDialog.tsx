import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { mapLayerApiService, useApiQuery } from '@/service'
import type { ApiResponse, MapLayerApi } from '@/types/api'
import { formatDateTime } from '@/lib/date'
import { getMappedErrorMessage } from '@/validators/mapLayerApiValidators'
import { StatusDotBadge } from '@/components/common/StatusDotBadge'
import { ACTIVE_CLASS, ACTIVE_DOT, ACTIVE_LABEL } from '@/constant/mapLayerConstant'

interface MapLayerApiDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  apiId: number | null
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <span className="font-semibold">{label}:</span>
      <span className="col-span-2">{children}</span>
    </div>
  )
}

export default function MapLayerApiDetailDialog({
  open,
  onOpenChange,
  apiId,
}: MapLayerApiDetailDialogProps) {
  const detailQuery = useApiQuery(
    ['mapLayerApiDetailDialog', apiId],
    () => mapLayerApiService.getById(apiId!),
    { enabled: !!apiId && open, staleTime: 0 },
    false,
    false
  )

  const api = (() => {
    const data = (detailQuery.data as ApiResponse<any> | undefined)?.data
    return (data ? (data.api ?? data) : null) as MapLayerApi | null
  })()

  const errorMessage = detailQuery.error
    ? getMappedErrorMessage(detailQuery.error, 'Không tải được chi tiết API key')
    : ''

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] max-w-4xl overflow-y-auto">
        <DialogTitle>Chi tiết API key bản đồ</DialogTitle>
        <DialogDescription>Thông tin key, lớp dữ liệu được chia sẻ và giới hạn truy cập</DialogDescription>

        {errorMessage && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        {detailQuery.isLoading && <div className="mt-4">Đang tải dữ liệu...</div>}

        {api ? (
          <div className="mt-4 space-y-3">
            <DetailRow label="ID">{api.id}</DetailRow>
            <DetailRow label="Tên key">{api.name}</DetailRow>
            <DetailRow label="Lớp dữ liệu">
              <span>{api.layer_name_vi ?? api.layer_code ?? '-'}</span>
              {api.layer_code && <span className="text-muted-foreground ml-2 text-xs">({api.layer_code})</span>}
            </DetailRow>
            <DetailRow label="Key nhận diện">
              <span className="font-mono text-sm">
                {api.key_prefix ? `${api.key_prefix}...${api.key_last4 ?? ''}` : '-'}
              </span>
            </DetailRow>
            <DetailRow label="Scope">
              <span className="font-mono text-sm break-all">{JSON.stringify(api.scope ?? {}, null, 2)}</span>
            </DetailRow>
            <DetailRow label="Trạng thái">
              <StatusDotBadge
                label={ACTIVE_LABEL[String(api.is_active)]}
                badgeClass={ACTIVE_CLASS[String(api.is_active)]}
                dotClass={ACTIVE_DOT[String(api.is_active)]}
              />
            </DetailRow>
            <DetailRow label="Hết hạn">{api.expires_at ? formatDateTime(api.expires_at) : 'Không hết hạn'}</DetailRow>
            <DetailRow label="Lượt gọi">{api.request_count ?? 0}</DetailRow>
            <DetailRow label="Lần dùng cuối">
              {api.last_used_at ? formatDateTime(api.last_used_at) : 'Chưa sử dụng'}
            </DetailRow>
            <DetailRow label="Ngày tạo">{formatDateTime(api.created_at ?? api.createdAt)}</DetailRow>
            <DetailRow label="Cập nhật">{formatDateTime(api.updated_at ?? api.updatedAt)}</DetailRow>
          </div>
        ) : (
          !detailQuery.isLoading && (
            <div className="text-muted-foreground mt-4">Không có dữ liệu</div>
          )
        )}
      </DialogContent>
    </Dialog>
  )
}
