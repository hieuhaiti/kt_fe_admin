import { useState } from 'react'
import { toast } from 'react-toastify'
import { ChevronDown, ChevronUp, Upload, Trash2, Trees, Info } from 'lucide-react'
import { forestClassificationService, useApiQuery, useApiMutation } from '@/service'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatDate } from '@/lib/date'
import { hasPerm } from '@/lib/permissions'
import { useAuthStore } from '@/stores/common/useAuthStore'

/**
 * Ground truth card cho phân loại rừng 11-class.
 *
 * Khác GT của fire-risk ở chỗ:
 *   - Thang: class_id 0-10 (11 land cover class) thay vì severity 1-5
 *   - "observedAt" thay vì "occurredAt" (đo đạc chứ không phải sự cố)
 *   - Point vẫn có class_id — điểm mẫu đơn lẻ (ranger đo tại tọa độ X,Y)
 *
 * Pipeline forest-classification chạy monthly cron sẽ query GT trong 180 ngày,
 * blend vào RF training với trọng số 50% → tăng accuracy khi có nhãn thật.
 */

// Palette + name lấy từ configs/forest-classification.js.
const CLASSES: Array<{ id: number; name: string; color: string }> = [
  { id: 0,  name: 'Đất khác',                       color: '#FFBEE8' },
  { id: 1,  name: 'Cây công nghiệp',                color: '#FFEBB0' },
  { id: 2,  name: 'Đất nông nghiệp',                color: '#F0E442' },
  { id: 3,  name: 'Rừng hỗn giao lá rộng, lá kim',  color: '#FEFF73' },
  { id: 4,  name: 'Rừng lá rộng thường xanh',       color: '#AAFF03' },
  { id: 5,  name: 'Rừng lá kim',                    color: '#D0FF73' },
  { id: 6,  name: 'Rừng lá rộng rụng lá',           color: '#E7E600' },
  { id: 7,  name: 'Rừng tre nứa',                   color: '#4DE600' },
  { id: 8,  name: 'Rừng trồng',                     color: '#FFAA01' },
  { id: 9,  name: 'Sông, suối, hồ',                 color: '#73B2FF' },
  { id: 10, name: 'Trảng cỏ, cây bụi',              color: '#55FF00' },
]

const classLabel = (id: number) => {
  const c = CLASSES.find((x) => x.id === id)
  return c ? `${id} · ${c.name}` : `${id}`
}

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
          className="flex w-full items-center justify-between text-left"
          aria-expanded={open}
        >
          <div className="flex items-center gap-2">
            <Trees className="h-4 w-4 text-emerald-600" />
            <h2 className="text-lg font-semibold">Ground truth (nhãn 11-class)</h2>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] text-emerald-700">
              Boost RF accuracy
            </span>
          </div>
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {open && (
          <div className="mt-4 space-y-4">
            <ExplanationBanner />
            <ClassLegend />
            <div className="grid gap-4 lg:grid-cols-2">
              <ZonesSection />
              <PointsSection />
            </div>
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
        Cơ chế nhận Ground Truth cho phân loại rừng
      </div>
      <ul className="ml-5 list-disc space-y-1 text-sky-800">
        <li>
          <b>Vùng</b> (GeoJSON Polygon): mẫu diện tích rộng — ví dụ 1 lô rừng
          lá rộng đã khảo sát toàn bộ.
        </li>
        <li>
          <b>Điểm</b>: mẫu đơn lẻ (ranger đo tại tọa độ X,Y). Mỗi mẫu gán 1
          class_id (0-10).
        </li>
        <li>
          Cron chạy <b>tháng 1</b> hàng tháng (00:00 VN) sẽ query GT trong{' '}
          <b>180 ngày</b> trước → blend vào Random Forest với trọng số:{' '}
          <b>50% input + 30% dataset + 20% threshold</b> (thay vì{' '}
          <b>60% dataset + 40% threshold</b> khi không có GT).
        </li>
        <li>
          Sau khi upload xong: bấm <b>"Chạy lại phân tích"</b> để áp dụng ngay
          — hoặc chờ cron tháng sau.
        </li>
        <li>
          Env override: <code>FC_GT_WINDOW_DAYS=180</code>. Xoá là soft-delete,
          không rewrite lịch sử snapshot.
        </li>
      </ul>
    </div>
  )
}

