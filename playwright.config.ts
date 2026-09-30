import { defineConfig, devices } from '@playwright/test'
import { loadEnvConfig } from '@next/env'
import { parseSocialProviders } from './src/server/auth/config'

// Read the repo-root .env here for the same reason Next reads it when it
// builds the app under test: which social sign-in buttons exist is derived from
// these credentials, and the specs have to expect the same set the build got.
// Without this the config process sees an empty environment while the local
// build (which does load .env) renders the Google button, so the provider test
// could only pass on a machine with no credentials configured.
loadEnvConfig(process.cwd())

/**
 * The social providers this run's build will offer, computed with the app's own
 * rule (src/server/auth/config.ts) and handed to the specs through the child
 * process env. Empty in CI, `google` on a machine with credentials set.
 */
process.env.E2E_SOCIAL_PROVIDERS = parseSocialProviders(process.env).join(',')

// The single e2e config for the Next app (phase 3 folded the legacy app's
// config in here). It boots the production Next build from the repo root.
const PORT = Number(process.env.E2E_PORT ?? 3100)
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`

export default defineConfig({
  testDir: './e2e/tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 4 : 1,
  reporter: process.env.CI
    ? [
        ['html', { open: 'never' }],
        // The CI report page (Results/Run-*/results.json on gh-pages) parses
        // this JSON for passed/failed/skipped counts. The output path itself
        // comes from PLAYWRIGHT_JSON_OUTPUT_NAME, set in .github/workflows/ci.yml.
        ['json', { outputFile: process.env.PLAYWRIGHT_JSON_OUTPUT_NAME ?? 'results.json' }],
        ['list'],
      ]
    : [['list']],
  timeout: 45_000,
  expect: { timeout: 12_000 },
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    actionTimeout: 15_000,
    // headless: !!process.env.CI,
  },
  projects: [
    {
      name: 'ui-chromium',
      testMatch: /tests\/ui\/.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'api-chromium',
      testMatch: /tests\/api\/.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    // {
    //   name: 'ui-firefox',
    //   testMatch: /tests\/ui\/.*\.spec\.ts/,
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'ui-webkit',
    //   testMatch: /tests\/ui\/.*\.spec\.ts/,
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        // Booting the production Next build (build + start) exercises what
        // Render serves. The mock suites intercept the external feeds and
        // /api/market/quotes at the browser. Client env vars from the
        // repo-root .env are loaded by Next itself.
        command: 'npm run build && npm run start',
        env: {
          PORT: String(PORT),
          // Same provider list the specs expect, so the build and the
          // assertions cannot drift apart.
          E2E_SOCIAL_PROVIDERS: process.env.E2E_SOCIAL_PROVIDERS ?? '',
          // Better Auth refuses to boot in production without a secret. The
          // real one comes from .env locally; this test-only fallback keeps
          // the e2e server bootable and is not a production credential.
          BETTER_AUTH_SECRET:
            process.env.BETTER_AUTH_SECRET ?? 'e2e_only_not_a_production_secret_0123456789',
        },
        url: `http://localhost:${PORT}`,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
        stdout: 'ignore',
        stderr: 'pipe',
      },
})
