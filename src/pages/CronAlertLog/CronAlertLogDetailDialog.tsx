import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import type { CronAlertLog } from '@/types/api'
import { formatDate, formatDateTime } from '@/lib/date'

interface CronAlertLogDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  log: CronAlertLog | null
}

function statusBadgeClass(status: CronAlertLog['status']) {
  switch (status) {
    case 'running':
      return 'bg-sky-100 text-sky-700 border-sky-200'
    case 'success':
      return 'bg-emerald-100 text-emerald-700 border-emerald-200'
    case 'waiting_retry':
      return 'bg-amber-100 text-amber-700 border-amber-200'
    default:
      return 'bg-red-100 text-red-700 border-red-200'
  }
}

function statusLabel(status: CronAlertLog['status']) {
  switch (status) {
    case 'running':
      return 'Đang chạy'
    case 'success':
      return 'Thành công'
    case 'waiting_retry':
      return 'Chờ retry'
    default:
      return 'Thất bại cuối'
  }
}

function scheduleLabel(value: CronAlertLog['schedule_type']) {
  switch (value) {
    case 'day_1':
      return 'Ngày 1'
    case 'day_15':
      return 'Ngày 15'
    default:
      return 'Retry'
  }
}

function formatDateOnly(value?: string | null) {
  return formatDate(value)
}

function formatPeriod(start?: string | null, end?: string | null) {
  const s = formatDateOnly(start)
  const e = formatDateOnly(end)
  if (s === '-' && e === '-') return '-'
  return `${s} đến ${e}`
}

export default function CronAlertLogDetailDialog({
  open,
  onOpenChange,
  log,
}: CronAlertLogDetailDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-4xl overflow-y-auto">
        <DialogTitle>Chi tiết nhật kí cảnh báo</DialogTitle>
        <DialogDescription>
          Thông tin đầy đủ của lần chạy cronjob cảnh báo (hiển thị theo giờ máy của bạn)
        </DialogDescription>

        {log ? (
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <span className="font-semibold">ID:</span>
              <span className="col-span-2">{log.id}</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <span className="font-semibold">Tên job:</span>
              <span className="col-span-2 font-mono text-sm">{log.job_name}</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <span className="font-semibold">Ngày chạy:</span>
              <span className="col-span-2">{formatDateOnly(log.scheduled_date)}</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <span className="font-semibold">Loại lịch:</span>
              <span className="col-span-2">
                <Badge variant="outline">{scheduleLabel(log.schedule_type)}</Badge>
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <span className="font-semibold">Trạng thái:</span>
              <span className="col-span-2">
                <span
                  className={`rounded border px-2 py-0.5 text-xs font-semibold ${statusBadgeClass(log.status)}`}
                >
                  {statusLabel(log.status)}
                </span>
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <span className="font-semibold">Lần chạy / Retry:</span>
              <span className="col-span-2">
                lần {log.attempt_no} | retry kỳ hiện tại: {log.period1_retry_count} | retry kỳ tham
                chiếu: {log.period2_retry_count}
              </span>
            </div>

            <Separator />

            <div className="grid grid-cols-3 gap-2">
              <span className="font-semibold">Kỳ hiện tại (gốc):</span>
              <span className="col-span-2">
                {formatPeriod(log.base_period1_start, log.base_period1_end)}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <span className="font-semibold">Kỳ tham chiếu (gốc):</span>
              <span className="col-span-2">
                {formatPeriod(log.base_period2_start, log.base_period2_end)}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <span className="font-semibold">Kỳ hiện tại (thực tế):</span>
              <span className="col-span-2">
                {formatPeriod(log.actual_period1_start, log.actual_period1_end)}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <span className="font-semibold">Kỳ tham chiếu (thực tế):</span>
              <span className="col-span-2">
                {formatPeriod(log.actual_period2_start, log.actual_period2_end)}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <span className="font-semibold">Thực vật tăng/giảm:</span>
              <span className="col-span-2">
                +{(log.vegetation?.increaseKm2 ?? 0).toFixed(2)} km2 | -
                {(log.vegetation?.decreaseKm2 ?? 0).toFixed(2)} km2
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <span className="font-semibold">Ngày retry kế tiếp:</span>
              <span className="col-span-2">{formatDateOnly(log.next_retry_date)}</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <span className="font-semibold">Bắt đầu / Kết thúc:</span>
              <span className="col-span-2">
                {formatDateTime(log.started_at)} {' đến '} {formatDateTime(log.finished_at)}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <span className="font-semibold">Cập nhật:</span>
              <span className="col-span-2">{formatDateTime(log.updated_at)}</span>
            </div>

            {log.last_error && (
              <div className="grid grid-cols-3 gap-2">
                <span className="font-semibold">Lỗi cuối:</span>
                <div className="col-span-2">
                  <pre className="bg-muted max-h-48 overflow-y-auto rounded-md p-3 text-xs break-all whitespace-pre-wrap">
                    {log.last_error}
                  </pre>
                </div>
              </div>
            )}

            {log.request_payload && (
              <div className="grid grid-cols-3 gap-2">
                <span className="font-semibold">Dữ liệu request:</span>
                <div className="col-span-2">
                  <pre className="bg-muted max-h-64 overflow-y-auto rounded-md p-3 text-xs">
                    {JSON.stringify(log.request_payload, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            {log.raw_response && (
              <div className="grid grid-cols-3 gap-2">
                <span className="font-semibold">Phản hồi thô:</span>
                <div className="col-span-2">
                  <pre className="bg-muted max-h-64 overflow-y-auto rounded-md p-3 text-xs">
                    {JSON.stringify(log.raw_response, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-muted-foreground mt-4">Không có dữ liệu.</p>
        )}
      </DialogContent>
    </Dialog>
  )
}
