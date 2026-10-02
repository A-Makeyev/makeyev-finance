import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { LocaleShell } from '../LocaleShell'
import { ProfilePage } from '@/features/profile/ProfilePage'
import { getServerSession } from '@/server/auth/session'
import { toRole } from '@/server/auth/roles'
import { en } from '@/i18n/en'

export const metadata: Metadata = {
  title: en.translation.auth.profileTitle,
}

/** Reads the request's session, so it is never prerendered at build time. */
export const dynamic = 'force-dynamic'

/** Profile page (English mirror): any signed-in user. */
export default async function Page() {
  const session = await getServerSession()
  if (!session) redirect('/en/login?next=/profile')

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
