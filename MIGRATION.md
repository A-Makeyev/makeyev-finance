# Next.js migration

Living log for the migration to Next.js (App Router). Read this together with
the scoping document; this file records what was actually decided and done,
so the next phase (or the next agent) starts from facts, not memory.

## Decisions (confirmed with Anatoly, 2026-09)

| Decision | Choice | Notes |
| --- | --- | --- |
| Locale routing | Prefix now (`/en/...`, Hebrew unprefixed) | No `/` redirect or Accept-Language sniffing; the stored `site_language` choice is followed client-side. Current URLs keep working (Hebrew stays unprefixed). |
| Backend | Keep a separate Express backend (phase 1) | The market-data proxy stayed a separate Express app through phase 2. **Phase 3 changed this** (confirmed with Anatoly): `/api/market` folded into Next route handlers, so there is no second backend today. **Phase 4 resolved the revisit**: still no second backend, and MongoDB enters as a managed connection to the existing instance. |
| Deploy | Stay on Render | `render.yaml` gains a `web` service (`next build` + `next start`). No new vendor. |
| Auth | Better Auth 1.7.x (changed from Auth.js/NextAuth) | Phase 4 scoping found Auth.js v5 still published as beta (`5.0.0-beta.32`) with v4 carrying the legacy API, so the stable Better Auth line was chosen instead. See "Phase 4" below. |
| Sequencing | Incremental, 4 phases | See "Phases" below. |

## Phase 1 (this change): Next alongside the existing app

`web/` is a self-contained Next.js 16 app (its own package.json, installed
with its own `npm install`). The legacy Vite/Express app is untouched and
still the source of truth for the calculator and compare pages.

What moved to Next in phase 1:

- Static content routes, both locales: home, `/services`, `/articles` +
  the four article pages, `/contact` (with the EmailJS form).
- Locale routing: two route groups, `(he)` at the root and `(en)/en`,
  each with its own root layout (`<html lang>` per locale, per-locale
  metadata, per-locale i18next instance - no shared mutable language state,
  the classic SSR hydration trap).
- The full chrome: navbar, footer, offline banner, markets-strip slot,
  wishlist pill/toast.
- The theme system, with the pre-paint script moved INTO a module
  (`web/src/theme/prePaint.ts`) that the root layout injects and the unit
  tests execute directly - one source, not a copied `<script>` block.
- The env adapter (`web/src/config/env.ts`): reads `NEXT_PUBLIC_*` with a
  `VITE_*` fallback so the deploy configs did not have to rename anything.
  (The `VITE_*` fallback was removed later, once every deploy config had
  moved to the clean names; the adapter now reads only `NEXT_PUBLIC_*` and
  the bare names.)

Phase-1 deltas, deliberate and visible:

- `/calculators` is a stub page (says so, links to the calculator in the
  current app, keeping the `?preset=` deep links alive). The real calculator
  is phase 2.
- The Markets strip slot renders chrome-only (no quotes): the real strip
  needs the market service + calculator store, which migrate with the
  calculator. The strip's height publisher (`--markets-height`) already
  works, so the navbar offset math is correct.
- The CBS Indexes strip is absent for the same reason; the design already
  treats a failed/absent index strip as a normal state.
- The contact form's "calculator scenario" email block is dropped until the
  calculator store migrates (phase 2).
- Document direction stays LTR on all phase-1 pages (parity with the
  current app, which keeps the document LTR outside the calculator/compare
  routes and opts into RTL locally). Fully structural per-locale RTL is a
  phase-2 decision with a visual QA pass - the verbatim stylesheet makes
  LTR assumptions that a document-level RTL flip invalidates (this was
  tried and reverted during phase 1: the legacy `.fade-in` offsets produced
  horizontal overflow).

Verification for phase 1 (all green):

- `web`: `tsc --noEmit`, `eslint .`, `vitest run` (49 tests), `next build`
  (20 routes, statically prerendered), and a dedicated Playwright suite
  (`playwright.web.config.ts`, 19 tests) covering locale routing, metadata,
  theme persistence, mobile nav, and overflow.
- Legacy app: lint + unit tests unchanged and green (the migration did not
  touch `client/` or `server/`).

## Phase 2 (done): calculator + compare

The calculator, comparison store and page, the live strips and the contact
scenario block now run in `web/`. What landed:

- Calculator store + comparison store, view model, every track/results/chart
  component, `lib/charts.ts`, `lib/timings.ts`, `useTooltipClamp`, and the
  `boi`/`cbs`/`market` services. Pure modules (`amortization`, `format`,
  `marketTypes`, the calculator CSS, all i18n keys) were already ported in
  phase 1 and are reused, not re-copied.
