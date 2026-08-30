import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { SocialLinks } from '@/components/layout/Footer'
import { SITE } from '@/config/siteConfig'
import { cn } from '@/lib/cn'

export interface MessageModalState {
  status: 'success' | 'failure'
  /** Extra detail line rendered under a divider (offline/API/device messages). */
  detail?: string
}

export interface MessageModalProps {
  state: MessageModalState | null
  /** First name extracted from the submitted form value. */
  firstName?: string
  /** Legacy index.html showed social icons; contact.html showed page links. */
  linksVariant?: 'social' | 'pages'
  onClose: () => void
}

/**
 * Success/failure status modal - Tailwind-styled with backdrop blur,
 * per-status accent theming, first-name greeting and detail block.
 */
export function MessageModal({
  state,
  firstName,
  linksVariant = 'social',
  onClose,
}: MessageModalProps) {
  const { t, i18n } = useTranslation()
  const active = state !== null
  const success = state?.status === 'success'

  useEffect(() => {
    if (!active) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.body.addEventListener('keydown', onKey)
    return () => document.body.removeEventListener('keydown', onKey)
  }, [active, onClose])

  const accent = success ? 'rgb(35, 185, 55)' : 'rgb(210, 60, 60)'
  const isHebrew = i18n.language.startsWith('he')

  return (
    <>
      {/* Overlay */}
      <div
        className={cn(
          'fixed inset-0 z-[999] bg-black/50 backdrop-blur-[5px] transition-opacity duration-300',
          active ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        )}
        onClick={onClose}
        data-testid="message-modal-overlay"
      />

      {/* Modal */}
      <div
        className={cn(
          // Legacy spin-in: the modal scales up while rotating a full turn
          // (`.modal.active { transform: ... scale(1) rotate(360deg) }`).
          // Legacy `transition: all 0.5s` - spins AND fades on both open and
          // close; legacy default `ease` curve keeps it smooth in each dir.
          'fixed left-1/2 top-1/2 z-[9999] w-[520px] max-w-[92vw] -translate-x-1/2 -translate-y-1/2 rounded-2xl border-2 bg-soft-white shadow-[0_8px_22px_0_rgba(15,15,15,0.5)] transition-all duration-500 ease-[cubic-bezier(0.25,0.1,0.25,1)]',
          // Border matches the header accent: green on success, red on failure.
          success ? 'border-soft-green' : 'border-soft-red',
          active
            ? 'pointer-events-auto opacity-100 scale-100 rotate-0'
            : 'pointer-events-none opacity-0 scale-0 -rotate-[360deg]',
        )}
        data-testid="message-modal"
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-3.5 capitalize"
          style={{
            borderBottom: `2px solid ${accent}`,
            flexDirection: isHebrew ? 'row-reverse' : 'row',
            textAlign: isHebrew ? 'right' : 'left',
          }}
        >
          <div>
            <h2
              data-testid="modal-title"
              className="text-[1.5em] font-bold"
              style={{ color: accent }}
            >
              {success ? t('contact.modal.successTitle') : t('contact.modal.failureTitle')}
            </h2>
          </div>
          <button
            type="button"
            className="flex items-center justify-center w-[38px] h-[38px] rounded-full text-[28px] font-semibold text-soft-black bg-transparent border-none cursor-pointer outline-none transition-[transform,color] duration-300 hover:rotate-90 hover:text-soft-red"
            data-modal-close
            data-testid="message-modal-close"
            aria-label="close"
            onClick={onClose}
          >
            &#215;
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-0.5 px-7 pt-5 pb-4">
          {success && (
            <p
              id="modal-user"
              data-testid="modal-user"
              className="text-center text-[1.2em] font-semibold leading-relaxed break-words"
            >
              {t('contact.modal.successUser', { name: firstName })}
            </p>
          )}
          <p data-testid="modal-body" className="text-center text-[19px] leading-relaxed">
            {success ? (
              t('contact.modal.successBody')
            ) : isHebrew ? (
              <>
                {t('contact.modal.failureBodyPrefix')}{' '}
                <a
                  href={`tel:${SITE.phoneDisplay}`}
                  className="text-[19px] font-semibold text-soft-black hover:text-soft-blue transition-colors"
                >
                  {SITE.phoneDisplay}
                </a>{' '}
                {t('contact.modal.failureBodySuffix')}
              </>
            ) : (
              <>
                {t('contact.modal.failureBodyPrefix')} ~ {SITE.phoneDisplay}
              </>
            )}
          </p>

          {state?.detail && (
            <div
              className="mt-3 pt-3"
              style={{ borderTop: `2px solid ${accent}` }}
            >
              <p
                data-testid="modal-detail"
                className="text-center text-[15px] font-medium mb-1.5"
                style={{ color: accent }}
              >
                {state.detail}
              </p>
            </div>
          )}
        </div>

        {/* Links */}
        <div
          className={cn(
            // `modal-links` restores the legacy white-on-black socials styling
            // (`.modal-links .socials { background: var(--soft-white) }`).
            'modal-links -mt-5 flex justify-center flex-wrap gap-3 px-6 pt-1 pb-4',
            success ? 'flex' : 'hidden',
          )}
        >
          {linksVariant === 'social' ? (
            <SocialLinks variant="modal" />
          ) : (
            <span className="flex justify-center flex-wrap gap-3">
              {[
                { to: '/', label: t('contact.modal.backHome') },
                { to: '/services', label: t('contact.modal.ourServices') },
                { to: '/articles', label: t('contact.modal.articles') },
              ].map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={onClose}
                  className="hero-btn btn-black remove-highlight !m-0 !px-5 !py-2.5 !text-[14px] !font-semibold !rounded-lg"
                >
                  {item.label}
                </Link>
              ))}
            </span>
          )}
        </div>
      </div>
    </>
  )
}
