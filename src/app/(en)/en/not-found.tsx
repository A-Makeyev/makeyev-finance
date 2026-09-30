import { LocaleShell } from './LocaleShell'
import { HomePage } from '@/views/HomePage'

/**
 * Legacy parity: the SPA's catch-all route rendered the home page for any
 * unknown URL. Next's notFound renders this instead - same content, correct
 * 404 status for crawlers (the SPA returned 200).
 */
export default function NotFound() {
  return (
    <LocaleShell>
      <HomePage />
    </LocaleShell>
  )
}
