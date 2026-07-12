import { statisticsService, useApiQuery } from '@/service'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Trees, Flame, MessageSquareWarning, RefreshCcw } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatDateTime } from '@/lib/date'

interface DistrictCoverage {
  name: string
  unitCode: string
  coveragePct: number
  forestAreaHa?: number
}

interface ForestBlock {
  totalForestHa?: number
  naturalForestHa?: number
  plantedForestHa?: number
  provinceCoveragePct?: number
  lowCoverageDistricts?: DistrictCoverage[]
  topCoverageDistricts?: DistrictCoverage[]
}

interface FeedbackBlock {
  total?: number
  byStatus?: Record<string, number>
}

interface FireAlertsBlock {
  available?: boolean
  note?: string
  count?: number
}

interface DashboardData {
  year?: number
  forest?: ForestBlock
  feedback?: FeedbackBlock
  fireAlerts?: FireAlertsBlock
  cached?: boolean
  computedAt?: string
}

const FEEDBACK_STATUS_LABEL: Record<string, string> = {
  new: 'Mới',
  in_progress: 'Đang xử lý',
  resolved: 'Đã xử lý',
  rejected: 'Từ chối',
}

const FEEDBACK_STATUS_CLASS: Record<string, string> = {
  new: 'bg-amber-50 text-amber-700 border-amber-200',
  in_progress: 'bg-blue-50 text-blue-700 border-blue-200',
  resolved: 'bg-green-50 text-green-700 border-green-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
}

function formatHa(v?: number) {
  if (v == null) return '—'
  return v.toLocaleString('vi-VN', { maximumFractionDigits: 0 }) + ' ha'
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

  const data = (dashboardQuery.data?.data ?? {}) as DashboardData
  const forest = data.forest
  const feedback = data.feedback
  const fireAlerts = data.fireAlerts

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Bảng điều khiển</h1>
          <p className="text-muted-foreground text-sm">
            Tổng hợp che phủ rừng, phản ánh và cảnh báo cháy toàn tỉnh Kon Tum
            {data.year != null && <> — dữ liệu năm <strong>{data.year}</strong></>}.
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

      {/* Feedback + Fire */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="p-6">
            <div className="mb-3 flex items-center gap-2">
              <MessageSquareWarning className="text-amber-600 size-5" />
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
                    FEEDBACK_STATUS_CLASS[k] ?? 'bg-slate-50 text-slate-600 border-slate-200'
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

        <Card>
          <CardContent className="p-6">
            <div className="mb-3 flex items-center gap-2">
              <Flame className="text-red-600 size-5" />
              <h2 className="text-lg font-semibold">Cảnh báo cháy rừng</h2>
            </div>
            {fireAlerts?.available ? (
              <p className="text-3xl font-bold text-red-600">{fireAlerts.count ?? 0}</p>
            ) : (
              <p className="text-muted-foreground text-sm">
                {fireAlerts?.note ?? 'Module cảnh báo cháy chưa sẵn sàng.'}
              </p>
            )}
          </CardContent>
        </Card>
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

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
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

function DistrictTable({ districts }: { districts: DistrictCoverage[] }) {
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
