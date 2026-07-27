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

// ── Published status ──────────────────────────────────────────────
export const PUBLISHED_LABEL: Record<string, string> = {
  true: 'Đã công bố',
  false: 'Chưa công bố',
}
export const PUBLISHED_CLASS: Record<string, string> = {
  true: 'bg-sky-50 text-sky-700 border-sky-200',
  false: 'bg-slate-100 text-slate-500 border-slate-200',
}
export const PUBLISHED_DOT: Record<string, string> = {
  true: 'bg-sky-500',
  false: 'bg-slate-400',
}

// ── Public status ─────────────────────────────────────────────────
export const PUBLIC_LABEL: Record<string, string> = {
  true: 'Công khai',
  false: 'Riêng tư',
}
export const PUBLIC_CLASS: Record<string, string> = {
  true: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  false: 'bg-slate-100 text-slate-500 border-slate-200',
}
export const PUBLIC_DOT: Record<string, string> = {
  true: 'bg-emerald-500',
  false: 'bg-slate-400',
}
