import type { Page } from '@playwright/test'

/**
 * Deterministic intercepts for Better Auth's own endpoints. The UI specs use
 * these so the sign-in/sign-up flows can be exercised without touching the
 * database or the network; the gated-area specs deliberately do NOT mock
 * get-session, because there the real server-side check is the thing under
 * test.
 */

const USER = {
  id: 'test-user',
  email: 'user@example.test',
  name: 'Test User',
  emailVerified: false,
  role: 'client',
}

/** No session: Better Auth answers a literal JSON null with a 200. */
export function mockGetSessionNull(page: Page): Promise<void> {
  return page
    .route('**/api/auth/get-session*', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: 'null' }),
    )
    .then(() => undefined)
}

/** A signed-in session, for the chrome's signed-in state (avatar menu). */
export function mockGetSessionUser(
  page: Page,
  overrides: { image?: string | null; name?: string | null } = {},
): Promise<void> {
  const user = { ...USER, emailVerified: true, ...overrides }
  return page
    .route('**/api/auth/get-session*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          session: {
            id: 'test-session',
            token: 'test-session-token',
            userId: USER.id,
            expiresAt: '2099-01-01T00:00:00.000Z',
          },
          user,
        }),
      }),
    )
    .then(() => undefined)
}

export function mockSignInSuccess(page: Page): Promise<void> {
  return page
    .route('**/api/auth/sign-in/email', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ token: 'test-session', user: { ...USER, emailVerified: true } }),
      }),
    )
    .then(() => undefined)
}

export function mockSignInInvalid(page: Page): Promise<void> {
  return page
    .route('**/api/auth/sign-in/email', (route) =>
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'INVALID_EMAIL_OR_PASSWORD', message: 'Invalid email or password' }),
      }),
    )
    .then(() => undefined)
}

export function mockSignUpSuccess(page: Page): Promise<void> {
  return page
    .route('**/api/auth/sign-up/email', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ token: null, user: USER }),
      }),
    )
    .then(() => undefined)
}

/**
 * Sign-up where the server also signs the user in: the shape Better Auth
 * returns when email verification is NOT required (no mailer configured).
 */
export function mockSignUpAutoSignedIn(page: Page): Promise<void> {
  return page
    .route('**/api/auth/sign-up/email', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ token: 'test-session', user: { ...USER, emailVerified: true } }),
      }),
    )
    .then(() => undefined)
}

/**
 * Sign-out: answers the POST and flips the session lookup to signed-out for
 * every call AFTER it, the way the real server behaves (the session is gone
 * once the endpoint answers). Without the flip, a persistent signed-in
 * get-session mock makes the nav stay on the avatar forever.
 */
export function mockSignOut(page: Page): Promise<void> {
  return page
    .route('**/api/auth/sign-out', async (route) => {
      await page.unroute('**/api/auth/get-session*')
      await mockGetSessionNull(page)
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      })
    })
    .then(() => undefined)
}

/** Delayed sign-in: long enough for the button's loading state to be observed. */
export function mockSignInSlow(page: Page, delayMs = 1200): Promise<void> {
  return page
    .route('**/api/auth/sign-in/email', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, delayMs))
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ token: 'test-session', user: { ...USER, emailVerified: true } }),
      })
    })
    .then(() => undefined)
}

/**
 * The reset request. It answers success for any address (known or not), which
 * is exactly what the server does so the endpoint cannot be used to discover
 * which addresses have accounts.
 */
export function mockRequestPasswordReset(page: Page): Promise<void> {
  return page
    .route('**/api/auth/email-otp/request-password-reset', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      }),
    )
    .then(() => undefined)
}

/** Redeeming a valid code. */
export function mockResetPasswordSuccess(page: Page): Promise<void> {
  return page
    .route('**/api/auth/email-otp/reset-password', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      }),
    )
    .then(() => undefined)
}

/**
 * Stage 1 of the reset: the code is checked before the password fields appear.
 * `check` sees the posted otp so a spec can accept one code and reject another.
 */
export function mockVerifyResetCode(
  page: Page,
  check: (otp: string) => boolean = () => true,
): Promise<void> {
  return page
    .route('**/api/auth/email-otp/check-verification-otp', async (route) => {
      const otp = String((route.request().postDataJSON() as { otp?: string }).otp ?? '')
      if (check(otp)) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        })
        return
      }
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'INVALID_OTP', message: 'Invalid OTP' }),
      })
    })
    .then(() => undefined)
}

/** A wrong or expired code: Better Auth answers 400 with an INVALID_OTP code. */
export function mockResetPasswordInvalidCode(page: Page): Promise<void> {
  return page
    .route('**/api/auth/email-otp/reset-password', (route) =>
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'INVALID_OTP', message: 'Invalid OTP' }),
      }),
    )
    .then(() => undefined)
}

/**
 * Social sign-in. Better Auth's client POSTs to this endpoint and, when the
 * answer carries `redirect: true`, hands the page over to the returned URL.
 * That URL is the provider's own consent screen, so a browser in a test cannot
 * actually load it (it resolves to a network error page). The mock answers
 * with the URL but WITHOUT the redirect flag: nothing navigates, and the spec
 * asserts on the request instead - which provider was asked for.
 */
export function mockSocialSignIn(page: Page, provider: 'google'): Promise<void> {
  return page
    .route(`**/api/auth/sign-in/social`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ url: `https://provider.test/oauth/${provider}` }),
      }),
    )
    .then(() => undefined)
}

/** The resend-verification endpoint answers with a plain success message. */
export function mockSendVerificationEmail(page: Page): Promise<void> {
  return page
    .route('**/api/auth/send-verification-email', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: true }),
      }),
    )
    .then(() => undefined)
}
