import { describe, expect, it, vi } from 'vitest'
import type { CreateEmailOptions, CreateEmailResponse } from 'resend'
import { MailSendError, createResendTransport, sendMail, type MailMessage } from '@/server/mail/client'
import { parseMailConfig } from '@/server/mail/config'

const MESSAGE: MailMessage = {
  to: 'to@example.test',
  subject: 'Hi',
  html: '<p>Hello</p>',
  text: 'Hello',
}

const CONFIG = parseMailConfig({
  RESEND_API_KEY: 're_key',
  AUTH_EMAIL_FROM: 'Makeyev Finance <from@example.test>',
})

function okResponse(): CreateEmailResponse {
  return { data: { id: 'email-id' }, error: null, headers: null }
}

/** Resend's own stable error-name type, which the module does not re-export. */
type ResendErrorName = NonNullable<CreateEmailResponse['error']>['name']

function errorResponse(name: ResendErrorName, statusCode: number | null): CreateEmailResponse {
  return { data: null, error: { name, message: 'boom', statusCode }, headers: null }
}

describe('createResendTransport', () => {
  it('sends the message with from/to/subject/html/text and no replyTo by default', async () => {
    const sent: CreateEmailOptions[] = []
    const transport = createResendTransport({
      config: CONFIG,
      sendEmail: async (payload) => {
        sent.push(payload)
        return okResponse()
      },
    })

    await transport.send(MESSAGE)

    expect(sent).toHaveLength(1)
    expect(sent[0]).toMatchObject({
      from: 'Makeyev Finance <from@example.test>',
      to: 'to@example.test',
      subject: 'Hi',
      html: '<p>Hello</p>',
      text: 'Hello',
    })
    expect((sent[0] as { replyTo?: string }).replyTo).toBeUndefined()
  })

  it('sets replyTo when the visitor address is valid', async () => {
    const sent: CreateEmailOptions[] = []
    const transport = createResendTransport({
      config: CONFIG,
      sendEmail: async (payload) => {
        sent.push(payload)
        return okResponse()
      },
    })

    await transport.send({ ...MESSAGE, replyTo: 'visitor@example.test' })

    expect((sent[0] as { replyTo?: string }).replyTo).toBe('visitor@example.test')
  })

  it('maps a provider rejection to Resend stable error name', async () => {
    const transport = createResendTransport({
      config: CONFIG,
      sendEmail: async () => errorResponse('validation_error', 403),
    })

    await expect(transport.send(MESSAGE)).rejects.toMatchObject({ code: 'validation_error' })
  })

  it('maps an unreachable provider to ECONNECTION', async () => {
    const transport = createResendTransport({
      config: CONFIG,
      sendEmail: async () => {
        throw new TypeError('fetch failed')
      },
    })

    await expect(transport.send(MESSAGE)).rejects.toMatchObject({ code: 'ECONNECTION' })
  })

  it('names the verified-domain requirement when a sender is rejected', async () => {
    const transport = createResendTransport({
      config: CONFIG,
      sendEmail: async () => errorResponse('validation_error', 403),
    })

    // The provider's own text is not repeated (it echoes the address), but the
    // fix is spelled out: this is the "mail silently stopped working" case.
    await expect(transport.send(MESSAGE)).rejects.toThrow(/resend\.com\/domains/)
  })

  it('adds no sender hint for an unrelated provider error', async () => {
    const transport = createResendTransport({
      config: CONFIG,
      sendEmail: async () => errorResponse('daily_quota_exceeded', 429),
    })

    await expect(transport.send(MESSAGE)).rejects.toThrow(/^Resend rejected the message \(HTTP 429\)\.$/)
  })

  it('refuses to send with nothing configured', async () => {
    const transport = createResendTransport({ config: parseMailConfig({}) })
    await expect(transport.send(MESSAGE)).rejects.toMatchObject({ code: 'ENOCONFIG' })
  })
})

describe('sendMail', () => {
  it('logs only the failure code, never the recipient or body', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const transport = {
      send: async () => {
        throw new MailSendError('invalid_api_key', 'Resend rejected the message (HTTP 401)')
      },
    }

    await expect(
      sendMail({ ...MESSAGE, to: 'secret-recipient@example.test', text: 'code 1234' }, transport),
    ).rejects.toThrow()

    const printed = error.mock.calls.flat().join(' ')
    expect(printed).toContain('invalid_api_key')
    expect(printed).not.toContain('secret-recipient')
    expect(printed).not.toContain('1234')
    error.mockRestore()
  })
})
