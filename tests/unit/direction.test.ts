import { describe, expect, it } from 'vitest'
import { PRE_PAINT_DIRECTION_SCRIPT, PRE_PAINT_LANGUAGE_SCRIPT } from '@/theme/prePaint'

/**
 * Executes the REAL pre-paint scripts (the strings the root layouts inject)
 * against fake globals, the same contract theme.test.ts keeps with the
 * pre-paint theme script.
 */
function runDirection(pathname: string, storedLanguage: string | null): string {
  const documentElement = { dir: '' }
  const document = { documentElement }
  const window = { location: { pathname } }
  const localStorage = { getItem: () => storedLanguage }
  new Function(
    'document',
    'window',
    'localStorage',
    PRE_PAINT_DIRECTION_SCRIPT,
  )(document, window, localStorage)
  return documentElement.dir
}

describe('pre-paint direction', () => {
  it.each([
    // The whole Hebrew segment (unprefixed URLs) is RTL: direction follows the
    // locale, not the route, so every page reads right-to-left in Hebrew.
    ['/', 'hebrew', 'rtl'],
    ['/services', 'hebrew', 'rtl'],
    ['/calculators', 'hebrew', 'rtl'],
    ['/compare', 'hebrew', 'rtl'],
    ['/articles/mortgage-decisions', 'hebrew', 'rtl'],
    ['/login', 'hebrew', 'rtl'],
    ['/advisor', 'hebrew', 'rtl'],
    // No stored choice yet means Hebrew (the default locale).
    ['/', null, 'rtl'],
    ['/articles', null, 'rtl'],
    // English lives under /en and stays LTR, whatever storage says.
    ['/en', 'english', 'ltr'],
    ['/en/services', 'english', 'ltr'],
    ['/en/calculators', 'english', 'ltr'],
    ['/en/login', 'hebrew', 'ltr'],
    // Seeded-English visitor on an unprefixed URL: LTR until the language
    // script hops them to /en (no RTL flash).
    ['/calculators', 'english', 'ltr'],
    ['/compare', 'english', 'ltr'],
    ['/', 'english', 'ltr'],
  ])('sets html dir for %s (stored=%s)', (pathname, storedLanguage, expected) => {
    expect(runDirection(pathname, storedLanguage)).toBe(expected)
  })
})

describe('pre-paint language redirect', () => {
  function runLanguage(pathname: string, storedLanguage: string | null, search = '') {
    const replaced: string[] = []
    const document = { documentElement: { dir: '' } }
    const window = {
      location: {
        pathname,
        search,
        replace: (url: string) => replaced.push(url),
      },
    }
    const localStorage = { getItem: () => storedLanguage }
    new Function(
      'window',
      'document',
      'localStorage',
      PRE_PAINT_LANGUAGE_SCRIPT,
    )(window, document, localStorage)
    return replaced
  }

  it('moves a stored-English visitor to the /en mirror of the same page', () => {
    expect(runLanguage('/services', 'english')).toEqual(['/en/services'])
    expect(runLanguage('/', 'english')).toEqual(['/en'])
    expect(runLanguage('/calculators', 'english', '?preset=basket2')).toEqual([
      '/en/calculators?preset=basket2',
    ])
  })

  it('leaves Hebrew visitors and /en pages alone', () => {
    expect(runLanguage('/services', 'hebrew')).toEqual([])
    expect(runLanguage('/services', null)).toEqual([])
    expect(runLanguage('/en/services', 'english')).toEqual([])
  })
})
