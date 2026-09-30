import type { Metadata } from 'next'
import { LocaleShell } from '../LocaleShell'
import { ContactPage } from '@/features/contact/ContactPage'
import { he } from '@/i18n/he'

export const metadata: Metadata = {
  title: he.translation.meta.contactTitle,
}

export default function Page() {
  return (
    <LocaleShell>
      <ContactPage />
    </LocaleShell>
  )
}
