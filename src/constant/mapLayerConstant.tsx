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

// ── Category (nhóm lớp) ───────────────────────────────────────────
// Mapping toàn diện: gồm cả slug mới (English, khớp GEE modules) và slug cũ
// (tiếng Việt không dấu) để hiển thị nhất quán ở mọi nơi.
export const MAP_LAYER_CATEGORY_LABEL_VI: Record<string, string> = {
  // Modules chuyên đề (English slug)
  land_cover: 'Lớp phủ mặt đất',
  remote_sensing: 'Ảnh viễn thám',
  fire_risk_district: 'Nguy cơ cháy rừng theo huyện',
  forest_district: 'Phân loại rừng theo huyện',
  administrative: 'Ranh giới hành chính',
  hydrology: 'Thủy văn',
  transportation: 'Giao thông',
  infrastructure: 'Hạ tầng',
  environment: 'Môi trường',
  agriculture: 'Nông nghiệp',
  forestry: 'Lâm nghiệp',
  // Legacy slug (dữ liệu cũ trong DB có thể còn)
  fire_risk: 'Nguy cơ cháy rừng',
  forest: 'Rừng',
  transport: 'Giao thông',
  weather: 'Thời tiết',
  hanh_chinh: 'Hành chính',
  thuy_van: 'Thủy văn',
  giao_thong: 'Giao thông',
  other: 'Khác',
}

// Danh sách chọn trong form Tạo/Sửa/Import — giữ nguyên value hiện hành để
// không phá dữ liệu đã tạo. Chỉ hiển thị label tiếng Việt.
export const MAP_LAYER_CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: 'land_cover', label: MAP_LAYER_CATEGORY_LABEL_VI.land_cover },
  { value: 'fire_risk_district', label: MAP_LAYER_CATEGORY_LABEL_VI.fire_risk_district },
  { value: 'remote_sensing', label: MAP_LAYER_CATEGORY_LABEL_VI.remote_sensing },
  { value: 'forest_district', label: MAP_LAYER_CATEGORY_LABEL_VI.forest_district },
  { value: 'hanh_chinh', label: MAP_LAYER_CATEGORY_LABEL_VI.hanh_chinh },
  { value: 'thuy_van', label: MAP_LAYER_CATEGORY_LABEL_VI.thuy_van },
  { value: 'giao_thong', label: MAP_LAYER_CATEGORY_LABEL_VI.giao_thong },
  { value: 'other', label: MAP_LAYER_CATEGORY_LABEL_VI.other },
]

export function getMapLayerCategoryLabel(key?: string | null): string {
  if (!key) return '-'
  return (
    MAP_LAYER_CATEGORY_LABEL_VI[key] ||
    key
      .replace(/[_-]+/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
  )
}
