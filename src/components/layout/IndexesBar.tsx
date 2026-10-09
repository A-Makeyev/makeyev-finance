import { useEffect, useMemo, useRef } from 'react'
import type { TFunction } from 'i18next'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { HoverTooltip } from '@/components/ui/HoverTooltip'
import { fetchCbsIndex, type CbsFeedKind } from '@/services/cbs'
import { formatIndexPercent, type CbsIndexPayload, type TrendDirection } from '@/lib/xml'
import { useCalculatorStore } from '@/stores/calculatorStore'
import { useMediaQuery } from '@/hooks/useScrolled'
import { MARQUEE_COPIES } from '@/lib/marquee'
/**
 * Live CBS index feeds (CPI + construction-input indexes).
 *
 * Legacy behaviour preserved: silent failure (bar simply stays hidden),
 * arrows/colors per trend, Hebrew typographic percent-minus, Google-search
 * deep link, CPI payload pushed into the calculator for real inflation data.
 *
 * Color note: the legacy JS constants differed slightly from its CSS palette;
 * these tokens match the legacy RUNTIME (rendered) values.
 */
const TREND_COLORS: Record<TrendDirection, string> = {
  up: 'rgb(210, 60, 60)',
  down: 'rgb(35, 210, 65)',
  flat: 'lightblue',
}

const TREND_ARROWS: Record<TrendDirection, string> = {
  up: '⭡',
  down: '⭣',
  flat: '',
}

/**
 * The three feeds the bar shows, used only to hold the layout while loading:
 * one skeleton entry per feed, so the bar settles at its final shape before
 * any number arrives.
 */
const SKELETON_ENTRIES = ['cpi', 'residentialConstruction', 'commercialConstruction'] as const

export interface CbsFeedsResult {
  payloads: Array<{ kind: CbsFeedKind; payload: CbsIndexPayload }>
  anySuccess: boolean
  /** At least one feed is still in flight (neither data nor an error yet). */
  anyPending: boolean
  cpiPayload: CbsIndexPayload | null
}

export function useCbsFeeds(): CbsFeedsResult {
  const cpi = useQuery({
    queryKey: ['cbs', 'cpi'],
    queryFn: ({ signal }) => fetchCbsIndex('cpi', signal),
    retry: false,
    staleTime: 15 * 60 * 1000,
  })
  const residential = useQuery({
    queryKey: ['cbs', 'residentialConstruction'],
    queryFn: ({ signal }) => fetchCbsIndex('residentialConstruction', signal),
    retry: false,
    staleTime: 15 * 60 * 1000,
  })
  const commercial = useQuery({
    queryKey: ['cbs', 'commercialConstruction'],
    queryFn: ({ signal }) => fetchCbsIndex('commercialConstruction', signal),
    retry: false,
    staleTime: 15 * 60 * 1000,
  })

  return useMemo(() => {
    const entries = [
      { kind: 'cpi' as const, query: cpi },
      { kind: 'residentialConstruction' as const, query: residential },
      { kind: 'commercialConstruction' as const, query: commercial },
    ]
    const payloads = entries
      .filter(({ query }) => Boolean(query.data))
      .map(({ kind, query }) => ({ kind, payload: query.data as CbsIndexPayload }))
    return {
      payloads,
      anySuccess: payloads.length > 0,
      anyPending: entries.some(({ query }) => query.isPending),
      cpiPayload: (cpi.data as CbsIndexPayload | null) ?? null,
    }
  }, [cpi, residential, commercial])
}

interface FeedAnchorProps {
  payload: CbsIndexPayload
  /**
   * True below 1200px, where the strip slides on one line: the yearly change
   * is dropped so a single line reads. The full name is kept.
   */
  compact: boolean
  /** The duplicated (aria-hidden) group that makes the loop seamless. */
  clone?: boolean
}

