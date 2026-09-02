import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { useCalculatorViewModel } from './useCalculatorViewModel'

/**
 * Must cover the longest exit delay (11 × 70ms) plus the exit duration
 * (450ms) - after it elapses the collapsed cards are removed from the grid.
 */
const EXIT_TOTAL_MS = 1300

/** Glide duration for the featured row settling up after the exit cascade. */
const SETTLE_MS = 350

/**
 * The toggle stays out of sight while a card cascade plays and fades in
 * afterwards: after the featured trio on first paint (~590ms cascade),
 * after the twelve-card expansion (~1220ms), and together with the
 * glide-up on collapse (EXIT_TOTAL_MS).
 */
const TOGGLE_IN_FEATURED_MS = 620
const TOGGLE_IN_EXPANDED_MS = 1250

/** The toggle's fade-out duration (CSS) - the label swaps once fully faded. */
const TOGGLE_FADE_OUT_MS = 400

/**
 * Results grid, ordered left-to-right in three logical rows of five:
 * 1. The monthly payment story - today's payment (first, highest/current,
 *    average) and its sensitivity to variable-rate moves (±1 point).
 * 2. The full-term cost - total repayments, interest, cost-of-credit %,
 *    payback ratio and the average rate behind them.
 * 3. Planning details - effective rate, annuity interest mechanics,
 *    5-year horizon figures and the normalized per-₪100k payment.
 * The three headline cards (first payment, total interest, total payments)
 * stay visible with a "show all" toggle beside them - below the grid while
 * it is expanded. The extra cards fade in one by one via their --card-index
 * stagger delay; on collapse the same animation runs reversed and the last
 * card hides first. Once the exit finishes, the featured row and the toggle
 * glide up to their collapsed spots (FLIP) instead of snapping. Inside every
 * card the big number comes first, with its label and caption below it - a
 * single-line value top-aligns across all cards naturally.
 */
