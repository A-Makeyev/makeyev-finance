import { NextResponse, type NextRequest } from 'next/server'
import { checkText } from '@/lib/moderation'
import { getServerSession } from '@/server/auth/session'
import { commentViewer } from '@/server/comments/access'
import { editComment, softDeleteComment } from '@/server/comments/repo'
import { commentEditSchema } from '@/server/comments/schema'

/**
 * PATCH  /api/comments/:id -> edits the CALLER'S OWN comment (re-moderated)
 * DELETE /api/comments/:id -> soft-deletes it (own, or any as an admin)
 *
 * Ownership is decided in the repo from the session's user id, never from the
 * request. A malformed id, someone else's comment and an already-deleted one
 * all answer the same 404, so the endpoint cannot be used to probe.
 *
 * Deleting is a soft delete: the body is cleared and the row keeps its place so
 * replies under it survive, showing as a removed comment rather than
 * disappearing with everyone else's words.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const NO_STORE = { 'Cache-Control': 'no-store' } as const

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession()
  if (!session) return json({ error: 'unauthenticated' }, 401)

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return json({ error: 'invalid' }, 400)
  }

  const parsed = commentEditSchema.safeParse(payload)
  if (!parsed.success) return json({ error: 'invalid' }, 400)

  // An edit is new text and is moderated exactly like a new comment: otherwise
  // the filter is one PATCH away from being bypassed.
  const verdict = checkText(parsed.data.body)
  if (!verdict.ok) {
    console.warn(`[comments] blocked an edit by moderation: ${verdict.matchedIds.join(',')}`)
    return json({ error: 'blocked', ids: verdict.matchedIds }, 422)
  }

  const { id } = await params
  const updated = await editComment(id, session.user.id, parsed.data.body)
  if (!updated) return json({ error: 'not_found' }, 404)

  return json({ ok: true })
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession()
  if (!session) return json({ error: 'unauthenticated' }, 401)

  const viewer = commentViewer({
    id: session.user.id,
    role: (session.user as { role?: unknown }).role,
  })

  const { id } = await params
  const deleted = await softDeleteComment(id, viewer)
  if (!deleted) return json({ error: 'not_found' }, 404)

  return json({ ok: true })
}
