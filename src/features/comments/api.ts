'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CommentDto, ReplyDto } from './types'

/**
 * Client access to the comment endpoints. The server owns authorization and
 * moderation; these hooks only carry the request and surface the server's
 * error token ('blocked', 'rate_limited', ...) so the UI can explain it.
 */

export const commentsKey = (slug: string) => ['comments', slug] as const
export const repliesKey = ['replies'] as const

async function errorToken(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as { error?: unknown } | null
  return typeof body?.error === 'string' ? body.error : 'unknown'
}

export function useComments(slug: string) {
  return useQuery({
    queryKey: commentsKey(slug),
    queryFn: async (): Promise<CommentDto[]> => {
      const response = await fetch(`/api/articles/${encodeURIComponent(slug)}/comments`)
      if (!response.ok) throw new Error(await errorToken(response))
      const body = (await response.json()) as { comments: CommentDto[] }
      return body.comments
    },
    staleTime: 15_000,
  })
}

export interface PostCommentPayload {
  body: string
  parentId?: string | null
}

export function usePostComment(slug: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: PostCommentPayload): Promise<void> => {
      const response = await fetch(`/api/articles/${encodeURIComponent(slug)}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!response.ok) throw new Error(await errorToken(response))
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: commentsKey(slug) })
    },
  })
}

export function useEditComment(slug: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { id: string; body: string }): Promise<void> => {
      const response = await fetch(`/api/comments/${encodeURIComponent(payload.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: payload.body }),
      })
      if (!response.ok) throw new Error(await errorToken(response))
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: commentsKey(slug) })
    },
  })
}

export function useDeleteComment(slug: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const response = await fetch(`/api/comments/${encodeURIComponent(id)}`, { method: 'DELETE' })
      if (!response.ok) throw new Error(await errorToken(response))
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: commentsKey(slug) })
    },
  })
}

export function useReplies(enabled: boolean) {
  return useQuery({
    queryKey: repliesKey,
    enabled,
    queryFn: async (): Promise<ReplyDto[]> => {
      const response = await fetch('/api/replies')
      if (!response.ok) throw new Error(await errorToken(response))
      const body = (await response.json()) as { replies: ReplyDto[] }
      return body.replies
    },
    staleTime: 30_000,
  })
}
