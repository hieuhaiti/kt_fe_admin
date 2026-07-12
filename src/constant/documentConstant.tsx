// ── Document type ─────────────────────────────────────────────────
// Server enum: bao_cao | van_ban | pdf_map
export const TYPE_LABEL: Record<string, string> = {
  bao_cao: 'Báo cáo',
  van_ban: 'Văn bản pháp quy',
  pdf_map: 'Bản đồ PDF',
}
export const TYPE_CLASS: Record<string, string> = {
  bao_cao: 'bg-blue-50 text-blue-700 border-blue-200',
  van_ban: 'bg-violet-50 text-violet-700 border-violet-200',
  pdf_map: 'bg-emerald-50 text-emerald-700 border-emerald-200',
}
export const TYPE_DOT: Record<string, string> = {
  bao_cao: 'bg-blue-500',
  van_ban: 'bg-violet-500',
  pdf_map: 'bg-emerald-500',
}

// ── Document status ───────────────────────────────────────────────
export const STATUS_LABEL: Record<string, string> = {
  active: 'Hiệu lực',
  archived: 'Lưu trữ',
  revoked: 'Thu hồi',
  replaced: 'Đã thay thế',
}
export const STATUS_CLASS: Record<string, string> = {
  active: 'bg-green-50 text-green-700 border-green-200',
  archived: 'bg-slate-100 text-slate-500 border-slate-200',
  revoked: 'bg-red-50 text-red-700 border-red-200',
  replaced: 'bg-orange-50 text-orange-700 border-orange-200',
}
export const STATUS_DOT: Record<string, string> = {
  active: 'bg-green-500',
  archived: 'bg-slate-400',
  revoked: 'bg-red-500',
  replaced: 'bg-orange-500',
}
export const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  active: 'default',
  archived: 'secondary',
  revoked: 'destructive',
  replaced: 'outline',
}
