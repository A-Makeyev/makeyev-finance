import type { Metadata } from 'next'
import { LocaleShell } from '../LocaleShell'
import { AverageRatesPage } from '@/features/rates/AverageRatesPage'
import { en } from '@/i18n/en'

export const metadata: Metadata = {
  title: en.translation.meta.ratesTitle,
  description: en.translation.meta.ratesDescription,
}

export default function Page() {
  return (
    <LocaleShell>
      <AverageRatesPage />
    </LocaleShell>
  )
}
