import type { Metadata } from 'next'
import { LocaleShell } from '../LocaleShell'
import { AuthPage } from '@/features/auth/AuthPage'
import { he } from '@/i18n/he'

export const metadata: Metadata = {
  title: he.translation.auth.pageTitle,
}

export default function Page() {
  return (
    <LocaleShell>
      <AuthPage />
    </LocaleShell>
  )
}
