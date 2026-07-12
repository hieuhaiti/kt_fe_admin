// ── Published status ──────────────────────────────────────────────
export const PUBLISHED_LABEL: Record<string, string> = {
  true: 'Xuất bản',
  false: 'Nháp',
}
export const PUBLISHED_CLASS: Record<string, string> = {
  true: 'bg-green-50 text-green-700 border-green-200',
  false: 'bg-slate-100 text-slate-500 border-slate-200',
}
export const PUBLISHED_DOT: Record<string, string> = {
  true: 'bg-green-500',
  false: 'bg-slate-400',
}

// ── Featured status ───────────────────────────────────────────────
export const FEATURED_LABEL: Record<string, string> = {
  true: 'Nổi bật',
  false: 'Không',
}
export const FEATURED_CLASS: Record<string, string> = {
  true: 'bg-amber-50 text-amber-700 border-amber-200',
  false: 'bg-slate-100 text-slate-500 border-slate-200',
}
export const FEATURED_DOT: Record<string, string> = {
  true: 'bg-amber-500',
  false: 'bg-slate-300',
}
