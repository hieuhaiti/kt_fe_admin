import { useEffect, useMemo } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { CitizenFeedback, FeedbackStatus } from '@/types/api'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { StatusDotBadge } from '@/components/common/StatusDotBadge'
import { STATUS_CLASS, STATUS_DOT, STATUS_LABEL } from '@/constant/feedbackConstant'

const statusSchema = z.object({
  status: z.enum(['new', 'in_progress', 'resolved', 'rejected'] as const),
  note: z.string().max(1000, 'Ghi chú không được vượt quá 1000 ký tự').optional().or(z.literal('')),
})
type StatusFormValues = z.infer<typeof statusSchema>

interface FeedbackUpdateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  feedback: CitizenFeedback | null
  onUpdateStatus: (data: StatusFormValues) => void
  isLoading?: boolean
  canOverrideTransitions?: boolean
}

const STATUS_LABELS: { value: FeedbackStatus; label: string }[] = [
  { value: 'new', label: 'Mới tiếp nhận' },
  { value: 'in_progress', label: 'Đang xử lý' },
  { value: 'resolved', label: 'Đã xử lý' },
  { value: 'rejected', label: 'Từ chối' },
]

export default function FeedbackUpdateDialog({
  open,
  onOpenChange,
  feedback,
  onUpdateStatus,
  isLoading = false,
  canOverrideTransitions = false,
}: FeedbackUpdateDialogProps) {
  const statusForm = useForm<StatusFormValues>({
    resolver: zodResolver(statusSchema),
    defaultValues: {
      status: 'new',
      note: '',
    },
  })

  const allowedStatuses = useMemo(() => {
    if (canOverrideTransitions) {
      return STATUS_LABELS
    }
    return STATUS_LABELS.filter(({ value }) => {
      if (feedback?.status === 'new') return value === 'in_progress' || value === 'rejected'
      if (feedback?.status === 'in_progress') return value === 'resolved' || value === 'rejected'
      return false
    })
  }, [canOverrideTransitions, feedback?.status])

  useEffect(() => {
    if (feedback && open) {
      const isCurrentAllowed = allowedStatuses.some((s) => s.value === feedback.status)
      const defaultStatus = isCurrentAllowed
        ? (feedback.status as StatusFormValues['status'])
        : (allowedStatuses[0]?.value ?? 'new')

      statusForm.reset({
        status: defaultStatus,
        note: '',
      })
    }
  }, [feedback, open, statusForm, allowedStatuses])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] max-w-3xl overflow-y-auto">
        <DialogTitle>Cập nhật phản ánh</DialogTitle>
        <DialogDescription asChild>
          <div className="text-muted-foreground mt-1 space-y-1.5 text-sm">
            <div>
              Phản ánh: <span className="text-foreground font-medium">{feedback?.title}</span>
            </div>
            {feedback?.status && (
              <div className="flex items-center gap-2">
                <span>Trạng thái hiện tại:</span>
                <StatusDotBadge
                  label={STATUS_LABEL[feedback.status] ?? feedback.status}
                  badgeClass={
                    STATUS_CLASS[feedback.status] ?? 'bg-gray-100 text-gray-600 border-gray-200'
                  }
                  dotClass={STATUS_DOT[feedback.status] ?? 'bg-gray-400'}
                />
              </div>
            )}
          </div>
        </DialogDescription>

        <form onSubmit={statusForm.handleSubmit(onUpdateStatus)} className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label>Trạng thái xử lý</Label>
            <Controller
              name="status"
              control={statusForm.control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Chọn trạng thái xử lý" />
                  </SelectTrigger>
                  <SelectContent>
                    {allowedStatuses.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {allowedStatuses.length === 0 && (
              <p className="text-muted-foreground text-xs">
                Phản ánh này đã ở trạng thái kết thúc và không thể chuyển trạng thái tiếp.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="feedback-note">Ghi chú xử lý</Label>
            <Textarea
              id="feedback-note"
              {...statusForm.register('note')}
              rows={4}
              placeholder="Nhập ghi chú xử lý phản ánh..."
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Hủy
            </Button>
            <Button type="submit" disabled={isLoading || allowedStatuses.length === 0}>
              {isLoading ? 'Đang lưu...' : 'Cập nhật trạng thái'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
