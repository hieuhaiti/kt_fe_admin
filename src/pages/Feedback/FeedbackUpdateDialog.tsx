import { useEffect } from 'react'
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

const statusSchema = z.object({
  status: z.enum(['new', 'in_progress', 'resolved', 'rejected'] as const),
  note: z
    .string()
    .max(1000, 'Ghi chú không được vượt quá 1000 ký tự')
    .optional()
    .or(z.literal('')),
})
type StatusFormValues = z.infer<typeof statusSchema>

interface FeedbackUpdateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  feedback: CitizenFeedback | null
  onUpdateStatus: (data: StatusFormValues) => void
  isLoading?: boolean
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
}: FeedbackUpdateDialogProps) {
  const statusForm = useForm<StatusFormValues>({
    resolver: zodResolver(statusSchema) as any,
    defaultValues: {
      status: 'new',
      note: '',
    },
  })

  useEffect(() => {
    if (feedback) {
      statusForm.reset({
        status: feedback.status as any,
        note: '',
      })
    }
  }, [feedback, open, statusForm])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] max-w-3xl overflow-y-auto">
        <DialogTitle>Cập nhật phản ánh</DialogTitle>
        <DialogDescription>
          Phản ánh: <span className="font-medium">{feedback?.title}</span>
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
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_LABELS.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
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
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Đang lưu...' : 'Cập nhật trạng thái'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
