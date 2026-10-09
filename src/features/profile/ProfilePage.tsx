'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { FaKey, FaRegUser, FaSignOutAlt, FaSpinner, FaTrashAlt } from 'react-icons/fa'
import { AppModal } from '@/components/ui/AppModal'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { FieldError } from '@/components/ui/FieldError'
import { authClient } from '@/lib/auth-client'
import { setAccountPassword } from '@/server/auth/actions'
import { useRouter } from '@/router'
import { initialsFor } from '@/lib/avatar'
import { matchesConfirmWord } from '@/lib/confirmWord'
import { maskEmail } from '@/lib/mask'
import { SavedMixesSection } from '@/features/mixes/SavedMixesSection'
import { Confetti } from './Confetti'
import { RepliesSection } from './RepliesSection'
import type { Role } from '@/server/auth/roles'

/**
 * The signed-in profile page body. The server page (which re-checks the
 * session) passes the identity down as props, so this component never has to
 * fetch the session itself and cannot render someone else's identity.
 *
 * Account actions are Better Auth's own: change password (with the option to
 * kill the other sessions, which pairs with the server's
 * `revokeSessionsOnPasswordReset`), sign out, sign out everywhere, and - last
 * and visually set apart - delete the account. An account created through
 * Google has no password at all, so the same button and modal become "set a
 * password" for it (see src/server/auth/accountPassword.ts): otherwise that
 * person could never use the email+password form, since the address is already
 * registered and the sign-up form refuses it. Deletion is irreversible, so it
 * takes three deliberate acts: a warning modal that will not submit until the
 * account's password is given (or, for an account with no password, the
 * profile's own word is typed), a single-use link mailed to the address, and
 * the button on the page that link lands on (see src/lib/confirmWord,
 * src/server/auth/accounts and src/server/auth/email).
 *
 * Layout: a theme-aware page backdrop (light surface in light mode; the
 * branded dark mixed-hue gradient in dark mode, the same family as the hero
 * and footer), the user's name as the page title, and the cards on top. The
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

/** Which copy each refusal from the set-password action gets. */
const SET_PASSWORD_ERROR_KEYS: Record<
  'unauthenticated' | 'too_short' | 'too_long' | 'has_password' | 'rate_limited' | 'error',
  string
