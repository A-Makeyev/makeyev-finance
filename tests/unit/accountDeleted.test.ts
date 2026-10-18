import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { announceAccountDeleted, onAccountDeleted } from '@/lib/accountDeleted'

/**
 * The module is browser-only, so `window` is stubbed here: this tests the two
 * rules that matter (the guard on the event, and that a storage failure is
 * swallowed) without a browser.
 */
type StorageListener = (event: StorageEvent) => void

const globalWithWindow = globalThis as unknown as { window?: unknown }

let store: Map<string, string>
let listeners: Map<string, StorageListener>
let removedType: string | null

function fakeWindow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    localStorage: {
      setItem: (key: string, value: string) => {
        store.set(key, value)
      },
    },
    addEventListener: (type: string, listener: StorageListener) => {
      listeners.set(type, listener)
    },
    removeEventListener: (type: string) => {
      removedType = type
    },
    ...overrides,
  }
}

const storageEvent = (key: string, newValue: string | null) =>
  ({ key, newValue }) as StorageEvent

beforeEach(() => {
  store = new Map()
  listeners = new Map()
  removedType = null
  globalWithWindow.window = fakeWindow()
})

afterEach(() => {
  delete globalWithWindow.window
})

describe('announceAccountDeleted', () => {
  it('writes a non-empty timestamp the other tabs can react to', () => {
    announceAccountDeleted()
    expect(store.get('account_deleted_at')).toBeTruthy()
  })

  it('swallows a storage failure instead of breaking the delete flow', () => {
    // Private mode / denied storage: the deletion itself already succeeded, so
    // this must never throw back into the confirm handler.
    globalWithWindow.window = fakeWindow({
      localStorage: {
        setItem: () => {
          throw new Error('denied')
        },
      },
    })
    expect(() => announceAccountDeleted()).not.toThrow()
  })
})

describe('onAccountDeleted', () => {
  it('fires only for a deletion announced by another tab', () => {
    const handler = vi.fn()
    onAccountDeleted(handler)
    const listener = listeners.get('storage')
    expect(listener).toBeDefined()

    listener!(storageEvent('some_other_key', '1'))
    expect(handler).not.toHaveBeenCalled()

    // A cleared key (newValue null) is not an announcement.
    listener!(storageEvent('account_deleted_at', null))
    expect(handler).not.toHaveBeenCalled()

    listener!(storageEvent('account_deleted_at', '1730000000000'))
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('unsubscribes the storage listener', () => {
    const off = onAccountDeleted(vi.fn())
    off()
    expect(removedType).toBe('storage')
  })
})
