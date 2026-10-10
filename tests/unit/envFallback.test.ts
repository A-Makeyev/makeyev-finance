import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * The env adapter maps NEXT_PUBLIC_* (the Next convention) and the clean bare
 * names (what deploy configs and .env carry) into the same validated shape the
 * app code reads. The module caches its result at import time, so each test
 * re-imports it with a fresh module registry and stubbed process.env.
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

const BOI = 'https://www.boi.org.il/PublicApi/GetInterest'
const CBS = 'https://api.cbs.gov.il/index/data/price'

afterEach(() => {
  vi.resetModules()
})

describe('env adapter', () => {
  it('prefers NEXT_PUBLIC_* values over the bare names', async () => {
    const env = await loadEnvWith({
      NEXT_PUBLIC_BOI_INTEREST_URL: 'https://next.example/boi',
      BOI_INTEREST_URL: 'https://bare.example/boi',
      NEXT_PUBLIC_CBS_API_BASE: 'https://next.example/cbs',
      CBS_API_BASE: 'https://bare.example/cbs',
    })
    expect(env.BOI_INTEREST_URL).toBe('https://next.example/boi')
    expect(env.CBS_API_BASE).toBe('https://next.example/cbs')
  })

  it('accepts the clean bare names the deploy configs use', async () => {
    const env = await loadEnvWith({
      NEXT_PUBLIC_BOI_INTEREST_URL: undefined,
      BOI_INTEREST_URL: 'https://bare.example/boi',
      NEXT_PUBLIC_CBS_API_BASE: undefined,
      CBS_API_BASE: 'https://bare.example/cbs',
    })
    expect(env.BOI_INTEREST_URL).toBe('https://bare.example/boi')
    expect(env.CBS_API_BASE).toBe('https://bare.example/cbs')
  })

  it('defaults both endpoints when env is missing', async () => {
    const env = await loadEnvWith({
      NEXT_PUBLIC_BOI_INTEREST_URL: undefined,
      BOI_INTEREST_URL: undefined,
      NEXT_PUBLIC_CBS_API_BASE: undefined,
      CBS_API_BASE: undefined,
    })
    expect(env.BOI_INTEREST_URL).toBe(BOI)
    expect(env.CBS_API_BASE).toBe(CBS)
  })

  it('ignores an explicitly empty value and falls through to the next name', async () => {
    const env = await loadEnvWith({
      NEXT_PUBLIC_BOI_INTEREST_URL: '',
      BOI_INTEREST_URL: 'https://bare.example/boi',
    })
    expect(env.BOI_INTEREST_URL).toBe('https://bare.example/boi')
  })

  it('degrades a malformed URL to the working default instead of passing it on', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const env = await loadEnvWith({ BOI_INTEREST_URL: 'not-a-url' })
    expect(env.BOI_INTEREST_URL).toBe(BOI)
    expect(env.CBS_API_BASE).toBe(CBS)
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})
