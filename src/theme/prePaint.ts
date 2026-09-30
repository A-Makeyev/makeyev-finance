/**
 * The pre-paint theme script, as ONE source of truth.
 *
 * It runs twice in two shapes:
 *  - as a string, injected by root/layout.tsx via <InlineScript> before any
 *    React paints, so a stored (or OS) dark theme never flashes light; and
 *  - in unit tests (tests/unit/theme.test.ts), which execute the REAL script
 *    text against fake globals - the same contract the Vite app's
 *    client/tests/unit/theme.test.ts kept with client/index.html.
 *
 * The body mirrors src/theme/index.ts: same storage key, same
 * prefers-color-scheme fallback, same data-theme + color-scheme writes.
 * Change all three together.
 */
/**
 * The pre-paint language script. A returning visitor whose stored choice is
 * English is moved to the /en mirror of the SAME page before anything paints
 * (legacy parity: the choice persisted and never dropped you to the home
 * page). Doing it here instead of in a React effect avoids a one-frame flash
 * of the Hebrew page and the mid-load navigation race that came with it.
 *
 * Hebrew is the default and unprefixed, so only English needs a hop. Safe
 * from loops: after moving to /en, the pathname starts with /en and the
 * guard is false.
 */
export const PRE_PAINT_LANGUAGE_SCRIPT = `
;(function () {
  try {
    var stored = localStorage.getItem('site_language')
    var path = window.location.pathname
    if (stored === 'english' && path.indexOf('/en') !== 0) {
      window.location.replace('/en' + (path === '/' ? '' : path) + window.location.search)
    }
  } catch (error) {
    /* storage unavailable - keep the URL's own locale */
  }
})()
`

/**
 * The pre-paint direction script, injected in the root layouts alongside the
 * theme script.
 *
 * Direction follows the locale (see directionFor): the whole Hebrew site is
 * RTL, English under /en is LTR. The legacy app set this from a React effect
 * once a route mounted, which was invisible under a client-only Vite SPA;
 * under server-rendered Next the first paint would be read as LTR by anything
 * that samples the DOM early, so it is set before paint here too.
 *
 * A stored-English visitor on an unprefixed (Hebrew) URL stays LTR until the
 * language script hops them to /en, so nothing flashes RTL on the way out.
 */
export const PRE_PAINT_DIRECTION_SCRIPT = `
;(function () {
  var path = window.location.pathname
  var language = 'hebrew'
  try {
    var raw = localStorage.getItem('site_language')
    if (raw === 'english' || raw === 'hebrew') language = raw
  } catch (error) {
    /* storage unavailable - the URL owns the locale */
  }
  var englishPath = path === '/en' || path.indexOf('/en/') === 0
  var rtl = language !== 'english' && !englishPath
  document.documentElement.dir = rtl ? 'rtl' : 'ltr'
})()
`

export const PRE_PAINT_THEME_SCRIPT = `
;(function () {
  var root = document.documentElement
  var stored = 'system'
  try {
    var raw = localStorage.getItem('site_theme')
    if (raw === 'light' || raw === 'dark' || raw === 'system') stored = raw
  } catch (error) {
    /* storage unavailable - treat as no choice yet (system) */
  }
  var dark = false
  try {
    dark =
      stored === 'dark' ||
      (stored === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  } catch (error) {
    /* matchMedia unavailable - light is the safe default */
  }
  root.dataset.theme = dark ? 'dark' : 'light'
  root.style.colorScheme = dark ? 'dark' : 'light'
})()
`
