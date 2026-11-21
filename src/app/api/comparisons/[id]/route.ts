import { NextResponse } from 'next/server'
import { getServerSession } from '@/server/auth/session'
import { consumeRateLimit } from '@/server/ratelimit'
import { deleteSavedComparison, updateSavedComparison } from '@/server/comparisons/repo'
import {
  COMPARISON_SAVE_RATE_LIMIT,
  savedComparisonInputSchema,
} from '@/server/comparisons/schema'

/**
 * PATCH  /api/comparisons/:id -> overwrites one of the CALLER'S OWN comparisons.
 * DELETE /api/comparisons/:id -> removes one of the CALLER'S OWN comparisons.
 *
 * Both are scoped by the session's user id. A malformed id and another user's
 * id answer the same 404, so ids cannot be probed. An update is still a save,
 * so it shares the save rate limit.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const NO_STORE = { 'Cache-Control': 'no-store' } as const

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession()
  if (!session) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401, headers: NO_STORE })
  }

  const allowed = await consumeRateLimit({
    bucket: 'comparisons',
    key: session.user.id,
    ...COMPARISON_SAVE_RATE_LIMIT,
  })
  if (!allowed) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: NO_STORE })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid' }, { status: 400, headers: NO_STORE })
  }

  const parsed = savedComparisonInputSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid' }, { status: 400, headers: NO_STORE })
  }

  const { id } = await params
  const result = await updateSavedComparison(session.user.id, id, parsed.data)
  if (!result.ok) {
    if (result.reason === 'duplicate') {
      return NextResponse.json({ error: 'duplicate' }, { status: 409, headers: NO_STORE })
    }
    return NextResponse.json({ error: 'not_found' }, { status: 404, headers: NO_STORE })
  }

  return NextResponse.json({ comparison: result.comparison }, { headers: NO_STORE })
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession()
  if (!session) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401, headers: NO_STORE })
  }

  const { id } = await params
  const deleted = await deleteSavedComparison(session.user.id, id)
  if (!deleted) {
    return NextResponse.json({ error: 'not_found' }, { status: 404, headers: NO_STORE })
  }

  return NextResponse.json({ ok: true }, { headers: NO_STORE })
}
