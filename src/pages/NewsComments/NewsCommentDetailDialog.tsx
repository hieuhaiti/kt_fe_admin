import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { newsCommentService, useApiQuery } from '@/service'
import type { ApiResponse, NewsComment } from '@/types/api'
import { UserText } from '@/components/common/UserText'
import { formatDateTime } from '@/lib/date'
import { toApprovedFlag } from '@/lib/newsComment'

interface NewsCommentDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  commentId: number | string | null
}

export default function NewsCommentDetailDialog({
  open,
  onOpenChange,
  commentId,
}: NewsCommentDetailDialogProps) {
  const dbQuery = useApiQuery(
    ['news-comment', commentId],
    () => newsCommentService.getById(commentId!),
    { enabled: !!commentId && open, staleTime: 0 },
    false,
    false
  )
  const comment = (dbQuery.data as ApiResponse<NewsComment>)?.data ?? null

  const parentQuery = useApiQuery(
    ['news-comment', comment?.parentCommentId ?? comment?.parent_comment_id],
    () => newsCommentService.getById((comment!.parentCommentId ?? comment!.parent_comment_id)!),
    {
      enabled: !!(comment?.parentCommentId ?? comment?.parent_comment_id),
      staleTime: 0,
    },
    false,
    false
  )
  const parentComment = (parentQuery.data as ApiResponse<NewsComment>)?.data ?? null
  const newsId = comment?.newsId ?? comment?.news_id
  const userId = comment?.userId ?? comment?.user_id
  const userName =
    comment?.userName ??
    comment?.user_name ??
    comment?.user?.fullName ??
    comment?.user?.full_name
  const parentCommentId = comment?.parentCommentId ?? comment?.parent_comment_id
  const isApproved = comment?.isApproved ?? comment?.is_approved
  const createdAt = comment?.createdAt ?? comment?.created_at
  const updatedAt = comment?.updatedAt ?? comment?.updated_at

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
        <DialogTitle>Chi tiết bình luận</DialogTitle>
        <DialogDescription>Thông tin chi tiết bình luận đã chọn</DialogDescription>

        {comment ? (
          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <span className="font-semibold">ID:</span>
              <span className="col-span-2">{comment.id}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <span className="font-semibold">Bài viết ID:</span>
              <span className="col-span-2">{newsId}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <span className="font-semibold">Người bình luận:</span>
              <span className="col-span-2">
                <UserText userId={userId} inlineUser={userName} />
              </span>
            </div>
            {!userId && comment.user_email && (
              <div className="grid grid-cols-3 gap-2">
                <span className="font-semibold">Email:</span>
                <span className="col-span-2">{comment.user_email}</span>
              </div>
            )}
            {parentCommentId && (
              <div className="grid grid-cols-3 gap-2">
                <span className="font-semibold">Trả lời bình luận:</span>
                <div className="col-span-2">
                  {parentComment ? (
                    <div className="space-y-1 rounded border p-2 text-sm">
                      <p className="text-muted-foreground text-xs">
                        #{parentComment.id} ·{' '}
                        {parentComment.user
                          ? parentComment.user.fullName ||
                            parentComment.user.full_name ||
                            `User #${parentComment.user.id}`
                          : parentComment.userName || parentComment.user_name || '-'}{' '}
                        ·{' '}
                        {formatDateTime(
                          (parentComment.createdAt ?? parentComment.created_at) as string
                        )}
                      </p>
                      <p className="whitespace-pre-wrap">{parentComment.content}</p>
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-sm">
                      #{parentCommentId}
                    </span>
                  )}
                </div>
              </div>
            )}
            <div className="grid grid-cols-3 gap-2">
              <span className="font-semibold">Nội dung:</span>
              <div className="col-span-2 rounded border p-2 text-sm whitespace-pre-wrap">
                {comment.content}
              </div>
            </div>
            {comment.replies && comment.replies.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                <span className="font-semibold">Trả lời ({comment.replies.length}):</span>
                <div className="col-span-2 space-y-2">
                  {comment.replies.map((r) => (
                    <div key={r.id} className="rounded border p-2 text-sm">
                      <p className="text-muted-foreground text-xs">
                        #{r.id} ·{' '}
                        {r.userName ||
                          r.user_name ||
                          (r.user
                            ? r.user.fullName || r.user.full_name || `User #${r.user.id}`
                            : '-')}{' '}
                        · {formatDateTime((r.createdAt ?? r.created_at) as string)}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap">{r.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="grid grid-cols-3 gap-2">
              <span className="font-semibold">Trạng thái:</span>
              <span className="col-span-2">
                {toApprovedFlag(isApproved) ? (
                  <Badge variant="default">Đã duyệt</Badge>
                ) : (
                  <Badge variant="secondary">Chờ duyệt</Badge>
                )}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <span className="font-semibold">Ngày tạo:</span>
              <span className="col-span-2">
                {createdAt ? formatDateTime(createdAt) : '-'}
              </span>
            </div>
            {updatedAt && (
              <div className="grid grid-cols-3 gap-2">
                <span className="font-semibold">Cập nhật:</span>
                <span className="col-span-2">
                  {formatDateTime(updatedAt)}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div>Không có dữ liệu</div>
        )}
      </DialogContent>
    </Dialog>
  )
}
