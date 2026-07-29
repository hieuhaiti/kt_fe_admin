import { useState, type ReactNode } from 'react'
import { CalendarRange, ChevronDown, GitCompareArrows } from 'lucide-react'
import { Button } from '@/components/ui/button'

type ForestPeriod = {
  year: number
  month: number
}

const formatMonth = ({ year, month }: ForestPeriod) => `${String(month).padStart(2, '0')}/${year}`

const formatDate = (date: Date) =>
  new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)

const getPeriodOrdinal = ({ year, month }: ForestPeriod) => year * 12 + month - 1

function getForestAnalysisWindow({ year, month }: ForestPeriod) {
  const endExclusive = new Date(Date.UTC(year, month, 1))
  const start = new Date(endExclusive)
  start.setUTCMonth(start.getUTCMonth() - 12)
  const end = new Date(endExclusive)
  end.setUTCDate(end.getUTCDate() - 1)

  return {
    start,
    end,
    label: `${formatDate(start)}–${formatDate(end)}`,
  }
}

function CollapsibleNotice({
  icon,
  title,
  summary,
  tone,
  ariaLabel,
  children,
}: {
  icon: ReactNode
  title: string
  summary: string
  tone: string
  ariaLabel: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)

  return (
    <aside
      role="note"
      aria-label={ariaLabel}
      className={`overflow-hidden rounded-lg border ${tone}`}
    >
      <Button
        type="button"
        variant="ghost"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="hover:bg-muted/40 h-auto w-full justify-start rounded-none px-3 py-2.5 text-left sm:px-4"
      >
        {icon}
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">{title}</span>
          <span className="text-muted-foreground block truncate text-xs font-normal">
            {summary}
          </span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </Button>
      {open && <div className="border-border/60 border-t px-3 py-3 sm:px-4">{children}</div>}
    </aside>
  )
}

export function ForestAnalysisPeriodNotice({
  year,
  month,
  compact = false,
}: ForestPeriod & { compact?: boolean }) {
  const period = { year, month }
  const window = getForestAnalysisWindow(period)

  return (
    <CollapsibleNotice
      icon={<CalendarRange className="text-info h-4 w-4 shrink-0" aria-hidden="true" />}
      title={`Kết quả cập nhật đến hết tháng ${formatMonth(period)}`}
      summary={`${window.label} · tổng hợp 12 tháng gần nhất`}
      tone="border-info/30 bg-info/10"
      ariaLabel={`Cách hiểu kỳ cập nhật ${formatMonth(period)}`}
    >
      <div className="space-y-1.5">
        <p className="text-foreground/85 text-sm leading-relaxed">
          Hệ thống tổng hợp ảnh từ <strong>{window.label}</strong>, không chỉ dùng riêng ảnh trong
          tháng {String(month).padStart(2, '0')}.
        </p>
        {!compact && (
          <div className="grid gap-2 pt-1 sm:grid-cols-2">
            <div className="bg-background/60 rounded-md border p-2.5">
              <p className="text-xs font-semibold">Nền ổn định — 12 tháng</p>
              <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
                Giúp quan sát đủ các mùa và bổ sung những nơi thường bị mây che.
              </p>
            </div>
            <div className="bg-background/60 rounded-md border p-2.5">
              <p className="text-xs font-semibold">Thông tin gần nhất — 3 tháng</p>
              <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
                Giúp kết quả phản ánh rõ hơn tình trạng mới vào cuối kỳ.
              </p>
            </div>
          </div>
        )}
      </div>
    </CollapsibleNotice>
  )
}

export function ForestComparisonPeriodNotice({
  current,
  reference,
}: {
  current?: ForestPeriod | null
  reference?: ForestPeriod | null
}) {
  if (!current || !reference) return null

  const currentOrdinal = getPeriodOrdinal(current)
  const referenceOrdinal = getPeriodOrdinal(reference)
  const distance = Math.abs(currentOrdinal - referenceOrdinal)
  const overlapMonths = Math.max(0, 12 - distance)
  const sameMonth = current.month === reference.month
  const referenceIsNewer = referenceOrdinal > currentOrdinal
  const currentWindow = getForestAnalysisWindow(current)
  const referenceWindow = getForestAnalysisWindow(reference)

  let title = 'Hai kỳ sử dụng các khoảng ảnh khác nhau'
  let summary = 'Nên ưu tiên cùng tháng giữa các năm'
  let description = 'Nên ưu tiên đối chiếu cùng tháng giữa các năm để hạn chế chênh lệch do mùa.'
  let tone = 'border-warning/35 bg-warning/10'

  if (referenceIsNewer) {
    title = 'Kỳ đối chiếu đang mới hơn kỳ cần xem'
    summary = 'Nên đổi lại thứ tự hai kỳ'
    description =
      'Chênh lệch sẽ khó đọc đúng chiều thời gian. Nên đổi vị trí hai kỳ trước khi nhận xét kết quả.'
  } else if (sameMonth && distance >= 12) {
    title = 'So sánh cùng mùa — phù hợp hơn'
    summary = `${formatMonth(reference)} → ${formatMonth(current)}`
    description =
      'Hai kỳ cùng tháng giúp hạn chế khác biệt tự nhiên giữa mùa mưa, mùa khô và giai đoạn cây thay lá.'
    tone = 'border-success/35 bg-success/10'
  } else if (overlapMonths > 0) {
    title = 'Hai kỳ dùng chung'
    summary = `${overlapMonths}/12 tháng dữ liệu`
    description =
      'Chênh lệch phù hợp để theo dõi xu hướng, nhưng không đại diện cho biến động chỉ xảy ra trong riêng hai tháng đã chọn.'
  }

  return (
    <CollapsibleNotice
      icon={<GitCompareArrows className="h-4 w-4 shrink-0" aria-hidden="true" />}
      title={title}
      summary={summary}
      tone={tone}
      ariaLabel={`Thông tin so sánh ${formatMonth(reference)} và ${formatMonth(current)}`}
    >
      <div className="space-y-2">
        <p className="text-foreground/80 text-xs leading-relaxed">{description}</p>
        <div className="text-muted-foreground grid gap-1 text-[11px] sm:grid-cols-2 sm:gap-3">
          <span>
            {formatMonth(current)}: {currentWindow.label}
          </span>
          <span>
            {formatMonth(reference)}: {referenceWindow.label}
          </span>
        </div>
      </div>
    </CollapsibleNotice>
  )
}
