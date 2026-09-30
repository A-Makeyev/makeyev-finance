import type { Metadata } from 'next'
import { LocaleShell } from '../LocaleShell'
import { ArticlesPage } from '@/views/ArticlesPage'
import { he } from '@/i18n/he'

export const metadata: Metadata = {
  title: he.translation.meta.articlesTitle,
  description: he.translation.meta.articlesDescription,
}

export default function Page() {
  return (
    <LocaleShell>
      <ArticlesPage />
    </LocaleShell>
  )
}
