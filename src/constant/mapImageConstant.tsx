// ── Public status ─────────────────────────────────────────────────
export const PUBLIC_LABEL: Record<string, string> = {
  true: 'Công khai',
  false: 'Riêng tư',
}
export const PUBLIC_CLASS: Record<string, string> = {
  true: 'bg-green-50 text-green-700 border-green-200',
  false: 'bg-slate-100 text-slate-500 border-slate-200',
}
export const PUBLIC_DOT: Record<string, string> = {
  true: 'bg-green-500',
  false: 'bg-slate-400',
}

// ── Theme codes ───────────────────────────────────────────────────
export const THEME_LABEL: Record<string, string> = {
  lop_phu_nhiet: 'Lớp phủ nhiệt',
  chay_rung: 'Cháy rừng',
  lop_phu_rung: 'Lớp phủ rừng',
  khac: 'Khác',
}

// ── Legacy aliases (kept so pages not yet migrated keep compiling) ─
export const ACTIVE_LABEL = PUBLIC_LABEL
export const ACTIVE_CLASS = PUBLIC_CLASS
export const ACTIVE_DOT = PUBLIC_DOT
