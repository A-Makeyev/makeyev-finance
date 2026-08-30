import type { Page, Route } from '@playwright/test'

/**
 * Deterministic network mocks for the external integrations
 * (Bank of Israel prime rate, CBS index feeds, EmailJS).
 *
 * Cross-origin fulfilled responses MUST carry CORS headers - otherwise the
 * browser blocks the app from reading them and fetch() rejects, which is
 * indistinguishable from a real outage. The production endpoints send
 * permissive CORS headers; we mirror that here. JSON POSTs also trigger an
 * OPTIONS preflight, which we answer generically.
 */

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
}

function preflight(route: Route): Promise<void> | undefined {
  if (route.request().method() === 'OPTIONS') {
    return route.fulfill({ status: 204, headers: CORS_HEADERS, body: '' })
  }
  return undefined
}

function fulfillCors(
  route: Route,
  body: { status: number; contentType: string; bodyText: string },
): Promise<void> {
  return route.fulfill({
    status: body.status,
    contentType: body.contentType,
    headers: CORS_HEADERS,
    body: body.bodyText,
  })
}

export interface CbsFixtureOptions {
  currentValue: string
  previousValue: string
  currentPercent: string
  currentPercentYear: string
  previousPercentYear: string
}

export function buildCbsXml(options: CbsFixtureOptions): string {
  const filler = Array.from(
    { length: 9 },
    () =>
      '<DateMonth><value>100</value><percent>0</percent><percentYear>2</percentYear></DateMonth>',
  ).join('\n  ')
  return `
<NewDataSet>
  <name>מדד המחירים לצרכן - כללי</name>
  <DateMonth><value>${options.currentValue}</value><percent>${options.currentPercent}</percent><percentYear>${options.currentPercentYear}</percentYear><date>2026-07-01</date></DateMonth>
  <DateMonth><value>${options.previousValue}</value><percent>0.1</percent><percentYear>${options.previousPercentYear}</percentYear><date>2026-06-01</date></DateMonth>
  ${filler}
</NewDataSet>`
}

const DEFAULT_CPI: CbsFixtureOptions = {
  currentValue: '106',
  previousValue: '105',
  currentPercent: '0.4',
  currentPercentYear: '3.5',
  previousPercentYear: '3.0',
}

export interface InstallExternalMocksOptions {
  /** Bank of Israel key rate; null simulates a dead BOI endpoint. */
  boiKeyRate?: number | null
  /** CPI fixture options; null simulates CBS failure for all feeds. */
  cpi?: CbsFixtureOptions | null
  /** Track observed requests (e.g. EmailJS POSTs). */
  onRequest?: (url: URL) => void
}

/**
 * Installs route intercepts BEFORE page.goto so the app's startup fetches are
 * fully deterministic and never touch the real network.
 */
export async function installExternalMocks(
  page: Page,
  options: InstallExternalMocksOptions = {},
): Promise<void> {
  const { boiKeyRate = 4.5, cpi = DEFAULT_CPI, onRequest } = options

  await page.route(/boi\.org\.il/, (route) => {
    const pf = preflight(route)
    if (pf) return pf
    if (boiKeyRate === null) return route.abort()
    return fulfillCors(route, {
      status: 200,
      contentType: 'application/json',
      bodyText: JSON.stringify({ currentInterest: boiKeyRate }),
    })
  })

  const ids = ['120010', '200010', '800010']
  for (const id of ids) {
    await page.route(new RegExp(`api\\.cbs\\.gov\\.il[^?]*\\?id=${id}`), (route) => {
      if (!cpi) return route.abort()
      const xml =
        id === '120010'
          ? buildCbsXml(cpi)
          : buildCbsXml(cpi).replace('מדד המחירים לצרכן - כללי', 'מחירי תשומה בבניין מגורים - כללי')
      return fulfillCors(route, { status: 200, contentType: 'text/xml', bodyText: xml })
    })
  }

  let emailjsCalls = 0
  await page.route(/api\.emailjs\.com/, (route) => {
    const pf = preflight(route)
    if (pf) return pf
    const request = route.request()
    onRequest?.(new URL(request.url()))
    if (request.method() !== 'POST') {
      return fulfillCors(route, { status: 404, contentType: 'text/plain', bodyText: '' })
    }
    emailjsCalls++
    const bodyText = request.postData() ?? ''
    // Deadlock simulation: first call returns the transient SMTP failure.
    if (bodyText.includes('DEADLOCK_ONCE') && emailjsCalls === 1) {
      return fulfillCors(route, {
        status: 200,
        contentType: 'application/json',
        // Legacy-era SMTP deadlocks surfaced a 200 response whose body
        // contained the marker - matched verbatim by the client.
        bodyText: 'deadlock victim of process 12345, resending email…',
      })
    }
    if (bodyText.includes('FORCE_FAILURE')) {
      // Real EmailJS failures arrive as HTTP errors with a plain-text body.
      return fulfillCors(route, {
        status: 500,
        contentType: 'text/plain',
        bodyText: 'smtp relay unavailable',
      })
    }
    return fulfillCors(route, {
      status: 200,
      contentType: 'application/json',
      bodyText: JSON.stringify({ status: 200, text: 'OK' }),
    })
  })
}
