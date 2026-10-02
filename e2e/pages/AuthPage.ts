import { expect, type Locator, type Page } from '@playwright/test'

/**
 * Page object for the auth surfaces: the login/register page, the navbar
 * account control, and the gated area body. Selectors live here, never inline
 * in a spec, so a markup change is one fix.
 */
export class AuthPage {
  readonly page: Page
  readonly navbar: Locator
  readonly heading: Locator
  readonly signInTab: Locator
  readonly signUpTab: Locator
  readonly name: Locator
  readonly email: Locator
  readonly password: Locator
  readonly passwordToggle: Locator
  readonly confirmPassword: Locator
  readonly confirmPasswordToggle: Locator
  readonly submit: Locator
  readonly submitSpinner: Locator
  readonly error: Locator
  readonly notice: Locator
  readonly verifyPanel: Locator
  readonly verifyEmail: Locator
  readonly resend: Locator
  readonly resendSent: Locator
  readonly backToSignIn: Locator
  readonly forgot: Locator
  
  readonly forgotPanel: Locator
  readonly forgotEmail: Locator
  readonly sendCode: Locator
  readonly resetPanel: Locator
  readonly resetHint: Locator
  /** The four square code inputs (same testid on each; index = position). */
  readonly resetCodeInputs: Locator
  readonly resetCode: Locator
  readonly resetNewPassword: Locator
  readonly resetConfirmPassword: Locator
  readonly resetSubmit: Locator
  readonly resetVerify: Locator
  readonly resetDone: Locator
  readonly footer: Locator
  readonly navLogin: Locator
  readonly navAccount: Locator
  readonly navAvatar: Locator
  readonly navAvatarImg: Locator
  readonly navAvatarEmpty: Locator
  readonly navAccountMenu: Locator
  readonly navAccountTheme: Locator
  readonly navAccountSignin: Locator
  readonly navAccountProfile: Locator
  readonly navAccountSignout: Locator
  readonly socialButtons: Locator
  readonly socialGoogle: Locator
  readonly orEmail: Locator
  readonly gatedTitle: Locator
  readonly gatedSession: Locator
  readonly gatedSignOut: Locator

  constructor(page: Page) {
    this.page = page
    this.navbar = page.getByTestId('navbar')
    this.heading = page.getByRole('heading', { level: 1 })
    this.signInTab = page.getByTestId('auth-tab-signin')
    this.signUpTab = page.getByTestId('auth-tab-signup')
    this.name = page.getByTestId('auth-name')
    this.email = page.getByTestId('auth-email')
    this.password = page.getByTestId('auth-password')
    this.passwordToggle = page.getByTestId('auth-password-toggle')
    this.confirmPassword = page.getByTestId('auth-confirm-password')
    this.confirmPasswordToggle = page.getByTestId('auth-confirm-password-toggle')
    this.submit = page.getByTestId('auth-submit')
    this.submitSpinner = page.getByTestId('auth-submit-spinner')
    this.error = page.getByTestId('auth-error')
    this.notice = page.getByTestId('auth-notice')
    this.verifyPanel = page.getByTestId('auth-verify-panel')
    this.verifyEmail = page.getByTestId('auth-verify-email')
    this.resend = page.getByTestId('auth-resend')
    this.resendSent = page.getByTestId('auth-resend-sent')
    this.backToSignIn = page.getByTestId('auth-back-to-signin')
    this.forgot = page.getByTestId('auth-forgot')
    
    this.forgotPanel = page.getByTestId('auth-forgot-panel')
    this.forgotEmail = this.forgotPanel.getByTestId('auth-email')
    this.sendCode = page.getByTestId('auth-send-code')
    this.resetPanel = page.getByTestId('auth-reset-panel')
    this.resetHint = page.getByTestId('auth-reset-hint')
    this.resetCodeInputs = page.getByTestId('auth-otp')
    this.resetCode = this.resetCodeInputs.first()
    this.resetNewPassword = page.getByTestId('auth-new-password')
    this.resetConfirmPassword = page.getByTestId('auth-confirm-password')
    this.resetSubmit = page.getByTestId('auth-reset-submit')
    this.resetVerify = page.getByTestId('auth-reset-verify')
    this.resetDone = page.getByTestId('auth-reset-done')
    this.footer = page.locator('footer.footer')
    this.navLogin = page.getByTestId('nav-login')
    this.navAccount = page.getByTestId('nav-account')
    this.navAvatar = page.getByTestId('nav-avatar')
    this.navAvatarImg = page.getByTestId('nav-avatar-img')
    this.navAvatarEmpty = page.getByTestId('nav-avatar-empty')
    this.navAccountMenu = page.getByTestId('nav-account-menu')
    this.navAccountTheme = page.getByTestId('nav-account-theme')
    this.navAccountSignin = page.getByTestId('nav-account-signin')
    this.navAccountProfile = page.getByTestId('nav-account-profile')
    this.navAccountSignout = page.getByTestId('nav-account-signout')
    this.socialButtons = page.getByTestId('auth-social-buttons')
    this.socialGoogle = page.getByTestId('auth-social-google')
    this.orEmail = page.getByTestId('auth-or-email')
    this.gatedTitle = page.getByTestId('gated-title')
    this.gatedSession = page.getByTestId('gated-session')
    this.gatedSignOut = page.getByTestId('gated-sign-out')
  }

