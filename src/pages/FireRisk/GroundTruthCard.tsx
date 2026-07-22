import { useState } from 'react'
import { toast } from 'react-toastify'
import { ChevronDown, ChevronUp, Upload, Trash2, MapPin, Info } from 'lucide-react'
import { fireRiskService, useApiQuery, useApiMutation } from '@/service'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatDate } from '@/lib/date'

/**
 * Ground Truth card — 2 loại input:
 *   - Zones: GeoJSON MultiPolygon (paste text hoặc upload file)
 *   - Points: Form đơn lẻ + bulk CSV
 *
 * Data lưu vào PostGIS local (fire.fire_gt_*). Cron chạy sáng hôm sau sẽ
 * pick up trong cửa sổ N ngày → blend vào Random Forest (50% weight).
 *
 * Section này collapsible mặc định đóng để không choán chỗ trang chính.
 */
export default function GroundTruthCard() {
  const [open, setOpen] = useState(false)

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
            <MapPin className="h-4 w-4 text-red-600" />
            <h2 className="text-lg font-semibold">Ground truth (nhãn thực địa)</h2>
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] text-red-700">
              Boost accuracy
            </span>
          </div>
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {open && (
          <div className="mt-4 space-y-4">
            <ExplanationBanner />
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

/**
 * Explanation banner: giải thích cho admin cơ chế nhận GT + cách nó dùng.
 * Ngắn gọn, đi thẳng vào tác động — không giải thích thuật toán RF.
 */
function ExplanationBanner() {
  return (
    <div className="rounded-md border border-sky-300 bg-sky-50 p-3 text-xs">
      <div className="mb-1 flex items-center gap-1.5 font-semibold text-sky-900">
        <Info size={12} />
        Cơ chế nhận Ground Truth
      </div>
      <ul className="ml-5 list-disc space-y-1 text-sky-800">
        <li>
          <b>Vùng</b> (GeoJSON MultiPolygon): điểm cháy đã xác nhận qua khảo sát
          field hoặc FIRMS confirmed.
        </li>
        <li>
          <b>Điểm</b>: quan sát đơn lẻ (ranger, citizen report) với lat/lng, ngày
          giờ, mức độ 1-5.
        </li>
        <li>
          GT được cron sáng hôm sau (06:00 VN) tự động blend vào Random Forest
          với trọng số <b>50%</b> (không có GT chỉ blend dataset MODIS/FIRMS
          với trọng số 60%).
        </li>
        <li>
          Cửa sổ mặc định: <b>30 ngày</b> trước ngày phân tích (khớp cửa sổ
          Sentinel-2). Có thể chỉnh env <code>FIRE_RISK_GT_WINDOW_DAYS</code>.
        </li>
        <li>
          Muốn áp dụng ngay: bấm <b>"Chạy lại phân tích"</b> sau khi nhập GT.
        </li>
        <li>
          Xoá là <b>soft delete</b> (`is_active = false`) — không rewrite lịch
          sử snapshot đã dùng GT đó.
        </li>
      </ul>
    </div>
  )
}

// ── ZONES ─────────────────────────────────────────────────────────────────────

function ZonesSection() {
  const [geojsonText, setGeojsonText] = useState('')
  const [severity, setSeverity] = useState(3)
  const [occurredAt, setOccurredAt] = useState(
    new Date().toISOString().slice(0, 16),
  )

  const listQ = useApiQuery(['gt-zones'], () => fireRiskService.listGtZones({ limit: 50 }))
  const bulkM = useApiMutation((fc: any) => fireRiskService.bulkGtZone(fc))
  const deleteM = useApiMutation((id: number) => fireRiskService.deleteGtZone(id))
  // OK_LIST server-side wrap: { data: { items: [...] }, metadata: {...} }
  // → apiClient trả nguyên ApiResponse → phải đọc .data.items (không phải .data).
  const items: any[] = listQ.data?.data?.items ?? []

  const onSubmit = async () => {
    let parsed: any
    try {
      parsed = JSON.parse(geojsonText)
    } catch {
      toast.error('GeoJSON không parse được — kiểm tra syntax.')
      return
    }
    // Nếu chỉ paste 1 Polygon/MultiPolygon → wrap thành FeatureCollection.
    if (parsed.type === 'Polygon' || parsed.type === 'MultiPolygon') {
      parsed = {
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          geometry: parsed,
          properties: { severity, occurredAt },
        }],
      }
    }
    // Nếu Feature đơn → wrap.
    if (parsed.type === 'Feature') {
      parsed = { type: 'FeatureCollection', features: [parsed] }
    }
    if (parsed.type !== 'FeatureCollection') {
      toast.error('Cần Polygon/MultiPolygon/Feature/FeatureCollection.')
      return
    }
    // Set default severity/occurredAt cho features thiếu.
    parsed.features.forEach((f: any) => {
      f.properties = f.properties || {}
      if (!f.properties.severity) f.properties.severity = severity
      if (!f.properties.occurredAt) f.properties.occurredAt = occurredAt
    })

    bulkM.mutate(parsed, {
      onSuccess: (res: any) => {
        toast.success(`Đã thêm ${res?.data?.inserted ?? '?'} vùng cháy.`)
        setGeojsonText('')
        listQ.refetch()
      },
      onError: (err: any) => toast.error(err?.message || 'Upload thất bại'),
    })
  }

  const onDelete = (id: number) => {
    if (!confirm(`Xoá zone #${id}?`)) return
    deleteM.mutate(id, { onSuccess: () => { toast.success('Đã xoá.'); listQ.refetch() } })
  }

  return (
    <div className="space-y-3 rounded-md border p-3">
      <h3 className="text-sm font-semibold">Vùng cháy (GeoJSON)</h3>

      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-0.5">
            <span className="text-xs text-muted-foreground">Ngày giờ mặc định</span>
            <Input
              type="datetime-local"
              value={occurredAt}
              onChange={(e) => setOccurredAt(e.target.value)}
            />
          </label>
          <label className="space-y-0.5">
            <span className="text-xs text-muted-foreground">Mức độ mặc định (C1-C5)</span>
            <select
              value={severity}
              onChange={(e) => setSeverity(Number(e.target.value))}
              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
            >
              {[1, 2, 3, 4, 5].map((s) => <option key={s} value={s}>C{s}</option>)}
            </select>
          </label>
        </div>

        <label className="block space-y-0.5">
          <span className="text-xs text-muted-foreground">
            Paste GeoJSON (Polygon/MultiPolygon/FeatureCollection)
          </span>
          <textarea
            value={geojsonText}
            onChange={(e) => setGeojsonText(e.target.value)}
            placeholder='{"type":"Polygon","coordinates":[[[107.5,14.5],[107.6,14.5],...]]}'
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
          {bulkM.isPending ? 'Đang gửi...' : 'Thêm vùng cháy'}
        </Button>
      </div>

      {/* List */}
      <div className="max-h-64 space-y-1 overflow-auto border-t pt-2">
        {listQ.isLoading && <p className="text-xs text-muted-foreground">Đang tải...</p>}
        {!listQ.isLoading && items.length === 0 && (
          <p className="text-xs text-muted-foreground">Chưa có vùng nào.</p>
        )}
        {items.map((z) => (
          <div key={z.id} className="flex items-center gap-2 rounded border p-1.5 text-xs">
            <span className="flex-1 truncate" title={z.name || `Zone ${z.id}`}>
              {z.name || `Zone #${z.id}`}
            </span>
            <span className="rounded bg-orange-100 px-1 text-orange-700">C{z.severity}</span>
            <span className="text-muted-foreground">
              {formatDate(z.occurred_at)}
            </span>
            <span className="text-muted-foreground tabular-nums">
              {Number(z.area_ha).toLocaleString('vi')} ha
            </span>
            <button
              onClick={() => onDelete(z.id)}
              className="text-red-500 hover:text-red-700"
              title="Xoá"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── POINTS ────────────────────────────────────────────────────────────────────

function PointsSection() {
  const now = new Date().toISOString().slice(0, 16)
  const [form, setForm] = useState({
    occurredAt: now,
    severity: 3,
    lng: '',
    lat: '',
    source: 'field_report',
    reporterName: '',
    notes: '',
  })

  const listQ = useApiQuery(['gt-points'], () => fireRiskService.listGtPoints({ limit: 100 }))
  const createM = useApiMutation((body: any) => fireRiskService.createGtPoint(body))
  const deleteM = useApiMutation((id: number) => fireRiskService.deleteGtPoint(id))
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
    deleteM.mutate(id, { onSuccess: () => { toast.success('Đã xoá.'); listQ.refetch() } })
  }

  return (
    <div className="space-y-3 rounded-md border p-3">
      <h3 className="text-sm font-semibold">Điểm quan sát</h3>

      <div className="grid grid-cols-2 gap-2">
        <label className="col-span-2 space-y-0.5">
          <span className="text-xs text-muted-foreground">Ngày giờ</span>
          <Input
            type="datetime-local"
            value={form.occurredAt}
            onChange={(e) => setForm((s) => ({ ...s, occurredAt: e.target.value }))}
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
        <label className="space-y-0.5">
          <span className="text-xs text-muted-foreground">Mức C</span>
          <select
            value={form.severity}
            onChange={(e) => setForm((s) => ({ ...s, severity: Number(e.target.value) }))}
            className="h-9 w-full rounded-md border bg-background px-2 text-sm"
          >
            {[1, 2, 3, 4, 5].map((s) => <option key={s} value={s}>C{s}</option>)}
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
            <option value="firms">FIRMS</option>
            <option value="citizen">Người dân</option>
            <option value="other">Khác</option>
          </select>
        </label>
        <label className="col-span-2 space-y-0.5">
          <span className="text-xs text-muted-foreground">Người báo cáo (tùy chọn)</span>
          <Input
            value={form.reporterName}
            onChange={(e) => setForm((s) => ({ ...s, reporterName: e.target.value }))}
          />
        </label>
      </div>

      <Button onClick={onSubmit} disabled={createM.isPending} size="sm" className="w-full">
        <Upload className="mr-1 h-3.5 w-3.5" />
        {createM.isPending ? 'Đang gửi...' : 'Thêm điểm'}
      </Button>

      {/* List */}
      <div className="max-h-64 space-y-1 overflow-auto border-t pt-2">
        {listQ.isLoading && <p className="text-xs text-muted-foreground">Đang tải...</p>}
        {!listQ.isLoading && items.length === 0 && (
          <p className="text-xs text-muted-foreground">Chưa có điểm nào.</p>
        )}
        {items.map((p) => (
          <div key={p.id} className="flex items-center gap-2 rounded border p-1.5 text-xs">
            <span className="font-mono tabular-nums">
              {Number(p.lng).toFixed(3)}, {Number(p.lat).toFixed(3)}
            </span>
            <span className="rounded bg-orange-100 px-1 text-orange-700">C{p.severity}</span>
            <span className="flex-1 text-muted-foreground">
              {formatDate(p.occurred_at)} · {p.source}
            </span>
            <button
              onClick={() => onDelete(p.id)}
              className="text-red-500 hover:text-red-700"
              title="Xoá"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
