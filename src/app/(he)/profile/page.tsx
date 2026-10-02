import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { LocaleShell } from '../LocaleShell'
import { ProfilePage } from '@/features/profile/ProfilePage'
import { getServerSession } from '@/server/auth/session'
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
export default async function Page() {
  const session = await getServerSession()
  if (!session) redirect('/login?next=/profile')

  return (
    <LocaleShell>
      <ProfilePage
        name={session.user.name ?? ''}
        email={session.user.email}
        image={session.user.image ?? null}
        role={toRole((session.user as { role?: unknown }).role)}
      />
    </LocaleShell>
  )
}
