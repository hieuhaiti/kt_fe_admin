import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { newsCommentService, useApiQuery } from '@/service'
import type { ApiResponse, NewsCommentData } from '@/types/api'
import { UserText } from '@/components/common/UserText'
import { formatDateTime } from '@/lib/date'
import { toApprovedFlag } from '@/lib/newsComment'

interface NewsCommentDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  commentId: number | null
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
  const comment = (dbQuery.data as ApiResponse<NewsCommentData>)?.data?.comment ?? null

  const parentQuery = useApiQuery(
    ['news-comment', comment?.parent_comment_id],
    () => newsCommentService.getById(comment!.parent_comment_id!),
    { enabled: !!comment?.parent_comment_id, staleTime: 0 },
    false,
    false
  )
  const parentComment = (parentQuery.data as ApiResponse<NewsCommentData>)?.data?.comment ?? null

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
              <span className="col-span-2">{comment.news_id}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <span className="font-semibold">Người bình luận:</span>
              <span className="col-span-2">
                {comment.user_id ? <UserText userId={comment.user_id} /> : comment.user_name || '-'}
              </span>
            </div>
            {!comment.user_id && comment.user_email && (
              <div className="grid grid-cols-3 gap-2">
                <span className="font-semibold">Email:</span>
                <span className="col-span-2">{comment.user_email}</span>
              </div>
            )}
            {comment.parent_comment_id && (
              <div className="grid grid-cols-3 gap-2">
                <span className="font-semibold">Trả lời bình luận:</span>
                <div className="col-span-2">
                  {parentComment ? (
                    <div className="space-y-1 rounded border p-2 text-sm">
                      <p className="text-muted-foreground text-xs">
                        #{parentComment.id} ·{' '}
                        {parentComment.user
                          ? parentComment.user.full_name || `User #${parentComment.user.id}`
                          : parentComment.user_name || '-'}{' '}
                        · {formatDateTime(parentComment.created_at)}
                      </p>
                      <p className="whitespace-pre-wrap">{parentComment.content}</p>
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-sm">
                      #{comment.parent_comment_id}
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
                        {r.user_name || (r.user ? r.user.full_name || `User #${r.user.id}` : '-')} ·{' '}
                        {formatDateTime(r.created_at)}
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
                {toApprovedFlag(comment.is_approved) ? (
                  <Badge variant="default">Đã duyệt</Badge>
                ) : (
                  <Badge variant="secondary">Chờ duyệt</Badge>
                )}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <span className="font-semibold">Ngày tạo:</span>
              <span className="col-span-2">
                {comment.created_at ? formatDateTime(comment.created_at) : '-'}
              </span>
            </div>
            {comment.updated_at && (
              <div className="grid grid-cols-3 gap-2">
                <span className="font-semibold">Cập nhật:</span>
                <span className="col-span-2">
                  {formatDateTime(comment.updated_at)}
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
