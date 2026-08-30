import type { Language } from '@/i18n'

/**
 * Public-facing business details. These are intentionally NOT secrets - they
 * are displayed on the site (legacy src/index.js carried them as globals).
 */
export const SITE = {
  name: 'Makeyev Finance',
  phoneDisplay: '0527729974',
  emailMain: 'anatoly.makeyev@gmail.com',
  emailCompany: 'makeyev.finance@gmail.com',
  address: 'Florentin 23 Tel Aviv',
  facebookPage: 'https://www.facebook.com/makeyev.finance',
} as const

/** tel: deep link */
export const CALL_LINK = `tel:${SITE.phoneDisplay}`

/** mailto deep link (subject preserved verbatim from legacy source) */
export const MAIL_LINK = `mailto:${SITE.emailMain}?subject=${encodeURIComponent(
  'I need financial advice!',
)}`

/** WhatsApp deep link - legacy logic replaced the leading '0' with '972'. */
export const WHATSAPP_LINK = `https://wa.me/${SITE.phoneDisplay.replace(
  SITE.phoneDisplay.charAt(0),
  '972',
)}?text=${encodeURIComponent("What's up?")}`

/** Waze navigation deep link to the office place (verbatim from legacy). */
export const WAZE_LINK =
  'https://ul.waze.com/ul?place=ChIJp9fIOZ9MHRURg5L4vD_YK1c&ll=32.05632250%2C34.76931260&navigate=yes&utm_campaign=default&utm_source=waze_website&utm_medium=lm_share_location'

/** Google Maps embed for the office address (verbatim from legacy). */
export const GOOGLE_MAPS_EMBED =
  'https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d27051.822489683218!2d34.76055827048644!3d32.05632299999998!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x151d4c9f39c8d7a7%3A0x572bd83fbcf89283!2sFlorentin%20St%2023%2C%20Tel%20Aviv-Yafo!5e0!3m2!1sen!2sil!4v1662889337932!5m2!1sen!2sil'

/** Legacy built a language-specific Waze live-map iframe (`wazeMap`) that was
 * never rendered anywhere - dropped as dead config (see migration checklist). */

export function socialLinks(lang: Language) {
  return {
    facebook: SITE.facebookPage,
    envelope: MAIL_LINK,
    waze: WAZE_LINK,
    whatsapp: WHATSAPP_LINK,
    phone: CALL_LINK,
    /** lang param kept for parity with legacy language-aware builders */
    _lang: lang,
  } as const
}
