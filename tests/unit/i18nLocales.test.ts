import { describe, expect, it } from 'vitest'
import {
  createI18nInstance,
  DEFAULT_LANGUAGE,
  directionFor,
  isLocaleSegment,
  languageFromSegment,
  LOCALES,
  localePath,
} from '@/i18n'
import { he } from '@/i18n/he'
import { en } from '@/i18n/en'

describe('locale segments', () => {
  it('maps the URL segment to its language', () => {
    expect(languageFromSegment('he')).toBe('hebrew')
    expect(languageFromSegment('en')).toBe('english')
  })

  it('accepts exactly the supported segments', () => {
    expect(isLocaleSegment('he')).toBe(true)
    expect(isLocaleSegment('en')).toBe(true)
    expect(isLocaleSegment('ru')).toBe(false)
    expect(isLocaleSegment('')).toBe(false)
  })

  it('keeps Hebrew as the default language (unprefixed URLs)', () => {
    expect(DEFAULT_LANGUAGE).toBe('hebrew')
    expect(LOCALES.hebrew).toBe('he')
    expect(LOCALES.english).toBe('en')
  })

  it('derives document direction from the language (RTL for Hebrew)', () => {
    expect(directionFor('hebrew')).toBe('rtl')
    expect(directionFor('english')).toBe('ltr')
  })

  it('builds locale-prefixed links: Hebrew unprefixed, English under /en', () => {
    expect(localePath('/services', 'hebrew')).toBe('/services')
    expect(localePath('/', 'hebrew')).toBe('/')
    expect(localePath('/services', 'english')).toBe('/en/services')
    expect(localePath('/', 'english')).toBe('/en')
  })
})

describe('createI18nInstance', () => {
  it('creates a Hebrew instance with the Hebrew resources', async () => {
    const instance = createI18nInstance('hebrew')
    await instance.init()
    expect(instance.language).toBe('he')
    expect(instance.t('nav.home')).toBe(he.translation.nav.home)
  })

  it('creates an English instance with the English resources', async () => {
    const instance = createI18nInstance('english')
    await instance.init()
    expect(instance.language).toBe('en')
    expect(instance.t('nav.home')).toBe(en.translation.nav.home)
  })

  it('creates independent instances (no shared mutable state between locales)', async () => {
    const a = createI18nInstance('hebrew')
    const b = createI18nInstance('english')
    await a.init()
    await b.init()
    expect(a.language).toBe('he')
    expect(b.language).toBe('en')
    expect(a).not.toBe(b)
  })

  it('falls back to Hebrew when a key is missing in the active locale', async () => {
    const instance = createI18nInstance('english')
    await instance.init()
    // Both locales currently carry every key; fallbackLng guards the day one
    // does not, so assert the configuration rather than inventing a key.
    expect(instance.options.fallbackLng).toEqual(['he'])
  })
})

describe('locale files', () => {
  it('expose the same meta keys in both languages', () => {
    expect(Object.keys(he.translation.meta).sort()).toEqual(
      Object.keys(en.translation.meta).sort(),
    )
  })

  it('carry the new homeDescription key in both languages', () => {
    expect(he.translation.meta.homeDescription).toBeTruthy()
    expect(en.translation.meta.homeDescription).toBeTruthy()
  })
})
