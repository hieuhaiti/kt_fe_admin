import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import {
  ChevronDown,
  ChevronUp,
  Upload,
  Trash2,
  Trees,
  Info,
  MapPin,
  Shapes,
  RefreshCw,
} from 'lucide-react'
import { forestClassificationService, useApiQuery, useApiMutation } from '@/service'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
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
import { formatDate } from '@/lib/date'
import { hasPerm } from '@/lib/permissions'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/common/useAuthStore'
import type { ApiResponse, ForestGtZoneItem, ForestGtPointItem } from '@/types/api'

/**
 * Ground truth card cho phân loại lớp phủ schema v5.3.
 *
 * Khác GT của fire-risk ở chỗ:
 *   - Thang: class_id 0-12 thay vì severity 1-5
 *   - "observedAt" thay vì "occurredAt" (đo đạc chứ không phải sự cố)
 *   - Point vẫn có class_id — điểm mẫu đơn lẻ (ranger đo tại tọa độ X,Y)
 *
 * Pipeline forest-classification chạy monthly cron sẽ query GT trong 180 ngày,
 * blend vào RF training với trọng số 50% → tăng accuracy khi có nhãn thật.
 *
 * Layout: hàng trên là 2 form nhập (import GeoJSON + thêm điểm thủ công), panel
 * dưới là danh sách dữ liệu đã thêm với tab vùng/điểm, chọn nhiều và xóa hàng loạt.
 */

// Palette + name lấy từ configs/forest-classification.js.
const CLASSES: Array<{ id: number; name: string; color: string }> = [
  { id: 0,  name: 'Không có ảnh',                    color: '#D9D9D9' },
  { id: 1,  name: 'Đất khác',                        color: '#FFBEE8' },
  { id: 2,  name: 'Cây công nghiệp',                 color: '#FFEBB0' },
  { id: 3,  name: 'Đất nông nghiệp',                 color: '#F0E442' },
  { id: 4,  name: 'Rừng hỗn giao lá rộng, lá kim',   color: '#FEFF73' },
  { id: 5,  name: 'Rừng lá rộng thường xanh',        color: '#AAFF03' },
  { id: 6,  name: 'Rừng lá kim',                     color: '#D0FF73' },
  { id: 7,  name: 'Rừng lá rộng rụng lá',            color: '#E7E600' },
  { id: 8,  name: 'Rừng tre nứa',                    color: '#4DE600' },
  { id: 9,  name: 'Rừng trồng',                      color: '#FFAA01' },
  { id: 10, name: 'Sông, suối, hồ',                  color: '#73B2FF' },
  { id: 11, name: 'Trảng cỏ, cây bụi',               color: '#55FF00' },
  { id: 12, name: 'Không xác định',                  color: '#8C8C8C' },
]

const QK_ZONES = ['forest-gt-zones'] as const
const QK_POINTS = ['forest-gt-points'] as const

// Backend `listQuery` giới hạn limit tối đa 200.
const LIST_LIMIT = 200

const classLabel = (id?: number | null) => {
  if (id == null) return '—'
  const c = CLASSES.find((x) => x.id === id)
  return c ? `${id} · ${c.name}` : `${id}`
}

const classColor = (id?: number | null) => CLASSES.find((x) => x.id === id)?.color

