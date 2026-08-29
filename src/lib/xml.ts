/**
 * Hand-rolled XML parsing utilities, ported verbatim from the legacy
 * navigation.js (src/navigation.js:203-230).
 *
 * WHY NOT a generic XML library: the CBS feed handling depends on this
 * parser's exact semantics — repeated sibling tags collapse last-wins into a
 * flat object, recursion only descends when children exist, and the caller
 * slices the raw document by splitting on `<DateMonth>` before parsing.
 * DOMParser/fast-xml-parser produce different shapes (arrays, attribute
 * objects) which would silently change behavior. Snapshot tests pin the
 * output against recorded CBS payloads.
 */

const XML_TAG_REGEX = /(?:<(\w*)(?:\s[^>]*)*>)((?:(?!<\1).)*)(?:<\/\1>)|<(\w*)(?:\s*)*\/>/gm

export interface XmlJson {
  [key: string]: string | XmlJson | null
}

export function parseXmlToJson(xmlString: string | undefined): XmlJson | undefined {
  if (!xmlString) return undefined
  const json: XmlJson = {}
  for (const res of xmlString.matchAll(XML_TAG_REGEX)) {
    const key = res[1] || res[3]
    const value = res[2] ? parseXmlToJson(res[2]) : undefined
    json[key] = ((value && Object.keys(value).length ? value : res[2]) ?? null) as
      string | XmlJson | null
  }
  return json
}

/** Returns the inner text of the LAST occurrence of <key>…</key> in xml. */
export function getXmlValue(xml: string, key: string): string {
  return xml.substring(
    xml.lastIndexOf('<' + key + '>') + ('<' + key + '>').length,
    xml.lastIndexOf('</' + key + '>'),
  )
}

/**
 * Legacy Hebrew typographic convention: moves a leading minus AFTER the
 * percent sign ("-0.5" → "0.5%-").
 */
export function adjustMinus(str: string): string {
  if (str.includes('-')) {
    const minus = str.substring(0, 1)
    const value = str.substring(1)
    return `${value}%${minus}`
  }
  return `${str}%`
}

export interface CbsMonthData {
  value: number
  percent: number
  percentYear: number
  date: string | null
}

export type TrendDirection = 'up' | 'down' | 'flat'

export interface CbsIndexPayload {
  indexName: string
  searchQuery: string
  displayOrder: '1' | '2' | '3'
  currentMonth: CbsMonthData | null
  monthDirection: TrendDirection
  yearDirection: TrendDirection
}

function toMonthData(raw: XmlJson | undefined): CbsMonthData | null {
  if (!raw || typeof raw.value === 'undefined') return null
  return {
    value: Number(raw.value),
    percent: Number(raw.percent),
    percentYear: Number(raw.percentYear),
    date: typeof raw.date === 'string' ? raw.date : null,
  }
}

/**
 * Deliberate correction vs legacy: trend comparisons use numeric comparison.
 * The legacy code compared raw strings ("99.5" > "100.1" evaluated true),
 * which inverted arrows/colors whenever integer-part lengths differed.
 * Numeric inflation input (percentYear/100) was already numeric in legacy and
 * is unaffected. Flagged in the migration checklist.
 */
function compareTrend(current: number, previous: number): TrendDirection {
  if (current > previous) return 'up'
  if (current < previous) return 'down'
  return 'flat'
}

/**
 * Extracts the display payload for one CBS index feed, replicating the legacy
 * slicing: split('<DateMonth>')[1] = newest entry, [2] = previous month,
 * [10] = year-ago context (parsed but unused downstream — kept for parity).
 */
export function extractCbsIndexPayload(xmlString: string): CbsIndexPayload | null {
  const segments = xmlString.split('<DateMonth>')
  const currentMonth = toMonthData(parseXmlToJson(segments[1]))
  const lastMonth = parseXmlToJson(segments[2])
  // Parsed for behavioral parity with legacy; intentionally unused:
  void parseXmlToJson(segments[10])

  const indexName = getXmlValue(xmlString, 'name')
    .replace('- כללי', '')
    .replace('מחירי תשומה', 'תשומה')
  const searchQuery = indexName
    .split(' ')
    .join('+')
    .substring(0, indexName.length - 1)
  const displayOrder = indexName.includes('צרכן') ? '3' : indexName.includes('מגורים') ? '2' : '1'

  if (!currentMonth) return null

  const previousPercentYear = Number(lastMonth?.percentYear ?? NaN)

  return {
    indexName,
    searchQuery,
    displayOrder,
    currentMonth,
    monthDirection: compareTrend(currentMonth.value, Number(lastMonth?.value ?? NaN)),
    yearDirection: compareTrend(currentMonth.percentYear, previousPercentYear),
  }
}
