import type { Metadata } from 'next'
import { LocaleShell } from '../LocaleShell'
import { ServicesPage } from '@/views/ServicesPage'
import { he } from '@/i18n/he'

export const metadata: Metadata = {
  title: he.translation.meta.servicesTitle,
}

export default function Page() {
  return (
    <LocaleShell>
      <ServicesPage />
    </LocaleShell>
  )
}
