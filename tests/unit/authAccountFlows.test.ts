import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ObjectId } from 'mongodb'
import { MongoMemoryServer } from 'mongodb-memory-server'

/**
 * The real Better Auth instance against a real (ephemeral) Mongo, with Resend
 * stubbed so no real mail leaves the machine. Everything the flows depend on ~
 * the endpoint wiring, the token handling and the row cleanup ~ is the code
 * that runs in production, not a stand-in for it.
 *
 * Covers the two account flows on the profile page:
 *  - a Google-only account sets its first password, and can then sign in with
 *    email + password;
 *  - deleting an account sends a link, deletes NOTHING until that link is
 *    followed, and then removes the account and its private rows.
 */

let mongo: MongoMemoryServer
let sentMails: Array<{ to: string; subject: string; text: string }> = []

beforeAll(async () => {
  mongo = await MongoMemoryServer.create()
  process.env.MONGODB_URI = mongo.getUri('accountflows')
  process.env.BETTER_AUTH_SECRET = 'x'.repeat(40)
  process.env.BETTER_AUTH_URL = 'http://localhost:3000'
  process.env.AUTH_EMAIL_FROM = 'Makeyev Finance <onboarding@resend.dev>'
  process.env.RESEND_API_KEY = 'test-key'
  delete process.env.GOOGLE_CLIENT_ID
  delete process.env.GOOGLE_CLIENT_SECRET

  const realFetch = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (url.startsWith('https://api.resend.com')) {
      const body = JSON.parse(String(init?.body ?? '{}')) as { to: string; subject: string; text: string }
      sentMails.push(body)
      return new Response(JSON.stringify({ id: 'stub-mail' }), {
        headers: { 'content-type': 'application/json' },
      })
    }
    return realFetch(input as RequestInfo, init)
  }) as typeof fetch
})

afterAll(async () => {
  await mongo?.stop()
})

async function harness() {
  const { getAuth } = await import('@/server/auth/index')
  const { getDb } = await import('@/server/auth/mongo')
  return { auth: await getAuth(), db: await getDb() }
}

function cookieOf(headers: Headers): Headers {
  const setCookies =
    typeof headers.getSetCookie === 'function' ? headers.getSetCookie() : [headers.get('set-cookie') ?? '']
  const cookie = setCookies.map((value) => value.split(';')[0]).filter(Boolean).join('; ')
  return new Headers({ cookie })
}

/**
 * A signed-in user on a verified address. Verification is on here (a mailer is
 * configured, which is what the deletion link needs), so the address is marked
 * verified directly and then signed in with the password.
 */
async function signUp(
  auth: Awaited<ReturnType<typeof harness>>['auth'],
  db: Awaited<ReturnType<typeof harness>>['db'],
  email: string,
) {
  const created = (await auth.api.signUpEmail({
    body: { name: 'Flow User', email, password: 'password123' },
    returnHeaders: true as never,
  })) as unknown as { headers: Headers; response: { user: { id: string } } }
  const userId = created.response.user.id
  await db.collection('user').updateOne({ email }, { $set: { emailVerified: true } })

  const signedIn = (await auth.api.signInEmail({
    body: { email, password: 'password123' },
    returnHeaders: true as never,
  })) as unknown as { headers: Headers }
  return { headers: cookieOf(signedIn.headers), userId }
}

describe('set a first password (Google-only account)', () => {
  it('writes a credential account and then the password signs in', async () => {
    const { auth, db } = await harness()
    const { setAccountPasswordFor } = await import('@/server/auth/accountPassword')
    const email = 'google-only@example.test'
    const session = await signUp(auth, db, email)

    // Simulate the Google-created account: no credential row at all.
    const removed = await db
      .collection('account')
      .deleteMany({ userId: { $in: [session.userId, new ObjectId(session.userId)] } })
    expect(removed.deletedCount).toBe(1)

    await expect(setAccountPasswordFor(session.headers, 'short')).resolves.toEqual({
      ok: false,
      reason: 'too_short',
    })

    await expect(setAccountPasswordFor(session.headers, 'brand-new-pass')).resolves.toEqual({ ok: true })

    const accounts = await db
      .collection('account')
      .find({ userId: { $in: [session.userId, new ObjectId(session.userId)] } })
      .toArray()
    expect(accounts.map((account) => account.providerId)).toEqual(['credential'])

    const signIn = (await auth.api.signInEmail({
      body: { email, password: 'brand-new-pass' },
      returnHeaders: true as never,
    })) as unknown as { response: { user?: { email?: string }; token?: string | null } }
    expect(signIn.response.user?.email).toBe(email)
    expect(signIn.response.token).toBeTruthy()

    // A second set is refused: it is a change now.
    await expect(setAccountPasswordFor(session.headers, 'another-pass')).resolves.toEqual({
      ok: false,
      reason: 'has_password',
    })

    // No session, no password.
    await expect(setAccountPasswordFor(new Headers(), 'brand-new-pass')).resolves.toEqual({
      ok: false,
      reason: 'unauthenticated',
    })
  })
})

/** The token the mailed link carries. Never logged by the app; only read here. */
function tokenFrom(mail: { text: string }): string {
  const token = mail.text.match(/[?&]delete=([^\s&]+)/)?.[1]
  expect(token, mail.text).toBeTruthy()
  return token!
}

