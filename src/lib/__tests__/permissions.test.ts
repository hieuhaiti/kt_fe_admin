import { describe, expect, it } from 'vitest'
import { hasPerm } from '../permissions'
import type { User } from '@/types/api'

const user = (code: string, permissions: NonNullable<User['role_permissions']>): User => ({
  id: code,
  email: `${code}@test.invalid`,
  role: { code, permissions },
})

describe('API role permissions', () => {
  it('reads boolean permissions without treating read as manage', () => {
    const viewer = user('ubnd_tinh', { forest_classification: { read: true, manage: false } })
    expect(hasPerm(viewer, 'forest_classification', 'read')).toBe(true)
    expect(hasPerm(viewer, 'forest_classification', 'manage')).toBe(false)
    expect(hasPerm(viewer, 'statistics', 'dashboard')).toBe(false)
  })
  it('keeps system admin bypass and denies absent identity', () => {
    expect(hasPerm(user('system_admin', {}), 'statistics', 'dashboard')).toBe(true)
    expect(hasPerm(null, 'statistics', 'dashboard')).toBe(false)
  })
  it('does not infer privileges from role name alone', () => {
    expect(hasPerm(user('so_nnmt', {}), 'fire_risk', 'manage')).toBe(false)
  })
})
