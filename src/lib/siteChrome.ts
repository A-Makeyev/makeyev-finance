/**
 * Routes that deliberately drop the site footer.
 *
 * - `/login`: a self-contained sign-in surface, a single card with nothing to
 *   scroll past.
 * - `/profile`: a full-height dark chrome panel that reads better with no page
 *   furniture underneath it.
 *
 * `pathname` is the locale-stripped path (the router reports `/en/profile` as
 * `/profile`), so the rule never needs the locale prefix.
 */
export function shouldHideFooter(pathname: string): boolean {
  return pathname === '/login' || pathname === '/profile'
}
