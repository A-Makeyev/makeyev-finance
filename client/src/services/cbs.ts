import { env } from '@/config/env'
import { extractCbsIndexPayload, type CbsIndexPayload } from '@/lib/xml'

export type CbsFeedKind = 'cpi' | 'residentialConstruction' | 'commercialConstruction'

/** CBS series ids preserved verbatim from legacy navigation.js:198-200. */
const FEED_IDS: Record<CbsFeedKind, string> = {
  cpi: '120010',
  residentialConstruction: '200010',
  commercialConstruction: '800010',
}

export function buildCbsUrl(kind: CbsFeedKind, now = new Date()): string {
  const year = now.getFullYear()
  const timePeriod = `&startPeriod=01-${year - 1}&endPeriod=12-${year}`
  return `${env.VITE_CBS_API_BASE}?id=${FEED_IDS[kind]}&format=xml&download=false${timePeriod}`
}

/**
 * Fetches and parses one CBS index feed. Returns null on any failure —
 * legacy logged to console and left the UI untouched; the index bar simply
 * stays hidden and indexed tracks keep their fallback inflation.
 */
export async function fetchCbsIndex(
  kind: CbsFeedKind,
  signal?: AbortSignal,
): Promise<CbsIndexPayload | null> {
  try {
    const response = await fetch(buildCbsUrl(kind), { signal })
    if (!response.ok) return null
    const xmlString = await response.text()
    return extractCbsIndexPayload(xmlString)
  } catch (error) {
    // Legacy: console.log(error) without blocking the UI.
    console.log(error)
    return null
  }
}
