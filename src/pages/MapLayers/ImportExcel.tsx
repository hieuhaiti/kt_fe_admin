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
import * as XLSX from 'xlsx'
import { CheckCircle2, Download, FileSpreadsheet, Info } from 'lucide-react'

const categoryOptions = [
  { value: 'forest', label: 'Rừng' },
  { value: 'land_cover', label: 'Lớp phủ đất' },
  { value: 'administrative', label: 'Hành chính' },
  { value: 'hydrology', label: 'Thủy văn' },
  { value: 'transport', label: 'Giao thông' },
  { value: 'remote_sensing', label: 'Viễn thám' },
  { value: 'other', label: 'Khác' },
]

function extractGeoJson(raw: any): GeoJSON.GeoJSON | null {
  if (!raw || typeof raw !== 'object') return null
  if (raw.type === 'FeatureCollection' && Array.isArray(raw.features))
    return raw as GeoJSON.FeatureCollection
  if (raw.type === 'Feature' && raw.geometry) return raw as GeoJSON.Feature
  if (typeof raw.type === 'string' && raw.coordinates) return raw as GeoJSON.Geometry
  return null
}

function normalizeRowKeys(row: Record<string, any>): Record<string, any> {
  const normalized: Record<string, any> = {}
  Object.entries(row).forEach(([key, value]) => {
    const normalizedKey = key.toLowerCase().replace(/\s+/g, '_')
    normalized[normalizedKey] = value
  })
  return normalized
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value.trim())
    if (Number.isFinite(parsed)) return parsed
  }
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

function downloadExcelSample() {
  const rows = [
    {
      name: 'Mẫu theo lat/lng',
      latitude: 14.35,
      longitude: 108,
      geometry: '',
    },
    {
      name: 'Mẫu theo geometry',
      latitude: '',
      longitude: '',
      geometry: '{"type":"Point","coordinates":[108.02,14.36]}',
    },
  ]

  const worksheet = XLSX.utils.json_to_sheet(rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'map_layers')
  XLSX.writeFile(workbook, 'sample-map-layer.xlsx')
}

