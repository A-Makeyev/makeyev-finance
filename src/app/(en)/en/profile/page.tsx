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
  // clicked the verification link, so the card celebrates once, and
  // `?delete=<token>` means the deletion link was just opened.
  const { verified, delete: deleteParam } = await searchParams
  const deleteToken = typeof deleteParam === 'string' && deleteParam ? deleteParam : null

  const session = await getServerSession()
  if (!session) {
    // Same contract as the Hebrew page: the token survives the sign-in.
    const next = deleteToken ? `/en/profile?delete=${encodeURIComponent(deleteToken)}` : '/profile'
    redirect(`/en/login?next=${encodeURIComponent(next)}`)
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
        deleteToken={deleteToken}
      />
    </LocaleShell>
  )
}