describe('deleting an account, step by step', () => {
  it('refuses a wrong password without mailing anything, then mails the link for the right one', async () => {
    const { auth, db } = await harness()
    const email = 'delete-wrong-password@example.test'
    const session = await signUp(auth, db, email)

    sentMails = []
    await expect(
      auth.api.deleteUser({ body: { password: 'not-the-password' }, headers: session.headers }),
    ).rejects.toThrow(/password/i)

    // A refused attempt sends nothing and deletes nothing.
    expect(sentMails).toHaveLength(0)
    expect(await db.collection('user').countDocuments({ email })).toBe(1)

    await auth.api.deleteUser({ body: { password: 'password123' }, headers: session.headers })

    expect(sentMails).toHaveLength(1)
    expect(sentMails[0].to).toBe(email)
    // Asking for the deletion still deletes nothing: only the link does.
    expect(await db.collection('user').countDocuments({ email })).toBe(1)

    // The link lands on the profile page of the mail's own language, not on
    // Better Auth's callback endpoint (which would delete on GET).
    const link = sentMails[0].text.match(/https?:\/\/\S+/)?.[0]
    expect(link).toBe('http://localhost:3000/profile?delete=' + tokenFrom(sentMails[0]))
  })

  it('deletes only for the session that asked, and only once', async () => {
    const { auth, db } = await harness()
    const email = 'delete-by-link@example.test'
    const session = await signUp(auth, db, email)
    await db.collection('saved_mixes').insertOne({
      userId: session.userId,
      label: 'mine',
      tracks: [],
      termYears: 30,
      scenario: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    sentMails = []
    await auth.api.deleteUser({ body: { password: 'password123' }, headers: session.headers })
    const token = tokenFrom(sentMails[0])

    // The legacy callback endpoint (an old mail) opened signed out still sends
    // the visitor to the sign-in page instead of a raw JSON 404, and consumes
    // nothing while it does.
    const signedOut = await auth.handler(
      new Request(`http://localhost:3000/api/auth/delete-user/callback?token=${token}`, {
        headers: { host: 'localhost:3000', origin: 'http://localhost:3000' },
      }),
    )
    expect(signedOut.status).toBe(302)
    expect(signedOut.headers.get('location')).toContain('error=delete_sign_in_required')
    expect(await db.collection('user').countDocuments({ email })).toBe(1)

    // Another signed-in account cannot spend it. The token is Better Auth's and
    // is checked against the session's own user id, so this is refused ~ and,
    // being single-use, it is spent even by a failed attempt.
    const other = await signUp(auth, db, 'someone-else@example.test')
    await expect(
      auth.api.deleteUser({ body: { token }, headers: other.headers }),
    ).rejects.toThrow(/token/i)
    expect(await db.collection('user').countDocuments({ email })).toBe(1)

    // A fresh link, spent by the session that asked for it, is what finishes it:
    // the account, its account rows and the app's own rows of private data.
    sentMails = []
    await auth.api.deleteUser({ body: { password: 'password123' }, headers: session.headers })
    const fresh = tokenFrom(sentMails[0])
    await auth.api.deleteUser({ body: { token: fresh }, headers: session.headers })

    expect(await db.collection('user').countDocuments({ email })).toBe(0)
    expect(
      await db
        .collection('account')
        .countDocuments({ userId: { $in: [session.userId, new ObjectId(session.userId)] } }),
    ).toBe(0)
    expect(await db.collection('saved_mixes').countDocuments({ userId: session.userId })).toBe(0)
  })
})

describe('what a deleted account leaves in the comment threads', () => {
  it('keeps the old comments marked as deleted, and hands a re-signed-up address none of them', async () => {
    const { auth, db } = await harness()
    const email = 'came-back@example.test'
    const first = await signUp(auth, db, email)

    // One comment by that account, and one reply TO it, so both the thread's
    // "deleted account" marker and the profile's reply list have something to
    // resolve.
    await db.collection('article_comments').insertOne({
      articleSlug: 'some-article',
      userId: first.userId,
      userName: 'Flow User',
      userImage: null,
      parentId: null,
      parentUserId: null,
      body: 'first',
      createdAt: new Date(),
      editedAt: null,
      deletedAt: null,
    })
    await db.collection('article_comments').insertOne({
      articleSlug: 'some-article',
      userId: 'someone-else',
      userName: 'Other',
      userImage: null,
      parentId: null,
      parentUserId: first.userId,
      body: 'a reply to you',
      createdAt: new Date(),
      editedAt: null,
      deletedAt: null,
    })

    sentMails = []
    await auth.api.deleteUser({ body: { password: 'password123' }, headers: first.headers })
    await auth.api.deleteUser({
      body: { token: tokenFrom(sentMails[0]) },
      headers: first.headers,
    })
    expect(await db.collection('user').countDocuments({ email })).toBe(0)

    // The same address can sign up again, and gets a NEW user row with a new id.
    const again = await signUp(auth, db, email)
    expect(again.userId).not.toBe(first.userId)

    // The thread's marker is resolved by user id, so the old comment stays
    // marked: the person who wrote it no longer has an account, even though
    // somebody with that address does.
    const { missingAuthorIds } = await import('@/server/comments/repo')
    const ids = (await db.collection('user').find({}).toArray()).map((row) => row._id)
    expect([...missingAuthorIds([first.userId], ids)]).toEqual([first.userId])
    expect([...missingAuthorIds([again.userId], ids)]).toEqual([])

    // "Replies to you" is scoped by user id too, so the new account inherits
    // none of the old replies: it only ever sees replies to what IT posted.
    expect(
      await db.collection('article_comments').countDocuments({ parentUserId: again.userId }),
    ).toBe(0)
    expect(
      await db.collection('article_comments').countDocuments({ parentUserId: first.userId }),
    ).toBe(1)
  })
})
