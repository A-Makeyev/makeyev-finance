import { describe, expect, it } from 'vitest'
import {
  CONTACT_SUBJECT,
  buildContactEmail,
  isEmailLike,
  safeTelHref,
} from '@/server/mail/contact'

const BASE = {
  name: 'Dana Levi',
  phone: '050-1234567',
  email: 'dana@example.test',
  message: 'Hello\nWorld',
}

/** The label column of every table row, in document order. */
function labels(html: string): string[] {
  return [...html.matchAll(/<strong>([^<]+)<\/strong>/g)].map((match) => match[1])
}

describe('buildContactEmail', () => {
  it('uses the fixed legacy subject', () => {
    expect(buildContactEmail(BASE).subject).toBe(CONTACT_SUBJECT)
    expect(CONTACT_SUBJECT).toBe('New Client 🤑')
  })

  it('renders rows in the documented order', () => {
    const { html } = buildContactEmail({
      ...BASE,
      callback: 'Morning (08:00–12:00)',
      calculator: 'Mortgage: ₪1,000,000',
      topics: ['Topic A', 'Topic B'],
    })
    expect(labels(html)).toEqual([
      'Details',
      'Name',
      'Phone',
      'Email',
      'Message',
      'Preferred Time',
      'Calculator Details',
      'Discussion Topics',
      'Topic 1',
      'Topic 2',
    ])
  })

  it('omits every optional row when its value is absent', () => {
    const { html } = buildContactEmail({ ...BASE, topics: [] })
    expect(html).not.toContain('Preferred Time')
    expect(html).not.toContain('Calculator Details')
    expect(html).not.toContain('Discussion Topics')
    expect(labels(html)).toEqual(['Details', 'Name', 'Phone', 'Email', 'Message'])
  })

  it('omits topics that are blank, and drops the header when none are left', () => {
    const { html } = buildContactEmail({ ...BASE, topics: ['Real', '   '] })
    expect(labels(html)).toContain('Topic 1')
    expect(html).not.toContain('Topic 2')

    expect(buildContactEmail({ ...BASE, topics: ['   '] }).html).not.toContain('Discussion Topics')
  })

  it('escapes every dynamic value, so no tag or quote can break out', () => {
    const { html } = buildContactEmail({
      name: '<script>alert(1)</script>',
      phone: '"onmouseover="x',
      email: 'a&b',
      message: '<b>hi</b>',
    })
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).not.toContain('"onmouseover="')
    expect(html).toContain('a&amp;b')
    expect(html).toContain('&lt;b&gt;hi&lt;/b&gt;')
  })

  it('marks value cells dir="auto" so a Hebrew message renders right-to-left', () => {
    const { html } = buildContactEmail({ ...BASE, topics: ['שלום'] })
    // Name, Phone, Email, Message and the one topic cell.
    expect(html.match(/dir="auto"/g)?.length).toBeGreaterThanOrEqual(5)
  })

  it('carries the same content in the plain-text alternative', () => {
    const { text } = buildContactEmail({
      ...BASE,
      callback: 'Morning',
      calculator: 'Mortgage',
      topics: ['Topic A'],
    })
    expect(text).toContain('Name: Dana Levi')
    expect(text).toContain('Phone: 050-1234567')
    expect(text).toContain('Email: dana@example.test')
    expect(text).toContain('Hello\nWorld')
    expect(text).toContain('Preferred Time: Morning')
    expect(text).toContain('Calculator Details:')
    expect(text).toContain('Topic 1: Topic A')
  })
})

describe('safeTelHref', () => {
  it('keeps digits, + and spaces only', () => {
    expect(safeTelHref('050-1234567')).toBe('tel:0501234567')
    expect(safeTelHref('+972 (50) 1234567')).toBe('tel:+972 50 1234567')
  })

  it('refuses a value with nothing dialable', () => {
    expect(safeTelHref('not a number')).toBeNull()
  })

  it('cannot smuggle another scheme', () => {
    const href = safeTelHref('javascript:alert(1)')
    expect(href?.startsWith('tel:')).toBe(true)
    expect(href).not.toContain('javascript')
  })
})

describe('isEmailLike', () => {
  it('accepts a real address', () => {
    expect(isEmailLike('dana@example.test')).toBe(true)
  })

  it('rejects the localized "not provided" fallback and other plain text', () => {
    expect(isEmailLike('Was not included')).toBe(false)
    expect(isEmailLike('לא צויין')).toBe(false)
  })
})

describe('email cell treatment', () => {
  it('links a valid address with mailto', () => {
    expect(buildContactEmail(BASE).html).toContain('mailto:dana@example.test')
  })

  it('renders a non-address as plain text, not a link', () => {
    const { html } = buildContactEmail({ ...BASE, email: 'Was not included' })
    expect(html).not.toContain('mailto:')
    expect(html).toContain('Was not included')
  })
})
