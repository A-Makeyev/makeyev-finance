import { readFileSync, existsSync } from 'node:fs'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import { expect, test } from '@playwright/test'
import { AuthPage } from '../../pages/AuthPage'
import { ProfilePage } from '../../pages/ProfilePage'

const execAsync = promisify(exec)

/**
 * TEMPORARY (deleted after running). The mail is often opened on a device with
 * no session: the link has to survive the sign-in and still land on the last
 * step of the deletion, otherwise the token is silently lost.
 *
 * The fixture is created by the helper script against the already-booted e2e
 * server (inherited env includes MONGODB_URI + BASE_URL), so the account lives
 * in the same database the e2e server uses and the test can sign in with it.
 */
const FIXTURE_PATH = '.tmp-signedout.json'

let fixture: { email: string; password: string; token: string } | null = null

test.beforeAll(async () => {
  // Re-create the fixture against the booted e2e server so the account lives in
  // the same database the server uses (the script inherits MONGODB_URI from this
  // process, which got it from the same loadEnvConfig the e2e server did).
  await execAsync(
    'node scripts/tmp-delete-signedout.mjs',
    { cwd: process.cwd(), env: { ...process.env, BASE_URL: 'http://localhost:3100' } },
  )
  if (!existsSync(FIXTURE_PATH)) throw new Error('tmp-delete-signedout.mjs did not write ' + FIXTURE_PATH)
  fixture = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as { email: string; password: string; token: string }
  if (!fixture.email || !fixture.password || !fixture.token)
    throw new Error('fixture missing email/password/token')
})

test('the deletion link opened signed out survives the sign-in and still deletes', async ({
  page,
}) => {
  // beforeAll has already run and assigned fixture; Playwright guarantees
  // beforeAll completes before the test body, so this narrowing is correct.
  const f = fixture!
  const profile = new ProfilePage(page)
  const auth = new AuthPage(page)

  await page.goto(`/profile?delete=${f.token}`)

  // Sent to sign-in, with the link kept in `next`.
  await expect(page).toHaveURL(/\/login\?/)
  expect(decodeURIComponent(page.url())).toContain(`next=/profile?delete=${f.token}`)

  await auth.email.fill(f.email)
  await auth.password.fill(f.password)
  await auth.submit.click()

  // Back on the profile, with the modal already on its last step.
  await expect(page).toHaveURL(new RegExp(`/profile\\?delete=${f.token}`))
  await expect(profile.deleteModal).toBeVisible()
  await expect(profile.deleteMailConfirm).toBeVisible()

  await profile.deleteSubmit.click()
  await page.waitForURL((url) => url.pathname === '/')

  await page.goto('/profile')
  await expect(page).toHaveURL(/\/login/)
})
