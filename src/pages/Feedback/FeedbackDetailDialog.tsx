import type { ReactNode } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { citizenFeedbackService, useApiQuery } from '@/service'
import type { ApiResponse, CitizenFeedback, FeedbackAttachment } from '@/types/api'
import { parseLink } from '@/lib/utils'
import { MapPin, Paperclip, User } from 'lucide-react'
import { UserText } from '@/components/common/UserText'
import { formatDateTime } from '@/lib/date'
import {
  CATEGORY_CLASS,
  CATEGORY_LABEL,
  PRIORITY_CLASS,
  PRIORITY_LABEL,
  STATUS_CLASS,
  STATUS_LABEL,
} from '@/constant/feedbackConstant'

interface FeedbackDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  feedbackId: number | string | null
}

function getFeedbackDetail(
  response?: ApiResponse<CitizenFeedback | { feedback?: CitizenFeedback }>
) {
  const data = response?.data
  if (!data) return null

  if ('feedback' in data && data.feedback) return data.feedback

  return data as CitizenFeedback
}

function attachmentUrl(att: FeedbackAttachment) {
  return att.file_url ?? att.fileUrl ?? att.file_path ?? att.filePath ?? ''
}

function isImageAttachment(att: FeedbackAttachment) {
  const mimeType = att.mime_type ?? att.mimeType ?? ''
  return mimeType.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(attachmentUrl(att))
}

function mediaItemsOf(feedback: CitizenFeedback) {
  const mediaUrls =
    feedback.mediaUrls?.map(
      (url, index): FeedbackAttachment => ({
        id: `media-${index}`,
        fileUrl: url,
        filePath: url,
        mimeType: /\.(png|jpe?g|webp|gif)$/i.test(url) ? 'image/*' : undefined,
      })
    ) ?? []

  return [...mediaUrls, ...(feedback.attachments ?? []), ...(feedback.media ?? [])]
}

