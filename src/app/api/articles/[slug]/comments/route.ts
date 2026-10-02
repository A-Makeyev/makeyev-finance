import { NextResponse, type NextRequest } from 'next/server'
import { isArticleSlug } from '@/lib/articles'
import { checkText } from '@/lib/moderation'
import { getServerSession } from '@/server/auth/session'
import { consumeRateLimit } from '@/server/ratelimit'
import { GUEST_VIEWER, commentViewer } from '@/server/comments/access'
import { createComment, listComments } from '@/server/comments/repo'
import { COMMENT_RATE_LIMIT, commentInputSchema } from '@/server/comments/schema'

/**
 * Comments on one article.
 *
 * GET  /api/articles/:slug/comments -> the thread (public: anyone may read)
 * POST /api/articles/:slug/comments -> adds a comment or a reply
 *
 * Reading is public; writing requires a session AND passes the moderation
 * check server-side before anything is stored. The filter never runs only in
 * the browser: a client-side check is a courtesy at best, and posting to this
 * endpoint directly skips it entirely.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const NO_STORE = { 'Cache-Control': 'no-store' } as const

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE })
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  if (!isArticleSlug(slug)) return json({ error: 'not_found' }, 404)

  const session = await getServerSession()
  const viewer = session
    ? commentViewer({ id: session.user.id, role: (session.user as { role?: unknown }).role })
    : GUEST_VIEWER

  const comments = await listComments(slug, viewer)
  return json({ comments })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  if (!isArticleSlug(slug)) return json({ error: 'not_found' }, 404)

  const session = await getServerSession()
  if (!session) return json({ error: 'unauthenticated' }, 401)

  const allowed = await consumeRateLimit({
    bucket: 'comments',
    key: session.user.id,
    ...COMMENT_RATE_LIMIT,
  })
  if (!allowed) return json({ error: 'rate_limited' }, 429)

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return json({ error: 'invalid' }, 400)
  }

  const parsed = commentInputSchema.safeParse(payload)
  if (!parsed.success) return json({ error: 'invalid' }, 400)

  // The gate. Rejected, not silently cleaned: replacing characters with
  // asterisks and posting anyway would hide from the author that their words
  // were changed. Only the matched entry ids are logged, never the text.
  const verdict = checkText(parsed.data.body)
  if (!verdict.ok) {
    console.warn(`[comments] blocked by moderation: ${verdict.matchedIds.join(',')}`)
    return json({ error: 'blocked', ids: verdict.matchedIds }, 422)
  }

  const viewer = commentViewer({
    id: session.user.id,
    role: (session.user as { role?: unknown }).role,
  })
  const result = await createComment(
    slug,
    viewer,
    { name: session.user.name ?? '', image: session.user.image ?? null },
    { body: parsed.data.body, parentId: parsed.data.parentId ?? null },
  )
  if (!result.ok) return json({ error: 'parent_not_found' }, 409)

  return json({ comment: result.comment }, 201)
}
