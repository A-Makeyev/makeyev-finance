import type { Metadata } from 'next'
import { LocaleShell } from '../../LocaleShell'
import { TrackTypesArticlePage } from '@/views/TrackTypesArticlePage'
import { en } from '@/i18n/en'

export const metadata: Metadata = {
  title: `${en.translation.articles.trackTypes.title} - Makeyev Finance`,
  description: en.translation.meta.articlesTrackTypesDescription,
}

export default function Page() {
  return (
    <LocaleShell>
      <TrackTypesArticlePage />
    </LocaleShell>
  )
}
