import type { JSX } from 'react'
import { useEffect, useRef, useState } from 'react'
import { mapLayerService, useApiMutation, useApiQuery } from '@/service'
import type {
  ApiResponse,
  CreateMapLayerBody,
  MapLayer,
  MapLayerListData,
  Pagination,
} from '@/types/api'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { StatusDotBadge } from '@/components/common/StatusDotBadge'
import {
  ACTIVE_LABEL,
  ACTIVE_CLASS,
  ACTIVE_DOT,
  getMapLayerCategoryLabel,
} from '@/constant/mapLayerConstant'
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
import { CloudOff, CloudUpload, Eye, EyeOff, Pen, Trash2 } from 'lucide-react'
import PageLayout from '@/layout/pageLayout'
import MapLayerDetailDialog from './MapLayerDetailDialog'
import MapLayerFormDialog from './MapLayerFormDialog'
import { formatDate } from '@/lib/date'
import { hasPerm } from '@/lib/permissions'
import { useAuthStore } from '@/stores/common/useAuthStore'

function getLayerItems(data: unknown): MapLayer[] {
  const response = data as ApiResponse<{ items?: MapLayer[]; mapLayers?: MapLayer[] } | MapLayer[]> | undefined
  const payload = response?.data
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.items)) return payload.items
  if (Array.isArray(payload?.mapLayers)) return payload.mapLayers
  return []
}

function getPagination(data: unknown): Partial<Pagination> {
  const response = data as ApiResponse<MapLayerListData> | undefined
  return (response?.metadata ?? response?.data?.pagination ?? {}) as Partial<Pagination>
}

