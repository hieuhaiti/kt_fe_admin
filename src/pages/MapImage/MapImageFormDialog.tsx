import { useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { mapImageService, useApiQuery } from '@/service'
import type { ApiResponse, MapImage } from '@/types/api'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  FileUpload,
  FileUploadDropzone,
  FileUploadItem,
  FileUploadItemDelete,
  FileUploadItemMetadata,
  FileUploadItemPreview,
  FileUploadList,
  FileUploadTrigger,
} from '@/components/ui/file-upload'
import { toast } from 'react-toastify'
import { parseLink, isPdf } from '@/lib/utils'
import { useState } from 'react'
import { FileImage } from 'lucide-react'

const mapImageSchema = z.object({
  name: z.string().min(2, 'Tên ảnh phải có ít nhất 2 ký tự').max(255),
  description: z.string().max(1000).optional().or(z.literal('')),
  is_active: z.boolean(),
})

type MapImageFormValues = z.infer<typeof mapImageSchema>

interface MapImageFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mapImageId: number | null
  onSubmit: (data: FormData) => void
  isLoading?: boolean
}

export default function MapImageFormDialog({
  open,
  onOpenChange,
  mapImageId,
  onSubmit,
  isLoading = false,
}: MapImageFormDialogProps) {
  const dbQuery = useApiQuery(
    ['mapImage', mapImageId],
    () => mapImageService.getById(mapImageId!),
    { enabled: !!mapImageId && open, staleTime: 0 },
    false,
    false
  )
  const mapImage = (() => {
    const d = (dbQuery.data as ApiResponse<any>)?.data
    return (d ? (d.mapImage ?? d.pdfMap ?? d) : null) as MapImage | null
  })()
  const isEdit = !!mapImage

  const [imageFiles, setImageFiles] = useState<File[]>([])

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<MapImageFormValues>({
    resolver: zodResolver(mapImageSchema) as any,
    defaultValues: {
      name: '',
      description: '',
      is_active: true,
    },
  })

  useEffect(() => {
    if (mapImage) {
      reset({
        name: mapImage.name,
        description: mapImage.description || '',
        is_active: mapImage.is_active,
      })
    } else {
      reset({ name: '', description: '', is_active: true })
    }
    setImageFiles([])
  }, [mapImage, reset, open])

  const onImageValidate = useCallback((file: File): string | null => {
    const validTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'image/gif',
    ]
    if (!validTypes.includes(file.type))
      return 'Chỉ chấp nhận file PDF hoặc ảnh (JPG, PNG, WebP, GIF)'
    if (file.size > 20 * 1024 * 1024) return 'Kích thước file không được quá 20MB'
    return null
  }, [])

  const onImageReject = useCallback((file: File, message: string) => {
    toast.error(
      `${message}: "${file.name.length > 20 ? `${file.name.slice(0, 20)}...` : file.name}"`
    )
  }, [])

  const handleFormSubmit = (data: MapImageFormValues) => {
    if (!isEdit && imageFiles.length === 0) {
      toast.error('Vui lòng chọn ảnh bản đồ')
      return
    }
    const fd = new FormData()
    fd.append('name', data.name)
    if (data.description?.trim()) fd.append('description', data.description)
    fd.append('is_active', String(data.is_active))
    if (imageFiles[0]) fd.append('image_url', imageFiles[0])
    onSubmit(fd)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogTitle>{isEdit ? 'Chỉnh sửa ảnh bản đồ' : 'Thêm ảnh bản đồ mới'}</DialogTitle>
        <DialogDescription>
          {isEdit ? 'Cập nhật thông tin ảnh bản đồ' : 'Điền thông tin để tạo ảnh bản đồ mới'}
        </DialogDescription>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="mt-4 space-y-4">
          {/* Tên */}
          <div className="space-y-2">
            <Label htmlFor="name">
              Tên ảnh bản đồ <span className="text-destructive">*</span>
            </Label>
            <Input id="name" {...register('name')} placeholder="Nhập tên ảnh bản đồ" />
            {errors.name && <p className="text-destructive text-sm">{errors.name.message}</p>}
          </div>

          {/* Mô tả */}
          <div className="space-y-2">
            <Label htmlFor="description">Mô tả</Label>
            <Textarea
              id="description"
              {...register('description')}
              placeholder="Nhập mô tả (tùy chọn)"
              rows={3}
            />
            {errors.description && (
              <p className="text-destructive text-sm">{errors.description.message}</p>
            )}
          </div>

          {/* Trạng thái */}
          <div className="space-y-2">
            <Label>Trạng thái</Label>
            <Select
              value={watch('is_active') ? 'true' : 'false'}
              onValueChange={(v) => setValue('is_active', v === 'true')}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">Kích hoạt</SelectItem>
                <SelectItem value="false">Không kích hoạt</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Ảnh */}
          <div className="space-y-2">
            <Label>
              Ảnh bản đồ {!isEdit && <span className="text-destructive">*</span>}
              {isEdit && (
                <span className="text-muted-foreground ml-1 text-xs">(Để trống nếu không đổi)</span>
              )}
            </Label>
            {isEdit && mapImage?.image_url && imageFiles.length === 0 && (
              <div className="mb-2">
                {isPdf(mapImage.image_url) ? (
                  <div className="flex h-48 items-center justify-center rounded-md border bg-gradient-to-br from-sky-50 to-sky-100">
                    <div className="text-center">
                      <FileImage className="mx-auto mb-2 h-12 w-12 text-sky-700" />
                      <span className="text-sm font-medium text-sky-700">PDF</span>
                    </div>
                  </div>
                ) : (
                  <img
                    src={parseLink(mapImage.image_url)}
                    alt="Ảnh hiện tại"
                    className="max-h-48 w-full rounded-md border object-contain"
                  />
                )}
                <p className="text-muted-foreground mt-1 text-xs">File hiện tại</p>
              </div>
            )}
            <FileUpload
              value={imageFiles}
              onValueChange={setImageFiles}
              onFileValidate={onImageValidate}
              onFileReject={onImageReject}
              accept=".pdf,.jpg,.jpeg,.png,.webp,.gif,image/*"
              maxFiles={1}
              maxSize={20 * 1024 * 1024}
            >
              <FileUploadDropzone className="border-dashed">
                <div className="flex flex-col items-center gap-1 text-center">
                  <p className="text-sm font-medium">Kéo thả file vào đây</p>
                  <p className="text-muted-foreground text-xs">hoặc</p>
                  <FileUploadTrigger asChild>
                    <Button type="button" variant="outline" size="sm">
                      Chọn file
                    </Button>
                  </FileUploadTrigger>
                  <p className="text-muted-foreground text-xs">
                    PDF, JPG, PNG, WebP, GIF · Tối đa 20MB
                  </p>
                </div>
              </FileUploadDropzone>
              <FileUploadList>
                {imageFiles.map((file) => (
                  <FileUploadItem key={file.name} value={file}>
                    <FileUploadItemPreview />
                    <FileUploadItemMetadata />
                    <FileUploadItemDelete asChild>
                      <Button type="button" variant="ghost" size="sm">
                        Xóa
                      </Button>
                    </FileUploadItemDelete>
                  </FileUploadItem>
                ))}
              </FileUploadList>
            </FileUpload>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting || isLoading}
            >
              Hủy
            </Button>
            <Button type="submit" disabled={isSubmitting || isLoading}>
              {isSubmitting || isLoading ? 'Đang xử lý...' : isEdit ? 'Cập nhật' : 'Tạo mới'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
