/**
 * Text normalization for denylist matching, so the cheapest evasions do not
 * walk straight past the list.
 *
 * Deliberately a REASONABLE pass, not a perfect one. Every rule here trades a
 * caught evasion against a risk of turning a legitimate word into a match
 * (the Scunthorpe problem), so the rules are the ones with a clear asymmetry:
 * stripping vowel points, folding final letter forms, mapping the usual
 * character substitutions, collapsing a long run of repeated letters, and
 * joining letters that were separated by punctuation.
 *
 * Both the denylist and the user's text go through the same functions, so the
 * two are always compared in the same shape.
 */

/** Hebrew vowel points (niqqud) and cantillation: written on a word, never part of it. */
const NIQQUD = /[\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7]/g

/** The usual character substitutions. Applied before punctuation stripping. */
const LEET: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '8': 'b',
  '9': 'g',
  '@': 'a',
  $: 's',
  '!': 'i',
  '+': 't',
}

/**
 * Hebrew final letter forms collapse to their regular forms, so a word written
 * or pasted with a final form in the middle still matches. Israeli users
 * frequently type a final form anywhere.
 */
const FINAL_FORMS: Record<string, string> = {
  ך: 'כ',
  ם: 'מ',
  ן: 'נ',
  ף: 'פ',
  ץ: 'צ',
}

/**
 * 's-p-a-m', 's p a m' and 's.p.a.m' all normalize to the same spaced text;
 * collapseForMatching then removes the spaces. Runs of three or more identical
 * letters collapse to one ('shiiit' -> 'shit'), while a double letter is left
 * alone (it is often a real spelling difference, as in 'ass').
 */
export function normalizeForMatching(text: string): string {
  let out = text.normalize('NFKC').toLowerCase().replace(NIQQUD, '')

  out = out
    .split('')
    .map((char) => LEET[char] ?? FINAL_FORMS[char] ?? char)
    .join('')

  // Anything that is not a letter or a digit becomes a separator.
  out = out.replace(/[^\p{L}\p{N}]+/gu, ' ')
  out = out.replace(/(\p{L})\1{2,}/gu, '$1')

  return out.trim().replace(/\s+/g, ' ')
}

/**
 * The same text with separators removed entirely, for matching entries that
 * were split apart. Used only for entries of at least four characters, since
 * short collapsed strings ('ass' inside 'classic') match far too eagerly.
 */
export function collapseForMatching(text: string): string {
  return normalizeForMatching(text).replace(/\s+/g, '')
}
