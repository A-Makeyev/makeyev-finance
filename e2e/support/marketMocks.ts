import type { Page } from '@playwright/test'
import { type FixtureQuote, snapshotBody } from '../data/marketQuotes'

/**
 * Route intercepts for the Markets strip (`/api/market/quotes`), shared by
 * every suite that serves fixture quotes. Responder-style, like the external
 * mocks in mocks.ts: the callback runs per request so a suite can change the
 * answer mid-test (the flash tests flip prices between polls).
 */
export function mockMarketQuotes(
  page: Page,
  responder: () => { status: number; body: unknown },
): Promise<void> {
  return page
    .route('**/api/market/quotes**', (route) => {
      const { status, body } = responder()
      return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
    })
    .then(() => undefined)
}

/** Convenience wrapper: a 200 snapshot of the given quotes. */
export function serveQuotes(page: Page, quotes: FixtureQuote[]): Promise<void> {
  return mockMarketQuotes(page, () => ({ status: 200, body: snapshotBody(quotes) }))
}
