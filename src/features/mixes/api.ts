'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { SavedMixScenario, SavedTrackInput } from '@/stores/calculatorStore'

/**
 * Client access to /api/mixes. Thin on purpose: the server owns validation,
 * authorization and the cap, so a UI bug can never become a data bug.
 *
 * The mutation errors carry the server's error token ('cap', 'rate_limited',
 * ...) so callers can show the right message without re-deriving it.
 */

export interface SavedMix {
  id: string
  label: string
  tracks: SavedTrackInput[]
  termYears: number
  /** Null for a mix saved before the scenario was stored. */
  scenario: SavedMixScenario | null
  createdAt: string
  updatedAt: string
}

export interface SavedMixList {
  mixes: SavedMix[]
  max: number
}

export const MIXES_QUERY_KEY = ['mixes'] as const

async function errorToken(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as { error?: unknown } | null
  return typeof body?.error === 'string' ? body.error : 'unknown'
}

export async function fetchSavedMixes(): Promise<SavedMixList> {
  const response = await fetch('/api/mixes')
  if (!response.ok) throw new Error(await errorToken(response))
  return (await response.json()) as SavedMixList
}

export function useSavedMixes(enabled: boolean) {
  return useQuery({
    queryKey: MIXES_QUERY_KEY,
    queryFn: fetchSavedMixes,
    enabled,
    staleTime: 30_000,
  })
}

export interface SaveMixPayload {
  /** When set, the save updates that mix in place instead of creating a new one. */
  id?: string
  label: string
  tracks: SavedTrackInput[]
  termYears: number
  scenario: SavedMixScenario
}

/** Creates a new mix, or updates an existing one when the payload carries an id. */
export function useSaveMix() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: SaveMixPayload): Promise<SavedMix> => {
      const { id, ...body } = payload
      const response = await fetch(id ? `/api/mixes/${encodeURIComponent(id)}` : '/api/mixes', {
        method: id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!response.ok) throw new Error(await errorToken(response))
      const result = (await response.json()) as { mix: SavedMix }
      return result.mix
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: MIXES_QUERY_KEY })
    },
  })
}

/**
 * Whether `label` is already one of the caller's mix names, compared the way
 * the server compares them (trimmed, case-insensitive). `ignoreId` lets a
 * loaded mix keep its own name. This is only the inline hint: the server is
 * the real check, and its refusal is what a stale list cannot miss.
 */
export function isMixLabelTaken(
  mixes: SavedMix[],
  label: string,
  ignoreId?: string | null,
): boolean {
  const wanted = label.trim().toLocaleLowerCase()
  if (!wanted) return false
  return mixes.some(
    (mix) => mix.id !== ignoreId && mix.label.trim().toLocaleLowerCase() === wanted,
  )
}

export function useDeleteMix() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const response = await fetch(`/api/mixes/${encodeURIComponent(id)}`, { method: 'DELETE' })
      if (!response.ok) throw new Error(await errorToken(response))
    },
    // Optimistic: the card goes as soon as the delete is sent, so the list does
    // not sit there looking frozen while the round trip and the refetch finish.
    // A failure puts it back (onError) and the caller explains why.
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: MIXES_QUERY_KEY })
      const previous = queryClient.getQueryData<SavedMixList>(MIXES_QUERY_KEY)
      if (previous) {
        queryClient.setQueryData<SavedMixList>(MIXES_QUERY_KEY, {
          ...previous,
          mixes: previous.mixes.filter((mix) => mix.id !== id),
        })
      }
      return { previous }
    },
    onError: (_error, _id, context) => {
      if (context?.previous) queryClient.setQueryData(MIXES_QUERY_KEY, context.previous)
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: MIXES_QUERY_KEY })
    },
  })
}
