import { useEffect, useMemo, useState } from 'react'
import { statisticsService, useApiQuery } from '@/service'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ChevronDown, RefreshCcw } from 'lucide-react'
import type { ForestType, LandcoverParams } from '@/types/api'

const FOREST_TYPES: { value: ForestType; label: string }[] = [
  { value: 'total', label: 'Tổng' },
  { value: 'natural', label: 'Tự nhiên' },
  { value: 'planted', label: 'Trồng' },
  { value: 'non_forest', label: 'Không rừng' },
]

interface LandcoverItem {
  unitCode?: string
  unitName?: string
  name?: string
  areaHa?: number
  coveragePct?: number
  [key: string]: any
}

interface LandcoverResponse {
  year?: number | null
  forestType?: ForestType
  items?: LandcoverItem[]
  summary?: { totalAreaHa?: number; totalCoveragePct?: number } | null
  availableYears?: number[]
  no_data?: boolean
}

function formatHa(v?: number) {
  if (v == null) return '—'
  return v.toLocaleString('vi-VN', { maximumFractionDigits: 0 }) + ' ha'
}

function formatPct(v?: number) {
  if (v == null) return '—'
  return v.toLocaleString('vi-VN', { maximumFractionDigits: 2 }) + '%'
}

export default function StatisticsPage() {
  // Không đặt sẵn năm — để server trả về năm mới nhất + danh sách năm hỗ trợ.
  const [year, setYear] = useState<number | null>(null)
  const [forestType, setForestType] = useState<ForestType>('total')

  const params: LandcoverParams = {
    year: year ?? undefined,
    forest_type: forestType,
    by: 'district', // server chỉ hỗ trợ district
  }

  const landcoverQuery = useApiQuery(['landcover', JSON.stringify(params)], () =>
    statisticsService.getLandcover(params)
  )

  const data = (landcoverQuery.data?.data ?? {}) as LandcoverResponse
  const items: LandcoverItem[] = data.items ?? []
  const availableYears = data.availableYears ?? []
  const activeYear = data.year ?? year ?? null

  // Nếu server trả về năm khác với năm đang chọn (do year=null), đồng bộ state.
  useEffect(() => {
    if (year == null && data.year != null) setYear(data.year)
  }, [data.year])

  const yearOptions = useMemo(
    () => (availableYears.length ? availableYears : year != null ? [year] : []),
    [availableYears, year]
  )

  const forestTypeLabel = FOREST_TYPES.find((t) => t.value === forestType)?.label ?? forestType

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="shrink-0 space-y-1 border-b p-6 pb-4">
        <h1 className="text-2xl font-bold">Thống kê lớp phủ rừng</h1>
        <p className="text-muted-foreground text-sm">
          Diện tích rừng theo huyện, dùng cho báo cáo và bảng biểu.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm">Năm</label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full justify-between">
                      <span>{activeYear ?? 'Đang tải...'}</span>
                      <ChevronDown className="size-4 opacity-60" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-(--radix-dropdown-menu-trigger-width)">
                    {yearOptions.map((y) => (
                      <DropdownMenuItem key={y} onSelect={() => setYear(y)}>
                        {y}
                      </DropdownMenuItem>
                    ))}
                    {!yearOptions.length && (
                      <DropdownMenuItem disabled>Chưa có năm nào</DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div>
                <label className="mb-1 block text-sm">Loại rừng</label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full justify-between">
                      <span>{forestTypeLabel}</span>
                      <ChevronDown className="size-4 opacity-60" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-(--radix-dropdown-menu-trigger-width)">
                    {FOREST_TYPES.map((t) => (
                      <DropdownMenuItem key={t.value} onSelect={() => setForestType(t.value)}>
                        {t.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="flex items-end">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => landcoverQuery.refetch()}
                  disabled={landcoverQuery.isFetching}
                >
                  <RefreshCcw className="mr-1 size-4" /> Làm mới
                </Button>
              </div>
            </div>

            {/* {availableYears.length > 0 && (
            <p className="text-muted-foreground text-xs">
              Các năm hiện có: <strong>{availableYears.join(', ')}</strong>
            </p>
          )} */}

            {data.summary && (
              <div className="grid gap-3 md:grid-cols-2">
                <SummaryCard
                  label={`Tổng diện tích ${forestTypeLabel.toLowerCase()}`}
                  value={formatHa(data.summary.totalAreaHa)}
                />
                <SummaryCard
                  label="Độ che phủ toàn tỉnh"
                  value={formatPct(data.summary.totalCoveragePct)}
                />
              </div>
            )}

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Huyện</TableHead>
                  <TableHead>Mã đơn vị</TableHead>
                  <TableHead className="text-right">Diện tích</TableHead>
                  <TableHead className="text-right">Độ che phủ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((it, idx) => (
                  <TableRow key={it.unitCode ?? idx}>
                    <TableCell className="font-medium">{it.unitName ?? it.name ?? '—'}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {it.unitCode ?? '—'}
                    </TableCell>
                    <TableCell className="text-right">{formatHa(it.areaHa)}</TableCell>
                    <TableCell className="text-right">{formatPct(it.coveragePct)}</TableCell>
                  </TableRow>
                ))}
                {!items.length && !landcoverQuery.isFetching && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-muted-foreground text-center">
                      Không có dữ liệu cho năm {activeYear ?? '?'}.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-4">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  )
}
