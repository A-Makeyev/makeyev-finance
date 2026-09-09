import fs from 'node:fs'
import path from 'node:path'
import type { MarketSnapshot } from './types.ts'

/**
 * Disk persistence for the last good market snapshot.
 *
 * Why: the snapshot cache is in-memory - every server restart (and any
 * upstream outage) used to blank the strip. Persisting the last complete
 * snapshot lets the service serve clearly-flagged stale prices through
 * restarts and outages instead of collapsing to placeholder hyphens.
 *
 * Only COMPLETE snapshots are persisted (a partial one would pin "-" rows
 * for its assets across restarts). The data file is git-ignored cache data,
 * never committed; it contains only normalized quotes, no secrets.
 */

/**
 * Resolved per call (not at import) so tests can redirect the file via
 * MARKET_CACHE_DIR. Set MARKET_CACHE_DIR in the environment to relocate;
 * default is <project>/.cache (git-ignored).
 */
function snapshotFile(): string {
  const dir = path.resolve(process.cwd(), process.env.MARKET_CACHE_DIR ?? '.cache')
  return path.join(dir, 'market-snapshot.json')
}

interface PersistedSnapshot {
  savedAt: number
  snapshot: MarketSnapshot
}

function writeAtomic(file: string, data: string): void {
  const tmp = `${file}.tmp`
  fs.writeFileSync(tmp, data, 'utf8')
  fs.renameSync(tmp, file)
}

export function saveSnapshot(snapshot: MarketSnapshot, now: () => number = Date.now): void {
  try {
    const file = snapshotFile()
    fs.mkdirSync(path.dirname(file), { recursive: true })
    const payload: PersistedSnapshot = { savedAt: now(), snapshot }
    writeAtomic(file, JSON.stringify(payload))
  } catch {
    // Persistence is best-effort: a read-only disk must never take down
    // the quotes endpoint.
  }
}

/** Returns the persisted snapshot, or undefined when absent/unreadable. */
export function loadSnapshot(): PersistedSnapshot | undefined {
  try {
    const parsed = JSON.parse(fs.readFileSync(snapshotFile(), 'utf8')) as PersistedSnapshot
    if (
      parsed &&
      typeof parsed.savedAt === 'number' &&
      Array.isArray(parsed.snapshot?.quotes) &&
      parsed.snapshot.quotes.length > 0
    ) {
      return parsed
    }
  } catch {
    // No file yet, or corrupt content: treat as "nothing persisted".
  }
  return undefined
}
