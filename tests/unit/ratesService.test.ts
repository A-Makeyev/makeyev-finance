import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { AverageRatesService, type FetchRateWorkbook } from '@/server/rates/AverageRatesService'
import type { AverageRateKind } from '@/lib/averageRates'

/**
 * Service tests: per-table independence, TTL caching, in-flight collapsing,
 * stale fallback and disk persistence. The fetcher is injected so no test
 * touches the BOI site.
 */

const FIXTURES = path.join(process.cwd(), 'tests', 'fixtures', 'rates')

function fixture(kind: AverageRateKind): Uint8Array {
  const name = kind === 'indexed' ? 'pribmash-2026-10-19.xls' : 'mashfix-2026-10-19.xls'
  return new Uint8Array(fs.readFileSync(path.join(FIXTURES, name)))
}

function bytesByKind(): Record<AverageRateKind, Uint8Array> {
  return { indexed: fixture('indexed'), nonIndexed: fixture('nonIndexed') }
}

function fetcher(): Mock<FetchRateWorkbook> {
  const bytes = bytesByKind()
  return vi.fn<FetchRateWorkbook>(async (kind) => bytes[kind])
}

let warn: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  warn.mockRestore()
  vi.restoreAllMocks()
  delete process.env.RATES_CACHE_DIR
})

