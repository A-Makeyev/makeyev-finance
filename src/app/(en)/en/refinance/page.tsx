import type { Metadata } from 'next'
import { LocaleShell } from '../LocaleShell'
import { RefinancePage } from '@/features/refinance/RefinancePage'
import { en } from '@/i18n/en'

export const metadata: Metadata = {
  title: en.translation.refinance.metaTitle,
  description: en.translation.refinance.intro,
}

export default function Page() {
  return (
    <LocaleShell>
      <RefinancePage />
    </LocaleShell>
  )
}
