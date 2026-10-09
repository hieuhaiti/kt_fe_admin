import type { JSX } from 'react'
import { useMemo, useState } from 'react'
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
import { hasMapLayerApiPermission } from '@/components/map-layer-apis/permissionUtils'
import { ACTIVE_CLASS, ACTIVE_DOT, ACTIVE_LABEL } from '@/constant/mapLayerConstant'
import { useAuthStore } from '@/stores/common/useAuthStore'
import { mapLayerApiService, useApiMutation, useApiQuery } from '@/service'
import { getMappedErrorMessage } from '@/validators/mapLayerApiValidators'
import { StatusDotBadge } from '@/components/common/StatusDotBadge'
import SearchableLayerSelect from '@/components/common/SearchableLayerSelect'
import { formatDateTime } from '@/lib/date'
import MapLayerApiDetailDialog from './MapLayerApiDetailDialog'
import MapLayerApiFormDialog from './MapLayerApiFormDialog'
import type {
  ApiResponse,
  MapLayer,
  MapLayerApi,
  MapLayerApiListData,
  MapLayerApiRegenerateKeyData,
  Pagination,
} from '@/types/api'

function getMapApis(data: unknown): MapLayerApi[] {
  const response = data as ApiResponse<MapLayerApiListData> | undefined
  return response?.data?.items ?? response?.data?.apis ?? []
}

function getPagination(data: unknown): Partial<Pagination> {
  const response = data as ApiResponse<MapLayerApiListData> | undefined
  return (response?.metadata ?? response?.data?.pagination ?? {}) as Partial<Pagination>
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
  const [filterLayer, setFilterLayer] = useState<MapLayer | null>(null)
  const [createLayer, setCreateLayer] = useState<MapLayer | null>(null)

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

  const apis = getMapApis(listQuery.data)
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
  const totalPages = Math.max(1, pagination.totalPages ?? (pagination.total ? Math.ceil(pagination.total / limit) : 1))
  const total = pagination?.total ?? filteredApis.length


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
        toast.success('Đã xóa khóa API')
        listQuery.refetch()
        setDeleteDialogOpen(false)
        setApiToDelete(null)
      },
      onError: (error) => {
        toast.error(getMappedErrorMessage(error, 'Không thể xóa khóa API.'))
      },
    },
    false
  )

  const regenerateMutation = useApiMutation(
    (id: number) => mapLayerApiService.regenerate(id),
    {
      onSuccess: (response: ApiResponse<MapLayerApiRegenerateKeyData | { apiKey?: string; raw_key?: string }>) => {
        const payload = response?.data
        const key =
          (payload && 'apiKey' in payload && payload.apiKey) ||
          (payload && 'raw_key' in payload && payload.raw_key) ||
          null
        toast.success(key ? `Đã cấp lại khóa. Khóa mới: ${key}` : 'Đã cấp lại khóa')
        listQuery.refetch()
        setRegenerateDialogOpen(false)
        setApiToRegenerate(null)
      },
      onError: (error) => {
        toast.error(getMappedErrorMessage(error, 'Không thể cấp lại khóa.'))
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
    setCreateLayer(layerFilter === 'all' ? null : filterLayer)
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
    <PageLayout title="Khóa API bản đồ" description="Cấp và quản lý khóa đọc dữ liệu bản đồ.">
      <ToolTableCustom
            searchValue={searchValue}
            setSearchValue={setSearchValue}
            filter={
              <div className="flex flex-wrap items-center gap-2">
                <SearchableLayerSelect
                  value={layerFilter}
                  onChange={(value, layer) => {
                    setLayerFilter(String(value))
                    setFilterLayer(layer ?? null)
                    setCurrentPage(1)
                  }}
                  includeAllOption={true}
                  allOptionLabel="Tất cả lớp bản đồ"
                  allOptionValue="all"
                  placeholder="Lớp bản đồ"
                  triggerClassName="w-60"
                  isActive={true}
                />

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
                    Tạo khóa
                  </Button>
                )}
                <Button variant="outline" onClick={() => navigate('/public/map-apis')}>
                  Kiểm tra API
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
                  <TableHead>Tên khóa</TableHead>
                  <TableHead>Lớp dữ liệu</TableHead>
                  <TableHead>Khóa</TableHead>
                  <TableHead>Giới hạn</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Sử dụng</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
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
                              title="Cấp lại khóa"
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
        initialLayer={createLayer}
        onSaved={() => {
          listQuery.refetch()
        }}
      />

      <AlertDialog open={regenerateDialogOpen} onOpenChange={setRegenerateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cấp lại khóa API</AlertDialogTitle>
            <AlertDialogDescription>
              Tạo khóa mới cho "{apiToRegenerate?.name}" và vô hiệu khóa cũ ngay lập tức. Khóa mới chỉ hiển thị một lần.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={handleRegenerate} disabled={regenerateMutation.isPending}>
              {regenerateMutation.isPending ? 'Đang cấp lại...' : 'Cấp lại khóa'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa</AlertDialogTitle>
            <AlertDialogDescription>
              Xóa khóa API "{apiToDelete?.name}"? Đối tác sẽ không thể dùng khóa này để đọc dữ liệu.
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
