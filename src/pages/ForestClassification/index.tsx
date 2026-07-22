import { useState } from 'react'
import { toast } from 'react-toastify'
import { forestClassificationService, useApiQuery, useApiMutation } from '@/service'
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
import ForestGroundTruthCard from './ForestGroundTruthCard'

export default function ForestClassificationPage() {
  const now = new Date()
  const [year, setYear] = useState(String(now.getFullYear()))
  const [month, setMonth] = useState(String(now.getMonth() + 1))
  const [page, setPage] = useState(1)

  const latestQuery = useApiQuery(['forest-class-latest'], () =>
    forestClassificationService.getLatest()
  )
  const historyQuery = useApiQuery(['forest-class-history', page], () =>
    forestClassificationService.getHistory({ page, limit: 10 })
  )
  const refreshMutation = useApiMutation((v: { year: number; month: number }) =>
    forestClassificationService.refresh(v)
  )

  const latest = latestQuery.data?.data
  const items = historyQuery.data?.data?.items ?? []

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Phân loại rừng</h1>
        <p className="text-muted-foreground text-sm">
          Random Forest 11 lớp — chạy hàng tháng. Có thể chạy thủ công cho tháng bất kì.
        </p>
      </div>

      {/* Ground truth intake — collapsible */}
      <ForestGroundTruthCard />

      <Card>
        <CardContent className="space-y-3 p-6">
          <h2 className="text-lg font-semibold">Bản ghi mới nhất</h2>
          {latest ? (
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-md border p-3">
                <p className="text-muted-foreground text-xs">Kỳ dữ liệu</p>
                <p className="text-lg font-medium">
                  {latest.year}-{String(latest.month).padStart(2, '0')}
                </p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-muted-foreground text-xs">Cập nhật</p>
                <p className="text-lg font-medium">
                  {latest.updatedAt ? formatDateTime(latest.updatedAt) : '—'}
                </p>
              </div>
              {latest.tileUrlTemplate && (
                <div className="col-span-2 rounded-md border p-3">
                  <p className="text-muted-foreground text-xs">Tile URL</p>
                  <code className="text-xs">{latest.tileUrlTemplate}</code>
                </div>
              )}
              {latest.legend && (
                <div className="col-span-2 rounded-md border p-3">
                  <p className="text-muted-foreground mb-2 text-xs">Chú giải</p>
                  <div className="flex flex-wrap gap-2">
                    {latest.legend.map((c: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 rounded-md border px-2 py-1 text-xs">
                        <span className="h-3 w-3 rounded" style={{ background: c.color }} />
                        <span>{c.label}</span>
                        {c.areaHa != null && (
                          <span className="text-muted-foreground">({c.areaHa.toFixed?.(0)}ha)</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">Đang tải...</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-6">
          <h2 className="text-lg font-semibold">Chạy phân loại</h2>
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm">Năm</label>
              <Input type="number" value={year} onChange={(e) => setYear(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm">Tháng</label>
              <Input
                type="number"
                min={1}
                max={12}
                value={month}
                onChange={(e) => setMonth(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button
                disabled={refreshMutation.isPending}
                onClick={() =>
                  refreshMutation.mutate(
                    { year: Number(year), month: Number(month) },
                    { onSuccess: () => toast.success('Đã gửi yêu cầu chạy') }
                  )
                }
              >
                {refreshMutation.isPending ? 'Đang chạy...' : 'Chạy'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <h2 className="mb-3 text-lg font-semibold">Lịch sử</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Kỳ</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Tạo lúc</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((h) => (
                <TableRow key={h.id}>
                  <TableCell>{h.id}</TableCell>
                  <TableCell>
                    {h.year}-{String(h.month).padStart(2, '0')}
                  </TableCell>
                  <TableCell>{h.status}</TableCell>
                  <TableCell>{h.createdAt ? formatDateTime(h.createdAt) : '—'}</TableCell>
                </TableRow>
              ))}
              {!items.length && (
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
