/**
 * Escapes a value for interpolation into an HTML email body.
 *
 * Every dynamic value in every mail template goes through this. The auth
 * templates carried their own copy before; sharing one keeps the contact
 * template (whose values ARE user input) from drifting away from it.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Strips CR/LF and trims, for anything destined for a mail header. */
export function headerSafe(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim()
}
