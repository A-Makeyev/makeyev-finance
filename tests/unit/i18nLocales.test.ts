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

  it('resolves the save-control labels instead of echoing the key path', async () => {
    // A key can satisfy the Translation type (both locale files agree) and
    // still be unreachable at runtime if it landed in the wrong block; i18next
    // then renders the raw key path, which is exactly what the save button did
    // ("savedMixes.saving" instead of "saving..."). Assert the resolved string.
    for (const language of ['hebrew', 'english'] as const) {
      const instance = createI18nInstance(language)
      await instance.init()
      const source = language === 'hebrew' ? he.translation : en.translation
      for (const value of [
        instance.t('savedMixes.saveAction'),
        instance.t('savedMixes.saving'),
        instance.t('savedMixes.savedState'),
      ]) {
        expect(value).not.toContain('savedMixes.')
        expect(value.trim()).not.toBe('')
      }
      expect(instance.t('savedMixes.saving')).toBe(source.savedMixes.saving)
    }
  })

  it('falls back to Hebrew when a key is missing in the active locale', async () => {
    const instance = createI18nInstance('english')
    await instance.init()
    // Both locales currently carry every key; fallbackLng guards the day one
    // does not, so assert the configuration rather than inventing a key.
    expect(instance.options.fallbackLng).toEqual(['he'])
  })
})

describe('savedMixes.termFor pluralization', () => {
  it('uses the singular for one year and the right plural form otherwise', async () => {
    const heInstance = createI18nInstance('hebrew')
    await heInstance.init()
    expect(heInstance.t('savedMixes.termFor', { count: 1 })).toBe('לתקופה של שנה')
    expect(heInstance.t('savedMixes.termFor', { count: 2 })).toBe('לתקופה של שנתיים')
    expect(heInstance.t('savedMixes.termFor', { count: 15 })).toBe('לתקופה של 15 שנים')

    const enInstance = createI18nInstance('english')
    await enInstance.init()
    expect(enInstance.t('savedMixes.termFor', { count: 1 })).toBe('For a term of 1 year')
    expect(enInstance.t('savedMixes.termFor', { count: 15 })).toBe('For a term of 15 years')
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
