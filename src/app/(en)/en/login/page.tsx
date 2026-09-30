import type { Metadata } from 'next'
import { LocaleShell } from '../LocaleShell'
import { AuthPage } from '@/features/auth/AuthPage'
import { en } from '@/i18n/en'

export const metadata: Metadata = {
  title: en.translation.auth.pageTitle,
}

export default function Page() {
  return (
    <LocaleShell>
      <AuthPage />
    </LocaleShell>
  )
}
