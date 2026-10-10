import { beforeEach, describe, expect, it, vi } from 'vitest'

const { consumeRateLimit, sendMail } = vi.hoisted(() => ({
  consumeRateLimit: vi.fn(),
  sendMail: vi.fn(),
}))

vi.mock('@/server/ratelimit', () => ({ consumeRateLimit }))
vi.mock('@/server/mail/client', () => ({ sendMail }))

import { POST } from '@/app/api/contact/route'
import { DEFAULT_CONTACT_TO_EMAIL } from '@/server/mail/config'
import { CONTACT_SUBJECT } from '@/server/mail/contact'

const VALID = { name: 'Dana Levi', phone: '0501234567', email: 'dana@example.test', message: 'hi' }

function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request('http://localhost/api/contact', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': '203.0.113.7',
      ...headers,
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  consumeRateLimit.mockResolvedValue(true)
  sendMail.mockResolvedValue(undefined)
  process.env.RESEND_API_KEY = 're_test'
  process.env.AUTH_EMAIL_FROM = 'Makeyev Finance <from@example.test>'
  process.env.CONTACT_TO_EMAIL = 'inbox@example.test'
})

describe('POST /api/contact', () => {
  it('sends a valid submission and answers 200', async () => {
    const response = await POST(request(VALID))

    expect(response.status).toBe(200)
    expect(sendMail).toHaveBeenCalledTimes(1)
    expect(sendMail.mock.calls[0][0]).toMatchObject({
      to: 'inbox@example.test',
      replyTo: 'dana@example.test',
      subject: CONTACT_SUBJECT,
    })
    // The limiter keyed on the client IP.
    expect(consumeRateLimit.mock.calls[0][0]).toMatchObject({ bucket: 'contact', key: '203.0.113.7' })
  })

  it('omits reply_to when the visitor email is the localized fallback', async () => {
    await POST(request({ ...VALID, email: 'Was not included' }))
    expect(sendMail.mock.calls[0][0].replyTo).toBeUndefined()
  })

  it('rejects an invalid body with 400 and sends nothing', async () => {
    const response = await POST(request({ ...VALID, name: '' }))
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ ok: false, error: 'invalid' })
    expect(sendMail).not.toHaveBeenCalled()
  })

  it('rejects malformed JSON with 400', async () => {
    const response = await POST(request('{not json'))
    expect(response.status).toBe(400)
    expect(sendMail).not.toHaveBeenCalled()
  })

  it('answers a honeypot hit with a silent success and sends nothing', async () => {
    const response = await POST(request({ ...VALID, website: 'http://spam.example' }))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
    expect(sendMail).not.toHaveBeenCalled()
  })

  it('answers 429 with a generic code when the rate limit is exceeded', async () => {
    consumeRateLimit.mockResolvedValue(false)
    const response = await POST(request(VALID))
    expect(response.status).toBe(429)
    expect(await response.json()).toEqual({ ok: false, error: 'rate_limited' })
    expect(sendMail).not.toHaveBeenCalled()
  })

  it('answers 502 with a generic code when the send fails, never the provider text', async () => {
    sendMail.mockRejectedValue(new Error('validation_error Resend rejected the message'))
    const response = await POST(request(VALID))
    expect(response.status).toBe(502)
    const body = await response.text()
    expect(JSON.parse(body)).toEqual({ ok: false, error: 'send_failed' })
    expect(body).not.toContain('Resend')
    expect(body).not.toContain('validation_error')
  })

  it('answers 502 when mail is not configured at all', async () => {
    delete process.env.RESEND_API_KEY
    delete process.env.AUTH_EMAIL_FROM
    const response = await POST(request(VALID))
    expect(response.status).toBe(502)
    expect(await response.json()).toEqual({ ok: false, error: 'unavailable' })
    expect(sendMail).not.toHaveBeenCalled()
  })

  it('still sends with only an API key set, from the test sender to the site inbox', async () => {
    delete process.env.AUTH_EMAIL_FROM
    delete process.env.CONTACT_TO_EMAIL
    const response = await POST(request(VALID))
    expect(response.status).toBe(200)
    // The recipient default is what makes a key-only setup work at all: the
    // test sender can only deliver to the account owner's address.
    expect(sendMail.mock.calls[0][0]).toMatchObject({ to: DEFAULT_CONTACT_TO_EMAIL })
  })
})
