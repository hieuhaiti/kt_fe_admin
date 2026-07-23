import type { User, UserRoleCode } from '@/types/api'

/**
 * Vai trò được định nghĩa trong server:
 * - system_admin: toàn quyền
 * - ubnd_tinh: xem dashboard, báo cáo, phê duyệt (chủ yếu read)
 * - so_nnmt: nghiệp vụ chính (nhập dữ liệu, quản lý trạm/vùng, xử lý cảnh báo)
 * - citizen: xem công khai + gửi phản ánh
 *
 * Ma trận phân quyền tuân theo tài liệu
 * "Danh mục chức năng WebGIS / MobileGIS Kon Tum".
 */
export const ROLES = {
  SYSTEM_ADMIN: 'system_admin',
  UBND_TINH: 'ubnd_tinh',
  SO_NNMT: 'so_nnmt',
  CITIZEN: 'citizen',
} as const

export type Role = (typeof ROLES)[keyof typeof ROLES] | UserRoleCode | string

export const ADMIN_PANEL_ROLES: Role[] = [ROLES.SYSTEM_ADMIN, ROLES.UBND_TINH, ROLES.SO_NNMT]

export function getUserRole(user: User | null | undefined): Role | null {
  if (!user) return null
  return (user.roleCode as Role) || (user.role?.code as Role) || null
}

export function hasRole(user: User | null | undefined, roles: Role[]): boolean {
  const role = getUserRole(user)
  if (!role) return false
  return roles.includes(role)
}

/**
 * Kiểm tra quyền chi tiết theo (resource, action) — mirror middleware server
 * `requirePermission(resource, action)`. Đọc trực tiếp từ `user.role.permissions`
 * (JSONB seed từ server) → single source of truth, không drift khi server đổi
 * migration seed. `system_admin` được bypass toàn quyền, giống backend.
 *
 * Tên `resource` dùng snake_case đúng như server: `map_layers`, `news`, `documents`,
 * `forest_classification`, `fire_risk`, `weather`, `satellite`, `pdf_maps`,
 * `remote_sensing`, `map_apis`, `field_measurements`, `notifications`, `users`,
 * `comments`, `feedback`, `statistics`, `spatial`, `roles`.
 *
 * Ví dụ:
 *   hasPerm(user, 'news', 'create')          // POST /news
 *   hasPerm(user, 'forest_classification', 'manage')
 *   hasPerm(user, 'users', 'change_role')
 */
export function hasPerm(
  user: User | null | undefined,
  resource: string,
  action: string
): boolean {
  if (!user) return false
  if (getUserRole(user) === ROLES.SYSTEM_ADMIN) return true
  const perms = (user.role?.permissions ?? user.role_permissions) as
    | Record<string, Record<string, boolean> | string[]>
    | undefined
  const resourcePerms = perms?.[resource]
  if (!resourcePerms) return false
  if (Array.isArray(resourcePerms)) return resourcePerms.includes(action)
  return resourcePerms[action] === true
}

/** Cho phép truyền nhiều action → true nếu có bất kỳ. */
export function hasAnyPerm(
  user: User | null | undefined,
  resource: string,
  actions: string[]
): boolean {
  return actions.some((a) => hasPerm(user, resource, a))
}

/**
 * Danh mục quyền theo module — mỗi entry là tập vai trò được phép truy cập
 * trang tương ứng trên admin panel (citizen không có mặt trên admin panel).
 */
