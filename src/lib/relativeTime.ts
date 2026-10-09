/**
 * A localized relative timestamp ("2 hours ago" / "לפני שעתיים").
 *
 * Intl.RelativeTimeFormat is built into the runtime, so this needs no i18n
 * key per unit and no dependency, and it pluralizes and localizes correctly
 * per locale. `locale` must be a BCP-47 tag ('he', 'en'): passing the i18n
 * language straight through is what keeps a Hebrew page from rendering an
 * English phrase.
 *
 * Pure, with `now` injected, so the bucket boundaries are unit-tested.
 */

/**
 * Hebrew's CLDR "auto" forms for the single unit back carry the definite
 * article: ICU returns "השבוע שעבר" / "החודש שעבר" / "השנה שעברה", which reads as
 * "the week that passed". The natural phrases are the bare idioms below
 * (user-reported: a comment one week old said "השבוע שעבר").
 *
 * Only the -1 forms are overridden, and only for Hebrew: the plural forms
 * ("לפני 3 שבועות"), "this week" ("השבוע") and the future forms ("השבוע הבא") all
 * read correctly as ICU returns them, so post-processing the string would risk
 * breaking the cases that are right. The one ICU auto form that does read
 * awkwardly in Hebrew is the past dual ("2 weeks ago") — ICU emits
 * "לפני שבועיים (2)", where the parenthetical is the numeric form of the
 * same dual meaning, so it is stripped here.
 */
const PAST_SINGLE_FORM: Readonly<Record<string, Partial<Record<Intl.RelativeTimeFormatUnit, string>>>> = {
  he: {
    year: 'שנה שעברה',
    month: 'חודש שעבר',
    week: 'שבוע שעבר',
  },
}

/** The language subtag, so 'he-IL' and 'he' behave the same. */
function languageOf(locale: string): string {
  return locale.toLowerCase().split('-')[0] ?? ''
}

const UNIT_SECONDS: ReadonlyArray<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 31_536_000],
  ['month', 2_592_000],
  ['week', 604_800],
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60],
]

export function formatRelativeTime(
  timestampMs: number,
  nowMs: number,
  locale: string,
): string {
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'long' })
  const diffSeconds = Math.round((timestampMs - nowMs) / 1000)

  const overrides = PAST_SINGLE_FORM[languageOf(locale)]
  for (const [unit, seconds] of UNIT_SECONDS) {
    if (Math.abs(diffSeconds) >= seconds) {
      const value = Math.round(diffSeconds / seconds)
      // numeric: 'auto' below means -1 is the phrase form, which is exactly the
      // case the override table corrects.
      const formatted = formatter.format(value, unit)
      const language = languageOf(locale)
      // Hebrew CLDR auto form for the dual unit (exactly value === -2) emits
      // the numeric parenthetical, e.g. "לפני שבועיים (2)". Strip it so the
      // dual form reads cleanly.
      if (language === 'he' && value === -2) {
        return formatted.replace(/\s*\([\d]+\)$/, '')
      }
      if (value === -1) {
        const phrase = overrides?.[unit]
        if (phrase) return phrase
      }
      return formatted
    }
  }
  return formatter.format(diffSeconds, 'second')
}
