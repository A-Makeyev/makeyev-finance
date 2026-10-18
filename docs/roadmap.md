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

**Source.** The Bank of Israel mortgage-transparency reform made the אישור
עקרוני a standardized, binding document; the **rate** inside it holds **24
days** (the approval document itself up to ~3 months). Confirm the figure and
its wording against
`boi.org.il/information/bank-paymnts/financial-education/competition-in-mortgages/`
before shipping, and label the UI with the source and an "as of" date.

**Open decision.** Approval date per mix or per comparison scenario?

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

**Gap.** We deep-link to the BOI average-rate page
(`calculator.links.rates.label`) but never show the data.

**Shape.**

- New `src/server/rates/` following the `src/server/market/` pattern (provider
  + service + cache + typed snapshot), exposed at
  `src/app/api/rates/average/route.ts`.
- A real accessible table: buckets 1-5 / 5-10 / 10-15 / 15-20 / 20-25 / 25+
  years, indexed vs non-indexed, nominal vs MIN, with dated snapshot history.
- Show an "as of" and degrade honestly (never invent a value), like the market
  strips' `stale` flag.
- Parse-fixture-to-table unit tests, plus e2e.

**Effort** M. **Risk** medium (external shape drift).

**Source.** The BOI series database (`edge.boi.gov.il`) and the monthly
housing-loans report. Pin the exact series ids with a test fixture.

**Open decision.** New external data source acceptable? Table near the
indexes/markets area, or on its own rates page?

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

---

## Recommended order

1. **Item 1** (indexation) - most on-brand, reuses existing math, unlocks most
   of item 6.
2. **Item 2** (rate validity) - small, sourced, visibly useful.
3. **Item 6 derived rows** - falls out of item 1.
4. **Item 4** (BOI average rates) - feeds item 3.
5. **Item 3** (early-repayment fee) - the flagship, but needs item 4 and a
   verified formula.
6. **Item 5** (resets and forecast) - needs the most product agreement.
