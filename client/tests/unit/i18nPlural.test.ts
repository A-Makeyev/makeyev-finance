import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import i18next from 'i18next'
import { he } from '../../src/i18n/he'
import { en } from '../../src/i18n/en'

/**
 * The term word in the summary notes must agree with the number: 1 שנה,
 * 2+ שנים (the user-reported bug printed שנה for every count). Hebrew CLDR
 * (Intl.PluralRules('he')) has three categories - one = 1, two = 2, other =
 * 3+ - so the test pins every category, not just one/other. These tests run
 * against a real i18next instance with the app's resources so suffix
 * resolution is exercised end to end, not just the raw strings. Raw t()
 * output keeps the <0>/<1> Trans tags; stripTags removes them so assertions
 * stay readable (the app renders tags via the <Trans> component).
 */
function stripTags(s: string): string {
  return s.replace(/<\/?\d+>/g, '')
}

describe('term pluralization in summary notes', () => {
  const i18n = i18next.createInstance()

  beforeAll(async () => {
    await i18n.init({
      lng: 'he',
      fallbackLng: 'he',
      resources: {
        he: { translation: he.translation },
        en: { translation: en.translation },
      },
      interpolation: { escapeValue: false },
      returnNull: false,
    })
  })

  describe('requiredPayment (Hebrew)', () => {
    const render = (count: number) =>
      stripTags(i18n.t('calculator.warnings.requiredPayment', { count, term: String(count), payment: 'X' }))

    it('uses שנה for exactly 1 year', () => {
      expect(render(1)).toContain('לתקופה של 1 שנה יהיה')
    })

    it('uses שנים for 2 years', () => {
      expect(render(2)).toContain('לתקופה של 2 שנים יהיה')
    })

    it('uses שנים for typical terms (5, 15, 30)', () => {
      for (const years of [5, 15, 30]) {
        expect(render(years), `${years} years`).toContain(`לתקופה של ${years} שנים יהיה`)
      }
    })

    it('never prints שנה with a count above 1', () => {
      for (let years = 2; years <= 30; years++) {
        expect(render(years), `${years} years`).not.toContain('שנה יהיה')
      }
    })
  })

  describe('monthlyAllowanceNone (Hebrew)', () => {
    const render = (count: number) =>
      stripTags(
        i18n.t('calculator.warnings.monthlyAllowanceNone', {
          count,
          term: String(count),
          income: 'X',
          liabilities: 'Y',
        }),
      )

    it('uses שנה for exactly 1 year', () => {
      expect(render(1)).toContain('לתקופה של 1 שנה:')
    })

    it('uses שנים for 2+ years', () => {
      expect(render(2)).toContain('לתקופה של 2 שנים:')
      expect(render(15)).toContain('לתקופה של 15 שנים:')
    })
  })

  describe('requiredPayment (English)', () => {
    beforeEach(() => i18n.changeLanguage('en'))

    const render = (count: number) =>
      stripTags(i18n.t('calculator.warnings.requiredPayment', { count, term: String(count), payment: 'X' }))

    it('reads 1-year singular and plural forms', () => {
      expect(render(1)).toContain('for a 1-year term')
      expect(render(2)).toContain('for a 2-year term')
      expect(render(30)).toContain('for a 30-year term')
    })
  })
})
