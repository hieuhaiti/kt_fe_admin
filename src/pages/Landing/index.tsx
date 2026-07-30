import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { statisticsService, useApiQuery } from '@/service'
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { navConfig } from '@/constant/common'
import { useAuthStore } from '@/stores/common/useAuthStore'
import { checkPermission, ROLE_LABELS, getUserRole, hasPerm } from '@/lib/permissions'
import type { NavItem } from '@/types/common'
import {
  ArrowRight,
  BookOpenText,
  Building2,
  Flame,
  LayoutDashboard,
  Mail,
  MessageSquareWarning,
  Phone,
  Trees,
} from 'lucide-react'

const HDSD_URL = 'http://103.163.119.247:8881/uploads/dl_hdsd_admin.docx'

function formatPct(v?: number | null) {
  if (v == null) return '—'
  return `${v.toLocaleString('vi-VN', { maximumFractionDigits: 2 })}%`
}

function formatInt(v?: number | null) {
  if (v == null) return '—'
  return v.toLocaleString('vi-VN')
}

function isExternalPath(path: string) {
  return /^https?:\/\//i.test(path)
}

export default function LandingPage() {
  const user = useAuthStore((s) => s.user)
  const userName = user?.fullName || user?.email || 'bạn'
  const roleLabel = user ? ROLE_LABELS[getUserRole(user) ?? ''] : ''

  // Chỉ fetch dashboard khi user có quyền, tránh 403 spam log.
  const canReadDashboard = hasPerm(user, 'statistics', 'dashboard')
  const dashboardQuery = useApiQuery(
    ['landing-dashboard'],
    () => statisticsService.getDashboard(),
    { enabled: canReadDashboard, staleTime: 60_000 }
  )
  const stats = dashboardQuery.data?.data

  const quickLinks = useMemo(() => {
    return navConfig
      .filter((item): item is NavItem => !isExternalPath(item.path))
      .filter((item) => checkPermission(user, item.permission))
  }, [user])

  const fireRisk = stats?.fireAlerts
  const feedback = stats?.feedback
  const forest = stats?.forest
  const classification = stats?.forestClassification

  return (
    <div className="flex-1 space-y-6 overflow-y-auto">
      {/* Hero */}
      <section className="from-primary/10 via-background to-background relative overflow-hidden rounded-2xl border bg-linear-to-br p-8 md:p-10">
        <div className="max-w-3xl">
          <div className="text-primary mb-3 text-sm font-medium">
            {roleLabel ? `Chào ${userName} · ${roleLabel}` : `Chào ${userName}`}
          </div>
          <h1 className="text-foreground text-3xl leading-tight font-bold md:text-4xl">
            Kon Tum GIS — Nền tảng WebGIS &amp; Cảnh báo cháy rừng
          </h1>
          <p className="text-muted-foreground mt-3 text-base md:text-lg">
            Giám sát tài nguyên rừng, ảnh vệ tinh, thời tiết và phản ánh hiện trường của tỉnh Kon
            Tum trên một nền tảng thống nhất.
          </p>
          {canReadDashboard && (
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild>
                <Link to="/dashboard">
                  <LayoutDashboard className="mr-2 h-4 w-4" />
                  Tới bảng điều hành
                </Link>
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* KPI */}
      {canReadDashboard && (
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            icon={<Trees className="h-5 w-5" />}
            label="Che phủ rừng toàn tỉnh"
            value={formatPct(forest?.provinceCoveragePct)}
            hint={
              forest?.totalForestHa != null
                ? `${(forest.totalForestHa / 100).toLocaleString('vi-VN', {
                    maximumFractionDigits: 1,
                  })} km² rừng`
                : undefined
            }
          />
          <KpiCard
            icon={<Flame className="h-5 w-5 text-orange-500" />}
            label="Cấp cháy cao nhất"
            value={fireRisk?.maxLevel != null ? `Cấp ${fireRisk.maxLevel}` : '—'}
            hint={fireRisk?.analysisDate ? `Cập nhật ${fireRisk.analysisDate}` : 'Chưa có snapshot'}
          />
          <KpiCard
            icon={<MessageSquareWarning className="h-5 w-5 text-blue-500" />}
            label="Phản ánh"
            value={formatInt(feedback?.total)}
            hint={
              feedback?.byStatus?.new != null ? `${feedback.byStatus.new} mới chờ xử lý` : undefined
            }
          />
          <KpiCard
            icon={<LayoutDashboard className="h-5 w-5 text-emerald-600" />}
            label="Phân loại rừng"
            value={
              classification?.year && classification?.month
                ? `${String(classification.month).padStart(2, '0')}/${classification.year}`
                : '—'
            }
            hint={
              classification?.forestCoveragePct != null
                ? `Che phủ ${formatPct(classification.forestCoveragePct)}`
                : (classification?.note ?? undefined)
            }
          />
        </section>
      )}

      {/* Quick links */}
      <section>
        <div className="mb-3 flex items-end justify-between">
          <div>
            <h2 className="text-xl font-semibold">Truy cập nhanh</h2>
            <p className="text-muted-foreground text-sm">Các module bạn có quyền sử dụng.</p>
          </div>
        </div>
        {quickLinks.length === 0 ? (
          <Card>
            <CardContent className="text-muted-foreground p-6 text-sm">
              Bạn chưa được cấp quyền vào module nào. Liên hệ quản trị viên để được hỗ trợ.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {quickLinks.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className="group hover:border-primary/40 hover:bg-primary/5 bg-card flex items-center gap-3 rounded-lg border p-4 transition-colors"
              >
                <div className="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-md">
                  {item.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-foreground font-medium">{item.name}</div>
                </div>
                <ArrowRight className="text-muted-foreground group-hover:text-primary h-4 w-4 transition-colors" />
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Contact / Docs footer */}
      <section className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="space-y-2 p-6">
            <div className="text-primary mb-2 flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              <CardTitle className="text-base">Đơn vị vận hành</CardTitle>
            </div>
            <div className="text-sm font-medium">Sở Nông nghiệp &amp; Môi trường tỉnh Kon Tum</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-2 p-6">
            <div className="text-primary mb-2 flex items-center gap-2">
              <BookOpenText className="h-4 w-4" />
              <CardTitle className="text-base">Tài liệu &amp; hướng dẫn</CardTitle>
            </div>
            <CardDescription>
              Hướng dẫn sử dụng chi tiết cho từng module trong hệ thống.
            </CardDescription>
            <a
              href={HDSD_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary inline-flex items-center gap-1 text-sm font-medium hover:underline"
            >
              Tải HDSD Admin (.docx)
              <ArrowRight className="h-3.5 w-3.5" />
            </a>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}

function KpiCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode
  label: string
  value: string
  hint?: string
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          {icon}
          <span>{label}</span>
        </div>
        <div className="mt-2 text-2xl font-semibold">{value}</div>
        {hint && <div className="text-muted-foreground mt-1 text-xs">{hint}</div>}
      </CardContent>
    </Card>
  )
}
