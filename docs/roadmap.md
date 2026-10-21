# Roadmap: reference-tool parity

This is a working plan, not a commitment to build all of it. It records what a
professional Israeli mortgage-advisor tool (the "סימולצייה מקצועית בסמארט"
YouTube walkthrough saved in `examples/`) does that our app does not yet, with a
proposed shape, effort, risk and source for each item.

Effort is S (a day or less), M (2-4 days), L (a week or more) for a first
slice, including unit tests, i18n for every supported language, and e2e.

The reference product's layout and copy belong to it. We borrow the ideas and
build our own components and strings.

---

## 1. Indexation visibility (הצמדה)

**Gap.** `computeTrackResult` (`src/lib/amortization.ts`) inflates an indexed
balance every month, then folds that cost into interest and principal. No
output ever names it: no chart, card or schedule column shows a shekel of
indexation, even though our own article text says "ההצמדה מגדילה את יתרת הקרן
עצמה" (`src/i18n/he.ts`). The reference's קרן / הצמדה / ריבית split exists
exactly to expose this.

**Shape.**

- `src/lib/amortization.ts`: per month, for indexed types only,
  `indexation = balanceAfterInflation - balanceBeforeInflation`; accumulate
  `totalIndexation`; add `indexation` to `YearlyRow` / `MonthlyRow` and
  `totalIndexation` to `TrackResult`. Non-indexed tracks report exactly 0.
- `combineSchedules` / `combineMonthlySchedules` sum it like principal and
  interest.
- Compare: a third stacked series in the composition chart
  (`src/features/compare/trend.ts`, `CompareTrendChart.tsx`), today קרן/ריבית.
- Calculator: an indexation column in `ScheduleSection.tsx` and a "סך ההצמדה"
  card in `ResultsCards.tsx`.
- i18n (he + en), chart text/table fallback, e2e.

**Definition (decided).** The series is the CPI drift added to the balance,
i.e. the amount by which the index grew the debt that month. It is the literal
reading of the article copy and it keeps interest and indexation from double
counting. Invariant to test: for a fully amortizing loan,
`sum(principal payments) == principal + sum(indexation)`, so
`totalPaid == principal + totalIndexation + totalInterest`.

**Effort** M. **Risk** medium-high (this edits core amortization math, so it
needs hand-checked golden unit tests).

**Shipped (first slice).**

- `indexation` on `YearlyRow` / `MonthlyRow` and `totalIndexation` on
  `TrackResult` / `TotalsSummary`; combined rows sum it.
- Schedule table: an indexation column, shown only when the mix holds an
  indexed track (both the combined and the per-track tables, yearly and
  monthly).
- Cost donut: a third slice (nominal principal / indexation / interest) when
  indexation is present, so the three slices sum to the total repaid.
- The total-payments card caption names הצמדה only for an indexed mix.
- Compare: a "cumulative indexation" line panel, added to the gallery only
  when some mix carries an indexed track.
- Unit tests, he/en keys, e2e updated (the compare gallery spec moved from
  four to five panels).

**Not done (deliberately).** An indexation column in the comparison's yearly
payments table: the sixth column overflows the three-across card at 1280px
(`compare.spec.ts` pins "no sideways scroll"), and the compare view already
shows indexation through the new chart. A dedicated indexation results card
was left out too; the cost donut's third slice carries the number.

**Open decision (resolved).** The schedule column shows only when the mix
holds an indexed track.

---

## 2. Rate-validity / approval-date warning (התראת תוקף ריבית)

**Gap.** The reference shows an approval date and a rate-validity alert. We
have neither an approval-date field nor a validity window anywhere.

**Shape.**

- New pure module `src/lib/rateValidity.ts`: `RATE_VALIDITY_DAYS = 24` (cited
  below) and `rateValidityStatus(approvalDate, now)` returning
  `valid | expiring | expired` plus `daysRemaining`, with `now` injected.
- Mix-editor date input; a status chip near the mix title; a banner in results
  and compare when expired.
- i18n (he + en); dates formatted through the existing i18n/Intl path.
- Tests: the boundary at exactly 24 days, 0/negative, and date-only arithmetic
  so timezone/DST cannot drift. e2e for the chip in both languages at ~360px.

**Effort** S. **Risk** low.

**Shipped (first slice).**

- `src/lib/rateValidity.ts`: `RATE_VALIDITY_DAYS = 24`, `EXPIRING_SOON_DAYS = 3`,
  `rateValidityStatus(approvalDate, now)`, `parseDateOnly`, `formatDateOnly`,
  `rateValidityText`. `now` is injected, and both sides of the comparison are
  normalised to UTC midnight so a timezone or DST change cannot shift the day
  count.
