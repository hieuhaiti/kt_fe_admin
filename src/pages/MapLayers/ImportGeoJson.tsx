import type { JSX } from 'react'
import { useState } from 'react'
import PageLayout from '@/layout/pageLayout'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import GeoJsonMapPreview from '@/components/features/GeoJsonMapPreview'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { mapLayerService, useApiMutation } from '@/service'
import { toast } from 'react-toastify'
import { CheckCircle2, Download, FileJson, Info } from 'lucide-react'
import { hasPerm } from '@/lib/permissions'
import { useAuthStore } from '@/stores/common/useAuthStore'
import { MAP_LAYER_CATEGORY_OPTIONS } from '@/constant/mapLayerConstant'

function extractGeoJson(raw: any): GeoJSON.GeoJSON | null {
  if (!raw || typeof raw !== 'object') return null
  if (raw.type === 'FeatureCollection' && Array.isArray(raw.features)) return raw as GeoJSON.FeatureCollection
  if (raw.type === 'Feature' && raw.geometry) return raw as GeoJSON.Feature
  if (typeof raw.type === 'string' && raw.coordinates) return raw as GeoJSON.Geometry
  return null
}

function toLayerCode(value: string): string {
  const ascii = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 54)

  const code = ascii || `layer_${Date.now()}`
  return /^[a-z_]/.test(code) ? code : `layer_${code}`
}

