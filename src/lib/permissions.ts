import type { User, UserRoleCode } from '@/types/api'

/**
 * Vai trò định nghĩa trong server (000_init_schema.sql):
 *   system_admin | ubnd_tinh | so_nnmt | citizen
 *
 * Frontend authorization là ánh xạ 1-1 với JSONB `auth.roles.permissions` seed
 * trên server: gate mọi UI qua `hasPerm(user, resource, action)`. Không maintain
 * bảng permission hard-code ở frontend — server là single source of truth.
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
 * Mirror middleware server `requirePermission(resource, action)`: đọc trực tiếp
 * từ `user.role.permissions` JSONB. `system_admin` được bypass giống backend.
 *
 * Tên `resource`/`action` dùng đúng như JSONB seed: `map_layers`, `news`,
 * `forest_classification`, `fire_risk`, `weather`, `satellite`, `pdf_maps`,
 * `remote_sensing`, `map_apis`, `field_measurements`, `notifications`, `users`,
 * `comments`, `feedback`, `statistics`, `spatial`, `roles`, `documents`.
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
 * Khai báo permission dạng object cho props (routes/nav): `action` có thể là
 * chuỗi đơn hoặc mảng (OR — có bất kỳ action nào cũng qua).
 */
export type PermissionCheck = {
  resource: string
  action: string | string[]
}

export function checkPermission(
  user: User | null | undefined,
  check: PermissionCheck | null | undefined
): boolean {
  if (!check) return true
  if (Array.isArray(check.action)) return hasAnyPerm(user, check.resource, check.action)
  return hasPerm(user, check.resource, check.action)
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
