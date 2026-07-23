import { useMemo, useState, type ComponentType } from 'react'
import { toast } from 'react-toastify'
import {
  Activity,
  Cloud,
  CloudRain,
  CloudSun,
  Compass,
  Droplets,
  Eye,
  Gauge,
  Link2,
  MapPin,
  RefreshCcw,
  Thermometer,
  Wind,
} from 'lucide-react'
import { weatherService, useApiQuery, useApiMutation } from '@/service'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { WeatherLayer, WeatherLayerType } from '@/types/api'
import { cn } from '@/lib/utils'
import { hasPerm } from '@/lib/permissions'
import { useAuthStore } from '@/stores/common/useAuthStore'

const LAYER_TYPES: {
  value: WeatherLayerType
  label: string
  description: string
  icon: ComponentType<{ className?: string }>
}[] = [
  { value: 'temp', label: 'Nhiệt độ', description: 'Lớp nhiệt bề mặt', icon: Thermometer },
  { value: 'rain', label: 'Mưa', description: 'Cường độ mưa', icon: CloudRain },
  { value: 'cloud', label: 'Mây', description: 'Độ phủ mây', icon: Cloud },
  { value: 'wind', label: 'Gió', description: 'Trường gió', icon: Wind },
  { value: 'pressure', label: 'Áp suất', description: 'Khí áp bề mặt', icon: Gauge },
]

function formatNumber(value?: number | null, suffix = '', maximumFractionDigits = 1) {
  if (value == null || Number.isNaN(Number(value))) return '-'
  return `${Number(value).toLocaleString('vi-VN', { maximumFractionDigits })}${suffix}`
}

