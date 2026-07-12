import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { newsService, useApiQuery } from '@/service'
import type { ApiResponse, News, NewsData } from '@/types/api'
import { parseLink } from '@/lib/utils'
import { UserText } from '@/components/common/UserText'
import { formatDateTime } from '@/lib/date'

interface NewsDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  newsId: number | null
}

const STATUS_LABEL: Record<string, string> = {
  published: 'Đã xuất bản',
  draft: 'Bản nháp',
}

const CATEGORY_LABEL: Record<string, string> = {
  general: 'Tin chung',
}

function getNewsDetail(response?: ApiResponse<NewsData | News>): News | null {
  const data = response?.data
  if (!data) return null

  if ('news' in data && data.news) return data.news

  return data as News
}

function toNumber(value?: number | string | null): number | null {
  if (value === null || value === undefined) return null
  const parsed = Number(value)
  return Number.isNaN(parsed) ? null : parsed
}

export default function NewsDetailDialog({ open, onOpenChange, newsId }: NewsDetailDialogProps) {
  const dbQuery = useApiQuery(
    ['news', newsId],
    () => newsService.getById(newsId!),
    { enabled: !!newsId && open, staleTime: 0 },
    false,
    false
  )
  const news = getNewsDetail(dbQuery.data as ApiResponse<NewsData | News> | undefined)

  const vi = news?.translations?.vi
  const title = vi?.title ?? news?.title ?? ''
  const slug = vi?.slug ?? news?.slug
  const summary = vi?.summary ?? news?.summary
  const content = vi?.content ?? news?.content ?? ''
  const coverUrl = news?.coverUrl ?? news?.thumbnailUrl ?? news?.thumbnail_url
  const publishedAt = news?.publishedAt ?? news?.published_at
  const viewCount = news?.viewCount ?? news?.view_count ?? 0
  const createdAt = news?.createdAt ?? news?.created_at
  const updatedAt = news?.updatedAt ?? news?.updated_at
  const authorId = toNumber(news?.authorId ?? news?.createdBy ?? news?.created_by)
  const updatedBy = news?.updatedBy ?? news?.updated_by
  const status = news?.status ?? (news?.is_published ? 'published' : 'draft')
  const category = news?.category

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] max-w-3xl overflow-y-auto">
        <DialogTitle>Chi tiết tin tức</DialogTitle>
        <DialogDescription>Thông tin chi tiết bài viết đã chọn</DialogDescription>

        {dbQuery.isLoading ? (
          <div className="text-muted-foreground mt-4 text-sm">Đang tải dữ liệu...</div>
        ) : dbQuery.isError ? (
          <div className="text-destructive mt-4 text-sm">Không thể tải thông tin tin tức.</div>
        ) : news ? (
          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <span className="font-semibold">ID:</span>
              <span className="col-span-2">{news.id}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <span className="font-semibold">Tiêu đề:</span>
              <span className="col-span-2">{title || '-'}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <span className="font-semibold">Slug:</span>
              <span className="col-span-2 font-mono text-sm">{slug || '-'}</span>
            </div>
            {summary && (
              <div className="grid grid-cols-3 gap-2">
                <span className="font-semibold">Tóm tắt:</span>
                <span className="col-span-2">{summary}</span>
              </div>
            )}
            <div className="grid grid-cols-3 gap-2">
              <span className="font-semibold">Ảnh đại diện:</span>
              <span className="col-span-2">
                {coverUrl ? (
                  <img
                    src={parseLink(coverUrl)}
                    alt={title || 'Ảnh đại diện tin tức'}
                    className="h-24 w-40 rounded border object-cover"
                  />
                ) : (
                  '-'
                )}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <span className="font-semibold">Trạng thái:</span>
              <span className="col-span-2">
                <Badge variant={status === 'published' ? 'default' : 'secondary'}>
                  {STATUS_LABEL[status] ?? status ?? '-'}
                </Badge>
              </span>
            </div>
            {category && (
              <div className="grid grid-cols-3 gap-2">
                <span className="font-semibold">Danh mục:</span>
                <span className="col-span-2">{CATEGORY_LABEL[category] ?? category}</span>
              </div>
            )}
            <div className="grid grid-cols-3 gap-2">
              <span className="font-semibold">Tác giả:</span>
              <span className="col-span-2">
                {news.authorName ? (
                  <UserText inlineUser={news.authorName} />
                ) : authorId ? (
                  <UserText userId={authorId} />
                ) : (
                  '-'
                )}
              </span>
            </div>
            {publishedAt && (
              <div className="grid grid-cols-3 gap-2">
                <span className="font-semibold">Ngày xuất bản:</span>
                <span className="col-span-2">{formatDateTime(publishedAt)}</span>
              </div>
            )}
            <div className="grid grid-cols-3 gap-2">
              <span className="font-semibold">Lượt xem:</span>
              <span className="col-span-2">{viewCount}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <span className="font-semibold">Nội dung:</span>
              <div
                className="col-span-2 max-h-48 overflow-y-auto rounded border p-2 text-sm"
                dangerouslySetInnerHTML={{ __html: content || '-' }}
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <span className="font-semibold">Ngày tạo:</span>
              <span className="col-span-2">{createdAt ? formatDateTime(createdAt) : '-'}</span>
            </div>
            {updatedBy && (
              <div className="grid grid-cols-3 gap-2">
                <span className="font-semibold">Cập nhật bởi:</span>
                <span className="col-span-2">
                  <UserText userId={updatedBy} />
                </span>
              </div>
            )}
            <div className="grid grid-cols-3 gap-2">
              <span className="font-semibold">Cập nhật:</span>
              <span className="col-span-2">{updatedAt ? formatDateTime(updatedAt) : '-'}</span>
            </div>
          </div>
        ) : (
          <div className="text-muted-foreground mt-4 text-sm">Không có dữ liệu</div>
        )}
      </DialogContent>
    </Dialog>
  )
}
