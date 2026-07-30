import type * as React from 'react'
import { Fragment, useEffect, useRef, useState } from 'react'
import { toast } from 'react-toastify'
import {
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Layers,
  Loader2,
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
  FireRiskFeature,
  FireRiskDistrictExport,
  FireRiskDistrictExportsData,
  FireRiskHistoryItem,
  FireRiskProvinceSummary,
  FireRiskSnapshot,
} from '@/types/api'
import FireRiskMap, { type FireRiskRasterLoadStatus } from '@/components/features/FireRiskMap'
import GeeProcessingStatus from '@/components/features/GeeProcessingStatus'
import AnalysisAccuracyNotice from '@/components/features/AnalysisAccuracyNotice'
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
const ANALYSIS_POLL_INTERVAL_MS = 20_000
const DISTRICT_RASTER_POLL_INTERVAL_MS = 15_000
const DISTRICT_RASTER_POLL_WINDOW_MS = 5 * 60 * 1_000
const DISTRICT_PUBLISH_POLL_WINDOW_MS = 15 * 60 * 1_000
let fireRiskImageDownloadActive = false
const isRasterProcessingStatus = (status?: string) =>
  ['pending', 'computing', 'exporting'].includes(String(status || '').toLowerCase())
const ACTIVE_RASTER_INGEST_STATUSES = new Set([
  'pending',
  'downloading',
  'validating',
  'uploading',
  'publishing',
])

const getDistrictTemporaryDownloadUrl = (district: FireRiskDistrictExport) =>
  getUsableTemporaryRasterUrl(
    district.geeDownloadUrl,
    district.geeGeneratedAt ?? district.completedAt
  )

const getDistrictDownloadUrl = (district: FireRiskDistrictExport) =>
  district.geoserverDownloadUrl ||
  buildGeoserverDownloadUrl(district.geoserverLayer) ||
  getDistrictTemporaryDownloadUrl(district)

const getDistrictDownloadFilename = (
  district: FireRiskDistrictExport,
  analysisDate?: string | null
) => {
  const dateSuffix = String(analysisDate || '')
    .slice(0, 10)
    .replace(/-/g, '')
  return (
    district.downloadFilename ||
    district.geeDownloadFilename ||
    `fire_risk_${district.districtCode || 'kontum'}${dateSuffix ? `_${dateSuffix}` : ''}.tif`
  )
}

async function downloadDistrictFile(
  district: FireRiskDistrictExport,
  analysisDate?: string | null
): Promise<void> {
  const url = getDistrictDownloadUrl(district)
  if (!url) throw new Error('DISTRICT_DOWNLOAD_NOT_READY')
  await downloadRasterFile(url, getDistrictDownloadFilename(district, analysisDate))
}

const hasDistrictSource = (district: FireRiskDistrictExport) =>
  Boolean(
    district.minioKey || district.geoserverDownloadUrl || getDistrictTemporaryDownloadUrl(district)
  )

const isDistrictPublished = (district: FireRiskDistrictExport) =>
  Boolean(normalizeGeoserverLayer(district.geoserverLayer))

const isDistrictReady = (district: FireRiskDistrictExport) =>
  Boolean(
    isDistrictPublished(district) &&
    (district.minioKey ||
      district.geoserverDownloadUrl ||
      String(district.status).toLowerCase() === 'published')
  )

