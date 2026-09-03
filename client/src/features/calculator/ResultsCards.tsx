import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { useTranslation } from 'react-i18next'
import { FaExternalLinkAlt } from 'react-icons/fa'
import { AppModal } from '@/components/ui/AppModal'
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

/** External "read more" source per card, localized under calculator.results.links. */
type LinkKey = 'guide' | 'interest' | 'compare' | 'rates' | 'cpi'

/** Every results card opens an explanation dialog keyed by this identifier. */
type CardKey =
  | 'firstPayment'
  | 'totalInterest'
  | 'totalPayment'
  | 'rateUp'
  | 'rateDown'
  | 'highestPayment'
  | 'avgPayment'
  | 'overpayPercent'
  | 'avgPayback'
  | 'avgRate'
  | 'effRate'
  | 'interestShare'
  | 'fiveYInterest'
  | 'balance5y'
  | 'per100k'

interface CardDef {
  key: CardKey
  /** data-testid on the <strong> value (missing only on the % cards' unit). */
  testId?: string
  value: string
  /** Inline unit rendered inside the <strong> (e.g. %). */
  unit?: '%'
  label: ReactNode
  caption: ReactNode
  captionTestId?: string
  labelTestId?: string
  labelClassName?: string
  /** Featured trio stays visible; the extras cascade via the show-all toggle. */
  featured?: boolean
  /** Teal-gradient headline styling - only the first-payment card gets it. */
  primary?: boolean
  /** "Read more" link shown at the bottom of the explanation dialog. */
  link: LinkKey
  /** --card-index stagger slot (0-2 featured, 0-11 extras). */
  index: number
}

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
 * single-line value top-aligns across all cards naturally. Every card is a
 * button: clicking it opens a dialog with a plain-language explanation of
 * the metric (calculator.results.details.<key>).
 */
