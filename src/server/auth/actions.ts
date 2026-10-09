'use server'

import { headers } from 'next/headers'
import { setAccountPasswordFor, type SetPasswordResult } from './accountPassword'

/**
 * The profile page's only server action: set a password on an account that has
 * none (a Google sign-in).
 *
 * A server action rather than a route handler because nothing else needs it,
 * and Next's server actions are same-origin POSTs with their own protection.
 * The password is never logged and never stored anywhere but Better Auth's own
 * hash. All the rules live in ./accountPassword; this is only the transport.
 */
export async function setAccountPassword(newPassword: string): Promise<SetPasswordResult> {
  return setAccountPasswordFor(await headers(), newPassword)
}
