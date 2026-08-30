# makeyev-finance

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
npm run dev               # http://localhost:5173 (Vite, HMR)

# Full stack, production-like:
npm run build && npm run dev:all   # Express on http://localhost:3000, Vite on :5173
```

`npm run dev:all` runs Vite (UI) and the Express server (serves the built
`client/dist/` SPA) side by side; run `npm run build` first so Express has
files to serve.

## Scripts

| Script                              | Purpose                                                       |
| ----------------------------------- | ------------------------------------------------------------- |
| `npm run dev`                       | Vite dev server                                               |
| `npm run dev:all`                   | Vite dev server + Express server together (run `npm run build` once first; Express serves the built SPA on :3000, Vite on :5173) |
| `npm run server:dev`                | Express server only, on :3000                                 |
| `npm run build`                     | Typecheck (both tsconfigs) + production build                 |
| `npm run preview`                   | Serve `client/dist/` on :5173                                  |
| `npm run typecheck`                 | `tsc --noEmit` for app + node configs                         |
| `npm run lint`                      | ESLint (flat config)                                          |
| `npm run format` / `format:check`   | Prettier                                                      |
| `npm test`                          | Vitest unit suite (amortization math, formatters, XML parser) |
| `npm run test:e2e`                  | Full Playwright matrix (3 browsers × UI + API project)        |
| `npm run test:e2e:ui` / `test:e2e:api` | Project subsets                                            |

E2E uses `vite preview` against `client/dist/`; run `npm run build` first (CI
does this for you). Tests never touch the real network - BOI/CBS/EmailJS are mocked.

## Architecture

```
client/
  index.html    Vite entry
  public/       static assets (images, favicon)
  src/
    config/       env.ts (zod-validated env) · siteConfig.ts (public business info)
    i18n/         he.ts · en.ts · provider (document dir/lang switching)
    lib/          amortization.ts (pure mortgage math + BoI rules)
                  format.ts (currency/input caret formatting) · xml.ts (CBS parser)
    services/     boi.ts · cbs.ts (typed fetch wrappers, silent-fail parity)
    stores/       calculatorStore.ts (tracks, sync modes, dirty flags, snapshot)
    components/
      layout/     Navbar · IndexesBar · Footer · OfflineBanner · Loader · Reveal
      ui/         MoneyInput · TermSlider (CSS-variable fill) · AppModal (Radix)
    features/
      calculator/ Page · TrackForm · PresetSelector · ResultsCards · ScheduleSection
      contact/    ContactForm · FloatingLabelField · MessageModal · ActionFormModal
                  emailjsClient.ts (deadlock-retry) · validation.ts (zod schemas)
    pages/        Home · Services · Articles
  tests/unit/   Vitest suites for lib/
server/         server.js (Express - serves client/dist, SPA fallback)
e2e/            playwright config in root; pom/ · support/mocks.ts · tests/{ui,api}
```

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
