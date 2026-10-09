import { useState } from 'react'
import { toast } from 'react-toastify'
import { Copy, KeyRound, Layers, Link2, Play, RotateCcw, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { mapLayerApiService } from '@/service'
import { getMappedErrorMessage } from '@/validators/mapLayerApiValidators'

type PublicTestMeta = {
  fetchedAt?: string
}

export default function PublicSlugTester() {
  const [apiKey, setApiKey] = useState('')
  const [bbox, setBbox] = useState('')
  const [limit, setLimit] = useState('50')
  const [loading, setLoading] = useState(false)
  const [json, setJson] = useState<unknown>(null)
  const [error, setError] = useState<string>('')
  const [meta, setMeta] = useState<PublicTestMeta>({})

  const endpointPreview = bbox.trim()
    ? `/map-data/features?bbox=${bbox.trim()}&limit=${limit || 50}`
    : '/map-data/layer'

  function resetAll() {
    setApiKey('')
    setBbox('')
    setLimit('50')
    setJson(null)
    setError('')
    setMeta({})
  }

  async function handleCopyData() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(json, null, 2))
      toast.success('Đã sao chép dữ liệu')
    } catch {
      toast.error('Không thể sao chép dữ liệu')
    }
  }

  async function handleTest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setJson(null)
    setMeta({})

    if (!apiKey.trim()) {
      setError('Vui lòng nhập khóa API')
      return
    }

    try {
      setLoading(true)
      const response = bbox.trim()
        ? await mapLayerApiService.getConsumerFeatures(apiKey.trim(), {
            bbox: bbox.trim(),
            limit: Number(limit) || 50,
          })
        : await mapLayerApiService.getConsumerLayer(apiKey.trim())

      setJson(response.data ?? response)
      setMeta({ fetchedAt: new Date().toISOString() })
    } catch (err) {
      setError(getMappedErrorMessage(err, 'Không thể truy cập API bản đồ'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
      <Card className="border-primary/25 from-primary/10 via-primary/5 bg-gradient-to-b to-transparent">
        <CardHeader className="space-y-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShieldCheck className="h-5 w-5" />
              Kiểm tra API bản đồ
            </CardTitle>
            <Badge variant="secondary">GET</Badge>
          </div>
          <CardDescription>
            Gọi `/map-data/layer` hoặc `/map-data/features` bằng header `X-Map-Api-Key`.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <form className="space-y-4" onSubmit={handleTest}>
            <div className="space-y-2">
              <Label htmlFor="public-apikey" className="inline-flex items-center gap-2">
                <KeyRound className="h-4 w-4" />
                Khóa API
              </Label>
              <Input
                id="public-apikey"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder="mapk_..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bbox">Vùng truy vấn (bbox)</Label>
              <Input
                id="bbox"
                value={bbox}
                onChange={(event) => setBbox(event.target.value)}
                placeholder="107.3375,13.9194,108.5417,15.4542"
              />
              <p className="text-muted-foreground text-xs">
                Nếu bạn cần xem dữ liệu dạng GeoJSON, xin vui lòng nhập bbox (107.3375,13.9194,108.5417,15.4542).
              </p>
              <p className="text-muted-foreground text-xs">
                Bỏ trống để chỉ xem thông tin lớp dữ liệu.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="limit">Số đối tượng tối đa</Label>
              <Input
                id="limit"
                type="number"
                min={1}
                max={5000}
                value={limit}
                onChange={(event) => setLimit(event.target.value)}
              />
            </div>

            <div className="bg-background/70 rounded-lg border p-3">
              <p className="text-muted-foreground text-xs font-medium">Địa chỉ API</p>
              <p className="text-foreground mt-1 font-mono text-xs break-all">{endpointPreview}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={loading} className="min-w-[140px]">
                <Play className="mr-2 h-4 w-4" />
                {loading ? 'Đang kiểm tra...' : 'Kiểm tra API'}
              </Button>
              <Button type="button" variant="outline" onClick={resetAll}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Làm mới
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="bg-muted/30 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Layers className="h-5 w-5" />
              Phản hồi
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant={error ? 'destructive' : 'secondary'}>{error ? 'Lỗi' : 'Sẵn sàng'}</Badge>
              {meta.fetchedAt && (
                <span className="text-muted-foreground text-xs">
                  {new Date(meta.fetchedAt).toLocaleTimeString('vi-VN')}
                </span>
              )}
            </div>
          </div>
          <CardDescription className="inline-flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            Kết quả từ API bản đồ với khóa đã nhập.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 pt-4">
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="overflow-hidden rounded-md border bg-slate-950">
            <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2 text-xs text-slate-300">
              <span>Kết quả JSON</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopyData}
                className="h-7 border-slate-700 bg-slate-900 px-2 text-slate-200 hover:bg-slate-800 hover:text-white"
              >
                <Copy className="mr-1 h-3.5 w-3.5" />
                Sao chép
              </Button>
            </div>
            <pre className="max-h-[500px] overflow-auto p-4 text-xs text-slate-100">
              {JSON.stringify(json, null, 2)}
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
