import type { PermissionCheck, Role } from '@/lib/permissions'

export type NavItem = {
  name: string
  icon: React.ReactNode
  path: string
  subpath?: string
  /** Role codes allowed to see this item. If undefined → visible to any admin panel role. */
  roles?: Role[]
  /** Server RBAC check: `{ resource, action }` — action là string hoặc mảng (OR). */
  permission?: PermissionCheck
  subItems?: {
    name: string
    path: string
    roles?: Role[]
    permission?: PermissionCheck
  }[]
}
