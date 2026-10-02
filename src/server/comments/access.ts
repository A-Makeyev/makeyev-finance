import { roleSatisfies, toRole } from '../auth/roles'
import type { CommentViewer } from './repo'

/**
 * The caller's comment permissions, derived from the SESSION only. There is no
 * path by which a client-supplied role or user id reaches this: the role comes
 * from the stored user record and the id from the session, and the role check
 * reuses the same roleSatisfies ladder the rest of the app authorizes with
 * rather than inventing a second scheme.
 */
export function commentViewer(user: { id: string; role?: unknown }): CommentViewer {
  return {
    userId: user.id,
    isAdmin: roleSatisfies(toRole(user.role), 'admin'),
  }
}

/** An anonymous reader: can read, owns nothing. */
export const GUEST_VIEWER: CommentViewer = { userId: '', isAdmin: false }
