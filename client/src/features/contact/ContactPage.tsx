import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FaMapMarkerAlt, FaRegEnvelope, FaWhatsapp } from 'react-icons/fa'
import { GOOGLE_MAPS_EMBED, MAIL_LINK, SITE, WAZE_LINK } from '@/config/siteConfig'
import {
  ContactForm,
  type ContactSubmitOutcome,
} from './ContactForm'
import { MessageModal, type MessageModalState } from './MessageModal'

export function ContactPage() {
  const { t } = useTranslation()
  const [message, setMessage] = useState<MessageModalState | null>(null)
  const [firstName, setFirstName] = useState<string>()
  const resetRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    document.title = t('meta.contactTitle')
  }, [t])

  useEffect(() => {
    const script = document.createElement('script')
    script.async = true
    script.defer = true
    script.crossOrigin = 'anonymous'
    script.src = 'https://connect.facebook.net/en_GB/sdk.js#xfbml=1&version=v13.0'
    document.body.appendChild(script)
    return () => {
      script.remove()
    }
  }, [])

  const handleOutcome = (result: ContactSubmitOutcome) => {
    setFirstName(result.name)
    window.setTimeout(() => {
      setMessage({ status: result.status, detail: result.detail })
      document.body.style.cursor = ''
    }, 150)
  }

  const closeMessage = () => {
    setMessage(null)
    if (window.navigator.onLine) resetRef.current?.()
  }

  return (
    <>
      <section className="sub-header contact-sub-header">
        <div className="text-box">
          <h1 className="gradient-text-no-hover whitespace-nowrap">{t('contact.headerTitle')}</h1>
        </div>
      </section>

      <section className="w-[80%] mx-auto pt-12 pb-14">
        {/* Form header */}
        <div className="flex flex-col items-center mb-10">
          <h1 className="text-[1.8em] sm:text-[2.1em] lg:text-[2.6em] text-center font-bold text-soft-black leading-tight">
            {t('contact.formTitle')}
          </h1>
          <p className="mt-2 text-[16px] sm:text-[18px] lg:text-[22px] text-center text-soft-blue whitespace-pre-line">
            {t('contact.formSubtitle')}
          </p>
        </div>

        {/* Two-column layout: form + contact info */}
        <div className="flex justify-between gap-10 max-lg:flex-col max-lg:gap-8">
          {/* Left: Form */}
          <div className="flex-1 min-w-0">
            <ContactForm
              variant="main"
              onOutcome={handleOutcome}
              registerReset={(fn) => (resetRef.current = fn)}
            />
          </div>

          {/* Divider */}
          <div className="w-px bg-soft-grey max-lg:w-full max-lg:h-px max-lg:my-6" />

          {/* Right: Contact info — nudged down a bit to sit alongside the form */}
          <div className="flex-1 min-w-0 lg:ml-14 lg:mt-8">
            {/* WhatsApp */}
            <div className="flex items-center gap-3 mb-10">
              <FaWhatsapp
                aria-hidden="true"
                className="text-soft-black text-[20px] font-semibold"
              />
              <a
                href={`https://wa.me/972${SITE.phoneDisplay.slice(1)}`}
                target="_blank"
                rel="noreferrer"
                data-testid="main-phone"
                className="group"
              >
                <span className="relative">
                  <p className="text-[20px] font-medium text-soft-black transition-colors group-hover:text-soft-blue">
                    {SITE.phoneDisplay}
                  </p>
                  <span className="block h-[2px] w-0 bg-soft-grey transition-all duration-300 group-hover:w-full" />
                </span>
              </a>
            </div>

            {/* Email */}
            <div className="flex items-center gap-3 mb-10">
              <FaRegEnvelope
                aria-hidden="true"
                className="text-soft-black text-[20px] font-semibold"
              />
              <a href={MAIL_LINK} target="_blank" rel="noreferrer" data-testid="main-email" className="group">
                <span className="relative">
                  <p className="text-[20px] font-medium text-soft-black transition-colors group-hover:text-soft-blue">
                    {SITE.emailMain}
                  </p>
                  <span className="block h-[2px] w-0 bg-soft-grey transition-all duration-300 group-hover:w-full" />
                </span>
              </a>
            </div>

            {/* Address */}
            <div className="flex items-center gap-3 mb-10">
              <FaMapMarkerAlt
                aria-hidden="true"
                className="text-soft-black text-[20px] font-semibold"
              />
              <a href={WAZE_LINK} target="_blank" rel="noreferrer" data-testid="main-address" className="group">
                <span className="relative">
                  <p className="text-[20px] font-medium text-soft-black transition-colors group-hover:text-soft-blue">
                    {SITE.address}
                  </p>
                  <span className="block h-[2px] w-0 bg-soft-grey transition-all duration-300 group-hover:w-full" />
                </span>
              </a>
            </div>

            {/* Facebook embed */}
            <div id="fb-root" />
            <div
              className="fb-page mt-[-50px] ml-[30px]"
              data-href={SITE.facebookPage}
              data-tabs="timeline"
              data-width="315"
              data-height="235"
              data-small-header="true"
              data-adapt-container-width="true"
              data-hide-cover="false"
              data-show-facepile="true"
            />
          </div>
        </div>
      </section>

      <section className="w-[80%] mx-auto pt-10 pb-24">
        <div className="relative">
          <iframe
            id="map"
            title="map"
            width="600"
            height="600"
            loading="lazy"
            allowFullScreen
            src={GOOGLE_MAPS_EMBED}
            data-testid="map-iframe"
            className="w-full rounded-[5px] shadow-black border border-soft-black"
          />
        </div>
      </section>

      <MessageModal
        state={message}
        firstName={firstName}
        linksVariant="pages"
        onClose={closeMessage}
      />
    </>
  )
}
