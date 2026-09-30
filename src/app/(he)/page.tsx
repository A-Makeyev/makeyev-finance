import type { Metadata } from 'next'
import { LocaleShell } from './LocaleShell'
import { HomePage } from '@/views/HomePage'
import { he } from '@/i18n/he'

export const metadata: Metadata = {
  title: he.translation.meta.homeTitle,
  description: he.translation.meta.homeDescription,
}

export default function Page() {
  return (
    <LocaleShell>
      <HomePage />
    </LocaleShell>
  )
}
