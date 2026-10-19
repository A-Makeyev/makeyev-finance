import {
  AVERAGE_RATE_KINDS,
  bucketIdsFor,
  recentRateRows,
  type AverageRateKind,
  type AverageRateTable,
  type AverageRateTablePayload,
  type AverageRatesResponse,
} from '@/lib/averageRates'
import {
  AVERAGE_RATE_HISTORY_ROWS,
  AVERAGE_RATE_PERSISTED_MAX_AGE_MS,
  AVERAGE_RATE_TIMEOUT_MS,
  AVERAGE_RATE_TTL_MS,
  AVERAGE_RATE_USER_AGENT,
  AVERAGE_RATE_WORKBOOK_URLS,
} from './config'
import { parseAverageRateWorkbook } from './parse'
import { loadAverageRates, saveAverageRates } from './persistence'

/**
 * AverageRatesService - fetches, parses and caches the two BOI workbooks.
 *
 * Every table is handled independently: one failed workbook must not hide the
 * other. Failures degrade in this order: fresh cache -> last cached table
 * (stale) -> disk-persisted table (stale) -> unavailable. A number is never
 * invented to fill a missing table.
 */

export type FetchRateWorkbook = (kind: AverageRateKind, signal: AbortSignal) => Promise<Uint8Array>

export interface AverageRatesServiceOptions {
  fetchWorkbook?: FetchRateWorkbook
  now?: () => number
  ttlMs?: number
  timeoutMs?: number
  historyRows?: number
  persist?: boolean
}

interface CachedTable {
  table: AverageRateTable
  fetchedAt: number
  freshUntil: number
}

export class AverageRatesService {
  private readonly fetchWorkbook: FetchRateWorkbook
  private readonly now: () => number
  private readonly ttlMs: number
  private readonly timeoutMs: number
  private readonly historyRows: number
  private readonly persist: boolean

  private readonly cache = new Map<AverageRateKind, CachedTable>()
  private readonly inFlight = new Map<AverageRateKind, Promise<AverageRateTablePayload>>()
  private persistedTables: Partial<Record<AverageRateKind, AverageRateTable>> = {}
  private persistedAt: number | null = null

  constructor(options: AverageRatesServiceOptions = {}) {
    this.fetchWorkbook = options.fetchWorkbook ?? fetchBoiWorkbook
    this.now = options.now ?? Date.now
    this.ttlMs = options.ttlMs ?? AVERAGE_RATE_TTL_MS
    this.timeoutMs = options.timeoutMs ?? AVERAGE_RATE_TIMEOUT_MS
    this.historyRows = Math.max(
      1,
      Math.floor(options.historyRows ?? AVERAGE_RATE_HISTORY_ROWS),
    )
    this.persist = options.persist ?? true

    if (this.persist) {
      const stored = loadAverageRates()
      const now = this.now()
      if (stored && now - stored.savedAt <= AVERAGE_RATE_PERSISTED_MAX_AGE_MS) {
        this.persistedTables = stored.tables
        this.persistedAt = stored.savedAt
      }
    }
  }

  async getSnapshot(): Promise<AverageRatesResponse> {
    const tables = await Promise.all(
      AVERAGE_RATE_KINDS.map((kind) => this.getTable(kind)),
    )
    return { tables, historyRows: this.historyRows }
  }

  private async getTable(kind: AverageRateKind): Promise<AverageRateTablePayload> {
    const now = this.now()
    const cached = this.cache.get(kind)
    if (cached && cached.freshUntil > now) {
      return this.payload(kind, cached.table, 'ok', cached.fetchedAt)
    }

    // Collapse concurrent requests for the same table into one upstream fetch.
    const existing = this.inFlight.get(kind)
    if (existing) return existing

    const promise = this.refresh(kind).finally(() => this.inFlight.delete(kind))
    this.inFlight.set(kind, promise)
    return promise
  }

  private async refresh(kind: AverageRateKind): Promise<AverageRateTablePayload> {
    const cached = this.cache.get(kind)

    try {
      const bytes = await fetchWithTimeout(this.fetchWorkbook, kind, this.timeoutMs)
      const rows = parseAverageRateWorkbook(bytes, kind)
      const table: AverageRateTable = { kind, rows }
      const fetchedAt = this.now()
      this.cache.set(kind, {
        table,
        fetchedAt,
        freshUntil: fetchedAt + this.ttlMs,
      })
      this.remember(table)
      return this.payload(kind, table, 'ok', fetchedAt)
    } catch (error) {
      console.warn(
        `[rates] could not refresh ${kind} average rates: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )

      const fallback = cached?.table ?? this.persistedTables[kind]
      if (!fallback) return this.unavailable(kind)

      const fetchedAt = cached?.fetchedAt ?? this.persistedAt
      return this.payload(kind, fallback, 'stale', fetchedAt)
    }
  }

  private payload(
    kind: AverageRateKind,
    table: AverageRateTable,
    status: AverageRateTablePayload['status'],
    fetchedAt: number | null,
  ): AverageRateTablePayload {
    const rows = recentRateRows(table.rows, this.historyRows)
    return {
      kind,
      status,
      rows,
      buckets: bucketIdsFor(kind),
      asOf: rows[0]?.validFrom ?? null,
      fetchedAt: fetchedAt === null ? null : new Date(fetchedAt).toISOString(),
    }
  }

  private unavailable(kind: AverageRateKind): AverageRateTablePayload {
    return {
      kind,
      status: 'unavailable',
      rows: [],
      buckets: bucketIdsFor(kind),
      asOf: null,
      fetchedAt: null,
    }
  }

  private remember(table: AverageRateTable): void {
    if (!this.persist) return
    this.persistedTables = { ...this.persistedTables, [table.kind]: table }
    this.persistedAt = this.now()
    saveAverageRates(this.persistedTables, this.persistedAt)
  }
}

async function fetchWithTimeout(
  fetchWorkbook: FetchRateWorkbook,
  kind: AverageRateKind,
  timeoutMs: number,
): Promise<Uint8Array> {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined

  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort()
      reject(new Error(`timed out after ${timeoutMs}ms`))
    }, timeoutMs)
  })

  try {
    return await Promise.race([fetchWorkbook(kind, controller.signal), timeout])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

async function fetchBoiWorkbook(
  kind: AverageRateKind,
  signal: AbortSignal,
): Promise<Uint8Array> {
  const response = await fetch(AVERAGE_RATE_WORKBOOK_URLS[kind], {
    signal,
    cache: 'no-store',
    headers: {
      accept: 'application/vnd.ms-excel,*/*;q=0.8',
      'user-agent': AVERAGE_RATE_USER_AGENT,
    },
  })

  if (!response.ok) {
    throw new Error(`BOI returned HTTP ${response.status}`)
  }

  const contentType = response.headers.get('content-type') ?? ''
  if (/text\/html/i.test(contentType)) {
    throw new Error('BOI returned HTML instead of a workbook')
  }

  const bytes = new Uint8Array(await response.arrayBuffer())
  // BIFF8 .xls files are OLE compound documents. Checking the magic bytes
  // catches an HTML error page or a truncated download before the parser sees
  // it, with a clearer failure.
  if (
    bytes.byteLength < 4 ||
    bytes[0] !== 0xd0 ||
    bytes[1] !== 0xcf ||
    bytes[2] !== 0x11 ||
    bytes[3] !== 0xe0
  ) {
    throw new Error('BOI response is not an XLS workbook')
  }
  return bytes
}
