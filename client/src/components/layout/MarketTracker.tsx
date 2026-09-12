import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMarketQuotes } from '@/services/market'
import type { MarketAssetMeta, MarketQuote } from '@/services/marketTypes'
import {
  formatMarketChangePercent,
  formatMarketQuotePrice,
  marketTrendOf,
  priceTickTrend,
  type PriceTickDirection,
} from '@/lib/marketFormat'

/**
 * Markets section for the top navigation strip, rendered directly below the
 * CBS Indexes section. Follows the .indexes strip conventions: same fixed
 * bar, same type scale, silent degradation - it never blocks the nav.
 *
 * Loading: rows render immediately with hyphen placeholders (nav stays
 * usable). Error: hyphens; the hook keeps polling and the strip heals
 * itself. Stale numbers get a title tooltip so they are never presented
 * as current. Row order comes from TRACKER_ASSET_IDS; the server
 * registry may grow (watchlist) without this component changing shape.
 */

export const TRACKER_ASSET_IDS = ['sp500', 'nasdaq', 'ta35', 'gold', 'bitcoin', 'usdils'] as const

/**
 * Trend arrows, matching the CBS Indexes strip's convention (index bar uses
 * ⭡ / ⭣ next to each change). Rendered only for up/down; flat rows show no
 * arrow, like the indexes. Placed after the signed percent ("-0.33% ⭣").
 * Non-selectable via the strip's user-select rule.
 */
const TREND_ARROWS: Record<'up' | 'down' | 'flat', string> = {
  up: '⭡',
  down: '⭣',
  flat: '',
}

/**
 * Movement colors follow the international convention (+ green, - red),
 * unlike the CBS Indexes strip (legacy: + red in the Hebrew convention).
 * Same palette, same brightness, same rendering as the indexes: names
 * white, the price and the change share the row's movement color.
 */
const TREND_CLASS: Record<'up' | 'down' | 'flat', string> = {
  up: 'market-change-up',
  down: 'market-change-down',
  flat: 'market-change-flat',
}

interface MarketTrackerProps {
  hidden?: boolean
  /**
   * True when the CBS Indexes strip above is absent (feeds failed): the
   * Markets strip then takes the very top slot and the navbar clears only
   * this strip's 35px height.
   */
  atTop?: boolean
}

export function MarketTracker({ hidden = false, atTop = false }: MarketTrackerProps) {
  const { t } = useTranslation()
  const { data, isError, isPending } = useMarketQuotes(TRACKER_ASSET_IDS)
  const stripRef = useRef<HTMLDivElement | null>(null)

  // The strip wraps on narrow screens, so its height is NOT the fixed 35px
  // the navbar offset math used to assume - at mid widths six rows flow onto
  // two lines and the frosted navbar slab would slide over the second line.
  // Measure the real rendered height and publish it as a CSS variable that
  // every nav#navbar.adjust-markets margin consumes (with a 35px fallback
  // for first paint). OffsetHeight (not contentRect) keeps the padding.
  useEffect(() => {
    const el = stripRef.current
    if (!el) return
    const publish = () => {
      const height = el.offsetHeight
      // A hidden (menu-open) strip reports 0; keep the last real height so
      // closing the menu never flashes the navbar over the strip.
      if (height > 0) {
        document.documentElement.style.setProperty('--markets-height', `${height}px`)
      }
    }
    publish()
    const observer = new ResizeObserver(publish)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const quotesById = new Map<string, MarketQuote>()
  for (const quote of data?.quotes ?? []) quotesById.set(quote.assetId, quote)
  const assetsMeta = data?.assets

  return (
    <div
      ref={stripRef}
      aria-label={t('marketTracker.ariaLabel')}
      className={`markets${atTop ? ' markets-no-indexes' : ''}`}
      data-testid="market-tracker"
      data-hidden={hidden ? 'true' : 'false'}
      data-state={isPending ? 'loading' : isError ? 'error' : 'ready'}
      aria-hidden={hidden}
    >
      {TRACKER_ASSET_IDS.map((id) => (
        <MarketRow
          key={id}
          assetId={id}
          name={t(`marketTracker.assets.${id}`)}
          quote={quotesById.get(id)}
          meta={assetsMeta?.find((assetMeta) => assetMeta.id === id)}
        />
      ))}
    </div>
  )
}

/**
 * How long the price flash lasts on screen. Must stay in sync with the
 * .markets-tick animation duration in globals.css - the timer only removes
 * the already-faded node, so a mistake here delays cleanup, it does not cut
 * the animation short.
 */
const FLASH_MS = 1200

/**
 * The flash pill. A tick renders ONE pill spanning the whole value pair
 * (price + change): the percent is derived from the same move (the server
 * computes it from the price and the previous close), so a tick that lights
 * the price must light the percent with it, as one rectangle rather than
 * two halves that never quite join. The parent passes the seq as the React
 * key, so two moves in the same direction remount and replay the fade
 * instead of inheriting a finished animation.
 *
 * The pill is absolutely positioned behind the digits inside the row's
 * .markets-values wrapper (its positioning context), so it never shifts
 * the row.
 */
function TickPill({ assetId, direction }: { assetId: string; direction: PriceTickDirection }) {
  return (
    <span
      className={`markets-tick markets-tick-${direction}`}
      data-tick={direction}
      data-testid={`market-tick-${assetId}`}
      aria-hidden="true"
    />
  )
}

/**
 * Reports the direction of each visible price move so the row can flash
 * green/red when a poll actually changes the number. Holds the previous
 * price in a ref (first paint has nothing to compare against, so it is
 * silent) and auto-clears the flash, the same shape the calculator's
 * re-balance flash uses. The seq makes a repeat move in the same direction
 * replay instead of inheriting a finished animation.
 */
function usePriceFlash(price: number | null, decimals: number) {
  const previousPrice = useRef<number | null>(null)
  const timer = useRef<number | null>(null)
  const [flash, setFlash] = useState<{ direction: PriceTickDirection; seq: number } | null>(null)

  useEffect(() => {
    const direction = priceTickTrend(previousPrice.current, price, decimals)
    previousPrice.current = price
    if (!direction) return
    setFlash((current) => ({ direction, seq: (current?.seq ?? 0) + 1 }))
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      timer.current = null
      setFlash(null)
    }, FLASH_MS)
  }, [price, decimals])

  // Unmount only: clearing on every dependency change would drop the pending
  // cleanup timer of a flash that is still on screen, leaving it stuck.
  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current)
    },
    [],
  )

  return flash
}

