import type { JSX } from 'react'
import { useState, useEffect, useRef } from 'react'
import { useApiQuery, useApiMutation, mapImageService } from '@/service'
import type {
  ApiResponse,
  MapImage,
  MapImageListData,
  Pagination,
  PdfMapListParams,
  PdfMapTheme,
} from '@/types/api'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import ToolTableCustom from '@/components/features/ToolTableCustom'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
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
import { StatusDotBadge } from '@/components/common/StatusDotBadge'
import {
  PUBLIC_LABEL,
  PUBLIC_CLASS,
  PUBLIC_DOT,
  THEME_LABEL,
} from '@/constant/mapImageConstant'
import { Pen, Trash2, ToggleLeft, ToggleRight, FileImage } from 'lucide-react'
import PageLayout from '@/layout/pageLayout'
import MapImageDetailDialog from './MapImageDetailDialog'
import MapImageFormDialog from './MapImageFormDialog'
import { isPdf, parseLink } from '@/lib/utils'
import { formatDate } from '@/lib/date'
import { hasPerm } from '@/lib/permissions'
import { useAuthStore } from '@/stores/common/useAuthStore'

export default function MapImagePage(): JSX.Element {
  const user = useAuthStore((s) => s.user)
  const canCreate = hasPerm(user, 'pdf_maps', 'create')
  const canUpdate = hasPerm(user, 'pdf_maps', 'update')
  const canDelete = hasPerm(user, 'pdf_maps', 'delete')
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [limit, setLimit] = useState<number>(10)
  const [searchValue, setSearchValue] = useState<string>('')
  const [themeFilter, setThemeFilter] = useState<string>('all')
  const [isPublicFilter, setIsPublicFilter] = useState<string>('all')
  const [yearFrom, setYearFrom] = useState<string>('')
  const [yearTo, setYearTo] = useState<string>('')

  const queryParams: PdfMapListParams = {
    page: currentPage,
    limit,
    sortBy: 'id',
    sortOrder: 'DESC' as const,
    ...(searchValue && { q: searchValue }),
    ...(themeFilter !== 'all' && { theme: themeFilter as PdfMapTheme }),
    ...(isPublicFilter !== 'all' && { isPublic: isPublicFilter === 'true' }),
    ...(yearFrom.trim() && !Number.isNaN(Number(yearFrom)) && { yearFrom: Number(yearFrom) }),
    ...(yearTo.trim() && !Number.isNaN(Number(yearTo)) && { yearTo: Number(yearTo) }),
  }

  const dbQuery = useApiQuery(
    ['mapImages', queryParams],
    () => mapImageService.getAll(queryParams),
    {},
    false,
    false
  )

  const data = (dbQuery.data as ApiResponse<MapImageListData & { pdfMaps?: MapImage[] }>)?.data
  const mapImages = ((data as any)?.pdfMaps ?? data?.mapImages ?? []) as MapImage[]
  const pagination = (data?.pagination ?? {}) as Partial<Pagination>

  const lastTotalPagesRef = useRef<number | null>(null)
  if (pagination?.totalPages) lastTotalPagesRef.current = pagination.totalPages
  const totalPages = pagination?.totalPages ?? lastTotalPagesRef.current ?? 1
  const total = pagination?.total ?? 0

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages)
  }, [currentPage, totalPages])

  // Dialog states
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [formDialogOpen, setFormDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<MapImage | null>(null)

  // Create mutation
  const createMutation = useApiMutation(
    (data: FormData) => mapImageService.create(data),
    {
      onSuccess: () => {
        dbQuery.refetch()
        setFormDialogOpen(false)
        setSelectedId(null)
      },
    },
    true
  )

  // Update mutation — now JSON PUT with translations + expectedUpdatedAt
  const updateMutation = useApiMutation(
    (data: { id: number; payload: any }) => mapImageService.update(data.id, data.payload),
    {
      onSuccess: () => {
        dbQuery.refetch()
        setFormDialogOpen(false)
        setSelectedId(null)
      },
    },
    true
  )

  // Toggle isPublic (compat shim expects expectedUpdatedAt + isPublic)
  const toggleMutation = useApiMutation(
    (payload: { id: number; expectedUpdatedAt: string; isPublic: boolean }) =>
      mapImageService.toggleStatus(payload.id, payload.expectedUpdatedAt, payload.isPublic),
    {
      onSuccess: () => {
        dbQuery.refetch()
      },
    },
    true
  )

  // Delete mutation
  const deleteMutation = useApiMutation(
    (id: number) => mapImageService.delete(id),
    {
      onSuccess: () => {
        dbQuery.refetch()
        setDeleteDialogOpen(false)
        setItemToDelete(null)
      },
    },
    true
  )

  function openDetails(item: MapImage) {
    setSelectedId(item.id)
    setDetailDialogOpen(true)
  }

  function openAddDialog() {
    setSelectedId(null)
    setFormDialogOpen(true)
  }

  function openEditDialog(item: MapImage) {
    setSelectedId(item.id)
    setFormDialogOpen(true)
  }

  function openDeleteDialog(item: MapImage) {
    setItemToDelete(item)
    setDeleteDialogOpen(true)
  }

  function handleFormSubmit(payload: FormData | Record<string, any>) {
    if (selectedId) {
      // Update path: JSON body (translations.vi + expectedUpdatedAt + partial fields)
      updateMutation.mutate({ id: selectedId, payload })
    } else {
      // Create path: multipart FormData
      createMutation.mutate(payload as FormData)
    }
  }

  function handleDelete() {
    if (itemToDelete) {
      deleteMutation.mutate(itemToDelete.id)
    }
  }

  return (
    <PageLayout title="Ảnh bản đồ" description="Quản lý ảnh bản đồ trong hệ thống">
      <ToolTableCustom
        searchValue={searchValue}
        setSearchValue={setSearchValue}
        filter={
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={themeFilter}
              onValueChange={(v) => {
                setThemeFilter(v)
                setCurrentPage(1)
              }}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Chủ đề" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Mọi chủ đề</SelectItem>
                <SelectItem value="lop_phu_nhiet">{THEME_LABEL.lop_phu_nhiet}</SelectItem>
                <SelectItem value="chay_rung">{THEME_LABEL.chay_rung}</SelectItem>
                <SelectItem value="lop_phu_rung">{THEME_LABEL.lop_phu_rung}</SelectItem>
                <SelectItem value="khac">{THEME_LABEL.khac}</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={isPublicFilter}
              onValueChange={(v) => {
                setIsPublicFilter(v)
                setCurrentPage(1)
              }}
            >
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Trạng thái" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="true">Công khai</SelectItem>
                <SelectItem value="false">Riêng tư</SelectItem>
              </SelectContent>
            </Select>

            <Input
              type="number"
              value={yearFrom}
              onChange={(e) => {
                setYearFrom(e.target.value)
                setCurrentPage(1)
              }}
              placeholder="Năm từ"
              className="w-24"
            />
            <Input
              type="number"
              value={yearTo}
              onChange={(e) => {
                setYearTo(e.target.value)
                setCurrentPage(1)
              }}
              placeholder="Năm đến"
              className="w-24"
            />

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
                Thêm bản đồ PDF
              </Button>
            )}
          </div>
        }
        total={total}
        pagination={{
          currentPage,
          totalPages,
          onPageChange: (page: number) => setCurrentPage(page),
        }}
      >
        <Table className="relative">
          <TableHeader className="sticky top-0 z-20">
            <TableRow>
              <TableHead className="w-12">ID</TableHead>
              <TableHead className="w-20">Ảnh</TableHead>
              <TableHead>Tên</TableHead>
              <TableHead>Mô tả</TableHead>
              <TableHead className="w-32">Trạng thái</TableHead>
              <TableHead className="w-40">Ngày tạo</TableHead>
              <TableHead className="w-32 text-right">Hành động</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mapImages.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center">
                  Không có dữ liệu
                </TableCell>
              </TableRow>
            ) : (
              mapImages.map((item: MapImage) => (
                <TableRow
                  key={item.id}
                  className="hover:cursor-pointer"
                  onClick={() => openDetails(item)}
                >
                  <TableCell>{item.id}</TableCell>
                  <TableCell>
                    {item.image_url ? (
                      isPdf(item.image_url) ? (
                        <div className="flex h-12 w-16 items-center justify-center rounded border bg-gradient-to-br from-sky-50 to-sky-100">
                          <FileImage className="h-6 w-6 text-sky-700" />
                        </div>
                      ) : (
                        <img
                          src={parseLink(item.image_url)}
                          alt={item.name}
                          className="h-12 w-16 rounded border object-cover"
                        />
                      )
                    ) : (
                      <div className="bg-muted h-12 w-16 rounded border" />
                    )}
                  </TableCell>
                  <TableCell className="max-w-48 font-medium">
                    <span className="line-clamp-2">{item.name}</span>
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-64">
                    <span className="line-clamp-2">{item.description || '-'}</span>
                  </TableCell>
                  <TableCell>
                    <StatusDotBadge
                      label={PUBLIC_LABEL[String(item.isPublic ?? item.is_active ?? false)]}
                      badgeClass={PUBLIC_CLASS[String(item.isPublic ?? item.is_active ?? false)]}
                      dotClass={PUBLIC_DOT[String(item.isPublic ?? item.is_active ?? false)]}
                    />
                  </TableCell>
                  <TableCell className="text-sm">
                    {item.created_at ? formatDate(item.created_at) : '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {canUpdate && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            openEditDialog(item)
                          }}
                          title="Chỉnh sửa"
                        >
                          <Pen className="size-4" />
                        </Button>
                      )}
                      {canUpdate && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleMutation.mutate({
                              id: item.id,
                              expectedUpdatedAt: (item.updatedAt ??
                                item.updated_at ??
                                '') as string,
                              isPublic: !(item.isPublic ?? item.is_active ?? false),
                            })
                          }}
                          title={item.is_active ? 'Hủy kích hoạt' : 'Kích hoạt'}
                        >
                          {item.is_active ? (
                            <ToggleRight className="text-primary size-4" />
                          ) : (
                            <ToggleLeft className="text-muted-foreground size-4" />
                          )}
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            openDeleteDialog(item)
                          }}
                          title="Xóa"
                        >
                          <Trash2 className="text-destructive size-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </ToolTableCustom>

      {/* Dialog chi tiết */}
      <MapImageDetailDialog
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        mapImageId={selectedId}
      />

      {/* Dialog thêm/sửa */}
      <MapImageFormDialog
        open={formDialogOpen}
        onOpenChange={setFormDialogOpen}
        mapImageId={selectedId}
        onSubmit={handleFormSubmit}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />

      {/* Dialog xác nhận xóa */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn xóa ảnh bản đồ &quot;{itemToDelete?.name}&quot;? Hành động này
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
