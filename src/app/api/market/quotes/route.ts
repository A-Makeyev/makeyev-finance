import { NextResponse, type NextRequest } from 'next/server'
import { handleQuotes } from '@/server/market/quotes'

/**
 * GET /api/market/quotes - the Markets strip's data source.
 *
 * Ported from the legacy Express router when phase 3 folded the separate
 * backend into the Next app. Node runtime: the market service uses node:fs
 * persistence and reads server-only secrets (FINNHUB_API_KEY), which must
 * never reach a client bundle.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const ids = request.nextUrl.searchParams.get('ids') ?? undefined
  const result = await handleQuotes(ids)
  return NextResponse.json(result.body, {
    status: result.status,
    headers: { 'Cache-Control': 'no-store' },
  })
}
