import { expect, serveQuotes, test } from '../../fixtures'
import { AuthPage } from '../../pages/AuthPage'
import {
  mockGetSessionNull,
  mockRequestPasswordReset,
  mockSocialSignIn,
  mockResetPasswordSuccess,
  mockSendVerificationEmail,
  mockSignInInvalid,
  mockSignInSlow,
  mockSignInSuccess,
  mockSignUpAutoSignedIn,
  mockSignUpSuccess,
  mockVerifyResetCode,
} from '../../support/authMocks'

const HEBREW_PAGE_TITLE = 'התחברות או הרשמה'
const ENGLISH_PAGE_TITLE = 'Sign in or register'
const HEBREW_PASSWORD_MISMATCH = 'הסיסמאות אינן תואמות'
const HEBREW_BAD_CREDENTIALS = 'כתובת הדוא״ל או הסיסמה שגויים'
const HEBREW_PASSWORD_TOO_SHORT = 'הסיסמה חייבת להכיל לפחות 8 תווים'
const HEBREW_VERIFY_SENT = 'שלחנו הודעת אימות לכתובת הדוא״ל. יש לאמת אותה לפני ההתחברות.'
const HEBREW_RESET_SENT = 'שלחנו קוד בן 4 ספרות לכתובת הזו:'
const HEBREW_RESET_INVALID_CODE = 'הקוד שגוי או שפג תוקפו'
const HEBREW_RESET_DONE = 'הסיסמה עודכנה. אפשר להתחבר עם הסיסמה החדשה.'

