import { useState } from 'react'
import { remoteSensingService, useApiMutation, useApiQuery } from '@/service'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatDate } from '@/lib/date'
import type { RemoteImageListParams, SatelliteSource } from '@/types/api'
import { ChevronDown } from 'lucide-react'
import { toast } from 'react-toastify'
import { can } from '@/lib/permissions'
import { useAuthStore } from '@/stores/common/useAuthStore'

const SATELLITES: SatelliteSource[] = [
  'sentinel1',
  'sentinel2',
  'landsat8',
  'landsat9',
  'modis',
  'vnredsat',
  'other',
]

const SATELLITE_FILTER_OPTIONS = [
  { value: '', label: 'Tất cả' },
  ...SATELLITES.map((value) => ({ value, label: value })),
]
const SATELLITE_OPTIONS = SATELLITES.map((value) => ({ value, label: value }))
const STATUS_OPTIONS = [
  { value: '', label: 'Tất cả' },
  { value: 'pending', label: 'Chờ' },
  { value: 'processing', label: 'Đang xử lý' },
  { value: 'completed', label: 'Hoàn tất' },
  { value: 'failed', label: 'Lỗi' },
]
const IMAGE_TYPE_OPTIONS = ['rgb', 'multispectral', 'sar', 'thermal', 'ndvi', 'other'].map(
  (value) => ({ value, label: value })
)

