import { useEffect, useRef, useState } from 'react'
import { Eye, Plus } from 'lucide-react'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import PageLayout from '@/layout/pageLayout'
import ToolTableCustom from '@/components/features/ToolTableCustom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { fieldMeasurementService, useApiMutation, useApiQuery } from '@/service'
import type {
  ApiResponse,
  GeoJsonPolygon,
  MonitoredArea,
  MonitoredAreaListData,
  Pagination,
} from '@/types/api'
import { formatDateTime } from '@/lib/date'
import { can } from '@/lib/permissions'
import { useAuthStore } from '@/stores/common/useAuthStore'

const polygonSchema = z.object({
  type: z.literal('Polygon'),
  coordinates: z.array(z.array(z.tuple([z.number(), z.number()])).min(4)).length(1),
})

const createSchema = z.object({
  name: z.string().max(200).optional(),
  communeCode: z.string().max(20).optional(),
  note: z.string().max(2000).optional(),
  geomText: z
    .string()
    .min(1, 'Nhập polygon GeoJSON')
    .refine((value) => {
      try {
        return polygonSchema.safeParse(JSON.parse(value)).success
      } catch {
        return false
      }
    }, 'GeoJSON phải là Polygon hợp lệ, có ít nhất 4 điểm'),
})

type CreateForm = z.infer<typeof createSchema>

function formatArea(value?: number | string | null) {
  const area = Number(value)
  if (!Number.isFinite(area)) return '—'
  return `${(area / 10_000).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} ha`
}

