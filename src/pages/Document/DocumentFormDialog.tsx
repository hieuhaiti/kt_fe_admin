import { useEffect, useCallback, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { documentService, useApiQuery } from '@/service'
import type { ApiResponse, Document, DocumentType, DocumentStatus } from '@/types/api'
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
import { parseLink } from '@/lib/utils'
import { FileText } from 'lucide-react'

const ACCEPTED_MIME = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]

const documentFormSchema = z.object({
  document_number: z.string().min(1, 'Số tài liệu là bắt buộc').max(100),
  title: z.string().min(5, 'Tiêu đề phải có ít nhất 5 ký tự').max(500),
  description: z.string().optional().or(z.literal('')),
  document_type: z.enum(['excel', 'word', 'pdf'] as const),
  status: z.enum(['active', 'archived', 'revoked', 'replaced'] as const),
  is_public: z.boolean(),
  // Đồng bộ server: max(255)
  issuer: z
    .string()
    .max(255, 'Cơ quan ban hành không được vượt quá 255 ký tự')
    .optional()
    .or(z.literal('')),
  signer: z
    .string()
    .max(255, 'Người ký không được vượt quá 255 ký tự')
    .optional()
    .or(z.literal('')),
  issued_date: z.string().optional().or(z.literal('')),
  effective_date: z.string().optional().or(z.literal('')),
  expiry_date: z.string().optional().or(z.literal('')),
})

type DocumentFormValues = z.infer<typeof documentFormSchema>

interface DocumentFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  documentId: number | null
  onSubmit: (data: FormData) => void
  isLoading?: boolean
}

const TYPE_LABELS: { value: DocumentType; label: string }[] = [
  { value: 'pdf', label: 'PDF' },
  { value: 'word', label: 'Word' },
  { value: 'excel', label: 'Excel' },
]

const STATUS_LABELS: { value: DocumentStatus; label: string }[] = [
  { value: 'active', label: 'Hiệu lực' },
  { value: 'archived', label: 'Lưu trữ' },
  { value: 'revoked', label: 'Thu hồi' },
  { value: 'replaced', label: 'Đã thay thế' },
]

