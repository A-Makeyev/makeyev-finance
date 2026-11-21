import { ObjectId, type WithId } from 'mongodb'
import { getDb } from '../auth/mongo'
import { normalizeMixLabel } from '../mixes/label'
import {
  MAX_SAVED_COMPARISONS,
  type ComparisonSnapshotInput,
  type SavedComparisonInput,
} from './schema'

/**
 * Mongo access for saved comparisons. Every function takes the caller's user id
 * and scopes its query by it, so a guessed or incremented document id can never
 * reach another user's saved comparison.
 *
 * Mirrors the saved-mix repo deliberately: same owner scoping, same
 * duplicate-name rule, same cap refusal instead of silent eviction, same
 * string user id as Better Auth reports it.
 */

const COLLECTION = 'saved_comparisons'

export interface SavedComparisonDoc {
  userId: string
  label: string
  snapshot: ComparisonSnapshotInput
  createdAt: Date
  updatedAt: Date
}

/** The client-facing shape: `_id`/`userId` (internal) become `id`. */
export interface SavedComparison {
  id: string
  label: string
  snapshot: ComparisonSnapshotInput
  createdAt: Date
  updatedAt: Date
}

function toSavedComparison(doc: WithId<SavedComparisonDoc>): SavedComparison {
  return {
    id: doc._id.toHexString(),
    label: doc.label,
    snapshot: doc.snapshot,
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
          .collection<SavedComparisonDoc>(COLLECTION)
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

/** The caller's own saved comparisons, newest first. */
export async function listSavedComparisons(userId: string): Promise<SavedComparison[]> {
  await ensureIndexes()
  const db = await getDb()
  const docs = await db
    .collection<SavedComparisonDoc>(COLLECTION)
    .find({ userId })
    .sort({ createdAt: -1 })
    .toArray()
  return docs.map(toSavedComparison)
}

export type SaveComparisonResult =
  | { ok: true; comparison: SavedComparison }
  | { ok: false; reason: 'cap' }
  | { ok: false; reason: 'duplicate' }

/** Whether the caller already has a comparison with this name. */
async function labelTaken(userId: string, label: string, exceptId?: string): Promise<boolean> {
  const db = await getDb()
  const docs = await db
    .collection<SavedComparisonDoc>(COLLECTION)
    .find({ userId }, { projection: { _id: 1, label: 1 } })
    .toArray()
  const wanted = normalizeMixLabel(label)
  return docs.some(
    (doc) => doc._id.toHexString() !== exceptId && normalizeMixLabel(doc.label) === wanted,
  )
}

/**
 * Stores one comparison for the caller, unless the per-user cap is reached or
 * the name is already taken. A cap is refused rather than evicting the oldest:
 * silently deleting saved work is worse than asking the user to remove one.
 */
export async function createSavedComparison(
  userId: string,
  input: SavedComparisonInput,
): Promise<SaveComparisonResult> {
  await ensureIndexes()
  const db = await getDb()
  const collection = db.collection<SavedComparisonDoc>(COLLECTION)

  const count = await collection.countDocuments({ userId })
  if (count >= MAX_SAVED_COMPARISONS) return { ok: false, reason: 'cap' }
  if (await labelTaken(userId, input.label)) return { ok: false, reason: 'duplicate' }

  const now = new Date()
  const doc: SavedComparisonDoc = {
    userId,
    label: input.label,
    snapshot: input.snapshot,
    createdAt: now,
    updatedAt: now,
  }
  const result = await collection.insertOne(doc)
  return { ok: true, comparison: toSavedComparison({ ...doc, _id: result.insertedId }) }
}

export type UpdateComparisonResult =
  | { ok: true; comparison: SavedComparison }
  | { ok: false; reason: 'not_found' | 'duplicate' }

/**
 * Overwrites one of the caller's own comparisons. Returns not_found for a
 * malformed or foreign id, so the endpoint cannot be used to probe which ids
 * exist. An update uses no new slot, so it is never blocked by the cap.
 */
export async function updateSavedComparison(
  userId: string,
  id: string,
  input: SavedComparisonInput,
): Promise<UpdateComparisonResult> {
  if (!ObjectId.isValid(id)) return { ok: false, reason: 'not_found' }
  await ensureIndexes()
  const db = await getDb()
  if (await labelTaken(userId, input.label, id)) return { ok: false, reason: 'duplicate' }
  const updated = await db.collection<SavedComparisonDoc>(COLLECTION).findOneAndUpdate(
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
    ? { ok: true, comparison: toSavedComparison(updated) }
    : { ok: false, reason: 'not_found' }
}

/** Deletes one of the caller's own comparisons. */
export async function deleteSavedComparison(userId: string, id: string): Promise<boolean> {
  if (!ObjectId.isValid(id)) return false
  await ensureIndexes()
  const db = await getDb()
  const result = await db
    .collection<SavedComparisonDoc>(COLLECTION)
    .deleteOne({ _id: new ObjectId(id), userId })
  return result.deletedCount === 1
}
