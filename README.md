# makeyev-finance

[![E2E test reports](https://img.shields.io/badge/E2E%20test%20reports-view-blue)](https://a-makeyev.github.io/makeyev-finance/)

Bilingual (Hebrew RTL / English) mortgage-advisory site with a financially
precise multi-track mortgage calculator. The legacy vanilla HTML/CSS/JS site
(preserved in git history) was migrated to a typed, tested, CI-gated Next.js
application; the legacy Vite/Express app was removed in phase 3.

## Stack

| Concern          | Choice                                                                                                         |
| ---------------- | -------------------------------------------------------------------------------------------------------------- |
| Framework        | Next.js 16 App Router + React 19 + TypeScript (`strict`)                                                       |
| Package manager  | npm                                                                                                            |
| Routing          | App Router route groups: Hebrew unprefixed at the root, English under `/en`                                     |
| Calculator state | Zustand (+ immer), ported from the legacy state machine                                                         |
| Data fetching    | TanStack Query wrapping native `fetch` with silent-fail semantics identical to the legacy site                  |
| Market data      | Next route handlers (`src/server/market`) - Finnhub + Frankfurter + Yahoo providers, API keys server-side only   |
| Forms            | Zod validation (regexes ported verbatim) with custom floating-label fields                                       |
| i18n             | react-i18next - Hebrew default, per-locale instance, document RTL on the Hebrew calculator/compare routes        |
| UI primitives    | Radix Dialog (focus trap / Escape / overlay), native `select` and `range` preserved; Tailwind CSS               |
| Icons            | react-icons (Font Awesome set)                                                                                  |
| Email            | @emailjs/browser (credentials via env only)                                                                     |
| Deploy           | Render (`render.yaml`), one service                                                                             |

## Getting started

```bash
npm install
cp .env.example .env      # fill values; dev placeholders work, FINNHUB_API_KEY is optional
npm run dev               # Next dev on http://localhost:3000
```

Without `FINNHUB_API_KEY` the `/api/market/quotes` endpoint degrades to 503 and
the Markets strip hides itself; everything else works.

## Scripts

| Script               | Purpose                                                        |
| -------------------- | -------------------------------------------------------------- |
| `npm run dev`        | Next dev server on :3000                                       |
| `npm run build`      | Production build (includes typecheck)                          |
| `npm run start`      | Serve the production build                                     |
| `npm run typecheck`  | `tsc --noEmit` for the app and the e2e sources                 |
| `npm run lint`       | ESLint (flat config)                                           |
| `npm test`           | Vitest unit suite                                              |
| `npm run test:e2e`   | Playwright suite (builds + boots the production Next server)   |

## Architecture

```text
src/
  app/
    (he)/            Hebrew routes, unprefixed (locale root layout)
    (en)/en/         English routes, /en-prefixed (locale root layout)
    api/market/      GET /api/market/quotes route handler
  components/        layout chrome (Navbar, IndexesBar, MarketTracker, Footer)
                     ui primitives (MoneyInput, TermSlider, AppModal)
  features/
    calculator/      Page · TrackForm · PresetSelector · ResultsCards · ScheduleSection
    compare/         ComparePage · computeScenario
    contact/         ContactForm · MessageModal · emailjsClient (deadlock-retry)
  i18n/              he.ts · en.ts · per-locale instance + direction policy
  lib/               amortization.ts (pure mortgage math + BoI rules) · format.ts
                     charts.ts · xml.ts (CBS parser) · marketFormat.ts
  server/market/     Finnhub + Frankfurter + Yahoo providers, service, cache,
                     persistence, asset registry (server-only; keys never ship)
  services/          boi.ts · cbs.ts · market.ts (typed fetch wrappers)
  stores/            calculatorStore · comparisonStore · questionWishlistStore
  theme/             theme store + pre-paint scripts (theme, language, direction)
tests/unit/          Vitest suites
e2e/                 Playwright: page objects (pom) · support/mocks.ts · tests/{ui,api}
```

The CSS in `src/styles/globals.css` is a verbatim port of the legacy stylesheet,
kept as the pixel-parity contract. See `MIGRATION.md` for the phase-by-phase
record and `SECURITY.md` for the secret-handling ledger.