> = {
  unauthenticated: 'auth.errorGeneric',
  // Both length rules read the same sentence: it names the minimum, which is
  // the one a person can actually hit by typing too little.
  too_short: 'auth.errorPasswordLength',
  too_long: 'auth.errorPasswordLength',
  has_password: 'auth.profileSetPasswordHasPassword',
  rate_limited: 'auth.profileSetPasswordTooManyAttempts',
  error: 'auth.errorGeneric',
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

// The destructive action keeps the secondary button's shape but takes the brand
// red on its border and text, so it reads as set apart from sign-out without
// shouting from the row it shares with it. The brand red rather than the danger
// role: --danger flips to a PALE red in dark mode, which put white text on a
// pink wash (same reasoning as .saved-mix-delete-button).
const DANGER_BUTTON_CLASS = `inline-flex items-center justify-center gap-2 rounded-lg border border-soft-red bg-surface-raised px-4 py-2.5 text-sm font-semibold text-soft-red transition-colors hover:bg-soft-red hover:text-white ${FOCUS_RING} disabled:cursor-not-allowed disabled:opacity-70`

// The one button in the modal that really does delete the account. Brand red
// again, and at 90%: a full-strength fill on a 460px dialog read louder than the
// action needs, while staying obviously destructive (user-requested). The
// spinner box keeps the button's height identical while the request is in
// flight, so swapping the label for it never nudges the modal's actions row.
const DELETE_BUTTON_CLASS =
  'inline-flex items-center justify-center gap-2 rounded-[5px] bg-soft-red/90 px-5 py-2 text-[15px] font-semibold text-white transition-colors hover:bg-soft-red disabled:cursor-not-allowed disabled:opacity-60'

const PRIMARY_BUTTON_CLASS = `inline-flex items-center justify-center gap-2 rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-surface-page transition-colors hover:bg-ink/85 ${FOCUS_RING} disabled:cursor-not-allowed disabled:opacity-70`

export function ProfilePage({
  name,
  email,
  image,
  role,
  hasPassword,
  justVerified = false,
  deleteToken = null,
}: {
  name: string
  email: string
  image: string | null
  role: Role
  /**
   * Whether this account can be proved with a password. Resolved on the server
   * (src/server/auth/accounts) because it decides whether the delete modal
   * asks for one; a Google-created account has none to give.
   */
  hasPassword: boolean
  /** True when the page was opened by an email-verification link. */
  justVerified?: boolean
  /**
   * Better Auth's single-use token from the mailed deletion link
   * (`?delete=...`). Present means the visitor opened that link, so the delete
   * modal opens on its last step. It is never logged, and Better Auth only
   * honours it for the session that asked for the deletion.
   */
  deleteToken?: string | null
}) {
  const { t, i18n } = useTranslation()
  const router = useRouter()

  // The celebration is one-off: the flag is dropped from the address bar as
  // soon as it has been read, so a reload (or a bookmark) does not replay it.
  useEffect(() => {
    if (!justVerified) return
    const url = new URL(window.location.href)
    url.searchParams.delete('verified')
    window.history.replaceState(null, '', `${url.pathname}${url.search}`)
  }, [justVerified])

  const [passwordOpen, setPasswordOpen] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  /** Checked by default: a password change is a common response to a suspected compromise. */
  const [revokeOtherSessions, setRevokeOtherSessions] = useState(true)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [changed, setChanged] = useState(false)
  // The set-a-password flow ends in its own sentence (nothing was "changed").
  const [passwordSet, setPasswordSet] = useState(false)

  // Deleting the account keeps its own state, separate from the password
  // modal's: the two modals are never open together, but sharing `pending`
  // would let one form's spinner appear on the other's button. The mailed link
  // opens the modal on its LAST step, the warning's own button opens it on the
  // first (prove it is you, then we mail you).
  const [deleteFromMail, setDeleteFromMail] = useState(Boolean(deleteToken))
  const [deleteOpen, setDeleteOpen] = useState(Boolean(deleteToken))
  /** The profile's own word: the deliberate act for an account with no password. */
  const [deleteConfirm, setDeleteConfirm] = useState('')
  /** The account's password, verified by Better Auth before it mails anything. */
  const [deletePassword, setDeletePassword] = useState('')
  const [deletePending, setDeletePending] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  // True once Better Auth accepted the request and mailed the confirmation
  // link: the modal then only reports where the mail went.
  const [deleteMailSent, setDeleteMailSent] = useState(false)

  const confirmWord = t('auth.profileDeleteConfirmWord')
  // An account that has a password is proved with that password: Better Auth's
  // own delete endpoint verifies it before it mails anything, so a typo is
  // answered instead of leaving a disabled button with nothing to fix. A
  // Google-created account has none to give, so it types the profile's word
  // instead, with the mismatch shown live while typing.
  const confirmTyped = !hasPassword && matchesConfirmWord(deleteConfirm, confirmWord)
  const deleteReady =
    deleteFromMail || confirmTyped || (hasPassword && deletePassword.length > 0)

  const initials = initialsFor(name)

  function openPassword() {
    setError(null)
    setChanged(false)
    setPasswordSet(false)
    setPasswordOpen(true)
  }

  /**
   * Sets a FIRST password through the server action (Better Auth's set-password
   * endpoint is server-only). The server re-checks everything: the session, the
   * length rules and that the account has no password yet.
   */
  async function onSetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

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
      const result = await setAccountPassword(newPassword)
      if (!result.ok) {
        setError(t(SET_PASSWORD_ERROR_KEYS[result.reason]))
        return
      }
      setNewPassword('')
      setConfirmPassword('')
      setPasswordOpen(false)
      setPasswordSet(true)
    } finally {
      setPending(false)
    }
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

  function openDelete() {
    setDeleteError(null)
    setDeleteConfirm('')
    setDeletePassword('')
    setDeleteMailSent(false)
    // The warning's own button always starts at the top; only the mailed link
    // opens the modal on the last step.
    setDeleteFromMail(false)
    setDeleteOpen(true)
  }

  /**
   * Closes the delete modal, and drops the token from the address bar when the
   * modal came from the mailed link: the URL is the only thing holding it, the
   * link is single-use, and leaving it behind would reopen the modal on the
   * next reload.
   */
  function closeDelete() {
    setDeleteOpen(false)
    if (!deleteFromMail) return
    setDeleteFromMail(false)
    const url = new URL(window.location.href)
    url.searchParams.delete('delete')
    window.history.replaceState(null, '', `${url.pathname}${url.search}`)
  }

  /**
   * First step, from the profile's warning modal: prove the deletion is wanted,
   * then let Better Auth mail the link. It deletes NOTHING yet.
   *
   * The password goes to Better Auth's own delete endpoint, which checks it
   * against the credential account before it creates the token, so a wrong
   * password is refused there and reported here. An account created through
   * Google has no password, so its proof is the typed word, checked here (the
   * mail's link is still the real gate on the deletion).
   */
  async function onDeleteRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setDeleteError(null)

    if (hasPassword && !deletePassword) {
      setDeleteError(t('auth.profileDeletePasswordRequired'))
      return
    }
    if (!hasPassword && !confirmTyped) {
      setDeleteError(t('auth.profileDeleteConfirmMismatch'))
      return
    }

    setDeletePending(true)
    try {
      const { error: deleteFailure } = await authClient.deleteUser(
        hasPassword ? { password: deletePassword } : {},
      )
      if (deleteFailure) {
        setDeleteError(
          deleteFailure.status === 429
            ? t('auth.profileDeleteTooManyAttempts')
            : deleteFailure.code === 'INVALID_PASSWORD'
              ? t('auth.profileErrorInvalidPassword')
              : deleteFailure.code === 'SESSION_EXPIRED'
                ? t('auth.profileDeleteSessionExpired')
                : t('auth.errorGeneric'),
        )
        return
      }
      setDeleteMailSent(true)
    } finally {
      setDeletePending(false)
    }
  }

  /**
   * Last step, from the mailed link: the token costs the account. Better Auth
   * consumes it, checks it belongs to this session's user, then removes the
   * user, its sessions and its account rows, clears the cookie, and runs the
   * app's own cleanup (see the afterDelete hook in src/server/auth/index.ts).
   * The browser is left signed out on the home page, so it goes there.
   */
  async function onDeleteConfirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!deleteToken) return
    setDeleteError(null)

    setDeletePending(true)
    try {
      const { error: deleteFailure } = await authClient.deleteUser({ token: deleteToken })
      if (deleteFailure) {
        setDeleteError(
          deleteFailure.status === 429
            ? t('auth.profileDeleteTooManyAttempts')
            : deleteFailure.code === 'INVALID_TOKEN'
              ? t('auth.profileDeleteInvalidLink')
              : t('auth.errorGeneric'),
        )
        return
      }
      router.push('/')
    } finally {
      setDeletePending(false)
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
    // Theme-aware backdrop (profile-page): light surface in light mode, the
    // branded dark gradient in dark mode (see .profile-page in globals.css).
    <main className="below-chrome profile-page min-h-screen px-4 pb-20 pt-28">
      {justVerified && <Confetti />}
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

          {(changed || passwordSet) && (
            <p
              role="status"
              data-testid="profile-password-changed"
              className="mt-5 rounded-lg bg-surface-soft px-3 py-2 text-sm text-ink"
            >
              {t(passwordSet ? 'auth.profileSetPasswordDone' : 'auth.profilePasswordChanged')}
            </p>
          )}

          <div className="mt-6 flex flex-col gap-3 border-t border-line-soft pt-6 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              // The same modal, two flows: an account with a password changes it,
              // an account without one (a Google sign-in) sets its first one.
              data-testid={hasPassword ? 'open-change-password' : 'open-set-password'}
              onClick={openPassword}
              className={PRIMARY_BUTTON_CLASS}
            >
              <FaKey aria-hidden="true" />
              {t(hasPassword ? 'auth.profileChangePasswordTitle' : 'auth.profileSetPasswordTitle')}
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
            {/* `ms-auto` (logical, so it flips with the direction) pushes the
                destructive action to the far end of the row on wide screens,
                where it cannot be hit while reaching for sign-out. */}
            <button
              type="button"
              data-testid="profile-delete-account"
              onClick={openDelete}
              className={`${DANGER_BUTTON_CLASS} sm:ms-auto`}
            >
              <FaTrashAlt aria-hidden="true" />
              {t('auth.profileDeleteAccount')}
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
        <form
          onSubmit={hasPassword ? onChangePassword : onSetPassword}
          className="flex flex-col gap-4 p-6"
        >
          <h3 className="text-[20px] font-bold leading-tight text-ink">
            {t(hasPassword ? 'auth.profileChangePasswordTitle' : 'auth.profileSetPasswordTitle')}
          </h3>

          {!hasPassword && (
            <p
              data-testid="set-password-hint"
              className="rounded-lg bg-surface-soft px-3 py-2.5 text-sm text-ink"
            >
              {t('auth.profileSetPasswordHint')}
            </p>
          )}

          {/* Only a change proves the old password; an account that has none
              has nothing to prove beyond its session, and the server refuses a
              set on an account that already has one. */}
          {hasPassword && (
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
          )}
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

          {/* Signing the other sessions out is part of a CHANGE (a suspected
              compromise); the set flow has no such history behind it. */}
          {hasPassword && (
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
          )}

          {error && <FieldError message={error} testId="profile-error" />}

          <div className="mt-2 modal-actions modal-actions-reversed">
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
              {t(
                hasPassword
                  ? 'auth.profileChangePasswordAction'
                  : 'auth.profileSetPasswordAction',
              )}
            </button>
          </div>
        </form>
      </AppModal>

      <AppModal
        open={deleteOpen}
        onOpenChange={(open) => {
          if (!open) closeDelete()
        }}
        testId="delete-account-modal"
        dir={i18n.dir()}
        tone="red"
        contentClassName="max-w-[460px]"
      >
        {deleteMailSent ? (
          /* The request went out: nothing is deleted yet, and the mail is the
             only thing that can finish it. Names the address (masked, like the
             sign-up panel) so it is clear which mailbox to open. */
          <div className="flex flex-col gap-4 p-6" data-testid="delete-account-sent">
            <h3
              data-testid="delete-account-mail-heading"
              className="text-center text-lg font-semibold text-ink"
            >
              {t('auth.profileDeleteMailSent')}
            </h3>
            <p
              role="status"
              data-testid="delete-account-mail-to"
              className="rounded-lg bg-surface-soft px-3 py-2.5 text-center text-sm font-medium text-ink"
            >
              <span dir="ltr">{maskEmail(email)}</span>
            </p>
            <p className="text-sm leading-relaxed text-ink-muted">{t('auth.profileDeleteMailHint')}</p>
            <div className="mt-2 modal-actions modal-actions-reversed">
              <button
                type="button"
                data-testid="delete-account-close"
                className="rounded-[5px] border border-line-strong px-5 py-2 text-[15px] font-medium text-ink-muted transition-colors hover:text-ink"
                onClick={closeDelete}
              >
                {t('auth.profileDeleteClose')}
              </button>
            </div>
          </div>
        ) : deleteFromMail ? (
          /* The mailed link: the address is already proved, and this is the last
             press. The warning is repeated in full here because this is the page
             the mail points at - the consequence has to be readable without
             going back to the profile's own modal. */
          <form onSubmit={onDeleteConfirm} className="flex flex-col gap-4 p-6">
            <h3 className="text-[20px] font-bold leading-tight text-ink">
              {t('auth.profileDeleteTitle')}
            </h3>

            <p
              data-testid="delete-account-warning"
              className="rounded-lg border border-danger/40 bg-surface-soft px-3 py-2.5 text-sm leading-relaxed text-ink"
            >
              {t('auth.profileDeleteWarning')}
            </p>

            <p
              data-testid="delete-account-mail-confirm"
              className="text-sm leading-relaxed text-ink-muted"
            >
              {t('auth.profileDeleteMailConfirmHint')}
            </p>

            {deleteError && <FieldError message={deleteError} testId="profile-delete-error" />}

            <div className="mt-2 modal-actions modal-actions-reversed">
              <button
                type="button"
                data-testid="delete-account-cancel"
                className="rounded-[5px] border border-line-strong px-5 py-2 text-[15px] font-medium text-ink-muted transition-colors hover:text-ink"
                onClick={closeDelete}
              >
                {t('savedMixes.cancel')}
              </button>
              <button
                type="submit"
                disabled={deletePending}
                aria-busy={deletePending}
                aria-label={deletePending ? t('auth.profileDeleting') : undefined}
                data-testid="profile-delete-submit"
                className={DELETE_BUTTON_CLASS}
              >
                {deletePending ? (
                  <span className="flex h-5 w-5 items-center justify-center">
                    <FaSpinner
                      aria-hidden="true"
                      data-testid="delete-submit-spinner"
                      className="animate-spin"
                    />
                  </span>
                ) : (
                  t('auth.profileDeleteAction')
                )}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={onDeleteRequest} className="flex flex-col gap-4 p-6">
            <h3 className="text-[20px] font-bold leading-tight text-ink">
              {t('auth.profileDeleteTitle')}
            </h3>

            {/* The consequence, in full, before anything can be typed: what
                goes, what stays, and that nothing brings it back. */}
            <p
              data-testid="delete-account-warning"
              className="rounded-lg border border-danger/40 bg-surface-soft px-3 py-2.5 text-sm leading-relaxed text-ink"
            >
              {t('auth.profileDeleteWarning')}
            </p>

            {/* The password is what Better Auth verifies before it mails
                anything; an account created through Google has none, so it
                types the profile's word instead. */}
            {hasPassword ? (
              <label className="flex flex-col gap-1 text-start">
                <span className="text-sm text-ink-muted">
                  {t('auth.profileCurrentPasswordLabel')}
                </span>
                <PasswordInput
                  value={deletePassword}
                  onChange={setDeletePassword}
                  testId="profile-delete-password"
                  name="delete-password"
                  autoComplete="current-password"
                  inputClassName={INPUT_CLASS}
                />
                <span className="text-xs text-ink-muted">
                  {t('auth.profileDeletePasswordHint')}
                </span>
              </label>
            ) : (
              <label className="flex flex-col gap-1 text-start">
                <span className="text-sm text-ink-muted">
                  {t('auth.profileDeleteConfirmLabel', { word: confirmWord })}
                </span>
                <input
                  type="text"
                  name="delete-confirm"
                  autoComplete="off"
                  aria-invalid={deleteConfirm.length > 0 && !confirmTyped}
                  data-testid="profile-delete-confirm"
                  value={deleteConfirm}
                  onChange={(event) => setDeleteConfirm(event.target.value)}
                  className={INPUT_CLASS}
                />
                {/* Live, not only on submit: the submit is disabled until the
                    word matches, so a mismatch has to be visible while typing. */}
                {deleteConfirm.length > 0 && !confirmTyped && (
                  <span className="text-xs text-danger" data-testid="delete-account-confirm-hint">
                    {t('auth.profileDeleteConfirmMismatch')}
                  </span>
                )}
              </label>
            )}

            {deleteError && <FieldError message={deleteError} testId="profile-delete-error" />}

            <div className="mt-2 modal-actions modal-actions-reversed">
              <button
                type="button"
                data-testid="delete-account-cancel"
                className="rounded-[5px] border border-line-strong px-5 py-2 text-[15px] font-medium text-ink-muted transition-colors hover:text-ink"
                onClick={() => setDeleteOpen(false)}
              >
                {t('savedMixes.cancel')}
              </button>
              <button
                type="submit"
                disabled={!deleteReady || deletePending}
                aria-busy={deletePending}
                aria-label={deletePending ? t('auth.profileDeleting') : undefined}
                data-testid="profile-delete-submit"
                className={DELETE_BUTTON_CLASS}
              >
                {deletePending ? (
                  <span className="flex h-5 w-5 items-center justify-center">
                    <FaSpinner
                      aria-hidden="true"
                      data-testid="delete-submit-spinner"
                      className="animate-spin"
                    />
                  </span>
                ) : (
                  t('auth.profileDeleteAction')
                )}
              </button>
            </div>
          </form>
        )}
      </AppModal>
    </main>
  )
}
