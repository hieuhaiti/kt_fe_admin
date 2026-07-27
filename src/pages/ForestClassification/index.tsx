import type * as React from 'react'
import { Fragment, useEffect, useRef, useState } from 'react'
import { toast } from 'react-toastify'
import { useQueryClient } from '@tanstack/react-query'
import {
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  GitCompareArrows,
  CircleHelp,
  Layers,
  Loader2,
  MapPin,
  TreePine,
} from 'lucide-react'
import { forestClassificationService, useApiQuery, useApiMutation } from '@/service'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
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
  buildGeoserverPreviewUrl,
  buildGeoserverRasterTileUrl,
  downloadRasterFile,
  getTemporaryRasterUrlStatus,
  getUsableTemporaryRasterUrl,
  normalizeGeoserverLayer,
} from '@/lib/geoserver'
import type {
  ForestClassSnapshot,
  ForestClassAreaComparisonMetric,
  ForestClassClassComparison,
  ForestClassComparison,
  ForestClassDistrictArea,
  ForestClassDistrictClassArea,
  ForestClassDistrictComparison,
  ForestClassDistrictExport,
  ForestClassDistrictExportsData,
  ForestClassHistoryItem,
  ForestClassLatestData,
} from '@/types/api'
import ForestMap, { type RasterLoadStatus } from '@/components/features/ForestMap'
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
 * tương tự nhưng transform khác. Schema v5.3 dùng ID 0 cho pixel không có ảnh,
 * ID 1-11 cho lớp phủ và ID 12 cho pixel không xác định.
 */

// Palette 13-class — trùng với server/src/configs/forest-classification.js
const CLASS_META: Record<number, { color: string; name: string }> = {
  0: { color: '#D9D9D9', name: 'Không có ảnh' },
  1: { color: '#FFBEE8', name: 'Đất khác' },
  2: { color: '#FFEBB0', name: 'Cây công nghiệp' },
  3: { color: '#F0E442', name: 'Đất nông nghiệp' },
  4: { color: '#FEFF73', name: 'Rừng hỗn giao lá rộng, lá kim' },
  5: { color: '#AAFF03', name: 'Rừng lá rộng thường xanh' },
  6: { color: '#D0FF73', name: 'Rừng lá kim' },
  7: { color: '#E7E600', name: 'Rừng lá rộng rụng lá' },
  8: { color: '#4DE600', name: 'Rừng tre nứa' },
  9: { color: '#FFAA01', name: 'Rừng trồng' },
  10: { color: '#73B2FF', name: 'Sông, suối, hồ' },
  11: { color: '#55FF00', name: 'Trảng cỏ, cây bụi' },
  12: { color: '#8C8C8C', name: 'Không xác định' },
}

const FOREST_CLASS_IDS = [4, 5, 6, 7, 8, 9]

const CLASS_HELP: Record<number, string> = {
  1: 'Gồm khu dân cư, đường giao thông, công trình xây dựng, đất trống, bãi cát sỏi, khu khai thác khoáng sản và đá lộ đầu.',
  2: 'Gồm cao su, cà phê, hồ tiêu, điều, mắc ca và các loại cây ăn quả lâu năm.',
  3: 'Gồm đất trồng cây hằng năm như lúa, ngô, sắn, rau màu và nương rẫy luân canh.',
  4: 'Rừng chuyển tiếp có cả cây lá rộng và cây lá kim, phân bố chủ yếu tại khu vực núi cao.',
  5: 'Gồm rừng lá rộng xanh quanh năm, kể cả rừng khép tán, rừng phục hồi và rừng nghèo.',
  6: 'Rừng lá kim tự nhiên, chủ yếu là thông ba lá tại Kon Plông, Đăk Glei và vùng núi cao.',
  7: 'Rừng lá rộng rụng lá theo mùa, gồm các mảnh rừng khộp tại Sa Thầy và Ia H’Drai.',
  8: 'Gồm rừng tre nứa thuần và rừng hỗn giao giữa cây gỗ với tre nứa.',
  9: 'Rừng trồng sản xuất hoặc phòng hộ, chủ yếu gồm thông ba lá, keo, bạch đàn và bời lời.',
  10: 'Gồm sông, suối, hồ tự nhiên và hồ chứa, hồ thủy điện có mặt nước thường xuyên.',
  11: 'Gồm trảng cỏ, cây bụi thấp và đất khoanh nuôi tái sinh chưa đạt tiêu chí thành rừng.',
}

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
const isSamePeriod = (
  first?: Pick<ForestClassHistoryItem, 'year' | 'month'> | null,
  second?: Pick<ForestClassHistoryItem, 'year' | 'month'> | null
) =>
  Boolean(
    first &&
    second &&
    Number(first.year) === Number(second.year) &&
    Number(first.month) === Number(second.month)
  )

function createAreaComparison(
  currentHa: number,
  previousHa: number
): ForestClassAreaComparisonMetric {
  const deltaHa = currentHa - previousHa
  return {
    currentHa,
    previousHa,
    deltaHa,
    changePct: previousHa > 0 ? (deltaHa / previousHa) * 100 : null,
  }
}

function buildSelectedPeriodComparison(
  currentData?: { snapshot: ForestClassSnapshot | null; districtAreas: ForestClassDistrictArea[] },
  previousData?: { snapshot: ForestClassSnapshot | null; districtAreas: ForestClassDistrictArea[] }
): ForestClassComparison | null {
  const current = currentData?.snapshot
  const previous = previousData?.snapshot
  if (
    !current ||
    !previous ||
    String(current.id) === String(previous.id) ||
    (Number(current.year) === Number(previous.year) &&
      Number(current.month) === Number(previous.month))
  ) {
    return null
  }

  const currentByClass = current.provinceSummary?.byClass ?? {}
  const previousByClass = previous.provinceSummary?.byClass ?? {}
  const classIds = Array.from(
    new Set([...Object.keys(currentByClass), ...Object.keys(previousByClass)].map(Number))
  ).sort((a, b) => a - b)
  const currentTotal = Number(current.provinceSummary?.totalHa) || 0
  const previousTotal = Number(previous.provinceSummary?.totalHa) || 0
  const currentForest = FOREST_CLASS_IDS.reduce(
    (sum, id) => sum + (Number(currentByClass[String(id)]) || 0),
    0
  )
  const previousForest = FOREST_CLASS_IDS.reduce(
    (sum, id) => sum + (Number(previousByClass[String(id)]) || 0),
    0
  )

  const previousDistricts = new Map(
    (previousData?.districtAreas ?? []).map((district) => [
      district.districtCode || district.districtName || '',
      district,
    ])
  )
  const districts = (currentData?.districtAreas ?? []).map((district) => {
    const previousDistrict = previousDistricts.get(
      district.districtCode || district.districtName || ''
    )
    const forestArea = (classes: ForestClassDistrictClassArea[] = []) =>
      classes.reduce(
        (sum, item) =>
          FOREST_CLASS_IDS.includes(Number(item.classId)) ? sum + (Number(item.areaHa) || 0) : sum,
        0
      )
    return {
      districtCode: district.districtCode,
      districtName: district.districtName,
      forest: createAreaComparison(
        forestArea(district.classes),
        forestArea(previousDistrict?.classes)
      ),
    }
  })

  return {
    previousSnapshot: {
      id: previous.id,
      year: previous.year,
      month: previous.month,
      computedAt: previous.computedAt,
    },
    province: {
      total: createAreaComparison(currentTotal, previousTotal),
      forest: createAreaComparison(currentForest, previousForest),
      classes: classIds.map((classId) => ({
        classId,
        className: CLASS_META[classId]?.name ?? `Lớp ${classId}`,
        ...createAreaComparison(
          Number(currentByClass[String(classId)]) || 0,
          Number(previousByClass[String(classId)]) || 0
        ),
      })),
    },
    districts,
  }
}

const MIN_ANALYSIS_YEAR = 2015
const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1)
const DISTRICT_RASTER_POLL_INTERVAL_MS = 5_000
const DISTRICT_RASTER_POLL_WINDOW_MS = 5 * 60 * 1_000
const DISTRICT_PUBLISH_POLL_WINDOW_MS = 15 * 60 * 1_000
const isRasterProcessingStatus = (status?: string) =>
  ['pending', 'computing', 'exporting'].includes(String(status || '').toLowerCase())
const ACTIVE_RASTER_INGEST_STATUSES = new Set([
  'pending',
  'downloading',
  'validating',
  'uploading',
  'publishing',
])

