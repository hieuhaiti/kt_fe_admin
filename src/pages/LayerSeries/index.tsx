import type { JSX } from 'react'
import { useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import { useQueryClient } from '@tanstack/react-query'
import { DndContext, type DragEndEvent, closestCenter } from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Check,
  CircleHelp,
  Clock,
  GripVertical,
  ImagePlus,
  Layers,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import PageLayout from '@/layout/pageLayout'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import LoadingInline from '@/components/common/LoadingInline'
import { layerSeriesService, mapLayerService, useApiMutation, useApiQuery } from '@/service'
import type {
  ApiResponse,
  LayerSeriesGroup,
  LayerSeriesGroupPayload,
  LayerSeriesGroupsListData,
  LayerSeriesStep,
  LayerSeriesTimeline,
  MapLayer,
} from '@/types/api'
import { hasPerm } from '@/lib/permissions'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/common/useAuthStore'

type GroupsResponse = ApiResponse<LayerSeriesGroupsListData | LayerSeriesGroup[]>
type TimelineResponse = ApiResponse<LayerSeriesTimeline>
type StepEditTarget = {
  group: LayerSeriesGroup
  step: LayerSeriesStep
}

const currentYear = new Date().getFullYear()

function extractMapLayers(data: unknown): MapLayer[] {
  const response = data as
    | ApiResponse<{ items?: MapLayer[]; mapLayers?: MapLayer[] } | MapLayer[]>
    | undefined
  const payload = response?.data
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.items)) return payload.items
  if (Array.isArray(payload?.mapLayers)) return payload.mapLayers
  return []
}

function getLayerPeriod(layer: MapLayer) {
  const years = String(layer.code || layer.geoserver_layer || '')
    .match(/(?:19|20)\d{2}/g)
    ?.map(Number)
  if (years && years.length >= 2) {
    return {
      yearFrom: years[years.length - 2],
      yearTo: years[years.length - 1],
      locked: true,
    }
  }
  const year = years?.[0] || layer.data_year || currentYear
  return { yearFrom: year, yearTo: year, locked: Boolean(years?.length) }
}

function extractGroups(data?: GroupsResponse): LayerSeriesGroup[] {
  const payload = data?.data
  if (Array.isArray(payload)) return payload
  return payload?.items ?? []
}

