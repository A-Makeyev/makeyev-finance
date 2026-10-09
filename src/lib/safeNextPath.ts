/**
 * The `?next=` target a gate (or a link) hands the sign-in page, kept only when
 * it is an in-app path.
 *
 * `next` comes from the URL, so it is user-controlled: a value like
 * `https://evil.test` or the protocol-relative `//evil.test` would turn the
 * sign-in page into an open redirect the moment the visitor is signed in.
 * Everything this app sets is path-relative (`/profile`, `/profile?delete=...`),
 * so anything else falls back to the home page instead of being followed.
 */
export function safeNextPath(value: string | null | undefined): string {
  if (!value || !value.startsWith('/')) return '/'
  // `//host` and `/\host` are both read as an origin by browsers, so a mere
  // leading slash is not enough.
  if (value.startsWith('//') || value.startsWith('/\\')) return '/'
  return value
}
