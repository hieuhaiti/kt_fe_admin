import { useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import { useQueryClient } from '@tanstack/react-query'
import { CloudUpload, Copy, Download, ExternalLink, Loader2 } from 'lucide-react'
import { satelliteService, useApiMutation, useApiQuery } from '@/service'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import type { SatelliteRgbBody, SatelliteNdviBody, SatelliteHeatMapBody } from '@/types/api'
import { hasPerm } from '@/lib/permissions'
import { useAuthStore } from '@/stores/common/useAuthStore'
import { buildGeoserverPreviewUrl } from '@/lib/geoserver'

type Mode = 'rgb' | 'ndvi' | 'heat'
const MODES: { value: Mode; label: string; help: string }[] = [
  {
    value: 'rgb',
    label: 'Ảnh màu tự nhiên',
    help: 'Quan sát bề mặt theo màu gần với thực tế',
  },
  {
    value: 'ndvi',
    label: 'Chỉ số thực vật',
    help: 'Đánh giá mức độ xanh của thảm thực vật',
  },
  { value: 'heat', label: 'Nhiệt độ bề mặt', help: 'Phân bố nhiệt độ bề mặt' },
]

export default function SatellitePage() {
  const user = useAuthStore((s) => s.user)
  // Cùng permission với fire-risk + forest-classification publish. Admin
  // được cấp qua migration 031 (system_admin + so_nnmt).
  const canPublish = hasPerm(user, 'map_layers', 'ingest_raster')
  const queryClient = useQueryClient()

  const [mode, setMode] = useState<Mode>('rgb')
  const [start, setStart] = useState('2026-06-01')
  const [end, setEnd] = useState('2026-06-30')
  const [cloud, setCloud] = useState('30')
  const [ndviThresh, setNdviThresh] = useState('0.4')

  // State cho publish job — 1 job/render, giữ trong state đến khi user chạy
  // request mới hoặc job vào terminal state.
  const [publishJobId, setPublishJobId] = useState<number | null>(null)
  const [publishBusy, setPublishBusy] = useState(false)

  const mutation = useApiMutation<any, any>((body: any) => {
    switch (mode) {
      case 'rgb':
        return satelliteService.rgb(body as SatelliteRgbBody) as any
      case 'ndvi':
        return satelliteService.ndvi(body as SatelliteNdviBody) as any
      case 'heat':
        return satelliteService.heatMap(body as SatelliteHeatMapBody) as any
    }
  })

  const publishMutation = useApiMutation<any, { resultId: number; force?: boolean }>(
    ({ resultId, force }) => satelliteService.publishResult(resultId, force) as any
  )

  const onRun = () => {
    const base: any = { startDate: start, endDate: end, cloudCover: Number(cloud) || undefined }
    if (mode === 'ndvi') base.ndviMinThresh = Number(ndviThresh) || undefined
    if (mode === 'heat') delete base.cloudCover
    // Reset publish state khi user chạy request mới
    setPublishJobId(null)
    setPublishBusy(false)
    mutation.mutate(base)
  }

  // API trả về `{ resultId, geeTileUrl, downloadUrl, downloadFilename, ..., geoserverLayer }`.
  // Compat với 2 dạng: root-level và trong `data`.
  const result = (mutation.data?.data ?? mutation.data) as any
  const resultId = result?.resultId ?? result?.data?.resultId ?? null
  const tileUrl = result?.geeTileUrl || result?.tileUrl || result?.tileUrlTemplate || null
  const downloadUrl = result?.downloadUrl || result?.metadata?.downloadUrl || null
  const downloadFilename = result?.downloadFilename || result?.metadata?.downloadFilename || null
  const geoserverLayer = result?.geoserverLayer || null
  const cached = result?.cached
  const stats = result?.stats || result?.statistics

  // Poll ingest job — dừng khi terminal.
  const jobQuery = useApiQuery(
    ['satellite-ingest-job', publishJobId],
    () => satelliteService.getIngestJob(publishJobId as number),
    {
      enabled: publishJobId != null,
      refetchInterval: (data: any) => {
        const st = data?.data?.data?.status ?? data?.data?.status
        return st && ['completed', 'failed', 'cancelled'].includes(st) ? false : 5000
      },
      refetchOnWindowFocus: false,
    } as any,
    false
  )
  const job: any = (jobQuery.data as any)?.data ?? (jobQuery.data as any)
  const terminal = job && ['completed', 'failed', 'cancelled'].includes(job.status)

  // Khi job terminal → toast + invalidate + auto-clear busy.
  useEffect(() => {
    if (!terminal || !publishBusy) return
    setPublishBusy(false)
    if (job.status === 'completed') {
      toast.success('Đã công bố ảnh lên bản đồ.')
      // Refetch result (nếu re-run request), tuy nhiên satellite là on-demand
      // không có "latest" cache — chỉ cần clear publish state.
      void queryClient.invalidateQueries({ queryKey: ['satellite-ingest-job'] })
    } else {
      toast.error('Không thể công bố ảnh. Vui lòng thử lại.')
    }
  }, [terminal, publishBusy, job?.status, job?.geoserver_layer, job?.error_log, queryClient])

  const onPublish = async () => {
    if (!resultId) {
      toast.error('Chưa có kết quả để công bố. Chạy phân tích trước.')
      return
    }
    if (!downloadUrl) {
      toast.error('Ảnh chưa sẵn sàng để tải xuống — hãy chạy lại phân tích.')
      return
    }
    setPublishBusy(true)
    try {
      const res: any = await publishMutation.mutateAsync({ resultId })
      const data = res?.data?.data ?? res?.data
      if (data?.alreadyPublished) {
        setPublishBusy(false)
        toast.info('Ảnh đã có sẵn trên bản đồ.')
        return
      }
      if (data?.jobId) {
        setPublishJobId(Number(data.jobId))
        toast.success('Đã gửi yêu cầu công bố ảnh, đang xử lý...')
      }
    } catch {
      setPublishBusy(false)
      toast.error('Không thể công bố ảnh. Vui lòng thử lại.')
    }
  }

  const dismissJob = () => setPublishJobId(null)

  const copyTileUrl = () => {
    if (!tileUrl) return
    navigator.clipboard.writeText(tileUrl)
    toast.success('Đã sao chép liên kết xem trước.')
  }

  return (
    <div className="flex-1 space-y-6 overflow-y-auto p-6">
      <div>
        <h1 className="text-2xl font-bold">Ảnh vệ tinh theo yêu cầu</h1>
        <p className="text-muted-foreground text-sm">
          Chọn chế độ và khoảng thời gian để phân tích ảnh vệ tinh, tính toán diện tích và tạo bản
          xem trước. Kết quả có thể được công bố lên bản đồ dùng chung.
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
              <LabeledInput
                label="Tỷ lệ mây tối đa (%)"
                value={cloud}
                onChange={setCloud}
                type="number"
              />
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

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={onRun} disabled={mutation.isPending}>
              {mutation.isPending ? (
                <>
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  Đang xử lý...
                </>
              ) : (
                'Chạy phân tích'
              )}
            </Button>
            {cached && (
              <Badge variant="outline" className="text-[10px] text-slate-600">
                Kết quả đã lưu
              </Badge>
            )}
          </div>

          {result && (
            <div className="space-y-3 pt-2">
              {/* Result meta */}
              {resultId && (
                <p className="text-muted-foreground text-xs">
                  Mã kết quả: <code className="bg-muted rounded px-1 py-0.5">{resultId}</code>
                </p>
              )}

              {/* Tile URL — mỗi loại có 1 URL riêng, hiện copy + open */}
              {tileUrl && (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-muted-foreground min-w-0 flex-1">
                    Bản xem trước đã sẵn sàng
                  </span>
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={copyTileUrl}
                    title="Sao chép liên kết xem trước"
                  >
                    <Copy className="h-3 w-3" />
                    Sao chép liên kết
                  </Button>
                </div>
              )}

              {/* Download URL — GEE TTL 24h. Ưu tiên cho user tải nhanh trước
                  khi publish (persistent) qua GeoServer. */}
              {downloadUrl && (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Download className="h-3 w-3 shrink-0 text-slate-500" />
                  <a
                    href={downloadUrl}
                    download={downloadFilename ?? undefined}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-primary min-w-0 flex-1 truncate hover:underline"
                    title={downloadFilename ?? undefined}
                  >
                    Tải ảnh tạm thời (hết hạn sau 24 giờ)
                  </a>
                </div>
              )}

              {/* ── Publish section — quyền map_layers.ingest_raster ────── */}
              {canPublish && (
                <div className="bg-background/60 flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
                  <div className="min-w-0 flex-1 text-xs">
                    <p className="font-semibold">Công bố lên bản đồ</p>
                    <p className="text-muted-foreground mt-0.5">
                      Lưu kết quả ổn định để sử dụng trên toàn hệ thống. Cập nhật lại nếu muốn thay
                      thế kết quả đã công bố.
                    </p>

                    {/* Đã publish sẵn (từ cache) */}
                    {geoserverLayer && !job && (
                      <p className="mt-2 flex flex-wrap items-center gap-2 text-emerald-700">
                        <span>Đã sẵn sàng trên bản đồ.</span>
                        {buildGeoserverPreviewUrl(String(geoserverLayer)) && (
                          <a
                            href={buildGeoserverPreviewUrl(String(geoserverLayer))!}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="flex items-center gap-1 text-emerald-700 hover:underline"
                          >
                            Xem bản đồ <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </p>
                    )}

                    {/* Đang publish → progress + status */}
                    {job && !terminal && (
                      <p className="mt-2 flex items-center gap-2 text-sky-700">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>
                          Đang xử lý ({job.progress ?? 0}%) — {statusVi(job.status)}
                        </span>
                      </p>
                    )}

                    {/* Job xong: hiển thị link + nút đóng */}
                    {job?.status === 'completed' && job.geoserver_layer && (
                      <p className="mt-2 flex flex-wrap items-center gap-2 text-emerald-700">
                        <span>Đã sẵn sàng trên bản đồ.</span>
                        {buildGeoserverPreviewUrl(String(job.geoserver_layer)) && (
                          <a
                            href={buildGeoserverPreviewUrl(String(job.geoserver_layer))!}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="flex items-center gap-1 hover:underline"
                          >
                            Xem bản đồ <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                        <Button
                          variant="link"
                          size="xs"
                          className="h-auto p-0 text-[10px] text-slate-500"
                          onClick={dismissJob}
                        >
                          Đóng
                        </Button>
                      </p>
                    )}

                    {/* Job fail */}
                    {job?.status === 'failed' && (
                      <p className="mt-2 flex flex-wrap items-center gap-2 text-red-700">
                        <span>Không thể công bố ảnh. Vui lòng thử lại.</span>
                        <Button
                          variant="link"
                          size="xs"
                          className="h-auto p-0 text-[10px] text-slate-500"
                          onClick={dismissJob}
                        >
                          Đóng
                        </Button>
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    onClick={onPublish}
                    disabled={!resultId || !downloadUrl || publishBusy || (job && !terminal)}
                    title={
                      !resultId
                        ? 'Chưa có kết quả'
                        : !downloadUrl
                          ? 'Ảnh chưa sẵn sàng để tải xuống'
                          : geoserverLayer
                            ? 'Đã công bố — bấm để cập nhật lại'
                            : 'Công bố ảnh lên bản đồ'
                    }
                  >
                    {publishBusy ? (
                      <>
                        <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                        Đang gửi...
                      </>
                    ) : geoserverLayer ? (
                      <>
                        <CloudUpload className="mr-1 h-3.5 w-3.5" />
                        Đã công bố
                      </>
                    ) : (
                      <>
                        <CloudUpload className="mr-1 h-3.5 w-3.5" />
                        Công bố
                      </>
                    )}
                  </Button>
                </div>
              )}

              {/* Statistics (nếu có) */}
              {stats && (
                <pre className="bg-muted max-h-64 overflow-auto rounded p-3 text-xs">
                  {JSON.stringify(stats, null, 2)}
                </pre>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function statusVi(s?: string) {
  switch (s) {
    case 'pending':
      return 'chờ xử lý'
    case 'downloading':
      return 'đang tải ảnh'
    case 'validating':
      return 'đang kiểm tra'
    case 'uploading':
      return 'đang lưu dữ liệu'
    case 'publishing':
      return 'đang cập nhật bản đồ'
    case 'completed':
      return 'hoàn tất'
    case 'failed':
      return 'thất bại'
    case 'cancelled':
      return 'đã hủy'
    default:
      return s || 'đang xử lý'
  }
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
