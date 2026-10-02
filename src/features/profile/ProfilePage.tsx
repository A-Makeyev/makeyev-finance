'use client'

import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { FaKey, FaRegUser, FaSignOutAlt } from 'react-icons/fa'
import { AppModal } from '@/components/ui/AppModal'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { authClient } from '@/lib/auth-client'
import { useRouter } from '@/router'
import { initialsFor } from '@/lib/avatar'
import { SavedMixesSection } from '@/features/mixes/SavedMixesSection'
import { RepliesSection } from './RepliesSection'
import type { Role } from '@/server/auth/roles'

/**
 * The signed-in profile page body. The server page (which re-checks the
 * session) passes the identity down as props, so this component never has to
 * fetch the session itself and cannot render someone else's identity.
 *
 * Account actions are Better Auth's own: change password (with the option to
 * kill the other sessions, which pairs with the server's
 * `revokeSessionsOnPasswordReset`), sign out, and sign out everywhere.
 *
 * Layout: a deliberately dark, mixed-hue gradient page (the same dark chrome
 * family as the hero and footer - kept dark in both themes rather than
 * tokenized), the user's name as the page title, and the cards on top. The
 * identity and the account actions share ONE card so the page does not repeat
 * "the account" twice, and the password form lives behind a button and a modal
 * rather than sitting open on the page. All copy goes through i18n and the
 * markup uses logical utilities plus the theme roles, so it flips for RTL and
 * the cards read correctly in both themes. Each list (saved mixes, replies) is
 * its own full-width row, and the cards inside each pair up two per row once
 * there is width for them.
 */

const ROLE_LABEL_KEY: Record<Role, string> = {
  client: 'auth.roleClient',
  advisor: 'auth.roleAdvisor',
  admin: 'auth.roleAdmin',
}

const INPUT_CLASS =
  'w-full rounded-lg border border-line-strong bg-surface-page px-3 py-2 text-ink outline-none transition-colors hover:border-ink focus:border-ink'

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-soft-blue focus-visible:ring-offset-2 focus-visible:ring-offset-surface-card'

const CARD_CLASS = 'rounded-3xl border border-line-soft bg-surface-card p-6 sm:p-8'

// surface-raised, not surface-page: these buttons sit ON the profile's card,
// and in the dark theme the page colour is darker than the card, so a
// page-coloured button read as a black slab. Hover emphasises the border and
// the text rather than dropping to a darker fill.
const SECONDARY_BUTTON_CLASS = `inline-flex items-center justify-center gap-2 rounded-lg border border-line-strong bg-surface-raised px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:border-ink hover:bg-ink/10 ${FOCUS_RING}`

const PRIMARY_BUTTON_CLASS = `inline-flex items-center justify-center gap-2 rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-surface-page transition-colors hover:bg-ink/85 ${FOCUS_RING} disabled:cursor-not-allowed disabled:opacity-70`

