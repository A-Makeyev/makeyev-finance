import type { Metadata } from 'next'
import { LocaleShell } from '../../LocaleShell'
import { TrackTypesArticlePage } from '@/views/TrackTypesArticlePage'
import { he } from '@/i18n/he'

export const metadata: Metadata = {
  title: `${he.translation.articles.trackTypes.title} - Makeyev Finance`,
  description: he.translation.meta.articlesTrackTypesDescription,
}

export default function Page() {
  return (
    <LocaleShell>
      <TrackTypesArticlePage />
    </LocaleShell>
  )
}
