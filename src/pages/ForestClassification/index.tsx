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
  GitCompareArrows,
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
import {
  buildGeoserverDownloadUrl,
  downloadRasterFile,
} from '@/lib/geoserver'
import type {
  ForestClassSnapshot,
  ForestClassAreaComparisonMetric,
  ForestClassClassComparison,
  ForestClassComparison,
  ForestClassDistrictArea,
  ForestClassDistrictClassArea,
  ForestClassDistrictComparison,
  ForestClassHistoryItem,
} from '@/types/api'
import ForestMap from '@/components/features/ForestMap'
import LoadingInline from '@/components/common/LoadingInline'
import { PaginationCustom } from '@/components/features/PaginationCustom'
import ForestGroundTruthCard from './ForestGroundTruthCard'
import { hasPerm } from '@/lib/permissions'
import { useAuthStore } from '@/stores/common/useAuthStore'

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
const formatAreaChange = (metric?: ForestClassAreaComparisonMetric | null) => {
  if (!metric) return '—'
  const sign = metric.deltaHa > 0 ? '+' : ''
  const pct =
    metric.changePct == null
      ? ''
      : ` (${metric.changePct > 0 ? '+' : ''}${metric.changePct.toFixed(1)}%)`
  return `${sign}${Math.round(metric.deltaHa).toLocaleString('vi')} ha${pct}`
}
const formatPeriod = (year: number, month: number) => `${year}-${String(month).padStart(2, '0')}`
const MIN_ANALYSIS_YEAR = 2015
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

// ── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status?: string }) {
  const s = String(status || '').toLowerCase()
  const map: Record<string, { label: string; className: string }> = {
    completed: {
      label: 'Hoàn thành',
      className: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    },
    published: {
      label: 'Đã công bố',
      className: 'bg-emerald-200 text-emerald-900 border-emerald-400',
    },
    computing: { label: 'Đang phân tích', className: 'bg-sky-100 text-sky-800 border-sky-300' },
    exporting: { label: 'Đang tạo bản đồ', className: 'bg-sky-100 text-sky-800 border-sky-300' },
    pending: { label: 'Đang chờ', className: 'bg-slate-100 text-slate-800 border-slate-300' },
    failed: { label: 'Thất bại', className: 'bg-red-100 text-red-800 border-red-300' },
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
  const user = useAuthStore((s) => s.user)
  const canManage = hasPerm(user, 'forest_classification', 'manage')
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
  const comparison = (latest?.comparison || null) as ForestClassComparison | null
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
          <p className="text-muted-foreground mt-1 max-w-3xl text-sm">
            Theo dõi 11 nhóm lớp phủ, diện tích rừng và biến động theo tháng trên toàn tỉnh.
          </p>
          {snapshot && (
            <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
              <span>
                Kỳ dữ liệu:{' '}
                <span>{formatPeriod(snapshot.year, snapshot.month)}</span>
              </span>
              <StatusBadge status={snapshot.status} />
              <span className={rasterTileUrl ? 'text-emerald-700' : 'text-amber-700'}>
                {rasterTileUrl ? 'Bản đồ sẵn sàng' : 'Bản đồ đang xử lý'}
              </span>
            </div>
          )}
        </div>
        {canManage && (
          <Button
            className="w-full md:w-auto md:shrink-0"
            onClick={() => setRefreshDialogOpen(true)}
            disabled={isRefreshing}
          >
            {isRefreshing ? 'Đang phân loại...' : 'Phân loại lại'}
          </Button>
        )}
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
              {isRefreshing ? 'Đang phân loại dữ liệu...' : 'Phân loại lại lớp phủ rừng?'}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                {isRefreshing ? (
                  <>
                    <p>Hệ thống đang cập nhật 11 nhóm lớp phủ cho kỳ đã chọn.</p>
                    <p className="flex items-center gap-2 text-sky-700">
                      <LoadingInline size="small" />
                      <span>Đang xử lý, kết quả sẽ tự động cập nhật.</span>
                    </p>
                  </>
                ) : (
                  <>
                    <p>
                      Chọn kỳ dữ liệu cần cập nhật. Kết quả mới sẽ thay thế kết quả của cùng kỳ.
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
                    <p className="text-muted-foreground text-xs">
                      Dữ liệu hiện tại vẫn được giữ nguyên cho đến khi quá trình hoàn tất.
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
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Đang tải dữ liệu phân loại...</p>
          ) : !snapshot ? (
            <p className="text-sm text-amber-700">
              Chưa có dữ liệu phân loại. Hãy chạy phân loại lần đầu.
            </p>
          ) : (
            <>
              {/* KPI — OOB xuất hiện với snapshot mới; Kappa chỉ có khi server
                  chạy đánh giá bằng ground-truth holdout. */}
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
                        hint="Tổng diện tích đã được phân loại"
                      value={formatHa(totalHa)}
                    />
                    <Stat
                      label="Diện tích rừng"
                        hint="Gồm các nhóm rừng tự nhiên và rừng trồng"
                      value={formatHa(forestHa)}
                      sub={`${formatPct(forestPct)} tổng`}
                      tone="success"
                    />
                    {hasOob && (
                      <Stat
                        label="Độ chính xác mô hình"
                        hint="Độ chính xác ước tính của kết quả phân loại"
                        value={formatPct(snapshot.oobAccuracy)}
                      />
                    )}
                    {hasKappa && (
                      <Stat
                        label="Mức đồng thuận"
                        hint="Mức phù hợp giữa kết quả và dữ liệu kiểm chứng"
                        value={snapshot.testKappa!.toFixed(3)}
                      />
                    )}
                  </div>
                )
              })()}

              {comparison && <ComparisonCard comparison={comparison} />}

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
                    downloadUrl={
                      buildGeoserverDownloadUrl(snapshot.geoserverLayer) ||
                      snapshot.geeDownloadUrl ||
                      null
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
                <ClassAreaTable byClass={byClass} comparison={comparison?.province.classes} />
              </CollapsibleSection>

              {/* Phân bố theo huyện — collapsible, mặc định đóng vì bảng dài
                  (9 huyện Kon Tum × class columns) và không phải use case chính. */}
              {districtAreas.length > 0 && (
                <CollapsibleSection
                  title="Phân bố theo huyện"
                  hint={`${districtAreas.length} huyện · nhóm phủ chính và tỷ lệ rừng`}
                >
                  <DistrictAreaTable rows={districtAreas} comparison={comparison?.districts} />
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
            </div>
          </div>
          {/* History table — max-h giới hạn để không đẩy pagination xa khỏi
              tầm nhìn khi expand nhiều row detail. Scroll cả 2 chiều. */}
          <div className="max-h-[70vh] overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead>Kỳ</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead className="text-right">Độ chính xác</TableHead>
                  <TableHead className="text-right">Tổng ha</TableHead>
                  <TableHead className="text-right">Rừng ha</TableHead>
                  <TableHead>Bản đồ</TableHead>
                  <TableHead>Cập nhật lúc</TableHead>
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
                        <TableCell>{formatPeriod(h.year, h.month)}</TableCell>
                        <TableCell>
                          <StatusBadge status={h.status} />
                        </TableCell>
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
                            <span className="text-emerald-700">Sẵn sàng</span>
                          ) : rasterKind === 'GEE tile' ? (
                            <span className="text-amber-700">Tạm thời</span>
                          ) : (
                            <span className="text-slate-500">Đang xử lý</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          {h.computed_at ? formatDateTime(h.computed_at) : '—'}
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow className="bg-muted/20">
                          <TableCell colSpan={8}>
                            <SnapshotDetailPanel item={h} />
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  )
                })}
                {!history.length && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-muted-foreground text-center">
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

function ComparisonCard({ comparison }: { comparison: ForestClassComparison }) {
  const previousPeriod = formatPeriod(
    comparison.previousSnapshot.year,
    comparison.previousSnapshot.month
  )
  const topChanges = comparison.province.classes
    .filter((item) => item.deltaHa !== 0)
    .sort((a, b) => Math.abs(b.deltaHa) - Math.abs(a.deltaHa))
    .slice(0, 3)
  return (
    <div className="overflow-hidden rounded-md border">
      <div className="bg-muted/40 flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <GitCompareArrows className="text-primary h-4 w-4" />
          So sánh với kỳ gần nhất
        </h3>
        <Badge variant="outline" className="font-mono text-xs">
          {previousPeriod}
        </Badge>
      </div>
      <div className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(220px,1.4fr)]">
        <div>
          <p className="text-muted-foreground text-xs">Tổng diện tích</p>
          <p className="mt-1 font-semibold tabular-nums">
            {formatAreaChange(comparison.province.total)}
          </p>
          <p className="text-muted-foreground text-[11px]">
            Kỳ trước {formatHa(comparison.province.total.previousHa)}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Diện tích rừng</p>
          <p className="mt-1 font-semibold text-emerald-700 tabular-nums">
            {formatAreaChange(comparison.province.forest)}
          </p>
          <p className="text-muted-foreground text-[11px]">
            Kỳ trước {formatHa(comparison.province.forest.previousHa)}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground mb-1 text-xs">Lớp biến động nhiều nhất</p>
          {topChanges.length > 0 ? (
            <div className="divide-y">
              {topChanges.map((item) => (
                <div key={item.classId} className="flex items-center gap-2 py-1 text-xs">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-sm border"
                    style={{ backgroundColor: CLASS_META[item.classId]?.color }}
                  />
                  <span className="min-w-0 flex-1 truncate">{item.className}</span>
                  <span className="shrink-0 font-medium tabular-nums">
                    {formatAreaChange(item)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-xs">Không có biến động diện tích.</p>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Table 11 lớp — hiển thị tên, diện tích, % vs tổng, cờ "rừng thực".
 */
function ClassAreaTable({
  byClass,
  comparison,
}: {
  byClass: Record<string, number>
  comparison?: ForestClassClassComparison[]
}) {
  const comparisonByClass = new Map((comparison || []).map((item) => [item.classId, item]))
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
      comparison: comparisonByClass.get(Number(id)),
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
            {comparison && <TableHead className="text-right">Kỳ trước</TableHead>}
            {comparison && <TableHead className="text-right">Chênh lệch</TableHead>}
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
              {comparison && (
                <TableCell className="text-right tabular-nums">
                  {formatHa(r.comparison?.previousHa)}
                </TableCell>
              )}
              {comparison && (
                <TableCell className="text-right tabular-nums">
                  {formatAreaChange(r.comparison)}
                </TableCell>
              )}
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
function DistrictAreaTable({
  rows,
  comparison,
}: {
  rows: ForestClassDistrictArea[]
  comparison?: ForestClassDistrictComparison[]
}) {
  const comparisonByDistrict = new Map(
    (comparison || []).map((item) => [item.districtCode || item.districtName, item])
  )
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
        comparison: comparisonByDistrict.get(r.districtCode || r.districtName),
      }
    })
    .sort((a, b) => b.totalHa - a.totalHa)

  if (!list.length) return null

  return (
    <div className="max-h-96 overflow-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-20 whitespace-nowrap">Mã huyện</TableHead>
            <TableHead>Huyện</TableHead>
            <TableHead className="text-right">Tổng ha</TableHead>
            <TableHead className="text-right">Rừng ha</TableHead>
            <TableHead className="text-right">Rừng %</TableHead>
            {comparison && <TableHead className="text-right">Δ rừng</TableHead>}
            <TableHead>Lớp phủ chính</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.map((g) => {
            const dom = g.dominant != null ? CLASS_META[g.dominant.classId] : null
            return (
              <TableRow key={g.code}>
                <TableCell className="whitespace-nowrap font-mono text-xs">{g.code}</TableCell>
                <TableCell className="font-medium">{g.name}</TableCell>
                <TableCell className="text-right tabular-nums">{formatHa(g.totalHa)}</TableCell>
                <TableCell className="text-right text-emerald-700 tabular-nums">
                  {formatHa(g.forestHa)}
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatPct(g.forestPct)}</TableCell>
                {comparison && (
                  <TableCell className="text-right tabular-nums">
                    {formatAreaChange(g.comparison?.forest)}
                  </TableCell>
                )}
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
  downloadUrl,
  downloadFilename,
}: {
  heatVisible: boolean
  heatOpacity: number
  onHeatVisibleChange: (v: boolean) => void
  onHeatOpacityChange: (v: number) => void
  downloadUrl: string | null | undefined
  downloadFilename: string
}) {
  const [open, setOpen] = useState(true)

  const downloadRaster = async () => {
    if (!downloadUrl) return
    try {
      await downloadRasterFile(downloadUrl, downloadFilename)
    } catch (err: any) {
      toast.error(err?.message || 'Không thể tải dữ liệu phân loại rừng.')
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
          <span className="text-sm font-semibold">Lớp bản đồ</span>
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
                  title="Tải dữ liệu phân loại"
                  aria-label="Tải dữ liệu phân loại"
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
          </div>
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
  const user = useAuthStore((s) => s.user)
  const canPublishRaster = hasPerm(user, 'map_layers', 'ingest_raster')
  const s = (item.province_summary || {}) as any
  const byClass: Record<string, number> = s.byClass || {}
  const totalHa = Number(s.totalHa) || 0
  const forestHa = FOREST_CLASS_IDS.reduce((sum, id) => sum + (Number(byClass[String(id)]) || 0), 0)

  const [ingestJobId, setIngestJobId] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const queryClient = useQueryClient()
  const hasDownload = Boolean(item.gee_download_url)
  const published = Boolean(item.geoserver_layer)
  const canPublish = canPublishRaster && hasDownload && !published && !busy

  const startPublish = async () => {
    setBusy(true)
    try {
      const res = await forestClassificationService.publishSnapshotRaster(item.id)
      const data: any = (res as any)?.data?.data ?? (res as any)?.data
      if (data?.alreadyPublished) {
        await Promise.all([
          queryClient.refetchQueries({ queryKey: ['forest-class-latest'], type: 'active' }),
          queryClient.refetchQueries({ queryKey: ['forest-class-history'], type: 'active' }),
        ])
        toast.info('Dữ liệu này đã có trên bản đồ.')
        setBusy(false)
        return
      }
      if (data?.jobId) {
        setIngestJobId(Number(data.jobId))
        toast.success('Đã bắt đầu cập nhật bản đồ.')
      }
    } catch (err: any) {
      toast.error(err?.message || 'Không thể cập nhật bản đồ')
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
      toast.success('Đã cập nhật bản đồ thành công.')
      void Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['forest-class-latest'],
          refetchType: 'none',
        }),
        queryClient.invalidateQueries({
          queryKey: ['forest-class-history'],
          refetchType: 'none',
        }),
      ]).then(() =>
        Promise.all([
          queryClient.refetchQueries({ queryKey: ['forest-class-latest'], type: 'active' }),
          queryClient.refetchQueries({ queryKey: ['forest-class-history'], type: 'active' }),
        ])
      )
    } else {
      toast.error(job.error_log || 'Cập nhật bản đồ thất bại.')
    }
  }, [terminal, busy, job?.status, job?.geoserver_layer, job?.error_log, queryClient])

  const dismissJob = () => setIngestJobId(null)

  const facts: Array<{ label: string; value: React.ReactNode; hint?: string }> = [
    {
      label: 'Kỳ dữ liệu',
      value: <span>{formatPeriod(item.year, item.month)}</span>,
    },
    { label: 'Trạng thái', value: <StatusBadge status={item.status} /> },
    { label: 'Hoàn thành lúc', value: item.computed_at ? formatDateTime(item.computed_at) : '—' },
    { label: 'Công bố lúc', value: item.published_at ? formatDateTime(item.published_at) : '—' },
    {
      label: 'Độ chính xác',
      value: item.oob_accuracy != null ? `${item.oob_accuracy}%` : '—',
    },
    {
      label: 'Thời gian xử lý',
      value: item.duration_ms != null ? `${Math.round(item.duration_ms / 1000)}s` : '—',
    },
    { label: 'Tổng diện tích', value: formatHa(totalHa) },
    {
      label: 'Diện tích rừng',
      value: <span className="text-emerald-700">{formatHa(forestHa)}</span>,
    },
    {
      label: 'Bản đồ',
      value: item.geoserver_layer ? (
        <span className="text-emerald-700">Sẵn sàng</span>
      ) : item.gee_tile_url ? (
        <span className="text-amber-700">Tạm thời</span>
      ) : (
        <span className="text-muted-foreground">Đang xử lý</span>
      ),
    },
    ...(item.error_message
      ? [{
        label: 'Thông báo lỗi',
        value: (
        <span className="text-xs text-red-600">{item.error_message}</span>
        ),
      }]
      : []),
  ]

  return (
    <div className="space-y-4">
      {/* Publish control — chỉ hiện cho user có quyền map_layers:ingest_raster
          (mirror backend POST /snapshots/:id/publish-raster gate). */}
      {canPublishRaster && (
      <div className="bg-background/60 flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
        <div className="min-w-0 flex-1 text-xs">
          <p className="font-semibold">Đưa kết quả lên bản đồ</p>
          <p className="text-muted-foreground mt-0.5">
            Công bố kết quả này để dùng ổn định trên trang quản trị và cổng bản đồ công khai.
          </p>
          {job && !terminal && (
            <p className="mt-1 flex items-center gap-2 text-sky-700">
              <LoadingInline size="small" />
              <span>
                Đang cập nhật bản đồ ({job.progress}%)
              </span>
            </p>
          )}
          {job?.status === 'completed' && job.geoserver_layer && (
            <p className="mt-1 flex items-center gap-2 text-emerald-700">
              <span>
                Đã cập nhật bản đồ thành công
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
              {job.error_log?.slice(0, 200) || 'Không thể cập nhật bản đồ.'}
              <Button
                type="button"
                variant="link"
                size="xs"
                onClick={dismissJob}
                className="h-auto shrink-0 px-0 py-0 text-[10px] text-slate-500 hover:text-slate-700"
              >
                Đóng
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
              ? 'Đã công bố.'
              : hasDownload
                ? 'Đưa kết quả lên bản đồ'
                : 'Chưa có dữ liệu bản đồ'
          }
        >
          {busy ? 'Đang xử lý...' : published ? 'Đã công bố' : 'Đưa lên bản đồ'}
        </Button>
      </div>
      )}

      {/* Facts grid */}
      <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
        {facts.map((f, i) => (
          <div key={i} className="bg-background/40 rounded-md border p-2 text-xs">
            <p className="text-muted-foreground text-[10px]" title={f.hint}>
              {f.label}
            </p>
            <div className="mt-0.5 min-w-0 truncate">{f.value}</div>
          </div>
        ))}
      </div>

      {/* Class breakdown mini */}
      {totalHa > 0 && (
        <div className="rounded-md border p-3">
          <p className="text-muted-foreground mb-2 text-xs font-semibold">
            Phân bố 11 lớp của kỳ này
          </p>
          <ClassDistributionBar byClass={byClass} totalHa={totalHa} />
        </div>
      )}

    </div>
  )
}
