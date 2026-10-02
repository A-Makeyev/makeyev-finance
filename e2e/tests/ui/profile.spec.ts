import { expect, serveQuotes, test } from '../../fixtures'
import { AuthPage } from '../../pages/AuthPage'
import { ProfilePage } from '../../pages/ProfilePage'
import { mockGetSessionUser } from '../../support/authMocks'

test.describe('profile page', () => {
  test.beforeEach(async ({ mockedPage }) => {
    // Keep the chrome's live strips off the network; these tests are about the gate.
    await serveQuotes(mockedPage, [])
  })

  test('sends a signed-out visitor from /profile to the login page', async ({ mockedPage }) => {
    // get-session is deliberately NOT mocked: the real server-side check is
    // what this exercises (the proxy's cookie test is optimistic only).
    const profile = new ProfilePage(mockedPage)
    await profile.goto()
    await expect(mockedPage).toHaveURL(/\/login\?next=(%2F|\/)profile$/)
  })

  test('redirects the English mirror to the English login page', async ({ mockedPage }) => {
    const profile = new ProfilePage(mockedPage)
    await profile.goto('/en/profile')
    await expect(mockedPage).toHaveURL(/\/en\/login\?next=(%2F|\/)profile$/)
  })

  test('a forged session cookie does not pass the server-side check', async ({ mockedPage }) => {
    await mockedPage.context().addCookies([
      { name: 'better-auth.session_token', value: 'forged', domain: 'localhost', path: '/' },
    ])

    const profile = new ProfilePage(mockedPage)
    await profile.goto()

    await expect(mockedPage).toHaveURL(/\/login\?next=(%2F|\/)profile$/)
  })

  test('the account menu offers a real profile link once signed in', async ({ mockedPage }) => {
    await mockGetSessionUser(mockedPage)
    const auth = new AuthPage(mockedPage)
    await auth.goto('/')

    await auth.openAccountMenu()

    // The item used to be an inert disabled button ("page does not exist
    // yet"); it now routes into the gated profile page.
    await expect(auth.navAccountProfile).toHaveAttribute('href', '/profile')
  })

  test('the English chrome links to the English profile route', async ({ mockedPage }) => {
    await mockGetSessionUser(mockedPage)
    const auth = new AuthPage(mockedPage)
    await auth.goto('/en')

    await auth.openAccountMenu()

    await expect(auth.navAccountProfile).toHaveAttribute('href', '/en/profile')
  })
})
