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

  for (const [unit, seconds] of UNIT_SECONDS) {
    if (Math.abs(diffSeconds) >= seconds) {
      return formatter.format(Math.round(diffSeconds / seconds), unit)
    }
  }
  return formatter.format(diffSeconds, 'second')
}
