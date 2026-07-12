// ── Approval status ───────────────────────────────────────────────
export const APPROVED_LABEL: Record<string, string> = {
  true: 'Đã duyệt',
  false: 'Chờ duyệt',
}
export const APPROVED_CLASS: Record<string, string> = {
  true: 'bg-green-50 text-green-700 border-green-200',
  false: 'bg-amber-50 text-amber-700 border-amber-200',
}
export const APPROVED_DOT: Record<string, string> = {
  true: 'bg-green-500',
  false: 'bg-amber-500',
}
