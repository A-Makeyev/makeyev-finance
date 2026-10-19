import type { Metadata } from 'next'
import { LocaleShell } from '../LocaleShell'
import { AverageRatesPage } from '@/features/rates/AverageRatesPage'
import { he } from '@/i18n/he'

export const metadata: Metadata = {
  title: he.translation.meta.ratesTitle,
  description: he.translation.meta.ratesDescription,
}

export default function Page() {
  return (
    <LocaleShell>
      <AverageRatesPage />
    </LocaleShell>
  )
}
