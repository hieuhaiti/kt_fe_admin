import { useState } from 'react'
import { mobileService, useApiMutation } from '@/service'
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
import { toast } from 'react-toastify'
import type { FieldUpdateResult } from '@/types/api'

export default function FieldUpdatesPage() {
  const [since, setSince] = useState('')
  const [updates, setUpdates] = useState<FieldUpdateResult[]>([])

  const syncMutation = useApiMutation((params?: { since?: string }) => mobileService.sync(params))

  const onSync = () => {
    syncMutation.mutate(
      { since: since || undefined },
      {
        onSuccess: (res) => {
          setUpdates(res.data?.updates ?? [])
          if (res.data?.serverTime) setSince(res.data.serverTime)
          toast.success(`Đồng bộ ${res.data?.updates?.length ?? 0} cập nhật`)
        },
      }
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Cập nhật hiện trường (Mobile)</h1>
        <p className="text-muted-foreground text-sm">
          Đồng bộ dữ liệu do cán bộ hiện trường gửi lên qua app.
        </p>
      </div>

      <Card>
        <CardContent className="space-y-3 p-6">
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-sm">Kể từ (ISO date)</label>
              <Input value={since} onChange={(e) => setSince(e.target.value)} placeholder="2026-07-01T00:00:00Z" />
            </div>
            <Button onClick={onSync} disabled={syncMutation.isPending}>
              {syncMutation.isPending ? 'Đang đồng bộ...' : 'Đồng bộ'}
            </Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Layer</TableHead>
                <TableHead>Feature</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Tạo lúc</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {updates.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>{u.id}</TableCell>
                  <TableCell>{u.layerCode}</TableCell>
                  <TableCell>{u.featureId ?? '—'}</TableCell>
                  <TableCell>{u.status}</TableCell>
                  <TableCell>{u.createdAt ?? '—'}</TableCell>
                </TableRow>
              ))}
              {!updates.length && (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground text-center">
                    Chưa có cập nhật.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
