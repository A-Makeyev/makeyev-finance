import { useTranslation } from 'react-i18next'
import { FaInfoCircle } from 'react-icons/fa'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'

/** Fixed red bottom banner shown while offline (legacy navigation.js:30-45). */
export function OfflineBanner() {
  const { t, i18n } = useTranslation()
  const isRtl = i18n.language.startsWith('he')
  const online = useOnlineStatus()
  return (
    <div
      id="offline"
      role="status"
      data-testid="offline-banner"
      className={online ? '' : 'visible'}
    >
      <div className="offline-content" dir={isRtl ? 'rtl' : 'ltr'}>
        <FaInfoCircle aria-hidden="true" />
        <span>{t('offlineBanner')}</span>
      </div>
    </div>
  )
}
