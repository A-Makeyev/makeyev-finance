# Agent instructions

## Never use em dashes

Do not write the em dash character (`—`, U+2014) anywhere in this project: not in code, comments, strings, translations, copy, docs, commit messages, or chat responses to the user.

- Use `~` (the user's chosen separator for email/copy strings) or a plain hyphen `-` where grammar needs a dash.
- If you find existing em dashes while editing a file, replace them in the same change.
- Rationale: the user dislikes the character and had all of them removed from the codebase (replaced with `~`); keep it that way.

## Ground rules

- Don't restructure, rename, or "clean up" working code as a side effect of an unrelated task. Flag it and ask instead.
- When a change is architectural (new subsystem, new data model, new dependency, anything hard to undo later) - propose the shape first rather than building against assumptions. This applies especially as the app grows beyond the calculator (auth, CRM, blog, marketing all landing in this repo) - each of those is a real design decision, not a default to pick silently.
- If you're not sure whether existing behavior is a bug or intentional, ask before "fixing" it.
- Keep the calculator's existing behavior and URLs working as everything else gets added around it - it's the proven part of the app.

## Formulas and financial correctness

- Before treating a formula or algorithm as done, check its output against 2-3 concrete inputs by hand or in a scratch script. This project has caught real bugs this way - don't skip it because a formula "looks right."
- Watch for the specific failure modes already found in this codebase: `NaN`/`Infinity` reaching a formatter unguarded, `toFixed` truncating instead of rounding at display boundaries, and off-by-one errors in loops over payment periods (the last period usually needs to absorb the rounding remainder, as `distributeEqually`/`allocatePreset` already do).
- When a reference implementation exists (a spreadsheet, a course document, a design doc), matching its output is a hard requirement - write the comparison test first.
- Financial and regulatory figures (rates, LTV limits, tax brackets, DTI/PTI thresholds) change over time and by jurisdiction - search for the current figure and its source rather than relying on memory. If sources disagree, check whether it's a real contradiction or just rounding (e.g. "33%" vs "33.33%") before picking one.
- A wrong financial formula or number is worse than a missing one. Flag new financial concepts or product-level judgment calls (which average to show, whether to add a new warning) for a decision rather than deciding silently - this project already works that way.

## Testing

- New calculation logic needs unit tests with concrete expected values, not just "it runs."
- When fixing a bug: write the test that reproduces it, confirm it fails, then fix and confirm it passes.
- Test boundaries explicitly - zero, negative, max values (`MAX_YEARS`, `MAX_TRACKS`), and exact regulatory limits (e.g. exactly 75% LTV) - since that's where this kind of bug actually lives.

## Responsive and accessibility

- Check mobile (~360-420px), tablet, and desktop widths before calling a UI change done - not just whatever width the editor happens to be.
- If you add a chart (amortization breakdown, track-mix donut - both already planned), make the same data available as a table or text summary too, not chart-only.

## Internationalization

- Every new feature ships in all supported languages, not just Hebrew - no hardcoded strings in components. New UI text goes through the existing i18n setup (`react-i18next`, per the existing view-model code) with a key added to every language file, not just one.
- Currently Hebrew-only; English, Russian, and others are planned. Build the i18n scaffolding (keys, language files, direction handling) as if more languages are coming, not as a Hebrew-only app that gets extended later - "all languages" means whatever the app supports at the time, including ones not added yet.
- A feature isn't done if a translation key is missing or falls back silently - treat a missing translation the same as a missing test.
- Direction follows the language: Hebrew renders RTL, English/Russian/future languages render LTR. This is structural, not just text alignment - button order, icon direction (a "next" arrow points the actual forward direction for that layout), form field/label order, card/column order, and primary vs. secondary button placement in modals all flip with direction too.
- Use logical CSS properties (`margin-inline-start`, `padding-inline-end`, etc.) and `dir`-aware flex/grid over hardcoded `left`/`right`, so direction flips automatically instead of needing a manual override per component.
- Check a new feature in an RTL rendering and an LTR rendering before calling it done - correct in Hebrew doesn't mean correct in English, and vice versa.

## CI/CD and dependencies

- Run build/lint/typecheck/test yourself before considering a task done, if they're available in the repo.
- Check for an existing CI workflow before adding a new one - extend, don't duplicate.
- Adding a dependency (a chart library, an auth library, anything) is a real decision - say what and why rather than defaulting silently. The app currently has no chart library and no auth system, so both are upcoming real choices, not swaps.
- Never commit secrets or `.env` files, and never weaken `.gitignore` or CI secret handling to make a task easier. This applies with extra weight once a login system and CRM exist in this repo.