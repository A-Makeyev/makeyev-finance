import type { Metadata } from 'next'
import { LocaleShell } from '../../LocaleShell'
import { PrepaymentPenaltyArticlePage } from '@/views/PrepaymentPenaltyArticlePage'
import { en } from '@/i18n/en'

export const metadata: Metadata = {
  title: `${en.translation.articles.prepayment.title} - Makeyev Finance`,
  description: en.translation.meta.articlesPrepaymentDescription,
}

export default function Page() {
  return (
    <LocaleShell>
      <PrepaymentPenaltyArticlePage />
    </LocaleShell>
  )
}
