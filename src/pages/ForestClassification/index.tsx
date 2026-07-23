import type * as React from 'react'
import { Fragment, useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import { useQueryClient } from '@tanstack/react-query'
import {
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  FileJson,
  Image as ImageIcon,
  Layers,
  TreePine,
} from 'lucide-react'
import { forestClassificationService, useApiQuery, useApiMutation } from '@/service'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import { formatDateTime } from '@/lib/date'
import type {
  ForestClassSnapshot,
  ForestClassDistrictArea,
  ForestClassDistrictClassArea,
  ForestClassHistoryItem,
} from '@/types/api'
import ForestMap from '@/components/features/ForestMap'
import LoadingInline from '@/components/common/LoadingInline'
import { PaginationCustom } from '@/components/features/PaginationCustom'
import ForestGroundTruthCard from './ForestGroundTruthCard'

/**
 * Phân loại rừng — admin (mirror pattern FireRisk).
 *
 * Cấu trúc UI:
 *   - Header: title + KPI mini (period, status) + nút "Chạy lại phân tích"
 *   - Ground truth card (collapsible, dùng chung với client GT)
 *   - Config status banner (GeoServer WMS / GEE tile / raw)
 *   - KPI cards: Tổng diện tích, Rừng, OOB accuracy, Kappa
 *   - Class distribution bar (11 lớp stacked ha + % legend)
 *   - Forest map (WMS + legend)
 *   - Class-level table (per-class area, có so sánh với snapshot trước)
 *   - Lịch sử (paginated) + SnapshotDetailPanel expand
 *
 * NOTE quan trọng — API forest trả `province_summary.byClass` là dict
 * `{ classId: haNumber }`, không phải `riskLevelDist` như fire-risk. Layout
 * tương tự nhưng transform khác. Class ID 0 = "Đất khác" (không phải rừng).
 * FOREST_CLASS_IDS = [1, 3, 4, 5, 6, 7, 8] — tính tổng rừng.
 */

// Palette 11-class — trùng với server/src/configs/forest-classification.js
const CLASS_META: Record<number, { color: string; name: string }> = {
  0: { color: '#FFBEE8', name: 'Đất khác' },
  1: { color: '#FFEBB0', name: 'Cây công nghiệp' },
  2: { color: '#F0E442', name: 'Đất nông nghiệp' },
  3: { color: '#FEFF73', name: 'Rừng hỗn giao lá rộng, lá kim' },
  4: { color: '#AAFF03', name: 'Rừng lá rộng thường xanh' },
  5: { color: '#D0FF73', name: 'Rừng lá kim' },
  6: { color: '#E7E600', name: 'Rừng lá rộng rụng lá' },
  7: { color: '#4DE600', name: 'Rừng tre nứa' },
  8: { color: '#FFAA01', name: 'Rừng trồng' },
  9: { color: '#73B2FF', name: 'Sông, suối, hồ' },
  10: { color: '#55FF00', name: 'Trảng cỏ, cây bụi' },
}

// Rừng thực sự = class 1, 3-8. Cùng với server FOREST_CLASS_IDS.
const FOREST_CLASS_IDS = [1, 3, 4, 5, 6, 7, 8]

const formatHa = (v?: number | null) => {
  if (v == null || !Number.isFinite(v)) return '—'
  return `${Math.round(v).toLocaleString('vi')} ha`
}
const formatHaShort = (v?: number | null) => {
  if (v == null || !Number.isFinite(v)) return '—'
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(1)}k`
  return Math.round(v).toLocaleString('vi')
}
const formatPct = (v?: number | null, decimals = 1) => {
  if (v == null || !Number.isFinite(v)) return '—'
  return `${v.toFixed(decimals)}%`
}
const formatPeriod = (year: number, month: number) => `${year}-${String(month).padStart(2, '0')}`
const MIN_ANALYSIS_YEAR = 1984
const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1)

/**
 * Chọn raster tile URL cho map. Ưu tiên:
 *   1. WMS GeoServer khi có `geoserverLayer` + env VITE_GEOSERVER_URL
 *   2. Fallback GEE tile URL
 *   3. null
 * Xử lý env VITE_GEOSERVER_URL cả 3 dạng (`/geoserver`, `/geoserver/kontum`,
 * `/geoserver/kontum/wms`) — mirror fire-risk resolveRasterTileUrl.
 */
function resolveRasterTileUrl(snapshot: ForestClassSnapshot | null | undefined): string | null {
  if (!snapshot) return null
  const layer = snapshot.geoserverLayer ?? (snapshot as any).geoserver_layer ?? null
  const geoserverBase = (import.meta.env.VITE_GEOSERVER_URL as string | undefined)
    ?.trim()
    .replace(/\/$/, '')
  if (layer && geoserverBase) {
    const [workspace, layerName] = String(layer).includes(':')
      ? String(layer).split(':')
      : [(import.meta.env as any).VITE_GEOSERVER_WORKSPACE || 'kontum', String(layer)]
    const params = new URLSearchParams({
      service: 'WMS',
      version: '1.3.0',
      request: 'GetMap',
      layers: `${workspace}:${layerName}`,
      styles: '',
      width: '256',
      height: '256',
      crs: 'EPSG:3857',
      format: 'image/png',
      transparent: 'true',
      tiled: 'true',
    })
    const lower = geoserverBase.toLowerCase()
    let endpoint: string
    if (lower.endsWith('/wms')) endpoint = geoserverBase
    else if (lower.endsWith(`/${workspace.toLowerCase()}`)) endpoint = `${geoserverBase}/wms`
    else endpoint = `${geoserverBase}/${workspace}/wms`
    return `${endpoint}?${params.toString()}&bbox={bbox-epsg-3857}`
  }
  const geeTile = snapshot.geeTileUrl ?? (snapshot as any).gee_tile_url ?? null
  return geeTile || null
}

/**
 * Build URL preview OpenLayers sinh sẵn — click từ list history mở tab
 * GeoServer preview.
 */
function buildGeoserverPreviewUrl(layerFqn: string): string {
  const raw = (import.meta.env.VITE_GEOSERVER_URL as string | undefined) || ''
  const [workspace, layerName] = String(layerFqn).includes(':')
    ? String(layerFqn).split(':')
    : [(import.meta.env as any).VITE_GEOSERVER_WORKSPACE || 'kontum', String(layerFqn)]
  const root = raw
    .replace(/\/+$/, '')
    .replace(new RegExp(`/${workspace}/wms$`, 'i'), '')
    .replace(/\/wms$/i, '')
  const bbox = '107.35,13.83,108.87,15.55'
  const qs = new URLSearchParams({
    service: 'WMS',
    version: '1.1.0',
    request: 'GetMap',
    layers: `${workspace}:${layerName}`,
    bbox,
    width: '768',
    height: '768',
    srs: 'EPSG:4326',
    styles: '',
    format: 'application/openlayers',
  })
  return `${root}/${workspace}/wms?${qs.toString()}`
}

// ── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status?: string }) {
  const s = String(status || '').toLowerCase()
  const map: Record<string, { label: string; className: string }> = {
    completed: {
      label: 'completed',
      className: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    },
    published: {
      label: 'published',
      className: 'bg-emerald-200 text-emerald-900 border-emerald-400',
    },
    computing: { label: 'computing', className: 'bg-sky-100 text-sky-800 border-sky-300' },
    exporting: { label: 'exporting', className: 'bg-sky-100 text-sky-800 border-sky-300' },
    pending: { label: 'pending', className: 'bg-slate-100 text-slate-800 border-slate-300' },
    failed: { label: 'failed', className: 'bg-red-100 text-red-800 border-red-300' },
  }
  const meta = map[s] || {
    label: status || '—',
    className: 'bg-slate-100 text-slate-700 border-slate-300',
  }
  return (
    <Badge variant="outline" className={`text-[10px] ${meta.className}`}>
      {meta.label}
    </Badge>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
export default function ForestClassificationPage() {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1
  const [page, setPage] = useState(1)
  const [refreshDialogOpen, setRefreshDialogOpen] = useState(false)
  const [analysisYear, setAnalysisYear] = useState(currentYear)
  const [analysisMonth, setAnalysisMonth] = useState(currentMonth)
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null)
  const [heatVisible, setHeatVisible] = useState(true)
  const [heatOpacity, setHeatOpacity] = useState(0.75)

  const latestQuery = useApiQuery(['forest-class-latest'], () =>
    forestClassificationService.getLatest()
  )
  const historyQuery = useApiQuery(['forest-class-history', page], () =>
    forestClassificationService.getHistory({ page, limit: 10 })
  )
  const refreshMutation = useApiMutation((body: any) => forestClassificationService.refresh(body))

  const latest = latestQuery.data?.data
  const snapshot = (latest?.snapshot || null) as ForestClassSnapshot | null
  const districtAreas = (latest?.districtAreas || []) as ForestClassDistrictArea[]
  const history = (historyQuery.data?.data?.items ?? []) as ForestClassHistoryItem[]
  const historyMetadata = historyQuery.data?.metadata
  const historyTotal = Number(historyMetadata?.total) || 0
  const historyTotalPages = Number(historyMetadata?.totalPages) || 0
  const analysisYears = Array.from(
    { length: currentYear - MIN_ANALYSIS_YEAR + 1 },
    (_, index) => currentYear - index
  )

  const rasterTileUrl = resolveRasterTileUrl(snapshot)
  const legend = Object.entries(CLASS_META).map(([id, meta]) => ({
    classId: Number(id),
    name: meta.name,
    color: meta.color,
  }))

  const isRefreshing = refreshMutation.isPending
  const isLoading = latestQuery.isLoading

  // Class breakdown từ province_summary.byClass — used for KPI + bar + table.
  const byClass = snapshot?.provinceSummary?.byClass || {}
  const totalHa = Number(snapshot?.provinceSummary?.totalHa) || 0
  const forestHa = FOREST_CLASS_IDS.reduce((sum, id) => sum + (Number(byClass[String(id)]) || 0), 0)
  const forestPct = totalHa > 0 ? (forestHa / totalHa) * 100 : 0

  const onConfirmRefresh = () => {
    refreshMutation.mutate(
      { year: analysisYear, month: analysisMonth },
      {
        onSuccess: () => {
          toast.success(
            `Đã chạy phân loại kỳ ${formatPeriod(analysisYear, analysisMonth)}. Kết quả sau ~3-5 phút.`
          )
          setRefreshDialogOpen(false)
          setPage(1)
          setTimeout(() => {
            latestQuery.refetch()
            historyQuery.refetch()
          }, 2000)
        },
        onError: (err: any) => {
          const msg = err?.response?.data?.message || err?.message || 'Chạy phân loại thất bại'
          toast.error(msg)
        },
      }
    )
  }

  return (
    // Layout admin (`mainLayout.tsx`) là `h-screen overflow-hidden` — mỗi
    // page tự tạo scroll container. `flex-1 overflow-y-auto` expand full
    // height của <main> + cho phép cuộn nội dung. Mirror pattern fire-risk.
    <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:space-y-6 sm:p-6">
      {/* ── Header ───────────────────────────────────── */}
      <div className="flex flex-col items-start gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <TreePine className="h-6 w-6 text-emerald-600" />
            Phân loại lớp phủ rừng
          </h1>
          <p className="text-muted-foreground text-sm">
            Random Forest 11 lớp, chạy 45 ngày/lần. Có thể chọn lại các kỳ dữ liệu trong quá khứ.
          </p>
          {snapshot && (
            <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
              <span>
                Kỳ dữ liệu:{' '}
                <span className="font-mono">{formatPeriod(snapshot.year, snapshot.month)}</span>
              </span>
              <StatusBadge status={snapshot.status} />
              {snapshot.geoserverLayer ? (
                <span className="text-emerald-600">GeoServer ✓ (persistent)</span>
              ) : snapshot.geeTileUrl ? (
                <span className="text-amber-600">GEE tile (TTL ~24h)</span>
              ) : (
                <span className="text-slate-500">Chưa có raster</span>
              )}
            </div>
          )}
        </div>
        <Button
          className="w-full md:w-auto md:shrink-0"
          onClick={() => setRefreshDialogOpen(true)}
          disabled={isRefreshing}
        >
          {isRefreshing ? 'Đang chạy (~3-5 phút)...' : 'Chạy lại phân tích'}
        </Button>
      </div>

      {/* ── Dialog xác nhận ───────────────────────────── */}
      <AlertDialog
        open={refreshDialogOpen}
        onOpenChange={(open) => {
          if (isRefreshing) return
          setRefreshDialogOpen(open)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isRefreshing ? 'Đang chạy phân loại...' : 'Chạy lại phân loại?'}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                {isRefreshing ? (
                  <>
                    <p>Server đang gọi Google Earth Engine để phân loại 11 lớp. Mất ~3-5 phút.</p>
                    <p className="flex items-center gap-2 text-sky-700">
                      <LoadingInline size="small" />
                      <span>Đang xử lý — không tắt tab.</span>
                    </p>
                  </>
                ) : (
                  <>
                    <p>
                      Chọn kỳ dữ liệu cần chạy Random Forest. Chạy lại cùng một kỳ sẽ cập nhật
                      snapshot của kỳ đó.
                    </p>
                    <div className="grid grid-cols-2 gap-3 py-2">
                      <label className="space-y-1 text-xs font-medium">
                        <span>Năm</span>
                        <Select
                          value={String(analysisYear)}
                          onValueChange={(value) => {
                            const nextYear = Number(value)
                            setAnalysisYear(nextYear)
                            if (nextYear === currentYear && analysisMonth > currentMonth) {
                              setAnalysisMonth(currentMonth)
                            }
                          }}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {analysisYears.map((year) => (
                              <SelectItem key={year} value={String(year)}>
                                {year}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </label>
                      <label className="space-y-1 text-xs font-medium">
                        <span>Tháng</span>
                        <Select
                          value={String(analysisMonth)}
                          onValueChange={(value) => setAnalysisMonth(Number(value))}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {MONTHS.map((month) => (
                              <SelectItem
                                key={month}
                                value={String(month)}
                                disabled={analysisYear === currentYear && month > currentMonth}
                              >
                                Tháng {String(month).padStart(2, '0')}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </label>
                    </div>
                    <p>
                      Bạn có thể tiếp tục làm việc khác — kết quả tự động hiện lên khi xong.
                      Auto-ingest raster vào MinIO/GeoServer chạy song song sau khi analysis
                      complete.
                    </p>
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRefreshing}>Huỷ</AlertDialogCancel>
            <AlertDialogAction onClick={onConfirmRefresh} disabled={isRefreshing}>
              {isRefreshing
                ? 'Đang chạy...'
                : `Chạy kỳ ${formatPeriod(analysisYear, analysisMonth)}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Ground truth (collapsible) ─────────────── */}
      <ForestGroundTruthCard />

      {/* ── Overview ─────────────────────────────────── */}
      <Card>
        <CardContent className="space-y-4 p-4 sm:p-6">
          {snapshot && <ConfigStatusBanner snapshot={snapshot} />}

          {isLoading ? (
            <p className="text-muted-foreground text-sm">Đang tải dữ liệu snapshot...</p>
          ) : !snapshot ? (
            <p className="text-sm text-amber-700">
              Chưa có snapshot nào. Bấm "Chạy lại phân tích" để tạo lần đầu.
            </p>
          ) : (
            <>
              {/* KPI — 2 thẻ diện tích + 2 thẻ accuracy (chỉ render khi có
                  giá trị). Với `skipStats: true` ở pipeline mới, OOB/Kappa
                  luôn null → 2 thẻ đó tự động ẩn, grid rút xuống 2 cột. */}
              {(() => {
                const hasOob = snapshot.oobAccuracy != null
                const hasKappa = snapshot.testKappa != null
                const nCards = 2 + (hasOob ? 1 : 0) + (hasKappa ? 1 : 0)
                const grid =
                  nCards >= 4
                    ? 'sm:grid-cols-2 lg:grid-cols-4'
                    : nCards === 3
                      ? 'sm:grid-cols-3'
                      : 'sm:grid-cols-2'
                return (
                  <div className={`grid gap-4 ${grid}`}>
                    <Stat
                      label="Tổng diện tích"
                      hint="Σ theo tất cả 11 lớp"
                      value={formatHa(totalHa)}
                    />
                    <Stat
                      label="Diện tích rừng"
                      hint="Σ class 1, 3-8 (rừng thực + trồng)"
                      value={formatHa(forestHa)}
                      sub={`${formatPct(forestPct)} tổng`}
                      tone="success"
                    />
                    {hasOob && (
                      <Stat
                        label="OOB accuracy"
                        hint="Out-of-bag accuracy của Random Forest"
                        value={formatPct(snapshot.oobAccuracy)}
                      />
                    )}
                    {hasKappa && (
                      <Stat
                        label="Kappa"
                        hint="Test set κ (0-1); >0.6 là tốt cho 11 class"
                        value={snapshot.testKappa!.toFixed(3)}
                      />
                    )}
                  </div>
                )
              })()}

              {/* Class distribution bar — collapsible, mở mặc định vì đây là
                  chỉ số quan trọng nhất (breakdown 11 lớp toàn tỉnh). */}
              <CollapsibleSection
                title="Phân bố diện tích 11 lớp"
                hint={`Tổng ${formatHa(totalHa)} · Rừng ${formatHa(forestHa)} (${formatPct(forestPct)})`}
                defaultOpen
              >
                <ClassDistributionBar byClass={byClass} totalHa={totalHa} />
              </CollapsibleSection>

              {/* Map + layer control */}
              <div className="grid gap-4 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <ForestMap
                    rasterTileUrl={rasterTileUrl}
                    legend={legend}
                    opacity={heatOpacity}
                    visible={heatVisible}
                    heightClassName="h-[420px]"
                  />
                </div>
                <div className="space-y-3">
                  <LayerManager
                    heatVisible={heatVisible}
                    heatOpacity={heatOpacity}
                    onHeatVisibleChange={setHeatVisible}
                    onHeatOpacityChange={setHeatOpacity}
                    geoserverLayer={snapshot.geoserverLayer}
                    downloadUrl={
                      (snapshot as any).geoserverDownloadUrl || snapshot.geeDownloadUrl || null
                    }
                    downloadFilename={
                      (snapshot as any).downloadFilename ||
                      `forest_class_kontum_${snapshot.year}${String(snapshot.month).padStart(2, '0')}.tif`
                    }
                  />
                </div>
              </div>

              {/* Bảng chi tiết 11 lớp — collapsible, mặc định đóng vì đã có
                  ClassDistributionBar summary ở trên. User mở khi cần số cụ thể. */}
              <CollapsibleSection
                title="Bảng chi tiết 11 lớp phủ"
                hint="Diện tích (ha) + % tổng cho từng lớp"
              >
                <ClassAreaTable byClass={byClass} />
              </CollapsibleSection>

              {/* Phân bố theo huyện — collapsible, mặc định đóng vì bảng dài
                  (9 huyện Kon Tum × class columns) và không phải use case chính. */}
              {districtAreas.length > 0 && (
                <CollapsibleSection
                  title="Phân bố theo huyện"
                  hint={`${districtAreas.length} huyện · dominant class + forest %`}
                >
                  <DistrictAreaTable rows={districtAreas} />
                </CollapsibleSection>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* ── History ──────────────────────────────────── */}
      <Card>
        <CardContent className="p-4 sm:p-6">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Lịch sử chạy phân loại</h2>
              <p className="text-muted-foreground text-xs">Click hàng để xem chi tiết snapshot.</p>
            </div>
          </div>
          {/* History table — max-h giới hạn để không đẩy pagination xa khỏi
              tầm nhìn khi expand nhiều row detail. Scroll cả 2 chiều. */}
          <div className="max-h-[70vh] overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead>#</TableHead>
                  <TableHead>Kỳ</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Trigger</TableHead>
                  <TableHead className="text-right">OOB</TableHead>
                  <TableHead className="text-right">Tổng ha</TableHead>
                  <TableHead className="text-right">Rừng ha</TableHead>
                  <TableHead>Raster</TableHead>
                  <TableHead>Tính lúc</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((h) => {
                  const key = String(h.id)
                  const isExpanded = expandedHistoryId === key
                  const summary = h.province_summary || {}
                  const hbc: Record<string, number> = summary.byClass || {}
                  const hTotal = Number(summary.totalHa) || 0
                  const hForest = FOREST_CLASS_IDS.reduce(
                    (sum, id) => sum + (Number(hbc[String(id)]) || 0),
                    0
                  )
                  const rasterKind = h.geoserver_layer
                    ? 'GeoServer'
                    : h.gee_tile_url
                      ? 'GEE tile'
                      : '—'
                  return (
                    <Fragment key={key}>
                      <TableRow
                        className="hover:bg-muted/40 cursor-pointer"
                        onClick={() => setExpandedHistoryId((cur) => (cur === key ? null : key))}
                      >
                        <TableCell>
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{h.id}</TableCell>
                        <TableCell className="font-mono">{formatPeriod(h.year, h.month)}</TableCell>
                        <TableCell>
                          <StatusBadge status={h.status} />
                        </TableCell>
                        <TableCell className="text-xs">{h.trigger || 'cron'}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {h.oob_accuracy != null ? `${h.oob_accuracy}%` : '—'}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatHaShort(hTotal)}
                        </TableCell>
                        <TableCell className="text-right text-emerald-700 tabular-nums">
                          {formatHaShort(hForest)}
                        </TableCell>
                        <TableCell className="text-xs">
                          {rasterKind === 'GeoServer' ? (
                            <span className="text-emerald-600">GeoServer ✓</span>
                          ) : rasterKind === 'GEE tile' ? (
                            <span className="text-amber-600">GEE tile</span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          {h.computed_at ? formatDateTime(h.computed_at) : '—'}
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow className="bg-muted/20">
                          <TableCell colSpan={10}>
                            <SnapshotDetailPanel item={h} />
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  )
                })}
                {!history.length && (
                  <TableRow>
                    <TableCell colSpan={10} className="text-muted-foreground text-center">
                      Chưa có bản ghi lịch sử.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <div className="mt-3 flex flex-col items-center justify-between gap-3 sm:flex-row">
            <span className="text-muted-foreground text-xs">
              Tổng {historyTotal.toLocaleString('vi')} bản ghi
            </span>
            <PaginationCustom
              currentPage={page}
              totalPages={historyTotalPages}
              onPageChange={(nextPage) => {
                setExpandedHistoryId(null)
                setPage(nextPage)
              }}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ── Small components ─────────────────────────────────────────────────────────

function Stat({
  label,
  hint,
  value,
  sub,
  tone,
}: {
  label: string
  hint?: string
  value: React.ReactNode
  sub?: string
  tone?: 'success' | 'warning' | 'danger' | 'default'
}) {
  const toneClass =
    tone === 'success'
      ? 'text-emerald-700'
      : tone === 'warning'
        ? 'text-amber-700'
        : tone === 'danger'
          ? 'text-red-700'
          : ''
  return (
    <div className="rounded-md border p-3">
      <p className="text-muted-foreground text-xs" title={hint}>
        {label}
      </p>
      <p className={`mt-1 text-xl font-bold tabular-nums ${toneClass}`}>{value}</p>
      {sub && <p className="text-muted-foreground mt-0.5 text-[11px]">{sub}</p>}
    </div>
  )
}

/**
 * Section header với collapse toggle — dùng cho các bảng dài (11-class, huyện)
 * để card không phình khi user chưa quan tâm. Icon chevron ở phải, tương phản
 * subtle bg khi expanded để phân biệt với nội dung khác.
 *
 * `hint` (optional): line ngắn dưới title giải thích section (VD "9 huyện").
 * `defaultOpen`: điều khiển state ban đầu; VD ClassDist thường luôn mở.
 */
function CollapsibleSection({
  title,
  hint,
  defaultOpen = false,
  children,
}: {
  title: React.ReactNode
  hint?: React.ReactNode
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="bg-card overflow-hidden rounded-md border">
      <Button
        type="button"
        variant="ghost"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`flex h-auto w-full items-center justify-between rounded-none px-3 py-2 text-left font-normal transition-colors ${
          open ? 'bg-primary/10 hover:bg-primary/15' : 'hover:bg-muted/50'
        }`}
      >
        <div className="flex min-w-0 flex-col">
          <span className="text-sm font-semibold">{title}</span>
          {hint && <span className="text-muted-foreground text-[11px] font-normal">{hint}</span>}
        </div>
        {open ? (
          <ChevronUp size={16} className="text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown size={16} className="text-muted-foreground shrink-0" />
        )}
      </Button>
      {open && <div className="border-t p-3">{children}</div>}
    </div>
  )
}

/**
 * Banner giải thích snapshot đang dùng nguồn raster nào.
 */
function ConfigStatusBanner({ snapshot }: { snapshot: ForestClassSnapshot }) {
  if (snapshot.geoserverLayer) {
    return (
      <div className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
        <b>Raster:</b> GeoServer WMS ✓ (persistent) —{' '}
        <span className="font-mono">{snapshot.geoserverLayer}</span>
      </div>
    )
  }
  if (snapshot.geeTileUrl) {
    const ageMs = snapshot.geeTileGeneratedAt
      ? Date.now() - new Date(snapshot.geeTileGeneratedAt).getTime()
      : 0
    const ageHours = ageMs / 3_600_000
    const stale = ageHours >= 24
    if (stale) {
      return (
        <div className="rounded-md border border-red-400 bg-red-50 px-3 py-2 text-xs text-red-800">
          <b>⚠ Raster GEE có thể đã hết hạn</b> — tile URL sinh {ageHours.toFixed(1)}h trước (TTL
          24h). Bấm <b>"Chạy lại phân tích"</b> để tạo URL mới, hoặc dùng snapshot cũ đã publish
          GeoServer.
        </div>
      )
    }
    return (
      <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
        <b>Raster:</b> Earth Engine (TTL ~24h, còn ~{Math.max(0, 24 - ageHours).toFixed(1)}h).
        Auto-ingest raster vào MinIO/GeoServer sẽ sinh layer WMS persistent sau vài phút.
      </div>
    )
  }
  return (
    <div className="rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-700">
      <b>Chưa có raster.</b> Snapshot chưa completed hoặc getDownloadURL timeout.
    </div>
  )
}

/**
 * Stacked bar 11 lớp — width theo % ha class trong total. Palette trùng
 * raster preview để user liên kết dễ.
 */
function ClassDistributionBar({
  byClass,
  totalHa,
}: {
  byClass: Record<string, number>
  totalHa: number
}) {
  if (totalHa <= 0) return null
  const items = Object.entries(CLASS_META)
    .map(([id, meta]) => {
      const ha = Number(byClass[id]) || 0
      return {
        classId: Number(id),
        name: meta.name,
        color: meta.color,
        ha,
        pct: (ha / totalHa) * 100,
      }
    })
    .filter((c) => c.ha > 0)
    .sort((a, b) => b.ha - a.ha)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground font-semibold">Phân bố diện tích 11 lớp</span>
        <span className="text-muted-foreground">
          Tổng: <span className="font-medium tabular-nums">{formatHa(totalHa)}</span>
        </span>
      </div>
      <div className="flex h-6 w-full overflow-hidden rounded-md border">
        {items.map((c) => (
          <div
            key={c.classId}
            style={{ width: `${c.pct}%`, backgroundColor: c.color }}
            title={`${c.name}: ${formatHa(c.ha)} (${formatPct(c.pct)})`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5 text-[11px]">
        {items.map((c) => (
          <span
            key={c.classId}
            className="inline-flex items-center gap-1.5 rounded-md border px-1.5 py-0.5"
            title={`${c.name}: ${formatHa(c.ha)}`}
          >
            <span
              className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm border"
              style={{ backgroundColor: c.color }}
            />
            <span className="max-w-35 truncate">{c.name}</span>
            <span className="text-muted-foreground tabular-nums">
              {formatHaShort(c.ha)} ({formatPct(c.pct, 1)})
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}

/**
 * Table 11 lớp — hiển thị tên, diện tích, % vs tổng, cờ "rừng thực".
 */
function ClassAreaTable({ byClass }: { byClass: Record<string, number> }) {
  const totalHa = Object.values(byClass).reduce((s, v) => s + (Number(v) || 0), 0)
  const rows = Object.entries(CLASS_META).map(([id, meta]) => {
    const ha = Number(byClass[id]) || 0
    return {
      classId: Number(id),
      name: meta.name,
      color: meta.color,
      ha,
      pct: totalHa > 0 ? (ha / totalHa) * 100 : 0,
      isForest: FOREST_CLASS_IDS.includes(Number(id)),
    }
  })

  return (
    <div className="max-h-96 overflow-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8">#</TableHead>
            <TableHead>Lớp phủ</TableHead>
            <TableHead className="text-right">Diện tích (ha)</TableHead>
            <TableHead className="text-right">% tổng</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.classId}>
              <TableCell className="font-mono text-xs">{r.classId}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block h-3 w-3 shrink-0 rounded-sm border"
                    style={{ backgroundColor: r.color }}
                  />
                  <span>{r.name}</span>
                </div>
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatHa(r.ha)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatPct(r.pct, 2)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

/**
 * District table — mỗi row là 1 huyện. Server đã group sẵn: mỗi item có
 * `districtCode`, `districtName`, `classes[]` (per-class areas). Client
 * chỉ cần iterate + tính totalHa, forestHa, dominant class.
 *
 * (Trước đây group by district_code + flat rows — sai vì API nested sẵn.)
 */
function DistrictAreaTable({ rows }: { rows: ForestClassDistrictArea[] }) {
  // Compute derived stats per row + sort desc theo totalHa.
  const list = rows
    .map((r) => {
      const classes = Array.isArray(r.classes) ? r.classes : []
      let totalHa = 0
      let forestHa = 0
      let dominant: ForestClassDistrictClassArea | null = null
      for (const c of classes) {
        const ha = Number(c.areaHa) || 0
        totalHa += ha
        if (FOREST_CLASS_IDS.includes(c.classId)) forestHa += ha
        if (!dominant || ha > (Number(dominant.areaHa) || 0)) dominant = c
      }
      const forestPct = totalHa > 0 ? (forestHa / totalHa) * 100 : 0
      return {
        code: r.districtCode || '(unknown)',
        name: r.districtName || r.districtCode || '(unknown)',
        totalHa,
        forestHa,
        forestPct,
        dominant,
      }
    })
    .sort((a, b) => b.totalHa - a.totalHa)

  if (!list.length) return null

  return (
    <div className="max-h-96 overflow-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Huyện</TableHead>
            <TableHead className="text-right">Tổng ha</TableHead>
            <TableHead className="text-right">Rừng ha</TableHead>
            <TableHead className="text-right">Rừng %</TableHead>
            <TableHead>Class dominant</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.map((g) => {
            const dom = g.dominant != null ? CLASS_META[g.dominant.classId] : null
            return (
              <TableRow key={g.code}>
                <TableCell className="font-medium">{g.name}</TableCell>
                <TableCell className="text-right tabular-nums">{formatHa(g.totalHa)}</TableCell>
                <TableCell className="text-right text-emerald-700 tabular-nums">
                  {formatHa(g.forestHa)}
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatPct(g.forestPct)}</TableCell>
                <TableCell>
                  {dom ? (
                    <span className="inline-flex items-center gap-1.5 text-xs">
                      <span
                        className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm border"
                        style={{ backgroundColor: dom.color }}
                      />
                      {dom.name}
                    </span>
                  ) : (
                    '—'
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

/**
 * Layer manager tối giản — Chỉ có "Bản đồ nhiệt" (raster 11 lớp) với
 * visibility + opacity + download. Không có district vector layer riêng.
 */
function LayerManager({
  heatVisible,
  heatOpacity,
  onHeatVisibleChange,
  onHeatOpacityChange,
  geoserverLayer,
  downloadUrl,
  downloadFilename,
}: {
  heatVisible: boolean
  heatOpacity: number
  onHeatVisibleChange: (v: boolean) => void
  onHeatOpacityChange: (v: number) => void
  geoserverLayer: string | null | undefined
  downloadUrl: string | null | undefined
  downloadFilename: string
}) {
  const [open, setOpen] = useState(true)

  const downloadRaster = async () => {
    if (!downloadUrl) return
    try {
      const res = await fetch(downloadUrl)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = downloadFilename
      a.click()
      setTimeout(() => URL.revokeObjectURL(objectUrl), 5000)
    } catch (err: any) {
      console.warn('[ForestCls] blob download failed:', err?.message)
      window.open(downloadUrl, '_blank', 'noopener')
    }
  }

  return (
    <div className="bg-card overflow-hidden rounded-md border">
      <Button
        type="button"
        variant="ghost"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`flex h-auto w-full items-center justify-between rounded-none px-3 py-2 text-sm font-normal transition-colors ${
          open ? 'bg-primary/10 hover:bg-primary/15' : 'hover:bg-muted/50'
        }`}
      >
        <div className="flex items-center gap-2">
          <Layers size={16} className="text-primary" />
          <span className="text-sm font-semibold">Quản lý Layer</span>
        </div>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </Button>
      {open && (
        <div className="space-y-3 border-t p-3">
          <div
            className={`rounded-md border p-2 transition-opacity ${heatVisible ? '' : 'opacity-60'}`}
          >
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-orange-500" />
              <span className="min-w-0 flex-1 truncate text-xs font-medium">
                Bản đồ phân loại 11 lớp
              </span>
              {/* Eye toggle — dùng Lucide Eye/EyeOff icon (không phải emoji).
                  variant=ghost khi hidden để user thấy nút disabled state. */}
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => onHeatVisibleChange(!heatVisible)}
                aria-label={heatVisible ? 'Ẩn lớp' : 'Hiển thị lớp'}
                title={heatVisible ? 'Ẩn lớp' : 'Hiển thị lớp'}
              >
                {heatVisible ? (
                  <Eye className="text-primary h-3.5 w-3.5" />
                ) : (
                  <EyeOff className="text-muted-foreground h-3.5 w-3.5" />
                )}
              </Button>
              {downloadUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={downloadRaster}
                  title={`Tải GeoTIFF (${downloadFilename})`}
                  aria-label="Tải GeoTIFF"
                >
                  <ImageIcon className="text-primary h-3.5 w-3.5" />
                </Button>
              )}
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={heatOpacity}
              onChange={(e) => onHeatOpacityChange(Number(e.target.value))}
              className="accent-primary mt-2 block w-full"
              title={`Độ trong suốt: ${Math.round(heatOpacity * 100)}%`}
            />
            <p className="text-muted-foreground mt-1 text-[10px]">
              Nguồn: {geoserverLayer ? 'GeoServer WMS' : 'Earth Engine tile'}
            </p>
          </div>
          {geoserverLayer && (
            <a
              href={buildGeoserverPreviewUrl(geoserverLayer)}
              target="_blank"
              rel="noopener noreferrer"
              className="block truncate rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1.5 font-mono text-[10px] text-emerald-700 hover:bg-emerald-100"
              title="Mở OpenLayers preview trên GeoServer"
            >
              ↗ {geoserverLayer}
            </a>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Panel bung khi user click 1 hàng lịch sử. Hiển thị full snapshot detail:
 * class breakdown + raster info + publish control + raw JSON.
 */
function SnapshotDetailPanel({ item }: { item: ForestClassHistoryItem }) {
  const s = (item.province_summary || {}) as any
  const byClass: Record<string, number> = s.byClass || {}
  const totalHa = Number(s.totalHa) || 0
  const forestHa = FOREST_CLASS_IDS.reduce((sum, id) => sum + (Number(byClass[String(id)]) || 0), 0)

  const [ingestJobId, setIngestJobId] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const queryClient = useQueryClient()
  const hasDownload = Boolean(item.gee_download_url)
  const published = Boolean(item.geoserver_layer)
  const canPublish = hasDownload && !published && !busy

  const startPublish = async () => {
    setBusy(true)
    try {
      const res = await forestClassificationService.publishSnapshotRaster(item.id)
      const data: any = (res as any)?.data?.data ?? (res as any)?.data
      if (data?.alreadyPublished) {
        toast.info('Snapshot đã publish trước đó.')
        setBusy(false)
        return
      }
      if (data?.jobId) {
        setIngestJobId(Number(data.jobId))
        toast.success(`Đã kích hoạt job publish (#${data.jobId}). Đang xử lý...`)
      }
    } catch (err: any) {
      toast.error(err?.message || 'Publish thất bại')
      setBusy(false)
    }
  }

  // Poll job status — dừng khi terminal.
  const jobQuery = useApiQuery(
    ['forest-ingest-job', ingestJobId],
    () => forestClassificationService.getIngestJob(ingestJobId as number),
    {
      enabled: ingestJobId != null,
      refetchInterval: (data: any) => {
        const st = data?.data?.data?.status ?? data?.data?.status
        return st && ['completed', 'failed', 'cancelled'].includes(st) ? false : 5000
      },
      refetchOnWindowFocus: false,
    } as any,
    false
  )
  const job: any = (jobQuery.data as any)?.data
  const terminal = job && ['completed', 'failed', 'cancelled'].includes(job.status)

  // Khi job terminal → invalidate queries + toast.
  useEffect(() => {
    if (!terminal || !busy) return
    setBusy(false)
    if (job.status === 'completed') {
      toast.success(`Publish xong → ${job.geoserver_layer || ''}`)
      queryClient.invalidateQueries({ queryKey: ['forest-class-latest'] })
      queryClient.invalidateQueries({ queryKey: ['forest-class-history'] })
    } else {
      toast.error(`Job ${job.status}: ${job.error_log || ''}`)
    }
  }, [terminal, busy, job?.status, job?.geoserver_layer, job?.error_log, queryClient])

  const dismissJob = () => setIngestJobId(null)

  const facts: Array<{ label: string; value: React.ReactNode; hint?: string }> = [
    { label: 'ID', value: <span className="font-mono">{item.id}</span> },
    {
      label: 'Kỳ dữ liệu',
      value: <span className="font-mono">{formatPeriod(item.year, item.month)}</span>,
    },
    { label: 'Trạng thái', value: <StatusBadge status={item.status} /> },
    { label: 'Trigger', value: item.trigger || 'cron' },
    { label: 'Tính lúc', value: item.computed_at ? formatDateTime(item.computed_at) : '—' },
    { label: 'Publish lúc', value: item.published_at ? formatDateTime(item.published_at) : '—' },
    { label: 'OOB accuracy', value: item.oob_accuracy != null ? `${item.oob_accuracy}%` : '—' },
    {
      label: 'Duration',
      value: item.duration_ms != null ? `${Math.round(item.duration_ms / 1000)}s` : '—',
    },
    { label: 'Tổng ha', value: formatHa(totalHa) },
    { label: 'Rừng ha', value: <span className="text-emerald-700">{formatHa(forestHa)}</span> },
    {
      label: 'GeoServer layer',
      value: item.geoserver_layer ? (
        <a
          href={buildGeoserverPreviewUrl(item.geoserver_layer)}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-emerald-600 underline decoration-dotted hover:decoration-solid"
          title="Mở OpenLayers preview trên GeoServer"
        >
          {item.geoserver_layer} ↗
        </a>
      ) : (
        <span className="text-slate-500">chưa publish</span>
      ),
      hint: 'Layer WMS đã publish. Click để mở preview OpenLayers.',
    },
    {
      label: 'GEE tile URL',
      value: item.gee_tile_url ? (
        <span className="text-amber-600">có (TTL ~24h)</span>
      ) : (
        <span className="text-slate-400">—</span>
      ),
    },
    {
      label: 'Download URL',
      value: item.gee_download_url ? (
        <span className="text-emerald-600">có</span>
      ) : (
        <span className="text-slate-400">—</span>
      ),
      hint: 'GEE getDownloadURL — TTL ~24h. Publish sẽ pull vào MinIO trước hạn.',
    },
    {
      label: 'Lỗi',
      value: item.error_message ? (
        <span className="text-xs text-red-600">{item.error_message}</span>
      ) : (
        <span className="text-slate-400">—</span>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      {/* Publish control */}
      <div className="bg-background/60 flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
        <div className="min-w-0 flex-1 text-xs">
          <p className="font-semibold">Lưu ảnh GeoTIFF & Publish GeoServer</p>
          <p className="text-muted-foreground mt-0.5">
            Ingest ảnh phân loại 11 lớp (RGB viz) từ GEE → MinIO → GeoServer. Layer sẽ gán vào
            snapshot này, xem lại được cả trên admin và client.
          </p>
          {job && !terminal && (
            <p className="mt-1 flex items-center gap-2 text-sky-700">
              <LoadingInline size="small" />
              <span>
                Job #{job.id} — {job.status} ({job.progress}%)
              </span>
            </p>
          )}
          {job?.status === 'completed' && job.geoserver_layer && (
            <p className="mt-1 flex items-center gap-2 text-emerald-700">
              <span>
                ✓ Layer: <span className="font-mono">{job.geoserver_layer}</span>
              </span>
              <Button
                type="button"
                variant="link"
                size="xs"
                onClick={dismissJob}
                className="h-auto px-0 py-0 text-[10px] text-slate-500 hover:text-slate-700"
              >
                Đóng
              </Button>
            </p>
          )}
          {job?.status === 'failed' && (
            <p className="mt-1 text-red-700">
              ✗ Job #{job.id} failed: {job.error_log?.slice(0, 200) || 'không rõ'}
              <Button
                type="button"
                variant="link"
                size="xs"
                onClick={dismissJob}
                className="h-auto shrink-0 px-0 py-0 text-[10px] text-slate-500 hover:text-slate-700"
              >
                Clear
              </Button>
            </p>
          )}
        </div>
        <Button
          size="sm"
          onClick={startPublish}
          disabled={!canPublish}
          title={
            published
              ? 'Đã publish rồi.'
              : hasDownload
                ? 'Bấm để enqueue job publish → MinIO → GeoServer'
                : 'Chưa có geeDownloadUrl'
          }
        >
          {busy ? 'Đang chạy...' : published ? 'Đã publish' : 'Publish → GeoServer'}
        </Button>
      </div>

      {/* Facts grid */}
      <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
        {facts.map((f, i) => (
          <div key={i} className="bg-background/40 rounded-md border p-2 text-xs">
            <p className="text-muted-foreground text-[10px]" title={f.hint}>
              {f.label}
            </p>
            <p className="mt-0.5 truncate">{f.value}</p>
          </div>
        ))}
      </div>

      {/* Class breakdown mini */}
      {totalHa > 0 && (
        <div className="rounded-md border p-3">
          <p className="text-muted-foreground mb-2 text-xs font-semibold">
            Phân bố 11 lớp trong snapshot này
          </p>
          <ClassDistributionBar byClass={byClass} totalHa={totalHa} />
        </div>
      )}

      {/* Raw JSON — collapsible cho debug */}
      <details className="bg-background/40 rounded-md border p-2 text-xs">
        <summary className="flex cursor-pointer items-center gap-1.5 font-semibold">
          <FileJson size={12} /> Raw JSON snapshot
        </summary>
        <pre className="mt-2 max-h-64 overflow-auto text-[10px]">
          {JSON.stringify(item, null, 2)}
        </pre>
      </details>
    </div>
  )
}