export function ResultsCards() {
  const { t } = useTranslation()
  const vm = useCalculatorViewModel()
  // showAll drives the aria state and which cascade plays; mountAll keeps the
  // extra cards rendered while the exit fade runs (hiding them immediately
  // would cut the animation off).
  const [showAll, setShowAll] = useState(false)
  const [mountAll, setMountAll] = useState(false)
  /** False while a cascade plays - the toggle is hidden then fades in. */
  const [toggleVisible, setToggleVisible] = useState(false)
  /** Which label the toggle shows - swapped only while it is invisible. */
  const [toggleLabelForOpen, setToggleLabelForOpen] = useState(false)
  const exitTimer = useRef<number | null>(null)
  const toggleTimer = useRef<number | null>(null)
  const labelTimer = useRef<number | null>(null)
  const layoutRef = useRef<HTMLElement | null>(null)
  const toggleRef = useRef<HTMLButtonElement | null>(null)
  /** Positions of the surviving row captured right before the grid shrinks. */
  const settledRects = useRef<Array<{ el: HTMLElement; rect: DOMRect }> | null>(null)

  useEffect(
    () => () => {
      if (exitTimer.current !== null) window.clearTimeout(exitTimer.current)
      if (toggleTimer.current !== null) window.clearTimeout(toggleTimer.current)
      if (labelTimer.current !== null) window.clearTimeout(labelTimer.current)
    },
    [],
  )

  /** Hide the toggle now; fade it back in once `delay` ms have passed. */
  const scheduleToggle = (delay: number) => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setToggleVisible(true)
      return
    }
    setToggleVisible(false)
    if (toggleTimer.current !== null) window.clearTimeout(toggleTimer.current)
    toggleTimer.current = window.setTimeout(() => setToggleVisible(true), delay)
  }

  /** Swap the toggle label `delay` ms in - while it is fully faded out. */
  const scheduleLabelSwap = (forOpen: boolean, delay: number) => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setToggleLabelForOpen(forOpen)
      return
    }
    if (labelTimer.current !== null) window.clearTimeout(labelTimer.current)
    labelTimer.current = window.setTimeout(() => setToggleLabelForOpen(forOpen), delay)
  }

  // First paint: the featured trio cascades in; the toggle follows it.
  useEffect(() => {
    scheduleToggle(TOGGLE_IN_FEATURED_MS)
  }, [])

  const toggleAll = () => {
    if (exitTimer.current !== null) {
      window.clearTimeout(exitTimer.current)
      exitTimer.current = null
    }
    if (showAll) {
      // Collapse: the extras fade out one by one from the last to the first;
      // the expanded grid layout holds (`all-visible` follows mountAll) so
      // nothing reflows mid-animation.
      setShowAll(false)
      scheduleToggle(EXIT_TOTAL_MS)
      scheduleLabelSwap(false, TOGGLE_FADE_OUT_MS)
      exitTimer.current = window.setTimeout(() => {
        const layout = layoutRef.current
        settledRects.current = layout
          ? Array.from(
              layout.querySelectorAll<HTMLElement>(
                '.results-card:not([hidden]), .results-toggle',
              ),
            ).map((el) => ({ el, rect: el.getBoundingClientRect() }))
          : null
        setMountAll(false)
      }, EXIT_TOTAL_MS)
    } else {
      // Expand: render the extras so their staggered fade-in starts; the
      // toggle waits for the cascade to finish before fading back in.
      setMountAll(true)
      setShowAll(true)
      scheduleToggle(TOGGLE_IN_EXPANDED_MS)
      scheduleLabelSwap(true, TOGGLE_FADE_OUT_MS)
    }
  }

  // After the grid shrinks, the surviving cards and the toggle would snap
  // from their expanded spots to the collapsed ones - FLIP them instead:
  // start each from its old position and glide to rest.
  useLayoutEffect(() => {
    if (mountAll) return
    const captured = settledRects.current
    settledRects.current = null
    if (!captured?.length) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    for (const { el, rect } of captured) {
      const last = el.getBoundingClientRect()
      const dx = rect.left - last.left
      const dy = rect.top - last.top
      if (!dx && !dy) continue
      el.animate(
        [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }],
        { duration: SETTLE_MS, easing: 'cubic-bezier(0.22, 0.61, 0.36, 1)' },
      )
    }
  }, [mountAll])

  /** Stagger helper: card N starts its cascade step N slots after the first. */
  const stagger = (index: number) => ({ '--card-index': index }) as CSSProperties
  const extra = (index: number) => ({
    className: `results-card results-extra${showAll ? '' : ' results-extra-out'}`,
    style: stagger(index),
    hidden: !mountAll,
  })

  return (
    <section
      ref={layoutRef}
      aria-live="polite"
      data-testid="results-layout"
      className={`results-layout${mountAll ? ' all-visible' : ''}`}
    >
      {/* The headline trio - first payment, total interest, total payments. */}
      <div className="results-card primary-result" style={stagger(0)}>
        <strong data-testid="monthly-payment">{vm.monthlyPayment}</strong>
        <p>{t('calculator.results.firstPaymentCard')}</p>
        <span data-testid="payment-note">{vm.paymentNote}</span>
      </div>

      <div className="results-card" style={stagger(1)}>
        <strong data-testid="total-interest">{vm.totalInterest}</strong>
        <p>{t('calculator.results.totalInterestCard')}</p>
        <span>{t('calculator.results.interestCaption')}</span>
      </div>

      <div className="results-card" style={stagger(2)}>
        <strong data-testid="total-payment">{vm.totalPayment}</strong>
        <p className="total-payment-label" data-testid="total-payment-label">
          <span className="total-payment-text">{vm.totalPaymentLabelParts}</span>
        </p>
        <span>{t('calculator.results.totalPaymentCaption')}</span>
      </div>

      <button
        ref={toggleRef}
        type="button"
        className={`results-toggle${toggleVisible ? ' is-visible' : ''}`}
        data-testid="results-toggle"
        aria-expanded={showAll}
        onClick={toggleAll}
      >
        {toggleLabelForOpen ? t('calculator.results.showLess') : t('calculator.results.showAll')}
      </button>

      {/* Rate-shock cards: with variable exposure show the stressed payment
          and delta; a fixed-only mix keeps its payment, so say so instead. */}
      <div {...extra(0)}>
        <strong data-testid="payment-rate-up">{vm.paymentRateUp1}</strong>
        <p>{t('calculator.results.rateUpCard')}</p>
        <span data-testid="payment-rate-up-note">
          {vm.hasVariableTrack
            ? t('calculator.results.rateUpCaption', { delta: vm.paymentRateUp1Delta })
            : t('calculator.results.rateUpCaptionFixed')}
        </span>
      </div>

      <div {...extra(1)}>
        <strong data-testid="payment-rate-down">{vm.paymentRateDown1}</strong>
        <p>{t('calculator.results.rateDownCard')}</p>
        <span data-testid="payment-rate-down-note">
          {vm.hasVariableTrack
            ? t('calculator.results.rateDownCaption', { delta: vm.paymentRateDown1Delta })
            : t('calculator.results.rateDownCaptionFixed')}
        </span>
      </div>

      {/* The rest of the monthly-payment story. */}
      <div {...extra(2)}>
        <strong data-testid="highest-payment">{vm.highestPayment}</strong>
        <p data-testid="highest-payment-label">{vm.highestLabelText}</p>
        <span>{t('calculator.results.highestCaption')}</span>
      </div>

      <div {...extra(3)}>
        <strong data-testid="avg-monthly-payment">{vm.avgMonthlyPayment}</strong>
        <p>{t('calculator.results.avgPaymentCard')}</p>
        <span>{t('calculator.results.avgPaymentCaption')}</span>
      </div>

      {/* Row 2 continued - the cost of the loan. */}
      <div {...extra(4)}>
        <strong data-testid="overpay-percent">
          {vm.overpayPercent}
          <span className="rate-unit">%</span>
        </strong>
        <p>{t('calculator.results.overpayCard')}</p>
        <span>{t('calculator.results.overpayCaption')}</span>
      </div>

      <div {...extra(5)}>
        <strong data-testid="avg-payback">{vm.avgPayback}</strong>
        <p>{t('calculator.results.avgPaybackCard')}</p>
        <span>{t('calculator.results.avgPaybackCaption')}</span>
      </div>

      <div {...extra(6)}>
        <strong data-testid="avg-rate">
          {vm.avgRate}
          <span className="rate-unit">%</span>
        </strong>
        <p>{t('calculator.results.avgRateCard')}</p>
        <span>{t('calculator.results.avgRateCaption', { weighted: vm.weightedAvgRate })}</span>
      </div>

      {/* Row 3 - planning details and the 5-year horizon. */}
      <div {...extra(7)}>
        <strong data-testid="eff-rate">
          {vm.effectiveRate}
          <span className="rate-unit">%</span>
        </strong>
        <p>{t('calculator.results.effRateCard')}</p>
        <span>{t('calculator.results.effRateCaption', { nominal: vm.avgRate })}</span>
      </div>

      <div {...extra(8)}>
        <strong data-testid="interest-share">
          {vm.firstPaymentInterestShare}
          <span className="rate-unit">%</span>
        </strong>
        <p>{t('calculator.results.interestShareCard')}</p>
        <span>{t('calculator.results.interestShareCaption')}</span>
      </div>

      <div {...extra(9)}>
        <strong data-testid="first5y-interest-share">
          {vm.first5yInterestShare}
          <span className="rate-unit">%</span>
        </strong>
        <p>{t('calculator.results.fiveYInterestCard')}</p>
        <span>{t('calculator.results.fiveYInterestCaption')}</span>
      </div>

      <div {...extra(10)}>
        <strong data-testid="balance-after-5y">{vm.balanceAfter5y}</strong>
        <p>{t('calculator.results.balance5yCard')}</p>
        <span>{t('calculator.results.balance5yCaption')}</span>
      </div>

      <div {...extra(11)}>
        <strong data-testid="payment-per-100k">{vm.paymentPer100k}</strong>
        <p>{t('calculator.results.per100kCard')}</p>
        <span>{t('calculator.results.per100kCaption')}</span>
      </div>
    </section>
  )
}
