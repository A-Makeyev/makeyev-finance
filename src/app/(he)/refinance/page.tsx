import type { Metadata } from 'next'
import { LocaleShell } from '../LocaleShell'
import { RefinancePage } from '@/features/refinance/RefinancePage'
import { he } from '@/i18n/he'

export const metadata: Metadata = {
  title: he.translation.refinance.metaTitle,
  description: he.translation.refinance.intro,
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ refinance?: string | string[] }>
}) {
  const query = await searchParams
  const refinanceId = typeof query.refinance === 'string' ? query.refinance : undefined
  return (
    <LocaleShell>
      <RefinancePage initialRefinanceId={refinanceId} />
    </LocaleShell>
  )
}
