import type { Metadata } from 'next'
import { LocaleShell } from '../LocaleShell'
import { RefinancePage } from '@/features/refinance/RefinancePage'
import { he } from '@/i18n/he'

export const metadata: Metadata = {
  title: he.translation.refinance.metaTitle,
  description: he.translation.refinance.intro,
}

export default function Page() {
  return (
    <LocaleShell>
      <RefinancePage />
    </LocaleShell>
  )
}