test.describe('auth pages', () => {
  test.beforeEach(async ({ mockedPage }) => {
    // Keep the chrome's live strips off the network; these tests are about auth.
    await serveQuotes(mockedPage, [])
    await mockGetSessionNull(mockedPage)
  })

  test('renders the sign-in form in both locales', async ({ mockedPage }) => {
    const auth = new AuthPage(mockedPage)

    await auth.goto('/login')
    await expect(auth.heading).toHaveText(HEBREW_PAGE_TITLE)
    await expect(auth.signInTab).toHaveAttribute('aria-selected', 'true')

    await auth.goto('/en/login')
    await expect(auth.heading).toHaveText(ENGLISH_PAGE_TITLE)
  })

  for (const viewport of [
    { width: 360, height: 800, tag: '360' },
    { width: 1280, height: 900, tag: '1280' },
  ]) {
    test(`the sign-in card starts below the fixed chrome - ${viewport.tag}px`, async ({
      mockedPage,
    }) => {
      const auth = new AuthPage(mockedPage)
      await mockedPage.setViewportSize({ width: viewport.width, height: viewport.height })
      await auth.goto('/login')

      const chrome = await auth.navbar.boundingBox()
      const heading = await auth.heading.boundingBox()
      expect(chrome).not.toBeNull()
      expect(heading).not.toBeNull()
      // The card is the first thing on the page (no hero banner behind the
      // chrome), so its title must clear the strips + navbar entirely - the
      // form used to start underneath them and hide its own tabs/title.
      expect(heading!.y).toBeGreaterThanOrEqual(chrome!.y + chrome!.height)
    })
  }

  test('the fields start at the page start edge, in both directions', async ({ mockedPage }) => {
    // Hard-coding dir="ltr" on the email/password fields made Hebrew typing
    // start at the wrong edge. The contract now is "no dir override, and
    // align to start": the browser resolves `start` against the document
    // direction, so the same rule puts the text on the right in Hebrew and on
    // the left in English.
    const auth = new AuthPage(mockedPage)

    for (const [path, heading] of [
      ['/login', HEBREW_PAGE_TITLE],
      ['/en/login', ENGLISH_PAGE_TITLE],
    ] as const) {
      await auth.goto(path)
      await expect(auth.heading).toHaveText(heading)
      for (const field of [auth.email, auth.password]) {
        await expect(field).not.toHaveAttribute('dir')
        expect(await auth.textAlignOf(field)).toBe('start')
      }
    }
  })

  test('switching to sign-up reveals the name and confirmation fields', async ({ mockedPage }) => {
    const auth = new AuthPage(mockedPage)
    await auth.goto('/login')

    await expect(auth.name).toHaveCount(0)
    await auth.switchToSignUp()
    await expect(auth.confirmPassword).toBeVisible()
  })

  test('the password fields can be revealed and masked again', async ({ mockedPage }) => {
    const auth = new AuthPage(mockedPage)
    await auth.goto('/login')

    await expect(auth.password).toHaveAttribute('type', 'password')
    await expect(auth.passwordToggle).toHaveAttribute('aria-pressed', 'false')
    await expect(auth.passwordToggle).toHaveAttribute('aria-label', 'הצגת סיסמה')

    await auth.password.fill('secret123')
    await auth.passwordToggle.click()
    await expect(auth.password).toHaveAttribute('type', 'text')
    await expect(auth.passwordToggle).toHaveAttribute('aria-pressed', 'true')
    await expect(auth.passwordToggle).toHaveAttribute('aria-label', 'הסתרת סיסמה')
    // Toggling reveals the same field, so the typed value is not lost.
    await expect(auth.password).toHaveValue('secret123')

    await auth.passwordToggle.click()
    await expect(auth.password).toHaveAttribute('type', 'password')

    // The sign-up confirmation field has its own, independent toggle.
    await auth.switchToSignUp()
    await expect(auth.confirmPassword).toHaveAttribute('type', 'password')
    await auth.confirmPasswordToggle.click()
    await expect(auth.confirmPassword).toHaveAttribute('type', 'text')
    await expect(auth.password).toHaveAttribute('type', 'password')
  })

  test('rejects mismatched passwords locally, in the page language', async ({ mockedPage }) => {
    const auth = new AuthPage(mockedPage)
    await auth.goto('/login')
    await auth.switchToSignUp()

    await auth.name.fill('Test User')
    await auth.email.fill('user@example.test')
    await auth.password.fill('password123')
    await auth.confirmPassword.fill('password124')
    await auth.submit.click()

    await expect(auth.error).toHaveText(HEBREW_PASSWORD_MISMATCH)
  })

  test('shows a localized error for wrong credentials', async ({ mockedPage }) => {
    await mockSignInInvalid(mockedPage)
    const auth = new AuthPage(mockedPage)

    await auth.goto('/login')
    await auth.signIn('user@example.test', 'password123')

    await expect(auth.error).toHaveText(HEBREW_BAD_CREDENTIALS)
  })

  test('replaces the form with a confirmation state after a successful sign-up', async ({
    mockedPage,
  }) => {
    await mockSignUpSuccess(mockedPage)
    const auth = new AuthPage(mockedPage)

    await auth.goto('/login')
    await auth.switchToSignUp()
    await auth.signUp('Test User', 'user@example.test', 'password123')

    await expect(auth.notice).toHaveText(HEBREW_VERIFY_SENT)
    await expect(auth.verifyPanel).toBeVisible()
    // The address the mail went to is spelled out, and the form is gone, so
    // the sign-up does not silently reset to an empty sign-in tab.
    await expect(auth.verifyEmail).toHaveText('user@example.test')
    await expect(auth.submit).toHaveCount(0)

    // The confirmation offers a way back to the form.
    await auth.backToSignIn.click()
    await expect(auth.submit).toBeVisible()
    await expect(auth.verifyPanel).toHaveCount(0)
  })

  test('re-sends the verification email from the confirmation state', async ({ mockedPage }) => {
    await mockSignUpSuccess(mockedPage)
    await mockSendVerificationEmail(mockedPage)
    const auth = new AuthPage(mockedPage)

    await auth.goto('/login')
    await auth.switchToSignUp()
    await auth.signUp('Test User', 'user@example.test', 'password123')

    await auth.resend.click()
    await expect(auth.resendSent).toBeVisible()
  })

  test('continues into the app when sign-up also creates a session', async ({ mockedPage }) => {
    // Verification is not required when the server cannot send mail: the new
    // account is signed in immediately, so there is nothing to confirm.
    await mockSignUpAutoSignedIn(mockedPage)
    const auth = new AuthPage(mockedPage)

    await auth.goto('/login')
    await auth.switchToSignUp()
    await auth.signUp('Test User', 'user@example.test', 'password123')

    await expect(mockedPage).toHaveURL(/\/$/)
    await expect(auth.verifyPanel).toHaveCount(0)
  })

  test('the submit button shows a loading state while the request is in flight', async ({
    mockedPage,
  }) => {
    await mockSignInSlow(mockedPage)
    const auth = new AuthPage(mockedPage)

    await auth.goto('/login')
    await auth.email.fill('user@example.test')
    await auth.password.fill('password123')

    // The idle box is captured so the swap to the spinner can be checked for
    // layout shift: the label leaves the DOM, so it is the box that has to
    // stay put.
    const idleBox = await auth.submit.boundingBox()
    await auth.submit.click()

    // A spinning glyph plus aria-busy, and the control is locked while it
    // sends - the same affordance on the sign-in and sign-up paths.
    await expect(auth.submit).toHaveAttribute('aria-busy', 'true')
    await expect(auth.submitSpinner).toBeVisible()
    await expect(auth.submit).toBeDisabled()

    // Spinner only: the label is gone while it sends, and the accessible name
    // comes from aria-label instead.
    await expect(auth.submit).not.toContainText('התחברות')
    await expect(auth.submit).toHaveAttribute('aria-label', 'שולח...')

    const busy = (await mockedPage.evaluate(`(() => {
      const button = document.querySelector('[data-testid="auth-submit"]')
      const box = button.getBoundingClientRect()
      const spinner = getComputedStyle(
        document.querySelector('[data-testid="auth-submit-spinner"]'),
      )
      const sweep = getComputedStyle(button, '::after')
      return {
        spin: spinner.animationName,
        sweep: sweep.animationName,
        sweepRepeat: sweep.animationIterationCount,
        width: Math.round(box.width),
        height: Math.round(box.height),
      }
    })()`)) as {
      spin: string
      sweep: string
      sweepRepeat: string
      width: number
      height: number
    }

    expect(busy.spin).toBe('spin')
    // The sheen crosses the button for as long as it is in flight.
    expect(busy.sweep).toBe('btn-sheen')
    expect(busy.sweepRepeat).toBe('infinite')
    // No layout shift from dropping the label for the spinner.
    expect(busy.width).toBe(Math.round(idleBox!.width))
    expect(busy.height).toBe(Math.round(idleBox!.height))

    await expect(mockedPage).toHaveURL(/\/$/)
  })

  test('the in-flight sheen is dropped under reduced motion', async ({ mockedPage }) => {
    await mockedPage.emulateMedia({ reducedMotion: 'reduce' })
    await mockSignInSlow(mockedPage)
    const auth = new AuthPage(mockedPage)

    await auth.goto('/login')
    await auth.email.fill('user@example.test')
    await auth.password.fill('password123')
    await auth.submit.click()

    await expect(auth.submit).toHaveAttribute('aria-busy', 'true')
    // Still visibly busy (spinner + aria-busy), just not animated sideways.
    await expect(auth.submitSpinner).toBeVisible()
    const sweep = await mockedPage.evaluate(
      `getComputedStyle(document.querySelector('[data-testid="auth-submit"]'), '::after').animationName`,
    )
    expect(sweep).toBe('none')
  })

  test('the form controls carry a hover state', async ({ mockedPage }) => {
    const auth = new AuthPage(mockedPage)
    await auth.goto('/login')

    const style = (testId: string, prop: string) =>
      mockedPage.evaluate(
        `getComputedStyle(document.querySelector('[data-testid="${testId}"]')).${prop}`,
      ) as Promise<string>

    // The submit fill reacts to the pointer...
    const submitIdle = await style('auth-submit', 'backgroundColor')
    await auth.submit.hover()
    await expect
      .poll(() => style('auth-submit', 'backgroundColor'))
      .not.toBe(submitIdle)

    // ...and so does an inactive tab (it takes the soft surface fill).
    const tabIdle = await style('auth-tab-signup', 'backgroundColor')
    await auth.signUpTab.hover()
    await expect.poll(() => style('auth-tab-signup', 'backgroundColor')).not.toBe(tabIdle)
  })

  test('is a full-bleed surface with no footer', async ({ mockedPage }) => {
    const auth = new AuthPage(mockedPage)
    await mockedPage.setViewportSize({ width: 1280, height: 900 })
    await auth.goto('/login')

    // The sign-in surface has no page content to scroll past, so the chrome's
    // footer is not rendered here at all (the other routes keep theirs).
    await expect(auth.footer).toHaveCount(0)

    const shell = (await mockedPage.evaluate(`(() => {
      const main = document.querySelector('main.auth-page')
      const box = main.getBoundingClientRect()
      return { height: Math.round(box.height), backdrop: getComputedStyle(main).backgroundImage }
    })()`)) as { height: number; backdrop: string }
    // The photo backdrop covers the whole viewport...
    expect(shell.height).toBeGreaterThanOrEqual(900)
    expect(shell.backdrop).toContain('/images/login-cover.jpg')

    // ...and the card still clears the fixed chrome inside it.
    const chrome = await auth.navbar.boundingBox()
    const heading = await auth.heading.boundingBox()
    expect(heading!.y).toBeGreaterThanOrEqual(chrome!.y + chrome!.height)
  })

  test('navigates onward after a successful sign-in', async ({ mockedPage }) => {
    await mockSignInSuccess(mockedPage)
    const auth = new AuthPage(mockedPage)

    await auth.goto('/en/login')
    await auth.signIn('user@example.test', 'password123')

    await expect(mockedPage).toHaveURL(/\/en$/)
  })

  test('offers a sign-in item in the account menu when signed out', async ({ mockedPage }) => {
    const auth = new AuthPage(mockedPage)

    await mockedPage.goto('/')
    // Same circular trigger as the signed-in avatar; the sign-in entry lives
    // in the menu under the language and color-mode rows.
    await expect(auth.navAccount).toBeVisible()
    await expect(auth.navAvatarEmpty).toBeVisible()
    await expect(auth.navLogin).toHaveCount(0)

    await auth.navAvatar.hover()
    await expect(auth.navAccountMenu).toBeVisible()
    await expect(auth.navAccountTheme).toBeVisible()
    await expect(auth.navAccountSignin).toBeVisible()

    await auth.navAccountSignin.click()
    await expect(mockedPage).toHaveURL(/\/login$/)
  })
})