- Shared `src/components/ui/RateValidityChip.tsx` (renders nothing without a
  real date; `data-status` carries valid | expiring | expired).
- Calculator: `approvalDateText` + `setApprovalDate` on the store, a date field
  with the shared chip under the limits row, and an ⓘ/❌ summary note when the
  rate is lapsing or lapsed. The date is persisted with a saved mix (below).
- Compare: `approvalDateText` per scenario (each mix is its own offer), the same
  field + chip in each scenario editor, and the same actionable warning as a
  status line in that mix's result card. The calculator's date travels into the
  first mix on seeding.
- he/en keys; 18 pure-module tests, 13 store tests, a placeholder-parity test,
  and 11 e2e cases (states, boundaries, both languages, 360px, and the seed
  carrying the date).

**Persisted with a saved mix (second slice).** The date is part of the saved
offer, not session-only:

- `savedMixScenarioSchema` gained an optional `approvalDateText`: blank or a
  real date-only string (the server rejects `2026-02-30`, `02/03/2026` and
  other formats rather than storing junk). Optional so a mix saved before this
  slice still validates and loads.
- `serializeScenario`, the store's `SavedMixScenario` and `loadSavedMix` carry
  it both ways. A loaded older mix restores no date, and an invalid stored
  value also falls back to none rather than showing a bogus window.
- It is part of `serializeMixBaseline`, so entering or changing the date now
  counts as unsaved work. That is deliberate: leaving the page would discard
  the date along with the rest of the offer.
- Reset and detach still clear it (a new offer starts with no approval date).
  Tests cover the schema boundaries, the dirty-state change, the round trip,
  restoring a saved date, and an older scenario without the field. E2e covers
  a `?mix=` load restoring the date and a new save sending it.
- The field's hint copy in both languages now says the date is saved, instead
  of the old "calculation only" wording.

**Wording split.** The chip beside the field is the compact sentence; the
results area (calculator summary note, compare status line) carries the
actionable warning ("ask the bank for an updated rate"). One rule, both pages.

**Open decision (resolved).** Per mix. In the calculator that is the single
mix; in the comparison each scenario is its own offer and gets its own date.

**Source.** The Bank of Israel mortgage-transparency reform made the אישור
עקרוני a standardized, binding document; the **rate** inside it holds **24
days** (the approval document itself up to ~3 months). Re-checked before
shipping against
`boi.org.il/information/bank-paymnts/financial-education/competition-in-mortgages/`
and the Kol-Zchut rights guide, which restates the BOI amendment's 24-day
minimum. `EXPIRING_SOON_DAYS = 3` is a UI urgency threshold, not a regulatory
figure. The UI does not yet print an "as of" date next to the figure.

---

## 3. Early-repayment fee calculator (עמלת פירעון מוקדם)

**Gap.** We carry static education copy only
(`src/components/education/PrepaymentPenaltyFacts.tsx`), no calculation. This
is the reference's flagship feature.

**Shape (proposal).**

- New pure module `src/lib/prepayment.ts` implementing the BOI formula: the fee
  is the positive difference between the present value of the remaining
  payments discounted at the contractual rate and at the current market rate
  for a comparable loan (so it bites when rates fell), with the legal taper,
  discounts and caps, on the real basis for index-linked tracks.
- Per-track inputs: outstanding balance, remaining term, original rate,
  current comparison rate (default from item 4), repayment method, and
  exit-station (תחנת יציאה) exemption.
- Outputs: per-track fee, cheapest payoff order for a partial prepayment, and
  the reference's "תוספת ריבית להשוואה" (the fee re-expressed as an annual rate
  addition).

**Hard requirement.** Build the comparison test against the Bank of Israel's
own published example / calculator before trusting any of it.

**Source.** BOI circular 2103, "נוסחה לחישוב עמלת פרעון מוקדם" (30/01/2003,
`boi.org.il/media/lqvg1b4g/h2103.pdf`), the Banking Order (עמלת פרעון מוקדם)
2002 / circular 2079, and the consumer page `boi.org.il/information/interestrates/`.
The BOI allows up to five fee components (היוון, אי-הודעה, and others); target
the main one (היוון) first.

**Effort** L. **Risk** high (a regulated formula and real money).

**Shipped.**

- `src/lib/prepayment.ts` implements the היוון component of the formula:
  `fee = max(0, PV(remaining payments at the market rate) - PV(at the
  contractual rate))`, with the loan-age reductions (0% / 20% from 3 years /
  30% from 5 years), the section 3(4) cap (when the average rate at origination
  is supplied), the prime and frequent-reset exemptions (section 4(2)), and the
  exit-station (rate-reset) waiver (section 4(3)). Index-linked tracks are
  compared on the real basis: the schedule's nominal payments are deflated by
  the same CPI assumption the schedule uses, and the track's real rate is the
  contractual rate.
