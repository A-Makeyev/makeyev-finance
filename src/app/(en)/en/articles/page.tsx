import type { Metadata } from 'next'
import { LocaleShell } from '../LocaleShell'
import { ArticlesPage } from '@/views/ArticlesPage'
import { en } from '@/i18n/en'

export const metadata: Metadata = {
  title: en.translation.meta.articlesTitle,
  description: en.translation.meta.articlesDescription,
}

export default function Page() {
  return (
    <LocaleShell>
      <ArticlesPage />
    </LocaleShell>
  )
}