test.describe('password reset', () => {
  test.beforeEach(async ({ mockedPage }) => {
    await serveQuotes(mockedPage, [])
    await mockGetSessionNull(mockedPage)
  })

  test('asks for a code from the sign-in form, carrying the typed address over', async ({
    mockedPage,
  }) => {
    await mockRequestPasswordReset(mockedPage)
    const auth = new AuthPage(mockedPage)

    await auth.goto('/login')
    await auth.email.fill('user@example.test')
    await auth.openReset()

    // The card is replaced by the request panel, and the address already typed
    // on the sign-in tab is what the code is requested for.
    await expect(auth.submit).toHaveCount(0)
    await expect(auth.forgotEmail).toHaveValue('user@example.test')

    await auth.sendCode.click()

    await expect(auth.resetPanel).toBeVisible()
    await expect(auth.resetHint).toContainText(HEBREW_RESET_SENT)
    await expect(auth.resetHint).toContainText('user@example.test')
    await expect(auth.resetCode).toBeVisible()
  })

  test('the password fields wait for a verified code', async ({ mockedPage }) => {
    await mockRequestPasswordReset(mockedPage)
    await mockVerifyResetCode(mockedPage, (otp) => otp === '1234')
    const auth = new AuthPage(mockedPage)

    await auth.goto('/login')
    await auth.openReset()
    await auth.requestResetCode('user@example.test')

    // Stage one is the code alone: nothing to type a password into yet, and no
    // submit control that could not possibly succeed.
    await expect(auth.resetNewPassword).toHaveCount(0)
    await expect(auth.resetConfirmPassword).toHaveCount(0)
    await expect(auth.resetSubmit).toHaveCount(0)
    await expect(auth.resetVerify).toBeDisabled()

    // Three digits is not a code, so there is still nothing to verify.
    for (const [index, digit] of ['1', '2', '3'].entries()) {
      await auth.resetCodeInputs.nth(index).fill(digit)
    }
    await expect(auth.resetVerify).toBeDisabled()
    await expect(auth.resetNewPassword).toHaveCount(0)

    // A wrong code: the error replaces the fields, the boxes stay to fix.
    await auth.resetCodeInputs.nth(3).fill('9')
    await auth.resetVerify.click()
    await expect(auth.error).toHaveText(HEBREW_RESET_INVALID_CODE)
    await expect(auth.resetCode).toBeVisible()
    await expect(auth.resetNewPassword).toHaveCount(0)

    // The right code swaps the boxes for the password fields.
    await auth.verifyResetCode('1234')
    await expect(auth.resetCodeInputs).toHaveCount(0)
    await expect(auth.error).toHaveCount(0)
    await expect(auth.resetNewPassword).toBeVisible()
    await expect(auth.resetConfirmPassword).toBeVisible()
    await expect(auth.resetSubmit).toBeVisible()
    await expect(auth.resetVerify).toHaveCount(0)
    // The code is in; "we emailed a code to..." is history and would push the
    // fields down the card.
    await expect(auth.resetHint).toHaveCount(0)
  })

  test('the heading names the reset flow, not sign-in or register', async ({ mockedPage }) => {
    await mockRequestPasswordReset(mockedPage)
    await mockVerifyResetCode(mockedPage)
    const auth = new AuthPage(mockedPage)

    await auth.goto('/login')
    // The credentials screen still calls itself sign-in/register...
    await expect(auth.heading).toHaveText(HEBREW_PAGE_TITLE)

    await auth.openReset()
    // ...but asking for a code is a password reset, and the header says so
    // rather than sitting above a contradicting one.
    await expect(auth.heading).toHaveText('איפוס סיסמה')
    // The panel must not repeat it as a second heading.
    await expect(auth.resetPanel.getByRole('heading')).toHaveCount(0)

    await auth.requestResetCode('user@example.test')
    await expect(auth.heading).toHaveText('איפוס סיסמה')
    await expect(auth.resetHint).toBeVisible()

    // Still one heading after the swap to the password stage.
    await auth.verifyResetCode('1234')
    await expect(auth.heading).toHaveText('איפוס סיסמה')
    await expect(auth.resetPanel.getByRole('heading')).toHaveCount(0)
  })

  test('the forgot-password link is absent on the sign-up tab', async ({ mockedPage }) => {
    const auth = new AuthPage(mockedPage)
    await auth.goto('/login')

    await expect(auth.forgot).toBeVisible()
    await auth.switchToSignUp()
    await expect(auth.forgot).toHaveCount(0)
  })

  test('the forgot-password link sits on the start edge, and mirrors in Hebrew', async ({
    mockedPage,
  }) => {
    const auth = new AuthPage(mockedPage)

    // English page: LTR, so the link starts flush with the fields' left edge.
    await auth.goto('/en/login')
    const english = await auth.forgotLinkAlignment()
    expect(Math.abs(english.forgotLeft - english.fieldLeft)).toBeLessThanOrEqual(1)

    // Hebrew page: the document is RTL (direction follows the locale - see
    // src/app/(he)/layout.tsx), so the link starts flush with the fields'
    // RIGHT edge instead. A left/right that did not flip fails here.
    await auth.goto('/login')
    const hebrew = await auth.forgotLinkAlignment()
    expect(Math.abs(hebrew.forgotRight - hebrew.fieldRight)).toBeLessThanOrEqual(1)
  })

  test('the code is four square inputs that keep digits only', async ({ mockedPage }) => {
    await mockRequestPasswordReset(mockedPage)
    const auth = new AuthPage(mockedPage)

    await auth.goto('/login')
    await auth.openReset()
    await auth.requestResetCode('user@example.test')

    // One square per digit, exactly four.
    await expect(auth.resetCodeInputs).toHaveCount(4)

    // A non-digit never reaches a box.
    await auth.resetCodeInputs.nth(0).fill('a')
    await expect(auth.resetCodeInputs.nth(0)).toHaveValue('')

    await auth.resetCodeInputs.nth(0).fill('1')
    await auth.resetCodeInputs.nth(1).fill('2')
    await auth.resetCodeInputs.nth(2).fill('3')
    await auth.resetCodeInputs.nth(3).fill('4')
    for (const [index, digit] of ['1', '2', '3', '4'].entries()) {
      await expect(auth.resetCodeInputs.nth(index)).toHaveValue(digit)
    }
  })

  test('keeps a digit typed into a later box in that box', async ({ mockedPage }) => {
    await mockRequestPasswordReset(mockedPage)
    const auth = new AuthPage(mockedPage)

    await auth.goto('/login')
    await auth.openReset()
    await auth.requestResetCode('user@example.test')

    // A box filled on its own must not collapse toward the start: the boxes
    // before it stay empty and the digit stays where the user put it.
    await auth.resetCodeInputs.nth(2).fill('7')
    await expect(auth.resetCodeInputs.nth(2)).toHaveValue('7')
    await expect(auth.resetCodeInputs.nth(0)).toHaveValue('')
  })

  test('a code dropped into the first box spreads across all four', async ({ mockedPage }) => {
    await mockRequestPasswordReset(mockedPage)
    const auth = new AuthPage(mockedPage)

    await auth.goto('/login')
    await auth.openReset()
    await auth.requestResetCode('user@example.test')

    // One change event carrying the whole string: a pasted code, or the OS
    // one-time-code autofill on a phone. Five digits for four boxes, so the
    // assertion also tells this apart from four separate keystrokes: typing
    // them one by one would put the last digit in the last box (1235), while
    // one change event keeps the first four and drops the overflow.
    await auth.insertResetCode('12345')
    for (const [index, digit] of ['1', '2', '3', '4'].entries()) {
      await expect(auth.resetCodeInputs.nth(index)).toHaveValue(digit)
    }
  })

  test('shows a localized error for a wrong code', async ({ mockedPage }) => {
    await mockRequestPasswordReset(mockedPage)
    await mockVerifyResetCode(mockedPage, (otp) => otp === '1234')
    const auth = new AuthPage(mockedPage)

    await auth.goto('/login')
    await auth.openReset()
    await auth.requestResetCode('user@example.test')
    await auth.verifyResetCode('0000')

    await expect(auth.error).toHaveText(HEBREW_RESET_INVALID_CODE)
    // The panel stays put, so the code can be corrected without re-requesting.
    // (The four boxes are one locator: assert on the first one.)
    await expect(auth.resetCode).toBeVisible()
  })

  test('rejects a short new password before it reaches the server', async ({ mockedPage }) => {
    await mockRequestPasswordReset(mockedPage)
    await mockVerifyResetCode(mockedPage)
    await mockResetPasswordSuccess(mockedPage)
    const auth = new AuthPage(mockedPage)

    await auth.goto('/login')
    await auth.openReset()
    await auth.requestResetCode('user@example.test')
    await auth.submitResetCode('1234', 'short')

    await expect(auth.error).toHaveText(HEBREW_PASSWORD_TOO_SHORT)
    await expect(mockedPage).toHaveURL(/\/login$/)
  })

  test('confirms the reset and returns the user to the sign-in form', async ({ mockedPage }) => {
    await mockRequestPasswordReset(mockedPage)
    await mockVerifyResetCode(mockedPage)
    await mockResetPasswordSuccess(mockedPage)
    const auth = new AuthPage(mockedPage)

    await auth.goto('/login')
    await auth.openReset()
    await auth.requestResetCode('user@example.test')
    await auth.submitResetCode('1234', 'password123')

    // The card is back on the sign-in form, with a confirmation status, the
    // address carried over and the password fields cleared.
    await expect(auth.resetDone).toHaveText(HEBREW_RESET_DONE)
    await expect(auth.submit).toBeVisible()
    await expect(auth.resetSubmit).toHaveCount(0)
    await expect(auth.resetVerify).toHaveCount(0)
    await expect(auth.email).toHaveValue('user@example.test')
    await expect(auth.password).toHaveValue('')
  })

  test('the reset panel fits a 360px phone in both stages', async ({ mockedPage }) => {
    await mockRequestPasswordReset(mockedPage)
    await mockVerifyResetCode(mockedPage)
    const auth = new AuthPage(mockedPage)
    await mockedPage.setViewportSize({ width: 360, height: 800 })

    const assertInside = async (controls: Locator[]) => {
      const overflow = (await mockedPage.evaluate(
        'document.documentElement.scrollWidth - document.documentElement.clientWidth',
      )) as number
      expect(overflow, 'horizontal overflow').toBeLessThanOrEqual(1)
      for (const control of controls) {
        const box = await control.boundingBox()
        expect(box).not.toBeNull()
        expect(box!.width).toBeGreaterThan(0)
        expect(box!.x).toBeGreaterThanOrEqual(0)
        expect(box!.x + box!.width).toBeLessThanOrEqual(360)
      }
    }

    await auth.goto('/login')
    await auth.openReset()
    await auth.requestResetCode('user@example.test')

    // Stage one: the boxes and the verify control.
    await assertInside([...[0, 1, 2, 3].map((index) => auth.resetCodeInputs.nth(index)), auth.resetVerify])

    // Stage two: the two fields and the submit, which only exist after verify.
    await auth.verifyResetCode('1234')
    await assertInside([auth.resetNewPassword, auth.resetSubmit])
  })

  test('the reset panel works in the English locale too', async ({ mockedPage }) => {
    await mockRequestPasswordReset(mockedPage)
    await mockVerifyResetCode(mockedPage)
    await mockResetPasswordSuccess(mockedPage)
    const auth = new AuthPage(mockedPage)

    await auth.goto('/en/login')
    await auth.openReset()
    await auth.requestResetCode('user@example.test')
    await auth.submitResetCode('1234', 'password123')

    await expect(auth.resetDone).toHaveText(
      'Your password has been updated. You can now sign in with the new password.',
    )
  })

  test('renders one button per provider this deployment enables', async ({ mockedPage }) => {
    // The list the app under test was built with (playwright.config.ts): CI has
    // no provider credentials, a developer machine usually has Google's.
    const enabled = (process.env.E2E_SOCIAL_PROVIDERS ?? '').split(',').filter(Boolean)
    const auth = new AuthPage(mockedPage)

    await auth.goto('/en/login')

    // A provider without credentials must never be advertised, because its
    // OAuth handshake would fail. The email form stays a path either way, and
    // the forgot link keeps its place in the row.
    await expect(auth.socialButtons).toHaveCount(enabled.length > 0 ? 1 : 0)
    await expect(auth.socialGoogle).toHaveCount(enabled.includes('google') ? 1 : 0)
    await expect(auth.forgot).toBeVisible()

    if (!enabled.includes('google')) return

    // The brand label carries no "Continue with": the provider name alone,
    // untranslated, beside its icon.
    await expect(auth.socialGoogle).toHaveText('Google')

    // The "or ... with email" rule sits BELOW the button, introducing the
    // email form that follows.
    const rule = (await auth.orEmail.boundingBox())!
    const buttonBox = (await auth.socialGoogle.boundingBox())!
    expect(rule.y).toBeGreaterThanOrEqual(buttonBox.y + buttonBox.height)

    // Its copy names the form UNDER it, so it follows the tab rather than
    // describing sign-in above a registration form.
    await expect(auth.orEmail).toHaveText('or sign in with email')
    await auth.switchToSignUp()
    await expect(auth.orEmail).toHaveText('or sign up with email')

    // One button, laid out like the form's own full-width controls: it fills
    // the card and sits centered on it rather than hugging either side.
    const button = (await auth.socialGoogle.boundingBox())!
    const field = (await auth.email.boundingBox())!
    expect(Math.abs(button.width - field.width)).toBeLessThanOrEqual(1)
    expect(
      Math.abs(button.x + button.width / 2 - (field.x + field.width / 2)),
    ).toBeLessThanOrEqual(1)

    // Same copy rule in Hebrew, asserted verbatim: the sign-up tab reads
    // "or sign up with email", never the sign-in wording.
    await auth.goto('/login')
    await expect(auth.orEmail).toHaveText('או התחברות עם דוא״ל')
    await auth.switchToSignUp()
    await expect(auth.orEmail).toHaveText('או הרשמה עם דוא״ל')
    await auth.goto('/login')

    // The icon keeps the button's start edge in both locales (the same LTR
    // row inside the button): the G sits LEFT of the word in Hebrew too.
    const internals = (await mockedPage.evaluate(`(() => {
      const button = document.querySelector('[data-testid="auth-social-google"]')
      if (!button) return null
      const icon = button.querySelector('svg')
      const label = button.querySelector('span:last-child span') ?? button.querySelector('span:last-child')
      if (!icon || !label) return null
      return {
        iconLeft: icon.getBoundingClientRect().left,
        labelLeft: label.getBoundingClientRect().left,
        docDir: document.documentElement.dir,
      }
    })()`)) as { iconLeft: number; labelLeft: number; docDir: string } | null
    expect(internals, 'button rendered with icon and label').not.toBeNull()
    expect(internals!.docDir).toBe('rtl')
    expect(internals!.iconLeft).toBeLessThan(internals!.labelLeft)

    // And it starts the provider handshake: the client asks the auth API for
    // Google. (The real round trip continues on Google's consent screen, which
    // a test browser cannot load, so the request is the assertion.)
    const handshake = mockedPage.waitForRequest('**/api/auth/sign-in/social')
    await mockSocialSignIn(mockedPage, 'google')
    await auth.socialGoogle.click()
    expect((await handshake).postDataJSON()).toMatchObject({ provider: 'google' })
  })
})

