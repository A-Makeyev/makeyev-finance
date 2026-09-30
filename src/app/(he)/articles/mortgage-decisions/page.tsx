import type { Metadata } from 'next'
import { LocaleShell } from '../../LocaleShell'
import { MortgageDecisionsArticlePage } from '@/views/MortgageDecisionsArticlePage'
import { he } from '@/i18n/he'

export const metadata: Metadata = {
  title: `${he.translation.articles.mortgageDecisions.title} - Makeyev Finance`,
  description: he.translation.meta.articlesMortgageDecisionsDescription,
}

export default function Page() {
  return (
    <LocaleShell>
      <MortgageDecisionsArticlePage />
    </LocaleShell>
  )
}
