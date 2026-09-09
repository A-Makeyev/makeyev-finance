import { Router } from 'express'
import { marketConfig } from './config.ts'
import { MarketDataService } from './MarketDataService.ts'
import { MARKET_ASSETS } from './assets.ts'
import { MarketDataError, type MarketQuote } from './types.ts'

/**
 * Internal market-data API.
 *
 * GET /api/market/quotes                -> every registered asset
 * GET /api/market/quotes?ids=a,b,c      -> the requested subset (watchlist-ready)
 *
 * The response is the normalized MarketQuote schema only. Provider API keys
 * and any raw upstream payloads never appear here.
 */

export interface MarketQuotesResponse {
  quotes: MarketQuote[]
  /** Present when the served snapshot has passed its cache TTL. */
  stale?: boolean
  /** Configured client refresh interval, so the UI never hard-codes it. */
  refreshIntervalMs: number
  /** Public display names of the assets backing the rows (proxy disclosure). */
  assets: Array<{
    id: string
    name: string
    proxyOf?: string
    symbol: string
    type: string
    decimals: number
  }>
}

let service: MarketDataService | null = null

function getService(): MarketDataService {
  if (!service) service = new MarketDataService()
  return service
}

/** Test seam: swap the service (or reset it) without module reload tricks. */
export function setMarketService(next: MarketDataService | null): void {
  service = next
}

export function marketRouter(): Router {
  const router = Router()

  router.get('/api/market/quotes', async (req, res) => {
    const idsParam = typeof req.query.ids === 'string' ? req.query.ids : undefined
    const requestedIds = idsParam
      ? idsParam
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean)
      : undefined

    const knownIds = new Set(MARKET_ASSETS.map((asset) => asset.id))
    if (requestedIds && requestedIds.some((id) => !knownIds.has(id))) {
      res.status(400).json({ error: 'unknown asset id' })
      return
    }

    try {
      const current = getService()
      if (!current.available) {
        // Configured without a key: degrade to 503, never leak why in detail.
        res.status(503).json({ error: 'market data unavailable' })
        return
      }
      const snapshot = await current.getQuotes(requestedIds)
      const assetMeta = MARKET_ASSETS.filter((asset) =>
        requestedIds ? requestedIds.includes(asset.id) : true,
      ).map((asset) => ({
        id: asset.id,
        name: asset.name,
        symbol: asset.symbol,
        type: asset.type,
        decimals: asset.decimals,
        ...(asset.proxyOf ? { proxyOf: asset.proxyOf } : {}),
      }))
      const body: MarketQuotesResponse = {
        quotes: snapshot.quotes,
        refreshIntervalMs: marketConfig.MARKET_DATA_REFRESH_INTERVAL,
        assets: assetMeta,
        ...(snapshot.quotes.some((quote) => quote.stale) ? { stale: true } : {}),
      }
      res.set('Cache-Control', 'no-store')
      res.json(body)
    } catch (error) {
      const code = error instanceof MarketDataError ? error.code : 'provider-error'
      const status = code === 'rate-limit' ? 503 : 502
      res.status(status).json({ error: 'market data unavailable', code })
    }
  })

  return router
}