export default function DocumentFormDialog({
  open,
  onOpenChange,
  documentId,
  onSubmit,
  isLoading = false,
}: DocumentFormDialogProps) {
  const dbQuery = useApiQuery(
    ['document', documentId],
    () => documentService.getById(documentId!),
    { enabled: !!documentId && open, staleTime: 0 },
    false,
    false
  )
  const doc = (() => {
    const d = (dbQuery.data as ApiResponse<any>)?.data
    return (d ? (d.document ?? d) : null) as Document | null
  })()
  const isEdit = !!doc

  const [fileList, setFileList] = useState<File[]>([])

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<DocumentFormValues>({
    resolver: zodResolver(documentFormSchema) as any,
    defaultValues: {
      document_number: '',
      title: '',
      description: '',
      document_type: 'pdf',
      status: 'active',
      is_public: true,
      issuer: '',
      signer: '',
      issued_date: '',
      effective_date: '',
      expiry_date: '',
    },
  })

  useEffect(() => {
    if (doc) {
      const vi = doc.translations?.vi
      reset({
        document_number: (doc.document_number ?? '') as string,
        title: (vi?.title ?? doc.title ?? '') as string,
        description: vi?.description ?? doc.description ?? '',
        document_type: (doc.document_type ?? doc.docType ?? 'bao_cao') as any,
        status: (doc.status ?? 'active') as any,
        is_public: doc.is_public ?? doc.isPublic ?? true,
        issuer: doc.issuer || '',
        signer: doc.signer || '',
        issued_date: doc.issued_date ? doc.issued_date.split('T')[0] : '',
        effective_date: doc.effective_date ? doc.effective_date.split('T')[0] : '',
        expiry_date: doc.expiry_date ? doc.expiry_date.split('T')[0] : '',
      })
    } else {
      reset({
        document_number: '',
        title: '',
        description: '',
        document_type: 'pdf',
        status: 'active',
        is_public: true,
        issuer: '',
        signer: '',
        issued_date: '',
        effective_date: '',
        expiry_date: '',
      })
    }
    setFileList([])
  }, [doc, reset, open])

  const onFileValidate = useCallback((file: File): string | null => {
    if (!ACCEPTED_MIME.includes(file.type)) return 'Chỉ chấp nhận PDF, Word, Excel'
    if (file.size > 50 * 1024 * 1024) return 'File không được vượt quá 50MB'
    return null
  }, [])

  const onFileReject = useCallback((file: File, message: string) => {
    toast.error(
      `${message}: "${file.name.length > 20 ? `${file.name.slice(0, 20)}...` : file.name}"`
    )
  }, [])

  const handleFormSubmit = (data: DocumentFormValues) => {
    if (!isEdit && fileList.length === 0) {
      toast.error('Vui lòng chọn file tài liệu')
      return
    }
    const fd = new FormData()
    fd.append('document_number', data.document_number)
    fd.append('title', data.title)
    if (data.description?.trim()) fd.append('description', data.description)
    fd.append('document_type', data.document_type)
    fd.append('status', data.status)
    fd.append('is_public', String(data.is_public))
    if (data.issuer?.trim()) fd.append('issuer', data.issuer)
    if (data.signer?.trim()) fd.append('signer', data.signer)
    if (data.issued_date) fd.append('issued_date', data.issued_date)
    if (data.effective_date) fd.append('effective_date', data.effective_date)
    if (data.expiry_date) fd.append('expiry_date', data.expiry_date)
    if (fileList[0]) fd.append('file_url', fileList[0])
    onSubmit(fd)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] max-w-3xl overflow-y-auto">
        <DialogTitle>{isEdit ? 'Chỉnh sửa tài liệu' : 'Thêm tài liệu mới'}</DialogTitle>
        <DialogDescription>
          {isEdit ? 'Cập nhật thông tin tài liệu' : 'Điền thông tin để tạo tài liệu mới'}
        </DialogDescription>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="document_number">
                Số tài liệu <span className="text-destructive">*</span>
              </Label>
              <Input
                id="document_number"
                {...register('document_number')}
                placeholder="VD: 01/QĐ-TTg"
              />
              {errors.document_number && (
                <p className="text-destructive text-sm">{errors.document_number.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>
                Loại tài liệu <span className="text-destructive">*</span>
              </Label>
              <Controller
                name="document_type"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TYPE_LABELS.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">
              Tiêu đề <span className="text-destructive">*</span>
            </Label>
            <Input id="title" {...register('title')} placeholder="Nhập tiêu đề tài liệu" />
            {errors.title && <p className="text-destructive text-sm">{errors.title.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Mô tả</Label>
            <Textarea
              id="description"
              {...register('description')}
              placeholder="Nhập mô tả (tùy chọn)"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="issuer">Cơ quan ban hành</Label>
              <Input id="issuer" {...register('issuer')} placeholder="VD: Thủ tướng Chính phủ" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signer">Người ký</Label>
              <Input id="signer" {...register('signer')} placeholder="Họ tên người ký" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="issued_date">Ngày ban hành</Label>
              <Input id="issued_date" type="date" {...register('issued_date')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="effective_date">Ngày hiệu lực</Label>
              <Input id="effective_date" type="date" {...register('effective_date')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expiry_date">Ngày hết hạn</Label>
              <Input id="expiry_date" type="date" {...register('expiry_date')} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Trạng thái</Label>
              <Controller
                name="status"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_LABELS.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-2">
              <Label>Phạm vi</Label>
              <Controller
                name="is_public"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value ? 'true' : 'false'}
                    onValueChange={(v) => field.onChange(v === 'true')}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Công khai</SelectItem>
                      <SelectItem value="false">Nội bộ</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          {/* File upload */}
          <div className="space-y-2">
            <Label>
              File tài liệu {!isEdit && <span className="text-destructive">*</span>}
              {isEdit && (
                <span className="text-muted-foreground ml-1 text-xs">(Để trống nếu không đổi)</span>
              )}
            </Label>
            {isEdit && (doc?.file_url ?? doc?.fileUrl) && fileList.length === 0 && (
              <div className="bg-muted flex items-center gap-2 rounded-md p-3">
                <FileText className="text-muted-foreground size-5 shrink-0" />
                <a
                  href={parseLink(doc.file_url ?? doc.fileUrl ?? '')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary truncate text-sm underline"
                >
                  {doc.file_name ?? doc.fileName ?? 'Xem file hiện tại'}
                </a>
              </div>
            )}
            <FileUpload
              value={fileList}
              onValueChange={setFileList}
              onFileValidate={onFileValidate}
              onFileReject={onFileReject}
              accept=".pdf,.doc,.docx,.xls,.xlsx"
              maxFiles={1}
              maxSize={50 * 1024 * 1024}
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
                  <p className="text-muted-foreground text-xs">PDF, Word, Excel · Tối đa 50MB</p>
                </div>
              </FileUploadDropzone>
              <FileUploadList>
                {fileList.map((file) => (
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