- Router seams: `useNavigate`, `useSearchParams` and `Link` added to
  `web/src/router.tsx`, so the ported components stay verbatim. The calculator
  reads `?preset=` from `window.location.search` in a mount effect instead of
  `useSearchParams`, so the route stays static and renders in the SSR HTML
  (no Suspense fallback); `?preset=` deep links still work.
- Route groups: `/calculators` + `/compare` in `(he)`, `/en/calculators` +
  `/en/compare` in `(en)`. The stub pages are deleted.
- Chrome: the real CBS Indexes strip and Markets strip replace the phase-1
  stubs, wired through `SiteChrome` (feeds, CPI -> calculator sync, navbar
  offsets, menu-hiding).
- RTL: document direction is decided pre-paint (`PRE_PAINT_DIRECTION_SCRIPT`,
  injected in both root layouts) so the Hebrew calculator/compare routes flip
  to RTL before paint and `SiteChrome` keeps it in step on navigation. A
  returning English visitor is hopped to `/en` before paint by
  `PRE_PAINT_LANGUAGE_SCRIPT` (same page, legacy parity) instead of by a React
  effect that raced navigation.
- Contact form: the calculator-scenario email block is restored.
- react-query provider added (`QueryProvider`) for the strips + calculator.
- The market API stays same-origin (`/api/market/quotes`). In phase 2 it was
  proxied to the Express backend; phase 3 folded it into a Next route handler
  (see below), so the proxy is gone and the service is unchanged.

Verification (all green): `web` tsc, eslint, 380 unit tests, `next build`
(22 routes, statically prerendered); legacy `npm test` 468 tests, root tsc,
root lint; the full Playwright suite retargeted to the Next server in
`playwright.config.ts` (132 passed, 12 skipped, 0 failed). Legacy-only deltas
in the e2e suite are test expectations, not app behavior: React 19's
`_R_<hash>_` aria ids, `/en`-prefixed article links, and a hydration wait in
the calculator page object (the calculator is now in the SSR HTML).

## Phase 3 (done): decommission the legacy app

Confirmed with Anatoly before running: flatten `web/` to the repo root, and
fold `/api/market` into Next route handlers (no second backend). Note on the
premise: `client/` had NO package.json or package-lock of its own; the ROOT
`package.json` / `package-lock.json` / `node_modules` were the LEGACY Vite
app's. So "one package.json at the root" meant the root files became the Next
app's, which required flattening.

Final layout (one frontend: one package.json, one node_modules, at the root):

```
/package.json            # the Next app's
/package-lock.json
/node_modules
/src  /public  /tests
/next.config.ts  /next-env.d.ts  /postcss.config.js  /tailwind.config.ts
/tsconfig.json  /tsconfig.e2e.json  /vitest.config.ts  /eslint.config.mjs
/e2e                     # Playwright; one config (playwright.config.ts)
/render.yaml             # one web service (no rootDir)
```

What happened:

- Market API folded in: `server/market/*` (including `YahooProvider`) moved to
  `src/server/market/`, with a framework-agnostic `quotes.ts`
  (`handleQuotes`) behind `src/app/api/market/quotes/route.ts`
  (`runtime = 'nodejs'`, `force-dynamic`). Imports lost their `.ts`
  extensions. The `next.config.ts` rewrite is gone; the strip still calls the
  same-origin `/api/market/quotes`. `FINNHUB_API_KEY` stays server-only.
- Flattened `web/src|public|tests` and its configs up to the root; the root
  `package.json` / lock / `node_modules` are now the Next app's.
- Deleted: `client/`, `server/` (folded), `web/`, `vite.config.ts`,
  `tsconfig.app.json`, `tsconfig.node.json`, the legacy root `package.json` +
  lock + `node_modules`, legacy `eslint.config.js`, `tailwind.config.js`, and
  `playwright.web.config.ts`.
- `@playwright/test` moved back into devDependencies (it was a legacy-root
  dep). e2e sources get their own `tsconfig.e2e.json`; `typecheck` runs both.
- CI collapsed to one `quality` job + one `e2e` job; `render.yaml` is one
  service (`npm ci && npm run build`, `npm start`, `healthCheckPath: /`).
- Docs (`README.md`) rewritten for the Next app.

Verification (all green from the root): lint, typecheck (app + e2e), 431 unit
tests, `next build` (22 routes: 21 static + the dynamic quotes route), and the
full Playwright suite in the one config: 151 passed, 12 skipped, 0 failed.

## Phase 4: new work on the Next foundation

Auth (Auth.js), MongoDB, advisor CRM, AI chat - each scoped separately, as
decided. `src/proxy.ts` is the seam for role-gated `/advisor` and `/client`
segments.

## Phase 4 (in progress): auth on the Next foundation

Scoped before building, since auth is a new subsystem and a new dependency.
Decisions confirmed with Anatoly:

- **Library**: Better Auth 1.7.x, not Auth.js. Reason: Auth.js v5 is still on
  the npm beta tag while v4 carries the legacy API; Better Auth is the stable
  line and its Next peer range covers Next 16.
- **Sign-in**: email + password now; OAuth later. Better Auth owns hashing and
  sessions, so nothing is hand-rolled (see AGENTS.md / SECURITY.md).
- **Verification**: email verification included, sent through Resend, with the
  message localized from the same i18n files as the UI.
- **Database**: the existing MongoDB instance. The Mongo adapter creates its
  collections implicitly, so there is no schema/migration step.
- **Gated segments**: `/advisor` (advisor or admin) and `/client` (any signed-in
  user), with placeholder bodies ~ proving the gate is the deliverable here;
  the CRM is a later phase.

What landed:

- `src/server/auth/*`: pure config (`config.ts`), role rules (`roles.ts`),
  cached Mongo client (`mongo.ts`), the lazy Better Auth instance (`index.ts`),
  the session helper (`session.ts`) and the Resend sender (`email.ts`).
- `src/app/api/auth/[...all]/route.ts` (Node runtime, dynamic).
- `src/lib/auth-client.ts` and `src/features/auth/{AuthPage,GatedArea}.tsx`.
- Routes: `/login`, `/advisor`, `/client` plus their `/en/...` mirrors.
- `src/proxy.ts` gained the optimistic cookie gate; the authoritative check is
  server-side in each protected page.
- Navbar account control (sign in / sign out).
- i18n: an `auth.*` block in both `he.ts` and `en.ts`, email copy included.
- `.env.example`, `render.yaml`, `SECURITY.md` and CI updated.

Direction: the Hebrew auth pages are now RTL at the document level, like every
other Hebrew page (see "Direction follows the locale" below). The markup was
already written with logical CSS utilities and per-field `dir`, so it needed no
per-component override to make that switch.

### Password reset (email OTP), added on top of the auth phase

Decision: a 4-digit code emailed to the address, not a reset link. The code is
entered in a panel of the existing `/login` card, so no new route pair was
added and the flow stays on one page on mobile; a link would also be fetched by
mail scanners before the user could click it. Implementation:

- `emailOTP` plugin in `src/server/auth/index.ts` (`otpLength: 4`,
  `expiresIn: 300`, `allowedAttempts: 3`, `storeOTP: 'hashed'`) with the OTP
  endpoints added to the custom rate-limit rules, and
  `revokeSessionsOnPasswordReset: true` (off by default in Better Auth: a
  session stolen before the reset would otherwise keep working).
- `sendPasswordResetOtpEmail` + `buildOtpEmail` in `src/server/auth/email.ts`,
  localized from the same `auth.emails` i18n keys as the verification mail.
  `sendVerificationEmail` was restored alongside it: the earlier refactor left
  `index.ts` importing a sender that no longer existed.
- Better Auth 1.7 API notes: `socialProviders` takes plain option objects, not
  `google({...})` instances, and `sendVerificationOTP` receives the endpoint
  context as its second argument (the request is read off it), while
  `emailVerification.sendVerificationEmail` receives the request directly.
- UI: an `auth-forgot` link on the sign-in tab opens
  `src/features/auth/AuthPage.tsx`'s reset panel (request code -> code + new
  password -> done), with copy in both locales. The code is four square digit
  inputs, and their editing rules live in `src/features/auth/otp.ts` as a pure
  function (`applyOtpInput`) over four fixed slots: a single digit overwrites
  its box, a paste or the OS one-time-code autofill spreads from the caret box,
  non-digits never land, and boxes stay in place instead of collapsing. None of
  the boxes carries `maxLength` - it would clip such a multi-digit string to its
  first digit before React saw it.
- Tests: `tests/unit/authEmail.test.ts` covers the OTP template and
  `tests/unit/authOtpInput.test.ts` the box editing rules (paste, non-digits,
  a later box, overflow); the auth e2e suite gained the reset flow, the digit
  filter, the four-box layout, the 360px fit and the English locale, and
  `theme.spec.ts` checks the panel's roles in dark mode.
- `playwright.config.ts` loads the repo-root .env (through `@next/env`) and
  computes the enabled provider list with the app's own `parseSocialProviders`,
  handing it to the specs as `E2E_SOCIAL_PROVIDERS`. The expectations about
  social buttons therefore describe the same build Next made locally and in CI,
  instead of only passing on a machine with no credentials.

### Auth UX: avatar account menu + social sign-in, added on top of the reset flow

