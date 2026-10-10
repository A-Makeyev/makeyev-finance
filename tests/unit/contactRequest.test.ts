import { describe, expect, it } from 'vitest'
import {
  MAX_CONTACT_MESSAGE,
  MAX_CONTACT_TOPICS,
  clientIp,
  isHoneypotFilled,
  parseContactRequest,
} from '@/server/contact/request'

const VALID = {
  name: 'Dana Levi',
  phone: '050-1234567',
  email: 'dana@example.test',
  message: 'Hello',
}

describe('parseContactRequest', () => {
  it('accepts a minimal body and applies the defaults', () => {
    expect(parseContactRequest(VALID)).toEqual({ ...VALID, topics: [] })
  })

  it('accepts the optional fields when present', () => {
    const parsed = parseContactRequest({
      ...VALID,
      callback: 'Morning',
      calculator: 'Mortgage',
      topics: ['A', 'B'],
      website: '',
    })
    expect(parsed).toMatchObject({ callback: 'Morning', calculator: 'Mortgage', topics: ['A', 'B'] })
  })

  it('rejects a missing or blank name or phone', () => {
    expect(parseContactRequest({ ...VALID, name: '' })).toBeNull()
    expect(parseContactRequest({ ...VALID, name: '   ' })).toBeNull()
    expect(parseContactRequest({ ...VALID, phone: undefined })).toBeNull()
  })

  it('caps the message length', () => {
    expect(parseContactRequest({ ...VALID, message: 'x'.repeat(MAX_CONTACT_MESSAGE) })).not.toBeNull()
    expect(parseContactRequest({ ...VALID, message: 'x'.repeat(MAX_CONTACT_MESSAGE + 1) })).toBeNull()
  })

  it('caps the topic count at the calculator size', () => {
    const topics = (count: number) => Array.from({ length: count }, (_, i) => `Topic ${i}`)
    expect(parseContactRequest({ ...VALID, topics: topics(MAX_CONTACT_TOPICS) })).not.toBeNull()
    expect(parseContactRequest({ ...VALID, topics: topics(MAX_CONTACT_TOPICS + 1) })).toBeNull()
  })

  it('rejects unknown keys outright', () => {
    // A hostile body cannot smuggle extra fields into the mail.
    expect(parseContactRequest({ ...VALID, isAdmin: true })).toBeNull()
    expect(parseContactRequest({ ...VALID, role: 'admin' })).toBeNull()
  })

  it('rejects a non-object body', () => {
    expect(parseContactRequest(null)).toBeNull()
    expect(parseContactRequest('nope')).toBeNull()
    expect(parseContactRequest([])).toBeNull()
  })
})

describe('isHoneypotFilled', () => {
  it('is false when the honeypot is absent, empty or whitespace', () => {
    expect(isHoneypotFilled({ ...VALID, topics: [] })).toBe(false)
    expect(isHoneypotFilled({ ...VALID, topics: [], website: '' })).toBe(false)
    expect(isHoneypotFilled({ ...VALID, topics: [], website: '   ' })).toBe(false)
  })

  it('is true once anything is typed into it', () => {
    expect(isHoneypotFilled({ ...VALID, topics: [], website: 'http://spam.example' })).toBe(true)
  })
})

describe('clientIp', () => {
  it('takes the first address from x-forwarded-for', () => {
    expect(clientIp(new Headers({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' }))).toBe('203.0.113.7')
  })

  it('is a stable placeholder when the header is absent', () => {
    expect(clientIp(new Headers())).toBe('unknown')
  })
})
