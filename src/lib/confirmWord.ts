/**
 * The typed confirmation in front of a destructive action (today: deleting the
 * account from the profile page).
 *
 * A second, deliberate act rather than another button: the action cannot be
 * undone, and the cost of a mis-click is the whole account. The word itself
 * comes from i18n, so the reader is asked to type something in their own
 * language instead of a hardcoded English one.
 *
 * Pure, so the rule that arms the button is unit-tested rather than only
 * exercised through the browser. Case is ignored and surrounding whitespace is
 * trimmed: neither is a meaningful part of the confirmation, and demanding the
 * exact casing of a Hebrew word would only produce failures.
 */

export function matchesConfirmWord(typed: string, word: string): boolean {
  const expected = word.trim().toLocaleLowerCase()
  // An empty expected word can never arm the action: a missing or blank
  // translation must not turn a destructive button into a one-click one.
  if (!expected) return false
  return typed.trim().toLocaleLowerCase() === expected
}
