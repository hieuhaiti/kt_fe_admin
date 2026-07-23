import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Download, Eye, X } from 'lucide-react'
import { toast } from 'react-toastify'
import PageLayout from '@/layout/pageLayout'
import ToolTableCustom from '@/components/features/ToolTableCustom'
import GeoJsonMapPreview from '@/components/features/GeoJsonMapPreview'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { StatusDotBadge } from '@/components/common/StatusDotBadge'
import {
  fieldMeasurementService,
  statisticsService,
  useApiMutation,
  useApiQuery,
} from '@/service'
import type {
  AdministrativeUnit,
  ApiResponse,
  FieldMeasurement,
  FieldMeasurementListData,
  FieldMeasurementStatus,
  Pagination,
} from '@/types/api'
import { formatDateTime } from '@/lib/date'
import { can } from '@/lib/permissions'
import { useAuthStore } from '@/stores/common/useAuthStore'
import { tokenManager } from '@/lib/tokenManager'
import { serviceFieldMeasurementPath } from '@/constant/serviceConstant'

const STATUS: Record<FieldMeasurementStatus, { label: string; badge: string; dot: string }> = {
  draft: {
    label: 'Bản nháp',
    badge: 'border-border bg-muted text-foreground',
    dot: 'bg-muted-foreground',
  },
  submitted: {
    label: 'Chờ xác minh',
    badge: 'border-warning/40 bg-warning/10 text-foreground',
    dot: 'bg-warning',
  },
  verified: {
    label: 'Đã xác minh',
    badge: 'border-success/40 bg-success/10 text-foreground',
    dot: 'bg-success',
  },
  rejected: {
    label: 'Từ chối',
    badge: 'border-destructive/40 bg-destructive/10 text-foreground',
    dot: 'bg-destructive',
  },
}

function statusBadge(status: FieldMeasurementStatus) {
  const item = STATUS[status] ?? STATUS.draft
  return <StatusDotBadge label={item.label} badgeClass={item.badge} dotClass={item.dot} />
}

function formatArea(value?: number | string | null) {
  const area = Number(value)
  if (!Number.isFinite(area)) return '—'
  return area >= 10_000
    ? `${(area / 10_000).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} ha`
    : `${area.toLocaleString('vi-VN', { maximumFractionDigits: 0 })} m²`
}

