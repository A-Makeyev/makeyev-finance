import fs from 'node:fs'
import path from 'node:path'
import type { AverageRateKind, AverageRateTable } from '@/lib/averageRates'

/**
 * Disk persistence for the last good average-rate tables.
 *
 * The in-memory cache is lost on every restart, and a restart during a BOI
 * outage would otherwise blank the page. Only parsed tables are stored, never
 * raw workbooks, and the file is git-ignored cache data with no secrets.
 */

interface PersistedAverageRates {
  savedAt: number
  tables: Partial<Record<AverageRateKind, AverageRateTable>>
}

function snapshotFile(): string {
  // turbopackIgnore: the cache dir is runtime/user-configurable, so bundler
  // static analysis would otherwise trace the whole project.
  const dir = path.resolve(/* turbopackIgnore: true */ process.cwd(), process.env.RATES_CACHE_DIR ?? '.cache')
  return path.join(dir, 'average-rates.json')
}

export function saveAverageRates(
  tables: Partial<Record<AverageRateKind, AverageRateTable>>,
  savedAt: number,
): void {
  try {
    const file = snapshotFile()
    fs.mkdirSync(path.dirname(file), { recursive: true })
    const payload: PersistedAverageRates = { savedAt, tables }
    fs.writeFileSync(file, JSON.stringify(payload), 'utf8')
  } catch {
    // Cache persistence is best-effort; a failed write must never fail a request.
  }
}

export function loadAverageRates(): PersistedAverageRates | undefined {
  try {
    const raw = fs.readFileSync(snapshotFile(), 'utf8')
    const parsed = JSON.parse(raw) as PersistedAverageRates
    if (!parsed || typeof parsed.savedAt !== 'number' || !parsed.tables) return undefined
    const tables: Partial<Record<AverageRateKind, AverageRateTable>> = {}
    for (const kind of ['indexed', 'nonIndexed'] as const) {
      const table = parsed.tables[kind]
      if (
        table &&
        table.kind === kind &&
        Array.isArray(table.rows) &&
        table.rows.length > 0 &&
        table.rows.every(
          (row) =>
            row &&
            typeof row.validFrom === 'string' &&
            typeof row.average === 'number' &&
            row.buckets !== null &&
            typeof row.buckets === 'object',
        )
      ) {
        tables[kind] = table
      }
    }
    return { savedAt: parsed.savedAt, tables }
  } catch {
    return undefined
  }
}
