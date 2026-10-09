import { headers } from 'next/headers'
import { getAuth } from './index'

/**
 * Whether the signed-in account can be proven with a password.
 *
 * Account deletion asks for the current password when there is one: Better Auth
 * only skips its session-freshness check when a password is supplied, and a
 * password is stronger evidence than "this browser holds a cookie from the last
 * day". An account created through Google has no password at all, so the modal
 * must not demand one (see src/features/profile/ProfilePage.tsx).
 *
 * Read from the request's own session, so it can only ever describe the caller.
 * A failure here fails CLOSED (answer "yes, there is a password"): a listing
 * error would otherwise be the one thing that turns the password prompt off for
 * an account that has one. In that state deletion cannot succeed anyway, so the
 * user loses nothing they could have had.
 */
export async function accountHasPassword(): Promise<boolean> {
  try {
    const auth = await getAuth()
    const accounts = await auth.api.listUserAccounts({ headers: await headers() })
    return accounts.some((account) => account.providerId === 'credential')
  } catch (error) {
    console.error(
      `[auth] account listing failed: ${error instanceof Error ? error.message : 'unknown error'}`,
    )
    return true
  }
}
