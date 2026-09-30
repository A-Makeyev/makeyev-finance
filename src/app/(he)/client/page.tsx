import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { LocaleShell } from '../LocaleShell'
import { GatedArea } from '@/features/auth/GatedArea'
import { getServerSession } from '@/server/auth/session'
import { he } from '@/i18n/he'

export const metadata: Metadata = {
  title: he.translation.auth.clientTitle,
}

/** Reads the request's session, so it is never prerendered at build time. */
export const dynamic = 'force-dynamic'

/** Signed-in area: any authenticated user, regardless of role. */
export default async function Page() {
  const session = await getServerSession()
  if (!session) redirect('/login?next=/client')

  return (
    <LocaleShell>
      <GatedArea area="client" email={session.user.email} />
    </LocaleShell>
  )
}