export const MODULE_PERMISSIONS: Record<string, Role[]> = {
  // ── Người dùng ──
  'users:view': [ROLES.SYSTEM_ADMIN, ROLES.UBND_TINH, ROLES.SO_NNMT],
  'users:create': [ROLES.SYSTEM_ADMIN, ROLES.SO_NNMT],
  'users:delete': [ROLES.SYSTEM_ADMIN, ROLES.SO_NNMT],
  'users:reset-password': [ROLES.SYSTEM_ADMIN, ROLES.SO_NNMT],
  'users:set-active': [ROLES.SYSTEM_ADMIN, ROLES.SO_NNMT],
  'users:change-role': [ROLES.SYSTEM_ADMIN],

  // ── Bản đồ ──
  'map-layers:view': [ROLES.SYSTEM_ADMIN, ROLES.UBND_TINH, ROLES.SO_NNMT],
  'map-layers:create': [ROLES.SYSTEM_ADMIN, ROLES.SO_NNMT],
  'map-layers:update': [ROLES.SYSTEM_ADMIN, ROLES.SO_NNMT],
  'map-layers:delete': [ROLES.SYSTEM_ADMIN, ROLES.SO_NNMT],
  'map-layers:publish': [ROLES.SYSTEM_ADMIN],
  'map-layers:import': [ROLES.SYSTEM_ADMIN, ROLES.SO_NNMT],

  // ── API bản đồ ──
  'map-apis:view': [ROLES.SYSTEM_ADMIN, ROLES.UBND_TINH, ROLES.SO_NNMT],
  'map-apis:manage': [ROLES.SYSTEM_ADMIN],

  // ── PDF Maps / Ảnh vệ tinh tĩnh ──
  'pdf-maps:view': [ROLES.SYSTEM_ADMIN, ROLES.UBND_TINH, ROLES.SO_NNMT],
  'pdf-maps:manage': [ROLES.SYSTEM_ADMIN, ROLES.SO_NNMT],

  // ── Viễn thám / Ảnh vệ tinh COG ──
  'remote-sensing:view': [ROLES.SYSTEM_ADMIN, ROLES.UBND_TINH, ROLES.SO_NNMT],
  'remote-sensing:upload': [ROLES.SYSTEM_ADMIN],
  'remote-sensing:delete': [ROLES.SYSTEM_ADMIN, ROLES.SO_NNMT],
  'remote-sensing:process': [ROLES.SYSTEM_ADMIN, ROLES.SO_NNMT],

  // ── Ảnh vệ tinh theo yêu cầu (GEE) ──
  'satellite:run': [ROLES.SYSTEM_ADMIN, ROLES.UBND_TINH, ROLES.SO_NNMT],

  // ── Phân loại rừng ──
  'forest-classification:view': [ROLES.SYSTEM_ADMIN, ROLES.UBND_TINH, ROLES.SO_NNMT],
  'forest-classification:manage': [ROLES.SYSTEM_ADMIN, ROLES.SO_NNMT],

  // ── Cháy rừng ──
  'fire-risk:view': [ROLES.SYSTEM_ADMIN, ROLES.UBND_TINH, ROLES.SO_NNMT],
  'fire-risk:manage': [ROLES.SYSTEM_ADMIN, ROLES.SO_NNMT],

  // ── Thời tiết ──
  'weather:view': [ROLES.SYSTEM_ADMIN, ROLES.UBND_TINH, ROLES.SO_NNMT],
  'weather:manage': [ROLES.SYSTEM_ADMIN, ROLES.SO_NNMT],

  // ── Tin tức ──
  'news:view': [ROLES.SYSTEM_ADMIN, ROLES.UBND_TINH, ROLES.SO_NNMT],
  'news:manage': [ROLES.SYSTEM_ADMIN, ROLES.SO_NNMT],
  'news:moderate-comments': [ROLES.SYSTEM_ADMIN, ROLES.SO_NNMT],

  // ── Văn bản ──
  'documents:view': [ROLES.SYSTEM_ADMIN, ROLES.UBND_TINH, ROLES.SO_NNMT],
  'documents:manage': [ROLES.SYSTEM_ADMIN, ROLES.SO_NNMT],

  // ── Phản ánh ──
  'feedback:view': [ROLES.SYSTEM_ADMIN, ROLES.UBND_TINH, ROLES.SO_NNMT],
  'feedback:handle': [ROLES.SYSTEM_ADMIN, ROLES.SO_NNMT],
  'feedback:delete': [ROLES.SYSTEM_ADMIN],

  // ── Thống kê ──
  'stats:view': [ROLES.SYSTEM_ADMIN, ROLES.UBND_TINH, ROLES.SO_NNMT],
  'stats:manage': [ROLES.SYSTEM_ADMIN],

  // ── Đo đạc thực địa MobileGIS ──
  'field-measurements:view': [ROLES.SYSTEM_ADMIN, ROLES.UBND_TINH, ROLES.SO_NNMT],
  'field-measurements:manage': [ROLES.SYSTEM_ADMIN, ROLES.SO_NNMT],

  // ── Nhật ký hệ thống ──
  'audit-logs:view': [ROLES.SYSTEM_ADMIN],

  // ── Thông báo ──
  'notifications:send': [ROLES.SYSTEM_ADMIN, ROLES.SO_NNMT],
}

export function can(
  user: User | null | undefined,
  permission: keyof typeof MODULE_PERMISSIONS | string
): boolean {
  const allowed = MODULE_PERMISSIONS[permission as string]
  if (!allowed) return false
  return hasRole(user, allowed)
}

export const ROLE_LABELS: Record<string, string> = {
  [ROLES.SYSTEM_ADMIN]: 'Quản trị hệ thống',
  [ROLES.UBND_TINH]: 'UBND tỉnh',
  [ROLES.SO_NNMT]: 'Sở NN&MT',
  [ROLES.CITIZEN]: 'Người dân',
}

export const ROLE_BADGE_CLASS: Record<string, string> = {
  [ROLES.SYSTEM_ADMIN]: 'bg-red-100 text-red-800 border-red-200',
  [ROLES.UBND_TINH]: 'bg-blue-100 text-blue-800 border-blue-200',
  [ROLES.SO_NNMT]: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  [ROLES.CITIZEN]: 'bg-slate-100 text-slate-800 border-slate-200',
}
