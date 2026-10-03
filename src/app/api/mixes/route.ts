import { NextResponse, type NextRequest } from 'next/server'
import { getServerSession } from '@/server/auth/session'
import { consumeRateLimit } from '@/server/ratelimit'
import { createSavedMix, listSavedMixes } from '@/server/mixes/repo'
import { MAX_SAVED_MIXES, MIX_SAVE_RATE_LIMIT, savedMixInputSchema } from '@/server/mixes/schema'

/**
 * Saved mortgage mixes.
 *
 * GET  /api/mixes -> the caller's own mixes (never another user's)
 * POST /api/mixes -> stores one for the caller
 *
 * Every handler re-derives the session server-side: the client never supplies
 * a user id, and a disabled button in the UI is not access control. The read
 * and write are scoped by the session's own id inside the repo.
 *
 * runtime = nodejs (Mongo driver) and force-dynamic (per-user data must never
 * be cached or prerendered for another visitor).
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const NO_STORE = { 'Cache-Control': 'no-store' } as const

function unauthenticated() {
  return NextResponse.json({ error: 'unauthenticated' }, { status: 401, headers: NO_STORE })
}

export async function GET() {
  const session = await getServerSession()
  if (!session) return unauthenticated()

  const mixes = await listSavedMixes(session.user.id)
  return NextResponse.json({ mixes, max: MAX_SAVED_MIXES }, { headers: NO_STORE })
}

export async function POST(request: NextRequest) {
  const session = await getServerSession()
  if (!session) return unauthenticated()

  // Better Auth's own rate limiter never sees this route (it only covers
  // /api/auth/*), so the endpoint brings its own budget.
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

  const result = await createSavedMix(session.user.id, parsed.data)
  if (!result.ok) {
    // Refused, not evicted: silently dropping a mix the user chose to keep is
    // worse than making them remove one. A duplicate name is refused for the
    // same reason a cap is: with four slots the name is the only handle a mix
    // has, so two identical ones are a mistake, not a feature.
    if (result.reason === 'duplicate') {
      return NextResponse.json({ error: 'duplicate' }, { status: 409, headers: NO_STORE })
    }
    return NextResponse.json(
      { error: 'cap', max: MAX_SAVED_MIXES },
      { status: 409, headers: NO_STORE },
    )
  }

  return NextResponse.json({ mix: result.mix }, { status: 201, headers: NO_STORE })
}
