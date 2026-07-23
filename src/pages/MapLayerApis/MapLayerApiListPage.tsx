import type { JSX } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { KeyRound, Pen, RotateCcw, Trash2 } from 'lucide-react'
import PageLayout from '@/layout/pageLayout'
import ToolTableCustom from '@/components/features/ToolTableCustom'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { mapLayerApiService, mapLayerService, useApiMutation, useApiQuery } from '@/service'
import { useAuthStore } from '@/stores/common/useAuthStore'
import type { ApiResponse, MapLayer, MapLayerApi, MapLayerApiListData, Pagination } from '@/types/api'
import { formatDateTime } from '@/lib/date'
import { getMappedErrorMessage } from '@/validators/mapLayerApiValidators'
import { hasMapLayerApiPermission } from '@/components/map-layer-apis/permissionUtils'
import { StatusDotBadge } from '@/components/common/StatusDotBadge'
import { ACTIVE_CLASS, ACTIVE_DOT, ACTIVE_LABEL } from '@/constant/mapLayerConstant'
import MapLayerApiDetailDialog from './MapLayerApiDetailDialog'
import MapLayerApiFormDialog from './MapLayerApiFormDialog'

function getMapApis(data: unknown): MapLayerApi[] {
  const response = data as ApiResponse<MapLayerApiListData> | undefined
  return response?.data?.items ?? response?.data?.apis ?? []
}

function getPagination(data: unknown): Partial<Pagination> {
  const response = data as ApiResponse<MapLayerApiListData> | undefined
  return (response?.metadata ?? response?.data?.pagination ?? {}) as Partial<Pagination>
}

function getLayerItems(data: unknown): MapLayer[] {
  const response = data as ApiResponse<{ items?: MapLayer[]; mapLayers?: MapLayer[] } | MapLayer[]> | undefined
  const payload = response?.data
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.items)) return payload.items
  if (Array.isArray(payload?.mapLayers)) return payload.mapLayers
  return []
}

function layerLabel(layer: MapLayer) {
  return layer.name_vi || layer.name || layer.code
}

function formatScope(api: MapLayerApi) {
  const rate = api.scope?.rate_per_min ?? 60
  const bbox = api.scope?.bbox_limit
  return bbox == null ? `${rate}/phút` : `${rate}/phút, bbox ${bbox}`
}

