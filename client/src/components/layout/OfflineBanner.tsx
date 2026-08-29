import { useTranslation } from 'react-i18next'
import { FaExclamationCircle } from 'react-icons/fa'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'

/** Fixed red bottom banner shown while offline (legacy navigation.js:30-45). */
export function OfflineBanner() {
  const { t } = useTranslation()
  const online = useOnlineStatus()
  return (
    <div
      id="offline"
      role="status"
      data-testid="offline-banner"
      className={online ? '' : 'visible'}
    >
      <FaExclamationCircle aria-hidden="true" />
      <span style={{ marginLeft: '5px' }}>{t('offlineBanner')}</span>
    </div>
  )
}
