import { useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { fetchCbsIndex, type CbsFeedKind } from '@/services/cbs'
import { formatIndexPercent, type CbsIndexPayload, type TrendDirection } from '@/lib/xml'
import { useCalculatorStore } from '@/stores/calculatorStore'

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

export interface CbsFeedsResult {
  payloads: Array<{ kind: CbsFeedKind; payload: CbsIndexPayload }>
  anySuccess: boolean
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
      cpiPayload: (cpi.data as CbsIndexPayload | null) ?? null,
    }
  }, [cpi, residential, commercial])
}

function FeedAnchor({ payload }: { payload: CbsIndexPayload }) {
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
  return (
    <a
      href={`https://google.com/search?q=${payload.searchQuery}`}
      target="_blank"
      rel="noreferrer"
      dir={dir}
      style={{ order: Number(payload.displayOrder) }}
      className="remove-highlight"
    >
      {/* Short localized name ("CPI" etc. in English); the raw Hebrew feed
          name stays in the search deep link and the tooltip. */}
      <span title={payload.indexName}>
        {t(`indexesBar.shortNames.${kindToShortNameKey(payload.searchQuery)}`)}
      </span>{' '}
      <span style={{ color: TREND_COLORS[payload.monthDirection] }}>{month.value}</span>
      {/* Non-breaking space: a plain collapsible space next to the empty
          .line-break span collapses to zero width (measured in the probe),
          gluing the number to the next label. */}
      <span className="line-break" />
      <span className="index-join">{t('indexesBar.monthlyChange')} </span>
      <span dir={dir} style={{ color: TREND_COLORS[payload.monthDirection] }}>
        {change(month.percent, payload.monthDirection)}
      </span>
      <span className="index-join">{t('indexesBar.yearlyChange')} </span>
      <span dir={dir} style={{ color: TREND_COLORS[payload.yearDirection] }}>
        {change(month.percentYear, payload.yearDirection)}
      </span>
    </a>
  )
}

interface IndexesBarProps {
  feeds: CbsFeedsResult
  hidden?: boolean
}

/** Fixed top strip; hidden until at least one CBS feed resolves (legacy parity). */
/** Fixed top strip; hidden until at least one CBS feed resolves (legacy parity). */
export function IndexesBar({ feeds, hidden = false }: IndexesBarProps) {
  const { t } = useTranslation()

  // The bar stays rendered/static (legacy parity); when the menu opens the
  // white nav panel slides over and covers it, so it's simply kept in place.
  if (!feeds.anySuccess) return null

  return (
    <div
      aria-label={t('indexesBar.ariaLabel')}
      className="indexes visible"
      data-testid="indexes-bar"
      data-hidden={hidden ? 'true' : 'false'}
      aria-hidden={hidden}
    >
      {feeds.payloads.map(({ kind, payload }) => (
        <FeedAnchor key={kind} payload={payload} />
      ))}
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

/** Syncs the live CPI annual change into the calculator store (recalculates indexed tracks). */
export function useCpiCalculatorSync(cpiPayload: CbsIndexPayload | null): void {
  useEffect(() => {
    if (!cpiPayload?.currentMonth) return
    const { setCpiAnnualChange } = useCalculatorStore.getState()
    setCpiAnnualChange(cpiPayload.currentMonth.percentYear / 100)
  }, [cpiPayload])
}