interface MarketRowProps {
  assetId: string
  name: string
  quote: MarketQuote | undefined
  /** Server-provided asset metadata: proxy disclosure + instrument type. */
  meta: MarketAssetMeta | undefined
}

function MarketRow({ assetId, name, quote, meta }: MarketRowProps) {
  const { t } = useTranslation()
  const trend = marketTrendOf(quote?.changePercent ?? null)
  // The server owns each instrument's display precision (registry decimals:
  // 4 for FX, 0 for crypto, 2 for ETFs); the client never hard-codes it.
  const decimals = meta?.decimals ?? 2
  const arrow = TREND_ARROWS[trend]

  const priceText = quote
    ? formatMarketQuotePrice(quote.price, decimals, quote.currency, meta?.type ?? 'etf')
    : '-'
  const changeText = formatMarketChangePercent(quote?.changePercent ?? null)
  const flash = usePriceFlash(quote?.price ?? null, decimals)

  const titleParts = [`${name}: ${priceText} (${changeText})`]
  // The strip has no room for a unit suffix, and a bare number next to the
  // dollar-prefixed rows reads as dollars, so an index level names its unit
  // here: index points, never shekels. Driven by the instrument type.
  if (meta?.type === 'index') titleParts.push(t('marketTracker.indexPoints'))
  // Gold is the metal's own price, but the front-month CONTRACT: a few percent
  // above what a bullion dealer quotes, so the row says which one it shows.
  if (meta?.futures) titleParts.push(t('marketTracker.futuresNote'))
  if (meta?.proxyOf) titleParts.push(t('marketTracker.proxyOf', { proxy: meta.proxyOf }))
  if (quote?.stale) titleParts.push(t('marketTracker.staleTooltip'))

  return (
    <span
      className={`markets-row${quote?.stale ? ' markets-row-stale' : ''} ${TREND_CLASS[trend]}`}
      data-testid={`market-row-${assetId}`}
      title={titleParts.join(' ~ ')}
    >
      <span className="markets-name">{name}</span>
      <span className="markets-values">
        {flash && <TickPill key={flash.seq} assetId={assetId} direction={flash.direction} />}
        <span className="markets-price">{priceText}</span>
        <span className={`markets-change ${TREND_CLASS[trend]}`}>
          {changeText}
          {arrow && ` ${arrow}`}
        </span>
      </span>
    </span>
  )
}
