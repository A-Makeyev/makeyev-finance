import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { LocaleShell } from '../LocaleShell'
import { GatedArea } from '@/features/auth/GatedArea'
import { getServerSession } from '@/server/auth/session'
import { roleSatisfies, toRole } from '@/server/auth/roles'
import { en } from '@/i18n/en'

export const metadata: Metadata = {
  title: en.translation.auth.advisorTitle,
}

/** Reads the request's session, so it is never prerendered at build time. */
export const dynamic = 'force-dynamic'

/** Advisor-only area (English mirror). Real gate: the server-side role check. */
export default async function Page() {
  const session = await getServerSession()
  if (!session) redirect('/en/login?next=/advisor')

  const role = toRole((session.user as { role?: unknown }).role)
  if (!roleSatisfies(role, 'advisor')) redirect('/en/client')

  return (
    <LocaleShell>
      <GatedArea area="advisor" email={session.user.email} />
    </LocaleShell>
  )
}
