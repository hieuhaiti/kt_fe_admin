import { statisticsService, useApiQuery } from '@/service'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Trees, Flame, Layers3, MessageSquareWarning, RefreshCcw, ExternalLink } from 'lucide-react'
import { buildGeoserverPreviewUrl } from '@/lib/geoserver'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatDateTime } from '@/lib/date'
import type {
  DashboardDistrictCoverage,
  DashboardFireRiskBlock,
  DashboardForestClassificationBlock,
  DashboardStats,
} from '@/types/api'

const RISK_LEVEL_META: Record<number, { label: string; color: string }> = {
  1: { label: 'Cấp I — Thấp', color: '#00a65a' },
  2: { label: 'Cấp II — Trung bình', color: '#f6e84a' },
  3: { label: 'Cấp III — Cao', color: '#f39c12' },
  4: { label: 'Cấp IV — Nguy hiểm', color: '#e74c3c' },
  5: { label: 'Cấp V — Cực kỳ nguy hiểm', color: '#7b241c' },
}

const FEEDBACK_STATUS_LABEL: Record<string, string> = {
  new: 'Mới',
  in_progress: 'Đang xử lý',
  resolved: 'Đã xử lý',
  rejected: 'Từ chối',
}

const FEEDBACK_STATUS_CLASS: Record<string, string> = {
  new: 'border-warning/30 bg-warning/10 text-warning',
  in_progress: 'bg-blue-50 text-blue-700 border-blue-200',
  resolved: 'bg-green-50 text-green-700 border-green-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
}

function formatHa(v?: number) {
  if (v == null) return '—'
  // Từ 100 ha trở lên đổi sang km² (1 km² = 100 ha) — thống nhất với client.
  if (Math.abs(v) >= 100) {
    return (v / 100).toLocaleString('vi-VN', { maximumFractionDigits: 2 }) + ' km²'
  }
  return v.toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + ' ha'
}

function formatPct(v?: number) {
  if (v == null) return '—'
  return v.toLocaleString('vi-VN', { maximumFractionDigits: 2 }) + '%'
}

