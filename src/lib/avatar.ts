/**
 * A name part only counts if it BEGINS with a letter or a digit.
 *
 * The seed data and real accounts carry bracketed role markers
 * ("Anatoly (Admin)"), and splitting on whitespace made the parenthesis its own
 * "name part", so the avatar rendered "A(" - a bracket is not an initial. Unicode
 * property escapes keep this script-agnostic: Hebrew, Cyrillic and accented
 * Latin all match \p{L}, while punctuation and symbols (\ ( / % $ @ # . - etc.)
 * do not. A leading apostrophe is still dropped ("O'Brien" -> the O part wins
 * first, and a part starting with one is skipped like any other punctuation).
 */
const NAME_PART_START = /^[\p{L}\p{N}]/u

/**
 * Initials for the fallback avatar (e.g. "נ" or "AB"): the first letter of up
 * to two name parts. Pure so it is unit-tested against concrete names rather
 * than only exercised through the navbar, and shared by every avatar surface
 * so the profile header and the navbar cannot drift.
 *
 * Punctuation-leading parts are skipped (see NAME_PART_START), so
 * "Anatoly (Admin)" reads "A" rather than "A(".
 *
 * A missing, empty or whitespace-only name yields '' - the caller renders its
 * own empty-avatar glyph in that case, the same way the navbar already does.
 */
export function initialsFor(name: string | null | undefined): string {
  if (!name) return ''
  return name
    .split(/\s+/)
    .filter((part) => NAME_PART_START.test(part))
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
}
