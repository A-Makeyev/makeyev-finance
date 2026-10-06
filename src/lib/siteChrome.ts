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

/**
 * Routes whose navbar starts in its SCROLLED (solid) treatment, before the
 * visitor scrolls anything.
 *
 * The bar is transparent while it sits over a dark hero: the glass needs
 * something behind it to read as glass, and the light items need the dark
 * backdrop to be legible at all. `/profile` is the one page whose first screen
 * is the plain page surface (a light, hero-less backdrop), so there the
 * transparent state would put white items on near-white and read as a grey
 * panel. It simply starts solid, exactly as it looks once other pages scroll,
 * which is a colours-only change: the bar's box is identical in both states.
 *
 * `pathname` is the locale-stripped path (see shouldHideFooter).
 */
export function navStartsSolid(pathname: string): boolean {
  return pathname === '/profile'
}
