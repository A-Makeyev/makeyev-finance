import type { Metadata } from 'next'
import { LocaleShell } from './LocaleShell'
import { HomePage } from '@/views/HomePage'
import { en } from '@/i18n/en'

export const metadata: Metadata = {
  title: en.translation.meta.homeTitle,
  description: en.translation.meta.homeDescription,
}

export default function Page() {
  return (
    <LocaleShell>
      <HomePage />
    </LocaleShell>
  )
}
