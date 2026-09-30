import type { Metadata } from 'next'
import { LocaleShell } from '../LocaleShell'
import { ContactPage } from '@/features/contact/ContactPage'
import { en } from '@/i18n/en'

export const metadata: Metadata = {
  title: en.translation.meta.contactTitle,
}

export default function Page() {
  return (
    <LocaleShell>
      <ContactPage />
    </LocaleShell>
  )
}