export default function FeedbackDetailDialog({
  open,
  onOpenChange,
  feedbackId,
}: FeedbackDetailDialogProps) {
  const dbQuery = useApiQuery(
    ['feedback', feedbackId],
    () => citizenFeedbackService.getAdminById(feedbackId!),
    { enabled: !!feedbackId && open, staleTime: 0 },
    false,
    false
  )
  const feedback = getFeedbackDetail(
    dbQuery.data as ApiResponse<CitizenFeedback | { feedback?: CitizenFeedback }> | undefined
  )

  const description = feedback?.description ?? feedback?.content
  const createdAt = feedback?.createdAt ?? feedback?.created_at
  const updatedAt = feedback?.updatedAt ?? feedback?.updated_at
  const resolvedAt = feedback?.resolvedAt ?? feedback?.resolved_at
  const locationCoordinates =
    feedback?.lng != null && feedback?.lat != null
      ? `${feedback.lat}, ${feedback.lng}`
      : feedback?.location_coordinates
  const senderName = feedback?.userName ?? feedback?.createdByName
  const mediaItems = feedback ? mediaItemsOf(feedback) : []

  const Row = ({ label, children }: { label: string; children: ReactNode }) => (
    <div className="grid grid-cols-3 gap-2">
      <span className="font-semibold">{label}:</span>
      <div className="col-span-2">{children}</div>
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] max-w-3xl overflow-y-auto">
        <DialogTitle>Chi tiết phản ánh</DialogTitle>
        <DialogDescription>Thông tin chi tiết phản ánh của người dân</DialogDescription>

        {dbQuery.isLoading ? (
          <div className="text-muted-foreground py-8 text-center">Đang tải dữ liệu...</div>
        ) : dbQuery.isError ? (
          <div className="text-destructive py-8 text-center">Không thể tải thông tin phản ánh.</div>
        ) : feedback ? (
          <div className="mt-4 space-y-3">
            <Row label="ID">{feedback.id}</Row>
            <Row label="Tiêu đề">
              <span className="font-medium">{feedback.title}</span>
            </Row>
            {description && (
              <Row label="Nội dung">
                <p className="text-sm whitespace-pre-wrap">{description}</p>
              </Row>
            )}
            {feedback.category && (
              <Row label="Nhóm phản ánh">
                <Badge variant="outline" className={CATEGORY_CLASS[feedback.category] ?? ''}>
                  {CATEGORY_LABEL[feedback.category] ?? feedback.category}
                </Badge>
              </Row>
            )}
            <Row label="Mức độ ưu tiên">
              <Badge variant="outline" className={PRIORITY_CLASS[feedback.priority] ?? ''}>
                {PRIORITY_LABEL[feedback.priority] ?? feedback.priority}
              </Badge>
            </Row>
            <Row label="Trạng thái xử lý">
              <Badge variant="outline" className={STATUS_CLASS[feedback.status] ?? ''}>
                {STATUS_LABEL[feedback.status] ?? feedback.status}
              </Badge>
            </Row>
            {feedback.is_location_verified !== undefined && (
              <Row label="Xác minh vị trí">
                <Badge
                  variant="outline"
                  className={
                    feedback.is_location_verified
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-slate-200 bg-slate-50 text-slate-600'
                  }
                >
                  {feedback.is_location_verified ? 'Đã xác minh thực địa' : 'Chưa xác minh'}
                </Badge>
              </Row>
            )}
            {feedback.location_verified_at && (
              <Row label="Thời gian xác minh">{formatDateTime(feedback.location_verified_at)}</Row>
            )}

            <Row label="Người gửi">
              {feedback.user ? (
                <div className="flex items-center gap-2">
                  {feedback.user.avatar_url || feedback.user.avatarUrl ? (
                    <img
                      src={parseLink(feedback.user.avatar_url ?? feedback.user.avatarUrl ?? '')}
                      alt=""
                      className="size-8 rounded-full border object-cover"
                    />
                  ) : (
                    <div className="bg-muted flex size-8 items-center justify-center rounded-full">
                      <User className="size-4" />
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium">
                      {feedback.user.full_name ?? feedback.user.fullName ?? feedback.user.username}
                    </p>
                    {feedback.user.username && (
                      <p className="text-muted-foreground text-xs">@{feedback.user.username}</p>
                    )}
                  </div>
                </div>
              ) : senderName ? (
                senderName
              ) : (feedback.userId ?? feedback.user_id) ? (
                <UserText userId={feedback.userId ?? feedback.user_id} />
              ) : (
                <span className="text-muted-foreground">Ẩn danh</span>
              )}
            </Row>

            {(feedback.anonymousId || feedback.clientUuid) && (
              <Row label="Định danh thiết bị">
                <div className="space-y-1 text-sm">
                  {feedback.anonymousId && <p>Anonymous ID: {feedback.anonymousId}</p>}
                  {feedback.clientUuid && <p>Client UUID: {feedback.clientUuid}</p>}
                </div>
              </Row>
            )}

            {(feedback.location_text || locationCoordinates) && (
              <Row label="Vị trí">
                <div className="flex items-start gap-1">
                  <MapPin className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                  <div>
                    {feedback.location_text && <p className="text-sm">{feedback.location_text}</p>}
                    {locationCoordinates && (
                      <p className="text-muted-foreground text-xs">{locationCoordinates}</p>
                    )}
                  </div>
                </div>
              </Row>
            )}

            {feedback.forest_loss_area_estimate_m2 != null && (
              <Row label="Diện tích mất rừng ước tính">
                {feedback.forest_loss_area_estimate_m2.toLocaleString('vi-VN')} m2
              </Row>
            )}

            {feedback.admin_response && (
              <Row label="Phản hồi admin">
                <p className="bg-muted rounded-md p-2 text-sm">{feedback.admin_response}</p>
              </Row>
            )}
            {feedback.resolution_note && (
              <Row label="Ghi chú xử lý">
                <p className="bg-muted rounded-md p-2 text-sm">{feedback.resolution_note}</p>
              </Row>
            )}
            {feedback.responded_at && (
              <Row label="Phản hồi lúc">{formatDateTime(feedback.responded_at)}</Row>
            )}
            {feedback.responder && (
              <Row label="Người phản hồi">
                {feedback.responder.full_name ??
                  feedback.responder.fullName ??
                  feedback.responder.id}
              </Row>
            )}
            {feedback.updatedByName && <Row label="Cập nhật bởi">{feedback.updatedByName}</Row>}
            {resolvedAt && <Row label="Xử lý xong lúc">{formatDateTime(resolvedAt)}</Row>}

            {mediaItems.length > 0 && (
              <Row label="Ảnh đính kèm">
                <div className="grid grid-cols-3 gap-2">
                  {mediaItems.map((att) => {
                    const url = attachmentUrl(att)
                    return (
                      <a
                        key={att.id}
                        href={parseLink(url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group relative"
                      >
                        {isImageAttachment(att) ? (
                          <img
                            src={parseLink(url)}
                            alt={(att.file_name ?? att.fileName ?? '') as string}
                            className="h-24 w-full rounded border object-cover transition group-hover:opacity-80"
                          />
                        ) : (
                          <div className="bg-muted flex h-24 items-center justify-center rounded border">
                            <Paperclip className="text-muted-foreground size-6" />
                          </div>
                        )}
                      </a>
                    )
                  })}
                </div>
              </Row>
            )}

            {feedback.statusLogs && feedback.statusLogs.length > 0 && (
              <Row label="Lịch sử xử lý">
                <div className="space-y-2">
                  {feedback.statusLogs.map((log) => (
                    <div key={log.id} className="rounded border p-2 text-sm">
                      <p className="font-medium">
                        {log.fromStatus
                          ? `${STATUS_LABEL[log.fromStatus] ?? log.fromStatus} -> `
                          : ''}
                        {STATUS_LABEL[log.toStatus] ?? log.toStatus}
                      </p>
                      {log.note && <p className="text-muted-foreground mt-1">{log.note}</p>}
                      <p className="text-muted-foreground mt-1 text-xs">
                        {log.changedByName ?? log.changedBy ?? 'Hệ thống'}
                        {log.createdAt ? ` - ${formatDateTime(log.createdAt)}` : ''}
                      </p>
                    </div>
                  ))}
                </div>
              </Row>
            )}

            <Row label="Ngày tạo">{createdAt ? formatDateTime(createdAt) : '-'}</Row>
            <Row label="Cập nhật lúc">{updatedAt ? formatDateTime(updatedAt) : '-'}</Row>
          </div>
        ) : (
          <div className="text-muted-foreground py-8 text-center">Không có dữ liệu</div>
        )}
      </DialogContent>
    </Dialog>
  )
}
