import type { Metadata } from 'next'
import { LocaleShell } from '../LocaleShell'
import { ComparePage } from '@/features/compare/ComparePage'
import { en } from '@/i18n/en'

export const metadata: Metadata = {
  title: en.translation.compare.metaTitle,
}

export default function Page() {
  return (
    <LocaleShell>
      <ComparePage />
    </LocaleShell>
  )
}
