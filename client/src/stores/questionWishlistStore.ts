import { create } from 'zustand'

/**
 * One topic saved from an explanation dialog - a compact record (header +
 * plain-language summary), not the full modal body, so the list stays
 * skimmable and the eventual email short.
 */
export interface QuestionWishlistItem {
  /** Stable topic id - the results-card key (e.g. 'firstPayment'). */
  id: string
  /** Localized topic header, snapshot at save time. */
  title: string
  /** Localized plain-language explanation, snapshot at save time. */
  summary: string
}

/** Last add/remove, so a global toast can confirm the action. */
export type WishlistAction = { kind: 'added' | 'removed'; title: string }

const STORAGE_KEY = 'mortgage_question_wishlist'

/** Soft cap - one per results card (15 cards), so the email list can't grow unbounded. */
export const WISHLIST_MAX_ITEMS = 15

function readStoredItems(): QuestionWishlistItem[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (entry): entry is QuestionWishlistItem =>
        entry !== null &&
        typeof entry === 'object' &&
        typeof (entry as QuestionWishlistItem).id === 'string' &&
        typeof (entry as QuestionWishlistItem).title === 'string' &&
        typeof (entry as QuestionWishlistItem).summary === 'string',
    )
  } catch {
    return []
  }
}

function persist(items: QuestionWishlistItem[]): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch {
    // Full/quota storage - the in-memory list still works for the session.
  }
}

interface QuestionWishlistState {
  items: QuestionWishlistItem[]
  lastAction: WishlistAction | null
  add(item: QuestionWishlistItem): void
  remove(id: string): void
  clear(): void
}

export const useQuestionWishlist = create<QuestionWishlistState>((set, get) => ({
  items: readStoredItems(),
  lastAction: null,
  add: (item) => {
    const { items } = get()
    if (items.some((existing) => existing.id === item.id)) return
    const next = [...items, item].slice(-WISHLIST_MAX_ITEMS)
    set({ items: next, lastAction: { kind: 'added', title: item.title } })
    persist(next)
  },
  remove: (id) => {
    const { items } = get()
    const target = items.find((existing) => existing.id === id)
    const next = items.filter((existing) => existing.id !== id)
    if (next.length === items.length) return
    set({ items: next, lastAction: { kind: 'removed', title: target?.title ?? '' } })
    persist(next)
  },
  clear: () => {
    set({ items: [], lastAction: null })
    persist([])
  },
}))
