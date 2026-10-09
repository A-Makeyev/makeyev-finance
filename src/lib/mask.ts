/**
 * Partially hides an email address.
 *
 * The sign-up confirmation shows which address the verification mail went to,
 * but there is no reason to print it in full: the local part keeps its first
 * half and the rest becomes bullets, so the owner recognises the address while
 * a passer-by does not read the whole thing off the screen. The domain stays
 * visible - it is not the private half, and it is what makes the address
 * recognisable at a glance.
 *
 * A value with no usable local part (missing `@`, or a single character before
 * it) is returned unchanged rather than mangled into something unrecognisable.
 */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@')
  if (at <= 1) return email
  const local = email.slice(0, at)
  // Odd lengths hide the smaller half: 5 chars -> 3 visible, 2 bullets.
  const visible = Math.ceil(local.length / 2)
  const hidden = '•'.repeat(local.length - visible)
  return `${local.slice(0, visible)}${hidden}${email.slice(at)}`
}