function ClassLegend() {
  return (
    <div className="rounded-md border p-2">
      <p className="mb-1.5 text-xs font-semibold text-muted-foreground">
        11 class ID (chọn khi upload)
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

// ── ZONES ─────────────────────────────────────────────────────────────────────

function ZonesSection() {
  const [geojsonText, setGeojsonText] = useState('')
  const [classId, setClassId] = useState(4)  // mặc định "Rừng lá rộng thường xanh"
  const [observedAt, setObservedAt] = useState(
    new Date().toISOString().slice(0, 16),
  )

  const listQ = useApiQuery(['forest-gt-zones'], () =>
    forestClassificationService.listGtZones({ limit: 50 }),
  )
  const bulkM = useApiMutation((fc: any) =>
    forestClassificationService.bulkGtZone(fc),
  )
  const deleteM = useApiMutation((id: number) =>
    forestClassificationService.deleteGtZone(id),
  )
  // OK_LIST server-side wrap: { data: { items: [...] }, metadata: {...} }
  // → apiClient trả nguyên ApiResponse → phải đọc .data.items (không phải .data).
  const items: any[] = listQ.data?.data?.items ?? []

  const onSubmit = () => {
    let parsed: any
    try {
      parsed = JSON.parse(geojsonText)
    } catch {
      toast.error('GeoJSON không parse được — kiểm tra syntax.')
      return
    }
    if (parsed.type === 'Polygon' || parsed.type === 'MultiPolygon') {
      parsed = {
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          geometry: parsed,
          properties: { classId, observedAt },
        }],
      }
    }
    if (parsed.type === 'Feature') {
      parsed = { type: 'FeatureCollection', features: [parsed] }
    }
    if (parsed.type !== 'FeatureCollection') {
      toast.error('Cần Polygon/MultiPolygon/Feature/FeatureCollection.')
      return
    }
    parsed.features.forEach((f: any) => {
      f.properties = f.properties || {}
      if (f.properties.classId == null && f.properties.class_id == null && f.properties.class == null) {
        f.properties.classId = classId
      }
      if (!f.properties.observedAt) f.properties.observedAt = observedAt
    })

    bulkM.mutate(parsed, {
      onSuccess: (res: any) => {
        toast.success(`Đã thêm ${res?.data?.inserted ?? '?'} vùng.`)
        setGeojsonText('')
        listQ.refetch()
      },
      onError: (err: any) => toast.error(err?.message || 'Upload thất bại'),
    })
  }

  const onDelete = (id: number) => {
    if (!confirm(`Xoá zone #${id}?`)) return
    deleteM.mutate(id, {
      onSuccess: () => { toast.success('Đã xoá.'); listQ.refetch() },
    })
  }

  return (
    <div className="space-y-3 rounded-md border p-3">
      <h3 className="text-sm font-semibold">Vùng mẫu (GeoJSON)</h3>

      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-0.5">
            <span className="text-xs text-muted-foreground">Ngày khảo sát</span>
            <Input
              type="datetime-local"
              value={observedAt}
              onChange={(e) => setObservedAt(e.target.value)}
            />
          </label>
          <label className="space-y-0.5">
            <span className="text-xs text-muted-foreground">Class mặc định</span>
            <select
              value={classId}
              onChange={(e) => setClassId(Number(e.target.value))}
              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
            >
              {CLASSES.map((c) => (
                <option key={c.id} value={c.id}>{c.id} · {c.name}</option>
              ))}
            </select>
          </label>
        </div>

        <label className="block space-y-0.5">
          <span className="text-xs text-muted-foreground">
            Paste GeoJSON (properties.classId sẽ được set từ default nếu thiếu)
          </span>
          <textarea
            value={geojsonText}
            onChange={(e) => setGeojsonText(e.target.value)}
            placeholder='{"type":"Polygon","coordinates":[[[107.5,14.5],...]]}'
            className="min-h-[100px] w-full rounded-md border bg-background p-2 font-mono text-xs"
          />
        </label>

        <Button
          onClick={onSubmit}
          disabled={!geojsonText.trim() || bulkM.isPending}
          size="sm"
          className="w-full"
        >
          <Upload className="mr-1 h-3.5 w-3.5" />
          {bulkM.isPending ? 'Đang gửi...' : 'Thêm vùng mẫu'}
        </Button>
      </div>

      <div className="max-h-64 space-y-1 overflow-auto border-t pt-2">
        {listQ.isLoading && <p className="text-xs text-muted-foreground">Đang tải...</p>}
        {!listQ.isLoading && items.length === 0 && (
          <p className="text-xs text-muted-foreground">Chưa có vùng nào.</p>
        )}
        {items.map((z) => {
          const c = CLASSES.find((x) => x.id === z.class_id)
          return (
            <div key={z.id} className="flex items-center gap-2 rounded border p-1.5 text-xs">
              <span
                className="inline-block h-3 w-3 shrink-0 rounded"
                style={{ backgroundColor: c?.color }}
              />
              <span className="flex-1 truncate" title={z.name || `Zone ${z.id}`}>
                {z.name || `Zone #${z.id}`} · {classLabel(z.class_id)}
              </span>
              <span className="text-muted-foreground">{formatDate(z.observed_at)}</span>
              <span className="text-muted-foreground tabular-nums">
                {Number(z.area_ha).toLocaleString('vi')} ha
              </span>
              <button
                onClick={() => onDelete(z.id)}
                className="text-red-500 hover:text-red-700"
              >
                <Trash2 size={12} />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── POINTS ────────────────────────────────────────────────────────────────────

function PointsSection() {
  const now = new Date().toISOString().slice(0, 16)
  const [form, setForm] = useState({
    observedAt: now,
    classId: 4,
    lng: '',
    lat: '',
    source: 'field_report',
    reporterName: '',
    notes: '',
  })

  const listQ = useApiQuery(['forest-gt-points'], () =>
    forestClassificationService.listGtPoints({ limit: 100 }),
  )
  const createM = useApiMutation((body: any) =>
    forestClassificationService.createGtPoint(body),
  )
  const deleteM = useApiMutation((id: number) =>
    forestClassificationService.deleteGtPoint(id),
  )
  // OK_LIST server-side wrap: { data: { items: [...] }, metadata: {...} }
  // → apiClient trả nguyên ApiResponse → phải đọc .data.items (không phải .data).
  const items: any[] = listQ.data?.data?.items ?? []

  const onSubmit = () => {
    const lng = Number(form.lng)
    const lat = Number(form.lat)
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
      toast.error('lat/lng không hợp lệ.')
      return
    }
    createM.mutate(
      { ...form, lng, lat },
      {
        onSuccess: () => {
          toast.success('Đã thêm điểm.')
          setForm((s) => ({ ...s, lng: '', lat: '', notes: '', reporterName: '' }))
          listQ.refetch()
        },
        onError: (err: any) => toast.error(err?.message || 'Thất bại'),
      },
    )
  }

  const onDelete = (id: number) => {
    if (!confirm(`Xoá point #${id}?`)) return
    deleteM.mutate(id, {
      onSuccess: () => { toast.success('Đã xoá.'); listQ.refetch() },
    })
  }

  return (
    <div className="space-y-3 rounded-md border p-3">
      <h3 className="text-sm font-semibold">Điểm mẫu</h3>

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
          <span className="text-xs text-muted-foreground">Lng</span>
          <Input
            type="number"
            step="0.000001"
            value={form.lng}
            onChange={(e) => setForm((s) => ({ ...s, lng: e.target.value }))}
            placeholder="108.0"
          />
        </label>
        <label className="space-y-0.5">
          <span className="text-xs text-muted-foreground">Lat</span>
          <Input
            type="number"
            step="0.000001"
            value={form.lat}
            onChange={(e) => setForm((s) => ({ ...s, lat: e.target.value }))}
            placeholder="14.5"
          />
        </label>
        <label className="col-span-2 space-y-0.5">
          <span className="text-xs text-muted-foreground">Class</span>
          <select
            value={form.classId}
            onChange={(e) => setForm((s) => ({ ...s, classId: Number(e.target.value) }))}
            className="h-9 w-full rounded-md border bg-background px-2 text-sm"
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
            className="h-9 w-full rounded-md border bg-background px-2 text-sm"
          >
            <option value="field_report">Field report</option>
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

      <Button onClick={onSubmit} disabled={createM.isPending} size="sm" className="w-full">
        <Upload className="mr-1 h-3.5 w-3.5" />
        {createM.isPending ? 'Đang gửi...' : 'Thêm điểm mẫu'}
      </Button>

      <div className="max-h-64 space-y-1 overflow-auto border-t pt-2">
        {listQ.isLoading && <p className="text-xs text-muted-foreground">Đang tải...</p>}
        {!listQ.isLoading && items.length === 0 && (
          <p className="text-xs text-muted-foreground">Chưa có điểm nào.</p>
        )}
        {items.map((p) => {
          const c = CLASSES.find((x) => x.id === p.class_id)
          return (
            <div key={p.id} className="flex items-center gap-2 rounded border p-1.5 text-xs">
              <span
                className="inline-block h-3 w-3 shrink-0 rounded"
                style={{ backgroundColor: c?.color }}
              />
              <span className="font-mono tabular-nums">
                {Number(p.lng).toFixed(3)}, {Number(p.lat).toFixed(3)}
              </span>
              <span className="flex-1 truncate text-muted-foreground">
                {classLabel(p.class_id)} · {formatDate(p.observed_at)}
              </span>
              <button
                onClick={() => onDelete(p.id)}
                className="text-red-500 hover:text-red-700"
              >
                <Trash2 size={12} />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
