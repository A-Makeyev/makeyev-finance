import type { Page } from '@playwright/test'

/**
 * Route intercepts for the average-rates page (`/api/rates/average`).
 * Responder-style, like marketMocks: the callback runs per request so a spec
 * can flip between a working table, a stale table and an outage mid-test.
 */
export function mockAverageRates(
  page: Page,
  responder: () => { status: number; body: unknown },
): Promise<void> {
  return page
    .route('**/api/rates/average', (route) => {
      const { status, body } = responder()
      return route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(body),
      })
    })
    .then(() => undefined)
}

/** Convenience wrapper: a 200 response with the given fixture body. */
export function serveAverageRates(page: Page, body: unknown): Promise<void> {
  return mockAverageRates(page, () => ({ status: 200, body }))
}
