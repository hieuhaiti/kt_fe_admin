import { useState } from 'react'
import {
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Clock3,
  Database,
  Loader2,
  RotateCcw,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { formatDateTime } from '@/lib/date'
import type { GeeProcessingState } from '@/types/api'

type Tone = 'muted' | 'info' | 'warning' | 'success' | 'destructive'

const TONE_CLASSES: Record<Tone, string> = {
  muted: 'border-border bg-muted/40',
  info: 'border-info/30 bg-info/10',
  warning: 'border-warning/30 bg-warning/10',
  success: 'border-success/30 bg-success/10',
  destructive: 'border-destructive/30 bg-destructive/10',
}

function resolvePresentation(processing: GeeProcessingState) {
  if (processing.queue.status === 'queued') {
    const ahead = processing.queue.jobsAhead
    return {
      tone: 'warning' as Tone,
      icon: Clock3,
      title: 'Đang chờ cập nhật',
      description:
        ahead > 0
          ? `Hệ thống đang xử lý ${ahead} yêu cầu trước. Dữ liệu sẽ tự cập nhật khi đến lượt.`
          : 'Yêu cầu đã được tiếp nhận và sẽ bắt đầu trong ít phút.',
    }
  }

  if (processing.state === 'exporting') {
    return {
      tone: 'info' as Tone,
      icon: Database,
      title: 'Số liệu mới đã sẵn sàng',
      description:
        'Bạn đã có thể xem số liệu và bản đồ tổng quan. Bản đồ chi tiết theo huyện đang được hoàn thiện.',
    }
  }

  if (processing.queue.status === 'running' || processing.state === 'computing') {
    return {
      tone: 'info' as Tone,
      icon: Loader2,
      title: 'Đang cập nhật dữ liệu mới',
      description: 'Bạn vẫn có thể xem bản đồ hiện tại. Kết quả mới sẽ tự hiển thị khi hoàn tất.',
    }
  }

  if (processing.state === 'failed') {
    return {
      tone: 'destructive' as Tone,
      icon: CircleAlert,
      title: 'Chưa thể cập nhật dữ liệu',
      description: processing.retry.nextRetryAt
        ? `Quá trình bị gián đoạn. Hệ thống sẽ tự thử lại lúc ${formatDateTime(
            processing.retry.nextRetryAt
          )}.`
        : 'Hãy gửi lại yêu cầu. Nếu lỗi tiếp tục, vui lòng liên hệ quản trị viên.',
    }
  }

  if (processing.state === 'completed' || processing.state === 'published') {
    return {
      tone: 'success' as Tone,
      icon: CheckCircle2,
      title: processing.state === 'published' ? 'Bản đồ đã được cập nhật' : 'Dữ liệu đã sẵn sàng',
      description:
        processing.state === 'published'
          ? 'Số liệu và bản đồ theo huyện đã sẵn sàng để tra cứu.'
          : 'Số liệu và bản đồ tổng quan đã được cập nhật.',
    }
  }

  return {
    tone: 'muted' as Tone,
    icon: Clock3,
    title: 'Sẵn sàng cập nhật dữ liệu',
    description: 'Chọn “Cập nhật dữ liệu” khi bạn muốn tạo kết quả mới.',
  }
}

export default function GeeProcessingStatus({
  processing,
  className,
}: {
  processing?: GeeProcessingState | null
  className?: string
}) {
  const [disclosure, setDisclosure] = useState<{ key: string; open: boolean } | null>(null)

  if (!processing) return null

  const presentation = resolvePresentation(processing)
  const Icon = presentation.icon
  const district = processing.districtExport
  const showDistrictProgress = district.total > 0
  const districtSettled = district.completed + district.failed + district.skipped
  const isSpinning = processing.state === 'computing'
  const otherPipelineRunning =
    processing.queue.globalBusy &&
    processing.queue.status !== 'running' &&
    processing.queue.activePipeline &&
    processing.queue.activePipeline !== processing.pipeline
  const shouldDefaultOpen =
    processing.queue.status === 'queued' ||
    processing.queue.status === 'running' ||
    processing.state === 'computing' ||
    processing.state === 'exporting' ||
    processing.state === 'failed'
  const disclosureKey = [
    processing.pipeline,
    processing.state,
    processing.queue.status,
    processing.queue.enqueuedAt,
    processing.queue.startedAt,
  ].join(':')
  const open = disclosure?.key === disclosureKey ? disclosure.open : shouldDefaultOpen

  return (
    <Card
      className={cn(TONE_CLASSES[presentation.tone], className)}
      role="status"
      aria-live="polite"
    >
      <CardContent className="p-0">
        <Button
          type="button"
          variant="ghost"
          onClick={() =>
            setDisclosure({
              key: disclosureKey,
              open: !open,
            })
          }
          aria-expanded={open}
          className="hover:bg-muted/30 h-auto w-full justify-start rounded-none px-3 py-2.5 text-left sm:px-4"
        >
          <span
            className={cn(
              'rounded-full p-1.5',
              presentation.tone === 'destructive'
                ? 'bg-destructive/15 text-destructive'
                : presentation.tone === 'success'
                  ? 'bg-success/15 text-success'
                  : presentation.tone === 'warning'
                    ? 'bg-warning/15 text-warning'
                    : 'bg-info/15 text-info'
            )}
          >
            <Icon className={cn('h-4 w-4', isSpinning && 'animate-spin')} aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">{presentation.title}</span>
            {!open && (
              <span className="text-muted-foreground block truncate text-xs font-normal">
                {presentation.description}
              </span>
            )}
          </span>
          {showDistrictProgress && (
            <Badge variant="outline" className="bg-background/70 shrink-0">
              {districtSettled}/{district.total} huyện
            </Badge>
          )}
          <ChevronDown
            className={cn('h-4 w-4 shrink-0 transition-transform', open && 'rotate-180')}
            aria-hidden="true"
          />
        </Button>

        {open && (
          <div className="border-border/60 space-y-3 border-t px-3 py-3 sm:px-4">
            <div>
              <p className="text-muted-foreground text-sm leading-6">{presentation.description}</p>
              {processing.retry.lastError && processing.state === 'failed' && (
                <p className="text-destructive mt-1 line-clamp-2 text-xs">
                  {processing.retry.lastError}
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {processing.queue.waitingCount > 0 && (
                <Badge variant="outline" className="bg-background/70">
                  {processing.queue.waitingCount} yêu cầu đang chờ
                </Badge>
              )}
              {processing.queue.status === 'queued' && processing.queue.position != null && (
                <Badge variant="outline" className="border-warning/30 bg-warning/10 text-warning">
                  Lượt thứ {processing.queue.position}
                </Badge>
              )}
              {processing.retry.count > 0 && (
                <Badge variant="outline" className="gap-1">
                  <RotateCcw className="h-3 w-3" aria-hidden="true" />
                  Đã thử lại {processing.retry.count} lần
                </Badge>
              )}
            </div>

            {showDistrictProgress && (
              <div>
                <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
                  <span className="font-medium">
                    Hoàn thiện bản đồ theo huyện: {districtSettled}/{district.total}
                  </span>
                  <span className="text-muted-foreground">{district.progressPercent}%</span>
                </div>
                <div
                  className="bg-muted h-2 overflow-hidden rounded-full"
                  role="progressbar"
                  aria-label="Tiến độ tạo dữ liệu bản đồ theo huyện"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={district.progressPercent}
                >
                  <div
                    className={cn(
                      'h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none',
                      district.failed > 0 ? 'bg-warning' : 'bg-success'
                    )}
                    style={{ width: `${district.progressPercent}%` }}
                  />
                </div>
                <div className="text-muted-foreground mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
                  <span>{district.completed} hoàn tất</span>
                  <span>{district.pending} đang chờ</span>
                  {district.skipped > 0 && <span>{district.skipped} bỏ qua</span>}
                  {district.failed > 0 && (
                    <span className="text-warning">{district.failed} lỗi</span>
                  )}
                </div>
              </div>
            )}

            {otherPipelineRunning && (
              <p className="border-border text-muted-foreground border-t pt-2 text-[11px]">
                Hệ thống đang cập nhật {processing.queue.activePipelineLabel}. Yêu cầu này sẽ bắt
                đầu ngay sau đó.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
