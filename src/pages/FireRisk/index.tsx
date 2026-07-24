import type * as React from 'react'
import { Fragment, useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import {
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Layers,
} from 'lucide-react'
import { fireRiskService, useApiQuery, useApiMutation } from '@/service'
import { useQueryClient } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import { formatDate, formatDateTime } from '@/lib/date'
import { buildGeoserverDownloadUrl, downloadRasterFile } from '@/lib/geoserver'
import type { FireRiskFeature, FireRiskProvinceSummary } from '@/types/api'
import FireRiskMap from '@/components/features/FireRiskMap'
import LoadingInline from '@/components/common/LoadingInline'
import { PaginationCustom } from '@/components/features/PaginationCustom'
import GroundTruthCard from './GroundTruthCard'
import { hasPerm } from '@/lib/permissions'
import { useAuthStore } from '@/stores/common/useAuthStore'

/**
 * Cảnh báo cháy rừng (fire-risk v8.1).
 *
 * Nguồn số liệu bám sát response GET /fire-risk/latest:
 *   - snapshot.provinceSummary   → maxLevel, avgRiskLevel, riskLevelDist{1..5},
 *                                   s2CoverageRatio
 *   - snapshot.districtStats[]   → per-district riskLevelDist + s2Coverage
 *   - snapshot.geoserverLayer    → tên layer WMS (khi raster đã publish)
 *   - features[]                 → 1 record / (huyện × cấp) — dùng cho map,
 *                                   fallback khi districtStats trống
 *
 * UI hiển thị:
 *   - Header: ngày snapshot, status, tình trạng GeoServer
 *   - KPI: cấp cao nhất tỉnh, cấp TB, S2 phủ (3 thẻ)
 *   - Bản đồ polygon cấp cảnh báo (component <FireRiskMap>)
 *   - RiskLevelBar: stacked bar 5 cấp + legend %
 *   - Bảng huyện: cấp cao nhất + tổng ha ≥ minLevel (theo filter)
 *   - Lịch sử phân tích (paginated)
 *   - Nút "Chạy lại" — mất ~3-5 phút, xác nhận qua AlertDialog
 *
 * NOTE quan trọng — cấp cảnh báo C1-C5 KHÔNG phải cấp phân theo P Nesterov
 * thuần (QĐ 25/2022). Đây là output của Random Forest 100 trees blend NDVI +
 * NDMI + NBR + LST + ERA5 + slope + fuel + NesterovP. Vì vậy UI này bỏ hiển
 * thị chỉ số P Nesterov để tránh gây hiểu nhầm rằng UI phân cấp theo P.
 */

// Palette + label bám theo RISK_LEVEL_VIZ ở fire-risk.service.js.
const LEVEL_META: Record<number, { color: string; label: string }> = {
  1: { color: '#00a65a', label: 'Cấp I — Thấp' },
  2: { color: '#f6e84a', label: 'Cấp II — Trung bình' },
  3: { color: '#f39c12', label: 'Cấp III — Cao' },
  4: { color: '#e74c3c', label: 'Cấp IV — Nguy hiểm' },
  5: { color: '#7b241c', label: 'Cấp V — Cực kỳ nguy hiểm' },
}

// Ngưỡng cảnh báo cứng = 1 (xem toàn bộ). User đã yêu cầu bỏ filter phía UI,
// query API vẫn cần param này để server pre-filter polygon nếu cần.
const DEFAULT_MIN_RISK_LEVEL = 1

export default function FireRiskPage() {
  const user = useAuthStore((s) => s.user)
  const canManage = hasPerm(user, 'fire_risk', 'manage')
  const minRiskLevel = DEFAULT_MIN_RISK_LEVEL // hard-coded, filter UI đã bỏ.
  const [page, setPage] = useState(1)
  // Trạng thái dialog xác nhận + hiển thị tiến trình refresh (thay `confirm()` cũ).
  const [refreshDialogOpen, setRefreshDialogOpen] = useState(false)
  // Row-level expand — 1 huyện mở tại 1 thời điểm. Set `null` để đóng.
  const [expandedDistrict, setExpandedDistrict] = useState<string | null>(null)
  // Cùng cơ chế cho bảng lịch sử — mở 1 snapshot để xem chi tiết đầy đủ.
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null)
  // Layer manager state — visibility + opacity từng lớp trên map.
  const [districtVisible, setDistrictVisible] = useState(true)
  const [districtOpacity, setDistrictOpacity] = useState(0.45)
  const [heatVisible, setHeatVisible] = useState(true)
  const [heatOpacity, setHeatOpacity] = useState(0.65)

  const latestQuery = useApiQuery(['fire-risk-latest', minRiskLevel], () =>
    fireRiskService.getLatest({ minRiskLevel: Number(minRiskLevel) || undefined })
  )
  const mapQuery = useApiQuery(['fire-risk-map', minRiskLevel], () =>
    fireRiskService.getMap({ minRiskLevel: Number(minRiskLevel) || undefined })
  )
  const historyQuery = useApiQuery(['fire-risk-history', page], () =>
    fireRiskService.getHistory({ page, limit: 10 })
  )
  // NOTE — `submitExport` là cờ tùy chọn (server default = cfg.isGcsConfigured()).
  // Truyền `false` để bỏ qua bước export raster khi GCS chưa cấu hình → tránh
  // pipeline fail trên deployed code cũ (code cũ throw thay vì graceful).
  const refreshMutation = useApiMutation(
    (body: { analysisDate?: string; submitExport?: boolean }) => fireRiskService.refresh(body)
  )

  const latest = latestQuery.data?.data
  const snapshot = latest?.snapshot
  const summary: FireRiskProvinceSummary = snapshot?.provinceSummary ?? {}
  const features: FireRiskFeature[] = latest?.features ?? []
  const districtStats = snapshot?.districtStats ?? []
  const history = historyQuery.data?.data?.items ?? []
  const historyMetadata = historyQuery.data?.metadata
  const historyTotal = Number(historyMetadata?.total) || 0
  const historyTotalPages = Number(historyMetadata?.totalPages) || 0

  // API không trả sẵn maxLevel — derive từ riskLevelDist (level cao nhất có ha>0).
  const provinceMaxLevel = deriveMaxLevel(summary.riskLevelDist)

  const isRefreshing = refreshMutation.isPending
  const isLoading = latestQuery.isLoading

  // Bấm Confirm trong dialog → gọi API, giữ dialog mở để hiển thị tiến trình.
  // Không đóng dialog cho tới khi mutation resolve (success hoặc error).
  const onConfirmRefresh = () => {
    // NOTE — force submitExport=false để bypass bước GCS raster export nếu
    // server chưa cấu hình `GEE_GCS_BUCKET`. Server code MỚI đã handle null
    // gracefully, nhưng nếu deployed vẫn là code cũ (throw), fallback này
    // giúp admin refresh thành công mà không cần config GCS trước.
    refreshMutation.mutate(
      { submitExport: false },
      {
        onSuccess: () => {
          toast.success('Đã gửi yêu cầu — kết quả sẽ xuất hiện sau vài phút.')
          setRefreshDialogOpen(false)
          // BUG-FIX (2026-07-19): trước đây chỉ refetch `latestQuery` → history
          // table không thấy row mới cho tới khi user F5. Giờ refetch cả 3 query
          // sau ~2s (server pipeline chạy ~5min, nhưng row `computing` đã INSERT
          // ngay ở stage B nên history thấy được ngay).
          setTimeout(() => {
            latestQuery.refetch()
            mapQuery.refetch()
            historyQuery.refetch()
          }, 2000)
        },
        onError: (err: any) => {
          toast.error(err?.message || 'Không thể chạy lại phân tích.')
          setRefreshDialogOpen(false)
        },
      }
    )
  }

  // NOTE — nguồn cho bảng huyện:
  //   1. Ưu tiên snapshot.districtStats (chuẩn: unitCode + name + riskLevelDist
  //      + s2Coverage + centroid + pNesterovMean).
  //   2. Fallback groupByDistrict(features) khi API cũ (< v4) chưa trả
  //      districtStats — gộp features[] theo district_code, lấy max risk_level.
  //
  // User quyết định hiển thị 3 field chính: tên, area_ha (ở cấp đỉnh), s2Coverage.
  // Giữ riskLevelDist để bung breakdown per level khi click expand.
  const minLevel = Number(minRiskLevel) || 1
  const districtRows = districtStats.length
    ? districtStats
        .map((d) => {
          const dMax = deriveMaxLevel(d.riskLevelDist) ?? 0
          const topHa =
            dMax > 0
              ? Number(d.riskLevelDist?.[String(dMax) as '1' | '2' | '3' | '4' | '5']) || 0
              : 0
          return {
            code: String(d.unitCode),
            name: d.name,
            maxLevel: dMax,
            totalHa: sumDistAbove(d.riskLevelDist, minLevel),
            topLevelHa: topHa,
            s2Coverage: (d as any).s2Coverage as number | undefined,
            riskLevelDist: d.riskLevelDist,
          }
        })
        .filter((d) => d.maxLevel >= minLevel && d.totalHa > 0)
        .sort((a, b) => b.maxLevel - a.maxLevel || b.totalHa - a.totalHa)
    : groupByDistrict(features)

  return (
    <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:space-y-6 sm:p-6">
      {/* ── Header ─────────────────────────────────── */}
      {/* Responsive: stack dọc trên mobile (button full width), row từ md. */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold sm:text-2xl">Cảnh báo cháy rừng</h1>
          <p className="text-muted-foreground mt-1 max-w-3xl text-sm">
            Theo dõi nguy cơ cháy theo 5 cấp, cập nhật hằng ngày cho toàn tỉnh và từng huyện.
          </p>
          {snapshot?.analysisDate && (
            // NOTE — dùng <div> thay <p> vì bên trong có <Badge> (render <div>).
            // <div> nested trong <p> gây React hydration error "Cannot be a
            // descendant of <p>" và bị auto-close ngoài <p> làm vỡ layout.
            <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
              <span>
                Ngày phân tích:{' '}
                <span>{formatDate(snapshot.analysisDate)}</span>
              </span>
              {snapshot.status && <StatusBadge status={snapshot.status} />}
              <span className={resolveRasterTileUrl(snapshot) ? 'text-emerald-700' : 'text-amber-700'}>
                {resolveRasterTileUrl(snapshot) ? 'Bản đồ sẵn sàng' : 'Bản đồ đang xử lý'}
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
            {isRefreshing ? 'Đang phân tích...' : 'Phân tích lại'}
          </Button>
        )}
      </div>

      {/* ── Dialog xác nhận + tiến trình refresh ──── */}
      <AlertDialog
        open={refreshDialogOpen}
        onOpenChange={(open) => {
          // Chặn đóng dialog khi mutation đang chạy — user phải chờ.
          if (isRefreshing) return
          setRefreshDialogOpen(open)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isRefreshing ? 'Đang phân tích cháy rừng...' : 'Phân tích lại dữ liệu cháy rừng?'}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                {isRefreshing ? (
                  <>
                    <p>Hệ thống đang cập nhật dữ liệu nguy cơ cháy cho toàn tỉnh.</p>
                    <p className="text-muted-foreground text-xs">
                      Bạn có thể đóng cửa sổ này sau khi hoàn tất — kết quả tự cập nhật.
                    </p>
                  </>
                ) : (
                  <>
                    <p>
                      Hệ thống sẽ dùng dữ liệu mới nhất để tính lại cấp nguy cơ cho toàn tỉnh và
                      từng huyện. Thời gian dự kiến 3-5 phút.
                    </p>
                    <p className="text-muted-foreground text-xs">
                      Dữ liệu hiện tại vẫn được giữ nguyên cho đến khi kết quả mới hoàn tất.
                    </p>
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRefreshing}>Huỷ</AlertDialogCancel>
            <AlertDialogAction onClick={onConfirmRefresh} disabled={isRefreshing}>
              {isRefreshing ? 'Đang xử lý...' : 'Bắt đầu phân tích'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Ground truth (collapsible) ─────────────── */}
      <GroundTruthCard />

      {/* ── Controls + tổng quan ───────────────────── */}
      <Card>
        <CardContent className="space-y-4 p-4 sm:p-6">
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Đang tải dữ liệu cảnh báo...</p>
          ) : !snapshot ? (
            <p className="text-sm text-amber-700">
              Chưa có dữ liệu cảnh báo. Hãy chạy phân tích lần đầu.
            </p>
          ) : (
            <>
              {/* KPI — 3 thẻ tổng quan toàn tỉnh. Đã bỏ thẻ "P Nesterov" vì
                  cấp cảnh báo hiển thị là output Random Forest, không phải
                  phân cấp thuần Nesterov → tránh gây hiểu nhầm cho user. */}
              <div className="grid gap-4 sm:grid-cols-3">
                <Stat
                  label="Cấp cao nhất tỉnh"
                  hint="Cấp nguy cơ cao nhất có ghi nhận diện tích"
                  value={provinceMaxLevel != null ? `Cấp ${provinceMaxLevel}` : '—'}
                  tone={provinceMaxLevel != null && provinceMaxLevel >= 4 ? 'danger' : 'default'}
                />
                <Stat
                  label="Cấp trung bình tỉnh"
                  hint="Mức nguy cơ bình quân theo diện tích"
                  value={summary.avgRiskLevel != null ? summary.avgRiskLevel.toFixed(2) : '—'}
                />
                <Stat
                  label="Ảnh hợp lệ"
                  hint="Tỷ lệ khu vực có đủ dữ liệu ảnh để phân tích"
                  value={
                    summary.s2CoverageRatio != null
                      ? `${(summary.s2CoverageRatio * 100).toFixed(1)}%`
                      : '—'
                  }
                />
              </div>

              {latest?.stale && (
                <div className="rounded-md border border-amber-400 bg-amber-50 p-3 text-sm text-amber-800">
                  Dữ liệu đã cũ. Nên chạy phân tích lại để cập nhật bản đồ.
                </div>
              )}
              {latest?.computing && (
                <div className="rounded-md border border-sky-400 bg-sky-50 p-3 text-sm text-sky-800">
                  Đang tạo kết quả mới. Bản đồ hiện vẫn dùng dữ liệu gần nhất.
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Bản đồ polygon theo cấp cảnh báo ──────── */}
      <Card>
        <CardContent className="p-4 sm:p-6">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-lg font-semibold">Bản đồ cảnh báo cháy rừng</h2>
            {mapQuery.isLoading && (
              <span className="text-muted-foreground text-xs">Đang tải bản đồ...</span>
            )}
          </div>
          {/* NOTE — endpoint /fire-risk/map trả RAW GeoJSON (controller
              explicit `res.json(geojson)`, không dùng OK helper), nhưng
              apiClient.get<T> luôn wrap kiểu ApiResponse<T> = {message, data}.
              Nên `mapQuery.data.data` = undefined ⇒ trước đây map hiện
              "Chưa có polygon". Unwrap fallback: nếu data.data missing → dùng
              luôn data (đã là FeatureCollection).

              Raster fallback chain (chuyền `rasterTileUrl` cho map):
                1. WMS GeoServer (khi `snapshot.geoserverLayer` không null +
                   env `VITE_GEOSERVER_URL` có config). Persistent.
                2. `snapshot.geeTileUrl` — Earth Engine tile URL, server luôn
                   cố sinh, KHÔNG cần GCS. TTL ~24h.
                3. Không có URL → chỉ vector polygon huyện, không raster nền. */}
          <FireRiskMap
            geojson={extractFeatureCollection(mapQuery.data)}
            rasterTileUrl={resolveRasterTileUrl(snapshot)}
            districtVisible={districtVisible}
            districtOpacity={districtOpacity}
            heatVisible={heatVisible}
            heatOpacity={heatOpacity}
          />
          {/* Layer Manager — collapsible, giống SatelliteControll/LayerManager */}
          <FireRiskLayerManager
            geojson={extractFeatureCollection(mapQuery.data)}
            snapshot={snapshot}
            districtVisible={districtVisible}
            districtOpacity={districtOpacity}
            heatVisible={heatVisible}
            heatOpacity={heatOpacity}
            onDistrictVisibleChange={setDistrictVisible}
            onDistrictOpacityChange={setDistrictOpacity}
            onHeatVisibleChange={setHeatVisible}
            onHeatOpacityChange={setHeatOpacity}
          />
        </CardContent>
      </Card>

      {/* ── Phân phối 5 cấp cảnh báo ──────────────── */}
      {summary.riskLevelDist && (
        <Card>
          <CardContent className="p-4 sm:p-6">
            <h2 className="mb-3 text-lg font-semibold">Phân bố diện tích theo cấp cảnh báo</h2>
            <RiskLevelBar dist={summary.riskLevelDist} />
          </CardContent>
        </Card>
      )}

      {/* ── Bảng chi tiết huyện ───────────────────── */}
      <Card>
        <CardContent className="p-4 sm:p-6">
          <h2 className="mb-1 text-lg font-semibold">Chi tiết huyện ({districtRows.length})</h2>
          <p className="text-muted-foreground mb-3 text-xs">
            Diện tích được tính tại cấp cảnh báo cao nhất của từng huyện.
          </p>
          {/* Wrap trong div scrollable — header sticky nhờ Radix Table + inline
              positioning. Max-height ~450px = ~10 hàng; overflow-x-auto để
              bảng không vỡ layout trên mobile khi header dài. */}
          <div className="max-h-112.5 overflow-auto rounded-md border">
            <Table>
              {/* NOTE — 3 cột chính: tên huyện + cấp cao nhất (badge) +
                  diện tích ở cấp đỉnh + S2 phủ. Bỏ mã huyện + tổng ha
                  ≥ minLevel để UI gọn (giữ trong expand row nếu cần). */}
              <TableHeader className="bg-background sticky top-0 z-10">
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Tên huyện</TableHead>
                  <TableHead>Cấp cao nhất</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Diện tích (ha)</TableHead>
                  <TableHead className="text-right whitespace-nowrap">S2 phủ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {districtRows.map((d) => {
                  const isExpanded = expandedDistrict === d.code
                  const dist = (d as { riskLevelDist?: Record<string, number> }).riskLevelDist
                  const s2 = (d as { s2Coverage?: number }).s2Coverage
                  return (
                    <Fragment key={d.code}>
                      <TableRow
                        onClick={() =>
                          setExpandedDistrict((cur) => (cur === d.code ? null : d.code))
                        }
                        className="hover:bg-muted/50 cursor-pointer"
                        aria-expanded={isExpanded}
                      >
                        <TableCell className="w-8 p-2">
                          <ChevronRight
                            className={`text-muted-foreground h-4 w-4 transition-transform ${
                              isExpanded ? 'rotate-90' : ''
                            }`}
                          />
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{d.name}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className="whitespace-nowrap"
                            style={{
                              borderColor: LEVEL_META[d.maxLevel]?.color,
                              color: LEVEL_META[d.maxLevel]?.color,
                            }}
                          >
                            {LEVEL_META[d.maxLevel]?.label || `Cấp ${d.maxLevel}`}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap tabular-nums">
                          {formatHaShort((d as { topLevelHa?: number }).topLevelHa)}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap tabular-nums">
                          {s2 != null ? `${(s2 * 100).toFixed(1)}%` : '—'}
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                          <TableCell colSpan={5} className="py-3">
                            <DistrictLevelBreakdown dist={dist} maxLevel={d.maxLevel} />
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  )
                })}
                {!districtRows.length && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground text-center">
                      Chưa có dữ liệu cảnh báo theo huyện.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ── Lịch sử ────────────────────────────────── */}
      <Card>
        <CardContent className="p-4 sm:p-6">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-lg font-semibold">Lịch sử chạy phân tích</h2>
          </div>
          <div className="max-h-125 overflow-auto rounded-md border">
            <Table>
              <TableHeader className="bg-background sticky top-0 z-10">
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead className="whitespace-nowrap">Ngày phân tích</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Cấp cao nhất</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Cấp TB</TableHead>
                  <TableHead className="text-right whitespace-nowrap">S2 phủ</TableHead>
                  <TableHead className="whitespace-nowrap">Bản đồ</TableHead>
                  <TableHead className="whitespace-nowrap">Cập nhật lúc</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((h) => {
                  const s = h.province_summary || {}
                  const hMax = s.maxLevel ?? deriveMaxLevel(s.riskLevelDist)
                  const rowKey = String(h.id)
                  const isExpanded = expandedHistoryId === rowKey
                  const rasterKind = h.geoserver_layer
                    ? 'geoserver'
                    : h.gee_tile_url || (h as any).geeTileUrl
                      ? 'gee'
                      : 'none'
                  return (
                    <Fragment key={h.id}>
                      <TableRow
                        onClick={() =>
                          setExpandedHistoryId((cur) => (cur === rowKey ? null : rowKey))
                        }
                        className="hover:bg-muted/50 cursor-pointer"
                        aria-expanded={isExpanded}
                      >
                        <TableCell className="w-8 p-2">
                          <ChevronRight
                            className={`text-muted-foreground h-4 w-4 transition-transform ${
                              isExpanded ? 'rotate-90' : ''
                            }`}
                          />
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {formatDate(h.analysis_date || h.analysisDate)}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={h.status} />
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap tabular-nums">
                          {hMax != null ? `Cấp ${hMax}` : '—'}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {s.avgRiskLevel != null ? Number(s.avgRiskLevel).toFixed(2) : '—'}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap tabular-nums">
                          {s.s2CoverageRatio != null
                            ? `${(Number(s.s2CoverageRatio) * 100).toFixed(1)}%`
                            : h.s2_coverage_ratio != null
                              ? `${(Number(h.s2_coverage_ratio) * 100).toFixed(1)}%`
                              : '—'}
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap">
                          {rasterKind === 'geoserver' && (
                            <span className="text-emerald-700">Sẵn sàng</span>
                          )}
                          {rasterKind === 'gee' && <span className="text-amber-700">Tạm thời</span>}
                          {rasterKind === 'none' && <span className="text-slate-500">Đang xử lý</span>}
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap">
                          {h.computed_at ? formatDateTime(h.computed_at) : '—'}
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                          <TableCell colSpan={8} className="py-3">
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
                      Chưa có bản ghi.
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

// ── Sub-components ─────────────────────────────────────────────────────────────

/**
 * FireRiskLayerManager — Layer Manager pattern giống
 * `SatelliteControll/SingleMode/LayerManager.jsx`: collapsible header với
 * icon Layers + count badge, list các layer cards có eye/download/opacity.
 *
 * 2 layer cố định:
 *   1. Trung bình theo huyện (vector polygon) — visibility + opacity only
 *   2. Bản đồ nhiệt cấp cháy (raster) — tải ảnh GeoTIFF màu (1 nút duy nhất)
 */
function FireRiskLayerManager({
  geojson,
  snapshot,
  districtVisible,
  districtOpacity,
  heatVisible,
  heatOpacity,
  onDistrictVisibleChange,
  onDistrictOpacityChange,
  onHeatVisibleChange,
  onHeatOpacityChange,
}: {
  geojson: GeoJSON.FeatureCollection | null
  snapshot: any
  districtVisible: boolean
  districtOpacity: number
  heatVisible: boolean
  heatOpacity: number
  onDistrictVisibleChange: (v: boolean) => void
  onDistrictOpacityChange: (v: number) => void
  onHeatVisibleChange: (v: boolean) => void
  onHeatOpacityChange: (v: number) => void
}) {
  const [open, setOpen] = useState(true)

  // Tải GeoTIFF bản đồ nhiệt. Ưu tiên `geoserverDownloadUrl` (WCS GetCoverage,
  // persistent, full-resolution) trước `geeDownloadUrl` (GEE trần, TTL 24h,
  // downsampled). File thực sự là image/tiff — extension `.tif` (KHÔNG `.zip`,
  // trước đây Windows Explorer prompt "invalid archive" khi double-click).
  const downloadHeatRaster = async () => {
    const url =
      buildGeoserverDownloadUrl(snapshot?.geoserverLayer ?? snapshot?.geoserver_layer) ||
      snapshot?.geeDownloadUrl ||
      snapshot?.gee_download_url
    if (!url) return
    const filename =
      (snapshot as any)?.downloadFilename ||
      `fire_risk_kontum_${(snapshot?.analysisDate || '').slice(0, 10).replace(/-/g, '')}.tif`
    try {
      await downloadRasterFile(url, filename)
    } catch (err: any) {
      toast.error(err?.message || 'Không thể tải dữ liệu cảnh báo cháy rừng.')
    }
  }

  const layers = [
    {
      id: 'district',
      label: 'Cảnh báo theo huyện',
      dotClass: 'bg-emerald-500',
      desc: `${geojson?.features?.length ?? 0} khu vực hành chính`,
      visible: districtVisible,
      opacity: districtOpacity,
      onVisibleChange: onDistrictVisibleChange,
      onOpacityChange: onDistrictOpacityChange,
      // Bỏ download GeoJSON — layer này chỉ để visualize, không cần export.
      canDownload: false,
      downloadLabel: '',
      downloadIcon: 'vector' as const,
      onDownload: () => {},
    },
    {
      id: 'heat',
      label: 'Nguy cơ cháy chi tiết',
      dotClass: 'bg-orange-500',
      desc:
        snapshot?.geoserverLayer || snapshot?.geeTileUrl || snapshot?.gee_tile_url
          ? 'Dữ liệu bản đồ đã sẵn sàng'
          : 'Dữ liệu bản đồ đang xử lý',
      visible: heatVisible,
      opacity: heatOpacity,
      onVisibleChange: onHeatVisibleChange,
      onOpacityChange: onHeatOpacityChange,
      // Chỉ giữ 1 nút "Tải ảnh" — đã bỏ Copy URL + Xem tile preview để UI gọn.
      canDownload: Boolean(
        buildGeoserverDownloadUrl(snapshot?.geoserverLayer ?? snapshot?.geoserver_layer) ||
        snapshot?.geeDownloadUrl ||
        snapshot?.gee_download_url
      ),
      downloadLabel: 'Tải dữ liệu bản đồ nguy cơ cháy',
      downloadIcon: 'raster' as const,
      onDownload: downloadHeatRaster,
    },
  ]

  return (
    <div className="bg-card mt-3 overflow-hidden rounded-md border">
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
          <span className="bg-primary/20 text-primary rounded-full px-2 py-0.5 text-xs font-medium">
            {layers.length}
          </span>
        </div>
        {open ? (
          <ChevronUp size={16} className="text-muted-foreground" />
        ) : (
          <ChevronDown size={16} className="text-muted-foreground" />
        )}
      </Button>

      {open && (
        // Layout 2 col × 1 row (stack trên mobile). Admin có nhiều không gian
        // ngang hơn client sidebar nên mỗi layer chiếm 1 cột song song.
        <div className="grid grid-cols-1 gap-2 border-t p-3 md:grid-cols-2">
          {layers.map((l) => (
            <FireRiskLayerCard key={l.id} layer={l} />
          ))}
        </div>
      )}
    </div>
  )
}

function FireRiskLayerCard({
  layer,
}: {
  layer: {
    id: string
    label: string
    dotClass: string
    desc: string
    visible: boolean
    opacity: number
    onVisibleChange: (v: boolean) => void
    onOpacityChange: (v: number) => void
    canDownload: boolean
    downloadLabel: string
    downloadIcon: 'vector' | 'raster'
    onDownload: () => void
  }
}) {
  return (
    <div className="bg-background hover:border-border rounded border p-2 transition-colors">
      <div className="space-y-2">
        {/* Header row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <div className={`h-2.5 w-2.5 shrink-0 rounded-full ${layer.dotClass}`} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">{layer.label}</p>
              <p className="text-muted-foreground truncate text-[11px]">{layer.desc}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant={layer.visible ? 'default' : 'outline'}
              size="icon"
              onClick={() => layer.onVisibleChange(!layer.visible)}
              aria-label={layer.visible ? 'Ẩn lớp' : 'Hiển thị lớp'}
              className="h-7 w-7"
            >
              {layer.visible ? <Eye size={12} /> : <EyeOff size={12} />}
            </Button>
            {layer.canDownload && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={layer.onDownload}
                title={layer.downloadLabel}
                className="h-7 w-7"
              >
                <ImageIcon size={12} />
              </Button>
            )}
          </div>
        </div>

        {/* Opacity slider — luôn hiện. Mỗi layer 1 slider độc lập.
            Khi layer ẩn slider mờ + disable để user vẫn thấy nó tồn tại. */}
        <div className={`space-y-1 ${layer.visible ? '' : 'opacity-40'}`}>
          <div className="flex items-center justify-between">
            <label className="text-muted-foreground text-[11px]">Độ trong suốt</label>
            <span className="bg-primary/10 text-primary rounded px-1.5 py-0.5 text-[11px] font-medium tabular-nums">
              {Math.round(layer.opacity * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={layer.opacity}
            onChange={(e) => layer.onOpacityChange(Number(e.target.value))}
            disabled={!layer.visible}
            className="accent-primary w-full"
          />
        </div>

      </div>
    </div>
  )
}

function Stat({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string
  value: any
  hint?: string
  tone?: 'default' | 'danger'
}) {
  const border = tone === 'danger' ? 'border-red-400 bg-red-50' : ''
  return (
    <div className={`min-w-0 rounded-md border p-3 ${border}`}>
      <p className="text-muted-foreground truncate text-xs">{label}</p>
      <p className="mt-1 truncate text-xl font-bold sm:text-2xl">{value ?? '—'}</p>
      {hint && (
        <p className="text-muted-foreground mt-1 line-clamp-2 text-[11px] leading-4">{hint}</p>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const labels: Record<string, string> = {
    completed: 'Hoàn thành',
    published: 'Đã công bố',
    computing: 'Đang phân tích',
    exporting: 'Đang tạo bản đồ',
    pending: 'Đang chờ',
    failed: 'Thất bại',
  }
  const variant: 'default' | 'secondary' | 'destructive' | 'outline' =
    status === 'completed' || status === 'published'
      ? 'default'
      : status === 'computing' || status === 'exporting'
        ? 'secondary'
        : status === 'failed'
          ? 'destructive'
          : 'outline'
  return <Badge variant={variant}>{labels[status] || status}</Badge>
}

/**
 * Panel bung khi user click 1 hàng huyện. Hiện chip riêng cho MỖI cấp có ha > 0
 * (kể cả cấp thấp hơn minRiskLevel filter — user cần thấy toàn cảnh khi expand).
 * Chip cấp cao nhất đậm (nền tô nhẹ), các cấp khác viền màu opacity nhẹ.
 */
function DistrictLevelBreakdown({
  dist,
  maxLevel,
}: {
  dist?: Record<string, number>
  maxLevel: number
}) {
  if (!dist) {
    return (
      <p className="text-muted-foreground text-xs">
        Không có breakdown chi tiết (fallback API cũ).
      </p>
    )
  }
  const chips: Array<{ level: number; ha: number }> = []
  for (let l = 5; l >= 1; l--) {
    const ha = Number(dist[String(l)]) || 0
    if (ha > 0) chips.push({ level: l, ha })
  }
  if (!chips.length) {
    return <p className="text-muted-foreground text-xs">Không có ha ở cấp 1-5.</p>
  }
  return (
    <div className="space-y-2">
      <p className="text-muted-foreground text-[11px]">
        Breakdown theo cấp cảnh báo (mọi cấp có ha &gt; 0):
      </p>
      <div className="flex flex-wrap gap-1.5">
        {chips.map((c) => {
          const meta = LEVEL_META[c.level]
          const isTop = c.level === maxLevel
          return (
            <span
              key={c.level}
              className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs whitespace-nowrap tabular-nums ${
                isTop ? 'font-semibold' : 'opacity-75'
              }`}
              style={{
                color: meta?.color,
                borderColor: meta?.color,
                backgroundColor: isTop ? `${meta?.color}22` : 'transparent',
              }}
              title={meta?.label}
            >
              <span
                className="inline-block h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: meta?.color }}
              />
              {meta?.label ?? `Cấp ${c.level}`} · {formatHaShort(c.ha)} ha
            </span>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Panel bung khi user click 1 hàng lịch sử. Hiển thị chi tiết snapshot: full
 * riskLevelDist (0-5), blendCase, confidenceHa, timestamps, raster info +
 * raw JSON. Giúp ops/admin debug trực tiếp trên UI thay vì phải psql.
 *
 * NOTE — nhiều field có thể null (snapshot cũ chưa có, hoặc pipeline fail
 * giữa chừng). Mỗi field guard riêng để không vỡ render.
 */
function SnapshotDetailPanel({ item }: { item: any }) {
  const user = useAuthStore((s) => s.user)
  const canPublishRaster = hasPerm(user, 'map_layers', 'ingest_raster')
  const s = (item?.province_summary || {}) as any
  const dist: Record<string, number> = s.riskLevelDist || {}
  const totalHaAll = [0, 1, 2, 3, 4, 5].reduce((sum, l) => sum + (Number(dist[String(l)]) || 0), 0)

  // Publish trigger: chỉ hiện khi snapshot có download URL và chưa publish.
  // State giữ jobId để poll trạng thái ingest — snapshot back-link khi xong.
  const [ingestJobId, setIngestJobId] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const queryClient = useQueryClient()
  const hasDownload = Boolean(item.gee_download_url || item.geeDownloadUrl)
  const published = Boolean(item.geoserver_layer)
  const canPublish = canPublishRaster && hasDownload && !published && !busy

  const startPublish = async () => {
    setBusy(true)
    try {
      const res = await fireRiskService.publishSnapshotRaster(item.id)
      const data: any = res?.data?.data ?? res?.data
      if (data?.alreadyPublished) {
        await Promise.all([
          queryClient.refetchQueries({ queryKey: ['fire-risk-latest'], type: 'active' }),
          queryClient.refetchQueries({ queryKey: ['fire-risk-map'], type: 'active' }),
          queryClient.refetchQueries({ queryKey: ['fire-risk-history'], type: 'active' }),
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

  // Poll job status mỗi 5s. DỪNG khi terminal — trước đây refetchInterval là
  // số fix nên poll mãi kể cả sau failed → UI nháy + server spam log.
  const jobQuery = useApiQuery(
    ['raster-ingest-job', ingestJobId],
    () => fireRiskService.getIngestJob(ingestJobId as number),
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
  const job: any = jobQuery.data?.data
  const terminal = job && ['completed', 'failed', 'cancelled'].includes(job.status)

  // Terminal side-effects trong useEffect (không setState trong render body).
  // Khi publish thành công → invalidate query fire-risk-{latest,map,history} để
  // UI refetch snapshot với `geoserverLayer` mới, badge chuyển "GeoServer ✓" +
  // FireRiskMap chuyển sang WMS thay cho GEE tile URL.
  useEffect(() => {
    if (!terminal || !busy) return
    setBusy(false)
    if (job.status === 'completed') {
      toast.success('Đã cập nhật bản đồ thành công.')
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ['fire-risk-latest'], refetchType: 'none' }),
        queryClient.invalidateQueries({ queryKey: ['fire-risk-map'], refetchType: 'none' }),
        queryClient.invalidateQueries({ queryKey: ['fire-risk-history'], refetchType: 'none' }),
      ]).then(() =>
        Promise.all([
          queryClient.refetchQueries({ queryKey: ['fire-risk-latest'], type: 'active' }),
          queryClient.refetchQueries({ queryKey: ['fire-risk-map'], type: 'active' }),
          queryClient.refetchQueries({ queryKey: ['fire-risk-history'], type: 'active' }),
        ])
      )
    } else {
      toast.error(job.error_log || 'Cập nhật bản đồ thất bại.')
    }
  }, [terminal, busy, job?.status, job?.geoserver_layer, job?.error_log, queryClient])

  // Cho phép user dismiss job đã terminal — xoá ingestJobId → dừng poll hoàn toàn
  // (nếu terminal khi mount lại panel, refetchInterval() trả false ngay nhưng vẫn
  // giữ card lỗi trong DOM; nút này để clear).
  const dismissJob = () => setIngestJobId(null)

  const rows: Array<{ label: string; value: React.ReactNode; hint?: string }> = [
    {
      label: 'Ngày phân tích',
      value: formatDate(item.analysis_date || item.analysisDate),
    },
    {
      label: 'Trạng thái',
      value: <StatusBadge status={item.status} />,
    },
    {
      label: 'Hoàn thành lúc',
      value: item.computed_at ? formatDateTime(item.computed_at) : '—',
    },
    {
      label: 'Công bố lúc',
      value: item.published_at ? formatDateTime(item.published_at) : '—',
    },
    {
      label: 'Bản đồ',
      value: item.geoserver_layer ? (
        <span className="text-emerald-700">Sẵn sàng</span>
      ) : item.gee_tile_url || item.geeTileUrl ? (
        <span className="text-amber-700">Tạm thời</span>
      ) : (
        <span className="text-muted-foreground">Đang xử lý</span>
      ),
    },
    ...(item.error_message
      ? [{
        label: 'Thông báo lỗi',
        value: (
        <span className="text-red-600">{item.error_message}</span>
        ),
      }]
      : []),
  ]

  return (
    <div className="space-y-4">
      {/* Publish → GeoServer: MinIO lưu GeoTIFF, GeoServer publish layer,
          back-link vào snapshot khi xong. FE poll job 5s.
          Gate `map_layers:ingest_raster` — mirror backend. */}
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
          {(job?.status === 'failed' || job?.status === 'cancelled') && (
            <p className="mt-1 flex items-start gap-2 text-red-600">
              <span className="break-all">
                {job.error_log || 'Không thể cập nhật bản đồ.'}
              </span>
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
          variant={published ? 'outline' : 'default'}
        >
          {published
            ? 'Đã công bố'
            : busy
              ? 'Đang xử lý...'
              : hasDownload
                ? 'Đưa lên bản đồ'
                : 'Chưa có dữ liệu bản đồ'}
        </Button>
      </div>
      )}

      {/* Grid metadata */}
      <div className="grid gap-x-4 gap-y-1.5 text-xs sm:grid-cols-2">
        {rows.map((r) => (
          <div
            key={r.label}
            className="bg-background/60 flex flex-col gap-0.5 rounded-md border p-2"
          >
            <span className="text-muted-foreground text-[10px] tracking-wider uppercase">
              {r.label}
            </span>
            <div className="text-sm">{r.value}</div>
            {r.hint && <span className="text-muted-foreground text-[10px]">{r.hint}</span>}
          </div>
        ))}
      </div>

      {/* Risk level distribution — full 0-5 breakdown */}
      <div className="space-y-2">
        <p className="text-muted-foreground text-[11px]">
          <b>Phân bố diện tích theo cấp cảnh báo, gồm cả khu vực thiếu dữ liệu:</b>
        </p>
        <div className="flex flex-wrap gap-1.5">
          {[0, 1, 2, 3, 4, 5].map((l) => {
            const ha = Number(dist[String(l)]) || 0
            const pct = totalHaAll > 0 ? (ha / totalHaAll) * 100 : 0
            const meta = LEVEL_META[l]
            const color = meta?.color || '#94a3b8'
            const label = l === 0 ? 'Cấp 0 — Thiếu ảnh' : meta?.label
            return (
              <span
                key={l}
                className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs whitespace-nowrap tabular-nums"
                style={{ color, borderColor: color, backgroundColor: `${color}18` }}
              >
                <span
                  className="inline-block h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: color }}
                />
                {label} · {formatHaShort(ha)} ha ({pct.toFixed(1)}%)
              </span>
            )
          })}
        </div>
      </div>

    </div>
  )
}

function RiskLevelBar({ dist }: { dist: Record<string, number> }) {
  const levels = [1, 2, 3, 4, 5]
  const total = levels.reduce((s, l) => s + (dist[String(l)] || 0), 0)
  return (
    <div className="space-y-3">
      {/* Stacked bar */}
      <div className="flex h-8 w-full overflow-hidden rounded-md border">
        {levels.map((l) => {
          const ha = dist[String(l)] || 0
          const pct = total > 0 ? (ha / total) * 100 : 0
          if (pct <= 0) return null
          return (
            <div
              key={l}
              style={{ backgroundColor: LEVEL_META[l].color, width: `${pct}%` }}
              title={`${LEVEL_META[l].label}: ${formatHa(ha)} (${pct.toFixed(1)}%)`}
            />
          )
        })}
      </div>
      {/* Legend — responsive: 1 col mobile, 2 col sm, 5 col lg. */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {levels.map((l) => {
          const ha = dist[String(l)] || 0
          const pct = total > 0 ? (ha / total) * 100 : 0
          return (
            <div key={l} className="flex items-start gap-2 text-xs">
              <span
                className="mt-0.5 inline-block h-3 w-3 shrink-0 rounded-sm border"
                style={{ backgroundColor: LEVEL_META[l].color }}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{LEVEL_META[l].label}</span>
                <span className="text-muted-foreground tabular-nums">
                  {formatHaShort(ha)} ha ({pct.toFixed(1)}%)
                </span>
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Level cao nhất có diện tích > 0 trong riskLevelDist (server không trả sẵn maxLevel). */
function deriveMaxLevel(dist?: Record<string, number> | null): number | undefined {
  if (!dist) return undefined
  for (let l = 5; l >= 1; l--) {
    if ((dist[String(l)] || 0) > 0) return l
  }
  return undefined
}

/** Tổng diện tích các cấp >= minLevel trong riskLevelDist. */
function sumDistAbove(dist: Record<string, number> | undefined, minLevel: number): number {
  if (!dist) return 0
  let sum = 0
  for (let l = minLevel; l <= 5; l++) sum += Number(dist[String(l)] || 0)
  return sum
}

// Fallback khi API chưa trả `districtStats`. Server /latest features[] có 1
// row per (huyện × cấp cảnh báo), gom lại theo district_code để tính:
//   - maxLevel = risk_level cao nhất trong nhóm
//   - topLevelHa = area_ha của feature có risk_level == maxLevel
//   - riskLevelDist = { l: area_ha } — để expand breakdown per level
//   - s2Coverage = properties.s2Coverage (giống nhau ở mọi feature cùng huyện)
//
// Nhờ vậy fallback hiển thị đầy đủ 3 field chính (name/topLevelHa/s2Coverage)
// giống districtStats path.
function groupByDistrict(features: FireRiskFeature[]) {
  const map = new Map<
    string,
    {
      code: string
      name: string
      maxLevel: number
      totalHa: number
      topLevelHa: number
      s2Coverage: number | undefined
      riskLevelDist: Record<string, number>
    }
  >()
  for (const f of features) {
    const code = String(f.district_code || 'unknown')
    const ha = Number(f.area_ha) || 0
    const lvl = f.risk_level
    const props = (f as any).properties || {}
    const s2 = typeof props.s2Coverage === 'number' ? props.s2Coverage : undefined
    const cur = map.get(code) || {
      code,
      name: f.district_name || code,
      maxLevel: 0,
      totalHa: 0,
      topLevelHa: 0,
      s2Coverage: s2,
      riskLevelDist: {} as Record<string, number>,
    }
    cur.totalHa += ha
    cur.riskLevelDist[String(lvl)] = (cur.riskLevelDist[String(lvl)] || 0) + ha
    if (lvl > cur.maxLevel) {
      cur.maxLevel = lvl
      cur.topLevelHa = ha
    } else if (lvl === cur.maxLevel) {
      cur.topLevelHa += ha
    }
    if (s2 != null && cur.s2Coverage == null) cur.s2Coverage = s2
    map.set(code, cur)
  }
  return Array.from(map.values()).sort(
    (a, b) => b.maxLevel - a.maxLevel || b.topLevelHa - a.topLevelHa
  )
}

function formatHa(v?: number | string | null): string {
  if (v == null || v === '') return '—'
  const n = Number(v)
  if (!isFinite(n)) return '—'
  return `${n.toLocaleString('vi-VN', { maximumFractionDigits: 0 })} ha`
}

function formatHaShort(v?: number | string | null): string {
  if (v == null || v === '') return '—'
  const n = Number(v)
  if (!isFinite(n)) return '—'
  return n.toLocaleString('vi-VN', { maximumFractionDigits: 0 })
}

/**
 * Unwrap FeatureCollection từ response /fire-risk/map.
 *
 * Server route trả raw GeoJSON (không wrap `{data}`) — nhưng apiClient generic
 * typing coi mọi response là ApiResponse<T>. Do đó cần chấp nhận 2 shape:
 *   1. `{ type: 'FeatureCollection', features: [...] }` — raw (thực tế)
 *   2. `{ data: { type: 'FeatureCollection', ... } }` — nếu sau này server wrap
 */
function extractFeatureCollection(payload: unknown): GeoJSON.FeatureCollection | null {
  if (!payload || typeof payload !== 'object') return null
  const anyPayload = payload as any
  if (anyPayload.type === 'FeatureCollection' && Array.isArray(anyPayload.features)) {
    return anyPayload as GeoJSON.FeatureCollection
  }
  if (anyPayload.data?.type === 'FeatureCollection' && Array.isArray(anyPayload.data.features)) {
    return anyPayload.data as GeoJSON.FeatureCollection
  }
  return null
}

/**
 * Chọn raster tile URL cho map. Fallback chain:
 *   1. Nếu snapshot có `geoserverLayer` (đã publish) + có env
 *      VITE_GEOSERVER_URL → build WMS URL bằng OGC WMS GetMap standard.
 *   2. Fallback về `snapshot.geeTileUrl` — server luôn cố sinh (không cần
 *      GCS). URL TTL ~24h nên với snapshot cũ có thể expired (404 im lặng).
 *   3. Không có URL nào → null → chỉ vẽ vector polygon huyện.
 *
 * NOTE — chấp nhận cả camelCase (`geeTileUrl`) và snake_case (`gee_tile_url`)
 * để tương thích với response cũ / snapshot cũ trong DB.
 */
function resolveRasterTileUrl(snapshot: any): string | null {
  if (!snapshot) return null
  const layer = snapshot.geoserverLayer ?? snapshot.geoserver_layer ?? null
  const geoserverBase = (import.meta.env.VITE_GEOSERVER_URL as string | undefined)
    ?.trim()
    .replace(/\/$/, '')
  if (layer && geoserverBase) {
    const [workspace, layerName] = String(layer).includes(':')
      ? String(layer).split(':')
      : [import.meta.env.VITE_GEOSERVER_WORKSPACE || 'kontum', String(layer)]
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
    // Env VITE_GEOSERVER_URL có thể ở 3 dạng: `.../geoserver`, `.../geoserver/<ws>`
    // hoặc `.../geoserver/<ws>/wms` (config trên .env deploy). Chuẩn hoá về endpoint
    // `<root>/<ws>/wms` để tránh URL kép `.../kontum/wms/kontum/wms`.
    const lower = geoserverBase.toLowerCase()
    let endpoint: string
    if (lower.endsWith('/wms')) {
      endpoint = geoserverBase
    } else if (lower.endsWith(`/${workspace.toLowerCase()}`)) {
      endpoint = `${geoserverBase}/wms`
    } else {
      endpoint = `${geoserverBase}/${workspace}/wms`
    }
    return `${endpoint}?${params.toString()}&bbox={bbox-epsg-3857}`
  }
  const geeTile = snapshot.geeTileUrl ?? snapshot.gee_tile_url ?? null
  return geeTile || null
}
