import { ObjectId, type WithId } from 'mongodb'
import { getDb } from '../auth/mongo'

/**
 * Mongo access for article comments.
 *
 * Authorization is per-caller, not per-role-in-the-UI: reads expose only what
 * the viewer may act on, deletes are scoped by the session's user id unless the
 * viewer is an admin, and a soft-deleted body is never sent to a client.
 *
 * Threading: `parentId` holds the direct parent (arbitrary depth), and
 * `parentUserId` is denormalized at write time so the "replies to you" list
 * needs no join. `userName`/`userImage` are denormalized for the same reason:
 * a comment shows the name and avatar the author had WHEN THEY POSTED, and does
 * not retroactively change if they later rename themselves. That staleness is
 * the deliberate tradeoff for not joining on every list render.
 */

const COLLECTION = 'article_comments'

export interface CommentDoc {
  articleSlug: string
  userId: string
  userName: string
  userImage: string | null
  parentId: ObjectId | null
  parentUserId: string | null
  body: string
  createdAt: Date
  editedAt: Date | null
  deletedAt: Date | null
}

export interface CommentViewer {
  userId: string
  isAdmin: boolean
}

/** The client-facing comment. The author's user id is never included. */
export interface ArticleComment {
  id: string
  parentId: string | null
  userName: string
  userImage: string | null
  /** Empty string once the comment is soft-deleted. */
  body: string
  createdAt: Date
  editedAt: Date | null
  deleted: boolean
  mine: boolean
  canDelete: boolean
}

export interface ReplyToUser {
  id: string
  articleSlug: string
  parentId: string | null
  userName: string
  body: string
  createdAt: Date
}

function toComment(doc: WithId<CommentDoc>, viewer: CommentViewer): ArticleComment {
  const deleted = doc.deletedAt !== null
  const mine = doc.userId === viewer.userId
  return {
    id: doc._id.toHexString(),
    parentId: doc.parentId ? doc.parentId.toHexString() : null,
    userName: doc.userName,
    userImage: doc.userImage,
    // A soft-deleted body is withheld from every client, admin included: the
    // deletion is a promise to the author, not a UI-level hide.
    body: deleted ? '' : doc.body,
    createdAt: doc.createdAt,
    editedAt: doc.editedAt,
    deleted,
    mine,
    canDelete: mine || viewer.isAdmin,
  }
}

let indexesEnsured: Promise<void> | null = null

function ensureIndexes(): Promise<void> {
  if (!indexesEnsured) {
    indexesEnsured = getDb()
      .then((db) =>
        db.collection<CommentDoc>(COLLECTION).createIndexes([
          { key: { articleSlug: 1, createdAt: 1 } },
          { key: { parentId: 1 } },
          { key: { userId: 1 } },
          { key: { parentUserId: 1, createdAt: -1 } },
        ]),
      )
      .then(() => undefined)
      .catch((error: unknown) => {
        indexesEnsured = null
        throw error
      })
  }
  return indexesEnsured
}

/** Every comment on an article, oldest first, so the client can build the tree. */
export async function listComments(
  articleSlug: string,
  viewer: CommentViewer,
): Promise<ArticleComment[]> {
  await ensureIndexes()
  const db = await getDb()
  const docs = await db
    .collection<CommentDoc>(COLLECTION)
    .find({ articleSlug })
    .sort({ createdAt: 1 })
    .toArray()
  return docs.map((doc) => toComment(doc, viewer))
}

export type CreateCommentResult =
  | { ok: true; comment: ArticleComment }
  | { ok: false; reason: 'parent_not_found' }

export async function createComment(
  articleSlug: string,
  viewer: CommentViewer,
  author: { name: string; image: string | null },
  input: { body: string; parentId?: string | null },
): Promise<CreateCommentResult> {
  await ensureIndexes()
  const db = await getDb()
  const collection = db.collection<CommentDoc>(COLLECTION)

  // A reply target must exist, be on the SAME article and not itself be
  // deleted: otherwise a comment could be attached to an unrelated thread, or
  // resurrect a removed one.
  let parent: WithId<CommentDoc> | null = null
  if (input.parentId) {
    if (!ObjectId.isValid(input.parentId)) return { ok: false, reason: 'parent_not_found' }
    parent = await collection.findOne({
      _id: new ObjectId(input.parentId),
      articleSlug,
      deletedAt: null,
    })
    if (!parent) return { ok: false, reason: 'parent_not_found' }
  }

  const doc: CommentDoc = {
    articleSlug,
    userId: viewer.userId,
    userName: author.name,
    userImage: author.image,
    parentId: parent ? parent._id : null,
    parentUserId: parent ? parent.userId : null,
    body: input.body,
    createdAt: new Date(),
    editedAt: null,
    deletedAt: null,
  }
  const result = await collection.insertOne(doc)
  return { ok: true, comment: toComment({ ...doc, _id: result.insertedId }, viewer) }
}

/**
 * Edits the caller's OWN comment. Returns false when the id is malformed, is
 * not theirs, or is already deleted - all indistinguishable to the caller.
 */
export async function editComment(id: string, userId: string, body: string): Promise<boolean> {
  if (!ObjectId.isValid(id)) return false
  await ensureIndexes()
  const db = await getDb()
  const result = await db.collection<CommentDoc>(COLLECTION).updateOne(
    { _id: new ObjectId(id), userId, deletedAt: null },
    { $set: { body, editedAt: new Date() } },
  )
  return result.modifiedCount === 1
}

/**
 * Soft-deletes a comment, keeping the subtree intact: the body is cleared and
 * `deletedAt` set, but the document (and so its replies' parent links) stays.
 * The owner may delete their own; an admin may delete any.
 */
export async function softDeleteComment(id: string, viewer: CommentViewer): Promise<boolean> {
  if (!ObjectId.isValid(id)) return false
  await ensureIndexes()
  const db = await getDb()
  const result = await db.collection<CommentDoc>(COLLECTION).updateOne(
    {
      _id: new ObjectId(id),
      deletedAt: null,
      ...(viewer.isAdmin ? {} : { userId: viewer.userId }),
    },
    { $set: { body: '', deletedAt: new Date() } },
  )
  return result.modifiedCount === 1
}

/**
 * Comments that reply to one of the caller's own comments, newest first.
 *
 * Self-replies are included on purpose: replying to your own comment is still
 * a reply to your comment, and this feed is the only place it shows up. An
 * earlier version excluded them (`userId != parentUserId`), which silently hid
 * every reply a user made inside their own thread.
 */
export async function listRepliesToUser(userId: string, limit = 20): Promise<ReplyToUser[]> {
  await ensureIndexes()
  const db = await getDb()
  const docs = await db
    .collection<CommentDoc>(COLLECTION)
    .find({ parentUserId: userId, deletedAt: null })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray()
  return docs.map((doc) => ({
    id: doc._id.toHexString(),
    articleSlug: doc.articleSlug,
    parentId: doc.parentId ? doc.parentId.toHexString() : null,
    userName: doc.userName,
    body: doc.body,
    createdAt: doc.createdAt,
  }))
}