function FeedAnchor({ payload, compact, clone = false }: FeedAnchorProps) {
  const { t, i18n } = useTranslation()
  const month = payload.currentMonth
  if (!month) return null
  // The strip renders on every page, but only the calculator route flips
  // the document to RTL, so without pinning, Hebrew pages with an LTR
  // document would flow inline left-to-right and each change value would
  // sit to the RIGHT of its label - read first in RTL. Pinning the anchor
  // to the UI language makes Hebrew flow RTL and English LTR on every
  // page, so the label always precedes its value in reading order,
  // mirroring the English layout.
  const hebrew = i18n.language.startsWith('he')
  const dir = hebrew ? 'rtl' : 'ltr'
  // The value span pins its own dir too (dir implies bidi isolation): the
  // trend arrow and trailing sign are bidi-neutrals whose side depends on
  // the surrounding paragraph, so the isolation keeps Hebrew rendering the
  // sign left of the digits and the arrow last in reading order, and
  // English leading with the sign, on every page.
  const change = (percent: number, direction: TrendDirection) => {
    const signed = formatIndexPercent(percent, direction, hebrew)
    const arrow = TREND_ARROWS[direction]
    return hebrew ? `${arrow} ${signed}` : `${signed} ${arrow}`
  }
  const shortNameKey = kindToShortNameKey(payload.searchQuery)
  // The hover tooltip explains what this index measures and how it reaches a
  // mortgage or loan, mirroring the Markets rows. The full official feed name
  // stays in the search deep link only.
  const tooltip = indexesTooltipContent(t, shortNameKey)
  return (
    <HoverTooltip
      as="a"
      href={`https://google.com/search?q=${payload.searchQuery}`}
      target="_blank"
      rel="noreferrer"
      dir={dir}
      style={{ order: Number(payload.displayOrder) }}
      className="remove-highlight"
      // The clone repeats an already-focusable link; keep it out of the tab
      // order (its group is aria-hidden, so screen readers skip it entirely).
      tabIndex={clone ? -1 : undefined}
      content={tooltip}
    >
      {/* Short localized name ("CPI" etc. in English); the raw Hebrew feed
          name stays in the search deep link only. The compact tier keeps
          this name too - only the yearly change is dropped. */}
      {t(`indexesBar.shortNames.${shortNameKey}`)}{' '}
      <span style={{ color: TREND_COLORS[payload.monthDirection] }}>{month.value}</span>
      {/* Non-breaking space: a plain collapsible space next to the empty
          .line-break span collapses to zero width (measured in the probe),
          gluing the number to the next label. */}
      {!compact && <span className="line-break" />}
      <span className="index-join">{t('indexesBar.monthlyChange')} </span>
      <span dir={dir} style={{ color: TREND_COLORS[payload.monthDirection] }}>
        {change(month.percent, payload.monthDirection)}
      </span>
      {/* The yearly change is the first thing to go on the compact line. */}
      {!compact && (
        <>
          <span className="index-join">{t('indexesBar.yearlyChange')} </span>
          <span dir={dir} style={{ color: TREND_COLORS[payload.yearDirection] }}>
            {change(month.percentYear, payload.yearDirection)}
          </span>
        </>
      )}
    </HoverTooltip>
  )
}

/**
 * One loading entry, mirroring the Markets strip's skeleton treatment (same
 * shimmer, same tint, same 0.75em bars) instead of the bar being absent and
 * then appearing.
 *
 * Like the Markets rows, the localized NAME is always real text - only the
 * value slot shimmers - so the strip reads as content the moment it paints
 * and the names never blink in and out per feed. The value bar is decorative;
 * the strip itself carries aria-busy.
 */
function IndexSkeleton({ kind }: { kind: CbsFeedKind }) {
  const { t } = useTranslation()
  return (
    <span className="indexes-skeleton" data-testid={`indexes-skeleton-${kind}`}>
      <span className="indexes-skeleton-name">{t(`indexesBar.shortNames.${kind}`)}</span>
      <span className="indexes-skeleton-value" aria-hidden="true" />
    </span>
  )
}

interface IndexesBarProps {
  feeds: CbsFeedsResult
  hidden?: boolean
}