export default function ImportExcelPage(): JSX.Element {
  const [category, setCategory] = useState<string>('forest')
  const [name, setName] = useState<string>('')
  const [autoPublish, setAutoPublish] = useState<'true' | 'false'>('true')
  const [file, setFile] = useState<File | null>(null)
  const [previewGeoJson, setPreviewGeoJson] = useState<GeoJSON.FeatureCollection | null>(null)
  const [previewError, setPreviewError] = useState<string>('')

  const importMutation = useApiMutation(
    async (payload: { code: string; name: string; category: string; geojson: GeoJSON.FeatureCollection }) => {
      await mapLayerService.create({
        code: payload.code,
        name_vi: payload.name,
        table_name: payload.code,
        category: payload.category,
        layer_kind: 'overlay',
        geometry_type: 'GEOMETRY',
        epsg_code: 4326,
        is_active: true,
        is_public: false,
        is_editable: true,
      })

      return mapLayerService.importInline(payload.code, {
        source_format: 'geojson',
        import_mode: 'overwrite',
        auto_publish: autoPublish === 'true',
        geojson: payload.geojson,
      })
    },
    {
      onSuccess: () => {
        setName('')
        setCategory('forest')
        setAutoPublish('true')
        setFile(null)
        setPreviewGeoJson(null)
        setPreviewError('')
      },
    },
    true
  )

  async function handleExcelFileChange(selectedFile: File | null) {
    setFile(selectedFile)
    setPreviewGeoJson(null)
    setPreviewError('')
    if (!selectedFile) return

    try {
      const buffer = await selectedFile.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const firstSheetName = workbook.SheetNames[0]
      if (!firstSheetName) {
        setPreviewError('Không tìm thấy sheet trong file Excel')
        return
      }

      const sheet = workbook.Sheets[firstSheetName]
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: null })
      if (!rows.length) {
        setPreviewError('Sheet không có dữ liệu để preview')
        return
      }

      const features: GeoJSON.Feature[] = []
      rows.forEach((rawRow) => {
        const row = normalizeRowKeys(rawRow)
        let rowHasGeometry = false
        const geometryCandidates = [row.geometry, row.geojson, row.geometry_data, row.geom].filter(
          Boolean
        )

        for (const candidate of geometryCandidates) {
          if (typeof candidate !== 'string') continue
          try {
            const parsed = JSON.parse(candidate)
            const geojson = extractGeoJson(parsed)
            if (geojson?.type === 'FeatureCollection') {
              features.push(...geojson.features)
              rowHasGeometry = true
              break
            }
            if (geojson?.type === 'Feature') {
              features.push(geojson)
              rowHasGeometry = true
              break
            }
            if (geojson && 'coordinates' in geojson) {
              features.push({
                type: 'Feature',
                geometry: geojson as GeoJSON.Geometry,
                properties: row,
              })
              rowHasGeometry = true
              break
            }
          } catch {
            // Ignore invalid geometry cell and fallback to lat/lng parsing.
          }
        }

        if (rowHasGeometry) return

        const latitude = toNumber(row.latitude ?? row.lat ?? row.y)
        const longitude = toNumber(row.longitude ?? row.lng ?? row.lon ?? row.x)
        if (latitude !== null && longitude !== null) {
          features.push({
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [longitude, latitude],
            },
            properties: row,
          })
        }
      })

      if (!features.length) {
        setPreviewError(
          'Không tìm thấy dữ liệu hình học trong Excel (geometry/geojson hoặc lat/lng)'
        )
        return
      }

      setPreviewGeoJson({
        type: 'FeatureCollection',
        features,
      })
    } catch {
      setPreviewError('Không đọc được file Excel để preview')
    }
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
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
      toast.error('Vui lòng chọn file Excel')
      return
    }
    if (!previewGeoJson) {
      toast.error('File Excel chưa có dữ liệu không gian hợp lệ')
      return
    }

    importMutation.mutate({
      code: toLayerCode(trimmedName),
      name: trimmedName,
      category,
      geojson: previewGeoJson,
    })
  }

  return (
    <PageLayout title="Nhập Excel" description="Chuyển dữ liệu Excel có tọa độ thành lớp bản đồ">
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
                  {categoryOptions.map((option) => (
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
              <Select value={autoPublish} onValueChange={(v) => setAutoPublish(v as 'true' | 'false')}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Tự publish nếu import thành công</SelectItem>
                  <SelectItem value="false">Chỉ tạo lớp, chưa publish</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="excel-file">
                File Excel <span className="text-destructive">*</span>
              </Label>
              <Input
                id="excel-file"
                type="file"
                accept=".xlsx,.xls,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={(e) => handleExcelFileChange(e.target.files?.[0] ?? null)}
              />
              <p className="text-muted-foreground text-xs">Hỗ trợ: .xlsx, .xls</p>
              {previewError && <p className="text-destructive text-xs">{previewError}</p>}
              {previewGeoJson && (
                <div className="space-y-2">
                  <p className="text-muted-foreground text-xs">Preview bản đồ từ file Excel</p>
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
                  setCategory('forest')
                  setAutoPublish('true')
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
                {importMutation.isPending ? 'Đang nhập...' : 'Nhập Excel'}
              </Button>
            </div>
          </form>
        </Card>

        <Card className="h-fit space-y-4 bg-gradient-to-b from-green-500/10 to-background p-4 sm:p-5 lg:sticky lg:top-4">
          <div className="flex items-center gap-2">
            <div className="rounded-md bg-green-500/15 p-2 text-green-700">
              <FileSpreadsheet size={18} />
            </div>
            <div>
              <p className="font-semibold">Hướng dẫn Excel</p>
              <p className="text-muted-foreground text-xs">Chuẩn bị dữ liệu trước khi import</p>
            </div>
          </div>

          <div className="rounded-lg border border-green-600/20 bg-green-500/5 p-3 text-sm">
            <div className="mb-2 flex items-center gap-2 font-medium text-green-800">
              <Info size={16} />
              Cột dữ liệu hỗ trợ
            </div>
            <p className="text-muted-foreground text-xs">
              Hệ thống đọc `geometry` / `geojson` hoặc cặp `longitude` + `latitude`.
            </p>
          </div>

          <div className="space-y-2 text-sm">
            <p className="font-medium">Checklist nhanh</p>
            <p className="text-muted-foreground flex items-start gap-2 text-xs">
              <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
              Sheet đầu tiên phải chứa dữ liệu.
            </p>
            <p className="text-muted-foreground flex items-start gap-2 text-xs">
              <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
              Nếu dùng tọa độ, dùng `longitude` và `latitude`.
            </p>
            <p className="text-muted-foreground flex items-start gap-2 text-xs">
              <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
              Tránh ô geometry bị lỗi JSON hoặc để trống toàn bộ tọa độ.
            </p>
          </div>

          <div className="rounded-lg bg-muted/50 p-3">
            <p className="mb-1 text-xs font-medium">Ví dụ header gợi ý</p>
            <code className="text-muted-foreground block text-[11px] leading-5">
              {`name | latitude | longitude | geometry`}
            </code>
          </div>

          <Button type="button" variant="outline" className="w-full" onClick={downloadExcelSample}>
            <Download size={16} />
            Tải file mẫu Excel
          </Button>
        </Card>
      </div>
    </PageLayout>
  )
}
