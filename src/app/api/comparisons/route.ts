import { NextResponse, type NextRequest } from 'next/server'
import { getServerSession } from '@/server/auth/session'
import { consumeRateLimit } from '@/server/ratelimit'
import { createSavedComparison, listSavedComparisons } from '@/server/comparisons/repo'
import {
  COMPARISON_SAVE_RATE_LIMIT,
  MAX_SAVED_COMPARISONS,
  savedComparisonInputSchema,
} from '@/server/comparisons/schema'

/**
 * Saved comparisons.
 *
 * GET  /api/comparisons -> the caller's own saved comparisons
 * POST /api/comparisons -> stores one versioned input snapshot for the caller
 *
 * The session is re-derived server-side on every request; the client never
 * supplies a user id, and the repo scopes both reads and writes by the session
 * id. Per-user data is never cached.
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

  const comparisons = await listSavedComparisons(session.user.id)
  return NextResponse.json(
    { comparisons, max: MAX_SAVED_COMPARISONS },
    { headers: NO_STORE },
  )
}

export async function POST(request: NextRequest) {
  const session = await getServerSession()
  if (!session) return unauthenticated()

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

  const result = await createSavedComparison(session.user.id, parsed.data)
  if (!result.ok) {
    if (result.reason === 'duplicate') {
      return NextResponse.json({ error: 'duplicate' }, { status: 409, headers: NO_STORE })
    }
    return NextResponse.json(
      { error: 'cap', max: MAX_SAVED_COMPARISONS },
      { status: 409, headers: NO_STORE },
    )
  }

  return NextResponse.json({ comparison: result.comparison }, { status: 201, headers: NO_STORE })
}