export default function DashboardPage() {
  const dashboardQuery = useApiQuery(['stats-dashboard'], () =>
    statisticsService.getDashboard({ force: false })
  )
  const forceRefetch = () =>
    statisticsService.getDashboard({ force: true }).then(() => dashboardQuery.refetch())

  const data = (dashboardQuery.data?.data ?? {}) as DashboardStats
  const forest = data.forest
  const feedback = data.feedback
  const fireAlerts = data.fireAlerts
  const forestClassification = data.forestClassification

  return (
    <div className="flex-1 space-y-6 overflow-y-auto p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Bảng điều khiển</h1>
          <p className="text-muted-foreground text-sm">
            Tổng hợp phân loại rừng, phản ánh và cảnh báo cháy toàn tỉnh Kon Tum
          </p>
        </div>
        <div className="flex items-center gap-3">
          {data.computedAt && (
            <span className="text-muted-foreground text-xs">
              Cập nhật {formatDateTime(data.computedAt)}
            </span>
          )}
          <Button variant="outline" onClick={forceRefetch} disabled={dashboardQuery.isFetching}>
            <RefreshCcw className="mr-1 size-4" /> Làm mới
          </Button>
        </div>
      </div>

      {/* Rừng */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          icon={<Trees className="text-emerald-600" />}
          label="Tổng diện tích rừng"
          value={formatHa(forest?.totalForestHa)}
        />
        <StatCard
          icon={<Trees className="text-emerald-500" />}
          label="Rừng tự nhiên"
          value={formatHa(forest?.naturalForestHa)}
        />
        <StatCard
          icon={<Trees className="text-lime-600" />}
          label="Rừng trồng"
          value={formatHa(forest?.plantedForestHa)}
        />
        <StatCard
          icon={<Trees className="text-emerald-700" />}
          label="Độ che phủ toàn tỉnh"
          value={formatPct(forest?.provinceCoveragePct)}
        />
      </div>

      {/* Feedback + forest classification + fire risk */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardContent className="p-6">
            <div className="mb-3 flex items-center gap-2">
              <MessageSquareWarning className="text-warning size-5" />
              <h2 className="text-lg font-semibold">Phản ánh</h2>
              <span className="text-muted-foreground ml-auto text-sm">
                Tổng: <strong>{feedback?.total ?? 0}</strong>
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(feedback?.byStatus ?? {}).map(([k, v]) => (
                <div
                  key={k}
                  className={`rounded-md border px-3 py-2 text-sm ${
                    FEEDBACK_STATUS_CLASS[k] ?? 'border-slate-200 bg-slate-50 text-slate-600'
                  }`}
                >
                  <span>{FEEDBACK_STATUS_LABEL[k] ?? k}</span>
                  <span className="ml-2 font-bold">{v}</span>
                </div>
              ))}
              {!Object.keys(feedback?.byStatus ?? {}).length && (
                <p className="text-muted-foreground text-sm">Chưa có phản ánh nào.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <ForestClassificationDashboardCard data={forestClassification} />
        <FireRiskDashboardCard fireAlerts={fireAlerts} />
      </div>

      {/* Districts tables */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="p-6">
            <h2 className="mb-3 text-lg font-semibold text-emerald-700">
              Huyện có độ che phủ cao nhất
            </h2>
            <DistrictTable districts={forest?.topCoverageDistricts ?? []} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <h2 className="mb-3 text-lg font-semibold text-red-700">
              Huyện có độ che phủ thấp nhất
            </h2>
            <DistrictTable districts={forest?.lowCoverageDistricts ?? []} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

/**
 * Fire-risk card — hiển thị min/max/avg cấp cảnh báo + số huyện điểm nóng từ
 * snapshot mới nhất. Nút "Xem chi tiết" điều hướng sang trang FireRisk để
 * xem history + publish GeoServer.
 */
function FireRiskDashboardCard({ fireAlerts }: { fireAlerts?: DashboardFireRiskBlock }) {
  if (!fireAlerts?.available) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="mb-3 flex items-center gap-2">
            <Flame className="size-5 text-red-600" />
            <h2 className="text-lg font-semibold">Cảnh báo cháy rừng</h2>
          </div>
          <p className="text-muted-foreground text-sm">Chưa có dữ liệu cảnh báo cháy.</p>
        </CardContent>
      </Card>
    )
  }

  const maxLevel = fireAlerts.maxLevel ?? 0
  const isHigh = maxLevel >= 4
  const maxColor = RISK_LEVEL_META[maxLevel]?.color || '#94a3b8'

  // Ưu tiên field mới `mapReady` + đếm huyện (migration 040 chia per-district),
  // fallback legacy `geoserverLayer`/`geeDownloadUrl` cho snapshot cũ.
  const drTotal = fireAlerts.districtRasterTotal ?? 0
  const drReady = fireAlerts.districtRasterReady ?? 0
  const mapReady =
    fireAlerts.mapReady === true ||
    (drTotal > 0 && drReady === drTotal) ||
    Boolean(fireAlerts.geoserverLayer)

  return (
    <Card className={isHigh ? 'border-red-400' : ''}>
      <CardContent className="p-6">
        <div className="mb-3 flex items-center gap-2">
          <Flame className="size-5 text-red-600" />
          <h2 className="text-lg font-semibold">Cảnh báo cháy rừng</h2>
          {mapReady ? (
            <span className="ml-auto rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
              {drTotal > 0 ? `Bản đồ sẵn sàng · ${drReady}/${drTotal} huyện` : 'Bản đồ sẵn sàng'}
            </span>
          ) : null}
        </div>

        {/* Min · TB · Max — 3 số nổi bật */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-md border p-2">
            <p className="text-muted-foreground text-xs font-medium">Thấp nhất</p>
            <p className="text-xl font-bold">C{fireAlerts.minLevel ?? '—'}</p>
          </div>
          <div className="rounded-md border p-2">
            <p className="text-muted-foreground text-xs font-medium">Trung bình</p>
            <p className="text-xl font-bold">
              {fireAlerts.avgLevel != null ? fireAlerts.avgLevel.toFixed(2) : '—'}
            </p>
          </div>
          <div className="relative overflow-hidden rounded-md border p-2 pt-2.5">
            <span
              aria-hidden="true"
              className="absolute inset-x-0 top-0 h-1"
              style={{ backgroundColor: maxColor }}
            />
            <p className="text-muted-foreground text-xs font-medium">Cao nhất</p>
            <p className="text-foreground text-xl font-bold">C{fireAlerts.maxLevel ?? '—'}</p>
          </div>
        </div>

        {/* Meta: ngày phân tích + tỷ lệ ảnh hợp lệ */}
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <span className="text-muted-foreground">
            Ngày phân tích:{' '}
            <strong className="text-foreground">
              {fireAlerts.analysisDate
                ? new Date(fireAlerts.analysisDate).toLocaleDateString('vi-VN')
                : '—'}
            </strong>
          </span>
          {fireAlerts.s2CoverageRatio != null && (
            <span className="text-muted-foreground">
              Ảnh hợp lệ:{' '}
              <strong className="text-foreground">
                {(fireAlerts.s2CoverageRatio * 100).toFixed(1)}%
              </strong>
            </span>
          )}
        </div>

        {/* List link mở xem trước từng huyện trên máy chủ bản đồ. */}
        <PublishedDistrictLinks
          districts={fireAlerts.publishedDistricts}
          emptyHint="Chưa có huyện nào được phân phát ảnh bản đồ."
        />

        <div className="mt-3">
          <a href="/fire-risk" className="text-primary text-xs font-medium hover:underline">
            Xem chi tiết cảnh báo →
          </a>
        </div>
      </CardContent>
    </Card>
  )
}

function ForestClassificationDashboardCard({
  data,
}: {
  data?: DashboardForestClassificationBlock
}) {
  if (!data?.available) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="mb-3 flex items-center gap-2">
            <Layers3 className="size-5 text-emerald-600" />
            <h2 className="text-lg font-semibold">Phân loại rừng</h2>
          </div>
          <p className="text-muted-foreground text-sm">Chưa có dữ liệu phân loại rừng.</p>
        </CardContent>
      </Card>
    )
  }

  const comparison = data.comparison
  const change = comparison?.forestDeltaHa
  const changeClass =
    change == null ? 'text-muted-foreground' : change < 0 ? 'text-destructive' : 'text-success'
  // Ưu tiên field mới `mapReady` + đếm huyện (migration 040 chia per-district),
  // fallback legacy `geoserverLayer`/`geeDownloadUrl` cho snapshot cũ.
  const drTotal = data.districtRasterTotal ?? 0
  const drReady = data.districtRasterReady ?? 0
  const mapReady =
    data.mapReady === true || (drTotal > 0 && drReady === drTotal) || Boolean(data.geoserverLayer)

  return (
    <Card>
      <CardContent className="p-6">
        <div className="mb-3 flex items-center gap-2">
          <Layers3 className="size-5 text-emerald-600" />
          <h2 className="text-lg font-semibold">Phân loại rừng</h2>
          {mapReady ? (
            <span className="bg-success/10 text-success ml-auto rounded px-2 py-0.5 text-[10px] font-medium">
              {drTotal > 0 ? `Bản đồ sẵn sàng · ${drReady}/${drTotal} huyện` : 'Bản đồ sẵn sàng'}
            </span>
          ) : null}
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <Metric label="Rừng" value={formatHa(data.forestAreaHa ?? undefined)} />
          <Metric label="Độ phủ rừng" value={formatPct(data.forestCoveragePct ?? undefined)} />
          <Metric
            label="Độ chính xác"
            value={data.oobAccuracy != null ? `${data.oobAccuracy.toFixed(1)}%` : '—'}
          />
        </div>

        <div className="mt-3 space-y-1 text-xs">
          <p className="text-muted-foreground">
            Kỳ:{' '}
            <strong className="text-foreground">
              {data.year}-{String(data.month ?? '').padStart(2, '0')}
            </strong>
            {' · '}Tổng vùng:{' '}
            <strong className="text-foreground">{formatHa(data.totalAreaHa ?? undefined)}</strong>
          </p>
          <p className="text-muted-foreground">
            Lớp chiếm ưu thế:{' '}
            <strong className="text-foreground">{data.dominantClassName ?? '—'}</strong>
          </p>
          {comparison && (
            <p className="text-muted-foreground">
              So với {comparison.previousYear}-{String(comparison.previousMonth).padStart(2, '0')}:{' '}
              <strong className={changeClass}>
                {change == null ? '—' : `${change > 0 ? '+' : ''}${formatHa(change)}`}
                {comparison.forestChangePct != null
                  ? ` (${comparison.forestChangePct > 0 ? '+' : ''}${comparison.forestChangePct.toFixed(2)}%)`
                  : ''}
              </strong>
            </p>
          )}
        </div>

        {/* List link mở xem trước từng huyện trên máy chủ bản đồ. */}
        <PublishedDistrictLinks
          districts={data.publishedDistricts}
          emptyHint="Chưa có huyện nào được phân phát ảnh bản đồ."
        />

        <div className="mt-3">
          <a
            href="/forest-classification"
            className="text-primary text-xs font-medium hover:underline"
          >
            Xem chi tiết phân loại →
          </a>
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Danh sách link mở xem trước từng huyện trên máy chủ bản đồ.
 * Nhận `publishedDistricts` từ dashboard block; mỗi huyện có `layer` FQN
 * (dạng `workspace:store_name`). FE build preview URL qua `buildGeoserverPreviewUrl`
 * — trả về OpenLayers viewer, mở tab mới. Nếu server chưa cấu hình
 * `VITE_GEOSERVER_URL` (URL null) thì bỏ qua huyện đó.
 */
function PublishedDistrictLinks({
  districts,
  emptyHint,
}: {
  districts?: Array<{ code: string | null; name: string | null; layer: string }>
  emptyHint?: string
}) {
  const items = (districts || [])
    .map((d) => ({
      key: d.code || d.name || d.layer,
      label: d.name || d.code || d.layer,
      url: buildGeoserverPreviewUrl(d.layer),
    }))
    .filter((it): it is { key: string; label: string; url: string } => Boolean(it.url))

  if (!items.length) {
    return emptyHint ? (
      <p className="text-muted-foreground mt-3 text-[11px] italic">{emptyHint}</p>
    ) : null
  }

  return (
    <div className="mt-3">
      <p className="text-muted-foreground mb-1 text-[10px] tracking-wider uppercase">
        Mở xem trước theo huyện
      </p>
      <div className="flex flex-wrap gap-1">
        {items.map((it) => (
          <a
            key={it.key}
            href={it.url}
            target="_blank"
            rel="noreferrer noopener"
            className="border-primary/20 hover:bg-primary/10 hover:text-primary text-foreground/80 inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] transition-colors"
            title={`Mở ${it.label} trên máy chủ bản đồ`}
          >
            <span className="max-w-32 truncate">{it.label}</span>
            <ExternalLink size={10} />
          </a>
        ))}
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-2">
      <p className="text-muted-foreground text-[10px]">{label}</p>
      <p className="truncate text-sm font-bold" title={value}>
        {value}
      </p>
    </div>
  )
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-1 flex items-center gap-2">
          {icon}
          <p className="text-muted-foreground text-xs">{label}</p>
        </div>
        <p className="text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  )
}

function DistrictTable({ districts }: { districts: DashboardDistrictCoverage[] }) {
  if (!districts.length) {
    return <p className="text-muted-foreground text-sm">Chưa có dữ liệu.</p>
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Huyện</TableHead>
          <TableHead className="text-right">Độ che phủ</TableHead>
          <TableHead className="text-right">Diện tích rừng</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {districts.map((d) => (
          <TableRow key={d.unitCode}>
            <TableCell className="font-medium">{d.name}</TableCell>
            <TableCell className="text-right">{formatPct(d.coveragePct)}</TableCell>
            <TableCell className="text-right">
              {d.forestAreaHa != null ? formatHa(d.forestAreaHa) : '—'}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
