import type { Metadata } from 'next'
import { LocaleShell } from '../LocaleShell'
import { RefinancePage } from '@/features/refinance/RefinancePage'
import { en } from '@/i18n/en'

export const metadata: Metadata = {
  title: en.translation.refinance.metaTitle,
  description: en.translation.refinance.intro,
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
