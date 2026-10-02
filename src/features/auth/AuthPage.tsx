'use client'

import { useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { FaGoogle, FaSpinner } from 'react-icons/fa'
import { authClient } from '@/lib/auth-client'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { useRouter } from '@/router'
import { applyOtpInput, emptyOtpSlots, OTP_LENGTH } from './otp'

/**
 * Sign in / register form, shared by both locale route segments.
 *
 * All copy goes through i18n (auth.* keys exist in he.ts and en.ts), and the
 * markup uses logical utilities (text-start / ms- / me-) plus dir="ltr" on the
 * credential inputs, so it stays correct if the document is ever rendered RTL
 * rather than needing a hand-written override per direction.
 *
 * The `?next=` target is read from window.location at submit time rather than
 * via useSearchParams, which would force a Suspense boundary around this
 * statically rendered page.
 */

type Mode = 'signin' | 'signup'
type Flow = 'credentials' | 'forgot' | 'reset'
type ResendState = 'idle' | 'sending' | 'sent'

const INPUT_CLASS =
  // text-start (not a hard direction): every field inherits the page's
  // direction, so typed text begins at the page's start edge - right in
  // Hebrew, left in English. No `dir` override on these inputs for the same
  // reason: forcing LTR made Hebrew typing start at the wrong edge.
  'w-full rounded-lg border border-line-strong bg-surface-page px-3 py-2 text-start text-ink outline-none transition-colors hover:border-ink focus:border-ink'

/** Shared keyboard ring: the site's blue over the card, never the UA outline. */
const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-soft-blue focus-visible:ring-offset-2 focus-visible:ring-offset-surface-card'

/**
 * One square of the 4-digit reset code: big centered digit, themed field.
 *
 * No `maxLength`: the box has to be able to receive a whole code in one change
 * event (a paste, or the OS one-time-code autofill) so the digits can spread
 * across the other boxes. A `maxLength={1}` clips that string to its first
 * digit before React ever sees it.
 */
const OTP_INPUT_CLASS =
  'h-12 w-12 rounded-lg border border-line-strong bg-surface-page text-center text-xl font-semibold text-ink outline-none transition-colors hover:border-ink focus:border-ink focus-visible:ring-2 focus-visible:ring-soft-blue'

/** Providers this deployment has credentials for (see next.config.ts). */
const ENABLED_SOCIAL_PROVIDERS = (process.env.AUTH_SOCIAL_PROVIDERS ?? '')
  .split(',')
  .filter(Boolean) as Array<'google'>

export function AuthPage() {
  const { t } = useTranslation()
  const router = useRouter()

  const [mode, setMode] = useState<Mode>('signin')
  // The page's current flow: the credential form, the "send me a code" step
  // of the password reset, or the "code + new password" step.
  const [flow, setFlow] = useState<Flow>('credentials')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  // One slot per square (not a plain string): a box left untouched must stay
  // empty instead of collapsing into its neighbour on the next edit.
  const [otp, setOtp] = useState<string[]>(emptyOtpSlots)
  // One ref per square input, so typing can auto-advance focus to the next
  // box (and backspace can fall back to the previous one).
  const otpRefs = useRef<Array<HTMLInputElement | null>>([])
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  // Set when a sign-up succeeded but the server did not sign the user in (a
  // verification mail went out): the form is replaced by the confirmation
  // state, which needs the address for the resend action.
  const [verifyEmail, setVerifyEmail] = useState<string | null>(null)
  const [resend, setResend] = useState<ResendState>('idle')
  // Set once the reset code has been requested; the reset step needs it.
  const [resetSent, setResetSent] = useState(false)

  const isSignUp = mode === 'signup'

  /** Maps a Better Auth error code to a localized message. */
  function describeError(code: string | undefined): string {
    switch (code) {
      case 'INVALID_EMAIL_OR_PASSWORD':
        return t('auth.errorInvalidCredentials')
      case 'EMAIL_NOT_VERIFIED':
        return t('auth.verifyRequired')
      case 'USER_ALREADY_EXISTS':
      case 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL':
        return t('auth.errorEmailInUse')
      case 'PASSWORD_TOO_SHORT':
        return t('auth.errorPasswordLength')
      case 'INVALID_OTP':
      case 'OTP_EXPIRED':
        return t('auth.resetInvalidCode')
      case 'TOO_MANY_ATTEMPTS':
        return t('auth.resetTooManyAttempts')
      case 'FAILED_TO_CREATE_USER':
      case 'FAILED_TO_CREATE_SESSION':
        return t('auth.errorGeneric')
      default:
        return t('auth.errorGeneric')
    }
  }

  /** The `?next=` target set by the gate, defaulting to the home page. */
  function nextTarget(): string {
    return new URLSearchParams(window.location.search).get('next') ?? '/'
  }

  function switchMode(next: Mode) {
    setMode(next)
    setFlow('credentials')
    setError(null)
  }

  function switchFlow(next: Flow) {
    setFlow(next)
    setError(null)
    if (next === 'forgot') {
      setPassword('')
      setOtp(emptyOtpSlots())
    }
    if (next === 'credentials') {
      setResetSent(false)
      setOtp(emptyOtpSlots())
    }
  }

  /**
   * The four square code inputs share one value. The editing rules (which box
   * a change belongs to, what a paste or autofill does, digits only) live in
   * ./otp where they are unit tested; this only applies them and moves focus.
   */
  function onOtpChange(index: number, raw: string) {
    const edit = applyOtpInput(otp, index, raw)
    setOtp(edit.slots)
    otpRefs.current[edit.focusIndex]?.focus()
  }

  /** Backspace on an empty box moves focus to the previous one. */
  function onOtpKeyDown(index: number, event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Backspace' && !otp[index]) {
      otpRefs.current[Math.max(index - 1, 0)]?.focus()
    }
    // Arrow keys walk the boxes, the way a spread code field should.
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      otpRefs.current[Math.max(index - 1, 0)]?.focus()
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      otpRefs.current[Math.min(index + 1, OTP_LENGTH - 1)]?.focus()
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (isSignUp && password !== confirm) {
      setError(t('auth.passwordMismatch'))
      return
    }
    if (isSignUp && password.length < 8) {
      setError(t('auth.errorPasswordLength'))
      return
    }

    setPending(true)
    try {
      if (isSignUp) {
        const { data, error: signUpError } = await authClient.signUp.email({ name, email, password })
        if (signUpError) {
          setError(describeError(signUpError.code))
          return
        }
        // Verification is only required when the server can actually send mail
        // (see src/server/auth), so two things can happen here: with a session
        // the new account is already signed in and continues exactly like
        // sign-in; without one a verification mail went out, and the form is
        // replaced by the confirmation state instead of silently resetting.
        if (data?.token) {
          router.push(nextTarget())
          return
        }
        setVerifyEmail(email)
        setResend('idle')
        setPassword('')
        setConfirm('')
      } else {
        const { error: signInError } = await authClient.signIn.email({ email, password })
        if (signInError) {
          setError(describeError(signInError.code))
          return
        }
        router.push(nextTarget())
      }
    } finally {
      setPending(false)
    }
  }

  /**
   * Step 1 of the reset flow: ask for the 4-digit code mail. The server
   * answers "success" whether or not the address exists (no account
   * enumeration), so a successful request always advances to the code step
   * and never confirms or denies the address.
   */
  async function onRequestReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setPending(true)
    try {
      const { error: resetError } = await authClient.emailOtp.requestPasswordReset({ email })
      if (resetError) {
        // The endpoint is rate-limited to 3/minute (see src/server/auth);
        // 429 gets its own message instead of the generic failure.
        setError(
          resetError.status === 429
            ? t('auth.otpErrorTooManyRequests')
            : describeError(resetError.code),
        )
        return
      }
      // Success never confirms the address exists (the server answers the
      // same for an unknown email): the code step is entered either way, so
      // the form cannot be used to probe accounts.
      setResetSent(false)
      setFlow('reset')
    } finally {
      setPending(false)
    }
  }

  /**
   * Step 2: verify the code and set the new password. On success the
   * credential account is updated; the user is NOT signed in automatically
   * (Better Auth policy), so the form returns to sign-in with a confirmation.
   */
  async function onResetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError(t('auth.errorPasswordLength'))
      return
    }
    if (password !== confirm) {
      setError(t('auth.passwordMismatch'))
      return
    }
    setPending(true)
    try {
      const { error: resetError } = await authClient.emailOtp.resetPassword({
        email,
        otp: otp.join(''),
        password,
      })
      if (resetError) {
        setError(describeError(resetError.code))
        return
      }
      setResetSent(true)
      setFlow('credentials')
      setPassword('')
      setConfirm('')
      setOtp(emptyOtpSlots())
    } finally {
      setPending(false)
    }
  }

  /**
   * Re-sends the verification mail. rate-limited server-side (3 per minute),
   * so a failure only needs the generic message rather than a specific one.
   */
  async function onResend() {
    if (!verifyEmail || resend === 'sending') return
    setResend('sending')
    const { error: resendError } = await authClient.sendVerificationEmail({
      email: verifyEmail,
      callbackURL: '/',
    })
    setResend(resendError ? 'idle' : 'sent')
    if (resendError) setError(t('auth.errorGeneric'))
  }

  /** Social sign-in: a full-page redirect to the provider, then back. */
  function onSocialSignIn(provider: 'google') {
    setError(null)
    // The OAuth round trip ends at the callbackURL; errors land there too
    // (errorCallbackURL defaults to the same place), where the session
    // hook picks the new state up.
    void authClient.signIn.social({
      provider,
      callbackURL: nextTarget(),
      errorCallbackURL: `${window.location.pathname}?error=social`,
    })
  }

  const tabClass = (active: boolean) =>
    `rounded-lg border px-3 py-2 text-sm transition-colors ${FOCUS_RING} ${
      active
        ? 'border-ink bg-ink text-surface-page hover:bg-ink/85'
        : 'border-line-strong bg-surface-raised text-ink hover:border-ink hover:bg-ink/10'
    }`

  // surface-raised: these sit on the auth card, and in the dark theme the page
  // colour is darker than the card, so a page-coloured button read as a hole.
  // The hover is an ink tint rather than the soft surface, so it tints the same
  // way in both themes instead of dropping to a darker fill in dark mode.
  const secondaryButtonClass =
    `rounded-lg border border-line-strong bg-surface-raised px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:border-ink hover:bg-ink/10 ${FOCUS_RING}`

  const submitButtonClass = `mt-2 inline-flex items-center justify-center gap-2 rounded-lg bg-ink px-4 py-2.5 font-medium leading-5 text-surface-page transition-[background-color,transform] hover:bg-ink/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-soft-blue focus-visible:ring-offset-2 focus-visible:ring-offset-surface-card active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70 ${
    pending ? 'btn-sheen' : ''
  }`

  return (
    // A rare page with no hero banner, so it carries its own backdrop
    // (.auth-page) and fills the viewport: the footer then sits below the
    // fold, exactly as it does after any other page's 100vh hero, instead of
    // floating in the middle of a short page.
    <main className="below-chrome auth-page flex min-h-screen items-center justify-center px-4 pb-16">
      <div className="w-full max-w-md rounded-2xl border border-line-soft bg-surface-card p-6 shadow-[0_10px_30px_-15px_rgba(15,15,15,0.35)] sm:p-8">
        <h1 className="mb-6 text-center text-2xl font-semibold text-ink">{t('auth.pageTitle')}</h1>

        {verifyEmail ? (
          <div className="flex flex-col gap-4" data-testid="auth-verify-panel">
            <h2 className="text-center text-lg font-semibold text-ink">{t('auth.verifyTitle')}</h2>
            <p
              role="status"
              data-testid="auth-notice"
              className="rounded-lg bg-surface-soft px-3 py-2 text-sm text-ink"
            >
              {t('auth.verifySent')}
            </p>
            <p
              className="text-center text-sm font-medium text-ink"
              data-testid="auth-verify-email"
              dir="ltr"
            >
              {verifyEmail}
            </p>
            <p className="text-sm text-ink-muted">{t('auth.verifyHint')}</p>

            {resend === 'sent' && (
              <p
                role="status"
                data-testid="auth-resend-sent"
                className="rounded-lg bg-surface-soft px-3 py-2 text-sm text-ink"
              >
                {t('auth.resendSent')}
              </p>
            )}
            {error && (
              <p
                role="alert"
                data-testid="auth-error"
                className="rounded-lg border border-danger px-3 py-2 text-sm text-danger"
              >
                {error}
              </p>
            )}

            <button
              type="button"
              data-testid="auth-resend"
              disabled={resend === 'sending'}
              onClick={onResend}
              className={`inline-flex items-center justify-center gap-2 ${secondaryButtonClass} ${
                resend === 'sending' ? 'btn-sheen' : ''
              } disabled:cursor-not-allowed disabled:opacity-70`}
            >
              {resend === 'sending' && <FaSpinner aria-hidden="true" className="animate-spin" />}
              {t('auth.resend')}
            </button>
            <button
              type="button"
              data-testid="auth-back-to-signin"
              onClick={() => {
                setVerifyEmail(null)
                setMode('signin')
                setError(null)
                setResend('idle')
              }}
              className={secondaryButtonClass}
            >
              {t('auth.backToSignIn')}
            </button>
          </div>
        ) : flow === 'forgot' ? (
          <div data-testid="auth-forgot-panel">
            <h2 className="mb-2 text-center text-lg font-semibold text-ink">
              {t('auth.resetTitle')}
            </h2>
            <p className="mb-4 text-center text-sm text-ink-muted">
              {t('auth.resetRequestHint')}
            </p>
            {error && (
              <p
                role="alert"
                data-testid="auth-error"
                className="mb-4 rounded-lg border border-danger px-3 py-2 text-sm text-danger"
              >
                {error}
              </p>
            )}
            <form onSubmit={onRequestReset} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1 text-start">
                <span className="text-sm text-ink-muted">{t('auth.emailLabel')}</span>
                <input
                  type="email"
                  required
                  name="email"
                  autoComplete="email"
                  data-testid="auth-email"
                  className={INPUT_CLASS}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </label>
              <button
                type="submit"
                disabled={pending}
                aria-busy={pending}
                aria-label={pending ? t('auth.submitting') : undefined}
                data-testid="auth-send-code"
                className={submitButtonClass}
              >
                {pending ? (
                  <span className="flex h-5 w-5 items-center justify-center">
                    <FaSpinner
                      aria-hidden="true"
                      data-testid="auth-submit-spinner"
                      className="animate-spin"
                    />
                  </span>
                ) : (
                  t('auth.resetRequestAction')
                )}
              </button>
              <button
                type="button"
                data-testid="auth-back-to-signin"
                onClick={() => switchFlow('credentials')}
                className={secondaryButtonClass}
              >
                {t('auth.backToSignIn')}
              </button>
            </form>
          </div>
        ) : flow === 'reset' ? (
          <div data-testid="auth-reset-panel">
            <h2 className="mb-2 text-center text-lg font-semibold text-ink">
              {t('auth.resetTitle')}
            </h2>
            <p className="mb-4 text-center text-sm text-ink-muted" data-testid="auth-reset-hint">
              {t('auth.resetSent')}
              <span className="mt-1 block font-medium text-ink" dir="ltr">
                {email}
              </span>
            </p>
            {error && (
              <p
                role="alert"
                data-testid="auth-error"
                className="mb-4 rounded-lg border border-danger px-3 py-2 text-sm text-danger"
              >
                {error}
              </p>
            )}
            <form onSubmit={onResetPassword} className="flex flex-col gap-4">
              {/* The code as four square boxes: digits-only, auto-advance on
                  type, a paste (or the OS one-time-code autofill) spreads
                  across the boxes, backspace falls back. All four inputs
                  carry the same data-testid so the specs (and autofill) keep
                  working against the group. */}
              <div
                role="group"
                aria-label={t('auth.resetCodeLabel')}
                className="flex justify-center gap-2"
                dir="ltr"
              >
                {Array.from({ length: OTP_LENGTH }, (_, index) => (
                  <input
                    key={index}
                    ref={(node) => {
                      otpRefs.current[index] = node
                    }}
                    type="text"
                    dir="ltr"
                    required
                    name={`reset-code-${index + 1}`}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete={index === 0 ? 'one-time-code' : 'off'}
                    aria-label={`${t('auth.resetCodeLabel')} ${index + 1}`}
                    data-testid="auth-otp"
                    data-otp-index={index}
                    className={OTP_INPUT_CLASS}
                    value={otp[index] ?? ''}
                    onChange={(event) => onOtpChange(index, event.target.value)}
                    onKeyDown={(event) => onOtpKeyDown(index, event)}
                    onFocus={(event) => event.target.select()}
                  />
                ))}
              </div>
              <span className="text-xs text-ink-muted">{t('auth.resetCodeHint')}</span>
              <label className="flex flex-col gap-1 text-start">
                <span className="text-sm text-ink-muted">{t('auth.resetNewPasswordLabel')}</span>
                <PasswordInput
                  value={password}
                  onChange={setPassword}
                  testId="auth-new-password"
                  name="new-password"
                  autoComplete="new-password"
                  inputClassName={INPUT_CLASS}
                />
                <span className="text-xs text-ink-muted">{t('auth.passwordHint')}</span>
              </label>
              <label className="flex flex-col gap-1 text-start">
                <span className="text-sm text-ink-muted">{t('auth.confirmPasswordLabel')}</span>
                <PasswordInput
                  value={confirm}
                  onChange={setConfirm}
                  testId="auth-confirm-password"
                  name="confirm-password"
                  autoComplete="new-password"
                  inputClassName={INPUT_CLASS}
                />
              </label>
              <button
                type="submit"
                disabled={pending}
                aria-busy={pending}
                aria-label={pending ? t('auth.submitting') : undefined}
                data-testid="auth-reset-submit"
                className={submitButtonClass}
              >
                {pending ? (
                  <span className="flex h-5 w-5 items-center justify-center">
                    <FaSpinner
                      aria-hidden="true"
                      data-testid="auth-submit-spinner"
                      className="animate-spin"
                    />
                  </span>
                ) : (
                  t('auth.resetAction')
                )}
              </button>
              <button
                type="button"
                data-testid="auth-back-to-signin"
                onClick={() => switchFlow('credentials')}
                className={secondaryButtonClass}
              >
                {t('auth.backToSignIn')}
              </button>
            </form>
          </div>
        ) : (
          <>
            <div
              className="mb-6 grid grid-cols-2 gap-2"
              role="tablist"
              aria-label={t('auth.pageTitle')}
            >
              <button
                type="button"
                role="tab"
                aria-selected={!isSignUp}
                data-testid="auth-tab-signin"
                className={tabClass(!isSignUp)}
                onClick={() => switchMode('signin')}
              >
                {t('auth.tabSignIn')}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={isSignUp}
                data-testid="auth-tab-signup"
                className={tabClass(isSignUp)}
                onClick={() => switchMode('signup')}
              >
                {t('auth.tabSignUp')}
              </button>
            </div>

            {resetSent && (
              <p
                role="status"
                data-testid="auth-reset-done"
                className="mb-4 rounded-lg bg-surface-soft px-3 py-2 text-sm text-ink"
              >
                {t('auth.resetDone')}
              </p>
            )}
            {error && (
              <p
                role="alert"
                data-testid="auth-error"
                className="mb-4 rounded-lg border border-danger px-3 py-2 text-sm text-danger"
              >
                {error}
              </p>
            )}

            {/* Social sign-in: one button per provider the server has
                credentials for. Providers without credentials render nothing,
                so the buttons can never advertise a flow that would fail at
                the OAuth handshake. The Google button leads the card (styled
                like the form's controls), and the "or ... with email" rule
                sits BELOW it (user-requested), introducing the form. Its copy
                follows the active tab, since it names the action the form
                under it performs. The
                brand name stays untranslated either way, and the icon keeps
                the button's start edge: a fixed LTR row inside the (RTL)
                Hebrew button, so the G never flips sides. */}
            {ENABLED_SOCIAL_PROVIDERS.length > 0 && (
              <>
                {/* Google is the only social provider: one full-width button,
                    its label centered like the other buttons'. */}
                <div className="mb-4 grid grid-cols-1 gap-2" data-testid="auth-social-buttons">
                  {ENABLED_SOCIAL_PROVIDERS.includes('google') && (
                    <button
                      type="button"
                      data-testid="auth-social-google"
                      className={secondaryButtonClass}
                      onClick={() => onSocialSignIn('google')}
                    >
                      <span className="flex items-center justify-center gap-2" dir="ltr">
                        <FaGoogle aria-hidden="true" />
                        <span>{t('auth.socialGoogle')}</span>
                      </span>
                    </button>
                  )}
                </div>
                <div
                  className="mb-4 flex items-center gap-3"
                  aria-hidden="true"
                  data-testid="auth-or-email"
                >
                  <span className="h-px flex-1 bg-line-soft" />
                  <span className="text-xs text-ink-muted">
                    {t(isSignUp ? 'auth.orEmailSignUp' : 'auth.orEmail')}
                  </span>
                  <span className="h-px flex-1 bg-line-soft" />
                </div>
              </>
            )}

            <form onSubmit={onSubmit} className="flex flex-col gap-4">
              {isSignUp && (
                <label className="flex flex-col gap-1 text-start">
                  <span className="text-sm text-ink-muted">{t('auth.nameLabel')}</span>
                  <input
                    type="text"
                    required
                    name="name"
                    autoComplete="name"
                    data-testid="auth-name"
                    className={INPUT_CLASS}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  />
                </label>
              )}

              <label className="flex flex-col gap-1 text-start">
                <span className="text-sm text-ink-muted">{t('auth.emailLabel')}</span>
                <input
                  type="email"
                  required
                  name="email"
                  autoComplete="email"
                  data-testid="auth-email"
                  className={INPUT_CLASS}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </label>

              <label className="flex flex-col gap-1 text-start">
                <span className="text-sm text-ink-muted">{t('auth.passwordLabel')}</span>
                <PasswordInput
                  value={password}
                  onChange={setPassword}
                  testId="auth-password"
                  name="password"
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                  inputClassName={INPUT_CLASS}
                />
                {isSignUp && <span className="text-xs text-ink-muted">{t('auth.passwordHint')}</span>}
              </label>

              {isSignUp && (
                <label className="flex flex-col gap-1 text-start">
                  <span className="text-sm text-ink-muted">{t('auth.confirmPasswordLabel')}</span>
                  <PasswordInput
                    value={confirm}
                    onChange={setConfirm}
                    testId="auth-confirm-password"
                    name="confirm-password"
                    autoComplete="new-password"
                    inputClassName={INPUT_CLASS}
                  />
                </label>
              )}

              {/* While the request is in flight the label is replaced by the
                  spinner alone (plus the .btn-sheen sweep). leading-5 + the
                  h-5 spinner box keep the button's height identical in both
                  states, so swapping to the spinner never nudges the form.
                  aria-label carries the "sending" name the dropped label used
                  to provide. */}
              <button
                type="submit"
                disabled={pending}
                aria-busy={pending}
                aria-label={pending ? t('auth.submitting') : undefined}
                data-testid="auth-submit"
                className={submitButtonClass}
              >
                {pending ? (
                  <span className="flex h-5 w-5 items-center justify-center">
                    <FaSpinner
                      aria-hidden="true"
                      data-testid="auth-submit-spinner"
                      className="animate-spin"
                    />
                  </span>
                ) : isSignUp ? (
                  t('auth.signUpAction')
                ) : (
                  t('auth.signInAction')
                )}
              </button>
            </form>

            {/* Sign-in extras: forgot password on the start side (left in
                English/LTR, right in Hebrew/RTL via the logical utilities),
                create-account hint on the end side. */}
            {!isSignUp && (
              <div className="mt-3 flex items-center justify-between gap-2">
                <button
                  type="button"
                  data-testid="auth-forgot"
                  className="text-sm text-ink-muted underline-offset-2 transition-colors hover:text-ink hover:underline"
                  onClick={() => switchFlow('forgot')}
                >
                  {t('auth.forgotPassword')}
                </button>
                <button
                  type="button"
                  data-testid="auth-goto-signup"
                  className="text-sm text-ink-muted underline-offset-2 transition-colors hover:text-ink hover:underline"
                  onClick={() => switchMode('signup')}
                >
                  {t('auth.gotoSignUp')}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}
