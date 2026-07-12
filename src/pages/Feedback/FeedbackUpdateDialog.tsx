import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { CitizenFeedback, FeedbackStatus, ModerationStatus } from '@/types/api'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import { Info } from 'lucide-react'

// ── Status update — đồng bộ server: updateStatusSchema ────────
const statusSchema = z.object({
  status: z.enum(['pending', 'in_progress', 'resolved', 'rejected', 'closed'] as const),
  admin_response: z
    .string()
    .min(10, 'Phản hồi phải có ít nhất 10 ký tự')
    .max(2000, 'Phản hồi không được vượt quá 2000 ký tự')
    .optional()
    .or(z.literal('')),
  resolution_note: z
    .string()
    .min(10, 'Ghi chú phải có ít nhất 10 ký tự')
    .max(2000, 'Ghi chú không được vượt quá 2000 ký tự')
    .optional()
    .or(z.literal('')),
  is_location_verified: z.boolean().optional(),
  moderation_status: z.literal('approved'),
})
type StatusFormValues = z.infer<typeof statusSchema>

// ── Moderation update — đồng bộ server: updateModerationStatusSchema ──
const moderationSchema = z.object({
  moderation_status: z.enum(['pending', 'approved', 'rejected'] as const),
  admin_response: z
    .string()
    .min(10, 'Phản hồi phải có ít nhất 10 ký tự')
    .max(2000, 'Phản hồi không được vượt quá 2000 ký tự')
    .optional()
    .or(z.literal('')),
})
type ModerationFormValues = z.infer<typeof moderationSchema>

interface FeedbackUpdateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  feedback: CitizenFeedback | null
  onUpdateStatus: (data: StatusFormValues) => void
  onUpdateModeration: (data: ModerationFormValues) => void
  isLoading?: boolean
}

const STATUS_LABELS: { value: FeedbackStatus; label: string }[] = [
  { value: 'pending', label: 'Chờ xử lý' },
  { value: 'in_progress', label: 'Đang xử lý' },
  { value: 'resolved', label: 'Đã xử lý' },
  { value: 'rejected', label: 'Từ chối' },
  { value: 'closed', label: 'Đóng' },
]
const MOD_LABELS: { value: ModerationStatus; label: string }[] = [
  { value: 'pending', label: 'Chờ duyệt' },
  { value: 'approved', label: 'Đã duyệt' },
  { value: 'rejected', label: 'Từ chối' },
]

export default function FeedbackUpdateDialog({
  open,
  onOpenChange,
  feedback,
  onUpdateStatus,
  onUpdateModeration,
  isLoading = false,
}: FeedbackUpdateDialogProps) {
  // Status form
  const statusForm = useForm<StatusFormValues>({
    resolver: zodResolver(statusSchema) as any,
    defaultValues: {
      status: 'pending',
      admin_response: '',
      resolution_note: '',
      is_location_verified: false,
      moderation_status: 'approved',
    },
  })

  // Moderation form
  const modForm = useForm<ModerationFormValues>({
    resolver: zodResolver(moderationSchema) as any,
    defaultValues: { moderation_status: 'pending', admin_response: '' },
  })
  const canUpdateModeration = feedback?.moderation_status === 'pending'

  useEffect(() => {
    if (feedback) {
      statusForm.reset({
        status: feedback.status as any,
        admin_response: feedback.admin_response || '',
        resolution_note: feedback.resolution_note || '',
        is_location_verified: feedback.is_location_verified || false,
        moderation_status: 'approved',
      })
      modForm.reset({
        moderation_status: (feedback.moderation_status ?? 'pending') as any,
        admin_response: feedback.admin_response || '',
      })
    }
  }, [feedback, open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] max-w-3xl overflow-y-auto">
        <DialogTitle>Cập nhật phản ánh</DialogTitle>
        <DialogDescription>
          Phản ánh: <span className="font-medium">{feedback?.title}</span>
        </DialogDescription>

        <Tabs defaultValue="status" className="mt-4">
          <TabsList className="w-full">
            <TabsTrigger value="status" className="flex-1">
              Trạng thái xử lý
            </TabsTrigger>
            {canUpdateModeration && (
              <TabsTrigger value="moderation" className="flex-1">
                Kiểm duyệt
              </TabsTrigger>
            )}
          </TabsList>

          {/* Tab: Status */}
          <TabsContent value="status">
            <form onSubmit={statusForm.handleSubmit(onUpdateStatus)} className="mt-4 space-y-4">
              {canUpdateModeration && (
                <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                  <Info className="mt-0.5 size-3.5 shrink-0" />
                  <span>
                    Cập nhật trạng thái sẽ tự động <strong>thông qua kiểm duyệt</strong> (approved).
                  </span>
                </div>
              )}
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
                        {STATUS_LABELS.map((s) => (
                          <SelectItem key={s.value} value={s.value}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                  <Checkbox
                    id="is_location_verified"
                    checked={Boolean(statusForm.watch('is_location_verified'))}
                    onCheckedChange={(checked) =>
                      statusForm.setValue('is_location_verified', Boolean(checked))
                    }
                  />
                  <Label htmlFor="is_location_verified" className="cursor-pointer">
                    Đã xác minh vị trí phản ánh tại hiện trường
                  </Label>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="admin_response_status">Phản hồi cho người dân</Label>
                <Textarea
                  id="admin_response_status"
                  {...statusForm.register('admin_response')}
                  rows={3}
                  placeholder="Nhập nội dung phản hồi cho người dân..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="resolution_note">Ghi chú xử lý (nội bộ)</Label>
                <Textarea
                  id="resolution_note"
                  {...statusForm.register('resolution_note')}
                  rows={3}
                  placeholder="Ghi chú nội bộ về cách xử lý phản ánh..."
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
          </TabsContent>

          {/* Tab: Moderation */}
          {canUpdateModeration && (
            <TabsContent value="moderation">
              <form onSubmit={modForm.handleSubmit(onUpdateModeration)} className="mt-4 space-y-4">
                <div className="space-y-2">
                  <Label>Trạng thái kiểm duyệt</Label>
                  <Controller
                    name="moderation_status"
                    control={modForm.control}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {MOD_LABELS.map((m) => (
                            <SelectItem key={m.value} value={m.value}>
                              {m.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="admin_response_mod">Phản hồi</Label>
                  <Textarea
                    id="admin_response_mod"
                    {...modForm.register('admin_response')}
                    rows={3}
                    placeholder="Nhập ghi chú kiểm duyệt..."
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
                    {isLoading ? 'Đang lưu...' : 'Cập nhật kiểm duyệt'}
                  </Button>
                </div>
              </form>
            </TabsContent>
          )}
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