/** Fixed top strip; holds its slot with skeletons while the feeds load. */
export function IndexesBar({ feeds, hidden = false }: IndexesBarProps) {
  const { t } = useTranslation()
  // Below the hamburger breakpoint the strip slides on one line (see the
  // compact marquee block in globals.css) instead of wrapping onto 2-3 lines.
  const compact = useMediaQuery('(max-width: 1200px)')
  // The loop copies assume the compact tier until the viewport is known. The
  // CSS marquee animates the track from the FIRST paint, so the markup it
  // animates must already carry MARQUEE_COPIES groups: with the conservative
  // desktop default (one group) a compact viewport animated a single-group
  // track that slid half its own width, then snapped back the moment
  // hydration added the copies - the strip flickered and restarted on every
  // load. Above 1200px the extra copies are `display: none` (globals.css), so
  // they are invisible and inert there and this drops them from the DOM once
  // the real query lands, keeping the wide-screen markup as light as before.
  const compactFirstPaint = useMediaQuery('(max-width: 1200px)', true)
  const stripRef = useRef<HTMLDivElement | null>(null)
  const anySuccess = feeds.anySuccess

  // Legacy silent degradation: once every feed has FAILED the bar stays
  // hidden (the Markets strip takes the top slot). While the feeds are still
  // in flight it renders with the same skeleton treatment the Markets strip
  // uses instead, so the bar is already the height it will be and the navbar
  // never jumps when the numbers land.
  const loading = !anySuccess && feeds.anyPending
  const present = anySuccess || loading

  // Publish the strip's real rendered height as --indexes-height, the same
  // contract MarketTracker keeps for --markets-height. The bar is 35px at
  // full width but wraps up to 84px on phones (before the compact marquee
  // tier collapses it back) and is absent entirely once every feed has
  // failed, so pages with no hero banner read this plus --markets-height to
  // start below the fixed chrome instead of underneath it (see
  // .below-chrome).
  useEffect(() => {
    const el = stripRef.current
    if (!el) {
      document.documentElement.style.removeProperty('--indexes-height')
      return
    }
    const publish = () => {
      const height = el.offsetHeight
      if (height > 0) {
        document.documentElement.style.setProperty('--indexes-height', `${height}px`)
      }
    }
    publish()
    const observer = new ResizeObserver(publish)
    observer.observe(el)
    return () => {
      observer.disconnect()
      document.documentElement.style.removeProperty('--indexes-height')
    }
  }, [present])

  if (!present) return null

  // Above 1200px the wrappers dissolve (display: contents) and the anchors
  // are direct flex items of .indexes, exactly as before. In the compact tier
  // (and until the viewport is known, see compactFirstPaint above) the same
  // group is rendered MARQUEE_COPIES times so the marquee loop is both
  // seamless and still covering the screen at the loop point (with only two
  // copies a group narrower than the viewport let blank space eat in from the
  // right before the loop snapped back); see src/lib/marquee.ts. Copy 0 is
  // the visible, tabbable one; the loop copies are hidden from assistive tech
  // and their links are not tabbable.
  const group = (clone: boolean, copy: number) => (
    <div
      key={copy}
      className="indexes-group"
      data-marquee-clone={clone ? 'true' : undefined}
      aria-hidden={clone || undefined}
    >
      {loading
        ? SKELETON_ENTRIES.map((entry) => <IndexSkeleton key={entry} kind={entry} />)
        : feeds.payloads.map(({ kind, payload }) => (
            <FeedAnchor key={kind} payload={payload} compact={compact} clone={clone} />
          ))}
    </div>
  )

  return (
    <div
      ref={stripRef}
      aria-label={t('indexesBar.ariaLabel')}
      className="indexes visible"
      data-testid="indexes-bar"
      data-marquee={compact ? 'true' : 'false'}
      data-hidden={hidden ? 'true' : 'false'}
      data-state={loading ? 'loading' : 'ready'}
      aria-busy={loading}
      aria-hidden={hidden}
    >
      <div className="indexes-track">
        {Array.from({ length: compactFirstPaint ? MARQUEE_COPIES : 1 }, (_, copy) =>
          group(copy > 0, copy),
        )}
      </div>
    </div>
  )
}

/**
 * Maps a feed to its short-name i18n key. The CBS searchQuery (built from
 * the trimmed Hebrew name) is the stable discriminator: צרכן = CPI,
 * מגורים = residential construction inputs, otherwise commercial.
 */
function kindToShortNameKey(
  searchQuery: string,
): 'cpi' | 'residentialConstruction' | 'commercialConstruction' {
  if (searchQuery.includes('צרכן')) return 'cpi'
  if (searchQuery.includes('מגורים')) return 'residentialConstruction'
  return 'commercialConstruction'
}

/**
 * The hover-tooltip text for one index row: what the index measures, then how
 * it reaches a mortgage or loan. Pure, so the composition is unit-tested
 * against the real translations rather than only rendered. The `kind` is both
 * the short-name key and the feed kind.
 */
export function indexesTooltipContent(t: TFunction, kind: CbsFeedKind): string {
  return `${t(`indexesBar.descriptions.${kind}`)} ~ ${t(`indexesBar.mortgageEffects.${kind}`)}`
}

/** Syncs the live CPI annual change into the calculator store (recalculates indexed tracks). */
export function useCpiCalculatorSync(cpiPayload: CbsIndexPayload | null): void {
  useEffect(() => {
    if (!cpiPayload?.currentMonth) return
    const { setCpiAnnualChange } = useCalculatorStore.getState()
    setCpiAnnualChange(cpiPayload.currentMonth.percentYear / 100)
  }, [cpiPayload])
}
