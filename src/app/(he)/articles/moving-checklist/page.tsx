import type { Metadata } from 'next'
import { LocaleShell } from '../../LocaleShell'
import { MovingChecklistArticlePage } from '@/views/MovingChecklistArticlePage'
import { he } from '@/i18n/he'

export const metadata: Metadata = {
  title: `${he.translation.articles.movingChecklist.title} - Makeyev Finance`,
  description: he.translation.meta.articlesMovingChecklistDescription,
}

export default function Page() {
  return (
    <LocaleShell>
      <MovingChecklistArticlePage />
    </LocaleShell>
  )
}
