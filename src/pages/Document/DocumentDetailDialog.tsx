import type { ReactNode } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { documentService, useApiQuery } from '@/service'
import type { ApiResponse, Document } from '@/types/api'
import { parseLink } from '@/lib/utils'
import { FileText, Download, Eye } from 'lucide-react'
import { TYPE_LABEL, STATUS_LABEL, STATUS_VARIANT } from '@/constant/documentConstant'
import { formatDate, formatDateTime } from '@/lib/date'

interface DocumentDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  documentId: number | null
}

function getDocumentDetail(response?: ApiResponse<Document | { document?: Document }>) {
  const data = response?.data
  if (!data) return null

  if ('document' in data && data.document) return data.document

  return data as Document
}

function formatBytes(size?: number | string | null) {
  const bytes = typeof size === 'string' ? Number(size) : size
  if (!bytes || Number.isNaN(bytes)) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <span className="font-semibold">{label}:</span>
      <span className="col-span-2">{children}</span>
    </div>
  )
}

export default function DocumentDetailDialog({
  open,
  onOpenChange,
  documentId,
}: DocumentDetailDialogProps) {
  const dbQuery = useApiQuery(
    ['document', documentId],
    () => documentService.getById(documentId!),
    { enabled: !!documentId && open, staleTime: 0 },
    false,
    false
  )
  const doc = getDocumentDetail(
    dbQuery.data as ApiResponse<Document | { document?: Document }> | undefined
  )

  const vi = doc?.translations?.vi
  const title = vi?.title ?? doc?.title
  const description = vi?.description ?? doc?.description
  const docType = doc?.docType ?? doc?.document_type
  const status = doc?.status
  const isPublic = doc?.isPublic ?? doc?.is_public ?? false
  const fileUrl = doc?.fileUrl ?? doc?.file_url
  const fileName = doc?.fileName ?? doc?.file_name
  const fileSize = doc?.fileSize ?? doc?.file_size
  const mimeType = doc?.mimeType ?? doc?.mime_type ?? doc?.fileType ?? doc?.file_type
  const uploadedBy = doc?.uploadedByName ?? doc?.uploadedBy ?? doc?.createdBy ?? doc?.created_by
  const viewCount = doc?.viewCount ?? doc?.view_count
  const downloadCount = doc?.downloadCount ?? doc?.download_count
  const createdAt = doc?.createdAt ?? doc?.created_at
  const updatedAt = doc?.updatedAt ?? doc?.updated_at

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] max-w-3xl overflow-y-auto">
        <DialogTitle>Chi tiết tài liệu</DialogTitle>
        <DialogDescription>Thông tin chi tiết tài liệu đã chọn</DialogDescription>

        {dbQuery.isLoading ? (
          <div className="text-muted-foreground py-8 text-center">Đang tải dữ liệu...</div>
        ) : dbQuery.isError ? (
          <div className="text-destructive py-8 text-center">Không thể tải thông tin tài liệu.</div>
        ) : doc ? (
          <div className="mt-4 space-y-3">
            <DetailRow label="ID">{doc.id}</DetailRow>
            {doc.document_number && <DetailRow label="Số tài liệu">{doc.document_number}</DetailRow>}
            <DetailRow label="Tiêu đề">{title || '-'}</DetailRow>
            <DetailRow label="Loại">
              <Badge variant="outline">{TYPE_LABEL[docType ?? ''] ?? docType ?? '-'}</Badge>
            </DetailRow>
            {status && (
              <DetailRow label="Trạng thái">
                <Badge variant={STATUS_VARIANT[status] ?? 'outline'}>
                  {STATUS_LABEL[status] ?? status}
                </Badge>
              </DetailRow>
            )}
            <DetailRow label="Phạm vi">
              {isPublic ? (
                <Badge variant="default">Công khai</Badge>
              ) : (
                <Badge variant="secondary">Nội bộ</Badge>
              )}
            </DetailRow>
            {description && <DetailRow label="Mô tả">{description}</DetailRow>}
            {doc.issuer && <DetailRow label="Cơ quan ban hành">{doc.issuer}</DetailRow>}
            {doc.signer && <DetailRow label="Người ký">{doc.signer}</DetailRow>}
            {doc.issued_date && <DetailRow label="Ngày ban hành">{formatDate(doc.issued_date)}</DetailRow>}
            {doc.effective_date && (
              <DetailRow label="Ngày hiệu lực">{formatDate(doc.effective_date)}</DetailRow>
            )}
            {doc.expiry_date && <DetailRow label="Ngày hết hạn">{formatDate(doc.expiry_date)}</DetailRow>}
            {fileName && <DetailRow label="Tên file">{fileName}</DetailRow>}
            {mimeType && <DetailRow label="Định dạng">{mimeType}</DetailRow>}
            <DetailRow label="Dung lượng">{formatBytes(fileSize)}</DetailRow>
            {uploadedBy && <DetailRow label="Người tải lên">{uploadedBy}</DetailRow>}
            {viewCount !== undefined && (
              <DetailRow label="Lượt xem">
                <span className="flex items-center gap-1">
                  <Eye className="size-4" /> {viewCount}
                </span>
              </DetailRow>
            )}
            {downloadCount !== undefined && (
              <DetailRow label="Lượt tải">
                <span className="flex items-center gap-1">
                  <Download className="size-4" /> {downloadCount}
                </span>
              </DetailRow>
            )}
            {doc.tags && doc.tags.length > 0 && (
              <DetailRow label="Tags">
                <div className="flex flex-wrap gap-1">
                  {doc.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </DetailRow>
            )}
            {fileUrl && (
              <DetailRow label="File">
                <a
                  href={parseLink(fileUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary flex items-center gap-1 underline"
                >
                  <FileText className="size-4" /> Xem / Tải tài liệu
                </a>
              </DetailRow>
            )}
            <DetailRow label="Ngày tạo">{createdAt ? formatDateTime(createdAt) : '-'}</DetailRow>
            <DetailRow label="Cập nhật lúc">{updatedAt ? formatDateTime(updatedAt) : '-'}</DetailRow>
          </div>
        ) : (
          <div className="text-muted-foreground py-8 text-center">Không có dữ liệu</div>
        )}
      </DialogContent>
    </Dialog>
  )
}
