'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ComparisonSnapshot } from '@/stores/comparisonStore'

/**
 * Client access to /api/comparisons. Thin on purpose: the server owns
 * validation, authorization and the cap, so a UI bug can never become a data
 * bug. Errors carry the server's token ('cap', 'duplicate', ...) so callers can
 * show the right message without re-deriving it.
 */

export interface SavedComparison {
  id: string
  label: string
  snapshot: ComparisonSnapshot
  createdAt: string
  updatedAt: string
}

export interface SavedComparisonList {
  comparisons: SavedComparison[]
  max: number
}

export const COMPARISONS_QUERY_KEY = ['comparisons'] as const

async function errorToken(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as { error?: unknown } | null
  return typeof body?.error === 'string' ? body.error : 'unknown'
}

export async function fetchSavedComparisons(): Promise<SavedComparisonList> {
  const response = await fetch('/api/comparisons')
  if (!response.ok) throw new Error(await errorToken(response))
  return (await response.json()) as SavedComparisonList
}

export function useSavedComparisons(enabled: boolean) {
  return useQuery({
    queryKey: COMPARISONS_QUERY_KEY,
    queryFn: fetchSavedComparisons,
    enabled,
    staleTime: 30_000,
  })
}

export interface SaveComparisonPayload {
  /** When set, the save updates that comparison in place instead of creating one. */
  id?: string
  label: string
  snapshot: ComparisonSnapshot
}

export function useSaveComparison() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: SaveComparisonPayload): Promise<SavedComparison> => {
      const { id, ...body } = payload
      const response = await fetch(
        id ? `/api/comparisons/${encodeURIComponent(id)}` : '/api/comparisons',
        {
          method: id ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      )
      if (!response.ok) throw new Error(await errorToken(response))
      const result = (await response.json()) as { comparison: SavedComparison }
      return result.comparison
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: COMPARISONS_QUERY_KEY })
    },
  })
}

/** Case-insensitive name check matching the server's rule. */
export function isComparisonLabelTaken(
  comparisons: SavedComparison[],
  label: string,
  ignoreId?: string | null,
): boolean {
  const wanted = label.trim().toLocaleLowerCase()
  if (!wanted) return false
  return comparisons.some(
    (comparison) =>
      comparison.id !== ignoreId &&
      comparison.label.trim().toLocaleLowerCase() === wanted,
  )
}

export function useDeleteComparison() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const response = await fetch(`/api/comparisons/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      })
      if (!response.ok) throw new Error(await errorToken(response))
    },
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: COMPARISONS_QUERY_KEY })
      const previous = queryClient.getQueryData<SavedComparisonList>(COMPARISONS_QUERY_KEY)
      if (previous) {
        queryClient.setQueryData<SavedComparisonList>(COMPARISONS_QUERY_KEY, {
          ...previous,
          comparisons: previous.comparisons.filter((comparison) => comparison.id !== id),
        })
      }
      return { previous }
    },
    onError: (_error, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(COMPARISONS_QUERY_KEY, context.previous)
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: COMPARISONS_QUERY_KEY })
    },
  })
}