const getDistrictTemporaryDownloadUrl = (district: ForestClassDistrictExport) =>
  getUsableTemporaryRasterUrl(
    district.geeDownloadUrl,
    district.geeGeneratedAt ?? district.completedAt
  )

const hasDistrictSource = (district: ForestClassDistrictExport) =>
  Boolean(
    district.minioKey || district.geoserverDownloadUrl || getDistrictTemporaryDownloadUrl(district)
  )

const isDistrictPublished = (district: ForestClassDistrictExport) =>
  Boolean(normalizeGeoserverLayer(district.geoserverLayer))

const isDistrictReady = (district: ForestClassDistrictExport) =>
  Boolean(
    isDistrictPublished(district) &&
    (district.minioKey ||
      district.geoserverDownloadUrl ||
      String(district.status).toLowerCase() === 'published')
  )

const hasActiveDistrictIngest = (district: ForestClassDistrictExport) => {
  const status = String(district.rasterIngestStatus || '').toLowerCase()
  return status ? ACTIVE_RASTER_INGEST_STATUSES.has(status) : Boolean(district.rasterIngestJobId)
}

function readNonNegativeCount(...values: unknown[]): number {
  for (const value of values) {
    if (value == null || value === '') continue
    const parsed = Number(value)
    if (Number.isFinite(parsed) && parsed >= 0) return parsed
  }
  return 0
}

function readOptionalNonNegativeCount(...values: unknown[]): number | undefined {
  for (const value of values) {
    if (value == null || value === '') continue
    const parsed = Number(value)
    if (Number.isFinite(parsed) && parsed >= 0) return parsed
  }
  return undefined
}

function resolveDistrictTotal(
  payload: ForestClassDistrictExportsData | null | undefined,
  districts: ForestClassDistrictExport[] = payload?.districts ?? []
): number {
  const expectedTotal = readOptionalNonNegativeCount(payload?.expectedTotal)
  if (expectedTotal != null && expectedTotal > 0) return expectedTotal

  const total = readOptionalNonNegativeCount(payload?.total)
  if (total != null && total > 0) return total

  const districtCodes = new Set(
    districts.map((district) => String(district.districtCode || '').trim()).filter(Boolean)
  )
  return districtCodes.size || districts.length
}

/**
 * Chọn raster tile URL cho map. Ưu tiên:
 *   1. Ghép các lớp WMS GeoServer theo huyện (nguồn phát hành hiện hành)
 *   2. WMS GeoServer toàn tỉnh kiểu cũ
 *   3. Fallback GEE tile URL
 *   4. null
 */
type ForestRasterTileSource = {
  url: string | null
  kind: 'geoserver-snapshot' | 'geoserver-districts' | 'gee' | 'none'
}

