import type { Role } from '@/lib/permissions'

export type NavItem = {
  name: string
  icon: React.ReactNode
  path: string
  subpath?: string
  /** Role codes allowed to see this item. If undefined → visible to any admin panel role. */
  roles?: Role[]
  /** Permission key from lib/permissions#MODULE_PERMISSIONS */
  permission?: string
  subItems?: {
    name: string
    path: string
    roles?: Role[]
    permission?: string
  }[]
}