export default function MonitoredAreasPage() {
  const user = useAuthStore((state) => state.user)
  const canCreate = can(user, 'field-measurements:manage')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [communeCode, setCommuneCode] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)

  const params = { page, limit, ...(communeCode.trim() && { commune_code: communeCode.trim() }) }
  const listQuery = useApiQuery(
    ['monitored-areas', params],
    () => fieldMeasurementService.getAreas(params),
    {},
    false,
    false
  )
  const response = listQuery.data as ApiResponse<MonitoredAreaListData> | undefined
  const items = response?.data?.items ?? []
  const pagination = (response?.metadata ?? {}) as Partial<Pagination>
  const lastPages = useRef(1)
  if (pagination.totalPages !== undefined) {
    lastPages.current = Math.max(1, pagination.totalPages)
  }
  const totalPages = lastPages.current
  const total = pagination.total ?? items.length

  useEffect(() => {
    if (page > totalPages) setPage(Math.max(totalPages, 1))
  }, [page, totalPages])

  const detailQuery = useApiQuery(
    ['monitored-area', selectedId],
    () => fieldMeasurementService.getAreaById(selectedId!),
    { enabled: detailOpen && selectedId != null, staleTime: 0 },
    false,
    false
  )
  const detail = (detailQuery.data as ApiResponse<MonitoredArea> | undefined)?.data

  const form = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      name: '',
      communeCode: '',
      note: '',
      geomText:
        '{\n  "type": "Polygon",\n  "coordinates": [[[107.9, 14.3], [107.91, 14.3], [107.91, 14.31], [107.9, 14.3]]]\n}',
    },
  })
  const createMutation = useApiMutation(
    (values: CreateForm) =>
      fieldMeasurementService.createArea({
        name: values.name?.trim() || null,
        communeCode: values.communeCode?.trim() || null,
        note: values.note?.trim() || null,
        geom: JSON.parse(values.geomText) as GeoJsonPolygon,
      }),
    {
      onSuccess: () => {
        setCreateOpen(false)
        form.reset()
        listQuery.refetch()
      },
    },
    true
  )

  return (
    <PageLayout
      title="Khu vực theo dõi"
      description="Nhóm các phiên đo cùng vị trí để theo dõi biến động theo thời gian"
    >
      <ToolTableCustom
        searchValue={communeCode}
        setSearchValue={(value) => {
          setCommuneCode(value)
          setPage(1)
        }}
        total={total}
        pagination={{ currentPage: page, totalPages, onPageChange: setPage }}
        filter={
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={String(limit)}
              onValueChange={(value) => {
                setLimit(Number(value))
                setPage(1)
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
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="size-4" /> Thêm khu vực
              </Button>
            )}
          </div>
        }
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mã khu vực</TableHead>
              <TableHead>Tên</TableHead>
              <TableHead>Mã địa bàn</TableHead>
              <TableHead>Người tạo</TableHead>
              <TableHead>Ngày tạo</TableHead>
              <TableHead>Ghi chú</TableHead>
              <TableHead className="text-right">Chi tiết</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow
                key={item.id}
                className="cursor-pointer"
                onClick={() => {
                  setSelectedId(item.id)
                  setDetailOpen(true)
                }}
              >
                <TableCell className="font-medium">{item.code}</TableCell>
                <TableCell>{item.name || '—'}</TableCell>
                <TableCell>{item.communeCode || '—'}</TableCell>
                <TableCell>#{item.createdBy ?? '—'}</TableCell>
                <TableCell>{formatDateTime(item.createdAt)}</TableCell>
                <TableCell className="max-w-64 truncate">{item.note || '—'}</TableCell>
                <TableCell className="text-right">
                  <Eye className="ml-auto size-4" />
                </TableCell>
              </TableRow>
            ))}
            {!items.length && (
              <TableRow>
                <TableCell colSpan={7} className="text-muted-foreground text-center">
                  Chưa có khu vực theo dõi.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </ToolTableCustom>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogTitle>{detail?.code ?? 'Chi tiết khu vực'}</DialogTitle>
          <DialogDescription>
            {detail?.name || 'Dòng thời gian các phiên đo thuộc khu vực'}
          </DialogDescription>
          {detail ? (
            <div className="space-y-4">
              <div className="grid gap-3 text-sm sm:grid-cols-3">
                <Info label="Mã địa bàn" value={detail.communeCode || '—'} />
                <Info label="Người tạo" value={`#${detail.createdBy ?? '—'}`} />
                <Info label="Số phiên đo" value={String(detail.timeline?.length ?? 0)} />
              </div>
              {detail.note && <Info label="Ghi chú" value={detail.note} />}
              <div>
                <h3 className="mb-2 text-sm font-semibold">Dòng thời gian đo đạc</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mã phiên</TableHead>
                      <TableHead>Trạng thái</TableHead>
                      <TableHead>Diện tích</TableHead>
                      <TableHead>Biến động</TableHead>
                      <TableHead>Thời gian</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(detail.timeline ?? []).map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="font-medium">{entry.code}</TableCell>
                        <TableCell>{entry.status}</TableCell>
                        <TableCell>{formatArea(entry.area_m2)}</TableCell>
                        <TableCell>
                          {entry.old_land_use || '—'} → {entry.new_land_use || '—'}
                        </TableCell>
                        <TableCell>
                          {formatDateTime(entry.finished_at ?? entry.created_at)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {!detail.timeline?.length && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-muted-foreground text-center">
                          Chưa có phiên đo.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground">Đang tải dữ liệu...</p>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogTitle>Thêm khu vực theo dõi</DialogTitle>
          <DialogDescription>
            Tạo vùng tham chiếu để liên kết các phiên đo MobileGIS
          </DialogDescription>
          <form
            onSubmit={form.handleSubmit((values) => createMutation.mutate(values))}
            className="space-y-4"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="area-name">Tên khu vực</Label>
                <Input id="area-name" {...form.register('name')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="commune-code">Mã địa bàn</Label>
                <Input id="commune-code" {...form.register('communeCode')} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="area-geom">Polygon GeoJSON</Label>
              <Textarea
                id="area-geom"
                className="min-h-40 font-mono text-xs"
                {...form.register('geomText')}
              />
              {form.formState.errors.geomText && (
                <p className="text-destructive text-xs">{form.formState.errors.geomText.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="area-note">Ghi chú</Label>
              <Textarea id="area-note" {...form.register('note')} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Hủy
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                Tạo khu vực
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </PageLayout>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-muted-foreground mb-1 text-xs">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  )
}
