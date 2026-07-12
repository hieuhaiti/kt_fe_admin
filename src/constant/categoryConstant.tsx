// ── Active status ─────────────────────────────────────────────────
export const ACTIVE_LABEL: Record<string, string> = {
  true: 'Đang hoạt động',
  false: 'Ngừng hoạt động',
}
export const ACTIVE_CLASS: Record<string, string> = {
  true: 'bg-green-50 text-green-700 border-green-200',
  false: 'bg-slate-100 text-slate-500 border-slate-200',
}
export const ACTIVE_DOT: Record<string, string> = {
  true: 'bg-green-500',
  false: 'bg-slate-400',
}

// ── Monitoring feature labels ───────────────────────────────────
export const MONITORING_FEATURE_LABEL: Record<string, string> = {
  reference: 'Điểm tham chiếu',
  monitoring: 'Điểm giám sát rừng và môi trường',
  none: 'Không giám sát',
}
