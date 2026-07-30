import { useCallback, useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { FileImage, FileText, Save } from 'lucide-react'
import { toast } from 'react-toastify'
import { mapImageService, useApiQuery } from '@/service'
import type { ApiResponse, MapImage, UpdatePdfMapBody } from '@/types/api'
import { THEME_LABEL } from '@/constant/mapImageConstant'
import { parseLink, isPdf } from '@/lib/utils'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Checkbox } from '@/components/ui/checkbox'
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

const mapImageSchema = z.object({
  titleVi: z.string().trim().min(2, 'Tiêu đề tiếng Việt phải có ít nhất 2 ký tự').max(255),
  titleEn: z.string().trim().max(255).optional().or(z.literal('')),
  descriptionVi: z.string().trim().max(2000).optional().or(z.literal('')),
  descriptionEn: z.string().trim().max(2000).optional().or(z.literal('')),
  themeCode: z.string().trim().min(1, 'Vui lòng chọn chủ đề'),
  year: z
    .string()
    .trim()
    .refine((v) => v === '' || (/^\d+$/.test(v) && Number(v) >= 1900 && Number(v) <= 2100), {
      message: 'Năm phải từ 1900 đến 2100',
    })
    .optional()
    .or(z.literal('')),
  scale: z.string().trim().max(120).optional().or(z.literal('')),
  region: z.string().trim().max(255).optional().or(z.literal('')),
  isPublic: z.boolean(),
  thumbnailUrl: z.string().trim().max(500).optional().or(z.literal('')),
})

type MapImageFormValues = z.infer<typeof mapImageSchema>

interface MapImageFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mapImageId: number | null
  onSubmit: (data: FormData | UpdatePdfMapBody) => void
  isLoading?: boolean
}

const ACCEPTED_MIME = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
const MAX_FILE_SIZE = 20 * 1024 * 1024

function toFormValues(mapImage: MapImage | null): MapImageFormValues {
  return {
    titleVi: mapImage?.translations?.vi?.title ?? mapImage?.title ?? mapImage?.name ?? '',
    titleEn: mapImage?.translations?.en?.title ?? '',
    descriptionVi: mapImage?.translations?.vi?.description ?? mapImage?.description ?? '',
    descriptionEn: mapImage?.translations?.en?.description ?? '',
    themeCode: mapImage?.themeCode ?? '',
    year: mapImage?.year != null ? String(mapImage.year) : '',
    scale: mapImage?.scale ?? '',
    region: mapImage?.region ?? '',
    isPublic: mapImage?.isPublic ?? true,
    thumbnailUrl: mapImage?.thumbnailUrl ?? '',
  }
}

