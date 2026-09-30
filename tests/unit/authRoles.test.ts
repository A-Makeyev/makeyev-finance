import { describe, expect, it } from 'vitest'
import { DEFAULT_ROLE, isRole, ROLES, roleSatisfies, toRole } from '@/server/auth/roles'

describe('isRole', () => {
  it('accepts exactly the defined roles', () => {
    expect(ROLES.map((role) => isRole(role))).toEqual([true, true, true])
    expect(isRole('admin')).toBe(true)
  })

  it('rejects anything else, including near-misses and non-strings', () => {
    expect(isRole('Admin')).toBe(false)
    expect(isRole('superuser')).toBe(false)
    expect(isRole('')).toBe(false)
    expect(isRole(null)).toBe(false)
    expect(isRole(undefined)).toBe(false)
    expect(isRole(1)).toBe(false)
    expect(isRole({ role: 'admin' })).toBe(false)
  })
})

describe('toRole', () => {
  it('keeps a valid role', () => {
    expect(toRole('advisor')).toBe('advisor')
    expect(toRole('admin')).toBe('admin')
    expect(toRole('client')).toBe('client')
  })

  it('falls back to least privilege, never upward', () => {
    expect(toRole('Admin')).toBe(DEFAULT_ROLE)
    expect(toRole(undefined)).toBe('client')
    expect(toRole(null)).toBe('client')
    expect(toRole('')).toBe('client')
  })
})

describe('roleSatisfies', () => {
  it('is true at or above the required rank (boundary matrix)', () => {
    expect(roleSatisfies('client', 'client')).toBe(true)
    expect(roleSatisfies('advisor', 'client')).toBe(true)
    expect(roleSatisfies('admin', 'client')).toBe(true)
    expect(roleSatisfies('advisor', 'advisor')).toBe(true)
    expect(roleSatisfies('admin', 'advisor')).toBe(true)
    expect(roleSatisfies('admin', 'admin')).toBe(true)
  })

  it('is false below the required rank', () => {
    expect(roleSatisfies('client', 'advisor')).toBe(false)
    expect(roleSatisfies('client', 'admin')).toBe(false)
    expect(roleSatisfies('advisor', 'admin')).toBe(false)
  })
})
