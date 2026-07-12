import { create } from 'zustand'
import type { User } from '@/types/api'
import apiClient from '@/service/common/apiClient'
import { tokenManager } from '@/lib/tokenManager'
import authService from '@/service/authService'

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isAdmin: boolean
  isInitializing: boolean
  loggedOut: boolean

  loginSuccess: (tokens: {
    accessToken: string
    refreshToken: string
    tokenType?: string
    expiresIn?: string | number
    refreshExpiresIn?: string | number
  }) => void

  fetchProfile: () => Promise<boolean>
  logout: () => void
  expireSession: () => void
  initialize: () => Promise<void>
}

const ADMIN_ROLE_CODES = new Set(['system_admin', 'so_nnmt', 'ubnd_tinh'])

function isAdminUser(user: User | null): boolean {
  if (!user) return false
  const roleCode =
    (user.roleCode as string | undefined) ??
    (user.role?.code as string | undefined) ??
    ''
  if (roleCode && ADMIN_ROLE_CODES.has(roleCode)) return true

  const legacyRoleName = user.role?.name?.trim().toLowerCase() ?? ''
  if (legacyRoleName === 'admin' || legacyRoleName === 'super_admin') return true
  if (user.role_id === 1) return true
  return false
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isAdmin: false,
  isInitializing: true,
  loggedOut: false,

  loginSuccess: ({ accessToken, refreshToken, tokenType, expiresIn, refreshExpiresIn }) => {
    apiClient.setTokens({ accessToken, refreshToken })
    if (tokenType) tokenManager.setTokenType(tokenType)
    if (expiresIn !== undefined) localStorage.setItem('token_expires_in', String(expiresIn))
    if (refreshExpiresIn !== undefined)
      localStorage.setItem('refresh_expires_in', String(refreshExpiresIn))
    tokenManager.setLoginTimestamp(new Date().toISOString())
    set({ isAuthenticated: false, isAdmin: false, loggedOut: false })
  },

  fetchProfile: async () => {
    try {
      const res = await authService.getProfile()
      const user = res?.data?.user ?? null
      const isAdmin = isAdminUser(user)

      if (!isAdmin) {
        tokenManager.clearAll()
        set({ user: null, isAuthenticated: false, isAdmin: false })
        return false
      }

      set({ user, isAuthenticated: true, isAdmin: true })
      return true
    } catch {
      tokenManager.clearAll()
      set({ user: null, isAuthenticated: false, isAdmin: false })
      return false
    }
  },

  logout: () => {
    tokenManager.clearAll()
    set({ user: null, isAuthenticated: false, isAdmin: false, loggedOut: true })
  },

  expireSession: () => {
    tokenManager.clearAll()
    set({ user: null, isAuthenticated: false, isAdmin: false, loggedOut: true })
  },

  initialize: async () => {
    const token = tokenManager.getAccessToken()
    if (!token) {
      set({ isInitializing: false })
      return
    }
    await get().fetchProfile()
    set({ isInitializing: false })
  },
}))

export default useAuthStore