export default function RemoteSensingPage() {
  const user = useAuthStore((s) => s.user)
  const [page, setPage] = useState(1)
  const [satellite, setSatellite] = useState<SatelliteSource | ''>('')
  const [status, setStatus] = useState('')
  const canUpload = can(user, 'remote-sensing:upload')
  const canDelete = can(user, 'remote-sensing:delete')
  const canProcess = can(user, 'remote-sensing:process')

  const params: RemoteImageListParams = {
    page,
    limit: 10,
    satellite: satellite || undefined,
    status: (status as any) || undefined,
  }

  const listQuery = useApiQuery(['remote-images', JSON.stringify(params)], () =>
    remoteSensingService.listImages(params)
  )
  const items = listQuery.data?.data?.images ?? []
  const pagination = listQuery.data?.data?.pagination

  const deleteMutation = useApiMutation((id: number) =>
    remoteSensingService.deleteImage(id, false)
  )

  const processMutation = useApiMutation((id: number) =>
    remoteSensingService.startProcessing(id, { job_type: 'full_pipeline' })
  )

  return (
    <div className="flex-1 space-y-6 overflow-y-auto p-6">
      <div>
        <h1 className="text-2xl font-bold">Viễn thám / Ảnh vệ tinh</h1>
        <p className="text-muted-foreground text-sm">
          Quản lý ảnh viễn thám và theo dõi trạng thái xử lý theo thời gian thực.
        </p>
      </div>

      <Card>
        <CardContent className="space-y-3 p-6">
          <div className="flex flex-wrap gap-3">
            <div>
              <label className="mb-1 block text-sm">Vệ tinh</label>
              <DropdownSelect
                value={satellite}
                options={SATELLITE_FILTER_OPTIONS}
                onChange={(value) => {
                  setSatellite(value as SatelliteSource | '')
                  setPage(1)
                }}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm">Trạng thái</label>
              <DropdownSelect
                value={status}
                options={STATUS_OPTIONS}
                onChange={(value) => {
                  setStatus(value)
                  setPage(1)
                }}
              />
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Tên</TableHead>
                <TableHead>Vệ tinh</TableHead>
                <TableHead>Loại</TableHead>
                <TableHead>Ngày chụp</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Công khai</TableHead>
                {(canProcess || canDelete) && (
                  <TableHead className="text-right">Hành động</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((img) => (
                <TableRow key={img.id}>
                  <TableCell>{img.id}</TableCell>
                  <TableCell className="font-medium">{img.name}</TableCell>
                  <TableCell>{img.satellite}</TableCell>
                  <TableCell>{img.imageType}</TableCell>
                  <TableCell>
                    {img.acquisitionDate ? formatDate(img.acquisitionDate) : '-'}
                  </TableCell>
                  <TableCell>{img.status}</TableCell>
                  <TableCell>{img.isPublic ? 'Có' : '-'}</TableCell>
                  {(canProcess || canDelete) && (
                    <TableCell className="space-x-1 text-right">
                      {canProcess && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            processMutation.mutate(img.id, {
                              onSuccess: () => toast.success('Đã đưa vào hàng chờ'),
                            })
                          }
                        >
                          Xử lý lại
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() =>
                            confirm('Xóa ảnh này?') &&
                            deleteMutation.mutate(img.id, {
                              onSuccess: () => toast.success('Đã xóa'),
                            })
                          }
                        >
                          Xóa
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {!items.length && (
                <TableRow>
                  <TableCell
                    colSpan={canProcess || canDelete ? 8 : 7}
                    className="text-muted-foreground text-center"
                  >
                    Không có ảnh nào.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between">
            <p className="text-muted-foreground text-sm">Tổng: {pagination?.total ?? 0}</p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Trước
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={pagination ? page >= pagination.totalPages : false}
                onClick={() => setPage((p) => p + 1)}
              >
                Sau
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {canUpload && (
        <Card>
          <CardContent className="space-y-3 p-6">
            <h2 className="text-lg font-semibold">Tải ảnh mới lên</h2>
            <UploadForm />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function UploadForm() {
  const [name, setName] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [satellite, setSatellite] = useState<SatelliteSource>('sentinel2')
  const [imageType, setImageType] = useState('rgb')
  const [acquisitionDate, setAcquisitionDate] = useState('')
  const [isPublic, setIsPublic] = useState(true)

  const mutation = useApiMutation((data: FormData) => remoteSensingService.createImage(data))

  const onUpload = () => {
    if (!file || !name) {
      toast.error('Chọn file và nhập tên ảnh')
      return
    }
    const fd = new FormData()
    fd.append('raster_file', file)
    fd.append('name', name)
    fd.append('satellite', satellite)
    fd.append('image_type', imageType)
    if (acquisitionDate) fd.append('acquisition_date', acquisitionDate)
    fd.append('is_public', String(isPublic))
    mutation.mutate(fd, {
      onSuccess: () => {
        toast.success('Đã tải ảnh lên')
        setName('')
        setFile(null)
      },
    })
  }

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      <Input placeholder="Tên ảnh" value={name} onChange={(e) => setName(e.target.value)} />
      <DropdownSelect
        value={satellite}
        options={SATELLITE_OPTIONS}
        onChange={(value) => setSatellite(value as SatelliteSource)}
      />
      <DropdownSelect value={imageType} options={IMAGE_TYPE_OPTIONS} onChange={setImageType} />
      <Input
        type="date"
        value={acquisitionDate}
        onChange={(e) => setAcquisitionDate(e.target.value)}
      />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={isPublic}
          onChange={(e) => setIsPublic(e.target.checked)}
        />
        Công khai
      </label>
      <Input
        type="file"
        accept=".tif,.tiff"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />
      <div className="md:col-span-3">
        <Button onClick={onUpload} disabled={mutation.isPending}>
          {mutation.isPending ? 'Đang tải lên...' : 'Tải ảnh lên'}
        </Button>
      </div>
    </div>
  )
}

function DropdownSelect({
  value,
  options,
  onChange,
}: {
  value: string
  options: Array<{ value: string; label: string }>
  onChange: (value: string) => void
}) {
  const selectedLabel = options.find((option) => option.value === value)?.label ?? value

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" className="w-full justify-between">
          <span>{selectedLabel}</span>
          <ChevronDown className="size-4 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-(--radix-dropdown-menu-trigger-width)">
        {options.map((option) => (
          <DropdownMenuItem key={option.value || 'all'} onSelect={() => onChange(option.value)}>
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