describe('AverageRatesService', () => {
  it('returns both tables, capped to the history window', async () => {
    const now = Date.UTC(2026, 9, 19, 12, 0, 0)
    const service = new AverageRatesService({
      fetchWorkbook: fetcher(),
      now: () => now,
      persist: false,
    })

    const snapshot = await service.getSnapshot()
    expect(snapshot.historyRows).toBe(12)
    expect(snapshot.tables.map((table) => table.kind)).toEqual(['indexed', 'nonIndexed'])
    for (const table of snapshot.tables) {
      expect(table.status).toBe('ok')
      expect(table.rows).toHaveLength(12)
      expect(table.asOf).toBe('2026-10-19')
      expect(table.fetchedAt).toBe(new Date(now).toISOString())
      expect(table.buckets.length).toBeGreaterThanOrEqual(6)
    }
    expect(snapshot.tables[0].rows[0].average).toBeCloseTo(3.4909803402847603, 10)
    expect(snapshot.tables[1].rows[0].average).toBeCloseTo(4.545864869178216, 10)
  })

  it('serves a fresh cache without refetching', async () => {
    const now = 1_000_000
    const fetchWorkbook = fetcher()
    const service = new AverageRatesService({
      fetchWorkbook,
      now: () => now,
      ttlMs: 60_000,
      persist: false,
    })

    await service.getSnapshot()
    await service.getSnapshot()
    expect(fetchWorkbook).toHaveBeenCalledTimes(2)
    expect(fetchWorkbook).toHaveBeenCalledWith('indexed', expect.any(AbortSignal))
    expect(fetchWorkbook).toHaveBeenCalledWith('nonIndexed', expect.any(AbortSignal))
  })

  it('refetches after the TTL expires', async () => {
    let now = 1_000_000
    const fetchWorkbook = fetcher()
    const service = new AverageRatesService({
      fetchWorkbook,
      now: () => now,
      ttlMs: 1_000,
      persist: false,
    })

    await service.getSnapshot()
    now += 1_001
    await service.getSnapshot()
    expect(fetchWorkbook).toHaveBeenCalledTimes(4)
  })

  it('collapses concurrent requests into one fetch per table', async () => {
    const fetchWorkbook = fetcher()
    const service = new AverageRatesService({
      fetchWorkbook,
      now: () => 1_000_000,
      persist: false,
    })

    await Promise.all([service.getSnapshot(), service.getSnapshot()])
    expect(fetchWorkbook).toHaveBeenCalledTimes(2)
  })

  it('keeps the working table when only one workbook fails', async () => {
    const bytes = bytesByKind()
    const fetchWorkbook = vi.fn<FetchRateWorkbook>(async (kind) => {
      if (kind === 'indexed') throw new Error('indexed is down')
      return bytes[kind]
    })
    const service = new AverageRatesService({
      fetchWorkbook,
      now: () => 1_000_000,
      persist: false,
    })

    const snapshot = await service.getSnapshot()
    expect(snapshot.tables[0]).toMatchObject({
      kind: 'indexed',
      status: 'unavailable',
      rows: [],
      asOf: null,
    })
    expect(snapshot.tables[1].status).toBe('ok')
    expect(snapshot.tables[1].rows).toHaveLength(12)
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('falls back to the last cached table and flags it stale', async () => {
    let now = 1_000_000
    let fail = false
    const bytes = bytesByKind()
    const fetchWorkbook = vi.fn<FetchRateWorkbook>(async (kind) => {
      if (fail) throw new Error('BOI is down')
      return bytes[kind]
    })
    const service = new AverageRatesService({
      fetchWorkbook,
      now: () => now,
      ttlMs: 1_000,
      persist: false,
    })

    const first = await service.getSnapshot()
    fail = true
    now += 1_001
    const second = await service.getSnapshot()

    expect(first.tables[0].status).toBe('ok')
    expect(second.tables[0].status).toBe('stale')
    expect(second.tables[0].fetchedAt).toBe(first.tables[0].fetchedAt)
    expect(second.tables[0].rows).toEqual(first.tables[0].rows)
    expect(second.tables[1].status).toBe('stale')
  })

  it('marks a table unavailable after a timeout, without hanging', async () => {
    const fetchWorkbook = vi.fn<FetchRateWorkbook>(
      () => new Promise<Uint8Array>(() => {}),
    )
    const service = new AverageRatesService({
      fetchWorkbook,
      timeoutMs: 10,
      persist: false,
    })

    const snapshot = await service.getSnapshot()
    expect(snapshot.tables.every((table) => table.status === 'unavailable')).toBe(true)
    expect(warn).toHaveBeenCalledTimes(2)
  })

  it('persists successful tables and serves them stale after a restart', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rates-'))
    process.env.RATES_CACHE_DIR = dir
    let now = Date.UTC(2026, 9, 19, 12, 0, 0)

    try {
      const first = new AverageRatesService({
        fetchWorkbook: fetcher(),
        now: () => now,
        persist: true,
      })
      const fresh = await first.getSnapshot()
      expect(fs.existsSync(path.join(dir, 'average-rates.json'))).toBe(true)

      const offline = new AverageRatesService({
        fetchWorkbook: vi.fn<FetchRateWorkbook>(async () => {
          throw new Error('offline')
        }),
        now: () => now,
        persist: true,
      })
      const stale = await offline.getSnapshot()
      expect(stale.tables[0].status).toBe('stale')
      expect(stale.tables[0].rows).toEqual(fresh.tables[0].rows)
      expect(stale.tables[0].fetchedAt).toBe(new Date(now).toISOString())
      expect(stale.tables[1].status).toBe('stale')
      now += 1
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  it('ignores a persisted snapshot older than six weeks', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rates-'))
    process.env.RATES_CACHE_DIR = dir
    const savedAt = Date.UTC(2026, 0, 1)

    try {
      const first = new AverageRatesService({
        fetchWorkbook: fetcher(),
        now: () => savedAt,
        persist: true,
      })
      await first.getSnapshot()

      const offline = new AverageRatesService({
        fetchWorkbook: vi.fn<FetchRateWorkbook>(async () => {
          throw new Error('offline')
        }),
        now: () => savedAt + 46 * 24 * 60 * 60 * 1000,
        persist: true,
      })
      const snapshot = await offline.getSnapshot()
      expect(snapshot.tables.every((table) => table.status === 'unavailable')).toBe(true)
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })
})
