import type { JSX } from 'react'
import { useState, useEffect, useRef } from 'react'
import { useApiQuery, useApiMutation, newsService } from '@/service'
import type { ApiResponse, NewsStatus, Pagination, UpdateNewsBody } from '@/types/api'
import { useQueryClient } from '@tanstack/react-query'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { StatusDotBadge } from '@/components/common/StatusDotBadge'
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
import { Pen, Trash2 } from 'lucide-react'
import PageLayout from '@/layout/pageLayout'
import NewsDetailDialog from './NewsDetailDialog'
import NewsFormDialog from './NewsFormDialog'
import { formatDate } from '@/lib/date'
import { hasPerm } from '@/lib/permissions'
import { useAuthStore } from '@/stores/common/useAuthStore'

const STATUS_LABEL: Record<string, string> = {
  published: 'Đã xuất bản',
  draft: 'Bản nháp',
}
const STATUS_CLASS: Record<string, string> = {
  published: 'bg-green-50 text-green-700 border-green-200',
  draft: 'bg-slate-100 text-slate-500 border-slate-200',
}
const STATUS_DOT: Record<string, string> = {
  published: 'bg-green-500',
  draft: 'bg-slate-400',
}

export default function News(): JSX.Element {
  const user = useAuthStore((s) => s.user)
  const canCreate = hasPerm(user, 'news', 'create')
  const canUpdate = hasPerm(user, 'news', 'update')
  const canDelete = hasPerm(user, 'news', 'delete')
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [limit, setLimit] = useState<number>(10)
  const [searchValue, setSearchValue] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<NewsStatus | 'all'>('all')

  const queryParams = {
    page: currentPage,
    limit,
    sortBy: 'created_at' as const,
    sortOrder: 'DESC' as const,
    ...(searchValue && { q: searchValue }),
    ...(statusFilter !== 'all' && { status: statusFilter }),
  }

  const dbQuery = useApiQuery(
    ['news', queryParams],
    () => newsService.getAll(queryParams),
    {},
    false,
    false
  )

  const raw = dbQuery.data as ApiResponse<any> | undefined
  const data = raw?.data as any
  const newsList = data?.items ?? data?.news ?? []
  const pagination = (raw?.metadata ?? data?.pagination ?? {}) as Partial<Pagination>
  const lastTotalPagesRef = useRef<number | null>(null)
  if (pagination?.totalPages) lastTotalPagesRef.current = pagination.totalPages
  const totalPages = pagination?.totalPages ?? lastTotalPagesRef.current ?? 1
  const total = pagination?.total ?? 0

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages)
  }, [currentPage, totalPages])

  // Dialog states
  const [selectedNewsId, setSelectedNewsId] = useState<number | null>(null)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [formDialogOpen, setFormDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [newsToDelete, setNewsToDelete] = useState<any | null>(null)

  const queryClient = useQueryClient()

  // Create mutation — FormData multipart
  const createMutation = useApiMutation(
    (data: FormData) => newsService.create(data),
    {
      onSuccess: () => {
        dbQuery.refetch()
        setFormDialogOpen(false)
        setSelectedNewsId(null)
      },
    },
    true
  )

  // Update mutation — JSON PUT
  const updateMutation = useApiMutation(
    (data: { id: number; payload: UpdateNewsBody }) => newsService.update(data.id, data.payload),
    {
      onSuccess: (_data, variables) => {
        const vars = variables as { id: number; payload: UpdateNewsBody }
        queryClient.invalidateQueries({ queryKey: ['news', vars.id] })
        dbQuery.refetch()
        setFormDialogOpen(false)
        setSelectedNewsId(null)
      },
    },
    true
  )

  // Delete mutation
  const deleteMutation = useApiMutation(
    (id: number) => newsService.delete(id),
    {
      onSuccess: () => {
        dbQuery.refetch()
        setDeleteDialogOpen(false)
        setNewsToDelete(null)
      },
    },
    true
  )

  function openDetails(n: any) {
    if (n?.id) {
      setSelectedNewsId(n.id)
      setDetailDialogOpen(true)
    }
  }

  function openAddDialog() {
    setSelectedNewsId(null)
    setFormDialogOpen(true)
  }

  function openEditDialog(n: any) {
    setSelectedNewsId(n.id)
    setFormDialogOpen(true)
  }

  function openDeleteDialog(n: any) {
    setNewsToDelete(n)
    setDeleteDialogOpen(true)
  }

  function handleFormSubmit(data: FormData | UpdateNewsBody) {
    if (selectedNewsId) {
      updateMutation.mutate({ id: selectedNewsId, payload: data as UpdateNewsBody })
    } else {
      createMutation.mutate(data as FormData)
    }
  }

  function handleDelete() {
    if (newsToDelete) {
      deleteMutation.mutate(newsToDelete.id)
    }
  }

  return (
    <PageLayout title="Tin tức" description="Quản lý bài viết tin tức">
      <ToolTableCustom
        searchValue={searchValue}
        setSearchValue={(v) => {
          setSearchValue(v)
          setCurrentPage(1)
        }}
        filter={
          <div className="flex items-center gap-2">
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v as NewsStatus | 'all')
                setCurrentPage(1)
              }}
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="published">Đã xuất bản</SelectItem>
                <SelectItem value="draft">Bản nháp</SelectItem>
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

            {canCreate && (
              <Button variant="default" onClick={openAddDialog}>
                Thêm tin tức
              </Button>
            )}
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
              <TableHead>Tiêu đề</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead>Lượt xem</TableHead>
              <TableHead>Ngày tạo</TableHead>
              <TableHead className="text-right">Hành động</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {newsList.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center">
                  Không có dữ liệu
                </TableCell>
              </TableRow>
            ) : (
              newsList.map((n: any) => {
                const status: string = n.status ?? (n.is_published ? 'published' : 'draft')
                const createdAt = n.createdAt ?? n.created_at
                const viewCount = n.viewCount ?? n.view_count ?? 0
                return (
                  <TableRow
                    className="hover:cursor-pointer"
                    key={n.id}
                    onClick={() => openDetails(n)}
                  >
                    <TableCell>{n.id}</TableCell>
                    <TableCell className="max-w-64">
                      <span className="line-clamp-2">{n.title}</span>
                    </TableCell>
                    <TableCell>
                      <StatusDotBadge
                        label={STATUS_LABEL[status] ?? status}
                        badgeClass={
                          STATUS_CLASS[status] ?? 'bg-slate-100 text-slate-500 border-slate-200'
                        }
                        dotClass={STATUS_DOT[status] ?? 'bg-slate-400'}
                      />
                    </TableCell>
                    <TableCell>{viewCount}</TableCell>
                    <TableCell>{createdAt ? formatDate(createdAt) : '-'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {canUpdate && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              openEditDialog(n)
                            }}
                            title="Chỉnh sửa"
                          >
                            <Pen className="size-4" />
                          </Button>
                        )}
                        {canDelete && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              openDeleteDialog(n)
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
      <NewsDetailDialog
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        newsId={selectedNewsId}
      />

      {/* Dialog thêm/sửa */}
      <NewsFormDialog
        open={formDialogOpen}
        onOpenChange={setFormDialogOpen}
        newsId={selectedNewsId}
        onSubmit={handleFormSubmit}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />

      {/* Dialog xác nhận xóa */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn xóa bài viết &quot;{newsToDelete?.title}&quot;? Hành động này
              không thể hoàn tác.
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
