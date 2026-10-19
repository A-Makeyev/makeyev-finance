import { afterEach, describe, expect, it, vi } from 'vitest'
import { bucketIdsFor, type AverageRatesResponse } from '@/lib/averageRates'
import { handleAverageRates, setAverageRatesService } from '@/server/rates/average'
import { GET } from '@/app/api/rates/average/route'

/**
 * API contract tests for GET /api/rates/average: normalized rows only, one
 * table's failure does not fail the response, and an unexpected service error
 * becomes a generic 500 with no internals.
 */

function sampleResponse(): AverageRatesResponse {
  return {
    historyRows: 12,
    tables: [
      {
        kind: 'indexed',
        status: 'ok',
        buckets: bucketIdsFor('indexed'),
        asOf: '2026-10-19',
        fetchedAt: '2026-10-19T12:00:00.000Z',
        rows: [
          {
            validFrom: '2026-10-19',
            periodToDueDate: '2026-09-30',
            average: 3.49,
            buckets: { over25: 3.52, upTo5: 3.5 },
          },
        ],
      },
      {
        kind: 'nonIndexed',
        status: 'unavailable',
        buckets: bucketIdsFor('nonIndexed'),
        asOf: null,
        fetchedAt: null,
        rows: [],
      },
    ],
  }
}

afterEach(() => {
  setAverageRatesService(null)
  vi.restoreAllMocks()
})

describe('GET /api/rates/average', () => {
  it('returns the normalized snapshot with a no-store header', async () => {
    const body = sampleResponse()
    setAverageRatesService({ getSnapshot: async () => body })

    const response = await GET()
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.json()).toEqual(body)
  })

  it('does not expose workbook URLs or provider payloads', async () => {
    setAverageRatesService({ getSnapshot: async () => sampleResponse() })
    const response = await GET()
    const json = (await response.json()) as Record<string, unknown>
    expect(Object.keys(json).sort()).toEqual(['historyRows', 'tables'])
    expect(JSON.stringify(json)).not.toContain('pribmash')
    expect(JSON.stringify(json)).not.toContain('mashfix')
    expect(JSON.stringify(json)).not.toContain('boi.org.il')
  })

  it('maps an unexpected service failure to a generic 500', async () => {
    setAverageRatesService({
      getSnapshot: async () => {
        throw new Error('secret upstream detail')
      },
    })

    const result = await handleAverageRates()
    expect(result).toEqual({ status: 500, body: { error: 'rates unavailable' } })
  })
})