  async goto(path = '/login'): Promise<void> {
    await this.page.goto(path)
  }

  async switchToSignUp(): Promise<void> {
    await this.signUpTab.click()
    await expect(this.name).toBeVisible()
  }

  async signUp(name: string, email: string, password: string): Promise<void> {
    await this.name.fill(name)
    await this.email.fill(email)
    await this.password.fill(password)
    await this.confirmPassword.fill(password)
    await this.submit.click()
  }

  /**
   * The computed text-align of a field, read as a string expression because
   * the e2e tsconfig has no DOM lib. Asserts what the reader actually sees:
   * which edge their typed text starts from.
   */
  async textAlignOf(locator: Locator): Promise<string> {
    const testId = await locator.getAttribute('data-testid')
    return this.page.evaluate(
      `(() => getComputedStyle(document.querySelector('[data-testid="${testId}"]')).textAlign)()`,
    )
  }

  async signIn(email: string, password: string): Promise<void> {
    await this.email.fill(email)
    await this.password.fill(password)
    await this.submit.click()
  }

  /** Steps of the password-reset flow, all inside the single login card. */
  async openReset(): Promise<void> {
    await this.forgot.click()
    await expect(this.forgotPanel).toBeVisible()
  }

  async requestResetCode(email: string): Promise<void> {
    await this.forgotEmail.fill(email)
    await this.sendCode.click()
    await expect(this.resetPanel).toBeVisible()
  }

  /**
   * Delivers a whole code to one box in a single change event, the way a
   * clipboard paste or the OS one-time-code autofill does. keyboard.insertText
   * goes through the browser's own input handling (so the box's constraints
   * apply), unlike fill(), which sets the value directly.
   */
  async insertResetCode(code: string, index = 0): Promise<void> {
    await this.resetCodeInputs.nth(index).click()
    await this.page.keyboard.insertText(code)
  }

  /**
   * Stage 1: type the code across the four boxes and press verify, which is
   * what swaps them for the password fields.
   */
  async verifyResetCode(code: string): Promise<void> {
    const digits = code.replace(/\D/g, '').slice(0, 4).split('')
    for (const [index, digit] of digits.entries()) {
      await this.resetCodeInputs.nth(index).fill(digit)
    }
    await this.resetVerify.click()
  }

  async submitResetCode(code: string, newPassword: string): Promise<void> {
    // Type the code across the four square inputs the way a user does: a
    // digit per box (typing into the group auto-advances, so a straight
    // pressSequentially on the first box also lands; fill per box is the
    // deterministic path a paste would end in).
    await this.verifyResetCode(code)
    await this.resetNewPassword.fill(newPassword)
    await this.resetConfirmPassword.fill(newPassword)
    await this.resetSubmit.click()
  }

  /**
   * The forgot-password link's edges against the email field's, in CSS pixels:
   * which edge of the card it sits flush with. Measured rather than read off a
   * dir attribute, so it catches a layout that does not actually mirror.
   */
  async forgotLinkAlignment(): Promise<{
    forgotLeft: number
    forgotRight: number
    fieldLeft: number
    fieldRight: number
  }> {
    const measure = async (locator: Locator) => {
      const box = await locator.boundingBox()
      const left = box?.x ?? 0
      return { left, right: left + (box?.width ?? 0) }
    }
    const forgot = await measure(this.forgot)
    const field = await measure(this.email)
    return {
      forgotLeft: forgot.left,
      forgotRight: forgot.right,
      fieldLeft: field.left,
      fieldRight: field.right,
    }
  }

  /** Opens the signed-in account menu (hover, as a desktop user would). */
  async openAccountMenu(): Promise<void> {
    await this.navAvatar.hover()
    await expect(this.navAccountMenu).toBeVisible()
  }
}
