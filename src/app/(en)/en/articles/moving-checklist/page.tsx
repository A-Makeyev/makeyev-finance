import type { Metadata } from 'next'
import { LocaleShell } from '../../LocaleShell'
import { MovingChecklistArticlePage } from '@/views/MovingChecklistArticlePage'
import { en } from '@/i18n/en'

export const metadata: Metadata = {
  title: `${en.translation.articles.movingChecklist.title} - Makeyev Finance`,
  description: en.translation.meta.articlesMovingChecklistDescription,
}

export default function Page() {
  return (
    <LocaleShell>
      <MovingChecklistArticlePage />
    </LocaleShell>
  )
}