export default function MapLayerApiListPage(): JSX.Element {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)

  const canCreate = hasMapLayerApiPermission(user, 'create')
  const canUpdate = hasMapLayerApiPermission(user, 'update')
  const canDelete = hasMapLayerApiPermission(user, 'delete')

  const [currentPage, setCurrentPage] = useState<number>(1)
  const [limit, setLimit] = useState<number>(10)
  const [searchValue, setSearchValue] = useState<string>('')
  const [activeFilter, setActiveFilter] = useState<'all' | 'true' | 'false'>('all')
  const [layerFilter, setLayerFilter] = useState<string>('all')

  const queryParams = {
    page: currentPage,
    limit,
    ...(searchValue.trim() && { q: searchValue.trim() }),
    ...(activeFilter !== 'all' && { is_active: activeFilter === 'true' }),
    ...(layerFilter !== 'all' && { layer_id: Number(layerFilter) }),
  }

  const listQuery = useApiQuery(
    ['mapLayerApis', queryParams],
    () => mapLayerApiService.getAll(queryParams),
    {},
    false,
    false
  )

  const layerOptionsQuery = useApiQuery(
    ['map-layers-for-map-api-filter'],
    () => mapLayerService.getAll({ page: 1, limit: 100, is_active: true }),
    {},
    false,
    false
  )

  const apis = getMapApis(listQuery.data)
  const layerOptions = useMemo(() => getLayerItems(layerOptionsQuery.data), [layerOptionsQuery.data])
  const filteredApis = useMemo(() => {
    const keyword = searchValue.trim().toLowerCase()
    if (!keyword) return apis
    return apis.filter((api) =>
      [api.name, api.layer_code, api.layer_name_vi, api.key_prefix, api.key_last4]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(keyword)
    )
  }, [apis, searchValue])

  const pagination = getPagination(listQuery.data)
  const lastTotalPagesRef = useRef<number | null>(null)
  if (pagination?.totalPages) lastTotalPagesRef.current = pagination.totalPages
  const totalPages = pagination?.totalPages ?? lastTotalPagesRef.current ?? 1
  const total = pagination?.total ?? filteredApis.length

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages)
  }, [currentPage, totalPages])

  const [selectedApiId, setSelectedApiId] = useState<number | null>(null)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [formDialogOpen, setFormDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [regenerateDialogOpen, setRegenerateDialogOpen] = useState(false)
  const [apiToDelete, setApiToDelete] = useState<MapLayerApi | null>(null)
  const [apiToRegenerate, setApiToRegenerate] = useState<MapLayerApi | null>(null)

  const deleteMutation = useApiMutation(
    (id: number) => mapLayerApiService.delete(id),
    {
      onSuccess: () => {
        toast.success('Xóa API key thành công')
        listQuery.refetch()
        setDeleteDialogOpen(false)
        setApiToDelete(null)
      },
      onError: (error) => {
        toast.error(getMappedErrorMessage(error, 'Không thể xóa API key.'))
      },
    },
    false
  )

  const regenerateMutation = useApiMutation(
    (id: number) => mapLayerApiService.regenerate(id),
    {
      onSuccess: (response: any) => {
        const key = response?.data?.apiKey || response?.data?.raw_key
        toast.success(key ? `Đã xoay key. Key mới: ${key}` : 'Đã xoay key thành công')
        listQuery.refetch()
        setRegenerateDialogOpen(false)
        setApiToRegenerate(null)
      },
      onError: (error) => {
        toast.error(getMappedErrorMessage(error, 'Không thể xoay key.'))
      },
    },
    false
  )

  function openDetails(api: MapLayerApi) {
    if (api?.id) {
      setSelectedApiId(api.id)
      setDetailDialogOpen(true)
    }
  }

  function openAddDialog() {
    setSelectedApiId(null)
    setFormDialogOpen(true)
  }

  function openEditDialog(api: MapLayerApi) {
    setSelectedApiId(api.id)
    setFormDialogOpen(true)
  }

  function openDeleteDialog(api: MapLayerApi) {
    setApiToDelete(api)
    setDeleteDialogOpen(true)
  }

  function openRegenerateDialog(api: MapLayerApi) {
    setApiToRegenerate(api)
    setRegenerateDialogOpen(true)
  }

  function handleDelete() {
    if (apiToDelete) deleteMutation.mutate(apiToDelete.id)
  }

  function handleRegenerate() {
    if (apiToRegenerate) regenerateMutation.mutate(apiToRegenerate.id)
  }

  return (
    <PageLayout title="Quản lý Map API" description="Cấp và quản lý API key đọc dữ liệu lớp bản đồ">
      <ToolTableCustom
            searchValue={searchValue}
            setSearchValue={setSearchValue}
            filter={
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  value={layerFilter}
                  onValueChange={(value) => {
                    setLayerFilter(value)
                    setCurrentPage(1)
                  }}
                >
                  <SelectTrigger className="w-60">
                    <SelectValue placeholder="Lớp bản đồ" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tất cả lớp bản đồ</SelectItem>
                    {layerOptions.map((layer) => (
                      <SelectItem key={layer.id ?? layer.code} value={String(layer.id)}>
                        {layerLabel(layer)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={activeFilter}
                  onValueChange={(value) => {
                    setActiveFilter(value as 'all' | 'true' | 'false')
                    setCurrentPage(1)
                  }}
                >
                  <SelectTrigger className="w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tất cả trạng thái</SelectItem>
                    <SelectItem value="true">Đang hoạt động</SelectItem>
                    <SelectItem value="false">Tạm dừng</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={`${limit}`}
                  onValueChange={(value) => {
                    setLimit(parseInt(value, 10))
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
                  <Button onClick={openAddDialog}>
                    <KeyRound className="size-4" />
                    Tạo key
                  </Button>
                )}
                <Button variant="outline" onClick={() => navigate('/public/map-apis')}>
                  Public Test
                </Button>
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
                  <TableHead>ID</TableHead>
                  <TableHead>Tên key</TableHead>
                  <TableHead>Lớp dữ liệu</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>Giới hạn</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Sử dụng</TableHead>
                  <TableHead className="text-right">Hành động</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredApis.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center">
                      Không có dữ liệu
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredApis.map((api) => (
                    <TableRow
                      key={api.id}
                      className="hover:cursor-pointer"
                      onClick={() => openDetails(api)}
                    >
                      <TableCell>{api.id}</TableCell>
                      <TableCell className="font-medium">{api.name}</TableCell>
                      <TableCell>
                        <div className="max-w-56">
                          <p className="truncate font-medium">{api.layer_name_vi ?? api.layer_code ?? '-'}</p>
                          {api.layer_code && (
                            <p className="text-muted-foreground truncate text-xs">{api.layer_code}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {api.key_prefix ? `${api.key_prefix}...${api.key_last4 ?? ''}` : '-'}
                      </TableCell>
                      <TableCell>{formatScope(api)}</TableCell>
                      <TableCell>
                        <StatusDotBadge
                          label={ACTIVE_LABEL[String(api.is_active)]}
                          badgeClass={ACTIVE_CLASS[String(api.is_active)]}
                          dotClass={ACTIVE_DOT[String(api.is_active)]}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <p>{api.request_count ?? 0} lượt</p>
                          <p className="text-muted-foreground text-xs">
                            {api.last_used_at ? formatDateTime(api.last_used_at) : 'Chưa sử dụng'}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {canUpdate && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(event) => {
                                event.stopPropagation()
                                openRegenerateDialog(api)
                              }}
                              title="Xoay key"
                            >
                              <RotateCcw className="size-4" />
                            </Button>
                          )}
                          {canUpdate && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(event) => {
                                event.stopPropagation()
                                openEditDialog(api)
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
                              onClick={(event) => {
                                event.stopPropagation()
                                openDeleteDialog(api)
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

      <MapLayerApiDetailDialog
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        apiId={selectedApiId}
      />

      <MapLayerApiFormDialog
        open={formDialogOpen}
        onOpenChange={setFormDialogOpen}
        apiId={selectedApiId}
        onSaved={() => {
          listQuery.refetch()
        }}
      />

      <AlertDialog open={regenerateDialogOpen} onOpenChange={setRegenerateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoay API key</AlertDialogTitle>
            <AlertDialogDescription>
              Tạo key mới cho "{apiToRegenerate?.name}" và vô hiệu key cũ ngay lập tức. Key mới chỉ hiển thị một lần.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={handleRegenerate} disabled={regenerateMutation.isPending}>
              {regenerateMutation.isPending ? 'Đang xoay...' : 'Xoay key'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn xóa API key "{apiToDelete?.name}"? Đối tác sẽ không thể dùng key này để đọc dữ liệu.
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