- Google is the only social sign-in provider (Facebook and Apple were removed
  by product decision; no facebook/apple code, CSS or env var is left, and the
  Facebook page link/embed that used to sit in the chrome and the contact page
  is gone with them). It is enabled by setting BOTH env vars
  (`GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`). `parseSocialProviders` in
  `src/server/auth/config.ts` is the single source: the server registers the
  provider in `src/server/auth/index.ts` (with `overrideUserInfoOnSignIn`, so
  the Google photo lands on `user.image` for accounts that existed before the
  OAuth link), and `next.config.ts` exposes only the enabled LIST
  (`AUTH_SOCIAL_PROVIDERS`) to the client, never the id/secret. The login
  page renders one full-width centered Google button when enabled and none
  otherwise, so it can never advertise a handshake that would fail. The button
  leads the card and carries the bare brand name (`auth.socialGoogle`, no
  "continue with" wrapper); the `auth.orEmail` rule sits BELOW it, introducing
  the email form. The icon+label row inside the button is pinned LTR, so in the
  RTL Hebrew document the G still sits left of the word, as the brand renders.
- Navbar: while the session lookup is in flight the account control shows a
  quiet spinner in the trigger's slot (previously empty, so the row jumped);
  in EVERY session state it is then the same circular 28px avatar trigger
  (the old bare sign-in icon link is gone): the provider photo when the
  session has `user.image` (Google returns one, rendered with
  `referrerPolicy="no-referrer"`), else the initials of the name, else an
  empty person-glyph avatar (which is also the signed-out look). Hover
  (desktop), click, and focus all open a dropdown with the color mode row on
  top (the same toggle as the navbar crescent, keeps the menu open); signed
  in it continues with the identity line, a disabled Profile item (the page
  does not exist yet) and Sign out; signed out with a Sign-in item linking to
  /login. The menu closes on outside click, Escape, or navigation. Sign out
  lands on the home page. On the scrolled light bar (`links-dark`) the
  initials/glyph flip to ink and the photo's ring goes dark, so the avatar
  stays visible instead of white-on-aliceblue.
- Auth page: every submit (sign in, sign up, send code, reset) swaps its label
  for a spinner only (same box height, aria-busy, btn-sheen) instead of a
  skeleton; the forgot-password link sits first in a justify-between row with
  the create-account hint, i.e. LEFT in English/LTR and flipping to the start
  side in Hebrew/RTL via logical utilities. The reset code is four square
  digit inputs (auto-advance, paste spreads, backspace falls back, arrow keys
  walk the boxes); all four share the `auth-otp` testid.
- Tests: `tests/unit/authSocialProviders.test.ts` covers the provider-parse
  rules (empty/partial/full/order, plus leftover facebook/apple env keys
  staying inert); the e2e page objects moved to the new
  testids (nav-account/nav-avatar/nav-account-menu/nav-account-signout,
  auth-forgot/auth-otp/auth-new-password), and the suites assert the avatar
  menu behavior, the photo avatar, the sign-out-to-home landing, the
  forgot-link side per locale, the pending spinner slot, the avatar's
  contrast on the scrolled bar, and that no social buttons render without
  credentials.

### Account lifecycle: deleting the account, and what a deleted author leaves behind

- Deletion lives on the profile page behind a warning modal (danger-styled
  button, `auth.profileDelete*` copy). Better Auth's own `delete-user` endpoint
  does the work (`user.deleteUser` is enabled in `src/server/auth/index.ts`, and
  `afterDelete` purges the account's private rows); nothing about the account is
  deleted by the component. The submit stays disabled until the profile's own
  word is typed (`src/lib/confirmWord.ts`) and, for an account that has a
  password, that password is filled in. Whether a password is asked for at all
  is decided server-side per request (`accountHasPassword`), because an account
  created through Google has none to give; without a password Better Auth falls
  back to its session-freshness rule (one day), and the modal explains that
  refusal. `/delete-user` also carries a 10-per-minute rate rule, since it
  verifies a password.
- What is removed: the user row, its sessions, its linked account rows, its
  saved mixes. What stays: the user's comments, which are part of a public
  thread other people replied to. The thread keeps the name the comment was
  posted under and marks it "(deleted account)" (`comments.deletedAuthor` /
  `replies.deletedAuthor`); the marker comes from a per-list lookup of the
  authors' accounts (`missingAuthorIds` in `src/server/comments/repo.ts`), not
  from a join on every render.
- Orphaned account rows (an `account` row whose user is gone) are released
  automatically before a social sign-in starts, so a Google subject that was
  linked once and whose owner row has since been deleted no longer dead-ends
  every later Google sign-in with `?error=unable_to_link_account`
  (`src/server/auth/orphanedAccounts.ts`, with the dashboard still available as
  `npm run auth:doctor -- --repair`).

## Running the app

```bash
npm install
npm run dev          # Next dev on 3000

# Tests
npm test             # unit tests
npm run test:e2e     # full e2e (builds + boots the production server on 3100)

# Production
npm run build && npm run start
```