const DEFAULT_VALUES: MapImageFormValues = {
  titleVi: '',
  titleEn: '',
  descriptionVi: '',
  descriptionEn: '',
  themeCode: '',
  year: '',
  scale: '',
  region: '',
  isPublic: true,
  thumbnailUrl: '',
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
  const isEdit = !!mapImageId
  const detailLoading = isEdit && dbQuery.isLoading

  const [imageFiles, setImageFiles] = useState<File[]>([])

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<MapImageFormValues>({
    resolver: zodResolver(mapImageSchema) as any,
    defaultValues: DEFAULT_VALUES,
  })

  const originalValues = useMemo(() => toFormValues(mapImage), [mapImage])

  useEffect(() => {
    if (!open) return
    if (isEdit && mapImage) reset(toFormValues(mapImage))
    else if (!isEdit) reset(DEFAULT_VALUES)
    setImageFiles([])
  }, [open, isEdit, mapImage, reset])

  const values = watch()
  const changedFields = useMemo(() => {
    if (!isEdit) return new Set<keyof MapImageFormValues>()
    const changed = new Set<keyof MapImageFormValues>()
    ;(Object.keys(DEFAULT_VALUES) as Array<keyof MapImageFormValues>).forEach((key) => {
      if ((values[key] ?? '') !== (originalValues[key] ?? '')) changed.add(key)
    })
    return changed
  }, [isEdit, values, originalValues])

  const changedCount = changedFields.size
  const submitDisabled = isLoading || detailLoading || (isEdit && changedCount === 0)

  const onImageValidate = useCallback((file: File): string | null => {
    if (!ACCEPTED_MIME.includes(file.type)) return 'Chỉ chấp nhận PDF hoặc ảnh (JPG, PNG, WebP, GIF)'
    if (file.size > MAX_FILE_SIZE) return 'Kích thước file không được quá 20MB'
    return null
  }, [])

  const onImageReject = useCallback((file: File, message: string) => {
    const short = file.name.length > 20 ? `${file.name.slice(0, 20)}...` : file.name
    toast.error(`${message}: "${short}"`)
  }, [])

  const buildUpdatePayload = (data: MapImageFormValues): UpdatePdfMapBody => {
    const payload: UpdatePdfMapBody = {
      expectedUpdatedAt: mapImage?.updatedAt ?? new Date().toISOString(),
    }
    if (changedFields.has('themeCode')) payload.themeCode = data.themeCode
    if (changedFields.has('year')) payload.year = data.year ? Number(data.year) : undefined
    if (changedFields.has('scale')) payload.scale = data.scale || undefined
    if (changedFields.has('region')) payload.region = data.region || undefined
    if (changedFields.has('isPublic')) payload.isPublic = data.isPublic
    if (changedFields.has('thumbnailUrl')) payload.thumbnailUrl = data.thumbnailUrl || undefined

    const translations: UpdatePdfMapBody['translations'] = {}
    if (changedFields.has('titleVi') || changedFields.has('descriptionVi')) {
      translations.vi = {
        title: data.titleVi.trim(),
        description: data.descriptionVi?.trim() || null,
      }
    }
    if (changedFields.has('titleEn') || changedFields.has('descriptionEn')) {
      translations.en = {
        title: data.titleEn?.trim() || '',
        description: data.descriptionEn?.trim() || null,
      }
    }
    if (Object.keys(translations).length > 0) payload.translations = translations

    return payload
  }

  const buildCreateFormData = (data: MapImageFormValues): FormData => {
    const fd = new FormData()
    fd.append('lang', 'vi')
    fd.append('title', data.titleVi.trim())
    if (data.descriptionVi?.trim()) fd.append('description', data.descriptionVi.trim())
    fd.append('themeCode', data.themeCode)
    if (data.year) fd.append('year', data.year)
    if (data.scale?.trim()) fd.append('scale', data.scale.trim())
    if (data.region?.trim()) fd.append('region', data.region.trim())
    fd.append('isPublic', String(data.isPublic))
    if (data.thumbnailUrl?.trim()) fd.append('thumbnailUrl', data.thumbnailUrl.trim())
    if (imageFiles[0]) fd.append('file', imageFiles[0])
    return fd
  }

  const handleFormSubmit = (data: MapImageFormValues) => {
    if (isEdit) {
      if (changedCount === 0) {
        toast.info('Chưa có thay đổi nào để lưu')
        return
      }
      onSubmit(buildUpdatePayload(data))
      return
    }
    if (imageFiles.length === 0) {
      toast.error('Vui lòng chọn file ảnh bản đồ')
      return
    }
    onSubmit(buildCreateFormData(data))
  }

  const existingFileUrl = mapImage?.fileUrl || mapImage?.image_url || ''
  const existingThumbnailUrl = mapImage?.thumbnailUrl || ''

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-[calc(100%-2rem)] max-w-3xl flex-col gap-0 overflow-hidden p-0">
        <div className="shrink-0 border-b px-6 py-5 pr-12">
          <DialogTitle>{isEdit ? 'Chỉnh sửa ảnh bản đồ' : 'Thêm ảnh bản đồ mới'}</DialogTitle>
          <DialogDescription className="mt-1">
            {isEdit
              ? 'Cập nhật thông tin ảnh bản đồ. Các trường không đổi sẽ không được gửi lên.'
              : 'Điền đầy đủ thông tin và tải lên file bản đồ.'}
          </DialogDescription>
        </div>

        {detailLoading ? (
          <div className="text-muted-foreground flex min-h-60 items-center justify-center px-6">
            Đang tải dữ liệu...
          </div>
        ) : (
          <form
            onSubmit={handleSubmit(handleFormSubmit)}
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
              {isEdit && existingFileUrl && (
                <div className="space-y-2">
                  <Label>Ảnh hiện tại</Label>
                  <div className="grid gap-3 md:grid-cols-[1fr_160px]">
                    <div className="bg-muted/40 flex min-h-44 items-center justify-center overflow-hidden rounded-md border">
                      {isPdf(existingFileUrl) ? (
                        <div className="flex flex-col items-center gap-2 py-8 text-center">
                          <FileText className="text-primary size-10" />
                          <span className="text-sm font-medium">Tệp PDF</span>
                          <span className="text-muted-foreground max-w-56 truncate text-xs">
                            {mapImage?.fileName || '-'}
                          </span>
                        </div>
                      ) : (
                        <img
                          src={parseLink(existingFileUrl)}
                          alt="Ảnh bản đồ"
                          className="max-h-64 w-full object-contain"
                        />
                      )}
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs font-medium">Thumbnail</p>
                      {existingThumbnailUrl ? (
                        <div className="bg-muted/40 mt-1 flex h-32 items-center justify-center overflow-hidden rounded-md border">
                          <img
                            src={parseLink(existingThumbnailUrl)}
                            alt="Thumbnail"
                            className="h-full w-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="text-muted-foreground bg-muted/20 mt-1 flex h-32 items-center justify-center rounded-md border border-dashed text-xs">
                          Chưa có
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    File chính không thay đổi được từ đây. Bạn có thể cập nhật link thumbnail bên dưới.
                  </p>
                </div>
              )}

              {!isEdit && (
                <div className="space-y-2">
                  <Label>
                    File bản đồ <span className="text-destructive">*</span>
                  </Label>
                  <FileUpload
                    value={imageFiles}
                    onValueChange={setImageFiles}
                    onFileValidate={onImageValidate}
                    onFileReject={onImageReject}
                    accept=".pdf,.jpg,.jpeg,.png,.webp,.gif,image/*,application/pdf"
                    maxFiles={1}
                    maxSize={MAX_FILE_SIZE}
                  >
                    <FileUploadDropzone className="border-dashed">
                      <div className="flex flex-col items-center gap-1 text-center">
                        <FileImage className="text-muted-foreground size-6" />
                        <p className="text-sm font-medium">Kéo thả file vào đây</p>
                        <FileUploadTrigger asChild>
                          <Button type="button" variant="outline" size="sm">
                            Chọn file
                          </Button>
                        </FileUploadTrigger>
                        <p className="text-muted-foreground text-xs">
                          PDF, JPG, PNG, WebP, GIF · tối đa 20MB
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
              )}

              <Separator />

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="titleVi">
                    Tiêu đề (VI) <span className="text-destructive">*</span>
                  </Label>
                  <Input id="titleVi" {...register('titleVi')} placeholder="Biến động lớp phủ..." />
                  {errors.titleVi && (
                    <p className="text-destructive text-xs">{errors.titleVi.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="titleEn">Tiêu đề (EN)</Label>
                  <Input id="titleEn" {...register('titleEn')} placeholder="Land cover change..." />
                  {errors.titleEn && (
                    <p className="text-destructive text-xs">{errors.titleEn.message}</p>
                  )}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="descriptionVi">Mô tả (VI)</Label>
                  <Textarea
                    id="descriptionVi"
                    rows={3}
                    {...register('descriptionVi')}
                    placeholder="Nội dung mô tả tiếng Việt"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="descriptionEn">Mô tả (EN)</Label>
                  <Textarea
                    id="descriptionEn"
                    rows={3}
                    {...register('descriptionEn')}
                    placeholder="English description"
                  />
                </div>
              </div>

              <Separator />

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>
                    Chủ đề <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={watch('themeCode')}
                    onValueChange={(v) =>
                      setValue('themeCode', v, { shouldDirty: true, shouldValidate: true })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Chọn chủ đề" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(THEME_LABEL).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.themeCode && (
                    <p className="text-destructive text-xs">{errors.themeCode.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="year">Năm</Label>
                  <Input
                    id="year"
                    type="number"
                    min={1900}
                    max={2100}
                    {...register('year')}
                    placeholder="2023"
                  />
                  {errors.year && (
                    <p className="text-destructive text-xs">{errors.year.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="scale">Tỉ lệ</Label>
                  <Input id="scale" {...register('scale')} placeholder="1:50000" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="region">Khu vực</Label>
                  <Input id="region" {...register('region')} placeholder="Tỉnh Kon Tum" />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="thumbnailUrl">Đường dẫn thumbnail (tùy chọn)</Label>
                  <Input
                    id="thumbnailUrl"
                    {...register('thumbnailUrl')}
                    placeholder="https://..."
                  />
                </div>
              </div>

              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox
                  checked={watch('isPublic')}
                  onCheckedChange={(checked) =>
                    setValue('isPublic', checked === true, { shouldDirty: true })
                  }
                />
                Công khai trên cổng thông tin
              </label>
            </div>

            <div className="flex shrink-0 flex-col-reverse items-stretch justify-between gap-3 border-t px-6 py-4 sm:flex-row sm:items-center">
              <p className="text-muted-foreground text-xs">
                {isEdit ? (
                  changedCount === 0 ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="bg-muted-foreground/40 size-1.5 rounded-full" />
                      Chưa có thay đổi nào để lưu
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="bg-primary size-1.5 rounded-full" />
                      {changedCount} trường đã thay đổi
                    </span>
                  )
                ) : (
                  <span>Các trường có dấu (*) là bắt buộc</span>
                )}
              </p>
              <div className="flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isLoading}
                >
                  Hủy
                </Button>
                <Button type="submit" disabled={submitDisabled} className="min-w-32">
                  {isLoading ? (
                    'Đang xử lý...'
                  ) : (
                    <span className="flex items-center gap-2">
                      <Save className="size-4" />
                      {isEdit ? 'Cập nhật' : 'Tạo mới'}
                    </span>
                  )}
                </Button>
              </div>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
