import type { JSX } from 'react'
import { useState } from 'react'
import { useApiQuery, useApiMutation, newsCommentService } from '@/service'
import type {
  ApiResponse,
  NewsComment,
  NewsCommentAdminListParams,
  NewsCommentListData,
  Pagination,
} from '@/types/api'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { StatusDotBadge } from '@/components/common/StatusDotBadge'
import { APPROVED_LABEL, APPROVED_CLASS, APPROVED_DOT } from '@/constant/newsCommentConstant'
import ToolTableCustom from '@/components/features/ToolTableCustom'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Trash2 } from 'lucide-react'
import PageLayout from '@/layout/pageLayout'
import { UserCell } from '@/components/common/UserCell'
import NewsCommentDetailDialog from './NewsCommentDetailDialog'
import { formatDate } from '@/lib/date'
import { toApprovedFlag } from '@/lib/newsComment'
import { hasPerm } from '@/lib/permissions'
import { useAuthStore } from '@/stores/common/useAuthStore'

export default function NewsComments(): JSX.Element {
  const user = useAuthStore((s) => s.user)
  const canApprove = hasPerm(user, 'comments', 'approve')
  const canDelete = hasPerm(user, 'comments', 'delete')
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [limit, setLimit] = useState<number>(10)
  const [searchValue, setSearchValue] = useState<string>('')
  const [approvedFilter, setApprovedFilter] = useState<string>('all')

  const queryParams: NewsCommentAdminListParams = {
    page: currentPage,
    limit,
    ...(approvedFilter !== 'all' && { approved: approvedFilter === 'true' }),
  }

  const dbQuery = useApiQuery(
    ['news-comments', queryParams],
    () => newsCommentService.getAll(queryParams),
    {},
    false,
    false
  )

  const raw = dbQuery.data as ApiResponse<NewsCommentListData> | undefined
  const data = raw?.data
  const comments = data?.items ?? data?.comments ?? []
  const pagination = (raw?.metadata ?? data?.pagination ?? {}) as Partial<Pagination>
  const totalPages = Math.max(1, pagination.totalPages ?? 1)
  const total = pagination?.total ?? 0

  // Filter comments locally by search value (user_name, user_email, content)
  const filteredComments = searchValue
    ? comments.filter((c) => {
        const q = searchValue.toLowerCase()
        return (
          c.content?.toLowerCase().includes(q) ||
          c.userName?.toLowerCase().includes(q) ||
          c.user_name?.toLowerCase().includes(q) ||
          c.user_email?.toLowerCase().includes(q) ||
          c.newsTitle?.toLowerCase().includes(q)
        )
      })
    : comments

  // Dialog states
  const [selectedCommentId, setSelectedCommentId] = useState<number | string | null>(null)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [commentToDelete, setCommentToDelete] = useState<NewsComment | null>(null)

  // Approve mutation
  const approveMutation = useApiMutation(
    (id: number | string) => newsCommentService.approve(id),
    {
      onSuccess: () => {
        dbQuery.refetch()
      },
    },
    true
  )

  // Delete mutation
  const deleteMutation = useApiMutation(
    (id: number | string) => newsCommentService.adminDelete(id),
    {
      onSuccess: () => {
        if (comments.length === 1 && currentPage > 1) {
          setCurrentPage((page) => page - 1)
        } else {
          dbQuery.refetch()
        }
        setDeleteDialogOpen(false)
        setCommentToDelete(null)
      },
    },
    true
  )

  function openDetails(c: NewsComment) {
    if (c?.id) {
      setSelectedCommentId(c.id)
      setDetailDialogOpen(true)
    }
  }

  function openDeleteDialog(c: NewsComment) {
    setCommentToDelete(c)
    setDeleteDialogOpen(true)
  }

  function handleDelete() {
    if (commentToDelete) {
      deleteMutation.mutate(commentToDelete.id)
    }
  }

  return (
    <PageLayout title="Bình luận tin tức" description="Quản lý bình luận bài viết">
      <ToolTableCustom
        searchValue={searchValue}
        setSearchValue={(v) => {
          setSearchValue(v)
          setCurrentPage(1)
        }}
        filter={
          <div className="flex items-center gap-2">
            <Select
              value={approvedFilter}
              onValueChange={(v) => {
                setApprovedFilter(v)
                setCurrentPage(1)
              }}
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="false">Chờ duyệt</SelectItem>
                <SelectItem value="true">Đã duyệt</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={`${limit}`}
              onValueChange={(v) => {
                setLimit(parseInt(v, 10))
                setCurrentPage(1)
              }}
            >
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
        total={total}
        pagination={{
          currentPage: currentPage,
          totalPages,
          onPageChange: (page: number) => setCurrentPage(page),
        }}
      >
        <Table className="relative">
          <TableHeader className="sticky top-0 z-20">
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Bài viết</TableHead>
              <TableHead>Người bình luận</TableHead>
              <TableHead>Nội dung</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead>Ngày tạo</TableHead>
              <TableHead className="text-right">Hành động</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredComments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center">
                  Không có dữ liệu
                </TableCell>
              </TableRow>
            ) : (
              filteredComments.map((c) => {
                const newsId = c.newsId ?? c.news_id
                const userId = c.userId ?? c.user_id
                const userName =
                  c.userName ?? c.user_name ?? c.user?.fullName ?? c.user?.full_name
                const isApproved = c.isApproved ?? c.is_approved
                const createdAt = c.createdAt ?? c.created_at

                return (
                  <TableRow
                    className="hover:cursor-pointer"
                    key={c.id}
                    onClick={() => openDetails(c)}
                  >
                    <TableCell>{c.id}</TableCell>
                    <TableCell className="max-w-72">
                      <div className="space-y-0.5">
                        <p className="line-clamp-2 text-sm font-medium">
                          {c.newsTitle || `Bài viết #${newsId}`}
                        </p>
                        {c.newsTitle && newsId && (
                          <p className="text-muted-foreground text-xs">#{newsId}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <UserCell userId={userId} inlineUser={userName} />
                    </TableCell>
                    <TableCell className="max-w-64">
                      <span className="line-clamp-2 text-sm">{c.content}</span>
                    </TableCell>
                    <TableCell>
                      <StatusDotBadge
                        label={APPROVED_LABEL[String(toApprovedFlag(isApproved))]}
                        badgeClass={APPROVED_CLASS[String(toApprovedFlag(isApproved))]}
                        dotClass={APPROVED_DOT[String(toApprovedFlag(isApproved))]}
                      />
                    </TableCell>
                    <TableCell>{createdAt ? formatDate(createdAt) : '-'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {canApprove && (
                          <Button
                            variant={toApprovedFlag(isApproved) ? 'outline' : 'default'}
                            size="sm"
                            disabled={toApprovedFlag(isApproved) || approveMutation.isPending}
                            onClick={(e) => {
                              e.stopPropagation()
                              if (!toApprovedFlag(isApproved)) approveMutation.mutate(c.id)
                            }}
                            title={
                              toApprovedFlag(isApproved)
                                ? 'Bình luận đã được duyệt'
                                : 'Duyệt bình luận'
                            }
                          >
                            {toApprovedFlag(isApproved)
                              ? 'Đã duyệt'
                              : approveMutation.isPending
                                ? 'Đang duyệt...'
                                : 'Duyệt'}
                          </Button>
                        )}
                        {canDelete && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              openDeleteDialog(c)
                            }}
                            title="Xóa"
                          >
                            <Trash2 className="text-destructive size-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </ToolTableCustom>

      {/* Dialog chi tiết */}
      <NewsCommentDetailDialog
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        commentId={selectedCommentId}
      />

      {/* Dialog xác nhận xóa */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn xóa bình luận này? Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? 'Đang xóa...' : 'Xóa'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageLayout>
  )
}
