export type UserRoleCode = 'system_admin' | 'so_nnmt' | 'ubnd_tinh' | 'citizen'

export interface UserRole {
  id?: number
  code?: UserRoleCode | string
  name?: string
  description?: string
  permissions?: Record<string, string[]> | string[]
}

export interface User {
  id: number | string
  email: string
  fullName?: string | null
  phone?: string | null
  avatarUrl?: string | null
  roleCode?: UserRoleCode | string
  role_name_vi?: string | null
  role_name_en?: string | null
  role_permissions?: Record<string, Record<string, boolean> | string[]>
  role?: UserRole
  isActive?: boolean
  isEmailVerified?: boolean
  email_verified?: boolean
  email_verified_at?: string | null
  hasPassword?: boolean
  must_change_password?: boolean
  password_changed_at?: string | null
  provider?: string
  addressDetail?: string | null
  lastLoginAt?: string | null
  last_login_at?: string | null
  last_login_ip?: string | null
  loginCount?: number
  lockedUntil?: string | null
  createdAt?: string
  updatedAt?: string
  deletedAt?: string | null

  // Legacy snake_case fields kept for pages not yet migrated
  full_name?: string | null
  avatar_url?: string | null
  address_detail?: string | null
  role_id?: number
  role_name?: string
  is_active?: boolean
  is_deleted?: boolean
  deleted_at?: string | null
  deleted_by?: string | null
  last_login?: string | null
  login_count?: number
  locked_until?: string | null
  created_at?: string
  updated_at?: string
  username?: string
}

export interface UserListData {
  items?: User[]
  users: User[]
  pagination?: import('./index').Pagination
}

export interface UserListParams {
  page?: number
  limit?: number
  roleCode?: UserRoleCode | string
  isActive?: boolean
  q?: string
  email?: string
  sortBy?: string
  sortOrder?: 'ASC' | 'DESC'

  // legacy
  is_active?: boolean
  role_id?: number
}

export interface CreateUserBody {
  email: string
  password: string
  fullName: string
  phone?: string
  roleCode: UserRoleCode | string
}

export interface UpdateUserRoleBody {
  roleCode: UserRoleCode | string
}

export interface UpdateUserActiveBody {
  isActive: boolean
}

export interface ResetUserPasswordBody {
  newPassword: string
}
