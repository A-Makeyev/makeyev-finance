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
- Calculator: `approvalDateText` + `setApprovalDate` on the store (session
  input, NOT part of a saved mix), a date field with the shared chip under the
  limits row, and an ⓘ/❌ summary note when the rate is lapsing or lapsed.
- Compare: `approvalDateText` per scenario (each mix is its own offer), the same
  field + chip in each scenario editor, and the same actionable warning as a
  status line in that mix's result card. The calculator's date travels into the
  first mix on seeding.
- he/en keys; 18 pure-module tests, 13 store tests, a placeholder-parity test,
  and 11 e2e cases (states, boundaries, both languages, 360px, and the seed
  carrying the date).

**Not done (deliberately).** The approval date is not persisted with a saved
mix: that would add a field to the stored mix scenario (server zod schema,
serialize baseline, load/restore), which is a data-model change to flag rather
than slip in. Today the date is session input, cleared on reset, on detaching
from a mix, and on loading one.

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

**Open decision.** Which assumptions are acceptable to show?

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

**Open decision.** Add the per-track margin field, or only the derived rows?

**Shipped (first slice, derived rows only).** Decided: no per-track מרווח שוק
field (a data-model change) - only the rows that fall out of the existing
schedule.

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
as a labelled cut. The מרווח שוק field stays a separate decision.

---

## Recommended order

1. **Item 1** (indexation) - most on-brand, reuses existing math, unlocks most
   of item 6.
2. **Item 2** (rate validity) - small, sourced, visibly useful.
3. **Item 6 derived rows** - falls out of item 1.
4. **Item 4** (BOI average rates) - shipped; feeds item 3.
5. **Item 3** (early-repayment fee) - the flagship, but needs item 4 and a
   verified formula.
6. **Item 5** (resets and forecast) - needs the most product agreement.
