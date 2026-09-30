import type { Metadata } from 'next'
import { LocaleShell } from '../LocaleShell'
import { CalculatorPage } from '@/features/calculator/CalculatorPage'
import { he } from '@/i18n/he'

export const metadata: Metadata = {
  title: he.translation.meta.calculatorsTitle,
}

export default function Page() {
  return (
    <LocaleShell>
      <CalculatorPage />
    </LocaleShell>
  )
}
