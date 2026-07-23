import type { JSX } from 'react'
import { useState, useEffect, useRef } from 'react'
import { useApiQuery, useApiMutation, documentService } from '@/service'
import type { ApiResponse, Document, DocumentType, Pagination } from '@/types/api'
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
import { Pen, Trash2, FileText, Download } from 'lucide-react'
import PageLayout from '@/layout/pageLayout'
import DocumentDetailDialog from './DocumentDetailDialog'
import DocumentFormDialog from './DocumentFormDialog'
import { parseLink } from '@/lib/utils'
import { formatDate } from '@/lib/date'
import { TYPE_LABEL, TYPE_CLASS, TYPE_DOT } from '@/constant/documentConstant'
import { hasPerm } from '@/lib/permissions'
import { useAuthStore } from '@/stores/common/useAuthStore'

type IsPublicFilter = 'all' | 'true' | 'false'

function formatSize(size?: number | string) {
  const n = typeof size === 'string' ? Number(size) : size
  if (!n || Number.isNaN(n)) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(2)} MB`
}

function getDocumentTitle(item: any) {
  return item?.translations?.vi?.title ?? item?.title ?? '-'
}

export default function DocumentPage(): JSX.Element {
  const user = useAuthStore((s) => s.user)
  const canCreate = hasPerm(user, 'documents', 'create')
  const canUpdate = hasPerm(user, 'documents', 'update')
  const canDelete = hasPerm(user, 'documents', 'delete')
  const [currentPage, setCurrentPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [searchValue, setSearchValue] = useState('')
  const [filterType, setFilterType] = useState<DocumentType | 'all'>('all')
  const [filterPublic, setFilterPublic] = useState<IsPublicFilter>('all')

  const queryParams = {
    page: currentPage,
    limit,
    sortBy: 'created_at',
    sortOrder: 'DESC' as const,
    ...(searchValue && { q: searchValue }),
    ...(filterType !== 'all' && { docType: filterType }),
    ...(filterPublic !== 'all' && { isPublic: filterPublic === 'true' }),
  }

  const dbQuery = useApiQuery(
    ['documents', queryParams],
    () => documentService.getAll(queryParams),
    {},
    false,
    false
  )

  const raw = dbQuery.data as ApiResponse<any> | undefined
  const data = raw?.data as any
  const documents: any[] = data?.items ?? data?.documents ?? []
  const pagination = (raw?.metadata ?? data?.pagination ?? {}) as Partial<Pagination>

  const lastTotalPagesRef = useRef<number | null>(null)
  if (pagination?.totalPages) lastTotalPagesRef.current = pagination.totalPages
  const totalPages = pagination?.totalPages ?? lastTotalPagesRef.current ?? 1
  const total = pagination?.total ?? 0

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages)
  }, [currentPage, totalPages])

  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [formDialogOpen, setFormDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<Document | null>(null)

  const createMutation = useApiMutation((fd: FormData) => documentService.create(fd), {
    onSuccess: () => {
      dbQuery.refetch()
      setFormDialogOpen(false)
      setSelectedId(null)
    },
  })

  const updateMutation = useApiMutation(
    (args: { id: number; payload: FormData }) =>
      documentService.update(args.id, args.payload as any),
    {
      onSuccess: () => {
        dbQuery.refetch()
        setFormDialogOpen(false)
        setSelectedId(null)
      },
    }
  )

  const deleteMutation = useApiMutation((id: number) => documentService.delete(id), {
    onSuccess: () => {
      dbQuery.refetch()
      setDeleteDialogOpen(false)
      setItemToDelete(null)
    },
  })

  function openDetails(item: any) {
    setSelectedId(Number(item.id))
    setDetailDialogOpen(true)
  }

  function openAddDialog() {
    setSelectedId(null)
    setFormDialogOpen(true)
  }

  function openEditDialog(item: any) {
    setSelectedId(Number(item.id))
    setFormDialogOpen(true)
  }

  function openDeleteDialog(item: any) {
    setItemToDelete(item)
    setDeleteDialogOpen(true)
  }

  function handleFormSubmit(fd: FormData) {
    if (selectedId) updateMutation.mutate({ id: selectedId, payload: fd })
    else createMutation.mutate(fd)
  }

  return (
    <PageLayout title="Văn bản báo cáo" description="Quản lý tài liệu và văn bản trong hệ thống">
      <ToolTableCustom
        searchValue={searchValue}
        setSearchValue={setSearchValue}
        filter={
          <div className="flex items-center gap-2">
            <Select
              value={filterType}
              onValueChange={(v) => {
                setFilterType(v as DocumentType | 'all')
                setCurrentPage(1)
              }}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Loại" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả loại</SelectItem>
                <SelectItem value="bao_cao">Báo cáo</SelectItem>
                <SelectItem value="van_ban">Văn bản pháp quy</SelectItem>
                <SelectItem value="pdf_map">Bản đồ PDF</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filterPublic}
              onValueChange={(v) => {
                setFilterPublic(v as IsPublicFilter)
                setCurrentPage(1)
              }}
            >
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Phạm vi" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="true">Công khai</SelectItem>
                <SelectItem value="false">Nội bộ</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={`${limit}`}
              onValueChange={(v) => {
                setLimit(parseInt(v, 10))
                setCurrentPage(1)
              }}
            >
              <SelectTrigger className="w-24">
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
                Thêm tài liệu
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
              <TableHead>Tiêu đề</TableHead>
              <TableHead className="w-40">Loại</TableHead>
              <TableHead className="w-24">Phạm vi</TableHead>
              <TableHead className="w-40">Người upload</TableHead>
              <TableHead className="w-24">Kích thước</TableHead>
              <TableHead className="w-28">Ngày tạo</TableHead>
              <TableHead className="w-28 text-right">Hành động</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {documents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center">
                  Không có dữ liệu
                </TableCell>
              </TableRow>
            ) : (
              documents.map((item) => {
                const docType = (item.docType ?? item.document_type ?? '') as string
                const isPublic = item.isPublic ?? item.is_public ?? false
                const fileUrl = item.fileUrl ?? item.file_url ?? ''
                const uploadedByName =
                  item.uploadedByName ?? item.uploaded_by_name ?? item.createdByName ?? '-'
                const fileName = item.fileName ?? item.file_name
                const fileSize = item.fileSize ?? item.file_size
                const createdAt = item.createdAt ?? item.created_at
                const title = getDocumentTitle(item)
                return (
                  <TableRow
                    key={item.id}
                    className="hover:cursor-pointer"
                    onClick={() => openDetails(item)}
                  >
                    <TableCell>{item.id}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileText className="text-muted-foreground size-4 shrink-0" />
                        <div className="min-w-0">
                          <p className="line-clamp-2 max-w-96 font-medium">{title}</p>
                          {fileName && (
                            <p className="text-muted-foreground truncate text-xs">{fileName}</p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusDotBadge
                        label={TYPE_LABEL[docType] ?? docType ?? '—'}
                        badgeClass={
                          TYPE_CLASS[docType] ?? 'bg-slate-100 text-slate-600 border-slate-200'
                        }
                        dotClass={TYPE_DOT[docType] ?? 'bg-slate-400'}
                      />
                    </TableCell>
                    <TableCell>
                      <StatusDotBadge
                        label={isPublic ? 'Công khai' : 'Nội bộ'}
                        badgeClass={
                          isPublic
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : 'bg-slate-100 text-slate-500 border-slate-200'
                        }
                        dotClass={isPublic ? 'bg-blue-500' : 'bg-slate-400'}
                      />
                    </TableCell>
                    <TableCell className="text-sm">{uploadedByName}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {formatSize(fileSize)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {createdAt ? formatDate(createdAt) : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {fileUrl && (
                          <Button
                            variant="ghost"
                            size="sm"
                            asChild
                            title="Tải file"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <a href={parseLink(fileUrl)} target="_blank" rel="noopener noreferrer">
                              <Download className="size-4" />
                            </a>
                          </Button>
                        )}
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
                )
              })
            )}
          </TableBody>
        </Table>
      </ToolTableCustom>

      <DocumentDetailDialog
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        documentId={selectedId}
      />

      <DocumentFormDialog
        open={formDialogOpen}
        onOpenChange={setFormDialogOpen}
        documentId={selectedId}
        onSubmit={handleFormSubmit}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn xóa tài liệu &quot;{getDocumentTitle(itemToDelete)}&quot;? Hành
              động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => itemToDelete && deleteMutation.mutate(Number(itemToDelete.id))}
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
