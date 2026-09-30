'use client'

import { useTranslation } from 'react-i18next'
import { FaInfoCircle } from 'react-icons/fa'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { directionFor, type Language } from '@/i18n'

/**
 * Fixed red bottom banner shown while offline (legacy navigation.js:30-45).
 *
 * Direction follows the active LANGUAGE, not the URL: the router adapter's
 * usePathname() reports the locale-STRIPPED path ("/login" for /en/login), so
 * testing it for an /en prefix could never match and the banner stayed RTL on
 * the English pages. The i18n instance is the source of truth the navbar
 * already uses for the same decision.
 */
export function OfflineBanner() {
  const { t, i18n } = useTranslation()
  const language: Language = i18n.language.startsWith('he') ? 'hebrew' : 'english'
  const online = useOnlineStatus()
  return (
    <div
      id="offline"
      role="status"
      data-testid="offline-banner"
      className={online ? '' : 'visible'}
    >
      <div className="offline-content" dir={directionFor(language)}>
        <FaInfoCircle aria-hidden="true" />
        <span>{t('offlineBanner')}</span>
      </div>
    </div>
  )
}
