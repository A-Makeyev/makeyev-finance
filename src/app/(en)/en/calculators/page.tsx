import type { Metadata } from 'next'
import { LocaleShell } from '../LocaleShell'
import { CalculatorPage } from '@/features/calculator/CalculatorPage'
import { en } from '@/i18n/en'

export const metadata: Metadata = {
  title: en.translation.meta.calculatorsTitle,
}

export default function Page() {
  return (
    <LocaleShell>
      <CalculatorPage />
    </LocaleShell>
  )
}
