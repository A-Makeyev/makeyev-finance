/**
 * Bank of Israel average-rate configuration.
 *
 * The two workbooks are the official source for the term-bucketed table. They
 * are fixed public BOI URLs, not environment variables: making them
 * user-configurable would add an SSRF surface for no product benefit. The BOI
 * publishes a new file roughly once a month, so a six-hour cache is plenty and
 * a failed refresh can fall back to the last good table for weeks.
 */
export const AVERAGE_RATE_WORKBOOK_URLS = {
  indexed: 'https://www.boi.org.il/boi_files/Pikuah/pribmash.xls',
  nonIndexed: 'https://www.boi.org.il/boi_files/Pikuah/mashfix.xls',
} as const

/** The public page the tables are linked from, for disclosure in the UI. */
export const AVERAGE_RATE_SOURCE_PAGE = 'https://www.boi.org.il/information/interestrates/mortgage/'

/** Refresh the cached workbooks at most every six hours. */
export const AVERAGE_RATE_TTL_MS = 6 * 60 * 60 * 1000

/** Abort an upstream workbook fetch after this long. */
export const AVERAGE_RATE_TIMEOUT_MS = 15_000

/** Rows per table returned to the page, including the current publication. */
export const AVERAGE_RATE_HISTORY_ROWS = 12

/**
 * A persisted table older than this is not shown at all. The data is monthly,
 * so a six-week-old snapshot is the previous publication and still useful; an
 * old one is more likely a broken deployment than a real rate.
 */
export const AVERAGE_RATE_PERSISTED_MAX_AGE_MS = 45 * 24 * 60 * 60 * 1000

/** A browser-like UA is not required, but a contactable bot UA is polite. */
export const AVERAGE_RATE_USER_AGENT =
  'MakeyevFinance/1.0 (+https://makeyev.finance; mortgage rate table)'
