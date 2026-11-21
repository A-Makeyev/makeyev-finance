import { ObjectId, type WithId } from 'mongodb'
import { getDb } from '../auth/mongo'
import { normalizeMixLabel } from '../mixes/label'
import {
  MAX_SAVED_REFINANCES,
  normalizeRefinanceSnapshot,
  type RefinanceSnapshotInput,
  type SavedRefinanceInput,
  type StoredRefinanceSnapshotInput,
} from './schema'

/**
 * Mongo access for saved refinance proposals. Every function takes the caller's
 * user id and scopes its query by it, so a guessed or incremented document id
 * can never reach another user's saved proposal.
 *
 * Mirrors the saved-comparison repo deliberately: same owner scoping, same
 * duplicate-name rule, same cap refusal instead of silent eviction.
 */

const COLLECTION = 'saved_refinances'

export interface SavedRefinanceDoc {
  userId: string
  label: string
  /** Version 1 is still present in older documents and is normalized on read. */
  snapshot: StoredRefinanceSnapshotInput
  createdAt: Date
  updatedAt: Date
}

/** The client-facing shape: `_id`/`userId` (internal) become `id`. */
export interface SavedRefinance {
  id: string
  label: string
  snapshot: RefinanceSnapshotInput
  createdAt: Date
  updatedAt: Date
}

function toSavedRefinance(doc: WithId<SavedRefinanceDoc>): SavedRefinance {
  return {
    id: doc._id.toHexString(),
    label: doc.label,
    snapshot: normalizeRefinanceSnapshot(doc.snapshot),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }
}

let indexesEnsured: Promise<void> | null = null

function ensureIndexes(): Promise<void> {
  if (!indexesEnsured) {
    indexesEnsured = getDb()
      .then((db) =>
        db
          .collection<SavedRefinanceDoc>(COLLECTION)
          .createIndex({ userId: 1, createdAt: -1 }),
      )
      .then(() => undefined)
      .catch((error: unknown) => {
        indexesEnsured = null
        throw error
      })
  }
  return indexesEnsured
}

/** The caller's own saved refinance proposals, newest first. */
export async function listSavedRefinances(userId: string): Promise<SavedRefinance[]> {
  await ensureIndexes()
  const db = await getDb()
  const docs = await db
    .collection<SavedRefinanceDoc>(COLLECTION)
    .find({ userId })
    .sort({ createdAt: -1 })
    .toArray()
  return docs.map(toSavedRefinance)
}

export type SaveRefinanceResult =
  | { ok: true; refinance: SavedRefinance }
  | { ok: false; reason: 'cap' }
  | { ok: false; reason: 'duplicate' }

/** Whether the caller already has a proposal with this name. */
async function labelTaken(userId: string, label: string, exceptId?: string): Promise<boolean> {
  const db = await getDb()
  const docs = await db
    .collection<SavedRefinanceDoc>(COLLECTION)
    .find({ userId }, { projection: { _id: 1, label: 1 } })
    .toArray()
  const wanted = normalizeMixLabel(label)
  return docs.some(
    (doc) => doc._id.toHexString() !== exceptId && normalizeMixLabel(doc.label) === wanted,
  )
}

/**
 * Stores one proposal for the caller, unless the per-user cap is reached or the
 * name is already taken. A cap is refused rather than evicting the oldest:
 * silently deleting saved work is worse than asking the user to remove one.
 */
export async function createSavedRefinance(
  userId: string,
  input: SavedRefinanceInput,
): Promise<SaveRefinanceResult> {
  await ensureIndexes()
  const db = await getDb()
  const collection = db.collection<SavedRefinanceDoc>(COLLECTION)

  const count = await collection.countDocuments({ userId })
  if (count >= MAX_SAVED_REFINANCES) return { ok: false, reason: 'cap' }
  if (await labelTaken(userId, input.label)) return { ok: false, reason: 'duplicate' }

  const now = new Date()
  const doc: SavedRefinanceDoc = {
    userId,
    label: input.label,
    snapshot: input.snapshot,
    createdAt: now,
    updatedAt: now,
  }
  const result = await collection.insertOne(doc)
  return { ok: true, refinance: toSavedRefinance({ ...doc, _id: result.insertedId }) }
}

export type UpdateRefinanceResult =
  | { ok: true; refinance: SavedRefinance }
  | { ok: false; reason: 'not_found' | 'duplicate' }

/**
 * Overwrites one of the caller's own proposals. Returns not_found for a
 * malformed or foreign id, so the endpoint cannot be used to probe which ids
 * exist. An update uses no new slot, so it is never blocked by the cap.
 */
export async function updateSavedRefinance(
  userId: string,
  id: string,
  input: SavedRefinanceInput,
): Promise<UpdateRefinanceResult> {
  if (!ObjectId.isValid(id)) return { ok: false, reason: 'not_found' }
  await ensureIndexes()
  const db = await getDb()
  if (await labelTaken(userId, input.label, id)) return { ok: false, reason: 'duplicate' }
  const updated = await db.collection<SavedRefinanceDoc>(COLLECTION).findOneAndUpdate(
    { _id: new ObjectId(id), userId },
    {
      $set: {
        label: input.label,
        snapshot: input.snapshot,
        updatedAt: new Date(),
      },
    },
    { returnDocument: 'after' },
  )
  return updated
    ? { ok: true, refinance: toSavedRefinance(updated) }
    : { ok: false, reason: 'not_found' }
}

/** Deletes one of the caller's own proposals. */
export async function deleteSavedRefinance(userId: string, id: string): Promise<boolean> {
  if (!ObjectId.isValid(id)) return false
  await ensureIndexes()
  const db = await getDb()
  const result = await db
    .collection<SavedRefinanceDoc>(COLLECTION)
    .deleteOne({ _id: new ObjectId(id), userId })
  return result.deletedCount === 1
}
