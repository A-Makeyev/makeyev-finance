import { describe, expect, it } from 'vitest'
import { he } from '../../src/i18n/he'
import { en } from '../../src/i18n/en'

function flatten(obj: unknown, prefix = ''): string[] {
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    v && typeof v === 'object' ? flatten(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  )
}

function tags(s: string): number[] {
  return [...s.matchAll(/<(\d+)>/g)].map((m) => Number(m[1]))
}

describe('i18n parity', () => {
  const heKeys = flatten(he.translation).sort()
  const enKeys = flatten(en.translation).sort()
  it('has identical key sets', () => {
    expect(enKeys).toEqual(heKeys)
  })
  it('has identical Trans tag counts per key', () => {
    for (const key of heKeys) {
      const hv = key
        .split('.')
        .reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], he.translation)
      const ev = key
        .split('.')
        .reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], en.translation)
      if (typeof hv !== 'string' || typeof ev !== 'string') continue
      expect(tags(ev), key).toEqual(tags(hv))
    }
  })
  it('merged capital+financing line tags match in both languages', () => {
    const w = (o: typeof he | typeof en) => o.translation
    const warnings = (o: typeof he | typeof en) => w(o).calculator.warnings
    // The merged ✔️ line (equity share + compliant financing ratio) carries
    // the capital percent, then the limit.
    expect(tags(String(warnings(he).capitalLtvOk))).toEqual([0, 1])
    expect(tags(String(warnings(en).capitalLtvOk))).toEqual([0, 1])
  })

  it('allowance line tags match in both languages', () => {
    const w = (o: typeof he | typeof en) => o.translation
    const warnings = (o: typeof he | typeof en) => w(o).calculator.warnings
    // The plain payment fact (info line): payment, term. It exists as plural
    // variants (Hebrew CLDR: one/two/other) with identical tag layouts.
    for (const variant of ['one', 'two', 'other'] as const) {
      expect(tags(String(warnings(he)[`requiredPayment_${variant}`]))).toEqual([0, 1])
      expect(tags(String(warnings(en)[`requiredPayment_${variant}`]))).toEqual([0, 1])
      expect(tags(String(warnings(he)[`monthlyAllowanceNone_${variant}`]))).toEqual([0, 1, 2])
      expect(tags(String(warnings(en)[`monthlyAllowanceNone_${variant}`]))).toEqual([0, 1, 2])
    }
    // Green verdict with monthly payments: payment, ceiling, percent,
    // income, then the monthly payments - the payment and the ceiling both
    // appear so they never read as one number.
    expect(tags(String(warnings(he).monthlyAllowanceOk))).toEqual([0, 1, 2, 3, 4])
    expect(tags(String(warnings(en).monthlyAllowanceOk))).toEqual([0, 1, 2, 3, 4])
    // Without them only the monthly-payments tag drops; the entered income
    // stays.
    expect(tags(String(warnings(he).monthlyAllowanceOkNoLiabilities))).toEqual([0, 1, 2, 3])
    expect(tags(String(warnings(en).monthlyAllowanceOkNoLiabilities))).toEqual([0, 1, 2, 3])
    // Over variants name the expected payment itself: payment, percent,
    // income, then the monthly payments when they exist, then the minimum
    // income mixed into the ❌ line.
    expect(tags(String(warnings(he).monthlyAllowanceOver))).toEqual([0, 1, 2, 3, 4])
    expect(tags(String(warnings(en).monthlyAllowanceOver))).toEqual([0, 1, 2, 3, 4])
    expect(tags(String(warnings(he).monthlyAllowanceOverNoLiabilities))).toEqual([0, 1, 2, 3])
    expect(tags(String(warnings(en).monthlyAllowanceOverNoLiabilities))).toEqual([0, 1, 2, 3])
  })
})
