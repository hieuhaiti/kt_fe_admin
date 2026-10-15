import type { JSX } from 'react'
import { useEffect, useRef, useState } from 'react'
import { mapLayerService, useApiMutation, useApiQuery } from '@/service'
// [check style] TEMP import
import { checkStyleLog } from '@/lib/checkStyleDebug'
import type {
  ApiResponse,
  CreateMapLayerBody,
  MapLayer,
  MapLayerListData,
  Pagination,
  PatchMapLayerBody,
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
import { readImportJobId } from './mapLayerImport'
import { formatDate } from '@/lib/date'
import { toast } from 'react-toastify'
import { hasPerm } from '@/lib/permissions'
import { useAuthStore } from '@/stores/common/useAuthStore'

function getLayerItems(data: unknown): MapLayer[] {
  const response = data as
    | ApiResponse<{ items?: MapLayer[]; mapLayers?: MapLayer[] } | MapLayer[]>
    | undefined
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
  const canImport = hasPerm(user, 'map_layers', 'import')
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
  const totalPages = Math.max(1, pagination.totalPages ?? 1)
  const total = pagination.total ?? 0

  const [selectedLayerCode, setSelectedLayerCode] = useState<string | null>(null)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [formDialogOpen, setFormDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [layerToDelete, setLayerToDelete] = useState<MapLayer | null>(null)
  const [publishDialogOpen, setPublishDialogOpen] = useState(false)
  const [layerToPublish, setLayerToPublish] = useState<MapLayer | null>(null)

  const createMutation = useApiMutation(
    (payload: CreateMapLayerBody) => mapLayerService.create(payload),
    {
      onSuccess: (res) => {
        // [check style] TEMP log
        checkStyleLog('mutation.create.success', {
          response: res,
        })
        dbQuery.refetch()
        setFormDialogOpen(false)
        setSelectedLayerCode(null)
      },
    },
    true
  )

  const [importJobId, setImportJobId] = useState<string | null>(null)
  const importJobQuery = useApiQuery(
    ['mapImportJob', importJobId],
    () => mapLayerService.getImportJob(importJobId || ''),
    { enabled: !!importJobId, refetchInterval: query => {
      if (query.state.status === 'error') return false
      const status = query.state.data?.data?.status
      return !query.state.data || status === 'pending' || status === 'processing' ? 2000 : false
    } }, false, false
  )
  const importJob = importJobQuery.data?.data
  const importJobMalformed = importJobQuery.isSuccess && !['pending', 'processing', 'completed', 'failed', 'cancelled'].includes(importJob?.status || '')
  const { refetch: refetchLayers } = dbQuery
  const notifiedImport = useRef('')
  useEffect(() => {
    const status = importJob?.status
    if (!importJobId || !status || !['completed', 'failed', 'cancelled'].includes(status)) return
    const notificationKey = `${importJobId}:${status}`
    if (notifiedImport.current === notificationKey) return
    notifiedImport.current = notificationKey
    void refetchLayers()
    if (status === 'completed') toast.success('Đã nhập GeoJSON. Có thể công bố lớp từ danh sách.')
    else if (status === 'failed') toast.error(`Nhập GeoJSON thất bại: ${importJob.error_log || 'Kiểm tra tệp và thử lại.'}`)
    else toast.info('Tác vụ nhập GeoJSON đã bị hủy.')
  }, [importJobId, importJob?.status, importJob?.error_log, refetchLayers])
  const importMutation = useApiMutation(
    ({ data, file }: { data: CreateMapLayerBody; file: File }) => {
      const form = new FormData()
      form.append('file', file)
      for (const field of ['code', 'name_vi', 'table_name', 'category', 'layer_kind', 'layer_group', 'is_active', 'is_public'] as const) {
        const value = data[field]
        if (value !== null && value !== undefined) form.append(field, String(value))
      }
      form.append('source_format', 'geojson')
      form.append('import_mode', 'overwrite')
      form.append('new_layer', 'true')
      form.append('srid_input', '4326')
      form.append('auto_publish', 'false')
      form.append('default_style', JSON.stringify(data.default_style ?? null))
      form.append('legend_config', JSON.stringify(data.legend_config ?? null))
      return mapLayerService.importFile(form)
    },
    { onSuccess: response => {
      const accepted = response.data
      const jobId = readImportJobId(accepted?.job_id)
      if (!jobId) {
        toast.error('Máy chủ chưa trả mã tác vụ nhập. Kiểm tra danh sách lớp trước khi gửi lại.')
        return
      }
      setImportJobId(jobId)
      setFormDialogOpen(false)
      setSelectedLayerCode(null)
      toast.info('Đã tiếp nhận tệp GeoJSON. Hệ thống đang xử lý, bạn có thể theo dõi tại danh sách lớp.')
      dbQuery.refetch()
    }, onError: error => {
      if (!(error as { status?: number }).status) {
        toast.error('Không gửi được tệp. Kiểm tra kết nối và danh sách lớp trước khi thử lại.')
      }
    } }, false
  )

  const updateMutation = useApiMutation(
    (payload: { code: string; data: PatchMapLayerBody }) =>
      mapLayerService.update(payload.code, payload.data),
    {
      onSuccess: (res, vars) => {
        // [check style] TEMP log
        checkStyleLog('mutation.update.success', {
          layerCode: vars?.code,
          sentDefaultStyle: vars?.data?.default_style,
          response: res,
        })
        dbQuery.refetch()
        setFormDialogOpen(false)
        setSelectedLayerCode(null)
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
    if (mapLayer?.code) {
      setSelectedLayerCode(mapLayer.code)
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
    setSelectedLayerCode(null)
    setFormDialogOpen(true)
  }

  function openEditDialog(mapLayer: MapLayer) {
    setSelectedLayerCode(mapLayer.code ?? null)
    setFormDialogOpen(true)
  }

  function handleFormSubmit(data: CreateMapLayerBody) {
    // [check style] TEMP log
    checkStyleLog('page.submit.dispatch', {
      selectedLayerCode,
      code: data.code,
      default_style: data.default_style,
    })
    if (selectedLayerCode) {
      updateMutation.mutate({ code: selectedLayerCode, data })
      return
    }
    if (canCreate) createMutation.mutate(data)
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
      {importJobId && <div role="status" className="border-border bg-muted/20 mb-4 space-y-2 rounded-lg border p-4 text-sm">
        <p>{importJobQuery.isError || importJobMalformed ? 'Không lấy được trạng thái nhập. Hãy kiểm tra lại trước khi nhập lần nữa.'
          : importJob?.status === 'cancelled' ? 'Tác vụ nhập đã bị hủy.'
          : importJob?.status === 'failed' ? `Nhập GeoJSON thất bại: ${importJob.error_log || 'Kiểm tra tệp và thử lại.'}`
          : importJob?.status === 'completed' ? 'Đã nhập GeoJSON. Có thể công bố lớp từ danh sách.'
          : `Đã tiếp nhận tệp. Đang xử lý${typeof importJob?.progress === 'number' ? ` (${importJob.progress}%)` : '...'}`}</p>
        <Button id="refresh-layer-import" type="button" variant="outline" size="sm" onClick={() => { importJobQuery.refetch(); dbQuery.refetch() }}>Cập nhật trạng thái</Button>
        {importJob?.status === 'completed' && <Button type="button" variant="ghost" size="sm" onClick={() => { dbQuery.refetch(); setImportJobId(null) }}>Đóng thông báo</Button>}
      </div>}
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
                <SelectItem value="all">Tất cả kiểu dữ liệu</SelectItem>
                <SelectItem value="point">Điểm</SelectItem>
                <SelectItem value="line">Đường</SelectItem>
                <SelectItem value="polygon">Vùng</SelectItem>
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

            {(canCreate || canImport) && (
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
              <TableHead>Tên lớp</TableHead>
              <TableHead>Nhóm lớp</TableHead>
              <TableHead>Kiểu</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead>Ngày tạo</TableHead>
              {showActions && <TableHead className="text-right">Thao tác</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {layers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={showActions ? 6 : 5} className="text-center">
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
                  <TableCell className="max-w-64 font-medium">
                    <span className="line-clamp-2">
                      {layer.name_vi || layer.name || layer.code}
                    </span>
                    <span className="text-muted-foreground block truncate font-mono text-xs">
                      {layer.code}
                    </span>
                  </TableCell>
                  <TableCell>{getMapLayerCategoryLabel(layer.category)}</TableCell>
                  <TableCell className="uppercase">{layer.geometry_type || '-'}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1">
                      <StatusDotBadge
                        label={ACTIVE_LABEL[String(layer.is_active)]}
                        badgeClass={ACTIVE_CLASS[String(layer.is_active)]}
                        dotClass={ACTIVE_DOT[String(layer.is_active)]}
                      />
                      <Badge variant={layer.geoserver_layer ? 'default' : 'outline'}>
                        {layer.geoserver_layer ? 'Đã công bố' : 'Chưa công bố'}
                      </Badge>
                      <Badge variant={layer.is_public ? 'secondary' : 'outline'}>
                        {layer.is_public ? 'Công khai' : 'Nội bộ'}
                      </Badge>
                    </div>
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
                              title={
                                layer.is_active ? 'Nhấn để ngừng hoạt động' : 'Nhấn để kích hoạt'
                              }
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
                              (!layer.geoserver_layer && (!layer.is_active || (layer.geometry_type === 'RASTER' && !layer.source_url?.trim())))
                            }
                            onClick={(e) => {
                              e.stopPropagation()
                              openPublishDialog(layer)
                            }}
                            title={
                              layer.geoserver_layer
                                ? 'Gỡ lớp khỏi dịch vụ bản đồ'
                                : layer.geometry_type === 'RASTER' && !layer.source_url?.trim()
                                  ? 'Cần tải GeoTIFF lên kho ảnh hoặc cấu hình nguồn dữ liệu trước khi công bố'
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
        layerCode={selectedLayerCode}
      />
      <MapLayerFormDialog
        open={formDialogOpen}
        onOpenChange={setFormDialogOpen}
        layerCode={selectedLayerCode}
        onSubmit={handleFormSubmit}
        canCreate={canCreate}
        canImport={canImport}
        onImport={(data, file) => { if (canImport && !selectedLayerCode) importMutation.mutate({ data, file }) }}
        isLoading={createMutation.isPending || updateMutation.isPending || importMutation.isPending}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn xóa lớp "
              {layerToDelete?.name_vi || layerToDelete?.name || layerToDelete?.code}"? Hành động này
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

      <AlertDialog open={publishDialogOpen} onOpenChange={setPublishDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {layerToPublish?.geoserver_layer ? 'Xác nhận gỡ công bố' : 'Xác nhận công bố'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {layerToPublish?.geoserver_layer
                ? `Lớp "${layerToPublish.name_vi || layerToPublish.name || layerToPublish.code}" sẽ bị gỡ khỏi dịch vụ bản đồ và không còn hiển thị trên WebGIS.`
                : `Lớp "${layerToPublish?.name_vi || layerToPublish?.name || layerToPublish?.code}" sẽ được công bố lên dịch vụ bản đồ. Chỉ lớp “Công khai” mới hiển thị cho người dân.`}
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
