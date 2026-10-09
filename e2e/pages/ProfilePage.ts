import { type Locator, type Page } from '@playwright/test'

/**
 * Page object for /profile (and its /en mirror). Selectors live here, never
 * inline in a spec, so a markup change is one fix.
 *
 * The identity-dependent assertions need a real session in the database,
 * which the e2e suite deliberately does not create (see the gated-area specs),
 * so the specs here exercise the gate and the account-menu entry; the
 * selectors for the signed-in body are kept ready for when a seeded session
 * fixture exists.
 */
export class ProfilePage {
  readonly page: Page
  readonly root: Locator
  readonly name: Locator
  readonly email: Locator
  readonly role: Locator
  readonly avatarImg: Locator
  readonly avatarInitials: Locator
  readonly avatarEmpty: Locator
  readonly openChangePassword: Locator
  readonly changePasswordModal: Locator
  readonly currentPassword: Locator
  readonly currentPasswordToggle: Locator
  readonly newPassword: Locator
  readonly newPasswordToggle: Locator
  readonly confirmPassword: Locator
  readonly confirmPasswordToggle: Locator
  readonly revokeOthers: Locator
  readonly changePassword: Locator
  readonly passwordChanged: Locator
  readonly error: Locator
  readonly signOut: Locator
  readonly signOutAll: Locator
  readonly deleteAccount: Locator
  readonly deleteModal: Locator
  readonly deleteWarning: Locator
  readonly deleteConfirm: Locator
  readonly deleteConfirmHint: Locator
  /** The password step: the account proves itself before the link is mailed. */
  readonly deletePassword: Locator
  readonly deleteSubmit: Locator
  readonly deleteSpinner: Locator
  /** The last step, on the page the mailed link opens. */
  readonly deleteMailConfirm: Locator
  readonly deleteCancel: Locator
  readonly deleteError: Locator
  /** The "a link was sent to" state the modal switches to. */
  readonly deleteMailSent: Locator
  readonly deleteMailTo: Locator
  readonly deleteClose: Locator
  /** The set-a-password flow (accounts created through Google). */
  readonly openSetPassword: Locator
  readonly setPasswordHint: Locator

  constructor(page: Page) {
    this.page = page
    this.root = page.getByTestId('profile-page')
    this.name = page.getByTestId('profile-name')
    this.email = page.getByTestId('profile-email')
    this.role = page.getByTestId('profile-role')
    this.avatarImg = page.getByTestId('profile-avatar-img')
    this.avatarInitials = page.getByTestId('profile-avatar-initials')
    this.avatarEmpty = page.getByTestId('profile-avatar-empty')
    this.openChangePassword = page.getByTestId('open-change-password')
    this.changePasswordModal = page.getByTestId('change-password-modal')
    this.currentPassword = page.getByTestId('profile-current-password')
    this.currentPasswordToggle = page.getByTestId('profile-current-password-toggle')
    this.newPassword = page.getByTestId('profile-new-password')
    this.newPasswordToggle = page.getByTestId('profile-new-password-toggle')
    this.confirmPassword = page.getByTestId('profile-confirm-password')
    this.confirmPasswordToggle = page.getByTestId('profile-confirm-password-toggle')
    this.revokeOthers = page.getByTestId('profile-revoke-others')
    this.changePassword = page.getByTestId('profile-change-password')
    this.passwordChanged = page.getByTestId('profile-password-changed')
    this.error = page.getByTestId('profile-error')
    this.signOut = page.getByTestId('profile-sign-out')
    this.signOutAll = page.getByTestId('profile-sign-out-all')
    this.deleteAccount = page.getByTestId('profile-delete-account')
    this.deleteModal = page.getByTestId('delete-account-modal')
    this.deleteWarning = page.getByTestId('delete-account-warning')
    this.deleteConfirm = page.getByTestId('profile-delete-confirm')
    this.deleteConfirmHint = page.getByTestId('delete-account-confirm-hint')
    this.deletePassword = page.getByTestId('profile-delete-password')
    this.deleteSubmit = page.getByTestId('profile-delete-submit')
    this.deleteSpinner = page.getByTestId('delete-submit-spinner')
    this.deleteMailConfirm = page.getByTestId('delete-account-mail-confirm')
    this.deleteCancel = page.getByTestId('delete-account-cancel')
    this.deleteError = page.getByTestId('profile-delete-error')
    this.deleteMailSent = page.getByTestId('delete-account-sent')
    this.deleteMailTo = page.getByTestId('delete-account-mail-to')
    this.deleteClose = page.getByTestId('delete-account-close')
    this.openSetPassword = page.getByTestId('open-set-password')
    this.setPasswordHint = page.getByTestId('set-password-hint')
  }

  async goto(path = '/profile'): Promise<void> {
    await this.page.goto(path)
  }
}
