import { useState } from 'react'
import { toast } from 'react-toastify'
import { fireRiskService, useApiQuery, useApiMutation } from '@/service'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatDateTime } from '@/lib/date'

export default function FireRiskPage() {
  const [minRiskLevel, setMinRiskLevel] = useState('4')
  const [page, setPage] = useState(1)

  const latestQuery = useApiQuery(['fire-risk-latest', minRiskLevel], () =>
    fireRiskService.getLatest({ minRiskLevel: Number(minRiskLevel) || undefined })
  )
  const historyQuery = useApiQuery(['fire-risk-history', page], () =>
    fireRiskService.getHistory({ page, limit: 10 })
  )
  const refreshMutation = useApiMutation((body: { analysisDate?: string }) =>
    fireRiskService.refresh(body)
  )

  const latest = latestQuery.data?.data
  const history = historyQuery.data?.data?.items ?? []

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Cảnh báo cháy rừng</h1>
          <p className="text-muted-foreground text-sm">
            Cập nhật hàng ngày lúc 06:00. Sử dụng Sentinel-2 + MODIS LST + ERA5-Land + P Nesterov.
          </p>
        </div>
        <Button
          onClick={() =>
            refreshMutation.mutate({}, { onSuccess: () => toast.success('Đã gửi yêu cầu chạy lại') })
          }
          disabled={refreshMutation.isPending}
        >
          {refreshMutation.isPending ? 'Đang chạy...' : 'Chạy lại phân tích'}
        </Button>
      </div>

      <Card>
        <CardContent className="space-y-3 p-6">
          <div className="flex items-end gap-3">
            <div className="w-40">
              <label className="mb-1 block text-sm">Ngưỡng cảnh báo tối thiểu</label>
              <Input
                type="number"
                min={1}
                max={5}
                value={minRiskLevel}
                onChange={(e) => setMinRiskLevel(e.target.value)}
              />
            </div>
          </div>

          {latest ? (
            <div className="grid gap-4 md:grid-cols-3">
              <Stat label="Trung bình toàn tỉnh" value={latest.provinceSummary?.avgRiskLevel} />
              <Stat label="Cao nhất" value={latest.provinceSummary?.maxRiskLevel} />
              <Stat label="Diện tích cảnh báo (ha)" value={latest.provinceSummary?.areaHa} />
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">Đang tải...</p>
          )}

          {latest?.stale && (
            <div className="rounded-md border border-amber-400 bg-amber-50 p-3 text-sm text-amber-800">
              Dữ liệu đã cũ hơn 24h.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <h2 className="mb-3 text-lg font-semibold">Lịch sử chạy phân tích</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Ngày phân tích</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Tạo lúc</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((h) => (
                <TableRow key={h.id}>
                  <TableCell>{h.id}</TableCell>
                  <TableCell>{h.analysisDate}</TableCell>
                  <TableCell>{h.status}</TableCell>
                  <TableCell>{h.createdAt ? formatDateTime(h.createdAt) : '—'}</TableCell>
                </TableRow>
              ))}
              {!history.length && (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground text-center">
                    Chưa có bản ghi.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Trước
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)}>
              Sau
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="text-2xl font-bold">{value ?? '—'}</p>
    </div>
  )
}
