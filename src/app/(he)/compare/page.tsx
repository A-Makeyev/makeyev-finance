import type { Metadata } from 'next'
import { LocaleShell } from '../LocaleShell'
import { ComparePage } from '@/features/compare/ComparePage'
import { he } from '@/i18n/he'

export const metadata: Metadata = {
  title: he.translation.compare.metaTitle,
}

export default function Page() {
  return (
    <LocaleShell>
      <ComparePage />
    </LocaleShell>
  )
}