export function ProfilePage({
  name,
  email,
  image,
  role,
}: {
  name: string
  email: string
  image: string | null
  role: Role
}) {
  const { t, i18n } = useTranslation()
  const router = useRouter()

  const [passwordOpen, setPasswordOpen] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  /** Checked by default: a password change is a common response to a suspected compromise. */
  const [revokeOtherSessions, setRevokeOtherSessions] = useState(true)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [changed, setChanged] = useState(false)

  const initials = initialsFor(name)

  function openPassword() {
    setError(null)
    setChanged(false)
    setPasswordOpen(true)
  }

  async function onChangePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    // Same rules the server enforces (8-128 chars); checked here only for
    // immediate feedback, the server re-validates regardless.
    if (newPassword.length < 8) {
      setError(t('auth.errorPasswordLength'))
      return
    }
    if (newPassword !== confirmPassword) {
      setError(t('auth.passwordMismatch'))
      return
    }

    setPending(true)
    try {
      const { error: changeError } = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions,
      })
      if (changeError) {
        setError(
          changeError.code === 'INVALID_PASSWORD'
            ? t('auth.profileErrorInvalidPassword')
            : t('auth.errorGeneric'),
        )
        return
      }
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordOpen(false)
      setChanged(true)
    } finally {
      setPending(false)
    }
  }

  async function signOut() {
    await authClient.signOut()
    router.push('/')
  }

  /**
   * Kills every session for the account, then clears the local one. The
   * second call is best-effort: the sessions are already gone server-side, so
   * a failure there must not strand the user on the page.
   */
  async function signOutEverywhere() {
    try {
      await authClient.revokeSessions()
    } finally {
      try {
        await authClient.signOut()
      } catch {
        // Already revoked; the cookie clears on the next response anyway.
      }
      router.push('/')
    }
  }

  return (
    // Dark mixed-hue gradient chrome (profile-page), kept dark in both themes.
    <main className="below-chrome profile-page min-h-screen px-4 pb-20 pt-28">
      <div className="mx-auto w-full max-w-6xl" data-testid="profile-page">
        {/* Identity + account actions share one card; no page title and no
            card heading (user-requested) - the identity itself is the top of
            the page, and the actions read as the card's content. */}
        <section className={CARD_CLASS} data-testid="account-card">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            {image ? (
              <img
                src={image}
                alt=""
                referrerPolicy="no-referrer"
                className="h-20 w-20 shrink-0 self-center rounded-full object-cover sm:self-auto"
                data-testid="profile-avatar-img"
              />
            ) : initials ? (
              <span
                className="flex h-20 w-20 shrink-0 items-center justify-center self-center rounded-full bg-surface-soft text-2xl font-semibold text-ink sm:self-auto"
                aria-hidden="true"
                data-testid="profile-avatar-initials"
              >
                {initials}
              </span>
            ) : (
              <span
                className="flex h-20 w-20 shrink-0 items-center justify-center self-center rounded-full bg-surface-soft text-ink-muted sm:self-auto"
                aria-hidden="true"
                data-testid="profile-avatar-empty"
              >
                <FaRegUser />
              </span>
            )}

            <div className="min-w-0 text-center sm:text-start">
              <p className="truncate text-xl font-semibold text-ink" data-testid="profile-name">
                {name || email}
              </p>
              <p className="truncate text-sm text-ink-muted" dir="ltr" data-testid="profile-email">
                {email}
              </p>
              <div className="mt-2.5 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <span className="text-xs text-ink-muted">{t('auth.profileRoleLabel')}</span>
                <span
                  className="rounded-full border border-line-strong bg-surface-soft px-2.5 py-0.5 text-xs font-medium text-ink"
                  data-testid="profile-role"
                >
                  {t(ROLE_LABEL_KEY[role])}
                </span>
              </div>
            </div>
          </div>

          {changed && (
            <p
              role="status"
              data-testid="profile-password-changed"
              className="mt-5 rounded-lg bg-surface-soft px-3 py-2 text-sm text-ink"
            >
              {t('auth.profilePasswordChanged')}
            </p>
          )}

          <div className="mt-6 flex flex-col gap-3 border-t border-line-soft pt-6 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              data-testid="open-change-password"
              onClick={openPassword}
              className={PRIMARY_BUTTON_CLASS}
            >
              <FaKey aria-hidden="true" />
              {t('auth.profileChangePasswordTitle')}
            </button>
            <button
              type="button"
              data-testid="profile-sign-out"
              onClick={signOut}
              className={SECONDARY_BUTTON_CLASS}
            >
              <FaSignOutAlt aria-hidden="true" />
              {t('auth.signOut')}
            </button>
            <button
              type="button"
              data-testid="profile-sign-out-all"
              onClick={signOutEverywhere}
              className={SECONDARY_BUTTON_CLASS}
            >
              <FaSignOutAlt aria-hidden="true" />
              {t('auth.profileSignOutAll')}
            </button>
          </div>
        </section>

        <section className={`mt-6 ${CARD_CLASS}`}>
          <SavedMixesSection />
        </section>

        <section className={`mt-6 ${CARD_CLASS}`}>
          <RepliesSection />
        </section>
      </div>

      <AppModal
        open={passwordOpen}
        onOpenChange={setPasswordOpen}
        testId="change-password-modal"
        dir={i18n.dir()}
        tone="teal"
        contentClassName="max-w-[460px]"
      >
        <form onSubmit={onChangePassword} className="flex flex-col gap-4 p-6">
          <h3 className="text-[20px] font-bold leading-tight text-ink">
            {t('auth.profileChangePasswordTitle')}
          </h3>

          {error && (
            <p
              role="alert"
              data-testid="profile-error"
              className="rounded-lg border border-danger px-3 py-2 text-sm text-danger"
            >
              {error}
            </p>
          )}

          <label className="flex flex-col gap-1 text-start">
            <span className="text-sm text-ink-muted">{t('auth.profileCurrentPasswordLabel')}</span>
            <PasswordInput
              value={currentPassword}
              onChange={setCurrentPassword}
              testId="profile-current-password"
              name="current-password"
              autoComplete="current-password"
              inputClassName={INPUT_CLASS}
            />
          </label>
          <label className="flex flex-col gap-1 text-start">
            <span className="text-sm text-ink-muted">{t('auth.resetNewPasswordLabel')}</span>
            <PasswordInput
              value={newPassword}
              onChange={setNewPassword}
              testId="profile-new-password"
              name="new-password"
              autoComplete="new-password"
              inputClassName={INPUT_CLASS}
            />
            <span className="text-xs text-ink-muted">{t('auth.passwordHint')}</span>
          </label>
          <label className="flex flex-col gap-1 text-start">
            <span className="text-sm text-ink-muted">{t('auth.confirmPasswordLabel')}</span>
            <PasswordInput
              value={confirmPassword}
              onChange={setConfirmPassword}
              testId="profile-confirm-password"
              name="confirm-password"
              autoComplete="new-password"
              inputClassName={INPUT_CLASS}
            />
          </label>

          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              name="revoke-other-sessions"
              data-testid="profile-revoke-others"
              checked={revokeOtherSessions}
              onChange={(event) => setRevokeOtherSessions(event.target.checked)}
            />
            <span>{t('auth.profileRevokeOtherSessions')}</span>
          </label>

          <div className="mt-2 flex justify-end gap-3">
            <button
              type="button"
              data-testid="change-password-cancel"
              className="rounded-[5px] border border-line-strong px-5 py-2 text-[15px] font-medium text-ink-muted transition-colors hover:text-ink"
              onClick={() => setPasswordOpen(false)}
            >
              {t('savedMixes.cancel')}
            </button>
            <button
              type="submit"
              disabled={pending}
              aria-busy={pending}
              data-testid="profile-change-password"
              className="rounded-[5px] bg-[var(--calc-teal)] px-5 py-2 text-[15px] font-semibold text-white transition-colors hover:bg-[var(--calc-teal-deep)] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {t('auth.profileChangePasswordAction')}
            </button>
          </div>
        </form>
      </AppModal>
    </main>
  )
}
