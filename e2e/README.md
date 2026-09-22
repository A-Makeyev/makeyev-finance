# E2E suite layout

Playwright tests for the client app. Run with `npm run test:e2e` (all projects)
or target one: `--project=ui-chromium` / `--project=api-chromium`.

```
e2e/
  data/        Shared fixture data (plain values, no Playwright imports)
  fixtures/    test.extend fixtures + seeding helpers (the `test`/`expect` specs import)
  pages/       Page Object Model classes (one class per page/feature surface)
  support/     Generic helpers: route mocks, currency-text helpers
  tests/
    api/       API-level specs (live-data fallbacks)
    ui/        UI specs, one file per feature surface
      calculator/  Calculator specs split by concern (core/tracks/summary/schedule)
```

## Conventions

**Imports.** Specs import `test`/`expect` from the fixtures entry point, never
from `@playwright/test`:

```ts
import { test, expect } from '../../fixtures'
```

The composed `test` carries every fixture; a suite that must NOT mock the
external feeds (marketTracker, qa-visual) simply never destructures
`mockedPage`/`calc`/`contact`, so the intercepts never install and its behavior
is unchanged.

**Fixtures** (`fixtures/index.ts`):

| Fixture           | Gives you                                                        |
| ----------------- | ---------------------------------------------------------------- |
| `mockedPage`      | The default `page` with BOI/CBS/EmailJS intercepts installed     |
| `calc`            | `CalculatorPage` wired to `mockedPage` (navigate it yourself)    |
| `contact`         | `ContactFormPage` wired to `mockedPage`                          |
| `actionModal`     | `ActionFormModalPage` wired to `mockedPage`                      |
| `emailjsRequests` | URLs of every EmailJS POST the mocks observed (assert with this) |
| `externalMocks`   | Suite-level mock options; `test.use({ externalMocks: {...} })`   |
| `languagePage`    | Page with the `language` option pre-seeded in localStorage       |
| `localizedCalc`   | `languagePage` + `CalculatorPage`                                |
| `themedPage`      | Page with the `theme` option pre-seeded in localStorage          |

Options set per suite or test with `test.use({ ... })`; defaults are
`boiKeyRate: 4.5` (when mocked) and `language: 'hebrew'`, `theme: 'light'`.
A failing endpoint is simulated per test by overriding, e.g.
`test.use({ externalMocks: { boiKeyRate: null } })`.

**Seeding in loops.** When language/theme varies per iteration of a
`for` loop, use the imperative helpers instead of the fixtures:

```ts
import { seedLanguage, seedSiteState } from '../../fixtures'
// ...
seedLanguage(page, language) // or seedSiteState(page, { language, theme: 'dark' })
```

**Page objects** (`pages/`): selectors and interactions live here, never
inline in specs (see AGENTS.md). A UI change means fixing one page object,
not every test.

**Fixture data** (`data/`): values shared by more than one spec (market
quotes, contact payloads, storage keys) live here so a fixture change
happens once. Single-suite values can stay local to their spec.

**Route mocks** (`support/`): `mocks.ts` owns the external BOI/CBS/EmailJS
intercepts; `marketMocks.ts` owns the `/api/market/quotes` responder. New
mocked endpoints belong there, not inline in specs.

## Evaluating in the page

The e2e tsconfig has no DOM lib, so `page.evaluate` callbacks that touch the
DOM are passed as strings (`page.evaluate('(() => {...})()')`), never as
inline arrow functions. This is the established pattern across the suite.
