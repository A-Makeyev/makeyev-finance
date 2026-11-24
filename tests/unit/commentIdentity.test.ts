import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { MongoClient, ObjectId, type Db } from 'mongodb'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { emailLinkHash, normalizeEmail } from '@/server/comments/identity'

const database = vi.hoisted(() => ({ db: null as Db | null }))
vi.mock('@/server/auth/mongo', () => ({ getDb: async () => database.db! }))

import { linkCommentsToAccount } from '@/server/comments/repo'

const SECRET = 'test-comments-email-link-secret-32chars'
const EMAIL = 'anatoly.makeyev@gmail.com'
// Real ObjectId-shaped ids, because the user collection keys on ObjectId while
// comments store the session's string form of it.
const OLD_ID = '6ac8bb8d563daa900309be01'
const NEW_ID = '6ac8bb8d563daa900309be02'

let mongo: MongoMemoryServer
let client: MongoClient

beforeAll(async () => {
  mongo = await MongoMemoryServer.create()
  client = new MongoClient(mongo.getUri())
  await client.connect()
  database.db = client.db('comments-identity-test')
})

afterAll(async () => {
  await client?.close()
  await mongo?.stop()
})

afterEach(async () => {
  await database.db!.collection('article_comments').deleteMany({})
  await database.db!.collection('user').deleteMany({})
  vi.unstubAllEnvs()
})

/**
 * The address link is what survives account deletion, so its normalization and
 * its keying are tested directly: a mismatch silently leaves the "(deleted
 * account)" marker on the person's own comments, and an unkeyed hash would make
 * the stored value guessable.
 */
describe('comment email link', () => {
  it('normalizes surrounding space and case', () => {
    expect(normalizeEmail('  Anatoly.Makeyev@GMAIL.com ')).toBe('anatoly.makeyev@gmail.com')
  })

  it('produces a stable, case-insensitive keyed hash', () => {
    vi.stubEnv('BETTER_AUTH_SECRET', SECRET)
    expect(emailLinkHash(' Anatoly@Example.com ', SECRET)).toBe(
      emailLinkHash('anatoly@example.com', SECRET),
    )
  })

  it('changes with the secret, so a deployment secret is what authorizes a match', () => {
    expect(emailLinkHash(EMAIL, SECRET)).not.toBe(emailLinkHash(EMAIL, `${SECRET}-other`))
  })
})

describe('linkCommentsToAccount', () => {
  const hash = emailLinkHash(EMAIL, SECRET)
  const ids = {
    owned: new ObjectId(),
    spaced: new ObjectId(),
    replyOther: new ObjectId(),
    replyByOld: new ObjectId(),
    legacy: new ObjectId(),
  }

  function comment(overrides: Record<string, unknown>) {
    return {
      articleSlug: 'track-types',
      userId: OLD_ID,
      emailHash: hash,
      userName: 'Anatoly Makeyev',
      userImage: null,
      parentId: null,
      parentUserId: null,
      body: 'body',
      createdAt: new Date(),
      editedAt: null,
      deletedAt: null,
      ...overrides,
    }
  }

  async function seed() {
    const collection = database.db!.collection('article_comments')
    await collection.insertMany([
      // The deleted author's own comment.
      comment({ _id: ids.owned }),
      // A different case and surrounding space in the address still match.
      comment({
        _id: ids.spaced,
        emailHash: emailLinkHash('  ANATOLY.MAKEYEV@GMAIL.COM ', SECRET),
      }),
      // Another person's comment replying to the deleted author's comment.
      comment({
        _id: ids.replyOther,
        userId: 'someone-else',
        emailHash: emailLinkHash('other@example.com', SECRET),
        parentUserId: OLD_ID,
      }),
      // The deleted author replying to someone else: the author moves, the
      // parent does not.
      comment({ _id: ids.replyByOld, parentUserId: 'someone-else' }),
    ])
  }

  it('moves a deleted account’s comments and the replies addressed to them', async () => {
    vi.stubEnv('BETTER_AUTH_SECRET', SECRET)
    await seed()

    const linked = await linkCommentsToAccount(NEW_ID, EMAIL)
    expect(linked).toBeGreaterThan(0)

    const collection = database.db!.collection('article_comments')
    expect((await collection.findOne({ _id: ids.owned }))?.userId).toBe(NEW_ID)
    expect((await collection.findOne({ _id: ids.spaced }))?.userId).toBe(NEW_ID)
    expect((await collection.findOne({ _id: ids.replyByOld }))?.userId).toBe(NEW_ID)
    expect((await collection.findOne({ _id: ids.replyByOld }))?.parentUserId).toBe(
      'someone-else',
    )
    // The reply's author is untouched; only who it replies TO changed.
    expect((await collection.findOne({ _id: ids.replyOther }))?.userId).toBe('someone-else')
    expect((await collection.findOne({ _id: ids.replyOther }))?.parentUserId).toBe(NEW_ID)
  })

  it('never moves comments owned by an account that still exists', async () => {
    vi.stubEnv('BETTER_AUTH_SECRET', SECRET)
    await database.db!
      .collection('user')
      .insertOne({ _id: new ObjectId(OLD_ID), email: 'changed@example.com' })
    await seed()

    expect(await linkCommentsToAccount(NEW_ID, EMAIL)).toBe(0)
    const owned = await database.db!
      .collection('article_comments')
      .findOne({ _id: ids.owned })
    expect(owned?.userId).toBe(OLD_ID)
  })

  it('ignores comments hashed from another address', async () => {
    vi.stubEnv('BETTER_AUTH_SECRET', SECRET)
    await seed()

    expect(await linkCommentsToAccount(NEW_ID, 'different@example.com')).toBe(0)
    const owned = await database.db!
      .collection('article_comments')
      .findOne({ _id: ids.owned })
    expect(owned?.userId).toBe(OLD_ID)
  })

  it('does nothing for a legacy comment with no stored hash', async () => {
    vi.stubEnv('BETTER_AUTH_SECRET', SECRET)
    await database.db!
      .collection('article_comments')
      .insertOne(comment({ _id: ids.legacy, emailHash: null }))

    expect(await linkCommentsToAccount(NEW_ID, EMAIL)).toBe(0)
  })

  it('stores no link at all when the deployment has no auth secret', async () => {
    vi.stubEnv('BETTER_AUTH_SECRET', '')
    vi.stubEnv('NODE_ENV', 'production')
    await seed()

    expect(await linkCommentsToAccount(NEW_ID, EMAIL)).toBe(0)
  })
})
