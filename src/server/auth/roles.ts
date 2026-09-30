/**
 * User roles and the authorization rules over them. Pure and dependency-free
 * so the rules get unit-tested against concrete values rather than only being
 * exercised through a live session.
 *
 * Ordering matters: the roles form a strict hierarchy (client < advisor <
 * admin) and authorization asks "is the actual role at least the required
 * one", never an exact match. That keeps a single rule correct for both
 * "advisors and admins may enter /advisor" and "any signed-in user may enter
 * /client".
 */

export const ROLES = ['client', 'advisor', 'admin'] as const

export type Role = (typeof ROLES)[number]

/** New sign-ups get the least privilege. Also the fallback for a missing/invalid role. */
export const DEFAULT_ROLE: Role = 'client'

const RANK: Record<Role, number> = {
  client: 0,
  advisor: 1,
  admin: 2,
}

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value)
}

/**
 * Normalizes an untrusted value (a stored field, a JWT claim) to a Role.
 * Unknown or missing values become the least-privileged role rather than
 * throwing or defaulting upward.
 */
export function toRole(value: unknown): Role {
  return isRole(value) ? value : DEFAULT_ROLE
}

/** True when `actual` is at least as privileged as `required`. */
export function roleSatisfies(actual: Role, required: Role): boolean {
  return RANK[actual] >= RANK[required]
}
