import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from '@/router'
import { useCalculatorViewModel } from './useCalculatorViewModel'
import { useAverageRates } from '@/services/rates'
import { bucketForYears, type AverageRateKind } from '@/lib/averageRates'
import { formatAmountWithCaret, formatCurrency, formatRatePercent } from '@/lib/format'
import { MAX_YEARS, type TrackType } from '@/lib/amortization'
import { MoneyInput } from '@/components/ui/MoneyInput'
import {
  cheapestPrepaymentOrder,
  EXIT_STATION_TYPES,
  feeAsAnnualRateAddition,
  prepaymentFee,
  streamToRateReset,
  type PrepaymentFeeBreakdown,
} from '@/lib/prepayment'

/** Where the market comparison rate falls back to when the BOI table is missing. */
const FALLBACK_MARKET_RATE_PERCENT = 3.5
/** The prepayment point opens on the common "after five years" case. */
const DEFAULT_PREPAY_YEARS = 5
/** Five-year variable tracks reset on this cycle, counted from origination. */
const RESET_EVERY_MONTHS = 60

interface TrackFeeRow {
  id: string
  type: TrackType
  balance: number
  marketRate: number
  /** True for CPI-linked tracks, whose share drives the CPI compensation. */
  isIndexed: boolean
  breakdown: PrepaymentFeeBreakdown
  /** The fee re-expressed as an annual rate addition (0 when exempt). */
  rateAddition: number
}

const clampYears = (value: number): number => Math.min(MAX_YEARS, Math.max(1, value))

/**
 * Early-repayment fee (עמלת פירעון מוקדם) - the היוון estimate for the mix
 * currently in the calculator.
 *
 * The math lives in `src/lib/prepayment.ts`; this component only gathers the
 * inputs the formula needs straight from the schedule the user is already
 * looking at (each track's remaining payments and balance at the chosen
 * month), defaults the market comparison rate from the Bank of Israel average
 * tables (item 4), and lays the per-track result out with the cheapest payoff
 * order for a partial prepayment. A five-year track is priced only to its next
 * reset (section 4(1)), matching the law's shorter horizon.
 *
 * The היוון fee is the statutory core. The operational fee (up to ₪60 per
 * track), the no-notice fee (up to 0.1%) and the CPI compensation for indexed
 * loans repaid on days 1-15 are not modelled; the panel's note says they are
 * charged on top. Section 3(4)'s origination-rate cap is not applied either:
 * the calculator does not know the loan's origination date or the average rate
 * then, so the estimate may be higher than the actual fee, never lower.
 */
