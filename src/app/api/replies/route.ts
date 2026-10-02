import { NextResponse } from 'next/server'
import { getServerSession } from '@/server/auth/session'
import { listRepliesToUser } from '@/server/comments/repo'

/**
 * GET /api/replies -> comments that replied to one of the caller's own.
 *
 * The recipient is the session's own user id, so this can only ever return the
 * caller's replies. In-app only for now: the profile page lists them, and there
 * is no unread state or email delivery yet.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession()
  if (!session) {
    return NextResponse.json(
      { error: 'unauthenticated' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  const replies = await listRepliesToUser(session.user.id)
  return NextResponse.json({ replies }, { headers: { 'Cache-Control': 'no-store' } })
}
