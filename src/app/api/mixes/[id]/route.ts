import { NextResponse } from 'next/server'
import { getServerSession } from '@/server/auth/session'
import { consumeRateLimit } from '@/server/ratelimit'
import { deleteSavedMix, updateSavedMix } from '@/server/mixes/repo'
import { MIX_SAVE_RATE_LIMIT, savedMixInputSchema } from '@/server/mixes/schema'

/**
 * PATCH  /api/mixes/:id -> overwrites one of the CALLER'S OWN mixes.
 * DELETE /api/mixes/:id -> removes one of the CALLER'S OWN mixes.
 *
 * Both are scoped by the session's user id, so guessing or incrementing an id
 * can only ever miss - it cannot reach another user's mix. A malformed id and
 * someone else's id both answer the same 404, so the endpoint cannot be used
 * to probe which ids exist. An update is still a save, so it shares the save
 * rate limit; it deliberately ignores the per-user cap (no new slot).
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
    bucket: 'mixes',
    key: session.user.id,
    ...MIX_SAVE_RATE_LIMIT,
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

  const parsed = savedMixInputSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid' }, { status: 400, headers: NO_STORE })
  }

  const { id } = await params
  const result = await updateSavedMix(session.user.id, id, parsed.data)
  if (!result.ok) {
    // A rename onto another mix's name is refused the same way a create is;
    // the mix's own name never counts as a duplicate of itself.
    if (result.reason === 'duplicate') {
      return NextResponse.json({ error: 'duplicate' }, { status: 409, headers: NO_STORE })
    }
    return NextResponse.json({ error: 'not_found' }, { status: 404, headers: NO_STORE })
  }

  return NextResponse.json({ mix: result.mix }, { headers: NO_STORE })
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession()
  if (!session) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401, headers: NO_STORE })
  }

  const { id } = await params
  const deleted = await deleteSavedMix(session.user.id, id)
  if (!deleted) {
    return NextResponse.json({ error: 'not_found' }, { status: 404, headers: NO_STORE })
  }

  return NextResponse.json({ ok: true }, { headers: NO_STORE })
}
