import { describe, it, expect } from 'vitest'

interface UserStatusInput {
  hasPassword?: boolean
  has_password?: boolean
  must_change_password?: boolean
}

function resolvePasswordPresence(user?: UserStatusInput | null) {
  const hasPassword = user?.hasPassword ?? user?.has_password ?? null
  if (hasPassword === true) return 'Có'
  if (hasPassword === false) return 'Chưa đặt mật khẩu'
  return '-'
}

function resolveMustChangePassword(user?: UserStatusInput | null) {
  const mustChange = user?.must_change_password ?? null
  if (mustChange === true) return 'Cần đổi mật khẩu'
  if (mustChange === false) return 'Bình thường'
  return null
}

describe('W075 - User Password Status Separation', () => {
  it('displays "Chưa đặt mật khẩu" when user has no password, distinct from must_change_password', () => {
    const userWithoutPassword: UserStatusInput = {
      has_password: false,
      must_change_password: false,
    }
    expect(resolvePasswordPresence(userWithoutPassword)).toBe('Chưa đặt mật khẩu')
    expect(resolveMustChangePassword(userWithoutPassword)).toBe('Bình thường')
  })

  it('displays "Có" when user has a password, and "Cần đổi mật khẩu" when required', () => {
    const userWithMustChange: UserStatusInput = {
      hasPassword: true,
      must_change_password: true,
    }
    expect(resolvePasswordPresence(userWithMustChange)).toBe('Có')
    expect(resolveMustChangePassword(userWithMustChange)).toBe('Cần đổi mật khẩu')
  })

  it('handles camelCase and snake_case hasPassword consistently without conflation', () => {
    expect(resolvePasswordPresence({ hasPassword: false })).toBe('Chưa đặt mật khẩu')
    expect(resolvePasswordPresence({ has_password: false })).toBe('Chưa đặt mật khẩu')
    expect(resolvePasswordPresence({ hasPassword: true })).toBe('Có')
    expect(resolvePasswordPresence({ has_password: true })).toBe('Có')
  })
})
