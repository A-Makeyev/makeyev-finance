# makeyev-finance

[![E2E test reports](https://img.shields.io/badge/E2E%20test%20reports-view-blue)](https://a-makeyev.github.io/makeyev-finance/)

Bilingual (Hebrew RTL / English) mortgage-advisory site with a financially
precise multi-track mortgage calculator. This is a production-grade migration
of the legacy vanilla HTML/CSS/JS site (preserved in git history) to a typed,
tested, CI-gated React application.

## Stack

| Concern          | Choice                                                                                                                                                   |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Build            | Vite 5 + React 18 + TypeScript (`strict`)                                                                                                                |
| Package manager  | npm                                                                                                                                                      |
| Routing          | React Router v7 (SPA, 5 routes mapped 1:1 from legacy pages)                                                                                             |
| Calculator state | Zustand (+ immer) - mirrors the legacy state machine exactly                                                                                             |
| Data fetching    | TanStack Query wrapping native `fetch` (BOI prime rate, CBS indexes) with **silent-fail** semantics identical to the legacy site                         |
| Forms            | React Hook Form + Zod (validation regexes ported verbatim)                                                                                               |
| i18n             | react-i18next - Hebrew default, full document-level RTL/LTR                                                                                              |
| UI primitives    | Radix Dialog (focus trap / Escape / overlay), native `select` and `range` preserved deliberately; Tailwind CSS with logical properties + `rtl:` variants |
| Icons            | react-icons (Font Awesome set) replacing the per-account FA kit                                                                                          |
| Email            | @emailjs/browser (credentials via env only)                                                                                                              |

## Getting started

```bash
npm install
cp .env.example .env      # then fill real values (dev placeholders work too)
npm run build             # once, so Express has SPA files to serve
npm run dev               # Vite on http://localhost:5173 (HMR) + Express on http://localhost:3000

# UI only:
npm run client:dev        # http://localhost:5173 (Vite, HMR)
```

`npm run dev` runs Vite (UI) and the Express server (serves the built
`client/dist/` SPA) side by side; run `npm run build` first so Express has
files to serve.

## Scripts

| Script                                 | Purpose                                                                                                                          |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `npm run client:dev`                   | Vite dev server                                                                                                                  |
| `npm run dev`                          | Vite dev server + Express server together (run `npm run build` once first; Express serves the built SPA on :3000, Vite on :5173) |
| `npm run server:dev`                   | Express server only, on :3000                                                                                                    |
| `npm run build`                        | Typecheck (both tsconfigs) + production build                                                                                    |
| `npm run preview`                      | Serve `client/dist/` on :5173                                                                                                    |
| `npm run typecheck`                    | `tsc --noEmit` for app + node configs                                                                                            |
| `npm run lint`                         | ESLint (flat config)                                                                                                             |
| `npm run format` / `format:check`      | Prettier                                                                                                                         |
| `npm test`                             | Vitest unit suite (amortization math, formatters, XML parser)                                                                    |
| `npm run test:e2e`                     | Full Playwright matrix (3 browsers × UI + API project)                                                                           |
| `npm run test:e2e:ui` / `test:e2e:api` | Project subsets                                                                                                                  |

E2E uses `vite preview` against `client/dist/`; run `npm run build` first (CI
does this for you). Tests never touch the real network - BOI/CBS/EmailJS are mocked.

## Test results

Every push to `main` and pull request runs the full suite in CI (lint,
typecheck/build, unit tests, then the Playwright UI + API matrix). The E2E
results - per-run pass/fail status and the HTML trace reports - are published
to GitHub Pages and browsable at:

**[Test Reports - https://a-makeyev.github.io/makeyev-finance/](https://a-makeyev.github.io/makeyev-finance/)**

The page keeps the last 10 runs, newest first, with auto-refresh when a new
run lands.

## Architecture```

client/
index.html Vite entry
public/ static assets (images, favicon)
src/
config/ env.ts (zod-validated env) · siteConfig.ts (public business info)
i18n/ he.ts · en.ts · provider (document dir/lang switching)
lib/ amortization.ts (pure mortgage math + BoI rules)
format.ts (currency/input caret formatting) · xml.ts (CBS parser)
services/ boi.ts · cbs.ts (typed fetch wrappers, silent-fail parity)
market.ts (GET /api/market/quotes client + react-query hook)
stores/ calculatorStore.ts (tracks, sync modes, dirty flags, snapshot)
components/
layout/ Navbar · IndexesBar · MarketTracker · Footer · OfflineBanner · Loader · Reveal
ui/ MoneyInput · TermSlider (CSS-variable fill) · AppModal (Radix)
features/
calculator/ Page · TrackForm · PresetSelector · ResultsCards · ScheduleSection
contact/ ContactForm · FloatingLabelField · MessageModal · ActionFormModal
emailjsClient.ts (deadlock-retry) · validation.ts (zod schemas)
pages/ Home · Services · Articles
tests/unit/ Vitest suites for lib/ + market data
server/ server.js (Express - serves client/dist, SPA fallback)
market/ (market data integration: Finnhub + Frankfurter +
Yahoo providers, service, cache, asset registry,
/api/market/quotes route; API keys stay server-side only)
e2e/ playwright config in root; pom/ · support/mocks.ts · tests/{ui,api}

```

### Market tracker

The "Markets" strip below the Indexes bar is powered by market-data providers
through our own server (never from the browser - `FINNHUB_API_KEY` is
server-only):

```

Navigation (MarketTracker)
-> GET /api/market/quotes
-> MarketDataService (per-provider-group cache, per-asset failure isolation)
-> FinnhubProvider (/quote: ETFs + BINANCE:BTCUSDT, real-time)
-> FrankfurterProvider (ECB daily FX series: USD/ILS, keyless)
-> YahooProvider (chart daily series: the TA-35 index + gold futures, keyless)

```

- Real instruments rather than stand-ins: S&P 500/NASDAQ rows are named by
  their ETF tickers (SPY/QQQ), and GOLD is the COMEX front-month contract
  (Yahoo, GC=F) - dollars per troy ounce of the metal. The `futures` flag
  makes the UI say it is the contract, not a spot quote: spot gold and index
  levels are premium-only upstream, and the previous stand-in (GLD, the SPDR
  ETF) is a ~0.09 oz share whose ratio drifts with the fund's fee, so a
  ~$400 number was being shown under a metal's name. Nothing uses `proxyOf`
  today. TA-35 is the real index level (Yahoo, TA35.TA), alongside Bitcoin
  (BINANCE:BTCUSDT) and the ECB's USD/ILS reference rate.
- Every row runs at its own market's speed: batches are cached per PROVIDER +
  CADENCE group, so the registry marks a continuously-printing instrument
  `realtime` and it gets the provider's fast TTL. Defaults: SPY/QQQ/BTC every
  10s (18 of Finnhub's 60 free calls/min, so there is room for retries and a
  couple more rows), the gold contract every 15s, TA-35 every 15min (Yahoo's
  TASE feed is already ~15min delayed, so polling faster only wastes requests),
  and USD/ILS every 15min (the ECB publishes once a business day). The client
  polls every 10s, matching the fastest row.
- The cache is shared by every visitor and driven by time rather than traffic:
  one viewer or ten thousand cost the same upstream calls, and with nobody on
  the site nothing is polled at all. `client/tests/unit/marketService.test.ts`
  asserts the registry plus these defaults stay inside each free tier, so
  adding rows fails loudly instead of quietly exhausting a quota.
- Row units: USD-quoted rows carry `$`; the FX pair carries the sign of its
  quote leg (`₪3.0192`, shekels per dollar); an index level stays bare, since
  it is measured in points, and names that unit in its hover tooltip (the
  strip has no room for a suffix at 360px).
- Loading and gaps: before the first snapshot the strip holds its EXACT final
  layout with shimmering bars for both values plus the trend arrow's line box,
  so the height the navbar offset reads never moves as quotes land. A row whose
  instrument has no price (its provider failed, or the request errored) is
  dropped rather than shown as a placeholder; the strip keeps its height and
  the hook keeps polling, so it heals itself with no retry control.
- Adding an asset (stock, coin, watchlist row) is one entry in
  `server/market/assets.ts` - no new API logic.
- Configuration: `FINNHUB_API_KEY`, `MARKET_DATA_FINNHUB_CACHE_TTL`,
  `MARKET_DATA_YAHOO_CACHE_TTL`, `MARKET_DATA_CACHE_TTL`,
  `MARKET_DATA_REFRESH_INTERVAL` (see `.env.example`).

### The calculator state machine

The legacy calculator's behavior lives in DOM mutations and module globals.
The port keeps every rule but makes it explicit:

- amounts are stored as **formatted display strings** and parsed exactly like
  the legacy DOM reads, preserving empty-vs-zero distinctions;
- property-value → loan derivation (including the "אין צורך 🥳" zero-loan
  state and gross restore-on-clear memory);
- proportional track rebalancing with last-track remainder absorption;
- Bank of Israel limits: LTV caps per purpose (75/70/50), the ⅔ variable-rate
  ceiling with tolerance, and the algorithmic auto-fix rebalancer;
- DTI warning with rounded suggested-minimum income;
- Spitzer / equal-principal amortization incl. CPI-indexed balance inflation
  using live CBS data when available (2% fallback otherwise);
- BOI prime rate (+1.5 margin) applied only to tracks whose rate the user has
  not overridden.

All of the math is pure (`client/src/lib/amortization.ts`) and pinned by
golden unit tests; see `client/tests/unit/amortization.test.ts`.

## Migration notes

Deliberate behavior changes (each flagged in the PR description / commit):
numeric trend comparisons replace the legacy string comparison for CBS index
arrows; deadlock retry is capped at 3; dev autofill button is gated by
build mode instead of URL sniffing; dead legacy code (unused SMTP tokens,
`sleep`, orphaned CSS) was dropped. Everything else is 1:1.

See [SECURITY.md](./SECURITY.md) for the secret-extraction ledger.
```