export default function MapLayerPage(): JSX.Element {
  const user = useAuthStore((s) => s.user)
  const canCreate = hasPerm(user, 'map_layers', 'create')
  const canUpdate = hasPerm(user, 'map_layers', 'update')
  const canDelete = hasPerm(user, 'map_layers', 'delete')
  const canPublish = hasPerm(user, 'map_layers', 'publish')
  const canUnpublish = hasPerm(user, 'map_layers', 'unpublish')
  const showActions = canUpdate || canDelete || canPublish || canUnpublish
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [limit, setLimit] = useState<number>(10)
  const [searchValue, setSearchValue] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [geometryFilter, setGeometryFilter] = useState<string>('all')

  const queryParams = {
    page: currentPage,
    limit,
    sortBy: 'created_at',
    sortOrder: 'DESC' as const,
    ...(searchValue && { q: searchValue }),
    ...(statusFilter !== 'all' && { is_active: statusFilter === 'true' }),
    ...(geometryFilter !== 'all' && { geometry_type: geometryFilter }),
  }

  const dbQuery = useApiQuery(
    ['mapLayers', queryParams],
    () => mapLayerService.getAll(queryParams),
    {},
    false,
    false
  )

  const layers = getLayerItems(dbQuery.data)
  const pagination = getPagination(dbQuery.data)
  const lastTotalPagesRef = useRef(1)
  if (pagination.totalPages !== undefined) {
    lastTotalPagesRef.current = Math.max(1, pagination.totalPages)
  }
  const totalPages = lastTotalPagesRef.current
  const total = pagination?.total ?? 0

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages)
  }, [currentPage, totalPages])

  const [selectedLayerId, setSelectedLayerId] = useState<number | null>(null)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [formDialogOpen, setFormDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [layerToDelete, setLayerToDelete] = useState<MapLayer | null>(null)
  const [publishDialogOpen, setPublishDialogOpen] = useState(false)
  const [layerToPublish, setLayerToPublish] = useState<MapLayer | null>(null)

  const createMutation = useApiMutation(
    (payload: CreateMapLayerBody) => mapLayerService.create(payload),
    {
      onSuccess: () => {
        dbQuery.refetch()
        setFormDialogOpen(false)
        setSelectedLayerId(null)
      },
    },
    true
  )

  const updateMutation = useApiMutation(
    (payload: { id: number; data: CreateMapLayerBody }) =>
      mapLayerService.update(String(payload.id), payload.data as any),
    {
      onSuccess: () => {
        dbQuery.refetch()
        setFormDialogOpen(false)
        setSelectedLayerId(null)
      },
    },
    true
  )

  const toggleStatusMutation = useApiMutation(
    (payload: { code: string; isActive: boolean }) =>
      mapLayerService.setActive(payload.code, { is_active: !payload.isActive }),
    {
      onSuccess: () => {
        dbQuery.refetch()
      },
    },
    true
  )

  const deleteMutation = useApiMutation(
    (code: string) => mapLayerService.delete(code),
    {
      onSuccess: () => {
        dbQuery.refetch()
        setDeleteDialogOpen(false)
        setLayerToDelete(null)
      },
    },
    true
  )

  const publishMutation = useApiMutation(
    (payload: { code: string; published: boolean }) =>
      payload.published
        ? mapLayerService.unpublish(payload.code)
        : mapLayerService.publish(payload.code),
    {
      onSuccess: () => {
        dbQuery.refetch()
        setPublishDialogOpen(false)
        setLayerToPublish(null)
      },
    },
    true
  )

  function openDetails(mapLayer: MapLayer) {
    if (mapLayer?.id != null) {
      setSelectedLayerId(mapLayer.id)
      setDetailDialogOpen(true)
    }
  }

  function openDeleteDialog(mapLayer: MapLayer) {
    setLayerToDelete(mapLayer)
    setDeleteDialogOpen(true)
  }

  function openPublishDialog(mapLayer: MapLayer) {
    setLayerToPublish(mapLayer)
    setPublishDialogOpen(true)
  }

  function openAddDialog() {
    setSelectedLayerId(null)
    setFormDialogOpen(true)
  }

  function openEditDialog(mapLayer: MapLayer) {
    setSelectedLayerId(mapLayer.id ?? null)
    setFormDialogOpen(true)
  }

  function handleFormSubmit(data: CreateMapLayerBody) {
    if (selectedLayerId) {
      updateMutation.mutate({ id: selectedLayerId, data })
      return
    }
    createMutation.mutate(data)
  }

  function handleDelete() {
    if (layerToDelete?.code) deleteMutation.mutate(layerToDelete.code)
  }

  function handlePublish() {
    if (!layerToPublish?.code) return
    publishMutation.mutate({
      code: layerToPublish.code,
      published: Boolean(layerToPublish.geoserver_layer),
    })
  }

  return (
    <PageLayout title="Quản lý lớp dữ liệu" description="Quản lý lớp dữ liệu bản đồ">
      <ToolTableCustom
        searchValue={searchValue}
        setSearchValue={(value) => {
          setSearchValue(value)
          setCurrentPage(1)
        }}
        filter={
          <div className="flex items-center gap-2">
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v)
                setCurrentPage(1)
              }}
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="true">Đang hoạt động</SelectItem>
                <SelectItem value="false">Ngừng hoạt động</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={geometryFilter}
              onValueChange={(v) => {
                setGeometryFilter(v)
                setCurrentPage(1)
              }}
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Mọi hình học</SelectItem>
                <SelectItem value="point">Point</SelectItem>
                <SelectItem value="line">Line</SelectItem>
                <SelectItem value="polygon">Polygon</SelectItem>
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
                Thêm lớp dữ liệu
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
              <TableHead>ID</TableHead>
              <TableHead>Tên lớp</TableHead>
              <TableHead>Nhóm lớp</TableHead>
              <TableHead>Kiểu</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead>Công bố</TableHead>
              <TableHead>Phạm vi</TableHead>
              <TableHead>Ngày tạo</TableHead>
              {showActions && <TableHead className="text-right">Hành động</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {layers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={showActions ? 9 : 8} className="text-center">
                  Không có dữ liệu
                </TableCell>
              </TableRow>
            ) : (
              layers.map((layer) => (
                <TableRow
                  key={layer.id}
                  className="hover:cursor-pointer"
                  onClick={() => openDetails(layer)}
                >
                  <TableCell>{layer.id}</TableCell>
                  <TableCell className="max-w-64 font-medium">
                    <span className="line-clamp-2">{layer.name_vi || layer.name || layer.code}</span>
                  </TableCell>
                  <TableCell>{getMapLayerCategoryLabel(layer.category)}</TableCell>
                  <TableCell className="uppercase">{layer.geometry_type || '-'}</TableCell>
                  <TableCell>
                    <StatusDotBadge
                      label={ACTIVE_LABEL[String(layer.is_active)]}
                      badgeClass={ACTIVE_CLASS[String(layer.is_active)]}
                      dotClass={ACTIVE_DOT[String(layer.is_active)]}
                    />
                  </TableCell>
                  <TableCell>
                    <Badge variant={layer.geoserver_layer ? 'default' : 'outline'}>
                      {layer.geoserver_layer ? 'Đã công bố' : 'Chưa công bố'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={layer.is_public ? 'secondary' : 'outline'}>
                      {layer.is_public ? 'Công khai' : 'Nội bộ'}
                    </Badge>
                  </TableCell>
                  <TableCell>{layer.created_at ? formatDate(layer.created_at) : '-'}</TableCell>
                  {showActions && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {canUpdate && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                openEditDialog(layer)
                              }}
                              title="Chỉnh sửa"
                            >
                              <Pen className="size-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleStatusMutation.mutate({
                                  code: layer.code,
                                  isActive: Boolean(layer.is_active),
                                })
                              }}
                              title={layer.is_active ? 'Nhấn để ngừng hoạt động' : 'Nhấn để kích hoạt'}
                            >
                              {layer.is_active ? (
                                <EyeOff className="size-4" />
                              ) : (
                                <Eye className="size-4" />
                              )}
                            </Button>
                          </>
                        )}
                        {((layer.geoserver_layer && canUnpublish) ||
                          (!layer.geoserver_layer && canPublish)) && (
                          <Button
                            variant={layer.geoserver_layer ? 'outline' : 'default'}
                            size="sm"
                            disabled={
                              publishMutation.isPending ||
                              (!layer.geoserver_layer && !layer.is_active)
                            }
                            onClick={(e) => {
                              e.stopPropagation()
                              openPublishDialog(layer)
                            }}
                            title={
                              layer.geoserver_layer
                                ? 'Gỡ lớp khỏi dịch vụ bản đồ'
                                : layer.is_active
                                  ? 'Công bố lớp lên dịch vụ bản đồ'
                                  : 'Cần kích hoạt lớp trước khi công bố'
                            }
                          >
                            {layer.geoserver_layer ? (
                              <CloudOff className="size-4" />
                            ) : (
                              <CloudUpload className="size-4" />
                            )}
                          </Button>
                        )}
                        {canDelete && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              openDeleteDialog(layer)
                            }}
                            title="Xóa"
                          >
                            <Trash2 className="text-destructive size-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </ToolTableCustom>

      <MapLayerDetailDialog
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        layerId={selectedLayerId}
      />
      <MapLayerFormDialog
        open={formDialogOpen}
        onOpenChange={setFormDialogOpen}
        layerId={selectedLayerId}
        onSubmit={handleFormSubmit}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn xóa lớp "
              {layerToDelete?.name_vi || layerToDelete?.name || layerToDelete?.code}"? Hành động
              này không thể hoàn tác.
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

      <AlertDialog open={publishDialogOpen} onOpenChange={setPublishDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {layerToPublish?.geoserver_layer ? 'Xác nhận gỡ công bố' : 'Xác nhận công bố'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {layerToPublish?.geoserver_layer
                ? `Lớp "${layerToPublish.name_vi || layerToPublish.name || layerToPublish.code}" sẽ bị gỡ khỏi dịch vụ bản đồ và không còn hiển thị trên WebGIS.`
                : `Lớp "${layerToPublish?.name_vi || layerToPublish?.name || layerToPublish?.code}" sẽ được publish lên dịch vụ bản đồ. Chỉ lớp có phạm vi "Công khai" mới xuất hiện với người dân.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={handlePublish} disabled={publishMutation.isPending}>
              {publishMutation.isPending
                ? 'Đang xử lý...'
                : layerToPublish?.geoserver_layer
                  ? 'Gỡ công bố'
                  : 'Công bố'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageLayout>
  )
}