function resolveRasterTileSource(
  snapshot: ForestClassSnapshot | null | undefined,
  districtLayers: Array<string | null | undefined> = [],
  allowProvinceFallback = true
): ForestRasterTileSource {
  if (!snapshot) return { url: null, kind: 'none' }
  const districtTileUrl = buildGeoserverRasterTileUrl(districtLayers)
  if (districtTileUrl) return { url: districtTileUrl, kind: 'geoserver-districts' }
  if (!allowProvinceFallback) return { url: null, kind: 'none' }

  const layer = normalizeGeoserverLayer(
    snapshot.geoserverLayer ?? (snapshot as any).geoserver_layer
  )
  const snapshotTileUrl = buildGeoserverRasterTileUrl(layer ? [layer] : [])
  if (snapshotTileUrl) return { url: snapshotTileUrl, kind: 'geoserver-snapshot' }

  const geeTile = snapshot.geeTileUrl ?? (snapshot as any).gee_tile_url ?? null
  const generatedAt =
    snapshot.geeTileGeneratedAt ??
    (snapshot as any).gee_tile_generated_at ??
    snapshot.computedAt ??
    (snapshot as any).computed_at
  const geeTileUrl = getUsableTemporaryRasterUrl(geeTile, generatedAt)
  return geeTileUrl ? { url: geeTileUrl, kind: 'gee' } : { url: null, kind: 'none' }
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
    cancelled: { label: 'Đã hủy', className: 'bg-slate-100 text-slate-800 border-slate-300' },
    failed: { label: 'Thất bại', className: 'bg-red-100 text-red-800 border-red-300' },
  }
  const meta = map[s] || {
    label: status ? 'Chưa xác định' : '—',
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
  // Chỉ cho chọn tới tháng liền trước tháng hiện tại — tháng đang chạy chưa
  // đủ dữ liệu Sentinel-2 (composite theo tháng cần tháng kết thúc). Nếu hôm
  // nay là tháng 1 → rollback về tháng 12 năm trước.
  const latestAllowedYear = currentMonth === 1 ? currentYear - 1 : currentYear
  const latestAllowedMonth = currentMonth === 1 ? 12 : currentMonth - 1
  const [page, setPage] = useState(1)
  const [refreshDialogOpen, setRefreshDialogOpen] = useState(false)
  const [analysisYear, setAnalysisYear] = useState(latestAllowedYear)
  const [analysisMonth, setAnalysisMonth] = useState(latestAllowedMonth)
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null)
  const [heatVisible, setHeatVisible] = useState(true)
  const [heatOpacity, setHeatOpacity] = useState(0.75)
  const [rasterLoadStatus, setRasterLoadStatus] = useState<RasterLoadStatus>('idle')
  const [compareMode, setCompareMode] = useState(false)
  const [compareCurrentId, setCompareCurrentId] = useState('')
  const [comparePreviousId, setComparePreviousId] = useState('')

  const latestQuery = useApiQuery(['forest-class-latest'], () =>
    forestClassificationService.getLatest()
  )
  const historyQuery = useApiQuery(['forest-class-history', page], () =>
    forestClassificationService.getHistory({ page, limit: 10 })
  )
  const comparisonPeriodsQuery = useApiQuery(
    ['forest-class-published-history'],
    () => forestClassificationService.getPublishedHistory({ page: 1, limit: 100 }),
    { enabled: compareMode },
    false
  )
  const compareCurrentQuery = useApiQuery(
    ['forest-class-compare-snapshot', compareCurrentId],
    () => forestClassificationService.getSnapshot(compareCurrentId),
    { enabled: compareMode && Boolean(compareCurrentId) },
    false
  )
  const comparePreviousQuery = useApiQuery(
    ['forest-class-compare-snapshot', comparePreviousId],
    () => forestClassificationService.getSnapshot(comparePreviousId),
    { enabled: compareMode && Boolean(comparePreviousId) },
    false
  )
  const refreshMutation = useApiMutation((body: any) => forestClassificationService.refresh(body))

  const latest = latestQuery.data?.data
  const snapshot = (latest?.snapshot || null) as ForestClassSnapshot | null
  const districtAreas = (latest?.districtAreas || []) as ForestClassDistrictArea[]
  const comparison = (latest?.comparison || null) as ForestClassComparison | null

  // Snapshot đang xử lý → poll latest mỗi 15s. Auto-stop khi status vào completed/published/failed.
  const activeStatus =
    snapshot?.status && ['pending', 'computing', 'exporting'].includes(snapshot.status)
  useEffect(() => {
    if (!activeStatus) return
    const timer = setInterval(() => {
      latestQuery.refetch()
      historyQuery.refetch()
    }, 15_000)
    return () => clearInterval(timer)
  }, [activeStatus, latestQuery, historyQuery])

  // Per-district export URLs (migration 040) — fetch khi snapshot completed.
  // Không fetch nếu đang computing — giảm noise, chờ snapshot done rồi mới có
  // districts (backend seed pending rồi update dần).
  const snapshotId = snapshot?.id ?? null
  const isSnapshotDone = snapshot?.status === 'completed' || snapshot?.status === 'published'
  const districtPollingRef = useRef({ snapshotId: '', startedAt: 0 })
  const districtPollingSnapshotId = `${String(snapshotId ?? '')}:${isSnapshotDone ? 'done' : 'active'}`
  if (districtPollingRef.current.snapshotId !== districtPollingSnapshotId) {
    districtPollingRef.current = {
      snapshotId: districtPollingSnapshotId,
      startedAt: Date.now(),
    }
  }
  const districtExportsQuery = useApiQuery(
    ['forest-class-district-exports', snapshotId],
    () => forestClassificationService.getDistrictExports(snapshotId!),
    {
      enabled: Boolean(snapshotId) && isSnapshotDone,
      refetchInterval: (query: any) => {
        if (query.state.error) return false
        if (
          !districtPollingRef.current.startedAt ||
          Date.now() - districtPollingRef.current.startedAt >= DISTRICT_RASTER_POLL_WINDOW_MS
        ) {
          return false
        }
        const payload = query.state.data?.data
        const districts = Array.isArray(payload?.districts) ? payload.districts : []
        const expectedTotal = resolveDistrictTotal(payload, districts)
        const publishedCount =
          readOptionalNonNegativeCount(payload?.publishedCount) ??
          districts.filter((district: ForestClassDistrictExport) => isDistrictPublished(district))
            .length
        // Snapshot có thể hoàn thành trước khi worker raster ghi jobId vào từng
        // huyện. Tiếp tục poll cho tới khi đủ layer thay vì phụ thuộc jobId.
        return payload?.fullyPublished !== true &&
          (expectedTotal === 0 || publishedCount < expectedTotal)
          ? DISTRICT_RASTER_POLL_INTERVAL_MS
          : false
      },
    } as any,
    false
  )
  const districtExports = districtExportsQuery.data?.data ?? null
  const history = (historyQuery.data?.data?.items ?? []) as ForestClassHistoryItem[]
  const comparisonPeriods = (comparisonPeriodsQuery.data?.data?.items ??
    []) as ForestClassHistoryItem[]
  const historyMetadata = historyQuery.data?.metadata
  const historyTotal = Number(historyMetadata?.total) || 0
  const lastHistoryTotalPages = useRef(1)
  if (historyMetadata?.totalPages !== undefined) {
    lastHistoryTotalPages.current = Math.max(1, Number(historyMetadata.totalPages) || 0)
  }
  const historyTotalPages = lastHistoryTotalPages.current

  useEffect(() => {
    if (page > historyTotalPages) setPage(historyTotalPages)
  }, [page, historyTotalPages])

  useEffect(() => {
    if (!compareMode || comparisonPeriods.length < 2) return
    const ids = comparisonPeriods.map((item) => String(item.id))
    const nextCurrentId = ids.includes(compareCurrentId) ? compareCurrentId : ids[0]
    const nextCurrentPeriod = comparisonPeriods.find((item) => String(item.id) === nextCurrentId)
    const selectedPreviousPeriod = comparisonPeriods.find(
      (item) => String(item.id) === comparePreviousId
    )
    if (nextCurrentId !== compareCurrentId) setCompareCurrentId(nextCurrentId)
    if (
      !ids.includes(comparePreviousId) ||
      isSamePeriod(selectedPreviousPeriod, nextCurrentPeriod)
    ) {
      const fallbackPrevious = comparisonPeriods.find(
        (item) => !isSamePeriod(item, nextCurrentPeriod)
      )
      setComparePreviousId(fallbackPrevious ? String(fallbackPrevious.id) : '')
    }
  }, [compareCurrentId, compareMode, comparePreviousId, comparisonPeriods])

  const selectedComparison =
    compareCurrentId && comparePreviousId && compareCurrentId !== comparePreviousId
      ? buildSelectedPeriodComparison(
          compareCurrentQuery.data?.data as ForestClassLatestData | undefined,
          comparePreviousQuery.data?.data as ForestClassLatestData | undefined
        )
      : null
  const compareCurrentPeriod = comparisonPeriods.find(
    (item) => String(item.id) === compareCurrentId
  )
  const comparePreviousPeriod = comparisonPeriods.find(
    (item) => String(item.id) === comparePreviousId
  )
  const analysisYears = Array.from(
    { length: latestAllowedYear - MIN_ANALYSIS_YEAR + 1 },
    (_, index) => latestAllowedYear - index
  )

  const snapshotRasterLayer = normalizeGeoserverLayer(
    snapshot?.geoserverLayer ?? (snapshot as any)?.geoserver_layer
  )
  const districtRasterLayers = Array.from(
    new Set(
      ((districtExports?.districts ?? []) as Array<{ geoserverLayer?: string | null }>)
        .map((district) => normalizeGeoserverLayer(district.geoserverLayer))
        .filter((layer): layer is string => Boolean(layer))
    )
  )
  const hasDistrictRasterContract =
    readOptionalNonNegativeCount(districtExports?.expectedTotal) != null &&
    Number(districtExports?.expectedTotal) > 0
  const allowProvinceRasterFallback = !districtExportsQuery.isLoading && !hasDistrictRasterContract
  const rasterTileSource = resolveRasterTileSource(
    snapshot,
    districtRasterLayers,
    allowProvinceRasterFallback
  )
  const rasterTileUrl = rasterTileSource.url
  const temporaryTileStatus = getTemporaryRasterUrlStatus(
    snapshot?.geeTileUrl ?? (snapshot as any)?.gee_tile_url,
    snapshot?.geeTileGeneratedAt ??
      (snapshot as any)?.gee_tile_generated_at ??
      snapshot?.computedAt ??
      (snapshot as any)?.computed_at
  )
  const rasterStatusLabel =
    rasterTileUrl && rasterLoadStatus === 'error'
      ? 'Không tải được dữ liệu bản đồ'
      : rasterTileUrl && rasterLoadStatus === 'loading'
        ? 'Đang tải dữ liệu bản đồ'
        : rasterTileSource.kind === 'geoserver-snapshot'
          ? 'Đang dùng bản đồ toàn tỉnh đã công bố'
          : rasterTileSource.kind === 'geoserver-districts'
            ? `Đang ghép dữ liệu bản đồ của ${districtRasterLayers.length} huyện`
            : rasterTileSource.kind === 'gee'
              ? 'Đang dùng bản xem trước có thời hạn'
              : snapshotRasterLayer || districtRasterLayers.length > 0
                ? 'Bản đồ đã công bố nhưng chưa thể hiển thị trên trình duyệt'
                : temporaryTileStatus === 'expired'
                  ? 'Bản xem trước đã hết hạn'
                  : temporaryTileStatus === 'invalid'
                    ? 'Liên kết bản xem trước không hợp lệ'
                    : 'Chưa có dữ liệu bản đồ khả dụng'
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
            `Đã tiếp nhận yêu cầu phân loại kỳ ${formatPeriod(analysisYear, analysisMonth)}. Hệ thống đang xử lý.`
          )
          setRefreshDialogOpen(false)
          setPage(1)
          setTimeout(() => {
            latestQuery.refetch()
            historyQuery.refetch()
          }, 2000)
        },
        onError: () => {
          toast.error('Không thể chạy phân loại. Vui lòng thử lại.')
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
                Kỳ dữ liệu: <span>{formatPeriod(snapshot.year, snapshot.month)}</span>
              </span>
              <StatusBadge status={snapshot.status} />
              <span
                className={
                  rasterLoadStatus === 'error'
                    ? 'text-red-700'
                    : rasterTileUrl
                      ? 'text-emerald-700'
                      : 'text-warning'
                }
              >
                {rasterTileUrl && rasterLoadStatus === 'error'
                  ? 'Không tải được dữ liệu bản đồ'
                  : rasterTileUrl && rasterLoadStatus === 'loading'
                    ? 'Đang tải dữ liệu bản đồ'
                    : rasterTileUrl
                      ? 'Bản đồ sẵn sàng'
                      : temporaryTileStatus === 'expired'
                        ? 'Bản xem trước đã hết hạn'
                        : 'Chưa có dữ liệu bản đồ khả dụng'}
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
                            if (
                              nextYear === latestAllowedYear &&
                              analysisMonth > latestAllowedMonth
                            ) {
                              setAnalysisMonth(latestAllowedMonth)
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
                                disabled={
                                  analysisYear === latestAllowedYear && month > latestAllowedMonth
                                }
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

      {/* ── Progress banner khi có job đang chạy ─────── */}
      {activeStatus && snapshot && (
        <ForestAnalysisProgressBanner
          snapshot={snapshot}
          districtExports={districtExports}
          isRefreshing={isRefreshing}
        />
      )}

      {/* ── Ground truth (collapsible) ─────────────── */}
      <ForestGroundTruthCard />

      <Card>
        <CardContent className="space-y-4 p-4 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 font-semibold">
                <GitCompareArrows className="text-primary h-4 w-4" />
                So sánh hai kỳ
              </h2>
              <p className="text-muted-foreground mt-1 text-xs">
                Chọn hai kỳ đã công bố để xem chênh lệch diện tích lớp phủ.
              </p>
            </div>
            <Button
              type="button"
              variant={compareMode ? 'secondary' : 'outline'}
              onClick={() => setCompareMode((current) => !current)}
            >
              {compareMode ? 'Đóng so sánh' : 'Mở so sánh'}
            </Button>
          </div>

          {compareMode && (
            <div className="space-y-4 border-t pt-4">
              {comparisonPeriodsQuery.isLoading ? (
                <div className="text-muted-foreground flex items-center gap-2 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Đang tải danh sách kỳ dữ liệu...
                </div>
              ) : comparisonPeriodsQuery.isError ? (
                <p className="text-sm text-red-700">
                  Không thể tải danh sách kỳ đã công bố. Vui lòng thử lại.
                </p>
              ) : comparisonPeriods.length < 2 ? (
                <p className="text-warning text-sm">
                  Cần ít nhất hai kỳ đã công bố để thực hiện so sánh.
                </p>
              ) : (
                <>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="space-y-1.5 text-xs font-medium">
                      <span>Kỳ cần xem</span>
                      <Select
                        value={compareCurrentId}
                        onValueChange={(value) => {
                          const nextPeriod = comparisonPeriods.find(
                            (item) => String(item.id) === value
                          )
                          if (isSamePeriod(nextPeriod, comparePreviousPeriod)) {
                            toast.warning('Hai kỳ so sánh không được trùng nhau.')
                            return
                          }
                          setCompareCurrentId(value)
                        }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Chọn kỳ cần xem" />
                        </SelectTrigger>
                        <SelectContent>
                          {comparisonPeriods.map((item) => (
                            <SelectItem
                              key={item.id}
                              value={String(item.id)}
                              disabled={isSamePeriod(item, comparePreviousPeriod)}
                            >
                              Kỳ {formatPeriod(Number(item.year), Number(item.month))}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </label>

                    <label className="space-y-1.5 text-xs font-medium">
                      <span>Kỳ đối chiếu</span>
                      <Select
                        value={comparePreviousId}
                        onValueChange={(value) => {
                          const nextPeriod = comparisonPeriods.find(
                            (item) => String(item.id) === value
                          )
                          if (isSamePeriod(nextPeriod, compareCurrentPeriod)) {
                            toast.warning('Hai kỳ so sánh không được trùng nhau.')
                            return
                          }
                          setComparePreviousId(value)
                        }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Chọn kỳ đối chiếu" />
                        </SelectTrigger>
                        <SelectContent>
                          {comparisonPeriods.map((item) => (
                            <SelectItem
                              key={item.id}
                              value={String(item.id)}
                              disabled={isSamePeriod(item, compareCurrentPeriod)}
                            >
                              Kỳ {formatPeriod(Number(item.year), Number(item.month))}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </label>
                  </div>

                  {compareCurrentQuery.isLoading || comparePreviousQuery.isLoading ? (
                    <div className="text-muted-foreground flex items-center gap-2 text-sm">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Đang tính toán chênh lệch hai kỳ...
                    </div>
                  ) : compareCurrentQuery.isError || comparePreviousQuery.isError ? (
                    <p className="text-sm text-red-700">
                      Không thể tải chi tiết một trong hai kỳ đã chọn.
                    </p>
                  ) : selectedComparison ? (
                    <>
                      <ComparisonCard comparison={selectedComparison} />
                      <CollapsibleSection
                        title="Chi tiết biến động theo lớp phủ"
                        hint={`${formatPeriod(
                          selectedComparison.previousSnapshot.year,
                          selectedComparison.previousSnapshot.month
                        )} → ${
                          compareCurrentQuery.data?.data?.snapshot
                            ? formatPeriod(
                                compareCurrentQuery.data.data.snapshot.year,
                                compareCurrentQuery.data.data.snapshot.month
                              )
                            : '—'
                        }`}
                        defaultOpen
                      >
                        <ClassAreaTable
                          byClass={
                            compareCurrentQuery.data?.data?.snapshot?.provinceSummary?.byClass ?? {}
                          }
                          comparison={selectedComparison.province.classes}
                        />
                      </CollapsibleSection>
                    </>
                  ) : null}
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Overview ─────────────────────────────────── */}
      <Card>
        <CardContent className="space-y-4 p-4 sm:p-6">
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Đang tải dữ liệu phân loại...</p>
          ) : latestQuery.isError ? (
            <p className="text-sm text-red-700">
              Không tải được dữ liệu phân loại lớp phủ rừng. Vui lòng thử lại sau.
            </p>
          ) : !snapshot ? (
            <p className="text-warning text-sm">
              Chưa có dữ liệu phân loại. Hãy chạy phân loại lần đầu.
            </p>
          ) : (
            <>
              {/* KPI — OOB xuất hiện với snapshot mới; Kappa chỉ có khi server
                  chạy đánh giá bằng ground-truth holdout. "Lớp biến động" chỉ
                  hiện khi có comparison (kỳ trước). */}
              {(() => {
                const parsedOobAccuracy =
                  snapshot.oobAccuracy == null ? Number.NaN : Number(snapshot.oobAccuracy)
                const parsedTestKappa =
                  snapshot.testKappa == null ? Number.NaN : Number(snapshot.testKappa)
                const oobAccuracy = Number.isFinite(parsedOobAccuracy) ? parsedOobAccuracy : null
                const testKappa = Number.isFinite(parsedTestKappa) ? parsedTestKappa : null
                const hasOob = oobAccuracy != null
                const hasKappa = testKappa != null
                // Top-1 class biến động — chỉ có khi comparison + có delta khác 0.
                const topChange =
                  comparison?.province.classes
                    ?.filter((item) => item.deltaHa !== 0)
                    ?.sort((a, b) => Math.abs(b.deltaHa) - Math.abs(a.deltaHa))?.[0] || null
                const hasChange = Boolean(topChange)
                const nCards = 2 + (hasOob ? 1 : 0) + (hasKappa ? 1 : 0) + (hasChange ? 1 : 0)
                const grid =
                  nCards >= 5
                    ? 'sm:grid-cols-2 lg:grid-cols-5'
                    : nCards >= 4
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
                    {hasChange && topChange && (
                      <Stat
                        label="Lớp biến động nhiều nhất"
                        hint={`So với kỳ ${formatPeriod(
                          comparison!.previousSnapshot.year,
                          comparison!.previousSnapshot.month
                        )} · ${topChange.className}`}
                        value={
                          <span className="flex items-center gap-2">
                            <span
                              className="inline-block h-3 w-3 shrink-0 rounded-sm border"
                              style={{ backgroundColor: CLASS_META[topChange.classId]?.color }}
                            />
                            <span className="truncate">{topChange.className}</span>
                          </span>
                        }
                        sub={formatAreaChange(topChange)}
                        tone={topChange.deltaHa >= 0 ? 'success' : 'danger'}
                      />
                    )}
                    {hasOob && (
                      <Stat
                        label="Độ chính xác mô hình"
                        hint="Độ chính xác ước tính của kết quả phân loại"
                        value={formatPct(oobAccuracy)}
                      />
                    )}
                    {hasKappa && (
                      <Stat
                        label="Mức đồng thuận"
                        hint="Mức phù hợp giữa kết quả và dữ liệu kiểm chứng"
                        value={testKappa!.toFixed(3)}
                      />
                    )}
                  </div>
                )
              })()}

              {comparison && <ComparisonCard comparison={comparison} />}

              {/* Class distribution bar — collapsible, mở mặc định vì đây là
                  chỉ số quan trọng nhất (breakdown 11 lớp toàn tỉnh). */}
              <CollapsibleSection
                title="Phân bố kết quả phân loại"
                hint={`Tổng ${formatHa(totalHa)} · Rừng ${formatHa(forestHa)} (${formatPct(forestPct)})`}
                defaultOpen
              >
                <ClassDistributionBar byClass={byClass} totalHa={totalHa} />
              </CollapsibleSection>

              {/* Map + layer control */}
              <div className="grid items-stretch gap-4 lg:grid-cols-3">
                <div className="lg:col-span-2 lg:h-[560px]">
                  <ForestMap
                    rasterTileUrl={rasterTileUrl}
                    legend={legend}
                    opacity={heatOpacity}
                    visible={heatVisible}
                    heightClassName="h-[420px] lg:h-full"
                    onRasterStatusChange={setRasterLoadStatus}
                  />
                </div>
                <div className="lg:h-[560px]">
                  <LayerManager
                    heatVisible={heatVisible}
                    heatOpacity={heatOpacity}
                    onHeatVisibleChange={setHeatVisible}
                    onHeatOpacityChange={setHeatOpacity}
                    rasterAvailable={Boolean(rasterTileUrl) && rasterLoadStatus !== 'error'}
                    rasterStatusLabel={rasterStatusLabel}
                    districtExports={districtExports}
                    isLoadingDistricts={districtExportsQuery.isLoading}
                    isDistrictExportsError={districtExportsQuery.isError}
                    snapshotGeoserverLayer={snapshot.geoserverLayer}
                  />
                </div>
              </div>

              {/* Bảng chi tiết 11 lớp — collapsible, mặc định đóng vì đã có
                  ClassDistributionBar summary ở trên. User mở khi cần số cụ thể. */}
              <CollapsibleSection
                title="Bảng chi tiết 11 lớp phủ"
                hint="Diện tích, tỷ lệ và nội dung của từng lớp phủ"
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
            {/* Đếm số lần chạy trên mỗi kỳ để show "#n" khi cùng (year, month)
                xuất hiện nhiều lần (migration 040 cho phép nhiều attempt/kỳ).
                Không group vì cần thấy được mỗi attempt riêng biệt cho audit. */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead>Kỳ</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead className="text-right">Độ chính xác</TableHead>
                  <TableHead className="text-right">Tổng ha</TableHead>
                  <TableHead className="text-right">Rừng ha</TableHead>
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
                  const attempt = (h as any).attempt as number | undefined
                  // Show attempt badge chỉ khi >1 (attempt=1 là mặc định, không cần chú thích).
                  const showAttempt = attempt != null && attempt > 1
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
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <span>{formatPeriod(h.year, h.month)}</span>
                            {showAttempt && (
                              <Badge
                                variant="outline"
                                className="border-slate-300 bg-slate-50 text-[10px] text-slate-600"
                                title={`Lần chạy thứ ${attempt} của cùng kỳ này`}
                              >
                                #{attempt}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
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
                          {h.computed_at ? formatDateTime(h.computed_at) : '—'}
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow className="bg-muted/20">
                          <TableCell colSpan={7}>
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

/**
 * Banner hiển thị tiến độ khi snapshot đang pending / computing / exporting.
 * Poll snapshot mới nhất (đã set up ở page-level useEffect 15s) — banner tự
 * biến mất khi status vào completed/published/failed.
 *
 * Nội dung:
 *   - Kỳ + trạng thái + attempt (giúp phân biệt run lần 2 cùng ngày)
 *   - Tiến độ per-district (nếu backend đã seed rows: X/Y huyện hoàn tất)
 *   - Loading spinner + text mô tả stage hiện tại
 */
function ForestAnalysisProgressBanner({
  snapshot,
  districtExports,
  isRefreshing,
}: {
  snapshot: ForestClassSnapshot
  districtExports: {
    total: number
    completed: number
    failed: number
    skipped: number
    pending: number
  } | null
  isRefreshing: boolean
}) {
  const stageDescription = (() => {
    switch (snapshot.status) {
      case 'pending':
        return 'Đang chuẩn bị dữ liệu vệ tinh cho kỳ được yêu cầu...'
      case 'computing':
        return 'Đang phân tích ảnh vệ tinh và phân loại 13 nhóm lớp phủ.'
      case 'exporting':
        return 'Đang tạo và lưu bản đồ kết quả. Sắp hoàn tất.'
      default:
        return 'Đang xử lý...'
    }
  })()

  const pct =
    districtExports && districtExports.total > 0
      ? Math.round(
          ((districtExports.completed + districtExports.failed + districtExports.skipped) /
            districtExports.total) *
            100
        )
      : 0

  return (
    <Card className="border-sky-300 bg-sky-50/60">
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:p-5">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-sky-100 p-2">
            <Loader2 className="h-5 w-5 animate-spin text-sky-700" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-sky-900">
                Đang phân loại kỳ {formatPeriod(snapshot.year, snapshot.month)}
              </p>
              <StatusBadge status={snapshot.status} />
              {(snapshot as any).attempt != null && (
                <Badge
                  variant="outline"
                  className="border-sky-300 bg-white text-[10px] text-sky-800"
                  title="Số lần đã chạy trong cùng kỳ này"
                >
                  Lần chạy #{(snapshot as any).attempt}
                </Badge>
              )}
            </div>
            <p className="mt-0.5 text-xs text-sky-800/80">{stageDescription}</p>
          </div>
        </div>

        {districtExports && districtExports.total > 0 && (
          <div className="min-w-45 flex-1 sm:max-w-md">
            <div className="mb-1 flex items-center justify-between text-[11px] font-medium text-sky-900">
              <span>
                {districtExports.completed}/{districtExports.total} huyện hoàn tất
              </span>
              <span>{pct}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-sky-200">
              <div
                className="h-full rounded-full bg-sky-600 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            {districtExports.failed > 0 && (
              <p className="text-warning mt-1 text-[11px]">
                {districtExports.failed} huyện thất bại — hệ thống sẽ tự thử lại.
              </p>
            )}
          </div>
        )}

        {isRefreshing && <p className="text-[11px] text-sky-800">Đang gửi yêu cầu chạy lại...</p>}
      </CardContent>
    </Card>
  )
}

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
        ? 'text-warning'
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
        <span className="text-muted-foreground font-semibold">Phân bố kết quả phân loại</span>
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
  // "Tổng diện tích" đã BỎ theo yêu cầu: 2 attempt cùng ngày chênh 0 ha nhìn
  // vô nghĩa. Giữ "Diện tích rừng" + top-3 lớp biến động — đây là 2 chỉ số
  // thật sự phản ánh động thái so với kỳ trước.
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
      <div className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_minmax(220px,1.4fr)]">
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
  const rows = Object.entries(CLASS_META)
    .filter(([id]) => Number(id) >= 1 && Number(id) <= 11)
    .map(([id, meta]) => {
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
    <TooltipProvider delayDuration={150}>
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
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring cursor-help rounded-sm focus-visible:ring-2 focus-visible:outline-none"
                          aria-label={`Xem mô tả lớp ${r.name}`}
                        >
                          <CircleHelp className="h-4 w-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-xs leading-relaxed">
                        <p className="font-medium">{r.name}</p>
                        <p className="text-muted-foreground mt-1 text-xs">
                          {CLASS_HELP[r.classId]}
                        </p>
                      </TooltipContent>
                    </Tooltip>
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
    </TooltipProvider>
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
                <TableCell className="font-mono text-xs whitespace-nowrap">{g.code}</TableCell>
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
 * Layer manager — visibility + opacity + DOWNLOAD PER HUYỆN (migration 040).
 *
 * Trước 040: 1 GeoTIFF toàn tỉnh scale 500m → 1 nút tải.
 * Sau 040: N huyện × 1 URL theo scale cấu hình (fallback 150m) → cần list N mục có trạng thái +
 * nút tải riêng cho từng huyện. Có thêm "Tải tất cả" (loop stream).
 */
function LayerManager({
  heatVisible,
  heatOpacity,
  onHeatVisibleChange,
  onHeatOpacityChange,
  rasterAvailable,
  rasterStatusLabel,
  districtExports,
  isLoadingDistricts,
  isDistrictExportsError,
  snapshotGeoserverLayer,
}: {
  heatVisible: boolean
  heatOpacity: number
  onHeatVisibleChange: (v: boolean) => void
  onHeatOpacityChange: (v: number) => void
  rasterAvailable: boolean
  rasterStatusLabel: string
  districtExports: ForestClassDistrictExportsData | null
  isLoadingDistricts: boolean
  isDistrictExportsError: boolean
  snapshotGeoserverLayer?: string | null
}) {
  const [open, setOpen] = useState(true)
  const [downloadOpen, setDownloadOpen] = useState(true)
  const [batchBusy, setBatchBusy] = useState(false)

  const districts = districtExports?.districts ?? []
  const getDistrictDownloadUrl = (district: ForestClassDistrictExport) =>
    district.geoserverDownloadUrl ||
    buildGeoserverDownloadUrl(district.geoserverLayer) ||
    getDistrictTemporaryDownloadUrl(district)
  const availableDistricts = districts.filter((district) =>
    Boolean(getDistrictDownloadUrl(district))
  )
  const sourceDistrictCount =
    readOptionalNonNegativeCount(districtExports?.sourceCount) ??
    districts.filter(hasDistrictSource).length
  const publishedDistrictCount =
    readOptionalNonNegativeCount(districtExports?.publishedCount) ??
    districts.filter(isDistrictPublished).length
  const expectedDistrictTotal = resolveDistrictTotal(districtExports, districts)
  const provinceDownloadUrl = buildGeoserverDownloadUrl(snapshotGeoserverLayer)
  const hasDownloadArtifacts = Boolean(provinceDownloadUrl || availableDistricts.length)

  const downloadOneDistrict = async (d: ForestClassDistrictExport): Promise<boolean> => {
    const url = getDistrictDownloadUrl(d)
    const filename =
      d.downloadFilename ||
      d.geeDownloadFilename ||
      `forest_class_${d.districtCode || 'kontum'}.tif`
    if (!url) {
      toast.error(`Huyện ${d.districtName || d.districtCode}: chưa có bản đồ tải xuống.`)
      return false
    }
    try {
      await downloadRasterFile(url, filename)
      return true
    } catch {
      toast.error(`Không thể tải dữ liệu huyện ${d.districtName}.`)
      return false
    }
  }

  const downloadAll = async () => {
    if (batchBusy) return
    setBatchBusy(true)
    try {
      // Tải tuần tự để tránh trình duyệt chặn nhiều lượt tải cùng lúc.
      let ok = 0
      for (const d of availableDistricts) {
        if (await downloadOneDistrict(d)) ok += 1
      }
      if (ok > 0) toast.success(`Đã tải ${ok}/${availableDistricts.length} huyện.`)
    } finally {
      setBatchBusy(false)
    }
  }

  return (
    <div className="bg-card overflow-hidden rounded-md border lg:flex lg:h-full lg:flex-col">
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
        <div className="space-y-3 border-t p-3 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
          <div
            className={`rounded-md border p-2 transition-opacity ${
              rasterAvailable && heatVisible ? '' : 'opacity-60'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <span
                className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                  rasterAvailable ? 'bg-orange-500' : 'bg-muted-foreground'
                }`}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">Bản đồ lớp phủ rừng</p>
                <p className="text-muted-foreground mt-0.5 text-[10px] leading-4">
                  {rasterStatusLabel}
                </p>
              </div>
              {rasterAvailable && (
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
              )}
            </div>
            {rasterAvailable && (
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
            )}
          </div>

          {/* Mỗi huyện có một tệp riêng; kết quả toàn tỉnh cũ vẫn được giữ
              để tương thích với các kỳ dữ liệu trước. */}
          {isDistrictExportsError ? (
            <div className="border-warning/30 bg-warning/10 text-warning rounded-md border p-2 text-xs">
              <div className="flex items-center gap-1.5 font-semibold">
                <Download size={14} />
                <span>Tệp tải xuống chưa khả dụng</span>
              </div>
              <p className="mt-1">
                Không tải được danh sách huyện. Không có liên kết tải nào được hiển thị.
              </p>
            </div>
          ) : !isLoadingDistricts && !hasDownloadArtifacts && !districts.length ? (
            <div className="rounded-md border p-2 text-xs">
              <div className="text-muted-foreground flex items-center gap-1.5 font-semibold">
                <Download size={14} />
                <span>Chưa có tệp tải xuống cho kỳ này</span>
              </div>
            </div>
          ) : (
            <div className="overflow-hidden rounded-md border">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setDownloadOpen((o) => !o)}
                aria-expanded={downloadOpen}
                className={`flex h-auto w-full items-center justify-between rounded-none px-2 py-1.5 text-xs font-normal transition-colors ${
                  downloadOpen ? 'bg-primary/10 hover:bg-primary/15' : 'hover:bg-muted/50'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Download size={14} className="text-primary" />
                  <span className="font-semibold">
                    Tệp tải xuống ({availableDistricts.length}/{expectedDistrictTotal} huyện)
                  </span>
                  {districtExports?.scaleM ? (
                    <Badge variant="outline" className="text-[10px]">
                      {districtExports.scaleM}m
                    </Badge>
                  ) : null}
                </div>
                {downloadOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </Button>
              {downloadOpen && (
                <div className="space-y-2 border-t p-2 text-xs">
                  {isLoadingDistricts && (
                    <div className="text-muted-foreground flex items-center gap-2">
                      <Loader2 size={12} className="animate-spin" />
                      <span>Đang tải danh sách huyện...</span>
                    </div>
                  )}

                  {districtExports && expectedDistrictTotal > 0 && (
                    <div className="grid grid-cols-2 gap-1.5">
                      <div className="border-warning/20 bg-warning/10 rounded-md border p-1.5">
                        <p className="text-muted-foreground text-[9px] uppercase">
                          Dữ liệu theo huyện
                        </p>
                        <p className="text-warning font-semibold">
                          {sourceDistrictCount}/{expectedDistrictTotal} huyện
                        </p>
                      </div>
                      <div className="rounded-md border bg-emerald-50/50 p-1.5">
                        <p className="text-muted-foreground text-[9px] uppercase">Đã công bố</p>
                        <p className="font-semibold text-emerald-800">
                          {publishedDistrictCount}/{expectedDistrictTotal} huyện
                        </p>
                      </div>
                    </div>
                  )}

                  {provinceDownloadUrl && (
                    <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50/50 p-1.5">
                      <MapPin size={12} className="shrink-0 text-emerald-700" />
                      <span className="min-w-0 flex-1 truncate font-medium text-emerald-800">
                        Toàn tỉnh
                      </span>
                      <Button
                        size="xs"
                        variant="link"
                        className="h-auto shrink-0 p-0 text-[11px] text-emerald-700"
                        onClick={async () => {
                          try {
                            await downloadRasterFile(provinceDownloadUrl, 'forest_class_kontum.tif')
                          } catch {
                            toast.error('Không thể tải dữ liệu toàn tỉnh.')
                          }
                        }}
                      >
                        <Download size={11} /> Tải
                      </Button>
                    </div>
                  )}

                  {availableDistricts.length > 0 && (
                    <Button
                      size="xs"
                      variant="outline"
                      className="h-7 w-full"
                      onClick={downloadAll}
                      disabled={batchBusy}
                    >
                      {batchBusy ? (
                        <>
                          <Loader2 size={12} className="mr-1 animate-spin" />
                          Đang tải hàng loạt...
                        </>
                      ) : (
                        <>
                          <Download size={12} className="mr-1" />
                          Tải {availableDistricts.length} huyện đã sẵn sàng
                        </>
                      )}
                    </Button>
                  )}

                  {districts.length > 0 && (
                    <div className="max-h-56 space-y-1 overflow-y-auto">
                      {districts.map((district) => {
                        const geoserverLayer = normalizeGeoserverLayer(district.geoserverLayer)
                        const temporaryDownloadStatus = getTemporaryRasterUrlStatus(
                          district.geeDownloadUrl,
                          district.geeGeneratedAt ?? district.completedAt
                        )
                        const canDownload = Boolean(getDistrictDownloadUrl(district))
                        // Link mở xem trước huyện trên máy chủ bản đồ (chỉ khi
                        // đã publish layer stable — không có layer thì URL 404).
                        const previewUrl = geoserverLayer
                          ? buildGeoserverPreviewUrl(geoserverLayer)
                          : null
                        const unavailableLabel =
                          temporaryDownloadStatus === 'expired'
                            ? 'Liên kết đã hết hạn'
                            : temporaryDownloadStatus === 'invalid'
                              ? 'Liên kết không hợp lệ'
                              : geoserverLayer
                                ? 'Chưa có liên kết tải'
                                : isRasterProcessingStatus(district.status)
                                  ? 'Đang xử lý'
                                  : 'Không có tệp'
                        return (
                          <div
                            key={district.districtCode}
                            className="hover:bg-muted/40 flex items-center gap-2 rounded-md border p-1.5"
                          >
                            <DistrictStatusDot status={district.status} />
                            <span className="min-w-0 flex-1 truncate">
                              {district.districtName || district.districtCode}
                            </span>
                            {geoserverLayer && (
                              <Badge
                                variant="outline"
                                className="border-emerald-300 bg-emerald-50 text-[9px] text-emerald-700"
                                title="Đã phân phát ổn định"
                              >
                                Ổn định
                              </Badge>
                            )}
                            {previewUrl ? (
                              <Button
                                size="icon-xs"
                                variant="ghost"
                                asChild
                                title={`Mở xem trước ${district.districtName || district.districtCode}`}
                                aria-label={`Mở xem trước ${district.districtName || district.districtCode}`}
                              >
                                <a href={previewUrl} target="_blank" rel="noreferrer noopener">
                                  <ExternalLink size={12} />
                                </a>
                              </Button>
                            ) : null}
                            {canDownload ? (
                              <Button
                                size="icon-xs"
                                variant="ghost"
                                onClick={() => downloadOneDistrict(district)}
                                title={`Tải ${district.districtName || district.districtCode}`}
                                aria-label={`Tải ${district.districtName || district.districtCode}`}
                              >
                                <Download size={12} />
                              </Button>
                            ) : (
                              <span
                                className="text-muted-foreground shrink-0 text-[10px]"
                                title={
                                  district.errorMessage
                                    ? 'Không thể chuẩn bị dữ liệu huyện này'
                                    : unavailableLabel
                                }
                              >
                                {unavailableLabel}
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {districtExports?.failed && districtExports.failed > 0 ? (
                    <p className="text-warning">
                      {districtExports.failed} huyện thất bại. Chạy lại phân tích để thử lại.
                    </p>
                  ) : null}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Chấm màu status huyện — completed xanh, computing xanh dương xoay, failed đỏ.
function DistrictStatusDot({ status }: { status: string }) {
  if (status === 'completed' || status === 'published') {
    return <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" title="Hoàn thành" />
  }
  if (status === 'computing' || status === 'pending') {
    return <Loader2 size={10} className="shrink-0 animate-spin text-sky-600" />
  }
  if (status === 'failed') {
    return <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" title="Thất bại" />
  }
  if (status === 'skipped') {
    return <span className="h-2 w-2 shrink-0 rounded-full bg-slate-400" title="Bỏ qua" />
  }
  return <span className="h-2 w-2 shrink-0 rounded-full bg-slate-300" />
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
  const [publishGoalCount, setPublishGoalCount] = useState<number | null>(null)
  const publishStartedAtRef = useRef(0)
  const publishRequestIdRef = useRef(0)
  const districtPollingStartedAtRef = useRef(Date.now())
  const queryClient = useQueryClient()
  const geoserverLayer = normalizeGeoserverLayer(item.geoserver_layer)
  const districtExportsQuery = useApiQuery(
    ['forest-class-history-district-exports', item.id],
    () => forestClassificationService.getDistrictExports(item.id),
    {
      refetchInterval: (query: any) => {
        const payload = query.state.data?.data as ForestClassDistrictExportsData | undefined
        const districts = payload?.districts ?? []
        const hasPendingPublish =
          Number(payload?.queuedCount ?? 0) > 0 ||
          districts.some(
            (district) =>
              !isDistrictReady(district) &&
              (hasActiveDistrictIngest(district) || isRasterProcessingStatus(district.status))
          )
        const withinPublishWindow =
          publishStartedAtRef.current > 0 &&
          Date.now() - publishStartedAtRef.current < DISTRICT_PUBLISH_POLL_WINDOW_MS
        const withinStatusWindow =
          Date.now() - districtPollingStartedAtRef.current < DISTRICT_PUBLISH_POLL_WINDOW_MS
        return withinStatusWindow && ((busy && withinPublishWindow) || hasPendingPublish)
          ? DISTRICT_RASTER_POLL_INTERVAL_MS
          : false
      },
    } as any,
    false
  )
  const districtExports = districtExportsQuery.data?.data ?? null
  const districts = districtExports?.districts ?? []
  const districtTotal = resolveDistrictTotal(districtExports, districts)
  const districtSourceCount =
    readOptionalNonNegativeCount(districtExports?.sourceCount) ??
    districts.filter(hasDistrictSource).length
  const districtStoredCount =
    readOptionalNonNegativeCount(districtExports?.storedCount) ??
    districts.filter((district) => Boolean(district.minioKey)).length
  const districtPublishedCount =
    readOptionalNonNegativeCount(districtExports?.publishedCount) ??
    districts.filter(isDistrictPublished).length
  const districtReadyCount =
    readOptionalNonNegativeCount(districtExports?.readyCount, districtExports?.ready) ??
    districts.filter(isDistrictReady).length
  const publishableDistrictCount = Math.max(0, districtSourceCount - districtReadyCount)
  const districtPublishInFlight =
    districts.some(
      (district) =>
        !isDistrictReady(district) &&
        !district.errorMessage &&
        (hasActiveDistrictIngest(district) || isRasterProcessingStatus(district.status))
    ) || Number(districtExports?.queuedCount ?? 0) > 0
  const hasDistrictArtifacts = districtTotal > 0 || districts.length > 0
  const temporaryDownloadStatus = getTemporaryRasterUrlStatus(
    item.gee_download_url,
    (item as any).gee_download_generated_at ?? item.computed_at
  )
  const temporaryTileStatus = getTemporaryRasterUrlStatus(
    item.gee_tile_url,
    item.gee_tile_generated_at ?? item.computed_at
  )
  const hasLegacyDownload = temporaryDownloadStatus === 'available'
  const published = hasDistrictArtifacts
    ? districtExports?.fullyPublished === true ||
      (districtTotal > 0 &&
        districtPublishedCount >= districtTotal &&
        districtReadyCount >= districtTotal)
    : Boolean(geoserverLayer)
  const hasPublishSource = hasDistrictArtifacts ? publishableDistrictCount > 0 : hasLegacyDownload
  const canPublish = canPublishRaster && hasPublishSource && !published && !busy

  const startPublish = async () => {
    if (!canPublish) return
    setBusy(true)
    setPublishGoalCount(null)
    publishStartedAtRef.current = Date.now()
    districtPollingStartedAtRef.current = Date.now()
    const requestId = ++publishRequestIdRef.current
    try {
      const res = await forestClassificationService.publishSnapshotRaster(item.id)
      if (publishRequestIdRef.current !== requestId) return
      const responseData = res.data
      const jobs = Array.isArray(responseData?.jobs) ? responseData.jobs : []
      const queuedCount = readNonNegativeCount(
        responseData?.queuedCount,
        responseData?.queued,
        responseData?.enqueuedCount,
        responseData?.enqueued,
        jobs.length
      )
      const responsePublishedCount = readNonNegativeCount(
        responseData?.publishedCount,
        responseData?.published
      )
      const responseReadyCount = readNonNegativeCount(
        responseData?.readyCount,
        responseData?.ready,
        responsePublishedCount
      )
      const responseTotal = readNonNegativeCount(
        responseData?.totalDistricts,
        responseData?.total,
        districtTotal
      )

      if (responseData?.alreadyPublished) {
        await Promise.all([
          queryClient.refetchQueries({ queryKey: ['forest-class-latest'], type: 'active' }),
          queryClient.refetchQueries({ queryKey: ['forest-class-history'], type: 'active' }),
          districtExportsQuery.refetch(),
        ])
        toast.info(
          `Kết quả đã được công bố trên bản đồ (${responsePublishedCount || responseTotal}/${responseTotal} huyện).`
        )
        setBusy(false)
        publishStartedAtRef.current = 0
        return
      }

      // Tương thích endpoint cũ chỉ trả một job toàn tỉnh.
      if (responseData?.jobId && !hasDistrictArtifacts) {
        setIngestJobId(Number(responseData.jobId))
      }

      if (queuedCount > 0) {
        setPublishGoalCount(
          Math.min(responseTotal || districtTotal, responseReadyCount + queuedCount)
        )
        toast.success(`Đã xếp hàng công bố bản đồ cho ${queuedCount} huyện.`)
        await districtExportsQuery.refetch()
        return
      }

      await districtExportsQuery.refetch()
      setBusy(false)
      publishStartedAtRef.current = 0
      toast.info('Không có tệp huyện mới cần đưa lên bản đồ.')
    } catch {
      if (publishRequestIdRef.current !== requestId) return
      toast.error('Không thể cập nhật bản đồ. Vui lòng thử lại.')
      setBusy(false)
      setPublishGoalCount(null)
      publishStartedAtRef.current = 0
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
    setPublishGoalCount(null)
    publishStartedAtRef.current = 0
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
      toast.error('Không thể cập nhật bản đồ. Vui lòng thử lại.')
    }
  }, [terminal, busy, job?.status, job?.geoserver_layer, job?.error_log, queryClient])

  useEffect(() => {
    if (!busy || !hasDistrictArtifacts) return

    const reachedPublishGoal =
      published || (publishGoalCount != null && districtReadyCount >= publishGoalCount)
    if (reachedPublishGoal) {
      setBusy(false)
      setPublishGoalCount(null)
      publishStartedAtRef.current = 0
      publishRequestIdRef.current += 1
      toast.success(`Đã công bố bản đồ cho ${districtReadyCount}/${districtTotal} huyện.`)
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ['forest-class-latest'] }),
        queryClient.invalidateQueries({ queryKey: ['forest-class-history'] }),
        queryClient.invalidateQueries({
          queryKey: ['forest-class-district-exports', item.id],
        }),
      ])
      return
    }

    if (publishGoalCount == null) return

    if (
      !districtPublishInFlight &&
      Number(districtExports?.failedPublishCount ?? districtExports?.failed) > 0 &&
      districtReadyCount < publishGoalCount
    ) {
      setBusy(false)
      setPublishGoalCount(null)
      publishStartedAtRef.current = 0
      toast.error(
        `Công bố chưa hoàn tất: ${districtReadyCount}/${districtTotal} huyện đã được lưu ổn định.`
      )
    }
  }, [
    busy,
    districtExports?.failed,
    districtExports?.failedPublishCount,
    districtPublishInFlight,
    districtPublishedCount,
    districtReadyCount,
    districtTotal,
    hasDistrictArtifacts,
    item.id,
    publishGoalCount,
    published,
    queryClient,
  ])

  useEffect(() => {
    if (!busy || publishStartedAtRef.current <= 0) return
    const elapsed = Date.now() - publishStartedAtRef.current
    const remaining = Math.max(0, DISTRICT_PUBLISH_POLL_WINDOW_MS - elapsed)
    const timer = window.setTimeout(() => {
      setBusy(false)
      setPublishGoalCount(null)
      publishStartedAtRef.current = 0
      publishRequestIdRef.current += 1
      toast.warning(
        `Đã dừng chờ sau 15 phút. Hiện có ${districtPublishedCount}/${districtTotal} huyện đã được công bố; tải lại trang để kiểm tra tiếp.`
      )
    }, remaining)
    return () => window.clearTimeout(timer)
  }, [busy, districtPublishedCount, districtTotal])

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
      label: 'Dữ liệu theo huyện',
      value: districtExportsQuery.isLoading ? (
        <span className="text-muted-foreground">Đang kiểm tra...</span>
      ) : districtExportsQuery.isError ? (
        <span className="text-warning">Không tải được trạng thái</span>
      ) : hasDistrictArtifacts ? (
        <span
          className={districtSourceCount >= districtTotal ? 'text-emerald-700' : 'text-warning'}
        >
          {districtSourceCount}/{districtTotal} huyện
          {districtStoredCount > 0 ? ` · Đã lưu ${districtStoredCount}/${districtTotal}` : ''}
        </span>
      ) : (
        <span className="text-muted-foreground">Chưa có tệp huyện</span>
      ),
    },
    {
      label: 'Bản đồ',
      value: hasDistrictArtifacts ? (
        <span
          className={districtPublishedCount >= districtTotal ? 'text-emerald-700' : 'text-sky-700'}
        >
          Đã công bố {districtPublishedCount}/{districtTotal} huyện
        </span>
      ) : geoserverLayer ? (
        <span className="text-emerald-700">Đã lưu ổn định</span>
      ) : temporaryTileStatus === 'available' ? (
        <span className="text-warning">Bản xem trước có thời hạn</span>
      ) : temporaryTileStatus === 'expired' ? (
        <span className="text-muted-foreground">Bản xem trước đã hết hạn</span>
      ) : isRasterProcessingStatus(item.status) ? (
        <span className="text-muted-foreground">Đang xử lý</span>
      ) : (
        <span className="text-muted-foreground">Chưa có lớp bản đồ</span>
      ),
    },
    ...(item.error_message
      ? [
          {
            label: 'Thông báo lỗi',
            value: (
              <span className="text-xs text-red-600">
                Không thể hoàn tất kỳ dữ liệu này. Vui lòng thử lại hoặc liên hệ quản trị hệ thống.
              </span>
            ),
          },
        ]
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
              {published
                ? hasDistrictArtifacts
                  ? `Đã công bố bản đồ ổn định cho ${districtPublishedCount}/${districtTotal} huyện.`
                  : 'Kết quả này đã có bản đồ ổn định.'
                : districtExportsQuery.isLoading
                  ? 'Đang kiểm tra dữ liệu và trạng thái công bố của từng huyện...'
                  : districtExportsQuery.isError
                    ? 'Không tải được trạng thái dữ liệu theo huyện. Vui lòng thử lại.'
                    : hasDistrictArtifacts
                      ? `${districtSourceCount}/${districtTotal} huyện có dữ liệu; ${districtPublishedCount}/${districtTotal} huyện đã được công bố trên bản đồ.`
                      : hasLegacyDownload
                        ? 'Công bố kết quả này để dùng ổn định trên trang quản trị và cổng bản đồ công khai.'
                        : temporaryDownloadStatus === 'expired'
                          ? 'Liên kết dữ liệu nguồn đã hết hạn. Hãy chạy lại kỳ này để tạo liên kết mới.'
                          : 'Kết quả này chưa có dữ liệu nguồn để công bố lên bản đồ.'}
            </p>
            {busy && hasDistrictArtifacts && (
              <p className="mt-1 flex items-center gap-2 text-sky-700">
                <LoadingInline size="small" />
                <span>
                  Đang lưu theo huyện ({districtReadyCount}/{publishGoalCount ?? districtTotal})
                </span>
              </p>
            )}
            {job && !terminal && (
              <p className="mt-1 flex items-center gap-2 text-sky-700">
                <LoadingInline size="small" />
                <span>Đang cập nhật bản đồ ({job.progress}%)</span>
              </p>
            )}
            {job?.status === 'completed' && job.geoserver_layer && (
              <p className="mt-1 flex items-center gap-2 text-emerald-700">
                <span>Đã cập nhật bản đồ thành công</span>
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
                Không thể cập nhật bản đồ. Vui lòng thử lại.
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
          {published ? (
            <Badge variant="outline" className="border-emerald-300 text-emerald-700">
              {hasDistrictArtifacts
                ? `Ổn định ${districtReadyCount}/${districtTotal}`
                : 'Đã công bố'}
            </Badge>
          ) : districtExportsQuery.isLoading ? (
            <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Đang kiểm tra
            </span>
          ) : hasPublishSource || busy ? (
            <Button size="sm" onClick={startPublish} disabled={!canPublish}>
              {busy
                ? 'Đang xử lý...'
                : hasDistrictArtifacts
                  ? `Đưa ${publishableDistrictCount} huyện lên bản đồ`
                  : 'Đưa lên bản đồ'}
            </Button>
          ) : (
            <span className="text-muted-foreground text-xs">
              {districtExportsQuery.isError
                ? 'Không kiểm tra được tệp nguồn'
                : temporaryDownloadStatus === 'expired'
                  ? 'Tệp nguồn đã hết hạn'
                  : 'Chưa có tệp nguồn'}
            </span>
          )}
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

      {/* Danh sách link mở xem trước từng huyện đã công bố — chỉ hiện khi có
          ít nhất 1 huyện có layer stable. Chip mở tab mới OpenLayers viewer. */}
      <DistrictPreviewLinks districts={districts} />

      {/* Class breakdown mini */}
      {totalHa > 0 && (
        <div className="rounded-md border p-3">
          <p className="text-muted-foreground mb-2 text-xs font-semibold">
            Phân bố kết quả của kỳ này
          </p>
          <ClassDistributionBar byClass={byClass} totalHa={totalHa} />
        </div>
      )}
    </div>
  )
}

/**
 * Danh sách chip link mở xem trước từng huyện đã publish trên máy chủ bản đồ.
 * Dùng chung cho SnapshotDetailPanel (Forest) — bấm chip mở tab mới OpenLayers.
 * Chip nào không build được preview URL (server chưa cấu hình `VITE_GEOSERVER_URL`)
 * sẽ bị lọc, tránh link chết.
 */
function DistrictPreviewLinks({ districts }: { districts: ForestClassDistrictExport[] }) {
  const items = districts
    .map((d) => {
      const layer = normalizeGeoserverLayer(d.geoserverLayer)
      if (!layer) return null
      const url = buildGeoserverPreviewUrl(layer)
      if (!url) return null
      const label = d.districtName || d.districtCode || layer
      return { key: String(d.districtCode || d.id || layer), label, url }
    })
    .filter((it): it is { key: string; label: string; url: string } => it !== null)

  if (!items.length) return null

  return (
    <div className="rounded-md border p-3">
      <p className="text-muted-foreground mb-2 text-xs font-semibold">
        Mở xem trước theo huyện ({items.length})
      </p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((it) => (
          <a
            key={it.key}
            href={it.url}
            target="_blank"
            rel="noreferrer noopener"
            className="border-primary/20 hover:bg-primary/10 hover:text-primary text-foreground/80 inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] transition-colors"
            title={`Mở ${it.label} trên máy chủ bản đồ`}
          >
            <span className="max-w-40 truncate">{it.label}</span>
            <ExternalLink size={11} />
          </a>
        ))}
      </div>
    </div>
  )
}
