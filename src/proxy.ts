import { NextResponse, type NextRequest } from 'next/server'
import { getSessionCookie } from 'better-auth/cookies'

/**
 * Locale routing is deliberately simple (Next 16 calls this file `proxy`; it
 * is the renamed `middleware` convention):
 *  - Hebrew (the default) lives at the root, unprefixed - current URLs keep
 *    working through the migration, per the standing rule.
 *  - English lives under /en.
 *  - There is NO redirect from / to /he (or Accept-Language sniffing): the
 *    user's language choice is followed client-side on first visit (see
 *    LocaleI18nProvider), which keeps the URL a visitor shares or bookmarks
 *    exactly what they saw.
 *
 * Auth gating: `/advisor` and `/client` require a session. This file performs
 * an OPTIMISTIC check only - it verifies that a session cookie EXISTS, not
 * that it is valid, so it just avoids rendering a protected page for a
 * visitor with no cookie at all. The authoritative check is the server-side
 * `getServerSession()` in each protected page (and later in route handlers),
 * which is what actually authenticates the request. Treating this cookie test
 * as the gate would let anyone forge a cookie.
 */

const PROTECTED_PREFIXES = ['/advisor', '/client', '/profile'] as const

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isEnglish = pathname === '/en' || pathname.startsWith('/en/')
  const appPath = isEnglish ? (pathname === '/en' ? '/' : pathname.slice(3)) : pathname

  const needsAuth = PROTECTED_PREFIXES.some(
    (prefix) => appPath === prefix || appPath.startsWith(`${prefix}/`),
  )
  if (!needsAuth) return NextResponse.next()

  if (getSessionCookie(request)) return NextResponse.next()

  const url = request.nextUrl.clone()
  url.pathname = isEnglish ? '/en/login' : '/login'
  url.search = ''
  // `next` is the locale-STRIPPED app path, so the login page's router adapter
  // can push it back into whichever locale the visitor is in. The query comes
  // with it: a protected link can carry state the page needs after the sign-in
  // (the account-deletion link's token), and dropping it would silently lose
  // it. The value is always path-relative ~ it starts with `/` and comes from
  // this request's own path and query ~ so this cannot become an off-site
  // redirect target.
  url.searchParams.set('next', `${appPath}${request.nextUrl.search}`)
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|images|favicon.ico).*)'],
}
