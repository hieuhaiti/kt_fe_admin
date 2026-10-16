import { useEffect, useRef, useState } from 'react'
import { Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  FileUpload, FileUploadDropzone, FileUploadTrigger, FileUploadList,
  FileUploadItem, FileUploadItemMetadata, FileUploadItemDelete,
} from '@/components/ui/file-upload'
import GeoJsonMapPreview from '@/components/features/GeoJsonMapPreview'
import { normalizeGeoJson } from './mapLayerImport'

type Props = {
  kind: 'geotiff' | 'geojson'
  disabled?: boolean
  previewOnly?: boolean
  onFileChange: (file: File | null, geojson: GeoJSON.GeoJSON | null) => void
  onValidationChange: (blocked: boolean) => void
}

export default function LayerFileUpload({ kind, disabled, previewOnly, onFileChange, onValidationChange }: Props) {
  const [files, setFiles] = useState<File[]>([])
  const [geojson, setGeojson] = useState<GeoJSON.GeoJSON | null>(null)
  const [error, setError] = useState('')
  const [reading, setReading] = useState(false)
  const [converted, setConverted] = useState(false)
  const generation = useRef(0)
  useEffect(() => () => { generation.current += 1 }, [])

  async function selectFiles(next: File[]) {
    const current = ++generation.current
    setConverted(false)
    setFiles(next)
    setGeojson(null)
    setError('')
    onFileChange(null, null)
    const file = next[0]
    if (!file) {
      setReading(false)
      onValidationChange(false)
      return
    }
    setReading(true)
    onValidationChange(true)
    try {
      let parsed: GeoJSON.GeoJSON | null = null
      let uploadFile = file
      let didConvert = false
      if (file.size === 0) throw new Error('Tệp rỗng. Hãy chọn tệp có dữ liệu.')
      if (kind === 'geojson') {
        if (!/\.(geojson|json)$/i.test(file.name)) throw new Error('Chọn tệp .geojson hoặc .json.')
        let raw: unknown
        try { raw = JSON.parse((await file.text()).replace(/^\uFEFF/, '')) }
        catch { throw new Error('Không đọc được JSON. Hãy kiểm tra nội dung tệp.') }
        const normalized = normalizeGeoJson(raw)
        parsed = normalized.geojson
        didConvert = normalized.sourceEpsg === 32648
        if (didConvert) {
          uploadFile = new File([JSON.stringify(parsed)], file.name, {
            type: 'application/geo+json', lastModified: file.lastModified,
          })
        }
      } else {
        if (!/\.(tif|tiff)$/i.test(file.name)) throw new Error('Chọn tệp .tif hoặc .tiff.')
        const bytes = new Uint8Array(await file.slice(0, 4).arrayBuffer())
        const le = bytes[0] === 0x49 && bytes[1] === 0x49 && (bytes[2] === 0x2a || bytes[2] === 0x2b) && bytes[3] === 0
        const be = bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[2] === 0 && (bytes[3] === 0x2a || bytes[3] === 0x2b)
        if (!le && !be) throw new Error('Tệp không có định dạng TIFF hợp lệ. Hãy kiểm tra lại tệp.')
      }
      if (current !== generation.current) return
      setGeojson(parsed)
      setConverted(didConvert)
      onFileChange(uploadFile, parsed)
      onValidationChange(false)
    } catch (cause) {
      if (current !== generation.current) return
      setError(cause instanceof Error ? cause.message : 'Không đọc được tệp. Hãy chọn lại.')
      onValidationChange(true)
    } finally {
      if (current === generation.current) setReading(false)
    }
  }

  return (
    <div className="min-w-0 space-y-3">
      <FileUpload value={files} onValueChange={selectFiles} maxFiles={1} disabled={disabled || reading}
        accept={kind === 'geojson' ? '.geojson,.json' : '.tif,.tiff'}
        label={`Chọn tệp ${kind === 'geojson' ? 'GeoJSON' : 'GeoTIFF'}`}
        onFileValidate={file => file.size === 0 ? 'Tệp rỗng. Hãy chọn tệp có dữ liệu.' : null}
        onFileReject={(_file, message) => {
          generation.current += 1
          setFiles([])
          setGeojson(null)
          setConverted(false)
          setReading(false)
          setError(message.startsWith('Maximum') ? 'Chỉ chọn một tệp. Hãy chọn lại tệp cần nhập.' : message)
          onFileChange(null, null)
          onValidationChange(true)
        }}>
        <FileUploadDropzone className="border-border bg-muted/20 gap-3 rounded-lg border border-dashed px-4 py-5">
          <Upload className="text-muted-foreground size-6" aria-hidden="true" />
          <p className="text-center text-sm">Kéo thả tệp {kind === 'geojson' ? 'GeoJSON' : 'GeoTIFF'} vào đây</p>
          <FileUploadTrigger asChild>
            <Button id={`choose-layer-${kind}`} type="button" variant="outline" size="sm">Chọn tệp</Button>
          </FileUploadTrigger>
        </FileUploadDropzone>
        <FileUploadList>
          {files.map(file => (
            <FileUploadItem key={`${file.name}-${file.lastModified}`} value={file} className="min-w-0">
              <FileUploadItemMetadata className="min-w-0 flex-1" />
              <FileUploadItemDelete asChild>
                <Button type="button" variant="ghost" size="icon" aria-label="Bỏ tệp đã chọn"><X className="size-4" aria-hidden="true" /></Button>
              </FileUploadItemDelete>
            </FileUploadItem>
          ))}
        </FileUploadList>
      </FileUpload>
      {reading && <p role="status" className="text-muted-foreground text-sm">Đang đọc và kiểm tra tệp...</p>}
      {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
      {converted && <p role="status" className="text-muted-foreground text-xs">Đã chuyển EPSG:32648 sang EPSG:4326 để hiển thị trên bản đồ. Tệp gốc được giữ nguyên.</p>}
      <p className="text-muted-foreground text-xs">
        {kind === 'geotiff' ? 'GeoTIFF cần dùng hệ tọa độ UTM 48N (EPSG:32648).'
          : 'Hỗ trợ WGS 84 (EPSG:4326) và UTM 48N (EPSG:32648), tự nhận diện khi đọc tệp. Nếu tệp chưa khai báo hệ tọa độ, tọa độ mét trong phạm vi UTM sẽ được hiểu là UTM 48N. Hãy khai báo đúng hệ tọa độ trong tệp để tránh hiển thị sai vị trí.'}
      </p>
      {previewOnly && (
        <p className="text-muted-foreground text-xs">Tệp này chỉ dùng để xem trước. Lưu thông tin lớp không thay thế dữ liệu hiện có.</p>
      )}
      {geojson && <div className="overflow-hidden rounded-lg border"><GeoJsonMapPreview geojson={geojson} /></div>}
    </div>
  )
}
