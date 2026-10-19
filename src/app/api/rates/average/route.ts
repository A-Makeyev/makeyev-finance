import { NextResponse } from 'next/server'
import { handleAverageRates } from '@/server/rates/average'

/**
 * GET /api/rates/average - the average mortgage-rate tables' data source.
 *
 * Node runtime: the service parses legacy BIFF8 workbooks with SheetJS and
 * uses node:fs persistence. The browser only ever sees the normalized rows.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const result = await handleAverageRates()
  return NextResponse.json(result.body, {
    status: result.status,
    headers: { 'Cache-Control': 'no-store' },
  })
}
