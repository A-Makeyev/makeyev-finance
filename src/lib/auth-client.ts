import { createAuthClient } from 'better-auth/react'
import { emailOTPClient } from 'better-auth/client/plugins'
import { DEFAULT_LANGUAGE, LOCALES, resolveStoredLanguage, type Language } from '@/i18n'

/**
 * The language the app is currently rendering in.
 *
 * Emails triggered by an auth request (verify the address, reset the password,
 * confirm deleting the account) must be in the language the user is looking at,
 * not whatever their BROWSER advertised in Accept-Language: a Hebrew user on an
 * English-locale browser was getting English mail, and the account-deletion link
 * itself pointed at the English profile page.
 *
 * The URL is the source of truth: locale is structural here (`/en/...` is
 * English, everything unprefixed is Hebrew), so it agrees with what the user
 * is looking at without waiting for the document to hydrate. The document's
 * `lang` and the stored choice are fallbacks for the rare call made outside a
 * page (a test harness, the first frame of a load).
 */
function activeLanguage(): Language {
  if (typeof window !== 'undefined') {
    const path = window.location.pathname
    return path === '/en' || path.startsWith('/en/') ? 'english' : 'hebrew'
  }
  if (typeof document !== 'undefined') {
    if (document.documentElement.lang === 'en') return 'english'
    if (document.documentElement.lang === 'he') return 'hebrew'
  }
  return resolveStoredLanguage() ?? DEFAULT_LANGUAGE
}

/**
 * Browser auth client. No baseURL: it defaults to the current origin, so the
 * same bundle works for localhost, previews and production without another
 * environment variable.
 *
 * Every request carries the active app language as Accept-Language. That is the
 * one signal the server's email senders read (see src/server/auth/email.ts), so
 * it fixes both the mail's language AND the locale of any link it contains -
 * Better Auth is not asked for a locale, the senders derive it from this header.
 *
 * The emailOTP client plugin mirrors the server plugin in src/server/auth, so
 * the password-reset calls (`emailOtp.requestPasswordReset` /
 * `emailOtp.resetPassword`) exist and are typed. Only public client methods
 * (signIn, signUp, signOut, useSession, emailOtp) are used; nothing here holds
 * a secret.
 */
export const authClient = createAuthClient({
  plugins: [emailOTPClient()],
  fetchOptions: {
    onRequest(context) {
      context.headers.set('Accept-Language', LOCALES[activeLanguage()])
    },
  },
})
