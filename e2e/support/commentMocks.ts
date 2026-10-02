import type { Page } from '@playwright/test'

/**
 * Route intercept for the article comments API
 * (`/api/articles/:slug/comments`), shared by every suite that loads an article
 * page.
 *
 * Why this must exist rather than being left to hit the server: the e2e
 * webServer boots the production build with the repo-root `.env`, so an
 * unmocked comments read goes to the REAL Mongo database and renders whatever
 * real comments are in it. That is non-deterministic (the count changes as
 * anyone comments) and it means a test run, and CI, reads live user content.
 * It also broke a real assertion: the prepayment article counts its own list
 * items, and real comments arriving inside the `<article>` element broke the
 * count.
 *
 * The default is an EMPTY thread, which is what a visitor with no comments
 * sees. A suite that needs comments in the thread (comments.spec.ts) passes
 * them explicitly.
 */
export function mockArticleComments(
  page: Page,
  comments: unknown[] = [],
): Promise<void> {
  return page
    .route('**/api/articles/*/comments', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ comments }),
      }),
    )
    .then(() => undefined)
}

/** Convenience wrapper: a 200 with an empty thread. */
export function serveNoComments(page: Page): Promise<void> {
  return mockArticleComments(page, [])
}