function downloadGeoJsonSample() {
  const sample = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { name: 'Mẫu điểm 1', code: 'P001' },
        geometry: { type: 'Point', coordinates: [108, 14.35] },
      },
      {
        type: 'Feature',
        properties: { name: 'Mẫu điểm 2', code: 'P002' },
        geometry: { type: 'Point', coordinates: [108.02, 14.36] },
      },
    ],
  }

  const blob = new Blob([JSON.stringify(sample, null, 2)], { type: 'application/geo+json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'sample-map-layer.geojson'
  link.click()
  URL.revokeObjectURL(url)
}

export default function ImportGeoJsonPage(): JSX.Element {
  const user = useAuthStore((state) => state.user)
  const canPublish = hasPerm(user, 'map_layers', 'publish')
  const [category, setCategory] = useState<string>('forest_district')
  const [name, setName] = useState<string>('')
  const [publishAfterImport, setPublishAfterImport] = useState<'true' | 'false'>(
    canPublish ? 'true' : 'false'
  )
  const [file, setFile] = useState<File | null>(null)
  const [previewGeoJson, setPreviewGeoJson] = useState<GeoJSON.GeoJSON | null>(null)
  const [previewError, setPreviewError] = useState<string>('')

  const importMutation = useApiMutation(
    (payload: FormData) => mapLayerService.importGeoJson(payload),
    {
      onSuccess: () => {
        setName('')
        setCategory('forest_district')
        setPublishAfterImport(canPublish ? 'true' : 'false')
        setFile(null)
        setPreviewGeoJson(null)
        setPreviewError('')
      },
    },
    true
  )

  async function handleGeoJsonFileChange(selectedFile: File | null) {
    setFile(selectedFile)
    setPreviewGeoJson(null)
    setPreviewError('')
    if (!selectedFile) return

    try {
      const text = await selectedFile.text()
      const parsed = JSON.parse(text)
      const geojson = extractGeoJson(parsed)
      if (!geojson) {
        setPreviewError('File không chứa GeoJSON hợp lệ để preview')
        return
      }
      setPreviewGeoJson(geojson)
    } catch {
      setPreviewError('Không đọc được GeoJSON hoặc file JSON không hợp lệ')
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    const trimmedName = name.trim()
    if (!category) {
      toast.error('Vui lòng chọn nhóm lớp')
      return
    }
    if (!trimmedName) {
      toast.error('Vui lòng nhập tên lớp')
      return
    }
    if (!file) {
      toast.error('Vui lòng chọn file GeoJSON')
      return
    }

    const geoJsonFile =
      file.type && file.type.trim()
        ? file
        : new File([await file.arrayBuffer()], file.name, {
            type: file.name.toLowerCase().endsWith('.geojson')
              ? 'application/geo+json'
              : 'application/json',
          })

    const code = toLayerCode(trimmedName)
    const fd = new FormData()
    fd.append('file', geoJsonFile)
    fd.append('code', code)
    fd.append('name_vi', trimmedName)
    fd.append('table_name', code)
    fd.append('source_format', 'geojson')
    fd.append('import_mode', 'overwrite')
    fd.append('srid_input', '4326')
    fd.append('category', category)
    fd.append('layer_kind', 'overlay')
    fd.append('is_public', publishAfterImport)
    fd.append('auto_publish', publishAfterImport)

    importMutation.mutate(fd)
  }

  return (
    <PageLayout
      title="Nhập GeoJSON"
      description="Nhập dữ liệu GeoJSON để tạo lớp bản đồ mới"
    >
      <div className="mx-auto grid w-full max-w-6xl gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="p-4 sm:p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>
                Nhóm lớp <span className="text-destructive">*</span>
              </Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Chọn nhóm lớp" />
                </SelectTrigger>
                <SelectContent>
                  {MAP_LAYER_CATEGORY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="layer-name">
                Tên lớp <span className="text-destructive">*</span>
              </Label>
              <Input
                id="layer-name"
                placeholder="Nhập tên lớp bản đồ"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Trạng thái sau import</Label>
              <Select
                value={publishAfterImport}
                onValueChange={(v) => setPublishAfterImport(v as 'true' | 'false')}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {canPublish && (
                    <SelectItem value="true">
                      Công khai trên WebGIS sau khi nhập thành công
                    </SelectItem>
                  )}
                  <SelectItem value="false">Chỉ tạo lớp, chưa công bố</SelectItem>
                </SelectContent>
              </Select>
              {!canPublish && (
                <p className="text-muted-foreground text-xs">
                  Tài khoản hiện tại không có quyền công bố lớp lên WebGIS.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="geojson-file">
                File GeoJSON <span className="text-destructive">*</span>
              </Label>
              <Input
                id="geojson-file"
                type="file"
                accept=".geojson,.json,application/geo+json,application/json"
                onChange={(e) => handleGeoJsonFileChange(e.target.files?.[0] ?? null)}
              />
              <p className="text-muted-foreground text-xs">Hỗ trợ: .geojson, .json</p>
              {previewError && <p className="text-destructive text-xs">{previewError}</p>}
              {previewGeoJson && (
                <div className="space-y-2">
                  <p className="text-muted-foreground text-xs">Preview bản đồ từ file GeoJSON</p>
                  <GeoJsonMapPreview geojson={previewGeoJson} />
                </div>
              )}
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setName('')
                  setCategory('forest_district')
                  setPublishAfterImport(canPublish ? 'true' : 'false')
                  setFile(null)
                  setPreviewGeoJson(null)
                  setPreviewError('')
                }}
                disabled={importMutation.isPending}
                className="w-full sm:w-auto"
              >
                Làm mới
              </Button>
              <Button type="submit" disabled={importMutation.isPending} className="w-full sm:w-auto">
                {importMutation.isPending ? 'Đang nhập...' : 'Nhập GeoJSON'}
              </Button>
            </div>
          </form>
        </Card>

        <Card className="from-primary/10 to-background h-fit space-y-4 bg-gradient-to-b p-4 sm:p-5 lg:sticky lg:top-4">
          <div className="flex items-center gap-2">
            <div className="bg-primary/15 text-primary rounded-md p-2">
              <FileJson size={18} />
            </div>
            <div>
              <p className="font-semibold">Hướng dẫn GeoJSON</p>
              <p className="text-muted-foreground text-xs">Chuẩn bị file trước khi import</p>
            </div>
          </div>

          <div className="bg-primary/5 border-primary/20 rounded-lg border p-3 text-sm">
            <div className="mb-2 flex items-center gap-2 font-medium">
              <Info size={16} />
              Định dạng hợp lệ
            </div>
            <p className="text-muted-foreground text-xs">
              Dữ liệu phải là `FeatureCollection`, `Feature` hoặc `Geometry`.
            </p>
          </div>

          <div className="space-y-2 text-sm">
            <p className="font-medium">Checklist nhanh</p>
            <p className="text-muted-foreground flex items-start gap-2 text-xs">
              <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
              File có phần mở rộng `.geojson` hoặc `.json`.
            </p>
            <p className="text-muted-foreground flex items-start gap-2 text-xs">
              <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
              Mỗi feature có `geometry` hợp lệ và tọa độ đúng thứ tự.
            </p>
            <p className="text-muted-foreground flex items-start gap-2 text-xs">
              <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
              Tên lớp rõ nghĩa để hệ thống sinh mã lớp ổn định.
            </p>
          </div>

          <div className="bg-muted/50 rounded-lg p-3">
            <p className="mb-1 text-xs font-medium">Ví dụ cấu trúc tối thiểu</p>
            <code className="text-muted-foreground block text-[11px] leading-5">
              {`{"type":"FeatureCollection","features":[...]}`}
            </code>
          </div>

          <Button type="button" variant="outline" className="w-full" onClick={downloadGeoJsonSample}>
            <Download size={16} />
            Tải file mẫu GeoJSON
          </Button>
        </Card>
      </div>
    </PageLayout>
  )
}
