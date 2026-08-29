import { defineConfig, devices } from '@playwright/test'

const PORT = Number(process.env.E2E_PORT ?? 5173)
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`

export default defineConfig({
  testDir: './e2e/tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 4 : 1,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['list']] : [['list']],
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
        command: 'pnpm exec vite preview --port 5173 --strictPort',
        url: `http://localhost:${PORT}`,
        reuseExistingServer: !process.env.CI,
        stdout: 'ignore',
        stderr: 'pipe',
      },
})
