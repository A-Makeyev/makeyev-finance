import type { Metadata } from 'next'
import { LocaleShell } from '../../LocaleShell'
import { PrepaymentPenaltyArticlePage } from '@/views/PrepaymentPenaltyArticlePage'
import { he } from '@/i18n/he'

export const metadata: Metadata = {
  title: he.translation.meta.articlesTitle.replace('מאמרים', he.translation.articles.prepayment.title),
  description: he.translation.meta.articlesPrepaymentDescription,
}

export default function Page() {
  return (
    <LocaleShell>
      <PrepaymentPenaltyArticlePage />
    </LocaleShell>
  )
}
