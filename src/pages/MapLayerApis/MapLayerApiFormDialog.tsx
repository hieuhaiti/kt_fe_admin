import { useMemo } from 'react'
import { toast } from 'react-toastify'
import { AlertCircle, Loader2, Pen, Plus } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import MapLayerApiForm from '@/components/map-layer-apis/MapLayerApiForm'
import { mapLayerApiService, useApiMutation, useApiQuery } from '@/service'
import type { ApiResponse, CreateMapLayerApiBody, MapLayerApi } from '@/types/api'
import {
  getMappedErrorMessage,
  validateCreatePayload,
  validateUpdatePayload,
} from '@/validators/mapLayerApiValidators'

interface MapLayerApiFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  apiId: number | null
  onSaved?: () => void
}

export default function MapLayerApiFormDialog({
  open,
  onOpenChange,
  apiId,
  onSaved,
}: MapLayerApiFormDialogProps) {
  const isEdit = !!apiId

  const detailQuery = useApiQuery(
    ['mapLayerApiDetailEditDialog', apiId],
    () => mapLayerApiService.getById(apiId!),
    { enabled: !!apiId && open, staleTime: 0 },
    false,
    false
  )

  const initialData = (() => {
    const d = (detailQuery.data as ApiResponse<any> | undefined)?.data
    return (d ? (d.api ?? d) : null) as MapLayerApi | null
  })()

  const createMutation = useApiMutation(
    (payload: CreateMapLayerApiBody) => mapLayerApiService.create(payload),
    {
      onSuccess: (response: any) => {
        const rawKey = response?.data?.apiKey || response?.data?.raw_key
        toast.success(rawKey ? `Tạo API key thành công: ${rawKey}` : 'Tạo API key thành công', {
          autoClose: rawKey ? 12000 : 3000,
        })
        onSaved?.()
        onOpenChange(false)
      },
      onError: (error) => {
        toast.error(getMappedErrorMessage(error, 'Không thể tạo API'))
      },
    },
    false
  )

  const updateMutation = useApiMutation(
    (payload: Partial<CreateMapLayerApiBody>) => mapLayerApiService.update(apiId!, payload),
    {
      onSuccess: () => {
        toast.success('Cập nhật API thành công')
        onSaved?.()
        onOpenChange(false)
      },
      onError: (error) => {
        toast.error(getMappedErrorMessage(error, 'Không thể cập nhật API'))
      },
    },
    false
  )

  const errorMessage = useMemo(() => {
    if (!detailQuery.error) return ''
    return getMappedErrorMessage(detailQuery.error, 'Không tải được chi tiết API')
  }, [detailQuery.error])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
            {isEdit ? (
              <Pen className="text-primary h-5 w-5" />
            ) : (
              <Plus className="text-primary h-5 w-5" />
            )}
          </div>
          <div>
            <DialogTitle className="text-lg">
              {isEdit ? 'Chỉnh sửa API lớp bản đồ' : 'Thêm API lớp bản đồ mới'}
            </DialogTitle>
            <DialogDescription className="mt-0.5">
              {isEdit
                ? `Cập nhật thông tin API #${apiId}`
                : 'Điền các thông tin bên dưới để tạo một API mới cho lớp bản đồ'}
            </DialogDescription>
          </div>
        </div>

        {isEdit && errorMessage && (
          <div className="mt-2 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {isEdit && detailQuery.isLoading && (
          <div className="flex items-center justify-center gap-2 py-12">
            <Loader2 className="text-primary h-5 w-5 animate-spin" />
            <span className="text-muted-foreground text-sm">Đang tải dữ liệu...</span>
          </div>
        )}

        {(!isEdit || initialData) && (
          <div className="mt-2">
            <MapLayerApiForm
              mode={isEdit ? 'edit' : 'create'}
              initialData={initialData}
              submitting={createMutation.isPending || updateMutation.isPending}
              onCancel={() => onOpenChange(false)}
              onSubmitCreate={(payload) => {
                const parsed = validateCreatePayload(payload)
                if (!parsed.success) {
                  toast.error(parsed.error.issues[0]?.message ?? 'Payload create không hợp lệ')
                  return
                }
                createMutation.mutate(parsed.data as any)
              }}
              onSubmitUpdate={(payload) => {
                const parsed = validateUpdatePayload(payload)
                if (!parsed.success) {
                  toast.error(parsed.error.issues[0]?.message ?? 'Payload update không hợp lệ')
                  return
                }
                updateMutation.mutate(parsed.data as any)
              }}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
