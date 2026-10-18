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
  /** The password step: the account proves itself before the code is mailed. */
  readonly deletePassword: Locator
  readonly deleteSubmit: Locator
  readonly deleteSpinner: Locator
  /** The second step: the mailed code is typed back in, one box per character. */
  readonly deleteCodeHeading: Locator
  /** Every box of the code field shares one test id (see CodeInput). */
  readonly deleteCodeInputs: Locator
  readonly deleteCode: Locator
  readonly deleteResend: Locator
  readonly deleteResendSent: Locator
  readonly deleteMailTo: Locator
  readonly deleteCancel: Locator
  readonly deleteError: Locator
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
    this.deleteCodeHeading = page.getByTestId('delete-account-code-heading')
    this.deleteCodeInputs = page.getByTestId('profile-delete-code')
    this.deleteCode = this.deleteCodeInputs.first()
    this.deleteResend = page.getByTestId('delete-account-resend')
    this.deleteResendSent = page.getByTestId('delete-account-resend-sent')
    this.deleteMailTo = page.getByTestId('delete-account-mail-to')
    this.deleteCancel = page.getByTestId('delete-account-cancel')
    this.deleteError = page.getByTestId('profile-delete-error')
    this.openSetPassword = page.getByTestId('open-set-password')
    this.setPasswordHint = page.getByTestId('set-password-hint')
  }

  async goto(path = '/profile'): Promise<void> {
    await this.page.goto(path)
  }

  /**
   * Delivers a whole code to one box in a single change event, the way a
   * clipboard paste or the OS one-time-code autofill does. keyboard.insertText
   * goes through the browser's own input handling, unlike fill(), which sets
   * the value directly and would not exercise the spread-across-boxes rules.
   */
  async insertDeleteCode(code: string, index = 0): Promise<void> {
    await this.deleteCodeInputs.nth(index).click()
    await this.page.keyboard.insertText(code)
  }
}