export default function LayerSeriesPage(): JSX.Element {
  const user = useAuthStore((s) => s.user)
  const canCreate = hasPerm(user, 'map_layers', 'create')
  const canUpdate = hasPerm(user, 'map_layers', 'update')
  const canDelete = hasPerm(user, 'map_layers', 'delete')
  const canAddImage = hasPerm(user, 'map_layers', 'update')

  const [openTimeline, setOpenTimeline] = useState<LayerSeriesGroup | null>(null)
  const [openForm, setOpenForm] = useState<LayerSeriesGroup | 'create' | null>(null)
  const [openAddImage, setOpenAddImage] = useState<LayerSeriesGroup | null>(null)
  const [openStepEdit, setOpenStepEdit] = useState<StepEditTarget | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<LayerSeriesGroup | null>(null)
  const queryClient = useQueryClient()

  const groupsQuery = useApiQuery<GroupsResponse>(['layer-series-groups'], () =>
    layerSeriesService.getAll()
  )

  const groups = extractGroups(groupsQuery.data)
  const deleteMutation = useApiMutation((code: string) => layerSeriesService.delete(code), {
    onSuccess: () => {
      toast.success('Đã xóa nhóm lớp')
      queryClient.invalidateQueries({ queryKey: ['layer-series-groups'] })
      setDeleteTarget(null)
    },
  })

  return (
    <PageLayout
      title="Lớp ảnh theo thời gian"
      description="Quản lý các nhóm bản đồ và dữ liệu theo từng mốc thời gian"
    >
      <Card>
        <CardContent className="p-4 sm:p-6">
          <div className="mb-3 flex items-center gap-2">
            <Layers className="text-primary size-5" />
            <h2 className="text-lg font-semibold">Nhóm lớp thời gian</h2>
            <Badge variant="outline" className="ml-2">
              {groups.length} nhóm
            </Badge>
            {canCreate && (
              <Button size="sm" className="ml-auto" onClick={() => setOpenForm('create')}>
                <Plus className="mr-1 size-4" />
                Tạo nhóm
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className={canCreate ? '' : 'ml-auto'}
              onClick={() => groupsQuery.refetch()}
              disabled={groupsQuery.isFetching}
            >
              {groupsQuery.isFetching ? 'Đang tải...' : 'Làm mới'}
            </Button>
          </div>

          {groupsQuery.isLoading ? (
            <div className="flex items-center justify-center py-10">
              <LoadingInline />
            </div>
          ) : groups.length === 0 ? (
            <p className="text-muted-foreground py-10 text-center text-sm">
              Chưa có nhóm lớp theo thời gian.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mã nhóm</TableHead>
                  <TableHead>Tên</TableHead>
                  <TableHead className="text-right">Số bước</TableHead>
                  <TableHead className="text-right">Khoảng năm</TableHead>
                  <TableHead className="text-center">Trạng thái</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.map((group) => (
                  <TableRow key={group.code}>
                    <TableCell className="font-mono text-xs">{group.code}</TableCell>
                    <TableCell>
                      <p className="font-medium">{group.name_vi}</p>
                    </TableCell>
                    <TableCell className="text-right">{group.step_count ?? 0}</TableCell>
                    <TableCell className="text-right">
                      {group.min_year ?? '—'} – {group.max_year ?? '—'}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex flex-wrap items-center justify-center gap-1">
                        <Badge variant={group.is_active ? 'default' : 'secondary'}>
                          {group.is_active ? 'Hoạt động' : 'Tắt'}
                        </Badge>
                        <Badge variant={group.is_public ? 'default' : 'outline'}>
                          {group.is_public ? 'Công khai' : 'Nội bộ'}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {canAddImage && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setOpenAddImage(group)}
                          >
                            <ImagePlus className="mr-1 size-3.5" />
                            Thêm ảnh
                          </Button>
                        )}
                        <Button variant="outline" size="sm" onClick={() => setOpenTimeline(group)}>
                          <Clock className="mr-1 size-3.5" />
                          Xem các mốc
                        </Button>
                        {canUpdate && (
                          <Button variant="outline" size="sm" onClick={() => setOpenForm(group)}>
                            <Pencil className="mr-1 size-3.5" />
                            Sửa
                          </Button>
                        )}
                        {canDelete && (
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={deleteMutation.isPending}
                            onClick={() => setDeleteTarget(group)}
                          >
                            <Trash2 className="mr-1 size-3.5" />
                            Xóa
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <TimelineDialog
        group={openTimeline}
        canAddImage={canAddImage}
        canUpdate={canUpdate}
        onAddImage={(group) => {
          setOpenTimeline(null)
          setOpenAddImage(group)
        }}
        onEditStep={(step) => {
          if (openTimeline) {
            setOpenStepEdit({ group: openTimeline, step })
            setOpenTimeline(null)
          }
        }}
        onClose={() => setOpenTimeline(null)}
      />
      <GroupFormDialog
        key={
          openForm === 'create'
            ? 'group-form:create'
            : `group-form:${openForm?.code ?? 'closed'}`
        }
        value={openForm}
        onClose={() => setOpenForm(null)}
      />
      <AddImageDialog
        key={`add-image:${openAddImage?.code ?? 'closed'}`}
        group={openAddImage}
        onClose={() => setOpenAddImage(null)}
      />
      <StepEditDialog
        key={`step-edit:${openStepEdit?.step.layer_code ?? 'closed'}`}
        target={openStepEdit}
        groups={groups}
        onClose={() => setOpenStepEdit(null)}
      />
      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !deleteMutation.isPending) setDeleteTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa nhóm lớp thời gian?</AlertDialogTitle>
            <AlertDialogDescription>
              Nhóm “{deleteTarget?.name_vi}” sẽ bị xóa. Các lớp ảnh nguồn trong Lớp dữ liệu vẫn được
              giữ lại.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Hủy</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
              onClick={(event) => {
                event.preventDefault()
                if (deleteTarget) deleteMutation.mutate(deleteTarget.code)
              }}
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="mr-1 size-4 animate-spin" />
                  Đang xóa...
                </>
              ) : (
                <>
                  <Trash2 className="mr-1 size-4" />
                  Xóa nhóm
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageLayout>
  )
}

function SortableStepRow({
  step,
  index,
  canUpdate,
  onEditStep,
}: {
  step: LayerSeriesStep
  index: number
  canUpdate: boolean
  onEditStep: (step: LayerSeriesStep) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: step.layer_code })

  return (
    <TableRow
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : undefined,
      }}
      className={cn(isDragging && 'bg-accent')}
    >
      <TableCell className="w-10">
        {canUpdate ? (
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground flex cursor-grab items-center justify-center active:cursor-grabbing"
            aria-label="Kéo để đổi thứ tự"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-4" />
          </button>
        ) : null}
      </TableCell>
      <TableCell className="text-right font-mono text-xs">{index + 1}</TableCell>
      <TableCell className="font-medium">{step.label}</TableCell>
      <TableCell className="text-right">{step.year_from}</TableCell>
      <TableCell className="text-right">{step.year_to}</TableCell>
      <TableCell className="font-mono text-xs">{step.layer_code}</TableCell>
      <TableCell className="font-mono text-xs">{step.geoserver_layer}</TableCell>
      {canUpdate && (
        <TableCell className="text-right">
          <Button variant="outline" size="sm" onClick={() => onEditStep(step)}>
            <Pencil className="mr-1 size-3.5" />
            Sửa
          </Button>
        </TableCell>
      )}
    </TableRow>
  )
}

function TimelineDialog({
  group,
  canAddImage,
  canUpdate,
  onAddImage,
  onEditStep,
  onClose,
}: {
  group: LayerSeriesGroup | null
  canAddImage: boolean
  canUpdate: boolean
  onAddImage: (group: LayerSeriesGroup) => void
  onEditStep: (step: LayerSeriesStep) => void
  onClose: () => void
}) {
  const open = Boolean(group)
  const queryClient = useQueryClient()
  const timelineQuery = useApiQuery<TimelineResponse>(
    ['layer-series-timeline', group?.code],
    () => layerSeriesService.getTimeline(group!.code),
    { enabled: open }
  )

  const timeline = timelineQuery.data?.data
  const serverSteps = timeline?.steps ?? []

  // Local optimistic order: sync khi server data mới về, còn khi user kéo thả
  // giữ order local để giao diện responsive ngay.
  const [localSteps, setLocalSteps] = useState<LayerSeriesStep[]>([])
  useEffect(() => {
    setLocalSteps(serverSteps)
    // JSON stringify để tránh re-sync khi array chỉ thay identity mà nội dung
    // không đổi (React Query có thể tạo array mới sau refetch cache-hit).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(serverSteps.map((s) => s.layer_code))])

  const reorderMutation = useApiMutation(
    async (order: string[]) => {
      if (!group) throw new Error('Không có nhóm')
      return layerSeriesService.reorderSteps(group.code, order)
    },
    {
      onSuccess: () => {
        toast.success('Đã lưu thứ tự mới')
        if (group) {
          queryClient.invalidateQueries({
            queryKey: ['layer-series-timeline', group.code],
          })
        }
      },
      onError: () => {
        // Rollback về server order nếu API lỗi
        setLocalSteps(serverSteps)
      },
    },
    false
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = localSteps.findIndex((step) => step.layer_code === active.id)
    const newIndex = localSteps.findIndex((step) => step.layer_code === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const next = arrayMove(localSteps, oldIndex, newIndex)
    setLocalSteps(next)
    reorderMutation.mutate(next.map((step) => step.layer_code))
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Các mốc thời gian · {group?.name_vi}</DialogTitle>
          <DialogDescription>
            Danh sách dữ liệu bản đồ đã có theo từng mốc thời gian.
            {canUpdate && ' Kéo biểu tượng ⋮⋮ để đổi thứ tự hiển thị.'}
          </DialogDescription>
        </DialogHeader>

        {canAddImage && group && (
          <div className="flex justify-end">
            <Button size="sm" onClick={() => onAddImage(group)}>
              <ImagePlus className="mr-1 size-4" />
              Thêm ảnh vào nhóm
            </Button>
          </div>
        )}

        <div className="max-h-[60vh] overflow-auto">
          {timelineQuery.isLoading ? (
            <div className="flex items-center justify-center py-10">
              <LoadingInline />
            </div>
          ) : localSteps.length === 0 ? (
            <p className="text-muted-foreground py-10 text-center text-sm">Chưa có bước ảnh nào.</p>
          ) : (
            <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10" />
                    <TableHead className="w-12 text-right">#</TableHead>
                    <TableHead>Nhãn</TableHead>
                    <TableHead className="text-right">Từ năm</TableHead>
                    <TableHead className="text-right">Đến năm</TableHead>
                    <TableHead>Mã dữ liệu</TableHead>
                    <TableHead>Nguồn bản đồ</TableHead>
                    {canUpdate && <TableHead className="text-right">Thao tác</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <SortableContext
                    items={localSteps.map((s) => s.layer_code)}
                    strategy={verticalListSortingStrategy}
                  >
                    {localSteps.map((step, index) => (
                      <SortableStepRow
                        key={step.layer_code}
                        step={step}
                        index={index}
                        canUpdate={canUpdate}
                        onEditStep={onEditStep}
                      />
                    ))}
                  </SortableContext>
                </TableBody>
              </Table>
            </DndContext>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={reorderMutation.isPending}>
            Đóng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function GroupFormDialog({
  value,
  onClose,
}: {
  value: LayerSeriesGroup | 'create' | null
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const open = value !== null
  const editing = value && value !== 'create' ? value : null

  const [code, setCode] = useState(editing?.code ?? '')
  const [nameVi, setNameVi] = useState(editing?.name_vi ?? '')
  const [isActive, setIsActive] = useState(editing?.is_active ?? true)
  const [isPublic, setIsPublic] = useState(editing?.is_public ?? true)

  const hydrate = () => {
    setCode(editing?.code ?? '')
    setNameVi(editing?.name_vi ?? '')
    setIsActive(editing?.is_active ?? true)
    setIsPublic(editing?.is_public ?? true)
  }

  const reset = () => {
    setCode('')
    setNameVi('')
    setIsActive(true)
    setIsPublic(true)
  }

  const mutation = useApiMutation(
    (payload: LayerSeriesGroupPayload) =>
      editing
        ? layerSeriesService.update(editing.code, payload)
        : layerSeriesService.create(payload),
    {
      onSuccess: () => {
        toast.success(editing ? 'Đã cập nhật nhóm lớp' : 'Đã tạo nhóm lớp')
        queryClient.invalidateQueries({ queryKey: ['layer-series-groups'] })
        reset()
        onClose()
      },
    }
  )

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!code.trim() || !nameVi.trim()) {
      toast.error('Vui lòng nhập mã nhóm và tên tiếng Việt')
      return
    }
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(code.trim())) {
      toast.error('Mã nhóm chỉ gồm chữ, số và dấu gạch dưới; không bắt đầu bằng số')
      return
    }

    // Chỉ gửi metadata user quan tâm. Server tự suy ra geoserver_store /
    // geoserver_layer từ các layer con thuộc nhóm (hoặc fallback default).
    mutation.mutate({
      code: code.trim(),
      name_vi: nameVi.trim(),
      is_active: isActive,
      is_public: isPublic,
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) hydrate()
        if (!next) {
          reset()
          onClose()
        }
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? 'Cập nhật nhóm lớp' : 'Tạo nhóm lớp'}</DialogTitle>
          <DialogDescription>
            Thiết lập nhóm dữ liệu theo thời gian hiển thị trên bản đồ công khai.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Label htmlFor="group-code">Mã nhóm *</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground focus-visible:ring-ring cursor-help rounded-sm focus-visible:ring-2 focus-visible:outline-none"
                      aria-label="Thông tin về mã nhóm"
                    >
                      <CircleHelp className="size-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs leading-relaxed">
                    Mã nhóm sẽ tự động được hệ thống nhóm theo nhóm phụ của lớp bản đồ.
                  </TooltipContent>
                </Tooltip>
              </div>
              <Input
                id="group-code"
                value={code}
                disabled={Boolean(editing)}
                onChange={(e) => setCode(e.target.value)}
                placeholder="lop_phu"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="group-name-vi">Tên tiếng Việt *</Label>
              <Input
                id="group-name-vi"
                value={nameVi}
                onChange={(e) => setNameVi(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              Đang hoạt động
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
              />
              Công khai trên webGIS
            </label>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                reset()
                onClose()
              }}
              disabled={mutation.isPending}
            >
              Hủy
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? (
                <>
                  <Loader2 className="mr-1 size-4 animate-spin" />
                  Đang nhập...
                </>
              ) : (
                <>
                  {editing ? <Pencil className="mr-1 size-4" /> : <Plus className="mr-1 size-4" />}
                  {editing ? 'Lưu thay đổi' : 'Tạo nhóm'}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function RasterLayerOption({
  layer,
  selected,
  onSelect,
}: {
  layer: MapLayer
  selected: boolean
  onSelect: (layer: MapLayer) => void
}) {
  const period = getLayerPeriod(layer)

  return (
    <label
      className={cn(
        'hover:bg-accent/40 flex w-full cursor-pointer items-center gap-3 rounded-md border p-3 text-left transition-colors',
        selected && 'border-primary bg-accent'
      )}
    >
      <input
        type="radio"
        name="raster-layer"
        value={layer.code}
        checked={selected}
        onChange={() => onSelect(layer)}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className={cn(
          'border-primary peer-focus-visible:ring-ring grid size-4 shrink-0 place-content-center rounded-sm border peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2',
          selected && 'bg-primary text-primary-foreground'
        )}
      >
        {selected && <Check />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">
          {layer.name_vi || layer.code}
        </span>
        <span className="text-muted-foreground block truncate font-mono text-xs">
          {layer.code}
        </span>
      </span>
      <span className="text-muted-foreground shrink-0 text-xs">
        {period.yearFrom === period.yearTo ? period.yearTo : `${period.yearFrom}–${period.yearTo}`}
      </span>
    </label>
  )
}

function SelectedLayerPreview({
  group,
  layer,
}: {
  group: LayerSeriesGroup
  layer: MapLayer | null
}) {
  return (
    <div className="flex min-h-28 items-center justify-center rounded-md border border-dashed p-4 text-center">
      {layer ? (
        <div className="space-y-1">
          <p className="font-medium">{layer.name_vi || layer.code}</p>
          <p className="text-muted-foreground font-mono text-xs">{layer.code}</p>
          <Badge variant="outline">Nhóm đích: {group.name_vi}</Badge>
        </div>
      ) : (
        <div>
          <ImagePlus className="text-muted-foreground mx-auto mb-2 size-7" />
          <p className="text-sm font-medium">Chưa chọn lớp nào</p>
          <p className="text-muted-foreground text-xs">
            Tick vào một lớp raster ở danh sách bên trái để chọn.
          </p>
        </div>
      )}
    </div>
  )
}

function AddImageDialog({
  group,
  onClose,
}: {
  group: LayerSeriesGroup | null
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [selectedLayer, setSelectedLayer] = useState<MapLayer | null>(null)
  const [dataYear, setDataYear] = useState(String(currentYear))
  const [isPublic, setIsPublic] = useState(group?.is_public ?? true)

  const layersQuery = useApiQuery(
    ['layer-series-raster-options'],
    () => mapLayerService.getAll({ page: 1, limit: 200 }),
    { enabled: Boolean(group) },
    false
  )
  const rasterLayers = extractMapLayers(layersQuery.data)
    .filter(
      (layer) =>
        String(layer.geometry_type).toUpperCase() === 'RASTER' && Boolean(layer.geoserver_layer)
    )
    .filter((layer) => {
      const keyword = search.trim().toLocaleLowerCase('vi')
      if (!keyword) return true
      return `${layer.code} ${layer.name_vi || ''} ${layer.name_en || ''}`
        .toLocaleLowerCase('vi')
        .includes(keyword)
    })

  const selectLayer = (layer: MapLayer) => {
    const period = getLayerPeriod(layer)
    setSelectedLayer(layer)
    setDataYear(String(period.yearTo))
    setIsPublic(layer.is_public ?? group?.is_public ?? true)
  }

  const mutation = useApiMutation(
    async () => {
      if (!group || !selectedLayer) throw new Error('Lớp raster không hợp lệ')
      await mapLayerService.patch(selectedLayer.code, {
        layer_group: group.code,
        data_year: Number(dataYear),
        is_public: isPublic,
      })
      if (selectedLayer.is_active !== true) {
        await mapLayerService.setActive(selectedLayer.code, { is_active: true })
      }
    },
    {
      onSuccess: () => {
        toast.success('Đã thêm lớp raster có sẵn vào nhóm thời gian')
        queryClient.invalidateQueries({ queryKey: ['layer-series-groups'] })
        if (group) {
          queryClient.invalidateQueries({
            queryKey: ['layer-series-timeline', group.code],
          })
        }
        queryClient.invalidateQueries({ queryKey: ['mapLayers'] })
        onClose()
      },
    },
    false
  )

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const parsedYear = Number(dataYear)
    if (!group || !selectedLayer) {
      toast.error('Vui lòng chọn một lớp raster có sẵn')
      return
    }
    if (!Number.isInteger(parsedYear) || parsedYear < 1900 || parsedYear > 2100) {
      toast.error('Năm dữ liệu phải từ 1900 đến 2100')
      return
    }
    mutation.mutate(undefined)
  }

  const selectedPeriod = selectedLayer ? getLayerPeriod(selectedLayer) : null

  return (
    <Dialog open={Boolean(group)} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Thêm lớp ảnh · {group?.name_vi}</DialogTitle>
          <DialogDescription>
            Chọn hoặc kéo một lớp raster đã có trong Lớp dữ liệu vào nhóm{' '}
            <span className="font-mono">{group?.code}</span>.
          </DialogDescription>
        </DialogHeader>

        {layersQuery.isError ? (
          <div className="space-y-3 py-8 text-center">
            <p className="text-destructive text-sm">Không tải được danh sách lớp dữ liệu.</p>
            <Button type="button" variant="outline" size="sm" onClick={() => layersQuery.refetch()}>
              Thử lại
            </Button>
          </div>
        ) : layersQuery.isLoading ? (
          <div className="flex items-center justify-center py-10">
            <LoadingInline />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="raster-layer-search">Lớp raster có sẵn</Label>
                  <Input
                    id="raster-layer-search"
                    value={search}
                    placeholder="Tìm theo tên hoặc mã lớp..."
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </div>
                <div
                  role="radiogroup"
                  aria-label="Chọn lớp raster"
                  className="max-h-72 space-y-2 overflow-y-auto rounded-md border p-2"
                >
                  {rasterLayers.map((layer) => (
                    <RasterLayerOption
                      key={layer.code}
                      layer={layer}
                      selected={selectedLayer?.code === layer.code}
                      onSelect={selectLayer}
                    />
                  ))}
                  {rasterLayers.length === 0 && (
                    <p className="text-muted-foreground py-8 text-center text-sm">
                      Không có lớp raster đã publish phù hợp.
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                {group && <SelectedLayerPreview group={group} layer={selectedLayer} />}

                {selectedLayer && selectedPeriod && (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="existing-layer-year">Năm dữ liệu *</Label>
                        <Input
                          id="existing-layer-year"
                          type="number"
                          min={1900}
                          max={2100}
                          value={dataYear}
                          disabled={selectedPeriod.locked}
                          onChange={(event) => setDataYear(event.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Khoảng hiển thị</Label>
                        <div className="flex h-10 items-center rounded-md border px-3 text-sm">
                          {selectedPeriod.yearFrom === selectedPeriod.yearTo
                            ? selectedPeriod.yearTo
                            : `${selectedPeriod.yearFrom}–${selectedPeriod.yearTo}`}
                        </div>
                      </div>
                    </div>
                    {selectedPeriod.locked && (
                      <p className="text-muted-foreground text-xs">
                        Thời gian được đọc từ mã lớp hiện có nên không thể đổi tại đây.
                      </p>
                    )}
                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                      <Checkbox
                        checked={isPublic}
                        onCheckedChange={(checked) => setIsPublic(checked === true)}
                      />
                      Công khai lớp ảnh trên bản đồ
                    </label>
                    <p className="text-muted-foreground text-xs">
                      Lớp sẽ được bật hoạt động khi thêm vào timeline.
                    </p>
                  </>
                )}
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={mutation.isPending}
              >
                Hủy
              </Button>
              <Button type="submit" disabled={mutation.isPending || !selectedLayer}>
                {mutation.isPending ? (
                  <>
                    <Loader2 className="mr-1 size-4 animate-spin" />
                    Đang thêm...
                  </>
                ) : (
                  <>
                    <ImagePlus className="mr-1 size-4" />
                    Thêm vào nhóm
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

function StepEditDialog({
  target,
  groups,
  onClose,
}: {
  target: StepEditTarget | null
  groups: LayerSeriesGroup[]
  onClose: () => void
}) {
  const detailQuery = useApiQuery<ApiResponse<MapLayer>>(
    ['layer-series-step-detail', target?.step.layer_code],
    () => mapLayerService.getByCode(target!.step.layer_code),
    { enabled: Boolean(target) }
  )
  const detail = detailQuery.data?.data

  return (
    <Dialog open={Boolean(target)} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Sửa mốc dữ liệu · {target?.step.label}</DialogTitle>
          <DialogDescription>
            Cập nhật tên, nhóm thời gian và trạng thái của lớp raster hiện có.
          </DialogDescription>
        </DialogHeader>

        {detailQuery.isError ? (
          <div className="space-y-3 py-8 text-center">
            <p className="text-destructive text-sm">Không tải được thông tin mốc dữ liệu.</p>
            <Button type="button" variant="outline" size="sm" onClick={() => detailQuery.refetch()}>
              Thử lại
            </Button>
          </div>
        ) : detailQuery.isLoading || !target || !detail ? (
          <div className="flex items-center justify-center py-10">
            <LoadingInline />
          </div>
        ) : (
          <StepEditForm
            key={`${target.step.layer_code}-${detail.updated_at ?? ''}`}
            target={target}
            detail={detail}
            groups={groups}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function StepEditForm({
  target,
  detail,
  groups,
  onClose,
}: {
  target: StepEditTarget
  detail: MapLayer
  groups: LayerSeriesGroup[]
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [nameVi, setNameVi] = useState(detail.name_vi || target.step.label)
  const [groupCode, setGroupCode] = useState(detail.layer_group || target.group.code)
  const [dataYear, setDataYear] = useState(String(detail.data_year || target.step.year_to))
  const [isPublic, setIsPublic] = useState(detail.is_public ?? true)
  const [isActive, setIsActive] = useState(detail.is_active ?? true)

  const mutation = useApiMutation(
    async () => {
      const nextDataYear = Number(dataYear)

      await mapLayerService.patch(target.step.layer_code, {
        name_vi: nameVi.trim(),
        name_en: (detail.name_en || '').trim() || null,
        layer_group: groupCode,
        data_year: nextDataYear,
        is_public: isPublic,
      })

      if (detail.is_active !== isActive) {
        await mapLayerService.setActive(target.step.layer_code, {
          is_active: isActive,
        })
      }
    },
    {
      onSuccess: () => {
        toast.success('Đã cập nhật mốc dữ liệu')
        queryClient.invalidateQueries({ queryKey: ['layer-series-groups'] })
        queryClient.invalidateQueries({
          queryKey: ['layer-series-timeline', target.group.code],
        })
        queryClient.invalidateQueries({
          queryKey: ['layer-series-timeline', groupCode],
        })
        queryClient.invalidateQueries({
          queryKey: ['layer-series-step-detail', target.step.layer_code],
        })
        onClose()
      },
    },
    false
  )

  const yearIsLocked = Boolean(target.step.layer_code.match(/(?:19|20)\d{2}/))

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const parsedYear = Number(dataYear)
    if (!nameVi.trim() || !groupCode) {
      toast.error('Vui lòng nhập đầy đủ thông tin bắt buộc')
      return
    }
    if (!Number.isInteger(parsedYear) || parsedYear < 1900 || parsedYear > currentYear) {
      toast.error(`Năm dữ liệu phải từ 1900 đến ${currentYear}`)
      return
    }
    mutation.mutate(undefined)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="step-layer-code">Mã lớp</Label>
          <Input id="step-layer-code" value={target.step.layer_code} disabled />
        </div>
        <div className="space-y-2">
          <Label htmlFor="step-geoserver-layer">Nguồn bản đồ</Label>
          <Input id="step-geoserver-layer" value={target.step.geoserver_layer} disabled />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="step-name-vi">Tên tiếng Việt *</Label>
          <Input
            id="step-name-vi"
            value={nameVi}
            onChange={(event) => setNameVi(event.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Nhóm lớp *</Label>
          <Select value={groupCode} onValueChange={setGroupCode}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {groups.map((group) => (
                <SelectItem key={group.code} value={group.code}>
                  {group.name_vi} ({group.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="step-data-year">Năm dữ liệu *</Label>
          <Input
            id="step-data-year"
            type="number"
            min={1900}
            max={currentYear}
            value={dataYear}
            disabled={yearIsLocked}
            onChange={(event) => setDataYear(event.target.value)}
          />
          {yearIsLocked && (
            <p className="text-muted-foreground text-xs">
              Nhãn thời gian đang lấy từ mã lớp nên không thể đổi năm nếu không đổi mã.
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-5">
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <Checkbox
            checked={isActive}
            onCheckedChange={(checked) => setIsActive(checked === true)}
          />
          Đang hoạt động
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <Checkbox
            checked={isPublic}
            onCheckedChange={(checked) => setIsPublic(checked === true)}
          />
          Công khai trên bản đồ
        </label>
      </div>

      <DialogFooter className="gap-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>
          Hủy
        </Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? (
            <>
              <Loader2 className="mr-1 size-4 animate-spin" />
              Đang lưu...
            </>
          ) : (
            <>
              <Pencil className="mr-1 size-4" />
              Lưu thay đổi
            </>
          )}
        </Button>
      </DialogFooter>
    </form>
  )
}
