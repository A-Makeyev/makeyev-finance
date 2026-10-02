/**
 * Initials for the fallback avatar (e.g. "נ" or "AB"): the first letter of up
 * to two name parts. Pure so it is unit-tested against concrete names rather
 * than only exercised through the navbar, and shared by every avatar surface
 * so the profile header and the navbar cannot drift.
 *
 * A missing, empty or whitespace-only name yields '' - the caller renders its
 * own empty-avatar glyph in that case, the same way the navbar already does.
 */
export function initialsFor(name: string | null | undefined): string {
  if (!name) return ''
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
}
