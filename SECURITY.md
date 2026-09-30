# SECURITY.md

## Secrets extracted from the legacy codebase

The legacy vanilla site (preserved in git history) committed credentials
directly in source. Disposition during this migration:

| Legacy secret                          | Where it lived                         | Action taken                                                                                                                                                                                                    |
| -------------------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mainSmtpToken` = `b52b8a29-…`         | `src/index.js:6`                       | **Dead config** - referenced nowhere in any legacy file. Not carried into the new codebase at all. ⚠️ Treat as compromised regardless (it was pushed to a public-ish repo): revoke/rotate on the SMTP provider. |
| `companySmtpToken` = `88263185-…`      | `src/index.js:7`                       | Same as above - dead, removed, rotate recommended.                                                                                                                                                              |
| EmailJS service id `service_k2c0eve`   | `src/contact.js:406`                   | Moved to `EMAILJS_SERVICE_ID` (.env).                                                                                                                                                                            |
| EmailJS template id `template_kmxsnuc` | `src/contact.js:407`                   | Moved to `EMAILJS_TEMPLATE_ID` (.env).                                                                                                                                                                           |
| EmailJS public key `2y064p5z9qRvVxOHN` | inline `<script>` in every legacy page | Moved to `EMAILJS_PUBLIC_KEY` (.env). Public keys are public-by-design, but they are configuration, not code.                                                                                                     |
| Font Awesome kit URL (`4f48855ba9`)    | every legacy page                      | Eliminated entirely - replaced with `react-icons`; no per-account dependency remains.                                                                                                                           |

## What stays in source (intentionally NOT secrets)

Phone number, email addresses, street address, Google Maps embed id and Waze
deep link are **public-facing business details** displayed on the site. They
live in `src/config/siteConfig.ts` as typed constants.

## Environment variable rules

- Client variables use the clean (non-prefixed) names (`EMAILJS_*`,
  `BOI_INTEREST_URL`, `CBS_API_BASE`), inlined into the browser bundle via the
  `env` block in `next.config.ts`; `NEXT_PUBLIC_*` spellings are also accepted
  and preferred. (The legacy `VITE_*` fallback was removed once nothing set
  it; the adapter in `src/config/env.ts` reads only `NEXT_PUBLIC_*` and the
  bare names.) **Anything client-side is
  public.** Never place server-only credentials in client variables.
- Server-only variables carry no prefix and are reachable only from server
  code: `FINNHUB_API_KEY`, `MONGODB_URI`, `BETTER_AUTH_SECRET`,
  `RESEND_API_KEY`, `AUTH_EMAIL_FROM`.
- `.env` is git-ignored; `.env.example` documents the required shape.
- `src/config/env.ts` validates the CLIENT variables through a Zod schema at
  startup. Server-only config is validated lazily at first use
  (`src/server/market/config.ts`, `src/server/auth/config.ts`) so `next build`
  never needs a secret.

## Authentication (Better Auth + MongoDB)

- **Library**: Better Auth (the stable line). It owns password hashing
  (scrypt), session storage and rate limiting; none of that is hand-rolled
  here. Passwords are never stored in plaintext, logged, or returned.
- **Sessions** are opaque tokens in an httpOnly cookie, stored in MongoDB and
  validated server-side on every protected request (`getServerSession`).
- **Authorization is per-user and server-side.** `src/proxy.ts` performs only
  an optimistic cookie-existence check to avoid rendering a protected page for
  a visitor with no cookie at all ~ it is explicitly NOT the gate, and the
  forged-cookie e2e test proves it. The real check lives in each protected page
  and route handler, and any per-user data added later (profile, saved
  calculations, the CRM) must be scoped to the session user on every query,
  never by a guessable id from the client.
- **Roles**: `client < advisor < admin`, stored on the user record and settable
  server-side only (`input: false`, so a signup payload cannot self-assign a
  role). New sign-ups get `client`.
- **Rate limiting**: Better Auth's built-in limiter covers the auth endpoints
  (default 100 requests / 60s, tighter on `/sign-in/email` and
  `/sign-up/email`, and 3/min on the password-reset and resend-verification
  entry points, since each one mails a real person), with the counter stored
  in MongoDB so it holds across instances rather than resetting per process.
  It keys on the client IP from `x-forwarded-for` (Render's proxy).
- **Password reset** uses the email-OTP plugin, not a reset link: a 4-digit
  code, valid 5 minutes, 3 attempts, stored hashed, so a database dump carries
  no usable codes and the code cannot be replayed from a mail scanner's
  prefetch of a URL. Requesting a code answers the same way whether or not the
  address has an account, so the endpoint cannot enumerate users.
  `revokeSessionsOnPasswordReset` is on: a session stolen before the reset
  does not survive it, which is the usual reason the password is being changed.
- **Email verification**: required when `RESEND_API_KEY` is set; the token and
  verification URL are generated by Better Auth, only the rendered message is
  ours (`src/server/auth/email.ts`, localized from the i18n files). The OAuth
  / app code never touches card data.
- **Secrets**: `MONGODB_URI`, `BETTER_AUTH_SECRET` and `RESEND_API_KEY` are
  server-only, live in the git-ignored `.env`, and are never exposed as
  `NEXT_PUBLIC_*`. `BETTER_AUTH_SECRET` must be a random 32+ character value
  (Better Auth refuses to start in production without one); rotating it
  invalidates every session.
- **Logging**: auth code never logs passwords, tokens, session values, or full
  email addresses; failure logs carry an error message only.
- **Deployment**: set these as Render environment variables
  (`BETTER_AUTH_SECRET` generated, the rest `sync: false`) and, if ever added
  as CI/deploy credentials, as GitHub **environment** secrets scoped to
  dedicated `dev`/`qa`/`production` environments ~ never repo-wide. CI itself
  stays secret-free (a throwaway Mongo service container plus dummy values).

## CI

The pipeline runs fully mocked: e2e tests intercept the BOI/CBS/EmailJS
endpoints, so CI requires **zero** real secrets (dummy values are exported in
the workflow). If real deployment credentials are introduced later (e.g. a
deploy job), store them as GitHub **environment secrets** scoped to dedicated
`dev` / `qa` / `production` environments - never as repository-wide secrets,
and never printed in logs.