export default function ForestGroundTruthCard() {
  const [open, setOpen] = useState(false)
  const user = useAuthStore((s) => s.user)
  // Backend gate: verifyToken + requirePermission('forest_classification', 'ground_truth').
  // Toàn bộ card (upload zone/point + delete) đều chung 1 quyền — ẩn thẳng card
  // để tránh hiển thị UI mà mọi mutation sẽ 403.
  if (!hasPerm(user, 'forest_classification', 'ground_truth')) return null

  return (
    <Card>
      <CardContent className="p-4 sm:p-6">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full cursor-pointer items-center justify-between text-left"
          aria-expanded={open}
        >
          <div className="flex items-center gap-2">
            <Trees className="h-4 w-4 text-emerald-600" />
            <h2 className="text-lg font-semibold">Dữ liệu mẫu thực địa (13 lớp)</h2>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] text-emerald-700">
              Cải thiện độ chính xác
            </span>
          </div>
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {open && (
          <div className="mt-4 space-y-4">
            <ExplanationBanner />
            <ClassLegend />
            <div className="grid gap-4 lg:grid-cols-2">
              <ImportSection />
              <PointFormSection />
            </div>
            <SampleDataPanel />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ExplanationBanner() {
  return (
    <div className="rounded-md border border-sky-300 bg-sky-50 p-3 text-xs">
      <div className="mb-1 flex items-center gap-1.5 font-semibold text-sky-900">
        <Info size={12} />
        Cách sử dụng dữ liệu mẫu thực địa
      </div>
      <ul className="ml-5 list-disc space-y-1 text-sky-800">
        <li>
          <b>Vùng</b>: mẫu diện tích rộng, ví dụ một lô rừng đã được khảo sát
          toàn bộ.
        </li>
        <li>
          <b>Điểm</b>: mẫu đơn lẻ do kiểm lâm hoặc cán bộ khảo sát ghi nhận tại
          một tọa độ. Mỗi mẫu được gán một nhóm lớp phủ.
        </li>
        <li>
          Dữ liệu trong <b>180 ngày gần nhất</b> được đưa vào kỳ phân loại tiếp
          theo với trọng số <b>50%</b>.
        </li>
        <li>
          Sau khi thêm dữ liệu, bấm <b>"Chạy lại phân tích"</b> để áp dụng ngay
          hoặc chờ kỳ phân loại tháng sau.
        </li>
        <li>
          Dữ liệu đã xóa không còn được dùng cho kỳ sau; kết quả lịch sử vẫn
          được giữ nguyên.
        </li>
      </ul>
    </div>
  )
}

function ClassLegend() {
  return (
    <div className="rounded-md border p-2">
      <p className="mb-1.5 text-xs font-semibold text-muted-foreground">
        13 nhóm lớp phủ (chọn khi thêm dữ liệu)
      </p>
      <div className="grid grid-cols-1 gap-1 text-xs sm:grid-cols-2 md:grid-cols-3">
        {CLASSES.map((c) => (
          <div key={c.id} className="flex items-center gap-1.5">
            <span
              className="inline-block h-3 w-3 shrink-0 rounded"
              style={{ backgroundColor: c.color }}
            />
            <span className="font-mono text-[10px]">{c.id}</span>
            <span className="truncate">{c.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Helpers import GeoJSON ────────────────────────────────────────────────────

type GeoGeometry = { type?: string; coordinates?: unknown } | null | undefined

interface GeoFeature {
  type?: string
  geometry?: GeoGeometry
  properties?: Record<string, unknown> | null
}

interface GtPointPayload {
  observedAt: string
  classId: number
  lng: number
  lat: number
  source?: string
  notes?: string
  reporterName?: string
}

const POLYGON_TYPES = ['Polygon', 'MultiPolygon']
const POINT_TYPES = ['Point', 'MultiPoint']

// Backend validator giới hạn điểm trong khung Kon Tum (lng 106-109, lat 13-16.5).
// Lọc trước ở client để một điểm lệch không làm hỏng cả transaction bulk.
const BOUNDS = { lngMin: 106, lngMax: 109, latMin: 13, latMax: 16.5 }

// Chunk nhỏ hơn giới hạn 1000 điểm/lần của backend.
const POINT_BATCH = 500

/**
 * Input `datetime-local` trả "2026-09-06T10:09" (thiếu giây + timezone) nên
 * chuẩn hóa về ISO đầy đủ trước khi gửi để Joi `date().iso()` luôn nhận.
 */
const toIso = (value: unknown): string | null => {
  if (value == null || value === '') return null
  const d = new Date(value as string | number | Date)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

/** Properties từ QGIS/ArcGIS có thể là classId, class_id, cls_id hoặc class. */
const pickClassId = (props: Record<string, unknown>): number | null => {
  const raw = props.classId ?? props.class_id ?? props.cls_id ?? props.class
  if (raw == null || raw === '') return null
  const n = Number(raw)
  return Number.isInteger(n) && n >= 0 && n <= 12 ? n : null
}

const pickString = (...values: unknown[]): string | undefined => {
  for (const v of values) {
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return undefined
}

/** Point → [lng, lat]; MultiPoint lấy đỉnh đầu tiên. */
const readLngLat = (geometry: GeoGeometry): [number, number] | null => {
  const coords = geometry?.coordinates
  if (!Array.isArray(coords)) return null
  const pair = geometry?.type === 'MultiPoint' ? coords[0] : coords
  if (!Array.isArray(pair)) return null
  const lng = Number(pair[0])
  const lat = Number(pair[1])
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null
  return [lng, lat]
}

const inBounds = (lng: number, lat: number) =>
  lng >= BOUNDS.lngMin && lng <= BOUNDS.lngMax &&
  lat >= BOUNDS.latMin && lat <= BOUNDS.latMax

/** Chấp nhận geometry trần, Feature đơn lẻ hoặc FeatureCollection. */
const normalizeFeatures = (input: unknown): GeoFeature[] | null => {
  if (!input || typeof input !== 'object') return null
  const obj = input as Record<string, unknown>
  const type = obj.type as string | undefined

  if (type && [...POLYGON_TYPES, ...POINT_TYPES].includes(type)) {
    return [{ type: 'Feature', geometry: obj as GeoGeometry, properties: {} }]
  }
  if (type === 'Feature') return [obj as GeoFeature]
  if (type === 'FeatureCollection' && Array.isArray(obj.features)) {
    return obj.features as GeoFeature[]
  }
  return null
}

const chunk = <T,>(arr: T[], size: number): T[][] => {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

// ── Import GeoJSON ────────────────────────────────────────────────────────────

function ImportSection() {
  const [geojsonText, setGeojsonText] = useState('')
  const [classId, setClassId] = useState(5)
  const [observedAt, setObservedAt] = useState(() =>
    new Date().toISOString().slice(0, 16),
  )
  const queryClient = useQueryClient()

  const bulkZoneM = useApiMutation((fc: Record<string, unknown>) =>
    forestClassificationService.bulkGtZone(fc),
  )
  // Cùng ô nhập nhưng khác endpoint: backend chỉ nhận Polygon/MultiPolygon ở
  // zones/bulk, điểm phải đi points/bulk — gửi nhầm sẽ bị validator trả 400.
  const bulkPointM = useApiMutation((points: GtPointPayload[]) =>
    forestClassificationService.bulkGtPoint(points),
  )
  const isSending = bulkZoneM.isPending || bulkPointM.isPending

  const onSubmit = async () => {
    let parsed: unknown
    try {
      parsed = JSON.parse(geojsonText)
    } catch {
      toast.error('Dữ liệu không đúng định dạng JSON. Vui lòng kiểm tra lại.')
      return
    }

    const features = normalizeFeatures(parsed)
    if (!features?.length) {
      toast.error('Dữ liệu chưa đúng định dạng bản đồ được hỗ trợ (GeoJSON).')
      return
    }

    const fallbackObservedAt = toIso(observedAt) ?? new Date().toISOString()
    const zoneFeatures: GeoFeature[] = []
    const pointPayloads: GtPointPayload[] = []
    let unsupported = 0
    let outOfBounds = 0

    features.forEach((f) => {
      const props = { ...(f.properties ?? {}) }
      const geomType = f.geometry?.type
      const cls = pickClassId(props) ?? classId
      const observed =
        toIso(props.observedAt ?? props.observed_at ?? props.date) ?? fallbackObservedAt

      if (geomType && POLYGON_TYPES.includes(geomType)) {
        zoneFeatures.push({
          type: 'Feature',
          geometry: f.geometry,
          properties: { ...props, classId: cls, observedAt: observed },
        })
        return
      }

      if (geomType && POINT_TYPES.includes(geomType)) {
        const lngLat = readLngLat(f.geometry)
        if (!lngLat) {
          unsupported += 1
          return
        }
        const [lng, lat] = lngLat
        if (!inBounds(lng, lat)) {
          outOfBounds += 1
          return
        }
        const notes = [
          pickString(props.Ten, props.ten, props.name),
          pickString(props.LPR, props.lpr),
          pickString(props.note, props.notes, props.ghi_chu),
        ].filter(Boolean).join(' · ').slice(0, 2000)

        pointPayloads.push({
          observedAt: observed,
          classId: cls,
          lng,
          lat,
          source: pickString(props.source) ?? 'field_survey',
          notes: notes || undefined,
          reporterName: pickString(props.reporterName, props.reporter_name),
        })
        return
      }

      unsupported += 1
    })

    if (!zoneFeatures.length && !pointPayloads.length) {
      toast.error('Không tìm thấy vùng hoặc điểm hợp lệ trong dữ liệu đã dán.')
      return
    }

    try {
      let insertedZones = 0
      let insertedPoints = 0

      if (zoneFeatures.length) {
        const res: ApiResponse<{ inserted?: number }> = await bulkZoneM.mutateAsync({
          type: 'FeatureCollection',
          features: zoneFeatures,
        })
        insertedZones = res?.data?.inserted ?? zoneFeatures.length
      }

      for (const batch of chunk(pointPayloads, POINT_BATCH)) {
        const res: ApiResponse<{ inserted?: number }> = await bulkPointM.mutateAsync(batch)
        insertedPoints += res?.data?.inserted ?? batch.length
      }

      const parts: string[] = []
      if (insertedZones) parts.push(`${insertedZones} vùng`)
      if (insertedPoints) parts.push(`${insertedPoints} điểm`)
      toast.success(`Đã thêm ${parts.join(' và ')}.`)

      setGeojsonText('')
      if (insertedZones) queryClient.invalidateQueries({ queryKey: QK_ZONES })
      if (insertedPoints) queryClient.invalidateQueries({ queryKey: QK_POINTS })

      if (outOfBounds) {
        toast.warning(`Bỏ qua ${outOfBounds} điểm nằm ngoài phạm vi tỉnh Kon Tum.`)
      }
      if (unsupported) {
        toast.warning(`Bỏ qua ${unsupported} đối tượng không được hỗ trợ.`)
      }
    } catch {
      // apiClient đã hiển thị thông báo lỗi chi tiết từ máy chủ.
    }
  }

  return (
    <div className="space-y-3 rounded-md border p-3">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold">
        <Upload className="h-3.5 w-3.5 text-muted-foreground" />
        Nhập dữ liệu từ tệp bản đồ
      </h3>

      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-0.5">
          <span className="text-xs text-muted-foreground">Ngày khảo sát mặc định</span>
          <Input
            type="datetime-local"
            value={observedAt}
            onChange={(e) => setObservedAt(e.target.value)}
          />
        </label>
        <label className="space-y-0.5">
          <span className="text-xs text-muted-foreground">Nhóm lớp phủ mặc định</span>
          <select
            value={classId}
            onChange={(e) => setClassId(Number(e.target.value))}
            className="h-9 w-full cursor-pointer rounded-md border bg-background px-2 text-sm"
          >
            {CLASSES.map((c) => (
              <option key={c.id} value={c.id}>{c.id} · {c.name}</option>
            ))}
          </select>
        </label>
      </div>

      <label className="block space-y-0.5">
        <span className="text-xs text-muted-foreground">
          Dán dữ liệu bản đồ (GeoJSON) — hỗ trợ cả vùng và điểm
        </span>
        <textarea
          value={geojsonText}
          onChange={(e) => setGeojsonText(e.target.value)}
          placeholder='{"type":"FeatureCollection","features":[...]}'
          className="min-h-[120px] w-full rounded-md border bg-background p-2 font-mono text-xs"
        />
        <span className="block text-[10px] text-muted-foreground">
          Đối tượng dạng vùng được thêm vào danh sách vùng mẫu, đối tượng dạng
          điểm được thêm vào danh sách điểm mẫu. Ngày và nhóm lớp phủ trong tệp
          được ưu tiên hơn giá trị mặc định ở trên.
        </span>
      </label>

      <Button
        onClick={onSubmit}
        disabled={!geojsonText.trim() || isSending}
        size="sm"
        className="w-full cursor-pointer"
      >
        <Upload className="mr-1 h-3.5 w-3.5" />
        {isSending ? 'Đang gửi...' : 'Thêm dữ liệu mẫu'}
      </Button>
    </div>
  )
}

// ── Form thêm điểm thủ công ───────────────────────────────────────────────────

function PointFormSection() {
  const queryClient = useQueryClient()
  const [form, setForm] = useState(() => ({
    observedAt: new Date().toISOString().slice(0, 16),
    classId: 5,
    lng: '',
    lat: '',
    source: 'field_report',
    reporterName: '',
    notes: '',
  }))

  const createM = useApiMutation(
    (body: Parameters<typeof forestClassificationService.createGtPoint>[0]) =>
      forestClassificationService.createGtPoint(body),
  )

  const onSubmit = () => {
    const lng = Number(form.lng)
    const lat = Number(form.lat)
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
      toast.error('Kinh độ hoặc vĩ độ không hợp lệ.')
      return
    }
    if (!inBounds(lng, lat)) {
      toast.error('Tọa độ nằm ngoài phạm vi tỉnh Kon Tum.')
      return
    }
    createM.mutate(
      { ...form, lng, lat, observedAt: toIso(form.observedAt) ?? new Date().toISOString() },
      {
        onSuccess: () => {
          toast.success('Đã thêm điểm.')
          setForm((s) => ({ ...s, lng: '', lat: '', notes: '', reporterName: '' }))
          queryClient.invalidateQueries({ queryKey: QK_POINTS })
        },
        onError: () => toast.error('Không thể thêm điểm mẫu. Vui lòng thử lại.'),
      },
    )
  }

  return (
    <div className="space-y-3 rounded-md border p-3">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold">
        <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
        Thêm điểm mẫu thủ công
      </h3>

      <div className="grid grid-cols-2 gap-2">
        <label className="col-span-2 space-y-0.5">
          <span className="text-xs text-muted-foreground">Ngày khảo sát</span>
          <Input
            type="datetime-local"
            value={form.observedAt}
            onChange={(e) => setForm((s) => ({ ...s, observedAt: e.target.value }))}
          />
        </label>
        <label className="space-y-0.5">
          <span className="text-xs text-muted-foreground">Kinh độ</span>
          <Input
            type="number"
            step="0.000001"
            value={form.lng}
            onChange={(e) => setForm((s) => ({ ...s, lng: e.target.value }))}
            placeholder="108.0"
          />
        </label>
        <label className="space-y-0.5">
          <span className="text-xs text-muted-foreground">Vĩ độ</span>
          <Input
            type="number"
            step="0.000001"
            value={form.lat}
            onChange={(e) => setForm((s) => ({ ...s, lat: e.target.value }))}
            placeholder="14.5"
          />
        </label>
        <label className="col-span-2 space-y-0.5">
          <span className="text-xs text-muted-foreground">Nhóm lớp phủ</span>
          <select
            value={form.classId}
            onChange={(e) => setForm((s) => ({ ...s, classId: Number(e.target.value) }))}
            className="h-9 w-full cursor-pointer rounded-md border bg-background px-2 text-sm"
          >
            {CLASSES.map((c) => (
              <option key={c.id} value={c.id}>{c.id} · {c.name}</option>
            ))}
          </select>
        </label>
        <label className="space-y-0.5">
          <span className="text-xs text-muted-foreground">Nguồn</span>
          <select
            value={form.source}
            onChange={(e) => setForm((s) => ({ ...s, source: e.target.value }))}
            className="h-9 w-full cursor-pointer rounded-md border bg-background px-2 text-sm"
          >
            <option value="field_report">Báo cáo thực địa</option>
            <option value="ranger">Kiểm lâm</option>
            <option value="expert">Chuyên gia</option>
            <option value="citizen">Người dân</option>
            <option value="other">Khác</option>
          </select>
        </label>
        <label className="space-y-0.5">
          <span className="text-xs text-muted-foreground">Người báo cáo</span>
          <Input
            value={form.reporterName}
            onChange={(e) => setForm((s) => ({ ...s, reporterName: e.target.value }))}
          />
        </label>
      </div>

      <Button
        onClick={onSubmit}
        disabled={createM.isPending}
        size="sm"
        className="w-full cursor-pointer"
      >
        <Upload className="mr-1 h-3.5 w-3.5" />
        {createM.isPending ? 'Đang gửi...' : 'Thêm điểm mẫu'}
      </Button>
    </div>
  )
}

// ── Panel danh sách dữ liệu đã thêm ───────────────────────────────────────────

type SelectionId = string

/** Key ổn định để so khớp giữa lần render và payload xóa (id có thể là number|string). */
const sid = (id: number | string): SelectionId => String(id)

function SampleDataPanel() {
  const [tab, setTab] = useState<'zones' | 'points'>('points')

  const zonesQ = useApiQuery(QK_ZONES, () =>
    forestClassificationService.listGtZones({ limit: LIST_LIMIT }),
  )
  const pointsQ = useApiQuery(QK_POINTS, () =>
    forestClassificationService.listGtPoints({ limit: LIST_LIMIT }),
  )

  // OK_LIST server-side wrap: { data: { items: [...] }, metadata: {...} }
  // → apiClient trả nguyên ApiResponse → phải đọc .data.items (không phải .data).
  const zones: ForestGtZoneItem[] = zonesQ.data?.data?.items ?? []
  const points: ForestGtPointItem[] = pointsQ.data?.data?.items ?? []

  return (
    <div className="rounded-md border">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b p-3">
        <h3 className="text-sm font-semibold">Dữ liệu mẫu đã thêm</h3>
        <Tabs value={tab} onValueChange={(v) => setTab(v as 'zones' | 'points')}>
          <TabsList className="h-8">
            <TabsTrigger value="points" className="h-6 cursor-pointer gap-1 text-xs">
              <MapPin className="h-3 w-3" />
              Điểm ({points.length})
            </TabsTrigger>
            <TabsTrigger value="zones" className="h-6 cursor-pointer gap-1 text-xs">
              <Shapes className="h-3 w-3" />
              Vùng ({zones.length})
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as 'zones' | 'points')}>
        <TabsContent value="points" className="mt-0">
          <SampleList
            kind="points"
            items={points}
            isLoading={pointsQ.isLoading}
            isFetching={pointsQ.isFetching}
            refetch={pointsQ.refetch}
            emptyText="Chưa có điểm mẫu nào."
          />
        </TabsContent>
        <TabsContent value="zones" className="mt-0">
          <SampleList
            kind="zones"
            items={zones}
            isLoading={zonesQ.isLoading}
            isFetching={zonesQ.isFetching}
            refetch={zonesQ.refetch}
            emptyText="Chưa có vùng mẫu nào."
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

interface SampleListProps {
  kind: 'zones' | 'points'
  items: Array<ForestGtZoneItem | ForestGtPointItem>
  isLoading: boolean
  isFetching: boolean
  refetch: () => unknown
  emptyText: string
}

function SampleList({ kind, items, isLoading, isFetching, refetch, emptyText }: SampleListProps) {
  const [selected, setSelected] = useState<Set<SelectionId>>(() => new Set())
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const label = kind === 'zones' ? 'vùng' : 'điểm'

  // notification=false: message của server đã được gộp vào toast tự soạn bên dưới.
  // Backend nhận cả danh sách id trong 1 statement nên không cần N request.
  const deleteM = useApiMutation(
    (ids: Array<number | string>) =>
      kind === 'zones'
        ? forestClassificationService.bulkDeleteGtZones(ids)
        : forestClassificationService.bulkDeleteGtPoints(ids),
    {},
    false,
  )

  const visibleIds = useMemo(() => items.map((i) => sid(i.id)), [items])
  // Bỏ id đã biến mất khỏi danh sách (sau khi xóa/refetch) khỏi selection.
  const activeSelected = useMemo(
    () => visibleIds.filter((id) => selected.has(id)),
    [visibleIds, selected],
  )
  const allSelected = visibleIds.length > 0 && activeSelected.length === visibleIds.length

  const toggleOne = (id: SelectionId) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(visibleIds))
  }

  const runDelete = async (ids: SelectionId[]) => {
    if (!ids.length) return
    setDeleting(true)
    try {
      const res = await deleteM.mutateAsync(ids)
      const deleted = res?.data?.deleted ?? ids.length
      const skipped = res?.data?.skipped?.length ?? 0
      setSelected(new Set())
      toast.success(`Đã xoá ${deleted} ${label}.`)
      if (skipped) {
        toast.warning(`Bỏ qua ${skipped} ${label} không còn tồn tại.`)
      }
    } catch {
      // apiClient đã hiển thị thông báo lỗi chi tiết từ máy chủ.
    } finally {
      setDeleting(false)
      refetch()
    }
  }

  const onConfirmDelete = async () => {
    setConfirmOpen(false)
    await runDelete(activeSelected)
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-b bg-muted/40 px-3 py-2">
        <label className="flex cursor-pointer items-center gap-2 text-xs">
          <Checkbox
            checked={allSelected}
            disabled={!visibleIds.length || deleting}
            onCheckedChange={toggleAll}
            aria-label={`Chọn tất cả ${label}`}
            className="cursor-pointer"
          />
          <span>Chọn tất cả</span>
        </label>

        <span className="text-xs text-muted-foreground">
          {activeSelected.length > 0
            ? `Đã chọn ${activeSelected.length}/${visibleIds.length}`
            : `${visibleIds.length} ${label}`}
        </span>

        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="xs"
            className="cursor-pointer"
            onClick={() => refetch()}
            disabled={isFetching || deleting}
          >
            <RefreshCw className={cn('mr-1 h-3 w-3', isFetching && 'animate-spin')} />
            Làm mới
          </Button>
          <Button
            variant="destructive"
            size="xs"
            className="cursor-pointer"
            disabled={!activeSelected.length || deleting}
            onClick={() => setConfirmOpen(true)}
          >
            <Trash2 className="mr-1 h-3 w-3" />
            {deleting ? 'Đang xoá...' : `Xoá đã chọn (${activeSelected.length})`}
          </Button>
        </div>
      </div>

      <div className="max-h-80 overflow-auto p-2">
        {isLoading && <p className="p-2 text-xs text-muted-foreground">Đang tải...</p>}
        {!isLoading && !items.length && (
          <p className="p-2 text-xs text-muted-foreground">{emptyText}</p>
        )}

        <div className="space-y-1">
          {items.map((item) => {
            const id = sid(item.id)
            const checked = selected.has(id)
            return (
              <label
                key={id}
                className={cn(
                  'flex cursor-pointer items-center gap-2 rounded border p-1.5 text-xs transition-colors hover:bg-accent/50',
                  checked && 'border-primary/60 bg-primary/5',
                )}
              >
                <Checkbox
                  checked={checked}
                  disabled={deleting}
                  onCheckedChange={() => toggleOne(id)}
                  aria-label={`Chọn ${label} #${id}`}
                  className="cursor-pointer"
                />
                <span
                  className="inline-block h-3 w-3 shrink-0 rounded"
                  style={{ backgroundColor: classColor(item.class_id) }}
                />
                {kind === 'zones' ? (
                  <ZoneRow zone={item as ForestGtZoneItem} />
                ) : (
                  <PointRow point={item as ForestGtPointItem} />
                )}
                <button
                  type="button"
                  disabled={deleting}
                  onClick={(e) => {
                    e.preventDefault()
                    void runDelete([id])
                  }}
                  className="shrink-0 cursor-pointer text-red-500 transition-colors hover:text-red-700 disabled:opacity-50"
                  aria-label={`Xoá ${label} #${id}`}
                >
                  <Trash2 size={12} />
                </button>
              </label>
            )
          })}
        </div>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá {activeSelected.length} {label} đã chọn?</AlertDialogTitle>
            <AlertDialogDescription>
              Dữ liệu đã xoá sẽ không còn được dùng cho kỳ phân loại tiếp theo.
              Kết quả của các kỳ đã chạy trước đó vẫn được giữ nguyên.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">Huỷ</AlertDialogCancel>
            <AlertDialogAction
              className="cursor-pointer bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={onConfirmDelete}
            >
              Xoá
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function ZoneRow({ zone }: { zone: ForestGtZoneItem }) {
  return (
    <>
      <span className="flex-1 truncate" title={zone.name || `Vùng #${zone.id}`}>
        {zone.name || `Vùng #${zone.id}`} · {classLabel(zone.class_id)}
      </span>
      <span className="shrink-0 text-muted-foreground">{formatDate(zone.observed_at)}</span>
      <span className="shrink-0 text-muted-foreground tabular-nums">
        {Number(zone.area_ha).toLocaleString('vi')} ha
      </span>
    </>
  )
}

function PointRow({ point }: { point: ForestGtPointItem }) {
  return (
    <>
      <span className="shrink-0 font-mono tabular-nums">
        {Number(point.lng).toFixed(3)}, {Number(point.lat).toFixed(3)}
      </span>
      <span className="flex-1 truncate text-muted-foreground" title={point.notes ?? undefined}>
        {classLabel(point.class_id)}
        {point.notes ? ` · ${point.notes}` : ''}
      </span>
      <span className="shrink-0 text-muted-foreground">{formatDate(point.observed_at)}</span>
    </>
  )
}
