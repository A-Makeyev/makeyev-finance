import { useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { fetchCbsIndex, type CbsFeedKind } from '@/services/cbs'
import { adjustMinus, type CbsIndexPayload, type TrendDirection } from '@/lib/xml'
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
  const month = payload.currentMonth
  if (!month) return null
  return (
    <a
      href={`https://google.com/search?q=${payload.searchQuery}`}
      target="_blank"
      rel="noreferrer"
      style={{ order: Number(payload.displayOrder) }}
      className="remove-highlight"
    >
      {payload.indexName}{' '}
      <span style={{ color: TREND_COLORS[payload.monthDirection] }}>{month.value}</span>
      <span className="line-break" />
      {' שינוי חודשי '}
      <span style={{ color: TREND_COLORS[payload.monthDirection] }}>
        {TREND_ARROWS[payload.monthDirection]} {adjustMinus(String(month.percent))}
      </span>
      {' שינוי שנתי '}
      <span style={{ color: TREND_COLORS[payload.yearDirection] }}>
        {TREND_ARROWS[payload.yearDirection]} {adjustMinus(String(month.percentYear))}
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

/** Syncs the live CPI annual change into the calculator store (recalculates indexed tracks). */
export function useCpiCalculatorSync(cpiPayload: CbsIndexPayload | null): void {
  useEffect(() => {
    if (!cpiPayload?.currentMonth) return
    const { setCpiAnnualChange } = useCalculatorStore.getState()
    setCpiAnnualChange(cpiPayload.currentMonth.percentYear / 100)
  }, [cpiPayload])
}