test.describe('gated areas', () => {
  test.beforeEach(async ({ mockedPage }) => {
    await serveQuotes(mockedPage, [])
    // get-session is intentionally NOT mocked: the real server-side check is
    // what these tests exercise.
  })

  test('sends a signed-out visitor from /advisor to the login page', async ({ mockedPage }) => {
    await mockedPage.goto('/advisor')
    await expect(mockedPage).toHaveURL(/\/login\?next=(%2F|\/)advisor$/)
  })

  test('sends a signed-out visitor from /client to the login page', async ({ mockedPage }) => {
    await mockedPage.goto('/client')
    await expect(mockedPage).toHaveURL(/\/login\?next=(%2F|\/)client$/)
  })

  test('redirects the English mirror to the English login page', async ({ mockedPage }) => {
    await mockedPage.goto('/en/client')
    await expect(mockedPage).toHaveURL(/\/en\/login\?next=(%2F|\/)client$/)
  })

  test('a forged session cookie does not pass the server-side check', async ({ mockedPage }) => {
    await mockedPage.context().addCookies([
      { name: 'better-auth.session_token', value: 'forged', domain: 'localhost', path: '/' },
    ])

    await mockedPage.goto('/advisor')

    // The proxy's optimistic cookie test lets the request through; the server
    // then looks the session up, finds nothing, and redirects. This is the
    // difference between "has a cookie" and "is authenticated".
    await expect(mockedPage).toHaveURL(/\/login\?next=(%2F|\/)advisor$/)
  })
})
