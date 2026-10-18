import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { LocaleShell } from '../LocaleShell'
import { ProfilePage } from '@/features/profile/ProfilePage'
import { getServerSession } from '@/server/auth/session'
import { accountHasPassword } from '@/server/auth/accounts'
import { toRole } from '@/server/auth/roles'
import { en } from '@/i18n/en'

export const metadata: Metadata = {
  title: en.translation.auth.profileTitle,
}

/** Reads the request's session, so it is never prerendered at build time. */
export const dynamic = 'force-dynamic'

/** Profile page (English mirror): any signed-in user. */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  // Same contract as the Hebrew page: `?verified=1` means the visitor just
  // clicked the verification link, so the card celebrates once. Account
  // deletion is confirmed with a code typed into the profile's own modal, so no
  // link lands here any more.
  const { verified } = await searchParams

  const session = await getServerSession()
  if (!session) {
    redirect(`/en/login?next=${encodeURIComponent('/profile')}`)
  }
  // Same contract as the Hebrew page: the delete modal asks for a password
  // only when the account has one.
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
      />
    </LocaleShell>
  )
}