const hasActiveDistrictIngest = (district: FireRiskDistrictExport) => {
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

function countUniqueDistricts(districts: FireRiskDistrictExport[]): number {
  const codes = new Set(
    districts.map((district) => String(district.districtCode || '').trim()).filter(Boolean)
  )
  return codes.size || districts.length
}

function resolveDistrictTotal(
  payload: FireRiskDistrictExportsData | null | undefined,
  districts: FireRiskDistrictExport[] = payload?.districts ?? []
): number {
  const expectedTotal = readOptionalNonNegativeCount(payload?.expectedTotal)
  if (expectedTotal != null && expectedTotal > 0) return expectedTotal

  const total = readOptionalNonNegativeCount(payload?.total)
  if (total != null && total > 0) return total

  return countUniqueDistricts(districts)
}

function resolveDistrictTileUrl(district: FireRiskDistrictExport): string | null {
  const stableLayer = normalizeGeoserverLayer(district.geoserverLayer)
  if (stableLayer) {
    const stableUrl = buildGeoserverRasterTileUrl([stableLayer])
    if (stableUrl) return stableUrl
  }

  const temporaryUrl = district.tileUrl ?? district.geeTileUrl
  return getUsableTemporaryRasterUrl(
    temporaryUrl,
    district.tileGeneratedAt ?? district.geeGeneratedAt ?? district.completedAt
  )
}

function buildDistrictTiles(
  districts: FireRiskDistrictExport[]
): Array<{ code: string; tileUrl: string }> {
  const tiles = new Map<string, string>()

  for (const district of districts) {
    const code = String(district.districtCode || '').trim()
    if (!code || tiles.has(code)) continue
    const tileUrl = resolveDistrictTileUrl(district)
    if (tileUrl) tiles.set(code, tileUrl)
  }

  return Array.from(tiles, ([code, tileUrl]) => ({ code, tileUrl }))
}

function countGeoJsonDistricts(geojson: GeoJSON.FeatureCollection | null): number {
  const features = geojson?.features ?? []
  const districtKeys = new Set<string>()

  for (const feature of features) {
    const properties = feature.properties ?? {}
    const key =
      properties.districtCode ??
      properties.district_code ??
      properties.unitCode ??
      properties.unit_code ??
      properties.districtName ??
      properties.district_name
    const normalized = String(key ?? '').trim()
    if (normalized) districtKeys.add(normalized)
  }

  return districtKeys.size || features.length
}

type DistrictArtifactSummary = {
  total: number
  sourceCount: number
  storedCount: number
  geoserverCount: number
  readyCount: number
  districtCodeCount: number
  fullyPublished: boolean
  geoserverLayers: string[]
  available: boolean
}

function getDistrictArtifactSummary(value: Record<string, any>): DistrictArtifactSummary {
  const nested = value.districtArtifacts ?? value.district_artifacts ?? {}
  const rawLayers =
    value.geoserverLayers ??
    value.geoserver_layers ??
    value.districtGeoserverLayers ??
    value.district_geoserver_layers ??
    nested.geoserverLayers ??
    nested.geoserver_layers ??
    []
  const geoserverLayers = Array.isArray(rawLayers)
    ? Array.from(
        new Set(
          rawLayers
            .map((layer) => normalizeGeoserverLayer(layer))
            .filter((layer): layer is string => Boolean(layer))
        )
      )
    : []
  const total = readNonNegativeCount(
    value.expectedTotal,
    value.expected_total,
    value.districtTotal,
    value.district_total,
    value.totalDistricts,
    value.total_districts,
    nested.expectedTotal,
    nested.expected_total,
    nested.total
  )
  const sourceCount = readNonNegativeCount(
    value.sourceCount,
    value.source_count,
    value.districtSourceCount,
    value.district_source_count,
    nested.sourceCount,
    nested.source_count
  )
  const storedCount = readNonNegativeCount(
    value.storedCount,
    value.stored_count,
    value.districtStoredCount,
    value.district_stored_count,
    nested.storedCount,
    nested.stored_count
  )
  const geoserverCount = Math.max(
    geoserverLayers.length,
    readNonNegativeCount(
      value.geoserverCount,
      value.geoserver_count,
      value.districtGeoserverCount,
      value.district_geoserver_count,
      value.districtLayerCount,
      value.district_layer_count,
      value.publishedCount,
      value.published_count,
      nested.geoserverCount,
      nested.geoserver_count
    )
  )
  const readyCount = readNonNegativeCount(
    value.readyCount,
    value.ready_count,
    value.districtReadyCount,
    value.district_ready_count,
    nested.readyCount,
    nested.ready_count
  )
  const districtCodeCount = readNonNegativeCount(
    value.districtCodeCount,
    value.district_code_count,
    nested.districtCodeCount,
    nested.district_code_count
  )
  const effectiveTotal =
    total > 0 ? total : Math.max(sourceCount, storedCount, geoserverCount, readyCount)
  const backendFullyPublished =
    value.fullyPublished === true ||
    value.fully_published === true ||
    nested.fullyPublished === true ||
    nested.fully_published === true
  const fullyPublished =
    effectiveTotal > 0 &&
    (backendFullyPublished ||
      (geoserverCount >= effectiveTotal &&
        readyCount >= effectiveTotal &&
        (districtCodeCount === 0 || districtCodeCount >= effectiveTotal)))

  return {
    total: effectiveTotal,
    sourceCount,
    storedCount,
    geoserverCount,
    readyCount,
    districtCodeCount,
    fullyPublished,
    geoserverLayers,
    available:
      sourceCount > 0 ||
      storedCount > 0 ||
      geoserverCount > 0 ||
      readyCount > 0 ||
      geoserverLayers.length > 0,
  }
}

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
  const [quickDownloadProgress, setQuickDownloadProgress] = useState<{
    snapshotId: string
    completed: number
    total: number
  } | null>(null)
  const quickDownloadLockRef = useRef(false)
  // Layer manager state — visibility + opacity từng lớp trên map.
  const [districtVisible, setDistrictVisible] = useState(true)
  const [districtOpacity, setDistrictOpacity] = useState(0.45)
  const [heatVisible, setHeatVisible] = useState(true)
  const [heatOpacity, setHeatOpacity] = useState(0.65)
  const [rasterLoadStatus, setRasterLoadStatus] = useState<FireRiskRasterLoadStatus>('idle')

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
    (body: { analysisDate?: string; submitExport?: boolean }) => fireRiskService.refresh(body),
    {},
    false
  )

  const latest = latestQuery.data?.data
  const snapshot = latest?.snapshot
  const processing = latest?.processing
  const isPipelineBusy =
    processing?.queue.status === 'queued' || processing?.queue.status === 'running'
  const shouldPollProcessing =
    isPipelineBusy ||
    processing?.state === 'exporting' ||
    isRasterProcessingStatus(snapshot?.status)
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
    ['fire-risk-district-exports', snapshotId],
    () => fireRiskService.getDistrictExports(snapshotId as number | string),
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
        const districts = Array.isArray(payload?.districts)
          ? (payload.districts as FireRiskDistrictExport[])
          : []
        const expectedTotal = resolveDistrictTotal(payload, districts)
        const readyCount =
          readOptionalNonNegativeCount(payload?.readyCount, payload?.ready) ??
          districts.filter(isDistrictReady).length
        const fullyPublished =
          payload?.fullyPublished === true || (expectedTotal > 0 && readyCount >= expectedTotal)
        // Snapshot có thể hoàn tất trước khi worker gắn jobId. Tiếp tục poll tới khi
        // đủ bộ raster ổn định thay vì phụ thuộc riêng vào rasterIngestJobId.
        return !fullyPublished ? DISTRICT_RASTER_POLL_INTERVAL_MS : false
      },
    } as any,
    false
  )
  const summary: FireRiskProvinceSummary = snapshot?.provinceSummary ?? {}
  const features: FireRiskFeature[] = latest?.features ?? []
  const districtStats = snapshot?.districtStats ?? []
  const history = (historyQuery.data?.data?.items ?? []) as FireRiskHistoryItem[]
  const historyMetadata = historyQuery.data?.metadata
  const historyTotal = Number(historyMetadata?.total) || 0
  const lastHistoryTotalPages = useRef(1)
  if (historyMetadata?.totalPages !== undefined) {
    lastHistoryTotalPages.current = Math.max(1, Number(historyMetadata.totalPages) || 0)
  }
  const historyTotalPages = lastHistoryTotalPages.current
  const latestHistoryItem = history.find((item) => String(item.id) === String(snapshot?.id))
  const districtExports = ((districtExportsQuery.data as any)?.data ??
    null) as FireRiskDistrictExportsData | null
  const districtArtifacts = districtExports?.districts ?? []
  const expectedDistrictTotal = resolveDistrictTotal(districtExports, districtArtifacts)
  const snapshotGeeGeneratedAt =
    snapshot?.geeTileGeneratedAt ??
    latestHistoryItem?.gee_tile_generated_at ??
    latestHistoryItem?.computed_at
  const perDistrictTiles = buildDistrictTiles(districtArtifacts)
  const hasDistrictRasterContract =
    readOptionalNonNegativeCount(districtExports?.expectedTotal) != null &&
    Number(districtExports?.expectedTotal) > 0
  const allowProvinceRasterFallback = !districtExportsQuery.isLoading && !hasDistrictRasterContract
  const rasterTileUrl = allowProvinceRasterFallback
    ? resolveRasterTileUrl(snapshot, snapshotGeeGeneratedAt)
    : null
  const hasRasterTile = perDistrictTiles.length > 0 || Boolean(rasterTileUrl)

  useEffect(() => {
    if (!shouldPollProcessing) return
    const timer = window.setInterval(() => {
      latestQuery.refetch()
      mapQuery.refetch()
      historyQuery.refetch()
    }, ANALYSIS_POLL_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [historyQuery, latestQuery, mapQuery, shouldPollProcessing])

  useEffect(() => {
    if (page > historyTotalPages) setPage(historyTotalPages)
  }, [page, historyTotalPages])

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
        onSuccess: (response) => {
          const run = response?.data?.run
          const queueState = run?.processing?.queue
          if (run?.deduplicated) {
            toast.info('Yêu cầu này đã có trong hàng chờ xử lý, hệ thống không tạo thêm lượt chạy.')
          } else {
            toast.success(
              queueState?.status === 'queued' && queueState?.position
                ? `Yêu cầu đã vào hàng chờ xử lý ở vị trí ${queueState.position}.`
                : 'Yêu cầu đã được tiếp nhận và đang xử lý.'
            )
          }
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
        onError: (error) => {
          if (!error?.body?.message) {
            toast.error('Không thể chạy lại phân tích. Vui lòng thử lại.')
          }
          setRefreshDialogOpen(false)
        },
      }
    )
  }

  const onQuickDownloadDistricts = async (item: FireRiskHistoryItem) => {
    if (quickDownloadLockRef.current || fireRiskImageDownloadActive) {
      toast.info('Một lượt tải ảnh huyện đang được thực hiện. Vui lòng chờ hoàn tất.')
      return
    }

    const snapshotId = String(item.id)
    const analysisDate = item.analysis_date || item.analysisDate
    quickDownloadLockRef.current = true
    fireRiskImageDownloadActive = true
    setQuickDownloadProgress({ snapshotId, completed: 0, total: 0 })

    try {
      const response = await fireRiskService.getDistrictExports(item.id)
      const payload = response.data
      const districts = payload?.districts ?? []
      const availableDistricts = districts.filter((district) =>
        Boolean(getDistrictDownloadUrl(district))
      )
      const expectedTotal = resolveDistrictTotal(payload, districts) || availableDistricts.length

      if (!availableDistricts.length) {
        toast.info(`Ngày ${formatDate(analysisDate)} chưa có ảnh huyện để tải.`)
        return
      }

      setQuickDownloadProgress({ snapshotId, completed: 0, total: expectedTotal })
      let downloadedCount = 0
      let failedCount = 0

      for (const district of availableDistricts) {
        try {
          await downloadDistrictFile(district, analysisDate)
          downloadedCount += 1
        } catch {
          failedCount += 1
        } finally {
          setQuickDownloadProgress({
            snapshotId,
            completed: downloadedCount + failedCount,
            total: expectedTotal,
          })
        }
      }

      const unavailableCount = Math.max(0, expectedTotal - availableDistricts.length)
      const notDownloadedCount = unavailableCount + failedCount
      if (downloadedCount === expectedTotal && notDownloadedCount === 0) {
        toast.success(`Đã tải đủ ${downloadedCount}/${expectedTotal} huyện.`)
      } else if (downloadedCount > 0) {
        toast.warning(
          `Đã tải ${downloadedCount}/${expectedTotal} huyện; ${notDownloadedCount} huyện chưa có ảnh hoặc tải chưa thành công.`
        )
      } else {
        toast.error(`Không thể tải ảnh huyện của ngày ${formatDate(analysisDate)}.`)
      }
    } catch (error) {
      const requestError = error as { body?: { message?: string } }
      if (!requestError.body?.message) {
        toast.error(`Không thể lấy danh sách ảnh huyện của ngày ${formatDate(analysisDate)}.`)
      }
    } finally {
      quickDownloadLockRef.current = false
      fireRiskImageDownloadActive = false
      setQuickDownloadProgress(null)
    }
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
                Ngày phân tích: <span>{formatDate(snapshot.analysisDate)}</span>
              </span>
              {snapshot.status && <StatusBadge status={snapshot.status} />}
              <span
                className={
                  rasterLoadStatus === 'error'
                    ? 'text-red-700'
                    : hasRasterTile
                      ? 'text-emerald-700'
                      : 'text-warning'
                }
              >
                {hasRasterTile && rasterLoadStatus === 'error'
                  ? 'Không tải được ảnh bản đồ'
                  : hasRasterTile && rasterLoadStatus === 'loading'
                    ? 'Đang tải ảnh bản đồ'
                    : hasRasterTile
                      ? 'Bản đồ sẵn sàng'
                      : hasDistrictRasterContract
                        ? `Chưa có ảnh chi tiết theo huyện (${perDistrictTiles.length}/${expectedDistrictTotal})`
                        : getTemporaryRasterUrlStatus(
                              snapshot.geeTileUrl,
                              snapshotGeeGeneratedAt
                            ) === 'expired'
                          ? 'Ảnh xem nhanh đã hết hạn'
                          : 'Chưa có ảnh bản đồ khả dụng'}
              </span>
            </div>
          )}
        </div>
        {canManage && (
          <Button
            className="w-full md:w-auto md:shrink-0"
            onClick={() => setRefreshDialogOpen(true)}
            disabled={isRefreshing || isPipelineBusy}
          >
            {isRefreshing
              ? 'Đang gửi yêu cầu...'
              : isPipelineBusy
                ? processing?.queue.status === 'queued'
                  ? 'Đang chờ cập nhật'
                  : 'Đang cập nhật'
                : 'Cập nhật dữ liệu'}
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
              {isRefreshing ? 'Đang cập nhật dữ liệu...' : 'Cập nhật dữ liệu cháy rừng?'}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                {isRefreshing ? (
                  <>
                    <p>Hệ thống đang tạo số liệu và bản đồ mới cho toàn tỉnh.</p>
                    <p className="text-muted-foreground text-xs">
                      Bạn có thể đóng cửa sổ này. Kết quả sẽ tự hiển thị khi hoàn tất.
                    </p>
                  </>
                ) : (
                  <>
                    <p>
                      Hệ thống sẽ dùng dữ liệu mới nhất để cập nhật cấp nguy cơ cho toàn tỉnh và
                      từng huyện.
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
              {isRefreshing ? 'Đang cập nhật...' : 'Bắt đầu cập nhật'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <GeeProcessingStatus processing={processing} />

      <AnalysisAccuracyNotice resultLabel="diện tích và cấp cảnh báo" />

      {/* ── Ground truth (collapsible) ─────────────── */}
      <GroundTruthCard />

      {/* ── Controls + tổng quan ───────────────────── */}
      <Card>
        <CardContent className="space-y-4 p-4 sm:p-6">
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Đang tải dữ liệu cảnh báo...</p>
          ) : latestQuery.isError ? (
            <p className="text-sm text-red-700">
              Không tải được dữ liệu cảnh báo cháy rừng. Vui lòng thử lại sau.
            </p>
          ) : !snapshot ? (
            <p className="text-warning text-sm">
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

              {latest?.stale && !isPipelineBusy && (
                <div
                  className="border-warning/30 bg-warning/10 rounded-md border p-3"
                  role="status"
                >
                  <p className="text-warning text-sm font-medium">
                    Bản đồ chưa có dữ liệu mới nhất
                  </p>
                  <p className="text-muted-foreground mt-1 text-xs leading-5">
                    Dữ liệu đang hiển thị được cập nhật ngày {formatDate(snapshot.analysisDate)}.
                    Chọn “Cập nhật dữ liệu” để làm mới.
                  </p>
                </div>
              )}
              {latest?.computing && !processing && (
                <div className="rounded-md border border-sky-400 bg-sky-50 p-3 text-sm text-sky-800">
                  Đang cập nhật dữ liệu mới. Bạn vẫn có thể xem bản đồ hiện tại trong lúc chờ.
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
          {mapQuery.isError && (
            <div className="border-warning/30 bg-warning/10 text-warning mb-3 rounded-md border p-2 text-xs">
              Không tải được dữ liệu ranh giới huyện. Ảnh bản đồ được hiển thị riêng nếu nguồn còn
              khả dụng.
            </div>
          )}
          {/* Endpoint bản đồ có thể trả GeoJSON trực tiếp hoặc nằm trong `data`.
              Khi API đã khai báo dữ liệu theo huyện, chỉ các ảnh huyện có URL
              hợp lệ được hiển thị; không thay bằng ảnh toàn tỉnh. */}
          <FireRiskMap
            geojson={extractFeatureCollection(mapQuery.data)}
            rasterTileUrl={rasterTileUrl}
            perDistrictTiles={perDistrictTiles}
            districtVisible={districtVisible}
            districtOpacity={districtOpacity}
            heatVisible={heatVisible}
            heatOpacity={heatOpacity}
            heightClassName="h-[420px] lg:h-[560px]"
            onRasterStatusChange={setRasterLoadStatus}
          />
          {/* Layer Manager — collapsible, giống SatelliteControll/LayerManager */}
          <FireRiskLayerManager
            geojson={extractFeatureCollection(mapQuery.data)}
            snapshot={snapshot}
            rasterTileUrl={rasterTileUrl}
            geeGeneratedAt={snapshotGeeGeneratedAt}
            rasterLoadStatus={rasterLoadStatus}
            districtExports={districtExports}
            districtTileCount={perDistrictTiles.length}
            isLoadingDistrictExports={districtExportsQuery.isLoading}
            isDistrictExportsError={districtExportsQuery.isError}
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
                  <TableHead className="text-right whitespace-nowrap">Ảnh hợp lệ</TableHead>
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
                            className="bg-card text-foreground gap-1.5 whitespace-nowrap"
                          >
                            <span
                              aria-hidden="true"
                              className="ring-foreground/25 inline-block h-2.5 w-2.5 shrink-0 rounded-sm ring-1 ring-inset"
                              style={{ backgroundColor: LEVEL_META[d.maxLevel]?.color }}
                            />
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
                  <TableHead className="text-right whitespace-nowrap">Cấp trung bình</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Ảnh hợp lệ</TableHead>
                  <TableHead className="whitespace-nowrap">Bản đồ</TableHead>
                  <TableHead className="whitespace-nowrap">Cập nhật lúc</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Tải theo huyện</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((h) => {
                  const s = h.province_summary || {}
                  const hMax = s.maxLevel ?? deriveMaxLevel(s.riskLevelDist)
                  const rowKey = String(h.id)
                  const isExpanded = expandedHistoryId === rowKey
                  const geoserverLayer = normalizeGeoserverLayer(h.geoserver_layer)
                  const districtArtifacts = getDistrictArtifactSummary(h)
                  const hasStableDistrictRaster = districtArtifacts.fullyPublished
                  const temporaryTileStatus = getTemporaryRasterUrlStatus(
                    h.gee_tile_url ?? h.geeTileUrl,
                    h.gee_tile_generated_at ?? h.computed_at
                  )
                  const rasterKind = hasStableDistrictRaster
                    ? 'districts'
                    : geoserverLayer
                      ? 'geoserver'
                      : temporaryTileStatus === 'available'
                        ? 'gee'
                        : temporaryTileStatus === 'expired'
                          ? 'expired'
                          : districtArtifacts.available
                            ? 'district-sources'
                            : 'none'
                  const canQuickDownload = ['completed', 'published'].includes(
                    String(h.status || '').toLowerCase()
                  )
                  const rowDownloadProgress =
                    quickDownloadProgress?.snapshotId === rowKey ? quickDownloadProgress : null
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
                          {rasterKind === 'districts' ? (
                            <span className="text-emerald-700">
                              Đã công bố {districtArtifacts.geoserverCount}/
                              {districtArtifacts.total} huyện
                            </span>
                          ) : rasterKind === 'district-sources' ? (
                            <span className="text-warning">
                              Ảnh tạm {districtArtifacts.sourceCount}/{districtArtifacts.total}{' '}
                              huyện
                            </span>
                          ) : rasterKind === 'geoserver' ? (
                            (() => {
                              const previewUrl = buildGeoserverPreviewUrl(geoserverLayer)
                              return previewUrl ? (
                                <Button
                                  asChild
                                  variant="link"
                                  size="xs"
                                  className="h-auto p-0 text-xs text-emerald-700 hover:text-emerald-800"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <a href={previewUrl} target="_blank" rel="noreferrer noopener">
                                    Mở xem trước
                                  </a>
                                </Button>
                              ) : (
                                <span className="text-emerald-700">Đã lưu ổn định</span>
                              )
                            })()
                          ) : rasterKind === 'gee' ? (
                            <span className="text-warning">Bản xem trước có thời hạn</span>
                          ) : rasterKind === 'expired' ? (
                            <span className="text-muted-foreground">Bản xem trước đã hết hạn</span>
                          ) : isRasterProcessingStatus(h.status) ? (
                            <span className="text-slate-500">Đang xử lý</span>
                          ) : (
                            <span className="text-muted-foreground">Chưa có lớp bản đồ</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap">
                          {h.computed_at ? formatDateTime(h.computed_at) : '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            size="xs"
                            variant="outline"
                            className="h-8 whitespace-nowrap"
                            disabled={!canQuickDownload || quickDownloadProgress !== null}
                            title={
                              canQuickDownload
                                ? `Tải ảnh 10 huyện của ngày ${formatDate(h.analysis_date || h.analysisDate)}`
                                : 'Có thể tải sau khi kết quả phân tích hoàn thành'
                            }
                            aria-label={`Tải ảnh 10 huyện của ngày ${formatDate(h.analysis_date || h.analysisDate)}`}
                            onClick={(event) => {
                              event.stopPropagation()
                              void onQuickDownloadDistricts(h)
                            }}
                          >
                            {rowDownloadProgress ? (
                              <>
                                <Loader2 size={13} className="mr-1.5 animate-spin" />
                                {rowDownloadProgress.total > 0
                                  ? `Đang tải ${rowDownloadProgress.completed}/${rowDownloadProgress.total}`
                                  : 'Đang chuẩn bị...'}
                              </>
                            ) : (
                              <>
                                <Download size={13} className="mr-1.5" />
                                Tải 10 huyện
                              </>
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                          <TableCell colSpan={9} className="py-3">
                            <SnapshotDetailPanel item={h} />
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  )
                })}
                {!history.length && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-muted-foreground text-center">
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
  rasterTileUrl,
  geeGeneratedAt,
  rasterLoadStatus,
  districtExports,
  districtTileCount,
  isLoadingDistrictExports,
  isDistrictExportsError,
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
  snapshot: FireRiskSnapshot | null | undefined
  rasterTileUrl: string | null
  geeGeneratedAt?: string | null
  rasterLoadStatus: FireRiskRasterLoadStatus
  districtExports: FireRiskDistrictExportsData | null
  districtTileCount: number
  isLoadingDistrictExports: boolean
  isDistrictExportsError: boolean
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
  const [districtDownloadState, setDistrictDownloadState] = useState<
    | { kind: 'batch'; completed: number; total: number }
    | { kind: 'district'; districtCode: string }
    | null
  >(null)
  const districtDownloadLockRef = useRef(false)
  const geoserverDownloadUrl =
    snapshot?.geoserverDownloadUrl || buildGeoserverDownloadUrl(snapshot?.geoserverLayer)
  const temporaryDownloadStatus = getTemporaryRasterUrlStatus(
    snapshot?.geeDownloadUrl,
    geeGeneratedAt
  )
  const downloadUrl =
    geoserverDownloadUrl || getUsableTemporaryRasterUrl(snapshot?.geeDownloadUrl, geeGeneratedAt)
  const districtArtifacts = districtExports?.districts ?? []
  const districtTotal = resolveDistrictTotal(districtExports, districtArtifacts)
  const availableDistricts = districtArtifacts.filter((district) =>
    Boolean(getDistrictDownloadUrl(district))
  )

  const downloadOneDistrict = async (district: FireRiskDistrictExport) => {
    if (districtDownloadLockRef.current || fireRiskImageDownloadActive) {
      toast.info('Một lượt tải ảnh đang được thực hiện. Vui lòng chờ hoàn tất.')
      return
    }

    const districtCode = String(district.districtCode || district.id)
    districtDownloadLockRef.current = true
    fireRiskImageDownloadActive = true
    setDistrictDownloadState({ kind: 'district', districtCode })
    try {
      await downloadDistrictFile(district, snapshot?.analysisDate)
      toast.success(`Đã tải ảnh ${district.districtName || district.districtCode}.`)
    } catch {
      toast.error(`Không thể tải ảnh ${district.districtName || district.districtCode}.`)
    } finally {
      districtDownloadLockRef.current = false
      fireRiskImageDownloadActive = false
      setDistrictDownloadState(null)
    }
  }

  const downloadAllDistricts = async () => {
    if (districtDownloadLockRef.current || fireRiskImageDownloadActive) {
      toast.info('Một lượt tải ảnh đang được thực hiện. Vui lòng chờ hoàn tất.')
      return
    }
    if (!availableDistricts.length) {
      toast.info('Chưa có ảnh huyện nào sẵn sàng để tải.')
      return
    }

    districtDownloadLockRef.current = true
    fireRiskImageDownloadActive = true
    setDistrictDownloadState({ kind: 'batch', completed: 0, total: districtTotal })
    let downloadedCount = 0
    let failedCount = 0
    try {
      for (const district of availableDistricts) {
        try {
          await downloadDistrictFile(district, snapshot?.analysisDate)
          downloadedCount += 1
        } catch {
          failedCount += 1
        } finally {
          setDistrictDownloadState({
            kind: 'batch',
            completed: downloadedCount + failedCount,
            total: districtTotal,
          })
        }
      }

      const unavailableCount = Math.max(0, districtTotal - availableDistricts.length)
      const notDownloadedCount = unavailableCount + failedCount
      if (downloadedCount === districtTotal && notDownloadedCount === 0) {
        toast.success(`Đã tải đủ ${downloadedCount}/${districtTotal} huyện.`)
      } else {
        toast.warning(
          `Đã tải ${downloadedCount}/${districtTotal} huyện; ${notDownloadedCount} huyện chưa có ảnh hoặc tải chưa thành công.`
        )
      }
    } finally {
      districtDownloadLockRef.current = false
      fireRiskImageDownloadActive = false
      setDistrictDownloadState(null)
    }
  }

  // Tải GeoTIFF bản đồ nhiệt. Ưu tiên `geoserverDownloadUrl` (WCS GetCoverage,
  // persistent, full-resolution) trước `geeDownloadUrl` tạm thời của GEE.
  // File thực sự là image/tiff — extension `.tif` (KHÔNG `.zip`,
  // trước đây Windows Explorer prompt "invalid archive" khi double-click).
  const downloadHeatRaster = async () => {
    if (!downloadUrl) return
    if (districtDownloadLockRef.current || fireRiskImageDownloadActive) {
      toast.info('Một lượt tải ảnh đang được thực hiện. Vui lòng chờ hoàn tất.')
      return
    }
    const filename =
      snapshot?.downloadFilename ||
      `fire_risk_kontum_${(snapshot?.analysisDate || '').slice(0, 10).replace(/-/g, '')}.tif`
    fireRiskImageDownloadActive = true
    try {
      await downloadRasterFile(downloadUrl, filename)
    } catch {
      toast.error('Không thể tải dữ liệu cảnh báo cháy rừng.')
    } finally {
      fireRiskImageDownloadActive = false
    }
  }

  const boundaryDistrictCount = countGeoJsonDistricts(geojson)
  const hasAnyDistrictTile = districtTileCount > 0
  const heatAvailable =
    hasAnyDistrictTile || (Boolean(rasterTileUrl) && rasterLoadStatus !== 'error')

  const layers = [
    {
      id: 'district',
      label: 'Ranh giới huyện',
      dotClass: 'bg-emerald-500',
      desc: boundaryDistrictCount > 0 ? `${boundaryDistrictCount} huyện` : 'Chưa có dữ liệu',
      visible: districtVisible,
      opacity: districtOpacity,
      onVisibleChange: onDistrictVisibleChange,
      onOpacityChange: onDistrictOpacityChange,
      available: Boolean(geojson?.features?.length),
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
        rasterLoadStatus === 'error'
          ? 'Không tải được ảnh bản đồ'
          : rasterLoadStatus === 'loading'
            ? 'Đang tải ảnh bản đồ'
            : hasAnyDistrictTile
              ? districtTileCount === districtTotal
                ? `Ảnh chi tiết đủ ${districtTileCount}/${districtTotal} huyện`
                : `Ảnh chi tiết ${districtTileCount}/${districtTotal} huyện — đang bổ sung`
              : rasterTileUrl
                ? 'Ảnh xem nhanh sẵn sàng'
                : getTemporaryRasterUrlStatus(snapshot?.geeTileUrl, geeGeneratedAt) === 'expired'
                  ? 'Ảnh xem nhanh đã hết hạn'
                  : 'Chưa có ảnh bản đồ khả dụng',
      visible: heatVisible,
      opacity: heatOpacity,
      onVisibleChange: onHeatVisibleChange,
      onOpacityChange: onHeatOpacityChange,
      available: heatAvailable,
      // Chỉ giữ 1 nút "Tải ảnh" — đã bỏ Copy URL + Xem tile preview để UI gọn.
      canDownload: Boolean(downloadUrl),
      downloadLabel:
        temporaryDownloadStatus === 'expired' && !geoserverDownloadUrl
          ? 'Liên kết tải đã hết hạn'
          : 'Tải ảnh nguy cơ cháy',
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
            {layers.filter((layer) => layer.available).length}/{layers.length}
          </span>
        </div>
        {open ? (
          <ChevronUp size={16} className="text-muted-foreground" />
        ) : (
          <ChevronDown size={16} className="text-muted-foreground" />
        )}
      </Button>

      {open && (
        <div className="space-y-2 border-t p-3">
          {/* Layout 2 col × 1 row (stack trên mobile). */}
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {layers.map((layer) => (
              <FireRiskLayerCard key={layer.id} layer={layer} />
            ))}
          </div>

          {isDistrictExportsError ? (
            <div className="border-warning/30 bg-warning/10 text-warning rounded-md border p-2 text-xs">
              <p className="font-semibold">Ảnh theo huyện chưa khả dụng</p>
              <p className="mt-1">
                Không tải được danh sách huyện. Không có liên kết tải nào được hiển thị.
              </p>
            </div>
          ) : isLoadingDistrictExports ? (
            <div className="text-muted-foreground flex items-center gap-2 rounded-md border p-2 text-xs">
              <LoadingInline size="small" />
              <span>Đang tải danh sách ảnh theo huyện...</span>
            </div>
          ) : districtArtifacts.length > 0 ? (
            <div className="space-y-2 rounded-md border p-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">Ảnh tải xuống theo huyện</p>
                  <p className="text-muted-foreground text-xs">
                    {availableDistricts.length}/{districtTotal} huyện đã sẵn sàng
                  </p>
                </div>
                <Badge variant="outline">
                  {availableDistricts.length}/{districtTotal}
                </Badge>
              </div>

              <Button
                type="button"
                size="xs"
                variant="outline"
                className="h-8 w-full"
                disabled={districtDownloadState !== null || availableDistricts.length === 0}
                onClick={() => void downloadAllDistricts()}
              >
                {districtDownloadState?.kind === 'batch' ? (
                  <>
                    <Loader2 size={13} className="mr-1.5 animate-spin" />
                    Đang tải {districtDownloadState.completed}/{districtDownloadState.total}
                  </>
                ) : (
                  <>
                    <Download size={13} className="mr-1.5" />
                    {availableDistricts.length === districtTotal
                      ? `Tải đủ ${districtTotal} huyện`
                      : `Tải ${availableDistricts.length}/${districtTotal} huyện đã sẵn sàng`}
                  </>
                )}
              </Button>

              <div className="max-h-56 space-y-1 overflow-y-auto">
                {districtArtifacts.map((district) => {
                  const districtCode = String(district.districtCode || district.id)
                  const canDownload = Boolean(getDistrictDownloadUrl(district))
                  const isDownloading =
                    districtDownloadState?.kind === 'district' &&
                    districtDownloadState.districtCode === districtCode
                  const stableLayer = normalizeGeoserverLayer(district.geoserverLayer)
                  const previewUrl = stableLayer ? buildGeoserverPreviewUrl(stableLayer) : null
                  const temporaryStatus = getTemporaryRasterUrlStatus(
                    district.geeDownloadUrl,
                    district.geeGeneratedAt ?? district.completedAt
                  )
                  const unavailableLabel =
                    temporaryStatus === 'expired'
                      ? 'Liên kết đã hết hạn'
                      : isRasterProcessingStatus(district.status)
                        ? 'Đang chuẩn bị'
                        : district.status === 'failed'
                          ? 'Chưa hoàn tất'
                          : 'Chưa có ảnh'

                  return (
                    <div
                      key={districtCode}
                      className="hover:bg-muted/40 flex items-center gap-2 rounded-md border p-1.5 text-xs"
                    >
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${
                          canDownload
                            ? 'bg-success'
                            : isRasterProcessingStatus(district.status)
                              ? 'bg-info'
                              : district.status === 'failed'
                                ? 'bg-destructive'
                                : 'bg-muted-foreground'
                        }`}
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1 truncate">
                        {district.districtName || district.districtCode}
                      </span>

                      {previewUrl ? (
                        <Button
                          type="button"
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
                          type="button"
                          size="icon-xs"
                          variant="ghost"
                          disabled={districtDownloadState !== null}
                          onClick={() => void downloadOneDistrict(district)}
                          title={`Tải ảnh ${district.districtName || district.districtCode}`}
                          aria-label={`Tải ảnh ${district.districtName || district.districtCode}`}
                        >
                          {isDownloading ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Download size={12} />
                          )}
                        </Button>
                      ) : (
                        <span className="text-muted-foreground shrink-0 text-[10px]">
                          {unavailableLabel}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground rounded-md border p-2 text-xs">
              Chưa có ảnh theo huyện cho lần phân tích này.
            </p>
          )}
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
    available: boolean
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
            {layer.available && (
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
            )}
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
        {layer.available && (
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
        )}
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
    completed: 'Đã cập nhật',
    published: 'Đã công bố',
    computing: 'Đang cập nhật',
    exporting: 'Đang hoàn thiện bản đồ',
    pending: 'Đang chờ cập nhật',
    failed: 'Chưa hoàn tất',
    cancelled: 'Đã hủy',
  }
  const variant: 'default' | 'secondary' | 'destructive' | 'outline' =
    status === 'completed' || status === 'published'
      ? 'default'
      : status === 'computing' || status === 'exporting'
        ? 'secondary'
        : status === 'failed'
          ? 'destructive'
          : 'outline'
  return <Badge variant={variant}>{labels[status] || 'Chưa xác định'}</Badge>
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
    return <p className="text-muted-foreground text-xs">Chưa có dữ liệu phân bố chi tiết.</p>
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
      <div className="flex flex-wrap gap-1.5">
        {chips.map((c) => {
          const meta = LEVEL_META[c.level]
          const isTop = c.level === maxLevel
          return (
            <span
              key={c.level}
              className={`border-border text-foreground inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs whitespace-nowrap tabular-nums ${
                isTop ? 'font-semibold shadow-xs' : 'font-normal'
              }`}
              style={{
                backgroundColor: isTop ? `${meta?.color}22` : 'transparent',
              }}
              title={meta?.label}
            >
              <span
                aria-hidden="true"
                className="ring-foreground/25 inline-block h-2 w-2 shrink-0 rounded-full ring-1 ring-inset"
                style={{ backgroundColor: meta?.color }}
              />
              {meta?.label ?? `Cấp ${c.level}`} · {formatHaShort(c.ha)}
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
function SnapshotDetailPanel({ item }: { item: FireRiskHistoryItem }) {
  const user = useAuthStore((s) => s.user)
  const canPublishRaster = hasPerm(user, 'map_layers', 'ingest_raster')
  const s = (item?.province_summary || {}) as any
  const dist: Record<string, number> = s.riskLevelDist || {}
  const totalHaAll = [0, 1, 2, 3, 4, 5].reduce((sum, l) => sum + (Number(dist[String(l)]) || 0), 0)

  // Publish trigger: chỉ hiện khi snapshot có download URL và chưa publish.
  // State giữ jobId để poll trạng thái ingest — snapshot back-link khi xong.
  const [ingestJobId, setIngestJobId] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [publishGoalCount, setPublishGoalCount] = useState<number | null>(null)
  const publishStartedAtRef = useRef(0)
  const publishRequestIdRef = useRef(0)
  const districtPollingStartedAtRef = useRef(Date.now())
  const queryClient = useQueryClient()
  const geoserverLayer = normalizeGeoserverLayer(item.geoserver_layer)
  const districtExportsQuery = useApiQuery(
    ['fire-risk-history-district-exports', item.id],
    () => fireRiskService.getDistrictExports(item.id),
    {
      refetchInterval: (query: any) => {
        const payload = query.state.data?.data as FireRiskDistrictExportsData | undefined
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
  const districtPublishedCount =
    readOptionalNonNegativeCount(
      districtExports?.publishedCount,
      districtExports?.geoserverCount
    ) ?? districts.filter(isDistrictPublished).length
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
    item.gee_download_url ?? item.geeDownloadUrl,
    item.gee_download_generated_at ?? item.computed_at
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
      const res = await fireRiskService.publishSnapshotRaster(item.id)
      if (publishRequestIdRef.current !== requestId) return
      const data = res.data
      const jobs = Array.isArray(data?.jobs) ? data.jobs : []
      const queuedCount = readNonNegativeCount(
        data?.queuedCount,
        data?.queued,
        data?.enqueuedCount,
        data?.enqueued,
        jobs.length
      )
      const responsePublishedCount = readNonNegativeCount(
        data?.publishedCount,
        data?.geoserverCount,
        data?.published
      )
      const responseReadyCount = readNonNegativeCount(
        data?.readyCount,
        data?.ready,
        responsePublishedCount
      )
      const responseTotal = readNonNegativeCount(data?.totalDistricts, data?.total, districtTotal)

      const responseFullyPublished =
        responseTotal > 0 &&
        responsePublishedCount >= responseTotal &&
        responseReadyCount >= responseTotal
      if (
        data?.fullyPublished === true ||
        (data?.alreadyPublished === true && (!hasDistrictArtifacts || responseFullyPublished))
      ) {
        await Promise.all([
          queryClient.refetchQueries({ queryKey: ['fire-risk-latest'], type: 'active' }),
          queryClient.refetchQueries({ queryKey: ['fire-risk-map'], type: 'active' }),
          queryClient.refetchQueries({ queryKey: ['fire-risk-history'], type: 'active' }),
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
      if (data?.jobId && !hasDistrictArtifacts) {
        setIngestJobId(Number(data.jobId))
      }

      if (queuedCount > 0) {
        setPublishGoalCount(
          Math.min(responseTotal || districtTotal, responseReadyCount + queuedCount)
        )
        toast.success(`Đã xếp hàng lưu ${queuedCount} huyện.`)
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

  // Poll job status mỗi 15s. DỪNG khi terminal — trước đây refetchInterval là
  // số fix nên poll mãi kể cả sau failed → UI nháy + server spam log.
  const jobQuery = useApiQuery(
    ['raster-ingest-job', ingestJobId],
    () => fireRiskService.getIngestJob(ingestJobId as number),
    {
      enabled: ingestJobId != null,
      refetchInterval: (data: any) => {
        const st = data?.data?.data?.status ?? data?.data?.status
        return st && ['completed', 'failed', 'cancelled'].includes(st)
          ? false
          : DISTRICT_RASTER_POLL_INTERVAL_MS
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
    setPublishGoalCount(null)
    publishStartedAtRef.current = 0
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
      toast.error('Không thể cập nhật bản đồ. Vui lòng thử lại.')
    }
  }, [terminal, busy, job?.status, job?.geoserver_layer, job?.error_log, queryClient])

  useEffect(() => {
    if (!busy || !hasDistrictArtifacts) return

    const reachedPublishGoal = publishGoalCount != null && districtReadyCount >= publishGoalCount
    if (published) {
      setBusy(false)
      setPublishGoalCount(null)
      publishStartedAtRef.current = 0
      publishRequestIdRef.current += 1
      toast.success(`Đã lưu ổn định ${districtReadyCount}/${districtTotal} huyện.`)
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ['fire-risk-latest'] }),
        queryClient.invalidateQueries({ queryKey: ['fire-risk-map'] }),
        queryClient.invalidateQueries({ queryKey: ['fire-risk-history'] }),
        queryClient.invalidateQueries({
          queryKey: ['fire-risk-history-district-exports', item.id],
        }),
      ])
      return
    }

    if (reachedPublishGoal) {
      setBusy(false)
      setPublishGoalCount(null)
      publishStartedAtRef.current = 0
      publishRequestIdRef.current += 1
      toast.warning(
        `Đã lưu ${districtReadyCount}/${districtTotal} huyện; cần đủ ${districtTotal}/${districtTotal} để công bố ổn định.`
      )
      void queryClient.invalidateQueries({
        queryKey: ['fire-risk-history-district-exports', item.id],
      })
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

    ...(item.error_message
      ? [
          {
            label: 'Thông báo lỗi',
            value: (
              <span className="text-red-600">
                Không thể hoàn tất kỳ dữ liệu này. Vui lòng thử lại hoặc liên hệ quản trị hệ thống.
              </span>
            ),
          },
        ]
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
              {published
                ? hasDistrictArtifacts
                  ? `Đã lưu ổn định ${districtReadyCount}/${districtTotal} huyện.`
                  : 'Kết quả này đã có ảnh bản đồ ổn định.'
                : districtExportsQuery.isLoading
                  ? 'Đang kiểm tra ảnh và trạng thái công bố của từng huyện...'
                  : districtExportsQuery.isError
                    ? 'Không tải được trạng thái ảnh theo huyện. Vui lòng thử lại.'
                    : hasDistrictArtifacts
                      ? `${districtSourceCount}/${districtTotal} huyện có ảnh; ${districtPublishedCount}/${districtTotal} huyện đã được công bố.`
                      : hasLegacyDownload
                        ? 'Công bố kết quả này để dùng ổn định trên trang quản trị và cổng bản đồ công khai.'
                        : temporaryDownloadStatus === 'expired'
                          ? 'Liên kết tải đã hết hạn. Hãy phân tích lại để tạo liên kết mới.'
                          : 'Kết quả này chưa có ảnh nguồn để công bố lên bản đồ.'}
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
            {(job?.status === 'failed' || job?.status === 'cancelled') && (
              <p className="mt-1 flex items-start gap-2 text-red-600">
                <span>Không thể cập nhật bản đồ. Vui lòng thử lại.</span>
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
              <LoadingInline size="small" />
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
                ? 'Không kiểm tra được ảnh nguồn'
                : temporaryDownloadStatus === 'expired'
                  ? 'Liên kết tải đã hết hạn'
                  : 'Chưa có ảnh nguồn'}
            </span>
          )}
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

      {/* Danh sách link mở xem trước từng huyện đã công bố — chip mở tab mới. */}
      <FireRiskDistrictPreviewLinks districts={districts} />

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
                className="border-border text-foreground inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs whitespace-nowrap tabular-nums"
                style={{ backgroundColor: `${color}18` }}
              >
                <span
                  aria-hidden="true"
                  className="ring-foreground/25 inline-block h-2 w-2 shrink-0 rounded-full ring-1 ring-inset"
                  style={{ backgroundColor: color }}
                />
                {label} · {formatHaShort(ha)} ({pct.toFixed(1)}%)
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
      <div aria-hidden="true" className="flex h-8 w-full overflow-hidden rounded-md border">
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
                aria-hidden="true"
                className="ring-foreground/25 mt-0.5 inline-block h-3 w-3 shrink-0 rounded-sm ring-1 ring-inset"
                style={{ backgroundColor: LEVEL_META[l].color }}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{LEVEL_META[l].label}</span>
                <span className="text-muted-foreground tabular-nums">
                  {formatHaShort(ha)} ({pct.toFixed(1)}%)
                </span>
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Danh sách chip link mở xem trước từng huyện đã publish trên máy chủ bản đồ.
 * Dùng chung cho SnapshotDetailPanel (Fire Risk) — bấm chip mở tab mới OpenLayers.
 * Chip nào không build được preview URL (server chưa cấu hình `VITE_GEOSERVER_URL`)
 * sẽ bị lọc, tránh link chết.
 */
function FireRiskDistrictPreviewLinks({ districts }: { districts: FireRiskDistrictExport[] }) {
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
  // Từ 100 ha trở lên đổi sang km² (1 km² = 100 ha) — thống nhất với client.
  if (Math.abs(n) >= 100) {
    return `${(n / 100).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} km²`
  }
  return `${n.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} ha`
}

// Compact variant dùng cho badge/legend hẹp — luôn nhả kèm đơn vị (km²/ha) để
// caller không phải append thủ công. Không dùng suffix `k`/`M` nữa vì đã
// chuyển sang km² khi >= 100 ha nên số hiếm khi quá lớn.
function formatHaShort(v?: number | string | null): string {
  if (v == null || v === '') return '—'
  const n = Number(v)
  if (!isFinite(n)) return '—'
  if (Math.abs(n) >= 100) {
    const km2 = n / 100
    return `${km2.toLocaleString('vi-VN', { maximumFractionDigits: km2 >= 100 ? 0 : 1 })} km²`
  }
  return `${Math.round(n).toLocaleString('vi-VN')} ha`
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
 *      GCS). URL chỉ tồn tại vài giờ nên snapshot cũ có thể đã hết hạn.
 *   3. Không có URL nào → null → chỉ vẽ vector polygon huyện.
 *
 * NOTE — chấp nhận cả camelCase (`geeTileUrl`) và snake_case (`gee_tile_url`)
 * để tương thích với response cũ / snapshot cũ trong DB.
 */
function resolveRasterTileUrl(
  snapshot: FireRiskSnapshot | null | undefined,
  generatedAt?: string | null,
  districtLayers: Array<string | null | undefined> = []
): string | null {
  if (!snapshot) return null
  const districtTileUrl = buildGeoserverRasterTileUrl(districtLayers)
  if (districtTileUrl) return districtTileUrl

  const geoserverTileUrl = buildGeoserverRasterTileUrl([snapshot.geoserverLayer])
  if (geoserverTileUrl) return geoserverTileUrl

  return getUsableTemporaryRasterUrl(
    snapshot.geeTileUrl,
    snapshot.geeTileGeneratedAt ?? generatedAt
  )
}
