'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { authClient } from '@/lib/auth-client'
import type { RefinanceSnapshot } from '@/features/refinance/snapshot'

/**
 * Client access to /api/refinances. Thin on purpose: the server owns
 * validation, authorization and the cap, so a UI bug can never become a data
 * bug. Errors carry the server's token ('cap', 'duplicate', ...) so callers can
 * show the right message without re-deriving it.
 */

export interface SavedRefinance {
  id: string
  label: string
  snapshot: RefinanceSnapshot
  createdAt: string
  updatedAt: string
}

export interface SavedRefinanceList {
  refinances: SavedRefinance[]
  max: number
}

export const REFINANCES_QUERY_KEY = ['refinances'] as const

async function errorToken(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as { error?: unknown } | null
  return typeof body?.error === 'string' ? body.error : 'unknown'
}

export async function fetchSavedRefinances(): Promise<SavedRefinanceList> {
  const response = await fetch('/api/refinances')
  if (!response.ok) throw new Error(await errorToken(response))
  return (await response.json()) as SavedRefinanceList
}

export function useSavedRefinances(enabled: boolean) {
  const { data: session } = authClient.useSession()
  return useQuery({
    queryKey: [...REFINANCES_QUERY_KEY, session?.user.id],
    queryFn: fetchSavedRefinances,
    enabled: enabled && Boolean(session),
    staleTime: 30_000,
  })
}

export interface SaveRefinancePayload {
  /** When set, the save updates that proposal in place instead of creating one. */
  id?: string
  label: string
  snapshot: RefinanceSnapshot
}

export function useSaveRefinance() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: SaveRefinancePayload): Promise<SavedRefinance> => {
      const { id, ...body } = payload
      const response = await fetch(
        id ? `/api/refinances/${encodeURIComponent(id)}` : '/api/refinances',
        {
          method: id ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      )
      if (!response.ok) throw new Error(await errorToken(response))
      const result = (await response.json()) as { refinance: SavedRefinance }
      return result.refinance
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: REFINANCES_QUERY_KEY })
    },
  })
}

/** Case-insensitive name check matching the server's rule. */
export function isRefinanceLabelTaken(
  refinances: SavedRefinance[],
  label: string,
  ignoreId?: string | null,
): boolean {
  const wanted = label.trim().toLocaleLowerCase()
  if (!wanted) return false
  return refinances.some(
    (proposal) =>
      proposal.id !== ignoreId && proposal.label.trim().toLocaleLowerCase() === wanted,
  )
}

export function useDeleteRefinance() {
  const queryClient = useQueryClient()
  const { data: session } = authClient.useSession()
  const queryKey = [...REFINANCES_QUERY_KEY, session?.user.id]
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const response = await fetch(`/api/refinances/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      })
      if (!response.ok) throw new Error(await errorToken(response))
    },
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<SavedRefinanceList>(queryKey)
      if (previous) {
        queryClient.setQueryData<SavedRefinanceList>(queryKey, {
          ...previous,
          refinances: previous.refinances.filter((proposal) => proposal.id !== id),
        })
      }
      return { previous }
    },
    onError: (_error, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous)
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey })
    },
  })
}
