import { useState } from 'react'
import { satelliteService, useApiMutation } from '@/service'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type {
  SatelliteRgbBody,
  SatelliteNdviBody,
  SatelliteHeatMapBody,
  SatelliteClassifiedBody,
} from '@/types/api'

type Mode = 'rgb' | 'ndvi' | 'heat' | 'classified'
const MODES: { value: Mode; label: string; help: string }[] = [
  { value: 'rgb', label: 'RGB', help: 'Ảnh true-color Sentinel-2' },
  { value: 'ndvi', label: 'NDVI', help: 'Chỉ số thực vật' },
  { value: 'heat', label: 'Nhiệt độ bề mặt', help: 'MODIS LST' },
  { value: 'classified', label: 'Phân loại 11 lớp', help: 'Random Forest v3 (Kon Tum)' },
]

export default function SatellitePage() {
  const [mode, setMode] = useState<Mode>('rgb')
  const [start, setStart] = useState('2026-06-01')
  const [end, setEnd] = useState('2026-06-30')
  const [cloud, setCloud] = useState('30')
  const [ndviThresh, setNdviThresh] = useState('0.4')

  const mutation = useApiMutation<any, any>((body: any) => {
    switch (mode) {
      case 'rgb':
        return satelliteService.rgb(body as SatelliteRgbBody) as any
      case 'ndvi':
        return satelliteService.ndvi(body as SatelliteNdviBody) as any
      case 'heat':
        return satelliteService.heatMap(body as SatelliteHeatMapBody) as any
      case 'classified':
        return satelliteService.classified(body as SatelliteClassifiedBody) as any
    }
  })

  const onRun = () => {
    const base: any = { startDate: start, endDate: end, cloudCover: Number(cloud) || undefined }
    if (mode === 'ndvi') base.ndviMinThresh = Number(ndviThresh) || undefined
    if (mode === 'heat') delete base.cloudCover
    mutation.mutate(base)
  }

  const result = mutation.data?.data

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Ảnh vệ tinh theo yêu cầu</h1>
        <p className="text-muted-foreground text-sm">
          Sử dụng Google Earth Engine — chọn chế độ và khoảng thời gian, hệ thống trả về URL tile + số liệu diện tích.
        </p>
      </div>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex flex-wrap gap-2">
            {MODES.map((m) => (
              <Button
                key={m.value}
                variant={mode === m.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMode(m.value)}
              >
                {m.label}
              </Button>
            ))}
          </div>
          <p className="text-muted-foreground text-sm">
            {MODES.find((m) => m.value === mode)?.help}
          </p>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <LabeledInput label="Từ ngày" value={start} onChange={setStart} type="date" />
            <LabeledInput label="Đến ngày" value={end} onChange={setEnd} type="date" />
            {mode !== 'heat' && (
              <LabeledInput label="Cloud cover (%)" value={cloud} onChange={setCloud} type="number" />
            )}
            {mode === 'ndvi' && (
              <LabeledInput
                label="NDVI min"
                value={ndviThresh}
                onChange={setNdviThresh}
                type="number"
              />
            )}
          </div>

          <Button onClick={onRun} disabled={mutation.isPending}>
            {mutation.isPending ? 'Đang xử lý...' : 'Chạy phân tích'}
          </Button>

          {result && (
            <div className="space-y-2 pt-2">
              {result.tileUrlTemplate && (
                <p className="text-xs">
                  Tile: <code className="bg-muted rounded px-1 py-0.5">{result.tileUrlTemplate}</code>
                </p>
              )}
              {result.statistics && (
                <pre className="bg-muted max-h-64 overflow-auto rounded p-3 text-xs">
                  {JSON.stringify(result.statistics, null, 2)}
                </pre>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function LabeledInput({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
}) {
  return (
    <div>
      <label className="mb-1 block text-sm">{label}</label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}
