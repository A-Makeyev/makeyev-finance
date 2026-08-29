import { describe, expect, it } from 'vitest'
import { adjustMinus, extractCbsIndexPayload, getXmlValue, parseXmlToJson } from '@/lib/xml'

const CPI_XML = `<?xml version="1.0" encoding="utf-8"?>
<NewDataSet>
  <name>מדד המחירים לצרכן - כללי</name>
  <DateMonth><value>106.2</value><percent>0.4</percent><percentYear>3.1</percentYear><date>2026-07-01</date></DateMonth>
  <DateMonth><value>105.8</value><percent>0.2</percent><percentYear>2.9</percentYear><date>2026-06-01</date></DateMonth>
  <DateMonth><value>105.6</value><percent>-0.1</percent><percentYear>2.8</percentYear><date>2026-05-01</date></DateMonth>
  <DateMonth><value>105.7</value><percent>0.0</percent><percentYear>2.7</percentYear><date>2026-04-01</date></DateMonth>
  <DateMonth><value>105.5</value><percent>0.3</percent><percentYear>2.6</percentYear><date>2026-03-01</date></DateMonth>
  <DateMonth><value>105.2</value><percent>0.1</percent><percentYear>2.5</percentYear><date>2026-02-01</date></DateMonth>
  <DateMonth><value>105.1</value><percent>0.2</percent><percentYear>2.4</percentYear><date>2026-01-01</date></DateMonth>
  <DateMonth><value>104.9</value><percent>0.5</percent><percentYear>2.3</percentYear><date>2025-12-01</date></DateMonth>
  <DateMonth><value>104.4</value><percent>-0.3</percent><percentYear>2.2</percentYear><date>2025-11-01</date></DateMonth>
  <DateMonth><value>104.7</value><percent>0.1</percent><percentYear>2.1</percentYear><date>2025-10-01</date></DateMonth>
  <DateMonth><value>104.6</value><percent>0.2</percent><percentYear>2.0</percentYear><date>2025-09-01</date></DateMonth>
</NewDataSet>`

describe('parseXmlToJson (legacy regex parser)', () => {
  it('flattens repeated sibling tags last-wins', () => {
    const parsed = parseXmlToJson(
      '<DateMonth><value>1</value><value>2</value><percent>0.1</percent></DateMonth>',
    )
    // The regex captures the enclosing tag too — callers parse inner segments
    expect(parsed).toEqual({ DateMonth: { value: '2', percent: '0.1' } })
  })

  it('recurses into nested tags only when children exist', () => {
    const parsed = parseXmlToJson('<a><b>text</b></a>')
    expect(parsed).toEqual({ a: { b: 'text' } })
  })

  it('returns undefined for empty input', () => {
    expect(parseXmlToJson(undefined)).toBeUndefined()
    expect(parseXmlToJson('')).toBeUndefined()
  })
})

describe('getXmlValue', () => {
  it('returns the inner text of the LAST occurrence', () => {
    expect(getXmlValue('<name>a</name><x/><name>b</name>', 'name')).toBe('b')
  })
})

describe('adjustMinus (Hebrew percent-minus convention)', () => {
  it('moves a leading minus after the percent sign', () => {
    expect(adjustMinus('-0.4')).toBe('0.4%-')
    expect(adjustMinus('2.1')).toBe('2.1%')
    expect(adjustMinus('0.0')).toBe('0.0%')
  })
})

describe('extractCbsIndexPayload', () => {
  it('slices DateMonth entries [1]=current, [2]=previous', () => {
    const payload = extractCbsIndexPayload(CPI_XML)!
    expect(payload.currentMonth!.value).toBe(106.2)
    expect(payload.currentMonth!.percentYear).toBe(3.1)
    // 106.2 > 105.8 → up; YoY 3.1 > 2.9 → up
    expect(payload.monthDirection).toBe('up')
    expect(payload.yearDirection).toBe('up')
  })

  it('cleans the index name and derives order/query', () => {
    const payload = extractCbsIndexPayload(CPI_XML)!
    expect(payload.indexName).toBe('מדד המחירים לצרכן ')
    expect(payload.displayOrder).toBe('3')
    expect(payload.searchQuery).toBe('מדד+המחירים+לצרכן')
  })

  it('compares trends NUMERICALLY (deliberate fix of the legacy string-compare bug)', () => {
    // Legacy: "99.5" > "100.9" evaluated true (string compare) → wrong arrow.
    const xml = `
      <name>test</name>
      <DateMonth><value>99.5</value><percent>0.1</percent><percentYear>1.0</percentYear></DateMonth>
      <DateMonth><value>100.9</value><percent>0.2</percent><percentYear>1.5</percentYear></DateMonth>
      <DateMonth><value>100.0</value><percent>0.0</percent><percentYear>1.2</percentYear></DateMonth>
    `
    const payload = extractCbsIndexPayload(xml)!
    expect(payload.monthDirection).toBe('down') // numeric: 99.5 < 100.9
    expect(payload.yearDirection).toBe('down') // 1.0 < 1.5
  })

  it('maps construction-input indexes to display orders', () => {
    const residential = extractCbsIndexPayload(
      '<name>מחירי תשומה בבניין מגורים - כללי</name><DateMonth><value>1</value><percent>0</percent><percentYear>0</percentYear></DateMonth><DateMonth><value>1</value><percent>0</percent><percentYear>0</percentYear></DateMonth>',
    )!
    expect(residential.indexName).toContain('תשומה')
    expect(residential.displayOrder).toBe('2')

    const commercial = extractCbsIndexPayload(
      '<name>מחירי תשומה בבניין מסחר ומשרדים - כללי</name><DateMonth><value>1</value><percent>0</percent><percentYear>0</percentYear></DateMonth><DateMonth><value>1</value><percent>0</percent><percentYear>0</percentYear></DateMonth>',
    )!
    expect(commercial.displayOrder).toBe('1')
  })

  it('returns null without current-month data', () => {
    expect(extractCbsIndexPayload('<name>x</name>')).toBeNull()
  })
})
