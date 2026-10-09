/**
 * The Indexes strip rows now carry a hover tooltip (see IndexesBar's
 * FeedAnchor): what the index measures, then how it reaches a mortgage or loan.
 *
 * AGENTS.md treats a missing translation as a missing test - a missing key
 * would render the raw `indexesBar.…` string inside the panel. The i18n parity
 * test guards key EXISTENCE; this guards that each key carries real, non-trivial
 * copy and that the composed tooltip uses it rather than the raw key.
 */
import { describe, expect, it } from 'vitest'
import { createI18nInstance } from '@/i18n'
import { he } from '@/i18n/he'
import { en } from '@/i18n/en'
import { indexesTooltipContent } from '@/components/layout/IndexesBar'
import type { CbsFeedKind } from '@/services/cbs'

const KINDS: readonly CbsFeedKind[] = [
  'cpi',
  'residentialConstruction',
  'commercialConstruction',
]

describe('indexes row tooltip content', () => {
  for (const language of ['hebrew', 'english'] as const) {
    const i18n = createI18nInstance(language)
    const translation = language === 'hebrew' ? he.translation : en.translation

    it(`${language}: composes the description with the mortgage effect`, () => {
      for (const kind of KINDS) {
        const text = indexesTooltipContent(i18n.t, kind)
        expect(text, kind).toContain(i18n.t(`indexesBar.descriptions.${kind}`))
        expect(text, kind).toContain(i18n.t(`indexesBar.mortgageEffects.${kind}`))
        // Never the raw i18n key (the missing-translation failure mode).
        expect(text, kind).not.toContain('indexesBar.')
      }
    })

    it(`${language}: carries real copy for every index and its mortgage effect`, () => {
      for (const kind of KINDS) {
        expect(translation.indexesBar.descriptions[kind].length, `${language}.${kind}`).toBeGreaterThan(
          20,
        )
        expect(
          translation.indexesBar.mortgageEffects[kind].length,
          `${language}.${kind} effect`,
        ).toBeGreaterThan(20)
      }
    })
  }
})