export function PrepaymentSection() {
  const { t } = useTranslation()
  const vm = useCalculatorViewModel()
  const tracks = vm.snapshot.scheduleTracks
  const annualInflation = vm.snapshot.annualInflation
  const rates = useAverageRates()

  const [prepayYearsText, setPrepayYearsText] = useState(String(DEFAULT_PREPAY_YEARS))
  const [manualMarketText, setManualMarketText] = useState('')
  const [onExitStation, setOnExitStation] = useState(false)
  const [partialText, setPartialText] = useState('')

  const prepayYears = clampYears(Number.parseFloat(prepayYearsText) || DEFAULT_PREPAY_YEARS)
  const prepayMonths = Math.round(prepayYears * 12)
  const manualMarket = (() => {
    const parsed = Number.parseFloat(manualMarketText)
    return Number.isFinite(parsed) && manualMarketText.trim() !== '' ? parsed : null
  })()

  const rows = useMemo<TrackFeeRow[]>(() => {
    /** The BOI average rate for a track's own basis and remaining term. */
    const marketRateFor = (
      track: (typeof tracks)[number],
      remainingYears: number,
    ): number => {
      if (manualMarket !== null) return manualMarket
      const kind: AverageRateKind = track.isIndexed ? 'indexed' : 'nonIndexed'
      const table = rates.data?.tables.find((entry) => entry.kind === kind)
      const bucket = bucketForYears(kind, remainingYears)
      const value = table?.rows[0] && bucket ? table.rows[0].buckets[bucket] : undefined
      return typeof value === 'number' ? value : FALLBACK_MARKET_RATE_PERCENT
    }

    const result: TrackFeeRow[] = []
    for (const [index, track] of tracks.entries()) {
      const months = track.monthlyRows.length
      // Nothing to prepay before the loan starts or after it has ended.
      if (prepayMonths < 1 || prepayMonths >= months) continue
      const balance = track.monthlyRows[prepayMonths - 1].closing
      if (!(balance > 0)) continue
      let remainingMonths = months - prepayMonths
      let payments = track.monthlyRows.slice(prepayMonths).map((row) => row.paid)
      // A five-year track's current rate is only fixed until its next reset.
      // Section 4(1) prices it to that date, with the reset balance as the last
      // future payment, rather than pretending the rate runs to the end.
      if (EXIT_STATION_TYPES.includes(track.type)) {
        const monthsIntoBlock = prepayMonths % RESET_EVERY_MONTHS
        const untilReset =
          monthsIntoBlock === 0 ? RESET_EVERY_MONTHS : RESET_EVERY_MONTHS - monthsIntoBlock
        if (untilReset < remainingMonths) {
          const balanceAtReset = track.monthlyRows[prepayMonths + untilReset - 1].closing
          payments = streamToRateReset(payments, balanceAtReset, untilReset)
          remainingMonths = untilReset
        }
      }
      // Opening principal of each month the fee covers, for the rate addition.
      const openingBalances = [
        balance,
        ...track.monthlyRows
          .slice(prepayMonths, prepayMonths + remainingMonths - 1)
          .map((row) => row.closing),
      ]
      const remainingYears = remainingMonths / 12
      const marketRate = marketRateFor(track, remainingYears)
      const breakdown = prepaymentFee({
        payments,
        balance,
        annualRatePercent: track.annualRatePercent,
        marketRatePercent: marketRate,
        type: track.type,
        indexed: track.isIndexed,
        annualInflation,
        monthsSinceOrigination: prepayMonths,
        onExitStation,
      })
      result.push({
        id: `${track.type}-${index}`,
        type: track.type,
        balance,
        marketRate,
        isIndexed: track.isIndexed,
        breakdown,
        rateAddition: feeAsAnnualRateAddition({
          openingBalances,
          fee: breakdown.fee,
          indexed: track.isIndexed,
          annualInflation,
        }),
      })
    }
    return result
  }, [tracks, annualInflation, prepayMonths, manualMarket, onExitStation, rates.data])

  const totalFee = rows.reduce((sum, row) => sum + row.breakdown.fee, 0)
  const partialAmount = Number.parseFloat(partialText.replace(/[,\s₪]/g, '')) || 0
  const plan = cheapestPrepaymentOrder(
    rows.map((row) => ({ id: row.id, balance: row.balance, fee: row.breakdown.fee })),
    partialAmount,
  )
  const trackName = (id: string): string => {
    const row = rows.find((entry) => entry.id === id)
    return row ? t(`calculator.trackTypes.${row.type}`) : id
  }

  const asOf = rates.data?.tables.find((entry) => entry.status === 'ok')?.asOf ?? null

  return (
    <section className="schedule-section prepayment-calc" data-testid="prepayment-calculator">
      <div className="section-heading">
        <div>
          <h2>{t('calculator.prepayment.heading')}</h2>
        </div>
        <p className="prepayment-lead">{t('calculator.prepayment.lead')}</p>
      </div>

      {rows.length === 0 ? (
        <p className="prepayment-empty" data-testid="prepayment-empty">
          {t('calculator.prepayment.empty')}
        </p>
      ) : (
        <>
          <div className="prepayment-controls">
            <label className="input-group prepayment-field">
              {t('calculator.prepayment.prepayYearsLabel')}
              <span className="input-wrap">
                <input
                  id="prepayment-years"
                  name="prepayment-years"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={MAX_YEARS}
                  step={1}
                  value={prepayYearsText}
                  onChange={(event) => setPrepayYearsText(event.target.value)}
                  aria-label={t('calculator.prepayment.prepayYearsLabel')}
                  data-testid="prepayment-years"
                />
                <span aria-hidden="true">{t('calculator.prepayment.yearsSuffix')}</span>
              </span>
            </label>

            <label className="input-group prepayment-field">
              {t('calculator.prepayment.marketRateLabel')}
              <span className="input-wrap">
                <input
                  id="prepayment-market-rate"
                  name="prepayment-market-rate"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step={0.01}
                  value={manualMarketText}
                  onChange={(event) => setManualMarketText(event.target.value)}
                  placeholder={t('calculator.prepayment.marketRatePlaceholder')}
                  aria-label={t('calculator.prepayment.marketRateLabel')}
                  data-testid="prepayment-market-rate"
                />
                <span aria-hidden="true">%</span>
              </span>
            </label>

            <label className="input-group prepayment-field">
              {t('calculator.prepayment.partialLabel')}
              <MoneyInput
                value={partialText}
                onChange={(raw, caret) => {
                  const result = formatAmountWithCaret(raw, caret)
                  setPartialText(result.text)
                  return result
                }}
                suffix="₪"
                ariaLabel={t('calculator.prepayment.partialLabel')}
                testId="prepayment-partial"
              />
            </label>

            <label className="prepayment-checkbox">
              <input
                id="prepayment-exit-station"
                name="prepayment-exit-station"
                type="checkbox"
                checked={onExitStation}
                onChange={(event) => setOnExitStation(event.target.checked)}
                data-testid="prepayment-exit-station"
              />
              <span>{t('calculator.prepayment.exitStation')}</span>
            </label>
          </div>

          <div className="table-wrap">
            <table className="prepayment-table">
              <thead>
                <tr>
                  <th>{t('calculator.prepayment.table.track')}</th>
                  <th>{t('calculator.prepayment.table.balance')}</th>
                  <th>{t('calculator.prepayment.table.marketRate')}</th>
                  <th>{t('calculator.prepayment.table.fee')}</th>
                  <th>{t('calculator.prepayment.table.rateAddition')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} data-testid={`prepayment-row-${row.type}`}>
                    <td>{t(`calculator.trackTypes.${row.type}`)}</td>
                    <td>{formatCurrency(row.balance)}</td>
                    <td>{formatRatePercent(row.marketRate)}%</td>
                    <td data-testid={`prepayment-fee-${row.type}`}>
                      {row.breakdown.exemptReason
                        ? t(`calculator.prepayment.exempt.${row.breakdown.exemptReason}`)
                        : formatCurrency(row.breakdown.fee)}
                    </td>
                    <td>
                      {row.rateAddition > 0 ? `${formatRatePercent(row.rateAddition)}%` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">{t('calculator.prepayment.totalLabel')}</th>
                  <td aria-hidden="true" />
                  <td aria-hidden="true" />
                  <td data-testid="prepayment-total">{formatCurrency(totalFee)}</td>
                  <td aria-hidden="true" />
                </tr>
              </tfoot>
            </table>
          </div>

          {partialAmount > 0 && (
            <div className="prepayment-order" data-testid="prepayment-order">
              <p className="prepayment-order-title">{t('calculator.prepayment.orderTitle')}</p>
              <ol>
                {plan.allocations.map((allocation) => (
                  <li key={allocation.id}>
                    {t('calculator.prepayment.orderLine', {
                      track: trackName(allocation.id),
                      amount: formatCurrency(allocation.amount),
                      fee: formatCurrency(allocation.fee),
                    })}
                  </li>
                ))}
              </ol>
              <p className="prepayment-order-total">
                {t('calculator.prepayment.orderTotal', {
                  amount: formatCurrency(plan.allocated),
                  fee: formatCurrency(plan.totalFee),
                })}
              </p>
            </div>
          )}

          <p className="prepayment-note-line">
            {asOf
              ? t('calculator.prepayment.marketRateSource', { date: asOf })
              : t('calculator.prepayment.marketRateFallback', {
                  rate: formatRatePercent(FALLBACK_MARKET_RATE_PERCENT),
                })}{' '}
            <Link to="/rates">{t('calculator.prepayment.marketRateLink')}</Link>
          </p>
        </>
      )}

      <p className="prepayment-note-line prepayment-disclaimer">
        {t('calculator.prepayment.note')}
      </p>
    </section>
  )
}