- Five-year variable tracks are priced to their next reset, not to the end of
  the loan: `streamToRateReset` adds the reset-date balance to the last payment
  (section 4(1)), and the comparison rate comes from the bucket for that
  shorter horizon. The PV-equals-balance identity still holds.
- Partner outputs: per-track fee, `feeAsAnnualRateAddition` ("תוספת ריבית
  להשוואה", the undiscounted rate the fee is worth over the remaining term,
  computed on the real balance path for indexed tracks) and
  `cheapestPrepaymentOrder` (fee pro rata to the amount repaid, so the cheapest
  shekel is the track with the **lowest** fee per shekel of balance).
- The calculator's new "עמלת פירעון מוקדם" panel feeds the formula straight
  from the scheduled rows it already renders (so spitzer / קרן שווה and
  indexation need no re-derivation), defaults the comparison rate per track
  from the item 4 average tables (basis + remaining-term bucket, with the
  table's as-of date and an honest fallback), and lets the user override the
  rate, move the prepayment month, mark an exit station and price a partial
  prepayment.
- Unit tests pin the PV-equals-balance identity for spitzer, קרן שווה and
  index-linked tracks, cross-check the closed-form annuity difference against
  the payment-by-payment sum, cover the reductions, all three exemptions, the
  reset split, the rate addition and the allocation order, and reproduce the
  BOI's published worked example (see the gate below). E2e covers pricing, the
  per-track exit-station waiver, the payoff order, the past-term empty state
  and the English locale.
- NOT shown in the panel: the operational fee (₪60/track), the no-notice fee (up
  to 0.1%) and the CPI compensation fee. `prepaymentExtras` computes all three
  under their statutory caps and the unit tests pin them, but they stay out of
  the panel: they are caps rather than quotes, and two of them depend on facts
  the panel does not ask (notice given, day of the month). They are named in the
  panel's disclaimer and belong on top of `fee`.
- NOT applied in the panel: section 3(4)'s origination-rate cap. The formula
  and its tests are there, but the calculator does not know the loan's
  origination date or the average rate then, so passing today's table would
  invent C. Leaving the cap off can overstate the fee, never understate it. The
  panel says so. Feeding it needs the deferred origination-date data model.

**Gate (closed).** The BOI's published worked example is reproduced exactly:
₪500,000, 5% nominal contractual vs 4% nominal average over 120 months gives
PV(A) ₪523,805.47, a ₪23,805.47 fee (BOI: ₪23,805), and ₪16,663.83 after the
30% reduction (BOI: ₪16,664); the 20% tier gives ₪19,044.38. The paper's second
example (C = 4.5%) is reproduced at ₪12,095.98 under the order's formula. The
Knesset explainer's ₪11,819 comes from recomputing the payment at C as well,
which is not what the order's `PV(C)` does; the test records that difference
instead of pinning the explainer's figure. The circular's rates are nominal, so
the regression passes `marketRateIsEffective: false`; the BOI average tables
are effective, which is the panel's default.

---

## 4. BOI average-interest table (ריבית ממוצעת)

**Gap (closed).** The calculator's average-rate card used to deep-link to the
BOI page without showing the data. `/rates` now renders the official tables and
the card links there.

**Shape.**

- New `src/server/rates/` following the `src/server/market/` pattern (provider
  + service + cache + typed snapshot), exposed at
  `src/app/api/rates/average/route.ts`.
- Two accessible tables with each workbook's official bucket layout: indexed
  has 25+, 20-25, 15-20, 10-15, 5-10 and up-to-5 buckets; non-indexed adds
  1-5 and up-to-1-year buckets. Current publication plus dated history.
- Show an "as of" and degrade honestly (never invent a value), like the market
  strips' `stale` flag.
- Parse-fixture-to-table unit tests, plus e2e.

**Effort** M. **Risk** medium (external shape drift).

**Shipped (first slice).**

- `src/server/rates/` parses the two official BIFF8 workbooks with SheetJS,
  validates the column count before reading, converts Excel date serials and
  normalizes every row; rows are deduped and sorted newest first.
- `GET /api/rates/average` returns both tables independently, each with
  `ok` / `stale` / `unavailable`. A six-hour in-memory cache, in-flight
  collapsing and a 45-day disk snapshot under `.cache/` keep one BOI outage
  from blanking the page.
- `/rates` and `/en/rates` show the current rate plus 12 monthly rows per
  table, the official bucket layout for each kind, a source link, and honest
  stale/unavailable messages. The calculator's average-rate card now links
  there instead of leaving the site.
- Unit tests cover the pinned real workbooks, date serials, shape mismatches,
  caching, stale fallback and the API contract. E2e covers both locales at 360
  and 1280, stale/partial/500 states, dark theme, and the calculator entry.

**Source (decided).** The two official BOI workbooks, not the series database:
`https://www.boi.org.il/boi_files/Pikuah/pribmash.xls` (indexed) and
`https://www.boi.org.il/boi_files/Pikuah/mashfix.xls` (non-indexed). The series
database (`edge.boi.gov.il`, `BIR_MRTG_99`) exposes only total series, not the
term-bucketed table. Pinned fixtures live in `tests/fixtures/rates/`.

**Open decision (resolved).** An external data source was approved, and the
tables live on their own `/rates` page linked from the calculator's existing
average-rate result card.

---

## 5. Rate-reset step chart + interest-vs-inflation forecast

**Gap.** Resets are described in text (`calculator.help.trackTypes.variable5y`)
but never modeled; there is no forecast curve beyond the single current CPI
annual change.

**Shape.** The chart is easy; the modeling is not. A reset-aware payment chart
needs a rate assumption per reset (proposal: reuse the existing "if the rate
moves by X%" idea from the rateUp/rateDown cards). A forecast chart needs an
inflation path (constant, or a user-set curve). Both introduce forward
assumptions into a tool that currently avoids them, so the assumption must be
visible in the UI and covered by the disclaimer.

**Effort** M-L. **Risk** medium-high (new forward assumptions).

**Open decision (resolved).** Two assumptions were approved and are both
printed in the panel: every contractual five-year resets moves the rate by
+/-1 percentage point, cumulatively; and the CPI runs flat at the annual change
the calculator already uses (`snapshot.annualInflation`). Deferred data-model
work was explicitly kept out of this slice: no persisted approval/origination
date, no per-track market margin, and no new indexation card or column.

**Shipped.**

- `src/lib/forecast.ts` builds three scenarios from the same per-month rows the
  schedule renders: base (rate unchanged), +1pp at every reset and -1pp at every
  reset. The step is cumulative per reset and floored at 0%. Only
  `variable5y` and `variableIndexed5y` step: prime and annual-or-more-frequent
  variable tracks reset on dates the contract does not fix, so they stay flat.
  A track that ends on or before its first reset contributes no reset year.
- `computeTrackResult` gained optional `rateResetMonths` / `rateStepPercent`.
  With neither supplied, every schedule figure is unchanged (150 amortization
  tests, including 5 new reset-step cases).
- CPI is flat at `snapshot.annualInflation`; indexation totals are the
  cumulative additions to principal on the base path. There is no new inflation
  input or curve.
- `src/features/calculator/ForecastSection.tsx` sits after the prepayment panel
  and holds two cards. The reset card plots the combined payment at the start of
  each year with vertical markers at the reset years, plus a caption naming them
  through `Intl.ListFormat` (Hebrew reads "6 ו-11" rather than a bidi-reversed
  comma list). The cost card plots cumulative interest against cumulative
  indexation. Both charts have a `<details>` table with the exact figures, so
  the data is not chart-only.
- Both assumptions are the panel's lead text (+/-1pp per reset, flat CPI), and
  the disclaimer says the forecast is an illustration, not a forecast of rates
  or the CPI.
- The reset chart uses a zoomed y-axis (`niceRange` +
  `formatAxisShekelDetailed`): a 1pp step is invisible on a zero-based axis. The
  cost chart stays zero-based, and both print their tick values, so the scale is
  visible rather than implied.
- The panel is hidden when the mix has neither a contractual reset nor an
  indexed track (basket 1, basket 2): its schedule is already fully
  deterministic, so a forecast would only duplicate it. An indexed mix with no
  reset left keeps the cost card and explains why the reset chart is absent.
- Unit coverage: 10 forecast tests, 5 reset-step amortization tests, and chart
  helper tests for `niceRange` / `formatAxisShekelDetailed` (38 in that file).
  E2e covers both languages, the reset table's values and ordering, the no-reset
  note, the hidden fixed/prime mixes and 360px with no sideways scroll.

---

## 6. Advisor-metric rows

**Gap.** The reference's metrics table carries figures we lack: מרווח שוק,
החזר בשיא (and the year it occurs), סך ירידת הקרן, תשלומי ריבית והצמדה.

**Shape.** "Peak payment + year" is small: `highestPayment` already exists, add
the year it occurs. "Total principal decline" and "interest and indexation
payments" fall out of item 1. "מרווח שוק" is a new per-track field; a safe
version keeps `rate` as the effective rate and adds an optional `margin` used
only for decomposition display, so no existing math changes.

**Effort** S-M. **Risk** low for the derived rows, medium for the margin field
(a data-model change).

**Open decision (resolved).** Both: the derived rows and the optional per-track
מרווח שוק field, with the field kept display-only.

**Shipped (derived rows and the market-margin field).**

- `snapshot.totalPrincipalPaid` = `totals.totalPaid - totals.totalInterest`:
  everything repaid that was not interest, which is the principal column and so
  telescopes to the nominal loan plus the CPI drift (`sum(principal) === nominal
  + indexation`; the donut derives its nominal slice the same way, one
  indexation lower). Rendered as a new extra results card, **סך ירידת הקרן**,
  whose caption names the indexation part when the mix holds an indexed track.
- `peakPaymentYear(rows)` in `src/lib/amortization.ts`: the 1-based year the
  combined payment peaks, read from the combined MONTHLY series the schedule
  renders. It requires a relative step (1e-9) to count, so the float drift of a
  constant payment is not mistaken for a rise and a flat loan does not "peak"
  in its final year. Year 1 (a payment that never rises) leaves the caption
  alone; otherwise the highest-payment card's caption reads "ההחזר מגיע לשיאו
  בשנה ה-{{year}}".
- The extra-card cascade grew from twelve to thirteen (`--card-index` collapse
  formula 11 → 12, `TOGGLE_IN_EXPANDED_MS` 1250 → 1350); `EXIT_TOTAL_MS` at
  1300 still covers the 1290ms reverse cascade.
- he/en keys (+ a details text for the new card's dialog); 8 store tests, 7
  `peakPaymentYear` unit tests (empty, flat, rising, mid-term peak, ties, float
  drift), and 6 e2e cases (both languages, the dialog, 360px, non-indexed mix).
- **מרווח שוק** (second slice): `marginText` on `TrackState`, `SavedTrackInput`
  and the saved mix's track schema. It is optional and blank means "not
  entered", so a mix saved before it still validates and loads. The server
  accepts only a finite 0-`MAX_RATE_PERCENT` value (same regex and range as a
  rate), and an older or malformed value falls back to none.
- The margin is decomposition only. `rateText` stays the effective rate every
  amortization input reads, so no schedule, card or chart figure moves when it
  is entered. `updateTrackMargin` rebuilds the snapshot only to carry the value
  into `trackPaybacks[i].marketMarginPercent`, and the store's mix baseline
  includes it, so editing it counts as unsaved work.
- `TrackForm` shows the field beside the rate; the schedule's per-track payback
  aside prints "מרווח שוק: {{percent}}%" when a margin was entered. Unit tests
  cover the schema boundaries, the round trip through a saved mix, restoring it
  on load, and the dirty-state change; e2e restores the input and the aside line
  from a `?mix=` load.

**Known nuance.** The highest-payment card's *amount* is the sum of each
track's own peak (an estimate, as its label says), while the *year* comes from
the combined monthly series. For a mix with a rising track and a falling
(equal-principal) track those two need not coincide, so the caption's year
describes the payment the user actually makes. Making the card's amount read
the true combined peak too is a behaviour change to an existing card - a
decision to take deliberately, not inside this slice.

**Not done (deliberately).** תשלומי ריבית והצמדה as a *single* combined number:
in this model indexation is folded into the principal column, so a combined
"interest + indexation" row would count the indexation twice against סך ירידת
הקרן. The indexation is instead named in that card's caption (and the donut
shows the three-way split). Say the word if the combined figure is wanted anyway
as a labelled cut. Section 3(4)'s origination-rate cap is the only item left
open, and it needs an origination-rate input the calculator does not collect.

---

## Recommended order

1. **Item 1** (indexation) - most on-brand, reuses existing math, unlocks most
   of item 6.
2. **Item 2** (rate validity) - small, sourced, visibly useful.
3. **Item 6 derived rows** - falls out of item 1.
4. **Item 4** (BOI average rates) - shipped; feeds item 3.
5. **Item 3** (early-repayment fee) - shipped; the BOI worked example now
   reproduces exactly.
6. **Item 5** (resets and forecast) - shipped with the approved +/-1pp and flat
   CPI assumptions. The approval date and the per-track מרווח שוק are now also
   persisted with a saved mix. The only piece left is section 3(4)'s
   origination-rate cap, which needs an input the calculator does not collect.
