/**
 * Mail doctor: answers "why is nothing being sent?" without printing a secret.
 *
 * It checks the things that actually break delivery, in the order they break:
 *
 *  1. RESEND_API_KEY present? Without it `canSendMail()` is false by design and
 *     every sender skips (the log says `[mail] not configured`).
 *  2. Which sender resolves, and can Resend send from its DOMAIN? Resend
 *     refuses any domain that is not verified on the account, and a consumer
 *     domain (gmail.com, outlook.com, ...) can never be verified at all: every
 *     send from one comes back `validation_error` (HTTP 403). That is the
 *     failure that reads as "mail just stopped working", because it fails on
 *     every path at once (verification, password reset, deletion, contact).
 *  3. Is that domain verified on this account? (Resend's domains list. Needs a
 *     key with read access; a send-only key makes this step report "unknown".)
 *  4. Where do contact submissions go, and can this sender reach it? With the
 *     test sender `onboarding@resend.dev` Resend delivers ONLY to the Resend
 *     account owner's address, so CONTACT_TO_EMAIL has to name that address.
 *
 * Prints presence, domains and provider status only - never the API key, never
 * a full address, never a message body. Mirrors the rules in
 * src/server/mail/config.ts; keep the two in sync.
 *
 * Usage:
 *   npm run mail:doctor
 *   node --env-file=.env scripts/mail-doctor.mjs
 */
import { pathToFileURL } from 'node:url'

/** Domains no one but the provider itself can verify, so a sender there cannot work. */
export const CONSUMER_DOMAINS = new Set([
  'aol.com',
  'gmail.com',
  'gmx.com',
  'googlemail.com',
  'hotmail.com',
  'icloud.com',
  'live.com',
  'mail.ru',
  'me.com',
  'outlook.com',
  'proton.me',
  'protonmail.com',
  'walla.co.il',
  'yahoo.com',
  'yandex.ru',
])

/** Resend's own test sender domain. Sends fine, but only to the account owner. */
export const TEST_SENDER_DOMAIN = 'resend.dev'

/**
 * The domain of `Name <email>` or a bare `email`, lowercased.
 *
 * @param {string | undefined} value
 * @returns {string} the domain, or '' when there is no usable address
 */
export function domainOf(value) {
  if (!value?.trim()) return ''
  const match = value.match(/<\s*([^>]+?)\s*>/)
  const address = (match ? match[1] : value).trim()
  const at = address.lastIndexOf('@')
  return at === -1 ? '' : address.slice(at + 1).toLowerCase()
}

/**
 * What to make of the resolved sender. Pure, so the rule is unit-tested rather
 * than only exercised against a live account.
 *
 * @param {{
 *   fromDomain: string,
 *   verifiedDomains?: string[] | null,
 *   domainStatus?: string | null,
 * }} args `verifiedDomains` is null when the account could not be read at all;
 *   `domainStatus` is the provider's status for this domain when the account
 *   knows it (a domain can be on the account and still NOT verified, which is
 *   not the same thing).
 * @returns {{ level: 'ok' | 'warn' | 'error', text: string }}
 */
export function senderVerdict({ fromDomain, verifiedDomains = null, domainStatus = null }) {
  if (!fromDomain) {
    return { level: 'error', text: 'AUTH_EMAIL_FROM does not carry a usable address' }
  }
  if (fromDomain === TEST_SENDER_DOMAIN) {
    return {
      level: 'warn',
      text: 'test sender: deliveries go only to the Resend account owner',
    }
  }
  if (CONSUMER_DOMAINS.has(fromDomain)) {
    return {
      level: 'error',
      text: `${fromDomain} can never be verified by Resend, so every send is rejected (validation_error, HTTP 403). Use a domain you own, or unset AUTH_EMAIL_FROM to fall back to onboarding@resend.dev`,
    }
  }
  if (verifiedDomains === null) {
    return {
      level: 'warn',
      text: `could not check whether ${fromDomain} is verified (listing domains needs a key with read access)`,
    }
  }
  if (verifiedDomains.includes(fromDomain)) {
    return { level: 'ok', text: `${fromDomain} is verified` }
  }
  if (domainStatus) {
    // On the account but still missing DNS records: Resend rejects sends from
    // it, so "listed" must never read as "ready".
    return {
      level: 'error',
      text: `${fromDomain} is on the account but not verified (status: ${domainStatus}); finish it at https://resend.com/domains`,
    }
  }
  return {
    level: 'error',
    text: `${fromDomain} is not on this Resend account (add and verify it at https://resend.com/domains)`,
  }
}

/** @param {string | undefined} value */
function described(value) {
  const domain = domainOf(value)
  if (!value?.trim()) return 'not set'
  return `set (domain: ${domain || 'no @ in the value'})`
}

export async function main(argv = process.argv.slice(2), env = process.env) {
  const key = env.RESEND_API_KEY?.trim()
  const from = env.AUTH_EMAIL_FROM?.trim()
  const to = env.CONTACT_TO_EMAIL?.trim()

  console.log(`[mail-doctor] RESEND_API_KEY: ${key ? `set (${key.length} chars)` : 'ABSENT'}`)
  console.log(`[mail-doctor] AUTH_EMAIL_FROM: ${described(from)}`)
  console.log(`[mail-doctor] CONTACT_TO_EMAIL: ${described(to)}`)

  if (!key) {
    console.log(
      '[mail-doctor] mail is DISABLED: every sender skips and /api/contact answers 502. Set RESEND_API_KEY (https://resend.com/api-keys).',
    )
    return 1
  }

  // Step 3 needs a key with read access; a send-only key is the common case and
  // must not turn into a crash.
  /** @type {Map<string, string> | null} domain name -> provider status */
  let domains = null
  try {
    const { Resend } = await import('resend')
    const result = await new Resend(key).domains.list()
    if (result.error) {
      console.log(`[mail-doctor] domains on the account: unreadable (${result.error.name})`)
    } else {
      domains = new Map(
        (result.data?.data ?? []).map((domain) => [String(domain.name).toLowerCase(), String(domain.status)]),
      )
      console.log(
        `[mail-doctor] domains on the account: ${
          domains.size
            ? [...domains].map(([name, status]) => `${name} (${status})`).join(', ')
            : 'none'
        }`,
      )
    }
  } catch (error) {
    console.log(`[mail-doctor] domains on the account: unreadable (${error?.name ?? 'unknown'})`)
  }

  const verifiedDomains = domains
    ? [...domains].filter(([, status]) => status === 'verified').map(([name]) => name)
    : null
  const fromDomain = domainOf(from) || TEST_SENDER_DOMAIN
  const verdict = senderVerdict({
    fromDomain,
    verifiedDomains,
    domainStatus: domains?.get(fromDomain) ?? null,
  })
  console.log(
    `[mail-doctor] sender: ${from ? fromDomain : `${fromDomain} (default)`} - ${verdict.level.toUpperCase()}: ${verdict.text}`,
  )

  console.log(
    `[mail-doctor] contact submissions go to: ${
      to ? domainOf(to) || 'CONTACT_TO_EMAIL has no @ in it' : "the site's own inbox (default)"
    }`,
  )
  if (fromDomain === TEST_SENDER_DOMAIN) {
    console.log(
      "[mail-doctor]   reminder: the test sender delivers ONLY to the Resend account owner's address, so this reaches a real inbox only when it is that address.",
    )
  }

  return verdict.level === 'error' ? 1 : 0
}

// Only run when invoked directly, so the pure helpers stay importable.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main()
}
