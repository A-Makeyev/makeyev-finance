import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { LocaleShell } from '../LocaleShell'
import { GatedArea } from '@/features/auth/GatedArea'
import { getServerSession } from '@/server/auth/session'
import { roleSatisfies, toRole } from '@/server/auth/roles'
import { he } from '@/i18n/he'

export const metadata: Metadata = {
  title: he.translation.auth.advisorTitle,
}

/** Reads the request's session, so it is never prerendered at build time. */
export const dynamic = 'force-dynamic'

/**
 * Advisor-only area. The proxy already redirected cookie-less visitors; this
 * server check is the real gate (the proxy's cookie test is optimistic and
 * must never be the only guard).
 */
export default async function Page() {
  const session = await getServerSession()
  if (!session) redirect('/login?next=/advisor')

  const role = toRole((session.user as { role?: unknown }).role)
  if (!roleSatisfies(role, 'advisor')) redirect('/client')

  return (
    <LocaleShell>
      <GatedArea area="advisor" email={session.user.email} />
    </LocaleShell>
  )
}
