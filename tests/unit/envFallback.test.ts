import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * The env adapter maps NEXT_PUBLIC_* (the Next convention) and the clean bare
 * names (what deploy configs and .env carry) into the same validated shape
 * the app code reads. The module caches its result at import time, so each
 * test re-imports it with a fresh module registry and stubbed process.env.
 */
async function loadEnvWith(envValues: Record<string, string | undefined>) {
  vi.resetModules()
  const original = { ...process.env }
  for (const key of Object.keys(envValues)) {
    if (envValues[key] === undefined) delete process.env[key]
    else process.env[key] = envValues[key]
  }
  try {
    const module = await import('@/config/env')
    return module.env
  } finally {
    process.env = original
  }
}

afterEach(() => {
  vi.resetModules()
})

describe('env adapter', () => {
  it('prefers NEXT_PUBLIC_* values over the bare names', async () => {
    const env = await loadEnvWith({
      NEXT_PUBLIC_EMAILJS_SERVICE_ID: 'svc_next',
      EMAILJS_SERVICE_ID: 'svc_bare',
      NEXT_PUBLIC_EMAILJS_TEMPLATE_ID: 'tpl_next',
      NEXT_PUBLIC_EMAILJS_PUBLIC_KEY: 'key_next',
    })
    expect(env.EMAILJS_SERVICE_ID).toBe('svc_next')
    expect(env.EMAILJS_TEMPLATE_ID).toBe('tpl_next')
    expect(env.EMAILJS_PUBLIC_KEY).toBe('key_next')
  })

  it('accepts the clean bare names the deploy configs use', async () => {
    const env = await loadEnvWith({
      EMAILJS_SERVICE_ID: 'svc_bare',
      EMAILJS_TEMPLATE_ID: 'tpl_bare',
      EMAILJS_PUBLIC_KEY: 'key_bare',
    })
    expect(env.EMAILJS_SERVICE_ID).toBe('svc_bare')
    expect(env.EMAILJS_TEMPLATE_ID).toBe('tpl_bare')
    expect(env.EMAILJS_PUBLIC_KEY).toBe('key_bare')
  })

  it('falls back to the legacy inline credentials when env is missing', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    // Cleared explicitly: the app lives at the repo root now, so a developer's
    // .env (loaded by Next) may otherwise satisfy the schema and skip the
    // fallback path this test is about.
    const env = await loadEnvWith({
      NEXT_PUBLIC_EMAILJS_SERVICE_ID: undefined,
      EMAILJS_SERVICE_ID: undefined,
      NEXT_PUBLIC_EMAILJS_TEMPLATE_ID: undefined,
      EMAILJS_TEMPLATE_ID: undefined,
      NEXT_PUBLIC_EMAILJS_PUBLIC_KEY: undefined,
      EMAILJS_PUBLIC_KEY: undefined,
    })
    // Public by design (legacy index.html shipped them inline); a missing
    // env must degrade to a working send pipeline, never a disabled one.
    expect(env.EMAILJS_SERVICE_ID).toBe('service_k2c0eve')
    expect(env.EMAILJS_TEMPLATE_ID).toBe('template_kmxsnuc')
    expect(env.EMAILJS_PUBLIC_KEY).toBe('2y064p5z9qRvVxOHN')
    expect(env.BOI_INTEREST_URL).toBe('https://www.boi.org.il/PublicApi/GetInterest')
    expect(env.CBS_API_BASE).toBe('https://api.cbs.gov.il/index/data/price')
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('defaults the BOI/CBS endpoints when only the EmailJS keys are set', async () => {
    const env = await loadEnvWith({
      EMAILJS_SERVICE_ID: 'svc',
      EMAILJS_TEMPLATE_ID: 'tpl',
      EMAILJS_PUBLIC_KEY: 'key',
    })
    expect(env.BOI_INTEREST_URL).toBe('https://www.boi.org.il/PublicApi/GetInterest')
    expect(env.CBS_API_BASE).toBe('https://api.cbs.gov.il/index/data/price')
  })

  it('ignores an explicitly empty value and falls through to the next name', async () => {
    const env = await loadEnvWith({
      NEXT_PUBLIC_EMAILJS_SERVICE_ID: '',
      EMAILJS_SERVICE_ID: 'svc_bare',
      NEXT_PUBLIC_EMAILJS_TEMPLATE_ID: 'tpl',
      NEXT_PUBLIC_EMAILJS_PUBLIC_KEY: 'key',
    })
    expect(env.EMAILJS_SERVICE_ID).toBe('svc_bare')
  })
})
