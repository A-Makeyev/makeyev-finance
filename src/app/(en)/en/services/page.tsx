import type { Metadata } from 'next'
import { LocaleShell } from '../LocaleShell'
import { ServicesPage } from '@/views/ServicesPage'
import { en } from '@/i18n/en'

export const metadata: Metadata = {
  title: en.translation.meta.servicesTitle,
}

export default function Page() {
  return (
    <LocaleShell>
      <ServicesPage />
    </LocaleShell>
  )
}