export function ResultsCards() {
  const { t, i18n } = useTranslation()
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
  /** The card whose explanation dialog is open (null = closed). */
  const [openCardKey, setOpenCardKey] = useState<CardKey | null>(null)
  /**
   * The card rendered inside the dialog. Kept separate from openCardKey so
   * the content survives the exit animation: Radix keeps the dialog shell
   * mounted while it fades out, and unmounting the children at that moment
   * would leave a hollow bordered line on screen (visible as a flash).
   */
  const [shownCardKey, setShownCardKey] = useState<CardKey | null>(null)
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
              layout.querySelectorAll<HTMLElement>('.results-card:not([hidden]), .results-toggle'),
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
      el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], {
        duration: SETTLE_MS,
        easing: 'cubic-bezier(0.22, 0.61, 0.36, 1)',
      })
    }
  }, [mountAll])

  /** Stagger helper: card N starts its cascade step N slots after the first. */
  const stagger = (index: number) => ({ '--card-index': index }) as CSSProperties

  /** One source of truth for every card - grid cell and dialog share it. */
  const cards: CardDef[] = [
    {
      key: 'firstPayment',
      testId: 'monthly-payment',
      value: vm.monthlyPayment,
      label: t('calculator.results.firstPaymentCard'),
      caption: vm.paymentNote,
      captionTestId: 'payment-note',
      featured: true,
      primary: true,
      link: 'guide',
      index: 0,
    },
    {
      key: 'totalInterest',
      testId: 'total-interest',
      value: vm.totalInterest,
      label: t('calculator.results.totalInterestCard'),
      caption: t('calculator.results.interestCaption'),
      featured: true,
      link: 'interest',
      index: 1,
    },
    {
      key: 'totalPayment',
      testId: 'total-payment',
      value: vm.totalPayment,
      // The label keeps its nowrap wrapper so "Total payments over 30
      // years" stays on one line inside the card (and the dialog).
      label: <span className="total-payment-text">{vm.totalPaymentLabelParts}</span>,
      labelTestId: 'total-payment-label',
      labelClassName: 'total-payment-label',
      caption: t('calculator.results.totalPaymentCaption'),
      featured: true,
      link: 'compare',
      index: 2,
    },
    {
      key: 'rateUp',
      testId: 'payment-rate-up',
      value: vm.paymentRateUp1,
      label: t('calculator.results.rateUpCard'),
      caption: vm.hasVariableTrack
        ? t('calculator.results.rateUpCaption', { delta: vm.paymentRateUp1Delta })
        : t('calculator.results.rateUpCaptionFixed'),
      captionTestId: 'payment-rate-up-note',
      link: 'guide',
      index: 0,
    },
    {
      key: 'rateDown',
      testId: 'payment-rate-down',
      value: vm.paymentRateDown1,
      label: t('calculator.results.rateDownCard'),
      caption: vm.hasVariableTrack
        ? t('calculator.results.rateDownCaption', { delta: vm.paymentRateDown1Delta })
        : t('calculator.results.rateDownCaptionFixed'),
      captionTestId: 'payment-rate-down-note',
      link: 'guide',
      index: 1,
    },
    {
      key: 'highestPayment',
      testId: 'highest-payment',
      value: vm.highestPayment,
      label: vm.highestLabelText,
      caption: t('calculator.results.highestCaption'),
      link: 'cpi',
      index: 2,
    },
    {
      key: 'avgPayment',
      testId: 'avg-monthly-payment',
      value: vm.avgMonthlyPayment,
      label: t('calculator.results.avgPaymentCard'),
      caption: t('calculator.results.avgPaymentCaption'),
      link: 'guide',
      index: 3,
    },
    {
      key: 'overpayPercent',
      testId: 'overpay-percent',
      value: vm.overpayPercent,
      unit: '%',
      label: t('calculator.results.overpayCard'),
      caption: t('calculator.results.overpayCaption'),
      link: 'interest',
      index: 4,
    },
    {
      key: 'avgPayback',
      testId: 'avg-payback',
      value: vm.avgPayback,
      label: t('calculator.results.avgPaybackCard'),
      caption: t('calculator.results.avgPaybackCaption'),
      link: 'compare',
      index: 5,
    },
    {
      key: 'avgRate',
      testId: 'avg-rate',
      value: vm.avgRate,
      unit: '%',
      label: t('calculator.results.avgRateCard'),
      caption: t('calculator.results.avgRateCaption', { weighted: vm.weightedAvgRate }),
      link: 'rates',
      index: 6,
    },
    {
      key: 'effRate',
      testId: 'eff-rate',
      value: vm.effectiveRate,
      unit: '%',
      label: t('calculator.results.effRateCard'),
      caption: t('calculator.results.effRateCaption', { nominal: vm.avgRate }),
      link: 'interest',
      index: 7,
    },
    {
      key: 'interestShare',
      testId: 'interest-share',
      value: vm.firstPaymentInterestShare,
      unit: '%',
      label: t('calculator.results.interestShareCard'),
      caption: t('calculator.results.interestShareCaption'),
      link: 'guide',
      index: 8,
    },
    {
      key: 'fiveYInterest',
      testId: 'first5y-interest-share',
      value: vm.first5yInterestShare,
      unit: '%',
      label: t('calculator.results.fiveYInterestCard'),
      caption: t('calculator.results.fiveYInterestCaption'),
      link: 'guide',
      index: 9,
    },
    {
      key: 'balance5y',
      testId: 'balance-after-5y',
      value: vm.balanceAfter5y,
      label: t('calculator.results.balance5yCard'),
      caption: t('calculator.results.balance5yCaption'),
      link: 'guide',
      index: 10,
    },
    {
      key: 'per100k',
      testId: 'payment-per-100k',
      value: vm.paymentPer100k,
      label: t('calculator.results.per100kCard'),
      caption: t('calculator.results.per100kCaption'),
      link: 'compare',
      index: 11,
    },
  ] // The dialog reads straight from the live card definition, so it always
  // shows the current values and language while open. Content follows
  // shownCardKey (persists through the close fade); opening sets both.
  const openCard =
    shownCardKey !== null ? (cards.find((card) => card.key === shownCardKey) ?? null) : null

  /** Open the explanation dialog for a card. */
  const openDialog = (key: CardKey) => {
    setShownCardKey(key)
    setOpenCardKey(key)
  }

  /** Start closing - content stays until the exit animation finishes. */
  const closeDialog = () => setOpenCardKey(null)

  // The external-link icon sits on the physical right of the label in both
  // languages: leading (start) in RTL, trailing (end) in LTR.
  const isRtl = i18n.dir() === 'rtl'

  return (
    <>
      <section
        ref={layoutRef}
        aria-live="polite"
        data-testid="results-layout"
        className={`results-layout${mountAll ? ' all-visible' : ''}`}
      >
        {cards.map((card) => {
          const isExtra = !card.featured
          return (
            <button
              key={card.key}
              type="button"
              data-card-key={card.key}
              aria-haspopup="dialog"
              className={`results-card${card.primary ? ' primary-result' : ''}${
                isExtra && !showAll ? ' results-extra-out' : ''
              }`}
              style={stagger(card.index)}
              hidden={isExtra && !mountAll}
              onClick={() => openDialog(card.key)}
            >
              <strong data-testid={card.testId}>
                {card.value}
                {card.unit && <span className="rate-unit">{card.unit}</span>}
              </strong>
              <p data-testid={card.labelTestId} className={card.labelClassName}>
                {card.label}
              </p>
              <span data-testid={card.captionTestId}>{card.caption}</span>
            </button>
          )
        })}

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
      </section>

      {/* Explanation dialog - every results card opens one. */}
      <AppModal
        open={openCardKey !== null}
        onOpenChange={(open) => {
          if (!open) closeDialog()
        }}
        testId="results-card-modal"
        dir={i18n.dir()}
        tone="teal"
        contentClassName="max-w-[480px]"
      >
        {openCard && (
          <div className="px-7 pb-7 pt-9 text-center">
            <div className="text-[34px] font-bold leading-tight text-[var(--calc-teal-dark)]">
              {openCard.value}
              {openCard.unit}
            </div>
            <div className="mt-2 text-[18px] font-bold leading-snug text-[var(--calc-ink)]">
              {openCard.label}
            </div>
            <p className="mt-4 text-[17px] leading-relaxed text-[#333]">
              {t(`calculator.results.details.${openCard.key}`)}
            </p>
            <div className="mt-3 text-[14px] font-semibold leading-relaxed text-[var(--calc-muted)]">
              {openCard.caption}
            </div>
            <a
              href={t(`calculator.results.links.${openCard.link}.url`)}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="results-card-modal-link"
              className="mt-5 inline-block text-[15px] font-semibold text-[var(--calc-teal-dark)] underline underline-offset-4 transition-colors hover:text-[var(--calc-accent)]"
            >
              {isRtl && (
                <FaExternalLinkAlt aria-hidden="true" className="me-1.5 inline-block text-[13px]" />
              )}
              {t(`calculator.results.links.${openCard.link}.label`)}
              {!isRtl && (
                <FaExternalLinkAlt aria-hidden="true" className="ms-1.5 inline-block text-[13px]" />
              )}
            </a>
            <button
              type="button"
              data-testid="results-card-modal-gotit"
              className="mt-6 w-full rounded-[5px] bg-[var(--calc-teal)] px-5 py-2.5 text-[16px] font-semibold text-white transition-colors hover:bg-[var(--calc-teal-dark)]"
              onClick={closeDialog}
            >
              {t('calculator.results.gotIt')}
            </button>
          </div>
        )}
      </AppModal>
    </>
  )
}
