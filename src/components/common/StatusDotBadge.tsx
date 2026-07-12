import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface StatusDotBadgeProps {
  /** Nhãn hiển thị đầy đủ (cũng hiện trong tooltip) */
  label: string
  /** Tailwind classes cho container badge (bg + border + text) */
  badgeClass: string
  /** Tailwind bg-* class cho chấm tròn chỉ thị màu */
  dotClass: string
  className?: string
}

/**
 * Badge gọn nhẹ: chấm màu + nhãn văn bản có thể truncate.
 * - Khi cell đủ rộng → hiện đầy đủ chấm + chữ
 * - Khi cell hẹp    → chữ tự truncate, chấm luôn hiển thị
 * - Tooltip luôn hiện nhãn đầy đủ khi hover
 */
export function StatusDotBadge({ label, badgeClass, dotClass, className }: StatusDotBadgeProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'inline-flex max-w-full cursor-default items-center gap-1.5 overflow-hidden rounded-full border px-2 py-0.5 text-xs font-semibold',
              badgeClass,
              className
            )}
          >
            <span className={cn('size-2 shrink-0 rounded-full', dotClass)} />
            <span className="truncate">{label}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p>{label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
