import type { User } from '@/types/api'
import { ROLES } from '@/lib/permissions'

export type MapLayerApiPermissionAction = 'create' | 'update' | 'delete' | 'share'

export function hasMapLayerApiPermission(user: User | null, action: MapLayerApiPermissionAction) {
  if (!user) return false

  const roleCode =
    (user.roleCode as string | undefined) ??
    (user.role?.code as string | undefined) ??
    (user.role?.name?.toLowerCase() ?? '')

  if (roleCode === ROLES.SYSTEM_ADMIN || roleCode === 'admin' || user.role_id === 1) return true
  if (roleCode === ROLES.SO_NNMT && (action === 'create' || action === 'update' || action === 'share')) {
    return true
  }

  const permissions = user.role?.permissions
  if (!permissions) return false

  if (Array.isArray(permissions)) {
    return (
      permissions.includes(`map_apis:${action}`) ||
      permissions.includes(`map_layer_apis:${action}`) ||
      permissions.includes('map_apis:*') ||
      permissions.includes('map_layer_apis:*')
    )
  }

  const bucket = permissions.map_apis ?? permissions.map_layer_apis ?? []
  if (bucket.includes('*') || bucket.includes(action)) return true

  const flattened = Object.entries(permissions).flatMap(([resource, actions]) =>
    (actions as string[]).map((item) => `${resource}:${item}`)
  )

  return (
    flattened.includes(`map_apis:${action}`) || flattened.includes(`map_layer_apis:${action}`)
  )
}

export function normalizeStatusBadge(status: string | undefined) {
  return status === 'published' ? 'Published' : status === 'draft' ? 'Draft' : status ?? 'Active'
}
