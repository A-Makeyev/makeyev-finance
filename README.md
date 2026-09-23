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
