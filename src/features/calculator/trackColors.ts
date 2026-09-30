import type { TrackType } from '@/lib/amortization'

/**
 * One fixed color per track TYPE - reused by the mix donut, the per-track
 * comparison lines and any future per-track rendering, so a track changing
 * type recolors consistently everywhere.
 */
export const TRACK_TYPE_COLORS: Record<TrackType, string> = {
  prime: '#0aa89f',
  fixed: '#3b82f6',
  variable5y: '#5b8def',
  variable: '#8a63d2',
  fixedIndexed: '#e0a63c',
  variableIndexed5y: '#d2762e',
  variableIndexed: '#c2508f',
}
