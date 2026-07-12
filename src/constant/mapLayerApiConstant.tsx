// ── Map API status (derived from is_active + expires_at) ──────────
// Postman /map-apis no longer uses draft/published. The UI derives a
// runtime status from `is_active` and `expires_at`:
//   - active   → is_active === true  && expires_at in the future (or null)
//   - expired  → expires_at <= now
//   - revoked  → is_active === false && not yet expired
export type MapApiRuntimeStatus = 'active' | 'expired' | 'revoked'

export function deriveMapApiStatus(api: {
  is_active?: boolean
  expires_at?: string | null
}): MapApiRuntimeStatus {
  const now = Date.now()
  if (api.expires_at) {
    const expiresMs = new Date(api.expires_at).getTime()
    if (Number.isFinite(expiresMs) && expiresMs <= now) return 'expired'
  }
  if (api.is_active === false) return 'revoked'
  return 'active'
}

export const STATUS_LABEL: Record<string, string> = {
  active: 'Đang hoạt động',
  expired: 'Đã hết hạn',
  revoked: 'Đã thu hồi',
  // Legacy aliases so pages migrated later keep rendering
  published: 'Đang hoạt động',
  draft: 'Đã thu hồi',
}
export const STATUS_CLASS: Record<string, string> = {
  active: 'bg-green-50 text-green-700 border-green-200',
  expired: 'bg-amber-50 text-amber-700 border-amber-200',
  revoked: 'bg-slate-100 text-slate-500 border-slate-200',
  published: 'bg-green-50 text-green-700 border-green-200',
  draft: 'bg-slate-100 text-slate-500 border-slate-200',
}
export const STATUS_DOT: Record<string, string> = {
  active: 'bg-green-500',
  expired: 'bg-amber-500',
  revoked: 'bg-slate-400',
  published: 'bg-green-500',
  draft: 'bg-slate-400',
}