export default function FieldMeasurementsPage() {
  const user = useAuthStore((state) => state.user)
  const canReview = can(user, 'field-measurements:manage')

  // Đơn vị hành chính (district) để map `communeCode` → tên hiển thị. Kết quả
  // gần như tĩnh (~10 đơn vị) nên staleTime dài để tránh gọi lại. Endpoint
  // dùng `optionalAuth` nên không bao giờ 401.
  const adminUnitsQuery = useApiQuery(
    ['stats-admin-units', 'district', 'vi'],
    () => statisticsService.getAdminUnits({ level: 'district' }),
    { staleTime: 24 * 60 * 60 * 1000 },
    false,
    false
  )
  const adminUnits =
    (adminUnitsQuery.data as ApiResponse<{ units: AdministrativeUnit[] }> | undefined)?.data
      ?.units ?? []
  const communeNameByCode = useMemo(() => {
    const map = new Map<string, string>()
    for (const unit of adminUnits) {
      if (unit?.code) map.set(String(unit.code), unit.name ?? String(unit.code))
    }
    return map
  }, [adminUnits])
  const formatCommune = (code?: string | null) => {
    if (!code) return '—'
    return communeNameByCode.get(String(code)) ?? code
  }

  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<FieldMeasurementStatus | 'all'>('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [reviewNote, setReviewNote] = useState('')

  const params = {
    page,
    limit,
    ...(status !== 'all' && { status }),
    ...(from && { from }),
    ...(to && { to }),
  }
  const listQuery = useApiQuery(
    ['field-measurements', params],
    () => fieldMeasurementService.getAll(params),
    {},
    false,
    false
  )
  const response = listQuery.data as ApiResponse<FieldMeasurementListData> | undefined
  const items = response?.data?.items ?? []
  const pagination = (response?.metadata ?? {}) as Partial<Pagination>
  const lastPages = useRef(1)
  if (pagination.totalPages) lastPages.current = pagination.totalPages
  const totalPages = pagination.totalPages ?? lastPages.current
  const total = pagination.total ?? items.length

  useEffect(() => {
    if (page > totalPages) setPage(Math.max(totalPages, 1))
  }, [page, totalPages])

  const filteredItems = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    if (!keyword) return items
    return items.filter((item) =>
      [item.code, item.communeCode, item.oldLandUse, item.newLandUse]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(keyword)
    )
  }, [items, search])

  const detailQuery = useApiQuery(
    ['field-measurement', selectedId],
    () => fieldMeasurementService.getById(selectedId!),
    { enabled: detailOpen && selectedId != null, staleTime: 0 },
    false,
    false
  )
  const detail = (detailQuery.data as ApiResponse<FieldMeasurement> | undefined)?.data

  const verifyMutation = useApiMutation(
    (id: number) => fieldMeasurementService.verify(id),
    {
      onSuccess: () => {
        toast.success('Đã xác minh phiên đo')
        listQuery.refetch()
        detailQuery.refetch()
      },
    },
    false
  )
  const rejectMutation = useApiMutation(
    ({ id, note }: { id: number; note: string }) => fieldMeasurementService.reject(id, note),
    {
      onSuccess: () => {
        toast.success('Đã từ chối phiên đo')
        setReviewNote('')
        listQuery.refetch()
        detailQuery.refetch()
      },
    },
    false
  )

  async function exportGeoJson() {
    try {
      const result = await fieldMeasurementService.exportGeoJson({
        ...(from && { from }),
        ...(to && { to }),
      })
      const blob = new Blob([JSON.stringify(result.data, null, 2)], {
        type: 'application/geo+json',
      })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `field-measurements-${new Date().toISOString().slice(0, 10)}.geojson`
      anchor.click()
      URL.revokeObjectURL(url)
    } catch {
      // apiClient already shows the server error.
    }
  }

  // XLSX endpoint trả binary blob (apiClient parse JSON nên phải fetch tay).
  // Server: GET /field-measurements/export?format=xlsx → application/vnd...sheet.
  async function exportXlsx() {
    try {
      const base = (
        import.meta.env.VITE_BASE_URL_BE ||
        import.meta.env.VITE_API_BASE_URL ||
        ''
      ).replace(/\/$/, '')
      const qs = new URLSearchParams({
        format: 'xlsx',
        lang: 'vi',
        ...(from && { from }),
        ...(to && { to }),
      })
      const token = tokenManager.getAccessToken()
      const res = await fetch(`${base}${serviceFieldMeasurementPath}/export?${qs.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      if (!blob.size) throw new Error('Tệp trả về rỗng')
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `field-measurements-${new Date().toISOString().slice(0, 10)}.xlsx`
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (err: any) {
      toast.error(err?.message || 'Không thể xuất Excel')
    }
  }

  return (
    <PageLayout
      title="Đo đạc thực địa"
      description="Xác minh phiên đo GPS gửi từ MobileGIS và xuất dữ liệu đã duyệt"
    >
      <ToolTableCustom
        searchValue={search}
        setSearchValue={setSearch}
        total={total}
        pagination={{ currentPage: page, totalPages, onPageChange: setPage }}
        filter={
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={status}
              onValueChange={(value) => {
                setStatus(value as typeof status)
                setPage(1)
              }}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả trạng thái</SelectItem>
                {Object.entries(STATUS).map(([value, option]) => (
                  <SelectItem key={value} value={value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={from}
              onChange={(event) => {
                setFrom(event.target.value)
                setPage(1)
              }}
              className="w-36"
              aria-label="Từ ngày"
            />
            <Input
              type="date"
              value={to}
              onChange={(event) => {
                setTo(event.target.value)
                setPage(1)
              }}
              className="w-36"
              aria-label="Đến ngày"
            />
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
            <Button variant="outline" onClick={exportGeoJson} title="Xuất GeoJSON đã xác minh">
              <Download className="size-4" /> GeoJSON
            </Button>
            <Button variant="outline" onClick={exportXlsx} title="Xuất Excel đã xác minh">
              <Download className="size-4" /> Excel
            </Button>
          </div>
        }
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mã phiên đo</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead>Địa bàn</TableHead>
              <TableHead>Diện tích</TableHead>
              <TableHead>Sử dụng đất</TableHead>
              <TableHead>Người đo</TableHead>
              <TableHead>Gửi lúc</TableHead>
              <TableHead className="text-right">Chi tiết</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredItems.map((item) => (
              <TableRow
                key={item.id}
                className="cursor-pointer"
                onClick={() => {
                  setSelectedId(item.id)
                  setDetailOpen(true)
                }}
              >
                <TableCell className="font-medium">{item.code}</TableCell>
                <TableCell>{statusBadge(item.status)}</TableCell>
                <TableCell>
                  <div className="min-w-0">
                    <p className="truncate">{formatCommune(item.communeCode)}</p>
                    {item.communeCode && communeNameByCode.has(String(item.communeCode)) && (
                      <p className="text-muted-foreground truncate font-mono text-[10px]">
                        {item.communeCode}
                      </p>
                    )}
                  </div>
                </TableCell>
                <TableCell>{formatArea(item.areaM2)}</TableCell>
                <TableCell>{item.newLandUse || item.oldLandUse || '—'}</TableCell>
                <TableCell>#{item.measuredBy ?? '—'}</TableCell>
                <TableCell>{formatDateTime(item.submittedAt ?? item.createdAt)}</TableCell>
                <TableCell className="text-right">
                  <Eye className="ml-auto size-4" />
                </TableCell>
              </TableRow>
            ))}
            {!filteredItems.length && (
              <TableRow>
                <TableCell colSpan={8} className="text-muted-foreground text-center">
                  Không có phiên đo phù hợp.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </ToolTableCustom>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogTitle>Chi tiết phiên đo {detail?.code}</DialogTitle>
          <DialogDescription>
            Dữ liệu GPS, biến động sử dụng đất và kết quả xác minh
          </DialogDescription>
          {detail ? (
            <div className="space-y-4 text-sm">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Info label="Trạng thái" value={statusBadge(detail.status)} />
                <Info label="Diện tích" value={formatArea(detail.areaM2)} />
                <Info
                  label="Sai số GPS trung bình"
                  value={detail.avgAccuracyM != null ? `${detail.avgAccuracyM} m` : '—'}
                />
                <Info
                  label="Địa bàn"
                  value={
                    detail.communeCode ? (
                      <div>
                        <p>{formatCommune(detail.communeCode)}</p>
                        {communeNameByCode.has(String(detail.communeCode)) && (
                          <p className="text-muted-foreground font-mono text-[10px]">
                            {detail.communeCode}
                          </p>
                        )}
                      </div>
                    ) : (
                      '—'
                    )
                  }
                />
                <Info label="Khu vực" value={detail.areaId ? `#${detail.areaId}` : 'Chưa gán'} />
                <Info label="Sử dụng đất cũ" value={detail.oldLandUse || '—'} />
                <Info label="Sử dụng đất mới" value={detail.newLandUse || '—'} />
                <Info label="Người đo" value={`#${detail.measuredBy ?? '—'}`} />
                <Info
                  label="Người xác minh"
                  value={detail.verifiedBy ? `#${detail.verifiedBy}` : '—'}
                />
                <Info label="Số điểm GPS" value={String(detail.points?.length ?? 0)} />
              </div>
              {/* Timeline vòng đời — server ghi lại 4 mốc (bắt đầu đo → kết thúc
                  → gửi duyệt → xác minh/từ chối). Hiển thị dạng grid gọn. */}
              <div className="rounded-md border p-3">
                <p className="text-muted-foreground mb-2 text-xs">Vòng đời phiên đo</p>
                <div className="grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
                  <TimelineEntry label="Bắt đầu đo" at={detail.startedAt} />
                  <TimelineEntry label="Kết thúc đo" at={detail.finishedAt} />
                  <TimelineEntry label="Gửi duyệt" at={detail.submittedAt} />
                  <TimelineEntry
                    label={detail.status === 'rejected' ? 'Từ chối' : 'Xác minh'}
                    at={detail.verifiedAt}
                  />
                </div>
              </div>

              {detail.note && <Info label="Ghi chú hiện trường" value={detail.note} />}
              {detail.reviewNote && <Info label="Ghi chú xác minh" value={detail.reviewNote} />}

              {/* affectedFeatures — server auto-fill khi tạo phiên đo (giao cắt
                  với lớp thửa nền qua repo.intersectWithLayer, ORDER BY
                  overlap_m2 DESC LIMIT 50). Empty khi payload.layerCode null. */}
              {Array.isArray(detail.affectedFeatures) && detail.affectedFeatures.length > 0 && (
                <div className="rounded-md border">
                  <div className="border-b p-3">
                    <p className="text-muted-foreground text-xs">
                      Thửa/đối tượng giao cắt ({detail.affectedFeatures.length})
                    </p>
                    <p className="text-muted-foreground mt-0.5 text-[10px]">
                      Sắp xếp theo diện tích chồng lấp giảm dần
                    </p>
                  </div>
                  <div className="max-h-64 overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Feature ID</TableHead>
                          <TableHead className="text-xs">Loại đất</TableHead>
                          <TableHead className="text-right text-xs">Chồng lấp</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detail.affectedFeatures.map((feat, idx) => {
                          const f = feat as {
                            featureId?: string | number
                            landUse?: string | null
                            overlapM2?: number | string | null
                          }
                          return (
                            <TableRow key={String(f.featureId ?? idx)}>
                              <TableCell className="font-mono text-[10px]">
                                {String(f.featureId ?? '—')}
                              </TableCell>
                              <TableCell className="text-xs">{f.landUse || '—'}</TableCell>
                              <TableCell className="text-right text-xs tabular-nums">
                                {formatArea(f.overlapM2)}
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
              {/* Preview GeoJSON polygon trên bản đồ. GeoJsonMapPreview tự
                  gỡ WebGL context + markers khi unmount (dialog đóng → detail
                  reset → component unmount → map.remove() chạy). Chỉ render
                  khi có geom để tránh khởi tạo map rỗng. */}
              {detail.geom ? (
                <div className="space-y-1">
                  <p className="text-muted-foreground text-xs">Hình học GeoJSON</p>
                  <GeoJsonMapPreview geojson={detail.geom} heightClassName="h-72" />
                  <details className="text-muted-foreground text-[10px]">
                    <summary className="cursor-pointer">Xem raw JSON</summary>
                    <code className="mt-1 block max-h-32 overflow-auto whitespace-pre-wrap">
                      {JSON.stringify(detail.geom)}
                    </code>
                  </details>
                </div>
              ) : (
                <Info label="Hình học GeoJSON" value="—" />
              )}
              <Info label="Ảnh hiện trường" value={`${detail.photos?.length ?? 0} ảnh`} />
              {canReview && detail.status === 'submitted' && (
                <div className="space-y-2 border-t pt-4">
                  <Textarea
                    value={reviewNote}
                    onChange={(event) => setReviewNote(event.target.value)}
                    placeholder="Lý do từ chối (ít nhất 3 ký tự)"
                  />
                  <DialogFooter>
                    <Button
                      variant="destructive"
                      disabled={reviewNote.trim().length < 3 || rejectMutation.isPending}
                      onClick={() =>
                        rejectMutation.mutate({ id: detail.id, note: reviewNote.trim() })
                      }
                    >
                      <X className="size-4" /> Từ chối
                    </Button>
                    <Button
                      disabled={verifyMutation.isPending}
                      onClick={() => verifyMutation.mutate(detail.id)}
                    >
                      <Check className="size-4" /> Xác minh
                    </Button>
                  </DialogFooter>
                </div>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground">Đang tải dữ liệu...</p>
          )}
        </DialogContent>
      </Dialog>
    </PageLayout>
  )
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-muted-foreground mb-1 text-xs">{label}</p>
      <div className="font-medium">{value}</div>
    </div>
  )
}

function TimelineEntry({ label, at }: { label: string; at?: string | null }) {
  return (
    <div>
      <p className="text-muted-foreground text-[10px]">{label}</p>
      <p className="font-medium tabular-nums">{at ? formatDateTime(at) : '—'}</p>
    </div>
  )
}
