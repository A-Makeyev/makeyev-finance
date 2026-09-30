import type { Metadata } from 'next'
import { LocaleShell } from '../../LocaleShell'
import { MortgageDecisionsArticlePage } from '@/views/MortgageDecisionsArticlePage'
import { en } from '@/i18n/en'

export const metadata: Metadata = {
  title: `${en.translation.articles.mortgageDecisions.title} - Makeyev Finance`,
  description: en.translation.meta.articlesMortgageDecisionsDescription,
}

export default function Page() {
  return (
    <LocaleShell>
      <MortgageDecisionsArticlePage />
    </LocaleShell>
  )
}