function formatDateTime(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function getLayerUrl(layer: WeatherLayer) {
  return layer.tileUrl || layer.tileUrlTemplate || ''
}

function getLayerName(layer: WeatherLayer) {
  const config = LAYER_TYPES.find((item) => item.value === layer.type)
  return layer.name || config?.label || layer.type
}

export default function WeatherPage() {
  const user = useAuthStore((s) => s.user)
  const canManage = hasPerm(user, 'weather', 'manage')
  const [type, setType] = useState<WeatherLayerType>('temp')
  const [lng, setLng] = useState('108.0')
  const [lat, setLat] = useState('14.35')

  const selectedConfig = useMemo(
    () => LAYER_TYPES.find((item) => item.value === type) ?? LAYER_TYPES[0],
    [type]
  )
  const SelectedIcon = selectedConfig.icon

  const layersQuery = useApiQuery(['weather-layers', type], () =>
    weatherService.getLayers({ type })
  )

  const pointMutation = useApiMutation((v: { lng: number; lat: number }) =>
    weatherService.getPoint(v)
  )

  const refreshMutation = useApiMutation(() => weatherService.refresh())

  const layers = layersQuery.data?.data?.layers ?? []
  const point = pointMutation.data?.data
  const canQueryPoint = Number.isFinite(Number(lng)) && Number.isFinite(Number(lat))

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="shrink-0 border-b p-6 pb-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2">
              <CloudSun className="text-primary size-6" />
              <h1 className="text-2xl font-bold">Thời tiết</h1>
            </div>
            <p className="text-muted-foreground mt-2 text-sm">
              Quản lý lớp thời tiết OpenWeather, kiểm tra dữ liệu tại điểm và làm mới cache phục vụ bản đồ WebGIS.
            </p>
          </div>
          {canManage && (
            <Button
              disabled={refreshMutation.isPending}
              onClick={() =>
                refreshMutation.mutate(undefined, {
                  onSuccess: () => toast.success('Đã làm mới cache thời tiết'),
                })
              }
              className="w-full sm:w-auto"
            >
              <RefreshCcw className={cn('size-4', refreshMutation.isPending && 'animate-spin')} />
              {refreshMutation.isPending ? 'Đang làm mới...' : 'Làm mới cache'}
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto p-6">
        <div className="grid gap-3 md:grid-cols-3">
          <MetricCard
            icon={Activity}
            label="Loại lớp đang xem"
            value={selectedConfig.label}
            hint={selectedConfig.description}
          />
          <MetricCard
            icon={CloudSun}
            label="Layer khả dụng"
            value={formatNumber(layers.length, '', 0)}
            hint={layersQuery.isFetching ? 'Đang tải danh sách' : 'Theo cấu hình backend'}
          />
          <MetricCard
            icon={MapPin}
            label="Điểm mặc định"
            value={`${lng}, ${lat}`}
            hint="Khu vực Kon Tum"
          />
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <SelectedIcon className="text-primary size-5" />
                  Lớp thời tiết bản đồ
                </CardTitle>
                <CardDescription>
                  Chọn lớp dữ liệu để kiểm tra tile proxy trước khi hiển thị trên bản đồ nghiệp vụ.
                </CardDescription>
              </div>
              <Badge variant="outline" className="w-fit">
                OpenWeather
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
              {LAYER_TYPES.map((item) => {
                const Icon = item.icon
                const active = type === item.value

                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setType(item.value)}
                    className={cn(
                      'cursor-pointer rounded-md border p-3 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                      active
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'hover:bg-accent hover:text-accent-foreground'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="size-4" />
                      <span className="font-medium">{item.label}</span>
                    </div>
                    <p className="text-muted-foreground mt-1 text-xs">{item.description}</p>
                  </button>
                )
              })}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {layers.map((layer, index) => (
                <LayerCard key={`${layer.type}-${layer.owmLayer ?? index}`} layer={layer} />
              ))}

              {layersQuery.isFetching && (
                <div className="text-muted-foreground rounded-md border border-dashed p-4 text-sm">
                  Đang tải cấu hình lớp thời tiết...
                </div>
              )}

              {!layers.length && !layersQuery.isFetching && (
                <div className="text-muted-foreground rounded-md border border-dashed p-4 text-sm">
                  Chưa có lớp thời tiết phù hợp với loại đã chọn.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <MapPin className="text-primary size-5" />
              Tra cứu thời tiết tại điểm
            </CardTitle>
            <CardDescription>
              Nhập tọa độ để kiểm tra dữ liệu quan trắc đang được cache cho khu vực cần theo dõi.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
              <div className="space-y-1.5">
                <Label htmlFor="weather-lng">Kinh độ</Label>
                <Input
                  id="weather-lng"
                  type="number"
                  step="0.000001"
                  value={lng}
                  onChange={(e) => setLng(e.target.value)}
                  placeholder="108.0"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="weather-lat">Vĩ độ</Label>
                <Input
                  id="weather-lat"
                  type="number"
                  step="0.000001"
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  placeholder="14.35"
                />
              </div>
              <Button
                onClick={() => pointMutation.mutate({ lng: Number(lng), lat: Number(lat) })}
                disabled={pointMutation.isPending || !canQueryPoint}
                className="w-full md:w-auto"
              >
                <MapPin className="size-4" />
                {pointMutation.isPending ? 'Đang tra cứu...' : 'Tra cứu'}
              </Button>
            </div>

            {!canQueryPoint && (
              <p className="text-destructive text-sm">Kinh độ và vĩ độ phải là số hợp lệ.</p>
            )}

            {point ? (
              <div className="space-y-4">
                <div className="border-primary/20 bg-primary/5 rounded-md border p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-lg font-semibold">{point.location ?? 'Vị trí đã chọn'}</p>
                      <p className="text-muted-foreground text-sm">
                        {point.weather?.description ?? point.description ?? 'Chưa có mô tả thời tiết'}
                      </p>
                    </div>
                    <Badge variant={point.stale ? 'destructive' : 'secondary'} className="w-fit">
                      {point.stale ? 'Dữ liệu cũ' : point.cached ? 'Từ cache' : 'Mới cập nhật'}
                    </Badge>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <MetricCard icon={Thermometer} label="Nhiệt độ" value={formatNumber(point.temp ?? point.temperature, '°C')} />
                  <MetricCard icon={Thermometer} label="Cảm nhận" value={formatNumber(point.feelsLike, '°C')} />
                  <MetricCard icon={Droplets} label="Độ ẩm" value={formatNumber(point.humidity, '%', 0)} />
                  <MetricCard icon={Gauge} label="Áp suất" value={formatNumber(point.pressure, ' hPa', 0)} />
                  <MetricCard icon={Wind} label="Tốc độ gió" value={formatNumber(point.wind?.speed ?? point.windSpeed, ' m/s')} />
                  <MetricCard icon={Compass} label="Hướng gió" value={formatNumber(point.wind?.deg ?? point.windDeg, '°', 0)} />
                  <MetricCard icon={Cloud} label="Mây" value={formatNumber(point.clouds, '%', 0)} />
                  <MetricCard icon={Eye} label="Tầm nhìn" value={formatNumber(point.visibility, ' m', 0)} />
                </div>

                <div className="text-muted-foreground grid gap-2 rounded-md border p-3 text-xs md:grid-cols-2">
                  <p>Quan trắc: {formatDateTime(point.observedAt ?? point.timestamp)}</p>
                  <p>Cập nhật cache: {formatDateTime(point.fetchedAt)}</p>
                </div>
              </div>
            ) : (
              <div className="text-muted-foreground rounded-md border border-dashed p-4 text-sm">
                Nhập tọa độ và bấm tra cứu để xem nhiệt độ, gió, mây, mưa và trạng thái cache.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function LayerCard({ layer }: { layer: WeatherLayer }) {
  const tileUrl = getLayerUrl(layer)

  return (
    <div className="rounded-md border p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">{getLayerName(layer)}</p>
          <p className="text-muted-foreground text-xs">
            {layer.owmLayer ? `OpenWeather layer: ${layer.owmLayer}` : 'Tile proxy nội bộ'}
          </p>
        </div>
        {layer.attribution && (
          <Badge variant="secondary" className="shrink-0">
            {layer.attribution}
          </Badge>
        )}
      </div>
      {tileUrl && (
        <div className="bg-muted mt-3 flex items-start gap-2 rounded-md p-2">
          <Link2 className="text-muted-foreground mt-0.5 size-3.5 shrink-0" />
          <p className="text-muted-foreground min-w-0 truncate font-mono text-xs">{tileUrl}</p>
        </div>
      )}
    </div>
  )
}

function MetricCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: ComponentType<{ className?: string }>
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="rounded-md border p-4">
      <div className="text-muted-foreground flex items-center gap-2 text-xs">
        <Icon className="size-3.5" />
        <span>{label}</span>
      </div>
      <p className="mt-2 text-xl font-semibold">{value}</p>
      {hint && <p className="text-muted-foreground mt-1 text-xs">{hint}</p>}
    </div>
  )
}
