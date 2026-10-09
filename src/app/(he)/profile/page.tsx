import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { LocaleShell } from '../LocaleShell'
import { ProfilePage } from '@/features/profile/ProfilePage'
import { getServerSession } from '@/server/auth/session'
import { accountHasPassword } from '@/server/auth/accounts'
import { toRole } from '@/server/auth/roles'
import { he } from '@/i18n/he'

export const metadata: Metadata = {
  title: he.translation.auth.profileTitle,
}

/** Reads the request's session, so it is never prerendered at build time. */
export const dynamic = 'force-dynamic'

/**
 * Profile page: any signed-in user, gated exactly like /client. The session is
 * re-checked here (the proxy's cookie test is optimistic and must never be the
 * only guard), and the identity is passed down as props rather than fetched
 * again in the client component.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  // The verification link lands here with `?verified=1` (see the sign-up
  // callbackURL in AuthPage), which is what triggers the one-off confetti. The
  // deletion link lands here with `?delete=<token>`: the modal it opens is the
  // last press before the account goes (nothing is deleted before it).
  const { verified, delete: deleteParam } = await searchParams
  const deleteToken = typeof deleteParam === 'string' && deleteParam ? deleteParam : null

  const session = await getServerSession()
  if (!session) {
    // Keep the token through the sign-in: the deletion link is only honoured
    // for the session that asked for it, and making the visitor dig the mail
    // out again would be the same dead end the raw JSON page used to be.
    const next = deleteToken ? `/profile?delete=${encodeURIComponent(deleteToken)}` : '/profile'
    redirect(`/login?next=${encodeURIComponent(next)}`)
  }
  // Resolved from this request's own session: the delete modal asks for a
  // password only when the account actually has one.
  const hasPassword = await accountHasPassword()

  return (
    <LocaleShell>
      <ProfilePage
        name={session.user.name ?? ''}
        email={session.user.email}
        image={session.user.image ?? null}
        role={toRole((session.user as { role?: unknown }).role)}
        hasPassword={hasPassword}
        justVerified={verified === '1'}
        deleteToken={deleteToken}
      />
    </LocaleShell>
  )
}
